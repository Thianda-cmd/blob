"use client";

// Nervous system, level 3 (Experte, Oberstufe): resting potential (ion distribution, K⁺ leak
// channels, sodium-potassium pump), action potential (threshold, voltage-gated Na⁺/K⁺ channels,
// depolarisation, repolarisation, hyperpolarisation, refractory periods, all-or-none law,
// frequency coding), continuous vs saltatory conduction, the chemical synapse in detail (Ca²⁺,
// exocytosis, ligand-gated receptors, EPSP/IPSP, acetylcholinesterase, summation) and synaptic
// poisons with their site of action.

import { resolveText, tx, type Text } from "@/i18n/text";
import { NerveApGraph, NerveApLab } from "@/learn/biology/visuals/NerveActionPotential";
import { NerveRestingLab } from "@/learn/biology/visuals/NerveMembrane";
import { NerveRace } from "@/learn/biology/visuals/NerveRace";
import { NerveSynapseLab } from "@/learn/biology/visuals/NerveSynapse";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson } from "@/learn/types";
import { answerFrame, cat, choice, choiceAt, decimal, flow, match, multi, num, order, pic, q, some, weighted, type Opt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const N = (v: number) => decimal(v, 3);

// ---------------------------------------------------------------------------
// Action potential: what happens at a point of the curve

type Pt = "A" | "B" | "C" | "D" | "E" | "F";
const AT: Record<Pt, Text> = {
  A: tx("Resting potential: voltage-gated channels closed, only K⁺ leak channels open", "Ruhepotenzial: spannungsgesteuerte Kanäle geschlossen, nur Kalium-Leckkanäle offen"),
  B: tx("Threshold reached: voltage-gated Na⁺ channels begin to open", "Schwellenwert erreicht: Spannungsgesteuerte Na⁺-Kanäle beginnen sich zu öffnen"),
  C: tx("Na⁺ channels open, Na⁺ flows in: depolarisation", "Na⁺-Kanäle offen, Na⁺ strömt ein: Depolarisation"),
  D: tx("Na⁺ channels are inactivated, K⁺ channels open", "Na⁺-Kanäle werden inaktiviert, K⁺-Kanäle öffnen sich"),
  E: tx("K⁺ flows out: repolarisation", "K⁺ strömt aus: Repolarisation"),
  F: tx("K⁺ channels close only slowly: hyperpolarisation", "K⁺-Kanäle schließen sich nur langsam: Hyperpolarisation"),
};
const K_IN = tx("K⁺ flows in: depolarisation", "K⁺ strömt ein: Depolarisation");
const PUMP_IN = tx("The Na⁺/K⁺ pump pumps Na⁺ into the cell", "Die Na⁺/K⁺-Pumpe pumpt Na⁺ in die Zelle");
const NA_OUT = tx("Na⁺ flows out: repolarisation", "Na⁺ strömt aus: Repolarisation");

const K_IN_SAY = { title: tx("K⁺ never flows in", "K⁺ strömt nicht ein"), say: tx("The classic trap! The depolarisation comes from **Na⁺ flowing in**. During the action potential K⁺ only flows **out** (repolarisation).", "Die klassische Falle! Die Depolarisation entsteht durch **Na⁺-Einstrom**. K⁺ strömt beim Aktionspotenzial nur **aus** (Repolarisation).") };
const PUMP_SAY = { title: tx("The pump is too slow", "Die Pumpe ist zu langsam"), say: tx("The pump works slowly and moves Na⁺ **out**, not in. The fast rise comes from Na⁺ flowing in through voltage-gated channels.", "Die Pumpe arbeitet langsam und befördert Na⁺ **hinaus**, nicht hinein. Der schnelle Anstieg kommt durch Na⁺-Einstrom durch spannungsgesteuerte Kanäle.") };

function apMix(want: Pt, got: Pt | "kin" | "pump" | "naout"): { title: Text; say: Text } | null {
  if (got === "kin") return K_IN_SAY;
  if (got === "pump") return PUMP_SAY;
  if (got === "naout") return { title: tx("Na⁺ doesn't flow out", "Na⁺ strömt nicht aus"), say: tx("Na⁺ doesn't flow out: the Na⁺ channels are now inactivated. The repolarisation comes from **K⁺ flowing out**.", "Na⁺ strömt nicht aus: Die Na⁺-Kanäle sind jetzt inaktiviert. Die Repolarisation entsteht durch **K⁺-Ausstrom**.") };
  const key = `${want}>${got}`;
  const M: Record<string, { title: Text; say: Text }> = {
    "C>E": { title: tx("Rising, not falling", "Steigt, fällt nicht"), say: tx("At C the curve is **rising**: Na⁺ flows in. K⁺ flowing out makes it fall again later (E).", "Bei C **steigt** die Kurve: Na⁺ strömt ein. Der K⁺-Ausstrom lässt sie erst später wieder fallen (E).") },
    "E>C": { title: tx("Falling, not rising", "Fällt, steigt nicht"), say: tx("At E the curve is **falling**: the Na⁺ channels are inactivated and K⁺ flows out.", "Bei E **fällt** die Kurve: Die Na⁺-Kanäle sind inaktiviert, K⁺ strömt aus.") },
    "F>A": { title: tx("Below the resting potential", "Unter dem Ruhepotenzial"), say: tx("At F the curve is **below** −70 mV: hyperpolarisation, because the K⁺ channels are still open.", "Bei F liegt die Kurve **unter** −70 mV: Hyperpolarisation, weil die K⁺-Kanäle noch offen sind.") },
    "A>F": { title: tx("Exactly at rest", "Genau in Ruhe"), say: tx("At A the membrane is at rest at −70 mV. Hyperpolarisation would be below that.", "Bei A liegt die Membran in Ruhe bei −70 mV. Hyperpolarisation wäre darunter.") },
    "D>C": { title: tx("At the peak it turns", "Am Gipfel kippt es"), say: tx("At the peak the Na⁺ channels close (they are inactivated) and the K⁺ channels open: the curve turns round.", "Am Gipfel schließen die Na⁺-Kanäle (sie werden inaktiviert) und die K⁺-Kanäle öffnen sich: Die Kurve kehrt um.") },
    "B>C": { title: tx("Only just at the threshold", "Gerade erst am Schwellenwert"), say: tx("At B the threshold is just being reached: the first Na⁺ channels open. The steep rise with lots of Na⁺ flowing in comes right after (C).", "Bei B wird gerade der Schwellenwert erreicht: Die ersten Na⁺-Kanäle öffnen sich. Der steile Anstieg mit viel Na⁺-Einstrom kommt direkt danach (C).") },
  };
  return M[key] ?? null;
}

function apPointExercise(p: Pt, rng: Rng | null): Exercise {
  const pts: Pt[] = ["A", "B", "C", "D", "E", "F"];
  const extra: { text: Text; key: Pt | "kin" | "pump" | "naout" }[] =
    p === "C" || p === "B" ? [{ text: K_IN, key: "kin" }, { text: PUMP_IN, key: "pump" }] : p === "E" || p === "D" ? [{ text: NA_OUT, key: "naout" }, { text: K_IN, key: "kin" }] : [{ text: K_IN, key: "kin" }];
  const near = pts.filter((x) => x !== p && apMix(p, x));
  const rest = pts.filter((x) => x !== p && !near.includes(x));
  const pool = [...extra, ...near.map((x) => ({ text: AT[x], key: x as Pt | "kin" | "pump" | "naout" })), ...(rng ? rng.shuffle(rest) : rest).map((x) => ({ text: AT[x], key: x as Pt | "kin" | "pump" | "naout" }))].slice(0, 3);
  const opts: Opt[] = [{ text: AT[p] }, ...pool.map((o) => ({ text: o.text, ...(apMix(p, o.key) ?? {}) }))];
  const c = rng ? choice(rng, opts) : choiceAt(2, opts);
  return {
    instruction: tx("Read the action potential", "Deute das Aktionspotenzial"),
    text: tx(`What happens at the membrane at point **${p}**?`, `Was passiert an der Membran bei Punkt **${p}**?`),
    visual: pic(NerveApGraph, { marks: ["A", "B", "C", "D", "E", "F"], guides: true }),
    answer: c.answer,
    hint: tx("Rising: Na⁺ flows in. Falling: K⁺ flows out. Below −70 mV: the K⁺ channels are still open.", "Steigt die Kurve: Na⁺ strömt ein. Fällt sie: K⁺ strömt aus. Unter −70 mV: Die K⁺-Kanäle sind noch offen."),
    solution: [answerFrame(tx(`point ${p}`, `Punkt ${p}`), AT[p])],
    mistakes: c.mistakes,
  };
}
const apPointTask = (rng: Rng) => apPointExercise(rng.pick(["A", "B", "C", "D", "E", "F"] as Pt[]), rng);

const AP_EVENTS: Text[] = [
  tx("A stimulus depolarises the membrane to the threshold", "Ein Reiz depolarisiert die Membran bis zum Schwellenwert"),
  tx("Voltage-gated Na⁺ channels open, Na⁺ flows in", "Spannungsgesteuerte Na⁺-Kanäle öffnen sich, Na⁺ strömt ein"),
  tx("The inside becomes positive (overshoot, about +30 mV)", "Das Innere wird positiv (Overshoot, etwa +30 mV)"),
  tx("Na⁺ channels are inactivated, voltage-gated K⁺ channels open", "Na⁺-Kanäle werden inaktiviert, spannungsgesteuerte K⁺-Kanäle öffnen sich"),
  tx("K⁺ flows out: repolarisation", "K⁺ strömt aus: Repolarisation"),
  tx("The potential briefly drops below −70 mV (hyperpolarisation)", "Das Potenzial sinkt kurz unter −70 mV (Hyperpolarisation)"),
  tx("The K⁺ channels close, the resting potential is restored", "Die K⁺-Kanäle schließen sich, das Ruhepotenzial ist wieder erreicht"),
];
function apOrderTask(rng: Rng): Exercise {
  const len = rng.int(4, 6);
  const start = rng.int(0, AP_EVENTS.length - len);
  const items = AP_EVENTS.slice(start, start + len);
  const E = AP_EVENTS;
  const o = order(items, [
    { items: [E[3], E[1]], title: tx("K⁺ channels come later", "K⁺-Kanäle kommen später"), say: tx("The voltage-gated K⁺ channels open **with a delay**, after the Na⁺ channels. First Na⁺ in, then K⁺ out.", "Die spannungsgesteuerten K⁺-Kanäle öffnen sich **verzögert**, nach den Na⁺-Kanälen. Erst Na⁺ rein, dann K⁺ raus.") },
    { items: [E[1], E[0]], title: tx("Threshold first", "Erst der Schwellenwert"), say: tx("The voltage-gated Na⁺ channels only open in large numbers once the threshold is reached.", "Die spannungsgesteuerten Na⁺-Kanäle öffnen sich erst in großer Zahl, wenn der Schwellenwert erreicht ist.") },
    { items: [E[4], E[2]], title: tx("Up before down", "Erst rauf, dann runter"), say: tx("Repolarisation brings the potential back down, so it has to come after the overshoot.", "Die Repolarisation bringt das Potenzial wieder herunter, sie kommt also nach dem Overshoot.") },
    { items: [E[5], E[4]], title: tx("Hyperpolarisation comes last", "Hyperpolarisation kommt danach"), say: tx("The hyperpolarisation happens because K⁺ keeps flowing out **after** the repolarisation, while the K⁺ channels close slowly.", "Die Hyperpolarisation entsteht, weil **nach** der Repolarisation noch K⁺ ausströmt, während sich die K⁺-Kanäle langsam schließen.") },
  ]);
  return {
    instruction: tx("Put the action potential in order", "Ordne die Vorgänge beim Aktionspotenzial"),
    text: tx("Put the events of an action potential in the right order.", "Bring die Vorgänge beim Aktionspotenzial in die richtige Reihenfolge."),
    answer: o.answer,
    hint: tx("Threshold → Na⁺ in → overshoot → K⁺ out → hyperpolarisation → rest.", "Schwelle → Na⁺ rein → Overshoot → K⁺ raus → Hyperpolarisation → Ruhe."),
    solution: [{ math: cat(q(tx("threshold", "Schwelle")), "\\to", "\\ce{Na+}", q(tx("in", "rein")), "\\to", "\\ce{K+}", q(tx("out", "raus")), "\\to", q(tx("rest", "Ruhe"))), note: tx("First the fast Na⁺ channels open, then they are inactivated and the slower K⁺ channels open.", "Erst öffnen die schnellen Na⁺-Kanäle, dann werden sie inaktiviert und die langsameren K⁺-Kanäle öffnen sich.") }],
    mistakes: o.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Resting potential: statements

type St = { text: Text; ok: boolean; title?: Text; say?: Text };
const REST_ST: St[] = [
  { text: tx("The K⁺ concentration is much higher inside the cell than outside.", "Die K⁺-Konzentration ist innen viel höher als außen."), ok: true },
  { text: tx("The Na⁺ concentration is much higher outside than inside.", "Die Na⁺-Konzentration ist außen viel höher als innen."), ok: true },
  { text: tx("At rest the membrane is mainly permeable to K⁺ (K⁺ leak channels).", "In Ruhe ist die Membran vor allem für K⁺ durchlässig (Kalium-Leckkanäle)."), ok: true },
  { text: tx("Large organic anions (A⁻) cannot cross the membrane.", "Große organische Anionen (A⁻) können die Membran nicht durchqueren."), ok: true },
  { text: tx("Per ATP the Na⁺/K⁺ pump moves 3 Na⁺ out and 2 K⁺ in.", "Pro ATP befördert die Na⁺/K⁺-Pumpe 3 Na⁺ hinaus und 2 K⁺ hinein."), ok: true },
  { text: tx("The resting potential is about −70 mV, negative inside.", "Das Ruhepotenzial liegt bei etwa −70 mV, innen negativ."), ok: true },
  { text: tx("The K⁺ concentration is higher outside than inside.", "Die K⁺-Konzentration ist außen höher als innen."), ok: false, title: tx("K⁺ is mostly inside", "K⁺ ist vor allem innen"), say: tx("It's the other way round: K⁺ is about 40 times more concentrated **inside**. That's why it diffuses **out** through the leak channels.", "Andersherum: K⁺ ist **innen** etwa 40-mal so hoch konzentriert. Darum diffundiert es durch die Leckkanäle **nach außen**.") },
  { text: tx("Per ATP the Na⁺/K⁺ pump moves 2 Na⁺ out and 3 K⁺ in.", "Pro ATP befördert die Na⁺/K⁺-Pumpe 2 Na⁺ hinaus und 3 K⁺ hinein."), ok: false, title: tx("3 Na⁺ out, 2 K⁺ in", "3 Na⁺ raus, 2 K⁺ rein"), say: tx("The numbers are swapped: per ATP **3 Na⁺ go out** and **2 K⁺ come in**. So with every cycle one positive charge more leaves the cell.", "Die Zahlen sind vertauscht: Pro ATP gehen **3 Na⁺ hinaus** und **2 K⁺ hinein**. Mit jedem Zyklus verlässt also eine positive Ladung mehr die Zelle.") },
  { text: tx("The resting potential is mainly caused by Na⁺ flowing in.", "Das Ruhepotenzial entsteht hauptsächlich durch einströmendes Na⁺."), ok: false, title: tx("K⁺ flowing out", "K⁺-Ausstrom"), say: tx("Na⁺ flowing in would make the inside **less** negative. The resting potential comes mainly from **K⁺ flowing out** through the leak channels.", "Na⁺-Einstrom würde das Innere **weniger** negativ machen. Das Ruhepotenzial entsteht vor allem durch **K⁺-Ausstrom** durch die Leckkanäle.") },
  { text: tx("At rest the membrane is equally permeable to all ions.", "In Ruhe ist die Membran für alle Ionen gleich gut durchlässig."), ok: false, title: tx("Selectively permeable", "Selektiv durchlässig"), say: tx("The membrane is **selectively** permeable: at rest mainly to K⁺, hardly to Na⁺, not at all to A⁻.", "Die Membran ist **selektiv** durchlässig: in Ruhe vor allem für K⁺, kaum für Na⁺, gar nicht für A⁻.") },
  { text: tx("At rest the inside of the cell is positively charged.", "In Ruhe ist das Zellinnere positiv geladen."), ok: false, title: tx("Negative inside", "Innen negativ"), say: tx("At rest the inside is **negative** (−70 mV). It only becomes positive briefly during the action potential.", "In Ruhe ist das Innere **negativ** (−70 mV). Positiv wird es nur kurz beim Aktionspotenzial.") },
];
function restTask(rng: Rng): Exercise {
  const nOk = rng.int(2, 3);
  const trues = some(
    rng,
    REST_ST.filter((s) => s.ok),
    nOk,
  );
  const falses = some(
    rng,
    REST_ST.filter((s) => !s.ok),
    5 - nOk,
  );
  const items = [...trues, ...falses];
  const okIdx = items.map((s, i) => (s.ok ? i : -1)).filter((i) => i >= 0);
  const wrong = items.map((s, i) => ({ s, i })).filter((x) => !x.s.ok).map((x) => ({ pick: [...okIdx, x.i], title: x.s.title!, say: x.s.say! }));
  const m = multi(rng, items.map((s) => ({ text: s.text, ok: s.ok })), wrong);
  return {
    instruction: tx("Resting potential: true or false?", "Ruhepotenzial: richtig oder falsch?"),
    text: tx("Which statements about a nerve cell at rest are correct?", "Welche Aussagen über eine Nervenzelle in Ruhe sind richtig?"),
    answer: m.answer,
    hint: tx("Inside: K⁺ and A⁻. Outside: Na⁺ and Cl⁻. Leak channels for K⁺. Pump: 3 Na⁺ out, 2 K⁺ in.", "Innen: K⁺ und A⁻. Außen: Na⁺ und Cl⁻. Leckkanäle für K⁺. Pumpe: 3 Na⁺ raus, 2 K⁺ rein."),
    solution: [{ math: cat(q(tx("inside:", "innen:")), "\\ce{K+} , \\ce{A-}", "\\quad", q(tx("outside:", "außen:")), "\\ce{Na+} , \\ce{Cl-}"), note: tx("K⁺ leaves through leak channels, the A⁻ stay behind: inside negative, about −70 mV. The pump keeps the gradients up.", "K⁺ strömt durch Leckkanäle aus, die A⁻ bleiben zurück: innen negativ, etwa −70 mV. Die Pumpe hält die Gradienten aufrecht.") }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Calculations

const ATP = [100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
function pumpTask(rng: Rng): Exercise {
  const kind = rng.pick(["na", "k", "atp", "net"] as const);
  const n = rng.pick(ATP);
  const de0 = (v: number) => de(N(v));
  const en0 = (v: number) => en(N(v));
  if (kind === "atp") {
    const na = 3 * n;
    const r = num(n, "ATP", 0.001, [
      { value: na, title: tx("That's the Na⁺", "Das sind die Na⁺"), say: tx("That's just the number of Na⁺ again. Each ATP moves **3** Na⁺, so divide by 3.", "Das ist wieder nur die Zahl der Na⁺. Jedes ATP befördert **3** Na⁺, also durch 3 teilen.") },
      { value: na / 2, title: tx("Divided by the K⁺", "Durch die K⁺ geteilt"), say: tx("You divided by 2, but 2 is the number of K⁺ per cycle. Per ATP **3 Na⁺** leave the cell.", "Du hast durch 2 geteilt, aber 2 ist die Zahl der K⁺ pro Zyklus. Pro ATP verlassen **3 Na⁺** die Zelle.") },
      { value: na * 3, title: tx("Multiplied instead of divided", "Mal statt geteilt"), say: tx("You multiplied by 3. But each ATP already moves 3 Na⁺, so the number of ATP is **smaller** than the number of ions.", "Du hast mal 3 gerechnet. Jedes ATP befördert aber schon 3 Na⁺, also ist die Zahl der ATP **kleiner** als die der Ionen.") },
    ]);
    return {
      instruction: tx("Calculate: sodium-potassium pump", "Berechne: Natrium-Kalium-Pumpe"),
      text: tx(`A sodium-potassium pump has moved **${en0(na)} Na⁺ ions** out of the cell. How many ATP molecules did it split?`, `Eine Natrium-Kalium-Pumpe hat **${de0(na)} Na⁺-Ionen** aus der Zelle befördert. Wie viele ATP-Moleküle hat sie dabei gespalten?`),
      answer: r.answer,
      hint: tx("One ATP per cycle: 3 Na⁺ out, 2 K⁺ in.", "Ein ATP pro Zyklus: 3 Na⁺ hinaus, 2 K⁺ hinein."),
      solution: [{ math: `\\frac{${na}}{3} = \\hl{${n}}`, note: tx(`Each ATP moves 3 Na⁺: ${en0(na)} : 3 = **${en0(n)} ATP**.`, `Jedes ATP befördert 3 Na⁺: ${de0(na)} : 3 = **${de0(n)} ATP**.`) }],
      mistakes: r.mistakes,
    };
  }
  const right = kind === "na" ? 3 * n : kind === "k" ? 2 * n : n;
  const what = kind === "na" ? tx("Na⁺ ions are moved out of the cell", "Na⁺-Ionen werden aus der Zelle befördert") : kind === "k" ? tx("K⁺ ions are moved into the cell", "K⁺-Ionen werden in die Zelle befördert") : tx("positive charges leave the cell in total (net)", "positive Ladungen verlassen die Zelle insgesamt (netto)");
  const wrong =
    kind === "na"
      ? [
          { value: 2 * n, title: tx("Those are the K⁺", "Das sind die K⁺"), say: tx("2 per ATP is the number of **K⁺** coming in. Na⁺ going out: **3** per ATP.", "2 pro ATP ist die Zahl der **K⁺**, die hineinkommen. Na⁺ hinaus: **3** pro ATP.") },
          { value: n, title: tx("One ATP, three Na⁺", "Ein ATP, drei Na⁺"), say: tx("One ATP drives one cycle of the pump, and each cycle moves **3** Na⁺.", "Ein ATP treibt einen Zyklus der Pumpe an, und jeder Zyklus befördert **3** Na⁺.") },
          { value: 5 * n, title: tx("Only the Na⁺", "Nur die Na⁺"), say: tx("You added Na⁺ and K⁺. The question is only about the Na⁺ going out: 3 per ATP.", "Du hast Na⁺ und K⁺ zusammengezählt. Gefragt sind nur die Na⁺, die hinausgehen: 3 pro ATP.") },
        ]
      : kind === "k"
        ? [
            { value: 3 * n, title: tx("Those are the Na⁺", "Das sind die Na⁺"), say: tx("3 per ATP is the number of **Na⁺** going out. K⁺ coming in: **2** per ATP.", "3 pro ATP ist die Zahl der **Na⁺**, die hinausgehen. K⁺ hinein: **2** pro ATP.") },
            { value: n, title: tx("One ATP, two K⁺", "Ein ATP, zwei K⁺"), say: tx("Each cycle (one ATP) brings **2** K⁺ into the cell.", "Jeder Zyklus (ein ATP) bringt **2** K⁺ in die Zelle.") },
            { value: 5 * n, title: tx("Only the K⁺", "Nur die K⁺"), say: tx("You added Na⁺ and K⁺. Only the K⁺ coming in are asked for: 2 per ATP.", "Du hast Na⁺ und K⁺ zusammengezählt. Gefragt sind nur die K⁺, die hineinkommen: 2 pro ATP.") },
          ]
        : [
            { value: 3 * n, title: tx("2 K⁺ come back in", "2 K⁺ kommen rein"), say: tx("3 Na⁺ go out, but 2 K⁺ come in at the same time. Net: 3 − 2 = **1** positive charge per ATP.", "3 Na⁺ gehen hinaus, gleichzeitig kommen aber 2 K⁺ herein. Netto: 3 − 2 = **1** positive Ladung pro ATP.") },
            { value: 5 * n, title: tx("Opposite directions", "Entgegengesetzte Richtungen"), say: tx("Na⁺ goes out but K⁺ comes in: subtract, don't add. 3 − 2 = 1 per ATP.", "Na⁺ geht hinaus, K⁺ kommt herein: abziehen, nicht addieren. 3 − 2 = 1 pro ATP.") },
            { value: 2 * n, title: tx("Na⁺ and K⁺ mixed up", "Na⁺ und K⁺ verwechselt"), say: tx("Per ATP 3 Na⁺ go out and 2 K⁺ come in. Net, **one** positive charge leaves.", "Pro ATP gehen 3 Na⁺ hinaus und 2 K⁺ herein. Netto verlässt **eine** positive Ladung die Zelle.") },
          ];
  const r = num(right, undefined, 0.001, wrong);
  const factor = kind === "na" ? 3 : kind === "k" ? 2 : 1;
  return {
    instruction: tx("Calculate: sodium-potassium pump", "Berechne: Natrium-Kalium-Pumpe"),
    text: tx(`In one second the sodium-potassium pumps of a small piece of membrane split **${en0(n)} ATP**. How many ${en(what)}?`, `In einer Sekunde spalten die Natrium-Kalium-Pumpen eines kleinen Membranstücks **${de0(n)} ATP**. Wie viele ${de(what)}?`),
    answer: r.answer,
    hint: tx("One ATP per cycle: 3 Na⁺ out, 2 K⁺ in.", "Ein ATP pro Zyklus: 3 Na⁺ hinaus, 2 K⁺ hinein."),
    solution: [{ math: `${n} \\cdot ${factor} = \\hl{${right}}`, note: kind === "net" ? tx(`Per ATP 3 Na⁺ out, 2 K⁺ in: net 1 positive charge. ${en0(n)} · 1 = **${en0(right)}**.`, `Pro ATP 3 Na⁺ hinaus, 2 K⁺ hinein: netto 1 positive Ladung. ${de0(n)} · 1 = **${de0(right)}**.`) : tx(`${factor} per ATP: ${en0(n)} · ${factor} = **${en0(right)}**.`, `${factor} pro ATP: ${de0(n)} · ${factor} = **${de0(right)}**.`) }],
    mistakes: r.mistakes,
  };
}

const ROUTES: { s: number; where: Text }[] = [
  { s: 1, where: tx("from the big toe to the spinal cord", "vom großen Zeh zum Rückenmark") },
  { s: 1.2, where: tx("from the foot to the spinal cord", "vom Fuß zum Rückenmark") },
  { s: 0.8, where: tx("from the fingertip to the spinal cord", "von der Fingerspitze zum Rückenmark") },
  { s: 0.6, where: tx("from the hand to the spinal cord", "von der Hand zum Rückenmark") },
  { s: 1.5, where: tx("along a nerve in a giraffe's leg", "entlang eines Nervs im Bein einer Giraffe") },
];
const SPEEDS: { v: number; what: Text }[] = [
  { v: 120, what: tx("a thick myelinated fibre", "einer dicken markhaltigen Faser") },
  { v: 100, what: tx("a myelinated fibre", "einer markhaltigen Faser") },
  { v: 80, what: tx("a myelinated fibre", "einer markhaltigen Faser") },
  { v: 60, what: tx("a myelinated fibre", "einer markhaltigen Faser") },
  { v: 50, what: tx("a thin myelinated fibre", "einer dünnen markhaltigen Faser") },
  { v: 20, what: tx("a thin myelinated fibre", "einer dünnen markhaltigen Faser") },
  { v: 2, what: tx("an unmyelinated fibre", "einer marklosen Faser") },
  { v: 1, what: tx("a thin unmyelinated fibre (pain fibre)", "einer dünnen marklosen Faser (Schmerzfaser)") },
];
function timeExercise(s: number, where: Text, v: number, what: Text): Exercise {
  const t = Math.round((s / v) * 1000 * 100) / 100;
  const r = num(t, "ms", 0.01, [
    { value: s / v, title: tx("Still in seconds", "Noch in Sekunden"), say: tx("You worked it out in **seconds**. The question asks for milliseconds: multiply by 1000.", "Du hast in **Sekunden** gerechnet. Gefragt sind Millisekunden: mal 1000.") },
    { value: v / s, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx("Time = distance **divided by** speed: $t = \\frac{s}{v}$, not $\\frac{v}{s}$.", "Zeit = Strecke **geteilt durch** Geschwindigkeit: $t = \\frac{s}{v}$, nicht $\\frac{v}{s}$.") },
    { value: s * v, title: tx("Multiplied", "Multipliziert"), say: tx("Distance times speed gives no time. Use $t = \\frac{s}{v}$.", "Strecke mal Geschwindigkeit ergibt keine Zeit. Rechne $t = \\frac{s}{v}$.") },
    { value: (v / s) * 1000, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx("Time = distance divided by speed: $t = \\frac{s}{v}$.", "Zeit = Strecke geteilt durch Geschwindigkeit: $t = \\frac{s}{v}$.") },
  ]);
  return {
    instruction: tx("Calculate the conduction time", "Berechne die Leitungszeit"),
    text: tx(
      `An impulse runs **${en(N(s))} m** ${en(where)} in ${en(what)} at **${v} m/s**. How long does it take? Give the time in ms.`,
      `Eine Erregung läuft **${de(N(s))} m** ${de(where)}, in ${de(what)} mit **${v} m/s**. Wie lange braucht sie? Gib die Zeit in ms an.`,
    ),
    answer: r.answer,
    hint: tx("t = s : v gives seconds; 1 s = 1000 ms.", "t = s : v ergibt Sekunden; 1 s = 1000 ms."),
    solution: [
      { math: tx(`t = \\frac{s}{v} = \\frac{${en(N(s))} "m"}{${v} "m/s"}`, `t = \\frac{s}{v} = \\frac{${de(N(s))} "m"}{${v} "m/s"}`), note: tx("Time = distance divided by speed.", "Zeit = Strecke geteilt durch Geschwindigkeit.") },
      { math: tx(`t = ${en(N(s / v))} "s" = \\hl{${en(N(t))} "ms"}`, `t = ${de(N(s / v))} \\, "s" = \\hl{${de(N(t))} \\, "ms"}`), note: tx(`That's **${en(N(t))} ms**.`, `Das sind **${de(N(t))} ms**.`) },
    ],
    mistakes: r.mistakes,
  };
}
function timeTask(rng: Rng): Exercise {
  const r = rng.pick(ROUTES);
  const sp = rng.pick(SPEEDS);
  return timeExercise(r.s, r.where, sp.v, sp.what);
}

const ELECTRODES: [number, number][] = [
  [4, 0.5],
  [5, 0.5],
  [6, 1],
  [3, 0.5],
  [2, 0.25],
  [10, 1],
  [10, 2],
  [8, 1],
  [1, 0.5],
  [2, 1],
  [12, 1.5],
  [9, 1.5],
  [0.5, 5],
  [1, 5],
  [2, 10],
];
function speedTask(rng: Rng): Exercise {
  const [cm, ms] = rng.pick(ELECTRODES);
  const v = cm / 100 / (ms / 1000);
  const r = num(v, "m/s", 0.01, [
    { value: cm / ms, title: tx("Units not converted", "Einheiten nicht umgerechnet"), say: tx("You divided cm by ms. Convert first: cm into m (÷ 100) and ms into s (÷ 1000).", "Du hast cm durch ms geteilt. Rechne zuerst um: cm in m (÷ 100) und ms in s (÷ 1000).") },
    { value: cm / 100 / ms, title: tx("ms not converted", "ms nicht umgerechnet"), say: tx("The metres are right, but the time is still in milliseconds. 1 ms = 0.001 s.", "Die Meter stimmen, aber die Zeit steht noch in Millisekunden. 1 ms = 0,001 s.") },
    { value: ms / 1000 / (cm / 100), title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx("Speed = distance **divided by** time: $v = \\frac{s}{t}$.", "Geschwindigkeit = Strecke **geteilt durch** Zeit: $v = \\frac{s}{t}$.") },
    { value: cm / (ms / 1000), title: tx("cm not converted", "cm nicht umgerechnet"), say: tx("The time is in seconds, but the distance is still in centimetres. 1 cm = 0.01 m.", "Die Zeit stimmt in Sekunden, aber die Strecke steht noch in Zentimetern. 1 cm = 0,01 m.") },
  ]);
  return {
    instruction: tx("Calculate the conduction speed", "Berechne die Leitungsgeschwindigkeit"),
    text: tx(
      `Two recording electrodes lie **${en(N(cm))} cm** apart on an axon. The action potential reaches the second electrode **${en(N(ms))} ms** after the first. Work out the conduction speed in m/s.`,
      `Zwei Messelektroden liegen **${de(N(cm))} cm** voneinander entfernt auf einem Axon. Das Aktionspotenzial erreicht die zweite Elektrode **${de(N(ms))} ms** nach der ersten. Berechne die Leitungsgeschwindigkeit in m/s.`,
    ),
    answer: r.answer,
    hint: tx("v = s : t, with s in m and t in s.", "v = s : t, mit s in m und t in s."),
    solution: [
      { math: tx(`v = \\frac{${en(N(cm / 100))} "m"}{${en(N(ms / 1000))} "s"}`, `v = \\frac{${de(N(cm / 100))} "m"}{${de(N(ms / 1000))} "s"}`), note: tx(`Convert first: ${en(N(cm))} cm = ${en(N(cm / 100))} m, ${en(N(ms))} ms = ${en(N(ms / 1000))} s.`, `Zuerst umrechnen: ${de(N(cm))} cm = ${de(N(cm / 100))} m, ${de(N(ms))} ms = ${de(N(ms / 1000))} s.`) },
      { math: tx(`v = \\hl{${en(N(v))} "m/s"}`, `v = \\hl{${de(N(v))} "m/s"}`), note: v >= 10 ? tx("That fast: a myelinated fibre (saltatory conduction).", "So schnell: eine markhaltige Faser (saltatorische Erregungsleitung).") : tx("That slow: probably an unmyelinated fibre (continuous conduction).", "So langsam: wohl eine marklose Faser (kontinuierliche Erregungsleitung).") },
    ],
    mistakes: r.mistakes,
  };
}

const REFR = [1, 1.25, 2, 2.5, 4, 5];
function freqTask(rng: Rng): Exercise {
  if (rng.chance(0.55)) {
    const t = rng.pick(REFR);
    const f = 1000 / t;
    const r = num(f, "Hz", 0.01, [
      { value: 1 / t, title: tx("Milliseconds left in", "Millisekunden gelassen"), say: tx("You calculated 1 : t with t in **milliseconds**. Hz means 'per second', so convert t into seconds first.", "Du hast 1 : t mit t in **Millisekunden** gerechnet. Hz heißt „pro Sekunde“, rechne t also erst in Sekunden um.") },
      { value: t, title: tx("That's the time", "Das ist die Zeit"), say: tx("That's the refractory period itself. The maximum frequency is its reciprocal: $f = \\frac{1}{t}$.", "Das ist die Refraktärzeit selbst. Die Höchstfrequenz ist ihr Kehrwert: $f = \\frac{1}{t}$.") },
      { value: 1000 * t, title: tx("Multiplied instead of divided", "Mal statt geteilt"), say: tx("A longer refractory period means **fewer** action potentials per second, so divide: $f = \\frac{1}{t}$.", "Eine längere Refraktärzeit bedeutet **weniger** Aktionspotenziale pro Sekunde, also teilen: $f = \\frac{1}{t}$.") },
    ]);
    return {
      instruction: tx("Maximum frequency", "Höchstfrequenz"),
      text: tx(`The absolute refractory period of an axon lasts **${en(N(t))} ms**. How many action potentials per second can it fire at most (in Hz)?`, `Die absolute Refraktärzeit eines Axons dauert **${de(N(t))} ms**. Wie viele Aktionspotenziale pro Sekunde kann es höchstens bilden (in Hz)?`),
      answer: r.answer,
      hint: tx("During the absolute refractory period no new action potential is possible. How many such periods fit into one second?", "Während der absoluten Refraktärzeit ist kein neues Aktionspotenzial möglich. Wie viele solcher Zeitspannen passen in eine Sekunde?"),
      solution: [{ math: tx(`f = \\frac{1}{${en(N(t / 1000))} "s"} = \\hl{${f} "Hz"}`, `f = \\frac{1}{${de(N(t / 1000))} "s"} = \\hl{${f} "Hz"}`), note: tx(`${en(N(t))} ms = ${en(N(t / 1000))} s. At most **${f}** action potentials per second.`, `${de(N(t))} ms = ${de(N(t / 1000))} s. Höchstens **${f}** Aktionspotenziale pro Sekunde.`) }],
      mistakes: r.mistakes,
    };
  }
  const per = rng.pick([0.5, 0.25, 0.2, 0.1]);
  const n = rng.pick([5, 8, 10, 12, 15, 20, 25, 30, 40]);
  const f = n / per;
  const r = num(f, "Hz", 0.01, [
    { value: n, title: tx("Per second, not per interval", "Pro Sekunde, nicht pro Zeitraum"), say: tx(`That's the number of action potentials in ${en(N(per))} s. Hertz means per **second**.`, `Das ist die Zahl der Aktionspotenziale in ${de(N(per))} s. Hertz heißt pro **Sekunde**.`) },
    { value: n * per, title: tx("Multiplied instead of divided", "Mal statt geteilt"), say: tx("Frequency = number divided by time: $f = \\frac{n}{t}$.", "Frequenz = Anzahl geteilt durch Zeit: $f = \\frac{n}{t}$.") },
  ]);
  return {
    instruction: tx("Frequency coding", "Frequenzcodierung"),
    text: tx(
      `A stronger stimulus makes a sensory neuron fire **${n} action potentials in ${en(N(per))} s**. What is the frequency in Hz?`,
      `Bei einem stärkeren Reiz bildet ein sensorisches Neuron **${n} Aktionspotenziale in ${de(N(per))} s**. Wie hoch ist die Frequenz in Hz?`,
    ),
    answer: r.answer,
    hint: tx("Hz = action potentials per second.", "Hz = Aktionspotenziale pro Sekunde."),
    solution: [{ math: tx(`f = \\frac{${n}}{${en(N(per))} "s"} = \\hl{${en(N(f))} "Hz"}`, `f = \\frac{${n}}{${de(N(per))} "s"} = \\hl{${de(N(f))} "Hz"}`), note: tx("The stimulus strength is coded in the **frequency**, not in the height of the action potentials.", "Die Reizstärke steckt in der **Frequenz**, nicht in der Höhe der Aktionspotenziale.") }],
    mistakes: r.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Synapse and poisons

type Poison = { id: string; name: Text; site: Text };
const POISONS: Poison[] = [
  { id: "curare", name: tx("curare", "Curare"), site: tx("blocks the ACh receptors (competitively) without opening them", "besetzt die ACh-Rezeptoren (kompetitiv), ohne sie zu öffnen") },
  { id: "atropine", name: tx("atropine", "Atropin"), site: tx("blocks muscarinic ACh receptors (e.g. heart, pupil)", "blockiert muskarinische ACh-Rezeptoren (z. B. Herz, Pupille)") },
  { id: "e605", name: tx("E 605 (parathion)", "E 605 (Parathion)"), site: tx("inhibits acetylcholinesterase irreversibly", "hemmt die Acetylcholinesterase irreversibel") },
  { id: "botox", name: tx("botulinum toxin", "Botulinumtoxin"), site: tx("stops the exocytosis of the vesicles", "verhindert die Exocytose der Vesikel") },
  { id: "ttx", name: tx("tetrodotoxin (puffer fish)", "Tetrodotoxin (Kugelfisch)"), site: tx("blocks voltage-gated Na⁺ channels", "blockiert spannungsgesteuerte Na⁺-Kanäle") },
  { id: "nicotine", name: tx("nicotine", "Nikotin"), site: tx("activates ACh receptors like ACh itself", "aktiviert ACh-Rezeptoren wie ACh selbst") },
  { id: "latro", name: tx("α-latrotoxin (black widow)", "α-Latrotoxin (Schwarze Witwe)"), site: tx("triggers a massive release of ACh", "löst eine massenhafte Ausschüttung von ACh aus") },
];
function poisonMix(want: string, got: string): { title: Text; say: Text } | null {
  const k = `${want}>${got}`;
  const M: Record<string, { title: Text; say: Text }> = {
    "curare>e605": { title: tx("Receptor, not enzyme", "Rezeptor, nicht Enzym"), say: tx("Curare doesn't touch the enzyme: it sits in the **receptors**, so ACh can't bind. E 605 is the one that inhibits acetylcholinesterase.", "Curare lässt das Enzym in Ruhe: Es sitzt in den **Rezeptoren**, sodass ACh nicht binden kann. E 605 ist es, das die Acetylcholinesterase hemmt.") },
    "e605>curare": { title: tx("Enzyme, not receptor", "Enzym, nicht Rezeptor"), say: tx("E 605 blocks the **enzyme** that splits ACh. The ACh piles up and keeps exciting the cell. Blocking receptors is curare's way.", "E 605 blockiert das **Enzym**, das ACh spaltet. ACh staut sich an und erregt die Zelle immer weiter. Rezeptoren blockiert Curare.") },
    "botox>curare": { title: tx("Before the cleft, not after", "Vor dem Spalt, nicht danach"), say: tx("Botulinum toxin acts **presynaptically**: no vesicle can fuse, so no ACh is released at all. Curare acts postsynaptically at the receptors.", "Botulinumtoxin wirkt **präsynaptisch**: Kein Vesikel kann verschmelzen, es wird gar kein ACh ausgeschüttet. Curare wirkt postsynaptisch an den Rezeptoren.") },
    "curare>botox": { title: tx("After the cleft, not before", "Nach dem Spalt, nicht davor"), say: tx("With curare the ACh is released normally, but it can't bind: curare acts **postsynaptically** at the receptors.", "Bei Curare wird ACh ganz normal ausgeschüttet, kann aber nicht binden: Curare wirkt **postsynaptisch** an den Rezeptoren.") },
    "atropine>curare": { title: tx("Two receptor blockers", "Zwei Rezeptorblocker"), say: tx("Both block ACh receptors competitively. Curare acts at the motor end plate, atropine at the **muscarinic** receptors of heart, gut and pupil muscle.", "Beide blockieren ACh-Rezeptoren kompetitiv. Curare wirkt an der motorischen Endplatte, Atropin an den **muskarinischen** Rezeptoren von Herz, Darm und Pupillenmuskel.") },
    "curare>atropine": { title: tx("Two receptor blockers", "Zwei Rezeptorblocker"), say: tx("Both block ACh receptors competitively, but curare acts at the **motor end plate** of skeletal muscles: that's why it paralyses.", "Beide blockieren ACh-Rezeptoren kompetitiv, aber Curare wirkt an der **motorischen Endplatte** der Skelettmuskeln: Darum lähmt es.") },
    "e605>botox": { title: tx("Too much ACh, not too little", "Zu viel ACh, nicht zu wenig"), say: tx("With E 605 the ACh is released and then **not broken down**. Stopping the release is what botulinum toxin does.", "Bei E 605 wird ACh ausgeschüttet und dann **nicht abgebaut**. Die Ausschüttung zu verhindern, macht Botulinumtoxin.") },
    "ttx>curare": { title: tx("Axon, not synapse", "Axon, nicht Synapse"), say: tx("Tetrodotoxin blocks the voltage-gated **Na⁺ channels** of the axon membrane: no action potentials at all.", "Tetrodotoxin blockiert die spannungsgesteuerten **Na⁺-Kanäle** der Axonmembran: Es entstehen gar keine Aktionspotenziale.") },
    "nicotine>curare": { title: tx("Opens, doesn't block", "Öffnet, statt zu blockieren"), say: tx("Nicotine fits the ACh receptors and **opens** them, just like ACh (an agonist). Curare blocks them.", "Nikotin passt in die ACh-Rezeptoren und **öffnet** sie, genau wie ACh (ein Agonist). Curare blockiert sie.") },
  };
  return M[k] ?? null;
}

function poisonMatchTask(rng: Rng): Exercise {
  const main = some(
    rng,
    POISONS.slice(0, 4),
    rng.int(2, 3),
  );
  const extra = some(
    rng,
    POISONS.slice(4),
    4 - main.length,
  );
  const chosen = rng.shuffle([...main, ...extra]);
  const pairs: [Text, Text][] = chosen.map((p) => [p.name, p.site]);
  const rest = POISONS.filter((p) => !chosen.includes(p));
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  chosen.forEach((a) =>
    chosen.forEach((b) => {
      const mix = a !== b ? poisonMix(a.id, b.id) : null;
      if (mix) wrong.push({ pairs: [[a.name, b.site]], ...mix });
    }),
  );
  const m = match(pairs, [rng.pick(rest).site], wrong);
  return {
    instruction: tx("Poisons and their site of action", "Gifte und ihr Wirkort"),
    text: tx("Match each poison to how it acts. One description is left over.", "Ordne jedem Gift seine Wirkungsweise zu. Eine Beschreibung bleibt übrig."),
    answer: m.answer,
    hint: tx("Before the cleft (release), in the cleft (enzyme), after the cleft (receptors) or on the axon (Na⁺ channels)?", "Vor dem Spalt (Ausschüttung), im Spalt (Enzym), nach dem Spalt (Rezeptoren) oder am Axon (Na⁺-Kanäle)?"),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Each poison blocks or overdrives one particular step of the transmission.", "Jedes Gift blockiert oder übersteuert einen ganz bestimmten Schritt der Übertragung.") }],
    mistakes: m.mistakes,
  };
}

type Fact = { q: Text; opts: Opt[]; hint: Text; answer: Text; note: Text };
const POISON_FACTS: Fact[] = [
  {
    q: tx("An insecticide inhibits acetylcholinesterase. What is the effect at the motor end plate?", "Ein Insektizid hemmt die Acetylcholinesterase. Welche Folge hat das an der motorischen Endplatte?"),
    opts: [
      { text: tx("ACh stays in the cleft, the muscle fibre stays depolarised: cramps, then paralysis.", "ACh bleibt im Spalt, die Muskelfaser bleibt depolarisiert: Krämpfe, dann Lähmung.") },
      { text: tx("No more ACh is released: flaccid paralysis.", "Es wird kein ACh mehr ausgeschüttet: schlaffe Lähmung."), ...poisonMix("e605", "botox")! },
      { text: tx("ACh can no longer bind to the receptors.", "ACh kann nicht mehr an die Rezeptoren binden."), ...poisonMix("e605", "curare")! },
      { text: tx("No more Ca²⁺ flows into the end bulb.", "Es strömt kein Ca²⁺ mehr ins Endknöpfchen."), title: tx("The enzyme is in the cleft", "Das Enzym sitzt im Spalt"), say: tx("Ca²⁺ inflow happens before the release and isn't affected. The enzyme works **in the cleft**: if it's blocked, ACh isn't removed.", "Der Ca²⁺-Einstrom passiert vor der Ausschüttung und bleibt unberührt. Das Enzym arbeitet **im Spalt**: Ist es blockiert, wird ACh nicht entfernt.") },
    ],
    hint: tx("What does acetylcholinesterase normally do?", "Was macht die Acetylcholinesterase normalerweise?"),
    answer: tx("permanent excitation", "Dauererregung"),
    note: tx("Without the enzyme, ACh isn't split: the receptors keep opening, the muscle stays excited (cramps), then it can no longer respond (paralysis).", "Ohne das Enzym wird ACh nicht gespalten: Die Rezeptoren öffnen immer wieder, der Muskel bleibt erregt (Krämpfe) und kann dann nicht mehr reagieren (Lähmung)."),
  },
  {
    q: tx("A toxin prevents the vesicles from fusing with the presynaptic membrane. What happens?", "Ein Gift verhindert, dass die Vesikel mit der präsynaptischen Membran verschmelzen. Was passiert?"),
    opts: [
      { text: tx("No ACh is released: the muscle is not excited (flaccid paralysis).", "Es wird kein ACh ausgeschüttet: Der Muskel wird nicht erregt (schlaffe Lähmung).") },
      { text: tx("ACh piles up in the cleft: cramps.", "ACh staut sich im Spalt: Krämpfe."), title: tx("Nothing gets into the cleft", "In den Spalt kommt nichts"), say: tx("If the vesicles can't fuse, **no** ACh gets into the cleft at all. Piling up happens when the enzyme is blocked (E 605).", "Können die Vesikel nicht verschmelzen, kommt **gar kein** ACh in den Spalt. Anstauen würde es, wenn das Enzym blockiert ist (E 605).") },
      { text: tx("The action potential can no longer reach the end bulb.", "Das Aktionspotenzial erreicht das Endknöpfchen nicht mehr."), title: tx("The AP still arrives", "Das AP kommt noch an"), say: tx("The action potential still arrives and Ca²⁺ still flows in. Only the last step, the exocytosis, is blocked.", "Das Aktionspotenzial kommt noch an, und Ca²⁺ strömt noch ein. Blockiert ist nur der letzte Schritt, die Exocytose.") },
    ],
    hint: tx("Which step is that? It's the toxin in spoiled tins.", "Welcher Schritt ist das? Es ist das Gift aus verdorbenen Konserven."),
    answer: tx("flaccid paralysis", "schlaffe Lähmung"),
    note: tx("That's botulinum toxin: without exocytosis there's no ACh in the cleft and the muscle stays limp.", "Das ist Botulinumtoxin: Ohne Exocytose kein ACh im Spalt, der Muskel bleibt schlaff."),
  },
  {
    q: tx("Why does an acetylcholinesterase inhibitor (e.g. neostigmine) help against curare poisoning?", "Warum hilft ein Hemmstoff der Acetylcholinesterase (z. B. Neostigmin) gegen eine Curare-Vergiftung?"),
    opts: [
      { text: tx("More ACh stays in the cleft and pushes curare out of the receptors (competitive inhibition).", "Mehr ACh bleibt im Spalt und verdrängt Curare von den Rezeptoren (kompetitive Hemmung).") },
      { text: tx("It destroys the curare molecules.", "Er zerstört die Curare-Moleküle."), title: tx("Competition, not destruction", "Konkurrenz, nicht Zerstörung"), say: tx("Curare isn't destroyed. ACh and curare **compete** for the same receptors: the more ACh, the more often ACh wins.", "Curare wird nicht zerstört. ACh und Curare **konkurrieren** um dieselben Rezeptoren: Je mehr ACh da ist, desto öfter gewinnt ACh.") },
      { text: tx("It opens the Na⁺ channels directly.", "Er öffnet die Na⁺-Kanäle direkt."), title: tx("It works via ACh", "Er wirkt über ACh"), say: tx("The inhibitor doesn't touch the channels. It slows down the breakdown of ACh, so there is more ACh to compete with curare.", "Der Hemmstoff rührt die Kanäle nicht an. Er bremst den Abbau von ACh, sodass mehr ACh gegen Curare antritt.") },
    ],
    hint: tx("Curare and ACh fight for the same binding site.", "Curare und ACh kämpfen um dieselbe Bindungsstelle."),
    answer: tx("more ACh wins", "mehr ACh gewinnt"),
    note: tx("Curare inhibits **competitively**. A higher ACh concentration pushes it out of the receptors.", "Curare hemmt **kompetitiv**. Eine höhere ACh-Konzentration verdrängt es von den Rezeptoren."),
  },
  {
    q: tx("Why is atropine given as an antidote to E 605 poisoning?", "Warum gibt man Atropin als Gegengift bei einer E-605-Vergiftung?"),
    opts: [
      { text: tx("It blocks the ACh receptors that are being over-excited by the piled-up ACh.", "Es blockiert die ACh-Rezeptoren, die vom angestauten ACh dauernd erregt werden.") },
      { text: tx("It reactivates acetylcholinesterase.", "Es reaktiviert die Acetylcholinesterase."), title: tx("It blocks receptors", "Es blockiert Rezeptoren"), say: tx("Atropine doesn't repair the enzyme. It sits in the (muscarinic) **receptors** and shields them from the excess ACh.", "Atropin repariert das Enzym nicht. Es setzt sich in die (muskarinischen) **Rezeptoren** und schirmt sie vor dem überschüssigen ACh ab.") },
      { text: tx("It increases the release of ACh.", "Es steigert die Ausschüttung von ACh."), title: tx("That would make it worse", "Das wäre noch schlimmer"), say: tx("There's already too much ACh. Atropine **blocks** receptors so the ACh can't act on them.", "Es ist schon zu viel ACh da. Atropin **blockiert** Rezeptoren, damit das ACh dort nicht wirken kann.") },
    ],
    hint: tx("With E 605 there is too much ACh. What could limit its effect?", "Bei E 605 ist zu viel ACh da. Was könnte seine Wirkung begrenzen?"),
    answer: tx("blocks receptors", "blockiert Rezeptoren"),
    note: tx("Atropine is a receptor blocker. It counters the effects of too much ACh at the muscarinic receptors (heart, glands, gut).", "Atropin ist ein Rezeptorblocker. Es hält die Wirkung von zu viel ACh an den muskarinischen Rezeptoren (Herz, Drüsen, Darm) in Schach."),
  },
  {
    q: tx("Tetrodotoxin (puffer fish poison) blocks voltage-gated Na⁺ channels. What is the consequence?", "Tetrodotoxin (Gift des Kugelfischs) blockiert spannungsgesteuerte Na⁺-Kanäle. Welche Folge hat das?"),
    opts: [
      { text: tx("No more action potentials can arise: paralysis.", "Es können keine Aktionspotenziale mehr entstehen: Lähmung.") },
      { text: tx("The resting potential collapses straight away.", "Das Ruhepotenzial bricht sofort zusammen."), title: tx("Rest depends on K⁺", "Die Ruhe hängt an K⁺"), say: tx("The resting potential depends mainly on the K⁺ leak channels, which TTX doesn't block. What's missing is the Na⁺ inflow for the **action potential**.", "Das Ruhepotenzial hängt vor allem an den Kalium-Leckkanälen, die TTX nicht blockiert. Es fehlt der Na⁺-Einstrom für das **Aktionspotenzial**.") },
      { text: tx("The axons stay permanently depolarised.", "Die Axone bleiben dauerhaft depolarisiert."), title: tx("No depolarisation at all", "Gar keine Depolarisation"), say: tx("Without Na⁺ inflow the membrane can't depolarise at all. It stays at rest, but can't fire.", "Ohne Na⁺-Einstrom kann die Membran gar nicht depolarisieren. Sie bleibt in Ruhe, kann aber nicht feuern.") },
    ],
    hint: tx("Which phase of the action potential needs these channels?", "Welche Phase des Aktionspotenzials braucht diese Kanäle?"),
    answer: tx("no action potentials", "keine Aktionspotenziale"),
    note: tx("Without voltage-gated Na⁺ channels there is no depolarisation, so no action potentials. Breathing muscles fail too.", "Ohne spannungsgesteuerte Na⁺-Kanäle keine Depolarisation, also keine Aktionspotenziale. Auch die Atemmuskulatur fällt aus."),
  },
  {
    q: tx("Where does botulinum toxin act?", "Wo greift Botulinumtoxin an?"),
    opts: [
      { text: tx("presynaptically, at the release of ACh (exocytosis)", "präsynaptisch, an der Ausschüttung von ACh (Exocytose)") },
      { text: tx("postsynaptically, at the receptors", "postsynaptisch, an den Rezeptoren"), ...poisonMix("botox", "curare")! },
      { text: tx("in the cleft, at acetylcholinesterase", "im Spalt, an der Acetylcholinesterase"), title: tx("That's E 605", "Das ist E 605"), say: tx("Inhibiting the enzyme is what E 605 does. Botulinum toxin stops the vesicles from fusing, **before** the cleft.", "Das Enzym hemmt E 605. Botulinumtoxin verhindert das Verschmelzen der Vesikel, **vor** dem Spalt.") },
    ],
    hint: tx("Does any ACh get into the cleft at all?", "Gelangt überhaupt ACh in den Spalt?"),
    answer: tx("presynaptic: exocytosis", "präsynaptisch: Exocytose"),
    note: tx("Botulinum toxin destroys proteins needed for exocytosis. No ACh is released.", "Botulinumtoxin zerstört Proteine, die für die Exocytose nötig sind. Es wird kein ACh freigesetzt."),
  },
];

const SYN_FACTS: Fact[] = [
  {
    q: tx("A single synapse fires three times in quick succession. Each EPSP on its own is below threshold, together they reach the threshold at the axon hillock. What is this called?", "Eine einzelne Synapse feuert dreimal kurz hintereinander. Jedes EPSP allein ist unterschwellig, zusammen erreichen sie am Axonhügel den Schwellenwert. Wie heißt das?"),
    opts: [
      { text: tx("temporal summation", "zeitliche Summation") },
      { text: tx("spatial summation", "räumliche Summation"), title: tx("One synapse, several times", "Eine Synapse, mehrmals"), say: tx("Spatial summation needs **several synapses at the same time**. Here it's one synapse firing quickly one after another: temporal.", "Räumliche Summation braucht **mehrere Synapsen gleichzeitig**. Hier feuert eine Synapse schnell hintereinander: zeitlich.") },
      { text: tx("saltatory conduction", "saltatorische Erregungsleitung") },
    ],
    hint: tx("Same place, different times, or different places, same time?", "Gleicher Ort, verschiedene Zeiten, oder verschiedene Orte, gleiche Zeit?"),
    answer: tx("temporal summation", "zeitliche Summation"),
    note: tx("EPSPs of **one** synapse arriving shortly after each other add up: **temporal** summation.", "EPSPs **einer** Synapse, die kurz nacheinander eintreffen, addieren sich: **zeitliche** Summation."),
  },
  {
    q: tx("Three different synapses on the same neuron fire at the same moment. Their EPSPs add up at the axon hillock. What is this called?", "Drei verschiedene Synapsen an derselben Nervenzelle feuern im selben Moment. Ihre EPSPs addieren sich am Axonhügel. Wie heißt das?"),
    opts: [
      { text: tx("spatial summation", "räumliche Summation") },
      { text: tx("temporal summation", "zeitliche Summation"), title: tx("Different places, same time", "Verschiedene Orte, gleiche Zeit"), say: tx("Temporal summation is one synapse firing repeatedly. Here several synapses fire **at the same time**: spatial.", "Zeitliche Summation ist eine Synapse, die mehrmals feuert. Hier feuern mehrere Synapsen **gleichzeitig**: räumlich.") },
      { text: tx("all-or-none law", "Alles-oder-Nichts-Gesetz") },
    ],
    hint: tx("Several places at once.", "Mehrere Orte auf einmal."),
    answer: tx("spatial summation", "räumliche Summation"),
    note: tx("EPSPs from **several** synapses at the same time add up: **spatial** summation.", "EPSPs **mehrerer** Synapsen zur gleichen Zeit addieren sich: **räumliche** Summation."),
  },
  {
    q: tx("At the same moment an EPSP and an equally large IPSP arrive at the axon hillock. What happens?", "Im selben Moment treffen ein EPSP und ein gleich großes IPSP am Axonhügel ein. Was passiert?"),
    opts: [
      { text: tx("They largely cancel out: no action potential.", "Sie heben sich weitgehend auf: kein Aktionspotenzial.") },
      { text: tx("They add up to a large action potential.", "Sie addieren sich zu einem großen Aktionspotenzial."), title: tx("IPSPs subtract", "IPSPs werden abgezogen"), say: tx("An IPSP **hyperpolarises**: it pulls the potential away from the threshold. EPSP and IPSP are offset against each other.", "Ein IPSP **hyperpolarisiert**: Es zieht das Potenzial vom Schwellenwert weg. EPSP und IPSP werden gegeneinander verrechnet.") },
      { text: tx("The IPSP is ignored.", "Das IPSP wird nicht beachtet.") },
    ],
    hint: tx("An IPSP is inhibitory.", "Ein IPSP hemmt."),
    answer: tx("no action potential", "kein Aktionspotenzial"),
    note: tx("At the axon hillock excitatory and inhibitory potentials are **added up**. Only if the threshold is reached does an action potential start.", "Am Axonhügel werden erregende und hemmende Potenziale **verrechnet**. Nur wenn der Schwellenwert erreicht ist, startet ein Aktionspotenzial."),
  },
  {
    q: tx("What is an IPSP?", "Was ist ein IPSP?"),
    opts: [
      { text: tx("a hyperpolarisation of the postsynaptic membrane, e.g. by Cl⁻ flowing in", "eine Hyperpolarisation der postsynaptischen Membran, z. B. durch Cl⁻-Einstrom") },
      { text: tx("a depolarisation caused by Na⁺ flowing in", "eine Depolarisation durch Na⁺-Einstrom"), title: tx("That's an EPSP", "Das ist ein EPSP"), say: tx("Na⁺ flowing in depolarises: that's an **E**PSP (excitatory). The **I** stands for inhibitory.", "Na⁺-Einstrom depolarisiert: Das ist ein **E**PSP (erregend). Das **I** steht für inhibitorisch, also hemmend.") },
      { text: tx("a particularly large action potential", "ein besonders großes Aktionspotenzial"), title: tx("PSPs aren't action potentials", "PSPs sind keine Aktionspotenziale"), say: tx("A postsynaptic potential is a small, graded change. Action potentials are always the same size.", "Ein postsynaptisches Potenzial ist eine kleine, abgestufte Änderung. Aktionspotenziale sind immer gleich groß.") },
    ],
    hint: tx("I for inhibitory.", "I wie inhibitorisch (hemmend)."),
    answer: tx("hyperpolarisation", "Hyperpolarisation"),
    note: tx("An **inhibitory** postsynaptic potential makes the inside more negative (Cl⁻ in or K⁺ out), e.g. with the transmitter GABA.", "Ein **inhibitorisches** postsynaptisches Potenzial macht das Innere negativer (Cl⁻ rein oder K⁺ raus), z. B. beim Transmitter GABA."),
  },
  {
    q: tx("Why does Ca²⁺ matter at the chemical synapse?", "Welche Rolle spielt Ca²⁺ an der chemischen Synapse?"),
    opts: [
      { text: tx("Ca²⁺ flowing into the end bulb triggers the exocytosis of the vesicles.", "Einströmendes Ca²⁺ löst im Endknöpfchen die Exocytose der Vesikel aus.") },
      { text: tx("Ca²⁺ is the transmitter that crosses the cleft.", "Ca²⁺ ist der Transmitter, der durch den Spalt wandert."), title: tx("Ca²⁺ is the trigger", "Ca²⁺ ist der Auslöser"), say: tx("The transmitter here is acetylcholine. Ca²⁺ stays in the end bulb and only **triggers** the release.", "Der Transmitter ist hier Acetylcholin. Ca²⁺ bleibt im Endknöpfchen und **löst** nur die Ausschüttung aus.") },
      { text: tx("Ca²⁺ splits acetylcholine in the cleft.", "Ca²⁺ spaltet im Spalt das Acetylcholin."), title: tx("That's the enzyme", "Das macht das Enzym"), say: tx("Acetylcholine is split by the enzyme acetylcholinesterase.", "Acetylcholin spaltet das Enzym Acetylcholinesterase.") },
    ],
    hint: tx("Voltage-gated Ca²⁺ channels open when the action potential arrives.", "Spannungsgesteuerte Ca²⁺-Kanäle öffnen, wenn das Aktionspotenzial ankommt."),
    answer: tx("triggers exocytosis", "löst Exocytose aus"),
    note: tx("Action potential → Ca²⁺ channels open → Ca²⁺ flows in → vesicles fuse (exocytosis).", "Aktionspotenzial → Ca²⁺-Kanäle öffnen → Ca²⁺ strömt ein → Vesikel verschmelzen (Exocytose)."),
  },
  {
    q: tx("How does an EPSP differ from an action potential?", "Wie unterscheidet sich ein EPSP von einem Aktionspotenzial?"),
    opts: [
      { text: tx("It is graded (more transmitter, bigger EPSP) and fades as it spreads.", "Es ist abgestuft (mehr Transmitter, größeres EPSP) und klingt bei der Ausbreitung ab.") },
      { text: tx("It follows the all-or-none law.", "Es folgt dem Alles-oder-Nichts-Gesetz."), title: tx("Only APs are all-or-none", "Nur APs sind Alles oder Nichts"), say: tx("The all-or-none law applies to **action potentials**. EPSPs are graded: their size depends on the amount of transmitter.", "Das Alles-oder-Nichts-Gesetz gilt für **Aktionspotenziale**. EPSPs sind abgestuft: Ihre Größe hängt von der Transmittermenge ab.") },
      { text: tx("It is always exactly +30 mV.", "Es erreicht immer genau +30 mV."), title: tx("EPSPs are small", "EPSPs sind klein"), say: tx("+30 mV is the peak of an action potential. An EPSP is usually only a few millivolts.", "+30 mV ist der Gipfel eines Aktionspotenzials. Ein EPSP beträgt meist nur wenige Millivolt.") },
    ],
    hint: tx("Amplitude coding at the synapse, frequency coding on the axon.", "Amplitudencodierung an der Synapse, Frequenzcodierung am Axon."),
    answer: tx("graded, fades", "abgestuft, klingt ab"),
    note: tx("Postsynaptic potentials are **graded** and spread with decrement; action potentials are all-or-none and are regenerated.", "Postsynaptische Potenziale sind **abgestuft** und breiten sich abklingend aus; Aktionspotenziale folgen dem Alles-oder-Nichts-Gesetz und werden neu gebildet."),
  },
];

const AP_FACTS: Fact[] = [
  {
    q: tx("A stimulus is made twice as strong. How do the action potentials in the axon change?", "Ein Reiz wird doppelt so stark. Wie ändern sich die Aktionspotenziale im Axon?"),
    opts: [
      { text: tx("They follow each other more often (higher frequency); their height stays the same.", "Sie folgen häufiger aufeinander (höhere Frequenz); ihre Höhe bleibt gleich.") },
      { text: tx("They become twice as high.", "Sie werden doppelt so hoch."), title: tx("All or none", "Alles oder nichts"), say: tx("A bigger stimulus does **not** make a bigger action potential: all-or-none law. The strength is coded in the **frequency**.", "Ein größerer Reiz macht **kein** größeres Aktionspotenzial: Alles-oder-Nichts-Gesetz. Die Stärke steckt in der **Frequenz**.") },
      { text: tx("They are conducted faster.", "Sie werden schneller weitergeleitet."), title: tx("Speed depends on the fibre", "Das Tempo hängt an der Faser"), say: tx("The conduction speed depends on the fibre (myelin, diameter), not on the stimulus.", "Die Leitungsgeschwindigkeit hängt von der Faser ab (Myelin, Durchmesser), nicht vom Reiz.") },
      { text: tx("Nothing changes at all.", "Es ändert sich gar nichts.") },
    ],
    hint: tx("Height or frequency?", "Höhe oder Frequenz?"),
    answer: tx("higher frequency", "höhere Frequenz"),
    note: tx("All-or-none: every action potential is the same height. Stronger stimulus → **higher frequency** (frequency coding).", "Alles oder nichts: Jedes Aktionspotenzial ist gleich hoch. Stärkerer Reiz → **höhere Frequenz** (Frequenzcodierung)."),
  },
  {
    q: tx("A stimulus depolarises the membrane only to −60 mV. What happens?", "Ein Reiz depolarisiert die Membran nur bis −60 mV. Was passiert?"),
    opts: [
      { text: tx("No action potential: the depolarisation fades away.", "Kein Aktionspotenzial: Die Depolarisation klingt wieder ab.") },
      { text: tx("A small action potential starts.", "Es entsteht ein kleines Aktionspotenzial."), title: tx("No small APs", "Keine kleinen APs"), say: tx("There are no small action potentials: below the threshold (about −50 mV) there is none at all, above it a full one.", "Kleine Aktionspotenziale gibt es nicht: Unter dem Schwellenwert (etwa −50 mV) entsteht gar keins, darüber ein vollständiges.") },
      { text: tx("A normal action potential starts, just a little later.", "Es entsteht ein normales Aktionspotenzial, nur etwas später."), title: tx("Threshold not reached", "Schwelle nicht erreicht"), say: tx("−60 mV is below the threshold of about −50 mV: too few Na⁺ channels open. No action potential.", "−60 mV liegt unter dem Schwellenwert von etwa −50 mV: Es öffnen zu wenige Na⁺-Kanäle. Kein Aktionspotenzial.") },
    ],
    hint: tx("Where is the threshold?", "Wo liegt der Schwellenwert?"),
    answer: tx("no action potential", "kein Aktionspotenzial"),
    note: tx("Below threshold (about −50 mV): no action potential. Above it: always a full one.", "Unter dem Schwellenwert (etwa −50 mV): kein Aktionspotenzial. Darüber: immer ein vollständiges."),
  },
  {
    q: tx("Why can't an action potential run backwards along the axon?", "Warum kann ein Aktionspotenzial im Axon nicht zurücklaufen?"),
    opts: [
      { text: tx("Behind it the Na⁺ channels are still inactivated (refractory period).", "Hinter ihm sind die Na⁺-Kanäle noch inaktiviert (Refraktärzeit).") },
      { text: tx("The myelin sheath only conducts in one direction.", "Die Myelinscheide leitet nur in eine Richtung."), title: tx("Myelin only insulates", "Myelin isoliert nur"), say: tx("Myelin only insulates, it has no direction. The reason is the **refractory period**: the membrane just behind can't fire again yet.", "Myelin isoliert nur und kennt keine Richtung. Der Grund ist die **Refraktärzeit**: Die Membran direkt dahinter kann noch nicht wieder feuern.") },
      { text: tx("The K⁺ flowing in pushes it forwards.", "Das einströmende K⁺ schiebt es nach vorn."), ...K_IN_SAY },
    ],
    hint: tx("What state are the Na⁺ channels in just after an action potential?", "In welchem Zustand sind die Na⁺-Kanäle direkt nach einem Aktionspotenzial?"),
    answer: tx("refractory period", "Refraktärzeit"),
    note: tx("The membrane just behind is in its **refractory period**: Na⁺ channels inactivated. So the impulse can only move forwards.", "Die Membran direkt dahinter ist in der **Refraktärzeit**: Na⁺-Kanäle inaktiviert. Darum läuft die Erregung nur nach vorn."),
  },
  {
    q: tx("Why is conduction faster in myelinated axons?", "Warum ist die Erregungsleitung in markhaltigen Axonen schneller?"),
    opts: [
      { text: tx("The myelin insulates; action potentials only arise at the nodes of Ranvier and jump from node to node.", "Das Myelin isoliert; Aktionspotenziale entstehen nur an den Ranvierschen Schnürringen und springen von Schnürring zu Schnürring.") },
      { text: tx("Ions flow especially fast through the myelin sheath.", "Durch die Myelinscheide strömen Ionen besonders schnell."), title: tx("No ions through myelin", "Durch Myelin keine Ionen"), say: tx("Exactly the opposite: myelin lets **no** ions through. That's why ions only flow at the nodes of Ranvier.", "Genau umgekehrt: Myelin lässt **keine** Ionen durch. Darum fließen Ionen nur an den Schnürringen.") },
      { text: tx("The action potentials are bigger.", "Die Aktionspotenziale sind größer."), title: tx("All the same height", "Alle gleich hoch"), say: tx("All action potentials are the same height (all-or-none). The time is saved because they only have to form at the nodes.", "Alle Aktionspotenziale sind gleich hoch (Alles oder nichts). Zeit wird gespart, weil sie nur an den Schnürringen gebildet werden müssen.") },
    ],
    hint: tx("Where do the action potentials have to be formed?", "Wo müssen die Aktionspotenziale gebildet werden?"),
    answer: tx("saltatory conduction", "saltatorische Leitung"),
    note: tx("**Saltatory** conduction: the action potential is only regenerated at the nodes. That's faster and saves energy.", "**Saltatorische** Leitung: Das Aktionspotenzial wird nur an den Schnürringen neu gebildet. Das ist schneller und spart Energie."),
  },
  {
    q: tx("How can an unmyelinated axon conduct faster?", "Wie kann ein markloses Axon schneller leiten?"),
    opts: [
      { text: tx("with a larger diameter (like the squid giant axon)", "durch einen größeren Durchmesser (wie das Riesenaxon des Tintenfischs)") },
      { text: tx("with a stronger stimulus", "durch einen stärkeren Reiz"), title: tx("The stimulus doesn't set the speed", "Der Reiz bestimmt nicht das Tempo"), say: tx("A stronger stimulus gives more action potentials, not faster ones. The speed depends on the fibre: a thicker axon has a lower resistance inside.", "Ein stärkerer Reiz gibt mehr Aktionspotenziale, nicht schnellere. Das Tempo hängt von der Faser ab: Ein dickeres Axon hat innen einen kleineren Widerstand.") },
      { text: tx("with a longer axon", "durch ein längeres Axon") },
    ],
    hint: tx("Think of the squid.", "Denk an den Tintenfisch."),
    answer: tx("larger diameter", "größerer Durchmesser"),
    note: tx("A thicker axon conducts faster (lower internal resistance), but needs much more space than myelin.", "Ein dickeres Axon leitet schneller (kleinerer Innenwiderstand), braucht aber viel mehr Platz als Myelin."),
  },
];

const EXP_FACTS: Fact[] = [
  {
    q: tx("In an experiment the K⁺ concentration outside a nerve cell is raised strongly. How does the resting potential change?", "In einem Versuch wird die K⁺-Konzentration außerhalb einer Nervenzelle stark erhöht. Wie verändert sich das Ruhepotenzial?"),
    opts: [
      { text: tx("It becomes less negative (depolarised), because less K⁺ flows out.", "Es wird weniger negativ (depolarisiert), weil weniger K⁺ ausströmt.") },
      { text: tx("It becomes more negative, because more K⁺ flows out.", "Es wird negativer, weil mehr K⁺ ausströmt."), title: tx("Smaller gradient", "Kleineres Gefälle"), say: tx("With more K⁺ outside, the concentration gradient for K⁺ is **smaller**: less K⁺ flows out, the inside becomes less negative.", "Mit mehr K⁺ außen ist das Konzentrationsgefälle für K⁺ **kleiner**: Es strömt weniger K⁺ aus, das Innere wird weniger negativ.") },
      { text: tx("It stays the same, because only Na⁺ matters.", "Es bleibt gleich, weil nur Na⁺ zählt."), title: tx("K⁺ sets the resting potential", "K⁺ bestimmt das Ruhepotenzial"), say: tx("The resting potential depends mainly on K⁺, because at rest the membrane is mostly permeable to K⁺.", "Das Ruhepotenzial hängt vor allem an K⁺, weil die Membran in Ruhe vor allem für K⁺ durchlässig ist.") },
    ],
    hint: tx("The resting potential comes from K⁺ flowing out down its gradient.", "Das Ruhepotenzial entsteht durch K⁺-Ausstrom entlang des Gefälles."),
    answer: tx("less negative", "weniger negativ"),
    note: tx("Less K⁺ gradient → less K⁺ efflux → the membrane is depolarised.", "Kleineres K⁺-Gefälle → weniger K⁺-Ausstrom → die Membran wird depolarisiert."),
  },
  {
    q: tx("The sodium-potassium pump is blocked with a poison (ouabain). What happens in the long run?", "Die Natrium-Kalium-Pumpe wird mit einem Gift (Ouabain) blockiert. Was passiert auf lange Sicht?"),
    opts: [
      { text: tx("The concentration differences slowly run down, so the resting potential gets smaller and smaller.", "Die Konzentrationsunterschiede bauen sich langsam ab, das Ruhepotenzial wird immer kleiner.") },
      { text: tx("The resting potential disappears immediately.", "Das Ruhepotenzial verschwindet sofort."), title: tx("Only slowly", "Nur langsam"), say: tx("The pump only maintains the gradients. Without it they run down **slowly** through the leaks: nothing changes immediately.", "Die Pumpe hält nur die Gradienten aufrecht. Ohne sie bauen sie sich **langsam** über die Leckströme ab: Sofort ändert sich kaum etwas.") },
      { text: tx("The cell becomes more and more negative inside.", "Die Zelle wird innen immer negativer."), title: tx("The gradients run down", "Die Gefälle verschwinden"), say: tx("Without the pump K⁺ leaks out and Na⁺ leaks in, until the gradients are gone: the potential approaches 0 mV.", "Ohne Pumpe strömt K⁺ heraus und Na⁺ herein, bis die Gefälle weg sind: Das Potenzial nähert sich 0 mV.") },
    ],
    hint: tx("What does the pump do: create the voltage or keep the gradients up?", "Was macht die Pumpe: die Spannung erzeugen oder die Gefälle erhalten?"),
    answer: tx("slowly runs down", "baut sich langsam ab"),
    note: tx("The pump keeps the ion gradients up. Without it, the leak currents slowly even them out.", "Die Pumpe hält die Ionengradienten aufrecht. Ohne sie gleichen die Leckströme sie langsam aus."),
  },
  {
    q: tx("An axon is placed in a solution in which Na⁺ has been replaced by a cation that can't pass through the channels. What happens when it is stimulated?", "Ein Axon liegt in einer Lösung, in der Na⁺ durch ein Kation ersetzt wurde, das nicht durch die Kanäle passt. Was passiert bei Reizung?"),
    opts: [
      { text: tx("No action potential forms, because no Na⁺ can flow in.", "Es entsteht kein Aktionspotenzial, weil kein Na⁺ einströmen kann.") },
      { text: tx("The action potential becomes larger.", "Das Aktionspotenzial wird größer."), title: tx("No Na⁺, no depolarisation", "Ohne Na⁺ keine Depolarisation"), say: tx("The depolarisation is carried by Na⁺ flowing in. Without Na⁺ outside it can't happen.", "Die Depolarisation entsteht durch Na⁺-Einstrom. Ohne Na⁺ außen kann sie nicht stattfinden.") },
      { text: tx("The resting potential collapses.", "Das Ruhepotenzial bricht zusammen."), title: tx("Rest depends on K⁺", "Die Ruhe hängt an K⁺"), say: tx("The resting potential depends mainly on K⁺ and hardly changes. Only the action potential needs Na⁺.", "Das Ruhepotenzial hängt vor allem an K⁺ und ändert sich kaum. Nur das Aktionspotenzial braucht Na⁺.") },
    ],
    hint: tx("Which ion carries the depolarisation?", "Welches Ion trägt die Depolarisation?"),
    answer: tx("no action potential", "kein Aktionspotenzial"),
    note: tx("This experiment shows that the depolarisation is carried by **Na⁺ flowing in**.", "Dieser Versuch zeigt: Die Depolarisation wird vom **Na⁺-Einstrom** getragen."),
  },
  {
    q: tx("A substance (TEA) blocks the voltage-gated K⁺ channels. How does the action potential change?", "Ein Stoff (TEA) blockiert die spannungsgesteuerten K⁺-Kanäle. Wie verändert sich das Aktionspotenzial?"),
    opts: [
      { text: tx("The repolarisation takes much longer: the action potential is broadened.", "Die Repolarisation dauert viel länger: Das Aktionspotenzial wird verbreitert.") },
      { text: tx("There is no depolarisation any more.", "Es gibt keine Depolarisation mehr."), ...K_IN_SAY },
      { text: tx("The action potential becomes smaller.", "Das Aktionspotenzial wird kleiner."), title: tx("The rise is unchanged", "Der Anstieg bleibt"), say: tx("The rise comes from Na⁺ and isn't affected. Without the voltage-gated K⁺ channels the **fall** back to rest is slowed.", "Der Anstieg kommt von Na⁺ und bleibt unverändert. Ohne die spannungsgesteuerten K⁺-Kanäle wird der **Abfall** zur Ruhe verlangsamt.") },
    ],
    hint: tx("Which phase needs the voltage-gated K⁺ channels?", "Welche Phase braucht die spannungsgesteuerten K⁺-Kanäle?"),
    answer: tx("longer repolarisation", "längere Repolarisation"),
    note: tx("Voltage-gated K⁺ channels speed up the repolarisation. Blocked, the action potential becomes much longer.", "Spannungsgesteuerte K⁺-Kanäle beschleunigen die Repolarisation. Blockiert, wird das Aktionspotenzial deutlich länger."),
  },
  {
    q: tx("In an experiment an axon is stimulated in the middle. In which direction does the excitation spread?", "In einem Versuch wird ein Axon in der Mitte gereizt. In welche Richtung breitet sich die Erregung aus?"),
    opts: [
      { text: tx("in both directions, because on either side no channels are inactivated yet", "in beide Richtungen, weil auf beiden Seiten noch keine Kanäle inaktiviert sind") },
      { text: tx("only towards the axon terminals", "nur zu den Endknöpfchen hin"), title: tx("Direction comes from history", "Die Richtung hat einen Grund"), say: tx("Normally the impulse starts at the axon hillock, and the refractory membrane behind it stops it going back. Started in the middle, nothing is refractory yet: it runs **both ways**.", "Normalerweise startet die Erregung am Axonhügel, und die refraktäre Membran dahinter hält sie vom Zurücklaufen ab. Mitten im Axon gestartet, ist noch nichts refraktär: Sie läuft in **beide Richtungen**.") },
      { text: tx("only towards the cell body", "nur zum Zellkörper hin") },
    ],
    hint: tx("Why does an impulse normally only run one way?", "Warum läuft eine Erregung normalerweise nur in eine Richtung?"),
    answer: tx("both directions", "beide Richtungen"),
    note: tx("The one-way traffic comes from the refractory period **behind** the action potential. In the middle of a resting axon there is none yet.", "Die Einbahnstraße kommt von der Refraktärzeit **hinter** dem Aktionspotenzial. Mitten in einem ruhenden Axon gibt es noch keine."),
  },
];

function factTask(rng: Rng, bank: Fact[], instruction: Text): Exercise {
  const f = rng.pick(bank);
  const c = choice(rng, f.opts);
  return { instruction, text: f.q, answer: c.answer, hint: f.hint, solution: [answerFrame(f.answer, f.note)], mistakes: c.mistakes };
}

const SYN_EVENTS: Text[] = [
  tx("An action potential reaches the end bulb", "Ein Aktionspotenzial erreicht das Endknöpfchen"),
  tx("Voltage-gated Ca²⁺ channels open, Ca²⁺ flows in", "Spannungsgesteuerte Ca²⁺-Kanäle öffnen sich, Ca²⁺ strömt ein"),
  tx("Vesicles fuse with the membrane (exocytosis)", "Vesikel verschmelzen mit der Membran (Exocytose)"),
  tx("ACh diffuses across the cleft and binds to receptors", "ACh diffundiert durch den Spalt und bindet an Rezeptoren"),
  tx("Ligand-gated Na⁺ channels open: EPSP", "Ligandengesteuerte Na⁺-Kanäle öffnen sich: EPSP"),
  tx("Acetylcholinesterase splits ACh into acetate and choline", "Acetylcholinesterase spaltet ACh in Acetat und Cholin"),
  tx("Choline is taken back up into the end bulb", "Cholin wird ins Endknöpfchen zurückgeholt"),
];
function synOrderTask(rng: Rng): Exercise {
  const len = rng.int(4, 6);
  const start = rng.int(0, SYN_EVENTS.length - len);
  const items = SYN_EVENTS.slice(start, start + len);
  const S = SYN_EVENTS;
  const o = order(items, [
    { items: [S[2], S[1]], title: tx("Ca²⁺ comes first", "Erst kommt Ca²⁺"), say: tx("Without Ca²⁺ flowing in there is no exocytosis: the Ca²⁺ is the trigger for the vesicles to fuse.", "Ohne Ca²⁺-Einstrom keine Exocytose: Das Ca²⁺ ist der Auslöser für das Verschmelzen der Vesikel.") },
    { items: [S[4], S[3]], title: tx("Binding opens the channel", "Die Bindung öffnet den Kanal"), say: tx("The receptors are **ligand-gated**: they only open once ACh has bound.", "Die Rezeptoren sind **ligandengesteuert**: Sie öffnen sich erst, wenn ACh gebunden hat.") },
    { items: [S[5], S[3]], title: tx("Split too early", "Zu früh gespalten"), say: tx("If ACh were split before binding, no signal would arrive. The enzyme ends the signal **afterwards**.", "Würde ACh vor der Bindung gespalten, käme kein Signal an. Das Enzym beendet das Signal **danach**.") },
    { items: [S[1], S[0]], title: tx("The AP opens the Ca²⁺ channels", "Das AP öffnet die Ca²⁺-Kanäle"), say: tx("The Ca²⁺ channels are voltage-gated: they open because the action potential depolarises the end bulb.", "Die Ca²⁺-Kanäle sind spannungsgesteuert: Sie öffnen sich, weil das Aktionspotenzial das Endknöpfchen depolarisiert.") },
  ]);
  return {
    instruction: tx("Transmission at the synapse", "Übertragung an der Synapse"),
    text: tx("Put the events at a cholinergic synapse in the right order.", "Bring die Vorgänge an einer cholinergen Synapse in die richtige Reihenfolge."),
    answer: o.answer,
    hint: tx("AP → Ca²⁺ → exocytosis → binding → Na⁺ in → split → recycling.", "AP → Ca²⁺ → Exocytose → Bindung → Na⁺ rein → Spaltung → Recycling."),
    solution: [{ math: cat(q(tx("AP", "AP")), "\\to", "\\ce{Ca^2+}", "\\to", q(tx("exocytosis", "Exocytose")), "\\\\", "\\to", q(tx("binding", "Bindung")), "\\to", q(tx("EPSP", "EPSP")), "\\to", q(tx("AChE", "AChE"))), note: tx("Electrical (AP, Ca²⁺) → chemical (ACh) → electrical (EPSP), then the enzyme ends the signal.", "Elektrisch (AP, Ca²⁺) → chemisch (ACh) → elektrisch (EPSP), dann beendet das Enzym das Signal.") }],
    mistakes: o.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.3, () => apPointTask(rng)],
    [1, () => apOrderTask(rng)],
    [1, () => restTask(rng)],
    [0.9, () => pumpTask(rng)],
    [1, () => timeTask(rng)],
    [0.9, () => speedTask(rng)],
    [0.8, () => freqTask(rng)],
    [1, () => poisonMatchTask(rng)],
    [1, () => factTask(rng, POISON_FACTS, tx("Synaptic poisons", "Synapsengifte"))],
    [0.9, () => factTask(rng, SYN_FACTS, tx("Synapse and summation", "Synapse und Summation"))],
    [1, () => factTask(rng, AP_FACTS, tx("All-or-none and conduction", "Alles oder nichts und Erregungsleitung"))],
    [0.9, () => factTask(rng, EXP_FACTS, tx("Interpret the experiment", "Deute den Versuch"))],
    [0.8, () => synOrderTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const restCheck = choiceAt(1, [
  { text: tx("K⁺ diffuses out through leak channels; the A⁻ stay behind.", "K⁺ diffundiert durch Leckkanäle nach außen; die A⁻ bleiben zurück.") },
  { text: tx("Na⁺ flows out through leak channels.", "Na⁺ strömt durch Leckkanäle nach außen."), title: tx("Na⁺ wants in, not out", "Na⁺ will rein, nicht raus"), say: tx("Na⁺ is far more concentrated **outside**: it would rather flow in than out. The key is **K⁺ flowing out**.", "Na⁺ ist **außen** viel höher konzentriert: Es würde eher hinein- als hinausströmen. Entscheidend ist der **K⁺-Ausstrom**.") },
  { text: tx("The sodium-potassium pump pumps all positive ions out.", "Die Natrium-Kalium-Pumpe pumpt alle positiven Ionen hinaus."), title: tx("The pump maintains, the leak creates", "Die Pumpe erhält, das Leck erzeugt"), say: tx("The pump swaps 3 Na⁺ for 2 K⁺ and contributes only a little directly. It keeps the gradients up; the voltage itself comes mainly from K⁺ leaking out.", "Die Pumpe tauscht 3 Na⁺ gegen 2 K⁺ und trägt direkt nur wenig bei. Sie hält die Gradienten aufrecht; die Spannung selbst entsteht vor allem durch K⁺-Ausstrom durch die Leckkanäle.") },
  { text: tx("Large amounts of Cl⁻ flow in.", "Es strömen große Mengen Cl⁻ ein."), title: tx("Not Cl⁻", "Nicht Cl⁻"), say: tx("At rest the membrane is mainly permeable to K⁺. The negative inside comes from K⁺ leaving while the A⁻ have to stay.", "In Ruhe ist die Membran vor allem für K⁺ durchlässig. Das negative Innere entsteht, weil K⁺ geht und die A⁻ bleiben müssen.") },
]);

const restCheckEx: Exercise = {
  instruction: tx("Pick the right answer", "Wähle die richtige Antwort"),
  text: tx("Why is the inside of a resting nerve cell negatively charged?", "Warum ist das Innere einer ruhenden Nervenzelle negativ geladen?"),
  answer: restCheck.answer,
  hint: tx("Which ion can leave through the open leak channels, and who has to stay behind?", "Welches Ion kann durch die offenen Leckkanäle hinaus, und wer muss zurückbleiben?"),
  solution: [answerFrame(tx("K⁺ out, A⁻ stay", "K⁺ raus, A⁻ bleiben"), tx("K⁺ diffuses out down its concentration gradient; the large A⁻ can't follow. A surplus of negative charge stays inside.", "K⁺ diffundiert dem Konzentrationsgefälle folgend hinaus; die großen A⁻ können nicht folgen. Innen bleibt negative Ladung übrig."))],
  mistakes: restCheck.mistakes,
};

const poisonCheck = (() => {
  const f = POISON_FACTS[0];
  const c = choiceAt(2, f.opts);
  const ex: Exercise = { instruction: tx("Synaptic poisons", "Synapsengifte"), text: tx("E 605 inhibits acetylcholinesterase. What is the effect at the motor end plate?", "E 605 hemmt die Acetylcholinesterase. Welche Folge hat das an der motorischen Endplatte?"), answer: c.answer, hint: f.hint, solution: [answerFrame(f.answer, f.note)], mistakes: c.mistakes };
  return ex;
})();

const ION_IN = cat(q(tx("inside:", "innen:"), "i"), "\\ce{K+} , \\ce{A-}");
const ION_OUT = cat(q(tx("outside:", "außen:"), "o"), "\\ce{Na+} , \\ce{Cl-}");

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The resting potential", "Das Ruhepotenzial"),
      blob: tx("Now it gets electric! From here on we count in millivolts.", "Jetzt wird es elektrisch! Ab hier rechnen wir in Millivolt."),
      body: tx(
        "Across the membrane of a resting nerve cell there is a voltage: the **resting potential**, about **−70 mV** (negative inside). It comes from an uneven distribution of ions and a membrane that only lets some of them through.",
        "An der Membran einer ruhenden Nervenzelle liegt eine Spannung: das **Ruhepotenzial**, etwa **−70 mV** (innen negativ). Es entsteht durch eine ungleiche Ionenverteilung und eine Membran, die nur manche Ionen durchlässt.",
      ),
      frames: [
        { math: cat(ION_IN, "\\\\", ION_OUT), note: tx("Inside there are lots of K⁺ and large organic anions (A⁻), outside lots of Na⁺ and Cl⁻.", "Innen gibt es viele K⁺ und große organische Anionen (A⁻), außen viele Na⁺ und Cl⁻.") },
        { math: cat("\\ce{K+}", q(tx("leak channels:", "Leckkanäle:")), q(tx("K⁺ out", "K⁺ raus"))), note: tx("At rest the membrane is mainly permeable to K⁺ (**K⁺ leak channels**). K⁺ diffuses out, down its concentration gradient; the large A⁻ can't follow.", "In Ruhe ist die Membran vor allem für K⁺ durchlässig (**Kalium-Leckkanäle**). K⁺ diffundiert dem Konzentrationsgefälle folgend hinaus; die großen A⁻ können nicht folgen.") },
        { math: cat(q(tx("outside +", "außen +")), "\\quad", q(tx("inside −", "innen −"))), note: tx("This separates charge: positive outside, negative inside. The **electrical gradient** pulls K⁺ back in.", "So entsteht eine Ladungstrennung: außen positiv, innen negativ. Das **Ladungsgefälle** zieht K⁺ wieder zurück.") },
        { math: cat(q(tx("K⁺ out = K⁺ in", "K⁺ raus = K⁺ rein")), "\\Rightarrow", "\\hl{-70 \"mV\"}"), note: tx("At about −90 mV as much K⁺ flows out as in: the **equilibrium potential** of K⁺. A small Na⁺ leak current makes it about **−70 mV**.", "Bei etwa −90 mV strömt gleich viel K⁺ hinaus wie herein: das **Gleichgewichtspotenzial** von K⁺. Ein kleiner Na⁺-Leckstrom macht daraus etwa **−70 mV**.") },
        { math: tx('3 \\ce{Na+} "out" , \\; 2 \\ce{K+} "in" , \\; 1 "ATP"', '3 \\ce{Na+} "raus" , \\; 2 \\ce{K+} "rein" , \\; 1 "ATP"'), note: tx("The **sodium-potassium pump** (Na⁺/K⁺-ATPase) keeps the concentration differences up: per ATP **3 Na⁺ out, 2 K⁺ in** (active transport).", "Die **Natrium-Kalium-Pumpe** (Na⁺/K⁺-ATPase) hält die Konzentrationsunterschiede aufrecht: pro ATP **3 Na⁺ hinaus, 2 K⁺ hinein** (aktiver Transport).") },
      ],
    },
    {
      type: "widget",
      title: tx("How the resting potential arises", "So entsteht das Ruhepotenzial"),
      blob: tx("A thought experiment: let's build the resting potential.", "Ein Gedankenexperiment: Wir bauen das Ruhepotenzial zusammen."),
      body: tx("Go through the thought experiment step by step and watch the voltage.", "Geh das Gedankenexperiment Schritt für Schritt durch und beobachte die Spannung."),
      widget: NerveRestingLab,
    },
    { type: "check", blob: tx("Where does the minus inside come from?", "Woher kommt das Minus innen?"), exercise: restCheckEx },
    {
      type: "widget",
      title: tx("The action potential", "Das Aktionspotenzial"),
      blob: tx("Here comes the heart of neurobiology!", "Jetzt kommt das Herzstück der Neurobiologie!"),
      body: tx(
        "Stimulate the membrane and watch the curve and the ion channels at the same time. Try a weak stimulus too, and switch on the refractory period. The second tab shows what a stronger stimulus does.",
        "Reize die Membran und beobachte gleichzeitig die Kurve und die Ionenkanäle. Probier auch einen schwachen Reiz und schalte die Refraktärzeit ein. Im zweiten Reiter siehst du, was ein stärkerer Reiz bewirkt.",
      ),
      widget: NerveApLab,
    },
    { type: "check", blob: tx("Read the curve like a pro.", "Lies die Kurve wie ein Profi."), exercise: apPointExercise("C", null) },
    {
      type: "explain",
      title: tx("All or none", "Alles oder nichts"),
      blob: tx("Bigger stimulus, bigger spike? Nope!", "Größerer Reiz, größerer Ausschlag? Nö!"),
      frames: [
        { math: cat(q(tx("below threshold", "unterschwellig")), "\\Rightarrow", q(tx("no AP", "kein AP"))), note: tx("A stimulus below the **threshold** (about −50 mV) doesn't trigger an action potential: the depolarisation fades away.", "Ein Reiz unter dem **Schwellenwert** (etwa −50 mV) löst kein Aktionspotenzial aus: Die Depolarisation klingt ab.") },
        { math: cat(q(tx("above threshold", "überschwellig")), "\\Rightarrow", q(tx("full AP, +30 mV", "volles AP, +30 mV"))), note: tx("Above the threshold there is always a complete action potential of the same height: the **all-or-none law**. A bigger stimulus does **not** make a bigger action potential.", "Über dem Schwellenwert entsteht immer ein vollständiges Aktionspotenzial gleicher Höhe: das **Alles-oder-Nichts-Gesetz**. Ein größerer Reiz macht das Aktionspotenzial **nicht** größer.") },
        { math: cat(q(tx("stronger stimulus", "stärkerer Reiz")), "\\Rightarrow", "\\hl{", q(tx("higher AP frequency", "höhere AP-Frequenz")), "}"), note: tx("The stimulus strength is coded in the **frequency** of the action potentials (**frequency coding**). At the synapse it becomes the amount of transmitter again.", "Die Reizstärke wird über die **Frequenz** der Aktionspotenziale verschlüsselt (**Frequenzcodierung**). An der Synapse wird daraus wieder die Menge an Transmitter.") },
        { math: cat(q(tx("absolute refractory period:", "absolute Refraktärzeit:")), q(tx("no AP possible", "kein AP möglich"))), note: tx("During the **absolute refractory period** (about 1 to 2 ms) the Na⁺ channels are inactivated: no new action potential. During the **relative refractory period** only a stronger stimulus works.", "In der **absoluten Refraktärzeit** (etwa 1 bis 2 ms) sind die Na⁺-Kanäle inaktiviert: kein neues Aktionspotenzial. In der **relativen Refraktärzeit** klappt es nur mit stärkerem Reiz.") },
        { math: tx('f_{"max"} = \\frac{1}{0.001 "s"} = 1000 "Hz"', 'f_{"max"} = \\frac{1}{0,001 \\, "s"} = 1000 \\, "Hz"'), note: tx("The refractory period limits the frequency: with 1 ms, at most 1000 action potentials per second. And it makes sure the impulse only runs **one way**.", "Die Refraktärzeit begrenzt die Frequenz: bei 1 ms höchstens 1000 Aktionspotenziale pro Sekunde. Und sie sorgt dafür, dass die Erregung nur **in eine Richtung** läuft.") },
      ],
    },
    {
      type: "widget",
      title: tx("Continuous or saltatory?", "Kontinuierlich oder saltatorisch?"),
      blob: tx("On your marks, get set, action potential!", "Auf die Plätze, fertig, Aktionspotenzial!"),
      body: tx(
        "In unmyelinated axons the action potential has to form anew at every spot of the membrane: **continuous conduction**. Local currents depolarise the next stretch above threshold. In myelinated axons the myelin sheath insulates, and the action potential only forms at the **nodes of Ranvier**, jumping from node to node: **saltatory conduction**. Let the two fibres race!",
        "Bei marklosen Axonen muss das Aktionspotenzial an jeder Stelle der Membran neu entstehen: **kontinuierliche Erregungsleitung**. Ausgleichsströme depolarisieren das nächste Stück überschwellig. Bei markhaltigen Axonen isoliert die Myelinscheide, das Aktionspotenzial entsteht nur an den **Ranvierschen Schnürringen** und springt von Schnürring zu Schnürring: **saltatorische Erregungsleitung**. Lass die beiden Fasern gegeneinander antreten!",
      ),
      widget: NerveRace,
    },
    { type: "check", blob: tx("A quick calculation from toe to spine.", "Eine kurze Rechnung vom Zeh bis zum Rückenmark."), exercise: timeExercise(1.2, tx("from the foot to the spinal cord", "vom Fuß zum Rückenmark"), 100, tx("a myelinated fibre", "einer markhaltigen Faser")) },
    {
      type: "explain",
      title: tx("The synapse in detail", "Die Synapse im Detail"),
      blob: tx("Zoom in on the gap between two cells.", "Zoom auf den Spalt zwischen zwei Zellen."),
      frames: [
        { math: cat(q(tx("AP", "AP")), "\\to", "\\ce{Ca^2+}", q(tx("in", "rein")), "\\to", "\\hl{", q(tx("exocytosis", "Exocytose")), "}"), note: tx("An action potential at the end bulb opens voltage-gated **Ca²⁺ channels**. Ca²⁺ flows in and triggers the **exocytosis** of the vesicles: acetylcholine (ACh) gets into the cleft.", "Ein Aktionspotenzial am Endknöpfchen öffnet spannungsgesteuerte **Ca²⁺-Kanäle**. Ca²⁺ strömt ein und löst die **Exocytose** der Vesikel aus: Acetylcholin (ACh) gelangt in den Spalt.") },
        { math: flow([tx("ACh + receptor", "ACh + Rezeptor"), tx("Na⁺ in", "Na⁺ rein"), tx("EPSP", "EPSP")], { hl: [2] }), note: tx("ACh binds to **ligand-gated** Na⁺ channels in the postsynaptic membrane. Na⁺ flows in: an **excitatory postsynaptic potential (EPSP)**.", "ACh bindet an **ligandengesteuerte** Na⁺-Kanäle der postsynaptischen Membran. Na⁺ strömt ein: ein **erregendes postsynaptisches Potenzial (EPSP)**.") },
        { math: cat(q(tx("IPSP:", "IPSP:")), "\\ce{Cl-}", q(tx("in or", "rein oder")), "\\ce{K+}", q(tx("out", "raus"))), note: tx("Other transmitters (e.g. GABA) open Cl⁻ or K⁺ channels: the membrane is hyperpolarised, an **inhibitory PSP (IPSP)**.", "Andere Transmitter (z. B. GABA) öffnen Cl⁻- oder K⁺-Kanäle: Die Membran wird hyperpolarisiert, ein **hemmendes PSP (IPSP)**.") },
        { math: cat(q(tx("ACh", "ACh")), "\\to", q(tx("acetate", "Acetat")), "+", q(tx("choline", "Cholin"))), note: tx("**Acetylcholinesterase** splits ACh at once. Choline is taken back into the end bulb and made into ACh again. That keeps the signal short.", "Die **Acetylcholinesterase** spaltet ACh sofort. Cholin wird ins Endknöpfchen zurückgeholt und wieder zu ACh aufgebaut. So bleibt das Signal kurz.") },
        { math: cat(q(tx("temporal summation:", "zeitliche Summation:")), q(tx("one synapse, quickly in a row", "eine Synapse, schnell nacheinander"))), note: tx("A single EPSP usually doesn't reach the threshold at the axon hillock. **Temporal summation:** several EPSPs of the same synapse in quick succession add up.", "Ein einzelnes EPSP erreicht am Axonhügel meist nicht den Schwellenwert. **Zeitliche Summation:** Mehrere EPSPs derselben Synapse kurz nacheinander addieren sich.") },
        { math: cat(q(tx("spatial summation:", "räumliche Summation:")), q(tx("several synapses at once", "mehrere Synapsen gleichzeitig"))), note: tx("**Spatial summation:** EPSPs of several synapses at the same time add up; IPSPs are subtracted. Only if the threshold is reached at the axon hillock does an action potential start.", "**Räumliche Summation:** EPSPs mehrerer Synapsen zur gleichen Zeit addieren sich, IPSPs werden abgezogen. Erst wenn am Axonhügel der Schwellenwert erreicht ist, entsteht ein Aktionspotenzial.") },
      ],
    },
    {
      type: "widget",
      title: tx("Synaptic poisons", "Synapsengifte"),
      blob: tx("Careful, toxic! But only on screen.", "Vorsicht, giftig! Aber nur auf dem Bildschirm."),
      body: tx("Step through the transmission. Then pick a poison and find out **where** it acts and what happens to the next cell.", "Geh die Übertragung Schritt für Schritt durch. Wähle dann ein Gift und finde heraus, **wo** es angreift und was mit der nachfolgenden Zelle passiert."),
      widget: NerveSynapseLab,
    },
    { type: "check", blob: tx("Last one: a poison at the end plate.", "Die letzte: ein Gift an der Endplatte."), exercise: poisonCheck },
  ],
  summary: [
    {
      title: tx("Resting potential (−70 mV)", "Ruhepotenzial (−70 mV)"),
      body: tx(
        "Inside K⁺ and A⁻, outside Na⁺ and Cl⁻. K⁺ leaks out through leak channels until the concentration and electrical gradients balance. Na⁺/K⁺ pump: 3 Na⁺ out, 2 K⁺ in per ATP.",
        "Innen K⁺ und A⁻, außen Na⁺ und Cl⁻. K⁺ strömt durch Leckkanäle aus, bis Konzentrations- und Ladungsgefälle im Gleichgewicht sind. Na⁺/K⁺-Pumpe: pro ATP 3 Na⁺ raus, 2 K⁺ rein.",
      ),
      examples: [tx('3 \\ce{Na+} "out" , \\; 2 \\ce{K+} "in" , \\; 1 "ATP"', '3 \\ce{Na+} "raus" , \\; 2 \\ce{K+} "rein" , \\; 1 "ATP"')],
      tone: "rule",
    },
    {
      title: tx("Action potential", "Aktionspotenzial"),
      body: tx(
        "Threshold (−50 mV) → depolarisation: Na⁺ channels open, Na⁺ flows in (to +30 mV) → repolarisation: Na⁺ channels inactivated, K⁺ flows out → hyperpolarisation → rest.",
        "Schwellenwert (−50 mV) → Depolarisation: Na⁺-Kanäle öffnen, Na⁺ strömt ein (bis +30 mV) → Repolarisation: Na⁺-Kanäle inaktiviert, K⁺ strömt aus → Hyperpolarisation → Ruhe.",
      ),
      examples: [cat(q(tx("depolarisation:", "Depolarisation:")), "\\ce{Na+}", q(tx("in", "rein"))), cat(q(tx("repolarisation:", "Repolarisation:")), "\\ce{K+}", q(tx("out", "raus")))],
      tone: "rule",
    },
    {
      title: tx("All or none", "Alles oder nichts"),
      body: tx(
        "Every action potential is the same height. Stimulus strength → frequency (frequency coding). Refractory period: one-way conduction, maximum frequency.",
        "Jedes Aktionspotenzial ist gleich hoch. Reizstärke → Frequenz (Frequenzcodierung). Refraktärzeit: Leitung in eine Richtung, Höchstfrequenz.",
      ),
      examples: [tx('f_{"max"} = \\frac{1}{t_{"refractory"}}', 'f_{"max"} = \\frac{1}{t_{"refraktär"}}')],
      tone: "rule",
    },
    {
      title: tx("Conduction", "Erregungsleitung"),
      body: tx(
        "Continuous (unmyelinated, about 1 m/s) vs saltatory (myelinated, up to about 120 m/s): the action potential only forms at the nodes of Ranvier. Faster and saves energy.",
        "Kontinuierlich (marklos, etwa 1 m/s) vs saltatorisch (markhaltig, bis etwa 120 m/s): Das Aktionspotenzial entsteht nur an den Ranvierschen Schnürringen. Schneller und energiesparend.",
      ),
      examples: ["t = \\frac{s}{v}", tx('\\frac{1 "m"}{100 "m/s"} = 0.01 "s" = 10 "ms"', '\\frac{1 "m"}{100 "m/s"} = 0,01 "s" = 10 "ms"')],
      tone: "rule",
    },
    {
      title: tx("Synapse and poisons", "Synapse und Gifte"),
      body: tx(
        "Ca²⁺ in → exocytosis of ACh → binding to receptors → Na⁺ in (EPSP) → AChE splits ACh. Curare: blocks receptors. Atropine: blocks (muscarinic) receptors. E 605: inhibits AChE. Botulinum toxin: stops the release.",
        "Ca²⁺ rein → Exocytose von ACh → Bindung an Rezeptoren → Na⁺ rein (EPSP) → AChE spaltet ACh. Curare: blockiert Rezeptoren. Atropin: blockiert (muskarinische) Rezeptoren. E 605: hemmt AChE. Botulinumtoxin: verhindert die Ausschüttung.",
      ),
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The depolarisation comes from Na⁺ flowing **in**, not from K⁺ flowing in: K⁺ only flows out. A stronger stimulus does not make a bigger action potential, only more of them.",
        "Die Depolarisation entsteht durch Na⁺-**Einstrom**, nicht durch K⁺-Einstrom: K⁺ strömt nur aus. Ein stärkerer Reiz macht kein größeres Aktionspotenzial, nur mehr davon.",
      ),
      tone: "warning",
    },
  ],
};

