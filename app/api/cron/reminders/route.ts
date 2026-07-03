import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 30;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_USER_ID!;
const USER_ID = process.env.USER_ID ?? "josh";

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Fetch reminders due in the past 16 minutes (slight overlap to avoid gaps between 15-min runs)
  const windowStart = new Date(now.getTime() - 16 * 60 * 1000).toISOString();
  const windowEnd = now.toISOString();

  const { data: due, error } = await db
    .from("reminders")
    .select("id, message, remind_at")
    .eq("user_id", USER_ID)
    .is("sent_at", null)
    .gte("remind_at", windowStart)
    .lte("remind_at", windowEnd);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0 });

  for (const reminder of due) {
    await sendTelegram(`⏰ <b>Reminder</b>\n${reminder.message}`);
    await db
      .from("reminders")
      .update({ sent_at: now.toISOString() })
      .eq("id", reminder.id);
  }

  return NextResponse.json({ sent: due.length });
}
