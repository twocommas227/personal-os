"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";

interface Reminder {
  id: string;
  message: string;
  remind_at: string;
}

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA");
  const dateStr = d.toLocaleDateString("en-CA");

  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dateStr === today) return `Today ${time}`;
  if (dateStr === tomorrowStr) return `Tomorrow ${time}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ` ${time}`;
}

function defaultDatetime(): string {
  const d = new Date();
  d.setHours(21, 0, 0, 0); // default to 9pm tonight
  if (d < new Date()) d.setDate(d.getDate() + 1);
  // datetime-local format: YYYY-MM-DDTHH:mm
  return d.toLocaleDateString("en-CA") + "T" + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function RemindersCard() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState(defaultDatetime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setReminders(data); })
      .catch(() => {});
  }, []);

  async function add() {
    if (!message.trim() || !remindAt || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), remind_at: new Date(remindAt).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setReminders((prev) => [...prev, data].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
      setMessage("");
      setRemindAt(defaultDatetime());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch("/api/reminders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  return (
    <Panel
      title="Reminders"
      action={
        <span className="num text-[10px] text-[var(--text-muted)]">
          {reminders.length > 0 ? `${reminders.length} upcoming` : ""}
        </span>
      }
    >
      <div className="px-4 pb-4 space-y-3">
        {/* Upcoming reminders */}
        {reminders.length > 0 && (
          <div className="space-y-1">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-2 py-2 border-b border-[var(--glass-border)] last:border-0"
              >
                <span className="text-[10px] font-mono text-[var(--accent)] whitespace-nowrap mt-0.5 min-w-[80px]">
                  {formatRemindAt(r.remind_at)}
                </span>
                <span className="flex-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                  {r.message}
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {reminders.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">No upcoming reminders</p>
        )}

        {/* Add form */}
        <div className="space-y-2 pt-1">
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
            placeholder="Reminder message…"
            rows={2}
            className="w-full bg-[var(--ink-2)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)] resize-none"
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors [color-scheme:dark]"
            />
            <button
              onClick={add}
              disabled={saving || !message.trim()}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {saving ? "…" : "Set"}
            </button>
          </div>
          {error && <p className="text-[10px] text-[var(--danger)]">{error}</p>}
        </div>
      </div>
    </Panel>
  );
}
