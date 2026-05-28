import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const source = searchParams.get("source"); // optional filter

  let query = db
    .from("memory_chunks")
    .select("id, text, source_type, created_at")
    .eq("user_id", process.env.USER_ID ?? "josh")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source && source !== "all") {
    query = query.eq("source_type", source);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
