"use client";

import { useEffect, useState, useRef } from "react";
import TaskDrawer from "./TaskDrawer";

export interface Task {
  id: string;
  title: string;
  description?: string;
  urgency: "today" | "this_week" | "this_month" | "someday";
  key: boolean;
  priority_score: number;
  time_estimate_min?: number;
  tags: string[];
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

const TIERS = [
  { id: "today",      label: "Today",      color: "var(--danger)" },
  { id: "this_week",  label: "This Week",  color: "var(--warn)" },
  { id: "this_month", label: "This Month", color: "var(--accent)" },
  { id: "someday",    label: "Someday",    color: "var(--ink-4)" },
] as const;

type View = "kanban" | "smart" | "category";

export default function CRMBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("crm-view") as View) ?? "kanban";
    return "kanban";
  });
  const [selected, setSelected] = useState<Task | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [smartQuery, setSmartQuery] = useState("");
  const [smartResults, setSmartResults] = useState<Task[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const dragRef = useRef<{ id: string; urgency: string } | null>(null);

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    const res = await fetch("/api/tasks?status=open");
    const data = await res.json();
    setTasks(data);
    setLoading(false);
  }

  function switchView(v: View) {
    setView(v);
    localStorage.setItem("crm-view", v);
  }

  async function addTask(urgency: string) {
    if (!newTitle.trim()) { setAdding(null); return; }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), urgency, priority_score: Date.now() }),
    });
    const task = await res.json();
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setAdding(null);
  }

  async function completeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelected(null);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  async function runSmartSearch() {
    if (!smartQuery.trim()) return;
    setSmartLoading(true);
    const res = await fetch("/api/tasks/smart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: smartQuery }),
    });
    const data = await res.json();
    setSmartResults(data);
    setSmartLoading(false);
  }

  // Drag-drop within tier
  function onDragStart(id: string, urgency: string) { dragRef.current = { id, urgency }; }
  function onDrop(targetId: string, targetUrgency: string) {
    if (!dragRef.current || dragRef.current.id === targetId) return;
    const { id } = dragRef.current;
    setTasks((prev) => {
      const tierTasks = prev.filter((t) => t.urgency === targetUrgency);
      const targetIdx = tierTasks.findIndex((t) => t.id === targetId);
      const newScore = targetIdx === 0
        ? (tierTasks[0]?.priority_score ?? 0) + 1000
        : Math.floor(((tierTasks[targetIdx - 1]?.priority_score ?? 0) + (tierTasks[targetIdx]?.priority_score ?? 0)) / 2);
      const updated = prev.map((t) =>
        t.id === id ? { ...t, urgency: targetUrgency as Task["urgency"], priority_score: newScore } : t
      );
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urgency: targetUrgency, priority_score: newScore }),
      });
      return updated;
    });
    dragRef.current = null;
  }

  const tierTasks = (urgency: string) =>
    tasks.filter((t) => t.urgency === urgency).sort((a, b) => b.priority_score - a.priority_score);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">CRM</h1>
        <div className="flex gap-1">
          {(["kanban", "smart", "category"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-[var(--accent)] text-white" : "bg-[var(--ink-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading tasks…</p>}

      {/* Kanban */}
      {view === "kanban" && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {TIERS.map((tier) => (
            <div key={tier.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: tier.color }}>
                  {tier.label}
                </span>
                <span className="num text-[10px] text-[var(--text-muted)]">{tierTasks(tier.id).length}</span>
              </div>

              <div
                className="min-h-[80px] space-y-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragRef.current && onDrop("__bottom__", tier.id)}
              >
                {tierTasks(tier.id).map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task.id, task.urgency)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.stopPropagation(); onDrop(task.id, tier.id); }}
                    onClick={() => setSelected(task)}
                    className="glass rounded-xl p-3 cursor-pointer hover:border-[var(--accent)]/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                        className="w-4 h-4 mt-0.5 rounded border border-[var(--ink-4)] flex-shrink-0 hover:border-[var(--ok)] hover:bg-[var(--ok)]/20 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${task.key ? "font-semibold" : ""}`}>
                          {task.key && <span className="text-[var(--warn)] mr-1">★</span>}
                          {task.title}
                        </p>
                        {task.time_estimate_min && (
                          <p className="num text-[10px] text-[var(--text-muted)] mt-0.5">{task.time_estimate_min}m</p>
                        )}
                        {task.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.tags.map((tag) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-[var(--ink-3)] text-[9px] text-[var(--text-muted)]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add task */}
              {adding === tier.id ? (
                <div className="space-y-1">
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addTask(tier.id); if (e.key === "Escape") setAdding(null); }}
                    placeholder="Task title…"
                    className="w-full bg-[var(--ink-2)] border border-[var(--accent)] rounded-lg px-2 py-1.5 text-xs outline-none"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => addTask(tier.id)} className="px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px]">Add</button>
                    <button onClick={() => setAdding(null)} className="px-2 py-1 rounded bg-[var(--ink-2)] text-[var(--text-muted)] text-[10px]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAdding(tier.id); setNewTitle(""); }}
                  className="w-full text-left text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] py-1 transition-colors"
                >
                  + Add task
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Smart search */}
      {view === "smart" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSmartSearch()}
              placeholder='Ask anything — "what should I do this morning?"'
              className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
            />
            <button
              onClick={runSmartSearch}
              disabled={smartLoading}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {smartLoading ? "…" : "Ask"}
            </button>
          </div>
          <div className="space-y-2">
            {smartResults.map((task) => (
              <div key={task.id} onClick={() => setSelected(task)} className="glass rounded-xl p-3 cursor-pointer hover:border-[var(--accent)]/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-20">{task.urgency.replace("_", " ")}</span>
                  <span className="text-sm flex-1">{task.title}</span>
                </div>
              </div>
            ))}
            {smartResults.length === 0 && smartQuery && !smartLoading && (
              <p className="text-sm text-[var(--text-muted)]">No matching tasks found.</p>
            )}
          </div>
        </div>
      )}

      {/* Category view */}
      {view === "category" && !loading && (
        <div className="space-y-6">
          {TIERS.map((tier) => {
            const t = tierTasks(tier.id);
            if (!t.length) return null;
            return (
              <div key={tier.id}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: tier.color }}>
                  {tier.label} · {t.length}
                </p>
                <div className="space-y-1">
                  {t.map((task) => (
                    <div key={task.id} onClick={() => setSelected(task)} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[var(--ink-2)] cursor-pointer transition-colors">
                      <button onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                        className="w-4 h-4 rounded border border-[var(--ink-4)] flex-shrink-0 hover:border-[var(--ok)] hover:bg-[var(--ok)]/20 transition-colors" />
                      <span className="flex-1 text-sm">{task.key && <span className="text-[var(--warn)] mr-1">★</span>}{task.title}</span>
                      {task.time_estimate_min && <span className="num text-[10px] text-[var(--text-muted)]">{task.time_estimate_min}m</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task drawer */}
      {selected && (
        <TaskDrawer
          task={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => { updateTask(selected.id, patch); setSelected({ ...selected, ...patch }); }}
          onDelete={() => deleteTask(selected.id)}
          onComplete={() => { completeTask(selected.id); setSelected(null); }}
        />
      )}
    </div>
  );
}
