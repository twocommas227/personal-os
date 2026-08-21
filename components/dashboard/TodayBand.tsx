"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/localDate";
import type { CalEvent } from "@/app/api/calendar/route";

const TZ = "Asia/Bangkok";
const SIMPLE_HABITS = ["Read", "Journal", "20/20", "Church"];
const TOTAL_HABITS = SIMPLE_HABITS.length + 1; // + Exercise

interface Meal {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

interface Reminder {
  id: string;
  message: string;
  remind_at: string;
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <svg viewBox="0 0 40 40" className="w-16 h-16 flex-shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="7" className="stroke-[var(--ink-2)]" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-[var(--ok)] transition-[stroke-dashoffset] duration-500"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
    </svg>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2.5">
        {label}
      </p>
      {children}
    </div>
  );
}

export default function TodayBand() {
  const today = localDateKey();
  const [habitsDone, setHabitsDone] = useState(0);
  const [habitNames, setHabitNames] = useState<string[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [nextEvent, setNextEvent] = useState<CalEvent | null>(null);
  const [nextReminder, setNextReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    fetch(`/api/habits?date=${today}`)
      .then((r) => r.json())
      .then((data: Record<string, { done?: string[]; exercise?: string[] }>) => {
        const day = data[today] ?? {};
        const done = day.done ?? [];
        const exercise = day.exercise ?? [];
        const names = [...done, ...(exercise.length > 0 ? ["Exercise"] : [])];
        setHabitNames(names);
        setHabitsDone(names.length);
      })
      .catch(() => {});

    fetch(`/api/nutrition?date=${today}`)
      .then((r) => r.json())
      .then((data: { date: string; meals: Meal[] }[]) => {
        const day = Array.isArray(data) ? data.find((d) => d.date === today) : null;
        setMeals((day?.meals ?? []).filter((m) => !m.id?.startsWith("supplement::")));
      })
      .catch(() => {});

    fetch("/api/calendar")
      .then((r) => r.json())
      .then((events: CalEvent[]) => {
        const now = Date.now();
        const upcoming = (events ?? [])
          .filter((e) => new Date(e.start).getTime() >= now)
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setNextEvent(upcoming[0] ?? null);
      })
      .catch(() => {});

    fetch("/api/reminders")
      .then((r) => r.json())
      .then((data: Reminder[]) => {
        if (Array.isArray(data) && data.length) setNextReminder(data[0]);
      })
      .catch(() => {});
  }, [today]);

  const kcal = Math.round(meals.reduce((s, m) => s + (m.kcal ?? 0), 0));
  const p = Math.round(meals.reduce((s, m) => s + (m.p ?? 0), 0));
  const c = Math.round(meals.reduce((s, m) => s + (m.c ?? 0), 0));
  const f = Math.round(meals.reduce((s, m) => s + (m.f ?? 0), 0));

  function eventTime(e: CalEvent) {
    if (e.allDay) return "All day";
    return new Date(e.start).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
    });
  }

  function eventDay(e: CalEvent) {
    const d = new Date(e.start).toLocaleDateString("en-CA", { timeZone: TZ });
    if (d === today) return "";
    return new Date(e.start).toLocaleDateString("en-US", {
      weekday: "short", timeZone: TZ,
    }) + " ";
  }

  function reminderWhen(iso: string) {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
    });
    if (dateStr === today) return time;
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }) + " " + time;
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-[var(--glass-border)]">

        {/* Habits ring */}
        <Cell label="Habits · Today">
          <div className="flex items-center gap-4">
            <Ring done={habitsDone} total={TOTAL_HABITS} />
            <div className="min-w-0">
              <p className="num text-2xl font-semibold leading-none">
                {habitsDone}
                <span className="text-[var(--text-muted)] text-base">/{TOTAL_HABITS}</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate">
                {habitNames.length ? habitNames.join(" · ") : "Nothing logged yet"}
              </p>
            </div>
          </div>
        </Cell>

        {/* Nutrition */}
        <Cell label="Nutrition">
          <p className="num text-2xl font-semibold leading-none">
            {meals.length ? kcal.toLocaleString() : "—"}
            <span className="text-[var(--text-muted)] text-sm ml-1.5">kcal</span>
          </p>
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {([["p", p, "var(--ok)"], ["c", c, "var(--warn)"], ["f", f, "var(--danger)"]] as const).map(
              ([key, val, color]) => (
                <span
                  key={key}
                  className="num text-[10.5px] px-2.5 py-1 rounded-full border border-[var(--glass-border)]"
                  style={{ color: meals.length ? color : "var(--text-muted)" }}
                >
                  {meals.length ? val : "—"} {key}
                </span>
              )
            )}
          </div>
        </Cell>

        {/* Next up */}
        <Cell label="Next up">
          {nextEvent ? (
            <>
              <p className="text-sm font-medium truncate">
                <span className="num text-[var(--accent)] mr-2">
                  {eventDay(nextEvent)}{eventTime(nextEvent)}
                </span>
                {nextEvent.title}
              </p>
              {nextReminder && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate">
                  Then <span className="num">{reminderWhen(nextReminder.remind_at)}</span> · {nextReminder.message}
                </p>
              )}
            </>
          ) : nextReminder ? (
            <p className="text-sm font-medium truncate">
              <span className="num text-[var(--accent)] mr-2">{reminderWhen(nextReminder.remind_at)}</span>
              {nextReminder.message}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">Nothing scheduled</p>
          )}
        </Cell>

      </div>
    </div>
  );
}
