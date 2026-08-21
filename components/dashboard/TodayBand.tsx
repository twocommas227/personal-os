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

/** A stat tile: icon chip, badge, hero number, supporting line. */
function Tile({
  icon,
  label,
  badge,
  children,
}: {
  icon: string;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-xl bg-[var(--ink-2)] grid place-items-center text-[13px] flex-shrink-0"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-muted)] flex-1 truncate">
          {label}
        </span>
        {badge && (
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[var(--ink-2)] text-[var(--text-muted)] flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Hero({ value, unit, sub }: { value: string; unit?: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="num text-[26px] leading-none font-semibold tracking-tight">
        {value}
        {unit && <span className="text-[var(--text-muted)] text-sm ml-1.5">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate">{sub}</p>}
    </div>
  );
}

/** Five dots — one per habit — so completion reads as shape, not just a number. */
function HabitPips({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${done} of ${total} habits done`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-[var(--ok)]" : "bg-[var(--ink-2)]"}`}
        />
      ))}
    </div>
  );
}

export default function TodayBand() {
  const today = localDateKey();
  const [habitsDone, setHabitsDone] = useState(0);
  const [habitNames, setHabitNames] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [nextEvent, setNextEvent] = useState<CalEvent | null>(null);
  const [nextReminder, setNextReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    fetch(`/api/habits?date=${today}`)
      .then((r) => r.json())
      .then((data: Record<string, { done?: string[]; exercise?: string[]; weight_kg?: string }>) => {
        const day = data[today] ?? {};
        const names = [...(day.done ?? []), ...((day.exercise ?? []).length > 0 ? ["Exercise"] : [])];
        setHabitNames(names);
        setHabitsDone(names.length);
        setWeight(day.weight_kg ?? "");
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
  const protein = Math.round(meals.reduce((s, m) => s + (m.p ?? 0), 0));

  function whenLabel(iso: string, allDay = false) {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
    if (allDay) return dateStr === today ? "All day" : d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
    });
    if (dateStr === today) return time;
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }) + " " + time;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

      {/* Habits */}
      <Tile icon="✳️" label="Habits" badge="Today">
        <Hero
          value={String(habitsDone)}
          unit={`/ ${TOTAL_HABITS}`}
          sub={habitNames.length ? habitNames.join(" · ") : "Nothing logged yet"}
        />
        <HabitPips done={habitsDone} total={TOTAL_HABITS} />
      </Tile>

      {/* Nutrition */}
      <Tile icon="🍽️" label="Nutrition" badge="Today">
        <Hero
          value={meals.length ? kcal.toLocaleString() : "—"}
          unit="kcal"
          sub={meals.length ? `${protein}g protein · ${meals.length} meals` : "Nothing logged yet"}
        />
      </Tile>

      {/* Weight */}
      <Tile icon="⚖️" label="Weight" badge="Today">
        <Hero
          value={weight || "—"}
          unit={weight ? "kg" : undefined}
          sub={weight ? "Logged today" : "Not logged today"}
        />
      </Tile>

      {/* Next up */}
      <Tile icon="📅" label="Next up">
        {nextEvent ? (
          <div className="min-w-0">
            <p className="num text-[15px] font-semibold text-[var(--accent)] leading-none">
              {whenLabel(nextEvent.start, nextEvent.allDay)}
            </p>
            <p className="text-[13px] mt-1.5 truncate">{nextEvent.title}</p>
            {nextReminder && (
              <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">
                Then {whenLabel(nextReminder.remind_at)} · {nextReminder.message}
              </p>
            )}
          </div>
        ) : nextReminder ? (
          <div className="min-w-0">
            <p className="num text-[15px] font-semibold text-[var(--accent)] leading-none">
              {whenLabel(nextReminder.remind_at)}
            </p>
            <p className="text-[13px] mt-1.5 truncate">{nextReminder.message}</p>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)] italic">Nothing scheduled</p>
        )}
      </Tile>

    </div>
  );
}
