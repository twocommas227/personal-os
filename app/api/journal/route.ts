import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";
const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ??
    new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  // Get daily entry from daily_logs
  const { data: log } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  let entry = "";
  try { entry = log?.notes ? JSON.parse(log.notes as string)?.journal ?? "" : ""; } catch {}

  // Get Telegram captures for that day (journal/note/idea/decision)
  const start = `${date}T00:00:00+07:00`;
  const end   = `${date}T23:59:59+07:00`;

  const { data: captures } = await db
    .from("raw_captures")
    .select("id, raw_text, routed_to, created_at, audio_url")
    .eq("user_id", USER_ID)
    .in("routed_to", ["journal", "note", "idea", "decision"])
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  return NextResponse.json({ date, entry, captures: captures ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, entry } = await req.json();

  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try { notes = existing?.notes ? JSON.parse(existing.notes as string) : {}; } catch {}
  notes.journal = entry;

  await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: date, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );

  return NextResponse.json({ ok: true });
}
