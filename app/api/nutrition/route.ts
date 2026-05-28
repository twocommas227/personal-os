import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const date = req.nextUrl.searchParams.get("date");

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

  const { data } = await query;

  const result = (data ?? []).map((row) => {
    try {
      const notes = JSON.parse(row.notes as string);
      return { date: row.log_date, meals: notes?.nutrition?.meals ?? [] };
    } catch {
      return { date: row.log_date, meals: [] };
    }
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, meals } = await req.json();

  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try { notes = existing?.notes ? JSON.parse(existing.notes as string) : {}; } catch {}
  notes.nutrition = { meals };

  const { error } = await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: date, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
