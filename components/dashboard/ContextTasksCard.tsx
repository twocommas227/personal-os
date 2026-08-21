"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";

interface Task {
  id: string;
  title: string;
  urgency: string;
  key: boolean;
  priority_score: number;
  time_estimate_min?: number;
}

interface Props {
  context: "personal" | "kritamorn" | "two_commas";
  label: string;
  /** Optional context wash class from globals.css, e.g. "tint-kritamorn" */
  tint?: string;
}

// Urgency reads as a severity stripe rather than an emoji you have to decode
const URGENCY_STRIPE: Record<string, string> = {
  today: "bg-[var(--danger)]",
  this_week: "bg-[var(--warn)]",
  this_month: "bg-[var(--ok)]",
  someday: "bg-[var(--ink-4)]",
};

export default function ContextTasksCard({ context, label, tint = "" }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks?status=open&context=${context}`)
      .then((r) => r.json())
      .then((data: Task[]) => {
        const sorted = [...data].sort((a, b) => {
          if (b.key !== a.key) return b.key ? 1 : -1;
          const urgencyOrder: Record<string, number> = { today: 0, this_week: 1, this_month: 2, someday: 3 };
          const ua = urgencyOrder[a.urgency] ?? 4;
          const ub = urgencyOrder[b.urgency] ?? 4;
          if (ua !== ub) return ua - ub;
          return b.priority_score - a.priority_score;
        });
        setTasks(sorted.slice(0, 6));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [context]);

  async function addTask() {
    if (!input.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.trim(),
          urgency: "this_week",
          context,
          priority_score: 0,
          tags: [],
        }),
      });
      const newTask = await res.json();
      setTasks((prev) => [newTask, ...prev].slice(0, 6));
      setInput("");
    } catch {}
    setSaving(false);
  }

  async function complete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    }).catch(() => {});
  }

  return (
    <Panel
      className={tint}
      title={`${label} Tasks`}
      action={
        <Link href="/tasks" className="text-[10px] text-[var(--accent)] hover:opacity-80 transition-opacity">
          All →
        </Link>
      }
    >
      <div className="px-4 pb-4 space-y-1">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">No open tasks</p>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--glass-border)] last:border-0 group">
            <button
              onClick={() => complete(task.id)}
              className="w-3.5 h-3.5 rounded border border-[var(--ink-4)] flex-shrink-0 hover:border-[var(--ok)] hover:bg-[var(--ok)]/20 transition-colors"
            />
            <span
              className={`w-[3px] h-4 rounded-sm flex-shrink-0 ${URGENCY_STRIPE[task.urgency] ?? "bg-[var(--ink-4)]"}`}
              title={task.urgency.replace("_", " ")}
            />

            <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">
              {task.key && <span className="text-[var(--warn)] mr-1">★</span>}
              {task.title}
            </span>
            {task.time_estimate_min && (
              <span className="num text-[10px] text-[var(--text-muted)]">{task.time_estimate_min}m</span>
            )}
          </div>
        ))}

        {/* Quick add */}
        <div className="flex gap-2 pt-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add task…"
            className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={addTask}
            disabled={saving || !input.trim()}
            className="px-2 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            +
          </button>
        </div>
      </div>
    </Panel>
  );
}
