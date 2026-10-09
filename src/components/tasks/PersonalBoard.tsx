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
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CardFace, DueChip } from "@/components/projects/CardFace";
import { positionBetween, spacedPositions, STEP, tooClose } from "@/components/projects/model";
import { ColumnDot } from "@/components/projects/pickers";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { tasksText } from "@/i18n/messages/tasks";
import { matchSubject, parseQuickAdd } from "@/lib/tasks";
import type { Subject, Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DuePicker, KindBadge, KindOptions, SubjectDot, SubjectPicker } from "./pickers";
import { TaskCheckbox } from "./TaskCheckbox";
import type { TaskStore } from "./useTaskStore";

const STATUSES: TaskStatus[] = ["todo", "doing", "done"];
const COLORS: Record<TaskStatus, string> = { todo: "ink", doing: "sky", done: "moss" };
const isStatus = (id: UniqueIdentifier): id is TaskStatus => STATUSES.includes(id as TaskStatus);
const byPlace = (a: Task, b: Task) => a.position - b.position || a.created_at.localeCompare(b.created_at);

type Items = Record<TaskStatus, string[]>;

/**
 * Your own tasks as a board: To do, Doing, Done. Drag cards between columns (mouse, long press,
 * keyboard); dropping in Done ticks a task off, and ticking it moves it there. `tasks` is the
 * filtered list from the Tasks page; places are worked out against all your tasks.
 */
export function PersonalBoard({ store, tasks, subjects, now }: { store: TaskStore; tasks: Task[]; subjects: Subject[]; now: number | null }) {
  // dnd-kit numbers its screen reader hints; React's id is the same on the server and in the browser.
  const dndId = useId();
  const t = useMessages(tasksText);
  const byId = useMemo(() => new Map(store.tasks.map((x) => [x.id, x])), [store.tasks]);
  const base = useMemo(() => {
    const out: Items = { todo: [], doing: [], done: [] };
    for (const task of [...tasks].sort(byPlace)) out[task.status].push(task.id);
    return out;
  }, [tasks]);
  const [items, setItems] = useState<Items | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const current = items ?? base;
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });
  const lastOver = useRef<UniqueIdentifier | null>(null);

  const find = useCallback((id: UniqueIdentifier): TaskStatus | null => {
    if (isStatus(id)) return id;
    const map = currentRef.current;
    return STATUSES.find((s) => map[s].includes(String(id))) ?? null;
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] },
    }),
  );

  const collision: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    const hits = pointer.length ? pointer : rectIntersection(args);
    let overId = getFirstCollision(hits, "id");
    if (overId != null) {
      if (isStatus(overId)) {
        const inside = currentRef.current[overId];
        if (inside.length) overId = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => inside.includes(String(c.id))) })[0]?.id ?? overId;
      }
      lastOver.current = overId;
      return [{ id: overId }];
    }
    return lastOver.current ? [{ id: lastOver.current }] : [];
  }, []);

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over) return;
    const from = find(a.id);
    const to = find(over.id);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const map = prev ?? base;
      const toList = map[to].filter((id) => id !== a.id);
      let index = toList.length;
      if (!isStatus(over.id)) {
        const i = toList.indexOf(String(over.id));
        const below = a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        index = i >= 0 ? i + (below ? 1 : 0) : toList.length;
      }
      return { ...map, [from]: map[from].filter((id) => id !== a.id), [to]: [...toList.slice(0, index), String(a.id), ...toList.slice(index)] };
    });
  }

  function finish() {
    setActive(null);
    setItems(null);
    lastOver.current = null;
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    const id = String(a.id);
    const status = find(id);
    const task = byId.get(id);
    if (!status || !over || !task) return finish();
    let list = currentRef.current[status];
    if (find(over.id) === status && !isStatus(over.id)) {
      const from = list.indexOf(id);
      const to = list.indexOf(String(over.id));
      if (from >= 0 && to >= 0 && from !== to) list = arrayMove(list, from, to);
    }
    // Neighbours among all your tasks in that column (filters may hide some).
    const all = store.tasks.filter((x) => x.status === status && x.id !== id).sort(byPlace);
    const at = list.indexOf(id);
    const before = list[at - 1] ? byId.get(list[at - 1]) : undefined;
    const after = list[at + 1] ? byId.get(list[at + 1]) : undefined;
    const index = before ? all.findIndex((x) => x.id === before.id) + 1 : after ? Math.max(0, all.findIndex((x) => x.id === after.id)) : all.length;
    const was = store.tasks.filter((x) => x.status === status).sort(byPlace).findIndex((x) => x.id === id);
    if (task.status !== status || was !== index) {
      const prev = all[index - 1];
      const next = all[index];
      if (tooClose(prev?.position, next?.position) || (prev && next && prev.position === next.position)) {
        const order = [...all.slice(0, index), task, ...all.slice(index)];
        const positions = spacedPositions(order.length);
        order.forEach((x, i) => {
          if (x.id === id || x.position !== positions[i]) void store.move(x.id, status, positions[i]);
        });
      } else {
        void store.move(id, status, positionBetween(prev?.position, next?.position));
      }
    }
    finish();
  }

  const label = (s: TaskStatus | null) => (s ? t.status[s] : "");
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => t.dnd.picked(byId.get(String(a.id))?.title ?? ""),
    onDragOver: ({ active: a, over }) => (over ? t.dnd.over(byId.get(String(a.id))?.title ?? "", label(find(over.id))) : undefined),
    onDragEnd: ({ active: a, over }) => t.dnd.dropped(byId.get(String(a.id))?.title ?? "", over ? label(find(over.id)) : ""),
    onDragCancel: ({ active: a }) => t.dnd.cancelled(byId.get(String(a.id))?.title ?? ""),
  };

  const activeTask = active ? byId.get(active) : undefined;
  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active: a }) => {
        setActive(String(a.id));
        setItems(base);
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.dnd.instructions } }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            ids={current[status]}
            byId={byId}
            store={store}
            subjects={subjects}
            now={now}
            dragging={!!active}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeTask ? (
          <div className="w-[280px]">
            <PersonalCardFace task={activeTask} subjects={subjects} now={now} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  ids,
  byId,
  store,
  subjects,
  now,
  dragging,
}: {
  status: TaskStatus;
  ids: string[];
  byId: Map<string, Task>;
  store: TaskStore;
  subjects: Subject[];
  now: number | null;
  dragging: boolean;
}) {
  const t = useMessages(tasksText);
  const { setNodeRef } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState(false);
  const limit = status === "done" && !all ? 12 : Infinity;
  const shown = ids.slice(0, limit);
  return (
    <section
      ref={setNodeRef}
      aria-label={t.status[status]}
      className="flex min-h-[180px] w-[82vw] max-w-[320px] shrink-0 flex-col rounded-xl bg-hover/45 max-sm:snap-center sm:w-auto sm:max-w-none dark:bg-hover/35"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 pl-3 pr-1.5">
        <ColumnDot column={{ color: COLORS[status], done: status === "done" }} />
        <h3 className="text-[13px] font-semibold text-ink">{t.status[status]}</h3>
        <span className="text-[12px] tabular-nums text-ink-3">{ids.length}</span>
        {status === "done" && <span className="truncate text-[11.5px] text-ink-3 max-lg:hidden">· {t.doneBoardHint}</span>}
        {status !== "done" && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-8"
            aria-label={t.addToColumn}
            title={t.addToColumn}
          >
            <Plus className="size-4" />
          </button>
        )}
      </header>
      <div className="flex-1 px-2 pb-2">
        {adding && <InlineAdd status={status} store={store} subjects={subjects} onClose={() => setAdding(false)} first={byId.get(ids[0] ?? "")} />}
        <SortableContext items={shown} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {shown.map((id) => {
              const task = byId.get(id);
              return task ? <SortableTask key={id} task={task} store={store} subjects={subjects} now={now} /> : null;
            })}
          </div>
        </SortableContext>
        {ids.length > shown.length && (
          <button type="button" onClick={() => setAll(true)} className="mt-2 h-8 w-full rounded-lg text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink">
            {t.showOlderDone(ids.length - shown.length)}
          </button>
        )}
        {ids.length === 0 && !adding && (
          <div
            className={cn(
              "grid h-16 place-items-center rounded-[10px] border border-dashed text-[12px] transition-colors",
              dragging ? "border-blob/50 bg-blob-soft/40 text-blob-ink" : "border-line-2 text-ink-3",
            )}
          >
            {t.dropHere}
          </div>
        )}
      </div>
    </section>
  );
}

/** Type a task straight into a column (dates like "bis Freitag" are understood, as in quick add). */
function InlineAdd({ status, store, subjects, onClose, first }: { status: TaskStatus; store: TaskStore; subjects: Subject[]; onClose: () => void; first?: Task }) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const [value, setValue] = useState("");
  const top = useRef(first?.position ?? STEP);
  function submit() {
    const text = value.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, new Date(), { locale, isSubject: (tag) => !!matchSubject(tag, subjects) });
    const subject = parsed.subject ? matchSubject(parsed.subject, subjects) : null;
    top.current -= STEP;
    void store.add({ title: parsed.title || text, kind: parsed.kind, due_at: parsed.due_at, subject_id: subject?.id ?? null, status, position: top.current });
    setValue("");
  }
  return (
    <div className="mb-2 rounded-[10px] border border-blob/60 bg-raised p-2 shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)]">
      <input
        autoFocus
        value={value}
        maxLength={200}
        placeholder={t.placeholderShort}
        aria-label={t.addToColumn}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        onBlur={() => {
          submit();
          onClose();
        }}
        className="h-7 w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

function PersonalCardFace({
  task,
  subjects,
  now,
  overlay,
  dragging,
  editing,
  controls,
}: {
  task: Task;
  subjects: Subject[];
  now: number | null;
  overlay?: boolean;
  dragging?: boolean;
  editing?: React.ReactNode;
  controls?: { checkbox: React.ReactNode; due: React.ReactNode; subject: React.ReactNode };
}) {
  const subject = subjects.find((s) => s.id === task.subject_id);
  return (
    <CardFace
      title={editing ?? task.title}
      done={task.done}
      leading={controls?.checkbox ?? <span className="mt-0.5 size-4 shrink-0 rounded-[5px] border-[1.5px] border-line-2" />}
      now={now}
      overlay={overlay}
      dragging={dragging}
      extra={
        <>
          {task.kind !== "homework" && <KindBadge kind={task.kind} className={cn("h-[18px]", task.done && "opacity-60")} />}
          {controls?.due ?? (task.due_at && <DueChip due={task.due_at} now={now} done={task.done} className="-ml-0.5" />)}
          {controls?.subject ??
            (subject && (
              <span className="flex min-w-0 items-center gap-1.5 text-ink-3">
                <SubjectDot subject={subject} />
                <span className="truncate">{subject.name}</span>
              </span>
            ))}
        </>
      }
    />
  );
}

const SortableTask = memo(function SortableTask({ task, store, subjects, now }: { task: Task; store: TaskStore; subjects: Subject[]; now: number | null }) {
  const t = useMessages(tasksText);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id, attributes: { roleDescription: t.dnd.task } });
  const [editing, setEditing] = useState<string | null>(null);
  const subject = subjects.find((s) => s.id === task.subject_id);

  const save = () => {
    const v = (editing ?? "").trim();
    setEditing(null);
    if (v && v !== task.title) void store.update(task.id, { title: v });
  };

  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onMouseDown: (e: React.MouseEvent) => e.stopPropagation(), onTouchStart: (e: React.TouchEvent) => e.stopPropagation() };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="group"
      aria-label={task.title}
      onKeyDown={(e) => {
        if (e.key === "Enter" && editing === null && e.target === e.currentTarget) {
          e.preventDefault();
          setEditing(task.title);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      data-task={task.id}
      className="group/card relative touch-manipulation select-none rounded-[10px] outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-blob"
    >
      <PersonalCardFace
        task={task}
        subjects={subjects}
        now={now}
        dragging={isDragging}
        editing={
          editing !== null ? (
            <input
              autoFocus
              value={editing}
              maxLength={200}
              aria-label={t.taskTitle}
              {...stop}
              onChange={(e) => setEditing(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(null);
              }}
              className="-my-0.5 w-full rounded bg-surface px-1 text-[13.5px] text-ink shadow-[0_0_0_1.5px_var(--blob)] outline-none"
            />
          ) : (
            <span className={cn("relative", task.done && "line-through decoration-ink-3/60")} onDoubleClick={() => setEditing(task.title)}>
              {task.title}
            </span>
          )
        }
        controls={{
          checkbox: (
            <span className="-ml-0.5 -mt-[3px]" {...stop}>
              <TaskCheckbox checked={task.done} onChange={(d) => void store.setDone(task.id, d)} size={16} label={task.done ? t.markNotDone(task.title) : t.markDone(task.title)} />
            </span>
          ),
          due: (
            <DuePicker
              value={task.due_at}
              kind={task.kind}
              align="start"
              onChange={(due_at) => void store.update(task.id, { due_at })}
              trigger={(props) =>
                task.due_at ? (
                  <button {...props} {...stop} className="-ml-1 rounded-md hover:bg-hover aria-expanded:bg-hover" title={t.addDueDate}>
                    <DueChip due={task.due_at} now={now} done={task.done} />
                  </button>
                ) : (
                  <button {...props} {...stop} className="hidden h-5 items-center rounded-md px-1 text-ink-3 hover:bg-hover hover:text-ink group-hover/card:flex aria-expanded:flex [@media(hover:none)]:flex">
                    {t.date}
                  </button>
                )
              }
            />
          ),
          subject: (
            <SubjectPicker
              value={task.subject_id}
              subjects={subjects}
              align="start"
              onChange={(subject_id) => void store.update(task.id, { subject_id })}
              trigger={(props) => (
                <button
                  {...props}
                  {...stop}
                  className={cn(
                    "flex h-5 min-w-0 max-w-[140px] items-center gap-1.5 rounded-md px-1 text-ink-3 hover:bg-hover hover:text-ink",
                    !subject && "hidden group-hover/card:flex aria-expanded:flex [@media(hover:none)]:flex",
                  )}
                  title={subject ? t.subjectIs(subject.name) : t.addSubject}
                >
                  <SubjectDot subject={subject} />
                  <span className="truncate">{subject ? subject.name : t.subject}</span>
                </button>
              )}
            />
          ),
        }}
      />
      <div className="absolute right-1.5 top-1.5" {...stop}>
        <Popover
          align="end"
          className="w-[200px]"
          trigger={(props) => (
            <button
              {...props}
              className="grid size-7 place-items-center rounded-md bg-raised/90 text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/card:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={t.taskOptions}
              title={t.taskOptions}
            >
              <Ellipsis className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Pencil />}
                onSelect={() => {
                  close();
                  setEditing(task.title);
                }}
              >
                {t.rename}
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>{t.type}</MenuLabel>
              <KindOptions
                value={task.kind}
                onChange={(kind) => {
                  void store.update(task.id, { kind });
                  close();
                }}
              />
              <MenuSeparator />
              {STATUSES.filter((s) => s !== task.status).map((s) => (
                <MenuItem
                  key={s}
                  icon={s === "done" ? <Check /> : <ColumnDot column={{ color: COLORS[s], done: false }} />}
                  onSelect={() => {
                    close();
                    const top = store.tasks.filter((x) => x.status === s).sort(byPlace)[0];
                    void store.move(task.id, s, positionBetween(null, top?.position));
                  }}
                >
                  {t.status[s]}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 />}
                danger
                onSelect={() => {
                  close();
                  void store.remove(task.id);
                }}
              >
                {t.deleteTask}
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
});
