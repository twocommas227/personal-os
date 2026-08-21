import Shell from "@/components/dashboard/Shell";
import OperatorCard from "@/components/dashboard/OperatorCard";
import HabitCard from "@/components/dashboard/HabitCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import RemindersCard from "@/components/dashboard/RemindersCard";
import ContextTasksCard from "@/components/dashboard/ContextTasksCard";

function ContextHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-1">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto items-start">

        {/* ── LEFT · Personal identity + goals ── */}
        <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1">
          <ContextHeader label="Personal" color="bg-[var(--ok)]" />
          <OperatorCard />
          <GoalsCard />
        </div>

        {/* ── MIDDLE · Calendar, then work contexts ── */}
        <div className="flex flex-col gap-4 md:col-start-2 md:row-start-1">
          <ContextHeader label="Schedule" color="bg-[var(--ok)]" />
          <CalendarCard source="apple" />

          <ContextHeader label="Kritamorn" color="bg-[var(--accent)]" />
          <ContextTasksCard context="kritamorn" label="Kritamorn" />

          <ContextHeader label="Two Commas" color="bg-[var(--warn)]" />
          <ContextTasksCard context="two_commas" label="Two Commas" />
        </div>

        {/* ── RIGHT · Reminders on top, nutrition below ── */}
        <div className="flex flex-col gap-4 md:col-start-3 md:row-start-1">
          <ContextHeader label="Daily" color="bg-[var(--ok)]" />
          <RemindersCard />
          <NutritionCard />
        </div>

        {/* ── HABITS · spans middle + right columns ── */}
        <div className="md:col-start-2 md:col-span-2 md:row-start-2">
          <HabitCard />
        </div>

      </div>
    </Shell>
  );
}
