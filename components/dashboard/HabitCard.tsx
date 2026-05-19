"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import { localDateKey } from "@/lib/localDate";

const HABITS = [
  "Exercise",
  "Read",
  "Meditate",
  "Journal",
  "No alcohol",
  "Sleep by midnight",
];

const STORAGE_KEY = (date: string) => `pos-habits-${date}`;

export default function HabitCard() {
  const today = localDateKey();
  const [done, setDone] = useState<string[]>([]);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage first, then merge with server
  useEffect(() => {
    const local = localStorage.getItem(STORAGE_KEY(today));
    if (local) setDone(JSON.parse(local));

    fetch(`/api/habits?days=1`)
      .then((r) => r.json())
      .then((data: Record<string, string[]>) => {
        if (!dirtyRef.current) {
          const server = data[today] ?? [];
          setDone(server);
          localStorage.setItem(STORAGE_KEY(today), JSON.stringify(server));
        }
      })
      .catch(() => {});
  }, [today]);

  function toggle(habit: string) {
    dirtyRef.current = true;
    const next = done.includes(habit) ? done.filter((h) => h !== habit) : [...done, habit];
    setDone(next);
    localStorage.setItem(STORAGE_KEY(today), JSON.stringify(next));

    // Debounce saves — wait 600ms after last tap
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/habits/${today}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next }),
      }).catch((err) => console.error("[habits] save failed:", err));
    }, 600);
  }

  const count = done.length;
  const total = HABITS.length;

  return (
    <Panel
      title="Habits"
      action={
        <span className="num text-[10px] text-[var(--text-muted)]">
          {count}/{total}
        </span>
      }
    >
      <div className="px-4 pb-4">
        {/* Progress bar */}
        <div className="h-1 bg-[var(--ink-2)] rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-[var(--ok)] rounded-full transition-all duration-300"
            style={{ width: `${(count / total) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {HABITS.map((habit) => {
            const checked = done.includes(habit);
            return (
              <button
                key={habit}
                onClick={() => toggle(habit)}
                className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
                  checked
                    ? "bg-[var(--ok)]/15 border border-[var(--ok)]/30"
                    : "bg-[var(--ink-2)] hover:bg-[var(--ink-3)] border border-transparent"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] transition-colors ${
                    checked
                      ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                      : "border-[var(--ink-4)]"
                  }`}
                >
                  {checked && "✓"}
                </span>
                <span
                  className={`text-xs transition-colors ${
                    checked ? "text-[var(--ok)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {habit}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
