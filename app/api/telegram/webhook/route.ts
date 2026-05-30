import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { processCapture } from "@/lib/router/processCapture";
import { db } from "@/lib/supabase";
import { PROGRAMS, nextProgramKey, formatWorkoutTelegram, saveStoredProgram, getProgram } from "@/lib/workouts";
import type { WorkoutProgram, WorkoutSet } from "@/lib/workouts";
import { saveWorkoutProgram } from "@/app/api/workout/route";

export const maxDuration = 60;

const ALLOWED_USER_ID = process.env.TELEGRAM_USER_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const USER_ID = process.env.USER_ID ?? "josh";

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
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error("No file path from Telegram");
  const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  const audioBuffer = await audioRes.arrayBuffer();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcript = await openai.audio.transcriptions.create({ file, model: "whisper-1" });
  return transcript.text;
}

async function downloadTelegramFile(fileId: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error("No file path from Telegram");
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  const buffer = await res.arrayBuffer();
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/jpeg";
  return { buffer, mimeType };
}

async function checkFoodBank(name: string): Promise<{ kcal: number; p: number; c: number; f: number } | null> {
  const { data } = await db
    .from("food_bank")
    .select("kcal, p, c, f, name, aliases")
    .eq("user_id", USER_ID);
  if (!data) return null;
  const lower = name.toLowerCase();
  const match = data.find((item) => {
    if (item.name.toLowerCase().includes(lower) || lower.includes(item.name.toLowerCase())) return true;
    return (item.aliases ?? []).some((a: string) => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower));
  });
  return match ? { kcal: match.kcal, p: match.p, c: match.c, f: match.f } : null;
}

interface SupplementFact { ingredient: string; amount: string }
interface PhotoAnalysis {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fromLabel: boolean;
  supplementFacts?: SupplementFact[];
}

async function analyzePhotoNutrition(
  buffer: ArrayBuffer,
  mimeType: string,
  caption?: string
): Promise<PhotoAnalysis> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = Buffer.from(buffer).toString("base64");

  const prompt = caption
    ? `The user says this is: "${caption}". Analyze this label.`
    : "Analyze this label.";

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png", data: base64 },
        },
        {
          type: "text",
          text: `${prompt}

This image may show a NUTRITION FACTS panel (food) OR a SUPPLEMENT FACTS panel (vitamins/supplements).

Return ONLY valid JSON (no markdown):
{
  "name": "product name",
  "kcal": number,
  "p": number,
  "c": number,
  "f": number,
  "fromLabel": true/false,
  "supplementFacts": [{"ingredient": "Vitamin D3", "amount": "1,000 IU"}, ...]
}

Rules:
NUTRITION FACTS (food/protein bars/oats etc):
- Set fromLabel=true, copy kcal/p/c/f EXACTLY as printed
- supplementFacts = []

SUPPLEMENT FACTS (vitamins, minerals, capsules):
- Set kcal=0, p=0, c=0, f=0, fromLabel=true
- Read EVERY ingredient from the Supplement Facts panel
- supplementFacts = array of all ingredients with exact amount + unit (e.g. "1,000 IU", "45 mcg", "500 mg")
- Name the product descriptively e.g. "Vitamin D3 & K2 (D3 1,000 IU · K2 45 mcg)"

NO label visible:
- fromLabel=false, estimate kcal/p/c/f for food, or all zeros for supplement
- supplementFacts = []`,
        },
      ],
    }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  let depth = 0, start = -1, jsonStr: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (raw[i] === "}") { depth--; if (depth === 0 && start !== -1) { jsonStr = raw.slice(start, i + 1); break; } }
  }
  if (!jsonStr) throw new Error("Could not read the label clearly. Try a clearer photo or add a caption like 'protein bar 270kcal 35p'");
  return JSON.parse(jsonStr);
}

async function lookupSupplementByName(name: string): Promise<{ name: string; supplementFacts: SupplementFact[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a supplement database. When asked about a supplement, you ALWAYS return a complete ingredient list with real amounts. You never return an empty supplementFacts array. You know the exact formulas for major brands like Pure Encapsulations, NOW Foods, Thorne, Garden of Life, etc.`,
    messages: [{
      role: "user",
      content: `Return the supplement facts for: "${name}"

For branded products, return the actual known formula.
For generic names, return realistic typical amounts.

Return ONLY this JSON structure (no markdown, no explanation):
{"name":"...","supplementFacts":[{"ingredient":"Vitamin A","amount":"750 mcg RAE"},{"ingredient":"Vitamin C","amount":"250 mg"}]}

Every entry needs a real numeric amount with unit (mg, mcg, IU, etc). List at least 10 ingredients for a multivitamin.`,
    }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  // Extract JSON — handle both object and any surrounding text
  let depth = 0, start = -1, jsonStr: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (raw[i] === "}") { depth--; if (depth === 0 && start !== -1) { jsonStr = raw.slice(start, i + 1); break; } }
  }
  if (!jsonStr) return { name, supplementFacts: [] };
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { name, supplementFacts: [] };
  }
}

async function removeMealFromLog(mealId: string, date: string) {
  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try { notes = existing?.notes ? JSON.parse(existing.notes as string) : {}; } catch {}

  const meals = (notes?.nutrition as { meals?: unknown[] })?.meals ?? [];
  notes.nutrition = { meals: meals.filter((m: unknown) => (m as { id: string }).id !== mealId) };

  await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: date, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function editTelegramMessage(chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  });
}

async function saveNutritionMeal(meal: { name: string; kcal: number; p: number; c: number; f: number }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.USER_TIMEZONE ?? "Asia/Bangkok" });

  const { data: existing } = await db
    .from("daily_logs")
    .select("notes")
    .eq("user_id", USER_ID)
    .eq("log_date", today)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  try { notes = existing?.notes ? JSON.parse(existing.notes as string) : {}; } catch {}

  const existingMeals: unknown[] = (notes?.nutrition as { meals?: unknown[] })?.meals ?? [];
  const mealId = crypto.randomUUID();
  const newMeal = { id: mealId, ...meal, estimated: true };
  notes.nutrition = { meals: [...existingMeals, newMeal] };

  await db.from("daily_logs").upsert(
    { user_id: USER_ID, log_date: today, notes: JSON.stringify(notes), updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" }
  );

  return { date: today, mealId };
}

async function saveFoodBank(
  name: string,
  macros: { kcal: number; p: number; c: number; f: number },
  supplementFacts?: SupplementFact[]
) {
  const notes = supplementFacts?.length
    ? JSON.stringify(supplementFacts)
    : undefined;
  await db.from("food_bank").upsert(
    { user_id: USER_ID, name, ...macros, ...(notes ? { notes } : {}) },
    { onConflict: "user_id,name" }
  );
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== WEBHOOK_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // ── CALLBACK QUERY (inline button taps) ─────────────────────────────
  if (body.callback_query) {
    const cq = body.callback_query;
    if (String(cq.from?.id) !== ALLOWED_USER_ID) return NextResponse.json({ ok: true });

    const data: string = cq.data ?? "";
    const cqChatId: number = cq.message?.chat?.id;
    const cqMsgId: number = cq.message?.message_id;

    if (data.startsWith("unmeal:")) {
      // unmeal:{mealId}:{date}  — remove meal from log
      const parts = data.split(":");
      const mealId = parts[1];
      const date = parts[2];
      try {
        await removeMealFromLog(mealId, date);
        await answerCallbackQuery(cq.id, "✅ Removed from log");
        await editTelegramMessage(cqChatId, cqMsgId,
          cq.message.text.replace("🍽️", "📚").replace(/\n<i>.*<\/i>$/, "\n<i>Removed from log — in food bank only</i>")
        );
      } catch {
        await answerCallbackQuery(cq.id, "❌ Failed to remove");
      }
    }

    return NextResponse.json({ ok: true });
  }

  const message = body.message ?? body.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const fromId = String(message.from?.id);
  if (fromId !== ALLOWED_USER_ID) return NextResponse.json({ ok: true });

  try {
    // ── PHOTO: nutrition logging via vision ──────────────────────────
    if (message.photo || message.document?.mime_type?.startsWith("image/")) {
      const fileId = message.photo
        ? message.photo[message.photo.length - 1].file_id  // largest size
        : message.document.file_id;
      const rawCaption = message.caption?.trim() ?? "";
      // "save" = food bank only | "log" = force log even if 0 kcal | default = auto
      let saveOnly = /^save\b/i.test(rawCaption);
      const forceLog = /^log\b/i.test(rawCaption);
      const caption = rawCaption.replace(/^(save|log)\s*/i, "").trim() || undefined;

      await sendTelegramMessage(chatId, saveOnly ? "📚 Scanning for food bank…" : "🔍 Analyzing nutrition…");

      // Check food bank first if caption provided
      let macros: { kcal: number; p: number; c: number; f: number } | null = null;
      let foodName = caption ?? "Food";
      let fromBank = false;

      if (caption) {
        macros = await checkFoodBank(caption).catch(() => null);
        if (macros) fromBank = true;
      }

      if (!macros) {
        let buffer: ArrayBuffer;
        let mimeType: string;
        try {
          await sendTelegramMessage(chatId, "📥 Downloading image…");
          ({ buffer, mimeType } = await downloadTelegramFile(fileId));
        } catch (e) {
          await sendTelegramMessage(chatId, `❌ Failed to download image: ${e}`);
          return NextResponse.json({ ok: true });
        }

        let result: PhotoAnalysis;
        try {
          await sendTelegramMessage(chatId, "🧠 Reading label with AI…");
          result = await analyzePhotoNutrition(buffer, mimeType, caption);
        } catch (e) {
          // If label is unreadable but we have a name, look it up by name via Claude
          if (saveOnly && caption) {
            await sendTelegramMessage(chatId, "🔍 Label unreadable — looking up by name…");
            const lookup = await lookupSupplementByName(caption).catch(() => ({ name: caption, supplementFacts: [] as SupplementFact[] }));
            // Caption is always the bank key — Claude's name goes into notes via supplementFacts
            const cleanFacts = (lookup.supplementFacts ?? []).filter(
              (f) => f.amount && !/not visible|unknown|n\/a/i.test(f.amount)
            );
            await saveFoodBank(caption, { kcal: 0, p: 0, c: 0, f: 0 }, cleanFacts).catch(() => {});
            const factsLines = cleanFacts.length
              ? cleanFacts.map((f) => `  · ${f.ingredient}: ${f.amount}`).join("\n")
              : "";
            await sendTelegramMessage(chatId,
              `💊 <b>Supplement saved to bank:</b> ${caption}` +
              (factsLines ? `\n${factsLines}` : "") +
              `\n\n<i>Looked up by name (label was unreadable).</i>`
            );
            return NextResponse.json({ ok: true });
          }
          await sendTelegramMessage(chatId, `📸 ${e instanceof Error ? e.message : "AI analysis failed"}\n\nTip: Add a caption with the food name, or try a clearer shot of the label.`);
          return NextResponse.json({ ok: true });
        }

        // Caption always wins as the bank name so it matches HabitCard exactly
        foodName = (saveOnly && caption) ? caption : result.name;
        macros = { kcal: result.kcal, p: result.p, c: result.c, f: result.f };
        // Strip unreadable facts entries before saving
        const cleanFacts = result.supplementFacts?.filter(
          (f) => f.amount && !/not visible|unknown|n\/a/i.test(f.amount)
        );
        if (result.fromLabel) {
          await saveFoodBank(foodName, macros, cleanFacts).catch(() => {});
        }

        // Auto-detect supplements: zero macros = not food, save to bank only (unless "log" prefix)
        if (!saveOnly && !forceLog && macros.kcal === 0 && macros.p === 0 && macros.c === 0 && macros.f === 0) {
          saveOnly = true;
          const factsLines = cleanFacts?.length
            ? cleanFacts.map((f) => `  · ${f.ingredient}: ${f.amount}`).join("\n")
            : "";
          await sendTelegramMessage(chatId,
            `💊 <b>Supplement saved to bank:</b> ${foodName}` +
            (factsLines ? `\n${factsLines}` : "") +
            `\n\n<i>Not logged as eaten. Tap your supplement in HabitCard to track it.</i>`
          );
          return NextResponse.json({ ok: true });
        }
      }

      const source = fromBank ? "📚 from food bank" : "🏷️ read from label";

      if (saveOnly) {
        await sendTelegramMessage(chatId,
          `💊 <b>Supplement saved to bank:</b> ${foodName}\n` +
          `<i>Not logged as eaten. Tap it in HabitCard to track.</i>`
        );
      } else {
        let savedDate: string;
        let savedMealId: string;
        try {
          await sendTelegramMessage(chatId, "💾 Saving to nutrition log…");
          const saved = await saveNutritionMeal({ name: foodName, ...macros });
          savedDate = saved.date;
          savedMealId = saved.mealId;
        } catch (e) {
          await sendTelegramMessage(chatId, `❌ Failed to save meal: ${e}`);
          return NextResponse.json({ ok: true });
        }
        // callback_data limit is 64 bytes: "unmeal:" (7) + uuid (36) + ":" (1) + date (10) = 54 ✓
        const undoKeyboard = {
          inline_keyboard: [[
            { text: "↩️ Undo — bank only", callback_data: `unmeal:${savedMealId}:${savedDate}` },
          ]],
        };
        await sendTelegramMessage(chatId,
          `🍽️ <b>Logged:</b> ${foodName}\n` +
          `${macros.kcal} kcal · ${macros.p}g protein · ${macros.c}g carbs · ${macros.f}g fat\n` +
          `<i>${source}</i>`,
          undoKeyboard
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ── VOICE / AUDIO ────────────────────────────────────────────────
    let text = "";
    let audioUrl: string | undefined;

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

    // ── WORKOUT COMMAND: "workout" ─────────────────────────────────────
    if (/^workout$/i.test(text.trim())) {
      // Find last workout logged to determine next in rotation
      const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const sinceStr = since.toLocaleDateString("en-CA");

      const { data: logs } = await db
        .from("daily_logs")
        .select("log_date, notes")
        .eq("user_id", USER_ID)
        .gte("log_date", sinceStr)
        .order("log_date", { ascending: false })
        .limit(60);

      let lastProgram: "A" | "B" | "C" | null = null;
      for (const row of logs ?? []) {
        try {
          const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
          const prog = notes?.workout?.program;
          if (prog && ["A", "B", "C"].includes(prog)) { lastProgram = prog; break; }
        } catch {}
      }

      const nextKey = nextProgramKey(lastProgram);
      const program = await getProgram(nextKey);

      // Find when this specific program was last done
      let lastThisDate: string | null = null;
      for (const row of logs ?? []) {
        try {
          const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
          if (notes?.workout?.program === nextKey) { lastThisDate = row.log_date; break; }
        } catch {}
      }

      const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
      await saveWorkoutProgram(nextKey, today);

      const msg = formatWorkoutTelegram(program, lastThisDate);
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // ── WORKOUT LOG: message contains "Day A/B/C" header ────────────────
    const workoutDayMatch = text.match(/Day\s+([ABC])\b/i);
    if (workoutDayMatch) {
      const programKey = workoutDayMatch[1].toUpperCase() as "A" | "B" | "C";
      await sendTelegramMessage(chatId, `💪 Parsing Day ${programKey} workout…`);

      try {
        const apiKey = process.env.ANTHROPIC_API_KEY!;
        const client = new Anthropic({ apiKey });

        const parseMsg = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
          max_tokens: 1024,
          system: `You are parsing a gym workout log. Extract exercises into JSON.
Return ONLY valid JSON with this shape:
{
  "exercises": [
    {
      "name": "Exercise name",
      "sets": [{ "weight": 25, "reps": 8 }, { "weight": 30, "reps": 10 }],
      "note": "optional string for finishers like '20 total'"
    }
  ]
}
Rules:
- weight is a number in kg, or null for bodyweight/no weight
- reps is a number or a string range like "6-8"
- "BW" weight = null
- If a finisher has no sets (e.g. "20 total pushups"), use empty sets array and put the note
- Output JSON only, no markdown`,
          messages: [{ role: "user", content: text }],
        });

        const raw = (parseMsg.content[0] as { type: string; text: string }).text;
        const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonStr) throw new Error("No JSON in parse response");

        const parsed = JSON.parse(jsonStr) as { exercises: WorkoutProgram["exercises"] };

        // Load current program (stored or default) and merge exercise list
        const current = await getProgram(programKey);
        const updated: WorkoutProgram = {
          ...current,
          exercises: parsed.exercises,
        };

        await saveStoredProgram(programKey, updated);

        const TZ = process.env.USER_TIMEZONE ?? "Asia/Bangkok";
        const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
        await saveWorkoutProgram(programKey, today);

        // Build confirmation message
        const lines = [
          `✅ <b>Day ${programKey} · ${current.focus} logged</b>`,
          `<i>${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })}</i>`,
          "",
        ];
        for (const ex of updated.exercises) {
          const setStr = ex.note
            ? ex.note
            : (ex.sets as WorkoutSet[]).map((s) => {
                const w = s.weight === null ? "—" : s.weight === "BW" ? "BW" : `${s.weight}kg`;
                return `${w}×${s.reps}`;
              }).join(" | ");
          lines.push(`${ex.name}: ${setStr}`);
        }
        lines.push("", `<i>Next: Day ${nextProgramKey(programKey)}</i>`);

        await sendTelegramMessage(chatId, lines.join("\n"));
      } catch (err) {
        await sendTelegramMessage(chatId, `❌ Could not parse workout: ${err}`);
      }
      return NextResponse.json({ ok: true });
    }

    // ── FOOD BANK SAVE: "save [name]" as text (supports multiple lines) ─
    const saveLines = text.split("\n").map((l) => l.match(/^save\s+(.+)/i)?.[1]?.trim()).filter(Boolean) as string[];
    if (saveLines.length > 0) {
      for (const name of saveLines) {
        await sendTelegramMessage(chatId, `🔍 Looking up <b>${name}</b>…`);
        const lookup = await lookupSupplementByName(name).catch(() => ({ name, supplementFacts: [] as SupplementFact[] }));
        const cleanFacts = (lookup.supplementFacts ?? []).filter(
          (f) => f.amount && !/not visible|unknown|n\/a/i.test(f.amount)
        );
        await saveFoodBank(name, { kcal: 0, p: 0, c: 0, f: 0 }, cleanFacts).catch(() => {});
        const factsLines = cleanFacts.length
          ? cleanFacts.map((f) => `  · ${f.ingredient}: ${f.amount}`).join("\n")
          : "";
        await sendTelegramMessage(chatId,
          `💊 <b>Saved to food bank:</b> ${name}` +
          (factsLines ? `\n${factsLines}` : "\n<i>No ingredient details found</i>")
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── FOOD BANK FIX: "fix [name]: [kcal]kcal [p]p [c]c [f]f" ──
    const fixMatch = text.match(/^fix\s+(.+?):\s*(\d+)\s*kcal\s+(\d+)p\s+(\d+)c\s+(\d+)f/i);
    if (fixMatch) {
      const [, name, kcal, p, c, f] = fixMatch;
      await db.from("food_bank")
        .upsert({ user_id: USER_ID, name: name.trim(), kcal: +kcal, p: +p, c: +c, f: +f }, { onConflict: "user_id,name" });
      await sendTelegramMessage(chatId, `✅ Updated food bank: <b>${name.trim()}</b>\n${kcal} kcal · ${p}g protein · ${c}g carbs · ${f}g fat`);
      return NextResponse.json({ ok: true });
    }

    const { classification } = await processCapture({ text, source: "telegram", audioUrl });

    const urgencyKeyboard = {
      inline_keyboard: [[
        { text: "🔴 Today",      callback_data: "urgency:today" },
        { text: "🟡 This Week",  callback_data: "urgency:this_week" },
        { text: "🟢 This Month", callback_data: "urgency:this_month" },
        { text: "⚪ Someday",    callback_data: "urgency:someday" },
      ]],
    };

    const emoji = { task: "✅", journal: "📓", note: "📌", decision: "⚖️", idea: "💡" }[classification.kind] ?? "📥";
    const reply = `${emoji} <b>${classification.kind.toUpperCase()}</b> · ${classification.urgency.replace("_", " ")}\n${classification.summary}`;
    await sendTelegramMessage(chatId, reply, urgencyKeyboard);

  } catch (err) {
    console.error("[telegram/webhook]", err);
    await sendTelegramMessage(chatId, "❌ Something went wrong.");
  }

  return NextResponse.json({ ok: true });
}
