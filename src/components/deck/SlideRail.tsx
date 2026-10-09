"use client";

import { ArrowLeft, ArrowRight, Copy, Ellipsis, Plus, Trash2 } from "lucide-react";
import { motion, Reorder } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { deckText } from "@/i18n/messages/deck";
import type { Slide, SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LAYOUT_GROUPS, LAYOUTS, type Palette } from "./deck";
import { LayoutGlyph } from "./LayoutGlyph";
import { SlideView } from "./SlideView";

const THUMB_W = 150;
/** Thumbnails in the phone filmstrip (the editor reserves room for it below the slide). */
const STRIP_W = 112;

/** Popover with a visual grid of layouts, grouped. */
export function AddSlideMenu({
  onAdd,
  trigger,
  side = "bottom",
  align = "start",
}: {
  onAdd: (layout: SlideLayout) => void;
  trigger: Parameters<typeof Popover>[0]["trigger"];
  side?: "bottom" | "top" | "right";
  align?: "start" | "end";
}) {
  const t = useMessages(deckText);
  return (
    <Popover side={side} align={align} className="w-[min(392px,calc(100vw-16px))] p-2" trigger={trigger}>
      {(close) => (
        <div className="space-y-1.5">
          {LAYOUT_GROUPS.map((g) => (
            <div key={g}>
              <div className="px-1.5 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.groups[g]}</div>
              <div className="grid grid-cols-5 gap-0.5">
                {LAYOUTS.filter((l) => l.group === g).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="menuitem"
                    title={t.layouts[l.id].hint}
                    onClick={() => {
                      onAdd(l.id);
                      close();
                    }}
                    className="group rounded-lg p-1.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <LayoutGlyph layout={l.id} className="group-hover:border-line-2" />
                    <div className="mt-1 truncate text-[11.5px] text-ink-2 group-hover:text-ink">{t.layouts[l.id].label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function SlideRail({
  className = "flex",
  slides,
  palette,
  sections,
  selectedId,
  onSelect,
  onReorder,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onEnter,
}: {
  className?: string;
  slides: Slide[];
  palette: Palette;
  sections: Map<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (slides: Slide[]) => void;
  onAdd: (layout: SlideLayout) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  onEnter: () => void;
}) {
  const t = useMessages(deckText);
  const listRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const index = Math.max(0, slides.findIndex((s) => s.id === selectedId));

  // Keep the selected thumbnail visible. Only the rail scrolls (scrollIntoView could move the whole panel).
  useEffect(() => {
    const list = listRef.current;
    const el = document.getElementById(`slide-thumb-${selectedId}`);
    if (!list || !el) return;
    const l = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < l.top + 8) list.scrollTop -= l.top + 8 - r.top;
    else if (r.bottom > l.bottom - 8) list.scrollTop += r.bottom - (l.bottom - 8);
  }, [selectedId]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLButtonElement && (e.key === "Enter" || e.key === " ")) return;
    const mod = e.metaKey || e.ctrlKey;
    let handled = true;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const delta = e.key === "ArrowUp" ? -1 : 1;
      if (e.altKey) onMove(selectedId, delta);
      else onSelect(slides[Math.min(slides.length - 1, Math.max(0, index + delta))].id);
    } else if (e.key === "Home") onSelect(slides[0].id);
    else if (e.key === "End") onSelect(slides[slides.length - 1].id);
    else if (e.key === "Delete" || e.key === "Backspace") onDelete(selectedId);
    else if (mod && e.key.toLowerCase() === "d") onDuplicate(selectedId);
    else if (e.key === "Enter") onEnter();
    else handled = false;
    if (handled) e.preventDefault();
  };

  return (
    <aside className={cn("w-[206px] shrink-0 flex-col border-r border-line bg-surface", className)} aria-label={t.slides}>
      <div className="flex h-10 shrink-0 items-center gap-1.5 pl-4 pr-2">
        <span className="text-[12.5px] font-medium text-ink-2">{t.slides}</span>
        <span className="text-[12px] tabular-nums text-ink-3">{slides.length}</span>
        <div className="ml-auto">
          <AddSlideMenu
            onAdd={onAdd}
            trigger={(props) => (
              <button
                {...props}
                className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink"
                aria-label={t.addSlide}
                title={t.addSlide}
              >
                <Plus className="size-4" />
              </button>
            )}
          />
        </div>
      </div>

      <motion.div
        ref={listRef}
        layoutScroll
        tabIndex={0}
        role="listbox"
        aria-label={t.slides}
        aria-activedescendant={`slide-thumb-${selectedId}`}
        onKeyDown={onKeyDown}
        style={{ outline: "none" }}
        className="group/rail min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-1 outline-none"
      >
        <Reorder.Group as="div" axis="y" values={slides} onReorder={onReorder} className="flex flex-col gap-2.5">
          {slides.map((slide, i) => {
            const selected = slide.id === selectedId;
            return (
              <Reorder.Item
                as="div"
                key={slide.id}
                value={slide}
                id={`slide-thumb-${slide.id}`}
                role="option"
                aria-selected={selected}
                aria-label={t.slideAria(i + 1, slide.title.trim())}
                onDragStart={() => setDragging(slide.id)}
                onDragEnd={() => setDragging(null)}
                whileDrag={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 600, damping: 40 }}
                onClick={() => {
                  onSelect(slide.id);
                  listRef.current?.focus({ preventScroll: true });
                }}
                className="group relative flex cursor-grab select-none items-start gap-2 active:cursor-grabbing"
              >
                <span
                  className={cn(
                    "w-[16px] shrink-0 pt-0.5 text-right text-[11.5px] tabular-nums transition-colors",
                    selected ? "font-semibold text-blob-ink" : "text-ink-3",
                  )}
                >
                  {i + 1}
                </span>
                <div
                  className={cn(
                    "relative rounded-[7px] outline-offset-2 transition-[outline-color,box-shadow]",
                    selected ? "outline-2 outline-blob" : "outline-1 outline-transparent group-hover:outline-line-2",
                    dragging === slide.id && "shadow-pop",
                  )}
                >
                  <SlideView
                    slide={slide}
                    palette={palette}
                    ordinal={sections.get(slide.id)}
                    mode="thumb"
                    width={THUMB_W}
                    frameClassName="rounded-[7px] ring-1 ring-ink/10 dark:ring-white/12"
                  />
                  <div
                    className={cn(
                      "absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                      selected && "[@media(hover:none)]:opacity-100",
                    )}
                  >
                    <ThumbAction label={t.duplicateSlide} onClick={() => onDuplicate(slide.id)}>
                      <Copy />
                    </ThumbAction>
                    <ThumbAction
                      label={slides.length === 1 ? t.lastSlide : t.deleteSlide}
                      disabled={slides.length === 1}
                      danger
                      onClick={() => onDelete(slide.id)}
                    >
                      <Trash2 />
                    </ThumbAction>
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <AddSlideMenu
          onAdd={onAdd}
          side="right"
          trigger={(props) => (
            <button
              {...props}
              className="ml-6 mt-2.5 flex h-9 w-[150px] items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-line-2 text-[12.5px] text-ink-3 transition-colors hover:border-ink-3 hover:bg-hover/60 hover:text-ink"
            >
              <Plus className="size-3.5" /> {t.newSlide}
            </button>
          )}
        />
      </motion.div>
    </aside>
  );
}

function ThumbAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-6 place-items-center rounded-md border border-line bg-raised text-ink-2 shadow-card transition-colors hover:text-ink disabled:opacity-40 [&_svg]:size-3.5",
        danger && "hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Phones: the slides as a horizontal filmstrip under the canvas (the rail needs more width).
 * Tap to select; the last tile adds a slide.
 */
export function SlideStrip({
  className,
  slides,
  palette,
  sections,
  selectedId,
  onSelect,
  onAdd,
}: {
  className?: string;
  slides: Slide[];
  palette: Palette;
  sections: Map<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (layout: SlideLayout) => void;
}) {
  const t = useMessages(deckText);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected slide in view. Only the strip scrolls.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-slide-id="${selectedId}"]`);
    if (!list || !el) return;
    const l = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < l.left) list.scrollLeft -= l.left - r.left + 4;
    else if (r.right > l.right) list.scrollLeft += r.right - l.right + 4;
  }, [selectedId, slides.length]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={t.slides}
      aria-orientation="horizontal"
      className={cn("-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {slides.map((slide, i) => {
        const selected = slide.id === selectedId;
        return (
          <button
            key={slide.id}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={t.slideAria(i + 1, slide.title.trim())}
            data-slide-id={slide.id}
            onClick={() => onSelect(slide.id)}
            className="shrink-0 text-left"
          >
            <div className={cn("rounded-[7px] outline-offset-2", selected ? "outline-2 outline-blob" : "outline-1 outline-transparent")}>
              <SlideView
                slide={slide}
                palette={palette}
                ordinal={sections.get(slide.id)}
                mode="thumb"
                width={STRIP_W}
                frameClassName="rounded-[7px] ring-1 ring-ink/10 dark:ring-white/12"
              />
            </div>
            <div className={cn("mt-1 text-[11.5px] tabular-nums", selected ? "font-semibold text-blob-ink" : "text-ink-3")}>{i + 1}</div>
          </button>
        );
      })}
      <AddSlideMenu
        onAdd={onAdd}
        align="end"
        side="top"
        trigger={(props) => (
          <button
            {...props}
            className="grid aspect-video shrink-0 place-items-center rounded-[7px] border border-dashed border-line-2 text-ink-3 transition-colors hover:border-ink-3 hover:text-ink"
            style={{ width: STRIP_W }}
            aria-label={t.addSlide}
            title={t.addSlide}
          >
            <Plus className="size-4" />
          </button>
        )}
      />
    </div>
  );
}

/** Phones: duplicate, move and delete the current slide (the rail's hover actions and shortcuts need a mouse). */
export function SlideMenu({
  index,
  total,
  onDuplicate,
  onMove,
  onDelete,
}: {
  index: number;
  total: number;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const t = useMessages(deckText);
  return (
    <Popover
      align="end"
      className="w-[230px]"
      trigger={(props) => (
        <button
          {...props}
          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink"
          aria-label={t.slideOptions}
          title={t.slideOptions}
        >
          <Ellipsis className="size-4" />
        </button>
      )}
    >
      {(close) => {
        const run = (fn: () => void) => () => {
          fn();
          close();
        };
        return (
          <>
            <MenuItem icon={<Copy />} onSelect={run(onDuplicate)}>
              {t.duplicateSlide}
            </MenuItem>
            <MenuItem icon={<ArrowLeft />} disabled={index === 0} onSelect={run(() => onMove(-1))}>
              {t.moveEarlier}
            </MenuItem>
            <MenuItem icon={<ArrowRight />} disabled={index === total - 1} onSelect={run(() => onMove(1))}>
              {t.moveLater}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger disabled={total === 1} onSelect={run(onDelete)}>
              {total === 1 ? t.lastSlide : t.deleteSlide}
            </MenuItem>
          </>
        );
      }}
    </Popover>
  );
}
