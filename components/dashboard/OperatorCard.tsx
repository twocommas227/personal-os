import Panel from "@/components/ui/Panel";

export default function OperatorCard() {
  return (
    <Panel title="Operator">
      <div className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-lg font-semibold">Josh Decker</p>
          <p className="text-xs text-[var(--text-muted)]">Bangkok, Thailand · UTC+7</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Current Focus</p>
          <p className="text-sm text-[var(--text-secondary)]">Building Personal OS</p>
        </div>
        <div className="flex gap-2 pt-1">
          <span className="px-2 py-0.5 rounded-full bg-[var(--ok)]/15 text-[var(--ok)] text-[10px] font-mono">online</span>
        </div>
      </div>
    </Panel>
  );
}
