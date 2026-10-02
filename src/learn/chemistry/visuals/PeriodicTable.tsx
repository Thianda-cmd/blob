"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES, ELEMENTS, element, mainGroup, MAIN_GROUP_NAMES, shells, valenceElectrons, type Element } from "../elements";
import { AtomShells } from "./AtomShells";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

type Shade = "none" | "metals" | "category";

type Props = {
  /** "main": the eight main groups (Hauptgruppen) as in school; "full": all 18 groups. */
  mode?: "main" | "full";
  /** Last period shown (main mode default 6, full mode 7). */
  periods?: number;
  /** Symbols to light up in the accent colour. */
  highlight?: string[];
  /** Fade everything that isn't highlighted. */
  focus?: boolean;
  /** Tint tiles: metals vs. nonmetals, or by family. */
  shade?: Shade;
  /** Controlled selection. Without `onSelect` the table keeps its own. */
  selected?: string | null;
  onSelect?: (symbol: string) => void;
  /** Detail card for the selected element (shells, mass, group). */
  details?: boolean;
  className?: string;
};

/** Metal / metalloid / nonmetal, for the simple school colouring. */
function kind(e: Element): "metal" | "metalloid" | "nonmetal" {
  if (e.category === "metalloid") return "metalloid";
  if (e.category === "nonmetal" || e.category === "halogen" || e.category === "noble-gas") return "nonmetal";
  return "metal";
}

const TINT: Record<string, string> = {
  metal: "bg-raised",
  metalloid: "bg-[color-mix(in_oklab,var(--blob)_9%,var(--raised))]",
  nonmetal: "bg-[color-mix(in_oklab,var(--blob)_20%,var(--raised))]",
};

/** Families in a few shades of the accent, so the table stays calm. */
function familyTint(e: Element) {
  switch (e.category) {
    case "alkali":
    case "halogen":
      return "bg-[color-mix(in_oklab,var(--blob)_24%,var(--raised))]";
    case "alkaline-earth":
    case "noble-gas":
      return "bg-[color-mix(in_oklab,var(--blob)_14%,var(--raised))]";
    case "nonmetal":
    case "metalloid":
      return "bg-[color-mix(in_oklab,var(--blob)_7%,var(--raised))]";
    default:
      return "bg-raised";
  }
}

/** Grid position: [column, row] (1-based). */
function place(e: Element, mode: "main" | "full"): [number, number] | null {
  if (e.group === null) return null;
  if (mode === "full") return [e.group, e.period];
  const g = mainGroup(e);
  return g ? [g, e.period] : null;
}

/**
 * An interactive periodic table. Tap an element for its card: shells, mass, group, period.
 * In "main" mode it is the short school table with the main groups I–VIII.
 */
export function PeriodicTable({ mode = "main", periods, highlight = [], focus = false, shade = "metals", selected, onSelect, details = true, className }: Props) {
  const scope = useId();
  const t = useText();
  const locale = useLocale();
  const [own, setOwn] = useState<string | null>(null);
  const current = selected !== undefined ? selected : own;
  const pick = (s: string) => {
    if (onSelect) onSelect(s);
    else setOwn((x) => (x === s ? null : s));
  };
  const last = periods ?? (mode === "main" ? 6 : 7);
  const cols = mode === "main" ? 8 : 18;
  const lit = new Set(highlight);
  const cells = ELEMENTS.map((e) => ({ e, at: place(e, mode) })).filter((c): c is { e: Element; at: [number, number] } => !!c.at && c.at[1] <= last);
  const sel = current ? element(current) : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn(mode === "full" && "-mx-1 overflow-x-auto px-1 pb-1")}>
        <div
          className="relative grid gap-[3px]"
          style={{
            gridTemplateColumns: `1.1rem repeat(${cols}, minmax(${mode === "full" ? "2.1rem" : "1.95rem"}, ${mode === "full" ? "3rem" : "3.6rem"}))`,
            minWidth: mode === "full" ? 640 : undefined,
          }}
        >
          {/* Group headers */}
          <span />
          {Array.from({ length: cols }, (_, i) => (
            <span key={`h${i}`} className="pb-0.5 text-center text-[10.5px] font-semibold text-ink-3 tabular-nums">
              {mode === "main" ? ROMAN[i + 1] : i + 1}
            </span>
          ))}
          {Array.from({ length: last }, (_, p) => (
            <span key={`p${p}`} className="grid place-items-center text-[10.5px] font-semibold text-ink-3 tabular-nums" style={{ gridColumn: 1, gridRow: p + 2 }}>
              {p + 1}
            </span>
          ))}
          {cells.map(({ e, at: [col, row] }) => {
            const on = lit.has(e.symbol);
            const isSel = current === e.symbol;
            const dim = focus && lit.size > 0 && !on && !isSel;
            const tint = shade === "none" ? "bg-raised" : shade === "metals" ? TINT[kind(e)] : familyTint(e);
            return (
              <motion.button
                key={e.symbol}
                type="button"
                onClick={() => pick(e.symbol)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
                aria-pressed={isSel}
                aria-label={`${t(e.name)}, ${e.z}`}
                className={cn(
                  "relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border leading-none transition-[opacity,border-color,background-color,color] duration-200",
                  on ? "border-transparent bg-blob text-white" : cn(tint, "border-line text-ink hover:border-blob/50"),
                  isSel && !on && "border-blob ring-2 ring-blob/30",
                  isSel && on && "ring-2 ring-blob/40 ring-offset-1 ring-offset-surface",
                  dim && "opacity-35",
                )}
              >
                <span className={cn("absolute left-[3px] top-[2px] text-[8px] tabular-nums", on ? "text-white/80" : "text-ink-3")}>{e.z}</span>
                <span className="mt-1 text-[13px] font-semibold sm:text-[14px]">{e.symbol}</span>
              </motion.button>
            );
          })}
          {mode === "main" && last >= 4 && (
            <span className="pointer-events-none self-center px-1 text-center text-[10.5px] leading-tight text-ink-3" style={{ gridColumn: "4 / span 4", gridRow: 2 }}>
              {t(tx("Main groups only", "Nur Hauptgruppen"))}
            </span>
          )}
        </div>
      </div>

      {shade !== "none" && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
          {shade === "metals"
            ? (["metal", "metalloid", "nonmetal"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded-[3px] border border-line", TINT[k])} />
                  {t(k === "metal" ? tx("Metals", "Metalle") : k === "metalloid" ? tx("Metalloids", "Halbmetalle") : tx("Nonmetals", "Nichtmetalle"))}
                </span>
              ))
            : (["alkali", "alkaline-earth", "halogen", "noble-gas"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded-[3px] border border-line", familyTint({ category: k } as Element))} />
                  {t(CATEGORY_NAMES[k])}
                </span>
              ))}
        </div>
      )}

      {details && (
        <AnimatePresence mode="popLayout" initial={false}>
          {sel ? (
            <motion.div
              key={sel.symbol}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-3.5"
            >
              <div className="grid size-[68px] shrink-0 place-items-center rounded-xl bg-blob text-white">
                <div className="text-center leading-none">
                  <div className="text-[11px] tabular-nums opacity-80">{sel.z}</div>
                  <div className="mt-1 text-[26px] font-bold">{sel.symbol}</div>
                </div>
              </div>
              <div className="min-w-[150px] flex-1 space-y-1 text-[13px] text-ink-2">
                <div className="text-[16px] font-semibold text-ink">{t(sel.name)}</div>
                <Fact label={t(tx("Atomic mass", "Atommasse"))} value={`${formatNumber(sel.mass, locale, { maximumFractionDigits: 2 })} u`} />
                <Fact
                  label={t(tx("Group", "Gruppe"))}
                  value={
                    mainGroup(sel)
                      ? `${ROMAN[mainGroup(sel)!]}${MAIN_GROUP_NAMES[sel.group!] ? ` · ${t(MAIN_GROUP_NAMES[sel.group!])}` : ""}`
                      : t(sel.group === null ? CATEGORY_NAMES[sel.category] : tx("Transition metal", "Nebengruppe"))
                  }
                />
                <Fact label={t(tx("Period", "Periode"))} value={String(sel.period)} />
                <Fact label={t(tx("Shells", "Schalen"))} value={shells(sel.z).join(" · ")} />
                {valenceElectrons(sel) !== null && <Fact label={t(tx("Outer electrons", "Außenelektronen"))} value={String(valenceElectrons(sel))} />}
              </div>
              {sel.z <= 36 && <AtomShells key={`${scope}-${sel.z}`} z={sel.z} size={128} />}
            </motion.div>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12.5px] text-ink-3">
              {t(tx("Tap an element to see its card.", "Tipp auf ein Element, um seine Karte zu sehen."))}
            </motion.p>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[118px] shrink-0 text-ink-3">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
