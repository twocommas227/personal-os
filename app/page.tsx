import Shell from "@/components/dashboard/Shell";
import OperatorCard from "@/components/dashboard/OperatorCard";
import SessionCard from "@/components/dashboard/SessionCard";
import HabitCard from "@/components/dashboard/HabitCard";
import FinancePulseCard from "@/components/dashboard/FinancePulseCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import RemindersCard from "@/components/dashboard/RemindersCard";

export default function Home() {
  return (
    <Shell>
      {/* 3-column grid: narrow | wide | narrow */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_280px] gap-4 max-w-7xl mx-auto">

        {/* Left column */}
        <div className="flex flex-col gap-4">
          <OperatorCard />
          <FinancePulseCard />
          <GoalsCard />
        </div>

        {/* Centre column */}
        <div className="flex flex-col gap-4">
          <SessionCard />
          <CalendarCard />
          <HabitCard />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <NutritionCard />
          <RemindersCard />
        </div>

      </div>
    </Shell>
  );
}
