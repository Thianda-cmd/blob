"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { resolveText, type Text } from "@/i18n/text";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { matchOptions, matchShown } from "@/learn/engine/arrange";
import type { AnswerSpec } from "@/learn/types";
import { cn } from "@/lib/utils";
import type { AnswerStatus } from "./AnswerInput";
import { MathView } from "./MathView";
import { Inline } from "./Rich";

/** A card's text; a card that is only maths ("$-9$") shows it at reading size, not inline size. */
function CardText({ text }: { text: Text }) {
  const raw = resolveText(text, useLocale()).trim();
  const only = /^\$[^$]+\$$/.test(raw);
  return only ? <MathView src={raw.slice(1, -1)} size="md" animate={false} /> : <Inline text={text} />;
}

/** A card's text for screen readers: maths and bold without their markup ("$-9$" reads "-9"). */
const plain = (text: string) => text.replace(/\$([^$]+)\$/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");

type OrderSpec = Extract<AnswerSpec, { kind: "order" }>;
type MatchSpec = Extract<AnswerSpec, { kind: "match" }>;

/** Sort cards into the right order: drag by the handle, or use the arrow buttons. */
export function OrderField({
  spec,
  order,
  onChange,
  status,
  disabled,
}: {
  spec: OrderSpec;
  order: number[];
  onChange: (order: number[]) => void;
  status: AnswerStatus;
  disabled?: boolean;
}) {
  const t = useMessages(learnText).input;
  const tt = useText();
  const move = (pos: number, by: -1 | 1) => {
    const to = pos + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[pos], next[to]] = [next[to], next[pos]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="text-[12.5px] text-ink-3">{spec.label ? tt(spec.label) : t.orderHint}</div>
      <Reorder.Group axis="y" values={order} onReorder={disabled ? () => {} : onChange} className="space-y-2">
        {order.map((item, pos) => (
          <OrderRow
            key={item}
            item={item}
            pos={pos}
            last={pos === order.length - 1}
            text={spec.items[item]}
            state={status === "idle" ? "idle" : item === pos ? "ok" : status === "wrong" ? "bad" : "idle"}
            disabled={disabled}
            onMove={(by) => move(pos, by)}
            upLabel={t.moveUp(plain(tt(spec.items[item])))}
            downLabel={t.moveDown(plain(tt(spec.items[item])))}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function OrderRow({
  item,
  pos,
  last,
  text,
  state,
  disabled,
  onMove,
  upLabel,
  downLabel,
}: {
  item: number;
  pos: number;
  last: boolean;
  text: OrderSpec["items"][number];
  state: "idle" | "ok" | "bad";
  disabled?: boolean;
  onMove: (by: -1 | 1) => void;
  upLabel: string;
  downLabel: string;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "relative flex min-h-13 items-center gap-2.5 rounded-xl border-2 bg-raised py-2 pl-2 pr-1.5 text-[15px] shadow-card",
        state === "idle" && "border-line",
        state === "ok" && "border-ok bg-ok/10",
        state === "bad" && "border-danger bg-danger/10",
      )}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px -12px rgb(0 0 0 / 0.35)", zIndex: 5 }}
    >
      <span
        onPointerDown={(e) => !disabled && controls.start(e)}
        className={cn("grid h-9 w-6 shrink-0 touch-none place-items-center rounded-md text-ink-3", !disabled && "cursor-grab hover:bg-hover active:cursor-grabbing")}
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold", state === "ok" ? "bg-ok text-white" : "bg-hover text-ink-2")}>
        {pos + 1}
      </span>
      <span className="min-w-0 flex-1 py-1 leading-snug">
        <CardText text={text} />
      </span>
      {/* Side by side on phones (two full-size tap targets), stacked on wider screens. */}
      <span className="flex shrink-0 sm:flex-col">
        <button
          type="button"
          disabled={disabled || pos === 0}
          onClick={() => onMove(-1)}
          aria-label={upLabel}
          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-6"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled || last}
          onClick={() => onMove(1)}
          aria-label={downLabel}
          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-6"
        >
          <ArrowDown className="size-3.5" />
        </button>
      </span>
    </Reorder.Item>
  );
}

/** Give every card on the left its partner: tap the row, then pick from the list. */
export function MatchField({
  spec,
  picks,
  onChange,
  status,
  disabled,
}: {
  spec: MatchSpec;
  picks: (number | null)[];
  onChange: (picks: (number | null)[]) => void;
  status: AnswerStatus;
  disabled?: boolean;
}) {
  const t = useMessages(learnText).input;
  const tt = useText();
  const options = matchOptions(spec);
  const shown = matchShown(spec);
  const [open, setOpen] = useState<number | null>(() => (disabled ? null : 0));

  function pick(row: number, option: number) {
    // An option belongs to one card at a time: taking it moves it.
    const next = picks.map((p) => (p === option ? null : p));
    next[row] = option;
    onChange(next);
    const empty = next.findIndex((p, i) => p === null && i !== row);
    setOpen(empty >= 0 ? empty : null);
  }

  return (
    <div className="space-y-2">
      <div className="text-[12.5px] text-ink-3">{spec.label ? tt(spec.label) : t.matchHint}</div>
      <ul className="space-y-2">
        {spec.pairs.map(([left], row) => {
          const chosen = picks[row];
          const state = status === "idle" || chosen === null ? "idle" : chosen === row ? "ok" : status === "wrong" ? "bad" : "idle";
          const isOpen = open === row && !disabled;
          return (
            <li
              key={row}
              className={cn(
                "overflow-hidden rounded-xl border-2 bg-raised shadow-card transition-colors",
                state === "idle" && (isOpen ? "border-blob" : "border-line"),
                state === "ok" && "border-ok bg-ok/10",
                state === "bad" && "border-danger bg-danger/10",
              )}
            >
              <div className="grid items-center gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <span className="min-w-0 px-1.5 text-[15px] font-medium leading-snug">
                  <CardText text={left} />
                </span>
                <span className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen(isOpen ? null : row)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[14.5px] transition-colors",
                      chosen === null ? "border-dashed border-line-2 text-ink-3 hover:border-blob/60" : "border-line bg-surface text-ink hover:border-line-2",
                    )}
                  >
                    {state === "ok" && <Check className="size-4 shrink-0 text-ok" strokeWidth={3} />}
                    <span className="min-w-0 flex-1 leading-snug">{chosen === null ? t.matchPick : <CardText text={options[chosen]} />}</span>
                    {!disabled && <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} />}
                  </button>
                  {chosen !== null && !disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(picks.map((p, i) => (i === row ? null : p)))}
                      aria-label={t.matchClear(plain(tt(left)))}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="border-t border-line bg-surface/70"
                  >
                    <div className="flex flex-wrap gap-1.5 p-2">
                      {shown.map((o) => {
                        const taken = picks.includes(o) && picks[row] !== o;
                        return (
                          <motion.button
                            key={o}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => pick(row, o)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 text-left text-[14px] leading-snug transition-colors",
                              picks[row] === o ? "border-blob bg-blob-soft/70 text-ink" : "border-line bg-raised hover:border-blob/50",
                              taken && "opacity-45",
                            )}
                          >
                            <CardText text={options[o]} />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
