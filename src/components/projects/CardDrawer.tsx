"use client";

import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, formatDistanceStrict } from "date-fns";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import {
  CalendarDays,
  ChevronDown,
  Ellipsis,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  GripVertical,
  Link2,
  Paperclip,
  Plus,
  Presentation,
  Search,
  Signal,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { Avatar, personName, type Person } from "@/components/share/Avatar";
import { PageIcon } from "@/components/shell/Sidebar";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { DuePicker } from "@/components/tasks/pickers";
import { IconButton } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { projectsText } from "@/i18n/messages/projects";
import { MAX_FILE_BYTES, fileKind, fileUrl, formatSize, removeUnusedFiles, uploadFile } from "@/lib/files";
import { formatDueLong } from "@/lib/tasks";
import type { Attachment, ChecklistItem, PageMeta, Task } from "@/lib/types";
import { cn, pageTitle, uid } from "@/lib/utils";
import { DueChip } from "./CardFace";
import { restrictToVerticalAxis } from "./dndModifiers";
import { MAX_ATTACHMENTS, checklistProgress, projectLabels, type AttachmentChange, type ChecklistChange } from "./model";
import { AssigneeMenu, ColumnDot, ColumnMenu, LabelChip, LabelMenu, PriorityIcon, PriorityMenu, parseLabels } from "./pickers";
import { RichText, toggleTodo } from "./RichText";
import type { Board } from "./useBoard";

/** Grow a textarea with its text. */
function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

const PHONE = "(max-width: 639px)";
const subscribePhone = (fn: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
/** Phone-sized screen (the drawer becomes a bottom sheet). False on the server. */
function usePhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

/**
 * Everything about one card: a panel on the right of the board (a sheet from the bottom on phones).
 * Title, status, people, due date, priority, labels, description, checklist and attachments; every
 * change saves at once (text after a short pause) and appears live for everyone on the board.
 */
export function CardDrawer({
  board,
  cardId,
  onClose,
  readOnly,
  now,
  meId,
}: {
  board: Board;
  cardId: string | null;
  onClose: () => void;
  readOnly: boolean;
  now: number | null;
  meId: string;
}) {
  const card = cardId ? board.cards.find((c) => c.id === cardId) : undefined;
  const phone = usePhone();

  // Tell the others which card you're looking at. (focus changes with every presence update, so it
  // is read through a ref: re-sending it on each update would make presence ping-pong.)
  const focusRef = useRef(board.focus);
  useEffect(() => {
    focusRef.current = board.focus;
  });
  const focusId = card?.id ?? null;
  useEffect(() => {
    focusRef.current(focusId);
  }, [focusId]);
  useEffect(() => () => focusRef.current(null), []);

  useEffect(() => {
    if (!cardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardId, onClose]);

  return (
    <AnimatePresence>
      {card && (
        <>
          {phone && (
            <motion.div
              key="scrim"
              className="fixed inset-0 z-[55] bg-[rgb(20_18_14/0.32)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}
          <Panel key="panel" phone={phone} onClose={onClose}>
            <CardDetails key={card.id} board={board} card={card} onClose={onClose} readOnly={readOnly} now={now} meId={meId} />
          </Panel>
        </>
      )}
    </AnimatePresence>
  );
}

function Panel({ phone, onClose, children }: { phone: boolean; onClose: () => void; children: ReactNode }) {
  const controls = useDragControls();
  if (phone) {
    return (
      <motion.aside
        role="dialog"
        aria-modal="false"
        className="fixed inset-x-0 bottom-0 z-[56] flex h-[92dvh] flex-col overflow-hidden rounded-t-2xl border-t border-line bg-raised shadow-pop"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center" onPointerDown={(e) => controls.start(e)} aria-hidden>
          <span className="h-1 w-10 rounded-full bg-line-2" />
        </div>
        {children}
      </motion.aside>
    );
  }
  return (
    <motion.aside
      role="dialog"
      aria-modal="false"
      className="absolute inset-y-0 right-0 z-30 flex w-[min(468px,100%)] flex-col border-l border-line bg-raised shadow-[-12px_0_32px_-16px_rgb(0_0_0/0.18)]"
      initial={{ x: 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 28, opacity: 0, transition: { duration: 0.14 } }}
      transition={{ type: "spring", stiffness: 520, damping: 42 }}
    >
      {children}
    </motion.aside>
  );
}

function CardDetails({ board, card, onClose, readOnly, now, meId }: { board: Board; card: Task; onClose: () => void; readOnly: boolean; now: number | null; meId: string }) {
  const t = useMessages(projectsText);
  const d = t.drawer;
  const locale = useLocale();
  const column = board.columns.find((c) => c.id === card.column_id) ?? board.columns[0];
  const people = new Map<string, Person>(board.members.map((m) => [m.user_id, m]));
  const assignees = card.assignees.map((id) => people.get(id)).filter((p): p is Person => !!p);
  const labels = parseLabels(card.labels);
  const known = projectLabels(board.cards);
  const watchers = board.peers.filter((p) => p.focus === card.id && p.user_id !== meId);
  const creator = people.get(card.user_id);
  const update = (patch: Parameters<Board["updateCard"]>[1]) => void board.updateCard(card.id, patch);
  const [dropping, setDropping] = useState(false);
  const uploader = useRef<{ upload: (files: FileList | File[]) => void }>(null);

  function copyLink() {
    const url = `${window.location.origin}/projects/${board.project.id}?card=${card.id}`;
    navigator.clipboard?.writeText(url);
    blob.say(d.linkCopied, { mood: "happy" });
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (readOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
      }}
      onDrop={(e) => {
        if (readOnly || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropping(false);
        uploader.current?.upload(e.dataTransfer.files);
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line pl-4 pr-2 max-sm:h-11">
        <ColumnMenu
          value={column?.id ?? null}
          columns={board.columns}
          onChange={(id) => {
            if (id === card.column_id) return;
            const count = board.cards.filter((c) => c.column_id === id).length;
            void board.moveCard(card.id, id, count);
          }}
          trigger={(props) => (
            <button
              {...props}
              disabled={readOnly}
              className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-line px-2 text-[12.5px] font-medium text-ink-2 hover:border-line-2 hover:text-ink disabled:pointer-events-none [@media(hover:none)]:h-9"
            >
              {column && <ColumnDot column={column} />}
              <span className="truncate">{column?.title}</span>
              {!readOnly && <ChevronDown className="size-3.5 text-ink-3" />}
            </button>
          )}
        />
        {watchers.length > 0 && (
          <span className="ml-1 flex items-center gap-1 text-[12px] text-ink-3" title={d.lookingToo(watchers.map((w) => w.name).join(", "))}>
            {watchers.slice(0, 3).map((w) => (
              <Avatar key={w.key} person={w} size={20} ring />
            ))}
          </span>
        )}
        {readOnly && <span className="ml-1 rounded-full bg-hover px-2 py-0.5 text-[11.5px] text-ink-2">{d.readOnly}</span>}
        <span className="ml-auto" />
        <Popover
          align="end"
          className="w-[220px]"
          trigger={(props) => (
            <IconButton {...props} label={d.options}>
              <Ellipsis className="size-4" />
            </IconButton>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Link2 />}
                onSelect={() => {
                  copyLink();
                  close();
                }}
              >
                {d.copyLink}
              </MenuItem>
              {!readOnly && (
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={() => {
                    close();
                    onClose();
                    void board.deleteCard(card.id);
                  }}
                >
                  {d.delete}
                </MenuItem>
              )}
            </>
          )}
        </Popover>
        <IconButton label={d.close} onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-4 max-sm:px-4">
        <TitleField card={card} readOnly={readOnly} onSave={(title) => update({ title })} />

        <dl className="mt-4 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-[13px] max-sm:grid-cols-[92px_minmax(0,1fr)]">
          <Prop icon={Users} label={d.assignees}>
            <AssigneeMenu
              value={card.assignees}
              members={board.members}
              me={meId}
              onChange={(assignees) => update({ assignees })}
              trigger={(props) => (
                <PropButton {...props} disabled={readOnly}>
                  {assignees.length ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {assignees.map((p) => (
                        <span key={p.user_id} className="flex min-w-0 items-center gap-1.5">
                          <Avatar person={p} size={20} />
                          <span className="truncate">{p.user_id === meId ? t.you : personName(p)}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-ink-3">{readOnly ? d.nobody : d.assign}</span>
                  )}
                </PropButton>
              )}
            />
          </Prop>
          <Prop icon={CalendarDays} label={d.due}>
            <DuePicker
              value={card.due_at}
              kind="project"
              align="start"
              onChange={(due_at) => update({ due_at })}
              trigger={(props) => (
                <PropButton {...props} disabled={readOnly} title={card.due_at ? formatDueLong(card.due_at, locale) : undefined}>
                  {card.due_at ? <DueChip due={card.due_at} now={now} done={card.done} className="-ml-1.5" /> : <span className="text-ink-3">{d.noDue}</span>}
                </PropButton>
              )}
            />
          </Prop>
          <Prop icon={Signal} label={d.priority}>
            <PriorityMenu
              value={card.priority}
              onChange={(priority) => update({ priority })}
              trigger={(props) => (
                <PropButton {...props} disabled={readOnly}>
                  <PriorityIcon priority={card.priority} />
                  <span className={cn(card.priority === 0 && "text-ink-3")}>{t.priorityNames[card.priority]}</span>
                </PropButton>
              )}
            />
          </Prop>
          <Prop icon={Tag} label={d.labels}>
            <div className="flex min-h-8 flex-wrap items-center gap-1 py-1">
              {labels.map((l) => (
                <LabelChip
                  key={l.raw}
                  label={l}
                  onRemove={readOnly ? undefined : () => update({ labels: card.labels.filter((raw) => raw !== l.raw) })}
                  removeLabel={`${d.remove}: ${l.name}`}
                />
              ))}
              {!readOnly && (
                <LabelMenu
                  value={card.labels}
                  known={known}
                  onChange={(next) => update({ labels: next })}
                  trigger={(props) => (
                    <button
                      {...props}
                      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink aria-expanded:bg-hover [@media(hover:none)]:h-8"
                    >
                      <Plus className="size-3.5" /> {labels.length ? "" : d.addLabel}
                      {labels.length > 0 && <span className="sr-only">{d.addLabel}</span>}
                    </button>
                  )}
                />
              )}
              {readOnly && !labels.length && <span className="px-1.5 text-ink-3">–</span>}
            </div>
          </Prop>
        </dl>

        <Section title={d.description}>
          <DescriptionField card={card} readOnly={readOnly} onSave={(details) => update({ details })} />
        </Section>

        <Checklist card={card} readOnly={readOnly} onChange={(change) => board.changeChecklist(card.id, change)} />

        <Attachments ref={uploader} card={card} projectId={board.project.id} readOnly={readOnly} onChange={(change) => board.changeAttachments(card.id, change)} />

        <footer className="mt-8 space-y-0.5 border-t border-line pt-3 text-[11.5px] text-ink-3" suppressHydrationWarning>
          <p>{d.created(creator ? personName(creator, d.someone) : d.someone, format(new Date(card.created_at), "PPp", { locale: dateLocale(locale) }))}</p>
          {now && card.updated_at !== card.created_at && (
            <p>
              {d.updated(
                now - new Date(card.updated_at).getTime() < 60_000
                  ? d.justNow
                  : formatDistanceStrict(new Date(card.updated_at), now, { addSuffix: true, locale: dateLocale(locale) }),
              )}
            </p>
          )}
        </footer>
      </div>

      <AnimatePresence>
        {dropping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-blob bg-blob-soft/80 text-[14px] font-medium text-blob-ink"
          >
            <span className="flex items-center gap-2">
              <Upload className="size-5" /> {d.dropFiles}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Prop({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex h-8 items-center gap-2 self-start text-ink-3">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function PropButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "-ml-1.5 flex min-h-8 w-[calc(100%+6px)] min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-ink transition-colors hover:bg-hover aria-expanded:bg-hover disabled:pointer-events-none [@media(hover:none)]:min-h-10",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[12.5px] font-semibold text-ink-2">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Title and description: local while typing, saved after a pause and on blur
   --------------------------------------------------------------------------- */

function useDraft(remote: string, save: (value: string) => void, delay = 700) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveRef = useRef(save);
  const draftRef = useRef<string | null>(null);
  useEffect(() => {
    saveRef.current = save;
  });
  const flush = () => {
    clearTimeout(timer.current);
    const v = draftRef.current;
    if (v !== null && v !== remote) saveRef.current(v);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (draftRef.current !== null) saveRef.current(draftRef.current);
    },
    [],
  );
  return {
    value: draft ?? remote,
    editing: draft !== null,
    change(v: string) {
      setDraft(v);
      draftRef.current = v;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (draftRef.current !== null) saveRef.current(draftRef.current);
      }, delay);
    },
    start() {
      setDraft(remote);
      draftRef.current = remote;
    },
    stop() {
      flush();
      setDraft(null);
      draftRef.current = null;
    },
  };
}

function TitleField({ card, readOnly, onSave }: { card: Task; readOnly: boolean; onSave: (title: string) => void }) {
  const t = useMessages(projectsText).drawer;
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft = useDraft(card.title, (v) => v.trim() && onSave(v.replace(/\s+/g, " ")));
  useAutosize(ref, draft.value);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft.value}
      readOnly={readOnly}
      maxLength={200}
      aria-label={t.titlePlaceholder}
      placeholder={t.titlePlaceholder}
      onFocus={() => !readOnly && draft.start()}
      onChange={(e) => draft.change(e.target.value.replace(/\n/g, " "))}
      onBlur={() => draft.stop()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "-mx-1.5 block w-[calc(100%+12px)] resize-none overflow-hidden rounded-lg bg-transparent px-1.5 py-1 font-display text-[21px] font-bold leading-snug tracking-[-0.015em] text-ink outline-none transition-colors placeholder:text-ink-3",
        !readOnly && "hover:bg-hover/60 focus:bg-hover/60",
        card.done && "text-ink-2",
      )}
    />
  );
}

function DescriptionField({ card, readOnly, onSave }: { card: Task; readOnly: boolean; onSave: (details: string) => void }) {
  const t = useMessages(projectsText).drawer;
  const ref = useRef<HTMLTextAreaElement>(null);
  const remote = card.details ?? "";
  const draft = useDraft(remote, onSave);
  useAutosize(ref, draft.value);

  if (!draft.editing) {
    if (!remote.trim()) {
      return readOnly ? (
        <p className="text-[13px] text-ink-3">–</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            draft.start();
            requestAnimationFrame(() => ref.current?.focus());
          }}
          className="-mx-1.5 flex min-h-16 w-[calc(100%+12px)] items-start rounded-lg px-1.5 py-1.5 text-left text-[13.5px] text-ink-3 transition-colors hover:bg-hover/60"
        >
          {t.descriptionPlaceholder}
        </button>
      );
    }
    return (
      <div
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        aria-label={readOnly ? undefined : `${t.edit}: ${t.description}`}
        onClick={(e) => {
          if (readOnly || (e.target as HTMLElement).closest("a,input")) return;
          draft.start();
          requestAnimationFrame(() => ref.current?.focus());
        }}
        onKeyDown={(e) => {
          if (!readOnly && e.key === "Enter") {
            e.preventDefault();
            draft.start();
            requestAnimationFrame(() => ref.current?.focus());
          }
        }}
        className={cn("-mx-1.5 rounded-lg px-1.5 py-1", !readOnly && "cursor-text transition-colors hover:bg-hover/60")}
      >
        <RichText text={remote} onToggle={readOnly ? undefined : (line) => onSave(toggleTodo(remote, line))} />
      </div>
    );
  }
  return (
    <div>
      <textarea
        ref={ref}
        value={draft.value}
        maxLength={8000}
        rows={3}
        placeholder={t.descriptionPlaceholder}
        onChange={(e) => draft.change(e.target.value)}
        onBlur={() => draft.stop()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        className="-mx-1.5 block min-h-20 w-[calc(100%+12px)] resize-none overflow-hidden rounded-lg border border-blob/60 bg-surface px-2 py-1.5 text-[13.5px] leading-[1.6] text-ink outline-none shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)] placeholder:text-ink-3"
      />
      <p className="mt-1 font-mono text-[11px] text-ink-3">{t.formatHint}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Checklist
   --------------------------------------------------------------------------- */

function Checklist({ card, readOnly, onChange }: { card: Task; readOnly: boolean; onChange: (change: ChecklistChange) => void }) {
  // dnd-kit numbers its screen reader hints; React's id is the same on the server and in the browser.
  const dndId = useId();
  const t = useMessages(projectsText).drawer;
  const list = card.checklist;
  const { done, total } = checklistProgress(list);
  const [value, setValue] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function add() {
    const text = value.trim().slice(0, 200);
    if (!text || list.length >= 100) return;
    onChange({ op: "add", item: { id: uid(), text, done: false } });
    setValue("");
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = list.findIndex((i) => i.id === active.id);
    const to = list.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    // Sent as "after this item", which still means the same place if someone changed the list meanwhile.
    const order = arrayMove(list, from, to);
    onChange({ op: "move", id: String(active.id), after: order[to - 1]?.id ?? null, index: to });
  }

  if (readOnly && !total) return null;
  return (
    <Section
      title={t.checklist}
      aside={
        total > 0 && (
          <span className="flex flex-1 items-center gap-2">
            <span className={cn("text-[11.5px] tabular-nums", done === total ? "text-ok" : "text-ink-3")}>
              {done}/{total}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-hover">
              <motion.span
                className={cn("block h-full rounded-full", done === total ? "bg-ok" : "bg-blob")}
                initial={false}
                animate={{ width: `${(done / total) * 100}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </span>
          </span>
        )
      }
    >
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="-mx-1.5">
            {list.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                readOnly={readOnly}
                onToggle={(done) => onChange({ op: "set", id: item.id, done })}
                onText={(text) => onChange({ op: "set", id: item.id, text })}
                onDelete={() => onChange({ op: "remove", id: item.id })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {!readOnly && (
        <div className="-mx-1.5 flex h-9 items-center gap-2 rounded-lg px-1.5 focus-within:bg-hover/60 [@media(hover:none)]:h-11">
          <Plus className="mx-[3px] size-4 shrink-0 text-ink-3" />
          <input
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={t.addItem}
            aria-label={t.addItem}
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
      )}
    </Section>
  );
}

function ChecklistRow({
  item,
  readOnly,
  onToggle,
  onText,
  onDelete,
}: {
  item: ChecklistItem;
  readOnly: boolean;
  onToggle: (done: boolean) => void;
  onText: (text: string) => void;
  onDelete: () => void;
}) {
  const t = useMessages(projectsText).drawer;
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled: readOnly });
  const [text, setText] = useState<string | null>(null);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/item relative flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 hover:bg-hover/60 [@media(hover:none)]:min-h-11",
        isDragging && "z-10 bg-raised shadow-pop",
      )}
    >
      {!readOnly && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t.dragItem}
          className="absolute -left-3.5 grid h-7 w-4 cursor-grab touch-none place-items-center rounded text-ink-3 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:hidden"
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <TaskCheckbox checked={item.done} onChange={readOnly ? () => {} : onToggle} size={16} label={item.text} />
      <input
        value={text ?? item.text}
        readOnly={readOnly}
        maxLength={200}
        aria-label={t.itemPlaceholder}
        onFocus={() => setText(item.text)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = (text ?? "").trim();
          setText(null);
          if (v && v !== item.text) onText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setText(item.text);
            e.currentTarget.blur();
          }
        }}
        className={cn("h-8 min-w-0 flex-1 bg-transparent text-[13.5px] outline-none transition-colors", item.done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}
      />
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.deleteItem}
          title={t.deleteItem}
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-danger focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:size-9 [@media(hover:none)]:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------------------
   Attachments
   --------------------------------------------------------------------------- */

const FILE_ICON: Record<ReturnType<typeof fileKind>, LucideIcon> = {
  image: FileImage,
  pdf: FileText,
  audio: FileAudio,
  video: FileVideo,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  archive: FileArchive,
  text: FileText,
  other: Paperclip,
};

/** Signed links for image previews, so reopening a card doesn't ask again (they last an hour). */
const previewCache = new Map<string, Promise<string | null>>();

function Attachments({
  card,
  projectId,
  readOnly,
  onChange,
  ref,
}: {
  card: Task;
  projectId: string;
  readOnly: boolean;
  /** Saves one change; the list the server saved, or null when it wasn't saved. */
  onChange: (change: AttachmentChange) => Promise<Attachment[] | null>;
  ref: React.Ref<{ upload: (files: FileList | File[]) => void }>;
}) {
  const t = useMessages(projectsText).drawer;
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef(card.attachments);
  useEffect(() => {
    listRef.current = card.attachments;
  });
  const list = card.attachments;

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (listRef.current.length >= MAX_ATTACHMENTS) break;
      if (file.size > MAX_FILE_BYTES) {
        blob.say(t.fileTooBig, { mood: "worried" });
        continue;
      }
      const temp = { id: uid(), name: file.name };
      setUploading((u) => [...u, temp]);
      const stored = await uploadFile({ type: "project", id: projectId }, file);
      setUploading((u) => u.filter((x) => x.id !== temp.id));
      if (!stored) {
        blob.say(t.uploadFailed, { mood: "worried" });
        blob.react("shake", "worried");
        continue;
      }
      const item = { id: uid(), type: "file" as const, ...stored };
      listRef.current = [...listRef.current, item];
      void onChange({ op: "add", item }).then((saved) => {
        // It didn't make it onto the card (not saved, or the card is full or gone): nothing refers to the upload.
        if (!saved?.some((a) => a.id === item.id)) void removeUnusedFiles("project", projectId, { minAge: "0 seconds", only: [item.path] });
      });
    }
  }

  // The drawer passes dropped files here.
  useImperativeHandle(ref, () => ({ upload }));

  async function remove(a: Attachment) {
    const saved = await onChange({ op: "remove", id: a.id });
    // The file goes once the card as saved no longer lists it, and only if no other card or note refers to it.
    if (saved && a.type === "file") void removeUnusedFiles("project", projectId, { minAge: "0 seconds", only: [a.path] });
  }

  if (readOnly && !list.length) return null;
  return (
    <Section title={t.attachments} aside={list.length > 0 && <span className="text-[11.5px] tabular-nums text-ink-3">{list.length}</span>}>
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((a) => (
            <li key={a.id}>
              <AttachmentRow attachment={a} readOnly={readOnly} onRemove={() => remove(a)} />
            </li>
          ))}
        </ul>
      )}
      {uploading.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {uploading.map((u) => (
            <li key={u.id} className="flex h-12 items-center gap-3 rounded-xl border border-dashed border-line-2 px-3 text-[12.5px] text-ink-2">
              <span className="size-4 animate-spin rounded-full border-2 border-blob border-t-transparent" />
              <span className="truncate">{t.uploading(u.name)}</span>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && list.length < MAX_ATTACHMENTS && (
        <div className={cn("flex flex-wrap gap-1.5", (list.length > 0 || uploading.length > 0) && "mt-2")}>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <AddButton icon={Upload} onClick={() => input.current?.click()}>
            {t.attachFile}
          </AddButton>
          <PagePicker
            exclude={new Set(list.flatMap((a) => (a.type === "page" ? [a.page_id] : [])))}
            onPick={(page) => void onChange({ op: "add", item: { id: uid(), type: "page", page_id: page.id, title: page.title, kind: page.kind } })}
          />
          <LinkForm onAdd={(url, title) => void onChange({ op: "add", item: { id: uid(), type: "link", url, title } })} />
        </div>
      )}
    </Section>
  );
}

function AddButton({ icon: Icon, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink aria-expanded:border-line-2 aria-expanded:text-ink [@media(hover:none)]:h-10"
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function AttachmentRow({ attachment: a, readOnly, onRemove }: { attachment: Attachment; readOnly: boolean; onRemove: () => void }) {
  const t = useMessages(projectsText).drawer;
  const locale = useLocale();
  const { pages } = useWorkspace();
  const [preview, setPreview] = useState<string | null>(null);
  const kind = a.type === "file" ? fileKind(a.mime, a.name) : null;

  useEffect(() => {
    if (a.type !== "file" || kind !== "image") return;
    let live = true;
    const p = previewCache.get(a.path) ?? fileUrl(a.path);
    previewCache.set(a.path, p);
    void p.then((url) => live && setPreview(url));
    return () => {
      live = false;
    };
  }, [a, kind]);

  async function openFile(download?: boolean) {
    if (a.type !== "file") return;
    // Open the tab first (browsers block tabs opened after waiting), then send it to the signed link.
    const tab = download ? null : window.open("", "_blank");
    // Downloads take the name from the storage path: Storage mangles non-ASCII names ("Brüche" arrives
    // as "Br%C3%BCche"), the path has the readable ASCII spelling ("Brueche").
    const url = await fileUrl(a.path, download ? { download: true } : {});
    if (!url) {
      tab?.close();
      blob.say(t.uploadFailed, { mood: "worried" });
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      // In the page, so the Blob app sees the click too (it sends file links to the browser).
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  let icon: ReactNode;
  let title: string;
  let meta: string;
  let main: ReactNode;
  if (a.type === "page") {
    const page = pages.find((p) => p.id === a.page_id);
    icon = page ? <PageIcon page={page} className="size-4" /> : <FileText className="size-4 text-ink-3" />;
    title = page ? pageTitle(page.title, page.kind, locale) : pageTitle(a.title, a.kind, locale);
    meta = page ? "" : t.pageGone;
    main = page ? (
      <Link href={`/p/${a.page_id}`} className="absolute inset-0 rounded-xl" aria-label={`${t.openAttachment}: ${title}`} />
    ) : null;
  } else if (a.type === "link") {
    let host = a.url;
    try {
      host = new URL(a.url).hostname.replace(/^www\./, "");
    } catch {}
    icon = <Globe className="size-4 text-ink-3" />;
    title = a.title || host;
    meta = a.title ? host : "";
    main = <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="absolute inset-0 rounded-xl" aria-label={`${t.openAttachment}: ${title}`} />;
  } else {
    const Icon = FILE_ICON[kind ?? "other"];
    icon = preview ? (
      // eslint-disable-next-line @next/next/no-img-element -- signed link to a private file
      <img src={preview} alt="" className="size-8 rounded-md object-cover" />
    ) : (
      <Icon className="size-4 text-ink-3" />
    );
    title = a.name;
    meta = formatSize(a.size, locale);
    main = <button type="button" onClick={() => void openFile()} className="absolute inset-0 rounded-xl" aria-label={`${t.openAttachment}: ${title}`} />;
  }

  return (
    <div className="group/att relative flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-2.5 py-1.5 transition-colors hover:border-line-2">
      {main}
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-hover/70">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink" title={title}>
          {title}
        </span>
        {meta && <span className="block truncate text-[11.5px] text-ink-3">{meta}</span>}
      </span>
      <span className="relative flex shrink-0 items-center">
        {a.type === "file" && (
          <IconButton label={t.download} onClick={() => void openFile(true)} className="opacity-0 group-hover/att:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
            <ExternalLink className="size-3.5 rotate-90" />
          </IconButton>
        )}
        {a.type === "link" && <ExternalLink className="mx-1.5 size-3.5 text-ink-3" />}
        {!readOnly && (
          <IconButton
            label={t.remove}
            onClick={onRemove}
            className="opacity-0 hover:text-danger group-hover/att:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3.5" />
          </IconButton>
        )}
      </span>
    </div>
  );
}

function PagePicker({ exclude, onPick }: { exclude: Set<string>; onPick: (page: PageMeta) => void }) {
  const t = useMessages(projectsText).drawer;
  const locale = useLocale();
  const { pages } = useWorkspace();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = pages
    .filter((p) => (p.kind === "note" || p.kind === "deck" || p.kind === "folder") && !exclude.has(p.id))
    .filter((p) => !q || pageTitle(p.title, p.kind, locale).toLowerCase().includes(q))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 30);
  return (
    <Popover
      align="start"
      className="w-[280px]"
      role="dialog"
      label={t.attachPage}
      onOpenChange={(o) => !o && setQuery("")}
      trigger={(props) => (
        <AddButton {...props} icon={FileText}>
          {t.attachPage}
        </AddButton>
      )}
    >
      {(close) => (
        <div>
          <div className="relative p-0.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && list[0]) {
                  onPick(list[0]);
                  close();
                }
              }}
              placeholder={t.findPage}
              className="h-8 w-full rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none focus:border-blob"
            />
          </div>
          <div className="mt-1 max-h-[260px] overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p);
                  close();
                }}
                className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:h-10"
              >
                <PageIcon page={p} className="size-4" />
                <span className="truncate">{pageTitle(p.title, p.kind, locale)}</span>
              </button>
            ))}
            {list.length === 0 && <p className="px-2 py-1.5 text-[12.5px] text-ink-3">{t.noPages}</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}

function LinkForm({ onAdd }: { onAdd: (url: string, title: string) => void }) {
  const t = useMessages(projectsText).drawer;
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const clean = (() => {
    const v = url.trim();
    if (!v) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withScheme);
      return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      return null;
    }
  })();
  return (
    <Popover
      align="start"
      className="w-[300px] p-2.5"
      role="dialog"
      label={t.attachLink}
      onOpenChange={(o) => {
        if (!o) {
          setUrl("");
          setTitle("");
        }
      }}
      trigger={(props) => (
        <AddButton {...props} icon={Link2}>
          {t.attachLink}
        </AddButton>
      )}
    >
      {(close) => (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!clean) return;
            onAdd(clean, title.trim().slice(0, 200));
            close();
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.linkUrl}
            aria-label={t.linkUrl}
            inputMode="url"
            className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-blob"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.linkTitle}
            aria-label={t.linkTitle}
            maxLength={200}
            className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-blob"
          />
          <button
            type="submit"
            disabled={!clean}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-blob text-[13px] font-medium text-white transition-colors hover:bg-blob-deep disabled:opacity-50"
          >
            <Plus className="size-3.5" /> {t.add}
          </button>
        </form>
      )}
    </Popover>
  );
}

