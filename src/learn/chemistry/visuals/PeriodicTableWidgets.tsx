"use client";

// Interactive pieces for the "periodic-table" topic: an explorer that links an element's
// position to its atom, a family map, and the noble gas configuration lab.

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES, ELEMENTS, element, mainGroup, shells, type Element } from "../elements";
import { AtomShells, ionShells } from "./AtomShells";
import { PeriodicTable } from "./PeriodicTable";

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** Metal, metalloid or nonmetal in the school sense. */
export function metalKind(e: Element): "metal" | "metalloid" | "nonmetal" {
  if (e.category === "metalloid") return "metalloid";
  if (e.category === "nonmetal" || e.category === "halogen" || e.category === "noble-gas") return "nonmetal";
  return "metal";
}

/** A chemical equation that only wraps between species: "2Na + Cl2 -> 2NaCl". */
export const eqn = (src: string) =>
  src
    .split(/\s+(->|\+)\s+/)
    .map((part, i) => (i % 2 ? (part === "->" ? "\\to" : "+") : `\\group{\\ce{${part}}}`))
    .join(" ");

const KIND_NAMES: Record<string, Text> = {
  metal: tx("metal", "Metall"),
  metalloid: tx("metalloid", "Halbmetall"),
  nonmetal: tx("nonmetal", "Nichtmetall"),
};

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

/** The table scrolls inside its own box on narrow phones. */
function TableBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[340px] max-sm:[zoom:0.9]">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explorer: position → atom

export function PeriodicTableExplorer() {
  const t = useText();
  const [sym, setSym] = useState("S");
  const [show, setShow] = useState<"period" | "group">("period");
  const e = element(sym)!;
  const g = mainGroup(e)!;
  const layers = shells(e.z);
  const outer = layers[layers.length - 1];
  const lit = ELEMENTS.filter((x) => x.period <= 6 && mainGroup(x) !== null && (show === "period" ? x.period === e.period : mainGroup(x) === g)).map((x) => x.symbol);
  const family = e.category === "alkali" || e.category === "alkaline-earth" || e.category === "halogen" || e.category === "noble-gas" ? CATEGORY_NAMES[e.category] : null;
  const row = (id: "period" | "group", left: string, right: string) => (
    <button
      type="button"
      onClick={() => setShow(id)}
      aria-pressed={show === id}
      className={cn(
        "flex w-full flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-2 text-left text-[14px] transition-colors",
        show === id ? "border-blob/50 bg-blob-soft/60" : "border-line hover:bg-hover",
      )}
    >
      <span className="text-ink-2">{left}</span>
      <span className="text-ink-3">→</span>
      <span className={cn("font-semibold", id === "group" ? "text-blob-ink" : "text-ink")}>{right}</span>
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,290px)] lg:items-start">
      <TableBox>
        <PeriodicTable mode="main" shade="none" details={false} selected={sym} onSelect={setSym} highlight={lit} />
      </TableBox>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={sym}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="space-y-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-blob text-white">
              <div className="text-center leading-none">
                <div className="text-[10px] tabular-nums opacity-80">{e.z}</div>
                <div className="mt-0.5 text-[22px] font-bold">{e.symbol}</div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[17px] font-semibold text-ink">{t(e.name)}</div>
              <div className="text-[12.5px] text-ink-3">
                {t(KIND_NAMES[metalKind(e)])}
                {family ? ` · ${t(family)}` : ""}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {row("period", t(tx(`Period ${e.period}`, `Periode ${e.period}`)), t(tx(`${e.period} ${e.period === 1 ? "shell" : "shells"}`, `${e.period} ${e.period === 1 ? "Schale" : "Schalen"}`)))}
            {row("group", t(tx(`Main group ${ROMAN[g]}`, `Hauptgruppe ${ROMAN[g]}`)), t(tx(`${outer} outer ${outer === 1 ? "electron" : "electrons"}`, `${outer} ${outer === 1 ? "Außenelektron" : "Außenelektronen"}`)))}
            {e.z === 2 && <div className="text-[12.5px] text-ink-3">{t(tx("Helium is the exception: its only shell is full with 2.", "Helium ist die Ausnahme: Seine einzige Schale ist mit 2 schon voll."))}</div>}
          </div>
          <div className="flex items-center gap-3">
            <AtomShells z={e.z} size={128} />
            <div className="text-[12.5px] leading-relaxed text-ink-3">
              <div className="font-math text-[15px] text-ink-2">{layers.join(" · ")}</div>
              {t(tx(`${e.z} protons, ${e.z} electrons`, `${e.z} Protonen, ${e.z} Elektronen`))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Families and metals

type Tab = "metals" | "alkali" | "alkaline-earth" | "halogen" | "noble-gas";

const FAMILY_INFO: Record<Exclude<Tab, "metals">, { group: number; points: Text[]; math: string; trend: Text; down: boolean }> = {
  alkali: {
    group: 1,
    points: [
      tx("**1 outer electron**. Soft, shiny metals: you can cut them with a knife.", "**1 Außenelektron**. Weiche, glänzende Metalle: Man kann sie mit dem Messer schneiden."),
      tx("React violently with water: hydrogen and an alkaline solution form.", "Reagieren heftig mit Wasser: Es entstehen Wasserstoff und eine Lauge."),
      tx("Kept under paraffin oil so they can't react with air and moisture.", "Werden unter Paraffinöl aufbewahrt, damit sie nicht mit Luft und Feuchtigkeit reagieren."),
    ],
    math: eqn("2Na + 2H2O -> 2NaOH + H2"),
    trend: tx("Reactivity increases from top to bottom.", "Die Reaktionsfähigkeit nimmt von oben nach unten zu."),
    down: true,
  },
  "alkaline-earth": {
    group: 2,
    points: [
      tx("**2 outer electrons**. Light metals, harder than the alkali metals.", "**2 Außenelektronen**. Leichtmetalle, härter als die Alkalimetalle."),
      tx("React with water more calmly than the alkali metals. Magnesium needs hot water.", "Reagieren ruhiger mit Wasser als die Alkalimetalle. Magnesium braucht heißes Wasser."),
      tx("Calcium is found in limestone, chalk and your bones.", "Calcium steckt in Kalkstein, Kreide und deinen Knochen."),
    ],
    math: eqn("Ca + 2H2O -> Ca(OH)2 + H2"),
    trend: tx("Reactivity increases from top to bottom.", "Die Reaktionsfähigkeit nimmt von oben nach unten zu."),
    down: true,
  },
  halogen: {
    group: 7,
    points: [
      tx("**7 outer electrons**. They form molecules of two atoms: $\\ce{F2}$, $\\ce{Cl2}$, $\\ce{Br2}$, $\\ce{I2}$.", "**7 Außenelektronen**. Sie bilden Moleküle aus zwei Atomen: $\\ce{F2}$, $\\ce{Cl2}$, $\\ce{Br2}$, $\\ce{I2}$."),
      tx("“Salt formers”: with metals they react to salts.", "„Salzbildner“: Mit Metallen reagieren sie zu Salzen."),
      tx("At room temperature fluorine and chlorine are gases, bromine is a liquid, iodine a solid.", "Bei Raumtemperatur sind Fluor und Chlor Gase, Brom ist flüssig, Iod fest."),
    ],
    math: eqn("2Na + Cl2 -> 2NaCl"),
    trend: tx("Reactivity decreases from top to bottom.", "Die Reaktionsfähigkeit nimmt von oben nach unten ab."),
    down: false,
  },
  "noble-gas": {
    group: 8,
    points: [
      tx("**Full outer shell**: 8 electrons (helium: 2).", "**Volle Außenschale**: 8 Elektronen (Helium: 2)."),
      tx("They hardly react at all and exist as single atoms.", "Sie reagieren kaum und kommen als einzelne Atome vor."),
      tx("Helium fills balloons, neon glows in signs, argon protects metal when welding.", "Helium füllt Ballons, Neon leuchtet in Reklameröhren, Argon schützt beim Schweißen."),
    ],
    math: "\\group{\\ce{He} \\; 2} \\quad \\group{\\ce{Ne} \\; 2, 8} \\quad \\group{\\ce{Ar} \\; 2, 8, 8}",
    trend: tx("Boiling points increase from top to bottom.", "Die Siedetemperaturen nehmen von oben nach unten zu."),
    down: true,
  },
};

export function PeriodicTableFamilies() {
  const t = useText();
  const scope = useId();
  const [tab, setTab] = useState<Tab>("metals");
  const tabs: [Tab, Text][] = [
    ["metals", tx("Metals and nonmetals", "Metalle und Nichtmetalle")],
    ["alkali", CATEGORY_NAMES.alkali],
    ["alkaline-earth", CATEGORY_NAMES["alkaline-earth"]],
    ["halogen", CATEGORY_NAMES.halogen],
    ["noble-gas", CATEGORY_NAMES["noble-gas"]],
  ];
  const info = tab === "metals" ? null : FAMILY_INFO[tab];
  const members = info ? ELEMENTS.filter((e) => e.period <= 6 && e.category === tab).map((e) => e.symbol) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("relative rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors", tab === id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {tab === id && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start">
        <TableBox>
          <PeriodicTable mode="main" shade={tab === "metals" ? "metals" : "category"} details={false} highlight={members} focus={tab !== "metals"} />
        </TableBox>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 rounded-xl border border-line bg-surface p-4 text-[13.5px] leading-relaxed text-ink-2">
            {info ? (
              <>
                <div className="text-[16px] font-semibold text-ink">
                  {t(tabs.find(([id]) => id === tab)![1])} <span className="font-normal text-ink-3">· {t(tx(`main group ${ROMAN[info.group]}`, `Hauptgruppe ${ROMAN[info.group]}`))}</span>
                </div>
                <ul className="space-y-1.5">
                  {info.points.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-blob" />
                      <span>
                        <InlineRich text={t(p)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="overflow-x-auto rounded-lg bg-raised px-3 py-2">
                  <MathView src={info.math} size="md" animate={false} />
                </div>
                <div className="flex items-center gap-2 font-medium text-ink">
                  {info.down ? <ArrowDown className="size-4 shrink-0 text-blob-ink" /> : <ArrowUp className="size-4 shrink-0 text-blob-ink" />}
                  {t(info.trend)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[16px] font-semibold text-ink">{t(tx("Metals and nonmetals", "Metalle und Nichtmetalle"))}</div>
                <p>
                  <Bold text={t(tx("**Metals** are on the left and at the bottom: most elements are metals. They shine, conduct electricity and heat and can be bent.", "**Metalle** stehen links und unten: Die meisten Elemente sind Metalle. Sie glänzen, leiten Strom und Wärme und lassen sich verformen."))} />
                </p>
                <p>
                  <Bold text={t(tx("**Nonmetals** are at the top right, plus hydrogen. Many are gases, and they hardly conduct electricity.", "**Nichtmetalle** stehen oben rechts, dazu der Wasserstoff. Viele sind Gase, und sie leiten Strom kaum."))} />
                </p>
                <p>
                  <Bold text={t(tx("**Metalloids** sit on the staircase in between: boron, silicon, germanium, arsenic, antimony, tellurium.", "**Halbmetalle** stehen an der Treppe dazwischen: Bor, Silicium, Germanium, Arsen, Antimon, Tellur."))} />
                </p>
                <p className="font-medium text-ink">{t(tx("Within a main group, the metallic character increases from top to bottom.", "Innerhalb einer Hauptgruppe nimmt der Metallcharakter von oben nach unten zu."))}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Text with $\ce{…}$ and **bold**. */
function InlineRich({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((part, i) =>
          part.startsWith("$") ? (
            <MathView key={i} src={part.slice(1, -1)} size="inline" animate={false} className="mx-[0.1em] align-middle" />
          ) : part.startsWith("**") ? (
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

// ---------------------------------------------------------------------------
// Noble gas configuration lab

const LAB = ["Li", "Na", "Mg", "Al", "N", "O", "F", "P", "S", "Cl"];
const NOBLE_BY_E: Record<number, string> = { 2: "He", 10: "Ne", 18: "Ar" };

const ionSrc = (sym: string, q: number) => (q === 0 ? `\\ce{${sym}}` : `\\ce{${sym}^${Math.abs(q) > 1 ? Math.abs(q) : ""}${q > 0 ? "+" : "-"}}`);

export function PeriodicTableNobleGas() {
  const t = useText();
  const [sym, setSym] = useState("Na");
  const [q, setQ] = useState(0);
  const e = element(sym)!;
  const outer = shells(e.z)[shells(e.z).length - 1];
  const maxGive = outer;
  const maxTake = 8 - outer;
  const layers = ionShells(e.z, q);
  const electrons = e.z - q;
  const noble = NOBLE_BY_E[electrons] && layers.join() === shells(electrons).join() ? NOBLE_BY_E[electrons] : null;
  const moved = Math.abs(q);
  const short = Math.min(maxGive, maxTake);
  const metal = maxGive <= 3;
  const name = (l: "en" | "de") => resolveText(e.name, l);

  const status: Text = (() => {
    if (q === 0)
      return tx(
        `Neutral ${name("en").toLowerCase()} atom: ${outer} outer ${outer === 1 ? "electron" : "electrons"}. To get a full outer shell it can give away ${maxGive} or take up ${maxTake}.`,
        `Neutrales ${name("de")}atom: ${outer} ${outer === 1 ? "Außenelektron" : "Außenelektronen"}. Für eine volle Außenschale kann es ${maxGive} abgeben oder ${maxTake} aufnehmen.`,
      );
    if (noble && moved === short)
      return tx(
        `**Noble gas configuration**, just like ${noble}! That's the short way, and it's what ${name("en").toLowerCase()} really does.`,
        `**Edelgaskonfiguration**, genau wie ${noble}! Das ist der kurze Weg, und genau so macht es ${name("de")} wirklich.`,
      );
    if (noble)
      return tx(
        `Noble gas configuration like ${noble}, but the long way: moving ${moved} electrons is far harder. ${name("en")} ${metal ? `gives away ${short}` : `takes up ${short}`} instead.`,
        `Edelgaskonfiguration wie ${noble}, aber auf dem langen Weg: ${moved} Elektronen zu bewegen ist viel schwerer. ${name("de")} ${metal ? `gibt stattdessen ${short} ab` : `nimmt stattdessen ${short} auf`}.`,
      );
    return tx(`Not there yet: the outer shell has ${layers[layers.length - 1] ?? 0} electrons.`, `Noch nicht geschafft: Auf der Außenschale sind ${layers[layers.length - 1] ?? 0} Elektronen.`);
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LAB.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSym(s);
              setQ(0);
            }}
            className={cn("h-9 min-w-10 rounded-lg border px-2.5 text-[14px] font-semibold transition-colors", s === sym ? "border-blob bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:items-center">
        <div className="flex flex-col items-center gap-2">
          <AtomShells z={e.z} charge={q} size={220} />
          <MathView src={ionSrc(sym, q)} size="lg" animate={false} />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQ(q + 1)}
              disabled={q >= maxGive}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink hover:bg-hover disabled:opacity-35"
            >
              <Minus className="size-4" /> {t(tx("Give away an electron", "Elektron abgeben"))}
            </button>
            <button
              type="button"
              onClick={() => setQ(q - 1)}
              disabled={q <= -maxTake}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink hover:bg-hover disabled:opacity-35"
            >
              <Plus className="size-4" /> {t(tx("Take up an electron", "Elektron aufnehmen"))}
            </button>
            {q !== 0 && (
              <button type="button" onClick={() => setQ(0)} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                <RotateCcw className="size-3.5" /> {t(tx("Reset", "Zurücksetzen"))}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px] sm:max-w-[360px]">
            <div className="rounded-lg border border-line bg-surface px-3 py-2">
              <div className="text-ink-3">{t(tx("Shells", "Schalen"))}</div>
              <div className="font-math text-[17px] text-ink">{layers.join(" · ") || "0"}</div>
            </div>
            <div className="rounded-lg border border-line bg-surface px-3 py-2">
              <div className="text-ink-3">{q > 0 ? t(tx("Given away", "Abgegeben")) : q < 0 ? t(tx("Taken up", "Aufgenommen")) : t(tx("Charge", "Ladung"))}</div>
              <div className="font-math text-[17px] text-ink">{q === 0 ? "0" : `${moved} e⁻`}</div>
            </div>
          </div>
          <motion.p key={`${sym}${q}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("text-[14px] leading-relaxed", noble ? "text-ink" : "text-ink-2")}>
            <Bold text={t(status)} />
          </motion.p>
        </div>
      </div>
    </div>
  );
}
