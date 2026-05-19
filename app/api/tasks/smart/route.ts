import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const USER_ID = process.env.USER_ID ?? "josh";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = await req.json();

  // Fetch all open tasks
  const { data: tasks } = await db
    .from("tasks")
    .select("id, title, description, urgency, key, tags")
    .eq("user_id", USER_ID)
    .is("completed_at", null)
    .limit(200);

  if (!tasks?.length) return NextResponse.json([]);

  const taskList = tasks.map((t) => `${t.id}: [${t.urgency}] ${t.title}`).join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 256,
    system: `You are a task search assistant. Given a natural language query and a list of tasks, return ONLY a JSON array of matching task IDs (UUIDs). Return at most 10 results. Return [] if nothing matches. Output JSON only.`,
    messages: [{ role: "user", content: `Query: "${query}"\n\nTasks:\n${taskList}` }],
  });

  try {
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const ids: string[] = JSON.parse(raw);
    const matched = tasks.filter((t) => ids.includes(t.id));
    return NextResponse.json(matched);
  } catch {
    return NextResponse.json([]);
  }
}
