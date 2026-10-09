import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadProjectSummaries } from "@/components/projects/load";
import { ProjectsHome } from "@/components/projects/ProjectsHome";
import { projectsText } from "@/i18n/messages/projects";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(projectsText)).title };
}

export default async function ProjectsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/projects");
  const supabase = await createClient();
  const projects = await loadProjectSummaries(supabase, user.id);
  return <ProjectsHome initial={projects} />;
}
