import { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export default function Panel({ children, className = "", title, action }: PanelProps) {
  return (
    <div className={`glass rounded-2xl flex flex-col overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-muted)]">
            {title}
          </span>
          {action}
        </div>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
