"use client";

import { useEffect, useRef, useState } from "react";

interface Task {
  id: string;
  title: string;
  description?: string;
  urgency: string;
  tags?: string[];
  created_at: string;
  completed_at?: string | null;
}

const URGENCIES = ["today", "this_week", "this_month", "someday"] as const;
type Urgency = typeof URGENCIES[number];

const URGENCY_META: Record<Urgency, { label: string; dot: string; color: string }> = {
  today:      { label: "Today",      dot: "🔴", color: "text-[var(--danger)]" },
  this_week:  { label: "This week",  dot: "🟡", color: "text-yellow-400" },
  this_month: { label: "This month", dot: "🟢", color: "text-[var(--ok)]" },
  someday:    { label: "Someday",    dot: "⚪", color: "text-[var(--text-muted)]" },
};

function nextUrgency(u: string): Urgency {
  const idx = URGENCIES.indexOf(u as Urgency);
  return URGENCIES[(idx + 1) % URGENCIES.length];
}

export default function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loadingDone, setLoadingDone] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrgency, setNewUrgency] = useState<Urgency>("this_week");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Task[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadOpen(); }, []);

  async function loadOpen() {
    const res = await fetch("/api/tasks?status=open");
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  async function loadDone() {
    if (loadingDone) return;
    setLoadingDone(true);
    const res = await fetch("/api/tasks?status=done");
    const data = await res.json();
    setDone(Array.isArray(data) ? data.slice(0, 30) : []);
    setLoadingDone(false);
  }

  async function addTask() {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), urgency: newUrgency, priority_score: 0 }),
    });
    const task = await res.json();
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setAdding(false);
  }

  async function complete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (searchResults) setSearchResults((prev) => prev?.filter((t) => t.id !== id) ?? null);
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
  }

  async function cycleUrgency(id: string, current: string) {
    const next = nextUrgency(current);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, urgency: next } : t));
    if (searchResults) setSearchResults((prev) => prev?.map((t) => t.id === id ? { ...t, urgency: next } : t) ?? null);
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urgency: next }),
    });
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (searchResults) setSearchResults((prev) => prev?.filter((t) => t.id !== id) ?? null);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  function onSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch("/api/tasks/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: val }),
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setSearching(false);
    }, 500);
  }

  const displayTasks = searchResults ?? tasks;
  const grouped = URGENCIES.reduce<Record<string, Task[]>>((acc, u) => {
    acc[u] = displayTasks.filter((t) => t.urgency === u);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Search + add */}
      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searching ? "Searching…" : "Search tasks…"}
          className="w-full bg-[var(--ink-1)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)]"
        />
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a task…"
            className="flex-1 bg-[var(--ink-1)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)]"
          />
          {/* Urgency picker */}
          <select
            value={newUrgency}
            onChange={(e) => setNewUrgency(e.target.value as Urgency)}
            className="bg-[var(--ink-1)] border border-[var(--glass-border)] rounded-xl px-3 text-xs text-[var(--text-secondary)] outline-none"
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>{URGENCY_META[u].dot} {URGENCY_META[u].label}</option>
            ))}
          </select>
          <button
            onClick={addTask}
            disabled={adding || !newTitle.trim()}
            className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {adding ? "…" : "Add"}
          </button>
        </div>
      </div>

      {/* Task groups */}
      {URGENCIES.map((urgency) => {
        const group = grouped[urgency];
        if (!group?.length) return null;
        const meta = URGENCY_META[urgency];
        return (
          <div key={urgency}>
            <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
              <span>{meta.dot}</span> {meta.label}
              <span className="ml-1 opacity-60">({group.length})</span>
            </p>
            <div className="space-y-1">
              {group.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => complete(task.id)}
                  onCycleUrgency={() => cycleUrgency(task.id, task.urgency)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {displayTasks.length === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">
          {search ? "No tasks match that search." : "No open tasks 🎉"}
        </div>
      )}

      {/* Completed */}
      {!search && (
        <div className="border-t border-[var(--glass-border)] pt-4">
          <button
            onClick={() => { setShowDone((v) => !v); if (!showDone && !done.length) loadDone(); }}
            className="text-[10px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
          >
            ✓ Completed {showDone ? "▲" : "▼"}
          </button>
          {showDone && (
            <div className="mt-2 space-y-1 opacity-50">
              {loadingDone && <p className="text-xs text-[var(--text-muted)] px-2">Loading…</p>}
              {done.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ink-1)]">
                  <span className="w-4 h-4 rounded-full bg-[var(--ok)] flex items-center justify-center text-[9px] text-white flex-shrink-0">✓</span>
                  <span className="flex-1 text-xs text-[var(--text-muted)] line-through">{task.title}</span>
                  <button onClick={() => deleteTask(task.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onCycleUrgency,
  onDelete,
}: {
  task: Task;
  onComplete: () => void;
  onCycleUrgency: () => void;
  onDelete: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const meta = URGENCY_META[task.urgency as Urgency] ?? URGENCY_META.someday;

  async function handleComplete() {
    setChecking(true);
    await onComplete();
  }

  return (
    <div className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--ink-1)] hover:bg-[var(--ink-2)] transition-colors border border-transparent hover:border-[var(--glass-border)]">
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={checking}
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          checking
            ? "bg-[var(--ok)] border-[var(--ok)]"
            : "border-[var(--ink-4)] hover:border-[var(--ok)] hover:bg-[var(--ok)]/20"
        }`}
      >
        {checking && <span className="text-[8px] text-white">✓</span>}
      </button>

      {/* Title */}
      <span className="flex-1 text-sm text-[var(--text-primary)] leading-snug">{task.title}</span>

      {/* Urgency badge — click to cycle */}
      <button
        onClick={onCycleUrgency}
        className={`text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--ink-3)] ${meta.color} hover:opacity-80 transition-opacity flex-shrink-0`}
        title="Click to change urgency"
      >
        {meta.dot} {meta.label}
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
