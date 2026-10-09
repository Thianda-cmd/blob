"use client";

import { formatDistanceToNowStrict, format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { PageIcon } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { trashText } from "@/i18n/messages/trash";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import { PAGE_META_COLUMNS, type PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";

/** One row in the trash: a page plus everything that was trashed together with it. */
type Item = { root: PageMeta; ids: string[] };

/**
 * Pages trashed together share a `trashed_at` stamp. Only the top page of each batch
 * gets a row; its children ride along when it's restored.
 */
function groupTrash(pages: PageMeta[]): Item[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const children = new Map<string, PageMeta[]>();
  for (const p of pages) {
    if (!p.parent_id) continue;
    if (!children.has(p.parent_id)) children.set(p.parent_id, []);
    children.get(p.parent_id)!.push(p);
  }
  return pages
    .filter((p) => {
      const parent = p.parent_id ? byId.get(p.parent_id) : undefined;
      return !parent || parent.trashed_at !== p.trashed_at;
    })
    .map((root) => {
      const ids = [root.id];
      const walk = (id: string) => {
        for (const child of children.get(id) ?? []) {
          if (child.trashed_at !== root.trashed_at) continue;
          ids.push(child.id);
          walk(child.id);
        }
      };
      walk(root.id);
      return { root, ids };
    });
}

/** Every trashed page under `ids`, whatever batch it came from (the database cascades to them). */
function withTrashedDescendants(pages: PageMeta[], ids: string[]) {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of pages) {
      if (p.parent_id && out.has(p.parent_id) && !out.has(p.id)) {
        out.add(p.id);
        grew = true;
      }
    }
  }
  return [...out];
}

function deletedAgo(iso: string, locale: Locale) {
  const t = trashText[locale];
  const date = new Date(iso);
  if (Date.now() - date.getTime() < 60_000) return t.deletedJustNow;
  return t.deleted(formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale(locale) }));
}

function chunks<T>(list: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Confirm = { kind: "one"; item: Item } | { kind: "all" } | null;

export function TrashView({ initialPages }: { initialPages: PageMeta[] }) {
  const { pages: livePages, subjects, upsertPages, removePages } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(trashText);
  const [trash, setTrash] = useState(initialPages);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [exit, setExit] = useState<"restore" | "delete">("delete");

  const items = useMemo(() => groupTrash(trash), [trash]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => pageTitle(i.root.title, i.root.kind, locale).toLowerCase().includes(q));
  }, [items, query, locale]);

  function oops(message: string) {
    blob.say(message, { mood: "worried" });
    blob.react("shake", "worried");
  }

  /** Never let a cascade take live pages with it: move them to the top level first. */
  async function detachLiveChildren(ids: string[]) {
    const supabase = createClient();
    for (const part of chunks(ids)) {
      const { data, error } = await supabase
        .from("pages")
        .update({ parent_id: null })
        .in("parent_id", part)
        .is("trashed_at", null)
        .select(PAGE_META_COLUMNS);
      if (error) return false;
      if (data?.length) upsertPages(data as PageMeta[]);
    }
    return true;
  }

  /** Put rows back into the list after a failed request, keeping newest first. */
  function putBack(rows: PageMeta[]) {
    setTrash((t) => {
      const ids = new Set(t.map((p) => p.id));
      return [...t, ...rows.filter((p) => !ids.has(p.id))].sort((a, b) => b.trashed_at!.localeCompare(a.trashed_at!));
    });
  }

  // All three actions are optimistic: the list and sidebar update at once, and roll back on failure.
  async function restore(item: Item) {
    const { root } = item;
    const original = trash.filter((p) => item.ids.includes(p.id));
    // If the parent is still in the trash, bring this page back at the top level.
    const detach = !!root.parent_id && !livePages.some((p) => p.id === root.parent_id);
    setExit("restore");
    setTrash((t) => t.filter((p) => !item.ids.includes(p.id)));
    upsertPages(original.map((p) => ({ ...p, trashed_at: null, parent_id: p.id === root.id && detach ? null : p.parent_id })));
    const name = pageTitle(root.title, root.kind, locale);
    blob.say(root.kind === "cv" ? t.restoredCv(name) : t.restored(name), { mood: "happy" });
    blob.react("jump", "happy");

    const supabase = createClient();
    const detached = detach ? await supabase.from("pages").update({ parent_id: null }).eq("id", root.id) : { error: null };
    const restored = detached.error
      ? null
      : await supabase.from("pages").update({ trashed_at: null }).in("id", item.ids).select(PAGE_META_COLUMNS);
    if (!restored || restored.error || !restored.data) {
      removePages(item.ids);
      putBack(original);
      return oops(t.restoreFailed);
    }
    upsertPages(restored.data as PageMeta[]);
  }

  async function destroy(item: Item) {
    const ids = withTrashedDescendants(trash, item.ids);
    const original = trash.filter((p) => ids.includes(p.id));
    setConfirm(null);
    setExit("delete");
    setTrash((t) => t.filter((p) => !ids.includes(p.id)));

    const ok = (await detachLiveChildren(ids)) && !(await createClient().from("pages").delete().in("id", ids)).error;
    if (!ok) {
      putBack(original);
      oops(t.deleteFailed);
    }
  }

  async function emptyTrash() {
    const ids = trash.map((p) => p.id);
    setConfirm(null);
    setExit("delete");
    setTrash([]);
    blob.say(t.allClean, { mood: "happy" });

    const supabase = createClient();
    let ok = await detachLiveChildren(ids);
    for (const part of ok ? chunks(ids) : []) {
      if ((await supabase.from("pages").delete().in("id", part)).error) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      // Show whatever is really left.
      const { data } = await supabase.from("pages").select(PAGE_META_COLUMNS).not("trashed_at", "is", null).order("trashed_at", { ascending: false });
      if (data) setTrash(data as PageMeta[]);
      oops(t.someLeft);
    }
  }

  const pending = confirm?.kind === "one" ? confirm.item : null;
  const pendingCount = pending ? withTrashedDescendants(trash, pending.ids).length - 1 : 0;

  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <Trash2 className="size-3.5 text-ink-3" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[920px] px-5 pb-28 pt-6 sm:px-8 lg:px-12 lg:pt-10">
          <motion.header
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{t.title}</h1>
              <p className="mt-1 text-[13.5px] text-ink-2">{t.intro}</p>
            </div>
            {items.length > 0 && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {/* Full width on phones, so the placeholder isn't cut off next to the button. */}
                <div className="min-w-0 flex-1 sm:w-[220px] sm:flex-none">
                  <Input
                    icon={<Search />}
                    placeholder={t.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-8 text-[13px]"
                    aria-label={t.search}
                  />
                </div>
                <Button variant="secondary" size="md" className="h-8 text-danger" onClick={() => setConfirm({ kind: "all" })}>
                  <Trash2 className="size-3.5" /> {t.empty}
                </Button>
              </div>
            )}
          </motion.header>

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-16 text-center"
            >
              <Blob size={128} mood="happy" />
              <h2 className="mt-2 font-display text-[20px] font-semibold tracking-[-0.015em]">{t.emptyTitle}</h2>
              <p className="mt-1 max-w-[340px] text-[13.5px] text-ink-2">
                {t.emptyHint}
              </p>
              <Link
                href="/home"
                className="mt-5 inline-flex h-8 items-center rounded-lg border border-line bg-raised px-3 text-[13px] font-medium text-ink shadow-card hover:border-line-2"
              >
                {t.backHome}
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-1 text-[12px] text-ink-3">
                <span>
                  {visible.length === items.length ? t.items(items.length) : t.filtered(visible.length, items.length)}
                </span>
                <span className="hidden sm:inline">{t.newestFirst}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
                <ul className="relative">
                  <AnimatePresence mode="popLayout" initial={false} custom={exit}>
                    {visible.map((item, index) => (
                      <TrashRow
                        key={item.root.id}
                        item={item}
                        first={index === 0}
                        subject={subjects.find((s) => s.id === item.root.subject_id)}
                        onRestore={() => restore(item)}
                        onDelete={() => setConfirm({ kind: "one", item })}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
                {visible.length === 0 && (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-3">{t.noMatch(query.trim())}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm?.kind === "one"}
        onClose={() => setConfirm(null)}
        onConfirm={() => pending && destroy(pending)}
        title={pending ? t.confirmOne(pageTitle(pending.root.title, pending.root.kind, locale)) : t.confirmOneFallback}
        confirmLabel={t.deleteForever}
      >
        {pendingCount > 0 ? t.alsoInside(pendingCount) : ""}
        {t.cantUndo}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "all"}
        onClose={() => setConfirm(null)}
        onConfirm={emptyTrash}
        title={t.confirmAll}
        confirmLabel={t.empty}
      >
        {t.allGone(trash.length)}
        {t.cantUndo}
      </ConfirmDialog>
    </>
  );
}

const rowVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, x: 0, y: 0, scale: 1 },
  exit: (kind: "restore" | "delete") =>
    kind === "restore"
      ? { opacity: 0, x: -48, transition: { type: "spring" as const, stiffness: 400, damping: 34 } }
      : { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

function TrashRow({
  item,
  first,
  subject,
  onRestore,
  onDelete,
}: {
  item: Item;
  first: boolean;
  subject?: { name: string; color: string; emoji: string | null };
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { root } = item;
  const locale = useLocale();
  const t = useMessages(trashText);
  const inside = item.ids.length - 1;
  const title = pageTitle(root.title, root.kind, locale);
  return (
    <motion.li
      layout
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cn("group flex items-center gap-3 bg-raised px-3 py-2.5 sm:px-4", !first && "border-t border-line")}
    >
      <Link href={`/p/${root.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg" title={t.open}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface">
          <PageIcon page={root} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink group-hover:underline group-hover:decoration-line-2 group-hover:underline-offset-4">
            {title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
            {subject ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: subjectColor(subject.color) }} />
                <span className="truncate">{subject.name}</span>
              </span>
            ) : (
              <span>{root.kind === "deck" ? t.presentation : root.kind === "cv" ? t.cv : t.note}</span>
            )}
            {inside > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0">{t.inside(inside)}</span>
              </>
            )}
            <span aria-hidden className="sm:hidden">
              ·
            </span>
            <span className="truncate sm:hidden" suppressHydrationWarning>
              {deletedAgo(root.trashed_at!, locale)}
            </span>
          </span>
        </span>
      </Link>
      <span
        className="hidden w-[150px] shrink-0 text-right text-[12.5px] text-ink-3 sm:block"
        title={format(new Date(root.trashed_at!), "PPp", { locale: dateLocale(locale) })}
        suppressHydrationWarning
      >
        {deletedAgo(root.trashed_at!, locale)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {/* Icon only on phones, where "Wiederherstellen" would squeeze the title. */}
        <Button variant="secondary" size="sm" onClick={onRestore} aria-label={t.restore}>
          <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">{t.restore}</span>
        </Button>
        <IconButton
          label={t.deleteForever}
          onClick={onDelete}
          className="hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </motion.li>
  );
}
