import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, kcal } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 128,
    system: `You are a nutrition expert. Given a food name and a calorie target, return realistic macros that sum to approximately that calorie count (kcal = 4*p + 4*c + 9*f). Return ONLY valid JSON: { "p": number, "c": number, "f": number }. Output JSON only.`,
    messages: [{ role: "user", content: `Food: "${name}", Target kcal: ${kcal}` }],
  });

  try {
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
