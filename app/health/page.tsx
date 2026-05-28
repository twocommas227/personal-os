import Shell from "@/components/dashboard/Shell";
import HealthPanel from "@/components/dashboard/HealthPanel";

export default function HealthPage() {
  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <HealthPanel />
      </div>
    </Shell>
  );
}
