import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { embedText } from "@/lib/embed";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, threshold = 0.3, limit = 20 } = await req.json();
  if (!query?.trim()) return NextResponse.json([]);

  const embedding = await embedText(query.trim());

  const { data, error } = await db.rpc("match_memory_chunks", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    p_user_id: process.env.USER_ID ?? "josh",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
