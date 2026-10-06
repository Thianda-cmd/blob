"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson } from "@/learn/types";
import { decText } from "@/learn/chemistry/format";
import { VertebrateThermoWidget } from "@/learn/biology/visuals/VertebrateBergmann";
import { BONES, LIMBS, VertebrateForelimbs, VertebrateLimb, type BoneId, type LimbId } from "@/learn/biology/visuals/VertebrateForelimbs";
import { HEART_INFO, VertebrateHeart, VertebrateHearts, type HeartType } from "@/learn/biology/visuals/VertebrateHearts";
import { VertebrateTempGraph } from "@/learn/biology/visuals/VertebrateTemperature";
import { VertebrateTree, VertebrateTreeDiagram } from "@/learn/biology/visuals/VertebrateTree";
import { cap, capT, choice, de, en, join, mistakes, q, visual, where, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Homologous or analogous?

type Pair = { a: Text; b: Text; hom: boolean; why: Text };
const PAIRS: Pair[] = [
  { a: tx("the human arm", "der Arm des Menschen"), b: tx("the flipper of a whale", "die Brustflosse eines Wals"), hom: true, why: tx("Same bones in the same order: upper arm, ulna and radius, wrist, palm, fingers. Different job, same basic plan.", "Gleiche Knochen in gleicher Reihenfolge: Oberarm, Elle und Speiche, Handwurzel, Mittelhand, Finger. Andere Aufgabe, gleicher Grundbauplan.") },
  { a: tx("the wing of a bat", "der Flügel einer Fledermaus"), b: tx("the foreleg of a horse", "das Vorderbein eines Pferdes"), hom: true, why: tx("Both are mammal forelimbs built from the same bones.", "Beides sind Vordergliedmaßen von Säugetieren aus denselben Knochen.") },
  { a: tx("the digging hand of a mole", "die Grabhand eines Maulwurfs"), b: tx("the human arm", "der Arm des Menschen"), hom: true, why: tx("The mole's shovel contains the same arm and hand bones as yours, only short and strong.", "In der Grabschaufel des Maulwurfs stecken dieselben Arm- und Handknochen wie bei dir, nur kurz und kräftig.") },
  { a: tx("the wing of a bird", "der Flügel eines Vogels"), b: tx("the human arm", "der Arm des Menschen"), hom: true, why: tx("A bird's wing is a front limb with upper arm, ulna and radius; only the hand bones are partly fused.", "Der Vogelflügel ist eine Vordergliedmaße mit Oberarm, Elle und Speiche; nur die Handknochen sind teilweise verwachsen.") },
  { a: tx("the swim bladder of a fish", "die Schwimmblase eines Fisches"), b: tx("the lung of a mammal", "die Lunge eines Säugetiers"), hom: true, why: tx("Both grow out of the front gut. Lungfish show intermediate forms (criterion of continuity).", "Beide entstehen als Ausstülpung des Vorderdarms. Lungenfische zeigen Zwischenformen (Kriterium der Stetigkeit).") },
  { a: tx("the ear ossicles hammer and anvil of mammals", "die Gehörknöchelchen Hammer und Amboss der Säugetiere"), b: tx("two jaw bones of reptiles", "zwei Kieferknochen der Reptilien"), hom: true, why: tx("Fossils and embryos show the step-by-step change from jaw joint to middle ear (continuity).", "Fossilien und Embryonen zeigen den schrittweisen Wandel vom Kiefergelenk zum Mittelohr (Stetigkeit).") },
  { a: tx("the teeth of a shark", "die Zähne eines Hais"), b: tx("the skin scales of a shark", "die Hautschuppen eines Hais"), hom: true, why: tx("Both are built of enamel, dentine and a pulp with blood vessels (specific quality).", "Beide sind aus Schmelz, Zahnbein und einer Pulpa mit Blutgefäßen aufgebaut (spezifische Qualität).") },
  { a: tx("the tiny pelvic bones of a whale", "die winzigen Beckenknochen eines Wals"), b: tx("the pelvis of a land mammal", "das Becken eines Landsäugetiers"), hom: true, why: tx("They sit in the same position in the body (criterion of position): a rudimentary organ.", "Sie liegen an derselben Stelle im Körper (Kriterium der Lage): ein rudimentäres Organ.") },
  { a: tx("the arm skeleton in a bird's wing", "das Armskelett im Vogelflügel"), b: tx("the arm skeleton in a bat's wing", "das Armskelett im Fledermausflügel"), hom: true, why: tx("As front limbs they have the same bones: homologous. (Only the flight surfaces, feathers and skin, arose separately.)", "Als Vordergliedmaßen haben sie dieselben Knochen: homolog. (Nur die Flugflächen, Federn und Haut, sind unabhängig entstanden.)") },
  { a: tx("the wing of a bird", "der Flügel eines Vogels"), b: tx("the wing of a bee", "der Flügel einer Biene"), hom: false, why: tx("A bird's wing is a front limb with bones; an insect wing is a fold of the chitin outer skeleton. Same job, different plan.", "Der Vogelflügel ist eine Vordergliedmaße mit Knochen, der Insektenflügel eine Ausstülpung des Chitin-Außenskeletts. Gleiche Aufgabe, anderer Bauplan.") },
  { a: tx("the digging leg of a mole", "das Grabbein eines Maulwurfs"), b: tx("the digging leg of a mole cricket", "das Grabbein einer Maulwurfsgrille"), hom: false, why: tx("Bones inside skin in the mole, a chitin tube in the insect: they arose independently (convergence).", "Beim Maulwurf Knochen in Haut, bei der Grille ein Chitinrohr: unabhängig entstanden (Konvergenz).") },
  { a: tx("the streamlined body of a shark", "die Stromlinienform eines Hais"), b: tx("the streamlined body of a dolphin", "die Stromlinienform eines Delfins"), hom: false, why: tx("A fish and a mammal: the same pressure of selection in water produced the same shape twice (convergence).", "Ein Fisch und ein Säugetier: Der gleiche Selektionsdruck im Wasser hat zweimal dieselbe Form hervorgebracht (Konvergenz).") },
  { a: tx("the camera eye of an octopus", "das Linsenauge eines Kraken"), b: tx("the camera eye of a human", "das Linsenauge eines Menschen"), hom: false, why: tx("In the octopus the sensory cells face the light, in humans they face away: built differently, evolved independently.", "Beim Kraken zeigen die Sinneszellen zum Licht, beim Menschen vom Licht weg: anders gebaut, unabhängig entstanden.") },
  { a: tx("the wing membrane of a bat", "die Flughaut einer Fledermaus"), b: tx("the feathered surface of a bird's wing", "die Federfläche eines Vogelflügels"), hom: false, why: tx("Skin in one, feathers in the other: the flight surfaces arose independently, even though the arm bones are homologous.", "Hier Haut, dort Federn: Die Flugflächen sind unabhängig entstanden, auch wenn die Armknochen homolog sind.") },
  { a: tx("the spines of a hedgehog", "die Stacheln eines Igels"), b: tx("the spines of a cactus", "die Stacheln eines Kaktus"), hom: false, why: tx("Hedgehog spines are modified hairs, cactus spines modified leaves.", "Igelstacheln sind umgewandelte Haare, Kaktusstacheln umgewandelte Blätter.") },
  { a: tx("the complete septum in a bird's heart", "die vollständige Kammerscheidewand im Vogelherz"), b: tx("the complete septum in a mammal's heart", "die vollständige Kammerscheidewand im Säugerherz"), hom: false, why: tx("Birds and mammals come from different lines of early amniotes: the four-chambered heart arose twice (convergence).", "Vögel und Säuger stammen aus verschiedenen Linien früher Amnioten: Das Vierkammerherz ist zweimal entstanden (Konvergenz).") },
  { a: tx("the jumping legs of a kangaroo", "die Sprungbeine eines Kängurus"), b: tx("the jumping legs of a grasshopper", "die Sprungbeine einer Heuschrecke"), hom: false, why: tx("A leg with bones and a leg made of chitin tubes: same job, unrelated plans.", "Ein Bein mit Knochen und ein Bein aus Chitinröhren: gleiche Aufgabe, nicht verwandte Baupläne.") },
];

const HA: Text[] = [tx("homologous", "homolog"), tx("analogous", "analog")];

function homAnaTask(rng: Rng, fixed?: number): Exercise {
  const p = PAIRS[fixed ?? rng.int(0, PAIRS.length - 1)];
  const answer: AnswerSpec = { kind: "choice", options: HA.map(capT), correct: p.hom ? 0 : 1 };
  return {
    instruction: tx("Homologous or analogous?", "Homolog oder analog?"),
    text: tx(`Are **${en(p.a)}** and **${en(p.b)}** homologous or analogous?`, `Sind **${de(p.a)}** und **${de(p.b)}** homolog oder analog?`),
    answer,
    hint: tx("Same basic plan through common descent, or only the same job?", "Gleicher Grundbauplan durch gemeinsame Abstammung oder nur die gleiche Aufgabe?"),
    solution: [
      { math: join(q(p.hom ? tx("same basic plan", "gleicher Grundbauplan") : tx("same function, different plan", "gleiche Funktion, anderer Bauplan"), "x"), "\\Rightarrow#r", q(HA[p.hom ? 0 : 1], "h")), note: p.why, highlight: ["h"] },
    ],
    mistakes: [
      p.hom
        ? { when: { kind: "choice", options: answer.options, correct: 1 }, title: tx("Look at the plan, not the job", "Achte auf den Bauplan"), say: tx(`The jobs may differ, but the plan is the same: ${en(p.why)}`, `Die Aufgaben mögen verschieden sein, aber der Bauplan ist gleich: ${de(p.why)}`) }
        : { when: { kind: "choice", options: answer.options, correct: 0 }, title: tx("Same job isn't homology", "Gleiche Aufgabe ist keine Homologie"), say: tx(`Homologous doesn't mean 'same function'! ${en(p.why)}`, `Homolog heißt nicht „gleiche Funktion“! ${de(p.why)}`) },
    ],
  };
}

function pickPairTask(rng: Rng): Exercise {
  const wantHom = rng.chance(0.5);
  const right = rng.pick(PAIRS.filter((p) => p.hom === wantHom));
  const others = rng.shuffle(PAIRS.filter((p) => p.hom !== wantHom)).slice(0, 3);
  const txt = (p: Pair): Text => tx(`${cap(en(p.a))} and ${en(p.b)}`, `${cap(de(p.a))} und ${de(p.b)}`);
  const opts: Opt[] = [
    { text: txt(right) },
    ...others.map((p) => ({ text: txt(p), title: wantHom ? tx("Only the same job", "Nur gleiche Aufgabe") : tx("That's homology", "Das ist Homologie"), say: wantHom ? tx(`Analogous: ${en(p.why)}`, `Analog: ${de(p.why)}`) : tx(`Those are homologous: ${en(p.why)}`, `Diese sind homolog: ${de(p.why)}`) })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: wantHom ? tx("Find the homologous pair", "Finde das homologe Paar") : tx("Find the analogous pair", "Finde das analoge Paar"),
    text: wantHom ? tx("Which pair of structures is **homologous**?", "Welches Strukturpaar ist **homolog**?") : tx("Which pair of structures is **analogous**?", "Welches Strukturpaar ist **analog**?"),
    answer,
    hint: tx("Homologous: same basic plan, common ancestor. Analogous: same job, arose independently.", "Homolog: gleicher Grundbauplan, gemeinsamer Vorfahr. Analog: gleiche Aufgabe, unabhängig entstanden."),
    solution: [{ math: q(HA[wantHom ? 0 : 1], "h"), note: right.why, highlight: ["h"] }],
    mistakes: list,
  };
}

function homMultiTask(rng: Rng): Exercise {
  const yes = rng.shuffle([tx("the flipper of a whale", "die Brustflosse eines Wals"), tx("the wing of a bat", "der Flügel einer Fledermaus"), tx("the wing of a bird", "der Flügel eines Vogels"), tx("the digging hand of a mole", "die Grabhand eines Maulwurfs"), tx("the foreleg of a horse", "das Vorderbein eines Pferdes")]).slice(0, rng.int(2, 3));
  const noPool = [
    { t: tx("the wing of a butterfly", "der Flügel eines Schmetterlings"), say: tx("A butterfly wing has no bones: it's a fold of the chitin outer skeleton. Only the job is the same.", "Ein Schmetterlingsflügel hat keine Knochen: Er ist eine Ausstülpung des Chitin-Außenskeletts. Nur die Aufgabe ist gleich.") },
    { t: tx("the digging leg of a mole cricket", "das Grabbein einer Maulwurfsgrille"), say: tx("The mole cricket is an insect: its leg is a chitin tube, not a bone skeleton.", "Die Maulwurfsgrille ist ein Insekt: Ihr Bein ist ein Chitinrohr, kein Knochenskelett.") },
    { t: tx("the grasping arm of an octopus", "der Fangarm eines Kraken"), say: tx("An octopus arm grasps like a hand but contains no bones at all. Same job, unrelated plan.", "Ein Krakenarm greift wie eine Hand, enthält aber gar keine Knochen. Gleiche Aufgabe, nicht verwandter Bauplan.") },
  ];
  const no = rng.shuffle(noPool).slice(0, 2);
  const items = rng.shuffle([...yes.map((t) => ({ t, ok: true as const, say: undefined as Text | undefined })), ...no.map((n) => ({ t: n.t, ok: false as const, say: n.say as Text | undefined }))]);
  const options = items.map((x) => capT(x.t));
  const correct = where(items, (x) => x.ok);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.ok && x.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Same job isn't homology", "Gleiche Aufgabe ist keine Homologie"), x.say);
  });
  items.forEach((x, i) => {
    if (x.ok && correct.length > 1) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== i) }, tx("One more", "Eins fehlt"), tx(`Nearly! "${en(x.t)}" also contains upper arm, ulna and radius, wrist, palm and fingers.`, `Fast! Auch in „${de(x.t)}“ stecken Oberarm, Elle und Speiche, Handwurzel, Mittelhand und Finger.`), true);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which structures are **homologous** to the human arm?", "Welche Strukturen sind **homolog** zum Arm des Menschen?"),
    answer,
    hint: tx("Look for the same bones, not the same job.", "Such nach denselben Knochen, nicht nach derselben Aufgabe."),
    solution: [{ math: tx(correct.map((i, k) => `"${en(options[i])}"#c${k}`).join(" \\\\ "), correct.map((i, k) => `"${de(options[i])}"#c${k}`).join(" \\\\ ")), note: tx("All vertebrate front limbs share one basic plan. Insect and octopus limbs only do similar jobs.", "Alle Vordergliedmaßen der Wirbeltiere haben denselben Grundbauplan. Gliedmaßen von Insekten und Kraken erfüllen nur ähnliche Aufgaben.") }],
    mistakes: m.list.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Remane's criteria

type Crit = "pos" | "qual" | "cont";
const CRIT: Record<Crit, Text> = {
  pos: tx("criterion of position", "Kriterium der Lage"),
  qual: tx("criterion of specific quality", "Kriterium der spezifischen Qualität"),
  cont: tx("criterion of continuity", "Kriterium der Stetigkeit"),
};
const CASES: { c: Crit; text: Text }[] = [
  { c: "pos", text: tx("In the front limbs of human, whale, bat and mole there is always one upper arm bone, then two forearm bones, then wrist, palm and finger bones.", "In den Vordergliedmaßen von Mensch, Wal, Fledermaus und Maulwurf folgen immer ein Oberarmknochen, zwei Unterarmknochen, dann Handwurzel-, Mittelhand- und Fingerknochen.") },
  { c: "pos", text: tx("Whales have small, useless pelvic bones. They lie in the same place in the body as the pelvis of other mammals.", "Wale haben kleine, funktionslose Beckenknochen. Sie liegen an derselben Stelle im Körper wie das Becken anderer Säugetiere.") },
  { c: "pos", text: tx("The slow worm has no legs, but under its skin there are remains of a shoulder girdle and a pelvic girdle in the usual place.", "Die Blindschleiche hat keine Beine, aber unter der Haut liegen Reste von Schulter- und Beckengürtel an der üblichen Stelle.") },
  { c: "qual", text: tx("Shark teeth and the shark's skin scales are both made of enamel, dentine and a pulp with blood vessels, although they sit in completely different places.", "Haizähne und die Hautschuppen des Hais bestehen beide aus Schmelz, Zahnbein und einer Pulpa mit Blutgefäßen, obwohl sie an ganz verschiedenen Stellen sitzen.") },
  { c: "qual", text: tx("The eyes of all vertebrates agree in many complex details: cornea, lens, vitreous body and a retina whose sensory cells face away from the light.", "Die Augen aller Wirbeltiere stimmen in vielen komplexen Einzelheiten überein: Hornhaut, Linse, Glaskörper und eine Netzhaut, deren Sinneszellen vom Licht weg zeigen.") },
  { c: "cont", text: tx("Fossils (cynodonts) show how two jaw bones of reptiles became, step by step, the hammer and anvil in the middle ear of mammals.", "Fossilien (Cynodonten) zeigen, wie zwei Kieferknochen der Reptilien Schritt für Schritt zu Hammer und Amboss im Mittelohr der Säugetiere wurden.") },
  { c: "cont", text: tx("A series of fossils shows how the four-toed foot of small early horses became the single hoof of today's horse.", "Eine Fossilreihe zeigt, wie aus dem vierzehigen Fuß kleiner Urpferde der einzehige Huf des heutigen Pferdes wurde.") },
  { c: "cont", text: tx("In lungfish and bichirs there are intermediate forms between a swim bladder and a lung.", "Bei Lungenfischen und Flösselhechten gibt es Zwischenformen zwischen Schwimmblase und Lunge.") },
  { c: "cont", text: tx("In the mammal embryo, the ear ossicles develop from the same parts as the jaw joint bones of reptiles.", "Im Säugetierembryo entstehen die Gehörknöchelchen aus denselben Anlagen wie die Kiefergelenkknochen der Reptilien.") },
];
const CRIT_SAY: Record<string, Text> = {
  "qual>pos": tx("Here the structures sit in completely different places. What do they still have in common?", "Hier sitzen die Strukturen gerade an ganz verschiedenen Stellen. Was haben sie trotzdem gemeinsam?"),
  "cont>pos": tx("Today the structures look completely different. What links them?", "Heute sehen die Strukturen völlig verschieden aus. Was verbindet sie?"),
  "pos>qual": tx("Here it's not about fine details of their make-up but about where the parts lie in the body plan.", "Hier geht es nicht um feine Details des Aufbaus, sondern darum, wo die Teile im Bauplan liegen."),
  "cont>qual": tx("The end forms are no longer built alike. Look at what lies between them.", "Die Endformen sind gar nicht mehr ähnlich gebaut. Schau, was zwischen ihnen liegt."),
  "pos>cont": tx("No intermediate forms are mentioned. What is the comparison based on here?", "Es werden keine Zwischenformen erwähnt. Worauf beruht der Vergleich hier?"),
  "qual>cont": tx("No intermediate forms are mentioned. The structures agree in many details of their make-up.", "Es werden keine Zwischenformen erwähnt. Die Strukturen stimmen in vielen Einzelheiten ihres Aufbaus überein."),
};

export function remaneTask(rng: Rng, fixed?: number): Exercise {
  const k = CASES[fixed ?? rng.int(0, CASES.length - 1)];
  const others = (Object.keys(CRIT) as Crit[]).filter((c) => c !== k.c);
  const opts: Opt[] = [
    { text: capT(CRIT[k.c]) },
    ...others.map((c) => ({ text: capT(CRIT[c]), title: tx("Another criterion", "Anderes Kriterium"), say: CRIT_SAY[`${k.c}>${c}`] })),
    { text: tx("None: these structures are analogous", "Keines: Die Strukturen sind analog"), title: tx("It is homology", "Es ist Homologie"), say: tx("One of Remane's criteria fits, so the structures are homologous, not just analogous.", "Eines der Kriterien nach Remane passt, die Strukturen sind also homolog, nicht nur analog.") },
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  const why: Record<Crit, Text> = {
    pos: tx("Same position in the body plan, in the same order: **criterion of position**.", "Gleiche Lage im Bauplan, in gleicher Reihenfolge: **Kriterium der Lage**."),
    qual: tx("Complex structures that agree in many details, even in different places: **criterion of specific quality**.", "Komplexe Strukturen, die in vielen Einzelheiten übereinstimmen, auch an verschiedenen Stellen: **Kriterium der spezifischen Qualität**."),
    cont: tx("Different structures linked by intermediate forms (fossils or embryonic development): **criterion of continuity**.", "Verschiedene Strukturen, die durch Zwischenformen verbunden sind (Fossilien oder Embryonalentwicklung): **Kriterium der Stetigkeit**."),
  };
  return {
    instruction: tx("Homology criteria (Remane)", "Homologiekriterien nach Remane"),
    text: tx(`${en(k.text)} Which homology criterion is used here?`, `${de(k.text)} Welches Homologiekriterium wird hier angewendet?`),
    answer,
    hint: tx("Position in the body plan? Many matching details? Intermediate forms?", "Lage im Bauplan? Viele übereinstimmende Details? Zwischenformen?"),
    solution: [{ math: q(CRIT[k.c], "c"), note: why[k.c], highlight: ["c"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Forelimb bones

const BONE_ACCEPT: Record<BoneId, Text[]> = {
  humerus: [tx("upper arm bone", "Oberarmknochen"), tx("humerus", "Oberarm")],
  radius: [tx("radius", "Speiche")],
  ulna: [tx("ulna", "Elle")],
  carpals: [tx("wrist bones", "Handwurzelknochen"), tx("carpals", "Handwurzel")],
  metacarpals: [tx("palm bones", "Mittelhandknochen"), tx("metacarpals", "Mittelhand")],
  phalanges: [tx("finger bones", "Fingerknochen"), tx("phalanges", "Finger")],
};
const ASKABLE: Record<LimbId, BoneId[]> = {
  human: ["humerus", "radius", "ulna", "carpals", "metacarpals", "phalanges"],
  whale: ["humerus", "carpals", "metacarpals", "phalanges"],
  bat: ["humerus", "radius", "carpals", "metacarpals", "phalanges"],
  mole: ["humerus", "carpals", "metacarpals", "phalanges"],
};
const BONE_CONF: Partial<Record<string, { b: BoneId; say: Text }>> = {
  "bat:metacarpals": { b: "phalanges", say: tx("They look like fingers, but these long rods start right at the wrist: in a bat, the palm bones are extremely long.", "Sie sehen aus wie Finger, aber diese langen Stäbe beginnen direkt an der Handwurzel: Bei der Fledermaus sind die Mittelhandknochen extrem lang.") },
  "bat:radius": { b: "ulna", say: tx("In a bat the ulna is thin and short. The long, strong forearm bone is the other one.", "Bei der Fledermaus ist die Elle dünn und kurz. Der lange, kräftige Unterarmknochen ist der andere.") },
  "human:radius": { b: "ulna", say: tx("The ulna is on the little-finger side. The marked bone runs to the thumb.", "Die Elle liegt auf der Kleinfingerseite. Der markierte Knochen läuft zum Daumen.") },
  "human:ulna": { b: "radius", say: tx("The radius runs to the thumb. The marked bone is on the little-finger side.", "Die Speiche läuft zum Daumen. Der markierte Knochen liegt auf der Kleinfingerseite.") },
  "whale:phalanges": { b: "metacarpals", say: tx("Count: whales have many more bones in a row than we do. The long chains are the finger bones.", "Zähl nach: Wale haben viel mehr Knochen hintereinander als wir. Die langen Ketten sind die Fingerknochen.") },
  "mole:humerus": { b: "carpals", say: tx("It's very short and broad, but it's the single bone at the shoulder.", "Er ist sehr kurz und breit, aber es ist der einzelne Knochen an der Schulter.") },
};

function boneTask(rng: Rng): Exercise {
  const limb = rng.pick(Object.keys(ASKABLE) as LimbId[]);
  const bone = rng.pick(ASKABLE[limb]);
  const conf = BONE_CONF[`${limb}:${bone}`];
  const v = visual(VertebrateLimb, { limb, ask: bone });
  const animal = LIMBS[limb].name;
  const solution: Frame[] = [{ math: q(BONES[bone].name, "b"), note: tx(`It's the ${en(BONES[bone].name)}. In every vertebrate front limb: upper arm, ulna and radius, wrist, palm, fingers.`, `Markiert: ${de(BONES[bone].name)}. In jeder Vordergliedmaße folgen Oberarm, Elle und Speiche, Handwurzel, Mittelhand, Finger.`), highlight: ["b"] }];
  const hint = tx("From the shoulder: one bone, two bones, small wrist bones, palm, fingers.", "Von der Schulter aus: ein Knochen, zwei Knochen, kleine Handwurzelknochen, Mittelhand, Finger.");
  const text = tx(`Front limb of the ${en(animal).toLowerCase()}. Which bone (or group of bones) is marked with "?"?`, `Vordergliedmaße: ${de(animal)}. Welcher Knochen (oder welche Knochengruppe) ist mit „?“ markiert?`);
  if (rng.chance(0.45)) {
    const answer: AnswerSpec = { kind: "word", accept: BONE_ACCEPT[bone], placeholder: tx("bone", "Knochen") };
    const m = mistakes(answer);
    if (conf) m.add({ kind: "word", accept: BONE_ACCEPT[conf.b] }, tx("Neighbouring bone", "Nachbarknochen"), conf.say);
    return { instruction: tx("Name the bone", "Benenne den Knochen"), text, visual: v, answer, hint, solution, mistakes: m.list };
  }
  const near: BoneId[] = conf ? [conf.b] : [];
  const rest = rng.shuffle((Object.keys(BONES) as BoneId[]).filter((b) => b !== bone && !near.includes(b)));
  const opts: Opt[] = [
    { text: capT(BONES[bone].name) },
    ...[...near, ...rest].slice(0, 3).map((b) => ({ text: capT(BONES[b].name), title: tx("Neighbouring bone", "Nachbarknochen"), say: conf && conf.b === b ? conf.say : tx("Count from the shoulder: one bone, two bones, wrist, palm, fingers. Where is the marked one?", "Zähl von der Schulter aus: ein Knochen, zwei Knochen, Handwurzel, Mittelhand, Finger. Wo liegt der markierte?") })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return { instruction: tx("Which bone?", "Welcher Knochen?"), text, visual: v, answer, hint, solution, mistakes: list };
}

// ---------------------------------------------------------------------------
// Family tree and bridge animals

type TreeQ = { q: Text; right: Text; wrong: { t: Text; say: Text }[]; note: Text; pic?: boolean };
const TREE_Q: TreeQ[] = [
  {
    q: tx("Which group are crocodiles most closely related to?", "Mit welcher Gruppe sind Krokodile am nächsten verwandt?"),
    right: tx("Birds", "Vögel"),
    wrong: [
      { t: tx("Lizards and snakes", "Echsen und Schlangen"), say: tx("They look alike, but in the tree crocodiles and birds share the youngest common ancestor (G).", "Sie sehen sich ähnlich, aber im Stammbaum teilen Krokodile und Vögel den jüngsten gemeinsamen Vorfahren (G).") },
      { t: tx("Amphibians", "Amphibien"), say: tx("Living in water and on land says nothing about relationship. Amphibians branch off much earlier (D).", "Im Wasser und an Land leben sagt nichts über Verwandtschaft. Amphibien zweigen viel früher ab (D).") },
      { t: tx("Mammals", "Säugetiere"), say: tx("Mammals branch off at E. Look for the youngest shared branching point.", "Säugetiere zweigen bei E ab. Such den jüngsten gemeinsamen Verzweigungspunkt.") },
    ],
    note: tx("Crocodiles and birds are both archosaurs (G): birds are the living dinosaurs.", "Krokodile und Vögel sind beide Archosaurier (G): Vögel sind die heute lebenden Dinosaurier."),
    pic: true,
  },
  {
    q: tx("Which group is the sister group of the mammals?", "Welche Gruppe ist die Schwestergruppe der Säugetiere?"),
    right: tx("Reptiles and birds (sauropsids)", "Reptilien und Vögel (Sauropsiden)"),
    wrong: [
      { t: tx("Amphibians", "Amphibien"), say: tx("Amphibians branch off earlier (D). Mammals share the amniotic egg (E) with reptiles and birds.", "Amphibien zweigen früher ab (D). Säugetiere teilen das Amnion-Ei (E) mit Reptilien und Vögeln.") },
      { t: tx("Birds only", "Nur die Vögel"), say: tx("Birds are only part of the group that splits off at E. The sister group includes everything on the other branch.", "Vögel sind nur ein Teil der Gruppe, die sich bei E abspaltet. Zur Schwestergruppe gehört alles auf dem anderen Ast.") },
      { t: tx("Lobe-finned fish", "Fleischflosser"), say: tx("Lobe-finned fish branch off at C, much earlier.", "Fleischflosser zweigen schon bei C ab, viel früher.") },
    ],
    note: tx("At E the amniotes split into the line leading to mammals (synapsids) and the line of reptiles and birds (sauropsids).", "Bei E spalten sich die Amnioten in die Linie zu den Säugetieren (Synapsiden) und die Linie der Reptilien und Vögel (Sauropsiden)."),
    pic: true,
  },
  {
    q: tx("Which new feature defines the amniotes (branching point E)?", "Welches neue Merkmal kennzeichnet die Amnioten (Verzweigungspunkt E)?"),
    right: tx("The amniotic egg, protected by membranes", "Das Amnion-Ei mit schützenden Eihäuten"),
    wrong: [
      { t: tx("Four limbs", "Vier Gliedmaßen"), say: tx("Four limbs arose earlier, at D (tetrapods). Amphibians have them too, but no amniotic egg.", "Vier Gliedmaßen entstanden schon bei D (Tetrapoden). Auch Amphibien haben sie, aber kein Amnion-Ei.") },
      { t: tx("Feathers", "Federn"), say: tx("Feathers only appear in the dinosaur and bird line, far up the tree.", "Federn treten erst in der Linie der Dinosaurier und Vögel auf, weit oben im Baum.") },
      { t: tx("Lungs", "Lungen"), say: tx("Lungs (or swim bladders) are much older: they already appear at B.", "Lungen (bzw. Schwimmblasen) sind viel älter: Sie treten schon bei B auf.") },
    ],
    note: tx("The amniotic egg made breeding on land possible: amniotes no longer need water to reproduce.", "Das Amnion-Ei ermöglichte die Fortpflanzung an Land: Amnioten brauchen dafür kein Gewässer mehr."),
    pic: true,
  },
  {
    q: tx("Is the lungfish more closely related to the trout or to the frog?", "Ist der Lungenfisch näher mit der Forelle oder mit dem Frosch verwandt?"),
    right: tx("To the frog", "Mit dem Frosch"),
    wrong: [{ t: tx("To the trout", "Mit der Forelle"), say: tx("Both swim and look like fish, but the lungfish is a lobe-finned fish (C). From this group the land vertebrates arose.", "Beide schwimmen und sehen aus wie Fische, aber der Lungenfisch ist ein Fleischflosser (C). Aus dieser Gruppe gingen die Landwirbeltiere hervor.") }],
    note: tx("Lungfish and frogs share the ancestor at C; the trout branched off before, at B. Similar looks are no proof of relationship.", "Lungenfisch und Frosch teilen den Vorfahren bei C, die Forelle zweigte schon vorher bei B ab. Ähnliches Aussehen beweist keine Verwandtschaft."),
    pic: true,
  },
  {
    q: tx("Why are the 'reptiles' in the classic sense not a complete descent group?", "Warum sind die „Reptilien“ im klassischen Sinn keine vollständige Abstammungsgruppe?"),
    right: tx("Birds descend from their common ancestor but are not counted as reptiles.", "Die Vögel stammen von ihrem gemeinsamen Vorfahren ab, werden aber nicht zu den Reptilien gezählt."),
    wrong: [
      { t: tx("Because snakes have no legs.", "Weil Schlangen keine Beine haben."), say: tx("Losing legs doesn't change who is related to whom. Look at which descendants of F are left out.", "Beinverlust ändert nichts daran, wer mit wem verwandt ist. Schau, welche Nachkommen von F weggelassen werden.") },
      { t: tx("Because reptiles are cold-blooded.", "Weil Reptilien wechselwarm sind."), say: tx("Body temperature is a feature, not a question of descent. Who else descends from the ancestor at F?", "Die Körpertemperatur ist ein Merkmal, keine Frage der Abstammung. Wer stammt noch vom Vorfahren bei F ab?") },
      { t: tx("Because crocodiles live in water.", "Weil Krokodile im Wasser leben."), say: tx("Habitat doesn't decide relationship. The point is a group that's missing.", "Der Lebensraum entscheidet nicht über die Verwandtschaft. Es geht um eine Gruppe, die fehlt.") },
    ],
    note: tx("A complete descent group contains an ancestor and all its descendants. Without the birds, the 'reptiles' are incomplete.", "Eine vollständige Abstammungsgruppe enthält einen Vorfahren und alle seine Nachkommen. Ohne die Vögel sind die „Reptilien“ unvollständig."),
  },
  {
    q: tx("Which bridge animal links fish and land vertebrates?", "Welches Brückentier verbindet Fische und Landwirbeltiere?"),
    right: tx("Tiktaalik, about 375 million years old", "Tiktaalik, etwa 375 Millionen Jahre alt"),
    wrong: [
      { t: tx("Archaeopteryx, about 150 million years old", "Archaeopteryx, etwa 150 Millionen Jahre alt"), say: tx("Archaeopteryx shows a mosaic of reptile and bird features, much later.", "Archaeopteryx zeigt ein Mosaik aus Reptilien- und Vogelmerkmalen, viel später.") },
      { t: tx("The platypus, living today", "Das Schnabeltier, heute lebend"), say: tx("The platypus is a living mosaic of reptile and mammal features (it lays eggs).", "Das Schnabeltier ist ein lebendes Mosaik aus Reptilien- und Säugermerkmalen (es legt Eier).") },
      { t: tx("Seymouria, about 280 million years old", "Seymouria, etwa 280 Millionen Jahre alt"), say: tx("Seymouria stands between amphibians and reptiles.", "Seymouria steht zwischen Amphibien und Reptilien.") },
    ],
    note: tx("Tiktaalik (about 375 million years ago) had gills, scales and fins, but also lungs, a neck and wrist bones in its fins.", "Tiktaalik (vor etwa 375 Millionen Jahren) hatte Kiemen, Schuppen und Flossen, aber auch Lungen, einen Hals und Handwurzelknochen in den Flossen."),
  },
  {
    q: tx("Which statement about Archaeopteryx is right?", "Welche Aussage über Archaeopteryx stimmt?"),
    right: tx("It is a mosaic form with reptile and bird features.", "Er ist eine Mosaikform mit Reptilien- und Vogelmerkmalen."),
    wrong: [
      { t: tx("It is the direct ancestor of all of today's birds.", "Er ist der direkte Vorfahr aller heutigen Vögel."), say: tx("A bridge animal shows that transitions happened. Whether it is the direct ancestor can't be proven; Archaeopteryx is probably an early side branch.", "Ein Brückentier zeigt, dass es Übergänge gab. Ob es der direkte Vorfahr ist, lässt sich nicht beweisen; Archaeopteryx gilt eher als früher Seitenzweig.") },
      { t: tx("It lived about 15 million years ago.", "Er lebte vor etwa 15 Millionen Jahren."), say: tx("Much older: about 150 million years, in the Jurassic.", "Viel älter: etwa 150 Millionen Jahre, im Jura.") },
      { t: tx("It is a mammal with feathers.", "Er ist ein Säugetier mit Federn."), say: tx("No hair, no milk: Archaeopteryx links reptiles and birds.", "Keine Haare, keine Milch: Archaeopteryx verbindet Reptilien und Vögel.") },
    ],
    note: tx("Archaeopteryx had feathers, wings and a wishbone (bird), but teeth, claws on its fingers and a long bony tail (reptile).", "Archaeopteryx hatte Federn, Flügel und Gabelbein (Vogel), aber Zähne, Krallen an den Fingern und eine lange Schwanzwirbelsäule (Reptil)."),
  },
];

export function treeTask(rng: Rng, fixed?: number): Exercise {
  const T = TREE_Q[fixed ?? rng.int(0, TREE_Q.length - 1)];
  const { answer, mistakes: list } = choice(rng, [{ text: T.right }, ...T.wrong.map((w) => ({ text: w.t, title: tx("Look at the tree", "Schau in den Stammbaum"), say: w.say }))]);
  return {
    instruction: tx("Family tree of the vertebrates", "Stammbaum der Wirbeltiere"),
    text: T.q,
    ...(T.pic ? { visual: visual(VertebrateTreeDiagram, {}) } : {}),
    answer,
    hint: tx("Relationship = the youngest common ancestor, not similar looks.", "Verwandtschaft = jüngster gemeinsamer Vorfahr, nicht ähnliches Aussehen."),
    solution: [{ math: q(T.right, "r"), note: T.note, highlight: ["r"] }],
    mistakes: list,
  };
}

function mosaicTask(rng: Rng): Exercise {
  const arch = rng.chance(0.5);
  const A = arch
    ? {
        name: tx("Archaeopteryx", "Archaeopteryx"),
        ask: tx("reptile features", "Reptilienmerkmale"),
        yes: [tx("teeth in the jaws", "Zähne in den Kiefern"), tx("claws on three free fingers", "Krallen an drei freien Fingern"), tx("a long bony tail", "eine lange Schwanzwirbelsäule"), tx("belly ribs", "Bauchrippen")],
        no: [
          { t: tx("feathers", "Federn"), say: tx("Feathers count as the bird feature of Archaeopteryx.", "Federn gelten bei Archaeopteryx als Vogelmerkmal.") },
          { t: tx("a wishbone (furcula)", "ein Gabelbein"), say: tx("The wishbone is a bird feature: the fused collarbones.", "Das Gabelbein ist ein Vogelmerkmal: die verwachsenen Schlüsselbeine.") },
          { t: tx("wings", "Flügel"), say: tx("Wings are on the bird side of the mosaic.", "Flügel gehören zur Vogelseite des Mosaiks.") },
        ],
      }
    : {
        name: tx("Tiktaalik", "Tiktaalik"),
        ask: tx("land vertebrate features", "Merkmale der Landwirbeltiere"),
        yes: [tx("a mobile neck", "ein beweglicher Hals"), tx("lungs", "Lungen"), tx("fins with upper arm, ulna, radius and wrist bones", "Flossen mit Oberarm-, Elle-, Speiche- und Handwurzelknochen"), tx("strong ribs that support the body", "kräftige Rippen, die den Körper stützen")],
        no: [
          { t: tx("gills", "Kiemen"), say: tx("Gills are the fish side of Tiktaalik.", "Kiemen gehören zur Fischseite von Tiktaalik.") },
          { t: tx("scales", "Schuppen"), say: tx("Scales on its body are a fish feature.", "Schuppen am Körper sind ein Fischmerkmal.") },
          { t: tx("fin rays at the edge of the fins", "Flossenstrahlen am Flossensaum"), say: tx("Fin rays are typical of fish fins.", "Flossenstrahlen sind typisch für Fischflossen.") },
        ],
      };
  const yes = rng.shuffle(A.yes).slice(0, rng.int(2, 3));
  const no = rng.shuffle(A.no).slice(0, 2);
  const items = rng.shuffle([...yes.map((t) => ({ t, ok: true as const, say: undefined as Text | undefined })), ...no.map((n) => ({ t: n.t, ok: false as const, say: n.say as Text | undefined }))]);
  const options = items.map((x) => capT(x.t));
  const correct = where(items, (x) => x.ok);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.ok && x.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Other side of the mosaic", "Andere Seite des Mosaiks"), x.say);
  });
  return {
    instruction: tx("Bridge animals", "Brückentiere"),
    text: tx(`${en(A.name)} is a mosaic form. Which of its features are **${en(A.ask)}**?`, `${de(A.name)} ist eine Mosaikform. Welche seiner Merkmale sind **${de(A.ask)}**?`),
    answer,
    hint: tx("Sort each feature: which group has it today?", "Ordne jedes Merkmal zu: Welche Gruppe hat es heute?"),
    solution: [{ math: tx(correct.map((i, k) => `"${en(options[i])}"#c${k}`).join(" \\\\ "), correct.map((i, k) => `"${de(options[i])}"#c${k}`).join(" \\\\ ")), note: arch ? tx("A mosaic form combines features of two groups: Archaeopteryx links reptiles and birds.", "Eine Mosaikform vereint Merkmale zweier Gruppen: Archaeopteryx verbindet Reptilien und Vögel.") : tx("A mosaic form combines features of two groups: Tiktaalik links fish and land vertebrates.", "Eine Mosaikform vereint Merkmale zweier Gruppen: Tiktaalik verbindet Fische und Landwirbeltiere.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Hearts

function heartCountTask(rng: Rng): Exercise {
  const items: { name: Text; n: number; t: HeartType }[] = [
    { name: tx("a frog", "eines Froschs"), n: 3, t: "amph" },
    { name: tx("a trout", "einer Forelle"), n: 2, t: "fish" },
    { name: tx("a pigeon", "einer Taube"), n: 4, t: "mammal" },
    { name: tx("a dog", "eines Hundes"), n: 4, t: "mammal" },
    { name: tx("a newt", "eines Molchs"), n: 3, t: "amph" },
    { name: tx("a carp", "eines Karpfens"), n: 2, t: "fish" },
  ];
  const it = rng.pick(items);
  const answer: AnswerSpec = { kind: "number", value: it.n };
  const m = mistakes(answer);
  if (it.n !== 4) m.add({ kind: "number", value: 4 }, tx("Not like ours", "Nicht wie bei uns"), tx("Four chambers are the bird and mammal heart. Count again for this class.", "Vier Herzräume hat das Herz von Vögeln und Säugern. Zähl für diese Klasse noch mal nach."));
  if (it.n === 4) m.add({ kind: "number", value: 3 }, tx("Completely separated", "Vollständig getrennt"), tx("Birds and mammals have a complete septum: two atria and two ventricles.", "Vögel und Säuger haben eine vollständige Scheidewand: zwei Vorhöfe und zwei Kammern."));
  if (it.n === 3) m.add({ kind: "number", value: 2 }, tx("Two atria", "Zwei Vorhöfe"), tx("Amphibians already have two atria: one for blood from the body, one for blood from the lungs.", "Amphibien haben schon zwei Vorhöfe: einen für Blut aus dem Körper, einen für Blut aus der Lunge."));
  if (it.n === 2) m.add({ kind: "number", value: 3 }, tx("Only one atrium", "Nur ein Vorhof"), tx("A fish has no lung circulation, so it needs only one atrium and one ventricle.", "Ein Fisch hat keinen Lungenkreislauf und braucht deshalb nur einen Vorhof und eine Kammer."));
  return {
    instruction: tx("Hearts in evolution", "Evolution des Herzens"),
    text: tx(`How many chambers (atria and ventricles together) does the heart of ${en(it.name)} have?`, `Wie viele Herzräume (Vorhöfe und Kammern zusammen) hat das Herz ${de(it.name)}?`),
    answer,
    hint: tx("Single or double circulation? Is the ventricle divided?", "Einfacher oder doppelter Kreislauf? Ist die Kammer geteilt?"),
    solution: [{ math: tx(`${it.n}#n \\; "chambers"#k`, `${it.n}#n \\; "Herzräume"#k`), note: HEART_INFO[it.t].chambers, highlight: ["n"] }],
    mistakes: m.list,
  };
}

function heartMixTask(rng: Rng): Exercise {
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("In the amphibian heart", "Im Amphibienherz") },
    { text: tx("In the fish heart", "Im Fischherz"), title: tx("Nothing to mix", "Nichts zu mischen"), say: tx("A fish heart only ever contains oxygen-poor blood: the oxygen-rich blood from the gills goes straight to the body.", "Ein Fischherz enthält nur sauerstoffarmes Blut: Das sauerstoffreiche Blut aus den Kiemen fließt direkt in den Körper.") },
    { text: tx("In the reptile heart", "Im Reptilienherz"), title: tx("Partly separated", "Teilweise getrennt"), say: tx("The partial septum in the reptile ventricle already separates most of the blood.", "Die Teilscheidewand in der Reptilienkammer trennt das Blut schon größtenteils.") },
    { text: tx("In the mammal heart", "Im Säugetierherz"), title: tx("Completely separated", "Vollständig getrennt"), say: tx("Mammals have a complete septum: no mixing at all.", "Säugetiere haben eine vollständige Scheidewand: keinerlei Mischung.") },
  ]);
  return {
    instruction: tx("Hearts in evolution", "Evolution des Herzens"),
    text: tx("In which heart do oxygen-rich and oxygen-poor blood mix the most?", "In welchem Herzen mischen sich sauerstoffreiches und sauerstoffarmes Blut am stärksten?"),
    answer,
    hint: tx("Where do two atria empty into one undivided ventricle?", "Wo münden zwei Vorhöfe in eine ungeteilte Kammer?"),
    solution: [{ math: join(q(tx("2 atria + 1 ventricle", "2 Vorhöfe + 1 Kammer"), "a"), "\\Rightarrow#r", q(tx("amphibians", "Amphibien"), "b")), note: HEART_INFO.amph.mix, highlight: ["b"] }],
    mistakes: list,
  };
}

const HEART_STEPS: Text[] = [
  tx("1 atrium, 1 ventricle, single circulation", "1 Vorhof, 1 Kammer, einfacher Kreislauf"),
  tx("2 atria, 1 ventricle, mixed blood", "2 Vorhöfe, 1 Kammer, Mischblut"),
  tx("2 atria, ventricle with partial septum", "2 Vorhöfe, Kammer mit Teilscheidewand"),
  tx("2 atria, 2 ventricles, no mixing", "2 Vorhöfe, 2 Kammern, keine Mischung"),
];

function heartOrderTask(): Exercise {
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("Sort the heart types in the order fish, amphibians, reptiles, birds and mammals: from the simplest to the most separated.", "Sortiere die Herztypen in der Reihenfolge Fische, Amphibien, Reptilien, Vögel und Säuger: vom einfachsten zum am stärksten getrennten."),
    answer: { kind: "order", items: HEART_STEPS },
    hint: tx("Step by step, the ventricle gets divided.", "Schritt für Schritt wird die Kammer unterteilt."),
    solution: HEART_STEPS.map((s, k) => ({ math: tx(HEART_STEPS.slice(0, k + 1).map((x, m) => `"${en(x)}"#h${m}`).join(" \\\\ "), HEART_STEPS.slice(0, k + 1).map((x, m) => `"${de(x)}"#h${m}`).join(" \\\\ ")), note: HEART_INFO[(["fish", "amph", "rept", "mammal"] as HeartType[])[k]].result, highlight: [`h${k}`] })),
    mistakes: [{ when: { kind: "order", items: [HEART_STEPS[2], HEART_STEPS[1]] }, title: tx("Amphibians before reptiles", "Erst Amphibien, dann Reptilien"), say: tx("The reptile ventricle already has a partial septum; the amphibian ventricle has none.", "Die Reptilienkammer hat schon eine Teilscheidewand, die Amphibienkammer noch keine.") }],
  };
}

function heartPicTask(rng: Rng): Exercise {
  const t = rng.pick(["fish", "amph", "rept", "mammal"] as HeartType[]);
  const say: Record<string, Text> = {
    "amph>rept": tx("Look at the ventricle: is there a partial septum, or none at all?", "Schau auf die Kammer: Gibt es eine Teilscheidewand oder gar keine?"),
    "rept>amph": tx("There's a partial septum in the ventricle. That's one step further than amphibians.", "In der Kammer steckt eine Teilscheidewand. Das ist einen Schritt weiter als bei Amphibien."),
    "rept>mammal": tx("The septum doesn't reach all the way up: the ventricle is only partly divided.", "Die Scheidewand reicht nicht ganz nach oben: Die Kammer ist nur teilweise geteilt."),
    "mammal>rept": tx("The septum goes all the way: two separate ventricles.", "Die Scheidewand ist vollständig: zwei getrennte Kammern."),
    "fish>amph": tx("There's only one atrium, and the blood goes from the gills straight to the body.", "Es gibt nur einen Vorhof, und das Blut fließt von den Kiemen direkt in den Körper."),
    "amph>fish": tx("Two atria: one receives blood from the lungs. That's a double circulation.", "Zwei Vorhöfe: Einer empfängt Blut aus der Lunge. Das ist ein doppelter Kreislauf."),
  };
  const opts: Opt[] = [{ text: HEART_INFO[t].group }, ...(["fish", "amph", "rept", "mammal"] as HeartType[]).filter((x) => x !== t).map((x) => ({ text: HEART_INFO[x].group, title: tx("Count and compare", "Zähl und vergleiche"), say: say[`${t}>${x}`] ?? tx(`Count atria and ventricles: ${en(HEART_INFO[x].chambers)} would look different.`, `Zähl Vorhöfe und Kammern: ${de(HEART_INFO[x].chambers)} sähe anders aus.`) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Which heart?", "Welches Herz?"),
    text: tx("Red: oxygen-rich, blue: oxygen-poor, purple: mixed. Which animal group does this heart and circulation belong to?", "Rot: sauerstoffreich, blau: sauerstoffarm, lila: gemischt. Zu welcher Tiergruppe gehören dieses Herz und dieser Kreislauf?"),
    visual: visual(VertebrateHeart, { type: t, mode: "plain" }),
    answer,
    hint: tx("Count the atria, look at the ventricle and at the colour of the blood.", "Zähl die Vorhöfe, schau auf die Kammer und auf die Farbe des Blutes."),
    solution: [{ math: q(HEART_INFO[t].group, "h"), note: tx(`${en(HEART_INFO[t].chambers)}; ${en(HEART_INFO[t].mix)}.`, `${de(HEART_INFO[t].chambers)}; ${de(HEART_INFO[t].mix)}.`), highlight: ["h"] }],
    mistakes: list,
  };
}

function heartWhyTask(rng: Rng): Exercise {
  const conv = rng.chance(0.4);
  if (conv) {
    const { answer, mistakes: list } = choice(rng, [
      { text: tx("Analogous: it arose independently in both lines (convergence).", "Analog: Sie ist in beiden Linien unabhängig entstanden (Konvergenz).") },
      { text: tx("Homologous: they inherited it from a shared four-chambered ancestor.", "Homolog: Sie haben sie von einem gemeinsamen Vorfahren mit Vierkammerherz geerbt."), title: tx("Two separate lines", "Zwei getrennte Linien"), say: tx("Look at the tree: the line to mammals split off at E, long before birds. Their common ancestor had no complete septum.", "Schau in den Stammbaum: Die Linie zu den Säugetieren trennte sich schon bei E, lange vor den Vögeln. Ihr gemeinsamer Vorfahr hatte keine vollständige Scheidewand.") },
      { text: tx("Homologous, because it is built the same way and does the same job.", "Homolog, weil sie gleich gebaut ist und dieselbe Aufgabe hat."), title: tx("Same job isn't homology", "Gleiche Aufgabe ist keine Homologie"), say: tx("Same function doesn't prove common descent. What matters is whether the common ancestor already had it.", "Gleiche Funktion beweist keine gemeinsame Abstammung. Entscheidend ist, ob der gemeinsame Vorfahr sie schon hatte.") },
    ]);
    return {
      instruction: tx("Hearts in evolution", "Evolution des Herzens"),
      text: tx("Birds and mammals both have a complete septum between the ventricles. Is this feature homologous or analogous?", "Vögel und Säugetiere haben beide eine vollständige Scheidewand zwischen den Kammern. Ist dieses Merkmal homolog oder analog?"),
      answer,
      hint: tx("Did their last common ancestor already have four chambers?", "Hatte ihr letzter gemeinsamer Vorfahr schon vier Kammern?"),
      solution: [{ math: q(tx("convergence", "Konvergenz"), "k"), note: tx("Birds come from the dinosaur line, mammals from the synapsid line. The four-chambered heart arose twice: a high metabolism favoured it in both.", "Vögel stammen aus der Linie der Dinosaurier, Säuger aus der Linie der Synapsiden. Das Vierkammerherz entstand zweimal: Ein hoher Stoffwechsel begünstigte es bei beiden."), highlight: ["k"] }],
      mistakes: list,
    };
  }
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("The body only gets oxygen-rich blood, at high pressure: enough oxygen for a high metabolism.", "Der Körper bekommt nur sauerstoffreiches Blut mit hohem Druck: genug Sauerstoff für einen hohen Stoffwechsel.") },
    { text: tx("The heart beats more slowly and saves energy.", "Das Herz schlägt langsamer und spart Energie."), title: tx("Not the point", "Nicht der Punkt"), say: tx("Birds and small mammals have very fast heartbeats. The gain is in the quality of the blood.", "Vögel und kleine Säuger haben einen sehr schnellen Herzschlag. Der Gewinn liegt in der Qualität des Blutes.") },
    { text: tx("The lungs take up more oxygen.", "Die Lunge nimmt mehr Sauerstoff auf."), title: tx("It's about the heart", "Es geht ums Herz"), say: tx("Gas exchange happens in the lungs either way. The septum stops the oxygen-rich blood from being diluted again.", "Der Gasaustausch geschieht so oder so in der Lunge. Die Scheidewand verhindert, dass das sauerstoffreiche Blut wieder verdünnt wird.") },
    { text: tx("The body needs less blood.", "Der Körper braucht weniger Blut."), title: tx("Not the point", "Nicht der Punkt"), say: tx("The amount of blood isn't the issue: it's that no oxygen-poor blood is mixed in.", "Die Blutmenge ist nicht das Problem: Entscheidend ist, dass kein sauerstoffarmes Blut beigemischt wird.") },
  ]);
  return {
    instruction: tx("Hearts in evolution", "Evolution des Herzens"),
    text: tx("What is the advantage of a four-chambered heart with a complete septum?", "Welchen Vorteil hat ein Vierkammerherz mit vollständiger Scheidewand?"),
    answer,
    hint: tx("Think of what reaches the body: mixed or pure oxygen-rich blood? At which pressure?", "Denk daran, was im Körper ankommt: Mischblut oder reines sauerstoffreiches Blut? Mit welchem Druck?"),
    solution: [{ math: join(q(tx("no mixing + high pressure", "keine Mischung + hoher Druck"), "a"), "\\Rightarrow", q(tx("endothermy", "Gleichwarmheit"), "b")), note: HEART_INFO.mammal.result, highlight: ["b"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Temperature control

function cubeTask(rng: Rng): Exercise {
  const sphere = rng.chance(0.35);
  if (sphere) {
    const r = rng.pick([1, 2, 4, 5, 10]);
    const value = 3 / r;
    const answer: AnswerSpec = { kind: "number", value, tolerance: 0.02, unit: "1/cm" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: r / 3, tolerance: 0.02 }, tx("Upside down", "Verkehrt herum"), tx("You calculated V : O. The question asks for surface divided by volume.", "Du hast V : O gerechnet. Gefragt ist Oberfläche geteilt durch Volumen."));
    m.add({ kind: "number", value: 1 / r, tolerance: 0.02 }, tx("Factor 3 lost", "Faktor 3 verloren"), tx("4πr² : (4/3 πr³): the 4 and π cancel, but a 3 stays in the numerator.", "4πr² : (4/3 πr³): 4 und π kürzen sich weg, aber eine 3 bleibt im Zähler stehen."), true);
    return {
      instruction: tx("Surface-to-volume ratio", "Oberflächen-Volumen-Verhältnis"),
      text: tx(`A model animal is a sphere with radius r = ${r} cm. Calculate O : V (O = 4πr², V = 4/3 πr³).`, `Ein Modelltier ist eine Kugel mit dem Radius r = ${r} cm. Berechne O : V (O = 4πr², V = 4/3 πr³).`),
      answer,
      hint: tx("Divide and cancel first: what is left of 4πr² : (4/3 πr³)?", "Erst teilen und kürzen: Was bleibt von 4πr² : (4/3 πr³) übrig?"),
      solution: [
        { math: `\\frac{O}{V} = \\frac{4 \\pi r^2}{\\frac{4}{3} \\pi r^3} = \\frac{3}{r}`, note: tx("4 and π cancel, one r cancels: O : V = 3/r.", "4 und π kürzen sich, ein r kürzt sich: O : V = 3/r.") },
        { math: tx(`\\frac{3}{${r} "cm"} = ${en(decText(value, 2))}#v "1/cm"`, `\\frac{3}{${r} "cm"} = ${de(decText(value, 2))}#v "1/cm"`), note: tx("The bigger the sphere, the smaller O : V.", "Je größer die Kugel, desto kleiner O : V."), highlight: ["v"] },
      ],
      mistakes: m.list,
    };
  }
  const a = rng.pick([1, 2, 3, 4, 5, 10]);
  const value = 6 / a;
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.02, unit: "1/cm" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: a / 6, tolerance: 0.02 }, tx("Upside down", "Verkehrt herum"), tx("You calculated V : O. The ratio asked for is surface divided by volume.", "Du hast V : O gerechnet. Gefragt ist Oberfläche geteilt durch Volumen."));
  m.add({ kind: "number", value: 1 / a, tolerance: 0.02 }, tx("Only one face", "Nur eine Fläche"), tx("a² is the area of just one face. A cube has six faces: O = 6a².", "a² ist nur eine Fläche. Ein Würfel hat sechs Flächen: O = 6a²."), true);
  return {
    instruction: tx("Surface-to-volume ratio", "Oberflächen-Volumen-Verhältnis"),
    text: tx(`A model animal is a cube with edge length a = ${a} cm. Calculate the ratio of surface to volume, O : V.`, `Ein Modelltier ist ein Würfel mit der Kantenlänge a = ${a} cm. Berechne das Verhältnis von Oberfläche zu Volumen, O : V.`),
    answer,
    hint: tx("O = 6a², V = a³.", "O = 6a², V = a³."),
    solution: [
      { math: `O = 6 \\cdot ${a}^2 = ${6 * a * a}#o "cm"^2 \\quad V = ${a}^3 = ${a ** 3}#w "cm"^3`, note: tx("Surface and volume of the cube.", "Oberfläche und Volumen des Würfels.") },
      { math: tx(`\\frac{O}{V} = \\frac{${6 * a * a}}{${a ** 3}} = ${en(decText(value, 2))}#v "1/cm"`, `\\frac{O}{V} = \\frac{${6 * a * a}}{${a ** 3}} = ${de(decText(value, 2))}#v "1/cm"`), note: tx("In general O : V = 6/a: the bigger the cube, the smaller the ratio, and the less heat it loses per volume.", "Allgemein gilt O : V = 6/a: Je größer der Würfel, desto kleiner das Verhältnis und desto weniger Wärme verliert er pro Volumen."), highlight: ["v"] },
    ],
    mistakes: m.list,
  };
}

function factorTask(rng: Rng): Exercise {
  const [a1, a2] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 6],
    [1, 4],
    [2, 10],
    [3, 9],
  ]);
  const f = a2 / a1;
  const answer: AnswerSpec = { kind: "number", value: f };
  const m = mistakes(answer);
  m.add({ kind: "number", value: f * f }, tx("That's the surface", "Das ist die Oberfläche"), tx(`The surfaces differ by a factor of ${f * f}. But the ratio O : V = 6/a only changes with a.`, `Die Oberflächen unterscheiden sich um den Faktor ${f * f}. Das Verhältnis O : V = 6/a ändert sich aber nur mit a.`));
  m.add({ kind: "number", value: f ** 3 }, tx("That's the volume", "Das ist das Volumen"), tx(`The volumes differ by a factor of ${f ** 3}. Use O : V = 6/a for both cubes.`, `Die Volumina unterscheiden sich um den Faktor ${f ** 3}. Rechne O : V = 6/a für beide Würfel.`));
  m.add({ kind: "number", value: 1 / f, tolerance: 0.02 }, tx("Upside down", "Verkehrt herum"), tx("The small cube has the LARGER ratio. How many times larger?", "Der kleine Würfel hat das GRÖSSERE Verhältnis. Um wie viel größer?"));
  return {
    instruction: tx("Surface-to-volume ratio", "Oberflächen-Volumen-Verhältnis"),
    text: tx(`Two model animals are cubes with edge lengths ${a1} cm and ${a2} cm. By what factor is O : V of the small one larger than that of the big one?`, `Zwei Modelltiere sind Würfel mit den Kantenlängen ${a1} cm und ${a2} cm. Um welchen Faktor ist O : V des kleinen größer als das des großen?`),
    answer,
    hint: tx("O : V = 6/a for each cube. Then divide.", "Für jeden Würfel gilt O : V = 6/a. Dann teilen."),
    solution: [{ math: `\\frac{6/${a1}}{6/${a2}} = \\frac{${a2}}{${a1}} = ${f}#v`, note: tx("The ratio scales with 1/a: a cube with a smaller edge loses relatively more heat. That's why small endotherms need so much food.", "Das Verhältnis skaliert mit 1/a: Ein Würfel mit kleinerer Kante verliert relativ mehr Wärme. Darum brauchen kleine gleichwarme Tiere so viel Nahrung."), highlight: ["v"] }],
    mistakes: m.list,
  };
}

type Rule = { q: Text; right: Text; wrong: { t: Text; say: Text }[]; note: Text };
const RULES: Rule[] = [
  {
    q: tx("Siberian tiger and Sumatran tiger are subspecies of the same species. Which statement fits Bergmann's rule?", "Amurtiger (Sibirien) und Sumatratiger sind Unterarten derselben Art. Welche Aussage passt zur Bergmannschen Regel?"),
    right: tx("The Siberian tiger is larger than the Sumatran tiger.", "Der Amurtiger ist größer als der Sumatratiger."),
    wrong: [
      { t: tx("The Sumatran tiger is larger, because it has more food in the tropics.", "Der Sumatratiger ist größer, weil er in den Tropen mehr Nahrung findet."), say: tx("Bergmann's rule is about heat: a larger body has a smaller O : V and loses relatively less heat in the cold.", "Die Bergmannsche Regel handelt von Wärme: Ein größerer Körper hat ein kleineres O : V und verliert in der Kälte relativ weniger Wärme.") },
      { t: tx("Both are the same size, because they are the same species.", "Beide sind gleich groß, weil sie zur selben Art gehören."), say: tx("The rule compares exactly such closely related forms, and they do differ in size.", "Die Regel vergleicht genau solche nah verwandten Formen, und die unterscheiden sich durchaus in der Größe.") },
    ],
    note: tx("Bergmann's rule: closely related warm-blooded animals are larger in colder regions. The Siberian tiger is the largest tiger.", "Bergmannsche Regel: Nah verwandte gleichwarme Tiere sind in kälteren Gebieten größer. Der Amurtiger ist der größte Tiger."),
  },
  {
    q: tx("For which animals does Bergmann's rule apply?", "Für welche Tiere gilt die Bergmannsche Regel?"),
    right: tx("For closely related warm-blooded species or subspecies.", "Für nah verwandte gleichwarme Arten oder Unterarten."),
    wrong: [
      { t: tx("For all animals, e.g. elephant and mouse.", "Für alle Tiere, z. B. Elefant und Maus."), say: tx("An elephant in Africa is bigger than a mouse in Siberia. The rule only compares closely related forms.", "Ein Elefant in Afrika ist größer als eine Maus in Sibirien. Die Regel vergleicht nur nah verwandte Formen.") },
      { t: tx("For cold-blooded animals such as lizards.", "Für wechselwarme Tiere wie Eidechsen."), say: tx("Cold-blooded animals hardly make their own heat to keep, so the heat argument doesn't apply to them.", "Wechselwarme Tiere erzeugen kaum eigene Wärme, die sie halten müssten, deshalb greift das Wärme-Argument bei ihnen nicht.") },
      { t: tx("Only for animals in the Arctic.", "Nur für Tiere in der Arktis."), say: tx("It compares regions: from warm to cold, the body size of related forms increases.", "Sie vergleicht Regionen: Von warm nach kalt nimmt die Körpergröße verwandter Formen zu.") },
    ],
    note: tx("The rule only makes sense where heat is produced inside and lost through the surface: warm-blooded animals, compared within related groups.", "Die Regel ergibt nur Sinn, wo Wärme im Körper erzeugt und über die Oberfläche abgegeben wird: bei gleichwarmen Tieren, verglichen innerhalb verwandter Gruppen."),
  },
  {
    q: tx("Arctic fox, red fox and fennec: which one has the largest ears, and why?", "Polarfuchs, Rotfuchs und Fennek: Wer hat die größten Ohren, und warum?"),
    right: tx("The fennec in the desert: big ears give off a lot of heat.", "Der Fennek in der Wüste: Große Ohren geben viel Wärme ab."),
    wrong: [
      { t: tx("The arctic fox: big ears warm the head.", "Der Polarfuchs: Große Ohren wärmen den Kopf."), say: tx("Ears don't warm anything: every bit of surface loses heat. In the cold, small ears are better.", "Ohren wärmen nicht: Jede Oberfläche gibt Wärme ab. In der Kälte sind kleine Ohren besser.") },
      { t: tx("The red fox: it lives in the middle and needs to hear best.", "Der Rotfuchs: Er lebt in der Mitte und muss am besten hören."), say: tx("Allen's rule is about heat loss through body parts that stick out.", "Die Allensche Regel handelt vom Wärmeverlust über abstehende Körperteile.") },
    ],
    note: tx("Allen's rule: in colder regions, ears, tails and legs of related warm-blooded animals are smaller. The fennec uses its huge ears to cool down.", "Allensche Regel: In kälteren Gebieten sind Ohren, Schwanz und Beine verwandter gleichwarmer Tiere kleiner. Der Fennek kühlt sich über seine riesigen Ohren."),
  },
  {
    q: tx("What does 'ectothermic' mean?", "Was bedeutet „ektotherm“?"),
    right: tx("The body heat comes mainly from the surroundings.", "Die Körperwärme stammt überwiegend aus der Umgebung."),
    wrong: [
      { t: tx("The animal is always cold.", "Das Tier ist immer kalt."), say: tx("A lizard in the sun can be 35 °C warm. Ectothermic only says where the heat comes from.", "Eine Eidechse in der Sonne kann 35 °C warm sein. Ektotherm sagt nur, woher die Wärme kommt.") },
      { t: tx("The animal produces no heat at all.", "Das Tier erzeugt überhaupt keine Wärme."), say: tx("Every metabolism produces some heat, but in ectotherms too little to keep the body temperature up.", "Jeder Stoffwechsel erzeugt etwas Wärme, bei ektothermen Tieren aber zu wenig, um die Körpertemperatur zu halten.") },
      { t: tx("The body temperature stays constant.", "Die Körpertemperatur bleibt konstant."), say: tx("That's endothermic animals: they produce heat in their metabolism and regulate it.", "Das sind endotherme Tiere: Sie erzeugen Wärme im Stoffwechsel und regeln sie.") },
    ],
    note: tx("Ectothermic (wechselwarm): heat from outside, body temperature follows the surroundings. Endothermic (gleichwarm): heat from metabolism, temperature regulated.", "Ektotherm (wechselwarm): Wärme von außen, Körpertemperatur folgt der Umgebung. Endotherm (gleichwarm): Wärme aus dem Stoffwechsel, Temperatur geregelt."),
  },
  {
    q: tx("Why does the energy use of a mouse rise sharply when the outside temperature falls below about 30 °C?", "Warum steigt der Energieumsatz einer Maus stark an, wenn die Außentemperatur unter etwa 30 °C fällt?"),
    right: tx("It has to make more heat to keep its body at 37 °C.", "Sie muss mehr Wärme erzeugen, um ihren Körper bei 37 °C zu halten."),
    wrong: [
      { t: tx("Its body cools down and its metabolism speeds up, as in lizards.", "Ihr Körper kühlt ab und der Stoffwechsel wird schneller, wie bei Eidechsen."), say: tx("In lizards the metabolism slows down in the cold (RGT rule). The mouse's body temperature doesn't drop.", "Bei Eidechsen wird der Stoffwechsel in der Kälte langsamer (RGT-Regel). Die Körpertemperatur der Maus sinkt gar nicht.") },
      { t: tx("It runs around more because it's cold.", "Sie läuft mehr herum, weil ihr kalt ist."), say: tx("The rise is measured at rest. The extra energy goes into heat production.", "Der Anstieg wird in Ruhe gemessen. Die zusätzliche Energie geht in die Wärmeproduktion.") },
    ],
    note: tx("Below the thermoneutral zone, a warm-blooded animal produces extra heat (e.g. shivering, brown fat): the colder, the more energy.", "Unterhalb der thermoneutralen Zone erzeugt ein gleichwarmes Tier zusätzliche Wärme (z. B. Muskelzittern, braunes Fett): Je kälter, desto mehr Energie."),
  },
];

function ruleTask(rng: Rng, fixed?: number): Exercise {
  const R = RULES[fixed ?? rng.int(0, RULES.length - 1)];
  const { answer, mistakes: list } = choice(rng, [{ text: R.right }, ...R.wrong.map((w) => ({ text: w.t, title: tx("Think about heat", "Denk an die Wärme"), say: w.say }))]);
  return {
    instruction: tx("Temperature control", "Temperaturregulation"),
    text: R.q,
    answer,
    hint: tx("Heat is made in the volume and lost through the surface.", "Wärme entsteht im Volumen und geht über die Oberfläche verloren."),
    solution: [{ math: q(R.right, "r"), note: R.note }],
    mistakes: list,
  };
}

function energyGraphTask(rng: Rng): Exercise {
  const swap = rng.chance(0.5);
  const endoLabel = swap ? "B" : "A";
  const ectoLabel = swap ? "A" : "B";
  const askEndo = rng.chance(0.5);
  const right = askEndo ? endoLabel : ectoLabel;
  const options: Text[] = [tx("Curve A", "Kurve A"), tx("Curve B", "Kurve B")];
  const correct = right === "A" ? 0 : 1;
  return {
    instruction: tx("Read the graph", "Lies das Diagramm"),
    text: askEndo
      ? tx("The graph shows the energy use (oxygen consumption) of a mouse and a lizard of the same mass at different outside temperatures. Which curve belongs to the endothermic mouse?", "Das Diagramm zeigt den Energieumsatz (Sauerstoffverbrauch) einer Maus und einer gleich schweren Eidechse bei verschiedenen Außentemperaturen. Welche Kurve gehört zur endothermen Maus?")
      : tx("The graph shows the energy use (oxygen consumption) of a mouse and a lizard of the same mass at different outside temperatures. Which curve belongs to the ectothermic lizard?", "Das Diagramm zeigt den Energieumsatz (Sauerstoffverbrauch) einer Maus und einer gleich schweren Eidechse bei verschiedenen Außentemperaturen. Welche Kurve gehört zur ektothermen Eidechse?"),
    visual: visual(VertebrateTempGraph, { anon: true, swap, energy: true }),
    answer: { kind: "choice", options, correct },
    hint: tx("Who has to heat when it gets cold? Whose metabolism slows down in the cold?", "Wer muss heizen, wenn es kalt wird? Wessen Stoffwechsel wird in der Kälte langsamer?"),
    solution: [
      { math: tx(`"${endoLabel}:"#a \\; "high in the cold"#b \\quad "${ectoLabel}:"#c \\; "rises with warmth"#d`, `"${endoLabel}:"#a \\; "hoch in der Kälte"#b \\quad "${ectoLabel}:"#c \\; "steigt mit Wärme"#d`), note: tx(`Curve ${endoLabel}: the mouse burns more and more energy the colder it gets. Curve ${ectoLabel}: the lizard's metabolism rises with temperature (RGT rule) and stays far lower.`, `Kurve ${endoLabel}: Die Maus verbraucht umso mehr Energie, je kälter es ist. Kurve ${ectoLabel}: Der Stoffwechsel der Eidechse steigt mit der Temperatur (RGT-Regel) und bleibt viel niedriger.`) },
    ],
    mistakes: [
      {
        when: { kind: "choice", options, correct: 1 - correct },
        title: askEndo ? tx("Rising isn't heating", "Steigen ist nicht Heizen") : tx("Heating in the cold", "Heizen in der Kälte"),
        say: askEndo
          ? tx("This curve rises with warmth: a metabolism that simply speeds up with temperature. The endotherm spends the most energy where it's coldest.", "Diese Kurve steigt mit der Wärme: ein Stoffwechsel, der einfach mit der Temperatur schneller wird. Das endotherme Tier verbraucht dort am meisten Energie, wo es am kältesten ist.")
          : tx("This curve is highest in the cold: that animal is heating its body. An ectotherm can't do that.", "Diese Kurve ist in der Kälte am höchsten: Dieses Tier heizt seinen Körper. Ein ektothermes Tier kann das nicht."),
      },
    ],
  };
}

export function generate3(rng: Rng): Exercise {
  const roll = rng.int(0, 15);
  if (roll <= 1) return homAnaTask(rng);
  if (roll === 2) return pickPairTask(rng);
  if (roll === 3) return homMultiTask(rng);
  if (roll <= 5) return remaneTask(rng);
  if (roll === 6) return boneTask(rng);
  if (roll <= 8) return treeTask(rng);
  if (roll === 9) return mosaicTask(rng);
  if (roll === 10) return rng.chance(0.5) ? heartCountTask(rng) : heartMixTask(rng);
  if (roll === 11) return rng.chance(0.25) ? heartOrderTask() : heartPicTask(rng);
  if (roll === 12) return heartWhyTask(rng);
  if (roll === 13) return rng.chance(0.65) ? cubeTask(rng) : factorTask(rng);
  if (roll === 14) return ruleTask(rng);
  return energyGraphTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const homFrames: Frame[] = [
  { math: tx('"homologous:"#h \\; "same basic plan"#b', '"homolog:"#h \\; "gleicher Grundbauplan"#b'), note: tx("**Homologous** structures go back to the same basic plan because the species share a common ancestor. Their jobs can be completely different.", "**Homolog** sind Strukturen, die auf denselben Grundbauplan zurückgehen, weil die Arten einen gemeinsamen Vorfahren haben. Ihre Aufgaben können ganz verschieden sein.") },
  { math: tx('"arm, flipper, wing, shovel"#x \\Rightarrow "homologous"#h', '"Arm, Flosse, Flügel, Schaufel"#x \\Rightarrow "homolog"#h'), note: tx("Human arm (grasping), whale flipper (swimming), bat wing (flying), mole hand (digging): the same bones in the same order. One plan, many jobs: **divergence**.", "Arm des Menschen (Greifen), Walflosse (Schwimmen), Fledermausflügel (Fliegen), Maulwurfshand (Graben): dieselben Knochen in derselben Reihenfolge. Ein Plan, viele Aufgaben: **Divergenz**.") },
  { math: tx('"analogous:"#a \\; "same function"#f', '"analog:"#a \\; "gleiche Funktion"#f'), note: tx("**Analogous** structures do the same job but are built differently. They arose independently, because similar selection pressures favour similar solutions: **convergence**.", "**Analog** sind Strukturen mit gleicher Funktion, aber verschiedenem Bauplan. Sie sind unabhängig voneinander entstanden, weil ähnlicher Selektionsdruck ähnliche Lösungen begünstigt: **Konvergenz**.") },
  { math: tx('"bird wing, insect wing"#x \\Rightarrow "analogous"#a', '"Vogelflügel, Insektenflügel"#x \\Rightarrow "analog"#a'), note: tx("A bird's wing is a front limb with bones and feathers, an insect wing a fold of the chitin outer skeleton. Same job, no shared plan.", "Der Vogelflügel ist eine umgebildete Vordergliedmaße mit Knochen und Federn, der Insektenflügel eine Ausstülpung des Chitin-Außenskeletts. Gleiche Aufgabe, kein gemeinsamer Bauplan.") },
  { math: tx('"shark, dolphin"#x \\Rightarrow "convergence"#a', '"Hai, Delfin"#x \\Rightarrow "Konvergenz"#a'), note: tx("More convergences: the streamlined body of shark (fish) and dolphin (mammal), the digging legs of mole and mole cricket, the camera eyes of octopus and human.", "Weitere Konvergenzen: die Stromlinienform von Hai (Fisch) und Delfin (Säugetier), die Grabbeine von Maulwurf und Maulwurfsgrille, die Linsenaugen von Krake und Mensch.") },
  { math: tx('"bird"#x \\; "bat"#y \\to "?"#q', '"Vogel"#x \\; "Fledermaus"#y \\to "?"#q'), note: tx("Careful: bird and bat wings are homologous as front limbs (same bones) but analogous as wings: feathers and wing membrane arose independently.", "Vorsicht: Vogel- und Fledermausflügel sind als Vordergliedmaßen homolog (gleiche Knochen), als Flügel aber analog: Federfläche und Flughaut sind unabhängig entstanden.") },
  { math: tx('"homology"#h \\to "relationship"#v', '"Homologie"#h \\to "Verwandtschaft"#v'), note: tx("Only homologies show relationship. Analogies show similar living conditions, not common descent.", "Nur Homologien zeigen Verwandtschaft. Analogien zeigen ähnliche Lebensbedingungen, keine gemeinsame Abstammung.") },
];

const remaneFrames: Frame[] = [
  { math: tx('"1." \\; "position"#a', '"1." \\; "Lage"#a'), note: tx("**Criterion of position**: structures are homologous if they take the same position in the body plan, e.g. upper arm, ulna and radius, wrist, palm and fingers in the same order.", "**Kriterium der Lage**: Strukturen sind homolog, wenn sie im Bauplan dieselbe Lage einnehmen, z. B. Oberarm, Elle und Speiche, Handwurzel, Mittelhand und Finger in gleicher Reihenfolge.") },
  { math: tx('"2." \\; "specific quality"#b', '"2." \\; "spezifische Qualität"#b'), note: tx("**Criterion of specific quality**: complex structures that agree in many details are homologous even in different places. Shark teeth and shark skin scales both consist of enamel, dentine and pulp.", "**Kriterium der spezifischen Qualität**: Komplexe Strukturen, die in vielen Einzelheiten übereinstimmen, sind homolog, auch an verschiedenen Stellen. Haizähne und Hautschuppen des Hais bestehen beide aus Schmelz, Zahnbein und Pulpa.") },
  { math: tx('"3." \\; "continuity"#c', '"3." \\; "Stetigkeit"#c'), note: tx("**Criterion of continuity**: even dissimilar structures are homologous if intermediate forms link them, in fossils or in embryonic development. Two reptile jaw bones became the hammer and anvil of the mammalian middle ear.", "**Kriterium der Stetigkeit**: Auch unähnliche Strukturen sind homolog, wenn Zwischenformen sie verbinden, bei Fossilien oder in der Embryonalentwicklung. Zwei Kieferknochen der Reptilien wurden zu Hammer und Amboss im Mittelohr der Säugetiere.") },
  { math: tx('"1 criterion"#k \\Rightarrow "homology"#h', '"1 Kriterium"#k \\Rightarrow "Homologie"#h'), note: tx("One criterion that is clearly met is enough to argue for homology. The more criteria, the safer the conclusion.", "Schon ein klar erfülltes Kriterium spricht für Homologie. Je mehr Kriterien erfüllt sind, desto sicherer ist der Schluss.") },
];

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Homology and analogy", "Homologie und Analogie"),
      blob: tx("Same job or same plan? That's the key question of this lesson!", "Gleiche Aufgabe oder gleicher Bauplan? Das ist die Schlüsselfrage dieser Lektion!"),
      frames: homFrames,
    },
    {
      type: "widget",
      title: tx("Four limbs, one plan", "Vier Gliedmaßen, ein Bauplan"),
      blob: tx("Tap a colour: the same bone lights up in all four animals!", "Tipp auf eine Farbe: Derselbe Knochen leuchtet bei allen vier Tieren auf!"),
      body: tx(
        "The front limbs of human, whale, bat and mole look completely different and do different jobs. Inside, the same bones sit in the same order: they are **homologous**.",
        "Die Vordergliedmaßen von Mensch, Wal, Fledermaus und Maulwurf sehen völlig verschieden aus und haben verschiedene Aufgaben. Innen liegen dieselben Knochen in derselben Reihenfolge: Sie sind **homolog**.",
      ),
      widget: VertebrateForelimbs,
    },
    { type: "check", blob: tx("The classic trap. Same job, so homologous?", "Die klassische Falle. Gleiche Aufgabe, also homolog?"), exercise: homAnaTask(createRng(9), 9) },
    {
      type: "explain",
      title: tx("How to prove homology: Remane's criteria", "Homologie begründen: Kriterien nach Remane"),
      blob: tx("In an exam you have to justify homology. Remane gives you three criteria.", "In der Klausur musst du Homologie begründen. Remane liefert dir drei Kriterien."),
      frames: remaneFrames,
    },
    { type: "check", blob: tx("Which criterion is at work here?", "Welches Kriterium steckt hier dahinter?"), exercise: remaneTask(createRng(5), 3) },
    {
      type: "widget",
      title: tx("The family tree of the vertebrates", "Der Stammbaum der Wirbeltiere"),
      blob: tx("Tap the branching points. Crocodiles have a surprise for you!", "Tipp auf die Verzweigungspunkte. Die Krokodile haben eine Überraschung für dich!"),
      body: tx(
        "Each branching point stands for a common ancestor in which a new feature appeared. **Bridge animals** (mosaic forms) such as Tiktaalik or Archaeopteryx combine features of two groups.",
        "Jeder Verzweigungspunkt steht für einen gemeinsamen Vorfahren, bei dem ein neues Merkmal entstand. **Brückentiere** (Mosaikformen) wie Tiktaalik oder Archaeopteryx vereinen Merkmale zweier Gruppen.",
      ),
      widget: VertebrateTree,
    },
    { type: "check", blob: tx("Who is the crocodile's closest relative?", "Wer ist der nächste Verwandte des Krokodils?"), exercise: treeTask(createRng(7), 0) },
    {
      type: "widget",
      title: tx("Hearts in evolution", "Die Evolution des Herzens"),
      blob: tx("From two chambers to four: watch the blood colours!", "Von zwei Herzräumen zu vier: Achte auf die Farben des Blutes!"),
      body: tx(
        "From fish to bird and mammal, the heart becomes more and more divided. The gain: oxygen-rich and oxygen-poor blood no longer mix, and the body gets blood at high pressure.",
        "Vom Fisch zu Vogel und Säuger wird das Herz immer stärker unterteilt. Der Gewinn: Sauerstoffreiches und sauerstoffarmes Blut mischen sich nicht mehr, und der Körper bekommt Blut mit hohem Druck.",
      ),
      widget: VertebrateHearts,
    },
    {
      type: "widget",
      title: tx("Temperature control", "Temperaturregulation"),
      blob: tx("Why is the emperor penguin so big? Let's calculate!", "Warum ist der Kaiserpinguin so groß? Rechnen wir nach!"),
      body: tx(
        "**Endothermic** (warm-blooded) animals produce heat in their metabolism and keep their temperature constant; **ectothermic** (cold-blooded) ones get their heat from outside. Heat is produced in the volume and lost through the surface, so the **surface-to-volume ratio** matters: **Bergmann's rule** (larger in the cold) and **Allen's rule** (smaller ears and tails in the cold).",
        "**Endotherme** (gleichwarme) Tiere erzeugen Wärme im Stoffwechsel und halten ihre Temperatur konstant, **ektotherme** (wechselwarme) beziehen ihre Wärme von außen. Wärme entsteht im Volumen und geht über die Oberfläche verloren, darum zählt das **Oberflächen-Volumen-Verhältnis**: **Bergmannsche Regel** (größer in der Kälte) und **Allensche Regel** (kleinere Ohren und Schwänze in der Kälte).",
      ),
      widget: VertebrateThermoWidget,
    },
    { type: "check", blob: tx("A quick calculation, Abitur style.", "Eine schnelle Rechnung, wie im Abitur."), exercise: factorTask(createRng(21)) },
  ],
  summary: [
    {
      title: tx("Homology and analogy", "Homologie und Analogie"),
      body: tx(
        "**Homologous**: same basic plan because of common descent, function may differ (divergence). Example: forelimbs of human, whale, bat, mole. **Analogous**: same function, different plan, arose independently (convergence). Example: wings of bird and insect. Only homologies show relationship.",
        "**Homolog**: gleicher Grundbauplan durch gemeinsame Abstammung, Funktion kann verschieden sein (Divergenz). Beispiel: Vordergliedmaßen von Mensch, Wal, Fledermaus, Maulwurf. **Analog**: gleiche Funktion, verschiedener Bauplan, unabhängig entstanden (Konvergenz). Beispiel: Flügel von Vogel und Insekt. Nur Homologien zeigen Verwandtschaft.",
      ),
      examples: [tx('"upper arm" \\to "ulna, radius" \\to "wrist" \\to "palm" \\to "fingers"', '"Oberarm" \\to "Elle, Speiche" \\to "Handwurzel" \\to "Mittelhand" \\to "Finger"')],
      tone: "rule",
    },
    {
      title: tx("Remane's homology criteria", "Homologiekriterien nach Remane"),
      body: tx(
        "1. **Position**: same position in the body plan. 2. **Specific quality**: many matching details of a complex structure, independent of position (shark teeth and skin scales). 3. **Continuity**: linked by intermediate forms in fossils or embryos (jaw bones to ear ossicles).",
        "1. **Lage**: gleiche Lage im Bauplan. 2. **Spezifische Qualität**: viele übereinstimmende Einzelheiten eines komplexen Organs, unabhängig von der Lage (Haizähne und Hautschuppen). 3. **Stetigkeit**: durch Zwischenformen bei Fossilien oder Embryonen verbunden (Kieferknochen zu Gehörknöchelchen).",
      ),
      tone: "rule",
    },
    {
      title: tx("Family tree and bridge animals", "Stammbaum und Brückentiere"),
      body: tx(
        "Jawed vertebrates → bony fish → lobe-finned fish → **tetrapods** (four limbs) → **amniotes** (amniotic egg) → synapsids (mammals) and sauropsids (reptiles and birds). Crocodiles and birds are archosaurs: birds are dinosaurs. Bridge animals: **Tiktaalik** (fish/tetrapod), **Archaeopteryx** (reptile/bird), platypus (reptile/mammal).",
        "Kiefermäuler → Knochenfische → Fleischflosser → **Tetrapoden** (vier Gliedmaßen) → **Amnioten** (Amnion-Ei) → Synapsiden (Säugetiere) und Sauropsiden (Reptilien und Vögel). Krokodile und Vögel sind Archosaurier: Vögel sind Dinosaurier. Brückentiere: **Tiktaalik** (Fisch/Landwirbeltier), **Archaeopteryx** (Reptil/Vogel), Schnabeltier (Reptil/Säuger).",
      ),
      tone: "rule",
    },
    {
      title: tx("Hearts in evolution", "Evolution des Herzens"),
      body: tx(
        "Fish: 1 atrium + 1 ventricle, single circulation. Amphibians: 2 atria + 1 ventricle, mixed blood. Reptiles: partial septum. Birds and mammals: 4 chambers, double circulation without mixing (arose twice: convergence).",
        "Fisch: 1 Vorhof + 1 Kammer, einfacher Kreislauf. Amphibien: 2 Vorhöfe + 1 Kammer, Mischblut. Reptilien: Teilscheidewand. Vögel und Säuger: 4 Kammern, doppelter Kreislauf ohne Mischung (zweimal entstanden: Konvergenz).",
      ),
      examples: [tx('2 \\to 3 \\to 3^{+} \\to 4 \\; "chambers"', '2 \\to 3 \\to 3^{+} \\to 4 \\; "Herzräume"')],
      tone: "tip",
    },
    {
      title: tx("Temperature control", "Temperaturregulation"),
      body: tx(
        "Endothermic: heat from metabolism, constant temperature, high energy use (most in the cold). Ectothermic: heat from outside, metabolism rises with temperature (RGT rule). Cube: O : V = 6/a, sphere: 3/r. **Bergmann**: related endotherms are larger in the cold. **Allen**: their ears, tails and legs are smaller in the cold.",
        "Endotherm: Wärme aus dem Stoffwechsel, konstante Temperatur, hoher Energieumsatz (am höchsten in der Kälte). Ektotherm: Wärme von außen, Stoffwechsel steigt mit der Temperatur (RGT-Regel). Würfel: O : V = 6/a, Kugel: 3/r. **Bergmann**: Verwandte gleichwarme Tiere sind in der Kälte größer. **Allen**: Ihre Ohren, Schwänze und Beine sind in der Kälte kleiner.",
      ),
      examples: ["\\frac{O}{V} = \\frac{6a^2}{a^3} = \\frac{6}{a}"],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Homologous does **not** mean 'same function'. A bridge animal is not necessarily a direct ancestor. Bergmann's rule only compares closely related warm-blooded animals (an African elephant is no counter-example). Ectothermic doesn't mean always cold.",
        "Homolog heißt **nicht** „gleiche Funktion“. Ein Brückentier ist nicht unbedingt ein direkter Vorfahr. Die Bergmannsche Regel vergleicht nur nah verwandte gleichwarme Tiere (der Afrikanische Elefant ist kein Gegenbeispiel). Ektotherm heißt nicht immer kalt.",
      ),
      tone: "warning",
    },
  ],
};

