import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { nextProgramKey, formatWorkoutPlain, getProgram } from "@/lib/workouts";
import { saveWorkoutProgram } from "@/app/api/workout/route";

export const maxDuration = 30;

const USER_ID = process.env.USER_ID ?? "josh";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_USER_ID!;
const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";

const SIMPLE_HABITS = ["Read", "Journal", "20/20", "Church"];
const TOTAL_HABITS = SIMPLE_HABITS.length + 1; // +1 for Exercise

function todayTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function friendlyDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: TZ,
  });
}

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
}

async function getDayData(date: string) {
  const { data } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  if (!data?.notes) return { done: [], exercise: [], supplements: [], weight_kg: "", meals: [] };
  try {
    const notes = JSON.parse(data.notes as string);
    const habits = notes.habits ?? {};
    return {
      done: habits.done ?? [],
      exercise: habits.exercise ?? [],
      supplements: habits.supplements ?? [],
      weight_kg: habits.weight_kg ?? "",
      meals: notes.nutrition?.meals ?? [],
    };
  } catch {
    return { done: [], exercise: [], supplements: [], weight_kg: "", meals: [] };
  }
}

async function getNextWorkout(): Promise<{ key: "A" | "B" | "C"; text: string } | null> {
  try {
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

    let lastProgram: "A" | "B" | "C" | null = null;
    for (const row of data ?? []) {
      try {
        const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
        const prog = notes?.workout?.program;
        if (prog && ["A", "B", "C"].includes(prog)) { lastProgram = prog; break; }
      } catch {}
    }

    const nextKey = nextProgramKey(lastProgram);
    const program = await getProgram(nextKey);

    // Save today's workout program so rotation is tracked
    const today = todayTZ();
    await saveWorkoutProgram(nextKey, today).catch(() => {});

    return { key: nextKey, text: formatWorkoutPlain(program) };
  } catch {
    return null;
  }
}

async function getOpenTasks() {
  const { data } = await db
    .from("tasks")
    .select("id, title, urgency, created_at")
    .eq("user_id", USER_ID)
    .is("completed_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

function habitSummary(done: string[], exercise: string[]): string {
  const all = [...SIMPLE_HABITS, "Exercise"];
  const doneSet = new Set([...done, ...(exercise.length > 0 ? ["Exercise"] : [])]);
  const count = doneSet.size;
  const lines = all.map((h) => (doneSet.has(h) ? `✓ ${h}` : `✗ ${h}`)).join("  ");
  return `Habits: ${count}/${TOTAL_HABITS}\n${lines}`;
}

function nutritionSummary(meals: { id?: string; name: string; kcal: number; p: number; c: number; f: number }[]): string {
  if (!meals.length) return "Nutrition: nothing logged";
  const kcal = Math.round(meals.reduce((s, m) => s + m.kcal, 0));
  const p = Math.round(meals.reduce((s, m) => s + m.p, 0));
  const c = Math.round(meals.reduce((s, m) => s + m.c, 0));
  const f = Math.round(meals.reduce((s, m) => s + m.f, 0));
  // Filter out supplement meals (0 kcal) from display names
  const foodMeals = meals.filter((m) => !m.id?.startsWith("supplement::") && m.kcal > 0);
  const mealNames = foodMeals.map((m) => m.name).join(", ");
  return `Nutrition: 🔥 ${kcal} kcal · ${p}g protein · ${c}g carbs · ${f}g fat` +
    (mealNames ? `\n${mealNames}` : "");
}

function taskLines(tasks: { title: string; urgency: string }[], urgencies: string[]): string {
  const filtered = tasks.filter((t) => urgencies.includes(t.urgency));
  if (!filtered.length) return "";
  return filtered.map((t) => `  • ${t.title}`).join("\n");
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "morning";
  const today = todayTZ();
  const yesterday = offsetDate(today, -1);

  if (type === "morning") {
    const [dayData, tasks, workout] = await Promise.all([
      getDayData(yesterday),
      getOpenTasks(),
      getNextWorkout(),
    ]);

    const todayLines = taskLines(tasks, ["today"]);
    const weekLines = taskLines(tasks, ["this_week"]);
    const todayCount = tasks.filter((t) => t.urgency === "today").length;
    const weekCount = tasks.filter((t) => t.urgency === "this_week").length;

    const lines: string[] = [
      `☀️ <b>Good morning!</b>`,
      `📅 ${friendlyDate(today)}`,
      ``,
      `── Yesterday (${yesterday}) ──`,
      habitSummary(dayData.done, dayData.exercise),
      dayData.exercise.length ? `Exercise: ${dayData.exercise.join(", ")}` : `Exercise: none`,
      ``,
      nutritionSummary(dayData.meals),
    ];

    if (workout) {
      lines.push(``, `── 💪 Today's Workout ──`, workout.text);
    }

    if (todayCount > 0) {
      lines.push(``, `── 🔴 Due today (${todayCount}) ──`, todayLines);
    }
    if (weekCount > 0) {
      lines.push(``, `── 🟡 This week (${weekCount}) ──`, weekLines);
    }
    if (todayCount === 0 && weekCount === 0) {
      lines.push(``, `── Tasks ──`, `  No open tasks 🎉`);
    }

    await sendTelegram(lines.join("\n"));

  } else {
    const [dayData, tasks] = await Promise.all([getDayData(today), getOpenTasks()]);

    const openToday = tasks.filter((t) => t.urgency === "today");
    const todayLines = taskLines(tasks, ["today"]);

    const lines: string[] = [
      `🌙 <b>Evening recap</b>`,
      `📅 ${friendlyDate(today)}`,
      ``,
      habitSummary(dayData.done, dayData.exercise),
      dayData.exercise.length ? `Exercise: ${dayData.exercise.join(", ")}` : `Exercise: none`,
      ``,
      nutritionSummary(dayData.meals),
    ];

    if (openToday.length > 0) {
      lines.push(``, `── Still open today (${openToday.length}) ──`, todayLines);
    } else {
      lines.push(``, `── Tasks ──`, `  All done for today 🎉`);
    }

    await sendTelegram(lines.join("\n"));
  }

  return NextResponse.json({ ok: true });
}
