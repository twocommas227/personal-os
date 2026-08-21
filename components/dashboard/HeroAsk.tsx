"use client";

import { useState, useRef, KeyboardEvent } from "react";

const KIND_LABEL: Record<string, string> = {
  task: "task",
  journal: "journal entry",
  note: "note",
  decision: "decision",
  idea: "idea",
};

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: process.env.NEXT_PUBLIC_USER_TIMEZONE ?? "Asia/Bangkok",
    })
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HeroAsk() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!text.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const kind = data.classification?.kind ?? "note";
      setResult(`Julie filed that as a ${KIND_LABEL[kind] ?? kind}`);
      setText("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setResult("Julie couldn't save that — try again");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[var(--glass-border)]">
      {/* Ambient wash — keeps the hero from reading as a flat slab */}
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

      <div className="px-6 py-9 sm:px-10 sm:py-12 flex flex-col items-center text-center">
        {/* Julie — the command centre's operator */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="relative w-9 h-9 rounded-full bg-[var(--ink-2)] border border-[var(--glass-border)] grid place-items-center font-mono text-[13px] font-bold text-[var(--accent)]">
            J
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--ok)] border-2 border-[var(--ink-1)]"
              aria-hidden="true"
            />
          </span>
          <span className="text-left">
            <span className="block text-[13px] font-semibold leading-tight">Julie</span>
            <span className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-muted)]">
              online
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
              placeholder="Capture a task, log a thought, note a decision…"
              className="flex-1 bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] max-h-32 py-1"
            />
            <button
              onClick={submit}
              disabled={!text.trim() || status === "loading"}
              className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--ink-0)] text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {status === "loading" ? "…" : "Send"}
            </button>
          </div>

          <p
            className="mt-2.5 text-[11px] h-4 font-mono"
            style={{
              color:
                status === "success"
                  ? "var(--ok)"
                  : status === "error"
                  ? "var(--danger)"
                  : "var(--text-muted)",
            }}
            aria-live="polite"
          >
            {status === "loading"
              ? "Julie is working on it…"
              : status === "idle"
              ? "Enter to send · Julie files it for you"
              : result}
          </p>
        </div>
      </div>
    </section>
  );
}
