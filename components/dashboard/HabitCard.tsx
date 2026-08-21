"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import { localDateKey } from "@/lib/localDate";

const SIMPLE_HABITS = ["Read", "Journal", "20/20", "Church"];
const EXERCISE_OPTIONS = ["Weight lifting", "Muay thai", "Yoga", "Running", "Sauna", "Cold plunge"];
const SUPPLEMENT_OPTIONS = ["Multi vitamin", "L-Lysine", "Vitamin D3 & K2", "Hair growth", "Probiotic"];
const BAD_HABITS = ["Alcohol", "Smoking"];

interface HabitState {
  done: string[];
  exercise: string[];
  supplements: string[];
  bad_habits: string[];
  weight_kg: string;
}

interface NutritionMeal {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  estimated: boolean;
}

const STORAGE_KEY = (date: string) => `pos-habits-${date}`;
const DEFAULT_STATE: HabitState = { done: [], exercise: [], supplements: [], bad_habits: [], weight_kg: "" };

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function friendlyDate(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function HabitCard() {
  const today = localDateKey();
  const [activeDate, setActiveDate] = useState(today);
  const [state, setState] = useState<HabitState>(DEFAULT_STATE);
  const [showExercise, setShowExercise] = useState(false);
  const [showSupplements, setShowSupplements] = useState(false);
  const [showBad, setShowBad] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function merge(partial: Partial<HabitState>): HabitState {
    return {
      done: partial.done ?? [],
      exercise: partial.exercise ?? [],
      supplements: partial.supplements ?? [],
      bad_habits: partial.bad_habits ?? [],
      weight_kg: partial.weight_kg ?? "",
    };
  }

  useEffect(() => {
    dirtyRef.current = false;
    setState(DEFAULT_STATE);
    setShowExercise(false);

    const local = localStorage.getItem(STORAGE_KEY(activeDate));
    if (local) {
      try { setState(merge(JSON.parse(local))); } catch {}
    }

    fetch(`/api/habits?date=${activeDate}`)
      .then((r) => r.json())
      .then((data: Record<string, Partial<HabitState>>) => {
        if (!dirtyRef.current) {
          const server = merge(data[activeDate] ?? {});
          setState(server);
          localStorage.setItem(STORAGE_KEY(activeDate), JSON.stringify(server));
          // Re-sync any supplements that are checked but missing from nutrition
          if (server.supplements.length > 0) {
            reconcileSupplements(server.supplements, activeDate);
          }
        }
      })
      .catch(() => {});
  }, [activeDate]);

  function save(next: HabitState) {
    dirtyRef.current = true;
    setState(next);
    localStorage.setItem(STORAGE_KEY(activeDate), JSON.stringify(next));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/habits/${activeDate}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch((err) => console.error("[habits] save failed:", err));
    }, 600);
  }

  function toggleSimple(habit: string) {
    const done = state.done.includes(habit) ? state.done.filter((h) => h !== habit) : [...state.done, habit];
    save({ ...state, done });
  }
  function toggleExercise(opt: string) {
    const exercise = state.exercise.includes(opt) ? state.exercise.filter((e) => e !== opt) : [...state.exercise, opt];
    save({ ...state, exercise });
  }
  // Reconcile the full supplements list against nutrition in one atomic write.
  // Avoids race conditions when multiple supplements are toggled quickly.
  function reconcileSupplements(activeSupplements: string[], date: string) {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(async () => {
      try {
        // Fetch current nutrition
        const nutritionRes = await fetch(`/api/nutrition?date=${date}`);
        const nutritionData = await nutritionRes.json();
        const day = Array.isArray(nutritionData)
          ? nutritionData.find((d: { date: string }) => d.date === date)
          : null;
        const currentMeals: NutritionMeal[] = day?.meals ?? [];

        // Keep all non-supplement meals intact
        const foodMeals = currentMeals.filter((m) => !m.id.startsWith("supplement::"));

        // For each active supplement, add it if missing (fetch macros from bank)
        const supplementMeals: NutritionMeal[] = [];
        for (const name of activeSupplements) {
          const supplementId = `supplement::${name}`;
          const existing = currentMeals.find((m) => m.id === supplementId);
          if (existing) {
            supplementMeals.push(existing);
          } else {
            // Look up food bank
            let macros = { kcal: 0, p: 0, c: 0, f: 0 };
            try {
              const res = await fetch("/api/nutrition/estimate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: name }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.fromBank) {
                  macros = {
                    kcal: Number(data.kcal) || 0,
                    p: Number(data.p) || 0,
                    c: Number(data.c) || 0,
                    f: Number(data.f) || 0,
                  };
                }
              }
            } catch {}
            supplementMeals.push({ id: supplementId, name, ...macros, estimated: false });
          }
        }
        // (supplement meals for unchecked items are simply excluded)

        const newMeals = [...foodMeals, ...supplementMeals];

        await fetch("/api/nutrition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, meals: newMeals }),
        });

        localStorage.setItem(`pos-nutrition-${date}`, JSON.stringify(newMeals));
        window.dispatchEvent(new CustomEvent("supplementsChanged", { detail: { date } }));
      } catch (err) {
        console.error("[habits] supplement reconcile failed:", err);
      }
    }, 300); // short debounce so rapid toggles batch into one write
  }

  function toggleSupplement(opt: string) {
    const isAdding = !state.supplements.includes(opt);
    const supplements = isAdding
      ? [...state.supplements, opt]
      : state.supplements.filter((s) => s !== opt);
    save({ ...state, supplements });
    reconcileSupplements(supplements, activeDate);
  }
  function toggleBad(habit: string) {
    const bad_habits = state.bad_habits.includes(habit) ? state.bad_habits.filter((h) => h !== habit) : [...state.bad_habits, habit];
    save({ ...state, bad_habits });
  }
  function setWeight(weight_kg: string) { save({ ...state, weight_kg }); }

  const exerciseDone = state.exercise.length > 0;
  const totalDone = state.done.length + (exerciseDone ? 1 : 0);
  const total = SIMPLE_HABITS.length + 1;
  const isToday = activeDate === today;

  return (
    <Panel
      title="Habits"
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveDate(offsetDate(activeDate, -1))}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-3)] transition-colors text-xs"
          >
            ‹
          </button>
          <span className="text-[10px] font-mono text-[var(--text-muted)] min-w-[54px] text-center">
            {friendlyDate(activeDate, today)}
          </span>
          <button
            onClick={() => setActiveDate(offsetDate(activeDate, 1))}
            disabled={isToday}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-3)] transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>
          <span className="num text-[10px] text-[var(--text-muted)] ml-1">{totalDone}/{total}</span>
        </div>
      }
    >
      <div className="px-4 pb-4 space-y-2">
        {/* Progress bar */}
        <div className="h-1 bg-[var(--ink-2)] rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-[var(--ok)] rounded-full transition-all duration-300" style={{ width: `${(totalDone / total) * 100}%` }} />
        </div>

        {/* Exercise */}
        <div>
          <button
            onClick={() => setShowExercise((v) => !v)}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
              exerciseDone ? "bg-[var(--ok)]/15 border border-[var(--ok)]/30" : "bg-[var(--ink-2)] hover:bg-[var(--ink-3)] border border-transparent"
            }`}
          >
            <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] transition-colors ${
              exerciseDone ? "bg-[var(--ok)] border-[var(--ok)] text-white" : "border-[var(--ink-4)]"
            }`}>{exerciseDone && "✓"}</span>
            <span className={`flex-1 text-xs ${exerciseDone ? "text-[var(--ok)]" : "text-[var(--text-secondary)]"}`}>Exercise</span>
            {state.exercise.length > 0 && <span className="text-[10px] text-[var(--text-muted)]">{state.exercise.join(", ")}</span>}
            <span className="text-[var(--text-muted)] text-[10px]">{showExercise ? "▲" : "▼"}</span>
          </button>
          {showExercise && (
            <div className="mt-1 ml-6 grid grid-cols-2 lg:grid-cols-3 gap-1">
              {EXERCISE_OPTIONS.map((opt) => {
                const active = state.exercise.includes(opt);
                return (
                  <button key={opt} onClick={() => toggleExercise(opt)}
                    className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                      active ? "bg-[var(--ok)]/20 text-[var(--ok)]" : "bg-[var(--ink-2)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}>
                    {active ? "✓ " : ""}{opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Simple habits */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {SIMPLE_HABITS.map((habit) => {
            const checked = state.done.includes(habit);
            return (
              <button key={habit} onClick={() => toggleSimple(habit)}
                className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
                  checked ? "bg-[var(--ok)]/15 border border-[var(--ok)]/30" : "bg-[var(--ink-2)] hover:bg-[var(--ink-3)] border border-transparent"
                }`}>
                <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] ${
                  checked ? "bg-[var(--ok)] border-[var(--ok)] text-white" : "border-[var(--ink-4)]"
                }`}>{checked && "✓"}</span>
                <span className={`text-xs ${checked ? "text-[var(--ok)]" : "text-[var(--text-secondary)]"}`}>{habit}</span>
              </button>
            );
          })}
        </div>

        {/* Weight */}
        <div className="flex items-center gap-2 bg-[var(--ink-2)] rounded-lg px-3 py-2">
          <span className="text-xs text-[var(--text-secondary)] flex-1">Weight</span>
          <input type="number" step="0.1" min="30" max="200" value={state.weight_kg}
            onChange={(e) => setWeight(e.target.value)} onBlur={() => save(state)} placeholder="—"
            className="num w-16 bg-transparent text-right text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">kg</span>
        </div>

        {/* Supplements */}
        <div>
          <button onClick={() => setShowSupplements((v) => !v)}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
              state.supplements.length > 0 ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30" : "bg-[var(--ink-2)] hover:bg-[var(--ink-3)] border border-transparent"
            }`}>
            <span className={`text-xs flex-1 ${state.supplements.length > 0 ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>Supplements</span>
            {state.supplements.length > 0 && <span className="num text-[10px] text-[var(--accent)]">{state.supplements.length}/{SUPPLEMENT_OPTIONS.length}</span>}
            <span className="text-[var(--text-muted)] text-[10px]">{showSupplements ? "▲" : "▼"}</span>
          </button>
          {showSupplements && (
            <div className="mt-1 ml-2 flex flex-col gap-1">
              {SUPPLEMENT_OPTIONS.map((opt) => {
                const active = state.supplements.includes(opt);
                return (
                  <button key={opt} onClick={() => toggleSupplement(opt)}
                    className={`text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                      active ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--ink-2)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}>
                    {active ? "✓ " : ""}{opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bad habits */}
        <div>
          <button onClick={() => setShowBad((v) => !v)}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
              state.bad_habits.length > 0 ? "bg-[var(--danger)]/15 border border-[var(--danger)]/30" : "bg-[var(--ink-2)] hover:bg-[var(--ink-3)] border border-transparent"
            }`}>
            <span className={`text-xs flex-1 ${state.bad_habits.length > 0 ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}>Bad habits</span>
            {state.bad_habits.length > 0 && <span className="text-[10px] text-[var(--danger)]">{state.bad_habits.join(", ")}</span>}
            <span className="text-[var(--text-muted)] text-[10px]">{showBad ? "▲" : "▼"}</span>
          </button>
          {showBad && (
            <div className="mt-1 ml-2 flex gap-2">
              {BAD_HABITS.map((habit) => {
                const active = state.bad_habits.includes(habit);
                return (
                  <button key={habit} onClick={() => toggleBad(habit)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                      active ? "bg-[var(--danger)]/20 text-[var(--danger)]" : "bg-[var(--ink-2)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}>
                    {active ? "✓ " : ""}{habit}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
