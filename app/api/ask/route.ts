import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { processCapture } from "@/lib/router/processCapture";
import { getProgram, nextProgramKey } from "@/lib/workouts";

export const maxDuration = 60;

const USER_ID = process.env.USER_ID ?? "josh";
const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";
const SENTINEL = "2000-01-01"; // goals live on a fixed date so they never roll over

interface GoalItem {
  id: string;
  text: string;
  done: boolean;
}

interface Meal {
  id?: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

function todayTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/**
 * Everything Julie is allowed to know, gathered in one pass and rendered as
 * plain text. Kept compact deliberately — this is prompt budget, not a dump.
 */
async function gatherContext(req: NextRequest): Promise<string> {
  const today = todayTZ();
  const nowLabel = new Date().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  });

  const [tasksRes, logRes, goalsRes, remindersRes] = await Promise.all([
    db.from("tasks")
      .select("title, urgency, context, key, time_estimate_min, due_date")
      .eq("user_id", USER_ID)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
    db.from("daily_logs")
      .select("log_date, notes")
      .eq("user_id", USER_ID)
      .gte("log_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .order("log_date", { ascending: false })
      .limit(8),
    db.from("daily_logs")
      .select("notes")
      .eq("user_id", USER_ID)
      .eq("log_date", SENTINEL)
      .maybeSingle(),
    db.from("reminders")
      .select("message, remind_at")
      .eq("user_id", USER_ID)
      .is("sent_at", null)
      .order("remind_at", { ascending: true })
      .limit(15),
  ]);

  const parts: string[] = [`Right now it is ${nowLabel} (${TZ}). Today's date key is ${today}.`];

  // ── Tasks, grouped by context ──
  const tasks = tasksRes.data ?? [];
  if (tasks.length) {
    const byContext: Record<string, string[]> = {};
    for (const t of tasks) {
      const ctx = (t.context as string) ?? "personal";
      const bits = [
        t.key ? "[key]" : "",
        `${t.title}`,
        `(${String(t.urgency).replace("_", " ")}`,
        t.time_estimate_min ? `, ${t.time_estimate_min}m` : "",
        t.due_date ? `, due ${t.due_date}` : "",
        ")",
      ].join("");
      (byContext[ctx] ??= []).push(bits);
    }
    parts.push(
      "OPEN TASKS:\n" +
        Object.entries(byContext)
          .map(([ctx, list]) => `  ${ctx}:\n` + list.map((l) => `    - ${l}`).join("\n"))
          .join("\n")
    );
  } else {
    parts.push("OPEN TASKS: none.");
  }

  // ── Habits, weight and nutrition from the last week of daily logs ──
  const habitLines: string[] = [];
  const nutritionLines: string[] = [];
  for (const row of logRes.data ?? []) {
    let notes: Record<string, unknown> = {};
    try {
      notes = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes ?? {});
    } catch {}

    const habits = (notes.habits ?? {}) as {
      done?: string[]; exercise?: string[]; supplements?: string[];
      bad_habits?: string[]; weight_kg?: string;
    };
    const done = [...(habits.done ?? []), ...((habits.exercise ?? []).length ? ["Exercise"] : [])];
    habitLines.push(
      `  ${row.log_date}: ${done.length ? done.join(", ") : "nothing logged"}` +
        (habits.exercise?.length ? ` | exercise: ${habits.exercise.join(", ")}` : "") +
        (habits.weight_kg ? ` | weight ${habits.weight_kg}kg` : "") +
        (habits.bad_habits?.length ? ` | slipped: ${habits.bad_habits.join(", ")}` : "")
    );

    const meals = ((notes.nutrition as { meals?: Meal[] })?.meals ?? []).filter(
      (m) => !m.id?.startsWith("supplement::")
    );
    if (meals.length) {
      const kcal = Math.round(meals.reduce((s, m) => s + (m.kcal ?? 0), 0));
      const p = Math.round(meals.reduce((s, m) => s + (m.p ?? 0), 0));
      nutritionLines.push(
        `  ${row.log_date}: ${kcal} kcal, ${p}g protein — ${meals.map((m) => m.name).join(", ")}`
      );
    }
  }
  if (habitLines.length) parts.push("HABITS (last 7 days):\n" + habitLines.join("\n"));
  if (nutritionLines.length) parts.push("NUTRITION (last 7 days):\n" + nutritionLines.join("\n"));

  // ── Goals ──
  let goalNotes: Record<string, unknown> = {};
  try {
    goalNotes = goalsRes.data?.notes ? JSON.parse(goalsRes.data.notes as string) : {};
  } catch {}
  const week = (goalNotes.goals_week_items as GoalItem[]) ?? [];
  const month = (goalNotes.goals_month_items as GoalItem[]) ?? [];
  const fmtGoals = (g: GoalItem[]) =>
    g.length ? g.map((x) => `    - ${x.done ? "[done] " : ""}${x.text}`).join("\n") : "    none";
  parts.push(`GOALS:\n  this week:\n${fmtGoals(week)}\n  this month:\n${fmtGoals(month)}`);

  // ── Reminders ──
  const reminders = remindersRes.data ?? [];
  parts.push(
    reminders.length
      ? "UPCOMING REMINDERS:\n" +
          reminders
            .map(
              (r) =>
                `  - ${new Date(r.remind_at as string).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
                })} — ${r.message}`
            )
            .join("\n")
      : "UPCOMING REMINDERS: none."
  );

  // ── Next workout in the rotation ──
  try {
    let lastProgram: "A" | "B" | "C" | null = null;
    for (const row of logRes.data ?? []) {
      try {
        const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
        const prog = notes?.workout?.program;
        if (prog && ["A", "B", "C"].includes(prog)) { lastProgram = prog; break; }
      } catch {}
    }
    const nextKey = nextProgramKey(lastProgram);
    const program = await getProgram(nextKey);
    parts.push(
      `NEXT WORKOUT: Day ${nextKey} — ${program.focus}\n` +
        program.exercises
          .map((ex) => {
            const sets = ex.note
              ? ex.note
              : (ex.sets ?? [])
                  .map((s) => `${s.weight === null ? "BW" : s.weight + "kg"}x${s.reps}`)
                  .join(", ");
            return `  - ${ex.name}: ${sets}`;
          })
          .join("\n")
    );
  } catch {
    // workout context is a nice-to-have; never fail the whole answer for it
  }

  // ── Calendar ──
  try {
    const urls = [
      ...((process.env.GOOGLE_CALENDAR_ICAL_URL ?? "").split(",")),
      ...((process.env.APPLE_CALENDAR_ICAL_URL ?? "").split(",")),
    ].filter((u) => u.trim());
    if (urls.length) {
      // Reuse this request's own origin and cookie so /api/calendar authorises.
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
      {
        const res = await fetch(`${origin}/api/calendar`, {
          cache: "no-store",
          headers: { cookie: req.headers.get("cookie") ?? "" },
        });
        if (res.ok) {
          const events = (await res.json()) as {
            title: string; start: string; allDay: boolean; calendar: string; location?: string;
          }[];
          const soon = events
            .filter((e) => new Date(e.start).getTime() >= Date.now() - 3600_000)
            .slice(0, 20);
          if (soon.length) {
            parts.push(
              "UPCOMING CALENDAR:\n" +
                soon
                  .map(
                    (e) =>
                      `  - ${new Date(e.start).toLocaleString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
                      })} ${e.allDay ? "(all day)" : ""} ${e.title}` +
                      (e.location ? ` @ ${e.location}` : "")
                  )
                  .join("\n")
            );
          }
        }
      }
    }
  } catch {
    // calendar is best-effort — a dead feed must not break the answer
  }

  return parts.join("\n\n");
}

const SYSTEM = `You are Julie, Josh's personal chief of staff inside his Personal OS dashboard.

You are given a snapshot of his real data. Answer using ONLY that snapshot — never
invent tasks, events, numbers or history. If the snapshot doesn't contain the answer,
say plainly what you don't have and, when useful, name where it would come from.

Voice: warm, direct, brief. Write like a sharp colleague who already knows the context,
not a chatbot. No preamble, no "Based on your data", no restating the question.

Format: plain prose in 1-4 short sentences. Use a short dash-led list only when the
answer genuinely is a list of items. Never use markdown headings or bold. Keep numbers
exact. Refer to times in his timezone as given.

Josh runs three contexts: personal, Kritamorn (his business), and Two Commas (his
business). Respect those when a question is scoped to one.`;

function isQuestionLike(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.endsWith("?")) return true;
  return /^(what|when|where|who|why|how|which|is|are|am|do|does|did|can|could|should|will|would|have|has|tell me|show me|give me|list|remind me what|how many|how much)\b/.test(
    t
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Julie isn't configured — missing API key" }, { status: 500 });
  }

  // Not a question → fall through to the existing capture pipeline unchanged.
  if (!isQuestionLike(text)) {
    try {
      const { classification } = await processCapture({ text, source: "web" });
      return NextResponse.json({ mode: "capture", classification });
    } catch (err) {
      console.error("[ask] capture failed:", err);
      return NextResponse.json({ error: "Could not save that" }, { status: 500 });
    }
  }

  try {
    const context = await gatherContext(req);
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 700,
      system: [
        { type: "text", text: SYSTEM },
        // The snapshot is large and stable within a session — cache it.
        { type: "text", text: `CURRENT SNAPSHOT\n\n${context}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: text }],
    });

    const answer = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ mode: "answer", answer });
  } catch (err) {
    console.error("[ask] answer failed:", err);
    return NextResponse.json({ error: "Julie couldn't work that out" }, { status: 500 });
  }
}
