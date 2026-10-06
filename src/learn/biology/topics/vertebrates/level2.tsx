"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { BIRD_PARTS, FEATHER_PARTS, VertebrateBirdSkeleton, VertebrateFeather } from "@/learn/biology/visuals/VertebrateBird";
import { FISH_PARTS, VertebrateFish } from "@/learn/biology/visuals/VertebrateFish";
import { META_STAGES, VertebrateMetamorphosis, VertebrateMetaStage } from "@/learn/biology/visuals/VertebrateMetamorphosis";
import { SKELETON_PARTS, VertebrateSkeleton } from "@/learn/biology/visuals/VertebrateSkeleton";
import { VertebrateBirdWidget, VertebrateFishWidget, VertebrateMammalWidget } from "@/learn/biology/visuals/VertebrateTabs";
import { DIET_NAMES, TEETH_PARTS, VertebrateTeeth, type Diet } from "@/learn/biology/visuals/VertebrateTeeth";
import { VertebrateTempGraph, VertebrateTempWidget } from "@/learn/biology/visuals/VertebrateTemperature";
import { cap, capT, choice, de, en, join, mistakes, q, visual, where, type Opt } from "./kit";
import type { FigurePart } from "@/learn/biology/Figure";

// ---------------------------------------------------------------------------
// Name the marked structure (fish, bird skeleton, feather, vertebrate skeleton)

/** Which other part a student typically confuses a part with, and why it's not that one. */
const CONFUSE: Record<string, { with: string; say: Text }[]> = {
  bladder: [
    { with: "gut", say: tx("The gut is the coiled tube below. The marked sac is filled with gas and lies right under the kidney.", "Der Darm ist der gewundene Schlauch darunter. Der markierte Sack ist mit Gas gefüllt und liegt direkt unter der Niere.") },
    { with: "gills", say: tx("Fish breathe with gills in the head. The gas-filled sac in the middle of the body is not a breathing organ.", "Fische atmen mit Kiemen im Kopf. Der gasgefüllte Sack in der Körpermitte ist kein Atemorgan.") },
  ],
  gills: [{ with: "operculum", say: tx("The gill cover is the bony flap on the outside. The marked red arches with filaments lie under it.", "Der Kiemendeckel ist die Knochenklappe außen. Die markierten roten Bögen mit Fäden liegen darunter.") }],
  operculum: [{ with: "gills", say: tx("The gills are the red arches underneath. The marked part is the flap that covers them.", "Die Kiemen sind die roten Bögen darunter. Markiert ist die Klappe, die sie bedeckt.") }],
  lateral: [{ with: "spine", say: tx("The backbone lies deeper inside. The marked dotted line runs along the skin: it's a sense organ.", "Die Wirbelsäule liegt tiefer im Körper. Die markierte gepunktete Linie verläuft in der Haut: ein Sinnesorgan.") }],
  kidney: [{ with: "liver", say: tx("The liver is the brown organ at the front of the belly. The marked organ is the dark strip right under the backbone.", "Die Leber ist das braune Organ vorne im Bauch. Markiert ist der dunkle Streifen direkt unter der Wirbelsäule.") }],
  pectoral: [{ with: "pelvic", say: tx("The pelvic fins sit on the belly. The marked fin sits on the side behind the gill cover.", "Die Bauchflossen sitzen am Bauch. Die markierte Flosse sitzt seitlich hinter dem Kiemendeckel.") }],
  pelvic: [{ with: "anal", say: tx("The anal fin sits behind the anus. The marked fin is further forward on the belly.", "Die Afterflosse sitzt hinter dem After. Die markierte Flosse sitzt weiter vorne am Bauch.") }],
  anal: [{ with: "pelvic", say: tx("The pelvic fins are further forward. The marked fin sits right behind the anus.", "Die Bauchflossen sitzen weiter vorne. Die markierte Flosse sitzt direkt hinter dem After.") }],
  keel: [{ with: "ribs", say: tx("The ribs form the cage above. The marked bone is the large plate below with a deep ridge.", "Die Rippen bilden den Korb darüber. Markiert ist die große Platte darunter mit dem hohen Kamm.") }],
  furcula: [{ with: "keel", say: tx("The keel is the big plate below. The marked thin bone in front of it is shaped like a V: the fused collarbones.", "Der Brustbeinkamm ist die große Platte darunter. Markiert ist der dünne Knochen davor, geformt wie ein V: die verwachsenen Schlüsselbeine.") }],
  humerus: [{ with: "forearm", say: tx("The forearm has two bones side by side. The marked single, thick bone comes first, at the shoulder.", "Der Unterarm hat zwei Knochen nebeneinander. Der markierte einzelne, dicke Knochen kommt zuerst, an der Schulter.") }],
  forearm: [{ with: "humerus", say: tx("The upper arm is a single bone at the shoulder. Here there are two bones side by side.", "Der Oberarm ist ein einzelner Knochen an der Schulter. Hier liegen zwei Knochen nebeneinander.") }],
  pelvis: [{ with: "keel", say: tx("The breastbone sits at the front underneath. The marked plate is at the back and carries the legs.", "Das Brustbein sitzt vorne unten. Die markierte Platte liegt hinten und trägt die Beine.") }],
  hooks: [{ with: "bows", say: tx("The curved barbules are smooth. The marked ones end in tiny hooks.", "Die Bogenstrahlen sind glatt. Die markierten enden in winzigen Häkchen.") }],
  bows: [{ with: "hooks", say: tx("The hooked barbules carry the little hooks. The marked ones are the smooth, curved partners.", "Die Hakenstrahlen tragen die Häkchen. Markiert sind die glatten, gebogenen Gegenstücke.") }],
  rachis: [{ with: "calamus", say: tx("The quill is the hollow part at the bottom without barbs. The marked part carries the barbs.", "Die Spule ist der hohle untere Teil ohne Äste. Der markierte Teil trägt die Äste.") }],
  calamus: [{ with: "rachis", say: tx("The shaft carries the barbs. The marked bare, hollow end sits in the skin.", "Der Schaft trägt die Äste. Das markierte nackte, hohle Ende steckt in der Haut.") }],
  shoulder: [{ with: "pelvis", say: tx("The pelvic girdle is at the back, at the hind legs. The marked bone holds the front legs.", "Der Beckengürtel sitzt hinten an den Hinterbeinen. Der markierte Knochen hält die Vorderbeine.") }],
  pelvis_s: [{ with: "shoulder", say: tx("The shoulder girdle holds the front legs. The marked bone is at the back and is joined firmly to the backbone.", "Der Schultergürtel hält die Vorderbeine. Der markierte Knochen sitzt hinten und ist fest mit der Wirbelsäule verbunden.") }],
};

/** Word answers for each part (both languages, plus common alternatives). */
const ACCEPT: Record<string, Text[]> = {
  gills: [tx("gills", "Kiemen"), tx("gill", "Kieme")],
  operculum: [tx("gill cover", "Kiemendeckel"), "operculum"],
  heart: [tx("heart", "Herz")],
  liver: [tx("liver", "Leber")],
  gut: [tx("gut", "Darm"), tx("intestine", "Darm")],
  kidney: [tx("kidney", "Niere")],
  bladder: [tx("swim bladder", "Schwimmblase"), "air bladder"],
  spine: [tx("backbone", "Wirbelsäule"), tx("spine", "Wirbelsaeule")],
  lateral: [tx("lateral line", "Seitenlinienorgan"), tx("lateral line organ", "Seitenlinie")],
  dorsal: [tx("dorsal fin", "Rückenflosse")],
  caudal: [tx("tail fin", "Schwanzflosse"), "caudal fin"],
  pectoral: [tx("pectoral fin", "Brustflosse")],
  pelvic: [tx("pelvic fin", "Bauchflosse")],
  anal: [tx("anal fin", "Afterflosse")],
  scales: [tx("scales", "Schuppen")],
  keel: [tx("keel", "Brustbeinkamm"), tx("breastbone", "Brustbein"), "sternum"],
  furcula: [tx("wishbone", "Gabelbein"), "furcula"],
  humerus: [tx("upper arm bone", "Oberarmknochen"), tx("humerus", "Oberarm")],
  pelvis: [tx("pelvis", "Becken"), tx("pelvic girdle", "Beckengürtel")],
  rachis: [tx("shaft", "Schaft"), "rachis"],
  calamus: [tx("quill", "Spule"), tx("calamus", "Federkiel")],
  vane: [tx("vane", "Fahne")],
  skull: [tx("skull", "Schädel")],
  shoulder: [tx("shoulder girdle", "Schultergürtel"), tx("shoulder blade", "Schulterblatt")],
  ribs: [tx("ribs", "Rippen"), tx("rib cage", "Brustkorb")],
};

type Drawing = { component: typeof VertebrateFish; parts: FigurePart[]; ids: string[]; what: Text; key?: (id: string) => string };
const DRAWINGS: Drawing[] = [
  { component: VertebrateFish, parts: FISH_PARTS, ids: ["gills", "operculum", "heart", "kidney", "bladder", "spine", "lateral", "dorsal", "caudal", "pectoral", "pelvic", "anal", "liver"], what: tx("the fish", "beim Fisch") },
  { component: VertebrateBirdSkeleton, parts: BIRD_PARTS, ids: ["keel", "furcula", "humerus", "forearm", "pelvis", "beak", "hand", "pygostyle"], what: tx("the bird skeleton", "am Vogelskelett") },
  { component: VertebrateFeather, parts: FEATHER_PARTS, ids: ["calamus", "rachis", "vane", "hooks", "bows", "down"], what: tx("the feather", "an der Feder") },
  { component: VertebrateSkeleton, parts: SKELETON_PARTS, ids: ["skull", "spine", "ribs", "shoulder", "pelvis", "fore", "hind"], what: tx("the skeleton", "am Skelett"), key: (id) => (id === "pelvis" ? "pelvis_s" : id) },
];

function partTask(rng: Rng, fixed?: { d: number; id: string; word?: boolean }): Exercise {
  const d = DRAWINGS[fixed?.d ?? rng.int(0, DRAWINGS.length - 1)];
  const id = fixed?.id ?? rng.pick(d.ids);
  const part = d.parts.find((p) => p.id === id)!;
  const conf = CONFUSE[d.key ? d.key(id) : id] ?? [];
  const asWord = fixed?.word ?? (!!ACCEPT[id] && rng.chance(0.4));
  const v = visual(d.component, { mode: "numbers", ask: id, legend: "none" });
  const solution: Frame[] = [{ math: q(part.label, "p"), note: tx(`This is the **${en(part.label)}**. ${en(part.info!)}`, `Das ist: **${de(part.label)}**. ${de(part.info!)}`), highlight: ["p"] }];
  const hint = tx("Where does it sit, and what could it do there?", "Wo sitzt die Struktur, und was könnte sie dort leisten?");
  if (asWord && ACCEPT[id]) {
    const answer: AnswerSpec = { kind: "word", accept: ACCEPT[id], placeholder: tx("name", "Name") };
    const m = mistakes(answer);
    for (const c of conf) if (ACCEPT[c.with]) m.add({ kind: "word", accept: ACCEPT[c.with] }, tx("Neighbouring structure", "Nachbarstruktur"), c.say);
    return { instruction: tx("Name the structure", "Benenne die Struktur"), text: tx(`What is the structure marked with "?" called in ${en(d.what)}?`, `Wie heißt die mit „?“ markierte Struktur ${de(d.what)}?`), visual: v, answer, hint, solution, mistakes: m.list };
  }
  const others = rng.shuffle(d.parts.filter((p) => p.id !== id && !conf.some((c) => c.with === p.id)));
  const wrong = [...conf.map((c) => d.parts.find((p) => p.id === c.with)!), ...others].slice(0, 3);
  const opts: Opt[] = [
    { text: capT(part.label) },
    ...wrong.map((p) => {
      const c = conf.find((x) => x.with === p.id);
      return { text: capT(p.label), title: tx("Neighbouring structure", "Nachbarstruktur"), say: c ? c.say : tx(`The ${en(p.label)} looks different and sits elsewhere: ${en(p.info!)}`, `${de(p.label)}: sieht anders aus und sitzt woanders. ${de(p.info!)}`) };
    }),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return { instruction: tx("Which structure?", "Welche Struktur?"), text: tx(`Which structure is marked with "?" in ${en(d.what)}?`, `Welche Struktur ist ${de(d.what)} mit „?“ markiert?`), visual: v, answer, hint, solution, mistakes: list };
}

// ---------------------------------------------------------------------------
// Structure and function

type SF = { id: string; s: Text; f: Text; wrong?: string; say?: Text };
const SF_BANK: SF[] = [
  { id: "bladder", s: tx("swim bladder", "Schwimmblase"), f: tx("controls buoyancy", "regelt den Auftrieb"), wrong: "gills", say: tx("The swim bladder isn't a breathing organ: it's filled with gas and lets the fish float.", "Die Schwimmblase ist kein Atemorgan: Sie ist mit Gas gefüllt und lässt den Fisch schweben.") },
  { id: "lateral", s: tx("lateral line", "Seitenlinienorgan"), f: tx("senses currents and pressure waves", "spürt Strömungen und Druckwellen"), wrong: "bladder", say: tx("The lateral line is a sense organ in the skin. Buoyancy is the swim bladder's job.", "Das Seitenlinienorgan ist ein Sinnesorgan in der Haut. Den Auftrieb regelt die Schwimmblase.") },
  { id: "gills", s: tx("gills", "Kiemen"), f: tx("exchange gases with the water", "Gasaustausch mit dem Wasser") },
  { id: "shape", s: tx("streamlined body", "Stromlinienform"), f: tx("low resistance in water", "geringer Wasserwiderstand") },
  { id: "keel", s: tx("keel of the breastbone", "Brustbeinkamm"), f: tx("anchors the flight muscles", "Ansatz der Flugmuskeln"), wrong: "bones", say: tx("The keel isn't about weight: it's the large surface where the strong flight muscles attach.", "Beim Brustbeinkamm geht es nicht ums Gewicht: Er ist die große Fläche, an der die kräftigen Flugmuskeln ansetzen.") },
  { id: "bones", s: tx("hollow bones", "Röhrenknochen"), f: tx("light but stable", "leicht, aber stabil") },
  { id: "hooks", s: tx("hooked barbules", "Hakenstrahlen"), f: tx("keep the vane closed", "halten die Fahne geschlossen"), wrong: "down", say: tx("Hooked barbules zip the vane together into a closed surface. Keeping warm is the job of the soft down.", "Hakenstrahlen verhaken die Fahne zu einer geschlossenen Fläche. Wärmen ist die Aufgabe der weichen Daunen.") },
  { id: "down", s: tx("down feathers", "Daunenfedern"), f: tx("keep the body warm", "halten den Körper warm"), wrong: "hooks", say: tx("Down has no hooks: its loose barbs hold air and insulate. A closed vane is what contour feathers have.", "Daunen haben keine Häkchen: Ihre lockeren Äste halten Luft fest und dämmen. Eine geschlossene Fahne haben Konturfedern.") },
  { id: "airsacs", s: tx("air sacs", "Luftsäcke"), f: tx("fresh air flows through the lungs all the time", "Lunge wird ständig von Frischluft durchströmt") },
  { id: "hornscales", s: tx("horny scales of reptiles", "Hornschuppen der Reptilien"), f: tx("protect from drying out", "Schutz vor Austrocknung"), wrong: "fur", say: tx("Horny scales don't keep a reptile warm: it's cold-blooded. They stop water evaporating through the skin.", "Hornschuppen wärmen ein Reptil nicht: Es ist wechselwarm. Sie verhindern, dass Wasser über die Haut verdunstet.") },
  { id: "egg", s: tx("egg with shell and egg membranes", "Ei mit Schale und Eihäuten"), f: tx("lets the embryo develop on dry land", "Entwicklung an Land ohne Austrocknen") },
  { id: "fur", s: tx("fur", "Fell"), f: tx("insulates: air between the hairs", "dämmt: Luft zwischen den Haaren") },
  { id: "skin", s: tx("moist amphibian skin", "feuchte Amphibienhaut"), f: tx("skin breathing", "Hautatmung"), wrong: "hornscales", say: tx("Moist skin does the opposite of protecting from drying out: it loses water easily, but oxygen can pass through it.", "Feuchte Haut schützt gerade nicht vor Austrocknung: Sie verliert leicht Wasser, aber Sauerstoff kann durch sie hindurch.") },
  { id: "carnassial", s: tx("carnassial teeth", "Reißzähne"), f: tx("cut meat like scissors", "zerschneiden Fleisch wie eine Schere"), wrong: "molarsH", say: tx("Carnassials are blades that cut. Grinding is done by broad, flat molars of plant-eaters.", "Reißzähne sind Klingen, die schneiden. Zermahlen tun die breiten, flachen Backenzähne der Pflanzenfresser.") },
  { id: "molarsH", s: tx("broad molars with enamel ridges", "breite Backenzähne mit Schmelzfalten"), f: tx("grind tough plants", "zermahlen zähe Pflanzen") },
];

function matchSFTask(rng: Rng): Exercise {
  const items = rng.shuffle(SF_BANK).slice(0, 4);
  const extra = rng.pick(SF_BANK.filter((x) => !items.includes(x)));
  const pairs: [Text, Text][] = items.map((x) => [capT(x.s), x.f]);
  const right = [...items, extra];
  const list: Mistake[] = [];
  for (const x of items) {
    const w = x.wrong ? right.find((y) => y.id === x.wrong) : undefined;
    if (w && x.say) list.push({ when: { kind: "match", pairs: [[capT(x.s), w.f]] }, title: tx("Mixed up", "Verwechselt"), say: x.say });
  }
  return {
    instruction: tx("Match structure and function", "Ordne Struktur und Funktion zu"),
    text: tx("Which job does each structure do? One job is left over.", "Welche Aufgabe hat jede Struktur? Eine Aufgabe bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [extra.f] },
    hint: tx("Structure and function belong together: ask what each structure is good for.", "Struktur und Funktion gehören zusammen: Frag dich, wofür die Struktur gut ist."),
    solution: items.map((x, k) => ({ math: join(q(x.s, `s${k}`), "\\to", q(x.f, `f${k}`)), note: tx(`${cap(en(x.s))}: ${en(x.f)}.`, `${de(x.s)}: ${de(x.f)}.`) })),
    mistakes: list.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Why questions about adaptations

type Why = { q: Text; right: Text; wrong: { text: Text; say: Text }[]; note: Text };
const WHY: Why[] = [
  {
    q: tx("How can a perch hang still in the water without sinking?", "Wie kann ein Barsch im Wasser stehen, ohne abzusinken?"),
    right: tx("Its swim bladder holds just enough gas for it to float.", "Seine Schwimmblase enthält genau so viel Gas, dass er schwebt."),
    wrong: [
      { text: tx("It keeps beating its fins all the time.", "Er schlägt ständig mit den Flossen."), say: tx("That would cost a lot of energy. A perch can rest almost still: something inside it gives buoyancy.", "Das würde viel Energie kosten. Ein Barsch kann fast reglos stehen: Etwas in seinem Inneren gibt ihm Auftrieb.") },
      { text: tx("Its bones are hollow and filled with air.", "Seine Knochen sind hohl und mit Luft gefüllt."), say: tx("Hollow, air-filled bones are a bird feature. Fish have a different gas-filled organ.", "Hohle, luftgefüllte Knochen sind ein Vogelmerkmal. Fische haben ein anderes gasgefülltes Organ.") },
      { text: tx("It stores air in its gills.", "Er speichert Luft in den Kiemen."), say: tx("Gills take oxygen out of the water; they don't store air.", "Kiemen holen Sauerstoff aus dem Wasser; sie speichern keine Luft.") },
    ],
    note: tx("The swim bladder is filled with gas. By changing the amount of gas the fish adjusts its buoyancy.", "Die Schwimmblase ist mit Gas gefüllt. Über die Gasmenge stellt der Fisch seinen Auftrieb ein."),
  },
  {
    q: tx("A pike notices a frog swimming behind it in murky water. How?", "Ein Hecht bemerkt im trüben Wasser einen Frosch hinter sich. Wie?"),
    right: tx("Its lateral line feels the frog's pressure waves.", "Sein Seitenlinienorgan spürt die Druckwellen des Froschs."),
    wrong: [
      { text: tx("It sees all around with its eyes.", "Er sieht mit den Augen rundherum."), say: tx("In murky water and behind it, the eyes won't help much. The fish has a sense organ for water movements.", "Im trüben Wasser und hinter sich helfen die Augen kaum. Der Fisch hat ein Sinnesorgan für Wasserbewegungen.") },
      { text: tx("Its swim bladder tastes the water.", "Seine Schwimmblase schmeckt das Wasser."), say: tx("The swim bladder controls buoyancy; it's not a sense organ.", "Die Schwimmblase regelt den Auftrieb; sie ist kein Sinnesorgan.") },
      { text: tx("Its gills hear the sound.", "Seine Kiemen hören das Geräusch."), say: tx("Gills are for breathing. The sense organ runs along the side of the body.", "Kiemen dienen der Atmung. Das Sinnesorgan verläuft an der Körperseite.") },
    ],
    note: tx("The lateral line organ along the side registers currents and pressure waves, even in the dark.", "Das Seitenlinienorgan an der Körperseite registriert Strömungen und Druckwellen, sogar im Dunkeln."),
  },
  {
    q: tx("Why do fast swimmers like trout and tuna have a streamlined, spindle-shaped body?", "Warum haben schnelle Schwimmer wie Forelle und Thunfisch einen stromlinienförmigen, spindelförmigen Körper?"),
    right: tx("The water flows past with little resistance.", "Das Wasser strömt mit wenig Widerstand vorbei."),
    wrong: [
      { text: tx("To have more room for the swim bladder.", "Damit die Schwimmblase mehr Platz hat."), say: tx("The shape is about the water flowing around the body, not about room inside.", "Bei der Form geht es darum, wie das Wasser um den Körper strömt, nicht um Platz im Inneren.") },
      { text: tx("So that they can see better.", "Damit sie besser sehen können."), say: tx("The body shape doesn't change their vision. Think about moving through water.", "Die Körperform ändert nichts am Sehen. Denk an die Bewegung durchs Wasser.") },
    ],
    note: tx("A streamlined body has low water resistance, so swimming costs less energy.", "Ein stromlinienförmiger Körper hat einen geringen Wasserwiderstand, Schwimmen kostet so weniger Energie."),
  },
  {
    q: tx("Why are many bird bones hollow?", "Warum sind viele Vogelknochen hohl?"),
    right: tx("They are light, and struts inside keep them stable.", "Sie sind leicht, und innere Verstrebungen machen sie stabil."),
    wrong: [
      { text: tx("They store food for long flights.", "Sie speichern Nahrung für lange Flüge."), say: tx("Inside there's air, not food. Think about what matters most for flying.", "Darin ist Luft, keine Nahrung. Überleg, was beim Fliegen am meisten zählt.") },
      { text: tx("The air inside keeps the bird warm.", "Die Luft darin wärmt den Vogel."), say: tx("Feathers keep the bird warm. Hollow bones are about weight.", "Warm halten den Vogel die Federn. Bei hohlen Knochen geht es ums Gewicht.") },
      { text: tx("Hollow bones bend, so they absorb landings.", "Hohle Knochen biegen sich und federn Landungen ab."), say: tx("Hollow bird bones are stiff, not bendy: fine struts brace them like a framework.", "Hohle Vogelknochen sind steif, nicht biegsam: Feine Knochenbälkchen verstreben sie wie ein Fachwerk.") },
    ],
    note: tx("Hollow bones (Röhrenknochen) with fine struts inside are light and still stable: lightweight construction for flying.", "Röhrenknochen mit feinen Verstrebungen innen sind leicht und trotzdem stabil: Leichtbau fürs Fliegen."),
  },
  {
    q: tx("What is the large keel on a bird's breastbone for?", "Wozu hat ein Vogel einen großen Kamm am Brustbein?"),
    right: tx("The strong flight muscles attach to it.", "An ihm setzen die kräftigen Flugmuskeln an."),
    wrong: [
      { text: tx("It protects the heart when landing.", "Er schützt das Herz beim Landen."), say: tx("The rib cage protects the heart. The keel is a large surface for something that moves the wings.", "Das Herz schützt der Brustkorb. Der Kamm ist eine große Fläche für etwas, das die Flügel bewegt.") },
      { text: tx("It stores air for flying.", "Er speichert Luft fürs Fliegen."), say: tx("Air is stored in the air sacs. The keel is solid bone for muscles.", "Luft steckt in den Luftsäcken. Der Kamm ist fester Knochen für Muskeln.") },
      { text: tx("It helps the bird balance on a branch.", "Er hilft beim Balancieren auf einem Ast."), say: tx("Balance comes from legs, toes and tail. Ostriches have hardly any keel: they don't fly. That's a clue!", "Das Gleichgewicht halten Beine, Zehen und Schwanz. Strauße haben kaum einen Kamm: Sie fliegen nicht. Das ist ein Hinweis!") },
    ],
    note: tx("The large flight muscles that pull the wings down are attached to the keel. Flightless birds have hardly any keel.", "Am Brustbeinkamm setzen die großen Flugmuskeln an, die die Flügel nach unten ziehen. Flugunfähige Vögel haben kaum einen Kamm."),
  },
  {
    q: tx("Why does the vane of a contour feather form a closed surface?", "Warum bildet die Fahne einer Konturfeder eine geschlossene Fläche?"),
    right: tx("Hooked barbules catch on the curved barbules of the next barb.", "Hakenstrahlen verhaken sich mit den Bogenstrahlen des nächsten Astes."),
    wrong: [
      { text: tx("The barbs are glued together with fat.", "Die Äste sind mit Fett verklebt."), say: tx("Preen oil makes feathers water-repellent, but the vane is held together mechanically, like a zip.", "Bürzelfett macht Federn wasserabweisend, aber die Fahne hält mechanisch zusammen, wie ein Reißverschluss.") },
      { text: tx("The vane is one solid plate of horn.", "Die Fahne ist eine einzige Hornplatte."), say: tx("Look at the zoom: the vane is made of hundreds of barbs with tiny barbules.", "Schau in die Vergrößerung: Die Fahne besteht aus Hunderten Ästen mit winzigen Strahlen.") },
    ],
    note: tx("Tiny hooks on the hooked barbules grip the curved barbules: the vane is closed and holds the air. Preening hooks torn places back together.", "Winzige Häkchen der Hakenstrahlen greifen in die Bogenstrahlen: Die Fahne ist geschlossen und hält die Luft. Beim Putzen hakt der Vogel Risse wieder zusammen."),
  },
  {
    q: tx("Why do small birds survive frosty winter nights?", "Warum überleben kleine Vögel frostige Winternächte?"),
    right: tx("They fluff up their down feathers, which trap insulating air.", "Sie plustern ihre Daunen auf, die isolierende Luft festhalten."),
    wrong: [
      { text: tx("They are cold-blooded and simply cool down.", "Sie sind wechselwarm und kühlen einfach ab."), say: tx("Birds are warm-blooded: they keep about 40 °C. They need insulation to save energy.", "Vögel sind gleichwarm: Sie halten etwa 40 °C. Sie brauchen eine Dämmung, um Energie zu sparen.") },
      { text: tx("Warm air in their hollow bones heats them.", "Warme Luft in den hohlen Knochen heizt sie."), say: tx("Hollow bones make the bird light. The insulation sits on the outside of the body.", "Hohle Knochen machen den Vogel leicht. Die Dämmung sitzt außen am Körper.") },
    ],
    note: tx("Down feathers have no hooks; their loose barbs trap a lot of air. Air is a poor conductor of heat: it insulates.", "Daunenfedern haben keine Häkchen; ihre lockeren Äste halten viel Luft fest. Luft leitet Wärme schlecht: Sie dämmt."),
  },
  {
    q: tx("Why are frogs and newts tied to damp places?", "Warum sind Frösche und Molche an feuchte Lebensräume gebunden?"),
    right: tx("Their thin, moist skin loses water easily, and their spawn has no shell.", "Ihre dünne, feuchte Haut verliert leicht Wasser, und ihr Laich hat keine Schale."),
    wrong: [
      { text: tx("Adults breathe with gills and need water.", "Die Erwachsenen atmen mit Kiemen und brauchen Wasser."), say: tx("Only the larvae have gills. Adults breathe with lungs and skin: the skin is the problem in dry air.", "Nur die Larven haben Kiemen. Erwachsene atmen mit Lungen und Haut: In trockener Luft ist die Haut das Problem.") },
      { text: tx("They are warm-blooded and need water to cool down.", "Sie sind gleichwarm und brauchen Wasser zum Kühlen."), say: tx("Amphibians are cold-blooded. The problem is losing water through the skin.", "Amphibien sind wechselwarm. Das Problem ist der Wasserverlust über die Haut.") },
      { text: tx("They can't walk on land.", "Sie können an Land nicht laufen."), say: tx("Frogs hop and newts walk very well on land. It's about water, not legs.", "Frösche springen und Molche laufen an Land sehr gut. Es geht um Wasser, nicht um Beine.") },
    ],
    note: tx("Moist skin is needed for skin breathing but lets water evaporate. Spawn without a shell would dry out on land.", "Die feuchte Haut ist für die Hautatmung nötig, lässt aber Wasser verdunsten. Laich ohne Schale würde an Land vertrocknen."),
  },
  {
    q: tx("Why can reptiles live in deserts?", "Warum können Reptilien in Wüsten leben?"),
    right: tx("Dry skin with horny scales protects them from losing water.", "Trockene Haut mit Hornschuppen schützt sie vor Wasserverlust."),
    wrong: [
      { text: tx("Their slimy skin keeps the water in.", "Ihre schleimige Haut hält das Wasser fest."), say: tx("Slimy skin belongs to fish and amphibians. Reptiles have a dry protective layer.", "Schleimige Haut haben Fische und Amphibien. Reptilien haben eine trockene Schutzschicht.") },
      { text: tx("They are warm-blooded and don't mind heat.", "Sie sind gleichwarm und vertragen Hitze."), say: tx("Reptiles are cold-blooded: in the midday heat they hide in the shade.", "Reptilien sind wechselwarm: In der Mittagshitze verstecken sie sich im Schatten.") },
      { text: tx("They breathe through their skin.", "Sie atmen über die Haut."), say: tx("Skin breathing needs moist skin: that's amphibians. Reptiles breathe only with lungs.", "Hautatmung braucht feuchte Haut: Das sind die Amphibien. Reptilien atmen nur mit Lungen.") },
    ],
    note: tx("Horny scales are a protection against evaporation (Verdunstungsschutz). Eggs with a shell develop on dry land.", "Hornschuppen sind ein Verdunstungsschutz. Eier mit Schale entwickeln sich auf trockenem Land."),
  },
  {
    q: tx("Why don't reptiles need water to breed?", "Warum brauchen Reptilien zur Fortpflanzung kein Gewässer?"),
    right: tx("The embryo grows in an egg with a shell and egg membranes (amnion) that stops it drying out.", "Der Embryo wächst in einem Ei mit Schale und Eihäuten (Amnion), das ihn vor Austrocknung schützt."),
    wrong: [
      { text: tx("They lay spawn in small puddles.", "Sie legen Laich in kleine Pfützen."), say: tx("Spawn in water is what fish and amphibians do. Reptiles lay eggs on land.", "Laich im Wasser legen Fische und Amphibien. Reptilien legen Eier an Land.") },
      { text: tx("All reptiles give birth to live young.", "Alle Reptilien bringen lebende Junge zur Welt."), say: tx("A few do, but most lay eggs. The trick is inside the egg.", "Einige wenige schon, die meisten legen aber Eier. Der Trick steckt im Ei.") },
      { text: tx("Their larvae breathe with lungs straight away.", "Ihre Larven atmen sofort mit Lungen."), say: tx("Reptiles have no larvae: young reptiles hatch looking like small adults.", "Reptilien haben keine Larven: Junge Reptilien schlüpfen als kleine Erwachsene.") },
    ],
    note: tx("The amniotic egg (Amnion-Ei) is a 'private pond': the embryo floats in fluid, protected by membranes and a shell.", "Das Amnion-Ei ist ein „eigener Teich“: Der Embryo schwimmt in Flüssigkeit, geschützt von Eihäuten und Schale."),
  },
  {
    q: tx("What are a bird's air sacs for?", "Wozu dienen die Luftsäcke eines Vogels?"),
    right: tx("Fresh air flows through the lungs all the time, even when breathing out.", "Die Lunge wird ständig von Frischluft durchströmt, auch beim Ausatmen."),
    wrong: [
      { text: tx("They store air for diving.", "Sie speichern Luft zum Tauchen."), say: tx("Most birds don't dive. The air sacs keep air moving through the lungs.", "Die meisten Vögel tauchen nicht. Die Luftsäcke halten die Luft in der Lunge in Bewegung.") },
      { text: tx("They replace the lungs.", "Sie ersetzen die Lunge."), say: tx("Gas exchange still happens in the lungs; the air sacs work like bellows.", "Der Gasaustausch findet weiter in der Lunge statt; die Luftsäcke arbeiten wie Blasebälge.") },
    ],
    note: tx("Air sacs work like bellows: the lungs get fresh air all the time, which supplies the flight muscles with plenty of oxygen. They also make the body lighter.", "Luftsäcke arbeiten wie Blasebälge: Die Lunge bekommt ständig Frischluft, die Flugmuskeln viel Sauerstoff. Außerdem machen sie den Körper leichter."),
  },
  {
    q: tx("Why do mammals in cold regions have thick fur?", "Warum haben Säugetiere in kalten Gebieten ein dichtes Fell?"),
    right: tx("Air between the hairs insulates and keeps body heat in.", "Luft zwischen den Haaren dämmt und hält die Körperwärme fest."),
    wrong: [
      { text: tx("Fur produces heat.", "Fell erzeugt Wärme."), say: tx("Heat comes from metabolism (burning food). Fur only stops it escaping.", "Die Wärme kommt aus dem Stoffwechsel (Verbrennung von Nahrung). Das Fell hält sie nur fest.") },
      { text: tx("Fur protects against evaporation like horny scales.", "Fell schützt wie Hornschuppen vor Verdunstung."), say: tx("Fur is mainly about heat. Its trick is the air trapped between the hairs.", "Beim Fell geht es vor allem um Wärme. Sein Trick ist die Luft zwischen den Haaren.") },
    ],
    note: tx("Fur traps air, and air conducts heat poorly: warm-blooded animals lose less heat and need less food.", "Fell hält Luft fest, und Luft leitet Wärme schlecht: Gleichwarme Tiere verlieren weniger Wärme und brauchen weniger Nahrung."),
  },
];

function whyTask(rng: Rng, fixed?: number): Exercise {
  const w = WHY[fixed ?? rng.int(0, WHY.length - 1)];
  const { answer, mistakes: list } = choice(rng, [{ text: w.right }, ...w.wrong.map((x) => ({ text: x.text, title: tx("Not quite", "Nicht ganz"), say: x.say }))]);
  return {
    instruction: tx("Explain the adaptation", "Erkläre die Angepasstheit"),
    text: w.q,
    answer,
    hint: tx("Structure and function: what does this structure make possible in its habitat?", "Struktur und Funktion: Was ermöglicht diese Struktur im Lebensraum?"),
    solution: [{ math: tx('"structure"#s \\to "function"#f', '"Struktur"#s \\to "Funktion"#f'), note: w.note }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Metamorphosis

const META_SHORT: Text[] = [
  tx("spawn in water", "Laich im Wasser"),
  tx("larva with external gills", "Larve mit Außenkiemen"),
  tx("tadpole with internal gills", "Kaulquappe mit Innenkiemen"),
  tx("hind legs grow", "Hinterbeine wachsen"),
  tx("front legs break through", "Vorderbeine brechen durch"),
  tx("tail is broken down", "Schwanz wird abgebaut"),
  tx("frog on land", "Frosch an Land"),
];

function metaOrderTask(rng: Rng): Exercise {
  const n = rng.int(4, 5);
  const idx = rng.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, n).sort((a, b) => a - b);
  const items = idx.map((i) => META_SHORT[i]);
  const list: Mistake[] = [];
  if (idx.includes(3) && idx.includes(4)) list.push({ when: { kind: "order", items: [META_SHORT[4], META_SHORT[3]] }, title: tx("Hind legs come first", "Hinterbeine zuerst"), say: tx("In frogs the hind legs appear first. The front legs only break through later, shortly before the tail is broken down.", "Beim Frosch erscheinen zuerst die Hinterbeine. Die Vorderbeine brechen erst später durch, kurz bevor der Schwanz abgebaut wird.") });
  if (idx.includes(1) && idx.includes(2)) list.push({ when: { kind: "order", items: [META_SHORT[2], META_SHORT[1]] }, title: tx("Outside first", "Erst außen"), say: tx("The freshly hatched larva has feathery gills on the outside. Later a fold of skin grows over them.", "Die frisch geschlüpfte Larve hat fedrige Kiemen außen. Erst später wächst eine Hautfalte darüber.") });
  if (idx.includes(5) && (idx.includes(3) || idx.includes(4))) {
    const leg = idx.includes(4) ? 4 : 3;
    list.push({ when: { kind: "order", items: [META_SHORT[5], META_SHORT[leg]] }, title: tx("Tail last", "Schwanz zuletzt"), say: tx("The tail is still needed for swimming while the legs grow. It's only broken down at the very end.", "Den Schwanz braucht die Kaulquappe zum Schwimmen, solange die Beine wachsen. Er wird erst ganz am Ende abgebaut.") });
  }
  return {
    instruction: tx("Put the stages in order", "Bring die Stadien in die richtige Reihenfolge"),
    text: tx("The development of the common frog (metamorphosis). Start with the earliest stage.", "Die Entwicklung des Grasfroschs (Metamorphose). Beginne mit dem frühesten Stadium."),
    answer: { kind: "order", items },
    hint: tx("Which legs does a tadpole get first? And when does it lose the tail?", "Welche Beine bekommt eine Kaulquappe zuerst? Und wann verliert sie den Schwanz?"),
    solution: idx.map((i, k) => ({ math: tx(idx.slice(0, k + 1).map((j, m) => `"${en(META_SHORT[j])}"#s${m}`).join(" \\to "), idx.slice(0, k + 1).map((j, m) => `"${de(META_SHORT[j])}"#s${m}`).join(" \\to ")), note: tx(`${en(META_STAGES[i].name)}: breathing ${en(META_STAGES[i].breath)}.`, `${de(META_STAGES[i].name)}: Atmung ${de(META_STAGES[i].breath)}.`), highlight: [`s${k}`] })),
    mistakes: list,
  };
}

function metaStageTask(rng: Rng): Exercise {
  const s = rng.int(1, 6);
  const ask = rng.pick(["name", "breath", "food"] as const);
  const st = META_STAGES[s];
  let opts: Opt[];
  let question: Text;
  if (ask === "name") {
    question = tx("Which stage of the frog's metamorphosis is shown?", "Welches Stadium der Metamorphose des Froschs ist abgebildet?");
    const near = [s - 1, s + 1].filter((i) => i >= 1 && i <= 6);
    const rest = rng.shuffle([1, 2, 3, 4, 5, 6].filter((i) => i !== s && !near.includes(i)));
    opts = [{ text: META_SHORT[s] }, ...[...near, ...rest].slice(0, 3).map((i) => ({ text: META_SHORT[i], title: tx("Look at the legs and tail", "Schau auf Beine und Schwanz"), say: tx(`Compare: ${en(META_SHORT[i])} would look different. Count the legs and check the tail and the gills.`, `Vergleich: ${de(META_SHORT[i])} sähe anders aus. Zähl die Beine und prüf Schwanz und Kiemen.`) }))];
  } else if (ask === "breath") {
    question = tx("How does the animal in this stage breathe?", "Wie atmet das Tier in diesem Stadium?");
    const pool = [1, 2, 4, 6].filter((i) => !(s >= 5 && i >= 5)).map((i) => META_STAGES[i].breath);
    const right = st.breath;
    const others = rng.shuffle(pool.filter((b) => en(b) !== en(right))).slice(0, 3);
    opts = [
      { text: capT(right) },
      ...others.map((b) => ({ text: capT(b), title: tx("Different stage", "Anderes Stadium"), say: tx("That's how a different stage breathes. Look at the picture: external gills? Legs? Tail?", "So atmet ein anderes Stadium. Schau aufs Bild: Außenkiemen? Beine? Schwanz?") })),
    ];
  } else {
    question = tx("What does the animal in this stage live on?", "Wovon ernährt sich das Tier in diesem Stadium?");
    const pool = [1, 2, 4, 5, 6].map((i) => META_STAGES[i].food);
    const right = s === 3 ? META_STAGES[2].food : st.food;
    const others = rng.shuffle(pool.filter((b) => en(b) !== en(right))).slice(0, 3);
    opts = [
      { text: capT(right) },
      ...others.map((b) => ({
        text: capT(b),
        title: en(b).startsWith("insects") ? tx("Plant-eater first", "Erst Pflanzenfresser") : tx("Different stage", "Anderes Stadium"),
        say: en(b).startsWith("insects") ? tx("Only the finished frog hunts insects. Tadpoles scrape algae with horny jaws.", "Erst der fertige Frosch jagt Insekten. Kaulquappen raspeln mit Hornkiefern Algen ab.") : tx("That fits a different stage. Look at the legs, the tail and the mouth.", "Das passt zu einem anderen Stadium. Schau auf Beine, Schwanz und Maul."),
      })),
    ];
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Metamorphosis", "Metamorphose"),
    text: question,
    visual: visual(VertebrateMetaStage, { stage: s }),
    answer,
    hint: tx("External gills, legs and the tail tell you the stage.", "Außenkiemen, Beine und Schwanz verraten das Stadium."),
    solution: [{ math: q(st.name, "n"), note: tx(`${en(st.name)} (${en(st.when)}): breathing ${en(st.breath)}; food: ${en(st.food)}.`, `${de(st.name)} (${de(st.when)}): Atmung ${de(st.breath)}; Nahrung: ${de(st.food)}.`), highlight: ["n"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Surviving winter

type Win = "hib" | "rest" | "rigor" | "migr" | "active";
const WINTER: Record<Win, { name: Text; what: Text }> = {
  hib: { name: tx("hibernation", "Winterschlaf"), what: tx("body temperature drops far (hedgehog: about 5 °C), heartbeat and breathing slow right down, lives off its fat, rarely wakes", "Körpertemperatur stark gesenkt (Igel: etwa 5 °C), Herzschlag und Atmung stark verlangsamt, lebt vom Fettvorrat, wacht selten auf") },
  rest: { name: tx("winter rest", "Winterruhe"), what: tx("body temperature drops only a little, sleeps a lot but wakes often and eats from its stores", "Körpertemperatur nur wenig gesenkt, schläft viel, wacht aber oft auf und frisst von Vorräten") },
  rigor: { name: tx("cold torpor", "Winterstarre"), what: tx("cold-blooded: the body cools with the surroundings, the animal becomes rigid and cannot wake up actively", "wechselwarm: Der Körper kühlt mit der Umgebung ab, das Tier wird starr und kann nicht aktiv aufwachen") },
  migr: { name: tx("migration to the south", "Zug in den Süden"), what: tx("flies to warmer regions with enough food", "fliegt in wärmere Gebiete mit genug Nahrung") },
  active: { name: tx("stays active (winter coat)", "bleibt aktiv (Winterfell)"), what: tx("stays active, grows a thicker coat and searches for food", "bleibt aktiv, bekommt ein dichteres Fell und sucht Nahrung") },
};
const WINTER_ANIMALS: { name: Text; art: "der" | "die" | "das"; w: Win }[] = [
  { name: tx("hedgehog", "Igel"), art: "der", w: "hib" },
  { name: tx("bat", "Fledermaus"), art: "die", w: "hib" },
  { name: tx("alpine marmot", "Murmeltier"), art: "das", w: "hib" },
  { name: tx("edible dormouse", "Siebenschläfer"), art: "der", w: "hib" },
  { name: tx("red squirrel", "Eichhörnchen"), art: "das", w: "rest" },
  { name: tx("badger", "Dachs"), art: "der", w: "rest" },
  { name: tx("brown bear", "Braunbär"), art: "der", w: "rest" },
  { name: tx("common frog", "Grasfrosch"), art: "der", w: "rigor" },
  { name: tx("sand lizard", "Zauneidechse"), art: "die", w: "rigor" },
  { name: tx("grass snake", "Ringelnatter"), art: "die", w: "rigor" },
  { name: tx("common toad", "Erdkröte"), art: "die", w: "rigor" },
  { name: tx("white stork", "Weißstorch"), art: "der", w: "migr" },
  { name: tx("barn swallow", "Rauchschwalbe"), art: "die", w: "migr" },
  { name: tx("cuckoo", "Kuckuck"), art: "der", w: "migr" },
  { name: tx("red fox", "Rotfuchs"), art: "der", w: "active" },
  { name: tx("roe deer", "Reh"), art: "das", w: "active" },
];
/** Blob's note when the animal with strategy `right` was given strategy `got`. */
function winterSay(right: Win, got: Win): { title: Text; say: Text } {
  const key = `${right}>${got}`;
  const S: Record<string, [Text, Text]> = {
    "rest>hib": [tx("It wakes up often", "Es wacht oft auf"), tx("Its body temperature only drops a little, and it wakes up often to eat from its stores. Deep hibernation looks different.", "Seine Körpertemperatur sinkt nur wenig, und es wacht oft auf, um von seinen Vorräten zu fressen. Echter Winterschlaf sieht anders aus.")],
    "hib>rest": [tx("Much deeper", "Viel tiefer"), tx("This animal cools down to just a few degrees and sleeps for months on its fat reserves. That's more than a winter rest.", "Dieses Tier kühlt auf wenige Grad ab und schläft monatelang von seinen Fettreserven. Das ist mehr als eine Winterruhe.")],
    "rigor>hib": [tx("Cold-blooded", "Wechselwarm"), tx("Only warm-blooded animals hibernate: they lower their set point and can heat up again. A cold-blooded animal just cools down with its surroundings and becomes rigid.", "Winterschlaf halten nur gleichwarme Tiere: Sie senken ihren Sollwert und können sich wieder aufheizen. Ein wechselwarmes Tier kühlt einfach mit der Umgebung ab und wird starr.")],
    "rigor>rest": [tx("Cold-blooded", "Wechselwarm"), tx("Winter rest needs a warm-blooded body that wakes up to eat. This cold-blooded animal can't wake up actively in the cold.", "Winterruhe braucht einen gleichwarmen Körper, der zum Fressen aufwacht. Dieses wechselwarme Tier kann in der Kälte nicht aktiv aufwachen.")],
    "hib>rigor": [tx("It's warm-blooded", "Es ist gleichwarm"), tx("Torpor happens to cold-blooded animals. This one is warm-blooded: it lowers its body temperature on purpose and can heat itself up again.", "Starre betrifft wechselwarme Tiere. Dieses ist gleichwarm: Es senkt seine Körpertemperatur gezielt ab und kann sich wieder aufheizen.")],
    "rest>rigor": [tx("It's warm-blooded", "Es ist gleichwarm"), tx("This animal is warm-blooded and stays fairly warm in winter. Torpor is for cold-blooded animals.", "Dieses Tier ist gleichwarm und bleibt im Winter ziemlich warm. Starre gibt es bei wechselwarmen Tieren.")],
    "migr>hib": [tx("It's a migrant", "Ein Zugvogel"), tx("Birds don't hibernate here: this one flies thousands of kilometres to find insects in the south.", "Vögel halten bei uns keinen Winterschlaf: Dieser fliegt Tausende Kilometer, um im Süden Insekten zu finden.")],
  };
  const s = S[key];
  if (s) return { title: s[0], say: s[1] };
  return { title: tx("Different strategy", "Andere Strategie"), say: tx(`${cap(en(WINTER[got].name))} means: ${en(WINTER[got].what)}. Does that fit this animal?`, `${de(WINTER[got].name)} heißt: ${de(WINTER[got].what)}. Passt das zu diesem Tier?`) };
}

function winterTask(rng: Rng): Exercise {
  const a = rng.pick(WINTER_ANIMALS);
  const others = rng.shuffle((Object.keys(WINTER) as Win[]).filter((w) => w !== a.w));
  const prefer: Win[] = a.w === "rest" ? ["hib"] : a.w === "hib" ? ["rest"] : a.w === "rigor" ? ["hib"] : [];
  const wrong = [...prefer, ...others.filter((w) => !prefer.includes(w))].slice(0, 3);
  const opts: Opt[] = [{ text: capT(WINTER[a.w].name) }, ...wrong.map((w) => ({ text: capT(WINTER[w].name), ...winterSay(a.w, w) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Surviving winter", "Überwintern"),
    text: tx(`How does the ${en(a.name)} get through the winter?`, `Wie überwintert ${a.art} ${de(a.name)}?`),
    answer,
    hint: tx("Warm- or cold-blooded? Does it wake up to eat? Can it fly away?", "Gleichwarm oder wechselwarm? Wacht es zum Fressen auf? Kann es wegfliegen?"),
    solution: [{ math: join(q(a.name, "a"), "\\to", q(WINTER[a.w].name, "w")), note: tx(`${cap(en(WINTER[a.w].name))}: ${en(WINTER[a.w].what)}.`, `${de(WINTER[a.w].name)}: ${de(WINTER[a.w].what)}.`), highlight: ["w"] }],
    mistakes: list,
  };
}

function winterMatchTask(rng: Rng): Exercise {
  const ws = rng.shuffle(["hib", "rest", "rigor", "migr"] as Win[]);
  const animals = ws.map((w) => rng.pick(WINTER_ANIMALS.filter((a) => a.w === w)));
  const pairs: [Text, Text][] = animals.map((a) => [capT(a.name), capT(WINTER[a.w].name)]);
  const list: Mistake[] = [];
  for (const a of animals) {
    const wrongW: Win | null = a.w === "rest" ? "hib" : a.w === "rigor" ? "hib" : a.w === "hib" ? "rest" : null;
    if (wrongW && list.length < 3) list.push({ when: { kind: "match", pairs: [[capT(a.name), capT(WINTER[wrongW].name)]] }, ...winterSay(a.w, wrongW) });
  }
  return {
    instruction: tx("Match animal and winter strategy", "Ordne Tier und Überwinterung zu"),
    answer: { kind: "match", pairs, distractors: [capT(WINTER.active.name)] },
    hint: tx("Hibernation and winter rest are for warm-blooded animals; torpor for cold-blooded ones.", "Winterschlaf und Winterruhe gibt es bei gleichwarmen Tieren, Winterstarre bei wechselwarmen."),
    solution: animals.map((a, k) => ({ math: join(q(a.name, `a${k}`), "\\to", q(WINTER[a.w].name, `w${k}`)), note: tx(`${cap(en(a.name))}: ${en(WINTER[a.w].what)}.`, `${de(a.name)}: ${de(WINTER[a.w].what)}.`) })),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Teeth

const DIETS: Diet[] = ["herbivore", "carnivore", "omnivore"];
const DIET_SAY: Record<string, Text> = {
  "herbivore>omnivore": tx("An omnivore has teeth of every kind, including canines. Here the upper incisors and the canines are missing, and the molars are broad grinding plates.", "Ein Allesfresser hat alle Zahnarten, auch Eckzähne. Hier fehlen die oberen Schneidezähne und die Eckzähne, und die Backenzähne sind breite Mahlplatten."),
  "herbivore>carnivore": tx("A meat-eater would have long fangs. Look at the gap and the broad, flat molars.", "Ein Fleischfresser hätte lange Fangzähne. Schau auf die Lücke und die breiten, flachen Backenzähne."),
  "carnivore>omnivore": tx("The canines here are long fangs, and some cheek teeth are sharp blades (carnassials). An omnivore's teeth are blunter.", "Die Eckzähne sind hier lange Fangzähne, und einige Backenzähne sind scharfe Klingen (Reißzähne). Ein Allesfresser hat stumpfere Zähne."),
  "carnivore>herbivore": tx("Plant-eaters grind with broad, flat molars and have no fangs. Here the teeth are pointed and blade-like.", "Pflanzenfresser mahlen mit breiten, flachen Backenzähnen und haben keine Fangzähne. Hier sind die Zähne spitz und klingenartig."),
  "omnivore>carnivore": tx("The canines are hardly longer than the other teeth, and the molars have blunt cusps, no blades.", "Die Eckzähne sind kaum länger als die anderen Zähne, und die Backenzähne haben stumpfe Höcker, keine Klingen."),
  "omnivore>herbivore": tx("All kinds of teeth are there, including canines, and no gap. Plant-eaters look different.", "Alle Zahnarten sind da, auch Eckzähne, und es gibt keine Lücke. Pflanzenfresser sehen anders aus."),
};
const DIET_WHY: Record<Diet, Text> = {
  herbivore: tx("No upper incisors (horny plate), no canines, a gap, and broad molars with enamel ridges for grinding: a plant-eater.", "Keine oberen Schneidezähne (Hornplatte), keine Eckzähne, eine Lücke und breite Backenzähne mit Schmelzfalten zum Mahlen: ein Pflanzenfresser."),
  carnivore: tx("Long canines (fangs) and carnassial teeth that cut like scissors: a meat-eater.", "Lange Eckzähne (Fangzähne) und Reißzähne, die wie eine Schere schneiden: ein Fleischfresser."),
  omnivore: tx("All kinds of teeth, short canines and molars with blunt cusps: an omnivore.", "Alle Zahnarten, kurze Eckzähne und Backenzähne mit stumpfen Höckern: ein Allesfresser."),
};

function teethTask(rng: Rng): Exercise {
  const d = rng.pick(DIETS);
  const pic = rng.chance(0.6);
  const ex = rng.pick(d === "herbivore" ? [tx("cow", "Rind"), tx("horse", "Pferd"), tx("rabbit", "Kaninchen"), tx("deer", "Reh")] : d === "carnivore" ? [tx("dog", "Hund"), tx("cat", "Katze"), tx("wolf", "Wolf"), tx("lion", "Löwe")] : [tx("human", "Mensch"), tx("pig", "Schwein"), tx("brown bear", "Braunbär"), tx("hedgehog", "Igel")]);
  const opts: Opt[] = [{ text: capT(DIET_NAMES[d].name) }, ...DIETS.filter((x) => x !== d).map((x) => ({ text: capT(DIET_NAMES[x].name), title: tx("Look at the teeth", "Schau auf die Zähne"), say: DIET_SAY[`${d}>${x}`] }))];
  const { answer, mistakes: list } = choice(rng, opts);
  const desc: Record<Diet, Text> = {
    herbivore: tx("no upper incisors but a horny plate, no canines, a wide gap, broad molars with sharp enamel ridges", "keine oberen Schneidezähne, sondern eine Hornplatte, keine Eckzähne, eine große Lücke, breite Backenzähne mit scharfen Schmelzfalten"),
    carnivore: tx("small incisors, long pointed canines, cheek teeth with sharp blades that slide past each other", "kleine Schneidezähne, lange spitze Eckzähne, Backenzähne mit scharfen Klingen, die aneinander vorbeigleiten"),
    omnivore: tx("chisel-shaped incisors, short canines, cheek teeth with blunt, rounded cusps", "meißelförmige Schneidezähne, kurze Eckzähne, Backenzähne mit stumpfen, runden Höckern"),
  };
  return {
    instruction: tx("Teeth and diet", "Gebiss und Ernährung"),
    text: pic ? tx("Which kind of feeder does this set of teeth belong to?", "Zu welchem Ernährungstyp gehört dieses Gebiss?") : tx(`A mammal has: ${en(desc[d])}. What kind of feeder is it?`, `Ein Säugetier hat: ${de(desc[d])}. Welcher Ernährungstyp ist das?`),
    ...(pic ? { visual: visual(VertebrateTeeth, { diet: d, mode: "plain" }) } : {}),
    answer,
    hint: tx("Look at the canines and at the surface of the cheek teeth.", "Achte auf die Eckzähne und die Oberfläche der Backenzähne."),
    solution: [{ math: join(q(DIET_NAMES[d].name, "d"), q(tx(`(e.g. ${en(ex)})`, `(z. B. ${de(ex)})`), "e")), note: DIET_WHY[d], highlight: ["d"] }],
    mistakes: list,
  };
}

function toothTypeTask(rng: Rng): Exercise {
  const d = rng.pick(DIETS);
  const parts = TEETH_PARTS[d];
  const p = rng.pick(parts);
  const first = (x: FigurePart) => en(x.label).split(" ")[0];
  const others = rng.shuffle([...TEETH_PARTS.herbivore, ...TEETH_PARTS.carnivore, ...TEETH_PARTS.omnivore].filter((x) => x.id !== p.id && first(x) !== first(p)));
  const uniq = others.filter((x, i) => others.findIndex((y) => first(y) === first(x)) === i);
  const opts: Opt[] = [{ text: capT(p.label) }, ...uniq.slice(0, 3).map((x) => ({ text: capT(x.label), title: tx("Different tooth", "Anderer Zahn"), say: tx(`${cap(en(x.label))}: ${en(x.info!)} Is that what the marked teeth look like?`, `${de(x.label)}: ${de(x.info!)} Sehen die markierten Zähne so aus?`) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Which teeth?", "Welche Zähne?"),
    text: tx(`Teeth of a ${en(DIET_NAMES[d].animal)}. What is marked with "?"?`, `Gebiss: ${de(DIET_NAMES[d].animal)}. Was ist mit „?“ markiert?`),
    visual: visual(VertebrateTeeth, { diet: d, mode: "numbers", ask: p.id, legend: "none" }),
    answer,
    hint: tx("Front to back: incisors, canines, cheek teeth.", "Von vorne nach hinten: Schneidezähne, Eckzähne, Backenzähne."),
    solution: [{ math: q(p.label, "p"), note: tx(`${cap(en(p.label))}: ${en(p.info!)}`, `${de(p.label)}: ${de(p.info!)}`), highlight: ["p"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Skeleton: the front limb in order

const LIMB: Text[] = [tx("upper arm bone", "Oberarmknochen"), tx("ulna and radius", "Elle und Speiche"), tx("wrist bones", "Handwurzelknochen"), tx("palm bones", "Mittelhandknochen"), tx("finger bones", "Fingerknochen")];
const LEG: Text[] = [tx("thigh bone", "Oberschenkelknochen"), tx("shin and calf bone", "Schien- und Wadenbein"), tx("ankle bones", "Fußwurzelknochen"), tx("foot bones", "Mittelfußknochen"), tx("toe bones", "Zehenknochen")];

function limbOrderTask(rng: Rng): Exercise {
  const leg = rng.chance(0.4);
  const all = leg ? LEG : LIMB;
  const start = rng.int(0, 1);
  const items = all.slice(start, start + rng.int(4, 5 - start));
  return {
    instruction: tx("Put the bones in order", "Bring die Knochen in die richtige Reihenfolge"),
    text: leg ? tx("Every vertebrate hind limb has the same basic plan. Sort the bones from the hip to the toes.", "Jede Hintergliedmaße der Wirbeltiere hat denselben Grundbauplan. Sortiere die Knochen von der Hüfte bis zu den Zehen.") : tx("Every vertebrate front limb has the same basic plan. Sort the bones from the shoulder to the fingertips.", "Jede Vordergliedmaße der Wirbeltiere hat denselben Grundbauplan. Sortiere die Knochen von der Schulter bis zu den Fingerspitzen."),
    answer: { kind: "order", items },
    hint: tx("One bone, then two bones, then many small ones.", "Ein Knochen, dann zwei Knochen, dann viele kleine."),
    solution: [{ math: tx(items.map((x, k) => `"${en(x)}"#b${k}`).join(" \\to "), items.map((x, k) => `"${de(x)}"#b${k}`).join(" \\to ")), note: tx("One bone, two bones, many small bones: the basic plan of every limb.", "Ein Knochen, zwei Knochen, viele kleine Knochen: der Grundbauplan jeder Gliedmaße.") }],
    mistakes: items.length >= 4 ? [{ when: { kind: "order", items: [items[items.length - 1], items[items.length - 2]] }, title: tx("Fingers and toes last", "Finger und Zehen zuletzt"), say: tx("The many small bones of the fingers or toes are at the very end. The palm or foot bones come before them.", "Die vielen kleinen Finger- oder Zehenknochen stehen ganz am Ende. Davor kommen Mittelhand oder Mittelfuß.") }] : [],
  };
}

// ---------------------------------------------------------------------------
// The body-temperature graph

function graphTask(rng: Rng): Exercise {
  const swap = rng.chance(0.5);
  const kind = rng.int(0, 2);
  const coldLabel = swap ? "A" : "B";
  const warmLabel = swap ? "B" : "A";
  const v = visual(VertebrateTempGraph, { anon: true, swap, fixed: null });
  if (kind < 2) {
    const askCold = kind === 0;
    const animalCold = rng.pick([tx("a lizard", "einer Eidechse"), tx("a frog", "einem Frosch"), tx("a snake", "einer Schlange")]);
    const animalWarm = rng.pick([tx("a mouse", "einer Maus"), tx("a fox", "einem Fuchs"), tx("a human", "einem Menschen")]);
    const right = askCold ? coldLabel : warmLabel;
    const wrong = askCold ? warmLabel : coldLabel;
    const options: Text[] = [tx(`Curve ${right}`, `Kurve ${right}`), tx(`Curve ${wrong}`, `Kurve ${wrong}`)].sort((a, b) => en(a).localeCompare(en(b)));
    const correct = options.findIndex((o) => en(o).endsWith(right));
    return {
      instruction: tx("Read the graph", "Lies das Diagramm"),
      text: askCold
        ? tx(`The graph shows the body temperature of two animals at different outside temperatures. Which curve belongs to ${en(animalCold)}?`, `Das Diagramm zeigt die Körpertemperatur zweier Tiere bei verschiedenen Außentemperaturen. Welche Kurve gehört zu ${de(animalCold)}?`)
        : tx(`The graph shows the body temperature of two animals at different outside temperatures. Which curve belongs to ${en(animalWarm)}?`, `Das Diagramm zeigt die Körpertemperatur zweier Tiere bei verschiedenen Außentemperaturen. Welche Kurve gehört zu ${de(animalWarm)}?`),
      visual: v,
      answer: { kind: "choice", options, correct },
      hint: tx("Which curve stays the same, whatever the outside temperature?", "Welche Kurve bleibt gleich, egal wie warm es draußen ist?"),
      solution: [
        { math: tx(`"${warmLabel}:"#a \\; "constant"#c \\quad "${coldLabel}:"#b \\; "rises"#r`, `"${warmLabel}:"#a \\; "konstant"#c \\quad "${coldLabel}:"#b \\; "steigt"#r`), note: tx(`Curve ${warmLabel} stays at about 37 °C: warm-blooded. Curve ${coldLabel} rises with the outside temperature: cold-blooded.`, `Kurve ${warmLabel} bleibt bei etwa 37 °C: gleichwarm. Kurve ${coldLabel} steigt mit der Außentemperatur: wechselwarm.`) },
      ],
      mistakes: [
        {
          when: { kind: "choice", options, correct: 1 - correct },
          title: askCold ? tx("'Changing' warm", "„Wechselnd“ warm") : tx("Constant is warm-blooded", "Konstant heißt gleichwarm"),
          say: askCold
            ? tx("The flat curve stays at 37 °C even when it's freezing outside: that animal heats itself. 'Cold-blooded' (wechselwarm) means the temperature changes with the surroundings.", "Die waagerechte Kurve bleibt bei 37 °C, selbst wenn es draußen friert: Dieses Tier heizt selbst. Wechselwarm heißt, die Temperatur wechselt mit der Umgebung.")
            : tx("This curve rises and falls with the outside temperature: the animal can't heat itself. A warm-blooded animal keeps the same temperature.", "Diese Kurve steigt und fällt mit der Außentemperatur: Das Tier kann nicht selbst heizen. Ein gleichwarmes Tier hält seine Temperatur gleich."),
        },
      ],
    };
  }
  const ta = rng.pick([5, 10, 15, 20, 25, 30]);
  const askCold = rng.chance(0.6);
  const value = askCold ? ta : 37;
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.1, unit: "°C" };
  const m = mistakes(answer);
  if (askCold) m.add({ kind: "number", value: 37 }, tx("Wrong curve", "Falsche Kurve"), tx(`37 °C belongs to the flat curve. Read curve ${coldLabel} at ${ta} °C outside.`, `37 °C gehört zur waagerechten Kurve. Lies Kurve ${coldLabel} bei ${ta} °C Außentemperatur ab.`));
  else m.add({ kind: "number", value: ta }, tx("Wrong curve", "Falsche Kurve"), tx(`That's the rising curve. Curve ${warmLabel} stays flat.`, `Das ist die ansteigende Kurve. Kurve ${warmLabel} bleibt waagerecht.`));
  return {
    instruction: tx("Read the graph", "Lies das Diagramm"),
    text: tx(`Curve ${askCold ? coldLabel : warmLabel} shows one animal's body temperature. How warm is its body at an outside temperature of ${ta} °C?`, `Kurve ${askCold ? coldLabel : warmLabel} zeigt die Körpertemperatur eines Tieres. Wie warm ist sein Körper bei ${ta} °C Außentemperatur?`),
    visual: visual(VertebrateTempGraph, { anon: true, swap, fixed: ta }),
    answer,
    hint: tx(`Go up from ${ta} °C on the x-axis to curve ${askCold ? coldLabel : warmLabel}, then across to the y-axis.`, `Geh bei ${ta} °C auf der x-Achse senkrecht nach oben bis zu Kurve ${askCold ? coldLabel : warmLabel}, dann waagerecht zur y-Achse.`),
    solution: [{ math: tx(`T_{"body"} = ${value}#v "°C"`, `T_{"Körper"} = ${value}#v "°C"`), note: askCold ? tx("The rising curve: body temperature = outside temperature. A cold-blooded animal.", "Die ansteigende Kurve: Körpertemperatur = Außentemperatur. Ein wechselwarmes Tier.") : tx("The flat curve: about 37 °C at any outside temperature. A warm-blooded animal.", "Die waagerechte Kurve: etwa 37 °C bei jeder Außentemperatur. Ein gleichwarmes Tier."), highlight: ["v"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Select all: water to land

function landMultiTask(rng: Rng): Exercise {
  const rept = rng.chance(0.5);
  const yes = rept
    ? [tx("dry skin with horny scales", "trockene Haut mit Hornschuppen"), tx("eggs with a shell and egg membranes", "Eier mit Schale und Eihäuten"), tx("breathing only with lungs", "Atmung nur mit Lungen")]
    : [tx("thin, moist skin that loses water", "dünne, feuchte Haut, die Wasser verliert"), tx("spawn without a shell", "Laich ohne Schale"), tx("larvae that breathe with gills", "Larven, die mit Kiemen atmen")];
  const no = rept
    ? [
        { t: tx("moist skin for skin breathing", "feuchte Haut für die Hautatmung"), say: tx("That's an amphibian feature, and it ties them to water. Reptiles have dry skin.", "Das ist ein Amphibienmerkmal, und es bindet sie gerade ans Wasser. Reptilien haben trockene Haut.") },
        { t: tx("warm-blooded body", "gleichwarmer Körper"), say: tx("Reptiles are cold-blooded. Their independence from water comes from skin and eggs.", "Reptilien sind wechselwarm. Ihre Unabhängigkeit vom Wasser kommt von Haut und Eiern.") },
        { t: tx("larvae with gills", "Larven mit Kiemen"), say: tx("Reptiles have no larvae: young reptiles hatch on land looking like small adults.", "Reptilien haben keine Larven: Junge Reptilien schlüpfen an Land als kleine Erwachsene.") },
      ]
    : [
        { t: tx("horny scales", "Hornschuppen"), say: tx("Amphibians have bare skin without scales. Horny scales would protect them from drying out.", "Amphibien haben nackte Haut ohne Schuppen. Hornschuppen würden sie gerade vor Austrocknung schützen.") },
        { t: tx("eggs with a hard shell", "Eier mit harter Schale"), say: tx("Amphibian spawn has no shell: that's exactly why it must lie in water.", "Amphibienlaich hat keine Schale: Genau deshalb muss er im Wasser liegen.") },
        { t: tx("warm-blooded body", "gleichwarmer Körper"), say: tx("Amphibians are cold-blooded. Their tie to water comes from skin, spawn and larvae.", "Amphibien sind wechselwarm. Ihre Bindung ans Wasser kommt von Haut, Laich und Larven.") },
      ];
  const picked = rng.shuffle(no).slice(0, 2);
  const items = rng.shuffle([...yes.map((t) => ({ t, ok: true as const, say: undefined as Text | undefined })), ...picked.map((p) => ({ t: p.t, ok: false as const, say: p.say as Text | undefined }))]);
  const options = items.map((x) => capT(x.t));
  const correct = where(items, (x) => x.ok);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.ok && x.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Doesn't fit", "Passt nicht"), x.say);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: rept ? tx("Which features let **reptiles** live away from water?", "Welche Merkmale machen **Reptilien** unabhängig vom Wasser?") : tx("Which features tie **amphibians** to water?", "Welche Merkmale binden **Amphibien** ans Wasser?"),
    answer,
    hint: tx("Think about skin, eggs and young.", "Denk an Haut, Eier und Jungtiere."),
    solution: [{ math: tx(correct.map((i, k) => `"${en(options[i])}"#c${k}`).join(" \\\\ "), correct.map((i, k) => `"${de(options[i])}"#c${k}`).join(" \\\\ ")), note: rept ? tx("Horny scales (protection against evaporation) and the amniotic egg made reptiles the first vertebrates fully at home on land.", "Hornschuppen (Verdunstungsschutz) und das Amnion-Ei machten Reptilien zu den ersten Wirbeltieren, die ganz an Land leben.") : tx("Moist skin, spawn without a shell and larvae with gills: amphibians stay tied to water.", "Feuchte Haut, Laich ohne Schale und Larven mit Kiemen: Amphibien bleiben ans Wasser gebunden.") }],
    mistakes: m.list,
  };
}

function counterTask(rng: Rng): Exercise {
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("Along the whole gill the water has more oxygen than the blood next to it.", "Auf der ganzen Kieme enthält das Wasser mehr Sauerstoff als das Blut daneben.") },
    { text: tx("The water flows faster than the blood.", "Das Wasser fließt schneller als das Blut."), title: tx("It's the direction", "Es geht um die Richtung"), say: tx("Speed isn't the trick. What matters is that water and blood flow in opposite directions.", "Der Trick ist nicht die Geschwindigkeit. Entscheidend ist, dass Wasser und Blut in entgegengesetzte Richtungen fließen.") },
    { text: tx("The blood takes up oxygen only at the start of the gill.", "Das Blut nimmt nur am Anfang der Kieme Sauerstoff auf."), title: tx("All along", "Auf ganzer Länge"), say: tx("That's what happens in the same-direction model. In countercurrent, oxygen diffuses into the blood all the way along.", "So ist es beim Gleichstrom. Beim Gegenstrom diffundiert Sauerstoff auf der ganzen Länge ins Blut.") },
    { text: tx("Water and blood mix in the gills.", "Wasser und Blut vermischen sich in den Kiemen."), title: tx("They stay apart", "Sie bleiben getrennt"), say: tx("Water and blood never mix: only a very thin wall separates them, and oxygen diffuses through it.", "Wasser und Blut mischen sich nie: Nur eine sehr dünne Wand trennt sie, und Sauerstoff diffundiert hindurch.") },
  ]);
  return {
    instruction: tx("Countercurrent principle", "Gegenstromprinzip"),
    text: tx("In fish gills, water and blood flow in opposite directions. Why does the blood take up so much oxygen this way?", "In den Kiemen der Fische fließen Wasser und Blut in entgegengesetzte Richtungen. Warum nimmt das Blut so besonders viel Sauerstoff auf?"),
    answer,
    hint: tx("Diffusion only happens where there is a difference in concentration.", "Diffusion findet nur dort statt, wo ein Konzentrationsunterschied besteht."),
    solution: [
      { math: tx('"water"#w \\; "←" \\quad "blood"#b \\; "→"', '"Wasser"#w \\; "←" \\quad "Blut"#b \\; "→"'), note: tx("Blood that has already taken up a lot of oxygen meets fresh water that contains even more. So the difference never disappears.", "Blut, das schon viel Sauerstoff aufgenommen hat, trifft auf frisches Wasser, das noch mehr enthält. So verschwindet der Unterschied nie.") },
      { math: tx('"blood leaves with"#t \\; 90#v "%"', '"Blut verlässt Kieme mit"#t \\; 90#v "%"'), note: tx("Model: in countercurrent the blood leaves almost saturated; in the same direction only about half.", "Modell: Im Gegenstrom verlässt das Blut die Kieme fast gesättigt, im Gleichstrom nur etwa zur Hälfte."), highlight: ["v"] },
    ],
    mistakes: list,
  };
}

export function generate2(rng: Rng): Exercise {
  const roll = rng.int(0, 13);
  if (roll <= 2) return partTask(rng);
  if (roll === 3) return matchSFTask(rng);
  if (roll <= 5) return whyTask(rng);
  if (roll === 6) return metaOrderTask(rng);
  if (roll === 7) return metaStageTask(rng);
  if (roll === 8) return rng.chance(0.6) ? winterTask(rng) : winterMatchTask(rng);
  if (roll === 9) return rng.chance(0.6) ? teethTask(rng) : toothTypeTask(rng);
  if (roll === 10) return limbOrderTask(rng);
  if (roll === 11) return graphTask(rng);
  if (roll === 12) return landMultiTask(rng);
  return counterTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const adaptFrames: Frame[] = [
  { math: tx('"structure"#s \\Leftrightarrow "function"#f', '"Struktur"#s \\Leftrightarrow "Funktion"#f'), note: tx("Every body part is built to fit its job: **structure and function** belong together.", "Jeder Körperteil ist so gebaut, dass er zu seiner Aufgabe passt: **Struktur und Funktion** gehören zusammen.") },
  { math: tx('"water:"#a \\; "streamlined, gills, swim bladder"#b', '"Wasser:"#a \\; "Stromlinienform, Kiemen, Schwimmblase"#b'), note: tx("Fish are adapted to water: a streamlined body, gills for breathing and a swim bladder for floating.", "Fische sind an das Wasser angepasst: Stromlinienform, Kiemen zum Atmen und eine Schwimmblase zum Schweben.") },
  { math: tx('"air:"#a \\; "light build, feathers, keel"#b', '"Luft:"#a \\; "Leichtbau, Federn, Brustbeinkamm"#b'), note: tx("Birds are adapted to the air: light bones, feathers and huge flight muscles on the keel.", "Vögel sind an die Luft angepasst: leichte Knochen, Federn und riesige Flugmuskeln am Brustbeinkamm.") },
  { math: tx('"land:"#a \\; "horny scales, egg with shell"#b', '"Land:"#a \\; "Hornschuppen, Ei mit Schale"#b'), note: tx("Reptiles are adapted to dry land: horny scales stop water loss, and the egg has a shell.", "Reptilien sind an trockenes Land angepasst: Hornschuppen verhindern Wasserverlust, und das Ei hat eine Schale.") },
  {
    math: tx('"generations"#g \\to "adaptedness"#f', '"Generationen"#g \\to "Angepasstheit"#f'),
    note: tx("Adaptedness (Angepasstheit) didn't come about because an animal tried hard. It arose over many generations through evolution.", "Die Angepasstheit entstand nicht, weil sich ein Tier angestrengt hat. Sie entstand über viele Generationen durch Evolution."),
  },
];

const landFrames: Frame[] = [
  { math: tx('"amphibians:"#a \\; "moist skin"#b', '"Amphibien:"#a \\; "feuchte Haut"#b'), note: tx("Adult amphibians breathe with lungs and through their moist, thin skin. But this skin also loses water quickly.", "Erwachsene Amphibien atmen mit Lungen und über ihre feuchte, dünne Haut. Diese Haut verliert aber auch schnell Wasser.") },
  { math: tx('"amphibians:"#a \\; "spawn, larvae"#b \\to "water"#w', '"Amphibien:"#a \\; "Laich, Larven"#b \\to "Wasser"#w'), note: tx("Their spawn has no shell and their larvae have gills: amphibians are tied to water to breed.", "Ihr Laich hat keine Schale und ihre Larven haben Kiemen: Zur Fortpflanzung sind Amphibien ans Wasser gebunden.") },
  { math: tx('"reptiles:"#a \\; "horny scales"#b', '"Reptilien:"#a \\; "Hornschuppen"#b'), note: tx("Reptiles have dry skin with horny scales: a **protection against evaporation**. They breathe only with lungs.", "Reptilien haben trockene Haut mit Hornschuppen: ein **Verdunstungsschutz**. Sie atmen nur mit Lungen.") },
  { math: tx('"reptiles:"#a \\; "amniotic egg"#b \\to "land"#w', '"Reptilien:"#a \\; "Amnion-Ei"#b \\to "Land"#w'), note: tx("Their egg has a shell and egg membranes. The innermost one, the **amnion**, holds the embryo in fluid like its own little pond. Reptiles no longer need water to breed.", "Ihr Ei hat eine Schale und Eihäute. Die innerste, das **Amnion**, umhüllt den Embryo mit Flüssigkeit wie ein eigener kleiner Teich. Reptilien brauchen zur Fortpflanzung kein Gewässer mehr.") },
];

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Built for their habitat", "Angepasst an den Lebensraum"),
      blob: tx("Water, air or dry land: every class has its own tricks!", "Wasser, Luft oder trockenes Land: Jede Klasse hat ihre eigenen Tricks!"),
      frames: adaptFrames,
    },
    {
      type: "widget",
      title: tx("Inside a fish", "Ein Fisch von innen"),
      blob: tx("Tap the numbers! Then switch to the gills and compare the two flow directions.", "Tipp auf die Nummern! Dann wechsle zu den Kiemen und vergleiche die beiden Strömungsrichtungen."),
      body: tx(
        "The perch is a typical bony fish. Its gills take oxygen from the water: water and blood flow in opposite directions (**countercurrent principle**). The **swim bladder** lets it float, and the **lateral line** senses every movement in the water.",
        "Der Barsch ist ein typischer Knochenfisch. Seine Kiemen holen Sauerstoff aus dem Wasser: Wasser und Blut fließen dabei gegeneinander (**Gegenstromprinzip**). Die **Schwimmblase** lässt ihn schweben, und das **Seitenlinienorgan** spürt jede Bewegung im Wasser.",
      ),
      widget: VertebrateFishWidget,
    },
    { type: "check", blob: tx("Why doesn't the perch sink?", "Warum sinkt der Barsch nicht ab?"), exercise: whyTask(createRng(4), 0) },
    {
      type: "widget",
      title: tx("Built to fly", "Gebaut zum Fliegen"),
      blob: tx("Light as a feather, strong as a framework. Have a look!", "Leicht wie eine Feder, stabil wie ein Fachwerk. Schau es dir an!"),
      body: tx(
        "Birds save weight everywhere: **hollow bones**, a beak of horn without teeth, fused bones. The flight muscles are attached to the **keel** of the breastbone. Air sacs supply the lungs with fresh air all the time. Contour feathers form closed surfaces; **down feathers** keep the bird warm.",
        "Vögel sparen überall Gewicht: **Röhrenknochen**, ein Hornschnabel ohne Zähne, verwachsene Knochen. Die Flugmuskeln setzen am **Brustbeinkamm** an. Luftsäcke versorgen die Lunge ständig mit Frischluft. Konturfedern bilden geschlossene Flächen, **Daunenfedern** halten warm.",
      ),
      widget: VertebrateBirdWidget,
    },
    { type: "check", blob: tx("Match each structure with its job.", "Ordne jeder Struktur ihre Aufgabe zu."), exercise: matchSFTask(createRng(7)) },
    {
      type: "explain",
      title: tx("From water to land", "Vom Wasser an Land"),
      blob: tx("Amphibians live a double life. Reptiles made the full move to land!", "Amphibien führen ein Doppelleben. Reptilien haben den ganzen Schritt an Land geschafft!"),
      frames: landFrames,
    },
    {
      type: "widget",
      title: tx("From spawn to frog", "Vom Laich zum Frosch"),
      blob: tx("Drag through the weeks. Watch the gills, the legs and the tail!", "Zieh durch die Wochen. Achte auf Kiemen, Beine und Schwanz!"),
      body: tx(
        "The transformation of the larva into the adult animal is called **metamorphosis**. The tadpole swaps gills for lungs, plant food for insects, and its tail for legs.",
        "Die Umwandlung der Larve zum erwachsenen Tier heißt **Metamorphose**. Die Kaulquappe tauscht Kiemen gegen Lungen, Pflanzenkost gegen Insekten und den Schwanz gegen Beine.",
      ),
      widget: VertebrateMetamorphosis,
    },
    { type: "check", blob: tx("Now you put the stages in order.", "Jetzt bringst du die Stadien in die richtige Reihenfolge."), exercise: metaOrderTask(createRng(12)) },
    {
      type: "widget",
      title: tx("One plan for all, teeth for every diet", "Ein Bauplan für alle, Zähne für jede Kost"),
      blob: tx("Dog, bird, frog or you: the skeleton follows the same plan!", "Hund, Vogel, Frosch oder du: Das Skelett folgt demselben Plan!"),
      body: tx(
        "Every vertebrate skeleton has a **skull**, a **backbone**, a **shoulder girdle** and a **pelvic girdle** with front and hind limbs. Mammals' teeth show what they eat: plant-eaters grind, meat-eaters cut, omnivores do a bit of both.",
        "Jedes Wirbeltierskelett hat einen **Schädel**, eine **Wirbelsäule**, einen **Schultergürtel** und einen **Beckengürtel** mit Vorder- und Hintergliedmaßen. Am Gebiss der Säugetiere erkennt man ihre Nahrung: Pflanzenfresser mahlen, Fleischfresser schneiden, Allesfresser können beides ein bisschen.",
      ),
      widget: VertebrateMammalWidget,
    },
    {
      type: "widget",
      title: tx("Getting through the winter", "Durch den Winter kommen"),
      blob: tx("Switch on the hedgehog and lower the temperature!", "Schalte den Igel ein und dreh die Temperatur runter!"),
      body: tx(
        "Warm-blooded animals need a lot of food in winter, cold-blooded ones get stiff. Four strategies:\n\n**Hibernation** (hedgehog, bat, marmot): body temperature lowered to a few degrees, lives off fat. **Winter rest** (squirrel, badger, brown bear): only slightly cooler, wakes often to eat. **Cold torpor** (frog, lizard, snake): cold-blooded, cools down with the surroundings and can't wake up actively. **Migration** (stork, swallow): flies south.",
        "Gleichwarme Tiere brauchen im Winter viel Nahrung, wechselwarme werden starr. Vier Strategien:\n\n**Winterschlaf** (Igel, Fledermaus, Murmeltier): Körpertemperatur auf wenige Grad gesenkt, lebt vom Fett. **Winterruhe** (Eichhörnchen, Dachs, Braunbär): nur wenig abgekühlt, wacht oft zum Fressen auf. **Winterstarre** (Frosch, Eidechse, Schlange): wechselwarm, kühlt mit der Umgebung ab und kann nicht aktiv aufwachen. **Vogelzug** (Storch, Schwalbe): fliegt in den Süden.",
      ),
      widget: VertebrateTempWidget,
    },
    { type: "check", blob: tx("Who sleeps, who rests, who freezes, who flies?", "Wer schläft, wer ruht, wer erstarrt, wer fliegt?"), exercise: winterMatchTask(createRng(3)) },
  ],
  summary: [
    {
      title: tx("Fish: adapted to water", "Fische: angepasst ans Wasser"),
      body: tx(
        "Streamlined body, scales with slime (less friction), **gills** with the **countercurrent principle** (water and blood flow in opposite directions, so oxygen diffuses all along), **swim bladder** (buoyancy), **lateral line** (senses currents and pressure waves).",
        "Stromlinienform, Schuppen mit Schleim (weniger Reibung), **Kiemen** mit **Gegenstromprinzip** (Wasser und Blut fließen gegeneinander, Sauerstoff diffundiert auf ganzer Länge), **Schwimmblase** (Auftrieb), **Seitenlinienorgan** (spürt Strömungen und Druckwellen).",
      ),
      tone: "rule",
    },
    {
      title: tx("Birds: lightweight construction", "Vögel: Leichtbau"),
      body: tx(
        "Hollow bones with struts, beak of horn without teeth, fused bones, **keel** for the flight muscles, wishbone, **air sacs** (fresh air through the lungs). Contour feathers: shaft, vane, barbs, hooked and curved barbules. Down feathers insulate.",
        "Röhrenknochen mit Verstrebungen, Hornschnabel ohne Zähne, verwachsene Knochen, **Brustbeinkamm** für die Flugmuskeln, Gabelbein, **Luftsäcke** (Frischluft für die Lunge). Konturfeder: Schaft, Fahne, Äste, Haken- und Bogenstrahlen. Daunenfedern dämmen.",
      ),
      tone: "rule",
    },
    {
      title: tx("Amphibians and reptiles", "Amphibien und Reptilien"),
      body: tx(
        "Amphibians: moist skin (skin breathing, but water loss), spawn without shell, larvae with gills, **metamorphosis**: tied to water. Reptiles: horny scales (protection against evaporation), **amniotic egg** with shell: independent of water.",
        "Amphibien: feuchte Haut (Hautatmung, aber Wasserverlust), Laich ohne Schale, Larven mit Kiemen, **Metamorphose**: ans Wasser gebunden. Reptilien: Hornschuppen (Verdunstungsschutz), **Amnion-Ei** mit Schale: unabhängig vom Wasser.",
      ),
      examples: [tx('"spawn" \\to "external gills" \\to "hind legs" \\to "front legs" \\to "frog"', '"Laich" \\to "Außenkiemen" \\to "Hinterbeine" \\to "Vorderbeine" \\to "Frosch"')],
      tone: "rule",
    },
    {
      title: tx("Skeleton and teeth", "Skelett und Gebiss"),
      body: tx(
        "Basic plan: skull, backbone, ribs, shoulder girdle, pelvic girdle, front and hind limbs. Teeth: plant-eaters have broad grinding molars and a gap, meat-eaters fangs and carnassials, omnivores all kinds with blunt cusps.",
        "Grundbauplan: Schädel, Wirbelsäule, Rippen, Schultergürtel, Beckengürtel, Vorder- und Hintergliedmaßen. Gebiss: Pflanzenfresser mit breiten Mahlzähnen und Lücke, Fleischfresser mit Fang- und Reißzähnen, Allesfresser mit allen Zahnarten und stumpfen Höckern.",
      ),
      examples: [tx('"upper arm" \\to "ulna, radius" \\to "wrist" \\to "palm" \\to "fingers"', '"Oberarm" \\to "Elle, Speiche" \\to "Handwurzel" \\to "Mittelhand" \\to "Finger"')],
      tone: "tip",
    },
    {
      title: tx("Winter and body temperature", "Winter und Körpertemperatur"),
      body: tx(
        "Warm-blooded: body temperature constant (horizontal line in the graph). Cold-blooded: follows the surroundings (rising line). **Hibernation** (hedgehog), **winter rest** (squirrel), **cold torpor** (frog, lizard), **migration** (stork).",
        "Gleichwarm: Körpertemperatur konstant (waagerechte Linie im Diagramm). Wechselwarm: folgt der Umgebung (ansteigende Linie). **Winterschlaf** (Igel), **Winterruhe** (Eichhörnchen), **Winterstarre** (Frosch, Eidechse), **Vogelzug** (Storch).",
      ),
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Squirrels and bears don't hibernate, they have a winter rest. Frogs don't hibernate either: they fall into cold torpor. The swim bladder is not a lung. Hind legs before front legs!",
        "Eichhörnchen und Bären halten keinen Winterschlaf, sondern Winterruhe. Frösche halten auch keinen Winterschlaf: Sie fallen in Winterstarre. Die Schwimmblase ist keine Lunge. Hinterbeine vor Vorderbeinen!",
      ),
      tone: "warning",
    },
  ],
};
