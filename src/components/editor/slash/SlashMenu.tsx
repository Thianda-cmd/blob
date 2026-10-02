"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "@/components/ui/Kbd";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { cn } from "@/lib/utils";
import type { SlashItem } from "./items";
import type { SlashController, SlashSnapshot } from "./SlashCommand";

/** The "/" block menu. Rendered with React into the host the Suggestion plugin positions at the caret. */
export function SlashMenu({ controller }: { controller: SlashController }) {
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const host = controller.host;
  if (!snap.open || !host) return null;
  return createPortal(<SlashPanel key={snap.session} controller={controller} snap={snap} />, host);
}

function SlashPanel({ controller, snap }: { controller: SlashController; snap: SlashSnapshot }) {
  const t = useMessages(editorText).slash;
  const { items, query, placement } = snap;
  const [active, setActive] = useState(0);
  const [seenQuery, setSeenQuery] = useState(query);
  const listRef = useRef<HTMLDivElement>(null);

  // A new query starts the highlight from the top again.
  if (seenQuery !== query) {
    setSeenQuery(query);
    setActive(0);
  }
  const current = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    controller.setKeyHandler((event) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((current + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((current - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        controller.choose(items[current]);
        return true;
      }
      return false;
    });
    return () => controller.setKeyHandler(null);
  }, [controller, items, current]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let lastGroup: string | null = null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: placement === "top" ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 560, damping: 30, mass: 0.7 }}
      style={{ transformOrigin: placement === "top" ? "bottom left" : "top left" }}
      className="w-[300px] overflow-hidden rounded-xl border border-line bg-raised text-ink shadow-pop"
      role="listbox"
      aria-label={t.label}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={listRef} className="max-h-[min(340px,48vh)] scroll-py-1 overflow-y-auto overscroll-contain p-1">
        {items.length === 0 ? (
          <div className="px-3 py-5 text-center text-[13px] text-ink-3">
            {t.noMatch} <span className="text-ink-2">{t.quote(query)}</span>
          </div>
        ) : (
          items.map((item, i) => {
            const label = item.group !== lastGroup ? t.groups[item.group] : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {label && <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-ink-3 first:pt-1">{label}</div>}
                <SlashRow item={item} active={i === current} onHover={() => setActive(i)} onChoose={() => controller.choose(item)} />
              </div>
            );
          })
        )}
      </div>
      <div className="flex h-8 items-center gap-3 border-t border-line bg-surface/60 px-2.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> {t.navigate}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> {t.insert}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> {t.close}
        </span>
      </div>
    </motion.div>
  );
}

function SlashRow({ item, active, onHover, onChoose }: { item: SlashItem; active: boolean; onHover: () => void; onChoose: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      onMouseMove={active ? undefined : onHover}
      onClick={onChoose}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors duration-100",
        active ? "bg-hover" : "hover:bg-hover/60",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border bg-surface transition-colors duration-100",
          active ? "border-line-2 text-ink" : "border-line text-ink-2",
        )}
      >
        <Icon className="size-[17px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">{item.title}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-3">{item.description}</span>
      </span>
      {item.hint && <span className="shrink-0 pr-1 font-mono text-[11px] text-ink-3/90">{item.hint}</span>}
    </button>
  );
}
