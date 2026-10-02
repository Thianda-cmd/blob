// A small model of a separation lab for the "mixtures" topic. A beaker holds a mixture; each
// step (magnet, sieve, add water, filter, decant, evaporate, distil) acts on it the way it does
// in school, and separated substances go onto the shelf. The widget plays with it, and the task
// generator uses it to check that an order of steps really works (or why it fails).

import { tx, type Text } from "@/i18n/text";

export type Comp = "salt" | "sugar" | "sand" | "iron" | "gravel" | "sulfur" | "water" | "ethanol";
export type Step = "magnet" | "sieve" | "dissolve" | "filter" | "decant" | "evaporate" | "distil";

type CompInfo = { name: Text; soluble?: boolean; magnetic?: boolean; coarse?: boolean; liquid?: boolean; bp?: number; plural?: boolean };

export const COMPS: Record<Comp, CompInfo> = {
  salt: { name: tx("salt", "Salz"), soluble: true },
  sugar: { name: tx("sugar", "Zucker"), soluble: true },
  sand: { name: tx("sand", "Sand") },
  iron: { name: tx("iron filings", "Eisenspäne"), magnetic: true, plural: true },
  gravel: { name: tx("gravel", "Kies"), coarse: true },
  sulfur: { name: tx("sulfur", "Schwefel") },
  water: { name: tx("water", "Wasser"), liquid: true, bp: 100 },
  ethanol: { name: tx("alcohol (ethanol)", "Alkohol (Ethanol)"), liquid: true, bp: 78 },
};

export const STEPS: Record<Step, { name: Text; property: Text }> = {
  magnet: { name: tx("Magnetic separation", "Magnetscheiden"), property: tx("magnetism", "Magnetisierbarkeit") },
  sieve: { name: tx("Sieving", "Sieben"), property: tx("particle size", "Teilchengröße") },
  dissolve: { name: tx("Dissolving in water", "Lösen in Wasser"), property: tx("solubility", "Löslichkeit") },
  filter: { name: tx("Filtering", "Filtrieren"), property: tx("particle size", "Teilchengröße") },
  decant: { name: tx("Settling and decanting", "Sedimentieren und Dekantieren"), property: tx("density", "Dichte") },
  evaporate: { name: tx("Evaporating", "Eindampfen"), property: tx("boiling temperature", "Siedetemperatur") },
  distil: { name: tx("Distilling", "Destillieren"), property: tx("boiling temperature", "Siedetemperatur") },
};

export type Vessel = { solids: Comp[]; dissolved: Comp[]; liquids: Comp[] };
export type Product = { comps: Comp[]; label: Text; lost?: boolean };
export type Outcome = { vessel: Vessel; products: Product[]; note: Text; ok: boolean };

const en = (t: Text) => (typeof t === "string" ? t : t.en);
const de = (t: Text) => (typeof t === "string" ? t : t.de);
/** "salt and sand", "Salz, Sand und Eisenspäne" */
export function namesOf(comps: Comp[]): Text {
  const list = (ns: string[], and: string) => (ns.length <= 1 ? ns.join("") : `${ns.slice(0, -1).join(", ")} ${and} ${ns[ns.length - 1]}`);
  return tx(list(comps.map((c) => en(COMPS[c].name)), "and"), list(comps.map((c) => de(COMPS[c].name)), "und"));
}
/** Verb agreement in German: "bleibt" / "bleiben". */
const many = (comps: Comp[]) => comps.length > 1 || COMPS[comps[0]].plural;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const isEmpty = (v: Vessel) => !v.solids.length && !v.dissolved.length && !v.liquids.length;
export const contentsOf = (v: Vessel): Comp[] => [...v.solids, ...v.dissolved, ...v.liquids];

/** One step on the beaker. `ok: false` means nothing happened (and `note` says why). */
export function apply(v: Vessel, step: Step): Outcome {
  const same = (note: Text): Outcome => ({ vessel: v, products: [], note, ok: false });
  const wet = v.liquids.length > 0;
  switch (step) {
    case "magnet": {
      if (!v.solids.includes("iron")) return same(tx("Nothing sticks to the magnet: there's nothing magnetic in here.", "Nichts bleibt am Magneten hängen: Hier ist nichts Magnetisches drin."));
      return {
        vessel: { ...v, solids: v.solids.filter((c) => c !== "iron") },
        products: [{ comps: ["iron"], label: tx("on the magnet", "am Magneten") }],
        note: tx("The magnet pulls out the iron filings. Everything else stays behind.", "Der Magnet zieht die Eisenspäne heraus. Alles andere bleibt zurück."),
        ok: true,
      };
    }
    case "sieve": {
      if (!v.solids.includes("gravel")) return same(tx("All the grains are smaller than the holes: everything falls through the sieve.", "Alle Körner sind kleiner als die Löcher: Alles fällt durchs Sieb."));
      return {
        vessel: { ...v, solids: v.solids.filter((c) => c !== "gravel") },
        products: [{ comps: ["gravel"], label: tx("in the sieve", "im Sieb") }],
        note: tx("The coarse gravel stays in the sieve. Everything finer falls through.", "Der grobe Kies bleibt im Sieb. Alles Feinere fällt durch."),
        ok: true,
      };
    }
    case "dissolve": {
      if (wet) return same(tx("There's already liquid in the beaker. More water changes nothing.", "Im Becherglas ist schon Flüssigkeit. Mehr Wasser ändert nichts."));
      const sol = v.solids.filter((c) => COMPS[c].soluble);
      const rest = v.solids.filter((c) => !COMPS[c].soluble);
      const N = namesOf(sol);
      const R = namesOf(rest);
      return {
        vessel: { solids: rest, dissolved: [...v.dissolved, ...sol], liquids: ["water"] },
        products: [],
        note: sol.length
          ? rest.length
            ? tx(`${cap(en(N))} dissolves in the water. ${cap(en(R))} ${many(rest) ? "don't" : "doesn't"} dissolve.`, `${de(N)} löst sich im Wasser auf. ${de(R)} ${many(rest) ? "lösen" : "löst"} sich nicht.`)
            : tx(`${cap(en(N))} dissolves completely: a clear solution.`, `${de(N)} löst sich ganz auf: eine klare Lösung.`)
          : tx(`Nothing dissolves: ${en(R)} just ${many(rest) ? "lie" : "lies"} in the water.`, `Nichts löst sich: ${de(R)} ${many(rest) ? "liegen" : "liegt"} nur im Wasser.`),
        ok: true,
      };
    }
    case "filter":
    case "decant": {
      if (!wet) return same(step === "filter" ? tx("Without a liquid nothing runs through the filter. Add water first?", "Ohne Flüssigkeit läuft nichts durch den Filter. Erst Wasser dazugeben?") : tx("There's no liquid to pour off.", "Da ist keine Flüssigkeit, die man abgießen könnte."));
      if (!v.solids.length) {
        return same(
          step === "filter"
            ? tx("Everything runs through: dissolved particles are far too small for the filter.", "Alles läuft durch: Gelöste Teilchen sind viel zu klein für den Filter.")
            : tx("Nothing settles: dissolved particles stay spread out in the liquid.", "Nichts setzt sich ab: Gelöste Teilchen bleiben in der Flüssigkeit verteilt."),
        );
      }
      const R = namesOf(v.solids);
      const left = contentsOf({ ...v, solids: [] });
      const L = v.dissolved.length ? tx(`${en(namesOf(v.dissolved))} solution`, `${de(namesOf(v.dissolved))}lösung`) : namesOf(left);
      return {
        vessel: { ...v, solids: [] },
        products: [{ comps: v.solids, label: step === "filter" ? tx("residue in the filter", "Rückstand im Filter") : tx("sediment", "Bodensatz") }],
        note:
          step === "filter"
            ? tx(`${cap(en(R))} ${many(v.solids) ? "stay" : "stays"} in the filter (residue). The filtrate runs through: ${en(L)}.`, `${de(R)} ${many(v.solids) ? "bleiben" : "bleibt"} im Filter (Rückstand). Das Filtrat läuft durch: ${de(L)}.`)
            : tx(`${cap(en(R))} ${many(v.solids) ? "settle" : "settles"} at the bottom. The liquid above is poured off: ${en(L)}.`, `${de(R)} ${many(v.solids) ? "setzen" : "setzt"} sich unten ab. Die Flüssigkeit darüber wird abgegossen: ${de(L)}.`),
        ok: true,
      };
    }
    case "evaporate": {
      if (!wet) return same(tx("There's no liquid to evaporate.", "Da ist keine Flüssigkeit zum Eindampfen."));
      const left = [...v.solids, ...v.dissolved];
      const gone = namesOf(v.liquids);
      return {
        vessel: { solids: [], dissolved: [], liquids: [] },
        products: [...(left.length ? [{ comps: left, label: tx("left in the dish", "Rückstand in der Schale") }] : []), { comps: v.liquids, label: tx("gone into the air", "in die Luft entwichen"), lost: true }],
        note: left.length
          ? tx(`The ${en(gone)} ${many(v.liquids) ? "boil" : "boils"} away into the air. ${cap(en(namesOf(left)))} ${many(left) ? "stay" : "stays"} behind.`, `${de(gone)} ${many(v.liquids) ? "verdampfen" : "verdampft"} in die Luft. ${de(namesOf(left))} ${many(left) ? "bleiben" : "bleibt"} zurück.`)
          : tx(`The ${en(gone)} ${many(v.liquids) ? "boil" : "boils"} away. Nothing is left.`, `${de(gone)} ${many(v.liquids) ? "verdampfen" : "verdampft"}. Nichts bleibt übrig.`),
        ok: true,
      };
    }
    case "distil": {
      if (!wet) return same(tx("There's no liquid to distil.", "Da ist keine Flüssigkeit zum Destillieren."));
      const order = [...v.liquids].sort((a, b) => (COMPS[a].bp ?? 0) - (COMPS[b].bp ?? 0));
      const left = [...v.solids, ...v.dissolved];
      const first = order[0];
      return {
        vessel: { solids: [], dissolved: [], liquids: [] },
        products: [...order.map((c) => ({ comps: [c], label: tx("distillate", "Destillat") })), ...(left.length ? [{ comps: left, label: tx("left in the flask", "Rückstand im Kolben") }] : [])],
        note:
          order.length > 1
            ? tx(
                `The ${en(COMPS[first].name)} boils first, at ${COMPS[first].bp} °C. It turns liquid again in the condenser and drips out. Then the ${en(COMPS[order[1]].name)} follows at ${COMPS[order[1]].bp} °C.`,
                `Zuerst siedet ${de(COMPS[first].name)} bei ${COMPS[first].bp} °C, wird im Kühler wieder flüssig und tropft heraus. Danach folgt ${de(COMPS[order[1]].name)} bei ${COMPS[order[1]].bp} °C.`,
              )
            : left.length
              ? tx(`The ${en(COMPS[first].name)} boils, turns liquid again in the condenser and is collected. ${cap(en(namesOf(left)))} ${many(left) ? "stay" : "stays"} behind.`, `${de(COMPS[first].name)} siedet, wird im Kühler wieder flüssig und aufgefangen. ${de(namesOf(left))} ${many(left) ? "bleiben" : "bleibt"} zurück.`)
              : tx(`The ${en(COMPS[first].name)} boils and is collected again.`, `${de(COMPS[first].name)} siedet und wird wieder aufgefangen.`),
        ok: true,
      };
    }
  }
}

export type Scenario = { id: string; name: Text; start: Vessel; goal: Comp[]; tools: Step[] };

export const SCENARIOS: Scenario[] = [
  { id: "salt-sand-iron", name: tx("Salt, sand and iron filings", "Salz, Sand und Eisenspäne"), start: { solids: ["salt", "sand", "iron"], dissolved: [], liquids: [] }, goal: ["salt", "sand", "iron"], tools: ["magnet", "sieve", "dissolve", "filter", "evaporate", "distil"] },
  { id: "gravel-sand-salt", name: tx("Gravel, sand and salt", "Kies, Sand und Salz"), start: { solids: ["gravel", "sand", "salt"], dissolved: [], liquids: [] }, goal: ["gravel", "sand", "salt"], tools: ["magnet", "sieve", "dissolve", "filter", "evaporate", "distil"] },
  { id: "salt-water", name: tx("Salt water: get salt and water", "Salzwasser: Salz und Wasser gewinnen"), start: { solids: [], dissolved: ["salt"], liquids: ["water"] }, goal: ["salt", "water"], tools: ["magnet", "sieve", "filter", "decant", "evaporate", "distil"] },
  { id: "wine", name: tx("Alcohol and water", "Alkohol und Wasser"), start: { solids: [], dissolved: [], liquids: ["ethanol", "water"] }, goal: ["ethanol", "water"], tools: ["sieve", "filter", "decant", "evaporate", "distil"] },
  { id: "mud", name: tx("Muddy water (sand and water)", "Schlammwasser (Sand und Wasser)"), start: { solids: ["sand"], dissolved: [], liquids: ["water"] }, goal: ["sand", "water"], tools: ["magnet", "sieve", "filter", "decant", "evaporate", "distil"] },
  { id: "iron-sulfur", name: tx("Iron and sulfur", "Eisen und Schwefel"), start: { solids: ["iron", "sulfur"], dissolved: [], liquids: [] }, goal: ["iron", "sulfur"], tools: ["magnet", "sieve", "dissolve", "filter", "evaporate"] },
  { id: "sugar-sand", name: tx("Sugar and sand", "Zucker und Sand"), start: { solids: ["sugar", "sand"], dissolved: [], liquids: [] }, goal: ["sugar", "sand"], tools: ["magnet", "sieve", "dissolve", "filter", "evaporate", "distil"] },
];

export const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;

export type Run = { vessel: Vessel; products: Product[]; log: Outcome[] };

export function run(start: Vessel, steps: Step[]): Run {
  let vessel = start;
  const products: Product[] = [];
  const log: Outcome[] = [];
  for (const s of steps) {
    const o = apply(vessel, s);
    log.push(o);
    vessel = o.vessel;
    products.push(...o.products);
  }
  return { vessel, products, log };
}

/** Each goal substance on its own: a pure product, or alone in the beaker at the end. */
export function separated(sc: Pick<Scenario, "goal">, r: Run): Comp[] {
  const pure = r.products.filter((p) => !p.lost && p.comps.length === 1).map((p) => p.comps[0]);
  const rest = contentsOf(r.vessel);
  if (rest.length === 1) pure.push(rest[0]);
  return sc.goal.filter((c) => pure.includes(c));
}

export const solved = (sc: Pick<Scenario, "goal">, r: Run) => separated(sc, r).length === sc.goal.length;

/** Why an order of steps doesn't work, in Blob's words (null when it works). */
export function whyNot(sc: Scenario, steps: Step[]): Text | null {
  const r = run(sc.start, steps);
  if (solved(sc, r)) return null;
  const idle = r.log.findIndex((o) => !o.ok);
  if (idle >= 0) {
    const S = STEPS[steps[idle]].name;
    return tx(`Step ${idle + 1} (${en(S).toLowerCase()}) does nothing here. ${en(r.log[idle].note)}`, `Schritt ${idle + 1} (${de(S)}) bewirkt hier nichts. ${de(r.log[idle].note)}`);
  }
  const lost = r.products.find((p) => p.lost && p.comps.some((c) => sc.goal.includes(c)));
  if (lost) return tx(`When you evaporate, the ${en(namesOf(lost.comps))} ${many(lost.comps) ? "escape" : "escapes"} into the air. To keep a liquid, you have to catch the vapour and cool it down again.`, `Beim Eindampfen ${many(lost.comps) ? "entweichen" : "entweicht"} ${de(namesOf(lost.comps))} in die Luft. Wer eine Flüssigkeit behalten will, muss den Dampf auffangen und wieder abkühlen.`);
  const mixed = [...r.products.filter((p) => !p.lost && p.comps.length > 1).map((p) => p.comps), ...(contentsOf(r.vessel).length > 1 ? [contentsOf(r.vessel)] : [])][0];
  if (mixed) {
    const goalMixed = mixed.filter((c) => sc.goal.includes(c));
    if (goalMixed.length > 1) return tx(`At the end ${en(namesOf(goalMixed))} are still mixed together. Think about which step should come earlier.`, `Am Ende sind ${de(namesOf(goalMixed))} immer noch zusammen. Überleg, welcher Schritt früher kommen muss.`);
    return tx(`At the end the ${en(namesOf(goalMixed))} is still in the liquid. A step is missing.`, `Am Ende steckt ${de(namesOf(goalMixed))} noch in der Flüssigkeit. Da fehlt noch ein Schritt.`);
  }
  return tx("Not everything is separated at the end.", "Am Ende ist noch nicht alles getrennt.");
}
