"use client";

import { useEffect, useState } from "react";

interface HabitState {
  done: string[];
  exercise: string[];
  supplements: string[];
  bad_habits: string[];
  weight_kg: string;
}

interface NutritionDay {
  date: string;
  meals: { kcal: number; p: number; c: number; f: number }[];
}

const SIMPLE_HABITS = ["Read", "Meditate", "Journal", "Sleep by midnight"];
const EXERCISE_OPTIONS = ["Weight lifting", "Muay thai", "Yoga", "Running", "Sauna", "Cold plunge"];

function SparkLine({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 200, H = 48;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ values, color = "var(--accent)", maxVal }: { values: number[]; color?: string; maxVal?: number }) {
  const max = maxVal ?? Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-h-[2px] transition-all"
          style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%`, backgroundColor: color, opacity: v > 0 ? 1 : 0.15 }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--ink-2)] rounded-xl px-3 py-2.5">
      <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="num text-lg font-semibold text-[var(--text-primary)] leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

export default function HealthPanel() {
  const [habits, setHabits] = useState<Record<string, HabitState>>({});
  const [nutrition, setNutrition] = useState<NutritionDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/habits?days=30").then((r) => r.json()),
      fetch("/api/nutrition?days=30").then((r) => r.json()),
    ]).then(([h, n]) => {
      setHabits(h);
      setNutrition(n);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Weight ──────────────────────────────────────────────
  const weightEntries = Object.entries(habits)
    .map(([date, h]) => ({ date, kg: parseFloat(h.weight_kg ?? "") }))
    .filter((e) => !isNaN(e.kg) && e.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const currentWeight = weightEntries[weightEntries.length - 1]?.kg ?? null;
  const firstWeight = weightEntries[0]?.kg ?? null;
  const weightDelta = currentWeight && firstWeight ? +(currentWeight - firstWeight).toFixed(1) : null;
  const weightValues = weightEntries.map((e) => e.kg);

  // ── Nutrition ────────────────────────────────────────────
  const sortedNutrition = [...nutrition].sort((a, b) => a.date.localeCompare(b.date));
  const last30 = sortedNutrition.slice(-30);
  const dailyKcal = last30.map((d) => d.meals.reduce((s, m) => s + (m.kcal ?? 0), 0));
  const loggedDays = dailyKcal.filter((k) => k > 0);
  const avgKcal = loggedDays.length ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : 0;

  const last7 = sortedNutrition.slice(-7);
  const avgMacros = last7.reduce(
    (acc, d) => {
      const meals = d.meals;
      return {
        p: acc.p + meals.reduce((s, m) => s + (m.p ?? 0), 0),
        c: acc.c + meals.reduce((s, m) => s + (m.c ?? 0), 0),
        f: acc.f + meals.reduce((s, m) => s + (m.f ?? 0), 0),
        days: acc.days + (meals.length > 0 ? 1 : 0),
      };
    },
    { p: 0, c: 0, f: 0, days: 0 }
  );
  const macroBase = avgMacros.days || 1;

  // ── Habit streaks ─────────────────────────────────────────
  function streak(check: (h: HabitState) => boolean): number {
    const dates = Object.keys(habits).sort((a, b) => b.localeCompare(a));
    let count = 0;
    for (const date of dates) {
      if (check(habits[date])) count++;
      else break;
    }
    return count;
  }

  // ── Exercise breakdown ────────────────────────────────────
  const exerciseCounts: Record<string, number> = {};
  Object.values(habits).forEach((h) => {
    (h.exercise ?? []).forEach((e) => {
      exerciseCounts[e] = (exerciseCounts[e] ?? 0) + 1;
    });
  });
  const totalExerciseDays = Object.values(habits).filter((h) => (h.exercise ?? []).length > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-xs text-[var(--text-muted)]">Loading health data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Health</h2>
        <p className="text-xs text-[var(--text-muted)]">30-day overview</p>
      </div>

      {/* ── WEIGHT ── */}
      <section className="glass rounded-2xl p-4 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Weight</p>
          {weightDelta !== null && (
            <span className={`text-[10px] font-mono ${weightDelta <= 0 ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>
              {weightDelta > 0 ? "+" : ""}{weightDelta} kg (30d)
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Current" value={currentWeight ? `${currentWeight} kg` : "—"} />
          <StatCard label="Entries" value={`${weightEntries.length}`} sub="days logged" />
          <StatCard label="Change" value={weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg` : "—"} />
        </div>
        {weightValues.length > 1 && (
          <div className="pt-1">
            <SparkLine values={weightValues} color="var(--accent)" />
            <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-0.5">
              <span>{weightEntries[0]?.date.slice(5)}</span>
              <span>{weightEntries[weightEntries.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ── NUTRITION ── */}
      <section className="glass rounded-2xl p-4 border border-[var(--glass-border)] space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Nutrition (30d)</p>
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Avg kcal" value={avgKcal > 0 ? `${avgKcal}` : "—"} sub="per day" />
          <StatCard label="Avg protein" value={avgMacros.days > 0 ? `${Math.round(avgMacros.p / macroBase)}g` : "—"} />
          <StatCard label="Avg carbs" value={avgMacros.days > 0 ? `${Math.round(avgMacros.c / macroBase)}g` : "—"} />
          <StatCard label="Avg fat" value={avgMacros.days > 0 ? `${Math.round(avgMacros.f / macroBase)}g` : "—"} />
        </div>
        {dailyKcal.some((k) => k > 0) && (
          <div>
            <BarChart values={dailyKcal} color="var(--accent)" />
            <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-0.5">
              <span>{last30[0]?.date.slice(5)}</span>
              <span>{loggedDays.length} days logged</span>
              <span>{last30[last30.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ── HABITS ── */}
      <section className="glass rounded-2xl p-4 border border-[var(--glass-border)] space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Habit Streaks</p>
        <div className="grid grid-cols-2 gap-2">
          {SIMPLE_HABITS.map((habit) => {
            const s = streak((h) => (h.done ?? []).includes(habit));
            return (
              <div key={habit} className="flex items-center justify-between bg-[var(--ink-2)] rounded-lg px-3 py-2">
                <span className="text-xs text-[var(--text-secondary)]">{habit}</span>
                <span className={`num text-sm font-semibold ${s > 0 ? "text-[var(--ok)]" : "text-[var(--text-muted)]"}`}>
                  {s > 0 ? `${s}🔥` : "—"}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between bg-[var(--ink-2)] rounded-lg px-3 py-2">
            <span className="text-xs text-[var(--text-secondary)]">Exercise</span>
            <span className={`num text-sm font-semibold ${streak((h) => (h.exercise ?? []).length > 0) > 0 ? "text-[var(--ok)]" : "text-[var(--text-muted)]"}`}>
              {streak((h) => (h.exercise ?? []).length > 0) > 0 ? `${streak((h) => (h.exercise ?? []).length > 0)}🔥` : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* ── EXERCISE BREAKDOWN ── */}
      {Object.keys(exerciseCounts).length > 0 && (
        <section className="glass rounded-2xl p-4 border border-[var(--glass-border)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Exercise Breakdown (30d)</p>
            <span className="text-[10px] text-[var(--text-muted)]">{totalExerciseDays} active days</span>
          </div>
          <div className="space-y-2">
            {EXERCISE_OPTIONS.filter((e) => exerciseCounts[e]).map((e) => {
              const count = exerciseCounts[e] ?? 0;
              const pct = Math.round((count / totalExerciseDays) * 100);
              return (
                <div key={e} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">{e}</span>
                    <span className="num text-xs text-[var(--text-muted)]">{count}x</span>
                  </div>
                  <div className="h-1 bg-[var(--ink-2)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--ok)] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
