import Panel from "@/components/ui/Panel";

export default function GoalsCard() {
  return (
    <Panel title="Goals">
      <div className="px-4 pb-4 space-y-4">
        {["This Week", "This Month"].map((scope) => (
          <div key={scope} className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{scope}</p>
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className="text-xs italic">No goals yet</span>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-[var(--text-muted)]">Placeholder — connects to Supabase in next step</p>
      </div>
    </Panel>
  );
}
