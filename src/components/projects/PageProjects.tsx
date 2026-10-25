"use client";

import { Check, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MenuSeparator, Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { projectLinksText } from "@/i18n/messages/projectLinks";
import { projectsText } from "@/i18n/messages/projects";
import { cn } from "@/lib/utils";
import { loadPageCards, type PageCard } from "./links";
import { ProjectIcon } from "./ProjectDialogs";

/** The project cards a page is on (none while loading, or for no page). */
export function usePageCards(pageId: string | null) {
  const [state, setState] = useState<{ page: string; cards: PageCard[] } | null>(null);

  useEffect(() => {
    if (!pageId) return;
    let alive = true;
    void loadPageCards(pageId).then((cards) => alive && setState({ page: pageId, cards }));
    return () => {
      alive = false;
    };
  }, [pageId]);

  const reload = useCallback(async () => {
    if (!pageId) return;
    setState({ page: pageId, cards: await loadPageCards(pageId) });
  }, [pageId]);

  return { cards: state && state.page === pageId ? state.cards : [], reload };
}

/**
 * In a page's bar: the projects the page is on cards in (the project's name when it is one). Opens
 * a list of the cards, each a link to it on its board, and "Add to project".
 */
export function PageProjectsChip({ cards, onAdd }: { cards: PageCard[]; onAdd?: () => void }) {
  const t = useMessages(projectLinksText);
  const tp = useMessages(projectsText);
  if (!cards.length) return null;
  const projects = [...new Map(cards.map((c) => [c.project.id, c.project])).values()];
  const one = projects.length === 1 ? projects[0] : null;

  return (
    <Popover
      align="end"
      className="w-[290px]"
      label={t.inProjectsTitle}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          title={t.inProjectsTitle}
          className="flex h-7 max-w-[200px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-raised pl-1.5 pr-2.5 text-[12px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink aria-expanded:border-line-2 aria-expanded:text-ink [@media(hover:none)]:h-8"
        >
          {one ? <span className="text-[12.5px] leading-none">{one.icon || "📋"}</span> : <FolderKanban className="size-3.5 text-ink-3" />}
          <span className="truncate max-sm:sr-only">{one ? one.title.trim() || tp.untitled : t.inProjects(projects.length)}</span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2 pb-1 pt-1 text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{t.inProjectsTitle}</div>
          <div className="max-h-[300px] overflow-y-auto">
            {projects.map((project) => (
              <div key={project.id} className="py-1">
                <Link
                  href={`/projects/${project.id}`}
                  onClick={close}
                  className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-ink hover:bg-hover"
                >
                  <ProjectIcon project={project} size={20} />
                  <span className="min-w-0 flex-1 truncate">{project.title.trim() || tp.untitled}</span>
                  {project.archived_at && <span className="shrink-0 text-[11px] font-normal text-ink-3">{t.archived}</span>}
                </Link>
                {cards
                  .filter((c) => c.project.id === project.id)
                  .map((card) => (
                    <Link
                      key={card.id}
                      href={`/projects/${project.id}?card=${card.id}`}
                      onClick={close}
                      className="ml-[18px] flex min-h-8 items-center gap-2 rounded-lg border-l border-line py-1 pl-3 pr-2 text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
                    >
                      <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-full", card.done ? "bg-ok text-white" : "border border-line-2")}>
                        {card.done && <Check className="size-2.5" strokeWidth={3.5} />}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", card.done && "text-ink-3 line-through decoration-ink-3/50")}>{card.title}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
          {onAdd && (
            <>
              <MenuSeparator />
              <button
                type="button"
                onClick={() => {
                  close();
                  onAdd();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
              >
                <Plus className="size-4" /> {t.addToProject}
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
