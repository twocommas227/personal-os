"use client";

import { useState } from "react";
import type { Task } from "./CRMBoard";

const URGENCY_OPTIONS = ["today", "this_week", "this_month", "someday"] as const;

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onComplete: () => void;
}

export default function TaskDrawer({ task, onClose, onUpdate, onDelete, onComplete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [urgency, setUrgency] = useState(task.urgency);
  const [key, setKey] = useState(task.key);
  const [estimate, setEstimate] = useState(String(task.time_estimate_min ?? ""));
  const [tags, setTags] = useState(task.tags?.join(", ") ?? "");

  function save() {
    onUpdate({
      title,
      description,
      urgency,
      key,
      time_estimate_min: estimate ? Number(estimate) : undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--ink-1)] border-l border-[var(--glass-border)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
          <span className="text-sm font-medium">Edit Task</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--ink-2)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[var(--ink-2)] rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Urgency</label>
            <div className="grid grid-cols-2 gap-1">
              {URGENCY_OPTIONS.map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`py-2 rounded-lg text-xs capitalize transition-colors ${
                    urgency === u ? "bg-[var(--accent)] text-white" : "bg-[var(--ink-2)] text-[var(--text-secondary)] hover:bg-[var(--ink-3)]"
                  }`}
                >
                  {u.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Estimate (min)</label>
              <input
                type="number"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="—"
                className="w-full bg-[var(--ink-2)] rounded-lg px-3 py-2 text-sm outline-none num focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Key task</label>
              <button
                onClick={() => setKey(!key)}
                className={`w-full py-2 px-3 rounded-lg text-xs transition-colors ${
                  key ? "bg-[var(--warn)]/20 text-[var(--warn)]" : "bg-[var(--ink-2)] text-[var(--text-secondary)]"
                }`}
              >
                {key ? "★ Key" : "☆ Normal"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Tags (comma separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, health, …"
              className="w-full bg-[var(--ink-2)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--glass-border)] flex gap-2">
          <button onClick={save} className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
            Save
          </button>
          <button onClick={onComplete} className="py-2 px-3 rounded-lg bg-[var(--ok)]/20 text-[var(--ok)] text-sm hover:bg-[var(--ok)]/30 transition-colors">
            ✓ Done
          </button>
          <button onClick={onDelete} className="py-2 px-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm hover:bg-[var(--danger)]/30 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
