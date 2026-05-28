"use client";

import { useState, useRef, KeyboardEvent } from "react";

export default function CaptureBox() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastKind, setLastKind] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-sm z-50">
      <div className="glass rounded-2xl p-3 shadow-2xl">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Capture anything… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
          style={{ maxHeight: "120px" }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {status === "loading" && "classifying…"}
            {status === "success" && `✓ saved as ${lastKind}`}
            {status === "error" && "✗ failed — try again"}
          </span>
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
  );
}
