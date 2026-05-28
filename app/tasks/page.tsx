import Shell from "@/components/dashboard/Shell";
import TasksPanel from "@/components/dashboard/TasksPanel";

export default function TasksPage() {
  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <TasksPanel />
      </div>
    </Shell>
  );
}
