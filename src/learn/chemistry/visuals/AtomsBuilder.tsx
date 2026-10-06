"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { STABLE } from "../atoms-data";
import { byNumber } from "../elements";
import { AtomShells } from "./AtomShells";
import { chargeLabel, Nuclide } from "./AtomsVisuals";
import { cos, sin } from "@/lib/stableMath";

/** Ions students meet in school (symbol charge), for the "this ion really exists" note. */
const REAL_IONS = new Set(["1:1", "1:-1", "3:1", "4:2", "11:1", "12:2", "13:3", "19:1", "20:2", "7:-3", "8:-2", "9:-1", "15:-3", "16:-2", "17:-1"]);

const NOBLE: Record<number, string> = { 2: "He", 10: "Ne", 18: "Ar" };

type Change = "p+" | "p-" | "n+" | "n-" | "e+" | "e-" | "neutral";

const MAX_P = 20;
const MAX_N = 30;
const SIZE = 236;

/** Protons and neutrons packed into the nucleus (sunflower pattern), drawn over AtomShells' core. */
function Nucleus({ p, n, size }: { p: number; n: number; size: number }) {
  const c = size / 2;
  const core = Math.max(16, size * 0.11);
  const total = p + n;
  const rb = Math.max(2.1, Math.min(7, ((core - 2) * 0.88) / Math.sqrt(Math.max(total, 1))));
  const R = core - 2 - rb;
  const balls: { key: string; x: number; y: number; proton: boolean }[] = [];
  let pi = 0;
  let ni = 0;
  for (let i = 0; i < total; i++) {
    const proton = Math.floor(((i + 1) * p) / total) > Math.floor((i * p) / total);
    const r = total === 1 ? 0 : R * Math.sqrt((i + 0.5) / total);
    const a = i * 2.39996;
    balls.push({
      key: proton ? `p${pi++}` : `n${ni++}`,
      x: Math.round((c + r * cos(a)) * 100) / 100,
      y: Math.round((c + r * sin(a)) * 100) / 100,
      proton,
    });
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="pointer-events-none absolute inset-0" aria-hidden>
      <AnimatePresence initial={false}>
        {balls.map((b) => (
          <motion.circle
            key={b.key}
            r={rb}
            initial={{ cx: c, cy: c, opacity: 0, scale: 0 }}
            animate={{ cx: b.x, cy: b.y, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            fill={b.proton ? "var(--blob)" : "var(--ink-3)"}
            stroke="var(--raised)"
            strokeWidth={0.8}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}

function Stepper({
  dot,
  label,
  value,
  onMinus,
  onPlus,
  minusOff,
  plusOff,
  minusLabel,
  plusLabel,
}: {
  dot: string;
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  minusOff: boolean;
  plusOff: boolean;
  minusLabel: string;
  plusLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-3 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="w-[104px] shrink-0 text-[14px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={onMinus}
        disabled={minusOff}
        aria-label={minusLabel}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Minus className="size-4" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-8 text-center font-math text-[22px] tabular-nums text-ink">
        {value}
      </motion.span>
      <button
        type="button"
        onClick={onPlus}
        disabled={plusOff}
        aria-label={plusLabel}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[13.5px]">
      <span className="w-[112px] shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 font-medium text-ink">{children}</span>
    </div>
  );
}

/** Build an atom: add or remove protons, neutrons and electrons and watch element, mass number and charge. */
export function AtomsBuilder() {
  const t = useText();
  const [p, setP] = useState(3);
  const [n, setN] = useState(4);
  const [e, setE] = useState(3);
  const [last, setLast] = useState<Change | null>(null);

  const el = byNumber(p)!;
  const a = p + n;
  const q = p - e;
  const stable = STABLE[p]?.includes(a) ?? false;
  const maxE = Math.min(MAX_P, p + 3);

  const change = (what: Change, fn: () => void) => {
    fn();
    setLast(what);
  };

  const status: Text | null = (() => {
    switch (last) {
      case "p+":
      case "p-":
        return tx(
          `${last === "p+" ? "One proton more" : "One proton less"}: a new element! The number of protons decides which element it is.`,
          `${last === "p+" ? "Ein Proton mehr" : "Ein Proton weniger"}: ein neues Element! Die Protonenzahl entscheidet, welches Element es ist.`,
        );
      case "n+":
      case "n-":
        return tx("Same element, different mass: that's another **isotope**.", "Gleiches Element, andere Masse: Das ist ein anderes **Isotop**.");
      case "e+":
      case "e-":
        return q === 0
          ? tx("As many electrons as protons again: the atom is neutral.", "Wieder gleich viele Elektronen wie Protonen: Das Atom ist neutral.")
          : q > 0
            ? tx("Fewer electrons than protons: a **positive ion** (cation).", "Weniger Elektronen als Protonen: ein **positives Ion** (Kation).")
            : tx("More electrons than protons: a **negative ion** (anion).", "Mehr Elektronen als Protonen: ein **negatives Ion** (Anion).");
      case "neutral":
        return tx("Back to a neutral atom.", "Zurück zum neutralen Atom.");
      default:
        return null;
    }
  })();

  const ionNote: Text | null =
    q === 0
      ? null
      : NOBLE[e] && REAL_IONS.has(`${p}:${q}`)
        ? tx(`This ion exists: its electrons are arranged like in ${NOBLE[e]} (noble gas configuration).`, `Dieses Ion gibt es wirklich: Seine Elektronen sind so verteilt wie bei ${NOBLE[e]} (Edelgaskonfiguration).`)
        : REAL_IONS.has(`${p}:${q}`)
          ? tx("This ion exists.", "Dieses Ion gibt es wirklich.")
          : tx("This ion would be very unstable. You won't find it in nature.", "Dieses Ion wäre sehr instabil. In der Natur findest du es nicht.");

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,250px)_minmax(0,1fr)] md:items-start">
      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <div aria-hidden>
            <AtomShells z={e} size={SIZE} nucleus={false} />
          </div>
          <Nucleus p={p} n={n} size={SIZE} />
          {q !== 0 && (
            <motion.span key={q} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute right-1 top-0 font-math text-[22px] font-semibold text-blob-ink">
              {chargeLabel(q)}
            </motion.span>
          )}
        </div>
        <span className="sr-only">
          {t(tx(`${resolveText(el.name, "en")}: ${p} protons, ${n} neutrons, ${e} electrons.`, `${resolveText(el.name, "de")}: ${p} Protonen, ${n} Neutronen, ${e} Elektronen.`))}
        </span>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blob" /> {t(tx("proton", "Proton"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-ink-3" /> {t(tx("neutron", "Neutron"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-ink-2" /> {t(tx("electron", "Elektron"))}
          </span>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Stepper
            dot="var(--blob)"
            label={t(tx("Protons", "Protonen"))}
            value={p}
            onMinus={() =>
              change("p-", () => {
                setP(p - 1);
                if (e > p + 2) setE(p + 2);
              })
            }
            onPlus={() => change("p+", () => setP(p + 1))}
            minusOff={p <= 1}
            plusOff={p >= MAX_P}
            minusLabel={t(tx("Remove a proton", "Proton wegnehmen"))}
            plusLabel={t(tx("Add a proton", "Proton hinzufügen"))}
          />
          <Stepper
            dot="var(--ink-3)"
            label={t(tx("Neutrons", "Neutronen"))}
            value={n}
            onMinus={() => change("n-", () => setN(n - 1))}
            onPlus={() => change("n+", () => setN(n + 1))}
            minusOff={n <= 0}
            plusOff={n >= MAX_N}
            minusLabel={t(tx("Remove a neutron", "Neutron wegnehmen"))}
            plusLabel={t(tx("Add a neutron", "Neutron hinzufügen"))}
          />
          <Stepper
            dot="var(--ink-2)"
            label={t(tx("Electrons", "Elektronen"))}
            value={e}
            onMinus={() => change("e-", () => setE(e - 1))}
            onPlus={() => change("e+", () => setE(Math.min(e + 1, maxE)))}
            minusOff={e <= 0}
            plusOff={e >= maxE}
            minusLabel={t(tx("Remove an electron", "Elektron wegnehmen"))}
            plusLabel={t(tx("Add an electron", "Elektron hinzufügen"))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4">
          <Nuclide symbol={el.symbol} a={a} z={p} charge={q} size={58} labels />
          <div className="min-w-[200px] flex-1 space-y-1">
            <motion.div key={el.symbol} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[18px] font-semibold text-ink">
              {t(el.name)}
              {q !== 0 && <span className="font-normal text-ink-2">{t(tx(" ion", "-Ion"))}</span>}
            </motion.div>
            <Fact label={t(tx("Atomic number", "Ordnungszahl"))}>Z = {p}</Fact>
            <Fact label={t(tx("Mass number", "Massenzahl"))}>
              A = {p} + {n} = {a}
            </Fact>
            <Fact label={t(tx("Charge", "Ladung"))}>{q === 0 ? t(tx("neutral", "neutral")) : `${Math.abs(q)}${q > 0 ? "+" : "−"}  (${p} − ${e})`}</Fact>
            <Fact label={t(tx("Isotope", "Isotop"))}>
              {el.symbol}-{a} ·{" "}
              <span className={stable ? "text-ok" : "text-ink-3"}>{t(stable ? tx("stable", "stabil") : tx("not stable (radioactive)", "nicht stabil (radioaktiv)"))}</span>
            </Fact>
          </div>
        </div>

        <div className="flex min-h-[44px] flex-wrap items-start gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={`${last}-${p}-${n}-${e}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2"
            >
              <Bold text={t(status ?? tx("Add or remove particles and watch what changes.", "Nimm Teilchen dazu oder weg und schau, was sich ändert."))} />
              {ionNote && <span className={cn("mt-1 block", REAL_IONS.has(`${p}:${q}`) ? "text-ink-2" : "text-ink-3")}>{t(ionNote)}</span>}
            </motion.p>
          </AnimatePresence>
          {q !== 0 && (
            <button
              type="button"
              onClick={() => change("neutral", () => setE(p))}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> {t(tx("Make it neutral", "Neutral machen"))}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** **bold** inside a plain line. */
function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
