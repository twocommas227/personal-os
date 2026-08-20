import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  let query = db
    .from("tasks")
    .select("*")
    .eq("user_id", USER_ID)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100000 + (Date.now() % 100000)); // bust PostgREST cache

  const context = req.nextUrl.searchParams.get("context");
  if (context) query = query.eq("context", context);

  if (status === "open") query = query.is("completed_at", null);
  else if (status === "done") query = query.not("completed_at", "is", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await db
    .from("tasks")
    .insert({ ...body, user_id: USER_ID })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
