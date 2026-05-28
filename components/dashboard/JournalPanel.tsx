"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localDateKey } from "@/lib/localDate";

interface Capture {
  id: string;
  raw_text: string;
  routed_to: string;
  created_at: string;
  audio_url?: string | null;
}

const KIND_META: Record<string, { icon: string; color: string }> = {
  journal:  { icon: "📓", color: "text-[var(--accent)]" },
  note:     { icon: "📌", color: "text-[var(--text-secondary)]" },
  idea:     { icon: "💡", color: "text-yellow-400" },
  decision: { icon: "⚖️", color: "text-[var(--ok)]" },
};

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function friendlyDate(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function JournalPanel() {
  const today = localDateKey();
  const [activeDate, setActiveDate] = useState(today);
  const [entry, setEntry] = useState("");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [status, setStatus] = useState<"saved" | "saving" | "">("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isToday = activeDate === today;

  useEffect(() => {
    setEntry("");
    setCaptures([]);
    fetch(`/api/journal?date=${activeDate}`)
      .then((r) => r.json())
      .then((data) => {
        setEntry(data.entry ?? "");
        setCaptures(data.captures ?? []);
      })
      .catch(() => {});
  }, [activeDate]);

  const save = useCallback((text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = setTimeout(() => {
      fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: activeDate, entry: text }),
      })
        .then(() => setStatus("saved"))
        .catch(() => setStatus(""));
    }, 800);
  }, [activeDate]);

  function onChange(text: string) {
    setEntry(text);
    save(text);
  }

  const wordCount = entry.trim() ? entry.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Date nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveDate(offsetDate(activeDate, -1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-2)] transition-colors"
          >‹</button>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {friendlyDate(activeDate, today)}
          </span>
          <button
            onClick={() => setActiveDate(offsetDate(activeDate, 1))}
            disabled={isToday}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >›</button>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          {status === "saving" ? "saving…" : status === "saved" ? "saved" : ""}
          {!status && wordCount > 0 && `${wordCount} words`}
        </span>
      </div>

      {/* Main editor */}
      <textarea
        value={entry}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isToday
          ? "What's on your mind today…"
          : "No entry for this day."}
        readOnly={false}
        rows={12}
        className="w-full bg-[var(--ink-1)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-2xl px-5 py-4 text-sm text-[var(--text-primary)] leading-relaxed outline-none resize-none transition-colors placeholder:text-[var(--text-muted)]"
      />

      {/* Captures from Telegram */}
      {captures.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
            Captured via Telegram
          </p>
          {captures.map((c) => {
            const meta = KIND_META[c.routed_to] ?? KIND_META.note;
            return (
              <div
                key={c.id}
                className="flex gap-3 bg-[var(--ink-1)] border border-[var(--glass-border)] rounded-xl px-4 py-3"
              >
                <span className="text-base flex-shrink-0 mt-0.5">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{c.raw_text}</p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                    {formatTime(c.created_at)} · {c.routed_to}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {entry === "" && captures.length === 0 && !isToday && (
        <p className="text-center text-[var(--text-muted)] text-sm py-8">Nothing recorded for this day.</p>
      )}
    </div>
  );
}
