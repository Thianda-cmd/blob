"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import { ArrowUpFromLine, Ellipsis, Eye, Folder, FolderInput, GripVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, type TouchEventHandler } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { SCHOOL_EMOJIS } from "@/components/editor/IconPicker";
import { PageTopBar } from "@/components/page/PageTopBar";
import { KIND_LOOK, NewPageButton, type NewKind } from "@/components/shell/NewPageMenu";
import { PageBody, PageHeader, SectionHeader } from "@/components/shell/PageHeader";
import { PageIcon } from "@/components/shell/Sidebar";
import { PageCard, type PagePreview } from "@/components/subjects/PageCards";
import { useNow } from "@/components/tasks/useNow";
import { EmptyState } from "@/components/ui/EmptyState";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { card, midTone } from "@/components/ui/surfaces";
import { PageMenuArea } from "./PageMenuArea";
import { useImporter } from "./useImporter";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import type { AccessRole, Member, Page, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

/** The cards of a section: two columns on a phone, as many as fit from tablets up. */
const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-3";

/** A folder: the pages inside it as cards, new pages inside, and drag (or a menu) to move them. */
export function FolderView({ page: initial, role, members, previews }: { page: Page; role: AccessRole; members: Member[]; previews: Record<string, PagePreview> }) {
  const t = useMessages(notesText).folder;
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const { pages, createPage, updatePage, trashPage, userId } = useWorkspace();
  const importer = useImporter();
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
  const inks = children.filter((p) => p.kind === "ink");
  const sheets = children.filter((p) => p.kind === "sheet");
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

  const tile = (p: PageMeta) => {
    const inside = p.kind === "folder" ? pages.filter((c) => c.parent_id === p.id) : [];
    return (
      <Item key={p.id} page={p} draggable={canEdit} droppable={canEdit && p.kind === "folder"} dragging={dragging?.id === p.id}>
        <PageCard page={p} preview={previews[p.id]} inside={{ count: inside.length, titles: inside.slice(0, 3).map((c) => pageTitle(c.title, c.kind, locale)) }} now={now} />
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
  };

  // (Its ▾ also imports a file into the folder, as the sidebar's "+" on the folder does.)
  const newPage = (onPhones?: boolean) => (
    <NewPageButton kind="note" onPick={create} onImport={() => importer.pick({ parentId: page.id })} busy={busy !== null} labelOnPhones={onPhones} />
  );

  return (
    <PageMenuArea>
      <PageTopBar pageId={page.id} saveState="saved" role={role} members={members} actions={canEdit ? newPage() : undefined} />
      <PageBody width="default">
        <PageHeader
          icon={<FolderIcon icon={page.icon} editable={canEdit} onChange={(icon) => updatePage(page.id, { icon })} />}
          label={t.label}
          title={
            canEdit ? (
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
                className="-mx-1.5 block w-[calc(100%+0.75rem)] truncate rounded-lg bg-transparent px-1.5 outline-none transition-colors placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] hover:bg-hover/60 focus:bg-hover/60"
              />
            ) : (
              pageTitle(page.title, "folder", locale)
            )
          }
          meta={t.count(children.length)}
        />

        {!canEdit && (
          <div className={cn(card, "mb-6 flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-ink-2")} role="status">
            <Eye className="size-4 shrink-0 text-ink-3" aria-hidden /> {t.readOnly}
          </div>
        )}

        <DndContext id={dndId} sensors={sensors} collisionDetection={dropTarget} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          {children.length === 0 ? (
            <EmptyState
              art={<Blob size={88} mood="sleepy" track={false} />}
              title={t.emptyTitle}
              body={canEdit ? t.emptyText : undefined}
              actions={canEdit ? newPage(true) : undefined}
            />
          ) : (
            <div className="space-y-9">
              {folders.length > 0 && (
                <Section title={t.folders} count={folders.length} hint={canEdit && children.length > folders.length ? t.dragHint : undefined}>
                  <div className={GRID}>{folders.map(tile)}</div>
                </Section>
              )}
              {notes.length > 0 && (
                <Section title={t.notes} count={notes.length}>
                  <div className={GRID}>{notes.map(tile)}</div>
                </Section>
              )}
              {sheets.length > 0 && (
                <Section title={t.sheets} count={sheets.length}>
                  <div className={GRID}>{sheets.map(tile)}</div>
                </Section>
              )}
              {inks.length > 0 && (
                <Section title={t.inks} count={inks.length}>
                  <div className={GRID}>{inks.map(tile)}</div>
                </Section>
              )}
              {decks.length > 0 && (
                <Section title={t.decks} count={decks.length}>
                  <div className={GRID}>{decks.map(tile)}</div>
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
      </PageBody>
    </PageMenuArea>
  );
}

/** When the last drag ended: the click that ends a drag must not open the card. */
let lastDrop = 0;

/**
 * Where a dragged page lands: under the pointer (the little chip that follows it sits above the
 * pointer by as much as you grabbed the card below its top); with the keyboard, where the chip is.
 */
const dropTarget: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : rectIntersection(args);
};

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
      data-page-id={page.id}
      // No native link dragging or long-press menu: the card itself moves.
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "group/item relative h-full min-w-0 rounded-xl transition-[opacity,box-shadow,transform] duration-150 [-webkit-touch-callout:none]",
        dragging && "opacity-40",
        isOver && "scale-[1.02] ring-2 ring-blob motion-reduce:scale-100",
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
        <span className="pointer-events-none absolute inset-x-0 -bottom-3 z-[3] mx-auto w-fit rounded-full bg-blob px-2.5 py-0.5 text-[11.5px] font-medium text-white shadow-pop dark:bg-blob-deep">
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

/** The folder's icon (in the header's tile): a folder, or an emoji you pick. */
function FolderIcon({ icon, editable, onChange }: { icon: string | null; editable: boolean; onChange: (icon: string | null) => void }) {
  const t = useMessages(notesText).folder;
  const face = icon ? <span className="text-[20px] leading-none">{icon}</span> : <Folder strokeWidth={1.8} style={{ color: KIND_LOOK.folder.fg }} aria-hidden />;
  if (!editable) return face;
  return (
    <Popover
      align="start"
      className="w-[300px] p-1.5"
      role="dialog"
      label={t.icon}
      trigger={(props) => (
        <button {...props} type="button" className="grid size-full place-items-center rounded-[11px] transition-[background,transform] hover:bg-hover active:scale-95" aria-label={t.icon} title={t.icon}>
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
      <SectionHeader title={title} count={count} action={hint ? <span className={cn("block truncate text-[12px] [@media(hover:none)]:hidden", midTone)}>{hint}</span> : undefined} />
      {children}
    </section>
  );
}
