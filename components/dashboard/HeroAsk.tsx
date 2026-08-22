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
    <section className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] w-full max-w-3xl mx-auto">
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

      <div className="px-4 py-4 sm:px-5 sm:py-5 flex items-start gap-3">
        {/* Julie */}
        <span className="relative w-8 h-8 mt-0.5 rounded-full bg-[var(--ink-2)] border border-[var(--glass-border)] grid place-items-center font-mono text-[12px] font-bold text-[var(--accent)] flex-shrink-0">
          J
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--ink-1)] ${
              status === "loading" ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--ok)]"
            }`}
            aria-hidden="true"
          />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] mb-2 text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-secondary)]">Julie</span>
            <span className="mx-1.5 opacity-40">·</span>
            {status === "loading" ? "looking that up…" : `${greeting()}, Josh`}
          </p>

          <div
            className={`flex items-end gap-2 rounded-xl border bg-[var(--ink-2)]/80 backdrop-blur px-3 py-2 transition-colors ${
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
              className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--ink-0)] text-[11px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {status === "loading" ? "…" : "Ask"}
            </button>
          </div>

          {/* Answer */}
          {status === "answer" && answer && (
            <div className="mt-2.5 text-left rounded-xl border border-[var(--glass-border)] bg-[var(--ink-1)]/70 px-3.5 py-2.5">
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

          {/* Status line — only when there's something to report */}
          {(status === "saved" || status === "error") && (
            <p
              className="mt-2 text-[11px] font-mono"
              style={{ color: status === "saved" ? "var(--ok)" : "var(--danger)" }}
              aria-live="polite"
            >
              {note}
            </p>
          )}

          {/* Suggested questions */}
          {status === "idle" && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
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
