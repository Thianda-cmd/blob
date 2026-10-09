import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { TopBar } from "@/components/shell/TopBar";
import { TasksView } from "@/components/tasks/TasksView";
import { tasksText } from "@/i18n/messages/tasks";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { loadAssignedCards, loadTasks } from "@/lib/tasks";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(tasksText)).title };
}

export default async function TasksPage() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);
  const [tasks, assigned, t] = await Promise.all([loadTasks(supabase), user ? loadAssignedCards(supabase, user.id) : [], getMessages(tasksText)]);
  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <ListChecks className="size-3.5 text-ink-3" /> }]} />
      <TasksView initialTasks={tasks} assigned={assigned} />
    </>
  );
}
