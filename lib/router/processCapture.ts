import { db } from "@/lib/supabase";
import { classifyCapture } from "./classifyCapture";
import { embedText } from "@/lib/embed";

const USER_ID = process.env.USER_ID ?? "josh";

interface CaptureInput {
  text: string;
  source: "telegram" | "web" | "shortcut";
  audioUrl?: string;
}

export async function processCapture(input: CaptureInput) {
  const { text, source, audioUrl } = input;

  // 1. Classify
  const classification = await classifyCapture(text);

  // 2. Write raw capture
  const { data: capture, error: captureErr } = await db
    .from("raw_captures")
    .insert({
      user_id: USER_ID,
      source,
      raw_text: text,
      audio_url: audioUrl ?? null,
      classification,
      llm_source: classification.llm_source,
      routed_to: classification.kind,
    })
    .select("id")
    .single();

  if (captureErr || !capture) {
    console.error("[processCapture] raw_captures insert failed:", captureErr);
    throw new Error("Failed to save capture");
  }

  // 3. Route to downstream table
  let routedId: string | null = null;

  if (classification.kind === "task") {
    const { data: task } = await db
      .from("tasks")
      .insert({
        user_id: USER_ID,
        title: classification.summary,
        description: text,
        urgency: classification.urgency,
        tags: classification.tags,
        entity_id: null,
        priority_score: 0,
      })
      .select("id")
      .single();
    routedId = task?.id ?? null;

    // Update raw_capture with routed_id
    if (routedId) {
      await db.from("raw_captures").update({ routed_id: routedId }).eq("id", capture.id);
    }
  }

  // For journal/note/idea/decision — stored in raw_captures only for now.
  // Will expand when journal card is built.

  // 4. Embed and write to memory_chunks
  try {
    const embedding = await embedText(text);
    await db.from("memory_chunks").insert({
      user_id: USER_ID,
      source_type: classification.kind,
      source_id: routedId ?? capture.id,
      text,
      embedding,
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.error("[processCapture] embedding failed:", err);
  }

  // 5. Audit log
  await db.from("audit_log").insert({
    user_id: USER_ID,
    action: "capture",
    resource_type: classification.kind,
    resource_id: routedId ?? capture.id,
    metadata: { source, llm_source: classification.llm_source },
  });

  return { classification, captureId: capture.id, routedId };
}
