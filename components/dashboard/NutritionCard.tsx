import Panel from "@/components/ui/Panel";

export default function NutritionCard() {
  return (
    <Panel title="Nutrition">
      <div className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "KCAL", value: "—" },
            { label: "P", value: "—" },
            { label: "C", value: "—" },
            { label: "F", value: "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--ink-2)] rounded-lg py-2">
              <p className="num text-sm font-semibold text-[var(--text-primary)]">{value}</p>
              <p className="text-[9px] font-mono text-[var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            placeholder="Log a meal…"
            className="flex-1 bg-[var(--ink-2)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">Placeholder — AI macro estimation coming soon</p>
      </div>
    </Panel>
  );
}
