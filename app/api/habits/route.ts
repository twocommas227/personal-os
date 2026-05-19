import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const { data, error } = await db
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", USER_ID)
    .gte("log_date", new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
    .order("log_date", { ascending: false })
    .limit(days + 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    try {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
      result[row.log_date] = notes?.habits?.done ?? [];
    } catch {
      result[row.log_date] = [];
    }
  }

  return NextResponse.json(result);
}
