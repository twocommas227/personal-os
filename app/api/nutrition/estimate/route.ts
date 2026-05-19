import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const text = body?.text?.trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 128,
      system: `You are a nutrition expert. Given a food description, return ONLY valid JSON with these fields:
{ "kcal": number, "p": number, "c": number, "f": number }
where p=protein(g), c=carbs(g), f=fat(g). Be realistic. Output JSON only, no markdown.`,
      messages: [{ role: "user", content: text }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
      .replace(/^```json?\n?/, "").replace(/```$/, "").trim();

    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[nutrition/estimate]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
