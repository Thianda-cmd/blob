"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, ChevronDown, Ellipsis, FolderKanban, LogOut, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { useRefreshOnBack } from "@/components/cv/home/useRefreshOnBack";
import { AvatarStack } from "@/components/share/Avatar";
import { PageBody, PageHeader, SectionHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { addTile, card, cardLift, featured, midTone } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { shareText } from "@/i18n/messages/share";
import { subjectColor } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { deleteProject, leaveProject, setArchived } from "./actions";
import { DueChip } from "./CardFace";
import type { ProjectSummary } from "./load";
import { TEMPLATES, TEMPLATE_IDS, boardColor, type TemplateId } from "./model";
import { ConfirmDialog, NewProjectDialog, ProjectIcon } from "./ProjectDialogs";

const isTemplate = (v: string | null): v is TemplateId => !!v && (TEMPLATE_IDS as readonly string[]).includes(v);

/**
 * /projects: your projects and the ones you're in, and the archive. With none yet, a start screen
 * in the look of the spreadsheet's template picker: "Leeres Board" first, then the templates.
 */
export function ProjectsHome({ initial }: { initial: ProjectSummary[] }) {
  const t = useMessages(projectsText);
  const now = useNow();
  const router = useRouter();
  const params = useSearchParams();
  const { userId } = useWorkspace();
  useRefreshOnBack(initial);
  // Changes made here until the server's list has them too.
  const [changes, setChanges] = useState<Record<string, { archived_at?: string | null; gone?: boolean }>>({});
  const [creating, setCreating] = useState<{ template?: TemplateId; subject?: string } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "leave"; project: ProjectSummary } | null>(null);

  const all = useMemo(
    () => initial.filter((p) => !changes[p.id]?.gone).map((p) => (changes[p.id] && "archived_at" in changes[p.id] ? { ...p, archived_at: changes[p.id].archived_at ?? null } : p)),
    [initial, changes],
  );
  const active = all.filter((p) => !p.archived_at);
  const archived = all.filter((p) => p.archived_at);

  // /projects?new=1 (command palette, Home, a subject) opens the dialog, optionally with &template=… and &subject=…
  const wantsNew = params.get("new") === "1";
  const wantedTemplate = params.get("template");
  const wantedSubject = params.get("subject");
  useEffect(() => {
    if (!wantsNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open once the page is in the browser
    setCreating({ template: isTemplate(wantedTemplate) ? wantedTemplate : undefined, subject: wantedSubject ?? undefined });
    window.history.replaceState(null, "", "/projects");
  }, [wantsNew, wantedTemplate, wantedSubject]);

  async function archive(p: ProjectSummary) {
    const next = await setArchived(p.id, !p.archived_at);
    if (!next) return blob.say(t.errSave, { mood: "worried" });
    setChanges((c) => ({ ...c, [p.id]: { archived_at: next.archived_at } }));
    blob.say(next.archived_at ? t.archived : t.restored, { mood: "happy" });
  }

  const meta = all.length ? [t.count(active.length), ...(archived.length ? [t.archivedCount(archived.length)] : [])].join(" · ") : undefined;

  return (
    <>
      <TopBar
        crumbs={[{ label: t.title, icon: <FolderKanban className="size-3.5 text-ink-3" /> }]}
        actions={
          <Button variant="blob" size="bar" onClick={() => setCreating({})} title={t.newProject}>
            <Plus className="size-4" strokeWidth={2.4} aria-hidden />
            <span className="max-sm:sr-only">{t.newProject}</span>
          </Button>
        }
      />
      <PageBody>
        <PageHeader title={t.title} meta={meta} />

        {active.length === 0 ? (
          <StartScreen fresh={all.length === 0} onStart={(template) => setCreating({ template })} />
        ) : (
          // "Deine Projekte" only says something when the archive below is there too.
          <section aria-labelledby={archived.length ? "projects-yours" : undefined} aria-label={archived.length ? undefined : t.yours}>
            {archived.length > 0 && <SectionHeader id="projects-yours" title={t.yours} count={active.length} />}
            <Grid>
              {active.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} now={now} me={userId} onArchive={() => archive(p)} onConfirm={(kind) => setConfirm({ kind, project: p })} />
              ))}
              <motion.button
                key="new"
                layout
                type="button"
                onClick={() => setCreating({})}
                className={cn(addTile, "flex min-h-[168px] flex-col items-center justify-center gap-1.5 text-[13.5px] font-medium max-sm:min-h-12 max-sm:flex-row")}
              >
                <Plus className="size-5 max-sm:size-4" aria-hidden />
                {t.newProject}
              </motion.button>
            </Grid>
          </section>
        )}

        {archived.length > 0 && (
          <section className="mt-8">
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              aria-expanded={showArchive}
              className="-ml-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:py-2"
            >
              <ChevronDown className={cn("size-4 transition-transform", !showArchive && "-rotate-90")} aria-hidden />
              {showArchive ? t.hideArchived : t.showArchived(archived.length)}
            </button>
            <AnimatePresence initial={false}>
              {showArchive && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Grid className="pt-3 opacity-80">
                    {archived.map((p, i) => (
                      <ProjectCard key={p.id} project={p} index={i} now={now} me={userId} onArchive={() => archive(p)} onConfirm={(kind) => setConfirm({ kind, project: p })} />
                    ))}
                  </Grid>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </PageBody>

      <NewProjectDialog open={!!creating} onClose={() => setCreating(null)} template={creating?.template} subject={creating?.subject} />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        title={confirm ? t.confirmDeleteTitle(confirm.project.title.trim() || t.untitled) : ""}
        body={t.confirmDeleteBody}
        confirm={t.confirmDelete}
        onConfirm={async () => {
          if (!confirm) return;
          const ok = await deleteProject(confirm.project.id);
          if (!ok) return void blob.say(t.errDelete, { mood: "worried" });
          setChanges((c) => ({ ...c, [confirm.project.id]: { gone: true } }));
          blob.say(t.deleted, { mood: "happy" });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "leave"}
        onClose={() => setConfirm(null)}
        title={confirm ? t.confirmLeaveTitle(confirm.project.title.trim() || t.untitled) : ""}
        body={t.confirmLeaveBody}
        confirm={t.confirmLeave}
        onConfirm={async () => {
          if (!confirm) return;
          const ok = await leaveProject(confirm.project.id, userId);
          if (!ok) return void blob.say(t.errSave, { mood: "worried" });
          setChanges((c) => ({ ...c, [confirm.project.id]: { gone: true } }));
          blob.say(t.left, { mood: "happy" });
          router.refresh();
        }}
      />
    </>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:gap-4", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({
  project: p,
  index,
  now,
  me,
  onArchive,
  onConfirm,
}: {
  project: ProjectSummary;
  index: number;
  now: number | null;
  me: string;
  onArchive: () => void;
  onConfirm: (kind: "delete" | "leave") => void;
}) {
  const t = useMessages(projectsText);
  const s = useMessages(shareText);
  const { subjects } = useWorkspace();
  const title = p.title.trim() || t.untitled;
  const owner = p.members.find((m) => m.role === "owner");
  const subject = subjects.find((x) => x.id === p.subject_id);
  const shared = p.members.length > 1;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 32, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className="group relative"
    >
      <Link href={`/projects/${p.id}`} className={cn(card, cardLift, "flex min-h-[168px] flex-col p-4")}>
        <div className="flex items-start gap-3 pr-7">
          <ProjectIcon project={p} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink" title={title}>
              {title}
            </h3>
            {p.role !== "owner" && owner ? (
              <p className={cn("mt-0.5 truncate text-[12px]", midTone)}>
                {t.sharedBy(owner.full_name || s.someone)}
                {p.role === "viewer" && ` · ${t.viewOnly}`}
              </p>
            ) : (
              p.description && <p className={cn("mt-0.5 truncate text-[12.5px]", midTone)}>{p.description}</p>
            )}
            {subject && (
              <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-hover/80 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
                {subject.emoji ? <span className="text-[11.5px] leading-none">{subject.emoji}</span> : <span className="size-2 shrink-0 rounded-full" style={{ background: subjectColor(subject.color) }} />}
                <span className="truncate">{subject.name}</span>
              </span>
            )}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <div className={cn("flex items-center justify-between text-[12px]", midTone)}>
            <span className="tabular-nums">{p.total ? t.progress(p.done, p.total) : t.noCards}</span>
            {p.total > 0 && <span className="tabular-nums">{pct}%</span>}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: boardColor(p.color) }} />
          </div>
          <div className="mt-3 flex min-h-6 items-center gap-2 text-[12px]">
            {shared ? (
              <AvatarStack people={p.members} size={22} max={4} label={t.membersLabel(p.members.map((m) => m.full_name || s.someone).join(", "))} />
            ) : (
              <span className="text-ink-3" />
            )}
            <span className="ml-auto flex items-center gap-2">
              {p.mine > 0 && <span className="rounded-full bg-blob-soft px-2 py-0.5 font-medium text-blob-ink">{t.forYou(p.mine)}</span>}
              {p.due_at && <DueChip due={p.due_at} now={now} done={p.total > 0 && p.done === p.total} />}
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2.5 top-2.5">
        <Popover
          align="end"
          className="w-[200px]"
          trigger={(props) => (
            <button
              {...props}
              className="grid size-8 place-items-center rounded-lg text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={t.projectOptions}
              title={t.projectOptions}
            >
              <Ellipsis className="size-4" />
            </button>
          )}
        >
          {(close) =>
            p.user_id === me ? (
              <>
                <MenuItem
                  icon={<ArchiveRestore />}
                  onSelect={() => {
                    close();
                    onArchive();
                  }}
                >
                  {p.archived_at ? t.unarchive : t.archiveAction}
                </MenuItem>
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={() => {
                    close();
                    onConfirm("delete");
                  }}
                >
                  {t.delete}
                </MenuItem>
              </>
            ) : (
              <MenuItem
                icon={<LogOut />}
                danger
                onSelect={() => {
                  close();
                  onConfirm("leave");
                }}
              >
                {t.leave}
              </MenuItem>
            )
          }
        </Popover>
      </div>
    </motion.div>
  );
}

/** No projects (or none that aren't archived): where to start, like the spreadsheet's template picker. */
function StartScreen({ fresh, onStart }: { fresh: boolean; onStart: (template: TemplateId) => void }) {
  const t = useMessages(projectsText);
  const ref = useRef<BlobHandle>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.wave(), 900);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <section aria-labelledby="projects-start">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          {fresh && <p className="text-[12.5px] font-medium text-ink-2">{t.emptyTitle}</p>}
          <h2 id="projects-start" className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {t.startTitle}
          </h2>
          <p className="mt-2 max-w-[640px] text-pretty text-[14px] leading-relaxed text-ink-2">{t.startBody}</p>
        </div>
        <div className="-my-2 hidden shrink-0 sm:block">
          <Blob ref={ref} size={96} mood="happy" />
        </div>
      </div>

      <button type="button" onClick={() => onStart("blank")} className={cn(featured, "mt-6 flex w-full items-center gap-3.5 p-3.5 text-left")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blob text-white shadow-card dark:bg-blob-deep">
          <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[16.5px] font-semibold leading-tight text-ink">{t.templates.blank.name}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{t.templates.blank.blurb}</span>
        </span>
      </button>

      <SectionHeader title={t.templatesTitle} className="mt-8" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {TEMPLATE_IDS.filter((id) => id !== "blank").map((id) => (
          <button key={id} type="button" onClick={() => onStart(id)} className={cn(card, cardLift, "flex items-start gap-3 p-3.5 text-left")}>
            <ProjectIcon project={{ icon: TEMPLATES[id].icon, color: TEMPLATES[id].color }} size={36} />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-tight text-ink">{t.templates[id].name}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-ink-2">{t.templates[id].blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
