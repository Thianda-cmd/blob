"use client";

// Level 1 (Einsteiger, Klasse 5–6): the heart as a pump, the pulse, arteries, veins and
// capillaries, what blood carries, the airways and inhaled versus exhaled air.

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { HeartAirways } from "@/learn/biology/visuals/HeartAirways";
import { HeartAirBars, HeartBreathWidget, type Gas } from "@/learn/biology/visuals/HeartBreath";
import { HeartTransportWidget } from "@/learn/biology/visuals/HeartCirculation";
import { HeartPulseWidget } from "@/learn/biology/visuals/HeartPulse";
import { answerFrames, choice, de, en, mistakes, multi, multiFrames, num, orderFrames, q, visual, type Opt } from "./data";

// ---------------------------------------------------------------------------
// Blood vessels: which way?

type Vessel = "artery" | "vein" | "capillary";
const VESSEL_NAME: Record<Vessel, Text> = {
  artery: tx("Arteries", "Arterien"),
  vein: tx("Veins", "Venen"),
  capillary: tx("Capillaries", "Kapillaren"),
};
const VESSEL_WHY: Record<Vessel, Text> = {
  artery: tx("Arteries carry blood **away from the heart** (A for away). Their wall is thick and strong; you feel the pulse in them.", "Arterien führen das Blut **vom Herzen weg** (A wie Ausgang). Ihre Wand ist dick und kräftig, in ihnen spürst du den Puls."),
  vein: tx("Veins carry blood **back to the heart**.", "Venen führen das Blut **zum Herzen hin**."),
  capillary: tx("Capillaries are thinner than a hair. Through their thin wall substances pass between blood and cells.", "Kapillaren sind dünner als ein Haar. Durch ihre dünne Wand tauschen Blut und Zellen Stoffe aus."),
};
const VESSEL_QUESTIONS: { q: Text; right: Vessel }[] = [
  { q: tx("Which blood vessels carry blood **away from** the heart?", "Welche Blutgefäße führen das Blut **vom Herzen weg**?"), right: "artery" },
  { q: tx("Which blood vessels carry blood **back to** the heart?", "Welche Blutgefäße führen das Blut **zum Herzen hin**?"), right: "vein" },
  { q: tx("In which blood vessels do blood and cells exchange substances?", "In welchen Blutgefäßen tauschen Blut und Zellen Stoffe aus?"), right: "capillary" },
  { q: tx("Which blood vessels are thinner than a hair?", "Welche Blutgefäße sind dünner als ein Haar?"), right: "capillary" },
  { q: tx("In which blood vessels can you feel the pulse?", "In welchen Blutgefäßen kannst du den Puls fühlen?"), right: "artery" },
  { q: tx("Which blood vessels have the thickest, strongest wall?", "Welche Blutgefäße haben die dickste, kräftigste Wand?"), right: "artery" },
  { q: tx("Blood flows from the muscles back to the heart. Which vessels does it flow through?", "Blut fließt von den Muskeln zurück zum Herzen. Durch welche Gefäße fließt es?"), right: "vein" },
  { q: tx("The heart pumps blood into the body. Which vessels does it flow into first?", "Das Herz pumpt Blut in den Körper. In welche Gefäße fließt es zuerst?"), right: "artery" },
  { q: tx("Where does oxygen pass from the blood into the cells?", "Wo gelangt Sauerstoff aus dem Blut zu den Zellen?"), right: "capillary" },
];
const VESSEL_TRAP: Record<string, { title: Text; say: Text }> = {
  "artery>vein": { title: tx("Mixed up the direction", "Richtung vertauscht"), say: tx("Careful with the direction: veins bring blood **to** the heart. A for away: **a**rteries lead away from it.", "Vorsicht mit der Richtung: Venen bringen Blut **zum** Herzen. A wie Ausgang: **A**rterien führen aus dem Herzen heraus.") },
  "vein>artery": { title: tx("Mixed up the direction", "Richtung vertauscht"), say: tx("Arteries lead **away** from the heart (A for away). Blood comes back through the veins.", "Arterien führen **vom** Herzen weg (A wie Ausgang). Zurück kommt das Blut durch die Venen.") },
  "capillary>artery": { title: tx("Too thick for exchange", "Zu dick für den Austausch"), say: tx("Arteries have a thick wall: nothing gets through. The exchange happens in the hair-thin capillaries.", "Arterien haben eine dicke Wand, da kommt nichts durch. Der Austausch passiert in den hauchdünnen Kapillaren.") },
  "capillary>vein": { title: tx("Not yet", "Noch nicht"), say: tx("Veins collect the blood **after** the exchange. The exchange itself happens in the capillaries in between.", "Venen sammeln das Blut **nach** dem Austausch. Der Austausch selbst passiert in den Kapillaren dazwischen.") },
  "artery>capillary": { title: tx("Capillaries are in between", "Kapillaren liegen dazwischen"), say: tx("Capillaries connect arteries and veins and exchange substances. Which vessels start at the heart?", "Kapillaren verbinden Arterien und Venen und tauschen Stoffe aus. Welche Gefäße beginnen am Herzen?") },
  "vein>capillary": { title: tx("Capillaries are in between", "Kapillaren liegen dazwischen"), say: tx("Capillaries lie between arteries and veins. Which vessels lead into the heart?", "Kapillaren liegen zwischen Arterien und Venen. Welche Gefäße münden ins Herz?") },
};

function vesselTask(rng: Rng, fixed?: number): Exercise {
  const Q = fixed !== undefined ? VESSEL_QUESTIONS[fixed] : rng.pick(VESSEL_QUESTIONS);
  const others = (["artery", "vein", "capillary"] as Vessel[]).filter((v) => v !== Q.right);
  const opts: Opt[] = [{ text: VESSEL_NAME[Q.right] }, ...others.map((v) => ({ text: VESSEL_NAME[v], ...VESSEL_TRAP[`${Q.right}>${v}`] }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Blood vessels", "Blutgefäße"),
    text: Q.q,
    answer,
    hint: tx("Arteries: away from the heart. Veins: to the heart. Capillaries: hair-thin, in between.", "Arterien: vom Herzen weg. Venen: zum Herzen hin. Kapillaren: haarfein, dazwischen."),
    solution: [
      { math: tx('"heart"#h \\to "arteries"#a \\to "capillaries"#k \\to "veins"#v \\to "heart"#h2', '"Herz"#h \\to "Arterien"#a \\to "Kapillaren"#k \\to "Venen"#v \\to "Herz"#h2'), note: tx("The blood always goes round this way.", "Das Blut fließt immer in diesem Kreis.") },
      { math: q(VESSEL_NAME[Q.right], "r"), note: VESSEL_WHY[Q.right], highlight: ["r"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Pulse

const PEOPLE = ["Mia", "Ben", "Lena", "Jonas", "Emma", "Paul", "Lea", "Finn", "Hanna", "Noah", "Sophie", "Elias"];
type Situation = { en: string; de: string; min: number; max: number };
const SITUATIONS: Situation[] = [
  { en: "at rest", de: "in Ruhe", min: 64, max: 88 },
  { en: "while reading", de: "beim Lesen", min: 64, max: 84 },
  { en: "right after a sprint", de: "direkt nach einem Sprint", min: 140, max: 176 },
  { en: "after climbing stairs", de: "nach dem Treppensteigen", min: 104, max: 132 },
  { en: "after 20 squats", de: "nach 20 Kniebeugen", min: 112, max: 140 },
];

export function pulseTask(rng: Rng, fixed?: { name: string; s: Situation; secs: number; count: number }): Exercise {
  const name = fixed?.name ?? rng.pick(PEOPLE);
  const s = fixed?.s ?? rng.pick(SITUATIONS);
  const secs = fixed?.secs ?? rng.pick([15, 15, 15, 10, 20, 30, 60]);
  const factor = 60 / secs;
  const count = fixed?.count ?? Math.round(rng.int(s.min, s.max) / factor);
  const rate = count * factor;
  const answer: AnswerSpec = { kind: "number", value: rate, unit: tx("beats/min", "Schläge/min") };
  const m = mistakes(answer);
  m.add({ kind: "number", value: count }, tx("Only counted", "Nur gezählt"), tx(`That's how often it beat in ${secs} seconds. A minute is longer: how many times does ${secs} s fit into a minute?`, `So oft hat es in ${secs} Sekunden geschlagen. Eine Minute ist länger: Wie oft passen ${secs} s in eine Minute?`));
  if (secs !== 15) m.add({ kind: "number", value: count * 4 }, tx("Not 15 seconds", "Nicht 15 Sekunden"), tx(`Times 4 only works for 15 seconds. Here ${name} counted for ${secs} seconds.`, `Mal 4 passt nur bei 15 Sekunden. Hier hat ${name} ${secs} Sekunden lang gezählt.`));
  m.add({ kind: "number", value: count * secs }, tx("Multiplied by the seconds", "Mit den Sekunden malgenommen"), tx(`You multiplied by ${secs}. But you need: how many ${secs}-second pieces fit into 60 seconds?`, `Du hast mit ${secs} malgenommen. Gesucht ist aber: Wie viele ${secs}-Sekunden-Stücke passen in 60 Sekunden?`));
  m.add({ kind: "number", value: count / factor, tolerance: 0.01 }, tx("Divided instead", "Geteilt statt mal"), tx("Per minute it must be **more** beats than in a few seconds, not fewer!", "Pro Minute müssen es **mehr** Schläge sein als in wenigen Sekunden, nicht weniger!"));
  return {
    instruction: tx("Work out the pulse", "Berechne den Puls"),
    text: tx(
      `${name} feels the pulse ${s.en} and counts **${count} beats in ${secs} seconds**. What is the pulse rate per minute?`,
      `${name} fühlt den Puls ${s.de} und zählt **${count} Schläge in ${secs} Sekunden**. Wie hoch ist der Puls pro Minute?`,
    ),
    answer,
    hint: secs === 60 ? tx("A minute has 60 seconds.", "Eine Minute hat 60 Sekunden.") : tx(`A minute has 60 seconds. How many times does ${secs} s fit into it?`, `Eine Minute hat 60 Sekunden. Wie oft passen ${secs} s hinein?`),
    solution: [
      { math: tx(`60 "s" : ${secs} "s" = ${factor}#f`, `60 "s" : ${secs} "s" = ${factor}#f`), note: tx(`A minute is ${factor} times as long as ${secs} seconds.`, `Eine Minute ist ${factor}-mal so lang wie ${secs} Sekunden.`) },
      { math: tx(`${count} \\cdot ${factor}#f = ${rate}#r "beats per minute"`, `${count} \\cdot ${factor}#f = ${rate}#r "Schläge pro Minute"`), note: tx(`So ${name}'s pulse is **${rate} beats per minute**.`, `${name} hat also einen Puls von **${rate} Schlägen pro Minute**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Heart rate at rest and during sport

const ACTIVITIES: { name: Text; rate: number }[] = [
  { name: tx("Sleeping", "Schlafen"), rate: 55 },
  { name: tx("Sitting", "Sitzen"), rate: 75 },
  { name: tx("Walking", "Gehen"), rate: 95 },
  { name: tx("Climbing stairs", "Treppensteigen"), rate: 120 },
  { name: tx("Sprinting", "Rennen"), rate: 165 },
];

function activityOrderTask(rng: Rng): Exercise {
  const drop = rng.int(0, 4);
  const items = ACTIVITIES.filter((_, i) => i !== drop || rng.chance(0.3)).map((a) => a.name);
  const has = (t: Text) => items.some((x) => en(x) === en(t));
  const answer: AnswerSpec = { kind: "order", items, label: tx("from the slowest to the fastest heartbeat", "vom langsamsten zum schnellsten Herzschlag") };
  const list: Mistake[] = [];
  if (has(ACTIVITIES[0].name) && has(ACTIVITIES[1].name))
    list.push({ when: { kind: "order", items: [ACTIVITIES[1].name, ACTIVITIES[0].name] }, title: tx("Asleep is slowest", "Im Schlaf am langsamsten"), say: tx("When you sleep, your body needs the least oxygen: the heart beats slowest then, even slower than sitting.", "Im Schlaf braucht dein Körper am wenigsten Sauerstoff: Dann schlägt das Herz am langsamsten, sogar langsamer als im Sitzen.") });
  if (has(ACTIVITIES[3].name) && has(ACTIVITIES[4].name))
    list.push({ when: { kind: "order", items: [ACTIVITIES[4].name, ACTIVITIES[3].name] }, title: tx("Sprinting is hardest", "Rennen ist am anstrengendsten"), say: tx("The harder the muscles work, the more oxygen they need. Sprinting is the hardest work here.", "Je stärker die Muskeln arbeiten, desto mehr Sauerstoff brauchen sie. Rennen ist hier die härteste Arbeit.") });
  return {
    instruction: tx("Order by heart rate", "Ordne nach der Herzfrequenz"),
    text: tx("Put the activities in order: from the **slowest** to the **fastest** heartbeat.", "Bring die Tätigkeiten in die richtige Reihenfolge: vom **langsamsten** zum **schnellsten** Herzschlag."),
    answer,
    hint: tx("The harder your muscles work, the more oxygen they need, and the faster the heart beats.", "Je mehr deine Muskeln arbeiten, desto mehr Sauerstoff brauchen sie und desto schneller schlägt das Herz."),
    solution: orderFrames(
      items,
      items.map((it) => {
        const a = ACTIVITIES.find((x) => en(x.name) === en(it))!;
        return tx(`${en(a.name)}: about ${a.rate} beats per minute.`, `${de(a.name)}: etwa ${a.rate} Schläge pro Minute.`);
      }),
    ),
    mistakes: list,
  };
}

const SPORT_WHY: Opt[] = [
  { text: tx("The muscles need more oxygen and nutrients.", "Die Muskeln brauchen mehr Sauerstoff und Nährstoffe.") },
  { text: tx("The heart gets smaller during sport and has to beat more often.", "Das Herz wird beim Sport kleiner und muss öfter schlagen."), title: tx("The heart stays the same", "Das Herz bleibt gleich"), say: tx("The heart doesn't shrink. It beats faster because the working muscles need more supplies.", "Das Herz schrumpft nicht. Es schlägt schneller, weil die arbeitenden Muskeln mehr Nachschub brauchen.") },
  { text: tx("The body needs less blood during sport.", "Der Körper braucht beim Sport weniger Blut."), title: tx("It's the other way round", "Genau umgekehrt"), say: tx("The other way round! Working muscles need **more** blood, because blood brings oxygen and nutrients.", "Genau umgekehrt! Arbeitende Muskeln brauchen **mehr** Blut, denn das Blut bringt Sauerstoff und Nährstoffe.") },
  { text: tx("The lungs stop working during sport.", "Die Lunge arbeitet beim Sport nicht mehr."), title: tx("The lungs work harder", "Die Lunge arbeitet mehr"), say: tx("The lungs work harder too: you breathe faster to take up more oxygen.", "Die Lunge arbeitet sogar mehr: Du atmest schneller, um mehr Sauerstoff aufzunehmen.") },
];

function sportTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const { answer, mistakes: list } = choice(rng, SPORT_WHY);
    return {
      instruction: tx("Pulse and sport", "Puls und Sport"),
      text: tx("Why does your heart beat faster when you do sport?", "Warum schlägt dein Herz beim Sport schneller?"),
      answer,
      hint: tx("What do working muscles need, and who brings it to them?", "Was brauchen arbeitende Muskeln, und wer bringt es zu ihnen?"),
      solution: answerFrames(tx("more oxygen and nutrients", "mehr Sauerstoff und Nährstoffe"), tx("Working muscles use a lot of oxygen and nutrients. The blood brings them, so the heart pumps faster.", "Arbeitende Muskeln verbrauchen viel Sauerstoff und Nährstoffe. Das Blut bringt sie heran, deshalb pumpt das Herz schneller.")),
      mistakes: list,
    };
  }
  const name = rng.pick(PEOPLE);
  const rest = rng.int(66, 84);
  const after = rng.int(140, 172);
  const later = rng.int(rest + 8, rest + 26);
  const vals = [rest, after, later];
  const askAfter = rng.chance(0.5);
  const target = askAfter ? after : rest;
  const opts: Opt[] = [
    { text: `${target}` },
    ...vals
      .filter((v) => v !== target)
      .map((v) => ({
        text: `${v}`,
        title: v === later ? tx("Already resting", "Schon in der Pause") : askAfter ? tx("That's at rest", "Das ist in Ruhe") : tx("That's after sport", "Das ist nach dem Sport"),
        say:
          v === later
            ? tx("After a few minutes' rest the pulse falls again, but it isn't back at the resting value yet.", "Nach ein paar Minuten Pause sinkt der Puls wieder, ist aber noch nicht ganz beim Ruhewert.")
            : askAfter
              ? tx("Right after running the heart beats fastest. Which is the highest value?", "Direkt nach dem Rennen schlägt das Herz am schnellsten. Welcher Wert ist der höchste?")
              : tx("At rest the heart beats slowest. Which is the lowest value?", "In Ruhe schlägt das Herz am langsamsten. Welcher Wert ist der niedrigste?"),
      })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Pulse and sport", "Puls und Sport"),
    text: tx(
      `${name} measured the pulse three times: before running, right after running and after 5 minutes' rest. The values are ${rng.shuffle(vals).join(", ")} beats per minute. Which value was measured **${askAfter ? "right after running" : "before running, at rest"}**?`,
      `${name} hat dreimal den Puls gemessen: vor dem Rennen, direkt nach dem Rennen und nach 5 Minuten Pause. Die Werte sind ${rng.shuffle(vals).join(", ")} Schläge pro Minute. Welcher Wert wurde **${askAfter ? "direkt nach dem Rennen" : "vor dem Rennen, in Ruhe"}** gemessen?`,
    ),
    answer,
    hint: tx("Working muscles need more oxygen: the heart beats faster. In a rest it slowly calms down again.", "Arbeitende Muskeln brauchen mehr Sauerstoff: Das Herz schlägt schneller. In der Pause beruhigt es sich langsam wieder."),
    solution: [
      { math: tx(`"rest"#a \\; ${rest} \\quad "after running"#b \\; ${after} \\quad "rest break"#c \\; ${later}`, `"Ruhe"#a \\; ${rest} \\quad "nach dem Rennen"#b \\; ${after} \\quad "Pause"#c \\; ${later}`), note: tx("Lowest at rest, highest right after running, in between after the break.", "Am niedrigsten in Ruhe, am höchsten direkt nach dem Rennen, dazwischen nach der Pause."), highlight: [askAfter ? "b" : "a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// What blood carries

type Cargo = "o2" | "food" | "co2" | "heat";
const CARGO: Record<Cargo, Text> = {
  o2: tx("Oxygen", "Sauerstoff"),
  food: tx("Nutrients", "Nährstoffe"),
  co2: tx("Carbon dioxide", "Kohlenstoffdioxid"),
  heat: tx("Heat", "Wärme"),
};
const ROUTES: { from: Text; to: Text; cargo: Cargo; why: Text }[] = [
  { from: tx("from the lungs", "von der Lunge"), to: tx("to the muscles", "zu den Muskeln"), cargo: "o2", why: tx("In the lungs the blood takes up oxygen and brings it to every cell, for example in the muscles.", "In der Lunge nimmt das Blut Sauerstoff auf und bringt ihn zu allen Zellen, zum Beispiel in die Muskeln.") },
  { from: tx("from the lungs", "von der Lunge"), to: tx("to the brain", "zum Gehirn"), cargo: "o2", why: tx("Oxygen comes in through the lungs. The brain needs a lot of it.", "Sauerstoff kommt über die Lunge herein. Das Gehirn braucht besonders viel davon.") },
  { from: tx("from the intestine", "vom Darm"), to: tx("to the muscles", "zu den Muskeln"), cargo: "food", why: tx("In the intestine digested nutrients such as glucose pass into the blood.", "Im Darm gehen verdaute Nährstoffe wie Traubenzucker ins Blut über.") },
  { from: tx("from the intestine", "vom Darm"), to: tx("to all body cells", "zu allen Körperzellen"), cargo: "food", why: tx("Nutrients from the intestine give the cells energy and building materials.", "Nährstoffe aus dem Darm liefern den Zellen Energie und Baustoffe.") },
  { from: tx("from the muscles", "von den Muskeln"), to: tx("to the lungs", "zur Lunge"), cargo: "co2", why: tx("Cells produce carbon dioxide. The blood takes it to the lungs, where you breathe it out.", "Zellen bilden Kohlenstoffdioxid. Das Blut bringt es zur Lunge, dort atmest du es aus.") },
  { from: tx("from the brain", "vom Gehirn"), to: tx("to the lungs", "zur Lunge"), cargo: "co2", why: tx("Every working cell produces carbon dioxide, also in the brain. It's breathed out through the lungs.", "Jede arbeitende Zelle bildet Kohlenstoffdioxid, auch im Gehirn. Es wird über die Lunge ausgeatmet.") },
  { from: tx("from the working muscles", "von den arbeitenden Muskeln"), to: tx("to the skin", "zur Haut"), cargo: "heat", why: tx("Working muscles get warm. The blood spreads the heat; through the skin it is given off.", "Arbeitende Muskeln werden warm. Das Blut verteilt die Wärme, über die Haut wird sie abgegeben.") },
];
const CARGO_TRAP: Record<string, Text> = {
  "o2>co2": tx("Carbon dioxide goes the other way: from the cells **to** the lungs.", "Kohlenstoffdioxid geht den umgekehrten Weg: von den Zellen **zur** Lunge."),
  "co2>o2": tx("Oxygen comes **from** the lungs. Towards the lungs the blood carries what the cells give off.", "Sauerstoff kommt **aus** der Lunge. Zur Lunge hin bringt das Blut, was die Zellen abgeben."),
  "food>o2": tx("Oxygen comes from the lungs, not from the intestine. What does the intestine take up?", "Sauerstoff kommt aus der Lunge, nicht aus dem Darm. Was nimmt der Darm auf?"),
  "o2>food": tx("Nutrients come from the intestine. What does the blood pick up in the lungs?", "Nährstoffe kommen aus dem Darm. Was holt sich das Blut in der Lunge?"),
};

function transportTask(rng: Rng): Exercise {
  const r = rng.pick(ROUTES);
  const others = (Object.keys(CARGO) as Cargo[]).filter((c) => c !== r.cargo);
  const opts: Opt[] = [
    { text: CARGO[r.cargo] },
    ...others.map((c) => ({
      text: CARGO[c],
      title: tx("Another job of the blood", "Eine andere Aufgabe des Blutes"),
      say: CARGO_TRAP[`${r.cargo}>${c}`] ?? tx(`The blood does carry ${en(CARGO[c]).toLowerCase()}, but not ${en(r.from)} ${en(r.to)}.`, `Das Blut transportiert zwar auch ${de(CARGO[c])}, aber nicht ${de(r.from)} ${de(r.to)}.`),
    })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("What does blood carry?", "Was transportiert das Blut?"),
    text: tx(`What does the blood carry **${en(r.from)} ${en(r.to)}**?`, `Was transportiert das Blut **${de(r.from)} ${de(r.to)}**?`),
    answer,
    hint: tx("Lungs: oxygen in, carbon dioxide out. Intestine: nutrients. Working muscles: heat.", "Lunge: Sauerstoff rein, Kohlenstoffdioxid raus. Darm: Nährstoffe. Arbeitende Muskeln: Wärme."),
    solution: answerFrames(CARGO[r.cargo], r.why),
    mistakes: list,
  };
}

const CARRIED: Text[] = [CARGO.o2, CARGO.food, CARGO.co2, CARGO.heat, tx("Waste products (to the kidneys)", "Abfallstoffe (zu den Nieren)")];
const NOT_CARRIED: { text: Text; say: Text }[] = [
  { text: tx("Undigested food pulp", "Unverdauter Nahrungsbrei"), say: tx("The food pulp stays in the gut. Only the dissolved nutrients pass into the blood.", "Der Nahrungsbrei bleibt im Darm. Nur die gelösten Nährstoffe gehen ins Blut über.") },
  { text: tx("Air bubbles", "Luftbläschen"), say: tx("Air bubbles in the blood would be dangerous! Oxygen is carried bound to the red blood cells, not as bubbles.", "Luftbläschen im Blut wären gefährlich! Sauerstoff wird an die roten Blutkörperchen gebunden transportiert, nicht als Bläschen.") },
  { text: tx("Urine", "Urin"), say: tx("Urine is made in the kidneys and collects in the bladder. The blood brings only the waste products to the kidneys.", "Urin entsteht erst in den Nieren und sammelt sich in der Blase. Das Blut bringt nur die Abfallstoffe zu den Nieren.") },
];

function carriedMultiTask(rng: Rng): Exercise {
  const yes = rng.shuffle(CARRIED).slice(0, rng.int(3, 4));
  const no = rng.shuffle(NOT_CARRIED).slice(0, 2);
  const M = multi(rng, [...yes.map((t) => ({ text: t, ok: true })), ...no.map((n) => ({ text: n.text, ok: false }))]);
  const m = mistakes(M.answer);
  for (const n of no) m.add({ kind: "multi", options: M.options, correct: M.pick((x) => x.ok || en(x.text) === en(n.text)) }, tx("Not in the blood", "Nicht im Blut"), n.say);
  const co2 = yes.find((t) => en(t) === en(CARGO.co2));
  if (co2) m.add({ kind: "multi", options: M.options, correct: M.pick((x) => x.ok && en(x.text) !== en(CARGO.co2)) }, tx("Waste is carried too", "Auch Abfall wird transportiert"), tx("The blood also takes away what the cells give off, like carbon dioxide.", "Das Blut nimmt auch mit, was die Zellen abgeben, zum Beispiel Kohlenstoffdioxid."), true);
  const heat = yes.find((t) => en(t) === en(CARGO.heat));
  if (heat) m.add({ kind: "multi", options: M.options, correct: M.pick((x) => x.ok && en(x.text) !== en(CARGO.heat)) }, tx("Heat counts too", "Wärme zählt auch"), tx("The blood spreads heat through the body, like the water in a radiator.", "Das Blut verteilt die Wärme im Körper, wie das Wasser in einer Heizung."), true);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("What does the blood transport?", "Was transportiert das Blut?"),
    answer: M.answer,
    hint: tx("Think about what the cells need and what they get rid of.", "Überleg, was die Zellen brauchen und was sie loswerden."),
    solution: multiFrames(tx("the blood carries:", "das Blut transportiert:"), yes, tx("Blood is the body's delivery service: it brings supplies and takes away waste and heat.", "Das Blut ist der Lieferdienst des Körpers: Es bringt Nachschub und nimmt Abfall und Wärme mit.")),
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Airways

const AIRWAY: { id: string; name: Text; note: Text }[] = [
  { id: "nose", name: tx("Nose", "Nase"), note: tx("The air enters through the nose: it is warmed, moistened and cleaned.", "Die Luft strömt durch die Nase ein und wird angewärmt, angefeuchtet und gereinigt.") },
  { id: "pharynx", name: tx("Pharynx", "Rachen"), note: tx("In the pharynx the airway and the food pipe cross.", "Im Rachen kreuzen sich Luftweg und Speiseweg.") },
  { id: "larynx", name: tx("Larynx", "Kehlkopf"), note: tx("Through the larynx with the vocal cords.", "Durch den Kehlkopf mit den Stimmbändern.") },
  { id: "trachea", name: tx("Windpipe", "Luftröhre"), note: tx("Down the windpipe, held open by rings of cartilage.", "Durch die Luftröhre, die Knorpelspangen offen halten.") },
  { id: "bronchi", name: tx("Bronchi", "Bronchien"), note: tx("The windpipe splits into the two bronchi, which branch further and further.", "Die Luftröhre teilt sich in die zwei Bronchien, die sich immer weiter verzweigen.") },
  { id: "alveoli", name: tx("Alveoli", "Lungenbläschen"), note: tx("At the end: the alveoli. Here oxygen passes into the blood.", "Am Ende: die Lungenbläschen. Hier geht Sauerstoff ins Blut über.") },
];
const airwayName = (id: string) => AIRWAY.find((a) => a.id === id)!.name;

function airwayOrderTask(rng: Rng, fixed?: string[]): Exercise {
  const ids = fixed ?? (rng.chance(0.4) ? AIRWAY.map((a) => a.id) : AIRWAY.map((a) => a.id).filter((id) => id === "nose" || id === "alveoli" || rng.chance(0.65)));
  const keep = ids.length >= 4 ? ids : ["nose", "trachea", "bronchi", "alveoli"];
  const items = keep.map(airwayName);
  const list: Mistake[] = [];
  const has = (id: string) => keep.includes(id);
  if (has("trachea") && has("bronchi")) list.push({ when: { kind: "order", items: [airwayName("bronchi"), airwayName("trachea")] }, title: tx("The windpipe comes first", "Erst die Luftröhre"), say: tx("The bronchi only start where the windpipe splits in two. So first the windpipe, then the bronchi.", "Die Bronchien beginnen erst dort, wo sich die Luftröhre teilt. Also zuerst die Luftröhre, dann die Bronchien.") });
  if (has("bronchi") && has("alveoli")) list.push({ when: { kind: "order", items: [airwayName("alveoli"), airwayName("bronchi")] }, title: tx("Alveoli are at the very end", "Lungenbläschen ganz am Ende"), say: tx("The alveoli sit at the very end of the finest branches, like grapes on a stalk.", "Die Lungenbläschen sitzen ganz am Ende der feinsten Verzweigungen, wie Trauben am Stiel.") });
  if (has("pharynx") && has("larynx")) list.push({ when: { kind: "order", items: [airwayName("larynx"), airwayName("pharynx")] }, title: tx("Throat before larynx", "Rachen vor Kehlkopf"), say: tx("From the nose the air first reaches the pharynx at the back of the throat, then the larynx at the top of the windpipe.", "Aus der Nase kommt die Luft zuerst in den Rachen, dann in den Kehlkopf am oberen Ende der Luftröhre.") });
  return {
    instruction: tx("The path of the air", "Der Weg der Atemluft"),
    text: tx("You breathe in. Put the stations of the air in the right order.", "Du atmest ein. Bring die Stationen der Luft in die richtige Reihenfolge."),
    answer: { kind: "order", items, label: tx("from the nose into the lungs", "von der Nase bis in die Lunge") },
    hint: tx("Start where the air enters. Where does the windpipe split?", "Fang dort an, wo die Luft hineinkommt. Wo teilt sich die Luftröhre?"),
    solution: orderFrames(items, keep.map((id) => AIRWAY.find((a) => a.id === id)!.note)),
    mistakes: list,
  };
}

const AIRWAY_PICTURE: { id: string; name: Text; confuse: string[]; why: Text }[] = [
  { id: "nose", name: tx("Nasal cavity", "Nasenhöhle"), confuse: ["mouth", "pharynx", "larynx"], why: tx("The air enters here: it is warmed, moistened and cleaned.", "Hier strömt die Luft ein und wird angewärmt, angefeuchtet und gereinigt.") },
  { id: "pharynx", name: tx("Pharynx", "Rachen"), confuse: ["larynx", "trachea", "nose"], why: tx("Behind nose and mouth: here the airway and food pipe cross.", "Hinter Nase und Mund: Hier kreuzen sich Luftweg und Speiseweg.") },
  { id: "larynx", name: tx("Larynx", "Kehlkopf"), confuse: ["pharynx", "trachea", "bronchi"], why: tx("At the top of the windpipe, with the vocal cords and the epiglottis.", "Am oberen Ende der Luftröhre, mit Stimmbändern und Kehldeckel.") },
  { id: "trachea", name: tx("Windpipe (trachea)", "Luftröhre"), confuse: ["bronchi", "larynx", "pharynx"], why: tx("A tube with rings of cartilage, leading down into the chest.", "Ein Rohr mit Knorpelspangen, das in den Brustkorb führt.") },
  { id: "bronchi", name: tx("Bronchi", "Bronchien"), confuse: ["trachea", "alveoli", "lung"], why: tx("The windpipe splits into the bronchi, which branch like a tree.", "Die Luftröhre teilt sich in die Bronchien, die sich wie ein Baum verzweigen.") },
  { id: "lung", name: tx("Lung", "Lungenflügel"), confuse: ["alveoli", "bronchi", "diaphragm"], why: tx("The whole lung: a sponge of millions of alveoli.", "Der ganze Lungenflügel: ein Schwamm aus Millionen Lungenbläschen.") },
  { id: "alveoli", name: tx("Alveoli", "Lungenbläschen"), confuse: ["bronchi", "lung", "trachea"], why: tx("Tiny air sacs at the end of the airways, wrapped in capillaries.", "Winzige Bläschen am Ende der Atemwege, umgeben von Kapillaren.") },
  { id: "diaphragm", name: tx("Diaphragm", "Zwerchfell"), confuse: ["lung", "bronchi", "trachea"], why: tx("The muscle under the lungs that pulls air in.", "Der Muskel unter der Lunge, der beim Einatmen Luft hineinzieht.") },
];
const MOUTH = tx("Oral cavity", "Mundhöhle");
const pictureName = (id: string) => (id === "mouth" ? MOUTH : AIRWAY_PICTURE.find((p) => p.id === id)!.name);
const PICTURE_TRAP: Record<string, Text> = {
  "trachea>bronchi": tx("The bronchi start only where the tube splits. The marked part is the single tube above.", "Die Bronchien beginnen erst dort, wo sich das Rohr teilt. Markiert ist das einzelne Rohr darüber."),
  "bronchi>trachea": tx("The windpipe is the single tube above. The marked part is one of its branches.", "Die Luftröhre ist das einzelne Rohr oben. Markiert ist einer ihrer Äste."),
  "alveoli>bronchi": tx("Bronchi are the air tubes. The marked part shows the tiny sacs at their ends.", "Bronchien sind die Luftröhrchen. Markiert sind die winzigen Bläschen an ihren Enden."),
  "larynx>pharynx": tx("The pharynx is the space behind nose and mouth. The marked part sits on top of the windpipe.", "Der Rachen ist der Raum hinter Nase und Mund. Das Markierte sitzt oben auf der Luftröhre."),
  "pharynx>larynx": tx("The larynx sits on top of the windpipe. The marked space lies behind nose and mouth.", "Der Kehlkopf sitzt oben auf der Luftröhre. Der markierte Raum liegt hinter Nase und Mund."),
};

function airwayPictureTask(rng: Rng): Exercise {
  const P = rng.pick(AIRWAY_PICTURE);
  const opts: Opt[] = [
    { text: P.name },
    ...P.confuse.map((c) => ({ text: pictureName(c), title: tx("Look again", "Schau noch mal hin"), say: PICTURE_TRAP[`${P.id}>${c}`] ?? tx(`That's another part. Follow the way of the air from the nose: where is the marker?`, `Das ist ein anderer Teil. Folge dem Weg der Luft ab der Nase: Wo sitzt die Markierung?`) })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("What is the part marked with **?** called?", "Wie heißt der mit **?** markierte Teil?"),
    visual: visual(HeartAirways, { mode: "numbers", ask: P.id, legend: "none" }),
    answer,
    hint: tx("Follow the air: nose, pharynx, larynx, windpipe, bronchi, alveoli.", "Folge der Luft: Nase, Rachen, Kehlkopf, Luftröhre, Bronchien, Lungenbläschen."),
    solution: answerFrames(P.name, P.why),
    mistakes: list,
  };
}

const AIRWAY_JOBS: { name: Text; job: Text }[] = [
  { name: tx("Nose", "Nase"), job: tx("warms, moistens and cleans the air", "wärmt, befeuchtet und reinigt die Luft") },
  { name: tx("Windpipe", "Luftröhre"), job: tx("tube held open by rings of cartilage", "Rohr, das Knorpelspangen offen halten") },
  { name: tx("Bronchi", "Bronchien"), job: tx("branch out in the lungs like a tree", "verzweigen sich in der Lunge wie ein Baum") },
  { name: tx("Alveoli", "Lungenbläschen"), job: tx("oxygen passes into the blood here", "hier geht Sauerstoff ins Blut über") },
  { name: tx("Diaphragm", "Zwerchfell"), job: tx("muscle that enlarges the chest when you breathe in", "Muskel, der beim Einatmen den Brustraum vergrößert") },
  { name: tx("Larynx", "Kehlkopf"), job: tx("closes the windpipe when you swallow", "verschließt beim Schlucken die Luftröhre") },
];

const join2 = (a: Text, b: Text, i: number): Text => tx(`"${en(a)}"#a${i} \\to "${en(b)}"#b${i}`, `"${de(a)}"#a${i} \\to "${de(b)}"#b${i}`);

function airwayMatchTask(rng: Rng): Exercise {
  const pick = rng.shuffle(AIRWAY_JOBS).slice(0, rng.int(3, 4));
  const pairs = pick.map((p) => [p.name, p.job] as [Text, Text]);
  const list: Mistake[] = [];
  const find = (n: string) => pick.find((p) => en(p.name) === n);
  const alv = find("Alveoli");
  const br = find("Bronchi");
  if (alv && br) list.push({ when: { kind: "match", pairs: [[br.name, alv.job]] }, title: tx("Exchange at the very end", "Austausch ganz am Ende"), say: tx("The bronchi only conduct the air. Oxygen passes into the blood only in the alveoli at the very end.", "Die Bronchien leiten die Luft nur weiter. Ins Blut geht der Sauerstoff erst in den Lungenbläschen ganz am Ende.") });
  const nose = find("Nose");
  const tra = find("Windpipe");
  if (nose && tra) list.push({ when: { kind: "match", pairs: [[tra.name, nose.job]] }, title: tx("The nose prepares the air", "Die Nase bereitet die Luft vor"), say: tx("Warming, moistening and filtering happens mostly in the nose, right at the start.", "Anwärmen, Anfeuchten und Filtern passiert vor allem in der Nase, gleich am Anfang.") });
  return {
    instruction: tx("Match the parts", "Ordne zu"),
    text: tx("Match each part of the airways with its job.", "Ordne jedem Teil der Atemwege seine Aufgabe zu."),
    answer: { kind: "match", pairs },
    hint: tx("Follow the air from the nose into the alveoli. What happens where?", "Folge der Luft von der Nase bis in die Lungenbläschen. Was passiert wo?"),
    solution: pairs.map(([a, b], i) => ({ math: join2(a, b, i), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`), highlight: [`b${i}`] })),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Inhaled and exhaled air

const PCT = (v: number): Text => tx(`${en(num(v))} %`, `${de(num(v))} %`);
type AirQ = { text: Text; gas: Gas; inhaled: boolean; right: number; wrong: { v: number; title: Text; say: Text }[]; why: Text };
const AIR_QUESTIONS: AirQ[] = [
  {
    text: tx("How much **oxygen** does **inhaled** air contain?", "Wie viel **Sauerstoff** enthält die **Einatemluft**?"),
    gas: "o2",
    inhaled: true,
    right: 21,
    wrong: [
      { v: 78, title: tx("That's nitrogen", "Das ist Stickstoff"), say: tx("78 % is nitrogen, the largest part of the air. Oxygen is only about a fifth.", "78 % ist Stickstoff, der größte Teil der Luft. Sauerstoff ist nur etwa ein Fünftel.") },
      { v: 16, title: tx("That's exhaled air", "Das ist Ausatemluft"), say: tx("16 % is what's left after breathing. Fresh air contains more.", "16 % bleiben nach dem Atmen übrig. Frische Luft enthält mehr.") },
      { v: 100, title: tx("Air is a mixture", "Luft ist ein Gemisch"), say: tx("Air isn't pure oxygen: it's a mixture, mostly nitrogen.", "Luft ist kein reiner Sauerstoff, sondern ein Gemisch, vor allem aus Stickstoff.") },
    ],
    why: tx("Fresh air: about 78 % nitrogen, 21 % oxygen, 1 % noble gases and only 0.04 % carbon dioxide.", "Frische Luft: etwa 78 % Stickstoff, 21 % Sauerstoff, 1 % Edelgase und nur 0,04 % Kohlenstoffdioxid."),
  },
  {
    text: tx("How much **oxygen** does **exhaled** air still contain?", "Wie viel **Sauerstoff** enthält die **Ausatemluft** noch?"),
    gas: "o2",
    inhaled: false,
    right: 16,
    wrong: [
      { v: 0, title: tx("Not all of it is used", "Nicht alles wird verbraucht"), say: tx("The body only keeps a small part of the oxygen. Exhaled air still has plenty: that's why rescue breaths work.", "Der Körper behält nur einen kleinen Teil des Sauerstoffs. In der Ausatemluft ist noch viel: Deshalb funktioniert die Atemspende.") },
      { v: 21, title: tx("Some oxygen stays in the body", "Etwas Sauerstoff bleibt im Körper"), say: tx("In the alveoli some oxygen passes into the blood, so exhaled air contains less than fresh air.", "In den Lungenbläschen geht ein Teil des Sauerstoffs ins Blut, deshalb enthält die Ausatemluft weniger als frische Luft.") },
      { v: 4, title: tx("That's carbon dioxide", "Das ist Kohlenstoffdioxid"), say: tx("4 % is the carbon dioxide in exhaled air. Oxygen is still much more.", "4 % ist das Kohlenstoffdioxid in der Ausatemluft. Sauerstoff ist noch viel mehr.") },
    ],
    why: tx("The body keeps about 5 % of the air as oxygen: 21 % in, about 16 % out.", "Der Körper behält etwa 5 % der Luft als Sauerstoff: 21 % rein, etwa 16 % raus."),
  },
  {
    text: tx("How much **carbon dioxide** does **inhaled** air contain?", "Wie viel **Kohlenstoffdioxid** enthält die **Einatemluft**?"),
    gas: "co2",
    inhaled: true,
    right: 0.04,
    wrong: [
      { v: 4, title: tx("That's exhaled air", "Das ist Ausatemluft"), say: tx("4 % is in exhaled air. In fresh air there is only a tiny amount: a hundred times less.", "4 % sind in der Ausatemluft. In frischer Luft ist nur ganz wenig: hundertmal weniger.") },
      { v: 21, title: tx("That's oxygen", "Das ist Sauerstoff"), say: tx("21 % is the oxygen in fresh air.", "21 % ist der Sauerstoff in frischer Luft.") },
      { v: 16, title: tx("That's oxygen", "Das ist Sauerstoff"), say: tx("16 % is the oxygen left in exhaled air.", "16 % ist der Sauerstoff, der in der Ausatemluft übrig ist.") },
    ],
    why: tx("Fresh air contains hardly any carbon dioxide: 0.04 %.", "Frische Luft enthält kaum Kohlenstoffdioxid: 0,04 %."),
  },
  {
    text: tx("How much **carbon dioxide** does **exhaled** air contain?", "Wie viel **Kohlenstoffdioxid** enthält die **Ausatemluft**?"),
    gas: "co2",
    inhaled: false,
    right: 4,
    wrong: [
      { v: 0.04, title: tx("That's fresh air", "Das ist frische Luft"), say: tx("0.04 % is in fresh air. Your cells produce carbon dioxide, so you breathe out much more.", "0,04 % sind in frischer Luft. Deine Zellen bilden Kohlenstoffdioxid, deshalb atmest du viel mehr aus.") },
      { v: 16, title: tx("That's oxygen", "Das ist Sauerstoff"), say: tx("16 % is the oxygen left in exhaled air.", "16 % ist der Sauerstoff, der in der Ausatemluft übrig ist.") },
      { v: 21, title: tx("That's oxygen", "Das ist Sauerstoff"), say: tx("21 % is the oxygen in fresh air.", "21 % ist der Sauerstoff in frischer Luft.") },
    ],
    why: tx("Exhaled air contains about 4 % carbon dioxide: a hundred times as much as fresh air.", "Ausatemluft enthält etwa 4 % Kohlenstoffdioxid: hundertmal so viel wie frische Luft."),
  },
];

function airTask(rng: Rng, fixed?: number): Exercise {
  const Q = fixed !== undefined ? AIR_QUESTIONS[fixed] : rng.pick(AIR_QUESTIONS);
  const opts: Opt[] = [{ text: PCT(Q.right) }, ...Q.wrong.map((w) => ({ text: PCT(w.v), title: w.title, say: w.say }))];
  const { answer, mistakes: list } = choice(rng, opts);
  const withBars = fixed === undefined && rng.chance(0.5);
  return {
    instruction: tx("Inhaled and exhaled air", "Einatem- und Ausatemluft"),
    text: Q.text,
    ...(withBars ? { visual: visual(HeartAirBars, { ask: Q.gas, askIn: Q.inhaled }) } : {}),
    answer,
    hint: tx("Fresh air: 21 % oxygen, 0.04 % carbon dioxide. The body takes some oxygen and gives off carbon dioxide.", "Frische Luft: 21 % Sauerstoff, 0,04 % Kohlenstoffdioxid. Der Körper nimmt Sauerstoff auf und gibt Kohlenstoffdioxid ab."),
    solution: [
      { math: tx(`"oxygen:"#o \\; 21 "%" \\to 16 "%"`, `"Sauerstoff:"#o \\; 21 "%" \\to 16 "%"`), note: tx("Some oxygen stays in the body.", "Ein Teil des Sauerstoffs bleibt im Körper.") },
      { math: tx(`"carbon dioxide:"#c \\; 0.04 "%" \\to 4 "%"`, `"Kohlenstoffdioxid:"#c \\; 0,04 "%" \\to 4 "%"`), note: Q.why, highlight: [Q.gas === "o2" ? "o" : "c"] },
    ],
    mistakes: list,
  };
}

function limewaterTask(rng: Rng): Exercise {
  const exhaled = rng.chance(0.6);
  const opts: Opt[] = exhaled
    ? [
        { text: tx("It turns milky, because exhaled air contains a lot of carbon dioxide.", "Es wird milchig trüb, weil Ausatemluft viel Kohlenstoffdioxid enthält.") },
        { text: tx("It stays clear.", "Es bleibt klar."), title: tx("Plenty of CO₂ here", "Hier ist viel CO₂"), say: tx("Exhaled air contains about 4 % carbon dioxide: a hundred times more than fresh air. That's enough to cloud limewater.", "Ausatemluft enthält etwa 4 % Kohlenstoffdioxid, hundertmal mehr als frische Luft. Das reicht, um Kalkwasser zu trüben.") },
        { text: tx("It turns milky, because exhaled air contains a lot of oxygen.", "Es wird milchig trüb, weil Ausatemluft viel Sauerstoff enthält."), title: tx("Wrong gas", "Falsches Gas"), say: tx("Limewater reacts to carbon dioxide, not to oxygen. Fresh air has even more oxygen and leaves it clear.", "Kalkwasser reagiert auf Kohlenstoffdioxid, nicht auf Sauerstoff. Frische Luft hat sogar mehr Sauerstoff und lässt es klar.") },
        { text: tx("It turns blue.", "Es färbt sich blau."), title: tx("Milky, not blue", "Trüb, nicht blau"), say: tx("Limewater doesn't change colour: carbon dioxide makes it milky.", "Kalkwasser ändert nicht die Farbe: Kohlenstoffdioxid macht es milchig trüb.") },
      ]
    : [
        { text: tx("It stays almost clear, because fresh air contains hardly any carbon dioxide.", "Es bleibt fast klar, weil frische Luft kaum Kohlenstoffdioxid enthält.") },
        { text: tx("It turns milky, because air contains oxygen.", "Es wird milchig trüb, weil Luft Sauerstoff enthält."), title: tx("Wrong gas", "Falsches Gas"), say: tx("Limewater only reacts to carbon dioxide. Fresh air contains just 0.04 % of it.", "Kalkwasser reagiert nur auf Kohlenstoffdioxid. Frische Luft enthält davon nur 0,04 %.") },
        { text: tx("It turns milky straight away, just like with exhaled air.", "Es wird sofort milchig trüb, genau wie bei Ausatemluft."), title: tx("Hardly any CO₂", "Kaum CO₂"), say: tx("Exhaled air has about a hundred times as much carbon dioxide as fresh air. That's the whole point of the comparison.", "Ausatemluft hat etwa hundertmal so viel Kohlenstoffdioxid wie frische Luft. Genau das zeigt der Vergleich.") },
      ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Experiment: limewater", "Versuch: Kalkwasser"),
    text: exhaled
      ? tx("Lukas blows his exhaled air through a straw into limewater. What does he observe?", "Lukas pustet seine Ausatemluft mit einem Strohhalm in Kalkwasser. Was beobachtet er?")
      : tx("With a pump, Lisa bubbles fresh room air through limewater for the same time. What does she observe?", "Lisa pumpt mit einer Pumpe gleich lange frische Raumluft durch Kalkwasser. Was beobachtet sie?"),
    answer,
    hint: tx("Limewater turns milky with carbon dioxide. Which air contains a lot of it?", "Kalkwasser wird durch Kohlenstoffdioxid trüb. Welche Luft enthält viel davon?"),
    solution: answerFrames(exhaled ? tx("milky", "milchig trüb") : tx("almost clear", "fast klar"), exhaled ? tx("Exhaled air contains about 4 % carbon dioxide: limewater turns milky. This is how you test for carbon dioxide.", "Ausatemluft enthält etwa 4 % Kohlenstoffdioxid: Kalkwasser wird trüb. So weist man Kohlenstoffdioxid nach.") : tx("Fresh air has only 0.04 % carbon dioxide: the limewater stays almost clear.", "Frische Luft hat nur 0,04 % Kohlenstoffdioxid: Das Kalkwasser bleibt fast klar.")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The heart

const HEART_FACTS: { q: Text; opts: Opt[]; why: Text }[] = [
  {
    q: tx("About how big is your heart?", "Wie groß ist dein Herz ungefähr?"),
    opts: [
      { text: tx("About as big as your fist", "Etwa so groß wie deine Faust") },
      { text: tx("About as big as your head", "Etwa so groß wie dein Kopf"), title: tx("Much smaller", "Viel kleiner"), say: tx("It's much smaller: make a fist, that's about the size of your heart.", "Es ist viel kleiner: Mach eine Faust, so groß ist ungefähr dein Herz.") },
      { text: tx("About as big as a pea", "Etwa so groß wie eine Erbse"), title: tx("Much bigger", "Viel größer"), say: tx("A pea-sized heart couldn't pump enough blood. It's about the size of your fist.", "Ein erbsengroßes Herz könnte nicht genug Blut pumpen. Es ist etwa so groß wie deine Faust.") },
    ],
    why: tx("Your heart is about as big as your fist and grows with you.", "Dein Herz ist etwa so groß wie deine Faust und wächst mit dir mit."),
  },
  {
    q: tx("What is the heart mainly made of?", "Woraus besteht das Herz vor allem?"),
    opts: [
      { text: tx("Muscle", "Muskelgewebe") },
      { text: tx("Bone", "Knochen"), title: tx("It has to move", "Es muss sich bewegen"), say: tx("Bone can't contract. The heart squeezes the blood out, so it is a muscle.", "Knochen kann sich nicht zusammenziehen. Das Herz presst das Blut hinaus, also ist es ein Muskel.") },
      { text: tx("Fat", "Fettgewebe"), title: tx("It has to work", "Es muss arbeiten"), say: tx("Fat stores energy but can't pump. The heart is a hollow muscle.", "Fett speichert Energie, kann aber nicht pumpen. Das Herz ist ein Hohlmuskel.") },
      { text: tx("Cartilage", "Knorpel"), title: tx("It has to move", "Es muss sich bewegen"), say: tx("Cartilage is firm but can't contract. The heart is a muscle.", "Knorpel ist fest, kann sich aber nicht zusammenziehen. Das Herz ist ein Muskel.") },
    ],
    why: tx("The heart is a hollow muscle: its muscle wall contracts and squeezes the blood out.", "Das Herz ist ein Hohlmuskel: Seine Muskelwand zieht sich zusammen und presst das Blut hinaus."),
  },
  {
    q: tx("Where is your heart?", "Wo liegt dein Herz?"),
    opts: [
      { text: tx("In the chest between the two lungs, a little to the left", "In der Brust zwischen den beiden Lungenflügeln, etwas nach links") },
      { text: tx("In the belly next to the stomach", "Im Bauch neben dem Magen"), title: tx("Higher up", "Weiter oben"), say: tx("The heart sits higher: in the chest, protected by the ribcage.", "Das Herz liegt weiter oben: in der Brust, geschützt vom Brustkorb.") },
      { text: tx("Far left, just under the armpit", "Ganz links, direkt unter der Achsel"), title: tx("More in the middle", "Mehr in der Mitte"), say: tx("It lies almost in the middle of the chest, only a little to the left.", "Es liegt fast in der Mitte der Brust, nur etwas nach links verschoben.") },
    ],
    why: tx("The heart lies in the chest between the lungs, only slightly to the left.", "Das Herz liegt in der Brust zwischen den Lungenflügeln, nur leicht nach links verschoben."),
  },
  {
    q: tx("How often does an adult's heart beat per minute at rest?", "Wie oft schlägt das Herz eines Erwachsenen in Ruhe pro Minute?"),
    opts: [
      { text: tx("About 60 to 80 times", "Etwa 60- bis 80-mal") },
      { text: tx("About 10 to 20 times", "Etwa 10- bis 20-mal"), title: tx("Much more often", "Viel öfter"), say: tx("That's more like breathing. Feel your pulse: it beats more than once a second.", "Das passt eher zur Atmung. Fühl mal deinen Puls: Er schlägt etwa einmal pro Sekunde oder öfter.") },
      { text: tx("About 200 to 300 times", "Etwa 200- bis 300-mal"), title: tx("Much slower", "Viel langsamer"), say: tx("That would be far too fast even for top athletes. At rest it's about once a second.", "Das wäre selbst für Spitzensportler viel zu schnell. In Ruhe ist es etwa einmal pro Sekunde.") },
    ],
    why: tx("At rest an adult heart beats about 60 to 80 times a minute; in children it beats a little faster.", "In Ruhe schlägt ein erwachsenes Herz etwa 60- bis 80-mal pro Minute, bei Kindern etwas schneller."),
  },
  {
    q: tx("What does the heart do?", "Was macht das Herz?"),
    opts: [
      { text: tx("It pumps blood through the body.", "Es pumpt das Blut durch den Körper.") },
      { text: tx("It takes oxygen out of the air.", "Es holt Sauerstoff aus der Luft."), title: tx("That's the lungs", "Das macht die Lunge"), say: tx("Oxygen is taken up in the lungs. The heart pumps the blood that carries it.", "Sauerstoff wird in der Lunge aufgenommen. Das Herz pumpt das Blut, das ihn transportiert.") },
      { text: tx("It cleans the blood.", "Es reinigt das Blut."), title: tx("That's the kidneys", "Das machen die Nieren"), say: tx("The kidneys clean the blood. The heart is the pump.", "Die Nieren reinigen das Blut. Das Herz ist die Pumpe.") },
    ],
    why: tx("The heart is a pump: it keeps the blood flowing through the whole body.", "Das Herz ist eine Pumpe: Es hält das Blut im ganzen Körper in Bewegung."),
  },
];

function heartFactTask(rng: Rng): Exercise {
  const F = rng.pick(HEART_FACTS);
  const { answer, mistakes: list } = choice(rng, F.opts);
  return {
    instruction: tx("The heart", "Das Herz"),
    text: F.q,
    answer,
    hint: tx("The heart is a hollow muscle in your chest. Feel your pulse!", "Das Herz ist ein Hohlmuskel in deiner Brust. Fühl mal deinen Puls!"),
    solution: answerFrames(F.opts[0].text, F.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// True or false

const RIGHT_WRONG: Text[] = [tx("True", "Richtig"), tx("False", "Falsch")];
const STATEMENTS: { s: Text; ok: boolean; why: Text; trap?: Text }[] = [
  { s: tx("Veins carry blood to the heart.", "Venen führen das Blut zum Herzen hin."), ok: true, why: tx("Right: veins lead to the heart, arteries away from it.", "Richtig: Venen führen zum Herzen hin, Arterien vom Herzen weg.") },
  { s: tx("Exhaled air contains no oxygen at all.", "Ausatemluft enthält gar keinen Sauerstoff mehr."), ok: false, why: tx("Exhaled air still contains about 16 % oxygen. That's why rescue breaths work.", "Ausatemluft enthält noch etwa 16 % Sauerstoff. Deshalb funktioniert die Atemspende."), trap: tx("The body only keeps a small part of the oxygen; about 16 % is still in your breath.", "Der Körper behält nur einen kleinen Teil des Sauerstoffs, etwa 16 % sind noch in deinem Atem.") },
  { s: tx("The blood in your veins is blue.", "Das Blut in den Venen ist blau."), ok: false, why: tx("Oxygen-poor blood is dark red. Books draw it blue only to tell it apart.", "Sauerstoffarmes Blut ist dunkelrot. Bücher malen es nur blau, um es zu unterscheiden."), trap: tx("Veins look bluish through the skin, but the blood inside is dark red. Blue is just the colour code in pictures.", "Venen schimmern bläulich durch die Haut, das Blut darin ist aber dunkelrot. Blau ist nur die Farbe in Abbildungen.") },
  { s: tx("Substances are exchanged with the cells in the capillaries.", "In den Kapillaren werden Stoffe mit den Zellen ausgetauscht."), ok: true, why: tx("Right: capillary walls are so thin that substances pass through.", "Richtig: Die Wände der Kapillaren sind so dünn, dass Stoffe hindurchgelangen.") },
  { s: tx("During sport the heart beats more slowly.", "Beim Sport schlägt das Herz langsamer."), ok: false, why: tx("During sport it beats faster: the muscles need more oxygen.", "Beim Sport schlägt es schneller: Die Muskeln brauchen mehr Sauerstoff."), trap: tx("Working muscles need more oxygen, so the heart has to beat **faster**.", "Arbeitende Muskeln brauchen mehr Sauerstoff, also muss das Herz **schneller** schlagen.") },
  { s: tx("The heart is a hollow muscle.", "Das Herz ist ein Hohlmuskel."), ok: true, why: tx("Right: a muscle with spaces inside that fill with blood.", "Richtig: ein Muskel mit Hohlräumen, die sich mit Blut füllen.") },
  { s: tx("The windpipe splits into two bronchi.", "Die Luftröhre teilt sich in zwei Bronchien."), ok: true, why: tx("Right: one bronchus for each lung.", "Richtig: ein Bronchus für jeden Lungenflügel.") },
  { s: tx("Oxygen passes into the blood in the bronchi.", "In den Bronchien geht der Sauerstoff ins Blut über."), ok: false, why: tx("That happens in the alveoli at the very end. The bronchi only conduct the air.", "Das passiert erst in den Lungenbläschen ganz am Ende. Die Bronchien leiten die Luft nur weiter."), trap: tx("The bronchi are just the airways. The exchange happens in the alveoli.", "Die Bronchien sind nur die Luftwege. Der Austausch passiert in den Lungenbläschen.") },
  { s: tx("Arteries carry blood away from the heart.", "Arterien führen das Blut vom Herzen weg."), ok: true, why: tx("Right: A for away.", "Richtig: A wie Ausgang.") },
  { s: tx("The blood also transports heat.", "Das Blut transportiert auch Wärme."), ok: true, why: tx("Right: it spreads the heat from working muscles through the body.", "Richtig: Es verteilt die Wärme arbeitender Muskeln im ganzen Körper.") },
  { s: tx("Exhaled air contains more carbon dioxide than inhaled air.", "Ausatemluft enthält mehr Kohlenstoffdioxid als Einatemluft."), ok: true, why: tx("Right: about 4 % instead of 0.04 %.", "Richtig: etwa 4 % statt 0,04 %.") },
  { s: tx("Your pulse is the beating of your lungs.", "Der Puls ist der Schlag der Lunge."), ok: false, why: tx("The pulse is the pressure wave of the blood in the arteries, caused by the heartbeat.", "Der Puls ist die Druckwelle des Blutes in den Arterien, die der Herzschlag auslöst."), trap: tx("The pulse comes from the heart: each beat sends a pressure wave through the arteries.", "Der Puls kommt vom Herzen: Jeder Schlag schickt eine Druckwelle durch die Arterien.") },
];

function statementTask(rng: Rng): Exercise {
  const S = rng.pick(STATEMENTS);
  const answer: AnswerSpec = { kind: "choice", options: RIGHT_WRONG, correct: S.ok ? 0 : 1 };
  return {
    instruction: tx("True or false?", "Richtig oder falsch?"),
    text: S.s,
    answer,
    hint: tx("Check each word: direction, place, amount.", "Prüf jedes Wort: Richtung, Ort, Menge."),
    solution: answerFrames(S.ok ? RIGHT_WRONG[0] : RIGHT_WRONG[1], S.why),
    mistakes: [
      {
        when: { kind: "choice", options: RIGHT_WRONG, correct: S.ok ? 1 : 0 },
        title: S.ok ? tx("It's true", "Das stimmt") : tx("Common mix-up", "Häufige Verwechslung"),
        say: S.ok ? tx(`It's actually true! ${en(S.why).replace(/^Right: /, "")}`, `Das stimmt tatsächlich! ${de(S.why).replace(/^Richtig: /, "")}`) : (S.trap ?? S.why),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  switch (rng.int(0, 12)) {
    case 0:
    case 1:
      return vesselTask(rng);
    case 2:
    case 3:
      return pulseTask(rng);
    case 4:
      return sportTask(rng);
    case 5:
      return activityOrderTask(rng);
    case 6:
      return transportTask(rng);
    case 7:
      return carriedMultiTask(rng);
    case 8:
      return airwayOrderTask(rng);
    case 9:
      return rng.chance(0.6) ? airwayPictureTask(rng) : airwayMatchTask(rng);
    case 10:
      return rng.chance(0.75) ? airTask(rng) : limewaterTask(rng);
    case 11:
      return heartFactTask(rng);
    default:
      return statementTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const heartFrames: Frame[] = [
  { math: tx('"heart"#h = "hollow muscle"#m', '"Herz"#h = "Hohlmuskel"#m'), note: tx("The heart is a muscle that is hollow inside. Its spaces are filled with blood.", "Das Herz ist ein Muskel, der innen hohl ist. In seinen Hohlräumen ist Blut.") },
  { math: tx('"size"#s \\approx "your fist"#f', '"Größe"#s \\approx "deine Faust"#f'), note: tx("About as big as your fist, and it sits in your chest between the lungs, a little to the left.", "Etwa so groß wie deine Faust. Es liegt in der Brust zwischen den Lungenflügeln, etwas nach links.") },
  { math: tx('"contract"#c \\to "blood out"#o \\quad "relax"#r \\to "blood in"#i', '"zusammenziehen"#c \\to "Blut raus"#o \\quad "erschlaffen"#r \\to "Blut rein"#i'), note: tx("Like a pump: when it contracts it squeezes blood out; when it relaxes it fills up again.", "Wie eine Pumpe: Zieht es sich zusammen, presst es Blut hinaus. Erschlafft es, füllt es sich wieder.") },
  { math: tx('70#n "beats per minute"#u', '70#n "Schläge pro Minute"#u'), note: tx("At rest an adult heart beats about 60 to 80 times a minute.", "In Ruhe schlägt ein erwachsenes Herz etwa 60- bis 80-mal pro Minute.") },
  { math: tx('70#n \\cdot 60 \\cdot 24 \\approx "100,000 a day"#d', '70#n \\cdot 60 \\cdot 24 \\approx "100.000 am Tag"#d'), note: tx("That makes about 100,000 beats a day, your whole life long, without a break!", "Das sind etwa 100.000 Schläge am Tag, ein Leben lang, ohne Pause!") },
];

const vesselFrames: Frame[] = [
  { math: tx('"heart"#h \\to "artery"#a \\to "capillaries"#k \\to "vein"#v \\to "heart"#h2', '"Herz"#h \\to "Arterie"#a \\to "Kapillaren"#k \\to "Vene"#v \\to "Herz"#h2'), note: tx("A circuit: the blood always comes back to the heart.", "Ein Kreislauf: Das Blut kommt immer wieder zum Herzen zurück.") },
  { math: tx('"artery"#a : "away from the heart"#x', '"Arterie"#a : "vom Herzen weg"#x'), note: tx("Memory aid: **A** for **a**way. Arteries have a thick, strong wall. You feel the pulse in them.", "Merkhilfe: **A** wie **A**usgang. Arterien führen aus dem Herzen heraus. Sie haben eine dicke, kräftige Wand, in ihnen spürst du den Puls."), highlight: ["a", "x"] },
  { math: tx('"vein"#v : "to the heart"#y', '"Vene"#v : "zum Herzen hin"#y'), note: tx("Veins bring the blood back to the heart. You sometimes see them shimmer bluish through your skin.", "Venen bringen das Blut zurück zum Herzen. Manchmal siehst du sie bläulich durch die Haut schimmern."), highlight: ["v", "y"] },
  { math: tx('"capillaries"#k : "exchange"#z', '"Kapillaren"#k : "Stoffaustausch"#z'), note: tx("Capillaries are thinner than a hair. Their wall is so thin that oxygen and nutrients get out to the cells, and carbon dioxide gets in.", "Kapillaren sind dünner als ein Haar. Ihre Wand ist so dünn, dass Sauerstoff und Nährstoffe zu den Zellen hinaus- und Kohlenstoffdioxid hineingelangen."), highlight: ["k", "z"] },
];

const checkPulse = pulseTask(createRng(1), { name: "Mia", s: SITUATIONS[0], secs: 15, count: 19 });
const checkVessel = vesselTask(createRng(5), 1);
const checkAirway = airwayOrderTask(createRng(2), ["nose", "pharynx", "larynx", "trachea", "bronchi", "alveoli"]);
const checkAir = airTask(createRng(4), 3);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Your heart: a pump", "Dein Herz: eine Pumpe"),
      blob: tx("Put your hand on the left of your chest. Feel that? That's your heart at work!", "Leg mal die Hand links auf deine Brust. Spürst du es? Das ist dein Herz bei der Arbeit!"),
      body: tx(
        "Your heart is a **hollow muscle**. Day and night it pumps your blood through the body, so that every cell gets what it needs.",
        "Dein Herz ist ein **Hohlmuskel**. Tag und Nacht pumpt es dein Blut durch den Körper, damit jede Zelle bekommt, was sie braucht.",
      ),
      frames: heartFrames,
    },
    {
      type: "widget",
      title: tx("Feeling the pulse", "Den Puls fühlen"),
      blob: tx("Sleeping, climbing stairs, sprinting: what does your heart do?", "Schlafen, Treppensteigen, Rennen: Was macht dein Herz dabei?"),
      body: tx(
        "With every heartbeat blood is pushed into the arteries. You feel this pressure wave as your **pulse**, for example at your wrist or neck. The pulse tells you the **heart rate**: beats per minute. Try out how it changes with sport, then measure it for 15 seconds.",
        "Bei jedem Herzschlag wird Blut in die Arterien gedrückt. Diese Druckwelle spürst du als **Puls**, zum Beispiel am Handgelenk oder am Hals. Der Puls verrät die **Herzfrequenz**: Schläge pro Minute. Probier aus, wie sie sich beim Sport ändert, und miss sie 15 Sekunden lang.",
      ),
      widget: HeartPulseWidget,
    },
    { type: "check", blob: tx("Now you do the maths. Remember the trick with the 15 seconds?", "Jetzt rechnest du. Weißt du noch, der Trick mit den 15 Sekunden?"), exercise: checkPulse },
    {
      type: "explain",
      title: tx("Arteries, veins, capillaries", "Arterien, Venen, Kapillaren"),
      blob: tx("Three kinds of tubes, one easy rule: it's all about the direction!", "Drei Sorten Röhren, eine einfache Regel: Es kommt auf die Richtung an!"),
      body: tx(
        "Blood flows in tubes, the **blood vessels**. There are three kinds.",
        "Das Blut fließt in Röhren, den **Blutgefäßen**. Es gibt drei Sorten.",
      ),
      frames: vesselFrames,
    },
    { type: "check", blob: tx("Which way does the blood flow?", "In welche Richtung fließt das Blut?"), exercise: checkVessel },
    {
      type: "widget",
      title: tx("What the blood carries", "Was das Blut transportiert"),
      blob: tx("Blood is like a delivery service that never takes a day off.", "Das Blut ist wie ein Lieferdienst, der nie Feierabend macht."),
      body: tx(
        "Blood is the body's transport system. It brings **oxygen** from the lungs and **nutrients** from the intestine to every cell. It takes away the **carbon dioxide** the cells give off and spreads **heat**. Tap a substance and follow its way.\n\nRed means oxygen-rich, blue oxygen-poor blood. That's just the colour code in pictures: real blood is always red, oxygen-poor blood is dark red.",
        "Das Blut ist das Transportsystem des Körpers. Es bringt **Sauerstoff** aus der Lunge und **Nährstoffe** aus dem Darm zu jeder Zelle. Es nimmt das **Kohlenstoffdioxid** mit, das die Zellen abgeben, und verteilt **Wärme**. Tipp auf einen Stoff und verfolge seinen Weg.\n\nRot heißt sauerstoffreich, blau sauerstoffarm. Das ist nur die Farbe in Abbildungen: Echtes Blut ist immer rot, sauerstoffarmes dunkelrot.",
      ),
      widget: HeartTransportWidget,
    },
    {
      type: "widget",
      title: tx("The way of the air", "Der Weg der Luft"),
      blob: tx("Follow the air from your nose all the way into the alveoli!", "Folge der Luft von der Nase bis in die Lungenbläschen!"),
      body: tx(
        "When you breathe in, air flows through the **nose** (where it is warmed, moistened and cleaned), the pharynx and the larynx into the **windpipe**. It splits into two **bronchi**, which branch finer and finer in the lungs. At their ends sit millions of tiny **alveoli**: there oxygen passes into the blood. Tap the numbers!",
        "Beim Einatmen strömt die Luft durch die **Nase** (dort wird sie angewärmt, angefeuchtet und gereinigt), den Rachen und den Kehlkopf in die **Luftröhre**. Sie teilt sich in zwei **Bronchien**, die sich in der Lunge immer feiner verzweigen. An ihren Enden sitzen Millionen winziger **Lungenbläschen**: Dort geht Sauerstoff ins Blut über. Tipp auf die Nummern!",
      ),
      widget: () => <HeartAirways mode="explore" />,
    },
    { type: "check", blob: tx("Put the stations of the air in order.", "Bring die Stationen der Luft in die richtige Reihenfolge."), exercise: checkAirway },
    {
      type: "widget",
      title: tx("Breathing in and out", "Einatmen und Ausatmen"),
      blob: tx("Is the air you breathe out still the same air? Let's look closer.", "Ist die Luft, die du ausatmest, noch dieselbe? Schauen wir genauer hin."),
      body: tx(
        "The air you breathe out is different from the air you breathe in. Switch between the two and compare. Then do the limewater experiment.",
        "Die Luft, die du ausatmest, ist anders als die Luft, die du einatmest. Wechsle zwischen beiden und vergleiche. Dann mach den Kalkwasser-Versuch.",
      ),
      widget: HeartBreathWidget,
    },
    { type: "check", blob: tx("Last one: how much carbon dioxide do you breathe out?", "Zum Schluss: Wie viel Kohlenstoffdioxid atmest du aus?"), exercise: checkAir },
  ],
  summary: [
    {
      title: tx("The heart", "Das Herz"),
      body: tx(
        "A hollow muscle about the size of your fist, in the chest between the lungs. It pumps the blood through the body: at rest about 60 to 80 beats per minute (adults), during sport much more.",
        "Ein Hohlmuskel, etwa so groß wie deine Faust, in der Brust zwischen den Lungenflügeln. Es pumpt das Blut durch den Körper: in Ruhe etwa 60 bis 80 Schläge pro Minute (Erwachsene), beim Sport viel mehr.",
      ),
      tone: "rule",
    },
    {
      title: tx("Measuring the pulse", "Puls messen"),
      body: tx("Feel with index and middle finger (not the thumb) at the wrist or neck. Count for 15 seconds and multiply by 4.", "Mit Zeige- und Mittelfinger (nicht mit dem Daumen) am Handgelenk oder Hals fühlen. 15 Sekunden zählen und mal 4 nehmen."),
      examples: [tx('20 "beats in 15 s" \\to 20 \\cdot 4 = 80 "per min"', '20 "Schläge in 15 s" \\to 20 \\cdot 4 = 80 "pro min"')],
      tone: "tip",
    },
    {
      title: tx("Blood vessels", "Blutgefäße"),
      body: tx("Arteries: away from the heart (A for away), thick wall. Veins: to the heart. Capillaries: hair-thin, exchange substances with the cells.", "Arterien: vom Herzen weg (A wie Ausgang), dicke Wand. Venen: zum Herzen hin. Kapillaren: haarfein, Stoffaustausch mit den Zellen."),
      examples: [tx('"heart" \\to "artery" \\to "capillaries" \\to "vein" \\to "heart"', '"Herz" \\to "Arterie" \\to "Kapillaren" \\to "Vene" \\to "Herz"')],
      tone: "rule",
    },
    {
      title: tx("Blood transports", "Das Blut transportiert"),
      body: tx("Oxygen (lungs → cells), nutrients (intestine → cells), carbon dioxide (cells → lungs) and heat.", "Sauerstoff (Lunge → Zellen), Nährstoffe (Darm → Zellen), Kohlenstoffdioxid (Zellen → Lunge) und Wärme."),
      tone: "rule",
    },
    {
      title: tx("The airways", "Die Atemwege"),
      body: tx("The nose warms, moistens and cleans the air. In the alveoli oxygen passes into the blood.", "Die Nase wärmt, befeuchtet und reinigt die Luft. In den Lungenbläschen geht Sauerstoff ins Blut über."),
      examples: [tx('"nose" \\to "pharynx" \\to "larynx" \\to "windpipe" \\\\ \\to "bronchi" \\to "alveoli"', '"Nase" \\to "Rachen" \\to "Kehlkopf" \\to "Luftröhre" \\\\ \\to "Bronchien" \\to "Lungenbläschen"')],
      tone: "rule",
    },
    {
      title: tx("Inhaled and exhaled air", "Einatemluft und Ausatemluft"),
      body: tx("Exhaled air still contains about 16 % oxygen, but a hundred times as much carbon dioxide (4 % instead of 0.04 %). It turns limewater milky.", "Ausatemluft enthält noch etwa 16 % Sauerstoff, aber hundertmal so viel Kohlenstoffdioxid (4 % statt 0,04 %). Sie trübt Kalkwasser."),
      examples: [tx('\\ce{O2}: 21 "%" \\to 16 "%" \\quad \\ce{CO2}: 0.04 "%" \\to 4 "%"', '\\ce{O2}: 21 "%" \\to 16 "%" \\quad \\ce{CO2}: 0,04 "%" \\to 4 "%"')],
      tone: "warning",
    },
  ],
};
