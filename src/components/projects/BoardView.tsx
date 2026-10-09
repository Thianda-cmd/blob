"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardCode,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Ellipsis, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { blob } from "@/components/blob/bus";
import type { Person } from "@/components/share/Avatar";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import type { Peer } from "@/lib/live";
import type { Member, ProjectColumn, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardFace } from "./CardFace";
import { cardsByColumn, checklistProgress } from "./model";
import { ColorSwatches, ColumnDot, parseLabels } from "./pickers";
import type { Board } from "./useBoard";

const COL = "col:";
const isColumnId = (id: UniqueIdentifier | null | undefined) => typeof id === "string" && id.startsWith(COL);
const columnKey = (id: string) => `${COL}${id}`;

type Items = Record<string, string[]>;

/**
 * The kanban: columns side by side, cards dragged between and within them (mouse, a long press on
 * touch screens, or the keyboard: space picks up, arrows move, space drops), columns reordered by
 * their header. `visible` hides cards (filters and search); positions are worked out against the
 * whole column, so a filtered drop still lands between the right neighbours.
 */
export function BoardView({
  board,
  visible,
  readOnly,
  now,
  openId,
  onOpen,
  meId,
}: {
  board: Board;
  visible: (card: Task) => boolean;
  readOnly: boolean;
  now: number | null;
  openId: string | null;
  onOpen: (cardId: string) => void;
  meId: string;
}) {
  // dnd-kit numbers its screen reader hints; React's id is the same on the server and in the browser.
  const dndId = useId();
  const t = useMessages(projectsText);
  const { columns, cards, members, peers } = board;

  const grouped = useMemo(() => cardsByColumn(columns, cards), [columns, cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const base = useMemo(() => {
    const out: Items = {};
    for (const c of columns) out[c.id] = (grouped.get(c.id) ?? []).filter(visible).map((card) => card.id);
    return out;
  }, [columns, grouped, visible]);

  // While a card is dragged, its place lives here (moving between columns as you hover them).
  const [items, setItems] = useState<Items | null>(null);
  const [active, setActive] = useState<{ id: string; type: "card" | "column" } | null>(null);
  const current = items ?? base;
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });
  const lastOver = useRef<UniqueIdentifier | null>(null);
  const movedBetween = useRef(false);
  const justDragged = useRef(0);

  const people = useMemo(() => new Map<string, Person>(members.map((m: Member) => [m.user_id, m])), [members]);
  const watchers = useMemo(() => {
    const map = new Map<string, Peer[]>();
    for (const p of peers) {
      if (!p.focus || p.user_id === meId) continue;
      map.set(p.focus, [...(map.get(p.focus) ?? []), p]);
    }
    return map;
  }, [peers, meId]);

  const findColumn = useCallback((id: UniqueIdentifier) => {
    const key = String(id);
    if (key.startsWith(COL)) return key.slice(COL.length);
    const map = currentRef.current;
    return Object.keys(map).find((col) => map[col].includes(key)) ?? null;
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // A long press picks a card up, so the board still scrolls under a finger.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] },
    }),
  );

  /** Cards find the card under the pointer (or the column, when it's empty); columns find columns. */
  const collision: CollisionDetection = useCallback(
    (args) => {
      if (active?.type === "column") {
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isColumnId(c.id)) });
      }
      const pointer = pointerWithin(args);
      const hits = pointer.length ? pointer : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");
      if (overId != null) {
        if (isColumnId(overId)) {
          const inside = currentRef.current[String(overId).slice(COL.length)] ?? [];
          if (inside.length) {
            overId =
              closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => inside.includes(String(c.id))) })[0]?.id ?? overId;
          }
        }
        lastOver.current = overId;
        return [{ id: overId }];
      }
      // Between columns for a moment: stay where we were (no flicker back and forth).
      if (movedBetween.current) lastOver.current = active?.id ?? null;
      return lastOver.current ? [{ id: lastOver.current }] : [];
    },
    [active],
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      movedBetween.current = false;
    });
  }, [items]);

  function onDragStart({ active: a }: DragStartEvent) {
    const id = String(a.id);
    const type = isColumnId(id) ? "column" : "card";
    setActive({ id, type });
    if (type === "card") setItems(base);
  }

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over || isColumnId(a.id)) return;
    const from = findColumn(a.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const map = prev ?? base;
      const fromList = map[from].filter((id) => id !== a.id);
      const toList = map[to].filter((id) => id !== a.id);
      let index = toList.length;
      if (!isColumnId(over.id)) {
        const overIndex = toList.indexOf(String(over.id));
        const below = a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : toList.length;
      }
      movedBetween.current = true;
      return { ...map, [from]: fromList, [to]: [...toList.slice(0, index), String(a.id), ...toList.slice(index)] };
    });
  }

  function finish() {
    setActive(null);
    setItems(null);
    lastOver.current = null;
    justDragged.current = Date.now();
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    const id = String(a.id);
    if (isColumnId(id)) {
      if (over && isColumnId(over.id) && over.id !== id) {
        const order = columns.map((c) => columnKey(c.id));
        const next = arrayMove(order, order.indexOf(id), order.indexOf(String(over.id)));
        void board.moveColumn(id.slice(COL.length), next.indexOf(id));
      }
      return finish();
    }
    const column = findColumn(id);
    if (!column || !over) return finish();
    let list = currentRef.current[column];
    const overColumn = findColumn(over.id);
    if (overColumn === column && !isColumnId(over.id)) {
      const from = list.indexOf(id);
      const to = list.indexOf(String(over.id));
      if (from >= 0 && to >= 0 && from !== to) list = arrayMove(list, from, to);
    }
    // From the visible order back to an index in the whole column (hidden cards included).
    const card = byId.get(id);
    const at = list.indexOf(id);
    const full = (grouped.get(column) ?? []).filter((c) => c.id !== id);
    const before = list[at - 1];
    const after = list[at + 1];
    const index = before ? full.findIndex((c) => c.id === before) + 1 : after ? Math.max(0, full.findIndex((c) => c.id === after)) : full.length;
    // Where it was among the others, if it stayed in its column: no write when nothing moved.
    const was = (grouped.get(column) ?? []).findIndex((c) => c.id === id);
    if (card && was !== index) void board.moveCard(id, column, index);
    finish();
  }

  const activeCard = active?.type === "card" ? byId.get(active.id) : undefined;
  const activeColumn = active?.type === "column" ? columns.find((c) => columnKey(c.id) === active.id) : undefined;
  const columnOf = (cardId: string) => columns.find((c) => c.id === findColumn(cardId));

  const announcements: Announcements = {
    onDragStart: ({ active: a }) =>
      isColumnId(a.id)
        ? t.dnd.columnPicked(columns.find((c) => columnKey(c.id) === a.id)?.title ?? "")
        : t.dnd.picked(byId.get(String(a.id))?.title ?? ""),
    onDragOver: ({ active: a, over }) => {
      if (!over || isColumnId(a.id)) return undefined;
      return t.dnd.over(byId.get(String(a.id))?.title ?? "", columnOf(String(over.id))?.title ?? "");
    },
    onDragEnd: ({ active: a, over }) => {
      if (isColumnId(a.id)) return t.dnd.columnDropped(columns.find((c) => columnKey(c.id) === a.id)?.title ?? "");
      return t.dnd.dropped(byId.get(String(a.id))?.title ?? "", over ? (columnOf(String(over.id))?.title ?? "") : "");
    },
    onDragCancel: ({ active: a }) => t.dnd.cancelled(byId.get(String(a.id))?.title ?? columns.find((c) => columnKey(c.id) === a.id)?.title ?? ""),
  };

  const open = useCallback(
    (cardId: string) => {
      if (Date.now() - justDragged.current < 250) return;
      onOpen(cardId);
    },
    [onOpen],
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.dnd.instructions } }}
    >
      <div
        className="flex h-full min-h-0 items-start gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 pt-1 max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-4 sm:px-8 lg:px-10"
        data-board
      >
        <SortableContext items={columns.map((c) => columnKey(c.id))} strategy={horizontalListSortingStrategy}>
          {columns.map((column, i) => (
            <BoardColumn
              key={column.id}
              column={column}
              index={i}
              count={columns.length}
              cardIds={current[column.id] ?? []}
              total={(grouped.get(column.id) ?? []).length}
              byId={byId}
              people={people}
              watchers={watchers}
              board={board}
              readOnly={readOnly}
              now={now}
              openId={openId}
              onOpen={open}
              dragging={active?.type === "card"}
            />
          ))}
        </SortableContext>
        {!readOnly && <AddColumn board={board} />}
        {/* Room to scroll the last columns out from under the open card (desktop). */}
        <div className={cn("shrink-0", openId ? "w-px sm:w-[452px]" : "w-px")} aria-hidden />
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeCard ? (
          <div className="w-[272px] max-sm:w-[calc(85vw-16px)]">
            <BoardCardFace card={activeCard} column={columns.find((c) => current[c.id]?.includes(activeCard.id))} people={people} now={now} overlay />
          </div>
        ) : activeColumn ? (
          <div className="w-[288px] rotate-[1deg] rounded-xl border border-line-2 bg-paper/95 p-3 shadow-pop">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <ColumnDot column={activeColumn} /> {activeColumn.title}
              <span className="text-ink-3">{(grouped.get(activeColumn.id) ?? []).length}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ---------------------------------------------------------------------------
   Column
   --------------------------------------------------------------------------- */

function BoardColumn({
  column,
  index,
  count,
  cardIds,
  total,
  byId,
  people,
  watchers,
  board,
  readOnly,
  now,
  openId,
  onOpen,
  dragging,
}: {
  column: ProjectColumn;
  index: number;
  count: number;
  cardIds: string[];
  total: number;
  byId: Map<string, Task>;
  people: Map<string, Person>;
  watchers: Map<string, Peer[]>;
  board: Board;
  readOnly: boolean;
  now: number | null;
  openId: string | null;
  onOpen: (id: string) => void;
  dragging: boolean;
}) {
  const t = useMessages(projectsText);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: columnKey(column.id),
    data: { type: "column" },
    disabled: readOnly,
    attributes: { roleDescription: t.dnd.column },
  });
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={column.title}
      className={cn(
        "group/col flex max-h-full w-[288px] shrink-0 flex-col rounded-xl bg-hover/45 max-sm:w-[85vw] max-sm:max-w-[320px] max-sm:snap-center dark:bg-hover/35",
        isDragging && "opacity-40",
      )}
    >
      <header
        {...(readOnly ? {} : listeners)}
        className={cn("flex h-11 shrink-0 items-center gap-1.5 pl-3 pr-1.5", !readOnly && "cursor-grab active:cursor-grabbing")}
      >
        {!readOnly && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            aria-label={t.dragColumn(column.title)}
            className="-ml-2 grid h-7 w-4 shrink-0 place-items-center rounded text-ink-3 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/col:opacity-100 [@media(hover:none)]:hidden"
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <span title={column.done ? t.doneColumnHint : undefined} className="flex">
          <ColumnDot column={column} />
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={column.title}
            maxLength={60}
            aria-label={t.columnName}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onBlur={(e) => {
              setRenaming(false);
              if (e.target.value.trim() && e.target.value !== column.title) void board.updateColumn(column.id, { title: e.target.value });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = column.title;
                e.currentTarget.blur();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-md bg-raised px-1.5 text-[13px] font-semibold text-ink shadow-[0_0_0_1.5px_var(--blob)] outline-none"
          />
        ) : (
          <h3
            className="min-w-0 truncate text-[13px] font-semibold text-ink"
            title={column.title}
            onDoubleClick={() => !readOnly && setRenaming(true)}
          >
            {column.title}
          </h3>
        )}
        {!renaming && (
          <span className="shrink-0 rounded-full px-1 text-[12px] tabular-nums text-ink-3" title={t.cardCount(total)}>
            {total}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center">
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
              }}
              className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/col:opacity-100 [@media(hover:none)]:size-8 [@media(hover:none)]:opacity-100"
              aria-label={t.addCard}
              title={t.addCard}
            >
              <Plus className="size-4" />
            </button>
          )}
          {!readOnly && (
            <ColumnOptions column={column} index={index} count={count} board={board} onRename={() => setRenaming(true)} />
          )}
        </span>
      </header>

      {/* A little room above the first card for the picture of whoever is looking at it. */}
      <div ref={listRef} className={cn("-mt-1.5 min-h-0 flex-1 overflow-y-auto px-2 pt-1.5", cardIds.length === 0 && !adding ? "pb-2" : "pb-1")}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-1 flex-col gap-2">
            {cardIds.map((id) => {
              const card = byId.get(id);
              if (!card) return null;
              return (
                <SortableCard
                  key={id}
                  card={card}
                  column={column}
                  people={people}
                  watchers={watchers.get(id)}
                  now={now}
                  open={openId === id}
                  readOnly={readOnly}
                  onOpen={onOpen}
                />
              );
            })}
          </div>
        </SortableContext>
        {cardIds.length === 0 && !adding && (
          <div
            className={cn(
              "grid h-16 place-items-center rounded-[10px] border border-dashed text-[12px] transition-colors",
              dragging ? "border-blob/50 bg-blob-soft/40 text-blob-ink" : "border-line-2 text-ink-3",
            )}
          >
            {readOnly ? "" : t.dropHere}
          </div>
        )}
        {adding && <CardComposer board={board} columnId={column.id} onClose={() => setAdding(false)} listRef={listRef} />}
      </div>

      {!readOnly && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mx-2 mb-2 mt-1 flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10"
        >
          <Plus className="size-4" /> {t.addCard}
        </button>
      )}
    </section>
  );
}

function ColumnOptions({ column, index, count, board, onRename }: { column: ProjectColumn; index: number; count: number; board: Board; onRename: () => void }) {
  const t = useMessages(projectsText);
  const [confirming, setConfirming] = useState(false);
  const target = board.columns.find((c) => c.id !== column.id);
  const cardsHere = board.cards.filter((c) => c.column_id === column.id).length;
  return (
    <Popover
      align="end"
      className="w-[240px]"
      onOpenChange={(o) => !o && setConfirming(false)}
      trigger={(props) => (
        <button
          {...props}
          onPointerDown={(e) => e.stopPropagation()}
          className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink aria-expanded:bg-hover [@media(hover:none)]:size-8"
          aria-label={t.columnOptions}
          title={t.columnOptions}
        >
          <Ellipsis className="size-4" />
        </button>
      )}
    >
      {(close) =>
        confirming ? (
          <div className="p-1.5">
            <p className="text-[13px] font-medium text-ink">{t.deleteColumn}?</p>
            {cardsHere > 0 && target && <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{t.deleteColumnCards(cardsHere, target.title)}</p>}
            <div className="mt-2.5 flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t.cancel}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  close();
                  if (target) void board.deleteColumn(column.id, target.id);
                }}
              >
                {t.deleteColumn}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <MenuItem
              icon={<Pencil />}
              onSelect={() => {
                close();
                onRename();
              }}
            >
              {t.rename}
            </MenuItem>
            <MenuItem
              icon={<CheckCircle2 />}
              shortcut={column.done ? <Check className="size-3.5" /> : undefined}
              onSelect={() => {
                void board.updateColumn(column.id, { done: !column.done });
                if (!column.done) blob.react("jump", "happy");
                close();
              }}
            >
              <span className="flex flex-col leading-tight">
                {t.doneColumn}
                <span className="text-[11px] text-ink-3">{t.doneColumnHint}</span>
              </span>
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>{t.color}</MenuLabel>
            <div className="px-1.5 pb-1.5">
              <ColorSwatches value={column.color} onChange={(color) => void board.updateColumn(column.id, { color })} label={t.color} size="sm" />
            </div>
            <MenuSeparator />
            <MenuItem
              icon={<ArrowLeft />}
              disabled={index === 0}
              onSelect={() => {
                void board.moveColumn(column.id, index - 1);
                close();
              }}
            >
              {t.moveLeft}
            </MenuItem>
            <MenuItem
              icon={<ArrowRight />}
              disabled={index === count - 1}
              onSelect={() => {
                void board.moveColumn(column.id, index + 1);
                close();
              }}
            >
              {t.moveRight}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 />}
              danger
              disabled={count <= 1}
              onSelect={() => (count <= 1 ? blob.say(t.lastColumn) : setConfirming(true))}
            >
              {t.deleteColumn}
            </MenuItem>
          </>
        )
      }
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   Cards
   --------------------------------------------------------------------------- */

export function BoardCardFace({
  card,
  column,
  people,
  watchers,
  now,
  overlay,
  dragging,
}: {
  card: Task;
  column?: ProjectColumn;
  people: Map<string, Person>;
  watchers?: Peer[];
  now: number | null;
  overlay?: boolean;
  dragging?: boolean;
}) {
  const done = card.done || !!column?.done;
  return (
    <CardFace
      title={
        <>
          {done && <Check className="-mt-0.5 mr-1 inline size-3.5 text-ok" strokeWidth={2.6} />}
          {card.title}
        </>
      }
      done={done}
      labels={parseLabels(card.labels)}
      priority={card.priority}
      due={card.due_at}
      checklist={checklistProgress(card.checklist)}
      attachments={card.attachments.length}
      description={!!card.details?.trim()}
      assignees={card.assignees.map((id) => people.get(id)).filter((p): p is Person => !!p)}
      watchers={watchers}
      now={now}
      overlay={overlay}
      dragging={dragging}
    />
  );
}

const SortableCard = memo(function SortableCard({
  card,
  column,
  people,
  watchers,
  now,
  open,
  readOnly,
  onOpen,
}: {
  card: Task;
  column: ProjectColumn;
  people: Map<string, Person>;
  watchers?: Peer[];
  now: number | null;
  open: boolean;
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useMessages(projectsText);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    disabled: readOnly,
    attributes: { roleDescription: t.dnd.card },
  });
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen(card.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={t.openCard(card.title)}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(card.id)}
      data-card={card.id}
      className={cn(
        "group/card relative cursor-pointer touch-manipulation select-none rounded-[10px] outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-1 focus-visible:ring-offset-paper",
        open && "ring-2 ring-blob/70",
      )}
    >
      <BoardCardFace card={card} column={column} people={people} watchers={watchers} now={now} dragging={isDragging} />
    </div>
  );
});

/** Quick add at the bottom of a column: type, Enter, type the next one. */
function CardComposer({ board, columnId, onClose, listRef }: { board: Board; columnId: string; onClose: () => void; listRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useMessages(projectsText);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const title = value.replace(/\s+/g, " ").trim();
    if (!title) return;
    setValue("");
    void board.addCard(columnId, title);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 pb-1">
        <div className="rounded-[10px] border border-blob/60 bg-raised p-2 shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)]">
          <textarea
            ref={ref}
            autoFocus
            rows={2}
            value={value}
            maxLength={200}
            placeholder={t.cardPlaceholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") onClose();
            }}
            onBlur={() => {
              submit();
              onClose();
            }}
            className="block w-full resize-none bg-transparent text-[13.5px] leading-[1.4] text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-ink-3 [@media(hover:none)]:hidden">{t.addCardHint}</span>
            <Button
              size="xs"
              variant="blob"
              className="ml-auto"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                submit();
                ref.current?.focus();
              }}
            >
              {t.addCard}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function AddColumn({ board }: { board: Board }) {
  const t = useMessages(projectsText);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-11 w-[240px] shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-2 px-3 text-[13px] text-ink-3 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink max-sm:snap-center"
      >
        <Plus className="size-4" /> {t.addColumn}
      </button>
    );
  }
  const submit = () => {
    if (value.trim()) void board.addColumn(value);
    setValue("");
  };
  return (
    <div className="w-[260px] shrink-0 rounded-xl bg-hover/45 p-2 max-sm:snap-center">
      <input
        autoFocus
        value={value}
        maxLength={60}
        placeholder={t.columnName}
        aria-label={t.columnName}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => {
          submit();
          setEditing(false);
        }}
        className="h-9 w-full rounded-lg border border-blob bg-raised px-2.5 text-[13px] font-semibold text-ink shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)] outline-none"
      />
    </div>
  );
}
