"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import type { CalEvent } from "@/app/api/calendar/route";

const TZ = "Asia/Bangkok";

/** YYYY-MM-DD in Bangkok time, regardless of the Mac's system timezone. */
function localDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

function sameDay(a: Date, b: Date): boolean {
  return localDateStr(a) === localDateStr(b);
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  });
}

export default function CalendarCard() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(
    () => new Date(new Date().toLocaleDateString("en-CA", { timeZone: TZ }) + "T00:00:00")
  );

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build 14-day strip starting from today in Bangkok time
  // Use a Date anchored to Bangkok midnight so day arithmetic is correct
  const todayBkk = new Date(new Date().toLocaleDateString("en-CA", { timeZone: TZ }) + "T00:00:00");
  const today = todayBkk;
  const days: Date[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayBkk);
    d.setDate(todayBkk.getDate() + i);
    return d;
  });

  const selectedEvents = events.filter((e) => sameDay(new Date(e.start), selectedDate));

  const hasEvents = (d: Date) => events.some((e) => sameDay(new Date(e.start), d));

  return (
    <Panel title="Calendar">
      <div className="px-4 pb-4 space-y-3">
        {/* 7-day strip */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {days.map((d) => {
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDate);
            const has = hasEvents(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 flex flex-col items-center w-9 py-1.5 rounded-xl transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] text-white"
                    : isToday
                    ? "bg-[var(--ink-3)] text-[var(--text-primary)]"
                    : "hover:bg-[var(--ink-2)] text-[var(--text-secondary)]"
                }`}
              >
                <span className="text-[9px] font-mono uppercase">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="num text-sm font-semibold">{d.getDate()}</span>
                {has && (
                  <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white/60" : "bg-[var(--accent)]"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ })}
          </p>

          {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

          {!loading && selectedEvents.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] italic">No events</p>
          )}

          {selectedEvents.map((e) => (
            <div key={e.id} className="flex gap-2 items-start py-1.5 border-b border-[var(--glass-border)] last:border-0">
              <div className="flex flex-col items-end w-12 flex-shrink-0">
                <span className="num text-[10px] text-[var(--text-muted)]">{formatTime(e.start, e.allDay)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{e.title}</p>
                {e.location && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{e.location}</p>
                )}
              </div>
              <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${
                e.calendar === "google"
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "bg-[var(--ok)]/20 text-[var(--ok)]"
              }`}>
                {e.calendar === "google" ? "G" : "A"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
