"use client";

// Level 3 (Oberstufe): absorption mechanisms (secondary active Na⁺ symport, carriers, the
// Na⁺/K⁺ pump, chylomicrons into the lymph), the gut microbiome, hormones of digestion
// (gastrin, secretin, CCK), blood sugar as a control loop (insulin, glucagon), diabetes
// type 1 and 2, energy balance and BMI.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { dec } from "@/learn/chemistry/format";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson } from "@/learn/types";
import { DigestionBloodSugar, DigestionGlucoseGraph } from "@/learn/biology/visuals/DigestionBloodSugar";
import { BMI_CLASSES, DigestionBmi, bmiClass } from "@/learn/biology/visuals/DigestionBmi";
import { DigestionTransport, TRANSPORT_PARTS, TransportCell, type TransportPart } from "@/learn/biology/visuals/DigestionTransport";
import { Figure } from "@/learn/biology/Figure";
import { choice, fixedChoice, matchTask, mistakes, multi, num, orderTask, pickN, quote, weighted, type Opt, type Stmt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

type Q = { q: Text; opts: Opt[]; hint: Text; note: Text };

function questionTask(rng: Rng, bank: Q[], instruction: Text): Exercise {
  const qq = rng.pick(bank);
  const c = choice(rng, qq.opts);
  return { instruction, text: qq.q, answer: c.answer, hint: qq.hint, solution: [{ math: quote(qq.opts[0].text), note: qq.note }], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Absorption mechanisms

const TRANSPORT_QS: Q[] = [
  {
    q: tx("Why is glucose uptake by SGLT1 called secondary active transport?", "Warum bezeichnet man die Glucoseaufnahme über SGLT1 als sekundär aktiven Transport?"),
    opts: [
      { text: tx("It uses the Na⁺ gradient that the Na⁺/K⁺ pump builds up with ATP.", "Sie nutzt das Na⁺-Gefälle, das die Na⁺/K⁺-Pumpe unter ATP-Verbrauch aufbaut.") },
      { text: tx("SGLT1 splits ATP itself.", "SGLT1 spaltet selbst ATP."), title: tx("That would be primary", "Das wäre primär aktiv"), say: tx("A transporter that splits ATP itself works **primary** active, like the Na⁺/K⁺ pump. SGLT1 uses the Na⁺ gradient instead.", "Ein Transporter, der selbst ATP spaltet, arbeitet **primär** aktiv, wie die Na⁺/K⁺-Pumpe. SGLT1 nutzt stattdessen das Na⁺-Gefälle.") },
      { text: tx("Glucose simply diffuses down its gradient.", "Glucose diffundiert einfach mit ihrem Gefälle."), title: tx("That would be passive", "Das wäre passiv"), say: tx("Diffusion down a gradient is passive. SGLT1 can even move glucose **against** its gradient.", "Diffusion mit dem Gefälle ist passiv. SGLT1 kann Glucose sogar **gegen** ihr Gefälle transportieren.") },
      { text: tx("Glucose crosses two membranes, in and out.", "Glucose passiert zwei Membranen, hinein und hinaus."), title: tx("It's about the energy", "Es geht um die Energie"), say: tx("\"Secondary\" refers to the energy source: an ion gradient built by a pump, not the number of membranes.", "„Sekundär“ bezieht sich auf die Energiequelle: ein Ionengefälle, das eine Pumpe aufbaut, nicht auf die Zahl der Membranen.") },
    ],
    hint: tx("Where does the energy for the transport come from?", "Woher stammt die Energie für den Transport?"),
    note: tx("**Secondary active**: SGLT1 couples the downhill flow of Na⁺ to the uphill transport of glucose (symport). The Na⁺ gradient is kept up by the Na⁺/K⁺-ATPase.", "**Sekundär aktiv**: SGLT1 koppelt den Na⁺-Einstrom mit dem Gefälle an den Glucosetransport gegen das Gefälle (Symport). Das Na⁺-Gefälle hält die Na⁺/K⁺-ATPase aufrecht."),
  },
  {
    q: tx("The Na⁺/K⁺ pump of the gut cells is blocked by a poison. What happens to glucose uptake?", "Die Na⁺/K⁺-Pumpe der Darmzellen wird durch ein Gift blockiert. Was passiert mit der Glucoseaufnahme?"),
    opts: [
      { text: tx("It falls: the Na⁺ gradient breaks down, SGLT1 loses its drive.", "Sie sinkt: Das Na⁺-Gefälle bricht zusammen, SGLT1 verliert seinen Antrieb.") },
      { text: tx("Nothing, because SGLT1 doesn't need ATP.", "Nichts, weil SGLT1 kein ATP braucht."), title: tx("Indirectly it does", "Indirekt schon"), say: tx("SGLT1 doesn't split ATP itself, but it depends on the Na⁺ gradient, and only the pump keeps that up.", "SGLT1 spaltet zwar kein ATP, ist aber auf das Na⁺-Gefälle angewiesen, und das hält nur die Pumpe aufrecht.") },
      { text: tx("It rises, because more Na⁺ stays in the cell.", "Sie steigt, weil mehr Na⁺ in der Zelle bleibt."), title: tx("Gradient goes the wrong way", "Das Gefälle schwindet"), say: tx("More Na⁺ inside means a **smaller** gradient, so less drive for the symport.", "Mehr Na⁺ in der Zelle heißt **kleineres** Gefälle, also weniger Antrieb für den Symport.") },
      { text: tx("Glucose is now taken up by GLUT2 from the gut instead.", "Glucose wird jetzt stattdessen über GLUT2 aus dem Darm aufgenommen."), title: tx("GLUT2 is on the other side", "GLUT2 sitzt auf der anderen Seite"), say: tx("GLUT2 sits mainly in the basolateral membrane and only works with the gradient.", "GLUT2 sitzt vor allem in der basolateralen Membran und arbeitet nur mit dem Gefälle.") },
    ],
    hint: tx("What keeps the Na⁺ concentration in the cell low?", "Was hält die Na⁺-Konzentration in der Zelle niedrig?"),
    note: tx("Without the pump Na⁺ accumulates in the cell, the gradient disappears and the secondary active glucose uptake stops.", "Ohne Pumpe sammelt sich Na⁺ in der Zelle, das Gefälle verschwindet und die sekundär aktive Glucoseaufnahme kommt zum Erliegen."),
  },
  {
    q: tx("Oral rehydration solution for diarrhoea contains salt and glucose. Why the glucose?", "Eine Trinklösung gegen Durchfall enthält Salz und Glucose. Wozu die Glucose?"),
    opts: [
      { text: tx("SGLT1 takes up Na⁺ together with glucose, and water follows by osmosis.", "SGLT1 nimmt Na⁺ zusammen mit Glucose auf, und Wasser folgt osmotisch.") },
      { text: tx("Only for the taste.", "Nur für den Geschmack."), title: tx("It has a real job", "Sie hat eine echte Aufgabe"), say: tx("The glucose has a job: it drives the uptake of Na⁺ via SGLT1, and water follows.", "Die Glucose hat eine Aufgabe: Sie treibt die Na⁺-Aufnahme über SGLT1 an, und Wasser folgt.") },
      { text: tx("Glucose kills the bacteria.", "Glucose tötet die Bakterien."), title: tx("No antibiotic", "Kein Antibiotikum"), say: tx("Glucose kills nothing. It helps the gut take up salt and water.", "Glucose tötet nichts ab. Sie hilft dem Darm, Salz und Wasser aufzunehmen.") },
      { text: tx("Glucose binds water in the gut and holds it there.", "Glucose bindet Wasser im Darm und hält es dort fest."), title: tx("The other way round", "Andersherum"), say: tx("Glucose that is **absorbed** pulls water **out** of the gut into the body, together with Na⁺.", "Glucose, die **resorbiert** wird, zieht zusammen mit Na⁺ Wasser **aus** dem Darm in den Körper.") },
    ],
    hint: tx("Which transporter takes up sodium and glucose together?", "Welcher Transporter nimmt Natrium und Glucose gemeinsam auf?"),
    note: tx("Na⁺-glucose symport: every glucose brings Na⁺ into the cells, and water follows by osmosis. That's why oral rehydration solution works.", "Na⁺-Glucose-Symport: Jede Glucose bringt Na⁺ in die Zellen, und Wasser folgt osmotisch. Darum wirkt die Trinklösung."),
  },
  {
    q: tx("Why do the fat building blocks reach the lymph and not the blood capillaries?", "Warum gelangen die Fettbausteine in die Lymphe und nicht in die Blutkapillaren?"),
    opts: [
      { text: tx("They are packed into chylomicrons, too big for the capillary wall.", "Sie werden zu Chylomikronen verpackt, die für die Kapillarwand zu groß sind.") },
      { text: tx("Fatty acids are not soluble in fat.", "Fettsäuren sind nicht fettlöslich."), title: tx("They are fat-soluble", "Sie sind fettlöslich"), say: tx("Fatty acids are fat-soluble: that's why they diffuse through the membrane. The reason is the size of the chylomicrons.", "Fettsäuren sind fettlöslich: Darum diffundieren sie durch die Membran. Der Grund ist die Größe der Chylomikronen.") },
      { text: tx("Lymph contains lipase that finishes digestion.", "Die Lymphe enthält Lipase, die die Verdauung beendet."), title: tx("Digestion is over", "Die Verdauung ist vorbei"), say: tx("The fat has already been rebuilt into triglycerides in the cell. It's about transport, not digestion.", "Das Fett wurde in der Zelle schon wieder zu Triglyceriden aufgebaut. Es geht um Transport, nicht um Verdauung.") },
      { text: tx("Because the liver mustn't get any fat.", "Weil die Leber kein Fett bekommen darf."), title: tx("Not the reason", "Nicht der Grund"), say: tx("The liver does get fat later. The point is the size of the chylomicrons.", "Die Leber bekommt später durchaus Fett. Entscheidend ist die Größe der Chylomikronen.") },
    ],
    hint: tx("What happens to fatty acids inside the gut cell?", "Was passiert mit den Fettsäuren in der Darmzelle?"),
    note: tx("In the cell they become triglycerides, packed with proteins into **chylomicrons**. They leave by exocytosis into the lymph vessel.", "In der Zelle werden sie zu Triglyceriden und mit Proteinen zu **Chylomikronen** verpackt. Sie gelangen per Exocytose ins Lymphgefäß."),
  },
  {
    q: tx("How many Na⁺ and K⁺ does the Na⁺/K⁺-ATPase move per ATP?", "Wie viele Na⁺ und K⁺ transportiert die Na⁺/K⁺-ATPase pro ATP?"),
    opts: [
      { text: tx("3 Na⁺ out, 2 K⁺ in", "3 Na⁺ hinaus, 2 K⁺ hinein") },
      { text: tx("2 Na⁺ out, 3 K⁺ in", "2 Na⁺ hinaus, 3 K⁺ hinein"), title: tx("Numbers swapped", "Zahlen vertauscht"), say: tx("Nearly! It's the other way round: 3 Na⁺ out, 2 K⁺ in.", "Fast! Andersherum: 3 Na⁺ hinaus, 2 K⁺ hinein.") },
      { text: tx("3 Na⁺ in, 2 K⁺ out", "3 Na⁺ hinein, 2 K⁺ hinaus"), title: tx("Directions swapped", "Richtung vertauscht"), say: tx("The pump keeps Na⁺ low inside, so Na⁺ goes **out**.", "Die Pumpe hält Na⁺ innen niedrig, also geht Na⁺ **hinaus**.") },
      { text: tx("1 Na⁺ out, 1 K⁺ in", "1 Na⁺ hinaus, 1 K⁺ hinein"), title: tx("Not 1 : 1", "Nicht 1 : 1"), say: tx("The pump is electrogenic: 3 positive charges out, only 2 in.", "Die Pumpe ist elektrogen: 3 positive Ladungen hinaus, nur 2 hinein.") },
    ],
    hint: tx("It is electrogenic: more positive charge goes out than in.", "Sie ist elektrogen: Es geht mehr positive Ladung hinaus als hinein."),
    note: tx("**3 Na⁺ out, 2 K⁺ in** per ATP: primary active transport.", "**3 Na⁺ hinaus, 2 K⁺ hinein** pro ATP: primär aktiver Transport."),
  },
  {
    q: tx("Where does the blood go first after it has taken up glucose in the small intestine?", "Wohin fließt das Blut zuerst, nachdem es im Dünndarm Glucose aufgenommen hat?"),
    opts: [
      { text: tx("via the portal vein to the liver", "über die Pfortader zur Leber") },
      { text: tx("straight to the heart", "direkt zum Herzen"), title: tx("The liver comes first", "Erst kommt die Leber"), say: tx("Blood from the gut first passes the liver via the portal vein. The liver can store glucose as glycogen.", "Das Blut aus dem Darm passiert über die Pfortader zuerst die Leber. Sie kann Glucose als Glykogen speichern.") },
      { text: tx("into the lymph vessel", "in das Lymphgefäß"), title: tx("That's for fats", "Das ist für Fette"), say: tx("The lymph takes the chylomicrons. Glucose goes with the blood.", "Die Lymphe nimmt die Chylomikronen auf. Glucose reist mit dem Blut.") },
      { text: tx("to the kidneys to be excreted", "zu den Nieren zur Ausscheidung"), title: tx("Glucose is kept", "Glucose wird behalten"), say: tx("Healthy kidneys keep all glucose. First stop is the liver.", "Gesunde Nieren behalten die gesamte Glucose. Erste Station ist die Leber.") },
    ],
    hint: tx("A special vein connects gut and liver.", "Eine besondere Vene verbindet Darm und Leber."),
    note: tx("**Portal vein** → liver: it buffers the blood sugar by storing glucose as glycogen.", "**Pfortader** → Leber: Sie puffert den Blutzucker, indem sie Glucose als Glykogen speichert."),
  },
];

const MICROBIOME_QS: Q[] = [
  {
    q: tx("Which is a job of the gut bacteria (microbiome) in the large intestine?", "Welche Aufgabe haben die Darmbakterien (Mikrobiom) im Dickdarm?"),
    opts: [
      { text: tx("They break down dietary fibre into short-chain fatty acids.", "Sie bauen Ballaststoffe zu kurzkettigen Fettsäuren ab.") },
      { text: tx("They produce bile.", "Sie bilden Galle."), title: tx("That's the liver", "Das ist die Leber"), say: tx("Bile is made by the liver. Gut bacteria ferment fibre.", "Galle bildet die Leber. Darmbakterien vergären Ballaststoffe.") },
      { text: tx("They absorb glucose into the blood.", "Sie resorbieren Glucose ins Blut."), title: tx("That's the gut cells", "Das machen die Darmzellen"), say: tx("Absorption is done by our own cells of the small intestine.", "Die Resorption übernehmen unsere eigenen Zellen im Dünndarm.") },
      { text: tx("They make the stomach acid.", "Sie bilden die Magensäure."), title: tx("That's the stomach", "Das ist der Magen"), say: tx("Stomach acid comes from the parietal cells of the stomach wall.", "Die Magensäure stammt von den Belegzellen der Magenwand.") },
    ],
    hint: tx("They live on what we can't digest ourselves.", "Sie leben von dem, was wir selbst nicht verdauen können."),
    note: tx("Gut bacteria ferment **dietary fibre** into short-chain fatty acids (food for the gut cells), produce vitamin K, crowd out pathogens and train the immune system.", "Darmbakterien vergären **Ballaststoffe** zu kurzkettigen Fettsäuren (Nahrung für die Darmzellen), bilden Vitamin K, verdrängen Krankheitserreger und trainieren das Immunsystem."),
  },
  {
    q: tx("Why can a long course of antibiotics cause diarrhoea?", "Warum kann eine längere Antibiotika-Behandlung Durchfall auslösen?"),
    opts: [
      { text: tx("It also kills useful gut bacteria and upsets the gut flora.", "Sie tötet auch nützliche Darmbakterien und bringt die Darmflora durcheinander.") },
      { text: tx("Antibiotics destroy the villi.", "Antibiotika zerstören die Darmzotten."), title: tx("They target bacteria", "Sie treffen Bakterien"), say: tx("Antibiotics act on bacteria, not on our own cells.", "Antibiotika wirken auf Bakterien, nicht auf unsere eigenen Zellen.") },
      { text: tx("Antibiotics block the Na⁺/K⁺ pump.", "Antibiotika blockieren die Na⁺/K⁺-Pumpe."), title: tx("They target bacteria", "Sie treffen Bakterien"), say: tx("Antibiotics act on structures of bacteria, not on our pumps.", "Antibiotika wirken auf Strukturen von Bakterien, nicht auf unsere Pumpen.") },
      { text: tx("Antibiotics are a kind of fibre.", "Antibiotika sind eine Art Ballaststoff."), title: tx("No", "Nein"), say: tx("Antibiotics are drugs against bacteria, and they hit the helpful ones too.", "Antibiotika sind Medikamente gegen Bakterien, und sie treffen auch die nützlichen.") },
    ],
    hint: tx("Antibiotics can't tell good from bad bacteria.", "Antibiotika unterscheiden nicht zwischen guten und schlechten Bakterien."),
    note: tx("Antibiotics also hit the **gut flora**. Without it the balance in the large intestine is lost and harmful germs can spread.", "Antibiotika treffen auch die **Darmflora**. Ohne sie gerät das Gleichgewicht im Dickdarm durcheinander, und schädliche Keime können sich ausbreiten."),
  },
];

const POSITIONS: Exclude<TransportPart, "junction">[] = ["sglt", "glut", "pump", "aa", "er", "lymph", "microvilli"];

function transportPartTask(rng: Rng): Exercise {
  const id = rng.pick(POSITIONS);
  const part = TRANSPORT_PARTS.find((p) => p.id === id)!;
  const others = pickN(rng, POSITIONS.filter((x) => x !== id), 3);
  const c = choice(rng, [
    { text: part.label },
    ...others.map((o) => {
      const op = TRANSPORT_PARTS.find((p) => p.id === o)!;
      return { text: op.label, title: tx("Check the position", "Prüf die Lage"), say: tx(`That one ${en(op.info!).replace(/^./, (x) => x.toLowerCase())} Look where the marked one sits: apical (gut side) or basolateral (blood side)?`, `Der hier: ${de(op.info!)} Schau, wo die markierte Struktur sitzt: apikal (Darmseite) oder basolateral (Blutseite)?`) };
    }),
  ]);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("Which structure of the gut cell is marked with **?**", "Welche Struktur der Darmzelle ist mit **?** markiert?"),
    visual: { component: TransportFigure as never, props: { ask: id } },
    answer: c.answer,
    hint: tx("Top = gut side (apical), bottom = blood side (basolateral). Symporters take things in, carriers and the pump sit at the bottom.", "Oben = Darmseite (apikal), unten = Blutseite (basolateral). Symporter nehmen auf, Carrier und Pumpe sitzen unten."),
    solution: [{ math: quote(part.label), note: part.info! }],
    mistakes: c.mistakes,
  };
}

/** The transport cell as a still picture for tasks. */
function TransportFigure({ ask }: { ask: TransportPart }) {
  return (
    <Figure title={tx("A cell of the gut lining", "Eine Zelle der Darmschleimhaut")} width={560} height={366} parts={TRANSPORT_PARTS} mode="numbers" ask={ask} show={[ask]} legend="none">
      <TransportCell />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Hormones of digestion

type Hormone = "gastrin" | "secretin" | "cck";
const HORMONE: Record<Hormone, { name: Text; source: Text; trigger: Text; effect: Text }> = {
  gastrin: {
    name: tx("gastrin", "Gastrin"),
    source: tx("G cells of the stomach lining", "G-Zellen der Magenschleimhaut"),
    trigger: tx("protein building blocks and stretching of the stomach", "Eiweißbausteine und Dehnung des Magens"),
    effect: tx("more hydrochloric acid and pepsinogen in the stomach", "mehr Salzsäure und Pepsinogen im Magen"),
  },
  secretin: {
    name: tx("secretin", "Sekretin"),
    source: tx("S cells of the duodenum", "S-Zellen des Zwölffingerdarms"),
    trigger: tx("acidic chyme in the duodenum", "saurer Speisebrei im Zwölffingerdarm"),
    effect: tx("pancreatic juice rich in hydrogen carbonate", "hydrogencarbonatreicher Bauchspeichel"),
  },
  cck: {
    name: tx("cholecystokinin (CCK)", "Cholecystokinin (CCK)"),
    source: tx("I cells of the duodenum", "I-Zellen des Zwölffingerdarms"),
    trigger: tx("fatty acids and amino acids in the duodenum", "Fettsäuren und Aminosäuren im Zwölffingerdarm"),
    effect: tx("the gall bladder contracts, enzyme-rich pancreatic juice", "Gallenblase zieht sich zusammen, enzymreicher Bauchspeichel"),
  },
};

type Dim = "source" | "trigger" | "effect";
const DIM: Record<Dim, { instruction: Text; text: Text }> = {
  source: { instruction: tx("Hormone and where it's made", "Hormon und Bildungsort"), text: tx("Where is each hormone made?", "Wo wird welches Hormon gebildet?") },
  trigger: { instruction: tx("Hormone and its trigger", "Hormon und Auslöser"), text: tx("What triggers the release of each hormone?", "Was löst die Ausschüttung des Hormons aus?") },
  effect: { instruction: tx("Hormone and its effect", "Hormon und Wirkung"), text: tx("What is the main effect of each hormone?", "Was ist die Hauptwirkung des Hormons?") },
};

function hormoneMatchExercise(dim: Dim, withSugar: boolean): Exercise {
  const ids: Hormone[] = ["gastrin", "secretin", "cck"];
  const pairs: [Text, Text][] = ids.map((h) => [HORMONE[h].name, HORMONE[h][dim]]);
  const insulin = tx("insulin", "Insulin");
  if (withSugar && dim === "effect") pairs.push([insulin, tx("cells take up glucose, blood sugar falls", "Zellen nehmen Glucose auf, Blutzucker sinkt")]);
  if (withSugar && dim === "source") pairs.push([insulin, tx("β cells of the islets of Langerhans", "β-Zellen der Langerhans-Inseln")]);
  const distract: Record<Dim, Text> = {
    source: tx("parietal cells of the stomach", "Belegzellen des Magens"),
    trigger: tx("a drop in blood sugar", "ein Absinken des Blutzuckers"),
    effect: tx("splits fats into fatty acids", "spaltet Fette in Fettsäuren"),
  };
  return matchTask({
    instruction: DIM[dim].instruction,
    text: DIM[dim].text,
    pairs,
    distractors: [distract[dim]],
    hint: tx("Gastrin acts on the stomach. Secretin answers acid, CCK answers fat and protein building blocks in the duodenum.", "Gastrin wirkt auf den Magen. Sekretin antwortet auf Säure, CCK auf Fett- und Eiweißbausteine im Zwölffingerdarm."),
    solution: ids.map((h) => ({ math: quote(HORMONE[h].name), note: tx(`${en(HORMONE[h].source)}; trigger: ${en(HORMONE[h].trigger)}; effect: ${en(HORMONE[h].effect)}.`, `${de(HORMONE[h].source)}; Auslöser: ${de(HORMONE[h].trigger)}; Wirkung: ${de(HORMONE[h].effect)}.`) })),
    wrong: [
      { pairs: [[HORMONE.secretin.name, HORMONE.cck[dim]]], title: tx("Secretin and CCK swapped", "Sekretin und CCK vertauscht"), say: tx("Both come from the duodenum, but secretin answers **acid** (hydrogen carbonate against it), CCK answers **fat** (bile, enzymes).", "Beide kommen aus dem Zwölffingerdarm, aber Sekretin antwortet auf **Säure** (Hydrogencarbonat dagegen), CCK auf **Fett** (Galle, Enzyme).") },
      { pairs: [[HORMONE.gastrin.name, HORMONE.secretin[dim]]], title: tx("Gastrin stays in the stomach", "Gastrin bleibt beim Magen"), say: tx("Gastrin is the stomach's own hormone: it turns **up** acid production. Secretin does the opposite.", "Gastrin ist das Hormon des Magens: Es kurbelt die Säurebildung **an**. Sekretin bewirkt das Gegenteil.") },
    ],
  });
}

function hormoneMatchTask(rng: Rng): Exercise {
  const dim = rng.pick(["source", "trigger", "effect"] as Dim[]);
  const ex = hormoneMatchExercise(dim, rng.chance(0.5));
  if (ex.answer.kind === "match") ex.answer = { ...ex.answer, pairs: rng.shuffle(ex.answer.pairs) };
  return ex;
}

const HORMONE_QS: Q[] = [
  {
    q: tx("Acidic chyme enters the duodenum. Which hormone is released, and with what effect?", "Saurer Speisebrei gelangt in den Zwölffingerdarm. Welches Hormon wird ausgeschüttet, mit welcher Wirkung?"),
    opts: [
      { text: tx("secretin: pancreatic juice rich in hydrogen carbonate neutralises the acid", "Sekretin: hydrogencarbonatreicher Bauchspeichel neutralisiert die Säure") },
      { text: tx("gastrin: more stomach acid", "Gastrin: mehr Magensäure"), title: tx("That would make it worse", "Das würde es verschlimmern"), say: tx("More acid would be the wrong answer to acid. The duodenum releases secretin, which leads to neutralisation.", "Mehr Säure wäre die falsche Antwort auf Säure. Der Zwölffingerdarm schüttet Sekretin aus, das zur Neutralisation führt.") },
      { text: tx("insulin: the blood sugar falls", "Insulin: Der Blutzucker sinkt"), title: tx("That's blood sugar", "Das ist Blutzucker"), say: tx("Insulin controls the blood sugar, not the acidity in the gut.", "Insulin regelt den Blutzucker, nicht den Säuregrad im Darm.") },
      { text: tx("CCK: the gall bladder contracts", "CCK: Die Gallenblase zieht sich zusammen"), title: tx("CCK answers fat", "CCK reagiert auf Fett"), say: tx("CCK is released when fatty acids and amino acids arrive. Against acid the duodenum uses secretin.", "CCK wird bei Fettsäuren und Aminosäuren ausgeschüttet. Gegen Säure setzt der Zwölffingerdarm Sekretin ein.") },
    ],
    hint: tx("The pancreatic enzymes work best at about pH 8.", "Die Enzyme des Bauchspeichels arbeiten am besten bei etwa pH 8."),
    note: tx("**Secretin** → hydrogen carbonate from the pancreas → the pH rises. Negative feedback: the acid triggers its own neutralisation.", "**Sekretin** → Hydrogencarbonat aus der Bauchspeicheldrüse → der pH-Wert steigt. Negative Rückkopplung: Die Säure löst ihre eigene Neutralisation aus."),
  },
  {
    q: tx("A tumour constantly releases gastrin. What do you expect?", "Ein Tumor schüttet ständig Gastrin aus. Was erwartest du?"),
    opts: [
      { text: tx("far too much stomach acid, with ulcers in stomach and duodenum", "viel zu viel Magensäure, mit Geschwüren in Magen und Zwölffingerdarm") },
      { text: tx("too little stomach acid", "zu wenig Magensäure"), title: tx("Gastrin raises acid", "Gastrin steigert die Säure"), say: tx("Gastrin **stimulates** acid production. Too much gastrin means too much acid.", "Gastrin **fördert** die Säurebildung. Zu viel Gastrin heißt zu viel Säure.") },
      { text: tx("a very low blood sugar", "einen sehr niedrigen Blutzucker"), title: tx("Wrong hormone system", "Falsches Hormonsystem"), say: tx("Blood sugar is controlled by insulin and glucagon. Gastrin acts on the stomach.", "Den Blutzucker regeln Insulin und Glucagon. Gastrin wirkt auf den Magen.") },
      { text: tx("no bile in the gut", "keine Galle im Darm"), title: tx("That's CCK", "Das ist CCK"), say: tx("Bile release is triggered by CCK. Gastrin acts on the stomach.", "Die Gallenabgabe löst CCK aus. Gastrin wirkt auf den Magen.") },
    ],
    hint: tx("What does gastrin normally do?", "Was macht Gastrin normalerweise?"),
    note: tx("Gastrin stimulates the **parietal cells** to make hydrochloric acid. Too much of it: acid surplus and ulcers (Zollinger-Ellison syndrome).", "Gastrin regt die **Belegzellen** zur Salzsäurebildung an. Zu viel davon: Säureüberschuss und Geschwüre (Zollinger-Ellison-Syndrom)."),
  },
  {
    q: tx("After a fatty meal the gall bladder contracts. Which hormone causes this?", "Nach einer fettreichen Mahlzeit zieht sich die Gallenblase zusammen. Welches Hormon bewirkt das?"),
    opts: [
      { text: tx("cholecystokinin (CCK)", "Cholecystokinin (CCK)") },
      { text: tx("secretin", "Sekretin"), title: tx("Secretin answers acid", "Sekretin reagiert auf Säure"), say: tx("Secretin answers acid with hydrogen carbonate. Fat triggers CCK, whose name says it: chole = bile, kinein = move.", "Sekretin antwortet auf Säure mit Hydrogencarbonat. Fett löst CCK aus, der Name verrät es: chole = Galle, kinein = bewegen.") },
      { text: tx("gastrin", "Gastrin"), title: tx("Gastrin acts on the stomach", "Gastrin wirkt auf den Magen"), say: tx("Gastrin stimulates the stomach, not the gall bladder.", "Gastrin regt den Magen an, nicht die Gallenblase.") },
      { text: tx("glucagon", "Glucagon"), title: tx("That's blood sugar", "Das ist Blutzucker"), say: tx("Glucagon raises the blood sugar. Bile release is controlled by CCK.", "Glucagon erhöht den Blutzucker. Die Gallenabgabe steuert CCK.") },
    ],
    hint: tx("Chole = bile, kystis = bladder, kinein = to move.", "Chole = Galle, kystis = Blase, kinein = bewegen."),
    note: tx("**Cholecystokinin**: released by I cells of the duodenum when fatty acids arrive. Gall bladder contracts, pancreas releases enzymes.", "**Cholecystokinin**: von I-Zellen des Zwölffingerdarms ausgeschüttet, wenn Fettsäuren ankommen. Die Gallenblase zieht sich zusammen, die Bauchspeicheldrüse gibt Enzyme ab."),
  },
];

// ---------------------------------------------------------------------------
// Blood sugar control

const SUGAR_QS: Q[] = [
  {
    q: tx("Which hormone lowers the blood sugar?", "Welches Hormon senkt den Blutzucker?"),
    opts: [
      { text: tx("insulin", "Insulin") },
      { text: tx("glucagon", "Glucagon"), title: tx("Glucagon raises it", "Glucagon erhöht ihn"), say: tx("Glucagon is the opponent: it **raises** the blood sugar by glycogen breakdown in the liver.", "Glucagon ist der Gegenspieler: Es **erhöht** den Blutzucker durch Glykogenabbau in der Leber.") },
      { text: tx("glycogen", "Glykogen"), title: tx("Glycogen isn't a hormone", "Glykogen ist kein Hormon"), say: tx("Careful, similar names! **Glycogen** is the storage form of glucose, not a hormone.", "Vorsicht, ähnliche Namen! **Glykogen** ist die Speicherform der Glucose, kein Hormon.") },
      { text: tx("adrenaline", "Adrenalin"), title: tx("Adrenaline raises it", "Adrenalin erhöht ihn"), say: tx("Adrenaline (stress) raises the blood sugar to provide energy quickly.", "Adrenalin (Stress) erhöht den Blutzucker, um schnell Energie bereitzustellen.") },
    ],
    hint: tx("It is the only hormone that lowers blood sugar.", "Es ist das einzige Hormon, das den Blutzucker senkt."),
    note: tx("**Insulin** from the β cells is the only hormone that lowers blood sugar.", "**Insulin** aus den β-Zellen ist das einzige Hormon, das den Blutzucker senkt."),
  },
  {
    q: tx("What does glucagon do in the liver?", "Was bewirkt Glucagon in der Leber?"),
    opts: [
      { text: tx("It stimulates glycogen breakdown, and glucose is released into the blood.", "Es fördert den Glykogenabbau, Glucose wird ins Blut abgegeben.") },
      { text: tx("It stimulates glycogen build-up.", "Es fördert den Glykogenaufbau."), title: tx("That's insulin", "Das ist Insulin"), say: tx("Glycogen build-up is insulin's job. Glucagon does the opposite.", "Glykogenaufbau ist die Aufgabe von Insulin. Glucagon bewirkt das Gegenteil.") },
      { text: tx("It is turned into glycogen.", "Es wird zu Glykogen umgebaut."), title: tx("A hormone is a signal", "Ein Hormon ist ein Signal"), say: tx("Glucagon and glycogen just sound alike. Glucagon is a signal, not a building material.", "Glucagon und Glykogen klingen nur ähnlich. Glucagon ist ein Signal, kein Baustoff.") },
      { text: tx("It makes muscle cells take up glucose.", "Es lässt Muskelzellen Glucose aufnehmen."), title: tx("That's insulin", "Das ist Insulin"), say: tx("Glucose uptake into muscle is stimulated by insulin.", "Die Glucoseaufnahme in Muskeln fördert Insulin.") },
    ],
    hint: tx("Glucagon is released when blood sugar is low.", "Glucagon wird ausgeschüttet, wenn der Blutzucker niedrig ist."),
    note: tx("**Glucagon** (α cells): the liver breaks down glycogen (and makes new glucose) and releases glucose. Blood sugar rises.", "**Glucagon** (α-Zellen): Die Leber baut Glykogen ab (und bildet neue Glucose) und gibt Glucose ab. Der Blutzucker steigt."),
  },
  {
    q: tx("Why are insulin and glucagon called antagonists?", "Warum nennt man Insulin und Glucagon Antagonisten?"),
    opts: [
      { text: tx("They have opposite effects on the same controlled variable.", "Sie wirken entgegengesetzt auf dieselbe Regelgröße.") },
      { text: tx("They are made in different organs.", "Sie werden in verschiedenen Organen gebildet."), title: tx("Same organ", "Gleiches Organ"), say: tx("Both come from the islets of Langerhans in the pancreas. Antagonists act in opposite directions.", "Beide stammen aus den Langerhans-Inseln der Bauchspeicheldrüse. Antagonisten wirken entgegengesetzt.") },
      { text: tx("They destroy each other in the blood.", "Sie zerstören sich gegenseitig im Blut."), title: tx("Not literally", "Nicht wörtlich"), say: tx("They don't react with each other. They pull the blood sugar in opposite directions.", "Sie reagieren nicht miteinander. Sie ziehen den Blutzucker in entgegengesetzte Richtungen.") },
      { text: tx("One acts quickly, the other slowly.", "Eines wirkt schnell, das andere langsam."), title: tx("It's the direction", "Es geht um die Richtung"), say: tx("Antagonist means: opposite direction of the effect.", "Antagonist heißt: entgegengesetzte Wirkrichtung.") },
    ],
    hint: tx("Antagonist means opponent.", "Antagonist heißt Gegenspieler."),
    note: tx("Insulin lowers, glucagon raises the blood sugar: **antagonists**. Together they keep it in a narrow range.", "Insulin senkt, Glucagon erhöht den Blutzucker: **Antagonisten**. Gemeinsam halten sie ihn in einem engen Bereich."),
  },
];

type LoopTerm = "variable" | "sensor" | "signal" | "effector" | "disturb" | "setpoint";
const LOOP: Record<LoopTerm, [Text, Text]> = {
  variable: [tx("controlled variable", "Regelgröße"), tx("blood glucose concentration", "Blutglucosekonzentration")],
  sensor: [tx("sensor and controller", "Fühler und Regler"), tx("α and β cells of the islets of Langerhans", "α- und β-Zellen der Langerhans-Inseln")],
  signal: [tx("control signal", "Stellgröße"), tx("concentration of insulin and glucagon", "Konzentration von Insulin und Glucagon")],
  effector: [tx("effectors", "Stellglieder"), tx("liver, muscle and fat cells", "Leber-, Muskel- und Fettzellen")],
  disturb: [tx("disturbance", "Störgröße"), tx("a meal or physical work", "eine Mahlzeit oder körperliche Arbeit")],
  setpoint: [tx("set point", "Sollwert"), tx("about 90 mg/dL", "etwa 90 mg/dl")],
};

function loopTask(rng: Rng): Exercise {
  const terms = pickN(rng, Object.keys(LOOP) as LoopTerm[], 4);
  const rest = (Object.keys(LOOP) as LoopTerm[]).filter((k) => !terms.includes(k));
  const has = (k: LoopTerm) => terms.includes(k);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("signal") && has("effector")) wrong.push({ pairs: [[LOOP.signal[0], LOOP.effector[1]]], title: tx("Signal vs effector", "Stellgröße oder Stellglied"), say: tx("The control signal is the hormone concentration. The organs that respond to it (liver, muscle, fat) are the effectors.", "Die Stellgröße ist die Hormonkonzentration. Die Organe, die darauf reagieren (Leber, Muskel, Fett), sind die Stellglieder.") });
  if (has("variable") && has("signal")) wrong.push({ pairs: [[LOOP.variable[0], LOOP.signal[1]]], title: tx("What is controlled?", "Was wird geregelt?"), say: tx("The controlled variable is what is kept constant: the blood glucose, not the hormones.", "Die Regelgröße ist das, was konstant gehalten wird: die Blutglucose, nicht die Hormone.") });
  return matchTask({
    instruction: tx("Blood sugar as a control loop", "Blutzucker als Regelkreis"),
    text: tx("Match the terms of the control loop to the blood sugar regulation.", "Ordne die Begriffe des Regelkreises der Blutzuckerregulation zu."),
    pairs: terms.map((k) => LOOP[k]),
    distractors: rng.chance(0.6) ? [LOOP[rng.pick(rest)][1]] : undefined,
    hint: tx("What is kept constant, who measures, which signal, who acts, what disturbs?", "Was wird konstant gehalten, wer misst, welches Signal, wer handelt, was stört?"),
    solution: terms.map((k) => ({ math: quote(LOOP[k][0]), note: tx(`${en(LOOP[k][0])}: ${en(LOOP[k][1])}.`, `${de(LOOP[k][0])}: ${de(LOOP[k][1])}.`) })),
    wrong,
  });
}

type Seq = { intro: Text; steps: Text[]; wrong: { a: number; b: number; title: Text; say: Text }[]; note: Text };
const SEQS: Seq[] = [
  {
    intro: tx("Put the events after a meal rich in carbohydrates in order.", "Bring die Vorgänge nach einer kohlenhydratreichen Mahlzeit in die richtige Reihenfolge."),
    steps: [
      tx("Glucose is absorbed in the small intestine.", "Glucose wird im Dünndarm resorbiert."),
      tx("The blood sugar rises above the set point.", "Der Blutzucker steigt über den Sollwert."),
      tx("β cells release insulin.", "β-Zellen schütten Insulin aus."),
      tx("Liver and muscle cells take up glucose and build glycogen.", "Leber- und Muskelzellen nehmen Glucose auf und bauen Glykogen auf."),
      tx("The blood sugar falls back into the normal range.", "Der Blutzucker sinkt zurück in den Normalbereich."),
    ],
    wrong: [
      { a: 2, b: 1, title: tx("Measure first", "Erst messen"), say: tx("The β cells react to the rise: first the blood sugar rises, then insulin is released.", "Die β-Zellen reagieren auf den Anstieg: Erst steigt der Blutzucker, dann wird Insulin ausgeschüttet.") },
      { a: 4, b: 3, title: tx("Cause before effect", "Erst Ursache, dann Wirkung"), say: tx("The level falls **because** the cells take up glucose.", "Der Spiegel sinkt, **weil** die Zellen Glucose aufnehmen.") },
    ],
    note: tx("Disturbance (meal), rise, β cells, insulin, uptake and glycogen, back to the set point: negative feedback.", "Störgröße (Mahlzeit), Anstieg, β-Zellen, Insulin, Aufnahme und Glykogen, zurück zum Sollwert: negative Rückkopplung."),
  },
  {
    intro: tx("Put the events during a long run in order.", "Bring die Vorgänge bei einem langen Lauf in die richtige Reihenfolge."),
    steps: [
      tx("Working muscles take up more glucose.", "Die arbeitenden Muskeln nehmen mehr Glucose auf."),
      tx("The blood sugar falls below the set point.", "Der Blutzucker sinkt unter den Sollwert."),
      tx("α cells release glucagon.", "α-Zellen schütten Glucagon aus."),
      tx("The liver breaks down glycogen and releases glucose.", "Die Leber baut Glykogen ab und gibt Glucose ab."),
      tx("The blood sugar rises back towards the set point.", "Der Blutzucker steigt wieder Richtung Sollwert."),
    ],
    wrong: [{ a: 3, b: 2, title: tx("The signal comes first", "Erst das Signal"), say: tx("The liver only breaks down glycogen when the glucagon signal arrives.", "Die Leber baut Glykogen erst ab, wenn das Glucagon-Signal ankommt.") }],
    note: tx("Fall, α cells, glucagon, glycogen breakdown in the liver, rise.", "Abfall, α-Zellen, Glucagon, Glykogenabbau in der Leber, Anstieg."),
  },
  {
    intro: tx("Put the steps of glucose absorption in order.", "Bring die Schritte der Glucoseresorption in die richtige Reihenfolge."),
    steps: [
      tx("Maltase splits maltose at the brush border.", "Maltase spaltet Maltose am Bürstensaum."),
      tx("SGLT1 takes up glucose together with 2 Na⁺.", "SGLT1 nimmt Glucose zusammen mit 2 Na⁺ auf."),
      tx("Glucose leaves the cell through GLUT2.", "Glucose verlässt die Zelle über GLUT2."),
      tx("The blood carries it via the portal vein.", "Das Blut bringt sie über die Pfortader weiter."),
      tx("The liver stores part of it as glycogen.", "Die Leber speichert einen Teil als Glykogen."),
    ],
    wrong: [{ a: 2, b: 1, title: tx("In before out", "Erst rein, dann raus"), say: tx("SGLT1 sits at the gut side and takes glucose in. GLUT2 lets it out on the blood side.", "SGLT1 sitzt an der Darmseite und nimmt Glucose auf. GLUT2 lässt sie an der Blutseite hinaus.") }],
    note: tx("Splitting, symport in, carrier out, portal vein, liver.", "Spaltung, Symport hinein, Carrier hinaus, Pfortader, Leber."),
  },
  {
    intro: tx("Put the steps of fat absorption in order.", "Bring die Schritte der Fettresorption in die richtige Reihenfolge."),
    steps: [
      tx("Bile emulsifies the fat.", "Galle emulgiert das Fett."),
      tx("Lipase splits it into fatty acids and monoglycerides.", "Lipase spaltet es in Fettsäuren und Monoglyceride."),
      tx("Micelles carry them to the brush border, they diffuse in.", "Micellen bringen sie zum Bürstensaum, sie diffundieren hinein."),
      tx("In the ER they are rebuilt into triglycerides.", "Im ER werden sie wieder zu Triglyceriden aufgebaut."),
      tx("Chylomicrons leave the cell by exocytosis into the lymph.", "Chylomikronen verlassen die Zelle per Exocytose in die Lymphe."),
    ],
    wrong: [
      { a: 1, b: 0, title: tx("Emulsify first", "Erst emulgieren"), say: tx("Lipase works at the surface of the droplets. Bile has to make them small first.", "Lipase arbeitet an der Oberfläche der Tröpfchen. Erst muss die Galle sie klein machen.") },
      { a: 4, b: 3, title: tx("Build, then pack", "Erst bauen, dann verpacken"), say: tx("Chylomicrons contain the rebuilt triglycerides, so resynthesis in the ER comes first.", "Chylomikronen enthalten die neu gebauten Triglyceride, also kommt die Resynthese im ER zuerst.") },
    ],
    note: tx("Emulsify, split, micelles, resynthesis in the ER, chylomicrons into the lymph.", "Emulgieren, spalten, Micellen, Resynthese im ER, Chylomikronen in die Lymphe."),
  },
];

function seqTask(rng: Rng): Exercise {
  const s = rng.pick(SEQS);
  const drop = rng.chance(0.4) ? rng.pick([0, s.steps.length - 1]) : -1;
  const keep = s.steps.map((_, i) => i).filter((i) => i !== drop);
  const items = keep.map((i) => s.steps[i]);
  return orderTask({
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: s.intro,
    items,
    hint: tx("Cause before effect: what has to happen so that the next step can start?", "Ursache vor Wirkung: Was muss passieren, damit der nächste Schritt beginnen kann?"),
    solution: items.map((it, k) => ({ math: `${k + 1}`, note: it })).concat([{ math: tx('"feedback"', '"Rückkopplung"'), note: s.note }]),
    wrong: s.wrong.filter((w) => keep.includes(w.a) && keep.includes(w.b)).map((w) => ({ items: [s.steps[w.a], s.steps[w.b]], title: w.title, say: w.say })),
  });
}

// Glucose tolerance test graphs
function ogttTask(rng: Rng): Exercise {
  const healthy: [number, number][] = [
    [0, rng.int(80, 95)],
    [30, rng.int(130, 150)],
    [60, rng.int(120, 140)],
    [90, rng.int(100, 115)],
    [120, rng.int(88, 105)],
  ];
  const kind = rng.pick(["diabetes", "impaired"] as const);
  const sick: [number, number][] =
    kind === "diabetes"
      ? [
          [0, rng.int(128, 150)],
          [30, rng.int(200, 230)],
          [60, rng.int(240, 270)],
          [90, rng.int(225, 250)],
          [120, rng.int(205, 235)],
        ]
      : [
          [0, rng.int(96, 108)],
          [30, rng.int(165, 185)],
          [60, rng.int(180, 195)],
          [90, rng.int(165, 180)],
          [120, rng.int(145, 175)],
        ];
  const swap = rng.chance(0.5);
  const curves = swap
    ? [
        { label: "A", points: sick },
        { label: "B", points: healthy },
      ]
    : [
        { label: "A", points: healthy },
        { label: "B", points: sick },
      ];
  const sickLabel = swap ? "A" : "B";
  const two = sick[4][1];
  const variant = rng.pick(["which", "classify"] as const);
  if (variant === "which") {
    const c = choice(rng, [
      { text: tx(`Person ${sickLabel}: high fasting value, the level stays high after 2 hours`, `Person ${sickLabel}: hoher Nüchternwert, der Spiegel bleibt nach 2 Stunden hoch`) },
      { text: tx(`Person ${swap ? "B" : "A"}: the level rises after drinking the glucose`, `Person ${swap ? "B" : "A"}: Der Spiegel steigt nach dem Trinken der Glucose`), title: tx("Rising is normal", "Ein Anstieg ist normal"), say: tx("Every blood sugar rises after 75 g of glucose. What matters is how high and how fast it comes back.", "Jeder Blutzucker steigt nach 75 g Glucose. Entscheidend ist, wie hoch und wie schnell er zurückkommt.") },
      { text: tx("Both: both curves rise above 110", "Beide: Beide Kurven steigen über 110"), title: tx("Short peaks are normal", "Kurze Spitzen sind normal"), say: tx("A short rise to about 140 after glucose is normal. Look at the 2-hour value.", "Ein kurzer Anstieg auf etwa 140 nach Glucose ist normal. Schau auf den 2-Stunden-Wert.") },
    ]);
    return {
      instruction: tx("Glucose tolerance test", "Glucosetoleranztest"),
      text: tx("Two people drink 75 g of glucose on an empty stomach. Their blood sugar is measured for 2 hours. Which curve points to a disorder of blood sugar regulation?", "Zwei Personen trinken nüchtern 75 g Glucose. Ihr Blutzucker wird 2 Stunden lang gemessen. Welche Kurve deutet auf eine Störung der Blutzuckerregulation hin?"),
      visual: { component: DigestionGlucoseGraph as never, props: { curves, threshold: kind === "diabetes" } },
      answer: c.answer,
      hint: tx("Healthy: back near the normal range after 2 hours (below 140 mg/dL).", "Gesund: nach 2 Stunden wieder nahe am Normalbereich (unter 140 mg/dl)."),
      solution: [
        { math: txMap((t) => t(`"person ${sickLabel}, 2 h:" \\; ${two} "mg/dL"`, `"Person ${sickLabel}, 2 h:" \\; ${two} "mg/dl"`)), note: tx(`Person ${sickLabel} starts higher and is still at ${two} mg/dL after 2 hours: glucose isn't taken up properly.`, `Person ${sickLabel} startet höher und liegt nach 2 Stunden noch bei ${two} mg/dl: Die Glucose wird nicht richtig aufgenommen.`) },
      ],
      mistakes: c.mistakes,
    };
  }
  const right = two >= 200 ? 0 : 1;
  const opts: Opt[] = [
    { text: tx("diabetes (2-hour value 200 mg/dL or more)", "Diabetes (2-Stunden-Wert ab 200 mg/dl)") },
    { text: tx("impaired glucose tolerance (140 to 199 mg/dL)", "gestörte Glucosetoleranz (140 bis 199 mg/dl)") },
    { text: tx("normal (below 140 mg/dL)", "normal (unter 140 mg/dl)") },
  ];
  const ordered: Opt[] = [opts[right], ...opts.filter((_, i) => i !== right).map((o) => ({ ...o, title: tx("Read the 2-hour value", "Lies den 2-Stunden-Wert ab"), say: tx(`Read off person ${sickLabel} at 2 h: ${two} mg/dL. Compare with the limits 140 and 200.`, `Lies Person ${sickLabel} bei 2 h ab: ${two} mg/dl. Vergleiche mit den Grenzen 140 und 200.`) }))];
  const c = choice(rng, ordered);
  return {
    instruction: tx("Glucose tolerance test", "Glucosetoleranztest"),
    text: tx(`75 g of glucose were drunk on an empty stomach (oral glucose tolerance test). How do you classify person ${sickLabel}?`, `Es wurden nüchtern 75 g Glucose getrunken (oraler Glucosetoleranztest). Wie ordnest du Person ${sickLabel} ein?`),
    visual: { component: DigestionGlucoseGraph as never, props: { curves, threshold: false } },
    answer: c.answer,
    hint: tx("The 2-hour value decides: below 140 normal, 140 to 199 impaired, from 200 diabetes.", "Der 2-Stunden-Wert entscheidet: unter 140 normal, 140 bis 199 gestört, ab 200 Diabetes."),
    solution: [{ math: txMap((t) => t(`"2 h:" \\; ${two} "mg/dL"`, `"2 h:" \\; ${two} "mg/dl"`)), note: right === 0 ? tx(`${two} mg/dL is at least 200: **diabetes**.`, `${two} mg/dl ist mindestens 200: **Diabetes**.`) : tx(`${two} mg/dL lies between 140 and 199: **impaired glucose tolerance**, a preliminary stage.`, `${two} mg/dl liegt zwischen 140 und 199: **gestörte Glucosetoleranz**, eine Vorstufe.`) }],
    mistakes: c.mistakes,
  };
}

// Diabetes type 1 vs type 2
const T1: Text[] = [
  tx("The immune system destroys the β cells.", "Das Immunsystem zerstört die β-Zellen."),
  tx("There is an absolute lack of insulin.", "Es besteht ein absoluter Insulinmangel."),
  tx("It usually starts in childhood or youth.", "Er beginnt meist im Kindes- oder Jugendalter."),
  tx("Insulin must always be injected.", "Insulin muss immer gespritzt werden."),
];
const T2: Text[] = [
  tx("The target cells respond weakly to insulin (insulin resistance).", "Die Zielzellen reagieren schwach auf Insulin (Insulinresistenz)."),
  tx("Overweight and lack of exercise are major risk factors.", "Übergewicht und Bewegungsmangel sind wichtige Risikofaktoren."),
  tx("Exercise and weight loss can improve it a lot.", "Bewegung und Gewichtsabnahme können ihn deutlich verbessern."),
  tx("At first the pancreas often makes even more insulin.", "Anfangs bildet die Bauchspeicheldrüse oft sogar mehr Insulin."),
];

function diabetesTask(rng: Rng): Exercise {
  const type1 = rng.chance(0.5);
  const own = type1 ? T1 : T2;
  const other = type1 ? T2 : T1;
  const trues: Stmt[] = pickN(rng, own, rng.int(2, 3)).map((text) => ({ text }));
  const falses: Stmt[] = pickN(rng, other, 5 - trues.length).map((text) => ({
    text,
    title: type1 ? tx("That's type 2", "Das ist Typ 2") : tx("That's type 1", "Das ist Typ 1"),
    say: type1
      ? tx("That describes type 2: insulin is there, but it doesn't work well. In type 1 the β cells are destroyed.", "Das beschreibt Typ 2: Insulin ist da, wirkt aber schlecht. Bei Typ 1 sind die β-Zellen zerstört.")
      : tx("That describes type 1: the β cells are destroyed. In type 2 insulin is there but works poorly.", "Das beschreibt Typ 1: Die β-Zellen sind zerstört. Bei Typ 2 ist Insulin da, wirkt aber schlecht."),
  }));
  const mu = multi(rng, trues, falses);
  return {
    instruction: tx("Diabetes type 1 or type 2", "Diabetes Typ 1 oder Typ 2"),
    text: type1 ? tx("Which statements are true for **type 1** diabetes?", "Welche Aussagen treffen auf Diabetes **Typ 1** zu?") : tx("Which statements are true for **type 2** diabetes?", "Welche Aussagen treffen auf Diabetes **Typ 2** zu?"),
    answer: mu.answer,
    hint: tx("Type 1: no insulin (β cells destroyed). Type 2: insulin works poorly (resistance).", "Typ 1: kein Insulin (β-Zellen zerstört). Typ 2: Insulin wirkt schlecht (Resistenz)."),
    solution: [
      { math: tx('"type 1:" \\; "no insulin"', '"Typ 1:" \\; "kein Insulin"'), note: tx("Autoimmune disease, absolute lack of insulin, usually young, insulin therapy.", "Autoimmunerkrankung, absoluter Insulinmangel, meist jung, Insulintherapie.") },
      { math: tx('"type 2:" \\; "insulin resistance"', '"Typ 2:" \\; "Insulinresistenz"'), note: tx("Cells respond weakly, risk factors overweight and lack of exercise, lifestyle helps.", "Zellen reagieren schwach, Risikofaktoren Übergewicht und Bewegungsmangel, Lebensstil hilft.") },
    ],
    mistakes: mu.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Numbers: BMI, energy balance, glucose in the blood

function bmiFrames(m: number, h: number, l: "en" | "de"): Frame[] {
  const bmi = m / (h * h);
  return [
    { math: `\\text{BMI} = \\frac{m}{h^2}`, note: l === "de" ? "Körpermasse in kg durch Körpergröße in m zum Quadrat." : "Body mass in kg divided by height in m, squared." },
    { math: `\\text{BMI} = \\frac{${m} "kg"}{(${dec(h, l, 2)} "m")^2} = \\frac{${m} "kg"}{${dec(h * h, l, 4)} "m²"}`, note: l === "de" ? "Erst die Größe quadrieren." : "Square the height first." },
    { math: `\\text{BMI} \\approx ${dec(bmi, l, 1)} "kg/m²"`, note: l === "de" ? `Ein BMI von etwa **${dec(bmi, l, 1)}**.` : `A BMI of about **${dec(bmi, l, 1)}**.` },
  ];
}
const both = (make: (l: "en" | "de") => Frame[]): Frame[] => {
  const a = make("en");
  const b = make("de");
  return a.map((fr, i) => ({ math: { en: fr.math as string, de: b[i].math as string }, note: { en: fr.note as string, de: b[i].note as string } }));
};

function bmiMistakes(m: number, h: number) {
  const bmi = Math.round((m / (h * h)) * 10) / 10;
  const mk = mistakes(num(bmi, 0.01, "kg/m²"));
  mk.add(num(Math.round((m / h) * 10) / 10, 0.01, "kg/m²"), tx("Height not squared", "Größe nicht quadriert"), tx("Ah, you divided by the height once. In the BMI the height is **squared**: $h^2$.", "Ah, du hast nur einmal durch die Größe geteilt. Im BMI steht die Größe **zum Quadrat**: $h^2$."));
  mk.add(num(Math.round((m / (2 * h)) * 10) / 10, 0.01, "kg/m²"), tx("Doubled instead of squared", "Verdoppelt statt quadriert"), tx("$h^2$ means $h \\cdot h$, not $2 \\cdot h$.", "$h^2$ heißt $h \\cdot h$, nicht $2 \\cdot h$."));
  mk.add(num(Math.round((m / (h * 100 * h * 100)) * 1e5) / 1e5, 0.01, "kg/m²"), tx("Height in cm", "Größe in cm"), tx("The height has to be in **metres**, not centimetres.", "Die Größe muss in **Metern** stehen, nicht in Zentimetern."));
  mk.add(num(Math.round(m * h * h * 10) / 10, 0.01, "kg/m²"), tx("Multiplied", "Multipliziert"), tx("The mass is **divided** by the height squared.", "Die Masse wird **durch** die Größe zum Quadrat geteilt."));
  return mk;
}

function bmiTask(rng: Rng): Exercise {
  const h = rng.int(152, 198) / 100;
  const target = rng.pick([17, 20, 22, 24, 26, 28, 31, 34]) + rng.int(0, 9) / 10;
  const m = Math.round(target * h * h);
  const bmi = Math.round((m / (h * h)) * 10) / 10;
  const classify = rng.chance(0.4);
  if (classify) {
    const k = bmiClass(m / (h * h));
    const opts: Opt[] = [
      { text: BMI_CLASSES[k].name },
      ...BMI_CLASSES.map((c, i) => ({ c, i }))
        .filter(({ i }) => i !== k)
        .map(({ c }) => ({ text: c.name, title: tx("Check the limits", "Prüf die Grenzen"), say: tx(`Work out the BMI first: about ${dec(bmi, "en", 1)}. Limits: 18.5, 25, 30.`, `Rechne zuerst den BMI aus: etwa ${dec(bmi, "de", 1)}. Grenzen: 18,5, 25, 30.`) })),
    ];
    const c = choice(rng, opts);
    return {
      instruction: tx("Classify the BMI", "BMI einordnen"),
      text: txMap((t, l) => t(`An adult is ${dec(h, l, 2)} m tall and weighs ${m} kg. How is the BMI classified (WHO)?`, `Ein Erwachsener ist ${dec(h, l, 2)} m groß und wiegt ${m} kg. Wie wird der BMI eingeordnet (WHO)?`)),
      answer: c.answer,
      hint: tx("BMI = mass / height². Under 18.5 underweight, 18.5 to 24.9 normal, 25 to 29.9 overweight, from 30 obesity.", "BMI = Masse / Größe². Unter 18,5 Untergewicht, 18,5 bis 24,9 Normalgewicht, 25 bis 29,9 Übergewicht, ab 30 Adipositas."),
      solution: [...both((l) => bmiFrames(m, h, l)), { math: quote(BMI_CLASSES[k].name), note: tx("WHO classes for adults: 18.5, 25 and 30 are the limits.", "WHO-Einteilung für Erwachsene: 18,5, 25 und 30 sind die Grenzen.") }],
      mistakes: c.mistakes,
    };
  }
  const mk = bmiMistakes(m, h);
  return {
    instruction: tx("Body mass index", "Body-Mass-Index"),
    text: txMap((t, l) => t(`Work out the BMI of an adult who is ${dec(h, l, 2)} m tall and weighs ${m} kg. Round to one decimal place.`, `Berechne den BMI eines Erwachsenen, der ${dec(h, l, 2)} m groß ist und ${m} kg wiegt. Runde auf eine Nachkommastelle.`)),
    answer: num(bmi, 0.01, "kg/m²"),
    hint: tx("BMI = body mass in kg / (height in m)².", "BMI = Körpermasse in kg / (Körpergröße in m)²."),
    solution: both((l) => bmiFrames(m, h, l)),
    mistakes: mk.list,
  };
}

function balanceTask(rng: Rng): Exercise {
  const variant = rng.pick(["need", "fat"] as const);
  if (variant === "need") {
    const m = rng.int(9, 18) * 5;
    const pal = rng.pick([1.4, 1.5, 1.6, 1.7, 1.8]);
    const basal = 4.2 * m * 24;
    const total = Math.round(basal * pal);
    const mk = mistakes(num(total, 0.01, "kJ"));
    mk.add(num(Math.round(basal), 0.01, "kJ"), tx("PAL forgotten", "PAL vergessen"), tx("That's only the basal metabolic rate. Multiply by the PAL value to include activity.", "Das ist nur der Grundumsatz. Multipliziere mit dem PAL-Wert, um die Aktivität einzurechnen."), true);
    mk.add(num(Math.round(basal + pal), 0.01, "kJ"), tx("PAL added", "PAL addiert"), tx("The PAL value is a **factor**: multiply, don't add.", "Der PAL-Wert ist ein **Faktor**: multiplizieren, nicht addieren."));
    mk.add(num(Math.round(4.2 * m * pal * 10) / 10, 0.01, "kJ"), tx("One hour only", "Nur eine Stunde"), tx("4.2 kJ per kg is per **hour**. A day has 24.", "4,2 kJ pro kg gilt pro **Stunde**. Ein Tag hat 24."));
    return {
      instruction: tx("Total energy need", "Gesamtumsatz"),
      text: txMap((t, l) =>
        t(
          `A person weighs ${m} kg. Basal metabolic rate: 4.2 kJ per kg and hour. The physical activity level (PAL) is ${dec(pal, l, 1)}. Work out the total energy need per day.`,
          `Eine Person wiegt ${m} kg. Grundumsatz: ${dec(4.2, l)} kJ pro kg und Stunde. Der PAL-Wert (körperliche Aktivität) beträgt ${dec(pal, l, 1)}. Berechne den Gesamtumsatz pro Tag.`,
        ),
      ),
      answer: num(total, 0.01, "kJ"),
      hint: tx("Total = basal rate (4.2 · kg · 24) × PAL.", "Gesamtumsatz = Grundumsatz (4,2 · kg · 24) · PAL."),
      solution: both((l) => [
        { math: `"${l === "de" ? "GU" : "BMR"}" = ${dec(4.2, l)} \\cdot ${m} \\cdot 24 = ${dec(basal, l, 0)} "kJ"`, note: l === "de" ? "Grundumsatz pro Tag." : "Basal metabolic rate per day." },
        { math: `${dec(basal, l, 0)} "kJ" \\cdot ${dec(pal, l, 1)} \\approx ${dec(total, l, 0)} "kJ"`, note: l === "de" ? `Gesamtumsatz: etwa **${dec(total, l, 0)} kJ** am Tag.` : `Total need: about **${dec(total, l, 0)} kJ** a day.` },
      ]),
      mistakes: mk.list,
    };
  }
  const surplus = rng.int(4, 12) * 100;
  const days = rng.pick([30, 60, 90, 180, 365]);
  const exact = (surplus * days) / 29000;
  const kg = Math.round(exact * 10) / 10;
  // the exact value and any rounding to one or two decimal places count
  const tol = Math.max(0.02, 0.06 / kg);
  const mk = mistakes(num(kg, tol, "kg"));
  mk.add(num(Math.round((surplus / 29000) * 1000) / 1000, 0.03, "kg"), tx("Only one day", "Nur ein Tag"), tx(`That's one day. Multiply by the ${days} days.`, `Das ist ein Tag. Multipliziere noch mit den ${days} Tagen.`), true);
  mk.add(num(surplus * days, 0.03, "kg"), tx("That's kJ, not kg", "Das sind kJ, nicht kg"), tx("That's the surplus energy in kJ. Divide by 29 000 kJ per kg of body fat.", "Das ist die überschüssige Energie in kJ. Teile durch 29 000 kJ pro kg Körperfett."));
  return {
    instruction: tx("Energy balance", "Energiebilanz"),
    text: tx(
      `Someone eats ${surplus} kJ more each day than they use. 1 kg of body fat stores about 29 000 kJ. How many kg of body fat does that make after ${days} days?`,
      `Jemand nimmt jeden Tag ${surplus} kJ mehr zu sich, als er verbraucht. 1 kg Körperfett speichert etwa 29 000 kJ. Wie viel kg Körperfett ergibt das nach ${days} Tagen?`,
    ),
    answer: num(kg, tol, "kg"),
    hint: tx("Surplus per day × days = total surplus. Then divide by 29 000 kJ/kg.", "Überschuss pro Tag · Tage = Gesamtüberschuss. Dann durch 29 000 kJ/kg teilen."),
    solution: both((l) => [
      { math: `${surplus} "kJ" \\cdot ${days} = ${dec(surplus * days, l, 0)} "kJ"`, note: l === "de" ? "Positive Energiebilanz über die ganze Zeit." : "Positive energy balance over the whole time." },
      { math: `\\frac{${dec(surplus * days, l, 0)} "kJ"}{29000 "kJ/kg"} \\approx ${dec(kg, l, 1)} "kg"`, note: l === "de" ? `Etwa **${dec(kg, l, 1)} kg** Körperfett: Schon kleine tägliche Überschüsse summieren sich.` : `About **${dec(kg, l, 1)} kg** of body fat: small daily surpluses add up.` },
    ]),
    mistakes: mk.list,
  };
}

function bloodGlucoseTask(rng: Rng): Exercise {
  const litres = rng.pick([4.5, 5, 5.5, 6]);
  const conc = rng.pick([80, 90, 100, 110]);
  const grams = Math.round(((litres * 10 * conc) / 1000) * 100) / 100;
  const mk = mistakes(num(grams, 0.02, "g"));
  mk.add(num(Math.round(((litres * conc) / 1000) * 1000) / 1000, 0.02, "g"), tx("Litres vs decilitres", "Liter oder Deziliter"), tx("The concentration is per **decilitre**. 1 litre = 10 dl.", "Die Konzentration gilt pro **Deziliter**. 1 Liter = 10 dl."));
  mk.add(num(litres * 10 * conc, 0.02, "g"), tx("That's milligrams", "Das sind Milligramm"), tx("Your result is in **mg**. Divide by 1000 for grams.", "Dein Ergebnis ist in **mg**. Teile durch 1000 für Gramm."), true);
  return {
    instruction: tx("Sugar in the blood", "Zucker im Blut"),
    text: txMap((t, l) =>
      t(
        `An adult has about ${dec(litres, l, 1)} litres of blood with a glucose concentration of ${conc} mg/dL. How many grams of glucose are dissolved in the whole blood?`,
        `Ein Erwachsener hat etwa ${dec(litres, l, 1)} Liter Blut mit einer Glucosekonzentration von ${conc} mg/dl. Wie viel Gramm Glucose sind im gesamten Blut gelöst?`,
      ),
    ),
    answer: num(grams, 0.02, "g"),
    hint: tx("1 litre = 10 decilitres. mg → g: divide by 1000.", "1 Liter = 10 Deziliter. mg → g: durch 1000 teilen."),
    solution: both((l) => [
      { math: `${dec(litres, l, 1)} "${l === "de" ? "l" : "L"}" = ${dec(litres * 10, l, 0)} "${l === "de" ? "dl" : "dL"}"`, note: l === "de" ? "In Deziliter umrechnen." : "Convert to decilitres." },
      { math: `${dec(litres * 10, l, 0)} \\cdot ${conc} "mg" = ${dec(litres * 10 * conc, l, 0)} "mg" = ${dec(grams, l, 2)} "g"`, note: l === "de" ? `Nur etwa **${dec(grams, l, 1)} g**, ungefähr ein Teelöffel Zucker. Darum muss der Spiegel so genau geregelt werden.` : `Only about **${dec(grams, l, 1)} g**, roughly a teaspoon of sugar. That's why the level must be controlled so precisely.` },
    ]),
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => questionTask(rng, TRANSPORT_QS, tx("Absorption mechanisms", "Resorptionsmechanismen"))],
    [0.8, () => transportPartTask(rng)],
    [1.2, () => hormoneMatchTask(rng)],
    [1, () => questionTask(rng, HORMONE_QS, tx("Hormones of digestion", "Verdauungshormone"))],
    [1, () => questionTask(rng, SUGAR_QS, tx("Insulin and glucagon", "Insulin und Glucagon"))],
    [1, () => loopTask(rng)],
    [1.1, () => seqTask(rng)],
    [1.1, () => ogttTask(rng)],
    [1, () => diabetesTask(rng)],
    [1.2, () => bmiTask(rng)],
    [0.9, () => balanceTask(rng)],
    [0.5, () => bloodGlucoseTask(rng)],
    [0.5, () => questionTask(rng, MICROBIOME_QS, tx("Gut flora", "Darmflora"))],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const symportCheck = (() => {
  const c = fixedChoice(TRANSPORT_QS[0].opts, 2);
  return { instruction: tx("Absorption mechanisms", "Resorptionsmechanismen"), text: TRANSPORT_QS[0].q, answer: c.answer, hint: TRANSPORT_QS[0].hint, solution: [{ math: tx('"Na⁺ gradient" \\to "glucose"', '"Na⁺-Gefälle" \\to "Glucose"'), note: TRANSPORT_QS[0].note }], mistakes: c.mistakes } satisfies Exercise;
})();

const mealOrder = orderTask({
  instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
  text: SEQS[0].intro,
  items: SEQS[0].steps,
  hint: tx("Cause before effect: the β cells react to the rise.", "Ursache vor Wirkung: Die β-Zellen reagieren auf den Anstieg."),
  solution: [
    { math: tx('"meal" \\to "glucose" "↑" \\to "insulin"', '"Mahlzeit" \\to "Glucose" "↑" \\to "Insulin"'), note: tx("The meal is the disturbance: glucose rises above the set point, the β cells release insulin.", "Die Mahlzeit ist die Störgröße: Die Glucose steigt über den Sollwert, die β-Zellen schütten Insulin aus.") },
    { math: tx('"insulin" \\to "glycogen" \\to "glucose" "↓"', '"Insulin" \\to "Glykogen" \\to "Glucose" "↓"'), note: SEQS[0].note },
  ],
  wrong: SEQS[0].wrong.map((w) => ({ items: [SEQS[0].steps[w.a], SEQS[0].steps[w.b]], title: w.title, say: w.say })),
});

const bmiCheck: Exercise = (() => {
  const m = 82;
  const h = 1.8;
  const mk = bmiMistakes(m, h);
  return {
    instruction: tx("Body mass index", "Body-Mass-Index"),
    text: tx("Work out the BMI of an adult who is 1.80 m tall and weighs 82 kg. Round to one decimal place.", "Berechne den BMI eines Erwachsenen, der 1,80 m groß ist und 82 kg wiegt. Runde auf eine Nachkommastelle."),
    answer: num(25.3, 0.01, "kg/m²"),
    hint: tx("BMI = mass in kg / (height in m)². Square the height first.", "BMI = Masse in kg / (Größe in m)². Erst die Größe quadrieren."),
    solution: [...both((l) => bmiFrames(m, h, l)), { math: tx('"overweight (pre-obesity)"', '"Übergewicht (Präadipositas)"'), note: tx("25.3 is just above 25: overweight by the WHO classes. But the BMI can't tell muscle from fat: an athlete can have this value, too.", "25,3 liegt knapp über 25: Übergewicht nach WHO. Der BMI unterscheidet aber nicht zwischen Muskeln und Fett: Auch Sportler können diesen Wert haben.") }],
    mistakes: mk.list,
  };
})();

const hormoneCheck = hormoneMatchExercise("effect", false);

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Absorption: how building blocks cross the gut wall", "Resorption: wie Bausteine die Darmwand passieren"),
      blob: tx("Time to look at the membrane itself. Transporters at work!", "Zeit für einen Blick auf die Membran selbst. Transporter bei der Arbeit!"),
      body: tx(
        "The epithelial cells of the villi carry a brush border of microvilli. Their membrane is a barrier: glucose and amino acids are water-soluble and need **transport proteins**.",
        "Die Epithelzellen der Zotten tragen einen Bürstensaum aus Mikrovilli. Ihre Membran ist eine Barriere: Glucose und Aminosäuren sind wasserlöslich und brauchen **Transportproteine**.",
      ),
      frames: [
        { math: tx('"passive:" \\; "diffusion, carriers"', '"passiv:" \\; "Diffusion, Carrier"'), note: tx("**Passive** transport only runs down the concentration gradient and needs no energy. In facilitated diffusion a carrier or channel helps (e.g. GLUT2).", "**Passiver** Transport läuft nur mit dem Konzentrationsgefälle und braucht keine Energie. Bei der erleichterten Diffusion hilft ein Carrier oder Kanal (z. B. GLUT2).") },
        {
          math: tx('"passive:" \\; "diffusion, carriers" \\\\ "primary active:" \\; "ATP (Na⁺/K⁺ pump)"', '"passiv:" \\; "Diffusion, Carrier" \\\\ "primär aktiv:" \\; "ATP (Na⁺/K⁺-Pumpe)"'),
          note: tx("**Primary active** transport uses ATP directly and pumps against the gradient: the Na⁺/K⁺-ATPase, 3 Na⁺ out, 2 K⁺ in.", "**Primär aktiver** Transport nutzt direkt ATP und pumpt gegen das Gefälle: die Na⁺/K⁺-ATPase, 3 Na⁺ hinaus, 2 K⁺ hinein."),
        },
        {
          math: tx(
            '"passive:" \\; "diffusion, carriers" \\\\ "primary active:" \\; "ATP (Na⁺/K⁺ pump)" \\\\ "secondary active:" \\; "Na⁺ gradient (SGLT1)"',
            '"passiv:" \\; "Diffusion, Carrier" \\\\ "primär aktiv:" \\; "ATP (Na⁺/K⁺-Pumpe)" \\\\ "sekundär aktiv:" \\; "Na⁺-Gefälle (SGLT1)"',
          ),
          note: tx("**Secondary active** transport uses a gradient built by a pump. SGLT1 couples the Na⁺ inflow to glucose uptake: a **symport**.", "**Sekundär aktiver** Transport nutzt ein Gefälle, das eine Pumpe aufgebaut hat. SGLT1 koppelt den Na⁺-Einstrom an die Glucoseaufnahme: ein **Symport**."),
        },
        {
          math: tx('"glucose, amino acids" \\to "blood" \\to "portal vein" \\to "liver"', '"Glucose, Aminosäuren" \\to "Blut" \\to "Pfortader" \\to "Leber"'),
          note: tx("Water-soluble building blocks enter the capillaries and reach the **liver** first, via the **portal vein**.", "Wasserlösliche Bausteine gelangen in die Kapillaren und über die **Pfortader** zuerst zur **Leber**."),
        },
        {
          math: tx('"fatty acids" \\to "chylomicrons" \\to "lymph"', '"Fettsäuren" \\to "Chylomikronen" \\to "Lymphe"'),
          note: tx("Fat building blocks diffuse into the cell, are rebuilt into triglycerides and leave as **chylomicrons** into the lymph.", "Fettbausteine diffundieren in die Zelle, werden zu Triglyceriden aufgebaut und verlassen sie als **Chylomikronen** in die Lymphe."),
        },
        {
          math: tx('"large intestine:" \\; 4 \\cdot 10^{13} "bacteria"', '"Dickdarm:" \\; 4 \\cdot 10^{13} "Bakterien"'),
          note: tx("What's left reaches the large intestine with its **gut flora (microbiome)**: about as many bacteria as body cells. They ferment fibre into short-chain fatty acids, make vitamin K, crowd out pathogens and train the immune system.", "Was übrig bleibt, erreicht den Dickdarm mit seiner **Darmflora (Mikrobiom)**: etwa so viele Bakterien wie Körperzellen. Sie vergären Ballaststoffe zu kurzkettigen Fettsäuren, bilden Vitamin K, verdrängen Krankheitserreger und trainieren das Immunsystem."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Through the gut cell", "Durch die Darmzelle"),
      blob: tx("Pick a nutrient and follow it step by step!", "Wähl einen Nährstoff und folge ihm Schritt für Schritt!"),
      body: tx("Choose glucose, amino acids or fats and step through their way from the gut into blood or lymph. Watch which transporter lights up.", "Wähle Glucose, Aminosäuren oder Fette und geh ihren Weg aus dem Darm ins Blut oder in die Lymphe Schritt für Schritt durch. Achte darauf, welcher Transporter aufleuchtet."),
      widget: DigestionTransport,
    },
    { type: "check", blob: tx("Primary, secondary, passive: let's see!", "Primär, sekundär, passiv: mal sehen!"), exercise: symportCheck },
    {
      type: "explain",
      title: tx("Hormones control digestion", "Hormone steuern die Verdauung"),
      blob: tx("The gut talks to itself, with hormones!", "Der Darm spricht mit sich selbst, mit Hormonen!"),
      body: tx(
        "Cells of the stomach and duodenum release hormones into the blood when food arrives. That way juices are released exactly when they are needed.",
        "Zellen in Magen und Zwölffingerdarm geben Hormone ins Blut ab, wenn Nahrung ankommt. So werden die Säfte genau dann ausgeschüttet, wenn sie gebraucht werden.",
      ),
      frames: [
        {
          math: tx('"gastrin"#g', '"Gastrin"#g'),
          note: tx("**Gastrin** from the G cells of the stomach lining. Trigger: protein building blocks, stretching, nerve signals. Effect: more hydrochloric acid and pepsinogen, stomach movement.", "**Gastrin** aus den G-Zellen der Magenschleimhaut. Auslöser: Eiweißbausteine, Dehnung, Nervensignale. Wirkung: mehr Salzsäure und Pepsinogen, Magenbewegung."),
        },
        {
          math: tx('"gastrin"#g \\quad "secretin"#s', '"Gastrin"#g \\quad "Sekretin"#s'),
          note: tx("**Secretin** from the duodenum. Trigger: acidic chyme. Effect: pancreatic juice rich in hydrogen carbonate neutralises the acid; acid production in the stomach is slowed.", "**Sekretin** aus dem Zwölffingerdarm. Auslöser: saurer Speisebrei. Wirkung: hydrogencarbonatreicher Bauchspeichel neutralisiert die Säure; die Säurebildung im Magen wird gebremst."),
        },
        {
          math: tx('"gastrin"#g \\quad "secretin"#s \\quad "CCK"#c', '"Gastrin"#g \\quad "Sekretin"#s \\quad "CCK"#c'),
          note: tx("**Cholecystokinin (CCK)** from the duodenum. Trigger: fatty acids and amino acids. Effect: the gall bladder contracts, enzyme-rich pancreatic juice, slower stomach emptying, feeling full.", "**Cholecystokinin (CCK)** aus dem Zwölffingerdarm. Auslöser: Fettsäuren und Aminosäuren. Wirkung: Die Gallenblase zieht sich zusammen, enzymreicher Bauchspeichel, langsamere Magenentleerung, Sättigung."),
        },
        {
          math: tx('"acid" \\to "secretin" \\to \\ce{HCO3-} \\to "pH" "↑"', '"Säure" \\to "Sekretin" \\to \\ce{HCO3-} \\to "pH" "↑"'),
          note: tx("Negative feedback: the acid triggers its own neutralisation. The pancreatic enzymes need about pH 8.", "Negative Rückkopplung: Die Säure löst ihre eigene Neutralisation aus. Die Enzyme des Bauchspeichels brauchen etwa pH 8."),
        },
      ],
    },
    { type: "check", blob: tx("Three hormones, three jobs.", "Drei Hormone, drei Aufgaben."), exercise: hormoneCheck },
    {
      type: "explain",
      title: tx("Blood sugar: a control loop", "Blutzucker: ein Regelkreis"),
      blob: tx("Your brain needs a steady supply of glucose. Here's how the body manages it.", "Dein Gehirn braucht ständig Glucose. So schafft der Körper das."),
      frames: [
        {
          math: txMap((t) => t('"set point:" \\; 90 "mg/dL"', '"Sollwert:" \\; 90 "mg/dl"')),
          note: tx("The blood glucose level is the **controlled variable**. It is kept between about 70 and 110 mg/dL, set point about 90 mg/dL.", "Der Blutzuckerspiegel ist die **Regelgröße**. Er wird zwischen etwa 70 und 110 mg/dl gehalten, Sollwert etwa 90 mg/dl."),
        },
        {
          math: tx('"actual" > "set" \\to "β cells" \\to "insulin"', '"Istwert" > "Sollwert" \\to "β-Zellen" \\to "Insulin"'),
          note: tx("After a meal (**disturbance**) the actual value rises. The **β cells** of the islets of Langerhans in the pancreas measure it (sensor) and release **insulin** (controller).", "Nach einer Mahlzeit (**Störgröße**) steigt der Istwert. Die **β-Zellen** der Langerhans-Inseln in der Bauchspeicheldrüse messen das (Fühler) und schütten **Insulin** aus (Regler)."),
        },
        {
          math: tx('"insulin" \\to "glucose uptake, glycogen build-up"', '"Insulin" \\to "Glucoseaufnahme, Glykogenaufbau"'),
          note: tx("Insulin acts on the **effectors**: muscle and fat cells take up glucose, liver and muscles build **glycogen**. The blood sugar falls.", "Insulin wirkt auf die **Stellglieder**: Muskel- und Fettzellen nehmen Glucose auf, Leber und Muskeln bauen **Glykogen** auf. Der Blutzucker sinkt."),
        },
        {
          math: tx('"actual" < "set" \\to "α cells" \\to "glucagon"', '"Istwert" < "Sollwert" \\to "α-Zellen" \\to "Glucagon"'),
          note: tx("When you're hungry or doing sport the blood sugar falls: the **α cells** release **glucagon**.", "Bei Hunger oder Sport sinkt der Blutzucker: Die **α-Zellen** schütten **Glucagon** aus."),
        },
        {
          math: tx('"glucagon" \\to "glycogen breakdown in the liver"', '"Glucagon" \\to "Glykogenabbau in der Leber"'),
          note: tx("The liver breaks down glycogen (and makes new glucose) and releases glucose. Insulin and glucagon are **antagonists**: **negative feedback** keeps the level stable.", "Die Leber baut Glykogen ab (und bildet neue Glucose) und gibt Glucose ab. Insulin und Glucagon sind **Antagonisten**: **Negative Rückkopplung** hält den Spiegel stabil."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The blood sugar simulator", "Der Blutzucker-Simulator"),
      blob: tx("Press play and watch the hormones react. Then try type 1 and type 2!", "Drück auf Play und schau, wie die Hormone reagieren. Dann probier Typ 1 und Typ 2!"),
      body: tx(
        "A model of the control loop over 4 hours. Compare a meal with sport, and a healthy person with diabetes type 1 (without and with insulin) and type 2. The green band is the normal range, the dashed line the kidney threshold.",
        "Ein Modell des Regelkreises über 4 Stunden. Vergleiche eine Mahlzeit mit Sport und eine gesunde Person mit Diabetes Typ 1 (ohne und mit Insulin) und Typ 2. Das grüne Band ist der Normalbereich, die gestrichelte Linie die Nierenschwelle.",
      ),
      widget: DigestionBloodSugar,
    },
    {
      type: "explain",
      title: tx("Diabetes mellitus: type 1 and type 2", "Diabetes mellitus: Typ 1 und Typ 2"),
      blob: tx("When the control loop fails.", "Wenn der Regelkreis versagt."),
      frames: [
        {
          math: tx('"type 1:" \\; "no insulin"', '"Typ 1:" \\; "kein Insulin"'),
          note: tx("**Type 1**: the body's own immune system destroys the β cells (autoimmune disease), usually in childhood or youth. **Absolute lack of insulin**: insulin must be injected for life (or given by a pump).", "**Typ 1**: Das eigene Immunsystem zerstört die β-Zellen (Autoimmunerkrankung), meist im Kindes- oder Jugendalter. **Absoluter Insulinmangel**: Insulin muss lebenslang gespritzt (oder per Pumpe gegeben) werden."),
        },
        {
          math: tx('"type 1:" \\; "no insulin" \\\\ "type 2:" \\; "insulin resistance"', '"Typ 1:" \\; "kein Insulin" \\\\ "Typ 2:" \\; "Insulinresistenz"'),
          note: tx("**Type 2**: the target cells respond less to insulin (**insulin resistance**); later the β cells tire (relative lack). Risk factors: overweight, lack of exercise, genes. About 90 % of all cases.", "**Typ 2**: Die Zielzellen reagieren schwächer auf Insulin (**Insulinresistenz**); später erschöpfen die β-Zellen (relativer Mangel). Risikofaktoren: Übergewicht, Bewegungsmangel, Veranlagung. Etwa 90 % aller Fälle."),
        },
        {
          math: txMap((t) => t('"fasting:" \\; \\ge 126 "mg/dL" \\quad "oGTT 2 h:" \\; \\ge 200 "mg/dL"', '"nüchtern:" \\; \\ge 126 "mg/dl" \\quad "oGTT 2 h:" \\; \\ge 200 "mg/dl"')),
          note: tx("Diagnosis: fasting blood sugar from 126 mg/dL, or 200 mg/dL or more 2 hours after drinking 75 g of glucose (oral glucose tolerance test).", "Diagnose: Nüchternblutzucker ab 126 mg/dl oder ab 200 mg/dl 2 Stunden nach dem Trinken von 75 g Glucose (oraler Glucosetoleranztest)."),
        },
        {
          math: txMap((t) => t('> 180 "mg/dL" \\to "glucose in the urine"', '> 180 "mg/dl" \\to "Glucose im Urin"')),
          note: tx("Above the kidney threshold (about 180 mg/dL) glucose appears in the urine: \"diabetes mellitus\" means \"honey-sweet flow\". Too much sugar over years damages blood vessels, nerves, eyes and kidneys.", "Über der Nierenschwelle (etwa 180 mg/dl) erscheint Glucose im Urin: „Diabetes mellitus“ heißt „honigsüßer Durchfluss“. Zu viel Zucker über Jahre schädigt Blutgefäße, Nerven, Augen und Nieren."),
        },
        {
          math: tx('"type 2:" \\; "exercise, diet, weight"', '"Typ 2:" \\; "Bewegung, Ernährung, Gewicht"'),
          note: tx("In type 2, exercise, a balanced diet and losing weight come first: they improve the effect of insulin. Later tablets or insulin may be added.", "Bei Typ 2 helfen zuerst Bewegung, ausgewogene Ernährung und Gewichtsabnahme: Sie verbessern die Insulinwirkung. Später kommen Tabletten oder Insulin dazu."),
        },
      ],
    },
    { type: "check", blob: tx("Put the control loop in motion.", "Bring den Regelkreis in Gang."), exercise: mealOrder },
    {
      type: "widget",
      title: tx("Energy balance and BMI", "Energiebilanz und BMI"),
      blob: tx("Energy in, energy out. Let's balance the books!", "Energie rein, Energie raus. Machen wir die Bilanz!"),
      body: tx(
        "The **energy balance** compares intake with need (total = basal metabolic rate × PAL value). A surplus is stored as fat. The **body mass index** BMI = body mass (kg) / height² (m²) estimates whether weight and height fit together.",
        "Die **Energiebilanz** vergleicht Zufuhr und Bedarf (Gesamtumsatz = Grundumsatz × PAL-Wert). Ein Überschuss wird als Fett gespeichert. Der **Body-Mass-Index** BMI = Körpermasse (kg) / Körpergröße² (m²) schätzt, ob Gewicht und Größe zusammenpassen.",
      ),
      widget: DigestionBmi,
    },
    { type: "check", blob: tx("Last one: a BMI calculation.", "Zum Schluss: eine BMI-Rechnung."), exercise: bmiCheck },
  ],
  summary: [
    {
      title: tx("Absorption mechanisms", "Resorptionsmechanismen"),
      body: tx(
        "Glucose: **SGLT1** (2 Na⁺ + 1 glucose, secondary active symport) in, **GLUT2** (facilitated diffusion) out. The **Na⁺/K⁺-ATPase** (primary active, 3 Na⁺ out, 2 K⁺ in) keeps the Na⁺ gradient. Amino acids: Na⁺ symport. Blood → portal vein → liver.",
        "Glucose: **SGLT1** (2 Na⁺ + 1 Glucose, sekundär aktiver Symport) hinein, **GLUT2** (erleichterte Diffusion) hinaus. Die **Na⁺/K⁺-ATPase** (primär aktiv, 3 Na⁺ hinaus, 2 K⁺ hinein) hält das Na⁺-Gefälle. Aminosäuren: Na⁺-Symport. Blut → Pfortader → Leber.",
      ),
      examples: [tx('"SGLT1:" \\; 2 \\ce{Na+} + 1 "glucose"', '"SGLT1:" \\; 2 \\ce{Na+} + 1 "Glucose"')],
      tone: "rule",
    },
    {
      title: tx("Fats and gut flora", "Fette und Darmflora"),
      body: tx(
        "Fatty acids and monoglycerides: micelles, diffusion, resynthesis to triglycerides in the ER, **chylomicrons** by exocytosis into the **lymph**. Gut bacteria ferment fibre, make vitamin K and protect against pathogens.",
        "Fettsäuren und Monoglyceride: Micellen, Diffusion, Resynthese zu Triglyceriden im ER, **Chylomikronen** per Exocytose in die **Lymphe**. Darmbakterien vergären Ballaststoffe, bilden Vitamin K und schützen vor Krankheitserregern.",
      ),
      tone: "rule",
    },
    {
      title: tx("Hormones of digestion", "Verdauungshormone"),
      body: tx(
        "**Gastrin** (stomach): more acid. **Secretin** (duodenum, trigger acid): hydrogen carbonate. **CCK** (duodenum, trigger fat/amino acids): gall bladder contracts, enzymes.",
        "**Gastrin** (Magen): mehr Säure. **Sekretin** (Zwölffingerdarm, Auslöser Säure): Hydrogencarbonat. **CCK** (Zwölffingerdarm, Auslöser Fett/Aminosäuren): Gallenblase, Enzyme.",
      ),
      tone: "rule",
    },
    {
      title: tx("Blood sugar control loop", "Regelkreis Blutzucker"),
      body: tx(
        "Set point about 90 mg/dL (70 to 110). Too high: **β cells → insulin** → uptake into cells, glycogen build-up. Too low: **α cells → glucagon** → glycogen breakdown in the liver. Antagonists, negative feedback.",
        "Sollwert etwa 90 mg/dl (70 bis 110). Zu hoch: **β-Zellen → Insulin** → Aufnahme in die Zellen, Glykogenaufbau. Zu niedrig: **α-Zellen → Glucagon** → Glykogenabbau in der Leber. Antagonisten, negative Rückkopplung.",
      ),
      examples: [tx('"too high" \\to "insulin" \\to "glucose" "↓"', '"zu hoch" \\to "Insulin" \\to "Glucose" "↓"'), tx('"too low" \\to "glucagon" \\to "glucose" "↑"', '"zu niedrig" \\to "Glucagon" \\to "Glucose" "↑"')],
      tone: "rule",
    },
    {
      title: tx("Diabetes types", "Diabetes-Typen"),
      body: tx(
        "**Type 1**: β cells destroyed (autoimmune), absolute insulin lack, insulin therapy. **Type 2**: insulin resistance, risk factors overweight and lack of exercise. Don't mix up glucagon (hormone) and glycogen (store)!",
        "**Typ 1**: β-Zellen zerstört (autoimmun), absoluter Insulinmangel, Insulintherapie. **Typ 2**: Insulinresistenz, Risikofaktoren Übergewicht und Bewegungsmangel. Glucagon (Hormon) nicht mit Glykogen (Speicher) verwechseln!",
      ),
      tone: "warning",
    },
    {
      title: tx("BMI and energy balance", "BMI und Energiebilanz"),
      body: tx(
        "BMI = m / h² (kg/m²): under 18.5 underweight, 18.5 to 24.9 normal, 25 to 29.9 overweight, from 30 obesity (adults; teenagers: percentiles). Total need = basal rate × PAL; a surplus is stored as fat (1 kg ≈ 29 000 kJ).",
        "BMI = m / h² (kg/m²): unter 18,5 Untergewicht, 18,5 bis 24,9 Normalgewicht, 25 bis 29,9 Übergewicht, ab 30 Adipositas (Erwachsene; Jugendliche: Perzentile). Gesamtumsatz = Grundumsatz · PAL; Überschuss wird als Fett gespeichert (1 kg ≈ 29 000 kJ).",
      ),
      examples: [txMap((t) => t('\\text{BMI} = \\frac{70 "kg"}{(1.75 "m")^2} \\approx 22.9', '\\text{BMI} = \\frac{70 "kg"}{(1,75 "m")^2} \\approx 22,9'))],
      tone: "tip",
    },
  ],
};
