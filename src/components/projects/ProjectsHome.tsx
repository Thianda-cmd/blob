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
import { TopBar } from "@/components/shell/TopBar";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { shareText } from "@/i18n/messages/share";
import { cn } from "@/lib/utils";
import { deleteProject, leaveProject, setArchived } from "./actions";
import { DueChip } from "./CardFace";
import type { ProjectSummary } from "./load";
import { TEMPLATES, TEMPLATE_IDS, boardColor, type TemplateId } from "./model";
import { ConfirmDialog, NewProjectDialog, ProjectIcon } from "./ProjectDialogs";

const rise = {
  hidden: { opacity: 0, y: 10 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.04 * i, type: "spring" as const, stiffness: 420, damping: 32 } }),
};

const isTemplate = (v: string | null): v is TemplateId => !!v && (TEMPLATE_IDS as readonly string[]).includes(v);

/** /projects: your projects and the ones you're in, a friendly start with templates, and the archive. */
export function ProjectsHome({ initial }: { initial: ProjectSummary[] }) {
  const t = useMessages(projectsText);
  const now = useNow();
  const router = useRouter();
  const params = useSearchParams();
  const { userId } = useWorkspace();
  useRefreshOnBack(initial);
  // Changes made here until the server's list has them too.
  const [changes, setChanges] = useState<Record<string, { archived_at?: string | null; gone?: boolean }>>({});
  const [creating, setCreating] = useState<{ template?: TemplateId } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "leave"; project: ProjectSummary } | null>(null);

  const all = useMemo(
    () => initial.filter((p) => !changes[p.id]?.gone).map((p) => (changes[p.id] && "archived_at" in changes[p.id] ? { ...p, archived_at: changes[p.id].archived_at ?? null } : p)),
    [initial, changes],
  );
  const active = all.filter((p) => !p.archived_at);
  const archived = all.filter((p) => p.archived_at);

  // /projects?new=1 (command palette, Home) opens the dialog, optionally with &template=…
  const wantsNew = params.get("new") === "1";
  const wantedTemplate = params.get("template");
  useEffect(() => {
    if (!wantsNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open once the page is in the browser
    setCreating({ template: isTemplate(wantedTemplate) ? wantedTemplate : undefined });
    window.history.replaceState(null, "", "/projects");
  }, [wantsNew, wantedTemplate]);

  async function archive(p: ProjectSummary) {
    const next = await setArchived(p.id, !p.archived_at);
    if (!next) return blob.say(t.errSave, { mood: "worried" });
    setChanges((c) => ({ ...c, [p.id]: { archived_at: next.archived_at } }));
    blob.say(next.archived_at ? t.archived : t.restored, { mood: "happy" });
  }

  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <FolderKanban className="size-3.5 text-ink-3" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-3 sm:px-8 lg:px-10 lg:pt-5">
          <motion.header initial="hidden" animate="shown" className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <motion.div variants={rise} custom={0} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <FolderKanban className="size-3.5" /> {t.eyebrow}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">{t.title}</h1>
              <p className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-ink-2">{t.intro}</p>
            </motion.div>
            {all.length > 0 && (
              <motion.div variants={rise} custom={1}>
                <Button variant="blob" size="lg" onClick={() => setCreating({})}>
                  <Plus className="size-4" /> {t.newProject}
                </Button>
              </motion.div>
            )}
          </motion.header>

          {all.length === 0 ? (
            <EmptyHero onStart={(template) => setCreating({ template })} />
          ) : (
            <>
              {active.length > 0 && (
                <section className="mt-7" aria-labelledby="projects-yours">
                  <div className="mb-3 flex items-baseline gap-3">
                    <h2 id="projects-yours" className="font-display text-[19px] font-semibold tracking-[-0.01em]">
                      {t.yours}
                    </h2>
                    <span className="text-[13px] text-ink-3">{t.count(active.length)}</span>
                  </div>
                  <Grid>
                    {active.map((p, i) => (
                      <ProjectCard key={p.id} project={p} index={i} now={now} me={userId} onArchive={() => archive(p)} onConfirm={(kind) => setConfirm({ kind, project: p })} />
                    ))}
                    <motion.button
                      key="new"
                      layout
                      type="button"
                      onClick={() => setCreating({})}
                      className="flex min-h-[168px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-2 text-[13.5px] text-ink-3 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink"
                    >
                      <Plus className="size-5" />
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
                    className="-ml-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
                  >
                    <ChevronDown className={cn("size-4 transition-transform", !showArchive && "-rotate-90")} />
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
            </>
          )}
        </div>
      </div>

      <NewProjectDialog open={!!creating} onClose={() => setCreating(null)} template={creating?.template} />
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
  const title = p.title.trim() || t.untitled;
  const owner = p.members.find((m) => m.role === "owner");
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
      <Link
        href={`/projects/${p.id}`}
        className="flex min-h-[168px] flex-col rounded-2xl border border-line bg-raised p-4 shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_1px_1px_rgb(28_27_24/0.04),0_8px_20px_-8px_rgb(28_27_24/0.18)]"
      >
        <div className="flex items-start gap-3 pr-7">
          <ProjectIcon project={p} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink" title={title}>
              {title}
            </h3>
            {p.role !== "owner" && owner ? (
              <p className="mt-0.5 truncate text-[12px] text-ink-3">
                {t.sharedBy(owner.full_name || s.someone)}
                {p.role === "viewer" && ` · ${t.viewOnly}`}
              </p>
            ) : (
              p.description && <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{p.description}</p>
            )}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-[12px] text-ink-3">
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

function EmptyHero({ onStart }: { onStart: (template: TemplateId) => void }) {
  const t = useMessages(projectsText);
  const ref = useRef<BlobHandle>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.wave(), 900);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative mt-7 overflow-hidden rounded-3xl border border-line bg-raised shadow-card"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" />
      <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="font-display text-[24px] font-bold tracking-[-0.02em]">{t.emptyTitle}</h2>
          <p className="mt-1.5 max-w-[520px] text-[14px] leading-relaxed text-ink-2">{t.emptyBody}</p>
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.quickStart}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onStart(id)}
                className="group flex items-center gap-3 rounded-xl border border-line bg-raised p-2.5 text-left shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-line-2"
              >
                <ProjectIcon project={{ icon: TEMPLATES[id].icon, color: TEMPLATES[id].color }} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{t.templates[id].name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{t.templates[id].blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="hidden justify-center md:flex">
          <Blob ref={ref} size={150} mood="happy" />
        </div>
      </div>
    </motion.section>
  );
}
