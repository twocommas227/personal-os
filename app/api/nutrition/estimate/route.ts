import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/supabase";

function extractFirstJSON(text: string): string | null {
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") { depth--; if (depth === 0 && start !== -1) return text.slice(start, i + 1); }
  }
  return null;
}

const USER_ID = process.env.USER_ID ?? "josh";

async function checkFoodBank(query: string): Promise<{ kcal: number; p: number; c: number; f: number } | null> {
  const { data } = await db
    .from("food_bank")
    .select("kcal, p, c, f, name, aliases")
    .eq("user_id", USER_ID);
  if (!data?.length) return null;

  const lower = query.toLowerCase();
  const match = data.find((item) => {
    if (item.name.toLowerCase().includes(lower) || lower.includes(item.name.toLowerCase())) return true;
    return (item.aliases ?? []).some((a: string) =>
      lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower)
    );
  });
  return match ? { kcal: Number(match.kcal), p: Number(match.p), c: Number(match.c), f: Number(match.f) } : null;
}

// Only match food bank for single-item queries (no commas or "and" separating multiple foods)
function looksLikeSingleItem(text: string): boolean {
  return !text.includes(",") && !/\band\b/i.test(text);
}

// Parse a leading quantity/unit prefix and return the multiplier + bare food name
function parseQuantity(text: string): { multiplier: number; foodName: string } {
  // "3x food" or "3 X food" or "3× food"
  let m = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s+(.+)/);
  if (m) return { multiplier: parseFloat(m[1]), foodName: m[2].trim() };

  // "1/2 [unit] food" — fractional with optional unit
  m = text.match(/^(\d+)\/(\d+)\s+(?:cups?|scoops?|servings?|tbsp|tsp|pieces?|slices?)?\s*(?:of\s+)?(.+)/i);
  if (m) return { multiplier: parseInt(m[1]) / parseInt(m[2]), foodName: m[3].trim() };

  // "3 scoops/cups/servings [of] food"
  m = text.match(/^(\d+(?:\.\d+)?)\s+(?:cups?|scoops?|servings?|tbsp|tsp|pieces?|slices?)\s+(?:of\s+)?(.+)/i);
  if (m) return { multiplier: parseFloat(m[1]), foodName: m[2].trim() };

  // "half [a] food" / "double food"
  m = text.match(/^half\s+(?:a\s+)?(.+)/i);
  if (m) return { multiplier: 0.5, foodName: m[1].trim() };
  m = text.match(/^double\s+(.+)/i);
  if (m) return { multiplier: 2, foodName: m[1].trim() };

  return { multiplier: 1, foodName: text };
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const text = body?.text?.trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

    // Parse leading quantity prefix ("3 scoops Yogurt", "2x Oats", "half Banana", etc.)
    const { multiplier, foodName } = parseQuantity(text);

    // Only check food bank for single-item inputs — prevents partial matches on multi-ingredient descriptions
    if (looksLikeSingleItem(foodName)) {
      const banked = await checkFoodBank(foodName).catch(() => null);
      if (banked) return NextResponse.json({
        kcal: Math.round(banked.kcal * multiplier),
        p: Math.round(banked.p * multiplier * 10) / 10,
        c: Math.round(banked.c * multiplier * 10) / 10,
        f: Math.round(banked.f * multiplier * 10) / 10,
        fromBank: true,
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const client = new Anthropic({ apiKey });

    const SYSTEM = `You are a nutrition expert. Given a food or meal description, return ONLY valid JSON:
{ "kcal": number, "p": number, "c": number, "f": number }
where p=protein(g), c=carbs(g), f=fat(g).

Rules:
- ADD UP nutrition for ALL ingredients combined — never return less than the sum of parts
- Use generous, realistic serving sizes — err on the side of larger portions
- When the unit is "scoop" for yogurt, assume a large ice-cream-style scoop ~150-170g
- Greek yogurt (per 170g): ~100 kcal, 17g protein, 6g carbs, 0g fat
- Regular yogurt (per 170g): ~100 kcal, 6g protein, 13g carbs, 2g fat
- 1 scoop whey protein powder: ~120 kcal, 24g protein, 3g carbs, 1g fat
- 1 medium banana: ~105 kcal, 1g protein, 27g carbs, 0g fat
- 1/2 cup oats (dry): ~150 kcal, 5g protein, 27g carbs, 3g fat
- 1 tbsp honey: ~64 kcal, 0g protein, 17g carbs, 0g fat
- 1 whole egg: ~70 kcal, 6g protein, 0g carbs, 5g fat
Output JSON only, no markdown.`;

    // Retry up to 3 times on 529 overload errors
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1000));
        const msg = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
          max_tokens: 256,
          system: SYSTEM,
          messages: [{ role: "user", content: text }],
        });
        const text2 = (msg.content[0] as { type: string; text: string }).text;
        const jsonStr = extractFirstJSON(text2);
        if (!jsonStr) throw new Error("No JSON in response");
        return NextResponse.json(JSON.parse(jsonStr));
      } catch (err: unknown) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        if (status !== 529 && status !== 503) break; // only retry on overload
      }
    }

    console.error("[nutrition/estimate]", lastErr);
    const isOverload = (lastErr as { status?: number })?.status === 529;
    return NextResponse.json(
      { error: isOverload ? "AI is busy — try again in a moment" : String(lastErr) },
      { status: isOverload ? 503 : 500 }
    );
  } catch (err) {
    console.error("[nutrition/estimate]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
