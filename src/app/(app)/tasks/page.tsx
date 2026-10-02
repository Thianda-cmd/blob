import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { TopBar } from "@/components/shell/TopBar";
import { TasksView } from "@/components/tasks/TasksView";
import { tasksText } from "@/i18n/messages/tasks";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadTasks } from "@/lib/tasks";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(tasksText)).title };
}

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasks, t] = await Promise.all([loadTasks(supabase), getMessages(tasksText)]);
  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <ListChecks className="size-3.5 text-ink-3" /> }]} />
      <TasksView initialTasks={tasks} />
    </>
  );
}
