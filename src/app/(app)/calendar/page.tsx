import type { Metadata } from "next";
import { loadEvents } from "@/calendar/load";
import { CalendarView } from "@/components/calendar/CalendarView";
import { calendarText } from "@/i18n/messages/calendar";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { loadAssignedCards, loadTasks } from "@/lib/tasks";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(calendarText)).title };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [supabase, user, params] = await Promise.all([createClient(), getUser(), searchParams]);
  const [events, tasks, cards] = await Promise.all([loadEvents(supabase), loadTasks(supabase), user ? loadAssignedCards(supabase, user.id) : []]);
  return (
    <CalendarView
      initialEvents={events}
      initialTasks={tasks}
      cards={cards}
      initialDate={one(params.date)}
      initialView={one(params.view)}
      openNew={one(params.new) === "1"}
      openEvent={one(params.event)}
      openImport={one(params.import) === "bta"}
    />
  );
}
