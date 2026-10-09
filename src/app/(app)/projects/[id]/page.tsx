import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBoard } from "@/components/projects/load";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { projectsText } from "@/i18n/messages/projects";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const [{ id }, t] = await Promise.all([params, getMessages(projectsText)]);
  if (!UUID.test(id)) return { title: t.title };
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("title").eq("id", id).maybeSingle();
  return { title: data ? (data.title as string).trim() || t.untitled : t.title };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const board = await loadBoard(supabase, id);
  if (!board) notFound();
  return <ProjectBoard key={id} initial={board} />;
}
