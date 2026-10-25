"use client";

import { Check, ChevronRight, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { blob } from "@/components/blob/bus";
import { Switch } from "@/components/settings/primitives";
import { AvatarStack } from "@/components/share/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { projectLinksText } from "@/i18n/messages/projectLinks";
import { projectsText } from "@/i18n/messages/projects";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { addPageToProject } from "./links";
import { loadProjectSummaries, type ProjectSummary } from "./load";
import { ProjectIcon } from "./ProjectDialogs";

/**
 * "Add to project": pick one of your active projects (where you may add cards); the page becomes a
 * new card there, and is shared with the people in the project unless you switch that off (only
 * when you may share the page). `onAdded` gets the project, the new card and whether the page was shared.
 */
export function AddToProjectDialog({
  open,
  onClose,
  page,
  canShare,
  already,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  page: Pick<PageMeta, "id" | "title" | "kind">;
  canShare: boolean;
  /** Projects the page is on a card in already. */
  already: Set<string>;
  onAdded: (project: ProjectSummary, cardId: string, shared: boolean) => void;
}) {
  const t = useMessages(projectLinksText);
  return (
    <Dialog open={open} onClose={onClose} labelledBy="add-to-project-title" className="max-w-[460px]">
      {open && <Picker page={page} canShare={canShare} already={already} onClose={onClose} onAdded={onAdded} titleId="add-to-project-title" t={t} />}
    </Dialog>
  );
}

function Picker({
  page,
  canShare,
  already,
  onClose,
  onAdded,
  titleId,
  t,
}: {
  page: Pick<PageMeta, "id" | "title" | "kind">;
  canShare: boolean;
  already: Set<string>;
  onClose: () => void;
  onAdded: (project: ProjectSummary, cardId: string, shared: boolean) => void;
  titleId: string;
  t: (typeof projectLinksText)["en"];
}) {
  const tp = useMessages(projectsText);
  const locale = useLocale();
  const { userId } = useWorkspace();
  const name = pageTitle(page.title, page.kind, locale);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState(name);
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);

  // The projects as the dialog opens; the first one the page isn't in yet is picked.
  const [initiallyIn] = useState(already);
  useEffect(() => {
    let alive = true;
    void loadProjectSummaries(createClient(), userId, { archived: false }).then((list) => {
      if (!alive) return;
      const usable = list.filter((p) => p.role !== "viewer");
      setProjects(usable);
      setChosen((c) => c ?? usable.find((p) => !initiallyIn.has(p.id))?.id ?? usable[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [userId, initiallyIn]);

  const project = projects?.find((p) => p.id === chosen) ?? null;
  const others = project ? project.members.filter((m) => m.user_id !== userId).length : 0;

  async function add() {
    if (!project || busy) return;
    setBusy(true);
    const shareIt = canShare && share && others > 0;
    const cardId = await addPageToProject(page, project, { title: title.trim() || name, share: shareIt, me: userId });
    setBusy(false);
    if (!cardId) return void blob.say(t.failed, { mood: "worried" });
    const projectName = project.title.trim() || tp.untitled;
    blob.say(shareIt ? t.addedShared(projectName) : t.added(projectName), { mood: "happy" });
    onAdded(project, cardId, shareIt);
    onClose();
  }

  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
          <FolderKanban className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink [overflow-wrap:anywhere]">
            {t.addTitle(name)}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.addHint}</p>
        </div>
      </div>

      {projects === null ? (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-hover/70" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-ink-2">
          <span>{t.noProjects}</span>
          <Link href="/projects?new=1" onClick={onClose} className="flex items-center gap-1 font-medium text-blob-ink hover:underline">
            <Plus className="size-3.5" /> {t.newProject}
          </Link>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label={tp.projects} className="mt-4 max-h-[260px] space-y-1.5 overflow-y-auto">
            {projects.map((p) => {
              const active = p.id === chosen;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosen(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-blob/60 bg-blob-soft/50" : "border-line bg-raised hover:border-line-2",
                  )}
                >
                  <ProjectIcon project={p} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{p.title.trim() || tp.untitled}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {p.total ? tp.progress(p.done, p.total) : tp.noCards}
                      {already.has(p.id) && ` · ${t.alreadyThere}`}
                    </span>
                  </span>
                  {p.members.length > 1 && <AvatarStack people={p.members} size={20} max={3} className="shrink-0" />}
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", active ? "bg-blob text-white" : "border border-line-2")}>
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className="text-[12.5px] font-medium text-ink-2">{t.cardTitle}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={cn(inputClass, "mt-1.5 h-9.5 w-full")} />
          </label>

          {canShare && project && (
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-hover/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{t.shareWithGroup}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{others ? t.shareWithGroupHint(others) : t.alone}</p>
              </div>
              <Switch checked={share && others > 0} disabled={!others} onChange={setShare} label={t.shareWithGroup} />
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tp.cancel}
            </Button>
            <Button variant="blob" onClick={() => void add()} loading={busy} disabled={!project}>
              {t.add} <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
