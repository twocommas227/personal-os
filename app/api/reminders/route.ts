import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const USER_ID = process.env.USER_ID ?? "josh";

export async function GET() {
  const { data, error } = await db
    .from("reminders")
    .select("id, message, remind_at, sent_at")
    .eq("user_id", USER_ID)
    .is("sent_at", null)
    .order("remind_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { message, remind_at } = await req.json();
  if (!message?.trim() || !remind_at) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data, error } = await db
    .from("reminders")
    .insert({ user_id: USER_ID, message: message.trim(), remind_at })
    .select("id, message, remind_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await db
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
