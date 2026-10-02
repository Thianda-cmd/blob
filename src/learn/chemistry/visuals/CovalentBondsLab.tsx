"use client";

import { AnimatePresence, motion } from "motion/react";
import { Link2, Unlink } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { element, valenceElectrons } from "../elements";
import { bondPairs, LewisStructure, lonePairs, MOLECULES, valenceTotal, type PairStyle } from "./CovalentBondsLewis";

// Two widgets around the Lewis renderer: watch single electrons pair up into a shared
// pair (H₂, Cl₂, HCl), and explore Lewis structures of common molecules.

function Segmented<T extends string>({ value, options, onChange, scope }: { value: T; options: [T, string][]; onChange: (v: T) => void; scope: string }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("relative rounded-md px-2.5 py-1.5 text-[13px] font-medium", value === v ? "text-ink" : "text-ink-3 hover:text-ink")}>
          {value === v && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

function MolChips({ ids, value, onPick, scope }: { ids: string[]; value: string; onPick: (id: string) => void; scope: string }) {
  const t = useText();
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          aria-label={t(MOLECULES[id].name)}
          className={cn("relative h-9 min-w-11 rounded-lg border px-2.5 transition-colors", id === value ? "border-transparent text-white" : "border-line text-ink hover:bg-hover")}
        >
          {id === value && <motion.span layoutId={`${scope}-mol`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
          <span className="relative">
            <MathView src={`\\ce{${MOLECULES[id].formula}}`} size="sm" animate={false} />
          </span>
        </button>
      ))}
    </div>
  );
}

function BondButton({ bonded, onToggle }: { bonded: boolean; onToggle: () => void }) {
  const t = useText();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold transition-colors", bonded ? "border border-line text-ink-2 hover:bg-hover hover:text-ink" : "bg-blob text-white hover:bg-blob-deep")}
    >
      {bonded ? <Unlink className="size-4" /> : <Link2 className="size-4" />}
      {bonded ? t(tx("Pull apart", "Trennen")) : t(tx("Bond", "Verbinden"))}
    </button>
  );
}

const SHARE_TEXT: Record<string, { apart: Text; bonded: Text }> = {
  H2: {
    apart: tx("Each hydrogen atom has just 1 electron. Neither wants to give it away.", "Jedes Wasserstoffatom hat nur 1 Elektron. Keines will es abgeben."),
    bonded: tx(
      "The two single electrons form one **shared pair**. It belongs to both atoms, so each now has 2 electrons, like helium.",
      "Die beiden einzelnen Elektronen bilden ein **gemeinsames Elektronenpaar**. Es gehört beiden Atomen, also hat jedes jetzt 2 Elektronen, wie Helium.",
    ),
  },
  Cl2: {
    apart: tx("Each chlorine atom has 7 outer electrons: 3 pairs and one single electron. One is missing for the octet.", "Jedes Chloratom hat 7 Außenelektronen: 3 Paare und ein einzelnes Elektron. Zum Oktett fehlt eins."),
    bonded: tx(
      "The two single electrons pair up between the atoms. The shared pair counts for both: each chlorine atom now has 8.",
      "Die beiden einzelnen Elektronen bilden zwischen den Atomen ein Paar. Das gemeinsame Paar zählt für beide: Jedes Chloratom hat jetzt 8.",
    ),
  },
  HCl: {
    apart: tx("Hydrogen brings 1 electron, chlorine has 7 outer electrons. Both are missing exactly one.", "Wasserstoff bringt 1 Elektron mit, Chlor hat 7 Außenelektronen. Beiden fehlt genau eins."),
    bonded: tx("One shared pair: hydrogen now has 2 (like helium), chlorine 8 (like argon).", "Ein gemeinsames Paar: Wasserstoff hat jetzt 2 (wie Helium), Chlor 8 (wie Argon)."),
  },
};

/** Single electrons pair up into a shared electron pair. */
export function CovalentBondsShare() {
  const t = useText();
  const scope = useId();
  const [mol, setMol] = useState("Cl2");
  const [bonded, setBonded] = useState(false);
  const [style, setStyle] = useState<"dots" | "lewis">("dots");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MolChips
          ids={["H2", "Cl2", "HCl"]}
          value={mol}
          onPick={(id) => {
            setMol(id);
            setBonded(false);
            setStyle("dots");
          }}
          scope={scope}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {bonded && <Segmented value={style} onChange={setStyle} scope={`${scope}-s`} options={[["dots", t(tx("Dots", "Punkte"))], ["lewis", t(tx("Bond line", "Bindungsstrich"))]]} />}
          <BondButton bonded={bonded} onToggle={() => setBonded((x) => !x)} />
        </div>
      </div>
      <div className="grid min-h-[190px] place-items-center overflow-hidden rounded-xl border border-line bg-surface px-2 py-3">
        <LewisStructure mol={mol} bonded={bonded} pairStyle={style} octet={bonded} unit={104} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={`${mol}-${bonded}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          <Bold text={t(bonded ? SHARE_TEXT[mol].bonded : SHARE_TEXT[mol].apart)} />
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** "**bold**" in a plain caption. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const LAB = ["H2O", "NH3", "CH4", "CO2", "O2", "N2", "HCl", "Cl2"];

/** Valence electrons as a sum: "6 + 2 \cdot 1 = 8". */
export function valenceSum(id: string): string {
  const m = MOLECULES[id];
  const counts = new Map<string, number>();
  for (const a of m.atoms) counts.set(a.el, (counts.get(a.el) ?? 0) + 1);
  const parts = [...counts].sort((a, b) => a[1] - b[1]).map(([el, n]) => {
    const v = valenceElectrons(element(el)!) ?? 0;
    return n === 1 ? `${v}` : `${n} \\cdot ${v}`;
  });
  return `${parts.join(" + ")} = ${valenceTotal(m)}`;
}

/** Explore Lewis structures: dots, Lewis style or Valenzstrichformel, with an octet check. */
export function CovalentBondsLewisLab() {
  const t = useText();
  const scope = useId();
  const [mol, setMol] = useState("H2O");
  const [style, setStyle] = useState<PairStyle>("lewis");
  const [octet, setOctet] = useState(false);
  const [bonded, setBonded] = useState(true);
  const m = MOLECULES[mol];
  const bp = bondPairs(m);
  const lp = lonePairs(m);
  const pairsText = tx(
    `${valenceTotal(m) / 2} electron pairs: ${bp} bonding, ${lp} lone`,
    `${valenceTotal(m) / 2} Elektronenpaare: ${bp} bindend, ${lp} frei`,
  );
  return (
    <div className="space-y-4">
      <MolChips
        ids={LAB}
        value={mol}
        onPick={(id) => {
          setMol(id);
          setBonded(true);
        }}
        scope={scope}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={style}
          onChange={setStyle}
          scope={`${scope}-st`}
          options={[
            ["dots", t(tx("Dots", "Punkte"))],
            ["lewis", t(tx("Lewis", "Lewis"))],
            ["lines", t(tx("Lines", "Striche"))],
          ]}
        />
        <button
          type="button"
          aria-pressed={octet}
          onClick={() => setOctet((x) => !x)}
          className={cn("h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors", octet ? "border-transparent bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {t(tx("Check the octet", "Oktett prüfen"))}
        </button>
        <div className="ml-auto">
          <BondButton bonded={bonded} onToggle={() => setBonded((x) => !x)} />
        </div>
      </div>
      <div className="grid min-h-[230px] place-items-center overflow-hidden rounded-xl border border-line bg-surface px-2 py-3">
        <LewisStructure mol={mol} bonded={bonded} pairStyle={style} octet={octet} unit={88} />
      </div>
      <div className="grid gap-2 rounded-xl border border-line px-4 py-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Outer electrons", "Valenzelektronen"))}</span>
        <MathView src={valenceSum(mol)} size="md" scope={`${scope}-v`} />
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Pairs", "Paare"))}</span>
        <span className="text-[14px] text-ink">{t(pairsText)}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-3">
        {style === "lines"
          ? t(tx("Valenzstrichformel: every electron pair is a line, bonding pairs between the atoms, lone pairs at the atom.", "Valenzstrichformel: Jedes Elektronenpaar ist ein Strich, bindende zwischen den Atomen, freie am Atom."))
          : style === "dots"
            ? t(tx("Every dot is one outer electron. Two dots between atoms are a shared pair.", "Jeder Punkt ist ein Außenelektron. Zwei Punkte zwischen den Atomen sind ein gemeinsames Paar."))
            : t(tx("Lewis formula: bonding pairs as lines, lone pairs as two dots.", "Lewis-Formel: bindende Paare als Striche, freie Elektronenpaare als zwei Punkte."))}
      </p>
    </div>
  );
}

const DIPOLE: { id: string; dipole: boolean; text: Text }[] = [
  {
    id: "HCl",
    dipole: true,
    text: tx("One polar bond: chlorine is δ−, hydrogen δ+. The two charge centres are apart, so HCl is a dipole.", "Eine polare Bindung: Chlor ist δ−, Wasserstoff δ+. Die beiden Ladungsschwerpunkte liegen auseinander, also ist HCl ein Dipol."),
  },
  {
    id: "H2O",
    dipole: true,
    text: tx(
      "Water is **bent**. The negative centre sits at the O atom, the positive one between the H atoms. They don't coincide: a dipole.",
      "Wasser ist **gewinkelt**. Der negative Schwerpunkt liegt am O-Atom, der positive zwischen den H-Atomen. Sie fallen nicht zusammen: ein Dipol.",
    ),
  },
  {
    id: "NH3",
    dipole: true,
    text: tx(
      "Ammonia is a **pyramid** with the lone pair on top. δ− at N, δ+ at the H atoms below: a dipole.",
      "Ammoniak ist eine **Pyramide** mit dem freien Elektronenpaar an der Spitze. δ− am N, δ+ an den H-Atomen darunter: ein Dipol.",
    ),
  },
  {
    id: "CO2",
    dipole: false,
    text: tx(
      "Both C=O bonds are polar, but the molecule is **linear**. The negative centre lies exactly on the carbon atom: the charges cancel. No dipole!",
      "Beide C=O-Bindungen sind polar, aber das Molekül ist **linear**. Der negative Schwerpunkt liegt genau auf dem C-Atom: Die Ladungen heben sich auf. Kein Dipol!",
    ),
  },
  {
    id: "CCl4",
    dipole: false,
    text: tx(
      "Four polar C–Cl bonds, pointing to the corners of a **tetrahedron**. Perfectly symmetric: both centres lie on the C atom. No dipole.",
      "Vier polare C–Cl-Bindungen, die in die Ecken eines **Tetraeders** zeigen. Perfekt symmetrisch: Beide Schwerpunkte liegen auf dem C-Atom. Kein Dipol.",
    ),
  },
  {
    id: "CH4",
    dipole: false,
    text: tx("The C–H bonds are nearly nonpolar, and the molecule is symmetric anyway. No dipole.", "Die C–H-Bindungen sind nahezu unpolar, und das Molekül ist sowieso symmetrisch. Kein Dipol."),
  },
];

/** Polar bonds plus shape: where are the centres of positive and negative charge? */
export function CovalentBondsDipole() {
  const t = useText();
  const scope = useId();
  const [mol, setMol] = useState("H2O");
  const d = DIPOLE.find((x) => x.id === mol) ?? DIPOLE[0];
  return (
    <div className="space-y-4">
      <MolChips ids={DIPOLE.map((x) => x.id)} value={mol} onPick={setMol} scope={scope} />
      <div className="relative grid min-h-[230px] place-items-center overflow-hidden rounded-xl border border-line bg-surface px-2 py-3">
        <LewisStructure mol={mol} partial centres unit={88} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mol}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn("absolute right-3 top-3 rounded-full px-2.5 py-1 text-[12px] font-semibold", d.dipole ? "bg-blob text-white" : "bg-hover text-ink-2")}
          >
            {d.dipole ? t(tx("dipole", "Dipol")) : t(tx("no dipole", "kein Dipol"))}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3.5 rounded-full border-2 border-blob" /> {t(tx("centre of negative charge", "Schwerpunkt der negativen Ladung"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3.5 rounded-full border-2 border-dashed border-ink-2" /> {t(tx("centre of positive charge", "Schwerpunkt der positiven Ladung"))}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={mol} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          <Bold text={t(d.text)} />
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
