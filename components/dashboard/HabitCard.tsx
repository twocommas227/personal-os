import Panel from "@/components/ui/Panel";

const HABITS = ["Exercise", "Read", "Meditate", "Journal", "No alcohol", "Sleep by midnight"];

export default function HabitCard() {
  return (
    <Panel title="Habits">
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {HABITS.map((habit) => (
          <button
            key={habit}
            className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[var(--ink-2)] hover:bg-[var(--ink-3)] transition-colors text-left"
          >
            <span className="w-4 h-4 rounded-full border border-[var(--ink-4)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-secondary)]">{habit}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pb-3 text-[10px] text-[var(--text-muted)]">Placeholder — connects to Supabase in next step</p>
    </Panel>
  );
}
