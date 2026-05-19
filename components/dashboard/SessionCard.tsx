import Panel from "@/components/ui/Panel";

const PLACEHOLDER_TASKS = [
  { id: "1", title: "Set up Telegram capture bot", estimate: 45 },
  { id: "2", title: "Wire finance Google Sheet", estimate: 60 },
  { id: "3", title: "Deploy to Vercel", estimate: 30 },
];

export default function SessionCard() {
  return (
    <Panel title="Session · Today">
      <div className="px-4 pb-4 space-y-2">
        {PLACEHOLDER_TASKS.map((task, i) => (
          <div
            key={task.id}
            className="flex items-center gap-3 py-2 border-b border-[var(--glass-border)] last:border-0"
          >
            <span className="num text-xs text-[var(--text-muted)] w-4">{i + 1}</span>
            <span className="flex-1 text-sm text-[var(--text-primary)]">{task.title}</span>
            <span className="num text-[10px] text-[var(--text-muted)]">{task.estimate}m</span>
          </div>
        ))}
        <p className="text-[10px] text-[var(--text-muted)] pt-1">Placeholder — connects to CRM in next step</p>
      </div>
    </Panel>
  );
}
