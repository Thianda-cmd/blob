"use client";

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { CHANGES, REVERSE, STATE_NAMES, SUBSTANCES, deAdj, degText, dePronoun, stateAt, substance, type Change, type State, type Substance } from "@/learn/chemistry/particles-data";
import { ParticlesBox } from "@/learn/chemistry/visuals/ParticlesBox";
import { HeatingChart, ParticlesHeatingLab, type CurvePoint } from "@/learn/chemistry/visuals/ParticlesCurve";
import { ParticlesMotion, ParticlesSyringes, ParticlesZoom } from "@/learn/chemistry/visuals/ParticlesMotion";
import { ParticlesScale, ParticlesTable } from "@/learn/chemistry/visuals/ParticlesScale";
import { ParticleSim } from "@/learn/chemistry/visuals/ParticlesSim";
import { useText } from "@/i18n/useText";

// ---------------------------------------------------------------------------
// Small helpers

function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "choice":
      return { kind: "choice", index: a.correct };
    case "multi":
      return { kind: "multi", indices: a.correct };
    case "word":
      return { kind: "text", text: resolveText(a.accept[0], "de") };
    default:
      return null;
  }
}

/** Typical mistakes, each kept only when it differs from the right answer and from the others. */
function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => check(m.when, v).correct)) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** Options with the right one first; shuffled when an rng is given. Wrong options with a `say` become mistakes. */
type Opt = { text: Text; title?: Text; say?: Text };
function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

/** A number in the display language with keys: `-#ks 114#k`. */
function dnum(v: number, k: string) {
  return v < 0 ? `-#${k}s ${-v}#${k}` : `${v}#${k}`;
}
/** "−114 °C" for notes. */
const deg = (v: number) => degText(v);
const degEn = (v: number) => en(deg(v));
const degDe = (v: number) => de(deg(v));

const STATE_OPTIONS: Text[] = [STATE_NAMES[0], STATE_NAMES[1], STATE_NAMES[2]];
const stateEn = (s: State) => en(STATE_NAMES[s]);
const stateDe = (s: State) => de(STATE_NAMES[s]);

/** Particle picture for a task. */
function StatePicture({ state, seed }: { state: State; seed: number }) {
  const t = useText();
  return (
    <div className="mx-auto max-w-[360px]">
      <ParticleSim liquid={state >= 1 ? 1 : 0} gas={state === 2 ? 1 : 0} heat={0.45} seed={seed} label={t(tx("A substance in the particle model", "Ein Stoff im Teilchenmodell"))} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Which state? (particle picture)

const LOOKS: Record<State, [Text, Text, Text]> = {
  0: [tx("close", "dicht"), tx("regular", "regelmäßig"), tx("vibrate", "schwingen")],
  1: [tx("close", "dicht"), tx("no order", "ungeordnet"), tx("slide", "gleiten")],
  2: [tx("far apart", "weit entfernt"), tx("no order", "ungeordnet"), tx("fly freely", "fliegen frei")],
};

const LOOK_NOTES: Record<State, Text> = {
  0: tx("The particles touch, sit in neat rows and only vibrate in their places.", "Die Teilchen berühren sich, sitzen in ordentlichen Reihen und schwingen nur auf ihren Plätzen."),
  1: tx("The particles are close together, but jumbled, and they slide past each other.", "Die Teilchen sind dicht beieinander, aber durcheinander, und sie gleiten aneinander vorbei."),
  2: tx("The particles are far apart and fly through the whole box.", "Die Teilchen sind weit voneinander entfernt und fliegen durch die ganze Box."),
};

/** Blob's note when the picture shows `right` but the student picked `picked`. */
const PICTURE_SAYS: Record<State, Partial<Record<State, [Text, Text]>>> = {
  0: {
    1: [
      tx("Look at the order", "Achte auf die Ordnung"),
      tx(
        "Close together, yes! But look closer: the particles sit in neat rows and only vibrate. In a liquid there are no rows.",
        "Dicht beieinander, stimmt! Aber schau genauer: Die Teilchen sitzen in ordentlichen Reihen und schwingen nur. In einer Flüssigkeit gibt es keine Reihen.",
      ),
    ],
    2: [
      tx("Look at the gaps", "Achte auf die Abstände"),
      tx("In a gas the particles would be far apart and fill the whole box. Here they're packed tightly.", "In einem Gas wären die Teilchen weit voneinander entfernt und würden die ganze Box füllen. Hier sind sie dicht gepackt."),
    ],
  },
  1: {
    0: [
      tx("Look at the order", "Achte auf die Ordnung"),
      tx("They are close together, but jumbled, not in neat rows, and they slide around. That's not how a solid looks.", "Sie sind dicht beieinander, aber durcheinander, nicht in Reihen, und sie gleiten herum. So sieht kein Feststoff aus."),
    ],
    2: [
      tx("Look at the gaps", "Achte auf die Abstände"),
      tx("These particles stay together at the bottom. Gas particles would spread out through the whole box.", "Diese Teilchen bleiben unten zusammen. Gasteilchen würden sich in der ganzen Box verteilen."),
    ],
  },
  2: {
    0: [tx("Look at the gaps", "Achte auf die Abstände"), tx("Look at the gaps! The particles are far apart and fly through the whole box.", "Schau dir die Abstände an! Die Teilchen sind weit voneinander entfernt und fliegen durch die ganze Box.")],
    1: [
      tx("Look at the gaps", "Achte auf die Abstände"),
      tx("A liquid stays together at the bottom. These particles are far apart and use the whole box.", "Eine Flüssigkeit bleibt unten zusammen. Diese Teilchen sind weit voneinander entfernt und nutzen die ganze Box."),
    ],
  },
};

function pictureTask(state: State, seed: number): Exercise {
  const answer: AnswerSpec = { kind: "choice", options: STATE_OPTIONS, correct: state };
  const m = mistakes(answer);
  for (const s of [0, 1, 2] as State[]) {
    const say = PICTURE_SAYS[state][s];
    if (say) m.add({ kind: "choice", options: STATE_OPTIONS, correct: s }, say[0], say[1]);
  }
  const [a, b, c] = LOOKS[state];
  return {
    instruction: tx("Which state?", "Welcher Aggregatzustand?"),
    text: tx("This is a substance in the particle model. Which state is it in?", "So sieht ein Stoff im Teilchenmodell aus. In welchem Aggregatzustand ist er?"),
    visual: visual(StatePicture, { state, seed }),
    answer,
    hint: tx("Look at three things: the distance between the particles, their order and how they move.", "Achte auf drei Dinge: den Abstand der Teilchen, ihre Ordnung und wie sie sich bewegen."),
    solution: [
      {
        math: tx('"distance?"#q1 \\quad "order?"#q2 \\quad "movement?"#q3', '"Abstand?"#q1 \\quad "Ordnung?"#q2 \\quad "Bewegung?"#q3'),
        note: tx("Check three things in the picture: distance, order and movement.", "Prüf im Bild drei Dinge: Abstand, Ordnung und Bewegung."),
      },
      { math: tx(`"${en(a)}"#q1 \\quad "${en(b)}"#q2 \\quad "${en(c)}"#q3`, `"${de(a)}"#q1 \\quad "${de(b)}"#q2 \\quad "${de(c)}"#q3`), note: LOOK_NOTES[state] },
      {
        math: tx(`\\Rightarrow#r "${stateEn(state)}"#s`, `\\Rightarrow#r "${stateDe(state)}"#s`),
        note: tx(`So the substance is **${stateEn(state)}**.`, `Der Stoff ist also **${stateDe(state)}**.`),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Changes of state

type Scene = { change: Change; text: Text; extra?: Text[]; notice?: { when: Text[]; title: Text; say: Text } };

const BOILING_NOTICE = {
  when: ["Verdunsten"],
  title: tx("Evaporating isn't boiling", "Verdunsten ist nicht Sieden"),
  say: tx(
    "Nearly! **Verdunsten** happens below the boiling temperature, quietly at the surface. Here the water bubbles at 100 °C, its boiling temperature. What's that called?",
    "Fast! **Verdunsten** passiert unterhalb der Siedetemperatur, leise an der Oberfläche. Hier brodelt das Wasser bei 100 °C, seiner Siedetemperatur. Wie heißt das?",
  ),
};
const PUDDLE_NOTICE = {
  when: [tx("boiling", "Sieden"), "boil"],
  title: tx("Not boiling", "Kein Sieden"),
  say: tx(
    "Boiling only happens at the boiling temperature, with bubbles. This water is far below 100 °C and still turns into a gas, quietly at the surface.",
    "Sieden passiert nur bei der Siedetemperatur, mit Blasen. Dieses Wasser ist weit unter 100 °C und wird trotzdem gasförmig, ganz leise an der Oberfläche.",
  ),
};

const SCENES: Scene[] = [
  { change: "melt", text: tx("An ice cube lies on the table and turns into a puddle of water.", "Ein Eiswürfel liegt auf dem Tisch und wird zu einer Wasserpfütze.") },
  { change: "melt", text: tx("A chocolate bar left in the sun goes soft and runny.", "Ein Schokoriegel liegt in der Sonne und wird weich und flüssig.") },
  { change: "melt", text: tx("Candle wax next to the flame turns liquid.", "Kerzenwachs wird neben der Flamme flüssig.") },
  { change: "freeze", text: tx("Water in the freezer turns into ice cubes.", "Wasser im Gefrierfach wird zu Eiswürfeln.") },
  { change: "freeze", text: tx("Liquid candle wax drips onto the table and goes hard.", "Flüssiges Kerzenwachs tropft auf den Tisch und wird hart.") },
  { change: "freeze", text: tx("Molten iron is poured into a mould and becomes solid.", "Flüssiges Eisen wird in eine Form gegossen und wird fest.") },
  { change: "freeze", text: tx("Lava flows into the sea and turns into rock.", "Lava fließt ins Meer und wird zu Gestein.") },
  { change: "boil", text: tx("Water in a pot bubbles at 100 °C and turns into water vapour.", "Wasser im Kochtopf brodelt bei 100 °C und wird zu Wasserdampf."), extra: [tx("boiling", "Sieden")], notice: BOILING_NOTICE },
  { change: "boil", text: tx("A puddle dries up in the sun, at about 25 °C.", "Eine Pfütze trocknet bei etwa 25 °C in der Sonne."), extra: [tx("evaporating", "Verdunsten")], notice: PUDDLE_NOTICE },
  { change: "boil", text: tx("Wet washing dries on the line.", "Nasse Wäsche trocknet auf der Leine."), extra: [tx("evaporating", "Verdunsten")], notice: PUDDLE_NOTICE },
  { change: "condense", text: tx("The bathroom mirror steams up when you shower.", "Der Badezimmerspiegel beschlägt beim Duschen.") },
  { change: "condense", text: tx("In the morning there are drops of dew on the grass.", "Morgens hängen Tautropfen an den Grashalmen.") },
  { change: "condense", text: tx("A cold bottle from the fridge gets wet on the outside.", "Eine kalte Flasche aus dem Kühlschrank wird außen nass.") },
  { change: "condense", text: tx("Your glasses steam up when you come into a warm room in winter.", "Deine Brille beschlägt, wenn du im Winter in einen warmen Raum kommst.") },
  { change: "sublime", text: tx("Dry ice (solid carbon dioxide) turns into a gas without becoming liquid.", "Trockeneis (festes Kohlenstoffdioxid) wird gasförmig, ohne flüssig zu werden.") },
  { change: "sublime", text: tx("Frozen washing dries in the frost, although the ice never melts.", "Gefrorene Wäsche trocknet im Frost, obwohl das Eis nie schmilzt.") },
  { change: "sublime", text: tx("Gently heated iodine crystals give off violet vapour.", "Iodkristalle geben beim vorsichtigen Erwärmen violetten Dampf ab.") },
  { change: "deposit", text: tx("On a frosty night, hoar frost grows on the branches: water vapour turns straight into ice.", "In einer Frostnacht wächst Raureif an den Ästen: Wasserdampf wird direkt zu Eis.") },
  { change: "deposit", text: tx("Ice flowers grow on a cold window pane from the water vapour in the air.", "An einer kalten Fensterscheibe wachsen Eisblumen aus dem Wasserdampf der Luft.") },
  { change: "deposit", text: tx("Violet iodine vapour forms crystals again on a cold glass.", "Violetter Ioddampf bildet an einem kalten Glas wieder Kristalle.") },
];

const fromTo = (c: Change) => [CHANGES[c].from, CHANGES[c].to] as const;

const AS_EN: Record<State, string> = { 0: "as a solid", 1: "as a liquid", 2: "as a gas" };
const AS_DE: Record<State, string> = { 0: "im festen Zustand", 1: "im flüssigen Zustand", 2: "im gasförmigen Zustand" };

/** What Blob says when the student named `wrong` instead of `right`. */
function changeSay(right: Change, wrong: Change): [Text, Text] {
  const [a, b] = fromTo(right);
  const [wa, wb] = fromTo(wrong);
  const W = CHANGES[wrong].name;
  if (REVERSE[right] === wrong) {
    return [
      tx("Wrong direction", "Falsche Richtung"),
      tx(
        `Other way round! **${capital(en(W))}** goes from ${stateEn(wa)} to ${stateEn(wb)}. Here the substance goes from ${stateEn(a)} to ${stateEn(b)}.`,
        `Genau andersherum! **${de(W)}** geht von ${stateDe(wa)} nach ${stateDe(wb)}. Hier geht der Stoff von ${stateDe(a)} nach ${stateDe(b)}.`,
      ),
    ];
  }
  if (wa === a) {
    return [
      tx("Different end state", "Anderer Endzustand"),
      tx(
        `Good start: **${en(W)}** begins ${AS_EN[a]} too. But it ends ${AS_EN[wb]}. What is the substance at the end here?`,
        `Guter Anfang: Auch **${de(W)}** beginnt ${AS_DE[a]}. Es endet aber ${AS_DE[wb]}. Wie liegt der Stoff hier am Ende vor?`,
      ),
    ];
  }
  if (wb === b) {
    return [
      tx("Different start state", "Anderer Anfangszustand"),
      tx(
        `**${capital(en(W))}** ends ${AS_EN[b]} too, right. But it starts ${AS_EN[wa]}. What is the substance at the start here?`,
        `**${de(W)}** endet auch ${AS_DE[b]}, stimmt. Es beginnt aber ${AS_DE[wa]}. Wie liegt der Stoff hier am Anfang vor?`,
      ),
    ];
  }
  return [
    tx("Another change", "Ein anderer Übergang"),
    tx(
      `**${capital(en(W))}** goes from ${stateEn(wa)} to ${stateEn(wb)}. What is the substance at the start here, and what at the end?`,
      `**${de(W)}** geht von ${stateDe(wa)} nach ${stateDe(wb)}. Wie liegt der Stoff hier am Anfang vor und wie am Ende?`,
    ),
  ];
}

/** Neighbours first: reverse, then changes sharing a start or end state. */
function confusable(c: Change): Change[] {
  const [a, b] = fromTo(c);
  const all = Object.keys(CHANGES) as Change[];
  return [REVERSE[c], ...all.filter((x) => x !== c && x !== REVERSE[c] && (CHANGES[x].from === a || CHANGES[x].to === b)), ...all.filter((x) => x !== c && x !== REVERSE[c] && CHANGES[x].from !== a && CHANGES[x].to !== b)];
}

function changeFrames(c: Change, start?: Text): Frame[] {
  const [a, b] = fromTo(c);
  const N = CHANGES[c].name;
  return [
    {
      math: tx(`"${stateEn(a)}"#a \\to#ar "${stateEn(b)}"#b`, `"${stateDe(a)}"#a \\to#ar "${stateDe(b)}"#b`),
      note: start ?? tx(`At the start the substance is **${stateEn(a)}**, at the end it is **${stateEn(b)}**.`, `Am Anfang ist der Stoff **${stateDe(a)}**, am Ende ist er **${stateDe(b)}**.`),
    },
    {
      math: tx(`"${stateEn(a)}"#a \\to#ar "${stateEn(b)}"#b \\quad "${en(N)}"#n`, `"${stateDe(a)}"#a \\to#ar "${stateDe(b)}"#b \\quad "${de(N)}"#n`),
      note: tx(`From ${stateEn(a)} to ${stateEn(b)}: that's **${en(N)}**.`, `Von ${stateDe(a)} nach ${stateDe(b)}: Das ist **${de(N)}**.`),
      highlight: ["n"],
    },
  ];
}

function changeWordTask(scene: Scene): Exercise {
  const c = scene.change;
  const answer: AnswerSpec = { kind: "word", accept: [...CHANGES[c].accept, ...(scene.extra ?? [])], placeholder: tx("name of the change", "Name des Übergangs") };
  const m = mistakes(answer);
  if (scene.notice) m.add({ kind: "word", accept: scene.notice.when }, scene.notice.title, scene.notice.say, true);
  for (const w of confusable(c).slice(0, 4)) {
    const [title, say] = changeSay(c, w);
    m.add({ kind: "word", accept: CHANGES[w].accept }, title, say);
  }
  return {
    instruction: tx("Name the change of state", "Benenne die Zustandsänderung"),
    text: scene.text,
    answer,
    hint: tx("What state is the substance in at the start, and what at the end?", "In welchem Aggregatzustand ist der Stoff am Anfang, in welchem am Ende?"),
    solution: changeFrames(c),
    mistakes: m.list.slice(0, 5),
  };
}

const arrowText = (c: Change): Text => {
  const [a, b] = fromTo(c);
  return tx(`${stateEn(a)} → ${stateEn(b)}`, `${stateDe(a)} → ${stateDe(b)}`);
};

/** "What happens in sublimation?" with from → to options. */
function changeMeaningTask(rng: Rng, c: Change): Exercise {
  const wrong = rng.shuffle(confusable(c).slice(0, 4)).slice(0, 3);
  if (!wrong.includes(REVERSE[c])) wrong[0] = REVERSE[c];
  const opts: Opt[] = [{ text: arrowText(c) }];
  for (const w of wrong) {
    const N = CHANGES[c].name;
    const W = CHANGES[w].name;
    opts.push({
      text: arrowText(w),
      title: REVERSE[c] === w ? tx("Wrong direction", "Falsche Richtung") : tx("Another change", "Ein anderer Übergang"),
      say:
        REVERSE[c] === w
          ? tx(`That's the reverse: **${en(W)}**. ${en(N)} goes exactly the other way.`, `Das ist die Umkehrung: **${de(W)}**. ${de(N)} geht genau andersherum.`)
          : tx(`That one is **${en(W)}**. Think about what ${en(N)} starts with and ends with.`, `Das ist **${de(W)}**. Überleg, womit das ${de(N)} anfängt und womit es endet.`),
    });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  const N = CHANGES[c].name;
  return {
    instruction: tx("Changes of state", "Zustandsänderungen"),
    text: tx(`What happens during **${en(N).toLowerCase()}**?`, `Was passiert beim **${de(N)}**?`),
    answer,
    hint: tx(
      "Melting, boiling and sublimation need heat. Their reverse changes happen when the substance cools down.",
      "Schmelzen, Verdampfen und Sublimieren brauchen Wärme. Ihre Umkehrungen passieren, wenn der Stoff abkühlt.",
    ),
    solution: changeFrames(c),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The state at a given temperature

const anyNegative = (...v: number[]) => v.some((x) => x < 0);

/** Blob's notes for each wrong state, worked out for this substance and temperature. */
function stateMistakes(s: Pick<Substance, "mp" | "bp">, T: number, answer: AnswerSpec): Mistake[] {
  const right = stateAt(s, T);
  const m = mistakes(answer);
  const minus = anyNegative(T, s.mp, s.bp);
  const minusEn = minus ? " Careful with minus temperatures: the bigger the number after the minus, the colder." : "";
  const minusDe = minus ? " Vorsicht bei Minusgraden: Je größer die Zahl nach dem Minus, desto kälter." : "";
  const pick = (st: State): AnswerSpec => ({ kind: "choice", options: STATE_OPTIONS, correct: st });
  if (right === 1) {
    m.add(
      pick(2),
      tx("Above m.p. means liquid", "Über der Smt. heißt flüssig"),
      tx(
        `${degEn(T)} is above the melting temperature (${degEn(s.mp)}), right. But that makes it **liquid** first. It only turns into a gas above the boiling temperature (${degEn(s.bp)}).`,
        `${degDe(T)} liegt über der Schmelztemperatur (${degDe(s.mp)}), stimmt. Dann ist der Stoff aber erst mal **flüssig**. Gasförmig wird er erst über der Siedetemperatur (${degDe(s.bp)}).`,
      ),
    );
    m.add(
      pick(0),
      minus ? tx("Minus temperatures", "Minusgrade") : tx("Already melted", "Schon geschmolzen"),
      tx(
        `Solid would need a temperature below the melting temperature (${degEn(s.mp)}). Is ${degEn(T)} really colder than that?${minusEn}`,
        `Fest wäre der Stoff nur unterhalb der Schmelztemperatur (${degDe(s.mp)}). Ist ${degDe(T)} wirklich kälter?${minusDe}`,
      ),
    );
  } else if (right === 0) {
    m.add(
      pick(1),
      minus ? tx("Minus temperatures", "Minusgrade") : tx("Not melted yet", "Noch nicht geschmolzen"),
      tx(
        `Liquid would mean warmer than the melting temperature (${degEn(s.mp)}). Compare ${degEn(T)} with it once more.${minusEn}`,
        `Flüssig hieße: wärmer als die Schmelztemperatur (${degDe(s.mp)}). Vergleich ${degDe(T)} noch mal damit.${minusDe}`,
      ),
    );
    m.add(
      pick(2),
      tx("Far from boiling", "Weit weg vom Sieden"),
      tx(
        `A gas would need more than the boiling temperature (${degEn(s.bp)}). At ${degEn(T)} the substance hasn't even melted.${minusEn}`,
        `Gasförmig wäre der Stoff erst über der Siedetemperatur (${degDe(s.bp)}). Bei ${degDe(T)} ist er noch nicht mal geschmolzen.${minusDe}`,
      ),
    );
  } else {
    m.add(
      pick(1),
      minus ? tx("Minus temperatures", "Minusgrade") : tx("Already boiled", "Schon gesiedet"),
      tx(
        `Liquid means between ${degEn(s.mp)} and ${degEn(s.bp)}. Is ${degEn(T)} really below the boiling temperature?${minusEn}`,
        `Flüssig heißt: zwischen ${degDe(s.mp)} und ${degDe(s.bp)}. Liegt ${degDe(T)} wirklich unter der Siedetemperatur?${minusDe}`,
      ),
    );
    m.add(
      pick(0),
      tx("Way above melting", "Weit über dem Schmelzen"),
      tx(
        `Solid would need less than ${degEn(s.mp)}. ${degEn(T)} is even above the boiling temperature.`,
        `Fest wäre der Stoff nur unter ${degDe(s.mp)}. ${degDe(T)} liegt sogar über der Siedetemperatur.`,
      ),
    );
  }
  return m.list;
}

/** Worked solution: m.p. and b.p., then where T lies, then the state. */
function stateFrames(name: Text, s: Pick<Substance, "mp" | "bp">, T: number): Frame[] {
  const right = stateAt(s, T);
  const mp = `${dnum(s.mp, "m")} "°C"#mu`;
  const bp = `${dnum(s.bp, "b")} "°C"#bu`;
  const t = `${dnum(T, "t")} "°C"#tu`;
  const where =
    right === 0 ? `${t} <#l1 ${mp}` : right === 1 ? `${mp} <#l1 ${t} <#l2 ${bp}` : `${bp} <#l2 ${t}`;
  const whereNote: Text =
    right === 0
      ? tx(`${degEn(T)} is colder than the melting temperature.`, `${degDe(T)} ist kälter als die Schmelztemperatur.`)
      : right === 1
        ? tx(`${degEn(T)} lies between the melting and the boiling temperature.`, `${degDe(T)} liegt zwischen Schmelz- und Siedetemperatur.`)
        : tx(`${degEn(T)} is hotter than the boiling temperature.`, `${degDe(T)} ist heißer als die Siedetemperatur.`);
  const why: Text =
    right === 0
      ? tx("Below the melting temperature a substance is **solid**.", "Unterhalb der Schmelztemperatur ist ein Stoff **fest**.")
      : right === 1
        ? tx("Melted, but not boiled yet: **liquid**.", "Geschmolzen, aber noch nicht gesiedet: **flüssig**.")
        : tx("Above the boiling temperature a substance is a **gas**.", "Oberhalb der Siedetemperatur ist ein Stoff **gasförmig**.");
  return [
    {
      math: tx(`"m.p."#lm =#e1 ${mp} \\quad "b.p."#lb =#e2 ${bp}`, `"Smt."#lm =#e1 ${mp} \\quad "Sdt."#lb =#e2 ${bp}`),
      note: tx(`Look up the two temperatures of ${en(name)}.`, `Schau die beiden Temperaturen von ${de(name)} nach.`),
    },
    { math: where, note: whereNote },
    { math: tx(`${where} \\Rightarrow#r "${stateEn(right)}"#s`, `${where} \\Rightarrow#r "${stateDe(right)}"#s`), note: why, highlight: ["s"] },
  ];
}

const STATE_HINT = tx(
  "Below the melting temperature: solid. Between melting and boiling temperature: liquid. Above the boiling temperature: gas.",
  "Unter der Schmelztemperatur: fest. Zwischen Schmelz- und Siedetemperatur: flüssig. Über der Siedetemperatur: gasförmig.",
);

function stateTask(sub: Substance, T: number, opts: { scale?: boolean } = {}): Exercise {
  const answer: AnswerSpec = { kind: "choice", options: STATE_OPTIONS, correct: stateAt(sub, T) };
  return {
    instruction: tx("Which state?", "Welcher Aggregatzustand?"),
    text: tx(
      `${capital(en(sub.name))} melts at ${degEn(sub.mp)} and boils at ${degEn(sub.bp)}. What state is it in at **${degEn(T)}**?`,
      `${de(sub.name)} schmilzt bei ${degDe(sub.mp)} und siedet bei ${degDe(sub.bp)}. In welchem Aggregatzustand ist ${dePronoun(sub)} bei **${degDe(T)}**?`,
    ),
    ...(opts.scale === false ? {} : { visual: visual(ParticlesScale, { name: sub.name, mp: sub.mp, bp: sub.bp, at: T }) }),
    answer,
    hint: STATE_HINT,
    solution: stateFrames(sub.name, sub, T),
    mistakes: stateMistakes(sub, T, answer),
  };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nice temperatures (whole tens, a few everyday ones) inside one state's range. */
function niceTemp(rng: Rng, s: Pick<Substance, "mp" | "bp">, state: State): number | null {
  const span = Math.max(30, s.bp - s.mp);
  const lo = state === 0 ? Math.max(-270, s.mp - Math.max(60, span * 0.6)) : state === 1 ? s.mp : s.bp;
  const hi = state === 0 ? s.mp : state === 1 ? s.bp : s.bp + Math.max(60, span * 0.6);
  const out: number[] = [];
  for (const step of [10, 5]) {
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v > lo && v < hi && v >= -270 && !out.includes(v)) out.push(v);
    if (out.length >= 3) break;
  }
  for (const v of [20, 25, 37, -18]) if (v > lo && v < hi && !out.includes(v)) out.push(v, v);
  return out.length ? rng.pick(out) : null;
}

// ---------------------------------------------------------------------------
// Concept questions (choice), each with Blob's notes for the tempting wrong options

type Concept = { instruction: Text; text: Text; opts: Opt[]; hint: Text; frames: Frame[]; picture?: "syringes" };

const SOLID_MOVES: Concept = {
  instruction: tx("Particles in a solid", "Teilchen im Feststoff"),
  text: tx("What do the particles in a solid do?", "Was machen die Teilchen in einem Feststoff?"),
  opts: [
    { text: tx("They vibrate back and forth in their places.", "Sie schwingen auf ihren Plätzen hin und her.") },
    {
      text: tx("They are completely still.", "Sie stehen völlig still."),
      title: tx("Particles never rest", "Teilchen ruhen nie"),
      say: tx("Ooh, classic trap! Particles are **always** moving, even in a solid. They just can't leave their places.", "Die klassische Falle! Teilchen bewegen sich **immer**, auch in einem Feststoff. Sie können nur ihre Plätze nicht verlassen."),
    },
    {
      text: tx("They fly freely through the whole space.", "Sie bewegen sich frei durch den ganzen Raum."),
      title: tx("That's a gas", "Das ist ein Gas"),
      say: tx("That's what gas particles do. In a solid the particles are held in fixed places.", "So machen es Gasteilchen. In einem Feststoff sind die Teilchen an feste Plätze gebunden."),
    },
    {
      text: tx("They slide past each other.", "Sie gleiten aneinander vorbei."),
      title: tx("That's a liquid", "Das ist eine Flüssigkeit"),
      say: tx("Sliding past each other is what happens in a liquid. A solid keeps its shape because its particles stay in place.", "Aneinander vorbeigleiten tun die Teilchen in einer Flüssigkeit. Ein Feststoff behält seine Form, weil seine Teilchen an ihren Plätzen bleiben."),
    },
  ],
  hint: tx("A solid keeps its shape. But are its particles really at rest?", "Ein Feststoff behält seine Form. Aber sind seine Teilchen wirklich in Ruhe?"),
  frames: [
    { math: tx('"solid:" \\quad "fixed places"#p', '"fest:" \\quad "feste Plätze"#p'), note: tx("In a solid every particle has its fixed place in the lattice.", "Im Feststoff hat jedes Teilchen seinen festen Platz im Gitter.") },
    {
      math: tx('"solid:" \\quad "fixed places"#p + "vibrating"#v', '"fest:" \\quad "feste Plätze"#p + "schwingen"#v'),
      note: tx("But it is never still: it **vibrates** in its place. The warmer, the stronger.", "Aber es steht nie still: Es **schwingt** auf seinem Platz. Je wärmer, desto stärker."),
      highlight: ["v"],
    },
  ],
};

const BETWEEN: Concept = {
  instruction: tx("The particle model", "Das Teilchenmodell"),
  text: tx("What is between the particles of a gas?", "Was ist zwischen den Teilchen eines Gases?"),
  opts: [
    { text: tx("Nothing: empty space.", "Nichts: leerer Raum.") },
    {
      text: tx("Air", "Luft"),
      title: tx("Air is particles too", "Luft sind auch Teilchen"),
      say: tx("Air is itself made of particles! So between the particles there can't be air. There's simply nothing.", "Luft besteht selbst aus Teilchen! Zwischen den Teilchen kann also keine Luft sein. Da ist einfach nichts."),
    },
    {
      text: tx("Water vapour", "Wasserdampf"),
      title: tx("Vapour is particles too", "Dampf sind auch Teilchen"),
      say: tx("Water vapour is made of water particles. Between any particles there is nothing at all.", "Wasserdampf besteht aus Wasserteilchen. Zwischen den Teilchen ist gar nichts."),
    },
    {
      text: tx("Even smaller particles of the gas", "Noch kleinere Teilchen des Gases"),
      title: tx("Same particles", "Gleiche Teilchen"),
      say: tx("All particles of a pure substance are the same. There are no smaller ones filling the gaps: the gaps are empty.", "Alle Teilchen eines Reinstoffs sind gleich. Es gibt keine kleineren, die die Lücken füllen: Die Lücken sind leer."),
    },
  ],
  hint: tx("Air itself is a gas made of particles.", "Luft ist selbst ein Gas aus Teilchen."),
  frames: [
    { math: tx('"particle"#a \\quad "?"#q \\quad "particle"#b', '"Teilchen"#a \\quad "?"#q \\quad "Teilchen"#b'), note: tx("What fills the space between two gas particles?", "Was füllt den Raum zwischen zwei Gasteilchen?") },
    { math: tx('"particle"#a \\quad "nothing"#q \\quad "particle"#b', '"Teilchen"#a \\quad "nichts"#q \\quad "Teilchen"#b'), note: tx("Nothing at all: empty space (a vacuum). Even air is just particles with empty space between them.", "Gar nichts: leerer Raum (Vakuum). Auch Luft ist nur Teilchen mit leerem Raum dazwischen."), highlight: ["q"] },
  ],
};

function propertyConcept(state: State): Concept {
  const q: Record<State, Text> = {
    0: tx("Which state has a fixed shape **and** a fixed volume?", "Welcher Aggregatzustand hat eine feste Form **und** ein festes Volumen?"),
    1: tx("Which state has a fixed volume, but takes the shape of its container?", "Welcher Aggregatzustand hat ein festes Volumen, nimmt aber die Form seines Gefäßes an?"),
    2: tx("Which state fills any container completely, whatever its size?", "Welcher Aggregatzustand füllt jedes Gefäß vollständig aus, egal wie groß?"),
  };
  const why: Record<State, Text> = {
    0: tx("The particles are held in fixed places: shape and volume stay.", "Die Teilchen sitzen an festen Plätzen: Form und Volumen bleiben."),
    1: tx("The particles stay close (fixed volume) but can slide (shape changes).", "Die Teilchen bleiben dicht beieinander (festes Volumen), können aber gleiten (Form ändert sich)."),
    2: tx("The particles fly freely until they hit a wall: they fill everything.", "Die Teilchen fliegen frei, bis sie an eine Wand stoßen: Sie füllen alles aus."),
  };
  const wrongPick: Record<State, Text> = {
    0: tx("In a solid the particles sit in fixed places, so it keeps its own shape. Does that fit the question?", "Im Feststoff sitzen die Teilchen an festen Plätzen, deshalb behält er seine eigene Form. Passt das zur Frage?"),
    1: tx("A liquid keeps its volume, but takes the shape of its container. Does that fit the question?", "Eine Flüssigkeit behält ihr Volumen, passt ihre Form aber dem Gefäß an. Passt das zur Frage?"),
    2: tx("A gas has neither a fixed shape nor a fixed volume: its particles fly until they hit a wall. Does that fit the question?", "Ein Gas hat weder eine feste Form noch ein festes Volumen: Seine Teilchen fliegen, bis sie an eine Wand stoßen. Passt das zur Frage?"),
  };
  const say = (s: State): Opt => ({ text: STATE_NAMES[s], title: tx("Shape and volume", "Form und Volumen"), say: wrongPick[s] });
  return {
    instruction: tx("States of matter", "Aggregatzustände"),
    text: q[state],
    opts: [{ text: STATE_NAMES[state] }, ...([0, 1, 2] as State[]).filter((s) => s !== state).map(say)],
    hint: tx("Think about what the particles do in each state.", "Überleg, was die Teilchen in jedem Aggregatzustand tun."),
    frames: [{ math: tx(`"${stateEn(state)}"#s`, `"${stateDe(state)}"#s`), note: why[state] }],
  };
}

const SPEED: Concept = {
  instruction: tx("Temperature and particles", "Temperatur und Teilchen"),
  text: tx("What decides how fast the particles of a substance move?", "Wovon hängt ab, wie schnell sich die Teilchen eines Stoffs bewegen?"),
  opts: [
    { text: tx("The temperature", "Von der Temperatur") },
    {
      text: tx("The size of the container", "Von der Größe des Gefäßes"),
      title: tx("Room isn't speed", "Platz ist nicht Tempo"),
      say: tx("A bigger container gives gas particles more room, but it doesn't make them faster. What does?", "Ein größeres Gefäß gibt Gasteilchen mehr Platz, macht sie aber nicht schneller. Was dann?"),
    },
    {
      text: tx("How much of the substance there is", "Davon, wie viel Stoff da ist"),
      title: tx("Amount isn't speed", "Menge ist nicht Tempo"),
      say: tx("A bucket of water and a cup of water at the same temperature: their particles are just as fast.", "Ein Eimer Wasser und eine Tasse Wasser mit derselben Temperatur: Ihre Teilchen sind gleich schnell."),
    },
    {
      text: tx("The colour of the substance", "Von der Farbe des Stoffs"),
      title: tx("Particles have no colour", "Teilchen haben keine Farbe"),
      say: tx("A single particle has no colour at all. Colour only appears when lots of particles come together.", "Ein einzelnes Teilchen hat gar keine Farbe. Farbe entsteht erst, wenn sehr viele Teilchen zusammenkommen."),
    },
  ],
  hint: tx("Remember the box you heated: what did the slider change?", "Denk an die Box, die du erhitzt hast: Was hat der Regler verändert?"),
  frames: [
    { math: tx('"warmer"#w \\Rightarrow "faster particles"#f', '"wärmer"#w \\Rightarrow "schnellere Teilchen"#f'), note: tx("Temperature is a measure of how fast the particles move.", "Die Temperatur ist ein Maß dafür, wie schnell sich die Teilchen bewegen.") },
  ],
};

const MELT_CHANGE: Concept = {
  instruction: tx("Melting in the particle model", "Schmelzen im Teilchenmodell"),
  text: tx("Ice melts. What changes for its particles?", "Eis schmilzt. Was ändert sich dabei für seine Teilchen?"),
  opts: [
    { text: tx("Their arrangement and their movement", "Ihre Anordnung und ihre Bewegung") },
    {
      text: tx("They turn into new particles.", "Sie werden zu neuen Teilchen."),
      title: tx("Still water particles", "Immer noch Wasserteilchen"),
      say: tx("Melting doesn't make a new substance: ice and liquid water are made of the very same water particles.", "Beim Schmelzen entsteht kein neuer Stoff: Eis und flüssiges Wasser bestehen aus genau denselben Wasserteilchen."),
    },
    {
      text: tx("They get bigger.", "Sie werden größer."),
      title: tx("Particles don't grow", "Teilchen wachsen nicht"),
      say: tx("Ooh, classic myth! The particles keep their size. Only their order and their movement change.", "Ein klassischer Irrtum! Die Teilchen behalten ihre Größe. Nur ihre Ordnung und ihre Bewegung ändern sich."),
    },
    {
      text: tx("They melt themselves and go soft.", "Sie schmelzen selbst und werden weich."),
      title: tx("Particles don't melt", "Teilchen schmelzen nicht"),
      say: tx("A single particle can't melt or go soft. Melting only describes what the whole substance does when its particles leave their lattice.", "Ein einzelnes Teilchen kann nicht schmelzen oder weich werden. Schmelzen beschreibt nur, was der ganze Stoff tut, wenn seine Teilchen das Gitter verlassen."),
    },
  ],
  hint: tx("Is liquid water still water? Then what can have changed?", "Ist flüssiges Wasser noch Wasser? Was kann sich dann geändert haben?"),
  frames: [
    { math: "\\ce{H2O(s)} \\to \\ce{H2O(l)}", note: tx("Same particles before and after: water. No new substance.", "Vorher und nachher dieselben Teilchen: Wasser. Kein neuer Stoff.") },
    { math: tx('"lattice"#a \\to "jumbled, sliding"#b', '"Gitter"#a \\to "ungeordnet, gleitend"#b'), note: tx("Only the arrangement and the movement change.", "Nur Anordnung und Bewegung ändern sich.") },
  ],
};

const TEA: Concept = {
  instruction: tx("How substances mix", "Wie sich Stoffe mischen"),
  text: tx(
    "You put one tea bag into cold water and one into hot water. Where does the colour spread faster, and why?",
    "Du hängst einen Teebeutel in kaltes und einen in heißes Wasser. Wo verteilt sich die Farbe schneller und warum?",
  ),
  opts: [
    { text: tx("In the hot water, because the particles move faster there.", "Im heißen Wasser, weil sich die Teilchen dort schneller bewegen.") },
    {
      text: tx("In the hot water, because the particles are bigger there.", "Im heißen Wasser, weil die Teilchen dort größer sind."),
      title: tx("Particles don't grow", "Teilchen wachsen nicht"),
      say: tx("Right place, wrong reason! Heat doesn't make particles bigger. It makes them faster.", "Richtiger Ort, falscher Grund! Wärme macht Teilchen nicht größer, sondern schneller."),
    },
    {
      text: tx("In the cold water, because cold particles are heavier.", "Im kalten Wasser, weil kalte Teilchen schwerer sind."),
      title: tx("Cold means slow", "Kalt heißt langsam"),
      say: tx("Cold particles aren't heavier, they're **slower**. So in cold water everything mixes more slowly.", "Kalte Teilchen sind nicht schwerer, sondern **langsamer**. Im kalten Wasser mischt sich deshalb alles langsamer."),
    },
    {
      text: tx("Equally fast, because they are the same particles.", "Gleich schnell, weil es dieselben Teilchen sind."),
      title: tx("Temperature matters", "Die Temperatur zählt"),
      say: tx("Same particles, yes. But the temperature decides how fast they move, and that decides how fast they mix.", "Dieselben Teilchen, stimmt. Aber die Temperatur bestimmt, wie schnell sie sich bewegen, und davon hängt ab, wie schnell sie sich mischen."),
    },
  ],
  hint: tx("The colour spreads by itself because the particles move. What changes their speed?", "Die Farbe verteilt sich von selbst, weil sich die Teilchen bewegen. Was ändert ihr Tempo?"),
  frames: [
    { math: tx('"hot"#h \\Rightarrow "faster particles"#f \\Rightarrow "faster diffusion"#d', '"heiß"#h \\Rightarrow "schnellere Teilchen"#f \\Rightarrow "schnellere Diffusion"#d'), note: tx("Particles mix by themselves: **diffusion**. The hotter, the faster.", "Teilchen mischen sich von selbst: **Diffusion**. Je heißer, desto schneller.") },
  ],
};

const SYRINGE: Concept = {
  instruction: tx("Compressing gases", "Gase zusammendrücken"),
  text: tx("You can push the piston of a syringe full of air quite far in. With water it hardly moves. Why?", "Den Kolben einer Spritze voll Luft kannst du ein gutes Stück hineindrücken. Mit Wasser bewegt er sich kaum. Warum?"),
  picture: "syringes",
  opts: [
    { text: tx("The air particles are far apart, so they can move closer together.", "Die Luftteilchen sind weit voneinander entfernt und können näher zusammenrücken.") },
    {
      text: tx("Air particles are softer than water particles.", "Luftteilchen sind weicher als Wasserteilchen."),
      title: tx("Particles aren't squashy", "Teilchen sind nicht weich"),
      say: tx("Particles don't get squashed. What gets smaller when you push is the empty space **between** them.", "Teilchen werden nicht zerquetscht. Beim Drücken wird der leere Raum **zwischen** ihnen kleiner."),
    },
    {
      text: tx("Air particles are smaller than water particles.", "Luftteilchen sind kleiner als Wasserteilchen."),
      title: tx("It's the gaps", "Es liegt an den Lücken"),
      say: tx("The size of the particles isn't the point. Look at the gaps: in air they're huge, in water the particles already touch.", "Auf die Größe der Teilchen kommt es nicht an. Schau auf die Lücken: In Luft sind sie riesig, im Wasser berühren sich die Teilchen schon."),
    },
    {
      text: tx("Some air particles disappear when you push.", "Beim Drücken verschwinden einige Luftteilchen."),
      title: tx("No particle disappears", "Kein Teilchen verschwindet"),
      say: tx("All the particles are still there. They just get less room.", "Alle Teilchen sind noch da. Sie haben nur weniger Platz."),
    },
  ],
  hint: tx("Look at the distances between the particles in the two syringes.", "Schau dir die Abstände zwischen den Teilchen in den beiden Spritzen an."),
  frames: [
    { math: tx('"gas:" \\quad "large gaps"#g', '"Gas:" \\quad "große Lücken"#g'), note: tx("Between gas particles there's lots of empty space.", "Zwischen Gasteilchen ist viel leerer Raum.") },
    { math: tx('"gas:" \\quad "large gaps"#g \\Rightarrow "compressible"#c', '"Gas:" \\quad "große Lücken"#g \\Rightarrow "komprimierbar"#c'), note: tx("Push, and the particles move closer: a gas can be compressed. A liquid hardly at all.", "Drückst du, rücken die Teilchen zusammen: Ein Gas lässt sich zusammendrücken. Eine Flüssigkeit kaum.") },
  ],
};

const PERFUME: Concept = {
  instruction: tx("How substances mix", "Wie sich Stoffe mischen"),
  text: tx("Someone opens a bottle of perfume in one corner of the room. Soon you can smell it in the other corner, without any draught. Why?", "Jemand öffnet in einer Ecke des Zimmers eine Parfümflasche. Bald riechst du es auch in der anderen Ecke, ganz ohne Luftzug. Warum?"),
  opts: [
    { text: tx("The scent particles move on their own and spread out (diffusion).", "Die Duftteilchen bewegen sich von selbst und verteilen sich (Diffusion).") },
    {
      text: tx("The scent particles grow until they fill the room.", "Die Duftteilchen werden größer, bis sie das Zimmer füllen."),
      title: tx("Particles don't grow", "Teilchen wachsen nicht"),
      say: tx("Particles never grow. They spread out because they keep moving.", "Teilchen wachsen nie. Sie verteilen sich, weil sie sich ständig bewegen."),
    },
    {
      text: tx("The air particles stand still and only the scent moves.", "Die Luftteilchen stehen still, nur der Duft bewegt sich."),
      title: tx("Everything moves", "Alles bewegt sich"),
      say: tx("All particles are moving all the time, the air particles too. Scent and air particles bump around and mix.", "Alle Teilchen bewegen sich ständig, auch die Luftteilchen. Duft- und Luftteilchen stoßen herum und mischen sich."),
    },
    {
      text: tx("Scent particles are lighter than air, so they only rise.", "Duftteilchen sind leichter als Luft und steigen nur nach oben."),
      title: tx("In all directions", "In alle Richtungen"),
      say: tx("Then you'd only smell it at the ceiling! The particles move in **all** directions.", "Dann würdest du es nur an der Decke riechen! Die Teilchen bewegen sich in **alle** Richtungen."),
    },
  ],
  hint: tx("Nobody stirs the air. What makes the particles spread?", "Niemand rührt die Luft um. Was bringt die Teilchen dazu, sich zu verteilen?"),
  frames: [{ math: tx('"particles move"#a \\Rightarrow "they mix by themselves"#b', '"Teilchen bewegen sich"#a \\Rightarrow "sie mischen sich von selbst"#b'), note: tx("That's **diffusion**: substances mix because their particles move on their own.", "Das ist **Diffusion**: Stoffe mischen sich, weil sich ihre Teilchen von selbst bewegen.") }],
};

const BRIDGE: Concept = {
  instruction: tx("Expansion", "Wärmeausdehnung"),
  text: tx("Steel bridges have small gaps (expansion joints). In summer the bridge gets a little longer. Why?", "Stahlbrücken haben kleine Lücken (Dehnungsfugen). Im Sommer wird die Brücke ein bisschen länger. Warum?"),
  opts: [
    { text: tx("The particles vibrate more strongly and need more room.", "Die Teilchen schwingen stärker und brauchen mehr Platz.") },
    {
      text: tx("The particles get bigger in the heat.", "Die Teilchen werden in der Hitze größer."),
      title: tx("Particles don't grow", "Teilchen wachsen nicht"),
      say: tx("The classic myth! The particles stay the same size. They vibrate more, so the **distances** between them grow.", "Der klassische Irrtum! Die Teilchen bleiben gleich groß. Sie schwingen stärker, deshalb werden die **Abstände** größer."),
    },
    {
      text: tx("New particles are added in summer.", "Im Sommer kommen neue Teilchen dazu."),
      title: tx("Same number", "Gleich viele"),
      say: tx("No particles come or go. The same particles just take up more room.", "Es kommen keine Teilchen dazu und keine gehen weg. Dieselben Teilchen brauchen nur mehr Platz."),
    },
    {
      text: tx("The steel starts to melt a little.", "Der Stahl fängt ein bisschen an zu schmelzen."),
      title: tx("Far from melting", "Weit weg vom Schmelzen"),
      say: tx("Steel melts at well over 1000 °C. A summer day is nowhere near that. The bridge stays solid.", "Stahl schmilzt erst weit über 1000 °C. Davon ist ein Sommertag weit entfernt. Die Brücke bleibt fest."),
    },
  ],
  hint: tx("Warmer means the particles move more. What does that do to the distances?", "Wärmer heißt: Die Teilchen bewegen sich stärker. Was macht das mit den Abständen?"),
  frames: [{ math: tx('"warmer"#w \\Rightarrow "stronger vibration"#v \\Rightarrow "larger distances"#d', '"wärmer"#w \\Rightarrow "stärkeres Schwingen"#v \\Rightarrow "größere Abstände"#d'), note: tx("The particles stay the same. Only the distances grow: the steel expands.", "Die Teilchen bleiben gleich. Nur die Abstände werden größer: Der Stahl dehnt sich aus.") }],
};

const BALLOON: Concept = {
  instruction: tx("Gases and temperature", "Gase und Temperatur"),
  text: tx("A blown-up balloon goes into the freezer and gets smaller. Why?", "Ein aufgeblasener Luftballon kommt in die Gefriertruhe und wird kleiner. Warum?"),
  opts: [
    { text: tx("The air particles get slower and need less room.", "Die Luftteilchen werden langsamer und brauchen weniger Platz.") },
    {
      text: tx("The air particles shrink in the cold.", "Die Luftteilchen schrumpfen in der Kälte."),
      title: tx("Particles don't shrink", "Teilchen schrumpfen nicht"),
      say: tx("Particles keep their size, warm or cold. Cold makes them slower, so they need less room.", "Teilchen behalten ihre Größe, ob warm oder kalt. Kälte macht sie langsamer, deshalb brauchen sie weniger Platz."),
    },
    {
      text: tx("Some of the air particles freeze and disappear.", "Ein Teil der Luftteilchen erfriert und verschwindet."),
      title: tx("No particle disappears", "Kein Teilchen verschwindet"),
      say: tx("All the particles are still inside the balloon. They just move more slowly.", "Alle Teilchen sind noch im Ballon. Sie bewegen sich nur langsamer."),
    },
    {
      text: tx("The rubber skin pushes air out through the knot.", "Die Gummihaut drückt Luft durch den Knoten hinaus."),
      title: tx("Nothing escapes", "Nichts entweicht"),
      say: tx("Take it out again and it grows back! The air was inside all along. It's about the particles' speed.", "Nimm ihn wieder raus, und er wird wieder größer! Die Luft war die ganze Zeit drin. Es geht um das Tempo der Teilchen."),
    },
  ],
  hint: tx("What does cold do to the particles' movement?", "Was macht Kälte mit der Bewegung der Teilchen?"),
  frames: [{ math: tx('"colder"#c \\Rightarrow "slower particles"#s \\Rightarrow "less room"#r', '"kälter"#c \\Rightarrow "langsamere Teilchen"#s \\Rightarrow "weniger Platz"#r'), note: tx("Slower gas particles hit the balloon skin less hard and less often: the balloon shrinks.", "Langsamere Gasteilchen stoßen seltener und schwächer gegen die Ballonhaut: Der Ballon schrumpft.") }],
};

const PLATEAU: Concept = {
  instruction: tx("Heating curve", "Erhitzungskurve"),
  text: tx("While ice melts, the temperature stays at 0 °C, although the hotplate keeps heating. Where does the energy go?", "Während Eis schmilzt, bleibt die Temperatur bei 0 °C, obwohl die Herdplatte weiter heizt. Wo bleibt die Energie?"),
  opts: [
    { text: tx("It is needed to free the particles from their lattice.", "Sie wird gebraucht, um die Teilchen aus ihrem Gitter zu lösen.") },
    {
      text: tx("It is all lost to the air.", "Sie geht vollständig an die Luft verloren."),
      title: tx("Not lost", "Nicht verloren"),
      say: tx("A little goes into the air, sure, but most of it goes into the ice. It's used up breaking the particles out of their lattice.", "Ein bisschen geht an die Luft, klar, aber das meiste geht ins Eis. Es wird gebraucht, um die Teilchen aus dem Gitter zu lösen."),
    },
    {
      text: tx("The thermometer can't measure in ice water.", "Das Thermometer kann in Eiswasser nicht messen."),
      title: tx("The thermometer is right", "Das Thermometer stimmt"),
      say: tx("The thermometer works fine: the mixture really is at 0 °C until all the ice has melted.", "Das Thermometer funktioniert: Die Mischung hat wirklich 0 °C, bis alles Eis geschmolzen ist."),
    },
    {
      text: tx("The particles get smaller and need no energy.", "Die Teilchen werden kleiner und brauchen keine Energie."),
      title: tx("Particles don't shrink", "Teilchen schrumpfen nicht"),
      say: tx("Particles keep their size. Melting actually **needs** energy: the particles must be pulled out of their places.", "Teilchen behalten ihre Größe. Schmelzen **braucht** sogar Energie: Die Teilchen müssen aus ihren Plätzen gelöst werden."),
    },
  ],
  hint: tx("In a solid the particles hold each other in place. What does it take to break that?", "Im Feststoff halten sich die Teilchen gegenseitig fest. Was braucht es, um das zu lösen?"),
  frames: [
    { math: tx('0 "°C" \\quad "ice + water"#a', '0 "°C" \\quad "Eis + Wasser"#a'), note: tx("During melting the temperature stays the same: a **plateau** in the heating curve.", "Während des Schmelzens bleibt die Temperatur gleich: ein **Plateau** in der Erhitzungskurve.") },
    { math: tx('"energy"#e \\to "breaking up the lattice"#b', '"Energie"#e \\to "Gitter auflösen"#b'), note: tx("All the energy goes into freeing the particles. Only when everything has melted does the temperature rise again.", "Die ganze Energie löst die Teilchen voneinander. Erst wenn alles geschmolzen ist, steigt die Temperatur wieder.") },
  ],
};

const HOTPLATE: Concept = {
  instruction: tx("Boiling", "Sieden"),
  text: tx("Water is boiling on the stove. You turn the hotplate up. What happens to the temperature of the boiling water?", "Wasser siedet auf dem Herd. Du drehst die Herdplatte höher. Was passiert mit der Temperatur des siedenden Wassers?"),
  opts: [
    { text: tx("It stays at 100 °C; the water just boils away faster.", "Sie bleibt bei 100 °C, das Wasser verdampft nur schneller.") },
    {
      text: tx("It rises above 100 °C.", "Sie steigt über 100 °C."),
      title: tx("The plateau", "Das Plateau"),
      say: tx("That's the trap! While water boils, all the energy goes into turning liquid into vapour. The temperature stays at the boiling temperature.", "Das ist die Falle! Solange Wasser siedet, steckt die ganze Energie im Verdampfen. Die Temperatur bleibt bei der Siedetemperatur."),
    },
    {
      text: tx("It drops a little.", "Sie sinkt ein bisschen."),
      title: tx("It doesn't drop", "Sie sinkt nicht"),
      say: tx("More heat can't make the water colder. It stays at its boiling temperature while it boils.", "Mehr Wärme macht das Wasser nicht kälter. Es bleibt beim Sieden bei seiner Siedetemperatur."),
    },
    {
      text: tx("It rises until the water reaches 150 °C.", "Sie steigt, bis das Wasser 150 °C hat."),
      title: tx("No liquid water at 150 °C", "Kein flüssiges Wasser bei 150 °C"),
      say: tx("At normal pressure liquid water can't get hotter than 100 °C. Above that it's a gas.", "Bei Normaldruck kann flüssiges Wasser nicht heißer als 100 °C werden. Darüber ist es gasförmig."),
    },
  ],
  hint: tx("Remember the flat parts of the heating curve.", "Denk an die waagerechten Stücke der Erhitzungskurve."),
  frames: [{ math: tx('"boiling:" \\quad 100 "°C" = "constant"#c', '"Sieden:" \\quad 100 "°C" = "konstant"#c'), note: tx("More heat makes the water boil away faster, but the temperature stays at 100 °C until all of it has evaporated.", "Mehr Wärme lässt das Wasser schneller verdampfen, aber die Temperatur bleibt bei 100 °C, bis alles verdampft ist.") }],
};

const PUDDLE: Concept = {
  instruction: tx("Evaporation", "Verdunsten"),
  text: tx("A puddle dries up at 20 °C, far below the boiling temperature of water. How can water turn into a gas there?", "Eine Pfütze trocknet bei 20 °C, weit unter der Siedetemperatur von Wasser. Wie kann Wasser da gasförmig werden?"),
  opts: [
    { text: tx("Some fast particles at the surface break free.", "Einige schnelle Teilchen an der Oberfläche können sich lösen.") },
    {
      text: tx("The sun heats the puddle to 100 °C.", "Die Sonne erhitzt die Pfütze auf 100 °C."),
      title: tx("Not that hot", "So heiß wird es nicht"),
      say: tx("A puddle never gets that hot, and it still dries. Not all particles are equally fast: some are fast enough to escape.", "So heiß wird eine Pfütze nie, und sie trocknet trotzdem. Nicht alle Teilchen sind gleich schnell: Manche sind schnell genug, um zu entkommen."),
    },
    {
      text: tx("The water particles are split up by the sunlight.", "Die Wasserteilchen werden vom Sonnenlicht zerlegt."),
      title: tx("Still water", "Immer noch Wasser"),
      say: tx("The particles stay whole. As vapour they are still water particles, just far apart.", "Die Teilchen bleiben ganz. Als Dampf sind es immer noch Wasserteilchen, nur weit voneinander entfernt."),
    },
    {
      text: tx("The water seeps into the ground; nothing evaporates.", "Das Wasser versickert, es verdunstet nichts."),
      title: tx("It does evaporate", "Es verdunstet wirklich"),
      say: tx("A puddle on a plate dries too! The water really turns into vapour, just slowly.", "Auch eine Pfütze auf einem Teller trocknet! Das Wasser wird wirklich zu Dampf, nur langsam."),
    },
  ],
  hint: tx("Do all particles of a liquid move at exactly the same speed?", "Bewegen sich alle Teilchen einer Flüssigkeit genau gleich schnell?"),
  frames: [{ math: tx('"fast particle at the surface"#a \\to "gas"#b', '"schnelles Teilchen an der Oberfläche"#a \\to "Gas"#b'), note: tx("Some particles are faster than average. At the surface they can escape: **evaporation** (Verdunsten), below the boiling temperature.", "Manche Teilchen sind schneller als der Durchschnitt. An der Oberfläche können sie entkommen: **Verdunsten**, unterhalb der Siedetemperatur.") }],
};

function conceptTask(rng: Rng, c: Concept): Exercise {
  const { answer, mistakes: list } = choice(rng, c.opts);
  return {
    instruction: c.instruction,
    text: c.text,
    ...(c.picture === "syringes" ? { visual: visual(ParticlesSyringes, {}) } : {}),
    answer,
    hint: c.hint,
    solution: c.frames,
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Heating curves (an unknown substance with values on the grid)

type Curve = { mp: number; bp: number; start: number; end: number; times: number[]; points: CurvePoint[]; yMin: number; yMax: number; xMax: number };

function makeCurve(rng: Rng): Curve {
  const mp = rng.pick([-40, -20, 20, 40, 60, 80]);
  const bp = mp + rng.pick([60, 80, 100, 120]);
  const start = mp - rng.pick([20, 40]);
  const end = bp + 20;
  const d = [rng.int(1, 2), rng.int(2, 4), rng.int(2, 4), rng.int(3, 5), 1];
  const times = d.reduce<number[]>((acc, x) => [...acc, (acc[acc.length - 1] ?? 0) + x], []);
  const points: CurvePoint[] = [
    [0, start],
    [times[0], mp],
    [times[1], mp],
    [times[2], bp],
    [times[3], bp],
    [times[4], end],
  ];
  return { mp, bp, start, end, times, points, yMin: start, yMax: end, xMax: times[4] };
}

const chartOf = (c: Curve) => visual(HeatingChart, { points: c.points, yMin: c.yMin, yMax: c.yMax, yStep: 20, xMax: c.xMax, xStep: 1, className: "mx-auto max-w-[540px]" });

function curveTempTask(rng: Rng, ask: "mp" | "bp" | "freeze" | "condense"): Exercise {
  const c = makeCurve(rng);
  const value = ask === "mp" || ask === "freeze" ? c.mp : c.bp;
  const other = value === c.mp ? c.bp : c.mp;
  const answer: AnswerSpec = { kind: "number", value, unit: "°C" };
  const m = mistakes(answer);
  const q: Record<typeof ask, Text> = {
    mp: tx("Read off the **melting temperature** of substance X.", "Lies die **Schmelztemperatur** von Stoff X ab."),
    bp: tx("Read off the **boiling temperature** of substance X.", "Lies die **Siedetemperatur** von Stoff X ab."),
    freeze: tx("At which temperature would liquid substance X **freeze** when it cools down?", "Bei welcher Temperatur würde flüssiger Stoff X beim Abkühlen **erstarren**?"),
    condense: tx("At which temperature would gaseous substance X **condense** when it cools down?", "Bei welcher Temperatur würde gasförmiger Stoff X beim Abkühlen **kondensieren**?"),
  };
  if (ask === "mp" || ask === "bp") {
    m.add(
      { kind: "number", value: other },
      tx("The other plateau", "Das andere Plateau"),
      ask === "mp"
        ? tx("That's the second flat part, where X boils. Melting comes first, at the lower plateau.", "Das ist das zweite waagerechte Stück, dort siedet X. Das Schmelzen kommt zuerst, beim unteren Plateau.")
        : tx("That's the first flat part, where X melts. Boiling comes later, at the upper plateau.", "Das ist das erste waagerechte Stück, dort schmilzt X. Das Sieden kommt später, beim oberen Plateau."),
    );
  } else {
    m.add(
      { kind: "number", value: other },
      ask === "freeze" ? tx("Freezing = melting backwards", "Erstarren = Schmelzen rückwärts") : tx("Condensing = boiling backwards", "Kondensieren = Sieden rückwärts"),
      ask === "freeze"
        ? tx("That's where X boils. Freezing is melting backwards, so it happens at the **same** temperature as melting.", "Dort siedet X. Erstarren ist Schmelzen rückwärts, es passiert also bei **derselben** Temperatur wie das Schmelzen.")
        : tx("That's where X melts. Condensing is boiling backwards, so it happens at the **same** temperature as boiling.", "Dort schmilzt X. Kondensieren ist Sieden rückwärts, es passiert also bei **derselben** Temperatur wie das Sieden."),
    );
  }
  const plateauTime = value === c.mp ? c.times[0] : c.times[2];
  m.add(
    { kind: "number", value: plateauTime },
    tx("That's a time", "Das ist eine Zeit"),
    tx("That number is on the time axis (minutes). The temperature is on the vertical axis.", "Diese Zahl steht auf der Zeitachse (Minuten). Die Temperatur liest du an der senkrechten Achse ab."),
  );
  m.add(
    { kind: "number", value: c.start },
    tx("Start temperature", "Starttemperatur"),
    tx("That's where the curve starts. Look for the flat parts: there the substance changes its state.", "Dort beginnt die Kurve. Such die waagerechten Stücke: Dort ändert der Stoff seinen Aggregatzustand."),
  );
  const first = value === c.mp;
  return {
    instruction: tx("Read the heating curve", "Lies die Erhitzungskurve ab"),
    text: txMap((t, locale) => `${t("Substance X is heated evenly.", "Stoff X wird gleichmäßig erhitzt.")} ${resolveText(q[ask], locale)}`),
    visual: chartOf(c),
    answer,
    hint: first
      ? tx("Find the **first** flat part of the curve. Read its height on the temperature axis.", "Such das **erste** waagerechte Stück der Kurve. Lies seine Höhe an der Temperaturachse ab.")
      : tx("Find the **second** flat part of the curve. Read its height on the temperature axis.", "Such das **zweite** waagerechte Stück der Kurve. Lies seine Höhe an der Temperaturachse ab."),
    solution: [
      {
        math: tx(`"${first ? "1st" : "2nd"} plateau:"#p \\quad ${dnum(value, "v")} "°C"#u`, `"${first ? "1." : "2."} Plateau:"#p \\quad ${dnum(value, "v")} "°C"#u`),
        note: first
          ? tx("The temperature stays the same for a while: the substance melts. That's the first plateau.", "Die Temperatur bleibt eine Weile gleich: Der Stoff schmilzt. Das ist das erste Plateau.")
          : tx("The second time the temperature stays the same, the substance boils.", "Beim zweiten Mal, wenn die Temperatur gleich bleibt, siedet der Stoff."),
      },
      {
        math: tx(`"${first ? "m.p." : "b.p."}"#p = ${dnum(value, "v")} "°C"#u`, `"${first ? "Smt." : "Sdt."}"#p = ${dnum(value, "v")} "°C"#u`),
        note:
          ask === "freeze"
            ? tx("Freezing happens at the melting temperature, just in the other direction.", "Erstarren passiert bei der Schmelztemperatur, nur in die andere Richtung.")
            : ask === "condense"
              ? tx("Condensing happens at the boiling temperature, just in the other direction.", "Kondensieren passiert bei der Siedetemperatur, nur in die andere Richtung.")
              : first
                ? tx("So the melting temperature is the height of the first plateau.", "Die Schmelztemperatur ist also die Höhe des ersten Plateaus.")
                : tx("So the boiling temperature is the height of the second plateau.", "Die Siedetemperatur ist also die Höhe des zweiten Plateaus."),
      },
    ],
    mistakes: m.list,
  };
}

function curveDurationTask(rng: Rng, which: "melt" | "boil"): Exercise {
  const c = makeCurve(rng);
  const [a, b] = which === "melt" ? [c.times[0], c.times[1]] : [c.times[2], c.times[3]];
  const value = b - a;
  const answer: AnswerSpec = { kind: "number", value, unit: "min" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: b }, tx("End time, not duration", "Endzeit statt Dauer"), tx(`That's the moment the ${which === "melt" ? "melting" : "boiling"} **ends**. How long did it take since it started?`, `Das ist der Zeitpunkt, an dem das ${which === "melt" ? "Schmelzen" : "Sieden"} **endet**. Wie lange hat es seit dem Anfang gedauert?`), true);
  m.add({ kind: "number", value: a }, tx("Start time, not duration", "Startzeit statt Dauer"), tx(`That's when the ${which === "melt" ? "melting" : "boiling"} **starts**. You need the length of the flat part: end minus start.`, `Da **beginnt** das ${which === "melt" ? "Schmelzen" : "Sieden"}. Gesucht ist die Länge des waagerechten Stücks: Ende minus Anfang.`), true);
  const [oa, ob] = which === "melt" ? [c.times[2], c.times[3]] : [c.times[0], c.times[1]];
  m.add({ kind: "number", value: ob - oa }, tx("The other plateau", "Das andere Plateau"), which === "melt" ? tx("That's how long the **boiling** takes (the upper plateau). Melting is the lower one.", "So lange dauert das **Sieden** (oberes Plateau). Das Schmelzen ist das untere.") : tx("That's how long the **melting** takes (the lower plateau). Boiling is the upper one.", "So lange dauert das **Schmelzen** (unteres Plateau). Das Sieden ist das obere."));
  const T = which === "melt" ? c.mp : c.bp;
  return {
    instruction: tx("Read the heating curve", "Lies die Erhitzungskurve ab"),
    text: which === "melt" ? tx("Substance X is heated evenly. How many minutes does the **melting** take?", "Stoff X wird gleichmäßig erhitzt. Wie viele Minuten dauert das **Schmelzen**?") : tx("Substance X is heated evenly. How many minutes does the **boiling** take?", "Stoff X wird gleichmäßig erhitzt. Wie viele Minuten dauert das **Sieden**?"),
    visual: chartOf(c),
    answer,
    hint: tx("Find the flat part. Read where it starts and where it ends on the time axis.", "Such das waagerechte Stück. Lies auf der Zeitachse ab, wo es anfängt und wo es aufhört."),
    solution: [
      {
        math: tx(`"from"#f \\; ${a}#a "min" \\quad "to"#t \\; ${b}#b "min" \\quad "at"#at \\; ${dnum(T, "T")} "°C"`, `"von"#f \\; ${a}#a "min" \\quad "bis"#t \\; ${b}#b "min" \\quad "bei"#at \\; ${dnum(T, "T")} "°C"`),
        note: which === "melt" ? tx("The first plateau (melting) runs from here to here.", "Das erste Plateau (Schmelzen) reicht von hier bis hier.") : tx("The second plateau (boiling) runs from here to here.", "Das zweite Plateau (Sieden) reicht von hier bis hier."),
      },
      { math: `${b}#b "min" - ${a}#a "min" = ${value}#r "min"`, note: tx("Duration = end minus start.", "Dauer = Ende minus Anfang."), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Reading tables

function freezeTempTask(rng: Rng): Exercise {
  const sub = substance(rng.pick(["mercury", "ethanol", "bromine", "acetone", "methanol", "ammonia", "oxygen", "nitrogen", "propane", "iron", "lead", "sulfur", "acetic", "naphthalene"]));
  const ask = rng.pick(["freeze", "condense"] as const);
  const value = ask === "freeze" ? sub.mp : sub.bp;
  const other = ask === "freeze" ? sub.bp : sub.mp;
  const answer: AnswerSpec = { kind: "number", value, unit: "°C" };
  const m = mistakes(answer);
  m.add(
    { kind: "number", value: other },
    ask === "freeze" ? tx("Freezing = melting backwards", "Erstarren = Schmelzen rückwärts") : tx("Condensing = boiling backwards", "Kondensieren = Sieden rückwärts"),
    ask === "freeze"
      ? tx("That's the boiling temperature. Freezing is melting in reverse, so it happens at the **melting** temperature.", "Das ist die Siedetemperatur. Erstarren ist die Umkehrung vom Schmelzen, es passiert also bei der **Schmelztemperatur**.")
      : tx("That's the melting temperature. Condensing is boiling in reverse, so it happens at the **boiling** temperature.", "Das ist die Schmelztemperatur. Kondensieren ist die Umkehrung vom Sieden, es passiert also bei der **Siedetemperatur**."),
  );
  if (value < 0) {
    m.add(
      { kind: "number", value: value - 1 },
      tx("Just below", "Knapp darunter"),
      tx("Close! The change happens exactly **at** that temperature, not one degree past it.", "Knapp! Der Übergang passiert genau **bei** dieser Temperatur, nicht ein Grad danach."),
      true,
    );
  }
  return {
    instruction: tx("Changes of state", "Zustandsänderungen"),
    text:
      ask === "freeze"
        ? tx(
            `${capital(en(sub.name))} melts at ${degEn(sub.mp)} and boils at ${degEn(sub.bp)}. At which temperature does liquid ${en(sub.name)} **freeze** when it cools down?`,
            `${de(sub.name)} schmilzt bei ${degDe(sub.mp)} und siedet bei ${degDe(sub.bp)}. Bei welcher Temperatur **erstarrt** ${deAdj(sub, "flüssig")} ${de(sub.name)} beim Abkühlen?`,
          )
        : tx(
            `${capital(en(sub.name))} melts at ${degEn(sub.mp)} and boils at ${degEn(sub.bp)}. At which temperature does ${en(sub.name)} vapour **condense** when it cools down?`,
            `${de(sub.name)} schmilzt bei ${degDe(sub.mp)} und siedet bei ${degDe(sub.bp)}. Bei welcher Temperatur **kondensiert** ${deAdj(sub, "gasförmig")} ${de(sub.name)} beim Abkühlen?`,
          ),
    answer,
    hint:
      ask === "freeze"
        ? tx("Freezing is the reverse of melting. Reverse changes happen at the same temperature.", "Erstarren ist die Umkehrung vom Schmelzen. Umkehrungen passieren bei derselben Temperatur.")
        : tx("Condensing is the reverse of boiling. Reverse changes happen at the same temperature.", "Kondensieren ist die Umkehrung vom Sieden. Umkehrungen passieren bei derselben Temperatur."),
    solution: [
      {
        math: ask === "freeze" ? tx('"freezing"#a \\Leftrightarrow "melting"#b', '"Erstarren"#a \\Leftrightarrow "Schmelzen"#b') : tx('"condensing"#a \\Leftrightarrow "boiling"#b', '"Kondensieren"#a \\Leftrightarrow "Sieden"#b'),
        note: tx("A change and its reverse happen at the same temperature.", "Ein Übergang und seine Umkehrung passieren bei derselben Temperatur."),
      },
      {
        math: ask === "freeze" ? tx(`"freezing"#a : \\; ${dnum(value, "v")} "°C"#u`, `"Erstarren"#a : \\; ${dnum(value, "v")} "°C"#u`) : tx(`"condensing"#a : \\; ${dnum(value, "v")} "°C"#u`, `"Kondensieren"#a : \\; ${dnum(value, "v")} "°C"#u`),
        note: ask === "freeze" ? tx("So it freezes at its melting temperature.", "Der Stoff erstarrt also bei seiner Schmelztemperatur.") : tx("So it condenses at its boiling temperature.", "Der Stoff kondensiert also bei seiner Siedetemperatur."),
      },
    ],
    mistakes: m.list,
  };
}

/** How many degrees wide is the liquid range? */
function liquidRangeTask(rng: Rng): Exercise {
  const sub = substance(rng.pick(["ethanol", "mercury", "bromine", "acetone", "methanol", "ammonia", "oxygen", "nitrogen", "propane", "hydrogen"]));
  const value = sub.bp - sub.mp;
  const answer: AnswerSpec = { kind: "number", value, unit: tx("degrees", "Grad") };
  const m = mistakes(answer);
  const ignore = Math.abs(Math.abs(sub.bp) - Math.abs(sub.mp));
  m.add(
    { kind: "number", value: ignore },
    tx("The minus got lost", "Das Minus ist verloren gegangen"),
    tx(
      `I think you subtracted the numbers without their minus signs. From ${degEn(sub.mp)} up to ${degEn(sub.bp)}: ${sub.bp >= 0 ? "first up to 0 °C, then on from there" : "count the steps on the thermometer"}.`,
      `Ich glaub, du hast die Zahlen ohne ihr Minus abgezogen. Von ${degDe(sub.mp)} hoch bis ${degDe(sub.bp)}: ${sub.bp >= 0 ? "erst bis 0 °C, dann weiter" : "zähl die Schritte auf dem Thermometer"}.`,
    ),
  );
  m.add(
    { kind: "number", value: sub.bp + sub.mp },
    tx("Added instead of subtracted", "Addiert statt subtrahiert"),
    tx("You need the **difference**: upper temperature minus lower temperature, and the minus of a negative number turns into a plus.", "Gesucht ist der **Unterschied**: obere Temperatur minus untere, und minus eine negative Zahl wird zu plus."),
  );
  m.add({ kind: "number", value: -value }, tx("Upside down", "Verkehrt herum"), tx("Nearly! Subtract the lower temperature from the higher one, then the difference is positive.", "Fast! Zieh die niedrigere Temperatur von der höheren ab, dann ist der Unterschied positiv."), true);
  return {
    instruction: tx("Liquid range", "Flüssigkeitsbereich"),
    text: tx(
      `${capital(en(sub.name))} melts at ${degEn(sub.mp)} and boils at ${degEn(sub.bp)}. In between it is liquid. How many degrees wide is this range?`,
      `${de(sub.name)} schmilzt bei ${degDe(sub.mp)} und siedet bei ${degDe(sub.bp)}. Dazwischen ist ${dePronoun(sub)} flüssig. Wie viele Grad umfasst dieser Bereich?`,
    ),
    visual: visual(ParticlesScale, { name: sub.name, mp: sub.mp, bp: sub.bp }),
    answer,
    hint: tx("Boiling temperature minus melting temperature. Careful with the minus signs!", "Siedetemperatur minus Schmelztemperatur. Vorsicht mit den Minuszeichen!"),
    solution: [
      { math: tx(`"b.p."#b - "m.p."#m`, `"Sdt."#b - "Smt."#m`), note: tx("The width of the liquid range is the difference of the two temperatures.", "Die Breite des Flüssigkeitsbereichs ist der Unterschied der beiden Temperaturen.") },
      { math: `${sub.bp < 0 ? `(${dnum(sub.bp, "bv")})` : dnum(sub.bp, "bv")} - (${dnum(sub.mp, "mv")})`, note: tx("Put in the values. The melting temperature is negative, so keep the bracket.", "Setz die Werte ein. Die Schmelztemperatur ist negativ, also bleibt die Klammer.") },
      { math: `${sub.bp < 0 ? `(${dnum(sub.bp, "bv")})` : dnum(sub.bp, "bv")} + ${-sub.mp}#mv = ${value}#r`, note: tx(`Minus a negative number means plus: the range is **${value}** degrees wide.`, `Minus eine negative Zahl heißt plus: Der Bereich ist **${value}** Grad breit.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

/** Pick `k` substances (shuffled) that have no melting/boiling temperature exactly at T. */
function tableRows(rng: Rng, k: number, T: number, pool: string[]): Substance[] {
  return rng
    .shuffle(pool)
    .map(substance)
    .filter((s) => s.mp !== T && s.bp !== T)
    .slice(0, k);
}

const TABLE_POOL = ["water", "ethanol", "mercury", "oxygen", "nitrogen", "bromine", "iron", "lead", "sulfur", "ammonia", "acetone", "acetic", "propane", "naphthalene", "salt", "sodium", "methanol", "tin"];

function whichAtTask(rng: Rng): Exercise | null {
  const T = rng.pick([20, 20, -50, 100, -20, 60]);
  const want = rng.pick([0, 1, 2] as State[]);
  const rows = tableRows(rng, 5, T, TABLE_POOL);
  const correct = rows.map((s, i) => (stateAt(s, T) === want ? i : -1)).filter((i) => i >= 0);
  if (correct.length < 1 || correct.length > 3) return null;
  const options = rows.map((s) => s.name);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const setOf = (f: (s: Substance) => boolean) => rows.map((s, i) => (f(s) ? i : -1)).filter((i) => i >= 0);
  if (want === 1) {
    const s1 = setOf((s) => s.mp < T);
    if (s1.length) m.add({ kind: "multi", options, correct: s1 }, tx("Some are gases already", "Manche sind schon gasförmig"), tx(`Above the melting temperature, yes. But some of your picks also have a boiling temperature below ${degEn(T)}: they're gases by then.`, `Über der Schmelztemperatur, stimmt. Aber bei manchen deiner Stoffe liegt auch die Siedetemperatur unter ${degDe(T)}: Die sind dann schon gasförmig.`));
    const s2 = setOf((s) => s.bp > T);
    if (s2.length) m.add({ kind: "multi", options, correct: s2 }, tx("Some haven't melted", "Manche sind nicht geschmolzen"), tx(`Below the boiling temperature, yes. But for some of your picks ${degEn(T)} is still below the melting temperature: they're solid.`, `Unter der Siedetemperatur, stimmt. Aber bei manchen deiner Stoffe liegt ${degDe(T)} noch unter der Schmelztemperatur: Die sind fest.`));
  } else if (want === 2) {
    const s1 = setOf((s) => s.mp < T);
    if (s1.length) m.add({ kind: "multi", options, correct: s1 }, tx("Melting isn't boiling", "Schmelzen ist nicht Sieden"), tx("You compared with the melting temperatures. But a substance is only a gas above its **boiling** temperature.", "Du hast mit den Schmelztemperaturen verglichen. Gasförmig ist ein Stoff aber erst über seiner **Siedetemperatur**."));
  } else {
    const s1 = setOf((s) => s.bp > T);
    if (s1.length) m.add({ kind: "multi", options, correct: s1 }, tx("Boiling isn't melting", "Sieden ist nicht Schmelzen"), tx("You compared with the boiling temperatures. But a substance is only solid below its **melting** temperature.", "Du hast mit den Siedetemperaturen verglichen. Fest ist ein Stoff aber nur unter seiner **Schmelztemperatur**."));
  }
  const listEn = correct.map((i) => en(rows[i].name)).join(", ");
  const listDe = correct.map((i) => de(rows[i].name)).join(", ");
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx(`Which of these substances are **${stateEn(want)}** at **${degEn(T)}**?`, `Welche dieser Stoffe sind bei **${degDe(T)}** **${stateDe(want)}**?`),
    visual: visual(ParticlesTable, { rows: rows.map((s) => ({ name: s.name, mp: s.mp, bp: s.bp })) }),
    answer,
    hint: STATE_HINT,
    solution: [
      {
        math: want === 0 ? tx(`T < "m.p."`, `T < "Smt."`) : want === 1 ? tx(`"m.p." < T < "b.p."`, `"Smt." < T < "Sdt."`) : tx(`T > "b.p."`, `T > "Sdt."`),
        note: want === 0 ? tx("Solid: the temperature is below the melting temperature.", "Fest: Die Temperatur liegt unter der Schmelztemperatur.") : want === 1 ? tx("Liquid: melted, but not boiled yet.", "Flüssig: geschmolzen, aber noch nicht gesiedet.") : tx("Gas: the temperature is above the boiling temperature.", "Gasförmig: Die Temperatur liegt über der Siedetemperatur."),
      },
      { math: `T = ${dnum(T, "t")} "°C"`, note: tx(`Go through the table row by row: ${listEn}.`, `Geh die Tabelle Zeile für Zeile durch: ${listDe}.`) },
    ],
    mistakes: m.list,
  };
}

function countGasesTask(rng: Rng): Exercise | null {
  const T = rng.pick([20, -50, -100, 100, 300]);
  const want = rng.pick([2, 2, 0] as State[]);
  const rows = tableRows(rng, 5, T, TABLE_POOL);
  const value = rows.filter((s) => stateAt(s, T) === want).length;
  if (value < 1 || value > 4) return null;
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakes(answer);
  if (want === 2) {
    m.add({ kind: "number", value: rows.filter((s) => s.mp < T).length }, tx("Melting isn't boiling", "Schmelzen ist nicht Sieden"), tx("You counted the ones above their **melting** temperature. A gas needs more: above the **boiling** temperature.", "Du hast die gezählt, die über ihrer **Schmelztemperatur** liegen. Gasförmig braucht mehr: über der **Siedetemperatur**."));
    m.add({ kind: "number", value: rows.filter((s) => stateAt(s, T) === 1).length }, tx("Those are the liquids", "Das sind die flüssigen"), tx("That's how many are **liquid**. The question asks for the gases.", "So viele sind **flüssig**. Gefragt sind die gasförmigen."));
  } else {
    m.add({ kind: "number", value: rows.filter((s) => s.bp > T).length }, tx("Boiling isn't melting", "Sieden ist nicht Schmelzen"), tx("You counted all below their **boiling** temperature. Solid means below the **melting** temperature.", "Du hast alle unter ihrer **Siedetemperatur** gezählt. Fest heißt: unter der **Schmelztemperatur**."));
    m.add({ kind: "number", value: rows.filter((s) => stateAt(s, T) === 1).length }, tx("Those are the liquids", "Das sind die flüssigen"), tx("That's how many are **liquid**. The question asks for the solids.", "So viele sind **flüssig**. Gefragt sind die festen."));
  }
  const names = rows.filter((s) => stateAt(s, T) === want);
  return {
    instruction: tx("Read the table", "Lies die Tabelle"),
    text: tx(`How many of these substances are **${stateEn(want)}** at **${degEn(T)}**?`, `Wie viele dieser Stoffe sind bei **${degDe(T)}** **${stateDe(want)}**?`),
    visual: visual(ParticlesTable, { rows: rows.map((s) => ({ name: s.name, mp: s.mp, bp: s.bp })) }),
    answer,
    hint: want === 2 ? tx("Gas means: the temperature is above the boiling temperature.", "Gasförmig heißt: Die Temperatur liegt über der Siedetemperatur.") : tx("Solid means: the temperature is below the melting temperature.", "Fest heißt: Die Temperatur liegt unter der Schmelztemperatur."),
    solution: [
      { math: want === 2 ? tx(`T > "b.p."`, `T > "Sdt."`) : tx(`T < "m.p."`, `T < "Smt."`), note: want === 2 ? tx(`Look for boiling temperatures below ${degEn(T)}.`, `Such Siedetemperaturen unter ${degDe(T)}.`) : tx(`Look for melting temperatures above ${degEn(T)}.`, `Such Schmelztemperaturen über ${degDe(T)}.`) },
      { math: `${value}#r`, note: tx(`That fits ${names.map((s) => en(s.name)).join(", ")}: **${value}**.`, `Das passt für ${names.map((s) => de(s.name)).join(", ")}: **${value}**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

const BOTH_PAIRS: [string, string][] = [
  ["water", "ethanol"],
  ["water", "bromine"],
  ["water", "mercury"],
  ["ethanol", "bromine"],
  ["water", "acetone"],
  ["mercury", "ethanol"],
  ["ammonia", "ethanol"],
  ["acetic", "water"],
  ["sulfur", "mercury"],
  ["naphthalene", "water"],
  ["methanol", "acetone"],
];

function bothLiquidTask(rng: Rng): Exercise | null {
  const [a, b] = rng.pick(BOTH_PAIRS).map(substance);
  const lo = Math.max(a.mp, b.mp);
  const hi = Math.min(a.bp, b.bp);
  const inside = niceTemp(rng, { mp: lo, bp: hi }, 1);
  if (inside === null) return null;
  const candidates = [
    niceTemp(rng, { mp: Math.min(a.mp, b.mp), bp: lo }, 1),
    niceTemp(rng, { mp: hi, bp: Math.max(a.bp, b.bp) }, 1),
    niceTemp(rng, { mp: Math.min(a.mp, b.mp), bp: Math.max(a.bp, b.bp) }, 0),
    niceTemp(rng, { mp: Math.min(a.mp, b.mp), bp: Math.max(a.bp, b.bp) }, 2),
  ].filter((v): v is number => v !== null && v !== inside && v !== a.mp && v !== b.mp && v !== a.bp && v !== b.bp);
  const wrong = [...new Set(candidates)].slice(0, 3);
  if (wrong.length < 3) return null;
  const why = (T: number): Text => {
    const bad = [a, b].find((s) => stateAt(s, T) !== 1)!;
    const st = stateAt(bad, T);
    return tx(
      `At ${degEn(T)} ${en(bad.name)} is ${st === 0 ? "still solid" : "already a gas"}: ${st === 0 ? `it only melts at ${degEn(bad.mp)}` : `it boils at ${degEn(bad.bp)}`}.`,
      `Bei ${degDe(T)} ist ${de(bad.name)} ${st === 0 ? "noch fest" : "schon gasförmig"}: ${capital(dePronoun(bad))} ${st === 0 ? `schmilzt erst bei ${degDe(bad.mp)}` : `siedet bei ${degDe(bad.bp)}`}.`,
    );
  };
  const { answer, mistakes: list } = choice(rng, [
    { text: deg(inside) },
    ...wrong.map((T) => ({ text: deg(T), title: tx("Only one of them", "Nur einer von beiden"), say: why(T) })),
  ]);
  return {
    instruction: tx("Both liquid", "Beide flüssig"),
    text: tx(
      `${capital(en(a.name))}: m.p. ${degEn(a.mp)}, b.p. ${degEn(a.bp)}. ${capital(en(b.name))}: m.p. ${degEn(b.mp)}, b.p. ${degEn(b.bp)}. At which temperature are **both** liquid?`,
      `${de(a.name)}: Smt. ${degDe(a.mp)}, Sdt. ${degDe(a.bp)}. ${de(b.name)}: Smt. ${degDe(b.mp)}, Sdt. ${degDe(b.bp)}. Bei welcher Temperatur sind **beide** flüssig?`,
    ),
    visual: visual(ParticlesTable, { rows: [a, b].map((s) => ({ name: s.name, mp: s.mp, bp: s.bp })) }),
    answer,
    hint: tx("Both must have melted (above the higher melting temperature) and neither may boil (below the lower boiling temperature).", "Beide müssen geschmolzen sein (über der höheren Schmelztemperatur) und keiner darf sieden (unter der niedrigeren Siedetemperatur)."),
    solution: [
      {
        math: `${dnum(lo, "lo")} "°C" < T < ${dnum(hi, "hi")} "°C"`,
        note: tx(`Both are liquid above ${degEn(lo)} (the higher melting temperature) and below ${degEn(hi)} (the lower boiling temperature).`, `Beide sind flüssig über ${degDe(lo)} (die höhere Schmelztemperatur) und unter ${degDe(hi)} (die niedrigere Siedetemperatur).`),
      },
      { math: `${dnum(lo, "lo")} "°C" < ${dnum(inside, "t")} "°C" < ${dnum(hi, "hi")} "°C"`, note: tx(`${degEn(inside)} lies in this range.`, `${degDe(inside)} liegt in diesem Bereich.`), highlight: ["t"] },
    ],
    mistakes: list,
  };
}

/** Two changes in a row: heating a solid into a gas, or cooling a gas into a solid. */
function sequenceTask(rng: Rng): Exercise {
  const sub = substance(rng.pick(["water", "ethanol", "bromine", "mercury", "acetone", "methanol", "ammonia", "sulfur"]));
  const heating = rng.chance(0.5);
  const cold = niceTemp(rng, sub, 0)!;
  const hot = niceTemp(rng, sub, 2)!;
  const [first, second]: Change[] = heating ? ["melt", "boil"] : ["condense", "freeze"];
  const seq = (a: Change, b?: Change): Text => (b ? tx(`${en(CHANGES[a].name)}, then ${en(CHANGES[b].name).toLowerCase()}`, `${de(CHANGES[a].name)}, dann ${de(CHANGES[b].name)}`) : CHANGES[a].name);
  const direct: Change = heating ? "sublime" : "deposit";
  const { answer, mistakes: list } = choice(rng, [
    { text: seq(first, second) },
    {
      text: seq(second, first),
      title: tx("Order matters", "Die Reihenfolge zählt"),
      say: heating
        ? tx("Right changes, wrong order! The solid has to become liquid before it can boil.", "Richtige Übergänge, falsche Reihenfolge! Der Feststoff muss erst flüssig werden, bevor er sieden kann.")
        : tx("Right changes, wrong order! The gas has to become liquid before it can freeze.", "Richtige Übergänge, falsche Reihenfolge! Das Gas muss erst flüssig werden, bevor es erstarren kann."),
    },
    {
      text: heating ? seq("freeze", "condense") : seq("boil", "melt"),
      title: heating ? tx("Those are for cooling", "Das ist Abkühlen") : tx("Those are for heating", "Das ist Erhitzen"),
      say: heating
        ? tx("Those changes happen when a substance cools down. Here it gets heated.", "Diese Übergänge passieren beim Abkühlen. Hier wird der Stoff erhitzt.")
        : tx("Those changes happen when a substance is heated. Here it cools down.", "Diese Übergänge passieren beim Erhitzen. Hier kühlt der Stoff ab."),
    },
    {
      text: CHANGES[direct].name,
      title: tx("It passes the liquid range", "Er durchläuft den Flüssigkeitsbereich"),
      say: tx(
        `${capital(en(CHANGES[direct].name))} would skip the liquid. But between ${degEn(sub.mp)} and ${degEn(sub.bp)} ${en(sub.name)} is liquid, and the temperature passes right through that range.`,
        `${de(CHANGES[direct].name)} würde das Flüssige überspringen. Aber zwischen ${degDe(sub.mp)} und ${degDe(sub.bp)} ist ${de(sub.name)} flüssig, und die Temperatur läuft genau durch diesen Bereich.`,
      ),
    },
  ]);
  const [from, to] = heating ? [cold, hot] : [hot, cold];
  return {
    instruction: tx("Changes of state in a row", "Zustandsänderungen nacheinander"),
    text: tx(
      `${capital(en(sub.name))} (m.p. ${degEn(sub.mp)}, b.p. ${degEn(sub.bp)}) is ${heating ? "heated" : "cooled"} from ${degEn(from)} to ${degEn(to)}. Which changes of state happen, in order?`,
      `${de(sub.name)} (Smt. ${degDe(sub.mp)}, Sdt. ${degDe(sub.bp)}) wird von ${degDe(from)} auf ${degDe(to)} ${heating ? "erhitzt" : "abgekühlt"}. Welche Zustandsänderungen laufen nacheinander ab?`,
    ),
    answer,
    hint: tx("Which state is it in at the start, which at the end? Which states does it pass on the way?", "In welchem Zustand ist der Stoff am Anfang, in welchem am Ende? Durch welche Zustände kommt er dazwischen?"),
    solution: heating
      ? [
          { math: tx(`"solid"#s \\to#a1 "liquid"#l \\to#a2 "gas"#g`, `"fest"#s \\to#a1 "flüssig"#l \\to#a2 "gasförmig"#g`), note: tx(`At ${degEn(from)} it's solid, at ${degEn(to)} a gas. On the way it is liquid.`, `Bei ${degDe(from)} ist der Stoff fest, bei ${degDe(to)} gasförmig. Dazwischen ist er flüssig.`) },
          { math: tx(`"melting"#n1 \\to "evaporation"#n2`, `"Schmelzen"#n1 \\to "Verdampfen"#n2`), note: tx(`First it melts at ${degEn(sub.mp)}, then it boils at ${degEn(sub.bp)}.`, `Erst schmilzt er bei ${degDe(sub.mp)}, dann siedet er bei ${degDe(sub.bp)}.`) },
        ]
      : [
          { math: tx(`"gas"#g \\to#a1 "liquid"#l \\to#a2 "solid"#s`, `"gasförmig"#g \\to#a1 "flüssig"#l \\to#a2 "fest"#s`), note: tx(`At ${degEn(from)} it's a gas, at ${degEn(to)} solid. On the way it is liquid.`, `Bei ${degDe(from)} ist der Stoff gasförmig, bei ${degDe(to)} fest. Dazwischen ist er flüssig.`) },
          { math: tx(`"condensation"#n1 \\to "freezing"#n2`, `"Kondensieren"#n1 \\to "Erstarren"#n2`), note: tx(`First it condenses at ${degEn(sub.bp)}, then it freezes at ${degEn(sub.mp)}.`, `Erst kondensiert er bei ${degDe(sub.bp)}, dann erstarrt er bei ${degDe(sub.mp)}.`) },
        ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Select the true statements about the particle model

type Statement = { text: Text; true: boolean; title: Text; say: Text };

const STATEMENTS: Statement[] = [
  { text: tx("Between the particles there is nothing, only empty space.", "Zwischen den Teilchen ist nichts, nur leerer Raum."), true: true, title: tx("Empty space", "Leerer Raum"), say: tx("What is really between two particles?", "Was ist wirklich zwischen zwei Teilchen?") },
  { text: tx("The particles are always moving, even in a solid.", "Die Teilchen bewegen sich ständig, auch in einem Feststoff."), true: true, title: tx("Even in solids", "Auch im Feststoff"), say: tx("Do particles ever stop moving, even in a solid?", "Hören Teilchen je auf, sich zu bewegen, auch im Feststoff?") },
  { text: tx("The higher the temperature, the faster the particles move.", "Je höher die Temperatur, desto schneller bewegen sich die Teilchen."), true: true, title: tx("Temperature is motion", "Temperatur ist Bewegung"), say: tx("What does heating do to the particles' speed?", "Was macht Erwärmen mit dem Tempo der Teilchen?") },
  { text: tx("When ice melts, the particles stay the same; only their arrangement changes.", "Beim Schmelzen von Eis bleiben die Teilchen gleich, nur ihre Anordnung ändert sich."), true: true, title: tx("Same particles", "Gleiche Teilchen"), say: tx("Does ice turn into new particles when it melts?", "Wird Eis beim Schmelzen zu neuen Teilchen?") },
  { text: tx("All particles of a pure substance are the same.", "Alle Teilchen eines Reinstoffs sind gleich."), true: true, title: tx("All the same", "Alle gleich"), say: tx("How many kinds of particles does a pure substance have?", "Wie viele Sorten Teilchen hat ein Reinstoff?") },
  { text: tx("When a substance is heated, the distances between its particles grow.", "Beim Erwärmen werden die Abstände zwischen den Teilchen größer."), true: true, title: tx("Distances grow", "Abstände wachsen"), say: tx("Why do things expand when they get warm?", "Warum dehnen sich Stoffe beim Erwärmen aus?") },
  { text: tx("When heated, the particles themselves get bigger.", "Beim Erwärmen werden die Teilchen selbst größer."), true: false, title: tx("Particles don't grow", "Teilchen wachsen nicht"), say: tx("Ooh, the classic myth crept in! The particles keep their size. Only the **distances** between them grow.", "Da hat sich der klassische Irrtum eingeschlichen! Die Teilchen behalten ihre Größe. Nur die **Abstände** werden größer.") },
  { text: tx("Between the particles of a gas there is air.", "Zwischen den Teilchen eines Gases ist Luft."), true: false, title: tx("Air is particles too", "Luft sind auch Teilchen"), say: tx("One of your picks says there's air between particles. But air is made of particles itself: between them there's nothing.", "Eine deiner Antworten sagt, zwischen den Teilchen sei Luft. Aber Luft besteht selbst aus Teilchen: Dazwischen ist nichts.") },
  { text: tx("In a solid the particles are completely at rest.", "In einem Feststoff stehen die Teilchen völlig still."), true: false, title: tx("Particles never rest", "Teilchen ruhen nie"), say: tx("One pick says solid particles are at rest. But they vibrate all the time, just in their places.", "Eine Antwort sagt, Teilchen im Feststoff stünden still. Sie schwingen aber ständig, nur eben auf ihren Plätzen.") },
  { text: tx("A single particle of sulfur is yellow.", "Ein einzelnes Schwefelteilchen ist gelb."), true: false, title: tx("Particles have no colour", "Teilchen haben keine Farbe"), say: tx("A single particle has no colour. Properties like colour or hardness only appear when huge numbers of particles come together.", "Ein einzelnes Teilchen hat keine Farbe. Eigenschaften wie Farbe oder Härte entstehen erst, wenn riesig viele Teilchen zusammenkommen.") },
  { text: tx("When water boils, its particles break into smaller pieces.", "Beim Sieden zerfallen die Wasserteilchen in kleinere Teile."), true: false, title: tx("Still water particles", "Immer noch Wasserteilchen"), say: tx("The bubbles in boiling water are water vapour: the very same water particles, just far apart.", "Die Blasen in siedendem Wasser sind Wasserdampf: genau dieselben Wasserteilchen, nur weit voneinander entfernt.") },
  { text: tx("Gas particles are bigger than the particles of the same substance as a liquid.", "Gasteilchen sind größer als die Teilchen desselben Stoffs im flüssigen Zustand."), true: false, title: tx("Same size", "Gleich groß"), say: tx("A gas takes up more room because the gaps are bigger, not the particles.", "Ein Gas braucht mehr Platz, weil die Lücken größer sind, nicht die Teilchen.") },
];

function statementsTask(rng: Rng): Exercise {
  const trues = rng.shuffle(STATEMENTS.filter((s) => s.true)).slice(0, rng.int(2, 3));
  const falses = rng.shuffle(STATEMENTS.filter((s) => !s.true)).slice(0, 5 - trues.length);
  const picked = rng.shuffle([...trues, ...falses]);
  const options = picked.map((s) => s.text);
  const correct = picked.map((s, i) => (s.true ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  // The right picks plus one myth, or the right picks minus one true statement.
  picked.forEach((s, i) => {
    if (!s.true) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, s.title, s.say);
  });
  picked.forEach((s, i) => {
    if (s.true && correct.length > 1) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== i) }, tx("One true one missing", "Eine richtige fehlt"), tx(`Almost! One true statement is still missing. Ask yourself: ${en(s.say)}`, `Fast! Eine richtige Aussage fehlt noch. Frag dich: ${de(s.say)}`), true);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which statements match the particle model?", "Welche Aussagen passen zum Teilchenmodell?"),
    answer,
    hint: tx("Watch out for statements that give single particles properties of the whole substance, like size changes, colour or melting.", "Achte auf Aussagen, die einzelnen Teilchen Eigenschaften des ganzen Stoffs geben, z. B. Größenänderung, Farbe oder Schmelzen."),
    solution: [
      { math: tx('"particles:" \\quad "same size"#a , "always moving"#b', '"Teilchen:" \\quad "gleich groß"#a , "immer in Bewegung"#b'), note: tx("Particles never change their size and never stop moving.", "Teilchen ändern nie ihre Größe und hören nie auf, sich zu bewegen.") },
      { math: tx('"between them:" \\quad "nothing"#c', '"dazwischen:" \\quad "nichts"#c'), note: tx(`Between them is empty space. True here: ${correct.map((i) => `"${en(options[i])}"`).join(" ")}`, `Dazwischen ist leerer Raum. Richtig sind hier: ${correct.map((i) => `„${de(options[i])}“`).join(" ")}`) },
    ],
    mistakes: m.list.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Generator

const WATER = substance("water");
const WATER_TEMPS = [-18, -5, 4, 20, 37, 60, 90, 110, 120, 150, -30];
const CHANGE_LIST = Object.keys(CHANGES) as Change[];

function level1(rng: Rng): Exercise | null {
  switch (rng.int(0, 5)) {
    case 0:
      return pictureTask(rng.int(0, 2) as State, rng.int(1, 60));
    case 1:
      return changeWordTask(rng.pick(SCENES));
    case 2:
      return changeMeaningTask(rng, rng.pick(CHANGE_LIST));
    case 3:
      return stateTask(WATER, rng.pick(WATER_TEMPS));
    case 4:
      return conceptTask(rng, rng.pick([SOLID_MOVES, BETWEEN, SPEED, MELT_CHANGE]));
    default:
      return conceptTask(rng, propertyConcept(rng.int(0, 2) as State));
  }
}

const L2_SUBSTANCES = SUBSTANCES.filter((s) => s.id !== "water" && s.id !== "hydrogen");

function level2(rng: Rng): Exercise | null {
  switch (rng.int(0, 6)) {
    case 0:
    case 1: {
      const sub = rng.pick(L2_SUBSTANCES);
      const T = niceTemp(rng, sub, rng.int(0, 2) as State);
      return T === null ? null : stateTask(sub, T);
    }
    case 2:
      return curveTempTask(rng, rng.pick(["mp", "bp"] as const));
    case 3:
      return freezeTempTask(rng);
    case 4:
      return whichAtTask(rng);
    case 5:
      return liquidRangeTask(rng);
    default:
      return conceptTask(rng, rng.pick([TEA, SYRINGE, PERFUME, BRIDGE, BALLOON]));
  }
}

function level3(rng: Rng): Exercise | null {
  switch (rng.int(0, 7)) {
    case 0:
      return statementsTask(rng);
    case 1:
      return sequenceTask(rng);
    case 2:
      return curveDurationTask(rng, rng.pick(["melt", "boil"] as const));
    case 3:
      return countGasesTask(rng);
    case 4:
      return bothLiquidTask(rng);
    case 5:
      return conceptTask(rng, rng.pick([PLATEAU, HOTPLATE, PUDDLE, BALLOON]));
    case 6:
      return curveTempTask(rng, rng.pick(["freeze", "condense"] as const));
    default: {
      // Very cold or very hot substances, no picture.
      const sub = substance(rng.pick(["oxygen", "nitrogen", "hydrogen", "propane", "ammonia", "iron", "copper", "salt", "tin"]));
      const T = niceTemp(rng, sub, rng.int(0, 2) as State);
      return T === null ? null : stateTask(sub, T, { scale: false });
    }
  }
}

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 30; tries++) {
    const ex = level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
    if (ex) return ex;
  }
  return stateTask(WATER, 20);
}

// ---------------------------------------------------------------------------
// Lesson

const statesFrames: Frame[] = [
  {
    math: tx('"ice"#n \\quad \\ce{H2O(s)}', '"Eis"#n \\quad \\ce{H2O(s)}'),
    note: tx(
      "**Solid** (s): the particles are tightly packed in a regular pattern, a lattice. They only vibrate in their places.",
      "**Fest** (s): Die Teilchen liegen dicht gepackt in einem regelmäßigen Muster, einem Gitter. Sie schwingen nur auf ihren Plätzen.",
    ),
  },
  {
    math: tx('"water"#n \\quad \\ce{H2O(l)}', '"Wasser"#n \\quad \\ce{H2O(l)}'),
    note: tx(
      "**Liquid** (l): the particles are still close together, but without order. They slide past each other, so a liquid takes the shape of its container.",
      "**Flüssig** (l): Die Teilchen sind noch dicht beieinander, aber ungeordnet. Sie gleiten aneinander vorbei, deshalb passt sich eine Flüssigkeit dem Gefäß an.",
    ),
  },
  {
    math: tx('"water vapour"#n \\quad \\ce{H2O(g)}', '"Wasserdampf"#n \\quad \\ce{H2O(g)}'),
    note: tx(
      "**Gas** (g): the particles are far apart and fly fast and freely in all directions. A gas fills any space.",
      "**Gasförmig** (g): Die Teilchen sind weit voneinander entfernt und fliegen schnell und frei in alle Richtungen. Ein Gas füllt jeden Raum aus.",
    ),
  },
  {
    math: "\\ce{H2O(s)} \\quad \\ce{H2O(l)} \\quad \\ce{H2O(g)}",
    note: tx(
      "Three times the **same** water particles! Only distance, order and movement change. s, l and g come from Latin: solidus, liquidus, gaseus.",
      "Dreimal **dieselben** Wasserteilchen! Nur Abstand, Ordnung und Bewegung ändern sich. s, l und g kommen aus dem Lateinischen: solidus, liquidus, gaseus.",
    ),
  },
];

const changeFramesLesson: Frame[] = [
  {
    math: tx('"solid"#s \\quad "liquid"#l \\quad "gas"#g', '"fest"#s \\quad "flüssig"#l \\quad "gasförmig"#g'),
    note: tx("Heating or cooling moves a substance from one state to another. Each change has its own name.", "Durch Erhitzen oder Abkühlen wechselt ein Stoff seinen Aggregatzustand. Jeder Übergang hat einen eigenen Namen."),
  },
  {
    math: tx('"solid"#s \\to#a1 "liquid"#l \\quad "gas"#g', '"fest"#s \\to#a1 "flüssig"#l \\quad "gasförmig"#g'),
    note: tx("**Melting**: solid to liquid. Ice melts at 0 °C, its **melting temperature**.", "**Schmelzen**: von fest nach flüssig. Eis schmilzt bei 0 °C, seiner **Schmelztemperatur**."),
    highlight: ["a1"],
  },
  {
    math: tx('"solid"#s \\to#a1 "liquid"#l \\to#a2 "gas"#g', '"fest"#s \\to#a1 "flüssig"#l \\to#a2 "gasförmig"#g'),
    note: tx(
      "**Evaporation**: liquid to gas. At the **boiling temperature** it bubbles: that's **boiling**. Below it, water evaporates slowly at the surface.",
      "**Verdampfen**: von flüssig nach gasförmig. Bei der **Siedetemperatur** brodelt es: Das heißt **Sieden**. Darunter **verdunstet** Wasser langsam an der Oberfläche.",
    ),
    highlight: ["a2"],
  },
  {
    math: tx('"gas"#g \\to#a3 "liquid"#l \\to#a4 "solid"#s', '"gasförmig"#g \\to#a3 "flüssig"#l \\to#a4 "fest"#s'),
    note: tx(
      "Cooling goes backwards: **condensation** (gas to liquid) and **freezing** (liquid to solid). They happen at the same temperatures as boiling and melting.",
      "Beim Abkühlen geht es rückwärts: **Kondensieren** (gasförmig nach flüssig) und **Erstarren** (flüssig nach fest). Sie passieren bei denselben Temperaturen wie Sieden und Schmelzen.",
    ),
    highlight: ["a3", "a4"],
  },
  {
    math: tx('"solid"#s \\to#a5 "gas"#g', '"fest"#s \\to#a5 "gasförmig"#g'),
    note: tx(
      "**Sublimation**: straight from solid to gas, without becoming liquid. Dry ice does this at −78.5 °C.",
      "**Sublimieren**: direkt von fest nach gasförmig, ohne flüssig zu werden. Trockeneis macht das bei −78,5 °C.",
    ),
    highlight: ["a5"],
  },
  {
    math: tx('"gas"#g \\to#a6 "solid"#s', '"gasförmig"#g \\to#a6 "fest"#s'),
    note: tx("**Deposition** (resublimation): straight from gas to solid. That's how hoar frost and ice flowers form.", "**Resublimieren**: direkt von gasförmig nach fest. So entstehen Raureif und Eisblumen."),
    highlight: ["a6"],
  },
  {
    math: tx(
      '"melting"#m1 \\Leftrightarrow "freezing"#m2 \\\\ "evaporation"#v1 \\Leftrightarrow "condensation"#v2 \\\\ "sublimation"#s1 \\Leftrightarrow "deposition"#s2',
      '"Schmelzen"#m1 \\Leftrightarrow "Erstarren"#m2 \\\\ "Verdampfen"#v1 \\Leftrightarrow "Kondensieren"#v2 \\\\ "Sublimieren"#s1 \\Leftrightarrow "Resublimieren"#s2',
    ),
    note: tx("Six changes, three pairs. Left: needs heat. Right: happens when cooling.", "Sechs Übergänge, drei Paare. Links: braucht Wärme. Rechts: passiert beim Abkühlen."),
  },
];

const BROM = substance("bromine");
const readFrames: Frame[] = [
  {
    math: tx(`"m.p."#lm = ${dnum(BROM.mp, "m")} "°C"#mu \\quad "b.p."#lb = ${dnum(BROM.bp, "b")} "°C"#bu`, `"Smt."#lm = ${dnum(BROM.mp, "m")} "°C"#mu \\quad "Sdt."#lb = ${dnum(BROM.bp, "b")} "°C"#bu`),
    note: tx("Bromine melts at −7 °C (m.p.) and boils at 59 °C (b.p.). What state is it in at room temperature?", "Brom schmilzt bei −7 °C (Smt.) und siedet bei 59 °C (Sdt.). In welchem Zustand ist es bei Zimmertemperatur?"),
  },
  {
    math: `${dnum(BROM.mp, "m")} "°C"#mu <#l1 20#t "°C"#tu <#l2 ${dnum(BROM.bp, "b")} "°C"#bu`,
    note: tx("20 °C lies **between** the two temperatures.", "20 °C liegt **zwischen** den beiden Temperaturen."),
    highlight: ["t"],
  },
  {
    math: tx(`${dnum(BROM.mp, "m")} "°C"#mu <#l1 20#t "°C"#tu <#l2 ${dnum(BROM.bp, "b")} "°C"#bu \\Rightarrow#r "liquid"#s`, `${dnum(BROM.mp, "m")} "°C"#mu <#l1 20#t "°C"#tu <#l2 ${dnum(BROM.bp, "b")} "°C"#bu \\Rightarrow#r "flüssig"#s`),
    note: tx("Melted, but not boiled: bromine is a **liquid** at 20 °C. One of only two elements that are!", "Geschmolzen, aber nicht gesiedet: Brom ist bei 20 °C **flüssig**. Eines von nur zwei Elementen, die das sind!"),
    highlight: ["s"],
  },
  {
    math: tx(`-#ts 20#t "°C"#tu <#l1 ${dnum(BROM.mp, "m")} "°C"#mu \\Rightarrow#r "solid"#s`, `-#ts 20#t "°C"#tu <#l1 ${dnum(BROM.mp, "m")} "°C"#mu \\Rightarrow#r "fest"#s`),
    note: tx("At −20 °C: colder than −7 °C, so bromine is **solid**. With minus temperatures: the bigger the number after the minus, the colder.", "Bei −20 °C: kälter als −7 °C, also ist Brom **fest**. Bei Minusgraden gilt: Je größer die Zahl nach dem Minus, desto kälter."),
    highlight: ["s"],
  },
  {
    math: tx(`${dnum(BROM.bp, "b")} "°C"#bu <#l2 70#t "°C"#tu \\Rightarrow#r "gas"#s`, `${dnum(BROM.bp, "b")} "°C"#bu <#l2 70#t "°C"#tu \\Rightarrow#r "gasförmig"#s`),
    note: tx("At 70 °C: hotter than the boiling temperature, so bromine is a **gas**.", "Bei 70 °C: heißer als die Siedetemperatur, also ist Brom **gasförmig**."),
    highlight: ["s"],
  },
];

const OXYGEN = substance("oxygen");
const checkPicture = pictureTask(1, 23);
const checkFrost = changeWordTask(SCENES.find((s) => s.change === "deposit")!);
const checkOxygen = stateTask(OXYGEN, -190);
const checkSyringe = conceptTask(createRng(5), SYRINGE);

const lesson: Topic["lesson"] = [
  {
    type: "widget",
    title: tx("Everything is made of particles", "Alles besteht aus Teilchen"),
    blob: tx("Let's zoom into a drop of water. Way, way in!", "Lass uns in einen Wassertropfen zoomen. Ganz, ganz tief!"),
    body: tx(
      "Chemists explain substances with the **particle model**: every substance is made of tiny particles. The particles of one pure substance are all the same. Between them there is empty space. They are always moving, and they attract each other.",
      "Chemiker erklären Stoffe mit dem **Teilchenmodell**: Jeder Stoff besteht aus winzigen Teilchen. Die Teilchen eines Reinstoffs sind alle gleich. Zwischen ihnen ist leerer Raum. Sie bewegen sich ständig und ziehen sich gegenseitig an.",
    ),
    widget: ParticlesZoom,
  },
  {
    type: "explain",
    title: tx("Solid, liquid, gas", "Fest, flüssig, gasförmig"),
    blob: tx("Same particles, three different moods!", "Gleiche Teilchen, drei verschiedene Launen!"),
    body: tx(
      "Every substance can be **solid**, **liquid** or **gaseous**. These are its three **states of matter**. In the particle model they differ in three ways: **distance**, **order** and **movement** of the particles.",
      "Jeder Stoff kann **fest**, **flüssig** oder **gasförmig** sein. Das sind seine drei **Aggregatzustände**. Im Teilchenmodell unterscheiden sie sich in drei Dingen: **Abstand**, **Ordnung** und **Bewegung** der Teilchen.",
    ),
    frames: statesFrames,
  },
  {
    type: "widget",
    title: tx("Heat the box", "Heiz die Box auf"),
    blob: tx("Drag the temperature up and watch the particles go wild!", "Schieb die Temperatur hoch und schau, wie die Teilchen loslegen!"),
    body: tx(
      "Move the slider. Watch how the particles move faster and faster, and what happens at the melting temperature (m.p.) and the boiling temperature (b.p.). Then try dry ice: it skips the liquid state.",
      "Bewege den Regler. Schau, wie die Teilchen immer schneller werden und was bei der Schmelztemperatur (Smt.) und der Siedetemperatur (Sdt.) passiert. Probier danach Trockeneis: Es überspringt den flüssigen Zustand.",
    ),
    widget: ParticlesBox,
  },
  { type: "check", blob: tx("Look closely at the particles. What do they tell you?", "Schau dir die Teilchen genau an. Was verraten sie dir?"), exercise: checkPicture },
  {
    type: "explain",
    title: tx("Six changes of state", "Sechs Zustandsänderungen"),
    blob: tx("Six names to learn, but they come in pairs. Easy!", "Sechs Namen zum Lernen, aber sie kommen paarweise. Ganz einfach!"),
    frames: changeFramesLesson,
  },
  { type: "check", blob: tx("A frosty morning. What's going on with the water vapour?", "Ein frostiger Morgen. Was passiert da mit dem Wasserdampf?"), exercise: checkFrost },
  {
    type: "widget",
    title: tx("The heating curve", "Die Erhitzungskurve"),
    blob: tx("Press heat and keep an eye on the temperature. Something odd happens!", "Drück auf Erhitzen und behalte die Temperatur im Blick. Da passiert etwas Seltsames!"),
    body: tx(
      "We heat ice evenly from −20 °C. While it melts and while it boils, the temperature stops rising: the curve has two flat parts (**plateaus**). The energy goes into pulling the particles apart instead.",
      "Wir erhitzen Eis gleichmäßig von −20 °C an. Während es schmilzt und während es siedet, steigt die Temperatur nicht weiter: Die Kurve hat zwei waagerechte Stücke (**Plateaus**). Die Energie geht stattdessen ins Auseinanderreißen der Teilchen.",
    ),
    widget: ParticlesHeatingLab,
  },
  {
    type: "explain",
    title: tx("Reading the state from a table", "Den Aggregatzustand ablesen"),
    blob: tx("Two numbers are all you need. Let's try bromine!", "Zwei Zahlen reichen dir. Probieren wir es mit Brom!"),
    body: tx(
      "Each pure substance has its own melting and boiling temperature. Compare a temperature with them: below the m.p. it's solid, between m.p. and b.p. liquid, above the b.p. a gas.",
      "Jeder Reinstoff hat seine eigene Schmelz- und Siedetemperatur. Vergleich eine Temperatur damit: unter der Smt. fest, zwischen Smt. und Sdt. flüssig, über der Sdt. gasförmig.",
    ),
    frames: readFrames,
  },
  { type: "check", blob: tx("Minus temperatures ahead. Careful which one is colder!", "Achtung, Minusgrade! Pass auf, was kälter ist!"), exercise: checkOxygen },
  {
    type: "widget",
    title: tx("Particles on the move", "Teilchen in Bewegung"),
    blob: tx("Remove the wall, then push the syringes. Particles explain both!", "Nimm die Wand weg und drück dann die Spritzen. Teilchen erklären beides!"),
    body: tx(
      "**Diffusion**: substances mix by themselves because their particles move on their own, faster when it's warm. **Compressing**: gases can be squeezed because there is so much empty space between their particles.",
      "**Diffusion**: Stoffe mischen sich von selbst, weil sich ihre Teilchen von allein bewegen, wenn es warm ist, schneller. **Zusammendrücken**: Gase lassen sich zusammendrücken, weil zwischen ihren Teilchen so viel leerer Raum ist.",
    ),
    widget: ParticlesMotion,
  },
  { type: "check", blob: tx("Last one! Think about the gaps.", "Die letzte! Denk an die Lücken."), exercise: checkSyringe },
];

// ---------------------------------------------------------------------------

const particles: Topic = {
  ...topicMeta("particles"),
  summary: [
    {
      title: tx("The particle model", "Das Teilchenmodell"),
      body: tx(
        "All substances are made of tiny particles. The particles of one pure substance are the same. Between them is empty space. They are always moving and attract each other.",
        "Alle Stoffe bestehen aus winzigen Teilchen. Die Teilchen eines Reinstoffs sind gleich. Zwischen ihnen ist leerer Raum. Sie bewegen sich ständig und ziehen sich an.",
      ),
      examples: ["\\ce{H2O(s)} \\quad \\ce{H2O(l)} \\quad \\ce{H2O(g)}"],
      tone: "rule",
    },
    {
      title: tx("Solid, liquid, gas", "Fest, flüssig, gasförmig"),
      body: tx(
        "**Solid**: tightly packed, regular, vibrating in place. **Liquid**: close, no order, sliding. **Gas**: far apart, no order, flying freely.",
        "**Fest**: dicht gepackt, regelmäßig, schwingen auf der Stelle. **Flüssig**: dicht, ungeordnet, gleiten. **Gasförmig**: weit entfernt, ungeordnet, fliegen frei.",
      ),
      examples: [tx('"solid" \\to "liquid" \\to "gas"', '"fest" \\to "flüssig" \\to "gasförmig"')],
      tone: "rule",
    },
    {
      title: tx("Changes of state", "Zustandsänderungen"),
      body: tx("Heating goes left to right, cooling right to left. Each pair happens at the same temperature.", "Erhitzen geht von links nach rechts, Abkühlen von rechts nach links. Jedes Paar passiert bei derselben Temperatur."),
      examples: [
        tx('"melting" \\Leftrightarrow "freezing"', '"Schmelzen" \\Leftrightarrow "Erstarren"'),
        tx('"evaporation" \\Leftrightarrow "condensation"', '"Verdampfen" \\Leftrightarrow "Kondensieren"'),
        tx('"sublimation" \\Leftrightarrow "deposition"', '"Sublimieren" \\Leftrightarrow "Resublimieren"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Reading the state", "Zustand ablesen"),
      body: tx("Below the melting temperature: solid. Between m.p. and b.p.: liquid. Above the boiling temperature: gas.", "Unter der Schmelztemperatur: fest. Zwischen Smt. und Sdt.: flüssig. Über der Siedetemperatur: gasförmig."),
      examples: [tx('-114 "°C" < 20 "°C" < 78 "°C" \\Rightarrow "ethanol is liquid"', '-114 "°C" < 20 "°C" < 78 "°C" \\Rightarrow "Ethanol ist flüssig"')],
      tone: "tip",
    },
    {
      title: tx("Temperature is motion", "Temperatur ist Bewegung"),
      body: tx(
        "The warmer, the faster the particles. That's why warm substances mix faster (**diffusion**). Gases can be compressed because their particles are far apart.",
        "Je wärmer, desto schneller die Teilchen. Deshalb mischen sich warme Stoffe schneller (**Diffusion**). Gase lassen sich zusammendrücken, weil ihre Teilchen weit voneinander entfernt sind.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "When heated, the particles don't get bigger: the **distances** grow. And while a substance melts or boils, its temperature stays the same.",
        "Beim Erwärmen werden nicht die Teilchen größer, sondern ihre **Abstände**. Und während ein Stoff schmilzt oder siedet, bleibt seine Temperatur gleich.",
      ),
      examples: [tx('"boiling water:" \\; 100 "°C" = "constant"', '"siedendes Wasser:" \\; 100 "°C" = "konstant"')],
      tone: "warning",
    },
  ],
  lesson,
  generate,
};

export default particles;
