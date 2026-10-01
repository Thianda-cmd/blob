import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { TopBar } from "@/components/shell/TopBar";
import { TasksView } from "@/components/tasks/TasksView";
import { createClient } from "@/lib/supabase/server";
import { loadTasks } from "@/lib/tasks";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const supabase = await createClient();
  const tasks = await loadTasks(supabase);
  return (
    <>
      <TopBar crumbs={[{ label: "Tasks", icon: <ListChecks className="size-3.5 text-ink-3" /> }]} />
      <TasksView initialTasks={tasks} />
    </>
  );
}
