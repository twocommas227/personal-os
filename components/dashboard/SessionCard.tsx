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
        const top = data
          .filter((t) => t.urgency === "today")
          .sort((a, b) => {
            if (b.key !== a.key) return b.key ? 1 : -1;
            return b.priority_score - a.priority_score;
          })
          .slice(0, 3);
        setTasks(top);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Panel
      title="Session · Today"
      action={
        <Link href="/crm" className="text-[10px] text-[var(--accent)] hover:opacity-80 transition-opacity">
          All tasks →
        </Link>
      }
    >
      <div className="px-4 pb-4 space-y-1">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">No key tasks for today.</p>
        )}
        {tasks.map((task, i) => (
          <div key={task.id} className="flex items-center gap-3 py-2 border-b border-[var(--glass-border)] last:border-0">
            <span className="num text-xs text-[var(--text-muted)] w-4">{i + 1}</span>
            <span className="flex-1 text-sm">
              {task.key && <span className="text-[var(--warn)] mr-1">★</span>}
              {task.title}
            </span>
            {task.time_estimate_min && (
              <span className="num text-[10px] text-[var(--text-muted)]">{task.time_estimate_min}m</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
