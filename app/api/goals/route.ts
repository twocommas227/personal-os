import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";
const SENTINEL = "2000-01-01"; // Goals never auto-clear — stored on fixed date

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", SENTINEL)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try {
    notes = data?.notes ? JSON.parse(data.notes as string) : {};
  } catch {}

  return NextResponse.json({
    week: (notes.goals_week_items as GoalItem[]) ?? [],
    month: (notes.goals_month_items as GoalItem[]) ?? [],
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scope, items } = await req.json() as { scope: "week" | "month"; items: GoalItem[] };

  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", SENTINEL)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try {
    notes = existing?.notes ? JSON.parse(existing.notes as string) : {};
  } catch {}

  if (scope === "week") notes.goals_week_items = items;
  else notes.goals_month_items = items;

  const { error } = await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: SENTINEL, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

interface GoalItem {
  id: string;
  text: string;
  done: boolean;
}
