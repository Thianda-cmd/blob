"use client";

import { ArrowRight, FolderKanban } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectSummary } from "@/components/projects/load";
import { TEMPLATES, TEMPLATE_IDS, boardColor } from "@/components/projects/model";
import { ProjectIcon } from "@/components/projects/ProjectDialogs";
import { AvatarStack } from "@/components/share/Avatar";
import { FromProjects } from "@/components/tasks/FromProjects";
import { card, cardLift, groupLabel, midTone, panel } from "@/components/ui/surfaces";
import { useMessages } from "@/i18n/client";
import { homeText } from "@/i18n/messages/home";
import { projectsText } from "@/i18n/messages/projects";
import type { AssignedCard } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Home: your active projects with their progress, and the cards waiting for you. */
export function ProjectsBlock({ projects, assigned, title }: { projects: ProjectSummary[]; assigned: AssignedCard[]; title: (children: ReactNode, action?: ReactNode) => ReactNode }) {
  const t = useMessages(homeText);
  const p = useMessages(projectsText);
  const all = (
    <Link href="/projects" className="font-medium text-ink-2 hover:text-ink [@media(hover:none)]:-my-2 [@media(hover:none)]:py-2">
      {t.allProjects}
    </Link>
  );

  if (!projects.length) {
    return (
      <>
        {title(t.projects, all)}
        {/* No projects yet: the templates to start one (a quiet panel, not a dashed "empty" box). */}
        <div className={cn(panel, "flex flex-wrap items-center gap-x-5 gap-y-3 px-4")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink" aria-hidden>
            <FolderKanban className="size-5" />
          </span>
          <p className="min-w-[200px] flex-1 text-[13px] leading-snug text-ink-2">{t.projectsEmpty}</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_IDS.filter((id) => id !== "blank").map((id) => (
              <Link
                key={id}
                href={`/projects?new=1&template=${id}`}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink [@media(hover:none)]:h-9"
              >
                <span className="text-[14px] leading-none" aria-hidden>
                  {TEMPLATES[id].icon}
                </span>
                {p.templates[id].name}
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {title(t.projects, all)}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}
      </div>
      {assigned.length > 0 && (
        <div className={cn(panel, "mt-3 pb-2 pt-3")}>
          <h3 className={cn(groupLabel, "mb-1.5")}>{t.forYou}</h3>
          <FromProjects initial={assigned} limit={4} compact />
        </div>
      )}
    </>
  );
}

/** A project in a short list (Home, a subject's page): icon, name, what is yours to do, progress, people. */
export function ProjectRow({ project }: { project: ProjectSummary }) {
  const p = useMessages(projectsText);
  const pct = project.total ? Math.round((project.done / project.total) * 100) : 0;
  const name = project.title.trim() || p.untitled;
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(card, cardLift, "group flex items-center gap-3 p-3")}
    >
      <ProjectIcon project={project} size={36} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink" title={name}>
            {name}
          </span>
          {project.mine > 0 && <span className="shrink-0 rounded-full bg-blob-soft px-1.5 text-[11px] font-medium leading-[18px] text-blob-ink">{p.forYou(project.mine)}</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-hover">
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: boardColor(project.color) }} />
          </span>
          <span className={cn("shrink-0 text-[11.5px] tabular-nums", midTone)}>{project.total ? `${project.done}/${project.total}` : p.noCards}</span>
        </span>
      </span>
      {project.members.length > 1 && <AvatarStack people={project.members} size={20} max={3} className="shrink-0 max-[420px]:hidden" />}
      <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </Link>
  );
}
