import Shell from "@/components/dashboard/Shell";
import JournalPanel from "@/components/dashboard/JournalPanel";

export default function JournalPage() {
  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <JournalPanel />
      </div>
    </Shell>
  );
}
