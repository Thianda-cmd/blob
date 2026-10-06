"use client";

import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { AMINO, aminoLetter, isStop, toRna } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { BASE_COLOR, baseTint, Segmented, StepButton } from "./DnaKit";

/** Start of the gene for the β chain of haemoglobin (coding strand, 5′→3′). */
const ORIGINAL = "ATGGTGCATCTGACTCCTGAGGAGAAG";
type Mode = "sub" | "ins" | "del";
type Base = { b: string; changed: boolean; id: number };

const fresh = (): Base[] => [...ORIGINAL].map((b, i) => ({ b, changed: false, id: i }));
const NEXT: Record<string, string> = { A: "T", T: "G", G: "C", C: "A" };

/** Reads codon by codon from the first base (the gene starts with ATG). */
function read(dna: string) {
  const codons: string[] = [];
  for (let i = 0; i < dna.length; i += 3) codons.push(dna.slice(i, i + 3));
  const aas: (string | null)[] = [];
  let stopped = false;
  for (const c of codons) {
    if (c.length < 3) aas.push(null);
    else if (stopped) aas.push(null);
    else if (isStop(c)) {
      aas.push("*");
      stopped = true;
    } else aas.push(aminoLetter(c));
  }
  return { codons, aas, stopped };
}

const ORIG = read(ORIGINAL);

function verdict(dna: string): { title: Text; text: Text; tone: "same" | "mild" | "bad" } {
  const r = read(dna);
  if (dna === ORIGINAL) return { title: tx("Original", "Ausgangssequenz"), text: tx("Tap a base to change it.", "Tipp auf eine Base, um sie zu verändern."), tone: "same" };
  if (!dna.startsWith("ATG"))
    return {
      title: tx("Start codon destroyed", "Startcodon zerstört"),
      text: tx("Without AUG the ribosome doesn't start here. Most likely no β chain is made at all.", "Ohne AUG startet das Ribosom hier nicht. Wahrscheinlich entsteht gar keine β-Kette."),
      tone: "bad",
    };
  const diff = dna.length - ORIGINAL.length;
  if (diff % 3 !== 0)
    return {
      title: tx("Frameshift mutation", "Rastermutation"),
      text: tx(
        `${diff > 0 ? "An insertion" : "A deletion"} of ${Math.abs(diff)} base${Math.abs(diff) === 1 ? "" : "s"} shifts the reading frame: every codon after it is read differently. The protein is usually useless.`,
        `${diff > 0 ? "Eine Insertion" : "Eine Deletion"} von ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "Base" : "Basen"} verschiebt das Leseraster: Jedes Codon danach wird anders gelesen. Das Protein ist meist funktionslos.`,
      ),
      tone: "bad",
    };
  if (diff !== 0)
    return {
      title: tx(diff > 0 ? "Whole triplet inserted" : "Whole triplet deleted", diff > 0 ? "Ganzes Triplett eingefügt" : "Ganzes Triplett deletiert"),
      text: tx(
        `${Math.abs(diff)} bases are a multiple of 3: the reading frame stays! ${diff > 0 ? "Amino acids are added" : "Amino acids are missing"}, the rest of the protein is unchanged.`,
        `${Math.abs(diff)} Basen sind ein Vielfaches von 3: Das Leseraster bleibt erhalten! ${diff > 0 ? "Es kommen Aminosäuren dazu" : "Es fehlen Aminosäuren"}, der Rest des Proteins bleibt gleich.`,
      ),
      tone: "mild",
    };
  const firstStop = r.aas.indexOf("*");
  if (firstStop >= 0)
    return {
      title: tx("Nonsense mutation", "Nonsense-Mutation"),
      text: tx("A stop codon appears too early: the protein breaks off and is too short.", "Ein Stoppcodon entsteht zu früh: Das Protein bricht ab und ist zu kurz."),
      tone: "bad",
    };
  const changed = r.aas.filter((a, i) => a !== ORIG.aas[i]).length;
  if (!changed)
    return {
      title: tx("Silent mutation", "Stumme Mutation"),
      text: tx("The base changed, but the new codon codes for the same amino acid (the code is degenerate). The protein stays the same.", "Die Base ist anders, aber das neue Codon codiert dieselbe Aminosäure (der Code ist degeneriert). Das Protein bleibt gleich."),
      tone: "same",
    };
  if (r.aas[6] === "V" && ORIG.aas[6] === "E" && changed === 1)
    return {
      title: tx("Missense mutation: sickle cell anaemia", "Missense-Mutation: Sichelzellanämie"),
      text: tx(
        "Exactly this one: glutamic acid (Glu) becomes valine (Val) at position 6 of the β chain. The haemoglobin clumps when oxygen is low and the red blood cells turn into sickles.",
        "Genau diese: Aus Glutaminsäure (Glu) wird an Position 6 der β-Kette Valin (Val). Das Hämoglobin verklumpt bei Sauerstoffmangel, und die roten Blutzellen werden sichelförmig.",
      ),
      tone: "bad",
    };
  return {
    title: tx("Missense mutation", "Missense-Mutation"),
    text: tx(
      `${changed === 1 ? "One amino acid is" : `${changed} amino acids are`} exchanged. Whether the protein still works depends on where and how different the new amino acid is.`,
      `${changed === 1 ? "Eine Aminosäure ist" : `${changed} Aminosäuren sind`} ausgetauscht. Ob das Protein noch funktioniert, hängt davon ab, wo und wie verschieden die neue Aminosäure ist.`,
    ),
    tone: "mild",
  };
}

/** Change, insert or delete single bases and watch the mRNA and the protein change. */
export function DnaMutation() {
  const t = useText();
  const [bases, setBases] = useState<Base[]>(fresh);
  const [mode, setMode] = useState<Mode>("sub");
  const [insertBase, setInsertBase] = useState("A");
  const [nextId, setNextId] = useState(ORIGINAL.length);
  const dna = bases.map((x) => x.b).join("");
  const r = read(dna);
  const v = verdict(dna);

  const tap = (i: number) => {
    if (mode === "sub") setBases(bases.map((x, k) => (k === i ? { ...x, b: NEXT[x.b], changed: NEXT[x.b] !== ORIGINAL[x.id] || x.id >= ORIGINAL.length } : x)));
    else if (mode === "ins") {
      setBases([...bases.slice(0, i), { b: insertBase, changed: true, id: nextId }, ...bases.slice(i)]);
      setNextId(nextId + 1);
    } else if (bases.length > 3) setBases(bases.filter((_, k) => k !== i));
  };

  const sickle = () => setBases(fresh().map((x) => (x.id === 19 ? { ...x, b: "T", changed: true } : x)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          label={t(tx("Kind of mutation", "Art der Mutation"))}
          options={[
            { id: "sub", label: t(tx("Exchange", "Austausch")) },
            { id: "ins", label: t(tx("Insert", "Einfügen")) },
            { id: "del", label: t(tx("Delete", "Löschen")) },
          ]}
        />
        {mode === "ins" && (
          <div className="flex items-center gap-1">
            {["A", "T", "G", "C"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setInsertBase(b)}
                aria-pressed={insertBase === b}
                aria-label={t(tx(`Insert ${b}`, `${b} einfügen`))}
                className={cn("grid size-8 place-items-center rounded-lg border-2 text-[14px] font-semibold text-ink", insertBase === b ? "scale-105" : "opacity-60")}
                style={{ borderColor: insertBase === b ? "var(--blob)" : BASE_COLOR[b], background: baseTint(b, 25) }}
              >
                {b}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <StepButton onClick={sickle} label={t(tx("Show the sickle cell mutation", "Sichelzell-Mutation zeigen"))}>
            {t(tx("Sickle cell", "Sichelzelle"))}
          </StepButton>
          <StepButton onClick={() => setBases(fresh())} disabled={dna === ORIGINAL} label={t(tx("Back to the original", "Zurück zum Original"))}>
            <RotateCcw className="size-4" />
          </StepButton>
        </div>
      </div>

      <p className="text-[13px] text-ink-3">
        {t(
          mode === "sub"
            ? tx("Tap a DNA base to exchange it (tap again for the next base).", "Tipp auf eine DNA-Base, um sie auszutauschen (nochmal tippen für die nächste Base).")
            : mode === "ins"
              ? tx(`Tap a DNA base: ${insertBase} is inserted in front of it.`, `Tipp auf eine DNA-Base: Davor wird ${insertBase} eingefügt.`)
              : tx("Tap a DNA base to delete it.", "Tipp auf eine DNA-Base, um sie zu löschen."),
        )}
      </p>

      <motion.div layout className="flex flex-wrap gap-x-3 gap-y-3">
        {r.codons.map((codon, ci) => {
          const aa = r.aas[ci];
          // Compare with the original codon these bases came from (an indel shifts the positions).
          const ids = bases.slice(ci * 3, ci * 3 + 3).map((x) => x.id);
          const k = ids[0] / 3;
          const aligned = ids.length === 3 && Number.isInteger(k) && ids[1] === ids[0] + 1 && ids[2] === ids[0] + 2 && k < ORIG.aas.length;
          const orig = aligned ? ORIG.aas[k] : null;
          const after = r.stopped && r.aas.indexOf("*") < ci;
          return (
            <motion.div layout key={ci} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface px-1.5 py-1.5" transition={{ type: "spring", stiffness: 400, damping: 34 }}>
              <div className="flex gap-[2px]">
                {[...codon].map((b, k) => {
                  const idx = ci * 3 + k;
                  const base = bases[idx];
                  return (
                    <motion.button
                      layout
                      key={base.id}
                      type="button"
                      onClick={() => tap(idx)}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t(tx(`Base ${idx + 1}: ${b}`, `Base ${idx + 1}: ${b}`))}
                      className="grid size-[26px] place-items-center rounded-md border-2 text-[13px] font-semibold text-ink"
                      style={{ background: baseTint(b), borderColor: base.changed ? "var(--blob)" : BASE_COLOR[b], boxShadow: base.changed ? "0 0 0 2px color-mix(in oklab, var(--blob) 30%, transparent)" : undefined }}
                    >
                      {b}
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex gap-[2px]">
                {[...toRna(codon)].map((b, k) => (
                  <span key={k} className="grid size-[26px] place-items-center rounded-md text-[12.5px] font-semibold text-ink-2" style={{ background: baseTint(b, 18) }}>
                    {b}
                  </span>
                ))}
              </div>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={`${aa}-${ci}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "min-w-[44px] rounded-full px-2 py-0.5 text-center text-[12.5px] font-semibold",
                    aa === null || after ? "text-ink-3" : aa === "*" ? "bg-danger/15 text-danger" : aa !== orig ? "bg-blob text-white" : "bg-hover text-ink",
                  )}
                >
                  {aa === null || after ? "–" : aa === "*" ? t(tx("Stop", "Stopp")) : AMINO[aa].abbr}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
      <p className="text-[12px] text-ink-3">
        {t(tx("Each box: DNA triplet (coding strand) · mRNA codon · amino acid. The gene goes on after these 9 codons.", "Jedes Kästchen: DNA-Triplett (codierender Strang) · mRNA-Codon · Aminosäure. Nach diesen 9 Codons geht das Gen noch weiter."))}
      </p>

      <motion.div
        key={dna}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border px-3.5 py-2.5 text-[14px] leading-snug", v.tone === "bad" ? "border-danger/40 bg-danger/5" : v.tone === "mild" ? "border-blob/40 bg-blob-soft/40" : "border-line bg-surface")}
        aria-live="polite"
      >
        <span className="font-semibold text-ink">{t(v.title)}: </span>
        <span className="text-ink-2">{t(v.text)}</span>
      </motion.div>
    </div>
  );
}
