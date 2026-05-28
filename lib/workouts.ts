export interface WorkoutSet {
  weight: number | "BW" | null; // null = bodyweight/no weight shown
  reps: number | string;        // string for ranges like "6–8"
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
  note?: string; // e.g. "50 total" for finishers
}

export interface WorkoutProgram {
  key: "A" | "B" | "C";
  name: string;
  focus: string;
  exercises: Exercise[];
}

export const PROGRAMS: Record<"A" | "B" | "C", WorkoutProgram> = {
  A: {
    key: "A",
    name: "Day A",
    focus: "Lower",
    exercises: [
      {
        name: "Back squat",
        sets: [{ weight: 45, reps: 8 }, { weight: 55, reps: 8 }, { weight: 62.5, reps: 8 }],
      },
      {
        name: "Front squat",
        sets: [{ weight: 30, reps: 8 }, { weight: 40, reps: 8 }, { weight: 45, reps: "6–8" }],
      },
      {
        name: "Bulgarian split squat",
        sets: [{ weight: 25, reps: 8 }, { weight: 30, reps: 8 }, { weight: 35, reps: 8 }],
      },
      {
        name: "Standing calf raise",
        sets: [{ weight: 15, reps: 10 }, { weight: 20, reps: 10 }, { weight: 25, reps: 10 }],
      },
      {
        name: "Hanging leg raise",
        sets: [{ weight: null, reps: 12 }, { weight: null, reps: 12 }, { weight: null, reps: 12 }],
      },
    ],
  },
  B: {
    key: "B",
    name: "Day B",
    focus: "Upper Push",
    exercises: [
      {
        name: "Bench press",
        sets: [{ weight: 30, reps: 8 }, { weight: 40, reps: 10 }, { weight: 45, reps: 10 }],
      },
      {
        name: "DB overhead press",
        sets: [{ weight: 9, reps: 10 }, { weight: 10, reps: 10 }, { weight: 10, reps: 10 }],
      },
      {
        name: "Incline DB press",
        sets: [{ weight: 8, reps: 10 }, { weight: 10, reps: 10 }, { weight: 10, reps: 10 }],
      },
      {
        name: "Lateral raise",
        sets: [{ weight: 4, reps: 10 }, { weight: 6, reps: 10 }, { weight: 8, reps: 10 }],
      },
      {
        name: "Tricep pushdown (bar)",
        sets: [{ weight: 20.4, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }],
      },
      {
        name: "Pushups (finisher)",
        sets: [],
        note: "50 total",
      },
    ],
  },
  C: {
    key: "C",
    name: "Day C",
    focus: "Upper Pull",
    exercises: [
      {
        name: "Deadlift",
        sets: [{ weight: 55, reps: 5 }, { weight: 65, reps: 5 }, { weight: 70, reps: "4–5" }],
      },
      {
        name: "Pull-ups",
        sets: [{ weight: "BW", reps: 5 }, { weight: "BW", reps: 5 }, { weight: "BW", reps: "4–5" }],
      },
      {
        name: "Barbell row",
        sets: [{ weight: 25, reps: 8 }, { weight: 30, reps: 8 }, { weight: 35, reps: "6–8" }],
      },
      {
        name: "DB reverse fly",
        sets: [{ weight: 10, reps: 12 }, { weight: 12, reps: 12 }, { weight: 14, reps: "10–12" }],
      },
      {
        name: "DB curl seated incline",
        sets: [{ weight: 15, reps: 10 }, { weight: 17.5, reps: 10 }, { weight: 20, reps: 8 }],
      },
    ],
  },
};

export const ROTATION: ("A" | "B" | "C")[] = ["A", "B", "C"];

/** Given the last completed program key, return the next one in rotation. */
export function nextProgramKey(lastKey: "A" | "B" | "C" | null): "A" | "B" | "C" {
  if (!lastKey) return "A";
  const idx = ROTATION.indexOf(lastKey);
  return ROTATION[(idx + 1) % ROTATION.length];
}

/** Format a workout for Telegram (HTML). */
export function formatWorkoutTelegram(
  program: WorkoutProgram,
  lastDate: string | null,
): string {
  const lastDoneStr = lastDate
    ? `Last done: ${new Date(lastDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })}`
    : "First session!";

  const lines: string[] = [
    `💪 <b>${program.name} · ${program.focus}</b>`,
    `<i>${lastDoneStr}</i>`,
    "",
  ];

  for (const ex of program.exercises) {
    lines.push(`<b>${ex.name}</b>`);
    if (ex.note) {
      lines.push(`  ${ex.note}`);
    } else {
      ex.sets.forEach((s, i) => {
        const w = s.weight === null
          ? "—"
          : s.weight === "BW"
          ? "BW"
          : `${s.weight}kg`;
        lines.push(`  S${i + 1}: ${w} × ${s.reps}`);
      });
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** Plain-text version for cron summary (no HTML tags). */
export function formatWorkoutPlain(program: WorkoutProgram): string {
  const lines: string[] = [`${program.name} · ${program.focus}`, ""];
  for (const ex of program.exercises) {
    const setStr = ex.note
      ? ex.note
      : ex.sets
          .map((s) => {
            const w = s.weight === null ? "—" : s.weight === "BW" ? "BW" : `${s.weight}kg`;
            return `${w}×${s.reps}`;
          })
          .join(" | ");
    lines.push(`  ${ex.name}: ${setStr}`);
  }
  return lines.join("\n");
}
