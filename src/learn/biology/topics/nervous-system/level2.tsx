"use client";

// Nervous system, level 2 (Fortgeschritten, Klasse 7–9): central and peripheral nervous system,
// the brain (parts and cortical areas), the reflex arc of the knee-jerk reflex, reflexes of the
// same and of another organ (Eigen-/Fremdreflex), the neuron, the synapse in simple terms
// (electrical → chemical → electrical, transmitter), drugs and addiction in brief, and the eye:
// accommodation, adaptation, rods and cones.

import { resolveText, tx, type Text } from "@/i18n/text";
import { BRAIN_FIELDS, NerveBrain, NerveBrainLab } from "@/learn/biology/visuals/NerveBrain";
import { NerveEyeFocus } from "@/learn/biology/visuals/NerveEye";
import { NerveNeuron, NerveNeuronLab } from "@/learn/biology/visuals/NerveNeuron";
import { NerveReflexArc, NerveReflexLab, REFLEX_PARTS } from "@/learn/biology/visuals/NerveReflex";
import { NerveSynapseSimple } from "@/learn/biology/visuals/NerveSynapse";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson } from "@/learn/types";
import { answerFrame, cat, choice, choiceAt, flow, match, multi, order, pic, q, some, weighted, word, type Opt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

// ---------------------------------------------------------------------------
// The brain

type Region = { id: string; name: Text; the: Text; accept: Text[]; jobs: Text[] };
const REGIONS: Region[] = [
  { id: "grosshirn", name: tx("cerebrum", "Großhirn"), the: tx("the cerebrum", "das Großhirn"), accept: [tx("cerebrum", "Großhirn"), "Endhirn"], jobs: [tx("thinking, learning and memory", "Denken, Lernen und Gedächtnis"), tx("consciousness and voluntary movement", "Bewusstsein und willkürliche Bewegungen"), tx("makes sensory impressions conscious", "macht Sinneseindrücke bewusst")] },
  { id: "kleinhirn", name: tx("cerebellum", "Kleinhirn"), the: tx("the cerebellum", "das Kleinhirn"), accept: [tx("cerebellum", "Kleinhirn")], jobs: [tx("coordination of movements", "Koordination der Bewegungen"), tx("keeping your balance", "Gleichgewicht halten"), tx("fine-tuning practised movements", "Feinabstimmung eingeübter Bewegungen")] },
  { id: "zwischenhirn", name: tx("diencephalon", "Zwischenhirn"), the: tx("the diencephalon", "das Zwischenhirn"), accept: [tx("diencephalon", "Zwischenhirn")], jobs: [tx("body temperature, hunger and thirst", "Körpertemperatur, Hunger und Durst"), tx("filters sensory signals on their way to the cerebrum", "filtert Sinnesmeldungen auf dem Weg zum Großhirn")] },
  { id: "hirnstamm", name: tx("brain stem", "Hirnstamm"), the: tx("the brain stem", "der Hirnstamm"), accept: [tx("brain stem", "Hirnstamm"), "brainstem", "Stammhirn"], jobs: [tx("breathing and heartbeat", "Atmung und Herzschlag"), tx("swallowing, coughing and blood pressure", "Schlucken, Husten und Blutdruck")] },
  { id: "rueckenmark", name: tx("spinal cord", "Rückenmark"), the: tx("the spinal cord", "das Rückenmark"), accept: [tx("spinal cord", "Rückenmark")], jobs: [tx("carries signals between brain and body", "leitet Erregungen zwischen Gehirn und Körper"), tx("switches reflexes such as the knee-jerk", "schaltet Reflexe wie den Kniesehnenreflex")] },
];
const region = (id: string) => REGIONS.find((r) => r.id === id)!;
const GEN: Record<string, string> = { grosshirn: "des **Großhirns**", kleinhirn: "des **Kleinhirns**", zwischenhirn: "des **Zwischenhirns**", hirnstamm: "des **Hirnstamms**", rueckenmark: "des **Rückenmarks**" };

/** What Blob says when region `got` is chosen instead of `want`. */
function regionMix(want: string, got: string): { title: Text; say: Text } | null {
  const M: Record<string, { title: Text; say: Text }> = {
    "kleinhirn>grosshirn": { title: tx("Cerebellum, not cerebrum", "Kleinhirn, nicht Großhirn"), say: tx("The cerebrum starts movements, but balance and smooth, practised movements are the job of the **cerebellum**.", "Bewegungen startet das Großhirn, aber Gleichgewicht und flüssige, eingeübte Bewegungen sind Sache des **Kleinhirns**.") },
    "grosshirn>kleinhirn": { title: tx("Small brain, big job? Not this one", "Kleinhirn denkt nicht"), say: tx("The cerebellum coordinates movements. Thinking, learning and deciding happen in the **cerebrum**.", "Das Kleinhirn koordiniert Bewegungen. Denken, Lernen und Entscheiden passieren im **Großhirn**.") },
    "hirnstamm>grosshirn": { title: tx("Runs without thinking", "Läuft ohne Nachdenken"), say: tx("Breathing and heartbeat go on without you thinking, even in your sleep. That's controlled by the **brain stem**.", "Atmung und Herzschlag laufen ohne Nachdenken weiter, sogar im Schlaf. Das steuert der **Hirnstamm**.") },
    "hirnstamm>zwischenhirn": { title: tx("One floor lower", "Ein Stockwerk tiefer"), say: tx("The diencephalon controls temperature, hunger and thirst. Breathing, heartbeat, swallowing and coughing are controlled by the **brain stem**.", "Das Zwischenhirn regelt Temperatur, Hunger und Durst. Atmung, Herzschlag, Schlucken und Husten steuert der **Hirnstamm**.") },
    "zwischenhirn>hirnstamm": { title: tx("That's the hypothalamus", "Das ist der Hypothalamus"), say: tx("Body temperature, hunger and thirst are regulated by the hypothalamus in the **diencephalon**.", "Körpertemperatur, Hunger und Durst regelt der Hypothalamus im **Zwischenhirn**.") },
    "zwischenhirn>grosshirn": { title: tx("Automatic, not conscious", "Automatisch, nicht bewusst"), say: tx("You don't decide to sweat: your body temperature is regulated automatically by the **diencephalon** (hypothalamus).", "Schwitzen beschließt du nicht: Die Körpertemperatur regelt automatisch das **Zwischenhirn** (Hypothalamus).") },
    "rueckenmark>grosshirn": { title: tx("The brain isn't asked", "Das Gehirn wird nicht gefragt"), say: tx("Classic mistake! In a reflex the cerebrum isn't asked at all: the **spinal cord** switches the signal straight back to the muscle.", "Klassischer Irrtum! Beim Reflex wird das Großhirn gar nicht gefragt: Das **Rückenmark** schaltet die Erregung direkt zum Muskel um.") },
    "rueckenmark>hirnstamm": { title: tx("Lower down", "Weiter unten"), say: tx("This reflex is switched in the **spinal cord**, in the back, not in the brain stem.", "Dieser Reflex wird im **Rückenmark** im Rücken umgeschaltet, nicht im Hirnstamm.") },
  };
  return M[`${want}>${got}`] ?? null;
}

function brainMatchTask(rng: Rng): Exercise {
  const chosen = some(rng, REGIONS, 4);
  const pairs: [Text, Text][] = chosen.map((r) => [r.name, rng.pick(r.jobs)]);
  const rest = REGIONS.filter((r) => !chosen.includes(r));
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  chosen.forEach((a, i) =>
    chosen.forEach((b) => {
      const mix = a !== b ? regionMix(a.id, b.id) : null;
      if (mix) wrong.push({ pairs: [[b.name, pairs[i][1]]], ...mix });
    }),
  );
  const m = match(pairs, [rng.pick(rng.pick(rest).jobs)], wrong);
  return {
    instruction: tx("Match the parts of the brain to their jobs", "Ordne den Hirnteilen ihre Aufgaben zu"),
    text: tx("Which part of the brain (or the spinal cord) does what? One job is left over.", "Welcher Teil von Gehirn (oder Rückenmark) macht was? Eine Aufgabe bleibt übrig."),
    answer: m.answer,
    hint: tx("Conscious things: cerebrum. Smooth movement: cerebellum. Automatic life support: brain stem.", "Alles Bewusste: Großhirn. Flüssige Bewegungen: Kleinhirn. Lebenswichtiges Automatisches: Hirnstamm."),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Each part of the central nervous system has its own main jobs.", "Jeder Teil des Zentralnervensystems hat seine eigenen Hauptaufgaben.") }],
    mistakes: m.mistakes,
  };
}

const BRAIN_SCENES: { id: string; text: Text }[] = [
  { id: "kleinhirn", text: tx("After too much alcohol someone sways and can't walk in a straight line.", "Nach zu viel Alkohol schwankt jemand und kann nicht mehr gerade gehen.") },
  { id: "kleinhirn", text: tx("A dancer spins pirouettes without falling over.", "Eine Tänzerin dreht Pirouetten, ohne umzufallen.") },
  { id: "kleinhirn", text: tx("You ride your bike without thinking about every single movement.", "Du fährst Fahrrad, ohne über jede einzelne Bewegung nachzudenken.") },
  { id: "hirnstamm", text: tx("Even in deep sleep you keep breathing and your heart keeps beating.", "Auch im Tiefschlaf atmest du weiter und dein Herz schlägt.") },
  { id: "hirnstamm", text: tx("Something goes down the wrong way and you have to cough.", "Dir gerät etwas in die falsche Kehle und du musst husten.") },
  { id: "hirnstamm", text: tx("Your blood pressure is adjusted all the time without you noticing.", "Dein Blutdruck wird ständig angepasst, ohne dass du es merkst.") },
  { id: "zwischenhirn", text: tx("In the heat you start to sweat so that your body stays at 37 °C.", "Bei Hitze fängst du an zu schwitzen, damit dein Körper bei 37 °C bleibt.") },
  { id: "zwischenhirn", text: tx("After sport you feel very thirsty.", "Nach dem Sport bekommst du großen Durst.") },
  { id: "grosshirn", text: tx("You learn a poem by heart.", "Du lernst ein Gedicht auswendig.") },
  { id: "grosshirn", text: tx("You solve a maths problem.", "Du löst eine Matheaufgabe.") },
  { id: "grosshirn", text: tx("You decide to go to the cinema tonight.", "Du beschließt, heute Abend ins Kino zu gehen.") },
  { id: "rueckenmark", text: tx("Your leg kicks forward when the doctor taps below your knee.", "Dein Bein schnellt vor, als die Ärztin unters Knie klopft.") },
  { id: "rueckenmark", text: tx("After a back injury someone can no longer move or feel their legs, although the legs are unhurt.", "Nach einer Verletzung der Wirbelsäule kann jemand die Beine weder bewegen noch spüren, obwohl die Beine unverletzt sind.") },
];

function brainSceneTask(rng: Rng): Exercise {
  const sc = rng.pick(BRAIN_SCENES);
  const right = region(sc.id);
  const others = some(
    rng,
    REGIONS.filter((r) => r.id !== sc.id),
    3,
  );
  const c = choice(rng, [{ text: right.name }, ...others.map((r) => ({ text: r.name, ...(regionMix(sc.id, r.id) ?? {}) }))]);
  return {
    instruction: tx("Which part of the brain is at work?", "Welcher Hirnteil ist hier am Werk?"),
    text: cat(sc.text, tx("Which part of the central nervous system is mainly responsible?", "Welcher Teil des Zentralnervensystems ist hauptsächlich zuständig?")),
    answer: c.answer,
    hint: tx("Conscious or automatic? Movement, balance, temperature, breathing or a reflex?", "Bewusst oder automatisch? Bewegung, Gleichgewicht, Temperatur, Atmung oder ein Reflex?"),
    solution: [answerFrame(right.name, tx(`This is the job of **${en(right.the)}**: ${en(right.jobs[0])}.`, `Das ist Aufgabe ${GEN[right.id]}: ${de(right.jobs[0])}.`))],
    mistakes: c.mistakes,
  };
}

function brainFigureTask(rng: Rng): Exercise {
  const part = rng.pick(REGIONS);
  const wrong = REGIONS.filter((r) => r.id !== part.id && regionMix(part.id, r.id)).map((r) => ({ accept: r.accept, ...regionMix(part.id, r.id)! }));
  const w = word(part.accept, wrong, tx("name of the part", "Name des Teils"));
  return {
    instruction: tx("Name the part of the brain", "Benenne den Hirnteil"),
    text: tx("The brain from the side (front on the left). What is the part marked with **?** called?", "Das Gehirn von der Seite (vorn ist links). Wie heißt der mit **?** markierte Teil?"),
    visual: pic(NerveBrain, { mode: "numbers", view: "parts", ask: part.id, legend: "none" }),
    answer: w.answer,
    hint: tx("Big and folded on top: cerebrum. Small and ridged at the back: cerebellum. The stalk below: brain stem, then spinal cord.", "Groß und gefaltet oben: Großhirn. Klein und gerillt hinten: Kleinhirn. Der Stiel darunter: Hirnstamm, dann Rückenmark."),
    solution: [answerFrame(part.name, tx(`That's **${en(part.the)}**: ${en(part.jobs[0])}.`, `Das ist **${de(part.the)}**: ${de(part.jobs[0])}.`))],
    mistakes: w.mistakes,
  };
}

type Field = { id: string; accept: Text[]; scenes: Text[] };
const FIELDS: Field[] = [
  { id: "motor", accept: [tx("motor cortex", "motorisches Rindenfeld"), "motorischer Cortex", "Motorcortex", "motorische Rinde", "motor area"], scenes: [tx("After a stroke someone can no longer move their right arm, although they can still feel it.", "Nach einem Schlaganfall kann jemand den rechten Arm nicht mehr bewegen, obwohl er ihn noch spürt."), tx("You decide to throw a ball and raise your arm.", "Du willst einen Ball werfen und hebst den Arm.")] },
  { id: "sensory", accept: [tx("sensory cortex", "sensorisches Rindenfeld"), "sensorischer Cortex", "Körperfühlfeld", "somatosensorisches Rindenfeld", "sensory area"], scenes: [tx("After a stroke someone no longer feels touch on their hand, although they can still move it.", "Nach einem Schlaganfall spürt jemand keine Berührung mehr an der Hand, kann sie aber noch bewegen."), tx("Someone strokes the back of your hand and you feel it.", "Jemand streicht dir über den Handrücken, und du spürst es.")] },
  { id: "visual", accept: [tx("visual cortex", "Sehrinde"), "Sehzentrum", "visuelles Rindenfeld", "Sehfeld"], scenes: [tx("After a fall on the back of the head someone can hardly see, although their eyes are healthy.", "Nach einem Sturz auf den Hinterkopf sieht jemand kaum noch etwas, obwohl die Augen gesund sind."), tx("You recognise a friend's face in a crowd.", "Du erkennst in der Menge das Gesicht deiner Freundin.")] },
  { id: "auditory", accept: [tx("auditory cortex", "Hörrinde"), "Hörzentrum", "auditorisches Rindenfeld", "Hörfeld"], scenes: [tx("The ears are healthy, but after an injury to the temporal lobe someone can hardly hear.", "Die Ohren sind gesund, aber nach einer Verletzung im Schläfenlappen hört jemand kaum noch etwas."), tx("You listen to your favourite song.", "Du hörst dein Lieblingslied.")] },
  { id: "broca", accept: [tx("speech centre (Broca)", "Sprachzentrum"), "Broca-Zentrum", "Broca", "motorisches Sprachzentrum", "Broca's area", "speech centre"], scenes: [tx("After a stroke someone understands everything but can hardly form words and speaks haltingly.", "Nach einem Schlaganfall versteht jemand alles, kann aber kaum Wörter bilden und spricht stockend.")] },
];
const fieldLabel = (id: string) => BRAIN_FIELDS.find((f) => f.id === id)!.label;
function fieldMix(want: string, got: string): { title: Text; say: Text } | null {
  if ((want === "motor" && got === "sensory") || (want === "sensory" && got === "motor"))
    return {
      title: tx("Moving and feeling swapped", "Bewegen und Spüren vertauscht"),
      say: tx("They lie right next to each other: **in front of** the central sulcus the motor cortex (moving), **behind** it the sensory cortex (feeling).", "Die beiden liegen direkt nebeneinander: **vor** der Zentralfurche das motorische Rindenfeld (Bewegen), **dahinter** das sensorische (Spüren)."),
    };
  if (want === "visual") return { title: tx("Seeing happens at the back", "Gesehen wird hinten"), say: tx("Your eyes are at the front, but their signals are analysed right at the **back** of the head, in the visual cortex of the occipital lobe.", "Die Augen sind vorn, aber ihre Signale werden ganz **hinten** im Kopf ausgewertet: in der Sehrinde im Hinterhauptslappen.") };
  if (want === "auditory") return { title: tx("Hearing is at the side", "Gehört wird seitlich"), say: tx("The signals from the ears end up in the **auditory cortex** in the temporal lobe, at the side of the head near the ears.", "Die Signale der Ohren landen in der **Hörrinde** im Schläfenlappen, seitlich am Kopf nahe den Ohren.") };
  if (want === "broca" && got === "motor") return { title: tx("Speaking needs its own centre", "Sprechen hat ein eigenes Zentrum"), say: tx("The motor cortex moves the body, but forming words needs the **speech centre (Broca)** in the frontal lobe.", "Das motorische Rindenfeld bewegt den Körper, aber zum Bilden von Wörtern braucht es das **Sprachzentrum (Broca)** im Stirnlappen.") };
  if (want === "broca" && got === "auditory") return { title: tx("Understanding works", "Verstehen klappt ja"), say: tx("The person understands everything, so hearing works. Forming words is planned in the **speech centre (Broca)** in the frontal lobe.", "Die Person versteht alles, das Hören klappt also. Für das Bilden von Wörtern ist das **Sprachzentrum (Broca)** im Stirnlappen zuständig.") };
  return null;
}

function cortexSceneTask(rng: Rng): Exercise {
  const f = rng.pick(FIELDS);
  const scene = rng.pick(f.scenes);
  const others = some(
    rng,
    FIELDS.filter((x) => x.id !== f.id),
    3,
  );
  const c = choice(rng, [{ text: fieldLabel(f.id) }, ...others.map((o) => ({ text: fieldLabel(o.id), ...(fieldMix(f.id, o.id) ?? {}) }))]);
  return {
    instruction: tx("Which cortical area?", "Welches Rindenfeld?"),
    text: cat(scene, tx("Which area of the cerebral cortex is involved?", "Welches Rindenfeld des Großhirns ist beteiligt?")),
    answer: c.answer,
    hint: tx("Moving: in front of the central sulcus. Feeling: behind it. Seeing: back of the head. Hearing: temporal lobe.", "Bewegen: vor der Zentralfurche. Spüren: dahinter. Sehen: Hinterkopf. Hören: Schläfenlappen."),
    solution: [answerFrame(fieldLabel(f.id), BRAIN_FIELDS.find((x) => x.id === f.id)!.info!)],
    mistakes: c.mistakes,
  };
}

function cortexFigureTask(rng: Rng): Exercise {
  const f = rng.pick(FIELDS);
  const wrong = FIELDS.filter((o) => o.id !== f.id && fieldMix(f.id, o.id)).map((o) => ({ accept: o.accept, ...fieldMix(f.id, o.id)! }));
  const w = word(f.accept, wrong, tx("name of the area", "Name des Rindenfelds"));
  return {
    instruction: tx("Name the cortical area", "Benenne das Rindenfeld"),
    text: tx("What is the area of the cerebral cortex marked with **?** called?", "Wie heißt das mit **?** markierte Rindenfeld des Großhirns?"),
    visual: pic(NerveBrain, { mode: "numbers", view: "cortex", ask: f.id, legend: "none" }),
    answer: w.answer,
    hint: tx("The front is on the left. The central sulcus runs from the top down the middle.", "Vorn ist links. Die Zentralfurche läuft von oben quer über die Mitte."),
    solution: [answerFrame(fieldLabel(f.id), BRAIN_FIELDS.find((x) => x.id === f.id)!.info!)],
    mistakes: w.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Reflexes

const SENS = tx("sensory neuron", "sensorisches Neuron");
const MOT = tx("motor neuron", "motorisches Neuron");
type Arc = { name: Text; own: boolean; steps: Text[]; brain: Text };
const ARCS: Arc[] = [
  {
    name: tx("the knee-jerk reflex", "Kniesehnenreflex"),
    own: true,
    steps: [tx("muscle spindle in the thigh muscle (receptor)", "Muskelspindel im Oberschenkelmuskel (Rezeptor)"), SENS, tx("synapse in the spinal cord", "Synapse im Rückenmark"), MOT, tx("thigh muscle contracts (effector)", "Oberschenkelmuskel zieht sich zusammen (Effektor)")],
    brain: tx("message reaches the brain: you notice the kick", "Meldung erreicht das Gehirn: Du merkst den Tritt"),
  },
  {
    name: tx("the ankle-jerk reflex (Achilles tendon)", "Achillessehnenreflex"),
    own: true,
    steps: [tx("muscle spindle in the calf muscle (receptor)", "Muskelspindel im Wadenmuskel (Rezeptor)"), SENS, tx("synapse in the spinal cord", "Synapse im Rückenmark"), MOT, tx("calf muscle contracts (effector)", "Wadenmuskel zieht sich zusammen (Effektor)")],
    brain: tx("message reaches the brain: you notice the foot move", "Meldung erreicht das Gehirn: Du merkst die Fußbewegung"),
  },
  {
    name: tx("the withdrawal reflex (hot plate)", "Rückziehreflex (heiße Herdplatte)"),
    own: false,
    steps: [tx("pain receptors in the skin of the hand (receptor)", "Schmerzrezeptoren in der Haut der Hand (Rezeptor)"), SENS, tx("interneurons in the spinal cord", "Zwischenneurone im Rückenmark"), MOT, tx("arm flexor pulls the hand back (effector)", "Beugemuskel des Arms zieht die Hand zurück (Effektor)")],
    brain: tx("message reaches the brain: you feel the pain", "Meldung erreicht das Gehirn: Du spürst den Schmerz"),
  },
  {
    name: tx("the blink reflex", "Lidschlussreflex"),
    own: false,
    steps: [tx("touch receptors in the cornea (receptor)", "Berührungsrezeptoren der Hornhaut (Rezeptor)"), SENS, tx("interneurons in the brain stem", "Zwischenneurone im Hirnstamm"), MOT, tx("eyelid muscle closes the eye (effector)", "Lidmuskel schließt das Auge (Effektor)")],
    brain: tx("message reaches the cerebrum: you notice the blink", "Meldung erreicht das Großhirn: Du merkst den Lidschlag"),
  },
];

function arcExercise(arc: Arc, withBrain: boolean): Exercise {
  const items = withBrain ? [...arc.steps, arc.brain] : arc.steps;
  const s = arc.steps;
  const o = order(items, [
    { items: [MOT, SENS], title: tx("Sensory and motor swapped", "Sensorisch und motorisch vertauscht"), say: tx("Sensory means 'coming from the senses': the **sensory** neuron carries the signal **to** the spinal cord, the **motor** neuron carries it **from** there to the muscle.", "Sensorisch heißt „von den Sinnen kommend“: Das **sensorische** Neuron leitet **zum** Rückenmark hin, das **motorische** von dort **zum** Muskel.") },
    ...(withBrain ? [{ items: [arc.brain, s[3]], title: tx("The brain doesn't decide", "Das Gehirn entscheidet nicht"), say: tx("Classic mistake! In a reflex the brain isn't asked: the switch happens in the spinal cord (or brain stem). The brain only finds out **afterwards**.", "Klassischer Irrtum! Beim Reflex wird das Gehirn nicht gefragt: Umgeschaltet wird im Rückenmark (bzw. Hirnstamm). Das Gehirn erfährt es erst **hinterher**.") }] : []),
    { items: [s[4], s[0]], title: tx("Effector at the start", "Effektor am Anfang"), say: tx("The receptor takes in the stimulus, so it comes first. The effector (the muscle) responds at the very end.", "Der Rezeptor nimmt den Reiz auf, er steht am Anfang. Der Effektor (der Muskel) reagiert ganz am Ende.") },
    { items: [s[2], s[1]], title: tx("Switch before the way in", "Umschaltung vor dem Hinweg"), say: tx("The signal first has to reach the spinal cord through the sensory neuron. Only then is it switched over.", "Die Erregung muss erst über das sensorische Neuron im Rückenmark ankommen. Erst dann wird umgeschaltet.") },
  ]);
  return {
    instruction: tx("Put the reflex arc in order", "Ordne den Reflexbogen"),
    text: tx(`Put the steps of ${en(arc.name)} in the right order.`, `Bring die Stationen des ${de(arc.name).replace(/reflex/, "reflexes").replace(/^(\S+) \((.*)\)$/, "$1 ($2)")} in die richtige Reihenfolge.`),
    answer: o.answer,
    hint: tx("Receptor → sensory neuron → switch-over → motor neuron → effector.", "Rezeptor → sensorisches Neuron → Umschaltung → motorisches Neuron → Effektor."),
    solution: [
      { math: flow([tx("receptor", "Rezeptor"), tx("sensory neuron", "sensorisches Neuron"), arc.steps[2] === s[2] && arc.own ? tx("spinal cord", "Rückenmark") : tx("interneurons", "Zwischenneurone"), tx("motor neuron", "motorisches Neuron"), tx("effector", "Effektor")]), note: arc.own ? tx("A reflex of the same organ: receptor and effector are in the same muscle, with only one synapse in between.", "Ein Eigenreflex: Rezeptor und Effektor liegen im selben Muskel, dazwischen nur eine Synapse.") : tx("A reflex of another organ: receptor and effector are in different organs, with interneurons in between.", "Ein Fremdreflex: Rezeptor und Effektor liegen in verschiedenen Organen, dazwischen sind Zwischenneurone geschaltet.") },
    ],
    mistakes: o.mistakes,
  };
}
const arcTask = (rng: Rng) => arcExercise(rng.pick(ARCS), rng.chance(0.5));

const ARC_IDS = ["receptor", "sensory", "ganglion", "cord", "synapse", "motor", "effector", "brainpath"];
function arcMix(want: string, got: string): { title: Text; say: Text } | null {
  if (want === "sensory" && got === "motor") return { title: tx("Sensory and motor swapped", "Sensorisch und motorisch vertauscht"), say: tx("This fibre runs from the muscle spindle **to** the spinal cord: it's the **sensory** one. Its cell body sits in the spinal ganglion.", "Diese Faser läuft von der Muskelspindel **zum** Rückenmark: Das ist die **sensorische**. Ihr Zellkörper liegt im Spinalganglion.") };
  if (want === "motor" && got === "sensory") return { title: tx("Sensory and motor swapped", "Sensorisch und motorisch vertauscht"), say: tx("This fibre leaves the spinal cord at the front and runs **to** the muscle: it's the **motor** one.", "Diese Faser verlässt das Rückenmark vorn und läuft **zum** Muskel: Das ist die **motorische**.") };
  if (want === "receptor" && got === "effector") return { title: tx("Receptor and effector swapped", "Rezeptor und Effektor vertauscht"), say: tx("The muscle spindle inside the muscle **senses** the stretch: it's the receptor. The muscle as a whole is the effector.", "Die Muskelspindel im Muskel **registriert** die Dehnung: Sie ist der Rezeptor. Der Muskel als Ganzes ist der Effektor.") };
  if (want === "effector" && got === "receptor") return { title: tx("Receptor and effector swapped", "Rezeptor und Effektor vertauscht"), say: tx("The whole muscle that contracts is the **effector**. The receptor is the small muscle spindle inside it.", "Der ganze Muskel, der sich zusammenzieht, ist der **Effektor**. Der Rezeptor ist die kleine Muskelspindel darin.") };
  return null;
}

function arcFigureTask(rng: Rng): Exercise {
  const id = rng.pick(ARC_IDS);
  const label = (x: string) => REFLEX_PARTS.find((p) => p.id === x)!.label;
  const tempting = ARC_IDS.filter((x) => x !== id && arcMix(id, x));
  const rest = rng.shuffle(ARC_IDS.filter((x) => x !== id && !tempting.includes(x)));
  const others = [...tempting, ...rest].slice(0, 3);
  const c = choice(rng, [{ text: label(id) }, ...others.map((x) => ({ text: label(x), ...(arcMix(id, x) ?? {}) }))]);
  return {
    instruction: tx("What is marked in the reflex arc?", "Was ist im Reflexbogen markiert?"),
    text: tx("The knee-jerk reflex: what is the structure marked with **?**", "Der Kniesehnenreflex: Was ist die mit **?** markierte Struktur?"),
    visual: pic(NerveReflexArc, { mode: "numbers", ask: id, legend: "none" }),
    answer: c.answer,
    hint: tx("Blue: the way in to the spinal cord. Red: the way out to the muscle.", "Blau: der Hinweg zum Rückenmark. Rot: der Rückweg zum Muskel."),
    solution: [answerFrame(label(id), REFLEX_PARTS.find((p) => p.id === id)!.info!)],
    mistakes: c.mistakes,
  };
}

const OWN: { name: Text; own: boolean; why: Text }[] = [
  { name: tx("knee-jerk reflex", "Kniesehnenreflex"), own: true, why: tx("Stretch receptor and effector are both in the thigh muscle.", "Dehnungsrezeptor und Effektor liegen beide im Oberschenkelmuskel.") },
  { name: tx("ankle-jerk reflex", "Achillessehnenreflex"), own: true, why: tx("Stretch receptor and effector are both in the calf muscle.", "Dehnungsrezeptor und Effektor liegen beide im Wadenmuskel.") },
  { name: tx("biceps reflex", "Bizepssehnenreflex"), own: true, why: tx("Stretch receptor and effector are both in the biceps.", "Dehnungsrezeptor und Effektor liegen beide im Bizeps.") },
  { name: tx("blink reflex", "Lidschlussreflex"), own: false, why: tx("The stimulus hits the cornea, but the eyelid muscle responds.", "Der Reiz trifft die Hornhaut, es reagiert aber der Lidmuskel.") },
  { name: tx("cough reflex", "Hustenreflex"), own: false, why: tx("Receptors in the airways, effectors are the breathing muscles.", "Rezeptoren in den Atemwegen, Effektoren sind die Atemmuskeln.") },
  { name: tx("withdrawal reflex", "Rückziehreflex"), own: false, why: tx("Pain receptors in the skin, effectors are the arm flexors.", "Schmerzrezeptoren in der Haut, Effektoren sind die Beugemuskeln des Arms.") },
  { name: tx("pupillary reflex", "Pupillenreflex"), own: false, why: tx("Light hits the retina, the iris muscle responds.", "Licht trifft die Netzhaut, es reagiert der Irismuskel.") },
  { name: tx("sneeze reflex", "Niesreflex"), own: false, why: tx("Receptors in the nose, effectors are the breathing muscles.", "Rezeptoren in der Nase, Effektoren sind die Atemmuskeln.") },
  { name: tx("swallowing reflex", "Schluckreflex"), own: false, why: tx("Receptors in the throat, effectors are the throat muscles.", "Rezeptoren im Rachen, Effektoren sind die Schluckmuskeln.") },
];
const EIGEN = tx("reflex of the same organ (Eigenreflex)", "Eigenreflex");
const FREMD = tx("reflex of another organ (Fremdreflex)", "Fremdreflex");

function ownTask(rng: Rng): Exercise {
  const r = rng.pick(OWN);
  const opts: Opt[] = r.own
    ? [{ text: EIGEN }, { text: FREMD, title: tx("Same muscle", "Derselbe Muskel"), say: tx("Here the receptor (muscle spindle) and the effector are in the **same** muscle. That makes it a reflex of the same organ (Eigenreflex).", "Hier liegen Rezeptor (Muskelspindel) und Effektor im **selben** Muskel. Das macht ihn zum Eigenreflex.") }]
    : [{ text: FREMD }, { text: EIGEN, title: tx("Two different organs", "Zwei verschiedene Organe"), say: tx("Stimulus and response are in **different** organs here. That makes it a reflex of another organ (Fremdreflex).", "Reiz und Reaktion liegen hier in **verschiedenen** Organen. Das macht ihn zum Fremdreflex.") }];
  const c = choice(rng, opts);
  return {
    instruction: tx("Same organ or another organ?", "Eigenreflex oder Fremdreflex?"),
    text: tx(`Is the **${en(r.name)}** a reflex of the same organ or of another organ?`, `Ist der **${de(r.name)}** ein Eigenreflex oder ein Fremdreflex?`),
    answer: c.answer,
    hint: tx("Where is the receptor, and which organ responds?", "Wo sitzt der Rezeptor, und welches Organ reagiert?"),
    solution: [answerFrame(r.own ? EIGEN : FREMD, r.why)],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Facts: CNS and PNS, reflexes, synapse, drugs, eye

type Fact = { q: Text; opts: Opt[]; hint: Text; answer: Text; note: Text };
const NS_FACTS: Fact[] = [
  {
    q: tx("Which nerve fibres carry signals from the sense organs to the central nervous system?", "Welche Nervenfasern leiten Erregungen von den Sinnesorganen zum Zentralnervensystem?"),
    opts: [
      { text: tx("sensory (afferent) fibres", "sensorische (afferente) Fasern") },
      { text: tx("motor (efferent) fibres", "motorische (efferente) Fasern"), title: tx("Sensory and motor swapped", "Sensorisch und motorisch vertauscht"), say: tx("Motor fibres carry commands **from** the CNS to the muscles. Signals **from the senses** run in **sensory** fibres.", "Motorische Fasern leiten Befehle **vom** ZNS zu den Muskeln. Erregungen **von den Sinnen** laufen in **sensorischen** Fasern.") },
      { text: tx("fibres of the myelin sheath", "Fasern der Myelinscheide") },
    ],
    hint: tx("Sensory: to do with the senses.", "Sensorisch: hat mit den Sinnen zu tun."),
    answer: tx("sensory (afferent)", "sensorisch (afferent)"),
    note: tx("**Sensory** (afferent) fibres lead **to** the CNS, **motor** (efferent) fibres lead **away** from it to the muscles.", "**Sensorische** (afferente) Fasern leiten **zum** ZNS hin, **motorische** (efferente) Fasern **vom** ZNS weg zu den Muskeln."),
  },
  {
    q: tx("Which nerve fibres carry commands from the spinal cord to a muscle?", "Welche Nervenfasern leiten Befehle vom Rückenmark zu einem Muskel?"),
    opts: [
      { text: tx("motor (efferent) fibres", "motorische (efferente) Fasern") },
      { text: tx("sensory (afferent) fibres", "sensorische (afferente) Fasern"), title: tx("Sensory and motor swapped", "Sensorisch und motorisch vertauscht"), say: tx("Sensory fibres bring news **from** the body **to** the CNS. Commands to muscles run in **motor** fibres (motor = movement).", "Sensorische Fasern bringen Meldungen **vom** Körper **zum** ZNS. Befehle an Muskeln laufen in **motorischen** Fasern (Motorik = Bewegung).") },
      { text: tx("dendrites of the brain", "Dendriten des Gehirns") },
    ],
    hint: tx("Motor: to do with movement.", "Motorisch: hat mit Bewegung zu tun."),
    answer: tx("motor (efferent)", "motorisch (efferent)"),
    note: tx("**Motor** (efferent) fibres carry commands from the CNS to the effectors, e.g. muscles.", "**Motorische** (efferente) Fasern leiten Befehle vom ZNS zu den Effektoren, z. B. Muskeln."),
  },
  {
    q: tx("What makes up the central nervous system (CNS)?", "Woraus besteht das Zentralnervensystem (ZNS)?"),
    opts: [
      { text: tx("brain and spinal cord", "aus Gehirn und Rückenmark") },
      { text: tx("brain and all the nerves of the body", "aus Gehirn und allen Nerven des Körpers"), title: tx("The nerves are peripheral", "Die Nerven sind peripher"), say: tx("The nerves out in the body form the **peripheral** nervous system. The CNS is just brain and spinal cord.", "Die Nerven draußen im Körper bilden das **periphere** Nervensystem. Zum ZNS gehören nur Gehirn und Rückenmark.") },
      { text: tx("only the brain", "nur aus dem Gehirn"), title: tx("The spinal cord belongs too", "Das Rückenmark gehört dazu"), say: tx("The spinal cord is part of the CNS too: it processes signals and switches reflexes.", "Auch das Rückenmark gehört zum ZNS: Es verarbeitet Erregungen und schaltet Reflexe.") },
    ],
    hint: tx("Central: in the middle of the body, protected by skull and spine.", "Zentral: in der Mitte des Körpers, geschützt von Schädel und Wirbelsäule."),
    answer: tx("brain + spinal cord", "Gehirn + Rückenmark"),
    note: tx("CNS = brain + spinal cord. All other nerves form the peripheral nervous system.", "ZNS = Gehirn + Rückenmark. Alle übrigen Nerven bilden das periphere Nervensystem."),
  },
  {
    q: tx("What is a nerve?", "Was ist ein Nerv?"),
    opts: [
      { text: tx("a bundle of many nerve fibres (axons)", "ein Bündel aus vielen Nervenfasern (Axonen)") },
      { text: tx("a single nerve cell", "eine einzelne Nervenzelle"), title: tx("Cell and nerve aren't the same", "Zelle und Nerv sind verschieden"), say: tx("A nerve is like a cable with many wires: it contains the fibres of many nerve cells.", "Ein Nerv ist wie ein Kabel mit vielen Drähten: Er enthält die Fasern vieler Nervenzellen.") },
      { text: tx("a part of the brain", "ein Teil des Gehirns") },
    ],
    hint: tx("Think of a cable with many wires inside.", "Denk an ein Kabel mit vielen Drähten darin."),
    answer: tx("bundle of fibres", "Faserbündel"),
    note: tx("A nerve is a bundle of many nerve fibres, often with sensory and motor fibres together.", "Ein Nerv ist ein Bündel aus vielen Nervenfasern, oft mit sensorischen und motorischen Fasern zusammen."),
  },
  {
    q: tx("Where is the signal switched from the sensory to the motor neuron in the knee-jerk reflex?", "Wo wird beim Kniesehnenreflex vom sensorischen auf das motorische Neuron umgeschaltet?"),
    opts: [
      { text: tx("in the spinal cord", "im Rückenmark") },
      { text: tx("in the cerebrum", "im Großhirn"), title: tx("The brain doesn't decide", "Das Gehirn entscheidet nicht"), say: tx("Classic mistake! The brain isn't asked in a reflex. The switch happens directly in the **spinal cord**, that's why it's so fast.", "Klassischer Irrtum! Beim Reflex wird das Gehirn nicht gefragt. Die Umschaltung passiert direkt im **Rückenmark**, darum geht es so schnell.") },
      { text: tx("in the knee joint", "im Kniegelenk"), title: tx("Neurons meet in the CNS", "Neurone treffen sich im ZNS"), say: tx("In the knee there are only receptors and muscle. The neurons connect at a synapse in the spinal cord.", "Im Knie gibt es nur Rezeptoren und Muskel. Verbunden werden die Neurone an einer Synapse im Rückenmark.") },
      { text: tx("in the cerebellum", "im Kleinhirn"), title: tx("Not in the head", "Nicht im Kopf"), say: tx("This reflex doesn't go up to the head at all: it's switched in the **spinal cord**.", "Dieser Reflex läuft gar nicht bis in den Kopf: Er wird im **Rückenmark** umgeschaltet.") },
    ],
    hint: tx("Why is a reflex so fast?", "Warum ist ein Reflex so schnell?"),
    answer: tx("spinal cord", "Rückenmark"),
    note: tx("In the **spinal cord**, at a single synapse. The brain only learns about it afterwards.", "Im **Rückenmark**, an einer einzigen Synapse. Das Gehirn erfährt es erst hinterher."),
  },
  {
    q: tx("Why are reflexes so fast?", "Warum laufen Reflexe so schnell ab?"),
    opts: [
      { text: tx("The route is short with few synapses, and the cerebrum isn't asked.", "Der Weg ist kurz mit wenigen Synapsen, und das Großhirn wird nicht gefragt.") },
      { text: tx("The brain decides especially fast for reflexes.", "Das Gehirn entscheidet bei Reflexen besonders schnell."), title: tx("No decision at all", "Gar keine Entscheidung"), say: tx("In a reflex nobody decides: the switch happens in the spinal cord or brain stem, without the cerebrum.", "Beim Reflex entscheidet niemand: Umgeschaltet wird im Rückenmark oder Hirnstamm, ohne Großhirn.") },
      { text: tx("Reflex nerves have no synapses at all.", "Reflexnerven haben gar keine Synapsen."), title: tx("At least one synapse", "Mindestens eine Synapse"), say: tx("Even the knee-jerk reflex has one synapse in the spinal cord, where sensory and motor neuron meet.", "Selbst der Kniesehnenreflex hat eine Synapse im Rückenmark, an der sich sensorisches und motorisches Neuron treffen.") },
    ],
    hint: tx("Compare the route of a reflex with your ruler-catching reaction.", "Vergleich den Weg eines Reflexes mit deiner Reaktion beim Linealfangen."),
    answer: tx("short route", "kurzer Weg"),
    note: tx("Short route, few synapses, no detour through the cerebrum: that saves time.", "Kurzer Weg, wenige Synapsen, kein Umweg über das Großhirn: Das spart Zeit."),
  },
  {
    q: tx("How is the signal passed across the synaptic cleft?", "Wie wird die Erregung über den synaptischen Spalt übertragen?"),
    opts: [
      { text: tx("by a chemical messenger (transmitter)", "durch einen Botenstoff (Transmitter)") },
      { text: tx("by an electrical spark that jumps across", "durch einen elektrischen Funken, der überspringt"), title: tx("Chemical, not electrical", "Chemisch, nicht elektrisch"), say: tx("At most synapses the signal does **not** jump across: it becomes chemical. A transmitter crosses the cleft and binds to receptors.", "An den meisten Synapsen springt die Erregung **nicht** über: Sie wird chemisch. Ein Transmitter wandert durch den Spalt und bindet an Rezeptoren.") },
      { text: tx("through the myelin sheath", "über die Myelinscheide") },
    ],
    hint: tx("Electrical → ? → electrical.", "Elektrisch → ? → elektrisch."),
    answer: tx("transmitter", "Transmitter"),
    note: tx("Electrical → **chemical** (transmitter) → electrical.", "Elektrisch → **chemisch** (Transmitter) → elektrisch."),
  },
  {
    q: tx("Why does a synapse pass signals in one direction only?", "Warum gibt eine Synapse Erregungen nur in eine Richtung weiter?"),
    opts: [
      { text: tx("Only the end bulb releases transmitter, and only the next cell has receptors.", "Nur das Endknöpfchen schüttet Transmitter aus, und nur die nachfolgende Zelle hat Rezeptoren.") },
      { text: tx("The cleft is a one-way street that only opens forwards.", "Der Spalt ist eine Einbahnstraße, die sich nur nach vorn öffnet."), title: tx("It's the molecules", "Es liegt an den Molekülen"), say: tx("The cleft is just a gap. The direction comes from the parts: vesicles with transmitter are only in the end bulb, receptors only on the next cell.", "Der Spalt ist nur eine Lücke. Die Richtung kommt von den Bauteilen: Vesikel mit Transmitter gibt es nur im Endknöpfchen, Rezeptoren nur an der nachfolgenden Zelle.") },
      { text: tx("The next cell has no membrane.", "Die nachfolgende Zelle hat keine Membran.") },
    ],
    hint: tx("Who sends the messenger, who has the 'locks' for it?", "Wer verschickt den Botenstoff, wer hat die „Schlösser“ dafür?"),
    answer: tx("transmitter only in the end bulb", "Transmitter nur im Endknöpfchen"),
    note: tx("Transmitter is only released from the end bulb; receptors sit only on the next cell. So the signal can only go one way.", "Transmitter wird nur vom Endknöpfchen ausgeschüttet; Rezeptoren sitzen nur an der nachfolgenden Zelle. Darum geht es nur in eine Richtung."),
  },
  {
    q: tx("Where do many drugs and medicines act in the nervous system?", "Wo greifen viele Drogen und Medikamente im Nervensystem an?"),
    opts: [
      { text: tx("at the synapses", "an den Synapsen") },
      { text: tx("at the myelin sheath", "an der Myelinscheide"), title: tx("The synapse is the switch", "Die Synapse ist die Schaltstelle"), say: tx("Most drugs act where transmitters are at work: at the **synapses**, e.g. by imitating a transmitter or blocking its breakdown.", "Die meisten Drogen wirken dort, wo Transmitter arbeiten: an den **Synapsen**, z. B. indem sie einen Transmitter nachahmen oder seinen Abbau stören.") },
      { text: tx("in the bones", "in den Knochen") },
    ],
    hint: tx("Where are chemical messengers at work?", "Wo arbeiten chemische Botenstoffe?"),
    answer: tx("synapses", "Synapsen"),
    note: tx("Drugs change the transmission at **synapses**: nicotine, for example, imitates the transmitter acetylcholine.", "Drogen verändern die Übertragung an **Synapsen**: Nikotin zum Beispiel ahmt den Transmitter Acetylcholin nach."),
  },
  {
    q: tx("What does 'tolerance' to a drug mean?", "Was bedeutet „Toleranz“ bei einer Droge?"),
    opts: [
      { text: tx("The body gets used to it: you need more and more for the same effect.", "Der Körper gewöhnt sich daran: Für dieselbe Wirkung braucht man immer mehr.") },
      { text: tx("The drug works more and more strongly over time.", "Die Droge wirkt mit der Zeit immer stärker."), title: tx("The other way round", "Andersherum"), say: tx("With tolerance the same amount works **less**, because the synapses adapt. That's how people end up taking more and more.", "Bei Toleranz wirkt dieselbe Menge **schwächer**, weil sich die Synapsen anpassen. So nimmt man immer mehr.") },
      { text: tx("You can stop at any time without problems.", "Man kann jederzeit ohne Probleme aufhören."), title: tx("Tolerance leads to dependence", "Toleranz führt zur Abhängigkeit"), say: tx("Tolerance is often a step towards **dependence**. Stopping can then cause withdrawal symptoms.", "Toleranz ist oft ein Schritt zur **Abhängigkeit**. Beim Aufhören können dann Entzugserscheinungen auftreten.") },
    ],
    hint: tx("Think of what happens to the effect over time.", "Denk daran, was mit der Wirkung im Lauf der Zeit passiert."),
    answer: tx("more for the same effect", "mehr für dieselbe Wirkung"),
    note: tx("**Tolerance**: the nervous system adapts, so the same dose works less. A step on the road to addiction.", "**Toleranz**: Das Nervensystem passt sich an, dieselbe Dosis wirkt schwächer. Ein Schritt auf dem Weg zur Sucht."),
  },
  {
    q: tx("How can you tell that someone is physically dependent on a drug?", "Woran erkennt man, dass jemand körperlich abhängig von einer Droge ist?"),
    opts: [
      { text: tx("When they stop, withdrawal symptoms appear (shaking, sweating, restlessness).", "Beim Absetzen treten Entzugserscheinungen auf (Zittern, Schwitzen, Unruhe).") },
      { text: tx("The drug no longer has any effect at all.", "Die Droge wirkt überhaupt nicht mehr.") },
      { text: tx("They only take it at weekends.", "Die Person nimmt sie nur am Wochenende."), title: tx("Withdrawal is the sign", "Entzug ist das Zeichen"), say: tx("How often someone takes a drug doesn't show dependence by itself. The typical sign is **withdrawal symptoms** when stopping.", "Wie oft jemand etwas nimmt, zeigt allein noch keine Abhängigkeit. Das typische Zeichen sind **Entzugserscheinungen** beim Absetzen.") },
    ],
    hint: tx("What happens when the drug is suddenly missing?", "Was passiert, wenn die Droge plötzlich fehlt?"),
    answer: tx("withdrawal symptoms", "Entzugserscheinungen"),
    note: tx("Physical dependence shows itself through **withdrawal symptoms**. Psychological dependence is the strong craving for the drug.", "Körperliche Abhängigkeit zeigt sich durch **Entzugserscheinungen**. Psychische Abhängigkeit ist das starke Verlangen nach der Droge."),
  },
];

const EYE_FACTS: Fact[] = [
  {
    q: tx("By moonlight you can hardly see colours. Which sensory cells are mainly at work now?", "Bei Mondlicht siehst du kaum Farben. Welche Sinneszellen arbeiten jetzt vor allem?"),
    opts: [
      { text: tx("rods", "Stäbchen") },
      { text: tx("cones", "Zapfen"), title: tx("Cones need lots of light", "Zapfen brauchen viel Licht"), say: tx("Cones see colours, but they need plenty of light. In dim light the very sensitive **rods** take over, and they only see light and dark.", "Zapfen sehen Farben, brauchen aber viel Licht. In der Dämmerung übernehmen die sehr empfindlichen **Stäbchen**, und die sehen nur hell und dunkel.") },
      { text: tx("the cells of the blind spot", "die Zellen des blinden Flecks"), title: tx("No cells there", "Dort gibt es keine"), say: tx("There are no sensory cells at the blind spot at all.", "Am blinden Fleck gibt es überhaupt keine Sinneszellen.") },
    ],
    hint: tx("'At night all cats are grey.'", "„Nachts sind alle Katzen grau.“"),
    answer: tx("rods", "Stäbchen"),
    note: tx("**Rods** are very sensitive to light but don't see colours. That's why at night all cats look grey.", "**Stäbchen** sind sehr lichtempfindlich, sehen aber keine Farben. Darum sind nachts alle Katzen grau."),
  },
  {
    q: tx("Which sensory cells let you see colours?", "Welche Sinneszellen ermöglichen das Farbensehen?"),
    opts: [
      { text: tx("cones", "Zapfen") },
      { text: tx("rods", "Stäbchen"), title: tx("Rods and cones swapped", "Stäbchen und Zapfen vertauscht"), say: tx("Rods only tell light from dark. Colours are seen by the **cones**: there are three kinds, for red, green and blue light.", "Stäbchen unterscheiden nur hell und dunkel. Farben sehen die **Zapfen**: Es gibt drei Sorten, für rotes, grünes und blaues Licht.") },
      { text: tx("the iris", "die Iris"), title: tx("The iris is coloured", "Die Iris ist nur farbig"), say: tx("The iris has a colour, but it doesn't see any. Colour vision is done by the **cones** in the retina.", "Die Iris hat zwar eine Farbe, sieht aber keine. Farben sehen die **Zapfen** in der Netzhaut.") },
    ],
    hint: tx("There are three kinds of them.", "Von ihnen gibt es drei Sorten."),
    answer: tx("cones", "Zapfen"),
    note: tx("**Cones** see colours (three kinds: red, green, blue). They need bright light.", "**Zapfen** sehen Farben (drei Sorten: rot, grün, blau). Sie brauchen helles Licht."),
  },
  {
    q: tx("Which sensory cells are packed especially tightly in the yellow spot?", "Welche Sinneszellen liegen im gelben Fleck besonders dicht?"),
    opts: [
      { text: tx("cones", "Zapfen") },
      { text: tx("rods", "Stäbchen"), title: tx("Rods are further out", "Stäbchen liegen weiter außen"), say: tx("In the yellow spot there are almost only **cones**, tightly packed: that's where you see most sharply and in colour. Rods are mostly around it.", "Im gelben Fleck gibt es fast nur **Zapfen**, dicht an dicht: Dort siehst du am schärfsten und farbig. Stäbchen liegen vor allem drumherum.") },
    ],
    hint: tx("The yellow spot is where you see most sharply and in colour.", "Am gelben Fleck siehst du am schärfsten und farbig."),
    answer: tx("cones", "Zapfen"),
    note: tx("The yellow spot holds tightly packed **cones**: sharpest colour vision.", "Im gelben Fleck liegen dicht gepackte **Zapfen**: schärfstes Farbensehen."),
  },
  {
    q: tx("Which sensory cells are there most of in the retina?", "Von welchen Sinneszellen gibt es in der Netzhaut am meisten?"),
    opts: [
      { text: tx("rods (about 120 million)", "Stäbchen (etwa 120 Millionen)") },
      { text: tx("cones (about 6 million)", "Zapfen (etwa 6 Millionen)"), title: tx("Far fewer cones", "Viel weniger Zapfen"), say: tx("There are only about 6 million cones but about **120 million rods**, twenty times as many.", "Zapfen gibt es nur etwa 6 Millionen, Stäbchen aber etwa **120 Millionen**, zwanzigmal so viele.") },
    ],
    hint: tx("One kind outnumbers the other about twenty to one.", "Eine Sorte ist etwa zwanzigmal so häufig."),
    answer: tx("rods", "Stäbchen"),
    note: tx("About 120 million **rods** and only about 6 million cones per eye.", "Etwa 120 Millionen **Stäbchen** und nur etwa 6 Millionen Zapfen pro Auge."),
  },
  {
    q: tx("You walk into a dark room. What helps you see better after a while (dark adaptation)?", "Du gehst in einen dunklen Raum. Was hilft dir, nach einer Weile besser zu sehen (Dunkeladaptation)?"),
    opts: [
      { text: tx("The pupils widen and the sensory cells slowly become more sensitive.", "Die Pupillen werden weit und die Sinneszellen werden langsam empfindlicher.") },
      { text: tx("The lens becomes rounder.", "Die Linse wird kugeliger."), title: tx("That's for near things", "Das ist fürs Nahsehen"), say: tx("A rounder lens helps you see **near** things sharply. Adjusting to darkness is done by the pupil and the sensory cells.", "Eine kugeligere Linse hilft beim **Nahsehen**. An die Dunkelheit passen sich Pupille und Sinneszellen an.") },
      { text: tx("The cones take over seeing.", "Die Zapfen übernehmen das Sehen."), title: tx("Rods for the dark", "Im Dunkeln die Stäbchen"), say: tx("In the dark the **rods** take over, cones need bright light.", "Im Dunkeln übernehmen die **Stäbchen**, Zapfen brauchen viel Licht.") },
    ],
    hint: tx("There's a fast part and a slow part.", "Es gibt einen schnellen und einen langsamen Teil."),
    answer: tx("pupil wide, cells more sensitive", "Pupille weit, Zellen empfindlicher"),
    note: tx("Fast: the pupil widens. Slow (up to about 30 minutes): the sensory cells, especially the rods, become more sensitive.", "Schnell: Die Pupille wird weit. Langsam (bis etwa 30 Minuten): Die Sinneszellen, vor allem die Stäbchen, werden empfindlicher."),
  },
  {
    q: tx("Why do you see a faint star better if you look slightly to the side of it?", "Warum siehst du einen schwachen Stern besser, wenn du knapp an ihm vorbeischaust?"),
    opts: [
      { text: tx("Next to the yellow spot there are many light-sensitive rods.", "Neben dem gelben Fleck liegen viele lichtempfindliche Stäbchen.") },
      { text: tx("The yellow spot has the most rods.", "Im gelben Fleck liegen die meisten Stäbchen."), title: tx("The yellow spot has cones", "Im gelben Fleck sitzen Zapfen"), say: tx("The yellow spot is packed with cones, which need bright light. The sensitive rods lie **around** it.", "Im gelben Fleck sitzen Zapfen, die viel Licht brauchen. Die empfindlichen Stäbchen liegen **drumherum**.") },
      { text: tx("The lens bends more strongly at the edge.", "Die Linse bricht am Rand stärker.") },
    ],
    hint: tx("Where are the rods?", "Wo liegen die Stäbchen?"),
    answer: tx("rods beside the yellow spot", "Stäbchen neben dem gelben Fleck"),
    note: tx("Looking past the star puts its image beside the yellow spot, where there are many sensitive **rods**.", "Schaust du am Stern vorbei, fällt sein Bild neben den gelben Fleck, wo viele empfindliche **Stäbchen** sitzen."),
  },
];

function factTask(rng: Rng, bank: Fact[], instruction: Text): Exercise {
  const f = rng.pick(bank);
  const c = choice(rng, f.opts);
  return { instruction, text: f.q, answer: c.answer, hint: f.hint, solution: [answerFrame(f.answer, f.note)], mistakes: c.mistakes };
}

function cnsMultiTask(rng: Rng): Exercise {
  const cns = [tx("cerebrum", "Großhirn"), tx("cerebellum", "Kleinhirn"), tx("spinal cord", "Rückenmark"), tx("brain stem", "Hirnstamm"), tx("diencephalon", "Zwischenhirn")];
  const pns = [tx("sciatic nerve in the leg", "Ischiasnerv im Bein"), tx("nerve in the arm", "Nerv im Arm"), tx("nerve fibres in the skin", "Nervenfasern in der Haut"), tx("nerves to the heart", "Nerven zum Herzen")];
  const a = some(rng, cns, rng.int(2, 3));
  const b = some(rng, pns, 5 - a.length);
  const items = [...a.map((t) => ({ text: t, ok: true })), ...b.map((t) => ({ text: t, ok: false }))];
  const m = multi(rng, items, [
    { pick: [...a.map((_, i) => i), a.length], title: tx("That nerve is peripheral", "Dieser Nerv ist peripher"), say: tx("Nerves out in the body belong to the **peripheral** nervous system, even long ones like the sciatic nerve. The CNS is only brain and spinal cord.", "Nerven draußen im Körper gehören zum **peripheren** Nervensystem, auch lange wie der Ischiasnerv. Zum ZNS gehören nur Gehirn und Rückenmark.") },
    ...(a.some((t) => en(t) === "spinal cord") ? [{ pick: a.map((t, i) => (en(t) === "spinal cord" ? -1 : i)).filter((i) => i >= 0), title: tx("Spinal cord forgotten", "Rückenmark vergessen"), say: tx("The spinal cord is part of the CNS too, not just the brain.", "Auch das Rückenmark gehört zum ZNS, nicht nur das Gehirn.") }] : []),
  ]);
  return {
    instruction: tx("Central nervous system?", "Zentralnervensystem?"),
    text: tx("Which of these belong to the central nervous system (CNS)?", "Was davon gehört zum Zentralnervensystem (ZNS)?"),
    answer: m.answer,
    hint: tx("CNS = brain + spinal cord.", "ZNS = Gehirn + Rückenmark."),
    solution: [{ math: cat(q(tx("CNS", "ZNS")), "=", q(tx("brain", "Gehirn")), "+", q(tx("spinal cord", "Rückenmark"))), note: tx("All parts of the brain and the spinal cord form the CNS. Nerves in the body are peripheral.", "Alle Teile des Gehirns und das Rückenmark bilden das ZNS. Nerven im Körper sind peripher.") }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Neuron and synapse

type NPart = { id: string; name: Text; accept: Text[]; job: Text };
const NPARTS: NPart[] = [
  { id: "dendrites", name: tx("dendrites", "Dendriten"), accept: [tx("dendrites", "Dendriten"), "Dendrit", "dendrite"], job: tx("receive signals from other cells", "nehmen Erregungen von anderen Zellen auf") },
  { id: "soma", name: tx("cell body", "Zellkörper"), accept: [tx("cell body", "Zellkörper"), "Soma"], job: tx("contains the nucleus; signals come together here", "enthält den Zellkern; hier laufen die Erregungen zusammen") },
  { id: "nucleus", name: tx("nucleus", "Zellkern"), accept: [tx("nucleus", "Zellkern"), "Kern"], job: tx("holds the genetic information", "enthält die Erbinformation") },
  { id: "hillock", name: tx("axon hillock", "Axonhügel"), accept: [tx("axon hillock", "Axonhügel")], job: tx("decides whether an impulse is sent down the axon", "entscheidet, ob eine Erregung ins Axon geschickt wird") },
  { id: "axon", name: tx("axon (neurite)", "Axon (Neurit)"), accept: [tx("axon", "Axon"), "Neurit", "neurite"], job: tx("carries the impulse away from the cell body", "leitet die Erregung vom Zellkörper weg") },
  { id: "myelin", name: tx("myelin sheath", "Myelinscheide"), accept: [tx("myelin sheath", "Myelinscheide"), "Markscheide", "Schwann-Zelle", "Schwannsche Zelle", "Schwann cell", "myelin"], job: tx("insulates the axon and speeds up conduction", "isoliert das Axon und beschleunigt die Leitung") },
  { id: "node", name: tx("node of Ranvier", "Ranvierscher Schnürring"), accept: [tx("node of Ranvier", "Ranvierscher Schnürring"), "Schnürring", "Ranvier-Schnürring", "Ranvier node"], job: tx("gap in the myelin where the impulse is renewed", "Lücke in der Myelinscheide, an der die Erregung erneuert wird") },
  { id: "terminal", name: tx("synaptic end bulbs", "Endknöpfchen"), accept: [tx("synaptic end bulb", "Endknöpfchen"), "synaptisches Endknöpfchen", "end bulb", "axon terminal", "synaptic knob", "end bulbs"], job: tx("release transmitter onto the next cell", "geben Transmitter an die nächste Zelle ab") },
];
function neuronMix(want: string, got: string): { title: Text; say: Text } | null {
  const M: Record<string, { title: Text; say: Text }> = {
    "axon>dendrites": { title: tx("Dendrites receive", "Dendriten nehmen auf"), say: tx("Dendrites are the short branches that **receive** signals. The one long extension that carries the impulse away is the **axon**.", "Dendriten sind die kurzen Verzweigungen, die Erregungen **aufnehmen**. Der eine lange Fortsatz, der sie wegleitet, ist das **Axon**.") },
    "dendrites>axon": { title: tx("The axon sends", "Das Axon leitet weg"), say: tx("The axon is the one long extension that carries signals **away**. The many short branches that receive signals are the **dendrites**.", "Das Axon ist der eine lange Fortsatz, der Erregungen **wegleitet**. Die vielen kurzen Verzweigungen, die aufnehmen, sind die **Dendriten**.") },
    "node>myelin": { title: tx("The gap, not the sheath", "Die Lücke, nicht die Hülle"), say: tx("The myelin sheath is the wrapping. The small **gap** between two Schwann cells is the **node of Ranvier**.", "Die Myelinscheide ist die Umhüllung. Die kleine **Lücke** zwischen zwei Schwann-Zellen ist der **Ranviersche Schnürring**.") },
    "myelin>node": { title: tx("The sheath, not the gap", "Die Hülle, nicht die Lücke"), say: tx("The node of Ranvier is the gap. The thick wrapping of Schwann cells around the axon is the **myelin sheath**.", "Der Schnürring ist die Lücke. Die dicke Hülle aus Schwann-Zellen um das Axon ist die **Myelinscheide**.") },
    "hillock>soma": { title: tx("Just where the axon starts", "Genau am Axonanfang"), say: tx("Close! It's the cone-shaped spot where the axon leaves the cell body: the **axon hillock**.", "Fast! Es ist die kegelförmige Stelle, an der das Axon den Zellkörper verlässt: der **Axonhügel**.") },
    "terminal>dendrites": { title: tx("Branched at both ends", "Verzweigt sind beide"), say: tx("Both are branched! But dendrites sit on the cell body and receive. The branches at the **end of the axon** carry the **end bulbs**, which release transmitter.", "Verzweigt sind beide! Aber Dendriten sitzen am Zellkörper und nehmen auf. Die Verzweigungen am **Ende des Axons** tragen die **Endknöpfchen**, die Transmitter abgeben.") },
    "dendrites>terminal": { title: tx("Branched at both ends", "Verzweigt sind beide"), say: tx("Both are branched! But the end bulbs sit at the end of the axon. The short branches on the **cell body** that receive signals are the **dendrites**.", "Verzweigt sind beide! Aber die Endknöpfchen sitzen am Ende des Axons. Die kurzen Verzweigungen am **Zellkörper**, die Erregungen aufnehmen, sind die **Dendriten**.") },
    "nucleus>soma": { title: tx("Inside the cell body", "Im Zellkörper drin"), say: tx("The cell body is the whole round part. The structure inside it with the genetic information is the **nucleus**.", "Der Zellkörper ist der ganze runde Teil. Die Struktur darin mit der Erbinformation ist der **Zellkern**.") },
  };
  return M[`${want}>${got}`] ?? null;
}

function neuronFigureTask(rng: Rng): Exercise {
  const part = rng.pick(NPARTS);
  const wrong = NPARTS.filter((p) => p.id !== part.id && neuronMix(part.id, p.id)).map((p) => ({ accept: p.accept, ...neuronMix(part.id, p.id)! }));
  const w = word(part.accept, wrong, tx("name of the part", "Name des Teils"));
  return {
    instruction: tx("Name the part of the neuron", "Benenne den Teil der Nervenzelle"),
    text: tx("What is the part of the nerve cell marked with **?** called?", "Wie heißt der mit **?** markierte Teil der Nervenzelle?"),
    visual: pic(NerveNeuron, { mode: "numbers", ask: part.id, legend: "none" }),
    answer: w.answer,
    hint: tx("Follow the impulse: dendrites → cell body → axon hillock → axon → end bulbs.", "Folge der Erregung: Dendriten → Zellkörper → Axonhügel → Axon → Endknöpfchen."),
    solution: [answerFrame(part.name, tx(`Its job: ${en(part.job)}.`, `Aufgabe: ${de(part.job)}.`))],
    mistakes: w.mistakes,
  };
}

function neuronMatchTask(rng: Rng): Exercise {
  const chosen = some(
    rng,
    NPARTS.filter((p) => p.id !== "nucleus"),
    4,
  );
  const pairs: [Text, Text][] = chosen.map((p) => [p.name, p.job]);
  const rest = NPARTS.filter((p) => !chosen.includes(p) && p.id !== "nucleus");
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  chosen.forEach((a) =>
    chosen.forEach((b) => {
      const mix = a !== b ? neuronMix(a.id, b.id) : null;
      if (mix) wrong.push({ pairs: [[b.name, a.job]], ...mix });
    }),
  );
  const m = match(pairs, [rng.pick(rest).job], wrong);
  return {
    instruction: tx("Match the parts of the neuron to their jobs", "Ordne den Teilen der Nervenzelle ihre Aufgaben zu"),
    text: tx("What does each part of a nerve cell do? One job is left over.", "Was macht welcher Teil einer Nervenzelle? Eine Aufgabe bleibt übrig."),
    answer: m.answer,
    hint: tx("The impulse always runs from the dendrites through the cell body to the axon and its end bulbs.", "Die Erregung läuft immer von den Dendriten über den Zellkörper ins Axon und zu den Endknöpfchen."),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Receive (dendrites), collect (cell body), decide (axon hillock), conduct (axon), pass on (end bulbs).", "Aufnehmen (Dendriten), sammeln (Zellkörper), entscheiden (Axonhügel), leiten (Axon), weitergeben (Endknöpfchen).") }],
    mistakes: m.mistakes,
  };
}

const SYN_STEPS: Text[] = [
  tx("A nerve impulse reaches the end bulb (electrical)", "Eine Erregung erreicht das Endknöpfchen (elektrisch)"),
  tx("Vesicles release transmitter into the cleft", "Vesikel schütten Transmitter in den Spalt aus"),
  tx("The transmitter crosses the synaptic cleft (chemical)", "Der Transmitter wandert durch den synaptischen Spalt (chemisch)"),
  tx("The transmitter binds to receptors of the next cell", "Der Transmitter bindet an Rezeptoren der nachfolgenden Zelle"),
  tx("Ion channels open: the next cell is excited (electrical)", "Ionenkanäle öffnen sich: Die nachfolgende Zelle wird erregt (elektrisch)"),
  tx("An enzyme breaks the transmitter down", "Ein Enzym baut den Transmitter ab"),
];
function synapseOrderTask(rng: Rng): Exercise {
  const len = rng.int(4, 6);
  const start = rng.int(0, SYN_STEPS.length - len);
  const items = SYN_STEPS.slice(start, start + len);
  const S = SYN_STEPS;
  const o = order(items, [
    { items: [S[3], S[1]], title: tx("Bound before it's released?", "Gebunden vor der Ausschüttung?"), say: tx("The transmitter is stored in vesicles in the end bulb. It must be **released** first before it can reach the receptors.", "Der Transmitter steckt in Vesikeln im Endknöpfchen. Er muss erst **ausgeschüttet** werden, bevor er die Rezeptoren erreichen kann.") },
    { items: [S[4], S[3]], title: tx("Excited before binding?", "Erregt vor der Bindung?"), say: tx("The next cell only reacts once the transmitter has bound to its receptors: that's what opens the channels.", "Die nachfolgende Zelle reagiert erst, wenn der Transmitter an ihre Rezeptoren gebunden hat: Das öffnet die Kanäle.") },
    { items: [S[5], S[4]], title: tx("Broken down too early", "Zu früh abgebaut"), say: tx("If the enzyme broke the transmitter down before it worked, nothing would arrive. The breakdown comes **at the end** and stops the signal.", "Würde das Enzym den Transmitter vorher abbauen, käme nichts an. Der Abbau kommt **am Ende** und beendet das Signal.") },
    { items: [S[1], S[0]], title: tx("Without an impulse, no release", "Ohne Erregung keine Ausschüttung"), say: tx("The vesicles only release transmitter when an impulse arrives at the end bulb.", "Die Vesikel schütten nur Transmitter aus, wenn eine Erregung am Endknöpfchen ankommt.") },
  ]);
  return {
    instruction: tx("How a synapse works", "So arbeitet eine Synapse"),
    text: tx("Put the steps of transmission at a synapse in the right order.", "Bring die Schritte der Übertragung an einer Synapse in die richtige Reihenfolge."),
    answer: o.answer,
    hint: tx("Electrical → chemical → electrical, then clean up.", "Elektrisch → chemisch → elektrisch, dann aufräumen."),
    solution: [{ math: flow([tx("electrical", "elektrisch"), tx("chemical", "chemisch"), tx("electrical", "elektrisch")], { hl: [1] }), note: tx("The impulse releases the transmitter, it crosses the cleft and binds to receptors, the next cell is excited, and an enzyme removes the transmitter.", "Die Erregung setzt den Transmitter frei, er wandert durch den Spalt und bindet an Rezeptoren, die nachfolgende Zelle wird erregt, und ein Enzym entfernt den Transmitter.") }],
    mistakes: o.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Accommodation

const NEAR_SCENES: Text[] = [tx("You read a book.", "Du liest ein Buch."), tx("You thread a needle.", "Du fädelst einen Faden in eine Nadel ein."), tx("You read a message on your phone.", "Du liest eine Nachricht auf deinem Handy."), tx("You look at a ladybird on your finger.", "Du betrachtest einen Marienkäfer auf deinem Finger.")];
const FAR_SCENES: Text[] = [tx("You look out of the window at the mountains.", "Du schaust aus dem Fenster auf die Berge."), tx("You watch a plane high in the sky.", "Du beobachtest ein Flugzeug hoch am Himmel."), tx("You read the board from the back row.", "Du liest die Tafel aus der letzten Reihe."), tx("You look for a friend at the other end of the schoolyard.", "Du suchst eine Freundin am anderen Ende des Schulhofs.")];
const ACC = {
  near: tx("ciliary muscle contracted, zonular fibres slack, lens round", "Ziliarmuskel angespannt, Linsenbänder locker, Linse kugelig"),
  far: tx("ciliary muscle relaxed, zonular fibres taut, lens flat", "Ziliarmuskel entspannt, Linsenbänder gespannt, Linse flach"),
  relaxedRound: tx("ciliary muscle relaxed, zonular fibres slack, lens round", "Ziliarmuskel entspannt, Linsenbänder locker, Linse kugelig"),
  tenseFlat: tx("ciliary muscle contracted, zonular fibres taut, lens flat", "Ziliarmuskel angespannt, Linsenbänder gespannt, Linse flach"),
};
function accOpts(near: boolean): Opt[] {
  return near
    ? [
        { text: ACC.near },
        { text: ACC.far, title: tx("That's for the distance", "Das ist die Ferneinstellung"), say: tx("Exactly the other way round: that's the setting for **far** things. For near things the lens has to bend light more strongly, so it gets rounder.", "Genau andersherum: Das ist die Einstellung für die **Ferne**. Für Nahes muss die Linse stärker brechen, also kugeliger werden.") },
        { text: ACC.relaxedRound, title: tx("The muscle has to work", "Der Muskel muss arbeiten"), say: tx("Sounds logical, but the lens only gets round when the ciliary muscle **contracts**: its ring narrows and the fibres go slack, so the elastic lens springs round.", "Klingt logisch, aber die Linse wird nur kugelig, wenn sich der Ziliarmuskel **anspannt**: Sein Ring wird enger, die Bänder erschlaffen, und die elastische Linse rundet sich.") },
        { text: ACC.tenseFlat, title: tx("The muscle doesn't pull the lens", "Der Muskel zieht nicht an der Linse"), say: tx("The contracted ciliary muscle doesn't pull on the lens: its ring gets narrower, the fibres go **slack**, and the lens rounds itself.", "Der angespannte Ziliarmuskel zieht nicht an der Linse: Sein Ring wird enger, die Bänder werden **locker**, und die Linse rundet sich von selbst.") },
      ]
    : [
        { text: ACC.far },
        { text: ACC.near, title: tx("That's for near things", "Das ist die Naheinstellung"), say: tx("Other way round: that's the setting for **near** things. For far things the lens is pulled flat and bends light less.", "Andersherum: Das ist die Einstellung für die **Nähe**. Für Fernes wird die Linse flach gezogen und bricht schwächer.") },
        { text: ACC.tenseFlat, title: tx("Relaxed for the distance", "Für die Ferne entspannt"), say: tx("For the distance the ciliary muscle **relaxes**. Its ring gets wider, the fibres are pulled taut and stretch the lens flat.", "Für die Ferne **entspannt** sich der Ziliarmuskel. Sein Ring wird weiter, die Bänder werden gespannt und ziehen die Linse flach.") },
        { text: ACC.relaxedRound, title: tx("Taut fibres, flat lens", "Gespannte Bänder, flache Linse"), say: tx("When the ciliary muscle relaxes, the zonular fibres are pulled **taut** and the lens becomes **flat**.", "Wenn der Ziliarmuskel entspannt ist, sind die Linsenbänder **gespannt** und die Linse wird **flach**.") },
      ];
}
function accExercise(near: boolean, scene: Text, rng: Rng | null): Exercise {
  const c = rng ? choice(rng, accOpts(near)) : choiceAt(0, accOpts(near));
  return {
    instruction: tx("Accommodation", "Akkommodation"),
    text: cat(scene, tx("How is your eye set?", "Wie ist dein Auge eingestellt?")),
    answer: c.answer,
    hint: tx("Near things need a strongly bending, round lens. Who makes it round?", "Nahes braucht eine stark brechende, kugelige Linse. Wer sorgt dafür?"),
    solution: [
      {
        math: near ? flow([tx("ciliary muscle contracts", "Ziliarmuskel spannt an"), tx("fibres slack", "Bänder locker"), tx("lens round", "Linse kugelig")], { hl: [2] }) : flow([tx("ciliary muscle relaxes", "Ziliarmuskel entspannt"), tx("fibres taut", "Bänder gespannt"), tx("lens flat", "Linse flach")], { hl: [2] }),
        note: near ? tx("Near: the ring muscle contracts, the fibres go slack, the elastic lens becomes round and bends light more strongly.", "Nah: Der Ringmuskel spannt sich an, die Bänder werden locker, die elastische Linse wird kugelig und bricht stärker.") : tx("Far: the muscle relaxes, the fibres are pulled taut and stretch the lens flat. It bends light less.", "Fern: Der Muskel entspannt sich, die Bänder werden gespannt und ziehen die Linse flach. Sie bricht schwächer."),
      },
    ],
    mistakes: c.mistakes,
  };
}
const accTask = (rng: Rng) => {
  const near = rng.chance(0.5);
  return accExercise(near, rng.pick(near ? NEAR_SCENES : FAR_SCENES), rng);
};

const SEE_PAIRS: { id: string; left: Text; right: Text }[] = [
  { id: "rods", left: tx("rods", "Stäbchen"), right: tx("light and dark, in dim light", "hell und dunkel, in der Dämmerung") },
  { id: "cones", left: tx("cones", "Zapfen"), right: tx("colours, in daylight", "Farben, bei Tageslicht") },
  { id: "ciliary", left: tx("ciliary muscle", "Ziliarmuskel"), right: tx("changes the shape of the lens", "verändert die Form der Linse") },
  { id: "zonule", left: tx("zonular fibres", "Linsenbänder"), right: tx("hold the lens and pull it flat", "halten die Linse und ziehen sie flach") },
  { id: "iris", left: tx("iris", "Iris"), right: tx("controls how much light gets in", "regelt den Lichteinfall") },
  { id: "fovea", left: tx("yellow spot", "Gelber Fleck"), right: tx("spot of sharpest vision", "Stelle des schärfsten Sehens") },
];
function seeMatchTask(rng: Rng): Exercise {
  const chosen = some(rng, SEE_PAIRS, 4);
  const pairs: [Text, Text][] = chosen.map((p) => [p.left, p.right]);
  const rest = SEE_PAIRS.filter((p) => !chosen.includes(p));
  const has = (id: string) => chosen.find((p) => p.id === id);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("rods") && has("cones")) wrong.push({ pairs: [[has("rods")!.left, has("cones")!.right]], title: tx("Rods and cones swapped", "Stäbchen und Zapfen vertauscht"), say: tx("Rods are sensitive but colour-blind: they work in dim light. Colours are seen by the **cones**.", "Stäbchen sind empfindlich, aber farbenblind: Sie arbeiten in der Dämmerung. Farben sehen die **Zapfen**.") });
  if (has("ciliary") && has("zonule")) wrong.push({ pairs: [[has("ciliary")!.left, has("zonule")!.right]], title: tx("The fibres pull, not the muscle", "Die Bänder ziehen, nicht der Muskel"), say: tx("The zonular fibres hold the lens and pull it flat. The ciliary muscle only decides whether they are taut or slack.", "Die Linsenbänder halten die Linse und ziehen sie flach. Der Ziliarmuskel bestimmt nur, ob sie gespannt oder locker sind.") });
  const m = match(pairs, [rng.pick(rest).right], wrong);
  return {
    instruction: tx("Seeing: who does what?", "Sehen: Wer macht was?"),
    text: tx("Match each structure to what it does. One description is left over.", "Ordne jeder Struktur ihre Aufgabe zu. Eine Beschreibung bleibt übrig."),
    answer: m.answer,
    hint: tx("Rods: dim light. Cones: colour. Ciliary muscle and fibres: focusing.", "Stäbchen: Dämmerung. Zapfen: Farbe. Ziliarmuskel und Bänder: Scharfstellen."),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Two kinds of sensory cells, and a muscle with fibres that change the lens.", "Zwei Sorten Sinneszellen und ein Muskel mit Bändern, der die Linse verformt.") }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1, () => brainMatchTask(rng)],
    [1.1, () => brainSceneTask(rng)],
    [0.7, () => brainFigureTask(rng)],
    [0.9, () => cortexSceneTask(rng)],
    [0.6, () => cortexFigureTask(rng)],
    [1.1, () => arcTask(rng)],
    [0.9, () => arcFigureTask(rng)],
    [0.8, () => ownTask(rng)],
    [1.2, () => factTask(rng, NS_FACTS, tx("Nerves, reflexes and synapses", "Nerven, Reflexe und Synapsen"))],
    [0.6, () => cnsMultiTask(rng)],
    [0.8, () => neuronFigureTask(rng)],
    [0.8, () => neuronMatchTask(rng)],
    [0.8, () => synapseOrderTask(rng)],
    [0.9, () => accTask(rng)],
    [0.8, () => factTask(rng, EYE_FACTS, tx("Rods, cones and adaptation", "Stäbchen, Zapfen und Adaptation"))],
    [0.6, () => seeMatchTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const brainCheck = (() => {
  const pick = (id: string, j: number): [Text, Text] => [region(id).name, region(id).jobs[j]];
  const pairs: [Text, Text][] = [pick("grosshirn", 0), pick("kleinhirn", 1), pick("hirnstamm", 0), pick("zwischenhirn", 0)];
  const m = match(pairs, [region("rueckenmark").jobs[1]], [
    { pairs: [[pairs[1][0], pairs[0][1]]], ...regionMix("grosshirn", "kleinhirn")! },
    { pairs: [[pairs[0][0], pairs[1][1]]], ...regionMix("kleinhirn", "grosshirn")! },
    { pairs: [[pairs[3][0], pairs[2][1]]], ...regionMix("hirnstamm", "zwischenhirn")! },
  ]);
  const ex: Exercise = {
    instruction: tx("Match the parts of the brain to their jobs", "Ordne den Hirnteilen ihre Aufgaben zu"),
    text: tx("Which part of the brain does what? One job is left over.", "Welcher Hirnteil macht was? Eine Aufgabe bleibt übrig."),
    answer: m.answer,
    hint: tx("The leftover job belongs to the spinal cord.", "Die übrige Aufgabe gehört zum Rückenmark."),
    solution: [{ math: cat(...pairs.flatMap(([n, j], i) => [q(n), "\\to", q(j), i < pairs.length - 1 ? "\\\\" : ""]).filter(Boolean)), note: tx("Switching reflexes is left over: that's the job of the spinal cord.", "Übrig bleibt das Umschalten von Reflexen: Das macht das Rückenmark.") }],
    mistakes: m.mistakes,
  };
  return ex;
})();

const CNS_WORDS = [tx("brain", "Gehirn"), tx("spinal cord", "Rückenmark")];

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Central and peripheral nervous system", "Zentrales und peripheres Nervensystem"),
      blob: tx("Time for a map of your nervous system!", "Zeit für eine Landkarte deines Nervensystems!"),
      body: tx(
        "The nervous system has two parts. The **central nervous system (CNS)**, brain and spinal cord, processes information. The **peripheral nervous system** is all the nerves that connect the CNS with the body.",
        "Das Nervensystem hat zwei Teile. Das **Zentralnervensystem (ZNS)** aus Gehirn und Rückenmark verarbeitet Informationen. Das **periphere Nervensystem** sind alle Nerven, die das ZNS mit dem Körper verbinden.",
      ),
      frames: [
        { math: cat(q(tx("CNS", "ZNS"), "z"), "=", q(CNS_WORDS[0], "g"), "+", q(CNS_WORDS[1], "r")), note: tx("The **central nervous system** is the **brain** and the **spinal cord**. Information is processed and commands are given here.", "Das **Zentralnervensystem** besteht aus **Gehirn** und **Rückenmark**. Hier werden Informationen verarbeitet und Befehle erteilt.") },
        { math: cat(q(tx("peripheral NS", "peripheres NS"), "p"), "=", q(tx("nerves in the body", "Nerven im Körper"), "n")), note: tx("The **peripheral nervous system**: all the nerves outside brain and spinal cord, right to your fingertips.", "Das **periphere Nervensystem**: alle Nerven außerhalb von Gehirn und Rückenmark, bis in die Fingerspitzen.") },
        { math: flow([tx("sense organ", "Sinnesorgan"), tx("sensory nerve", "sensorischer Nerv"), tx("CNS", "ZNS")], { hl: [1] }), note: tx("**Sensory** (afferent) nerve fibres carry signals from the sense organs **to** the CNS.", "**Sensorische** (afferente) Nervenfasern leiten Erregungen von den Sinnesorganen **zum** ZNS.") },
        { math: flow([tx("CNS", "ZNS"), tx("motor nerve", "motorischer Nerv"), tx("muscle", "Muskel")], { hl: [1] }), note: tx("**Motor** (efferent) nerve fibres carry commands **from** the CNS to the muscles (effectors).", "**Motorische** (efferente) Nervenfasern leiten Befehle **vom** ZNS zu den Muskeln (Effektoren).") },
        { math: cat(q(tx("nerve", "Nerv")), "=", q(tx("bundle of nerve fibres", "Bündel aus Nervenfasern"))), note: tx("A **nerve** is a bundle of many nerve fibres (axons), like a cable with many wires. Many nerves contain sensory and motor fibres.", "Ein **Nerv** ist ein Bündel aus vielen Nervenfasern (Axonen), wie ein Kabel mit vielen Drähten. Viele Nerven enthalten sensorische und motorische Fasern.") },
      ],
    },
    {
      type: "widget",
      title: tx("The brain: who does what?", "Das Gehirn: Wer macht was?"),
      blob: tx("About 86 billion nerve cells, all working together.", "Rund 86 Milliarden Nervenzellen, und alle arbeiten zusammen."),
      body: tx("Tap the parts of the brain or try the activities. Then switch to the **cortical areas** of the cerebrum.", "Tippe auf die Hirnteile oder probier die Tätigkeiten aus. Schalte dann auf die **Rindenfelder** des Großhirns um."),
      widget: NerveBrainLab,
    },
    { type: "check", blob: tx("Who's in charge of what?", "Wer ist wofür zuständig?"), exercise: brainCheck },
    {
      type: "widget",
      title: tx("The reflex arc", "Der Reflexbogen"),
      blob: tx("A little test at the doctor's: tap, tap!", "Kleiner Test beim Arzt: Klopf, klopf!"),
      body: tx(
        "In the **knee-jerk reflex** the doctor taps just below your kneecap and your leg kicks forward. Tap it yourself and follow the impulse. Its route is called the **reflex arc**.",
        "Beim **Kniesehnenreflex** klopft die Ärztin unter die Kniescheibe, und dein Bein schnellt vor. Klopf selbst und verfolge die Erregung. Ihr Weg heißt **Reflexbogen**.",
      ),
      widget: NerveReflexLab,
    },
    {
      type: "explain",
      title: tx("Two kinds of reflexes", "Eigenreflex und Fremdreflex"),
      blob: tx("Not all reflexes are built the same way.", "Nicht alle Reflexe sind gleich gebaut."),
      body: tx("Reflexes are switched in the spinal cord or the brain stem, not in the cerebrum. That's why they're so fast.", "Reflexe werden im Rückenmark oder im Hirnstamm umgeschaltet, nicht im Großhirn. Darum sind sie so schnell."),
      frames: [
        { math: flow([tx("receptor", "Rezeptor"), tx("sensory neuron", "sensorisches Neuron"), tx("spinal cord", "Rückenmark"), tx("motor neuron", "motorisches Neuron"), tx("effector", "Effektor")], { keys: "a" }), note: tx("Every reflex arc has these five links. The cerebrum isn't asked; it only finds out afterwards.", "Jeder Reflexbogen hat diese fünf Glieder. Das Großhirn wird nicht gefragt, es erfährt erst hinterher davon.") },
        { math: cat(q(tx("Eigenreflex:", "Eigenreflex:")), q(tx("receptor and effector in one organ", "Rezeptor und Effektor im selben Organ"))), note: tx("**Reflex of the same organ (Eigenreflex):** receptor and effector are in the **same organ**, in the knee-jerk reflex in the thigh muscle. Just **one** synapse (monosynaptic): very fast and always the same.", "**Eigenreflex:** Rezeptor und Effektor liegen im **selben Organ**, beim Kniesehnenreflex im Oberschenkelmuskel. Nur **eine** Synapse (monosynaptisch): sehr schnell und immer gleich.") },
        { math: cat(q(tx("Fremdreflex:", "Fremdreflex:")), q(tx("receptor and effector in different organs", "Rezeptor und Effektor in verschiedenen Organen"))), note: tx("**Reflex of another organ (Fremdreflex):** receptor and effector are in **different organs**. In the blink reflex the stimulus hits the cornea, but the eyelid muscle responds. Several synapses with interneurons (polysynaptic).", "**Fremdreflex:** Rezeptor und Effektor liegen in **verschiedenen Organen**. Beim Lidschlussreflex trifft der Reiz die Hornhaut, es reagiert aber der Lidmuskel. Mehrere Synapsen mit Zwischenneuronen (polysynaptisch).") },
        { math: flow([tx("hot plate", "heiße Herdplatte"), tx("pain receptors in the skin", "Schmerzrezeptoren der Haut"), tx("arm flexor", "Beugemuskel im Arm")]), note: tx("Pulling your hand back is also a reflex of another organ. Such reflexes can weaken when the same stimulus comes again and again (habituation).", "Auch das Zurückziehen der Hand ist ein Fremdreflex. Solche Reflexe können schwächer werden, wenn derselbe Reiz immer wieder kommt (Gewöhnung).") },
      ],
    },
    { type: "check", blob: tx("Put the reflex arc together.", "Bau den Reflexbogen zusammen."), exercise: arcExercise(ARCS[1], true) },
    {
      type: "widget",
      title: tx("The nerve cell", "Die Nervenzelle"),
      blob: tx("This is a neuron: a living cable, so to speak.", "Das ist ein Neuron, sozusagen ein lebendes Kabel."),
      body: tx("Nerve cells (neurons) pass signals on. Tap the parts, then send an impulse on its way.", "Nervenzellen (Neurone) leiten Erregungen weiter. Tippe auf die Teile und schick dann eine Erregung los."),
      widget: NerveNeuronLab,
    },
    {
      type: "widget",
      title: tx("The synapse: a handover with a messenger", "Die Synapse: Übergabe mit Botenstoff"),
      blob: tx("Mind the gap!", "Vorsicht, Spalt!"),
      body: tx(
        "Between two nerve cells, or between a nerve and a muscle, there's a tiny gap: the **synapse**. The signal doesn't simply jump across. It is passed on **electrically → chemically → electrically**, with a messenger called the **transmitter**. Step through it.\n\nMany **drugs** and medicines act at synapses too: nicotine, for example, imitates a transmitter. Taking such substances often changes the synapses: the body gets used to them (tolerance) and demands more and more. That's how **addiction** (dependence) develops.",
        "Zwischen zwei Nervenzellen, oder zwischen Nerv und Muskel, liegt ein winziger Spalt: die **Synapse**. Die Erregung springt nicht einfach hinüber. Sie wird **elektrisch → chemisch → elektrisch** übertragen, mit einem Botenstoff, dem **Transmitter**. Geh die Schritte durch.\n\nAn Synapsen wirken auch viele **Drogen** und Medikamente: Nikotin zum Beispiel ahmt einen Transmitter nach. Wer solche Stoffe oft nimmt, verändert seine Synapsen: Der Körper gewöhnt sich daran (Toleranz) und verlangt immer mehr. So entsteht **Sucht** (Abhängigkeit).",
      ),
      widget: NerveSynapseSimple,
    },
    {
      type: "explain",
      title: tx("The eye focuses and adapts", "Das Auge stellt scharf und passt sich an"),
      blob: tx("Your eye is a camera that refocuses all by itself.", "Dein Auge ist eine Kamera, die sich ganz von selbst scharf stellt."),
      frames: [
        { math: flow([tx("near", "nah"), tx("ciliary muscle contracts", "Ziliarmuskel spannt an"), tx("lens round", "Linse kugelig")], { hl: [2] }), note: tx("**Accommodation:** to see near things sharply, the **ciliary muscle** contracts. The zonular fibres go slack and the elastic lens becomes **rounder**: it bends light more strongly.", "**Akkommodation:** Damit Nahes scharf wird, zieht sich der **Ziliarmuskel** zusammen. Die Linsenbänder erschlaffen, die elastische Linse wird **kugeliger** und bricht das Licht stärker.") },
        { math: flow([tx("far", "fern"), tx("ciliary muscle relaxes", "Ziliarmuskel entspannt"), tx("lens flat", "Linse flach")], { hl: [2] }), note: tx("For the distance the ciliary muscle relaxes. The zonular fibres are taut and pull the lens **flat**.", "Für die Ferne entspannt sich der Ziliarmuskel. Die Linsenbänder sind gespannt und ziehen die Linse **flach**.") },
        { math: cat(q(tx("bright", "hell")), "\\to", q(tx("pupil narrow", "Pupille eng")), "\\\\", q(tx("dark", "dunkel")), "\\to", q(tx("pupil wide", "Pupille weit"))), note: tx("**Adaptation:** the eye adjusts to brightness, quickly through the pupil and slowly through the sensory cells, which become more sensitive in the dark (up to about 30 minutes).", "**Adaptation:** Das Auge passt sich an die Helligkeit an, schnell über die Pupille und langsam über die Sinneszellen, die im Dunkeln empfindlicher werden (bis etwa 30 Minuten).") },
        { math: cat(q(tx("rods:", "Stäbchen:")), q(tx("light and dark", "hell und dunkel"))), note: tx("The retina has two kinds of light-sensitive cells. **Rods** (about 120 million) are very sensitive: they only tell light from dark and are for seeing in dim light.", "Die Netzhaut hat zwei Sorten Lichtsinneszellen. **Stäbchen** (etwa 120 Millionen) sind sehr lichtempfindlich: Sie unterscheiden nur hell und dunkel und sind fürs Dämmerungssehen da.") },
        { math: cat(q(tx("cones:", "Zapfen:")), q(tx("colours", "Farben"))), note: tx("**Cones** (about 6 million) need more light and see **colours** (three kinds: red, green, blue). They are packed most tightly in the **yellow spot**. That's why at night all cats are grey!", "**Zapfen** (etwa 6 Millionen) brauchen mehr Licht und sehen **Farben** (drei Sorten: rot, grün, blau). Am dichtesten liegen sie im **gelben Fleck**. Darum sind nachts alle Katzen grau!") },
      ],
    },
    {
      type: "widget",
      title: tx("Near and far", "Nah und fern"),
      blob: tx("Focus! Now bring the flower really close.", "Fokus! Und jetzt hol die Blume ganz nah ran."),
      body: tx("Move the flower closer and watch the ciliary muscle, the zonular fibres and the lens. Try the stiff lens too.", "Schieb die Blume näher heran und beobachte Ziliarmuskel, Linsenbänder und Linse. Probier auch die starre Linse aus."),
      widget: NerveEyeFocus,
    },
    { type: "check", blob: tx("Last one! Think of the flower.", "Die letzte! Denk an die Blume."), exercise: accExercise(true, NEAR_SCENES[0], createRng(4)) },
  ],
  summary: [
    {
      title: tx("CNS and PNS", "ZNS und PNS"),
      body: tx(
        "CNS = brain + spinal cord. Peripheral nervous system = all nerves in the body. **Sensory** (afferent): to the CNS. **Motor** (efferent): from the CNS to the muscle.",
        "ZNS = Gehirn + Rückenmark. Peripheres Nervensystem = alle Nerven im Körper. **Sensorisch** (afferent): zum ZNS. **Motorisch** (efferent): vom ZNS zum Muskel.",
      ),
      examples: [cat(q(tx("CNS", "ZNS")), "=", q(CNS_WORDS[0]), "+", q(CNS_WORDS[1]))],
      tone: "rule",
    },
    {
      title: tx("The brain", "Das Gehirn"),
      body: tx(
        "Cerebrum: consciousness, thinking, learning; cortical areas (motor, sensory, visual, auditory, speech). Cerebellum: coordination, balance. Diencephalon: temperature, hunger, thirst. Brain stem: breathing, heartbeat.",
        "Großhirn: Bewusstsein, Denken, Lernen; Rindenfelder (motorisch, sensorisch, Sehrinde, Hörrinde, Sprache). Kleinhirn: Koordination, Gleichgewicht. Zwischenhirn: Temperatur, Hunger, Durst. Hirnstamm: Atmung, Herzschlag.",
      ),
      tone: "rule",
    },
    {
      title: tx("Reflex arc", "Reflexbogen"),
      body: tx(
        "Same organ (Eigenreflex): receptor and effector in one organ, one synapse (knee-jerk). Another organ (Fremdreflex): different organs, interneurons (blink reflex).",
        "Eigenreflex: Rezeptor und Effektor im selben Organ, eine Synapse (Kniesehnenreflex). Fremdreflex: verschiedene Organe, Zwischenneurone (Lidschlussreflex).",
      ),
      examples: [flow([tx("receptor", "Rezeptor"), tx("sensory neuron", "sensorisches Neuron"), tx("spinal cord", "Rückenmark"), tx("motor neuron", "motorisches Neuron"), tx("effector", "Effektor")])],
      tone: "rule",
    },
    {
      title: tx("Neuron and synapse", "Nervenzelle und Synapse"),
      body: tx(
        "Dendrites → cell body → axon hillock → axon (myelin sheath, nodes of Ranvier) → end bulbs. At the synapse: electrical → chemical (transmitter) → electrical, in one direction only.",
        "Dendriten → Zellkörper → Axonhügel → Axon (Myelinscheide, Ranviersche Schnürringe) → Endknöpfchen. An der Synapse: elektrisch → chemisch (Transmitter) → elektrisch, nur in eine Richtung.",
      ),
      examples: [flow([tx("electrical", "elektrisch"), tx("chemical", "chemisch"), tx("electrical", "elektrisch")])],
      tone: "rule",
    },
    {
      title: tx("The eye", "Das Auge"),
      body: tx(
        "Near: ciliary muscle contracted, fibres slack, lens round. Far: muscle relaxed, fibres taut, lens flat. Rods: light and dark (dim light); cones: colours (yellow spot).",
        "Nah: Ziliarmuskel angespannt, Bänder locker, Linse kugelig. Fern: Muskel entspannt, Bänder gespannt, Linse flach. Stäbchen: hell-dunkel (Dämmerung); Zapfen: Farben (gelber Fleck).",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "In a reflex the brain does **not** decide: the switch happens in the spinal cord. Sensory = towards the CNS, motor = from the CNS to the muscle. For near things the ciliary muscle is **contracted**, not relaxed.",
        "Beim Reflex entscheidet **nicht** das Gehirn: Umgeschaltet wird im Rückenmark. Sensorisch = zum ZNS hin, motorisch = vom ZNS zum Muskel. Für die Nähe ist der Ziliarmuskel **angespannt**, nicht entspannt.",
      ),
      tone: "warning",
    },
  ],
};

