import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  const { done } = await req.json() as { done: string[] };

  // Read existing notes so we don't clobber other fields (nutrition, goals, etc.)
  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try {
    notes = existing?.notes ? JSON.parse(existing.notes as string) : {};
  } catch {
    notes = {};
  }

  notes.habits = { done, total: done.length };

  const { error } = await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: date, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
