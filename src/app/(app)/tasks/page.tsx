import type { Metadata } from "next";
import { TasksView } from "@/components/tasks/TasksView";
import { tasksText } from "@/i18n/messages/tasks";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { loadAssignedCards, loadTasks } from "@/lib/tasks";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(tasksText)).title };
}

// The top bar (with the view switch and "+ Neue Aufgabe") belongs to TasksView: it needs the page's state.
export default async function TasksPage() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);
  const [tasks, assigned] = await Promise.all([loadTasks(supabase), user ? loadAssignedCards(supabase, user.id) : []]);
  return <TasksView initialTasks={tasks} assigned={assigned} />;
}
