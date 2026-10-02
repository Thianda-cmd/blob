"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { dec } from "../format";
import { alkaneName, BOIL, BOIL_BRANCHED, condensedLine, graphOf, ISOMERS, MELT, nameOf, STATE_NAME, stateAt, USES, type Branch, type Skeleton } from "../alkanes-core";
import { StructureFull } from "./AlkanesStructure";

// Build an alkane: add carbon atoms to the chain and (in the branching version) tap a carbon
// to hang a methyl group on it. The structural formula is drawn with every hydrogen; name,
// molecular formula and condensed formula update live. Bent main chains get highlighted.

const MAX_ROW = 10;
const MAX_METHYL = 4;

type Found = { key: string; name: Text };
const foundOf = (s: Skeleton): Found => {
  const name = nameOf(graphOf(s)).name;
  return { key: resolveText(name, "en"), name };
};

/** "CH3–(CH2)4–CH3" for long unbranched chains, the full condensed line otherwise. */
function condensed(s: Skeleton) {
  const g = graphOf(s);
  const n = nameOf(g);
  if (g.n >= 6 && n.subs.length === 0) return `CH3–(CH2)${g.n - 2}–CH3`;
  return condensedLine(g, n.chain);
}

function Stepper({ value, onMinus, onPlus, minusOff, plusOff, minusLabel, plusLabel }: { value: number; onMinus: () => void; onPlus: () => void; minusOff: boolean; plusOff: boolean; minusLabel: string; plusLabel: string }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface">
      <button type="button" onClick={onMinus} disabled={minusOff} aria-label={minusLabel} className="grid size-10 place-items-center rounded-l-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30">
        <Minus className="size-4" />
      </button>
      <span className="relative grid h-10 w-9 place-items-center overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
            className="font-math text-[21px] tabular-nums text-ink"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" onClick={onPlus} disabled={plusOff} aria-label={plusLabel} className="grid size-10 place-items-center rounded-r-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}

/** **bold** inside a plain line. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((part, i) =>
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

function Builder({ branching }: { branching: boolean }) {
  const t = useText();
  const locale = useLocale();
  const start: Skeleton = branching ? { row: 4, branches: [{ at: 1, len: 1, dir: -1 }] } : { row: 3, branches: [] };
  const [sk, setSk] = useState<Skeleton>(start);
  const [found, setFound] = useState<Record<number, Found[]>>(() => ({ [graphOf(start).n]: [foundOf(start)] }));
  const [say, setSay] = useState<Text | null>(null);

  const g = graphOf(sk);
  const naming = nameOf(g);
  const total = g.n;
  const H = 2 * total + 2;
  const formula = `C${total === 1 ? "" : total}H${H}`;
  const bent = naming.chain.some((c) => g.pos[c].lvl !== 0);
  const branched = naming.subs.length > 0;
  const methylCount = sk.branches.length;

  const commit = (next: Skeleton, line: Text | null) => {
    setSk(next);
    setSay(line);
    const n = graphOf(next).n;
    const item = foundOf(next);
    setFound((f) => (f[n]?.some((x) => x.key === item.key) ? f : { ...f, [n]: [...(f[n] ?? []), item] }));
  };

  const addCarbon = () =>
    commit(
      { ...sk, row: sk.row + 1 },
      tx("One more carbon: **+1 C and +2 H**, one CH₂ group more. That's one step along the homologous series.", "Ein C-Atom mehr: **+1 C und +2 H**, also eine CH₂-Gruppe mehr. Das ist ein Schritt in der homologen Reihe."),
    );
  const removeCarbon = () =>
    commit(
      { row: sk.row - 1, branches: sk.branches.filter((b) => b.at < sk.row - 1) },
      tx("One CH₂ group less: **−1 C and −2 H**.", "Eine CH₂-Gruppe weniger: **−1 C und −2 H**."),
    );

  const tap = (col: number) => {
    const here = sk.branches.filter((b) => b.at === col);
    let branches: Branch[];
    let line: Text;
    if (here.length === 2) {
      branches = sk.branches.filter((b) => b.at !== col);
      line = tx(`Methyl groups at carbon ${col + 1} removed.`, `Methylgruppen an C-Atom ${col + 1} entfernt.`);
    } else if (methylCount >= MAX_METHYL) {
      setSay(tx(`That's enough branches for now: at most ${MAX_METHYL} methyl groups. Tap a branched carbon to remove them.`, `Genug Verzweigungen für jetzt: höchstens ${MAX_METHYL} Methylgruppen. Tipp auf ein verzweigtes C-Atom, um sie zu entfernen.`));
      return;
    } else {
      const dir: 1 | -1 = here.length === 0 ? -1 : (-here[0].dir as 1 | -1);
      branches = [...sk.branches, { at: col, len: 1, dir }];
      const end = col === 0 || col === sk.row - 1;
      line = end
        ? tx("A methyl group at the **end** of the chain? That just makes the chain longer, even if it bends. Look at the name!", "Eine Methylgruppe am **Ende** der Kette? Die macht die Kette einfach länger, auch wenn sie abknickt. Schau auf den Namen!")
        : tx(`Methyl group (CH₃) attached to carbon ${col + 1}.`, `Methylgruppe (CH₃) an C-Atom ${col + 1} angehängt.`);
    }
    commit({ ...sk, branches }, line);
  };

  const reset = () => commit(start, null);
  const n = total;
  const knownIsomers = branching && n >= 4 && n <= 6 ? ISOMERS[n] : 0;
  const foundHere = found[n] ?? [];
  const deName = resolveText(naming.name, "de");
  const bp = !branched && n <= 10 ? BOIL[n - 1] : BOIL_BRANCHED[deName];
  const deg = (v: number) => `${v < 0 ? "−" : ""}${dec(Math.abs(v), locale, 0)} °C`;

  const hint: Text = branching
    ? tx("Tap a carbon atom in the chain to attach a methyl group. Tap again for a second one, a third time to remove them.", "Tipp auf ein C-Atom der Kette, um eine Methylgruppe anzuhängen. Noch mal tippen für eine zweite, ein drittes Mal zum Entfernen.")
    : tx("Add carbon atoms and watch formula and name change.", "Füg C-Atome hinzu und schau, wie sich Formel und Name ändern.");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[14px] text-ink-2">{t(branching ? tx("Carbons in the row", "C-Atome in der Reihe") : tx("Carbon atoms", "Kohlenstoffatome"))}</span>
        <Stepper
          value={sk.row}
          onMinus={removeCarbon}
          onPlus={addCarbon}
          minusOff={sk.row <= 1}
          plusOff={sk.row >= MAX_ROW}
          minusLabel={t(tx("Remove a carbon atom", "C-Atom entfernen"))}
          plusLabel={t(tx("Add a carbon atom", "C-Atom hinzufügen"))}
        />
        {branching && (
          <button type="button" onClick={reset} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> {t(tx("Start again", "Neu anfangen"))}
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
        <div className="min-w-0 rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto px-2 py-3">
            <div className="flex min-h-[230px] items-center">
              <StructureFull skeleton={sk} chain={branching} onTapCarbon={branching ? tap : undefined} className="mx-auto shrink-0" />
            </div>
          </div>
          <div className="space-y-0.5 border-t border-line px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Condensed structural formula", "Halbstrukturformel"))}</div>
            <div className="overflow-x-auto">
              <MathView src={`\\ce{${condensed(sk)}}`} size="sm" animate={false} />
            </div>
          </div>
          <p className="border-t border-line px-3 py-2 text-[12.5px] text-ink-3">{t(hint)}</p>
        </div>

        <div className="min-w-0 space-y-3 rounded-xl border border-line bg-surface p-4">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={deName} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="break-words text-[22px] font-semibold leading-tight text-ink">
              {t(naming.name)}
            </motion.div>
          </AnimatePresence>
          <Row label={t(tx("Molecular formula", "Summenformel"))}>
            <MathView src={`\\ce{${formula}}`} size="md" scope="ab-sum" />
          </Row>
          {!branching ? (
            <Row label={t(tx("General formula", "Allgemeine Formel"))}>
              <MathView src={`\\ce{C}_{${n}} \\ce{H}_{2 \\cdot ${n} + 2} = \\ce{${formula}}`} size="sm" animate={false} />
            </Row>
          ) : (
            <Row label={t(tx("Main chain", "Hauptkette"))}>
              <span className="text-[14px] text-ink">
                {t(tx(`${naming.chain.length} C atoms`, `${naming.chain.length} C-Atome`))} → {t(alkaneName(naming.chain.length))}
              </span>
            </Row>
          )}
          {bp !== undefined && (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[12.5px]">
              <span className="rounded-full bg-hover px-2.5 py-1 text-ink-2">
                {t(tx("boils at", "siedet bei"))} {deg(bp)}
              </span>
              {!branched && n <= 10 && (
                <>
                  <span className="rounded-full bg-hover px-2.5 py-1 text-ink-2">
                    {t(tx("at 20 °C", "bei 20 °C"))}: {t(STATE_NAME[stateAt(n, 20)])}
                  </span>
                  <span className="rounded-full bg-blob-soft/70 px-2.5 py-1 text-blob-ink">{t(USES[n - 1])}</span>
                </>
              )}
            </div>
          )}
          {!branched && n <= 10 && <span className="sr-only">{t(tx(`Melting point ${MELT[n - 1]} °C`, `Schmelztemperatur ${MELT[n - 1]} °C`))}</span>}
        </div>
      </div>

      {branching && (bent || branched) && (
        <div className="flex flex-wrap gap-2 text-[13px]">
          {bent && <span className="rounded-lg bg-blob-soft/60 px-3 py-1.5 text-ink">{t(tx("The longest chain bends here: follow the purple bonds.", "Die längste Kette knickt hier ab: Folge den lila Bindungen."))}</span>}
          {branched && (
            <span className="rounded-lg bg-hover px-3 py-1.5 text-ink-2">
              {t(tx(`Isomer of ${resolveText(alkaneName(n), "en")}: same molecular formula, different structure.`, `Isomer von ${resolveText(alkaneName(n), "de")}: gleiche Summenformel, andere Struktur.`))}
            </span>
          )}
        </div>
      )}

      {knownIsomers > 0 && (
        <div className="rounded-xl border border-dashed border-line-2 px-3.5 py-2.5 text-[13px] text-ink-2">
          <span className="font-semibold text-ink">
            {t(tx("Isomer hunt", "Isomerenjagd"))} <MathView src={`\\ce{${formula}}`} size="inline" animate={false} />:
          </span>{" "}
          {t(tx(`${foundHere.length} of ${knownIsomers} found`, `${foundHere.length} von ${knownIsomers} gefunden`))}
          {foundHere.length >= knownIsomers ? <span className="text-ok"> · {t(tx("all of them!", "alle!"))}</span> : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {foundHere.map((f) => (
              <span key={f.key} className="rounded-full bg-hover px-2 py-0.5 text-[12px] text-ink">
                {t(f.name)}
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${sk.row}-${sk.branches.map((b) => `${b.at}${b.dir}`).join()}-${say ? resolveText(say, "en").length : 0}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className={cn("min-h-[1.5em] text-[14px] leading-relaxed text-ink-2")}
        >
          {say ? <Bold text={t(say)} /> : null}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** The chain builder: methane to decane. */
export function AlkanesBuilder() {
  return <Builder branching={false} />;
}

/** The branching builder: attach methyl groups and watch the IUPAC name. */
export function AlkanesBranchBuilder() {
  return <Builder branching />;
}
