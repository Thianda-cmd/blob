"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import { ArrowUpFromLine, Ellipsis, Eye, FilePlus2, Folder, FolderInput, FolderPlus, GripVertical, Presentation, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, type TouchEventHandler } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { SCHOOL_EMOJIS } from "@/components/editor/IconPicker";
import { PageTopBar } from "@/components/page/PageTopBar";
import { PageIcon } from "@/components/shell/Sidebar";
import { DeckCard, NoteCard, type PagePreview } from "@/components/subjects/PageCards";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import type { AccessRole, Member, Page, PageKind, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

type NewKind = Extract<PageKind, "note" | "deck" | "folder">;

/** A folder: the pages inside it as cards, new pages inside, and drag (or a menu) to move them. */
export function FolderView({ page: initial, role, members, previews }: { page: Page; role: AccessRole; members: Member[]; previews: Record<string, PagePreview> }) {
  const t = useMessages(notesText).folder;
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const { pages, createPage, updatePage, trashPage, userId } = useWorkspace();
  const page = pages.find((p) => p.id === initial.id) ?? initial;
  const canEdit = role !== "viewer";
  const [title, setTitle] = useState(page.title);
  // What the database has (the workspace copy changes while typing).
  const [savedTitle, setSavedTitle] = useState(page.title);
  const [busy, setBusy] = useState<NewKind | null>(null);
  const [dragging, setDragging] = useState<PageMeta | null>(null);
  // A stable id keeps dnd-kit's accessibility ids the same on the server and in the browser.
  const dndId = useId();

  const children = useMemo(
    () =>
      pages
        .filter((p) => p.parent_id === page.id && p.kind !== "cv")
        .sort((a, b) => (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) || a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [pages, page.id],
  );
  const folders = children.filter((p) => p.kind === "folder");
  const notes = children.filter((p) => p.kind === "note");
  const decks = children.filter((p) => p.kind === "deck");
  const parent = page.parent_id ? pages.find((p) => p.id === page.parent_id) : undefined;

  useEffect(() => {
    document.title = `${pageTitle(title, "folder", locale)} · Blob`;
  }, [title, locale]);

  const saveTitle = () => {
    const next = title.replace(/\s+/g, " ").trim().slice(0, 300);
    if (next === savedTitle) return;
    setSavedTitle(next);
    void updatePage(page.id, { title: next });
  };

  async function create(kind: NewKind) {
    if (busy) return;
    setBusy(kind);
    const created = await createPage({ kind, parent_id: page.id, subject_id: page.subject_id });
    setBusy(null);
    if (created) router.push(`/p/${created.id}`);
  }

  /** Move a page into `target` (a folder here, or this folder's parent: null is the top level). */
  async function move(item: PageMeta, target: PageMeta | null) {
    if (target && (target.id === item.id || target.id === item.parent_id)) return;
    const ok = await updatePage(item.id, {
      parent_id: target ? target.id : (page.parent_id ?? null),
      // At the top level a page keeps the folder's subject; inside a folder the folder's place decides.
      // Inside someone else's shared folder your page has no subject (their subjects aren't yours).
      ...(item.user_id === userId && { subject_id: (target ?? page).user_id === userId ? (target ?? page).subject_id : null }),
    });
    const name = pageTitle(item.title, item.kind, locale);
    if (!ok) blob.say(t.moveFailed, { mood: "worried" });
    else if (target) blob.say(t.moved(name, pageTitle(target.title, target.kind, locale)), { mood: "happy" });
    else blob.say(t.movedUp(name), { mood: "happy" });
  }

  // Mouse: a short move starts a drag. Touch: press and hold (so scrolling stays scrolling). Keys: the grip.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const onDragStart = (e: DragStartEvent) => setDragging(children.find((c) => c.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    lastDrop = Date.now();
    const item = children.find((c) => c.id === e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!item || !over) return;
    if (over === "up") void move(item, null);
    else if (over.startsWith("into:")) {
      const target = pages.find((p) => p.id === over.slice(5));
      if (target) void move(item, target);
    }
  };

  const card = (p: PageMeta) => (
    <Item key={p.id} page={p} draggable={canEdit} droppable={canEdit && p.kind === "folder"} dragging={dragging?.id === p.id}>
      {p.kind === "folder" ? (
        <FolderCard page={p} count={pages.filter((c) => c.parent_id === p.id).length} titles={pages.filter((c) => c.parent_id === p.id).slice(0, 2).map((c) => pageTitle(c.title, c.kind, locale))} />
      ) : p.kind === "deck" ? (
        <DeckCard page={p} preview={previews[p.id]} now={now} />
      ) : (
        <NoteCard page={p} preview={previews[p.id]} now={now} />
      )}
      {canEdit && (
        <MoveMenu
          item={p}
          folders={folders.filter((f) => f.id !== p.id)}
          canUp
          canTrash={p.user_id === userId}
          onMove={(target) => move(p, target)}
          onTrash={() => trashPage(p.id)}
        />
      )}
    </Item>
  );

  return (
    <>
      <PageTopBar pageId={page.id} saveState="saved" role={role} members={members} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-4 pb-28 pt-5 sm:px-8 lg:px-10 lg:pt-8">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-4">
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3.5 sm:basis-auto">
              <FolderIcon icon={page.icon} editable={canEdit} onChange={(icon) => updatePage(page.id, { icon })} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{t.label}</div>
                {canEdit ? (
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      void updatePage(page.id, { title: e.target.value }, { local: true });
                    }}
                    onBlur={saveTitle}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    placeholder={t.namePlaceholder}
                    aria-label={t.nameLabel}
                    // A brand-new folder asks for its name right away.
                    autoFocus={!initial.title}
                    maxLength={300}
                    className="block w-full truncate bg-transparent font-display text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink outline-none placeholder:text-ink-3/50"
                  />
                ) : (
                  <h1 className="truncate font-display text-[28px] font-bold leading-tight tracking-[-0.025em]">{pageTitle(page.title, "folder", locale)}</h1>
                )}
                <p className="mt-0.5 text-[13px] text-ink-3">{t.count(children.length)}</p>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => create("note")} loading={busy === "note"}>
                  <FilePlus2 className="size-4" /> {t.newNote}
                </Button>
                <Button variant="secondary" onClick={() => create("deck")} loading={busy === "deck"}>
                  <Presentation className="size-4" /> <span className="max-sm:sr-only">{t.newDeck}</span>
                </Button>
                <Button variant="secondary" onClick={() => create("folder")} loading={busy === "folder"}>
                  <FolderPlus className="size-4" /> <span className="max-sm:sr-only">{t.newFolder}</span>
                </Button>
              </div>
            )}
          </header>

          {!canEdit && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[13px] text-ink-2 shadow-card" role="status">
              <Eye className="size-4 shrink-0 text-ink-3" /> {t.readOnly}
            </div>
          )}

          <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            {children.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-14 text-center"
              >
                <Blob size={104} mood="sleepy" track={false} />
                <h2 className="mt-2 font-display text-[19px] font-semibold tracking-[-0.015em]">{t.emptyTitle}</h2>
                {canEdit && <p className="mt-1 max-w-[340px] text-[13.5px] text-ink-2">{t.emptyText}</p>}
              </motion.div>
            ) : (
              <div className="mt-8 space-y-8">
                {folders.length > 0 && (
                  <Section
                    title={t.folders}
                    count={folders.length}
                    hint={canEdit && children.length > folders.length ? t.dragHint : undefined}
                  >
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">{folders.map(card)}</div>
                  </Section>
                )}
                {notes.length > 0 && (
                  <Section title={t.notes} count={notes.length}>
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">{notes.map(card)}</div>
                  </Section>
                )}
                {decks.length > 0 && (
                  <Section title={t.decks} count={decks.length}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">{decks.map(card)}</div>
                  </Section>
                )}
              </div>
            )}

            {/* While dragging: a place to drop that takes the page up one level. */}
            {dragging && <UpTarget label={parent ? `${t.moveUp} · ${pageTitle(parent.title, parent.kind, locale)}` : t.moveUp} />}
            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {dragging && (
                <div className="flex max-w-[260px] items-center gap-2 rounded-xl border border-blob/40 bg-raised px-3 py-2.5 text-[13.5px] font-medium text-ink shadow-pop">
                  <PageIcon page={dragging} />
                  <span className="truncate">{pageTitle(dragging.title, dragging.kind, locale)}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </>
  );
}

/** When the last drag ended: the click that ends a drag must not open the card. */
let lastDrop = 0;

/** A card that can be dragged (all of it with a mouse or a long press; the grip with keys), and folders dropped onto. */
function Item({ page, draggable, droppable, dragging, children }: { page: PageMeta; draggable: boolean; droppable: boolean; dragging: boolean; children: ReactNode }) {
  const t = useMessages(notesText).folder;
  const { setNodeRef: setDragRef, listeners, attributes } = useDraggable({ id: page.id, disabled: !draggable });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `into:${page.id}`, disabled: !droppable });
  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      onMouseDown={draggable ? (listeners?.onMouseDown as MouseEventHandler | undefined) : undefined}
      onTouchStart={draggable ? (listeners?.onTouchStart as TouchEventHandler | undefined) : undefined}
      onClickCapture={(e) => {
        if (Date.now() - lastDrop < 400) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      // No native link dragging or long-press menu: the card itself moves.
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "group/item relative rounded-xl transition-[opacity,box-shadow,transform] duration-150 [-webkit-touch-callout:none]",
        dragging && "opacity-40",
        isOver && "scale-[1.02] shadow-[0_0_0_2px_var(--blob)]",
      )}
    >
      {children}
      {draggable && (
        <button
          {...attributes}
          onKeyDown={listeners?.onKeyDown as KeyboardEventHandler | undefined}
          aria-label={t.dragHint}
          title={t.dragHint}
          className="absolute left-1 top-1/2 z-[2] grid h-8 w-5 -translate-y-1/2 cursor-grab place-items-center rounded-md bg-raised text-ink-3 opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:hidden"
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      {isOver && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-3 z-[3] mx-auto w-fit rounded-full bg-blob px-2.5 py-0.5 text-[11.5px] font-medium text-white shadow-pop">
          {t.moveHere}
        </span>
      )}
    </div>
  );
}

function UpTarget({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: "up" });
  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border-2 border-dashed px-5 py-3 text-[13.5px] font-medium shadow-pop backdrop-blur-md transition-colors",
        isOver ? "border-blob bg-blob-soft text-blob-ink" : "border-line-2 bg-raised/90 text-ink-2",
      )}
    >
      <ArrowUpFromLine className="size-4" /> {label}
    </motion.div>
  );
}

function FolderCard({ page, count, titles }: { page: PageMeta; count: number; titles: string[] }) {
  const t = useMessages(notesText);
  const locale = useLocale();
  const router = useRouter();
  const name = pageTitle(page.title, page.kind, locale);
  return (
    <button
      onClick={() => router.push(`/p/${page.id}`)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-raised p-3.5 text-left shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
        {page.icon ? <span className="text-[18px] leading-none">{page.icon}</span> : <Folder className="size-5" strokeWidth={1.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink" title={name}>
          {name}
        </span>
        <span className="block truncate text-[12px] text-ink-3">{count ? [t.pagesInside(count), ...titles].join(" · ") : t.emptyFolder}</span>
      </span>
    </button>
  );
}

/** Move without dragging (touch, keyboard): into a folder next to it, or up one level. */
function MoveMenu({
  item,
  folders,
  canUp,
  canTrash,
  onMove,
  onTrash,
}: {
  item: PageMeta;
  folders: PageMeta[];
  canUp: boolean;
  canTrash: boolean;
  onMove: (target: PageMeta | null) => void;
  onTrash: () => void;
}) {
  const t = useMessages(notesText).folder;
  const locale = useLocale();
  return (
    <span className="absolute right-1.5 top-1.5 z-[2] opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100 [&:has([aria-expanded=true])]:opacity-100 [@media(hover:none)]:opacity-100">
      <Popover
        align="end"
        className="w-[230px]"
        trigger={(props) => (
          <button {...props} className="grid size-7 place-items-center rounded-lg bg-raised/90 text-ink-3 shadow-card backdrop-blur-sm hover:text-ink [@media(hover:none)]:size-8" aria-label={pageTitle(item.title, item.kind, locale)}>
            <Ellipsis className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <>
            {folders.length > 0 && (
              <MenuLabel>
                <span className="flex items-center gap-1.5">
                  <FolderInput className="size-3" /> {t.moveTo}
                </span>
              </MenuLabel>
            )}
            <div className="max-h-[200px] overflow-y-auto">
              {folders.map((f) => (
                <MenuItem key={f.id} icon={<PageIcon page={f} />} onSelect={() => (close(), onMove(f))}>
                  {pageTitle(f.title, f.kind, locale)}
                </MenuItem>
              ))}
            </div>
            {canUp && (
              <MenuItem icon={<ArrowUpFromLine />} onSelect={() => (close(), onMove(null))}>
                {t.moveUp}
              </MenuItem>
            )}
            {canTrash && (
              <>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={() => (close(), onTrash())}>
                  {t.trash}
                </MenuItem>
              </>
            )}
          </>
        )}
      </Popover>
    </span>
  );
}

/** The folder's icon: a folder, or an emoji you pick. */
function FolderIcon({ icon, editable, onChange }: { icon: string | null; editable: boolean; onChange: (icon: string | null) => void }) {
  const t = useMessages(notesText).folder;
  const face = icon ? <span className="text-[28px] leading-none">{icon}</span> : <Folder className="size-7 text-blob-ink" strokeWidth={1.7} />;
  const box = "grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-raised shadow-card";
  if (!editable) return <div className={box}>{face}</div>;
  return (
    <Popover
      align="start"
      className="w-[300px] p-1.5"
      role="dialog"
      label={t.icon}
      trigger={(props) => (
        <button {...props} className={cn(box, "transition-[transform,border-color] hover:border-line-2 active:scale-95")} aria-label={t.icon} title={t.icon}>
          {face}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="grid grid-cols-8 gap-0.5">
            {SCHOOL_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => (onChange(e), close())}
                className={cn("grid size-8 place-items-center rounded-lg text-[18px] leading-none hover:bg-hover", icon === e && "bg-blob-soft")}
              >
                {e}
              </button>
            ))}
          </div>
          {icon && (
            <>
              <MenuSeparator />
              <MenuItem icon={<Folder />} onSelect={() => (onChange(null), close())}>
                {t.removeIcon}
              </MenuItem>
            </>
          )}
        </>
      )}
    </Popover>
  );
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex h-6 items-center gap-2">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium leading-[18px] tabular-nums text-ink-3">{count}</span>
        {hint && <span className="ml-auto truncate text-[12px] text-ink-3 [@media(hover:none)]:hidden">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
