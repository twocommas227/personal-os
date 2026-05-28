import Shell from "@/components/dashboard/Shell";
import BrainPanel from "@/components/dashboard/BrainPanel";

export default function BrainPage() {
  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <BrainPanel />
      </div>
    </Shell>
  );
}
