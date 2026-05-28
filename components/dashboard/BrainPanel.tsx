"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MemoryChunk {
  id: string;
  text: string;
  source_type: string;
  created_at: string;
  similarity?: number;
}

const SOURCE_LABELS: Record<string, string> = {
  capture: "Capture",
  task: "Task",
  journal: "Journal",
  habit: "Habit",
  meal: "Meal",
};

const SOURCE_COLORS: Record<string, string> = {
  capture: "bg-[var(--accent)]/20 text-[var(--accent)]",
  task: "bg-[var(--ok)]/20 text-[var(--ok)]",
  journal: "bg-purple-500/20 text-purple-400",
  habit: "bg-orange-500/20 text-orange-400",
  meal: "bg-pink-500/20 text-pink-400",
};

const SOURCES = ["all", "capture", "task", "journal", "habit", "meal"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default function BrainPanel() {
  const [memories, setMemories] = useState<MemoryChunk[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"recent" | "search">("recent");
  const [total, setTotal] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRecent = useCallback(async (src: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory?limit=50&source=${src}`);
      const data = await res.json();
      setMemories(data);
      if (src === "all") setTotal(data.length);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecent(source);
  }, [source, loadRecent]);

  async function semanticSearch(q: string) {
    if (!q.trim()) {
      setMode("recent");
      loadRecent(source);
      return;
    }
    setMode("search");
    setLoading(true);
    try {
      const res = await fetch("/api/memory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, threshold: 0.25, limit: 20 }),
      });
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  function onQueryChange(val: string) {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => semanticSearch(val), 500);
  }

  function clearSearch() {
    setQuery("");
    setMode("recent");
    loadRecent(source);
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Memory</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {total !== null ? `${total} memories stored` : "Semantic search over everything you've captured"}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your memory semantically…"
          className="w-full pl-8 pr-10 py-3 bg-[var(--ink-2)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-xl text-sm outline-none transition-colors placeholder:text-[var(--text-muted)]"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Source filter (only in recent mode) */}
      {mode === "recent" && (
        <div className="flex gap-1.5 flex-wrap">
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wide transition-colors ${
                source === s
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--ink-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s === "all" ? "All" : SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Mode label */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
          {mode === "search" ? `Semantic results for "${query}"` : "Recent memories"}
        </span>
        {loading && <span className="text-[10px] text-[var(--text-muted)] animate-pulse">searching…</span>}
      </div>

      {/* Memory list */}
      <div className="space-y-2">
        {!loading && memories.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            {mode === "search" ? "No memories matched — try a different query" : "No memories yet — start capturing!"}
          </div>
        )}

        {memories.map((m) => (
          <div
            key={m.id}
            className="glass rounded-xl px-4 py-3 space-y-1.5 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${SOURCE_COLORS[m.source_type] ?? "bg-[var(--ink-3)] text-[var(--text-muted)]"}`}>
                {SOURCE_LABELS[m.source_type] ?? m.source_type}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto">{timeAgo(m.created_at)}</span>
              {m.similarity !== undefined && (
                <span className="text-[10px] font-mono text-[var(--accent)]">
                  {Math.round(m.similarity * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{m.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
