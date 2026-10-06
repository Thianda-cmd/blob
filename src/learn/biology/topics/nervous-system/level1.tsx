"use client";

// Nervous system, level 1 (Einsteiger, Klasse 5–6): the senses and their stimuli, the chain
// stimulus → sense organ → nerve → brain → nerve → muscle, the eye (parts, how an image forms,
// pupillary reflex, blind spot), hearing in brief, and reflexes as fast unconscious reactions.

import { resolveText, tx, type Text } from "@/i18n/text";
import { NerveBlindSpot } from "@/learn/biology/visuals/NerveBlindSpot";
import { EYE_BASIC, NerveEye, NerveEyeLab } from "@/learn/biology/visuals/NerveEye";
import { NerveReaction } from "@/learn/biology/visuals/NerveReaction";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson } from "@/learn/types";
import { answerFrame, cat, choice, flow, match, multi, order, pic, q, some, weighted, word, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Senses

type Organ = { id: string; organ: Text; the: Text; stim: Text[]; sense: Text };
const ORGANS: Organ[] = [
  { id: "eye", organ: tx("eye", "Auge"), the: tx("the eye", "das Auge"), stim: [tx("light", "Licht")], sense: tx("sense of sight", "Sehsinn") },
  { id: "ear", organ: tx("ear", "Ohr"), the: tx("the ear", "das Ohr"), stim: [tx("sound", "Schall")], sense: tx("sense of hearing", "Hörsinn") },
  { id: "nose", organ: tx("nose", "Nase"), the: tx("the nose", "die Nase"), stim: [tx("smell chemicals in the air", "Duftstoffe in der Luft")], sense: tx("sense of smell", "Geruchssinn") },
  { id: "tongue", organ: tx("tongue", "Zunge"), the: tx("the tongue", "die Zunge"), stim: [tx("taste chemicals in food", "Geschmacksstoffe im Essen")], sense: tx("sense of taste", "Geschmackssinn") },
  { id: "skin", organ: tx("skin", "Haut"), the: tx("the skin", "die Haut"), stim: [tx("pressure (touch)", "Druck (Berührung)"), tx("warmth and cold", "Wärme und Kälte"), tx("pain", "Schmerz")], sense: tx("senses of touch, temperature and pain", "Tast-, Temperatur- und Schmerzsinn") },
  { id: "balance", organ: tx("organ of balance (inner ear)", "Gleichgewichtsorgan (Innenohr)"), the: tx("the organ of balance", "das Gleichgewichtsorgan"), stim: [tx("position and turning of the head", "Lage und Drehung des Kopfes")], sense: tx("sense of balance", "Gleichgewichtssinn") },
];
const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const organ = (id: string) => ORGANS.find((o) => o.id === id)!;

/** Typical swaps between two sense organs: what Blob says when a student mixes them up. */
function organSwap(a: string, b: string): { title: Text; say: Text } | null {
  const key = [a, b].sort().join("+");
  const SWAPS: Record<string, { title: Text; say: Text }> = {
    "nose+tongue": {
      title: tx("Nose and tongue swapped", "Nase und Zunge vertauscht"),
      say: tx("Close! Both react to chemicals. But the **nose** smells chemicals in the air, the **tongue** tastes sweet, sour, salty, bitter and umami in your mouth.", "Fast! Beide reagieren auf chemische Reize. Aber die **Nase** riecht Duftstoffe in der Luft, die **Zunge** schmeckt süß, sauer, salzig, bitter und umami im Mund."),
    },
    "balance+ear": {
      title: tx("Hearing isn't balance", "Hören ist nicht Gleichgewicht"),
      say: tx("The organ of balance sits in the inner ear, right next to the cochlea. But it senses the **position and turning of the head**, not sound.", "Das Gleichgewichtsorgan sitzt im Innenohr, gleich neben der Schnecke. Es spürt aber **Lage und Drehung des Kopfes**, nicht den Schall."),
    },
    "ear+skin": {
      title: tx("Ear and skin swapped", "Ohr und Haut vertauscht"),
      say: tx("Sound is a vibration of the air, but you **hear** it with your ear. Pressure on your body (a touch) is felt by the **skin**.", "Schall ist eine Schwingung der Luft, aber du **hörst** ihn mit dem Ohr. Druck auf deinen Körper (eine Berührung) spürt die **Haut**."),
    },
  };
  return SWAPS[key] ?? null;
}

function senseMatchTask(rng: Rng): Exercise {
  const chosen = some(rng, ORGANS, 4);
  const pairs: [Text, Text][] = chosen.map((o) => [o.organ, rng.pick(o.stim)]);
  const rest = ORGANS.filter((o) => !chosen.includes(o));
  const distractors = rest.length ? [rng.pick(rng.pick(rest).stim)] : [];
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  for (let i = 0; i < pairs.length; i++)
    for (let j = 0; j < pairs.length; j++) {
      if (i === j) continue;
      const sw = organSwap(chosen[i].id, chosen[j].id);
      if (sw && i < j) wrong.push({ pairs: [[pairs[i][0], pairs[j][1]], [pairs[j][0], pairs[i][1]]], ...sw });
    }
  const m = match(pairs, distractors, wrong);
  return {
    instruction: tx("Match each sense organ to its stimulus", "Ordne jedem Sinnesorgan seinen Reiz zu"),
    text: tx("Which stimuli do these sense organs take in?", "Welche Reize nehmen diese Sinnesorgane auf?"),
    answer: m.answer,
    hint: tx("Ask yourself: what do I notice with it? Seeing, hearing, smelling, tasting, feeling, keeping balance.", "Frag dich: Was bemerke ich damit? Sehen, hören, riechen, schmecken, fühlen, das Gleichgewicht halten."),
    solution: [
      { math: cat(...pairs.flatMap(([o, s], i) => [q(o), "\\to", q(s), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Each kind of sensory cell responds to its own kind of stimulus.", "Jede Sorte Sinneszelle reagiert nur auf ihren passenden Reiz.") },
    ],
    mistakes: m.mistakes,
  };
}

type Scene = { organ: string; text: Text };
const SCENES: Scene[] = [
  { organ: "eye", text: tx("You see the traffic light turn green.", "Du siehst, dass die Ampel auf Grün springt.") },
  { organ: "eye", text: tx("You read a message on your phone.", "Du liest eine Nachricht auf dem Handy.") },
  { organ: "eye", text: tx("You spot a rainbow in the sky.", "Du entdeckst einen Regenbogen am Himmel.") },
  { organ: "ear", text: tx("Your alarm clock rings.", "Dein Wecker klingelt.") },
  { organ: "ear", text: tx("A friend calls your name from far away.", "Eine Freundin ruft von weitem deinen Namen.") },
  { organ: "ear", text: tx("A dog barks in the distance.", "In der Ferne bellt ein Hund.") },
  { organ: "nose", text: tx("The kitchen smells of pizza.", "Aus der Küche duftet es nach Pizza.") },
  { organ: "nose", text: tx("You notice that something is burning in the oven.", "Du riechst, dass im Ofen etwas anbrennt.") },
  { organ: "nose", text: tx("The rose smells lovely.", "Die Rose duftet herrlich.") },
  { organ: "tongue", text: tx("The lemon tastes sour.", "Die Zitrone schmeckt sauer.") },
  { organ: "tongue", text: tx("The soup is far too salty.", "Die Suppe ist viel zu salzig.") },
  { organ: "tongue", text: tx("The cocoa tastes sweet.", "Der Kakao schmeckt süß.") },
  { organ: "skin", text: tx("A mosquito bites your arm.", "Eine Mücke sticht dich in den Arm.") },
  { organ: "skin", text: tx("You feel the cold wind on your cheeks.", "Du spürst den kalten Wind auf den Wangen.") },
  { organ: "skin", text: tx("Someone taps you on the shoulder.", "Jemand tippt dir auf die Schulter.") },
  { organ: "skin", text: tx("Your fingers burn on the hot mug.", "Du verbrennst dir die Finger an der heißen Tasse.") },
  { organ: "balance", text: tx("With your eyes shut you notice the lift starting to move.", "Mit geschlossenen Augen merkst du, dass der Fahrstuhl losfährt.") },
  { organ: "balance", text: tx("You spin on the roundabout and feel it even with your eyes closed.", "Du drehst dich auf dem Karussell und merkst es sogar mit geschlossenen Augen.") },
];

function sceneTask(rng: Rng): Exercise {
  const sc = rng.pick(SCENES);
  const right = organ(sc.organ);
  const others = some(
    rng,
    ORGANS.filter((o) => o.id !== sc.organ && !(sc.organ === "balance" && o.id === "ear") && !(sc.organ === "ear" && o.id === "balance")),
    3,
  );
  const opts: Opt[] = [{ text: right.organ }, ...others.map((o) => ({ text: o.organ, ...(organSwap(sc.organ, o.id) ?? {}) }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Which sense organ?", "Welches Sinnesorgan?"),
    text: cat(sc.text, tx("Which sense organ takes in this stimulus?", "Welches Sinnesorgan nimmt diesen Reiz auf?")),
    answer: c.answer,
    hint: tx("First name the stimulus: light, sound, smell, taste, pressure, temperature, pain or movement?", "Nenne zuerst den Reiz: Licht, Schall, Duft, Geschmack, Druck, Temperatur, Schmerz oder Bewegung?"),
    solution: [answerFrame(right.organ, tx(`The stimulus is taken in by **${en(right.the)}** (${en(right.sense)}).`, `Den Reiz nimmt **${de(right.the)}** auf (${de(right.sense)}).`))],
    mistakes: c.mistakes,
  };
}

function stimulusTask(rng: Rng): Exercise {
  const o = rng.pick(ORGANS);
  const others = some(
    rng,
    ORGANS.filter((x) => x.id !== o.id),
    3,
  );
  const stim = rng.pick(o.stim);
  const opts: Opt[] = [{ text: stim }, ...others.map((x) => ({ text: rng.pick(x.stim), ...(organSwap(o.id, x.id) ?? {}) }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Which stimulus?", "Welcher Reiz?"),
    text: tx(`Which stimulus does **${en(o.the)}** respond to?`, `Auf welchen Reiz reagiert **${de(o.the)}**?`),
    answer: c.answer,
    hint: tx("Think of what you notice with this sense organ.", "Überleg, was du mit diesem Sinnesorgan bemerkst."),
    solution: [answerFrame(stim, tx(`The sensory cells of ${en(o.the)} respond to ${en(stim)}.`, `Die Sinneszellen von ${de(o.the).replace(/^das /, "dem ").replace(/^die /, "der ")} reagieren auf ${de(stim)}.`))],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// From stimulus to response

type Chain = { name: Text; steps: Text[] };
const CHAINS: Chain[] = [
  {
    name: tx("A ball flies towards you and you catch it.", "Ein Ball fliegt auf dich zu, und du fängst ihn."),
    steps: [
      tx("Light from the ball (stimulus)", "Licht vom Ball (Reiz)"),
      tx("The eye takes in the light", "Das Auge nimmt das Licht auf"),
      tx("The optic nerve carries the signal to the brain", "Der Sehnerv leitet die Erregung zum Gehirn"),
      tx("The brain recognises the ball and decides", "Das Gehirn erkennt den Ball und entscheidet"),
      tx("Nerves carry the command to the arm muscles", "Nerven leiten den Befehl zu den Armmuskeln"),
      tx("The arm muscles catch the ball (response)", "Die Armmuskeln fangen den Ball (Reaktion)"),
    ],
  },
  {
    name: tx("Your phone rings and you answer it.", "Dein Handy klingelt, und du gehst ran."),
    steps: [
      tx("The ringtone (stimulus)", "Der Klingelton (Reiz)"),
      tx("The ear takes in the sound", "Das Ohr nimmt den Schall auf"),
      tx("The auditory nerve carries the signal to the brain", "Der Hörnerv leitet die Erregung zum Gehirn"),
      tx("The brain recognises the ringtone and decides", "Das Gehirn erkennt den Klingelton und entscheidet"),
      tx("Nerves carry the command to the arm muscles", "Nerven leiten den Befehl zu den Armmuskeln"),
      tx("Your hand picks up the phone (response)", "Die Hand greift nach dem Handy (Reaktion)"),
    ],
  },
  {
    name: tx("It smells of pizza and you run to the kitchen.", "Es duftet nach Pizza, und du läufst in die Küche."),
    steps: [
      tx("The smell of pizza (stimulus)", "Der Pizzaduft (Reiz)"),
      tx("The nose takes in the smell", "Die Nase nimmt den Duft auf"),
      tx("The olfactory nerve carries the signal to the brain", "Der Riechnerv leitet die Erregung zum Gehirn"),
      tx("The brain recognises: pizza! And decides", "Das Gehirn erkennt: Pizza! Und entscheidet"),
      tx("Nerves carry the command to the leg muscles", "Nerven leiten den Befehl zu den Beinmuskeln"),
      tx("Your legs run to the kitchen (response)", "Die Beine laufen in die Küche (Reaktion)"),
    ],
  },
  {
    name: tx("The traffic light turns green and you cross the road.", "Die Ampel springt auf Grün, und du gehst über die Straße."),
    steps: [
      tx("Green light (stimulus)", "Grünes Licht (Reiz)"),
      tx("The eye takes in the light", "Das Auge nimmt das Licht auf"),
      tx("The optic nerve carries the signal to the brain", "Der Sehnerv leitet die Erregung zum Gehirn"),
      tx("The brain recognises green and decides to go", "Das Gehirn erkennt Grün und entscheidet: los!"),
      tx("Nerves carry the command to the leg muscles", "Nerven leiten den Befehl zu den Beinmuskeln"),
      tx("Your legs start walking (response)", "Die Beine setzen sich in Bewegung (Reaktion)"),
    ],
  },
  {
    name: tx("Someone taps your shoulder and you turn round.", "Jemand tippt dir auf die Schulter, und du drehst dich um."),
    steps: [
      tx("A tap on the shoulder (stimulus)", "Ein Tippen auf die Schulter (Reiz)"),
      tx("The skin feels the touch", "Die Haut spürt die Berührung"),
      tx("Nerves carry the signal to the brain", "Nerven leiten die Erregung zum Gehirn"),
      tx("The brain recognises the touch and decides", "Das Gehirn erkennt die Berührung und entscheidet"),
      tx("Nerves carry the command to the neck muscles", "Nerven leiten den Befehl zu den Halsmuskeln"),
      tx("You turn your head (response)", "Du drehst den Kopf (Reaktion)"),
    ],
  },
];

function chainExercise(ch: Chain): Exercise {
  const s = ch.steps;
  const o = order(s, [
    { items: [s[3], s[1]], title: tx("Brain before the sense organ", "Gehirn vor dem Sinnesorgan"), say: tx("The brain can only work on something once a sense organ has taken in the stimulus and sent a signal.", "Das Gehirn kann erst etwas auswerten, wenn ein Sinnesorgan den Reiz aufgenommen und eine Erregung losgeschickt hat.") },
    { items: [s[5], s[3]], title: tx("Muscle before the brain", "Muskel vor dem Gehirn"), say: tx("Muscles don't move on their own here: first the brain decides, then nerves carry the command to the muscle.", "Die Muskeln bewegen sich hier nicht von allein: Erst entscheidet das Gehirn, dann leiten Nerven den Befehl zum Muskel.") },
    { items: [s[3], s[2]], title: tx("The nerve comes first", "Erst kommt der Nerv"), say: tx("Between the sense organ and the brain there's a nerve. Without it, the signal never reaches the brain.", "Zwischen Sinnesorgan und Gehirn liegt ein Nerv. Ohne ihn kommt die Erregung gar nicht im Gehirn an.") },
    { items: [s[5], s[4]], title: tx("The nerve comes first", "Erst kommt der Nerv"), say: tx("The muscle needs a command first, and that arrives through a nerve from the brain.", "Der Muskel braucht zuerst einen Befehl, und der kommt über einen Nerv vom Gehirn.") },
  ]);
  return {
    instruction: tx("From stimulus to response", "Vom Reiz zur Reaktion"),
    text: cat(ch.name, tx("Put the steps in the right order.", "Bring die Schritte in die richtige Reihenfolge.")),
    answer: o.answer,
    hint: tx("Stimulus → sense organ → nerve → brain → nerve → muscle.", "Reiz → Sinnesorgan → Nerv → Gehirn → Nerv → Muskel."),
    solution: [
      { math: flow([tx("stimulus", "Reiz"), tx("sense organ", "Sinnesorgan"), tx("nerve", "Nerv"), tx("brain", "Gehirn"), tx("nerve", "Nerv"), tx("muscle", "Muskel")]), note: tx("It always works like this: the sense organ takes in the stimulus, a nerve carries the signal to the brain, the brain decides, and a nerve carries the command to the muscle.", "Es läuft immer so: Das Sinnesorgan nimmt den Reiz auf, ein Nerv leitet die Erregung zum Gehirn, das Gehirn entscheidet, und ein Nerv leitet den Befehl zum Muskel.") },
    ],
    mistakes: o.mistakes,
  };
}
const chainTask = (rng: Rng) => chainExercise(rng.pick(CHAINS));

// ---------------------------------------------------------------------------
// The eye

type EyePart = { id: string; name: Text; the: Text; accept: Text[]; job: Text; desc: Text };
const EYE: EyePart[] = [
  { id: "cornea", name: tx("cornea", "Hornhaut"), the: tx("the cornea", "die Hornhaut"), accept: [tx("cornea", "Hornhaut")], job: tx("clear window at the front, bends the light", "durchsichtiges Fenster vorn, bricht das Licht"), desc: tx("the clear, curved window at the very front of the eye", "die durchsichtige, gewölbte Haut ganz vorn am Auge") },
  { id: "iris", name: tx("iris", "Iris"), the: tx("the iris", "die Iris"), accept: [tx("iris", "Iris"), "Regenbogenhaut"], job: tx("makes the pupil narrower or wider", "macht die Pupille enger oder weiter"), desc: tx("the coloured ring that gives the eye its colour", "der farbige Ring, der dem Auge seine Farbe gibt") },
  { id: "pupil", name: tx("pupil", "Pupille"), the: tx("the pupil", "die Pupille"), accept: [tx("pupil", "Pupille"), "Sehloch"], job: tx("opening that lets light into the eye", "Öffnung, durch die Licht ins Auge fällt"), desc: tx("the black hole in the middle of the iris", "das schwarze Loch in der Mitte der Iris") },
  { id: "lens", name: tx("lens", "Linse"), the: tx("the lens", "die Linse"), accept: [tx("lens", "Linse"), "Augenlinse"], job: tx("focuses the image sharply", "stellt das Bild scharf"), desc: tx("clear and elastic, right behind the pupil; it focuses the light", "durchsichtig und elastisch, direkt hinter der Pupille; sie bündelt das Licht") },
  { id: "vitreous", name: tx("vitreous body", "Glaskörper"), the: tx("the vitreous body", "der Glaskörper"), accept: [tx("vitreous body", "Glaskörper"), "vitreous", "vitreous humour"], job: tx("fills the eye and keeps it round", "füllt das Auge und hält es rund"), desc: tx("the clear jelly that fills the inside of the eye", "die durchsichtige Gallerte, die das Augeninnere füllt") },
  { id: "retina", name: tx("retina", "Netzhaut"), the: tx("the retina", "die Netzhaut"), accept: [tx("retina", "Netzhaut")], job: tx("turns light into nerve signals", "wandelt Licht in Erregungen um"), desc: tx("the layer at the back of the eye with the light-sensitive cells", "die Schicht hinten im Auge mit den Lichtsinneszellen") },
  { id: "fovea", name: tx("yellow spot", "Gelber Fleck"), the: tx("the yellow spot", "der gelbe Fleck"), accept: [tx("yellow spot", "gelber Fleck"), "fovea", "Sehgrube"], job: tx("spot of sharpest vision", "Stelle des schärfsten Sehens"), desc: tx("the spot of sharpest vision, right opposite the pupil", "die Stelle des schärfsten Sehens, genau gegenüber der Pupille") },
  { id: "blindspot", name: tx("blind spot", "Blinder Fleck"), the: tx("the blind spot", "der blinde Fleck"), accept: [tx("blind spot", "blinder Fleck")], job: tx("where the optic nerve leaves: no sensory cells", "Austritt des Sehnervs, ohne Sinneszellen"), desc: tx("the spot without sensory cells where the optic nerve leaves the eye", "die Stelle ohne Sinneszellen, an der der Sehnerv das Auge verlässt") },
  { id: "opticnerve", name: tx("optic nerve", "Sehnerv"), the: tx("the optic nerve", "der Sehnerv"), accept: [tx("optic nerve", "Sehnerv")], job: tx("carries the signals to the brain", "leitet die Erregungen zum Gehirn"), desc: tx("the cable that carries the signals from the eye to the brain", "das „Kabel“, das die Erregungen vom Auge zum Gehirn leitet") },
  { id: "sclera", name: tx("sclera", "Lederhaut"), the: tx("the sclera", "die Lederhaut"), accept: [tx("sclera", "Lederhaut"), "white of the eye"], job: tx("tough white outer coat that protects the eye", "feste, weiße Hülle, die das Auge schützt"), desc: tx("the tough white outer coat of the eye", "die feste, weiße äußere Hülle des Auges") },
];
const eye = (id: string) => EYE.find((e) => e.id === id)!;

/** What Blob says when part `got` is named instead of part `want`. */
function eyeMix(want: string, got: string): { title: Text; say: Text } | null {
  const key = `${want}>${got}`;
  const M: Record<string, { title: Text; say: Text }> = {
    "iris>pupil": { title: tx("That's the hole", "Das ist das Loch"), say: tx("The pupil is only the hole. The coloured ring around it, with the muscles, is the **iris**.", "Die Pupille ist nur das Loch. Der farbige Ring drumherum, mit den Muskeln, ist die **Iris**.") },
    "pupil>iris": { title: tx("That's the ring", "Das ist der Ring"), say: tx("The iris is the coloured ring. The hole in its middle, where the light goes in, is the **pupil**.", "Die Iris ist der farbige Ring. Das Loch in ihrer Mitte, durch das das Licht fällt, ist die **Pupille**.") },
    "lens>cornea": { title: tx("Both bend light", "Beide brechen Licht"), say: tx("The cornea bends light too, but it sits right at the front. The part behind the pupil that focuses is the **lens**.", "Die Hornhaut bricht das Licht zwar auch, sie sitzt aber ganz vorn. Das Teil hinter der Pupille, das scharf stellt, ist die **Linse**.") },
    "cornea>lens": { title: tx("The lens is further in", "Die Linse liegt weiter innen"), say: tx("The lens sits behind the pupil. The clear window at the very front is the **cornea**.", "Die Linse liegt hinter der Pupille. Das durchsichtige Fenster ganz vorn ist die **Hornhaut**.") },
    "lens>vitreous": { title: tx("The jelly fills the eye", "Die Gallerte füllt das Auge"), say: tx("The vitreous body fills the whole eye. The small elastic part right behind the pupil is the **lens**.", "Der Glaskörper füllt das ganze Auge. Das kleine, elastische Teil direkt hinter der Pupille ist die **Linse**.") },
    "vitreous>lens": { title: tx("The lens is smaller", "Die Linse ist kleiner"), say: tx("The lens is the small part behind the pupil. The clear jelly filling the eye is the **vitreous body**.", "Die Linse ist das kleine Teil hinter der Pupille. Die durchsichtige Gallerte, die das Auge füllt, ist der **Glaskörper**.") },
    "fovea>blindspot": { title: tx("Sharpest, not blind", "Am schärfsten, nicht blind"), say: tx("Careful, these two are opposites: at the blind spot you see nothing; at the **yellow spot** you see most sharply.", "Vorsicht, die beiden sind Gegensätze: Am blinden Fleck siehst du nichts, am **gelben Fleck** am schärfsten.") },
    "blindspot>fovea": { title: tx("Blind, not sharpest", "Blind, nicht am schärfsten"), say: tx("Careful, these two are opposites: the yellow spot is where you see most sharply. Where the optic nerve leaves, there's the **blind spot**.", "Vorsicht, die beiden sind Gegensätze: Am gelben Fleck siehst du am schärfsten. Wo der Sehnerv austritt, liegt der **blinde Fleck**.") },
    "retina>opticnerve": { title: tx("The nerve only carries", "Der Nerv leitet nur weiter"), say: tx("The optic nerve only carries the signals. The light is turned into signals by the sensory cells of the **retina**.", "Der Sehnerv leitet die Erregungen nur weiter. In Erregungen umgewandelt wird das Licht von den Sinneszellen der **Netzhaut**.") },
    "opticnerve>retina": { title: tx("The retina only turns light into signals", "Die Netzhaut wandelt nur um"), say: tx("The retina turns light into signals. The cable that carries them to the brain is the **optic nerve**.", "Die Netzhaut wandelt Licht in Erregungen um. Das „Kabel“, das sie zum Gehirn bringt, ist der **Sehnerv**.") },
    "sclera>cornea": { title: tx("The white part", "Der weiße Teil"), say: tx("The cornea is the clear part at the front. The tough white coat around the rest of the eye is the **sclera**.", "Die Hornhaut ist der durchsichtige Teil vorn. Die feste weiße Hülle um den Rest des Auges ist die **Lederhaut**.") },
    "cornea>sclera": { title: tx("The clear part", "Der durchsichtige Teil"), say: tx("The sclera is white and not see-through. The clear front window that lets light in is the **cornea**.", "Die Lederhaut ist weiß und undurchsichtig. Das durchsichtige Fenster vorn, das Licht hereinlässt, ist die **Hornhaut**.") },
  };
  return M[key] ?? null;
}

function eyeNameTask(rng: Rng, fixed?: string): Exercise {
  const part = fixed ? eye(fixed) : rng.pick(EYE);
  const wrong = EYE.filter((e) => e.id !== part.id)
    .map((e) => ({ e, mix: eyeMix(part.id, e.id) }))
    .filter((x) => x.mix)
    .map((x) => ({ accept: x.e.accept, ...x.mix! }));
  const w = word(part.accept, wrong, tx("name of the part", "Name des Teils"));
  return {
    instruction: tx("Name the part of the eye", "Benenne den Teil des Auges"),
    text: tx("What is the part marked with **?** called?", "Wie heißt der Teil, der mit **?** markiert ist?"),
    visual: pic(NerveEye, { mode: "numbers", show: EYE_BASIC, ask: part.id, legend: "none", pupil: 0.5 }),
    answer: w.answer,
    hint: tx("Follow the light: cornea, pupil, lens, vitreous body, retina, optic nerve.", "Folge dem Licht: Hornhaut, Pupille, Linse, Glaskörper, Netzhaut, Sehnerv."),
    solution: [answerFrame(part.name, tx(`That's **${en(part.the)}**: ${en(part.job)}.`, `Das ist **${de(part.the)}**: ${de(part.job)}.`))],
    mistakes: w.mistakes,
  };
}

function eyeDescribeTask(rng: Rng): Exercise {
  const part = rng.pick(EYE);
  const pool = EYE.filter((e) => e.id !== part.id);
  const tempting = pool.filter((e) => eyeMix(part.id, e.id));
  const others = [...some(rng, tempting, Math.min(2, tempting.length))];
  for (const e of rng.shuffle(pool)) if (others.length < 3 && !others.includes(e)) others.push(e);
  const c = choice(rng, [{ text: part.name }, ...others.map((e) => ({ text: e.name, ...(eyeMix(part.id, e.id) ?? {}) }))]);
  return {
    instruction: tx("Which part of the eye?", "Welcher Teil des Auges?"),
    text: tx(`Which part of the eye is ${en(part.desc)}?`, `Welcher Teil des Auges ist ${de(part.desc)}?`),
    answer: c.answer,
    hint: tx("Picture the eye in section and follow the light from front to back.", "Stell dir das Auge im Schnitt vor und folge dem Licht von vorn nach hinten."),
    solution: [answerFrame(part.name, tx(`It's **${en(part.the)}**. Its job: ${en(part.job)}.`, `Es ist **${de(part.the)}**. Aufgabe: ${de(part.job)}.`))],
    mistakes: c.mistakes,
  };
}

function eyeMatchTask(rng: Rng): Exercise {
  const chosen = some(rng, EYE, 4);
  const pairs: [Text, Text][] = chosen.map((e) => [e.name, e.job]);
  const rest = EYE.filter((e) => !chosen.includes(e));
  const distractors = [rng.pick(rest).job];
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  chosen.forEach((a) =>
    chosen.forEach((b) => {
      if (a === b) return;
      const mix = eyeMix(a.id, b.id);
      if (mix) wrong.push({ pairs: [[b.name, a.job]], ...mix });
    }),
  );
  const m = match(pairs, distractors, wrong);
  return {
    instruction: tx("Match the parts of the eye to their jobs", "Ordne den Teilen des Auges ihre Aufgaben zu"),
    text: tx("What does each part of the eye do?", "Was macht welcher Teil des Auges?"),
    answer: m.answer,
    hint: tx("One job is left over.", "Eine Aufgabe bleibt übrig."),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Every part of the eye has its own job on the way from light to signal.", "Jeder Teil des Auges hat seine eigene Aufgabe auf dem Weg vom Licht zur Erregung.") }],
    mistakes: m.mistakes,
  };
}

const LIGHT: Text[] = [tx("cornea", "Hornhaut"), tx("pupil", "Pupille"), tx("lens", "Linse"), tx("vitreous body", "Glaskörper"), tx("retina", "Netzhaut"), tx("optic nerve", "Sehnerv")];
const SOUND: Text[] = [tx("outer ear (pinna)", "Ohrmuschel"), tx("ear canal", "Gehörgang"), tx("eardrum", "Trommelfell"), tx("ossicles (hammer, anvil, stirrup)", "Gehörknöchelchen (Hammer, Amboss, Steigbügel)"), tx("cochlea", "Schnecke"), tx("auditory nerve", "Hörnerv")];

function pathTask(rng: Rng, kind: "light" | "sound"): Exercise {
  const all = kind === "light" ? LIGHT : SOUND;
  const len = rng.int(4, 6);
  const start = rng.int(0, all.length - len);
  const items = all.slice(start, start + len);
  const L = (i: number) => all[i];
  const wrong =
    kind === "light"
      ? [
          { items: [L(2), L(1)], title: tx("Lens before the pupil", "Linse vor der Pupille"), say: tx("The lens lies **behind** the pupil: the light first passes the hole in the iris, then the lens.", "Die Linse liegt **hinter** der Pupille: Das Licht fällt erst durch das Loch in der Iris, dann durch die Linse.") },
          { items: [L(2), L(0)], title: tx("The cornea is at the front", "Die Hornhaut ist ganz vorn"), say: tx("The cornea is the very first thing the light passes: it's the clear window at the front of the eye.", "Die Hornhaut ist das Allererste, was das Licht durchquert: Sie ist das durchsichtige Fenster vorn am Auge.") },
          { items: [L(4), L(3)], title: tx("Vitreous body before retina", "Erst der Glaskörper"), say: tx("Behind the lens the light crosses the vitreous body and only then reaches the retina at the back.", "Hinter der Linse durchquert das Licht den Glaskörper und trifft erst dann hinten auf die Netzhaut.") },
          { items: [L(5), L(4)], title: tx("First the retina", "Erst die Netzhaut"), say: tx("The optic nerve can only carry signals once the retina has turned the light into signals.", "Der Sehnerv kann erst etwas weiterleiten, wenn die Netzhaut das Licht in Erregungen umgewandelt hat.") },
        ]
      : [
          { items: [L(3), L(2)], title: tx("First the eardrum", "Erst das Trommelfell"), say: tx("The sound first makes the **eardrum** vibrate. Only then do the ossicles pass the vibrations on.", "Der Schall bringt zuerst das **Trommelfell** zum Schwingen. Erst dann leiten die Gehörknöchelchen die Schwingungen weiter.") },
          { items: [L(4), L(3)], title: tx("The cochlea is deepest", "Die Schnecke liegt ganz innen"), say: tx("The cochlea lies in the inner ear, behind the ossicles. The ossicles pass the vibrations on to it.", "Die Schnecke liegt im Innenohr, hinter den Gehörknöchelchen. Die Gehörknöchelchen geben die Schwingungen an sie weiter.") },
          { items: [L(1), L(0)], title: tx("The pinna catches the sound", "Die Ohrmuschel fängt den Schall"), say: tx("The outer ear catches the sound and funnels it into the ear canal.", "Die Ohrmuschel fängt den Schall auf und leitet ihn in den Gehörgang.") },
          { items: [L(5), L(4)], title: tx("First the cochlea", "Erst die Schnecke"), say: tx("The auditory nerve only carries signals once the sensory cells in the cochlea have formed them.", "Der Hörnerv leitet erst Erregungen weiter, wenn die Sinneszellen in der Schnecke sie gebildet haben.") },
        ];
  const o = order(items, wrong);
  return {
    instruction: kind === "light" ? tx("Follow the light into the eye", "Verfolge das Licht durchs Auge") : tx("Follow the sound into the ear", "Verfolge den Schall durchs Ohr"),
    text:
      kind === "light"
        ? tx("Put the parts in the order in which the light (or its signal) passes through them.", "Bring die Teile in die Reihenfolge, in der das Licht (bzw. seine Erregung) sie durchläuft.")
        : tx("Put the parts in the order in which the sound (or its signal) passes through them.", "Bring die Teile in die Reihenfolge, in der der Schall (bzw. seine Erregung) sie durchläuft."),
    answer: o.answer,
    hint: kind === "light" ? tx("From the front of the eye to the back, then to the brain.", "Von vorn nach hinten durchs Auge, dann zum Gehirn.") : tx("From outside to inside: outer ear, middle ear, inner ear.", "Von außen nach innen: Außenohr, Mittelohr, Innenohr."),
    solution: [
      {
        math: flow(items),
        note:
          kind === "light"
            ? tx("The light passes cornea, pupil, lens and vitreous body. On the retina sensory cells turn it into signals, which the optic nerve carries to the brain.", "Das Licht durchläuft Hornhaut, Pupille, Linse und Glaskörper. Auf der Netzhaut wandeln Sinneszellen es in Erregungen um, die der Sehnerv zum Gehirn leitet.")
            : tx("Sound makes the eardrum vibrate; the ossicles pass this on to the cochlea, where sensory cells form signals for the auditory nerve.", "Der Schall bringt das Trommelfell zum Schwingen; die Gehörknöchelchen geben das an die Schnecke weiter, wo Sinneszellen Erregungen für den Hörnerv bilden."),
      },
    ],
    mistakes: o.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Pupil and reflexes

const PUPIL_SCENES: { text: Text; bright: boolean }[] = [
  { text: tx("You walk out of a dark cinema into bright sunshine.", "Du kommst aus dem dunklen Kino in die helle Sonne."), bright: true },
  { text: tx("In the evening you switch off the light in your room.", "Abends machst du in deinem Zimmer das Licht aus."), bright: false },
  { text: tx("The doctor shines a torch into your eye.", "Die Ärztin leuchtet dir mit einer Taschenlampe ins Auge."), bright: true },
  { text: tx("You walk through a dark park at night.", "Du gehst nachts durch einen dunklen Park."), bright: false },
  { text: tx("You look at a snowy ski slope in the sun.", "Du schaust auf eine verschneite Skipiste in der Sonne."), bright: true },
  { text: tx("You go down into a dark cellar.", "Du gehst in einen dunklen Keller."), bright: false },
];

function pupilTask(rng: Rng): Exercise {
  const sc = rng.pick(PUPIL_SCENES);
  const narrow = tx("The pupil gets narrower (smaller).", "Die Pupille wird enger (kleiner).");
  const wide = tx("The pupil gets wider (bigger).", "Die Pupille wird weiter (größer).");
  const opts: Opt[] = [
    { text: sc.bright ? narrow : wide },
    {
      text: sc.bright ? wide : narrow,
      title: tx("Exactly the other way round", "Genau andersherum"),
      say: sc.bright
        ? tx("Other way round! In bright light the iris makes the pupil **narrower**, so that the retina isn't dazzled.", "Andersherum! Bei hellem Licht macht die Iris die Pupille **enger**, damit die Netzhaut nicht geblendet wird.")
        : tx("Other way round! In the dark the pupil gets **wider**, so that more light can get in.", "Andersherum! Im Dunkeln wird die Pupille **weiter**, damit mehr Licht hineinfällt."),
    },
    { text: tx("The pupil stays the same size.", "Die Pupille bleibt gleich groß."), title: tx("The pupil reacts", "Die Pupille reagiert"), say: tx("The pupil always reacts to brightness: that's the pupillary reflex. It happens on its own.", "Die Pupille reagiert immer auf Helligkeit: Das ist der Pupillenreflex. Er läuft ganz von allein ab.") },
    { text: tx("The lens gets thicker.", "Die Linse wird dicker."), title: tx("The lens focuses", "Die Linse stellt scharf"), say: tx("The lens is for focusing, not for brightness. The amount of light is controlled by the iris and the pupil.", "Die Linse ist fürs Scharfstellen da, nicht für die Helligkeit. Die Lichtmenge regeln Iris und Pupille.") },
  ];
  const c = choice(rng, opts);
  return {
    instruction: tx("Pupillary reflex", "Pupillenreflex"),
    text: cat(sc.text, tx("What happens to your pupils?", "Was passiert mit deinen Pupillen?")),
    answer: c.answer,
    hint: tx("Too much light dazzles, too little and you can't see much. What does the iris do?", "Zu viel Licht blendet, zu wenig und du siehst kaum etwas. Was macht die Iris?"),
    solution: [answerFrame(sc.bright ? tx("pupil narrower", "Pupille enger") : tx("pupil wider", "Pupille weiter"), sc.bright ? tx("Bright: the iris narrows the pupil, less light gets in.", "Hell: Die Iris macht die Pupille eng, es fällt weniger Licht ein.") : tx("Dark: the iris widens the pupil, more light gets in.", "Dunkel: Die Iris macht die Pupille weit, es fällt mehr Licht ein."))],
    mistakes: c.mistakes,
  };
}

type Act = { text: Text; short: Text; reflex: boolean };
const ACTS: Act[] = [
  { text: tx("Your eyelid snaps shut when a fly comes close to your eye.", "Dein Lid schließt sich, als eine Fliege nah ans Auge kommt."), short: tx("blink reflex", "Lidschlussreflex"), reflex: true },
  { text: tx("You sneeze because of dust in your nose.", "Du niest wegen Staub in der Nase."), short: tx("sneezing", "Niesen"), reflex: true },
  { text: tx("You cough after swallowing the wrong way.", "Du hustest, weil du dich verschluckt hast."), short: tx("coughing", "Husten"), reflex: true },
  { text: tx("Your pupils get narrower in bright sunlight.", "Deine Pupillen werden im grellen Sonnenlicht eng."), short: tx("pupillary reflex", "Pupillenreflex"), reflex: true },
  { text: tx("Your hand jerks back from the hot plate.", "Deine Hand zuckt von der heißen Herdplatte zurück."), short: tx("withdrawal reflex", "Rückziehreflex"), reflex: true },
  { text: tx("Your leg kicks forward when the doctor taps below your knee.", "Dein Bein schnellt vor, als die Ärztin unters Knie klopft."), short: tx("knee-jerk reflex", "Kniesehnenreflex"), reflex: true },
  { text: tx("A baby grips a finger that touches its palm.", "Ein Baby umklammert einen Finger, der seine Handfläche berührt."), short: tx("grasp reflex", "Greifreflex"), reflex: true },
  { text: tx("You catch a ball that is thrown to you.", "Du fängst einen Ball, der dir zugeworfen wird."), short: tx("catching", "Fangen"), reflex: false },
  { text: tx("You put your hand up in class.", "Du meldest dich im Unterricht."), short: tx("putting your hand up", "Melden"), reflex: false },
  { text: tx("You cross the road when the light turns green.", "Du gehst über die Straße, als die Ampel grün wird."), short: tx("crossing the road", "Losgehen"), reflex: false },
  { text: tx("You answer your ringing phone.", "Du nimmst das klingelnde Handy ab."), short: tx("answering the phone", "Telefonieren"), reflex: false },
  { text: tx("You write a message to a friend.", "Du schreibst einer Freundin eine Nachricht."), short: tx("writing", "Schreiben"), reflex: false },
  { text: tx("You press the buzzer in a quiz as soon as you know the answer.", "Du drückst beim Quiz auf den Buzzer, sobald du die Antwort weißt."), short: tx("pressing the buzzer", "Buzzer drücken"), reflex: false },
];
const REFLEX = tx("a reflex", "ein Reflex");
const CONSCIOUS = tx("a conscious reaction", "eine bewusste Reaktion");

function reflexOrNotTask(rng: Rng): Exercise {
  const a = rng.pick(ACTS);
  const opts: Opt[] = a.reflex
    ? [{ text: REFLEX }, { text: CONSCIOUS, title: tx("That happens by itself", "Das passiert von allein"), say: tx("You don't decide this: it happens automatically, very fast and always the same way. That's a **reflex**.", "Das entscheidest du nicht: Es passiert automatisch, sehr schnell und immer gleich. Das ist ein **Reflex**.") }]
    : [{ text: CONSCIOUS }, { text: REFLEX, title: tx("Fast isn't a reflex", "Schnell heißt nicht Reflex"), say: tx("You decide to do this: your brain works out the situation first. Even when it's quick, it's a **conscious reaction**, not a reflex.", "Dafür entscheidest du dich: Dein Gehirn wertet die Lage erst aus. Auch wenn es schnell geht, ist das eine **bewusste Reaktion**, kein Reflex.") }];
  const c = choice(rng, opts);
  return {
    instruction: tx("Reflex or not?", "Reflex oder nicht?"),
    text: cat(a.text, tx("What is this?", "Was ist das?")),
    answer: c.answer,
    hint: tx("A reflex is fast, unconscious and always the same. You don't have to think about it.", "Ein Reflex ist schnell, unbewusst und immer gleich. Du musst nicht darüber nachdenken."),
    solution: [answerFrame(a.reflex ? REFLEX : CONSCIOUS, a.reflex ? tx("It happens automatically and protects you: a reflex.", "Es läuft automatisch ab und schützt dich: ein Reflex.") : tx("You decide to do it, so your brain is involved: a conscious reaction.", "Du entscheidest dich bewusst dafür, das Gehirn ist beteiligt: eine bewusste Reaktion."))],
    mistakes: c.mistakes,
  };
}

function reflexMultiTask(rng: Rng, fixed?: number[]): Exercise {
  const reflexes = ACTS.filter((a) => a.reflex);
  const others = ACTS.filter((a) => !a.reflex);
  const nr = fixed ? 3 : rng.int(2, 3);
  const picked = fixed ? fixed.map((i) => ACTS[i]) : [...some(rng, reflexes, nr), ...some(rng, others, 5 - nr)];
  const items = picked.map((a) => ({ text: a.text, ok: a.reflex }));
  const okIdx = items.map((it, i) => (it.ok ? i : -1)).filter((i) => i >= 0);
  const badIdx = items.map((it, i) => (!it.ok ? i : -1)).filter((i) => i >= 0);
  const m = multi(fixed ? null : rng, items, [
    { pick: [...okIdx, badIdx[0]], title: tx("One isn't a reflex", "Eins ist kein Reflex"), say: tx("All your reflexes are right, but one of your picks is a conscious action: you decide to do it, so your brain is asked first.", "Deine Reflexe stimmen alle, aber eins davon ist eine bewusste Handlung: Dafür entscheidest du dich, das Gehirn wird zuerst gefragt.") },
    { pick: badIdx, title: tx("Exactly the other way round", "Genau andersherum"), say: tx("You picked the conscious actions. Reflexes are the ones that happen by themselves, fast and always the same: blinking, sneezing, coughing…", "Du hast die bewussten Handlungen gewählt. Reflexe sind die, die von allein ablaufen, schnell und immer gleich: Blinzeln, Niesen, Husten …") },
  ]);
  return {
    instruction: tx("Pick all the reflexes", "Wähle alle Reflexe"),
    text: tx("Which of these reactions are reflexes?", "Welche dieser Reaktionen sind Reflexe?"),
    answer: m.answer,
    hint: tx("Reflexes happen without you thinking. Would you have to decide to do it?", "Reflexe laufen ab, ohne dass du nachdenkst. Müsstest du dich dafür entscheiden?"),
    solution: [{ math: cat(...picked.filter((a) => a.reflex).flatMap((a, i, arr) => [q(a.short), i < arr.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Reflexes are fast, unconscious, always the same, and they usually protect you. The others are actions you choose.", "Reflexe sind schnell, unbewusst, immer gleich und meist schützen sie dich. Die anderen sind Handlungen, für die du dich entscheidest.") }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Facts about seeing and hearing

type Fact = { q: Text; opts: Opt[]; hint: Text; answer: Text; note: Text };
const FACTS: Fact[] = [
  {
    q: tx("Where does the image form in the eye?", "Wo entsteht im Auge das Bild?"),
    opts: [
      { text: tx("on the retina", "auf der Netzhaut") },
      { text: tx("on the lens", "auf der Linse"), title: tx("The lens only bends", "Die Linse bricht nur"), say: tx("The lens bends the light, but the image forms behind it, on the **retina**.", "Die Linse bricht das Licht, das Bild entsteht aber dahinter, auf der **Netzhaut**.") },
      { text: tx("on the cornea", "auf der Hornhaut"), title: tx("The cornea is the window", "Die Hornhaut ist das Fenster"), say: tx("The cornea is the clear window at the front. The image forms at the back, on the retina.", "Die Hornhaut ist das durchsichtige Fenster vorn. Das Bild entsteht hinten, auf der Netzhaut.") },
      { text: tx("in the vitreous body", "im Glaskörper") },
    ],
    hint: tx("Where are the light-sensitive cells?", "Wo sitzen die Lichtsinneszellen?"),
    answer: tx("retina", "Netzhaut"),
    note: tx("The image forms on the **retina**, where the light-sensitive cells are.", "Das Bild entsteht auf der **Netzhaut**, dort sitzen die Lichtsinneszellen."),
  },
  {
    q: tx("What does the image on the retina look like?", "Wie sieht das Bild auf der Netzhaut aus?"),
    opts: [
      { text: tx("smaller and upside down", "verkleinert und auf dem Kopf stehend") },
      { text: tx("exactly like the object", "genau wie der Gegenstand"), title: tx("It's upside down", "Es steht auf dem Kopf"), say: tx("The lens turns the image upside down. Only the brain makes sure you see the world the right way up.", "Die Linse stellt das Bild auf den Kopf. Erst das Gehirn sorgt dafür, dass du die Welt richtig herum siehst.") },
      { text: tx("bigger and the right way up", "vergrößert und aufrecht"), title: tx("Smaller and upside down", "Kleiner und verdreht"), say: tx("The image on the retina is tiny and upside down. The brain turns it round for you.", "Das Bild auf der Netzhaut ist winzig und steht auf dem Kopf. Das Gehirn dreht es für dich um.") },
    ],
    hint: tx("The lens works like a magnifying glass that projects an image.", "Die Linse wirkt wie eine Lupe, die ein Bild wirft."),
    answer: tx("smaller and upside down", "verkleinert und umgedreht"),
    note: tx("The lens makes a small, **upside-down** image on the retina. The brain turns it the right way up.", "Die Linse erzeugt auf der Netzhaut ein kleines, **umgedrehtes** Bild. Das Gehirn dreht es richtig herum."),
  },
  {
    q: tx("Where do you actually 'see'?", "Wo wird eigentlich „gesehen“?"),
    opts: [
      { text: tx("in the brain", "im Gehirn") },
      { text: tx("in the lens", "in der Linse"), title: tx("The lens only bends", "Die Linse bricht nur"), say: tx("The lens only focuses the light. What you see is put together in the brain.", "Die Linse bündelt nur das Licht. Was du siehst, entsteht im Gehirn.") },
      { text: tx("in the optic nerve", "im Sehnerv"), title: tx("The nerve only carries", "Der Nerv leitet nur"), say: tx("The optic nerve only carries the signals. The picture you see is made in the **brain**.", "Der Sehnerv leitet die Erregungen nur weiter. Das Bild, das du wahrnimmst, entsteht im **Gehirn**.") },
      { text: tx("in the pupil", "in der Pupille"), title: tx("The pupil is a hole", "Die Pupille ist ein Loch"), say: tx("The pupil is just the opening that lets light in. You see with your brain.", "Die Pupille ist nur die Öffnung, die Licht hereinlässt. Gesehen wird mit dem Gehirn.") },
    ],
    hint: tx("The eye delivers signals. Who makes sense of them?", "Das Auge liefert Erregungen. Wer macht daraus etwas Sinnvolles?"),
    answer: tx("in the brain", "im Gehirn"),
    note: tx("The eye only delivers signals. The picture you see is made in the **brain**.", "Das Auge liefert nur Erregungen. Das Bild, das du siehst, entsteht im **Gehirn**."),
  },
  {
    q: tx("Why can't you see anything at the blind spot?", "Warum siehst du am blinden Fleck nichts?"),
    opts: [
      { text: tx("There are no sensory cells there, because the optic nerve leaves the eye there.", "Dort gibt es keine Sinneszellen, weil der Sehnerv dort das Auge verlässt.") },
      { text: tx("No light ever falls there.", "Dorthin fällt nie Licht."), title: tx("Light does get there", "Licht kommt schon hin"), say: tx("Light does fall there, but there are no sensory cells to take it in.", "Licht fällt schon dorthin, aber es gibt keine Sinneszellen, die es aufnehmen könnten.") },
      { text: tx("The lens covers this spot.", "Die Linse verdeckt diese Stelle."), title: tx("The lens is at the front", "Die Linse ist vorn"), say: tx("The lens sits at the front and lets light through. The blind spot is at the back, where the optic nerve leaves.", "Die Linse sitzt vorn und lässt Licht durch. Der blinde Fleck liegt hinten, wo der Sehnerv austritt.") },
      { text: tx("The cells there are asleep.", "Die Zellen dort schlafen."), title: tx("No cells at all", "Gar keine Zellen"), say: tx("There aren't any sensory cells there at all: that's where the optic nerve leaves the eye.", "Dort gibt es überhaupt keine Sinneszellen: An dieser Stelle verlässt der Sehnerv das Auge.") },
    ],
    hint: tx("What leaves the eye at this spot?", "Was verlässt an dieser Stelle das Auge?"),
    answer: tx("no sensory cells", "keine Sinneszellen"),
    note: tx("Where the optic nerve leaves the eye there's no room for sensory cells: the **blind spot**.", "Wo der Sehnerv das Auge verlässt, ist kein Platz für Sinneszellen: der **blinde Fleck**."),
  },
  {
    q: tx("Why does the pupil look black?", "Warum sieht die Pupille schwarz aus?"),
    opts: [
      { text: tx("It's a hole: light goes in and hardly any comes back out.", "Sie ist ein Loch: Licht fällt hinein und kaum etwas kommt zurück.") },
      { text: tx("It's filled with black dye.", "Sie ist mit schwarzem Farbstoff gefüllt."), title: tx("It's a hole", "Es ist ein Loch"), say: tx("The pupil isn't tissue at all, it's a hole in the iris. It looks black because the light disappears into the eye.", "Die Pupille ist gar kein Gewebe, sondern ein Loch in der Iris. Sie sieht schwarz aus, weil das Licht im Auge verschwindet.") },
      { text: tx("It's a black muscle.", "Sie ist ein schwarzer Muskel."), title: tx("The muscles are in the iris", "Die Muskeln sind in der Iris"), say: tx("The muscles are in the iris. The pupil itself is just the hole in the middle.", "Die Muskeln sitzen in der Iris. Die Pupille selbst ist nur das Loch in der Mitte.") },
    ],
    hint: tx("Look into a dark room through an open window from outside.", "Schau von draußen durch ein offenes Fenster in ein dunkles Zimmer."),
    answer: tx("it's a hole", "sie ist ein Loch"),
    note: tx("The pupil is the **hole** in the iris. Light goes in and hardly any comes back, so it looks black.", "Die Pupille ist das **Loch** in der Iris. Licht fällt hinein und kaum etwas kommt zurück, darum sieht sie schwarz aus."),
  },
  {
    q: tx("What is the job of the iris?", "Welche Aufgabe hat die Iris?"),
    opts: [
      { text: tx("It controls how much light gets into the eye.", "Sie regelt, wie viel Licht ins Auge fällt.") },
      { text: tx("It focuses the image.", "Sie stellt das Bild scharf."), title: tx("That's the lens", "Das macht die Linse"), say: tx("Focusing is the lens's job. The iris makes the pupil narrower or wider.", "Scharf stellt die Linse. Die Iris macht die Pupille enger oder weiter.") },
      { text: tx("It turns light into signals.", "Sie wandelt Licht in Erregungen um."), title: tx("That's the retina", "Das macht die Netzhaut"), say: tx("Light is turned into signals by the sensory cells of the retina. The iris controls the amount of light.", "In Erregungen umgewandelt wird das Licht von den Sinneszellen der Netzhaut. Die Iris regelt die Lichtmenge.") },
    ],
    hint: tx("Think of the pupillary reflex.", "Denk an den Pupillenreflex."),
    answer: tx("controls the light", "regelt das Licht"),
    note: tx("The iris has muscles that make the pupil narrower or wider. So it controls how much light gets in.", "Die Iris hat Muskeln, die die Pupille enger oder weiter machen. So regelt sie, wie viel Licht ins Auge fällt."),
  },
  {
    q: tx("What happens in the retina?", "Was passiert in der Netzhaut?"),
    opts: [
      { text: tx("Sensory cells turn light into nerve signals.", "Sinneszellen wandeln Licht in Erregungen um.") },
      { text: tx("The light is bent.", "Das Licht wird gebrochen."), title: tx("Bending happens earlier", "Gebrochen wird vorher"), say: tx("The light is bent by the cornea and the lens. The retina turns it into signals.", "Gebrochen wird das Licht von Hornhaut und Linse. Die Netzhaut wandelt es in Erregungen um.") },
      { text: tx("The signals are turned into a picture.", "Die Erregungen werden zu einem Bild verarbeitet."), title: tx("That's the brain", "Das macht das Gehirn"), say: tx("Turning signals into the picture you see is the brain's job. The retina makes the signals.", "Aus den Erregungen das Bild zu machen, das du siehst, ist Aufgabe des Gehirns. Die Netzhaut bildet die Erregungen.") },
    ],
    hint: tx("Where are the light-sensitive cells?", "Wo sitzen die Lichtsinneszellen?"),
    answer: tx("light → signals", "Licht → Erregungen"),
    note: tx("In the retina, sensory cells turn light into nerve signals.", "In der Netzhaut wandeln Sinneszellen das Licht in Erregungen um."),
  },
  {
    q: tx("What protects the eye from dust and from drying out?", "Was schützt das Auge vor Staub und vor dem Austrocknen?"),
    opts: [
      { text: tx("eyelids, eyelashes and tears", "Lider, Wimpern und Tränenflüssigkeit") },
      { text: tx("the lens and the vitreous body", "Linse und Glaskörper"), title: tx("Those are inside", "Die sind innen"), say: tx("Lens and vitreous body are inside the eye. The protection is on the outside: lids, lashes and tears.", "Linse und Glaskörper liegen im Auge. Geschützt wird es von außen: durch Lider, Wimpern und Tränen.") },
      { text: tx("the retina", "die Netzhaut") },
    ],
    hint: tx("What do you do when dust gets into your eye?", "Was machst du, wenn Staub ins Auge kommt?"),
    answer: tx("lids, lashes, tears", "Lider, Wimpern, Tränen"),
    note: tx("Lids and lashes keep dust out; tears keep the cornea moist and wash dirt away. Blinking spreads them.", "Lider und Wimpern halten Staub ab; Tränen halten die Hornhaut feucht und spülen Schmutz weg. Beim Blinzeln werden sie verteilt."),
  },
  {
    q: tx("In the ear, what is the first thing the sound makes vibrate?", "Was bringt der Schall im Ohr als Erstes zum Schwingen?"),
    opts: [
      { text: tx("the eardrum", "das Trommelfell") },
      { text: tx("the ossicles", "die Gehörknöchelchen"), title: tx("First the eardrum", "Erst das Trommelfell"), say: tx("The ossicles only vibrate because the eardrum vibrates first and passes it on.", "Die Gehörknöchelchen schwingen erst, weil vorher das Trommelfell schwingt und es weitergibt.") },
      { text: tx("the cochlea", "die Schnecke"), title: tx("The cochlea is deep inside", "Die Schnecke liegt ganz innen"), say: tx("The cochlea is in the inner ear. Before the sound gets there, the eardrum and the ossicles vibrate.", "Die Schnecke liegt im Innenohr. Bevor der Schall dort ankommt, schwingen Trommelfell und Gehörknöchelchen.") },
      { text: tx("the auditory nerve", "der Hörnerv") },
    ],
    hint: tx("It's at the end of the ear canal.", "Es sitzt am Ende des Gehörgangs."),
    answer: tx("eardrum", "Trommelfell"),
    note: tx("Sound travels down the ear canal and makes the **eardrum** vibrate.", "Der Schall läuft durch den Gehörgang und bringt das **Trommelfell** zum Schwingen."),
  },
  {
    q: tx("Where are the sensory cells for hearing?", "Wo sitzen die Hörsinneszellen?"),
    opts: [
      { text: tx("in the cochlea (inner ear)", "in der Schnecke (Innenohr)") },
      { text: tx("in the eardrum", "im Trommelfell"), title: tx("The eardrum only vibrates", "Das Trommelfell schwingt nur"), say: tx("The eardrum only vibrates. The sensory cells sit deep inside, in the **cochlea**.", "Das Trommelfell schwingt nur mit. Die Sinneszellen sitzen tief innen, in der **Schnecke**.") },
      { text: tx("in the outer ear", "in der Ohrmuschel"), title: tx("The pinna only catches", "Die Ohrmuschel fängt nur"), say: tx("The outer ear only catches the sound like a funnel. The sensory cells are in the cochlea.", "Die Ohrmuschel fängt den Schall nur wie ein Trichter auf. Die Sinneszellen sitzen in der Schnecke.") },
    ],
    hint: tx("They're in the inner ear, in a coiled tube.", "Sie liegen im Innenohr, in einem aufgewundenen Gang."),
    answer: tx("cochlea", "Schnecke"),
    note: tx("The sensory cells for hearing sit in the **cochlea** in the inner ear.", "Die Hörsinneszellen sitzen in der **Schnecke** im Innenohr."),
  },
  {
    q: tx("What is a stimulus?", "Was ist ein Reiz?"),
    opts: [
      { text: tx("a change in the surroundings (or the body) that sensory cells respond to", "eine Veränderung in der Umwelt (oder im Körper), auf die Sinneszellen reagieren") },
      { text: tx("the body's answer, for example a movement", "die Antwort des Körpers, zum Beispiel eine Bewegung"), title: tx("That's the response", "Das ist die Reaktion"), say: tx("That's the **response**. The stimulus comes first, the response afterwards.", "Das ist die **Reaktion**. Der Reiz kommt zuerst, die Reaktion danach.") },
      { text: tx("a nerve that carries signals", "ein Nerv, der Erregungen leitet") },
    ],
    hint: tx("Light, sound, a smell, a touch…", "Licht, Schall, ein Duft, eine Berührung …"),
    answer: tx("stimulus", "Reiz"),
    note: tx("A **stimulus** is a change that sensory cells respond to: light, sound, smell, pressure, heat…", "Ein **Reiz** ist eine Veränderung, auf die Sinneszellen reagieren: Licht, Schall, Duft, Druck, Wärme …"),
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: tx("Pick the right answer", "Wähle die richtige Antwort"), text: f.q, answer: c.answer, hint: f.hint, solution: [answerFrame(f.answer, f.note)], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Practice

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [1.2, () => senseMatchTask(rng)],
    [1.2, () => sceneTask(rng)],
    [0.8, () => stimulusTask(rng)],
    [1, () => chainTask(rng)],
    [1.3, () => eyeNameTask(rng)],
    [1, () => eyeDescribeTask(rng)],
    [1, () => eyeMatchTask(rng)],
    [0.9, () => pathTask(rng, "light")],
    [0.6, () => pathTask(rng, "sound")],
    [0.8, () => pupilTask(rng)],
    [1, () => reflexOrNotTask(rng)],
    [0.8, () => reflexMultiTask(rng)],
    [1.4, () => factTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const senseCheck = (() => {
  const pairs: [Text, Text][] = [
    [organ("eye").organ, organ("eye").stim[0]],
    [organ("nose").organ, organ("nose").stim[0]],
    [organ("tongue").organ, organ("tongue").stim[0]],
    [organ("skin").organ, organ("skin").stim[0]],
  ];
  const m = match(pairs, [organ("ear").stim[0]], [{ pairs: [[pairs[1][0], pairs[2][1]], [pairs[2][0], pairs[1][1]]], ...organSwap("nose", "tongue")! }]);
  const ex: Exercise = {
    instruction: tx("Match each sense organ to its stimulus", "Ordne jedem Sinnesorgan seinen Reiz zu"),
    text: tx("Which stimulus does each sense organ take in? One stimulus is left over.", "Welchen Reiz nimmt welches Sinnesorgan auf? Ein Reiz bleibt übrig."),
    answer: m.answer,
    hint: tx("Smell with the nose, taste with the tongue.", "Riechen mit der Nase, schmecken mit der Zunge."),
    solution: [{ math: cat(...pairs.flatMap(([o, s], i) => [q(o), "\\to", q(s), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Sound would be the ear's stimulus, but the ear isn't in this list.", "Schall wäre der Reiz fürs Ohr, aber das Ohr fehlt in dieser Liste.") }],
    mistakes: m.mistakes,
  };
  return ex;
})();

const reflexCheck = reflexMultiTask(createRng(5), [0, 7, 1, 8, 3]);

const SENSES: [Text, Text][] = [
  [tx("eye", "Auge"), tx("light", "Licht")],
  [tx("ear", "Ohr"), tx("sound", "Schall")],
  [tx("nose", "Nase"), tx("smells", "Duftstoffe")],
  [tx("tongue", "Zunge"), tx("tastes", "Geschmacksstoffe")],
  [tx("skin", "Haut"), tx("pressure, warmth, cold, pain", "Druck, Wärme, Kälte, Schmerz")],
];
function senseFrame(n: number): Text {
  const line = (i: number) => {
    const [o, s] = SENSES[i];
    const body = cat(q(o, `o${i}`), "\\to", q(s, `s${i}`));
    return i === n - 1 ? cat("\\hl{", body, "}") : body;
  };
  return cat(...Array.from({ length: n }, (_, i) => (i < n - 1 ? cat(line(i), "\\\\") : line(i))));
}

const CHAIN_WORDS: Text[] = [tx("stimulus", "Reiz"), tx("sense organ", "Sinnesorgan"), tx("nerve", "Nerv"), tx("brain", "Gehirn"), tx("nerve", "Nerv"), tx("muscle", "Muskel")];
const chainFrame = (n: number) => flow(CHAIN_WORDS.slice(0, n), { hl: [n - 1], keys: "c" });
const LIGHT_WORDS: Text[] = [tx("light", "Licht"), tx("cornea", "Hornhaut"), tx("pupil", "Pupille"), tx("lens", "Linse"), tx("vitreous body", "Glaskörper"), tx("retina", "Netzhaut"), tx("optic nerve", "Sehnerv"), tx("brain", "Gehirn")];
const lightFrame = (n: number, hl: number[]) => flow(LIGHT_WORDS.slice(0, n), { hl, keys: "l", per: 4 });

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Your senses", "Deine Sinne"),
      blob: tx("Eyes open, ears pricked! Let's start with your senses.", "Augen auf, Ohren gespitzt! Los geht's mit deinen Sinnen."),
      body: tx(
        "Your **sense organs** take in **stimuli** from your surroundings. They contain **sensory cells**, and each kind of sensory cell only responds to its own kind of stimulus.",
        "Deine **Sinnesorgane** nehmen **Reize** aus der Umwelt auf. In ihnen sitzen **Sinneszellen**, und jede Sorte Sinneszelle reagiert nur auf ihren passenden Reiz.",
      ),
      frames: [
        { math: senseFrame(1), note: tx("The **eye** takes in **light**: the sense of sight.", "Das **Auge** nimmt **Licht** auf: der Sehsinn.") },
        { math: senseFrame(2), note: tx("The **ear** takes in **sound**: the sense of hearing. The organ of balance also sits in the inner ear.", "Das **Ohr** nimmt **Schall** auf: der Hörsinn. Im Innenohr sitzt außerdem das Gleichgewichtsorgan.") },
        { math: senseFrame(3), note: tx("The **nose** smells chemicals in the air: the sense of smell.", "Die **Nase** riecht **Duftstoffe** in der Luft: der Geruchssinn.") },
        { math: senseFrame(4), note: tx("The **tongue** tastes sweet, sour, salty, bitter and umami. Smell and taste are both chemical senses.", "Die **Zunge** schmeckt süß, sauer, salzig, bitter und umami. Riechen und Schmecken sind beides chemische Sinne.") },
        { math: senseFrame(5), note: tx("The **skin** feels **pressure** (touch), **warmth**, **cold** and **pain**.", "Die **Haut** spürt **Druck** (Berührung), **Wärme**, **Kälte** und **Schmerz**.") },
        {
          math: flow([tx("sound", "Schall"), tx("eardrum", "Trommelfell"), tx("ossicles", "Gehörknöchelchen"), tx("cochlea", "Schnecke"), tx("auditory nerve", "Hörnerv"), tx("brain", "Gehirn")], { keys: "e" }),
          note: tx("How you hear: sound makes the **eardrum** vibrate. The **ossicles** (hammer, anvil, stirrup) pass the vibrations to the **cochlea**, where the sensory cells sit.", "So hörst du: Der Schall bringt das **Trommelfell** zum Schwingen. Die **Gehörknöchelchen** (Hammer, Amboss, Steigbügel) leiten die Schwingungen zur **Schnecke**. Dort sitzen die Sinneszellen."),
        },
        { math: flow([tx("stimulus", "Reiz"), tx("sensory cells", "Sinneszellen"), tx("nerve signal", "Erregung")], { hl: [2] }), note: tx("In every sense organ, sensory cells turn the stimulus into **nerve signals** (electrical signals). Nerves carry them on.", "In jedem Sinnesorgan wandeln Sinneszellen den Reiz in **Erregungen** (elektrische Signale) um. Nerven leiten sie weiter.") },
      ],
    },
    { type: "check", blob: tx("Quick sorting job!", "Kurze Sortieraufgabe!"), exercise: senseCheck },
    {
      type: "explain",
      title: tx("From stimulus to response", "Vom Reiz zur Reaktion"),
      blob: tx("What actually happens when you catch a ball?", "Was passiert eigentlich, wenn du einen Ball fängst?"),
      body: tx("Sense organs, nerves, brain and muscles work together. The signal always takes the same route.", "Sinnesorgane, Nerven, Gehirn und Muskeln arbeiten zusammen. Das Signal nimmt immer denselben Weg."),
      frames: [
        { math: chainFrame(1), note: tx("A **stimulus**: a ball flies towards you. Light from the ball hits your eye.", "Ein **Reiz**: Ein Ball fliegt auf dich zu. Licht vom Ball trifft dein Auge.") },
        { math: chainFrame(2), note: tx("The **sense organ** (here the eye) takes in the stimulus. Its sensory cells form nerve signals.", "Das **Sinnesorgan** (hier das Auge) nimmt den Reiz auf. Seine Sinneszellen bilden Erregungen.") },
        { math: chainFrame(3), note: tx("A **nerve** (the optic nerve) carries the signal to the brain.", "Ein **Nerv** (der Sehnerv) leitet die Erregung zum Gehirn.") },
        { math: chainFrame(4), note: tx("The **brain** works it out: a ball! I want to catch it. It decides and sends off a command.", "Das **Gehirn** wertet aus: Ein Ball! Den will ich fangen. Es entscheidet und schickt einen Befehl los.") },
        { math: chainFrame(5), note: tx("Through **nerves** again, the command travels to the muscles of your arm and hand.", "Wieder über **Nerven** läuft der Befehl zu den Muskeln von Arm und Hand.") },
        { math: chainFrame(6), note: tx("The **muscles** contract: you catch the ball. That's the **response**.", "Die **Muskeln** ziehen sich zusammen: Du fängst den Ball. Das ist die **Reaktion**.") },
      ],
    },
    {
      type: "widget",
      title: tx("Catch the ruler!", "Fang das Lineal!"),
      blob: tx("Ready? Don't blink!", "Bereit? Nicht blinzeln!"),
      body: tx(
        "Test your reaction time. At some point the ruler drops: grab it as fast as you can. The quicker you react, the shorter the distance it falls.",
        "Teste deine Reaktionszeit. Irgendwann fällt das Lineal los: Greif so schnell du kannst zu. Je schneller du reagierst, desto kürzer ist die Strecke, die es fällt.",
      ),
      widget: NerveReaction,
    },
    { type: "check", blob: tx("Now you put the chain together.", "Jetzt baust du die Kette zusammen."), exercise: chainExercise(CHAINS[1]) },
    {
      type: "widget",
      title: tx("Explore the eye", "Das Auge erkunden"),
      blob: tx("Look into my eyes! Well, into this one.", "Schau mir in die Augen! Na ja, in dieses hier."),
      body: tx(
        "Tap the numbers to find out what each part of the eye does. Then slide the light up and down: what does the pupil do?",
        "Tippe auf die Nummern und finde heraus, was die Teile des Auges tun. Schieb dann das Licht hoch und runter: Was macht die Pupille?",
      ),
      widget: NerveEyeLab,
    },
    {
      type: "explain",
      title: tx("How an image forms", "So entsteht ein Bild"),
      blob: tx("Follow the light on its way through the eye.", "Folge dem Licht auf seinem Weg durchs Auge."),
      frames: [
        { math: lightFrame(3, [1, 2]), note: tx("Light passes through the clear **cornea** and the **pupil** into the eye.", "Licht fällt durch die durchsichtige **Hornhaut** und die **Pupille** ins Auge.") },
        { math: lightFrame(4, [3]), note: tx("The **lens** bends the light so that a sharp image forms.", "Die **Linse** bricht das Licht so, dass ein scharfes Bild entsteht.") },
        { math: lightFrame(6, [4, 5]), note: tx("The light crosses the **vitreous body** and hits the **retina**. There an image forms: smaller and **upside down**.", "Das Licht durchquert den **Glaskörper** und trifft auf die **Netzhaut**. Dort entsteht ein Bild: verkleinert und **auf dem Kopf stehend**.") },
        { math: lightFrame(8, [6, 7]), note: tx("Sensory cells in the retina turn the light into signals. The **optic nerve** carries them to the **brain**. Only the brain makes the picture you see, the right way up.", "Sinneszellen der Netzhaut wandeln das Licht in Erregungen um. Der **Sehnerv** leitet sie ins **Gehirn**. Erst das Gehirn macht daraus das Bild, das du siehst, und zwar richtig herum.") },
        { math: blindFrame(), note: tx("Where the optic nerve leaves the eye there are no sensory cells: the **blind spot**. You're about to find your own!", "Wo der Sehnerv das Auge verlässt, gibt es keine Sinneszellen: den **blinden Fleck**. Gleich findest du deinen eigenen!") },
      ],
    },
    {
      type: "widget",
      title: tx("Find your blind spot", "Finde deinen blinden Fleck"),
      blob: tx("Watch out, something's about to vanish!", "Achtung, gleich verschwindet etwas!"),
      body: tx("An experiment for you: cover one eye, look at the cross and slowly move closer to the screen.", "Ein Versuch für dich: Halte ein Auge zu, schau aufs Kreuz und geh langsam näher an den Bildschirm."),
      widget: NerveBlindSpot,
    },
    { type: "check", blob: tx("Do you know this part?", "Kennst du dieses Teil?"), exercise: eyeNameTask(createRng(11), "lens") },
    {
      type: "explain",
      title: tx("Reflexes: faster than thought", "Reflexe: schneller als gedacht"),
      blob: tx("Some reactions happen before you even think. Handy!", "Manche Reaktionen passieren, bevor du überhaupt nachdenkst. Praktisch!"),
      body: tx(
        "Some reactions run all by themselves, without you thinking: **reflexes**. They are **fast**, **unconscious** and **always the same**. Most of them protect you.",
        "Manche Reaktionen laufen ganz von allein ab, ohne dass du nachdenkst: **Reflexe**. Sie sind **schnell**, **unbewusst** und **immer gleich**. Meist schützen sie dich.",
      ),
      frames: [
        { math: flow([tx("stimulus", "Reiz"), tx("reflex", "Reflex")], { hl: [1] }), note: tx("A **reflex** is a fast, unconscious response to a stimulus. You can hardly stop it.", "Ein **Reflex** ist eine schnelle, unbewusste Reaktion auf einen Reiz. Du kannst ihn kaum unterdrücken.") },
        { math: flow([tx("fly near the eye", "Fliege nah am Auge"), tx("eyelid closes", "Lid schließt sich")]), note: tx("**Blink reflex:** if something comes too close to your eye, the lid closes in a flash. That protects the eye.", "**Lidschlussreflex:** Kommt etwas zu nah ans Auge, schließt sich das Lid blitzschnell. Das schützt das Auge.") },
        { math: flow([tx("bright light", "helles Licht"), tx("pupil narrows", "Pupille wird eng")]), note: tx("**Pupillary reflex:** in bright light the pupil narrows, in the dark it widens. You tried it out earlier.", "**Pupillenreflex:** Bei hellem Licht wird die Pupille eng, im Dunkeln weit. Das hast du vorhin ausprobiert.") },
        { math: flow([tx("dust in the nose", "Staub in der Nase"), tx("sneezing", "Niesen")]), note: tx("**Sneezing** and **coughing** are reflexes too: they blast dust and crumbs out of your nose and airways.", "**Niesen** und **Husten** sind auch Reflexe: Sie befördern Staub und Krümel aus Nase und Atemwegen.") },
        { math: flow([tx("hot plate", "heiße Herdplatte"), tx("hand jerks back", "Hand zuckt zurück")]), note: tx("Your hand jerks back from a hot plate **before** you feel the pain. The signal takes a shortcut through the spinal cord; the brain only finds out afterwards.", "Die Hand zuckt von der heißen Herdplatte zurück, **bevor** du den Schmerz spürst. Das Signal nimmt eine Abkürzung über das Rückenmark, das Gehirn erfährt es erst danach.") },
      ],
    },
    { type: "check", blob: tx("Last one! Which happen all by themselves?", "Die letzte! Was passiert ganz von allein?"), exercise: reflexCheck },
  ],
  summary: [
    {
      title: tx("Sense organs and stimuli", "Sinnesorgane und Reize"),
      body: tx(
        "Eye: light · ear: sound · nose: smells · tongue: tastes · skin: pressure, warmth, cold, pain. Sensory cells turn stimuli into nerve signals.",
        "Auge: Licht · Ohr: Schall · Nase: Duftstoffe · Zunge: Geschmacksstoffe · Haut: Druck, Wärme, Kälte, Schmerz. Sinneszellen wandeln Reize in Erregungen um.",
      ),
      examples: [cat(q(tx("eye", "Auge")), "\\to", q(tx("light", "Licht")), "\\quad", q(tx("ear", "Ohr")), "\\to", q(tx("sound", "Schall")))],
      tone: "rule",
    },
    {
      title: tx("From stimulus to response", "Vom Reiz zur Reaktion"),
      body: tx("The signal always takes the same route: sense organ, nerve, brain, nerve, muscle.", "Das Signal nimmt immer denselben Weg: Sinnesorgan, Nerv, Gehirn, Nerv, Muskel."),
      examples: [flow(CHAIN_WORDS)],
      tone: "rule",
    },
    {
      title: tx("The eye", "Das Auge"),
      body: tx(
        "Light passes cornea, pupil, lens and vitreous body to the retina. The image there is upside down; the optic nerve carries the signals to the brain. Blind spot: where the optic nerve leaves, no sensory cells.",
        "Licht durchläuft Hornhaut, Pupille, Linse und Glaskörper bis zur Netzhaut. Das Bild dort steht auf dem Kopf; der Sehnerv leitet die Erregungen ins Gehirn. Blinder Fleck: Austritt des Sehnervs, keine Sinneszellen.",
      ),
      examples: [flow([tx("cornea", "Hornhaut"), tx("pupil", "Pupille"), tx("lens", "Linse"), tx("vitreous body", "Glaskörper"), tx("retina", "Netzhaut")])],
      tone: "rule",
    },
    {
      title: tx("Pupillary reflex", "Pupillenreflex"),
      body: tx("The iris controls the pupil: bright light makes it narrow, darkness makes it wide.", "Die Iris regelt die Pupille: Bei hellem Licht wird sie eng, im Dunkeln weit."),
      examples: [cat(q(tx("bright", "hell")), "\\Rightarrow", q(tx("pupil narrow", "Pupille eng")))],
      tone: "tip",
    },
    {
      title: tx("Reflexes", "Reflexe"),
      body: tx("Fast, unconscious, always the same, and usually protective: blinking, coughing, sneezing, the pupillary reflex, pulling back from heat.", "Schnell, unbewusst, immer gleich und meist schützend: Lidschluss, Husten, Niesen, Pupillenreflex, Zurückzucken vor Hitze."),
      tone: "rule",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx(
        "The pupil is not an organ but a **hole** in the iris. In bright light it gets **narrower**, not wider. And you see with your **brain**: the eye only delivers signals.",
        "Die Pupille ist kein Organ, sondern ein **Loch** in der Iris. Bei hellem Licht wird sie **enger**, nicht weiter. Und gesehen wird im **Gehirn**: Das Auge liefert nur Erregungen.",
      ),
      tone: "warning",
    },
  ],
};

function blindFrame(): Text {
  return cat(q(tx("optic nerve leaves", "Sehnerv tritt aus")), "\\Rightarrow", "\\hl{", q(tx("blind spot", "blinder Fleck")), "}");
}
