import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const date = req.nextUrl.searchParams.get("date"); // specific date: YYYY-MM-DD

  let query = db
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", USER_ID)
    .order("log_date", { ascending: false });

  if (date) {
    query = query.eq("log_date", date).limit(1);
  } else {
    query = query
      .gte("log_date", new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
      .limit(days + 1);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: Record<string, unknown> = {};
  for (const row of data ?? []) {
    try {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
      result[row.log_date] = notes?.habits ?? { done: [], exercise: [], bad_habits: [], weight_kg: "" };
    } catch {
      result[row.log_date] = { done: [], exercise: [], bad_habits: [], weight_kg: "" };
    }
  }

  return NextResponse.json(result);
}
