"use client";

import { useState, useRef, KeyboardEvent } from "react";

const KIND_LABEL: Record<string, string> = {
  task: "task",
  journal: "journal entry",
  note: "note",
  decision: "decision",
  idea: "idea",
};

const SUGGESTIONS = [
  "What's on today?",
  "What's my next workout?",
  "How are my habits this week?",
  "What's open for Two Commas?",
];

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    })
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Status = "idle" | "loading" | "answer" | "saved" | "error";

export default function HeroAsk() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(value?: string) {
    const payload = (value ?? text).trim();
    if (!payload || status === "loading") return;

    setStatus("loading");
    setAnswer("");
    setNote("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      if (data.mode === "answer") {
        setAnswer(data.answer);
        setStatus("answer");
      } else {
        const kind = data.classification?.kind ?? "note";
        setNote(`Filed as a ${KIND_LABEL[kind] ?? kind}`);
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 4000);
      }
      setText("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function ask(q: string) {
    setText(q);
    send(q);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[var(--glass-border)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(680px 340px at 22% 8%, oklch(38% 0.10 48 / 0.55), transparent 66%), " +
            "radial-gradient(620px 320px at 82% 92%, oklch(32% 0.075 340 / 0.42), transparent 64%), " +
            "var(--ink-1)",
        }}
      />

      <div className="px-6 py-9 sm:px-10 sm:py-11 flex flex-col items-center text-center">
        {/* Julie */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="relative w-9 h-9 rounded-full bg-[var(--ink-2)] border border-[var(--glass-border)] grid place-items-center font-mono text-[13px] font-bold text-[var(--accent)]">
            J
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--ink-1)] ${
                status === "loading" ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--ok)]"
              }`}
              aria-hidden="true"
            />
          </span>
          <span className="text-left">
            <span className="block text-[13px] font-semibold leading-tight">Julie</span>
            <span className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {status === "loading" ? "thinking" : "online"}
            </span>
          </span>
        </div>

        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {greeting()}, Josh <span aria-hidden="true">👋</span>
        </p>

        <h1 className="mt-2 text-2xl sm:text-[32px] font-semibold tracking-tight text-balance">
          Ask Julie anything
        </h1>

        <div className="mt-6 w-full max-w-2xl">
          <div
            className={`flex items-end gap-2 rounded-2xl border bg-[var(--ink-2)]/80 backdrop-blur px-4 py-3 transition-colors ${
              status === "error"
                ? "border-[var(--danger)]"
                : "border-[var(--glass-border)] focus-within:border-[var(--accent)]"
            }`}
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask a question, or capture a task or thought…"
              className="flex-1 bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] max-h-32 py-1"
            />
            <button
              onClick={() => send()}
              disabled={!text.trim() || status === "loading"}
              className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--ink-0)] text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {status === "loading" ? "…" : "Ask"}
            </button>
          </div>

          {/* Answer */}
          {status === "answer" && answer && (
            <div className="mt-3 text-left rounded-2xl border border-[var(--glass-border)] bg-[var(--ink-1)]/70 px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                {answer}
              </p>
              <button
                onClick={() => { setStatus("idle"); setAnswer(""); }}
                className="mt-2.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Status line */}
          {status !== "answer" && (
            <p
              className="mt-2.5 text-[11px] h-4 font-mono"
              style={{
                color:
                  status === "saved"
                    ? "var(--ok)"
                    : status === "error"
                    ? "var(--danger)"
                    : "var(--text-muted)",
              }}
              aria-live="polite"
            >
              {status === "loading"
                ? "Julie is looking that up…"
                : status === "idle"
                ? "Ask a question, or just capture — Julie tells the difference"
                : note}
            </p>
          )}

          {/* Suggested questions */}
          {status === "idle" && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
