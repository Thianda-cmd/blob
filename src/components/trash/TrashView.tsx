"use client";

import { formatDistanceToNowStrict, format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { deletePagesForever } from "@/components/files/deleteForever";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { PageIcon } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { Button, buttonClass, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { card, midTone, searchOnPaper } from "@/components/ui/surfaces";
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

type Confirm = { kind: "one"; item: Item } | { kind: "all" } | null;

export function TrashView({ initialPages }: { initialPages: PageMeta[] }) {
  const { pages: livePages, subjects, upsertPages, removePages, userId } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(trashText);
  // Only your own pages: someone else's trash (a page shared with you) stays theirs.
  const [trash, setTrash] = useState(() => initialPages.filter((p) => p.user_id === userId));
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

  /** Show the trash as the server has it. True when none of `ids` is left in it. */
  async function reload(ids: string[]) {
    const { data } = await createClient()
      .from("pages")
      .select(PAGE_META_COLUMNS)
      .eq("user_id", userId)
      .not("trashed_at", "is", null)
      .order("trashed_at", { ascending: false });
    if (!data) return false;
    setTrash(data as PageMeta[]);
    return !data.some((p) => ids.includes(p.id));
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

    // On the server: it deletes only what is still in the trash, then the files of what is gone.
    const done = await deletePagesForever(ids).catch(() => null);
    if (!done) {
      putBack(original);
      return oops(t.deleteFailed);
    }
    if (done.detached.length) upsertPages(done.detached);
    // Not all gone: restored meanwhile somewhere else (fine), or still in the trash (failed).
    if (done.gone.length < ids.length && !(await reload(ids))) oops(t.deleteFailed);
  }

  async function emptyTrash() {
    const ids = trash.map((p) => p.id);
    setConfirm(null);
    setExit("delete");
    setTrash([]);
    blob.say(t.allClean, { mood: "happy" });

    const done = await deletePagesForever(ids).catch(() => null);
    if (done?.detached.length) upsertPages(done.detached);
    // Show whatever is really left (a page restored meanwhile somewhere else isn't).
    if ((!done || done.gone.length < ids.length) && !(await reload(ids))) oops(t.someLeft);
  }

  const pending = confirm?.kind === "one" ? confirm.item : null;
  const pendingCount = pending ? withTrashedDescendants(trash, pending.ids).length - 1 : 0;
  // One line under the title: how many there are (or found), newest first; empty: what the trash is for.
  const meta = items.length
    ? `${visible.length === items.length ? t.items(items.length) : t.filtered(visible.length, items.length)} · ${t.newestFirst}`
    : t.intro;

  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <Trash2 className="size-3.5 text-ink-3" /> }]} />
      <PageBody width="narrow">
          <PageHeader title={t.title} meta={meta}>
            {items.length > 0 && (
              <>
                {/* Grows on phones, so the placeholder isn't cut off next to the button. */}
                <label className="relative flex min-w-0 flex-1 items-center sm:max-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" />
                  <input
                    type="search"
                    placeholder={t.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                    className={cn(searchOnPaper, "w-full min-w-[9rem] pl-9 [&::-webkit-search-cancel-button]:hidden")}
                    aria-label={t.search}
                  />
                </label>
                {/* "Leeren" on phones, so the search keeps room for its placeholder. */}
                <Button variant="secondary" size="md" className="shrink-0 text-danger [@media(hover:none)]:h-10" onClick={() => setConfirm({ kind: "all" })} aria-label={t.empty}>
                  <Trash2 className="size-3.5" /> <span className="sm:hidden">{t.emptyShort}</span>
                  <span className="max-sm:hidden">{t.empty}</span>
                </Button>
              </>
            )}
          </PageHeader>

          {items.length === 0 ? (
            <EmptyState
              art={<Blob size={96} mood="happy" />}
              title={t.emptyTitle}
              body={t.emptyHint}
              actions={
                <Link href="/home" className={buttonClass("secondary", "sm")}>
                  {t.backHome}
                </Link>
              }
            />
          ) : (
            <>
              <div className={cn(card, "overflow-hidden")}>
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
                  <div className={cn("px-4 py-10 text-center text-[13px]", midTone)}>{t.noMatch(query.trim())}</div>
                )}
              </div>
            </>
          )}
      </PageBody>

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

/** What kind of page a row is ("Tabelle", "Handschrift" …). */
function kindLabel(kind: PageMeta["kind"], t: (typeof trashText)["en"]) {
  return kind === "deck" ? t.presentation : kind === "cv" ? t.cv : kind === "folder" ? t.folder : kind === "sheet" ? t.sheet : kind === "ink" ? t.ink : t.note;
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
          <span className={cn("flex min-w-0 items-center gap-1.5 text-[12px]", midTone)}>
            <span className="shrink-0">{kindLabel(root.kind, t)}</span>
            {subject && (
              <>
                <span aria-hidden>·</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: subjectColor(subject.color) }} />
                  <span className="truncate">{subject.name}</span>
                </span>
              </>
            )}
            {inside > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0">{t.inside(inside)}</span>
              </>
            )}
          </span>
          {/* Phones: when it was deleted gets a line of its own (beside the kind it was cut off). */}
          <span className={cn("block truncate text-[12px] sm:hidden", midTone)} suppressHydrationWarning>
            {deletedAgo(root.trashed_at!, locale)}
          </span>
        </span>
      </Link>
      <span
        className={cn("hidden w-[150px] shrink-0 text-right text-[12.5px] sm:block", midTone)}
        title={format(new Date(root.trashed_at!), "PPp", { locale: dateLocale(locale) })}
        suppressHydrationWarning
      >
        {deletedAgo(root.trashed_at!, locale)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {/* Icon only on phones, where "Wiederherstellen" would squeeze the title. */}
        <Button variant="secondary" size="sm" onClick={onRestore} aria-label={t.restore} className="[@media(hover:none)]:h-9 [@media(hover:none)]:min-w-9">
          <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">{t.restore}</span>
        </Button>
        <IconButton
          label={t.deleteForever}
          onClick={onDelete}
          className="hover:bg-danger/10 hover:text-danger [@media(hover:none)]:size-9"
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </motion.li>
  );
}
