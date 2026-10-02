"use client";

// Small pictures for the "atoms" topic (also used by "periodic-table"): nuclide notation,
// a periodic-table tile, a shell picture without giveaway labels and a look-up table.

import type { ComponentType } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { element } from "../elements";
import { dec } from "../format";
import { AtomShells, ionShells } from "./AtomShells";
import { PeriodicTable } from "./PeriodicTable";

/** A charge as written after a symbol: "+", "2+", "−", "3−". */
export function chargeLabel(q: number) {
  if (!q) return "";
  return `${Math.abs(q) > 1 ? Math.abs(q) : ""}${q > 0 ? "+" : "−"}`;
}

/** Nuclide notation (Kernsymbol): mass number top left, atomic number bottom left, charge top right. */
export function Nuclide({
  symbol,
  a,
  z,
  charge = 0,
  size = 64,
  labels = false,
  className,
}: {
  symbol: string;
  a: number;
  z: number;
  charge?: number;
  size?: number;
  /** Small labels next to the numbers (mass number / atomic number). */
  labels?: boolean;
  className?: string;
}) {
  const t = useText();
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {labels && (
        <div className="flex flex-col items-end justify-between self-stretch py-[0.15em] text-right text-[11.5px] leading-tight text-ink-3" style={{ fontSize: Math.max(11, size * 0.18) }}>
          <span>{t(tx("mass number A", "Massenzahl A"))} →</span>
          <span>{t(tx("atomic number Z", "Ordnungszahl Z"))} →</span>
        </div>
      )}
      <div className="inline-flex items-stretch font-math leading-none text-ink" style={{ fontSize: size }} role="img" aria-label={`${symbol}, A = ${a}, Z = ${z}${charge ? `, ${chargeLabel(charge)}` : ""}`}>
        <span className="flex flex-col items-end justify-between py-[0.06em] pr-[0.06em] text-[0.4em] tabular-nums">
          <span>{a}</span>
          <span>{z}</span>
        </span>
        <span className="font-semibold">{symbol}</span>
        {charge !== 0 && <span className="pl-[0.04em] text-[0.4em] text-blob-ink">{chargeLabel(charge)}</span>}
      </div>
    </div>
  );
}

/** Nuclide symbol centred in a task card. */
export function NuclideCard(props: { symbol: string; a: number; z: number; charge?: number; size?: number }) {
  return (
    <div className="grid place-items-center py-2">
      <Nuclide {...props} />
    </div>
  );
}

/** A tile as in the periodic table: atomic number, symbol, name and atomic mass. */
export function ElementTile({ symbol, showMass = true, className }: { symbol: string; showMass?: boolean; className?: string }) {
  const t = useText();
  const locale = useLocale();
  const el = element(symbol);
  if (!el) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className={cn("w-[148px] rounded-xl border-2 border-line bg-raised px-3 pb-2.5 pt-2 shadow-card", className)}>
        <div className="flex items-baseline justify-between text-[13px] tabular-nums text-ink-2">
          <span className="font-semibold">{el.z}</span>
          {showMass && <span>{dec(el.mass, locale, 2)}</span>}
        </div>
        <div className="py-1 text-center text-[44px] font-bold leading-none text-ink">{el.symbol}</div>
        <div className="truncate text-center text-[13px] text-ink-2">{t(el.name)}</div>
      </div>
      <div className="space-y-1 text-[12.5px] text-ink-3">
        <div>
          <span className="font-semibold text-ink-2">{el.z}</span> = {t(tx("atomic number", "Ordnungszahl"))}
        </div>
        {showMass && (
          <div>
            <span className="font-semibold text-ink-2">{dec(el.mass, locale, 2)}</span> = {t(tx("atomic mass in u (average)", "Atommasse in u (Mittelwert)"))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The shell model of an atom or ion without its name or nucleus numbers, so a task can ask
 * "which element is this?". Electrons are drawn still, to be counted.
 */
export function ShellPicture({ z, charge = 0, size = 210 }: { z: number; charge?: number; size?: number }) {
  const t = useText();
  const layers = ionShells(z, charge);
  return (
    <div className="grid place-items-center" role="img" aria-label={t(tx(`Shell model with ${layers.join(", ")} electrons`, `Schalenmodell mit ${layers.join(", ")} Elektronen`))}>
      <div className="relative" aria-hidden>
        <AtomShells z={z} charge={charge} size={size} spin={false} nucleus={false} highlightOuter={false} />
        <span className="pointer-events-none absolute inset-0 grid place-items-center font-math text-[18px] font-semibold text-blob-ink">?</span>
      </div>
    </div>
  );
}

/** A periodic table to look things up in (main groups, or all groups with `full`), scrolling inside its box on phones. */
export function LookupTable({ periods = 4, highlight = [], full = false }: { periods?: number; highlight?: string[]; full?: boolean }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className={full ? "min-w-[640px]" : "min-w-[340px] max-sm:[zoom:0.9]"}>
        <PeriodicTable mode={full ? "full" : "main"} periods={periods} shade="none" details={false} highlight={highlight} />
      </div>
    </div>
  );
}

/** Wrap a typed component as an exercise visual. */
export function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}
