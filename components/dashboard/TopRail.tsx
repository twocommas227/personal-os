"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const TABS = [
  { label: "Home",    href: "/" },
  { label: "CRM",     href: "/crm" },
  { label: "Brain",   href: "/brain" },
  { label: "Finance", href: "/finance" },
  { label: "Journal", href: "/journal" },
  { label: "Health",  href: "/health" },
];

export default function TopRail() {
  const pathname = usePathname();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
      setDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--ink-1)] sticky top-0 z-40">
      {/* Brand */}
      <span className="font-mono text-sm font-semibold tracking-tight text-[var(--text-primary)]">
        personal<span className="text-[var(--accent)]">.</span>os
      </span>

      {/* Tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-2)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Date/time + avatar */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="num text-sm text-[var(--text-primary)]">{time}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{date}</p>
        </div>
        <button
          onClick={logout}
          className="w-7 h-7 rounded-full bg-[var(--ink-3)] flex items-center justify-center text-xs font-mono font-bold text-[var(--accent)] hover:opacity-80 transition-opacity"
          title="Sign out"
        >
          J
        </button>
      </div>
    </header>
  );
}
