import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 128,
    system: `You are a nutrition expert. Given a food description, return ONLY valid JSON with these fields:
{ "kcal": number, "p": number, "c": number, "f": number }
where p=protein(g), c=carbs(g), f=fat(g). Be realistic. Output JSON only.`,
    messages: [{ role: "user", content: text }],
  });

  try {
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
