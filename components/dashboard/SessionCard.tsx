"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import type { Task } from "./CRMBoard";

export default function SessionCard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks?status=open")
      .then((r) => r.json())
      .then((data: Task[]) => {
        const sort = (list: Task[]) =>
          list.sort((a, b) => {
            if (b.key !== a.key) return b.key ? 1 : -1;
            return b.priority_score - a.priority_score;
          });
        const todayTasks = sort(data.filter((t) => t.urgency === "today"));
        // If fewer than 3 today tasks, fill with this_week
        const weekTasks = sort(data.filter((t) => t.urgency === "this_week"));
        const top = [...todayTasks, ...weekTasks].slice(0, 5);
        setTasks(top);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Panel
      title="Session · Today"
      action={
        <Link href="/tasks" className="text-[10px] text-[var(--accent)] hover:opacity-80 transition-opacity">
          All tasks →
        </Link>
      }
    >
      <div className="px-4 pb-4 space-y-1">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">No key tasks for today.</p>
        )}
        {tasks.map((task, i) => {
          const dot = task.urgency === "today" ? "🔴" : task.urgency === "this_week" ? "🟡" : "🟢";
          return (
            <div key={task.id} className="flex items-center gap-3 py-2 border-b border-[var(--glass-border)] last:border-0">
              <span className="text-xs w-4 flex-shrink-0">{dot}</span>
              <span className="flex-1 text-sm">
                {task.key && <span className="text-[var(--warn)] mr-1">★</span>}
                {task.title}
              </span>
              {task.time_estimate_min && (
                <span className="num text-[10px] text-[var(--text-muted)]">{task.time_estimate_min}m</span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
