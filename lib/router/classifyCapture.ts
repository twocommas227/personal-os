import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface Classification {
  kind: "task" | "note" | "journal" | "decision" | "idea";
  urgency: "today" | "this_week" | "this_month" | "someday";
  entity_id: string | null;
  tags: string[];
  summary: string;
  llm_source: string;
}

const SYSTEM = `You are a personal assistant classifying a voice or text capture.
Return ONLY valid JSON matching this schema:
{
  "kind": "task" | "note" | "journal" | "decision" | "idea",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "entity_id": null,
  "tags": string[],
  "summary": string
}
Rules:
- kind=task if the capture is something to do
- kind=journal if it's a personal reflection or how you feel
- kind=note for reference info
- kind=decision for a choice made
- kind=idea for future possibilities
- urgency based on time language in the text
- summary is one concise sentence
- entity_id is always null (no lookup at this stage)
- tags: 1-3 lowercase keywords`;

export async function classifyCapture(text: string): Promise<Classification> {
  // Try Anthropic first
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(raw);
    return { ...parsed, llm_source: "anthropic" };
  } catch (err) {
    console.error("[classify] Anthropic failed:", err);
  }

  // Fallback to OpenAI
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      max_tokens: 256,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
    return { ...parsed, llm_source: "openai" };
  } catch (err) {
    console.error("[classify] OpenAI failed:", err);
  }

  // Last resort: regex heuristics
  const lower = text.toLowerCase();
  const urgency = lower.includes("today") || lower.includes("asap")
    ? "today"
    : lower.includes("this week")
    ? "this_week"
    : lower.includes("this month")
    ? "this_month"
    : "someday";
  const kind = lower.includes("feel") || lower.includes("today was")
    ? "journal"
    : lower.includes("idea") || lower.includes("what if")
    ? "idea"
    : "task";

  return {
    kind,
    urgency,
    entity_id: null,
    tags: [],
    summary: text.slice(0, 80),
    llm_source: "regex",
  };
}
