import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { processCapture } from "@/lib/router/processCapture";

const ALLOWED_USER_ID = process.env.TELEGRAM_USER_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: object) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function transcribeAudio(fileId: string): Promise<string> {
  // Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error("No file path from Telegram");

  // Download audio
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
  );
  const audioBuffer = await audioRes.arrayBuffer();

  // Transcribe with Whisper
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcript = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return transcript.text;
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const message = body.message ?? body.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const fromId = String(message.from?.id);

  // Only respond to the owner
  if (fromId !== ALLOWED_USER_ID) {
    return NextResponse.json({ ok: true });
  }

  let text = "";
  let audioUrl: string | undefined;

  try {
    if (message.voice || message.audio) {
      const fileId = (message.voice ?? message.audio).file_id;
      text = await transcribeAudio(fileId);
      audioUrl = `tg:${fileId}`;
    } else if (message.text) {
      text = message.text;
    } else {
      return NextResponse.json({ ok: true });
    }

    if (!text.trim()) {
      await sendTelegramMessage(chatId, "⚠️ Could not transcribe audio.");
      return NextResponse.json({ ok: true });
    }

    const { classification } = await processCapture({ text, source: "telegram", audioUrl });

    // Urgency override keyboard
    const urgencyKeyboard = {
      inline_keyboard: [[
        { text: "🔴 Today",      callback_data: `urgency:today` },
        { text: "🟡 This Week",  callback_data: `urgency:this_week` },
        { text: "🟢 This Month", callback_data: `urgency:this_month` },
        { text: "⚪ Someday",    callback_data: `urgency:someday` },
      ]],
    };

    const emoji = { task: "✅", journal: "📓", note: "📌", decision: "⚖️", idea: "💡" }[classification.kind] ?? "📥";
    const reply = `${emoji} <b>${classification.kind.toUpperCase()}</b> · ${classification.urgency.replace("_", " ")}\n${classification.summary}`;

    await sendTelegramMessage(chatId, reply, urgencyKeyboard);
  } catch (err) {
    console.error("[telegram/webhook]", err);
    await sendTelegramMessage(chatId, "❌ Something went wrong saving that capture.");
  }

  return NextResponse.json({ ok: true });
}
