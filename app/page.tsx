import Shell from "@/components/dashboard/Shell";
import OperatorCard from "@/components/dashboard/OperatorCard";
import HabitCard from "@/components/dashboard/HabitCard";
import FinancePulseCard from "@/components/dashboard/FinancePulseCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import RemindersCard from "@/components/dashboard/RemindersCard";
import ContextTasksCard from "@/components/dashboard/ContextTasksCard";

function ContextHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-1 pb-1`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <Shell>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">

        {/* ── PERSONAL ── */}
        <div className="flex flex-col gap-4">
          <ContextHeader label="Personal" color="bg-[var(--ok)]" />
          <OperatorCard />
          <CalendarCard source="apple" />
          <HabitCard />
          <NutritionCard />
          <RemindersCard />
        </div>

        {/* ── KRITAMORN ── */}
        <div className="flex flex-col gap-4">
          <ContextHeader label="Kritamorn" color="bg-[var(--accent)]" />
          <ContextTasksCard context="kritamorn" label="Kritamorn" />
          <CalendarCard source="google" />
        </div>

        {/* ── TWO COMMAS ── */}
        <div className="flex flex-col gap-4">
          <ContextHeader label="Two Commas" color="bg-[var(--warn)]" />
          <ContextTasksCard context="two_commas" label="Two Commas" />
          <FinancePulseCard />
        </div>

      </div>
    </Shell>
  );
}
