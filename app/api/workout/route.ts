import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { PROGRAMS, nextProgramKey } from "@/lib/workouts";

const USER_ID = process.env.USER_ID ?? "josh";
const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";

function todayTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Find the most recent daily_log that has notes.workout.program set. */
async function getLastWorkout(): Promise<{ program: "A" | "B" | "C"; date: string } | null> {
  // Look back 60 days to find the last logged workout
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toLocaleDateString("en-CA");

  const { data } = await db
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", USER_ID)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: false })
    .limit(60);

  if (!data) return null;

  for (const row of data) {
    try {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
      const prog = notes?.workout?.program;
      if (prog && ["A", "B", "C"].includes(prog)) {
        return { program: prog as "A" | "B" | "C", date: row.log_date };
      }
    } catch {}
  }
  return null;
}

/** Save today's workout program to daily_logs. Merges with existing notes. */
export async function saveWorkoutProgram(programKey: "A" | "B" | "C", date?: string) {
  const logDate = date ?? todayTZ();
  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", logDate)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try {
    notes = existing?.notes ? JSON.parse(existing.notes as string) : {};
  } catch {}

  notes.workout = { program: programKey, date: logDate };

  await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: logDate, notes: JSON.stringify(notes) },
    { onConflict: "user_id,log_date" }
  );
}

/** GET /api/workout — returns next program and last workout info. */
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const last = await getLastWorkout();
  const nextKey = nextProgramKey(last?.program ?? null);
  const program = PROGRAMS[nextKey];

  // Find the last time THIS program was done (for "last done" label)
  const since = new Date();
  since.setDate(since.getDate() - 120);
  const sinceStr = since.toLocaleDateString("en-CA");

  const { data } = await db
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", USER_ID)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: false })
    .limit(120);

  let lastThisDate: string | null = null;
  for (const row of data ?? []) {
    try {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
      if (notes?.workout?.program === nextKey) {
        lastThisDate = row.log_date;
        break;
      }
    } catch {}
  }

  return NextResponse.json({
    program,
    nextKey,
    lastDone: last,
    lastThisProgramDate: lastThisDate,
  });
}

/** POST /api/workout — mark today's workout program (called when workout is sent via Telegram). */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const programKey = body.programKey as "A" | "B" | "C" | undefined;
  const date = body.date as string | undefined;

  if (!programKey || !["A", "B", "C"].includes(programKey)) {
    return NextResponse.json({ error: "programKey A/B/C required" }, { status: 400 });
  }

  await saveWorkoutProgram(programKey, date);
  return NextResponse.json({ ok: true, programKey, date: date ?? todayTZ() });
}
