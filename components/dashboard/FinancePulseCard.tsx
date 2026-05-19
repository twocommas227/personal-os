import Panel from "@/components/ui/Panel";

export default function FinancePulseCard() {
  return (
    <Panel title="Finance Pulse">
      <div className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Net Worth</p>
          <p className="num text-2xl font-semibold text-[var(--text-primary)]">—</p>
          <p className="text-[10px] text-[var(--text-muted)]">Connect Google Sheet to populate</p>
        </div>
        <div className="space-y-1.5">
          {["Cash", "Investments", "Crypto"].map((cat) => (
            <div key={cat} className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)]">{cat}</span>
              <span className="num text-xs text-[var(--text-muted)]">—</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
