"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import Panel from "@/components/ui/Panel";

interface GoalItem {
  id: string;
  text: string;
  done: boolean;
}

function GoalSection({
  title,
  items,
  onChange,
}: {
  title: string;
  items: GoalItem[];
  onChange: (items: GoalItem[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const text = input.trim();
    if (!text) return;
    onChange([...items, { id: crypto.randomUUID(), text, done: false }]);
    setInput("");
  }

  function toggle(id: string) {
    onChange(items.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  function remove(id: string) {
    onChange(items.filter((g) => g.id !== id));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") add();
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
      <div className="space-y-1">
        {items.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">No goals yet</p>
        )}
        {items.map((g) => (
          <div key={g.id} className="flex items-center gap-2 group">
            <button
              onClick={() => toggle(g.id)}
              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[9px] transition-colors ${
                g.done
                  ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                  : "border-[var(--ink-4)] hover:border-[var(--accent)]"
              }`}
            >
              {g.done && "✓"}
            </button>
            <span className={`flex-1 text-xs ${g.done ? "line-through text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>
              {g.text}
            </span>
            <button
              onClick={() => remove(g.id)}
              className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] text-xs transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Add a goal…"
          className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
        />
        <button
          onClick={add}
          className="px-2 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs hover:opacity-90 transition-opacity"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function GoalsCard() {
  const [week, setWeek] = useState<GoalItem[]>([]);
  const [month, setMonth] = useState<GoalItem[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data) => {
        setWeek(data.week ?? []);
        setMonth(data.month ?? []);
        loaded.current = true;
      })
      .catch(() => { loaded.current = true; });
  }, []);

  function save(scope: "week" | "month", items: GoalItem[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, items }),
      }).catch((err) => console.error("[goals] save failed:", err));
    }, 600);
  }

  function handleWeek(items: GoalItem[]) {
    setWeek(items);
    save("week", items);
  }

  function handleMonth(items: GoalItem[]) {
    setMonth(items);
    save("month", items);
  }

  const weekDone = week.filter((g) => g.done).length;
  const monthDone = month.filter((g) => g.done).length;

  return (
    <Panel
      title="Goals"
      action={
        <span className="num text-[10px] text-[var(--text-muted)]">
          {weekDone}/{week.length} · {monthDone}/{month.length}
        </span>
      }
    >
      <div className="px-4 pb-4 space-y-4">
        <GoalSection title="This Week" items={week} onChange={handleWeek} />
        <GoalSection title="This Month" items={month} onChange={handleMonth} />
      </div>
    </Panel>
  );
}
