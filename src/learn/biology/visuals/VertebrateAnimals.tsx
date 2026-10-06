"use client";

// Friendly side views of the five vertebrate classes (fish, frog, lizard, bird, mouse) for the
// "vertebrates" topic: class tiles, the sorter's buttons and small task pictures.

import type { ReactElement } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import type { ClassId } from "@/learn/biology/topics/vertebrates/data";
import { CLASSES } from "@/learn/biology/topics/vertebrates/data";
import { cn } from "@/lib/utils";

const SW = 2;

function Fish() {
  const f = "var(--bio-water)";
  const s = "var(--bio-water-deep)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M42 21 C 46 9, 60 8, 67 25 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M56 55 C 60 65, 68 65, 71 54 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M84 38 L 108 21 C 103 33, 103 47, 108 59 L 84 43 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M10 40 C 18 26, 44 17, 66 24 C 76 27, 82 32, 86 36 L 86 44 C 82 48, 76 53, 66 56 C 44 62, 18 54, 10 40 Z" fill={f} stroke={s} strokeWidth={SW} />
      <g fill="none" stroke={s} strokeWidth={1.2} opacity={0.55}>
        {[
          [46, 33],
          [55, 33],
          [64, 34],
          [50, 41],
          [59, 41],
          [68, 41],
          [54, 49],
          [63, 48],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y} a 4.5 4.5 0 0 1 0 8`} />
        ))}
      </g>
      <path d="M32 27 C 37 35, 37 46, 32 53" fill="none" stroke={s} strokeWidth={1.6} />
      <path d="M34 45 C 40 50, 46 54, 49 51 C 45 47, 40 45, 34 45 Z" fill={f} stroke={s} strokeWidth={1.5} />
      <path d="M10 40 L 16 41" stroke={s} strokeWidth={1.5} />
      <circle cx={22} cy={36} r={3.6} fill="var(--raised)" stroke={s} strokeWidth={1.2} />
      <circle cx={21.5} cy={36} r={1.8} fill="var(--bio-outline)" />
    </g>
  );
}

function Frog() {
  const f = "var(--bio-leaf)";
  const s = "var(--bio-leaf-deep)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M62 52 C 70 36, 92 38, 94 54 C 95 62, 86 66, 74 65 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M76 64 L 100 65 C 105 65, 105 70, 100 70 L 70 70 C 68 68, 70 65, 76 64 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M16 44 C 14 30, 28 22, 44 24 C 62 26, 80 36, 84 52 C 86 62, 76 68, 62 68 L 36 68 C 24 68, 17 58, 16 44 Z" fill={f} stroke={s} strokeWidth={SW} />
      <g fill={s} opacity={0.3}>
        <ellipse cx={56} cy={36} rx={4} ry={2.6} />
        <ellipse cx={68} cy={44} rx={3.4} ry={2.2} />
        <ellipse cx={48} cy={30} rx={2.6} ry={1.8} />
      </g>
      <path d="M17 43 C 24 49, 34 49, 42 45" fill="none" stroke={s} strokeWidth={1.5} />
      <circle cx={45} cy={37} r={4} fill="none" stroke={s} strokeWidth={1.4} />
      <path d="M36 56 C 36 62, 34 68, 31 72" fill="none" stroke={s} strokeWidth={4.5} />
      <path d="M31 72 L 24 73 M31 72 L 36 74 M31 72 L 29 76" fill="none" stroke={s} strokeWidth={2} />
      <circle cx={30} cy={25} r={8} fill={f} stroke={s} strokeWidth={SW} />
      <circle cx={30} cy={25} r={5} fill="var(--raised)" stroke={s} strokeWidth={1} />
      <ellipse cx={30} cy={25} rx={3} ry={2} fill="var(--bio-outline)" />
    </g>
  );
}

function Lizard() {
  const f = "var(--bio-pollen)";
  const s = "var(--bio-nerve-deep)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <g fill="none" stroke={s} strokeWidth={3.5} opacity={0.55}>
        <path d="M36 44 C 40 50, 42 54, 46 58" />
        <path d="M70 44 C 74 50, 76 54, 80 58" />
      </g>
      <path d="M6 42 C 8 36, 16 33, 24 35 C 34 32, 54 32, 66 36 C 80 40, 98 42, 116 37 C 100 46, 82 48, 66 47 C 54 50, 34 50, 24 47 C 16 49, 8 47, 6 42 Z" fill={f} stroke={s} strokeWidth={SW} />
      <g fill={s} opacity={0.4}>
        {[30, 38, 46, 54, 62, 70, 78].map((x) => (
          <circle key={x} cx={x} cy={38 + (x > 66 ? 2 : 0)} r={1.3} />
        ))}
      </g>
      <g fill="none" stroke={s} strokeWidth={4.5}>
        <path d="M30 46 C 28 52, 25 56, 21 59" />
        <path d="M63 46 C 64 52, 62 56, 57 60" />
      </g>
      <g fill="none" stroke={s} strokeWidth={1.6}>
        <path d="M21 59 L 15 59 M21 59 L 17 63 M21 59 L 22 64" />
        <path d="M57 60 L 51 60 M57 60 L 53 64 M57 60 L 58 65" />
      </g>
      <path d="M6 42 L 15 43" stroke={s} strokeWidth={1.4} />
      <circle cx={16} cy={39} r={2.3} fill="var(--bio-outline)" />
    </g>
  );
}

function Bird() {
  const f = "var(--bio-mito)";
  const s = "var(--bio-mito-deep)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M72 44 L 104 39 L 100 50 L 70 53 Z" fill={f} stroke={s} strokeWidth={SW} />
      <g fill="none" stroke={s} strokeWidth={2}>
        <path d="M47 58 L 45 71 M55 58 L 57 71" />
        <path d="M45 71 L 39 73 M45 71 L 49 73 M57 71 L 52 73 M57 71 L 62 73" />
      </g>
      <path d="M24 40 C 22 28, 32 20, 44 22 C 54 24, 58 32, 70 36 C 80 40, 80 52, 68 56 C 56 60, 36 60, 28 52 C 24 48, 24 44, 24 40 Z" fill={f} stroke={s} strokeWidth={SW} />
      <circle cx={36} cy={27} r={12} fill={f} stroke={s} strokeWidth={SW} />
      <path d="M27 37 C 26 46, 34 54, 46 56 C 36 56, 28 50, 26 42 Z" fill="var(--bio-petal)" opacity={0.7} />
      <path d="M26 31 C 30 36, 40 36, 46 33 C 40 40, 30 40, 26 31 Z" fill={f} />
      <path d="M44 37 C 56 32, 72 36, 80 45 C 68 51, 52 50, 44 37 Z" fill={s} opacity={0.45} stroke={s} strokeWidth={1.4} />
      <path d="M25 24 L 12 27 L 25 30 Z" fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.4} />
      <circle cx={31} cy={24} r={2.5} fill="var(--bio-outline)" />
    </g>
  );
}

function Mouse() {
  const f = "var(--bio-soil)";
  const s = "var(--bio-wood-deep)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M86 56 C 100 60, 108 52, 114 40" fill="none" stroke={s} strokeWidth={2.5} />
      <path d="M24 50 C 24 36, 42 28, 60 30 C 78 32, 90 42, 88 54 C 87 62, 78 64, 70 64 L 34 64 C 28 64, 24 58, 24 50 Z" fill={f} stroke={s} strokeWidth={SW} />
      <path d="M38 36 C 26 34, 14 44, 8 52 C 16 58, 30 60, 40 56 Z" fill={f} stroke={s} strokeWidth={SW} />
      <ellipse cx={34} cy={34} rx={7.5} ry={8.5} fill="var(--bio-flesh)" stroke={s} strokeWidth={SW} />
      <circle cx={22} cy={46} r={2.2} fill="var(--bio-outline)" />
      <circle cx={8.5} cy={52} r={2} fill="var(--bio-flesh-deep)" />
      <g stroke={s} strokeWidth={0.9} opacity={0.8}>
        <path d="M12 52 L 2 48 M12 53 L 2 54 M12 54 L 4 59" />
      </g>
      <g fill="none" stroke={s} strokeWidth={2}>
        <path d="M38 64 L 34 69 M72 64 L 76 69" />
      </g>
    </g>
  );
}

const DRAW: Record<ClassId, () => ReactElement> = { fish: Fish, amph: Frog, rept: Lizard, bird: Bird, mammal: Mouse };

/** A small drawing of a typical member of a class (fish, frog, lizard, bird, mouse). */
export function ClassAnimal({ cls, className, title = true }: { cls: ClassId; className?: string; title?: boolean }) {
  const t = useText();
  const D = DRAW[cls];
  return (
    <svg viewBox="0 0 120 80" className={cn("block h-auto w-full", className)} role={title ? "img" : undefined} aria-label={title ? t(CLASSES[cls].name) : undefined} aria-hidden={title ? undefined : true}>
      <D />
    </svg>
  );
}

/** Task picture: the five class drawings in a row, one of them asked about. */
export function VertebrateClassRow({ ask }: { ask?: ClassId }) {
  const t = useText();
  const ids: ClassId[] = ["fish", "amph", "rept", "bird", "mammal"];
  return (
    <div className="grid grid-cols-5 gap-2" role="img" aria-label={t(tx("The five classes of vertebrates", "Die fünf Wirbeltierklassen"))}>
      {ids.map((c) => (
        <div key={c} className={cn("rounded-xl p-1", ask === c && "bg-blob-soft ring-2 ring-blob")}>
          <ClassAnimal cls={c} title={false} />
        </div>
      ))}
    </div>
  );
}
