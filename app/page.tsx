import Shell from "@/components/dashboard/Shell";
import TodayBand from "@/components/dashboard/TodayBand";
import OperatorCard from "@/components/dashboard/OperatorCard";
import HabitCard from "@/components/dashboard/HabitCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import RemindersCard from "@/components/dashboard/RemindersCard";
import ContextTasksCard from "@/components/dashboard/ContextTasksCard";

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5 pt-1">
      <div className={`w-[7px] h-[7px] rounded-full ${color}`} />
      <span className="text-[10px] font-mono font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--glass-border)]" />
    </div>
  );
}

export default function Home() {
  return (
    <Shell>
      <div className="max-w-7xl mx-auto flex flex-col gap-5">

        {/* ── TODAY BAND · state of the day, before any detail ── */}
        <TodayBand />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

          {/* ── PERSONAL ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader label="Personal" color="bg-[var(--ok)]" />
            <OperatorCard />
            <GoalsCard />
            <HabitCard />
          </div>

          {/* ── SCHEDULE + WORK ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader label="Schedule" color="bg-[var(--ok)]" />
            {/* Both calendars in one view — events carry an A/G tag */}
            <CalendarCard />

            <SectionHeader label="Kritamorn" color="bg-[var(--accent)]" />
            <ContextTasksCard context="kritamorn" label="Kritamorn" tint="tint-kritamorn" />

            <SectionHeader label="Two Commas" color="bg-[var(--warn)]" />
            <ContextTasksCard context="two_commas" label="Two Commas" tint="tint-twocommas" />
          </div>

          {/* ── DAILY ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader label="Daily" color="bg-[var(--ok)]" />
            <RemindersCard />
            <NutritionCard />
          </div>

        </div>
      </div>
    </Shell>
  );
}
