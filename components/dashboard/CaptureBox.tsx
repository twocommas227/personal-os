"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

export default function CaptureBox() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastKind, setLastKind] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Focus the textarea whenever the box opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Collapse on click outside (only when there's nothing typed)
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node) && !text.trim()) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, text]);

  async function submit() {
    if (!text.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLastKind(data.classification?.kind ?? "captured");
      setText("");
      setStatus("success");
      setOpen(false);
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      setText("");
      setOpen(false);
    }
  }

  // ── Collapsed: small pill ──────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-xl hover:border-[var(--accent)] transition-colors"
        title="Capture anything"
      >
        <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs leading-none">
          +
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {status === "loading" && "classifying…"}
          {status === "success" && `✓ saved as ${lastKind}`}
          {status === "error" && "✗ failed — try again"}
          {status === "idle" && "Capture"}
        </span>
      </button>
    );
  }

  // ── Expanded: full capture box ─────────────────────────────────────
  return (
    <div ref={boxRef} className="fixed bottom-5 right-5 w-[min(22rem,calc(100vw-2.5rem))] z-50">
      <div className="glass rounded-2xl p-3 shadow-2xl">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Capture anything…"
          rows={2}
          className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
          style={{ maxHeight: "120px" }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {status === "loading" ? "classifying…" : "Enter to send · Esc to close"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setText(""); setOpen(false); }}
              className="px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Close
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() || status === "loading"}
              className="px-3 py-1 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
