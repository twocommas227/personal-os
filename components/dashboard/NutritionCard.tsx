"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import { localDateKey } from "@/lib/localDate";

interface Meal {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  estimated: boolean;
}

const STORAGE_KEY = (date: string) => `pos-nutrition-${date}`;

function sum(meals: Meal[], key: keyof Meal) {
  return meals.reduce((acc, m) => acc + (m[key] as number), 0);
}

export default function NutritionCard() {
  const today = localDateKey();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const local = localStorage.getItem(STORAGE_KEY(today));
    if (local) { try { setMeals(JSON.parse(local)); } catch {} }
  }, [today]);

  function persist(next: Meal[]) {
    setMeals(next);
    localStorage.setItem(STORAGE_KEY(today), JSON.stringify(next));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, meals: next }),
      }).catch((err) => console.error("[nutrition] save failed:", err));
    }, 800);
  }

  async function addMeal() {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const meal: Meal = {
        id: crypto.randomUUID(),
        name: input.trim(),
        kcal: data.kcal,
        p: data.p,
        c: data.c,
        f: data.f,
        estimated: true,
      };
      persist([...meals, meal]);
      setInput("");
    } catch (err) {
      console.error("Estimate failed:", err);
    }
    setLoading(false);
  }

  function updateMacro(id: string, field: "p" | "c" | "f", value: number) {
    const next = meals.map((m) => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      updated.kcal = Math.round(4 * updated.p + 4 * updated.c + 9 * updated.f);
      return updated;
    });
    persist(next);
  }

  function updateKcal(id: string, kcal: number) {
    const next = meals.map((m) => (m.id === id ? { ...m, kcal } : m));
    persist(next);

    // Debounce AI redistribution
    if (redistTimer.current) clearTimeout(redistTimer.current);
    const meal = meals.find((m) => m.id === id);
    if (!meal) return;
    redistTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/nutrition/redistribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: meal.name, kcal }),
        });
        const data = await res.json();
        setMeals((prev) => {
          const updated = prev.map((m) =>
            m.id === id ? { ...m, kcal, p: data.p, c: data.c, f: data.f } : m
          );
          localStorage.setItem(STORAGE_KEY(today), JSON.stringify(updated));
          return updated;
        });
      } catch {}
    }, 600);
  }

  function removeMeal(id: string) { persist(meals.filter((m) => m.id !== id)); }

  const totals = {
    kcal: Math.round(sum(meals, "kcal")),
    p: Math.round(sum(meals, "p")),
    c: Math.round(sum(meals, "c")),
    f: Math.round(sum(meals, "f")),
  };

  return (
    <Panel title="Nutrition">
      <div className="px-4 pb-4 space-y-3">
        {/* Totals */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(["kcal", "p", "c", "f"] as const).map((key) => (
            <div key={key} className="bg-[var(--ink-2)] rounded-lg py-2">
              <p className="num text-sm font-semibold text-[var(--text-primary)]">
                {meals.length ? totals[key] : "—"}
              </p>
              <p className="text-[9px] font-mono uppercase text-[var(--text-muted)]">{key}</p>
            </div>
          ))}
        </div>

        {/* Meal list */}
        {meals.map((meal) => (
          <div key={meal.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="flex-1 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => setEditingId(editingId === meal.id ? null : meal.id)}
              >
                {meal.name}
              </span>
              <button onClick={() => removeMeal(meal.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">✕</button>
            </div>
            {editingId === meal.id && (
              <div className="grid grid-cols-4 gap-1 ml-2">
                {(["kcal", "p", "c", "f"] as const).map((field) => (
                  <div key={field} className="space-y-0.5">
                    <p className="text-[9px] font-mono text-[var(--text-muted)] text-center">{field}</p>
                    <input
                      type="number"
                      value={meal[field]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (field === "kcal") updateKcal(meal.id, val);
                        else updateMacro(meal.id, field, val);
                      }}
                      className="w-full num text-xs bg-[var(--ink-2)] rounded px-1.5 py-1 text-center outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                ))}
              </div>
            )}
            {editingId !== meal.id && (
              <p className="num text-[10px] text-[var(--text-muted)] ml-2">
                {meal.kcal} kcal · {meal.p}p · {meal.c}c · {meal.f}f
                {meal.estimated && <span className="ml-1 opacity-50">~</span>}
              </p>
            )}
          </div>
        ))}

        {/* Add meal */}
        <div className="flex gap-2 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMeal()}
            placeholder="Log a meal…"
            className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] focus:border-[var(--accent)] rounded-lg px-3 py-2 text-xs outline-none transition-colors placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={addMeal}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? "…" : "+"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
