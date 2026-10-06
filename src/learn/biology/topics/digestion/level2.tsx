"use client";

// Level 2 (Klasse 7–9): digestion as splitting into building blocks by enzymes (where, what),
// stomach acid and bile, absorption in the small intestine (villi, microvilli, blood and
// lymph), food tests, and energy content and energy need in kJ.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { dec } from "@/learn/chemistry/format";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson } from "@/learn/types";
import { DigestionEnergy, DigestionLabel, KJ } from "@/learn/biology/visuals/DigestionEnergy";
import { DigestionFoodLab, DigestionTestResults, TESTS, type FoodTest } from "@/learn/biology/visuals/DigestionFoodLab";
import { DigestionJourney2 } from "@/learn/biology/visuals/DigestionJourney";
import { DigestionScissors } from "@/learn/biology/visuals/DigestionScissors";
import { DigestionVillus, DigestionVillusExplore, VILLUS_PARTS, type VillusPart } from "@/learn/biology/visuals/DigestionVillus";
import { choice, fixedChoice, matchTask, mistakes, multi, num, orderTask, pickN, quote, weighted, word, type Opt, type Stmt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

// ---------------------------------------------------------------------------
// Enzymes: where and what

type Q = { q: Text; opts: Opt[]; hint: Text; note: Text };

const ENZYME_QS: Q[] = [
  {
    q: tx("Which enzyme starts protein digestion in the stomach?", "Welches Enzym beginnt im Magen mit der Eiweißverdauung?"),
    opts: [
      { text: tx("pepsin", "Pepsin") },
      { text: tx("trypsin", "Trypsin"), title: tx("That's in the small intestine", "Das ist im Dünndarm"), say: tx("Trypsin also cuts proteins, but it comes from the pancreas and works in the small intestine.", "Trypsin schneidet auch Eiweiße, kommt aber aus der Bauchspeicheldrüse und arbeitet im Dünndarm.") },
      { text: tx("amylase", "Amylase"), title: tx("Amylase cuts starch", "Amylase schneidet Stärke"), say: tx("Amylase only cuts starch. Enzymes are specific: each fits only its own substrate.", "Amylase schneidet nur Stärke. Enzyme sind spezifisch: Jedes passt nur zu seinem Substrat.") },
      { text: tx("bile", "Galle"), title: tx("Bile isn't an enzyme", "Galle ist kein Enzym"), say: tx("Bile is not an enzyme, and it acts on fat in the small intestine.", "Galle ist kein Enzym, und sie wirkt im Dünndarm auf Fett.") },
    ],
    hint: tx("It only works in strong acid, at pH 2.", "Es arbeitet nur in starker Säure, bei pH 2."),
    note: tx("**Pepsin** cuts proteins into peptides. The hydrochloric acid of the stomach activates it.", "**Pepsin** spaltet Eiweiße in Peptide. Die Salzsäure des Magens aktiviert es."),
  },
  {
    q: tx("Where does the digestion of starch begin?", "Wo beginnt die Verdauung von Stärke?"),
    opts: [
      { text: tx("in the mouth", "im Mund") },
      { text: tx("in the stomach", "im Magen"), title: tx("Earlier!", "Früher!"), say: tx("Classic trap! Saliva amylase already cuts starch in the **mouth**. In the stomach the acid actually stops it.", "Die klassische Falle! Die Amylase im Speichel schneidet Stärke schon im **Mund**. Im Magen wird sie von der Säure sogar gestoppt.") },
      { text: tx("in the small intestine", "im Dünndarm"), title: tx("It continues there", "Dort geht es weiter"), say: tx("In the small intestine starch digestion is **finished**. It starts in the mouth with saliva.", "Im Dünndarm wird die Stärkeverdauung **beendet**. Sie beginnt im Mund mit dem Speichel.") },
      { text: tx("in the large intestine", "im Dickdarm"), title: tx("Much too late", "Viel zu spät"), say: tx("By then the starch is long gone. It starts in the mouth.", "Da ist die Stärke längst weg. Es beginnt im Mund.") },
    ],
    hint: tx("Chew a piece of bread for a long time: it starts to taste sweet.", "Kau ein Stück Brot lange: Es schmeckt dann süß."),
    note: tx("In the **mouth**: saliva contains amylase, which cuts starch into maltose.", "Im **Mund**: Der Speichel enthält Amylase, die Stärke in Maltose spaltet."),
  },
  {
    q: tx("Which enzyme splits fats?", "Welches Enzym spaltet Fette?"),
    opts: [
      { text: tx("lipase", "Lipase") },
      { text: tx("bile", "Galle"), title: tx("Bile is not an enzyme", "Galle ist kein Enzym"), say: tx("Classic trap! Bile only **emulsifies** fat into tiny droplets. The splitting is done by an enzyme from the pancreas.", "Die klassische Falle! Galle **emulgiert** Fett nur in winzige Tröpfchen. Gespalten wird es von einem Enzym aus der Bauchspeicheldrüse.") },
      { text: tx("pepsin", "Pepsin"), title: tx("Pepsin cuts proteins", "Pepsin schneidet Eiweiße"), say: tx("Pepsin only cuts proteins. Enzymes are specific.", "Pepsin schneidet nur Eiweiße. Enzyme sind spezifisch.") },
      { text: tx("maltase", "Maltase"), title: tx("Maltase cuts maltose", "Maltase schneidet Maltose"), say: tx("Maltase splits maltose into glucose. Fats need another enzyme.", "Maltase spaltet Maltose in Glucose. Fette brauchen ein anderes Enzym.") },
    ],
    hint: tx("Enzyme names often end in -ase and start with the substrate: lipids are fats.", "Enzymnamen enden oft auf -ase und beginnen mit dem Substrat: Lipide sind Fette."),
    note: tx("**Lipase** from the pancreas splits fats into glycerol and fatty acids.", "**Lipase** aus der Bauchspeicheldrüse spaltet Fette in Glycerin und Fettsäuren."),
  },
  {
    q: tx("What does amylase turn starch into?", "Was macht Amylase aus Stärke?"),
    opts: [
      { text: tx("maltose (a double sugar)", "Maltose (einen Zweifachzucker)") },
      { text: tx("amino acids", "Aminosäuren"), title: tx("Those come from proteins", "Die kommen aus Eiweißen"), say: tx("Amino acids are the building blocks of proteins. Starch is made of glucose units.", "Aminosäuren sind die Bausteine der Eiweiße. Stärke besteht aus Glucose-Einheiten.") },
      { text: tx("glycerol and fatty acids", "Glycerin und Fettsäuren"), title: tx("Those come from fats", "Die kommen aus Fetten"), say: tx("Glycerol and fatty acids are the building blocks of fats.", "Glycerin und Fettsäuren sind die Bausteine der Fette.") },
      { text: tx("glucose directly", "direkt Glucose"), title: tx("One more step", "Ein Schritt fehlt"), say: tx("Nearly! Amylase cuts the chain into pieces of two units, maltose. Maltase then splits maltose into glucose.", "Fast! Amylase schneidet die Kette in Stücke aus zwei Einheiten, Maltose. Erst die Maltase spaltet Maltose in Glucose.") },
    ],
    hint: tx("It's an intermediate step on the way to glucose.", "Es ist ein Zwischenschritt auf dem Weg zur Glucose."),
    note: tx("Amylase cuts starch into **maltose**. Maltase then splits each maltose into two glucose molecules.", "Amylase spaltet Stärke in **Maltose**. Die Maltase spaltet jede Maltose dann in zwei Glucose-Moleküle."),
  },
  {
    q: tx("Which digestive juice contains enzymes for starch, proteins and fats?", "Welcher Verdauungssaft enthält Enzyme für Stärke, Eiweiße und Fette?"),
    opts: [
      { text: tx("pancreatic juice", "der Bauchspeichel") },
      { text: tx("bile", "die Galle"), title: tx("No enzymes in bile", "In der Galle sind keine Enzyme"), say: tx("Bile contains no digestive enzymes at all. It only emulsifies fat.", "Die Galle enthält gar keine Verdauungsenzyme. Sie emulgiert nur Fett.") },
      { text: tx("saliva", "der Speichel"), title: tx("Only amylase", "Nur Amylase"), say: tx("Saliva only has amylase for starch.", "Der Speichel hat nur Amylase für Stärke.") },
      { text: tx("gastric juice", "der Magensaft"), title: tx("Only for proteins", "Nur für Eiweiße"), say: tx("Gastric juice digests mainly proteins with pepsin.", "Der Magensaft verdaut vor allem Eiweiße mit Pepsin.") },
    ],
    hint: tx("It flows into the duodenum through a duct from a gland below the stomach.", "Er fließt über einen Gang aus einer Drüse unter dem Magen in den Zwölffingerdarm."),
    note: tx("The **pancreatic juice** contains amylase, trypsin and lipase, plus hydrogen carbonate against the acid.", "Der **Bauchspeichel** enthält Amylase, Trypsin und Lipase, dazu Hydrogencarbonat gegen die Säure."),
  },
  {
    q: tx("Which is NOT a job of the hydrochloric acid in the stomach?", "Was ist KEINE Aufgabe der Salzsäure im Magen?"),
    opts: [
      { text: tx("splitting fats into fatty acids", "Fette in Fettsäuren spalten") },
      { text: tx("killing germs", "Keime abtöten"), title: tx("That's one of its jobs", "Das macht sie"), say: tx("Killing germs is one of its main jobs: the acid protects you from bacteria in the food.", "Keime abtöten ist eine Hauptaufgabe: Die Säure schützt dich vor Bakterien im Essen.") },
      { text: tx("activating pepsin", "Pepsin aktivieren"), title: tx("That's one of its jobs", "Das macht sie"), say: tx("Pepsin is released inactive and only becomes active in the acid. So that's a job of the acid.", "Pepsin wird inaktiv abgegeben und erst in der Säure aktiv. Das ist also eine Aufgabe der Säure.") },
      { text: tx("unfolding (denaturing) proteins", "Eiweiße entfalten (denaturieren)"), title: tx("That's one of its jobs", "Das macht sie"), say: tx("The acid does unfold proteins, which makes them easier for pepsin to cut.", "Die Säure entfaltet tatsächlich Eiweiße, damit Pepsin sie leichter schneiden kann.") },
    ],
    hint: tx("Three of them really happen in the stomach.", "Drei davon passieren wirklich im Magen."),
    note: tx("Hydrochloric acid kills germs, denatures proteins and activates pepsin. **Fats** are split later by lipase in the small intestine.", "Salzsäure tötet Keime, denaturiert Eiweiße und aktiviert Pepsin. **Fette** spaltet erst die Lipase im Dünndarm."),
  },
  {
    q: tx("Why doesn't the stomach digest itself?", "Warum verdaut sich der Magen nicht selbst?"),
    opts: [
      { text: tx("A layer of mucus protects its wall.", "Eine Schleimschicht schützt seine Wand.") },
      { text: tx("The stomach contains no enzymes.", "Der Magen enthält keine Enzyme."), title: tx("It does: pepsin", "Doch: Pepsin"), say: tx("The stomach does make an enzyme: pepsin. Its wall is protected by mucus.", "Der Magen bildet sehr wohl ein Enzym: Pepsin. Seine Wand ist durch Schleim geschützt.") },
      { text: tx("The acid is too weak.", "Die Säure ist zu schwach."), title: tx("It's very strong", "Sie ist sehr stark"), say: tx("Gastric juice has a pH of 1 to 2: very strong. The wall needs protection by mucus.", "Magensaft hat einen pH-Wert von 1 bis 2: sehr stark. Die Wand braucht den Schutz durch Schleim.") },
      { text: tx("Bile neutralises the acid in the stomach.", "Galle neutralisiert die Säure im Magen."), title: tx("Bile acts later", "Galle wirkt später"), say: tx("Bile only flows into the small intestine. In the stomach mucus protects the wall.", "Galle fließt erst in den Dünndarm. Im Magen schützt Schleim die Wand.") },
    ],
    hint: tx("Something slimy is involved.", "Es hat mit etwas Schleimigem zu tun."),
    note: tx("**Mucus** covers the stomach wall and keeps acid and pepsin away from it.", "**Schleim** bedeckt die Magenwand und hält Säure und Pepsin von ihr fern."),
  },
  {
    q: tx("What does bile do?", "Was macht die Galle?"),
    opts: [
      { text: tx("It emulsifies fat into tiny droplets.", "Sie emulgiert Fett zu winzigen Tröpfchen.") },
      { text: tx("It splits fat into glycerol and fatty acids.", "Sie spaltet Fett in Glycerin und Fettsäuren."), title: tx("Bile is not an enzyme", "Galle ist kein Enzym"), say: tx("Classic trap! Bile is **not an enzyme** and splits nothing. It emulsifies the fat, so lipase can work on a bigger surface.", "Die klassische Falle! Galle ist **kein Enzym** und spaltet nichts. Sie emulgiert das Fett, damit die Lipase an einer größeren Oberfläche arbeiten kann.") },
      { text: tx("It digests proteins in the stomach.", "Sie verdaut Eiweiße im Magen."), title: tx("Wrong place and job", "Falscher Ort, falsche Aufgabe"), say: tx("Bile flows into the small intestine and helps with fats, not proteins.", "Galle fließt in den Dünndarm und hilft bei Fetten, nicht bei Eiweißen.") },
      { text: tx("It takes water back from the faeces.", "Sie entzieht dem Kot Wasser."), title: tx("That's the large intestine", "Das ist der Dickdarm"), say: tx("Taking back water is the job of the large intestine.", "Wasser zurückholen ist die Aufgabe des Dickdarms.") },
    ],
    hint: tx("Think of washing-up liquid on a greasy plate.", "Denk an Spülmittel auf einem fettigen Teller."),
    note: tx("Bile **emulsifies** fat: big drops become tiny droplets with a much bigger surface. Then lipase can split them quickly.", "Galle **emulgiert** Fett: Aus großen Tropfen werden winzige Tröpfchen mit viel größerer Oberfläche. Dann kann die Lipase sie schnell spalten."),
  },
];

function questionTask(rng: Rng, bank: Q[], instruction: Text): Exercise {
  const qq = rng.pick(bank);
  const c = choice(rng, qq.opts);
  return { instruction, text: qq.q, answer: c.answer, hint: qq.hint, solution: [{ math: quote(qq.opts[0].text), note: qq.note }], mistakes: c.mistakes };
}

// Enzyme ↔ what it does
type Enz = "amylase" | "maltase" | "pepsin" | "trypsin" | "peptidase" | "lipase" | "bile";
const ENZ: Record<Enz, { name: Text; does: Text; from: Text }> = {
  amylase: { name: tx("amylase", "Amylase"), does: tx("starch → maltose", "Stärke → Maltose"), from: tx("saliva and pancreas", "Speichel und Bauchspeichel") },
  maltase: { name: tx("maltase", "Maltase"), does: tx("maltose → glucose", "Maltose → Glucose"), from: tx("small intestine wall", "Dünndarmwand") },
  pepsin: { name: tx("pepsin", "Pepsin"), does: tx("proteins → peptides, in the stomach", "Eiweiße → Peptide, im Magen"), from: tx("stomach", "Magen") },
  trypsin: { name: tx("trypsin", "Trypsin"), does: tx("proteins → peptides, in the small intestine", "Eiweiße → Peptide, im Dünndarm"), from: tx("pancreas", "Bauchspeichel") },
  peptidase: { name: tx("peptidases", "Peptidasen"), does: tx("peptides → amino acids", "Peptide → Aminosäuren"), from: tx("small intestine wall", "Dünndarmwand") },
  lipase: { name: tx("lipase", "Lipase"), does: tx("fats → glycerol + fatty acids", "Fette → Glycerin + Fettsäuren"), from: tx("pancreas", "Bauchspeichel") },
  bile: { name: tx("bile", "Galle"), does: tx("emulsifies fat (no enzyme)", "emulgiert Fett (kein Enzym)"), from: tx("liver, gall bladder", "Leber, Gallenblase") },
};

function enzymeMatchExercise(ids: Enz[], extra?: Enz): Exercise {
  const has = (e: Enz) => ids.includes(e);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("bile") && has("lipase"))
    wrong.push({ pairs: [[ENZ.bile.name, ENZ.lipase.does]], title: tx("Bile is not an enzyme", "Galle ist kein Enzym"), say: tx("Classic trap! Bile only **emulsifies** fat. Splitting it into glycerol and fatty acids is the job of lipase.", "Die klassische Falle! Galle **emulgiert** Fett nur. Spalten in Glycerin und Fettsäuren macht die Lipase.") });
  if (has("amylase") && has("maltase"))
    wrong.push({ pairs: [[ENZ.amylase.name, ENZ.maltase.does]], title: tx("One step too far", "Ein Schritt zu weit"), say: tx("Amylase stops at maltose. The last step to glucose is done by maltase.", "Amylase hört bei Maltose auf. Den letzten Schritt zur Glucose macht die Maltase.") });
  if (has("pepsin") && has("trypsin"))
    wrong.push({ pairs: [[ENZ.pepsin.name, ENZ.trypsin.does]], title: tx("Stomach or small intestine?", "Magen oder Dünndarm?"), say: tx("Both cut proteins, but pepsin works in the acidic **stomach**, trypsin in the small intestine.", "Beide schneiden Eiweiße, aber Pepsin arbeitet im sauren **Magen**, Trypsin im Dünndarm.") });
  if (has("pepsin") && has("amylase"))
    wrong.push({ pairs: [[ENZ.pepsin.name, ENZ.amylase.does]], title: tx("Enzymes are specific", "Enzyme sind spezifisch"), say: tx("Pepsin only fits proteins. Starch is cut by amylase.", "Pepsin passt nur zu Eiweißen. Stärke schneidet die Amylase.") });
  return matchTask({
    instruction: tx("Match the enzyme to its job", "Ordne jedem Enzym seine Aufgabe zu"),
    text: tx("What does each one do?", "Was macht welches?"),
    pairs: ids.map((e) => [ENZ[e].name, ENZ[e].does] as [Text, Text]),
    distractors: extra ? [ENZ[extra].does] : undefined,
    hint: tx("The name often gives away the substrate: amyl- (starch), malt- (maltose), lip- (fat), pept- (peptides).", "Der Name verrät oft das Substrat: Amyl- (Stärke), Malt- (Maltose), Lip- (Fett), Pept- (Peptide)."),
    solution: ids.map((e) => ({ math: tx(`"${en(ENZ[e].name)}"`, `"${de(ENZ[e].name)}"`), note: tx(`${en(ENZ[e].name)} (${en(ENZ[e].from)}): ${en(ENZ[e].does)}`, `${de(ENZ[e].name)} (${de(ENZ[e].from)}): ${de(ENZ[e].does)}`) })),
    wrong,
  });
}

function enzymeMatchTask(rng: Rng): Exercise {
  const all: Enz[] = ["amylase", "maltase", "pepsin", "trypsin", "peptidase", "lipase", "bile"];
  const ids = pickN(rng, all, rng.int(3, 4));
  const rest = all.filter((e) => !ids.includes(e));
  return enzymeMatchExercise(rng.shuffle(ids), rng.chance(0.7) ? rng.pick(rest) : undefined);
}

// Building blocks as a word
type BlockQ = { q: Text; accept: Text[]; wrong: [Text[], Text, Text, boolean?][]; note: Text };
const BLOCK_QS: BlockQ[] = [
  {
    q: tx("Starch is fully digested into which building block?", "In welchen Baustein wird Stärke vollständig zerlegt?"),
    accept: [tx("glucose", "Glucose"), "Traubenzucker", "Glukose", "dextrose"],
    wrong: [
      [[tx("maltose", "Maltose"), "Malzzucker"], tx("Intermediate step", "Zwischenschritt"), tx("Nearly! Maltose is the intermediate step after amylase. Maltase splits it once more.", "Fast! Maltose ist der Zwischenschritt nach der Amylase. Die Maltase spaltet sie noch einmal."), true],
      [[tx("amino acids", "Aminosäuren"), "Aminosäure"], tx("Wrong nutrient", "Falscher Nährstoff"), tx("Amino acids come from proteins. Starch is a chain of sugar units.", "Aminosäuren kommen aus Eiweißen. Stärke ist eine Kette aus Zucker-Einheiten.")],
    ],
    note: tx("Starch → maltose → **glucose**.", "Stärke → Maltose → **Glucose**."),
  },
  {
    q: tx("Proteins are digested into which building blocks?", "In welche Bausteine werden Eiweiße zerlegt?"),
    accept: [tx("amino acids", "Aminosäuren"), "Aminosäure", "amino acid"],
    wrong: [
      [[tx("peptides", "Peptide"), "Peptid"], tx("Intermediate step", "Zwischenschritt"), tx("Nearly! Peptides are the short chains in between. Peptidases split them into single building blocks.", "Fast! Peptide sind die kurzen Ketten dazwischen. Peptidasen spalten sie in einzelne Bausteine."), true],
      [[tx("glucose", "Glucose"), "Traubenzucker"], tx("Wrong nutrient", "Falscher Nährstoff"), tx("Glucose is the building block of starch. Proteins are chains of a different kind.", "Glucose ist der Baustein der Stärke. Eiweiße sind Ketten aus einer anderen Sorte Baustein.")],
    ],
    note: tx("Proteins → peptides → **amino acids**.", "Eiweiße → Peptide → **Aminosäuren**."),
  },
  {
    q: tx("Lipase splits fats into glycerol and … ?", "Lipase spaltet Fette in Glycerin und … ?"),
    accept: [tx("fatty acids", "Fettsäuren"), "Fettsäure", "fatty acid"],
    wrong: [[[tx("amino acids", "Aminosäuren")], tx("Wrong nutrient", "Falscher Nährstoff"), tx("Amino acids are the building blocks of proteins. A fat molecule has three long chains of a different kind.", "Aminosäuren sind die Bausteine der Eiweiße. Ein Fettmolekül hat drei lange Ketten einer anderen Sorte.")]],
    note: tx("Fat → glycerol + three **fatty acids**.", "Fett → Glycerin + drei **Fettsäuren**."),
  },
  {
    q: tx("Which double sugar does amylase produce from starch?", "Welchen Zweifachzucker stellt Amylase aus Stärke her?"),
    accept: [tx("maltose", "Maltose"), "Malzzucker"],
    wrong: [[[tx("glucose", "Glucose"), "Traubenzucker"], tx("That's the end product", "Das ist das Endprodukt"), tx("Glucose is a single sugar and comes one step later, from maltase. Amylase produces pieces of two units.", "Glucose ist ein Einfachzucker und kommt einen Schritt später, von der Maltase. Amylase macht Stücke aus zwei Einheiten.")]],
    note: tx("Amylase: starch → **maltose** (malt sugar).", "Amylase: Stärke → **Maltose** (Malzzucker)."),
  },
  {
    q: tx("Which enzyme splits maltose into glucose?", "Welches Enzym spaltet Maltose in Glucose?"),
    accept: [tx("maltase", "Maltase")],
    wrong: [[[tx("amylase", "Amylase")], tx("One step before", "Einen Schritt davor"), tx("Amylase makes the maltose. The enzyme that splits maltose is named after it.", "Amylase stellt die Maltose her. Das Enzym, das Maltose spaltet, ist nach ihr benannt."), true]],
    note: tx("**Maltase** (from the small intestine wall): maltose → 2 glucose.", "**Maltase** (aus der Dünndarmwand): Maltose → 2 Glucose."),
  },
  {
    q: tx("Which liquid from the liver emulsifies fats?", "Welche Flüssigkeit aus der Leber emulgiert Fette?"),
    accept: [tx("bile", "Galle"), "Gallensaft", "Gallenflüssigkeit"],
    wrong: [[[tx("lipase", "Lipase")], tx("That one splits", "Die spaltet"), tx("Lipase splits fat and comes from the pancreas. The emulsifier from the liver is no enzyme.", "Lipase spaltet Fett und kommt aus der Bauchspeicheldrüse. Der Emulgator aus der Leber ist kein Enzym.")]],
    note: tx("**Bile** emulsifies fats. It is made by the liver and stored in the gall bladder.", "**Galle** emulgiert Fette. Sie wird in der Leber gebildet und in der Gallenblase gespeichert."),
  },
];

function blockTask(rng: Rng): Exercise {
  const b = rng.pick(BLOCK_QS);
  const right = word(b.accept);
  const m = mistakes(right);
  for (const [acc, title, say, close] of b.wrong) m.add(word(acc), title, say, close);
  return {
    instruction: tx("Name it", "Benenne"),
    text: b.q,
    answer: right,
    hint: tx("Starch → maltose → glucose; protein → peptides → amino acids; fat → glycerol + fatty acids.", "Stärke → Maltose → Glucose; Eiweiß → Peptide → Aminosäuren; Fett → Glycerin + Fettsäuren."),
    solution: [{ math: quote(b.accept[0]), note: b.note }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Processes in order

type Seq = { intro: Text; steps: Text[]; wrong: { a: number; b: number; title: Text; say: Text }[]; note: Text };

const SEQS: Seq[] = [
  {
    intro: tx("Put the steps of **fat** digestion in order.", "Bring die Schritte der **Fettverdauung** in die richtige Reihenfolge."),
    steps: [
      tx("A fatty meal reaches the duodenum.", "Ein fettreicher Speisebrei erreicht den Zwölffingerdarm."),
      tx("Bile emulsifies the fat into tiny droplets.", "Galle emulgiert das Fett zu winzigen Tröpfchen."),
      tx("Lipase splits the fat into glycerol and fatty acids.", "Lipase spaltet das Fett in Glycerin und Fettsäuren."),
      tx("The building blocks enter the cells of the villi.", "Die Bausteine gelangen in die Zellen der Darmzotten."),
      tx("They are passed on into the lymph vessel.", "Sie werden an das Lymphgefäß weitergegeben."),
    ],
    wrong: [{ a: 2, b: 1, title: tx("Emulsify first", "Erst emulgieren"), say: tx("Lipase can only attack the surface of a fat drop. Bile has to make the droplets first.", "Die Lipase kann nur an der Oberfläche eines Fetttropfens angreifen. Erst muss die Galle Tröpfchen daraus machen.") }],
    note: tx("Emulsify (bile), split (lipase), absorb into the villi, then into the lymph.", "Emulgieren (Galle), spalten (Lipase), in die Zotten aufnehmen, dann in die Lymphe."),
  },
  {
    intro: tx("Put the steps of **protein** digestion in order.", "Bring die Schritte der **Eiweißverdauung** in die richtige Reihenfolge."),
    steps: [
      tx("Hydrochloric acid in the stomach unfolds the proteins.", "Salzsäure im Magen entfaltet die Eiweiße."),
      tx("Pepsin cuts the proteins into peptides.", "Pepsin spaltet die Eiweiße in Peptide."),
      tx("Trypsin from the pancreas cuts the peptides further.", "Trypsin aus dem Bauchspeichel zerlegt die Peptide weiter."),
      tx("Peptidases of the gut wall split off amino acids.", "Peptidasen der Darmwand spalten Aminosäuren ab."),
      tx("The amino acids pass into the blood.", "Die Aminosäuren gelangen ins Blut."),
    ],
    wrong: [
      { a: 2, b: 1, title: tx("Stomach first", "Erst der Magen"), say: tx("Food reaches the stomach before the small intestine: pepsin comes first, then trypsin.", "Die Nahrung erreicht den Magen vor dem Dünndarm: Erst kommt Pepsin, dann Trypsin.") },
      { a: 4, b: 3, title: tx("Only building blocks pass", "Nur Bausteine passen durch"), say: tx("Only single amino acids (and very short peptides) can pass into the blood. They must be split first.", "Nur einzelne Aminosäuren (und sehr kurze Peptide) gelangen ins Blut. Erst muss gespalten werden.") },
    ],
    note: tx("Stomach: acid and pepsin. Small intestine: trypsin, then peptidases. Then into the blood.", "Magen: Säure und Pepsin. Dünndarm: Trypsin, dann Peptidasen. Dann ins Blut."),
  },
  {
    intro: tx("Put the steps of **starch** digestion in order.", "Bring die Schritte der **Stärkeverdauung** in die richtige Reihenfolge."),
    steps: [
      tx("Saliva amylase begins to cut starch.", "Die Amylase im Speichel beginnt, Stärke zu spalten."),
      tx("The stomach acid stops the saliva amylase.", "Die Magensäure stoppt die Speichel-Amylase."),
      tx("Amylase from the pancreas cuts the rest into maltose.", "Amylase aus dem Bauchspeichel spaltet den Rest in Maltose."),
      tx("Maltase splits maltose into glucose.", "Maltase spaltet Maltose in Glucose."),
      tx("Glucose passes into the blood.", "Glucose gelangt ins Blut."),
    ],
    wrong: [
      { a: 3, b: 2, title: tx("Maltose comes first", "Erst muss Maltose da sein"), say: tx("Maltase needs maltose, and maltose is only made by amylase.", "Maltase braucht Maltose, und die entsteht erst durch die Amylase.") },
      { a: 1, b: 0, title: tx("Mouth first", "Erst der Mund"), say: tx("Starch digestion starts in the mouth. The stomach acid only stops it afterwards.", "Die Stärkeverdauung beginnt im Mund. Die Magensäure stoppt sie erst danach.") },
    ],
    note: tx("Mouth (amylase), stomach (pause), small intestine (amylase, maltase), blood.", "Mund (Amylase), Magen (Pause), Dünndarm (Amylase, Maltase), Blut."),
  },
  {
    intro: tx("Put the stations in order of the food's way.", "Bring die Stationen in die Reihenfolge des Nahrungswegs."),
    steps: [
      tx("mouth: amylase", "Mund: Amylase"),
      tx("stomach: hydrochloric acid and pepsin", "Magen: Salzsäure und Pepsin"),
      tx("duodenum: pancreatic juice and bile", "Zwölffingerdarm: Bauchspeichel und Galle"),
      tx("rest of the small intestine: absorption through the villi", "übriger Dünndarm: Resorption über die Zotten"),
      tx("large intestine: water is taken back", "Dickdarm: Wasser wird zurückgeholt"),
    ],
    wrong: [
      { a: 4, b: 3, title: tx("Small before large", "Dünn- vor Dickdarm"), say: tx("The small intestine comes first, the large intestine only takes back water at the end.", "Der Dünndarm kommt zuerst, der Dickdarm holt am Ende nur noch Wasser zurück.") },
      { a: 2, b: 1, title: tx("Stomach first", "Erst der Magen"), say: tx("From the oesophagus the food goes into the stomach. The duodenum follows the pylorus.", "Aus der Speiseröhre kommt die Nahrung in den Magen. Der Zwölffingerdarm folgt nach dem Magenpförtner.") },
    ],
    note: tx("Mouth, stomach, duodenum, rest of the small intestine, large intestine.", "Mund, Magen, Zwölffingerdarm, übriger Dünndarm, Dickdarm."),
  },
];

function seqTask(rng: Rng): Exercise {
  const s = rng.pick(SEQS);
  // 4 or 5 steps, keeping their order
  const drop = rng.chance(0.5) ? rng.int(0, s.steps.length - 1) : -1;
  const keep = s.steps.map((_, i) => i).filter((i) => i !== drop);
  const items = keep.map((i) => s.steps[i]);
  return orderTask({
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: s.intro,
    items,
    hint: tx("Follow the food from the mouth. Enzymes can only split what the step before has prepared.", "Folge der Nahrung vom Mund aus. Enzyme können nur spalten, was der Schritt davor vorbereitet hat."),
    solution: [...items.map((it, k): Frame => ({ math: `${k + 1}`, note: it })), { math: tx('"done"', '"fertig"'), note: s.note }],
    wrong: s.wrong.filter((w) => keep.includes(w.a) && keep.includes(w.b)).map((w) => ({ items: [s.steps[w.a], s.steps[w.b]], title: w.title, say: w.say })),
  });
}

// ---------------------------------------------------------------------------
// Absorption

const ABSORB_QS: Q[] = [
  {
    q: tx("Why does the small intestine have folds, villi and microvilli?", "Wozu hat der Dünndarm Falten, Zotten und Mikrovilli?"),
    opts: [
      { text: tx("They make the surface for absorption much bigger.", "Sie vergrößern die Oberfläche für die Resorption stark.") },
      { text: tx("They cut the food into small pieces.", "Sie zerkleinern die Nahrung."), title: tx("No teeth in the gut", "Im Darm gibt's keine Zähne"), say: tx("Cutting is done by teeth and enzymes. Folds and villi create **surface**.", "Zerkleinern machen Zähne und Enzyme. Falten und Zotten schaffen **Oberfläche**.") },
      { text: tx("They store the digestive enzymes.", "Sie speichern die Verdauungsenzyme."), title: tx("Not a store", "Kein Speicher"), say: tx("Villi aren't stores. The more surface, the more building blocks can pass into the blood at once.", "Zotten sind keine Speicher. Je mehr Oberfläche, desto mehr Bausteine gelangen gleichzeitig ins Blut.") },
      { text: tx("They slow the chyme down so it doesn't leave too fast.", "Sie bremsen den Brei, damit er nicht zu schnell weiterfließt."), title: tx("Surface is the point", "Es geht um Oberfläche"), say: tx("The point is the huge surface: the principle of surface enlargement.", "Der Sinn ist die riesige Oberfläche: das Prinzip der Oberflächenvergrößerung.") },
    ],
    hint: tx("Biology principle: structure and function. Think of a towel with many loops.", "Biologisches Prinzip: Struktur und Funktion. Denk an ein Handtuch mit vielen Schlaufen."),
    note: tx("Folds, villi and microvilli multiply the surface (about 3 × 10 × 20 = 600-fold): **surface enlargement** for fast absorption.", "Falten, Zotten und Mikrovilli vervielfachen die Oberfläche (etwa 3 · 10 · 20 = 600-fach): **Oberflächenvergrößerung** für schnelle Resorption."),
  },
  {
    q: tx("Where do the fat building blocks go after absorption?", "Wohin gelangen die Fettbausteine nach der Resorption?"),
    opts: [
      { text: tx("into the lymph vessel of the villus", "in das Lymphgefäß der Zotte") },
      { text: tx("directly into the blood capillaries", "direkt in die Blutkapillaren"), title: tx("That's glucose and amino acids", "Das sind Glucose und Aminosäuren"), say: tx("Glucose and amino acids go into the blood capillaries. Fats are packed into droplets that take the **lymph**.", "Glucose und Aminosäuren gehen in die Blutkapillaren. Fette werden in Tröpfchen verpackt und nehmen den Weg über die **Lymphe**.") },
      { text: tx("into the large intestine", "in den Dickdarm"), title: tx("Absorbed means: inside the body", "Resorbiert heißt: im Körper"), say: tx("Absorbed building blocks have left the gut. They travel on in the body, in the lymph.", "Resorbierte Bausteine haben den Darm verlassen. Sie reisen im Körper weiter, in der Lymphe.") },
      { text: tx("into the gall bladder", "in die Gallenblase"), title: tx("Bile only flows out", "Galle fließt nur hinaus"), say: tx("The gall bladder only releases bile into the gut. Fat building blocks go into the lymph.", "Die Gallenblase gibt nur Galle in den Darm ab. Fettbausteine gehen in die Lymphe.") },
    ],
    hint: tx("In the middle of each villus there is a vessel that isn't a blood vessel.", "In der Mitte jeder Zotte liegt ein Gefäß, das kein Blutgefäß ist."),
    note: tx("Fat building blocks go into the central **lymph vessel**. Glucose and amino acids go into the blood capillaries.", "Fettbausteine gehen in das zentrale **Lymphgefäß**. Glucose und Aminosäuren gehen in die Blutkapillaren."),
  },
  {
    q: tx("What is the main job of the large intestine?", "Was ist die Hauptaufgabe des Dickdarms?"),
    opts: [
      { text: tx("taking water and minerals back", "Wasser und Mineralstoffe zurückholen") },
      { text: tx("absorbing glucose and amino acids", "Glucose und Aminosäuren aufnehmen"), title: tx("That's the small intestine", "Das ist der Dünndarm"), say: tx("The nutrients are absorbed earlier, in the small intestine. The large intestine takes back water.", "Die Nährstoffe werden vorher im Dünndarm resorbiert. Der Dickdarm holt Wasser zurück.") },
      { text: tx("splitting fats with bile", "Fette mit Galle spalten"), title: tx("Bile doesn't split", "Galle spaltet nicht"), say: tx("Bile only emulsifies, and it works in the small intestine.", "Galle emulgiert nur, und sie wirkt im Dünndarm.") },
      { text: tx("starting protein digestion", "die Eiweißverdauung beginnen"), title: tx("That's the stomach", "Das ist der Magen"), say: tx("Protein digestion starts in the stomach with pepsin.", "Die Eiweißverdauung beginnt im Magen mit Pepsin.") },
    ],
    hint: tx("Without it, faeces would be liquid.", "Ohne ihn wäre der Kot flüssig."),
    note: tx("The **large intestine** takes back water and minerals. Gut bacteria live there too.", "Der **Dickdarm** holt Wasser und Mineralstoffe zurück. Dort leben auch die Darmbakterien."),
  },
];

function surfaceTask(rng: Rng): Exercise {
  const base = rng.pick([0.3, 0.4, 0.5]);
  const [f, v, mv] = [rng.pick([3, 3]), rng.pick([8, 10]), rng.pick([15, 20, 25])];
  const factor = f * v * mv;
  const area = Math.round(base * factor * 10) / 10;
  const right = num(area, 0.01, "m²");
  const m = mistakes(right);
  m.add(num(Math.round(base * (f + v + mv) * 100) / 100, 0.01, "m²"), tx("Added the factors", "Faktoren addiert"), tx("Ah, you added the factors. But each step enlarges the surface that is already there, so they multiply.", "Ah, du hast die Faktoren addiert. Jeder Schritt vergrößert aber die schon vorhandene Fläche, also wird multipliziert."));
  m.add(num(factor, 0.01, "m²"), tx("That's the factor", "Das ist der Faktor"), tx(`${factor} is how many times bigger. Multiply it by the area of the smooth tube.`, `${factor} ist das „Wievielfache“. Multipliziere noch mit der Fläche des glatten Rohres.`));
  m.add(num(Math.round(base * f * v * 10) / 10, 0.01, "m²"), tx("Microvilli forgotten", "Mikrovilli vergessen"), tx("Nearly! The microvilli on every cell enlarge the surface once more.", "Fast! Die Mikrovilli auf jeder Zelle vergrößern die Fläche noch einmal."));
  const B = (l: "en" | "de") => dec(base, l, 1);
  return {
    instruction: tx("Surface enlargement", "Oberflächenvergrößerung"),
    text: txMap((t, l) =>
      t(
        `Model calculation: a smooth tube as long as the small intestine would have an inner surface of ${B(l)} m². Folds enlarge it ${f}-fold, villi ${v}-fold and microvilli ${mv}-fold. How big is the surface?`,
        `Modellrechnung: Ein glattes Rohr so lang wie der Dünndarm hätte innen ${B(l)} m² Fläche. Falten vergrößern sie ${f}-fach, Zotten ${v}-fach und Mikrovilli ${mv}-fach. Wie groß ist die Oberfläche?`,
      ),
    ),
    answer: right,
    hint: tx("Each enlargement acts on the surface before it: multiply.", "Jede Vergrößerung wirkt auf die Fläche davor: multiplizieren."),
    solution: [
      { math: `${f} \\cdot ${v} \\cdot ${mv} = ${factor}`, note: tx(`Together the surface becomes ${factor} times bigger.`, `Zusammen wird die Fläche ${factor}-mal so groß.`) },
      { math: txMap((_, l) => `${dec(base, l, 1)} "m²" \\cdot ${factor} = ${dec(area, l, 1)} "m²"`), note: tx("A huge surface for absorption: the principle of surface enlargement.", "Eine riesige Fläche für die Resorption: das Prinzip der Oberflächenvergrößerung.") },
    ],
    mistakes: m.list,
  };
}

function villusPartTask(rng: Rng): Exercise {
  const ids: VillusPart[] = ["villus", "microvilli", "blood", "lymph", "epithelium"];
  const id = rng.pick(ids);
  const part = VILLUS_PARTS.find((p) => p.id === id)!;
  const others = rng.shuffle(ids.filter((x) => x !== id)).slice(0, 3);
  const why: Partial<Record<VillusPart, Text>> = {
    blood: tx("The red and blue vessels are the blood capillaries. The pale one in the middle is the lymph vessel.", "Die roten und blauen Gefäße sind Blutkapillaren. Das helle in der Mitte ist das Lymphgefäß."),
    lymph: tx("The pale vessel in the middle is the lymph vessel. Blood vessels are red and blue.", "Das helle Gefäß in der Mitte ist das Lymphgefäß. Blutgefäße sind rot und blau."),
    microvilli: tx("The tiny fingers on top of each cell are the microvilli, the brush border.", "Die winzigen Finger oben auf jeder Zelle sind die Mikrovilli, der Bürstensaum."),
    villus: tx("The whole finger-shaped fold is the villus.", "Die ganze fingerförmige Ausstülpung ist die Zotte."),
    epithelium: tx("The tall cell in the zoom is an epithelial cell of the gut lining.", "Die hohe Zelle in der Vergrößerung ist eine Epithelzelle der Darmschleimhaut."),
  };
  const c = choice(rng, [{ text: part.label }, ...others.map((o) => ({ text: VILLUS_PARTS.find((p) => p.id === o)!.label, title: tx("Look closely", "Genau hinschauen"), say: why[id]! }))]);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("What is the structure marked with **?** called?", "Wie heißt die mit **?** markierte Struktur?"),
    visual: { component: DigestionVillus as never, props: { mode: "numbers", ask: id, legend: "none", show: [id] } },
    answer: c.answer,
    hint: tx("Blood is red and blue, lymph is pale. Microvilli are the tiny fingers on the cells.", "Blut ist rot und blau, Lymphe hell. Mikrovilli sind die winzigen Finger auf den Zellen."),
    solution: [{ math: quote(part.label), note: part.info ?? part.label }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Food tests

const NUT: Record<FoodTest, Text> = { iodine: tx("starch", "Stärke"), strip: tx("glucose", "Glucose"), biuret: tx("protein", "Eiweiß"), grease: tx("fat", "Fett") };
const TEST_ORDER: FoodTest[] = ["iodine", "strip", "biuret", "grease"];
const NEG: Record<FoodTest, Text> = {
  iodine: tx("the iodine stayed brown-yellow", "Das Iod ist gelbbraun geblieben"),
  strip: tx("the test strip stayed yellow", "Der Teststreifen ist gelb geblieben"),
  biuret: tx("the biuret solution stayed blue", "Die Biuret-Lösung ist blau geblieben"),
  grease: tx("the spot dried away", "Der Fleck ist weggetrocknet"),
};
const negSay = (t: FoodTest): Text => tx(`Look again: ${en(NEG[t])}. So there's no ${en(NUT[t])} in it.`, `Schau noch mal: ${de(NEG[t])}. Also kein Nachweis von ${de(NUT[t])}.`);

/** Unknown samples with their real composition. */
const SAMPLES: { has: FoodTest[] }[] = [
  { has: ["iodine"] },
  { has: ["strip"] },
  { has: ["biuret"] },
  { has: ["grease"] },
  { has: ["biuret", "grease"] },
  { has: ["iodine", "biuret"] },
  { has: ["strip", "grease"] },
  { has: ["iodine", "strip"] },
  { has: ["iodine", "grease"] },
  { has: ["iodine", "biuret", "grease"] },
];

function testResultsTask(rng: Rng): Exercise {
  const s = rng.pick(SAMPLES);
  const tests = rng.chance(0.5) ? TEST_ORDER : rng.shuffle(TEST_ORDER);
  const results: [FoodTest, boolean][] = tests.map((t) => [t, s.has.includes(t)]);
  // fixed order of nutrient options (starch, glucose, protein, fat) reads best
  const options = TEST_ORDER.map((t) => NUT[t]);
  const correct = TEST_ORDER.map((t, i) => (s.has.includes(t) ? i : -1)).filter((i) => i >= 0);
  const mu = {
    answer: { kind: "multi", options, correct } as AnswerSpec,
    mistakes: TEST_ORDER.map((t, i) => [t, i] as const)
      .filter(([t]) => !s.has.includes(t))
      .map(([t, i]) => ({ when: { kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) } as AnswerSpec, title: tx("That test was negative", "Dieser Nachweis war negativ"), say: negSay(t) })),
  };
  return {
    instruction: tx("Evaluate the food tests", "Werte die Nachweise aus"),
    text: tx("An unknown food sample was tested. Which nutrients does it contain? Select all.", "Eine unbekannte Lebensmittelprobe wurde untersucht. Welche Nährstoffe enthält sie? Wähle alle."),
    visual: { component: DigestionTestResults as never, props: { results } },
    answer: mu.answer,
    hint: tx("Iodine blue-black: starch. Strip green: glucose. Biuret violet: protein. Grease spot stays: fat.", "Iod blau-schwarz: Stärke. Streifen grün: Glucose. Biuret violett: Eiweiß. Fettfleck bleibt: Fett."),
    solution: results.map(([t, pos]) => ({
      math: tx(`"${en(TESTS[t].short)} test:" \\; "${pos ? "+" : "–"}"`, `"${de(TESTS[t].short)}:" \\; "${pos ? "+" : "–"}"`),
      note: tx(`${en(TESTS[t].name)}: ${en(pos ? TESTS[t].plus : TESTS[t].minus)}, so ${pos ? "" : "no "}${en(NUT[t])}.`, `${de(TESTS[t].name)}: ${de(pos ? TESTS[t].plus : TESTS[t].minus)}, also ${pos ? "" : "kein Nachweis von "}${de(NUT[t])}.`),
    })),
    mistakes: mu.mistakes,
  };
}

const TEST_QS: Q[] = [
  {
    q: tx("You put iodine solution on a slice of potato. What do you see?", "Du gibst Iod-Kaliumiodid-Lösung auf eine Kartoffelscheibe. Was siehst du?"),
    opts: [
      { text: tx("It turns blue-black.", "Sie färbt sich blau-schwarz.") },
      { text: tx("It turns violet.", "Sie färbt sich violett."), title: tx("That's biuret", "Das ist Biuret"), say: tx("Violet is the biuret test for protein. Iodine with starch turns blue-black.", "Violett zeigt die Biuret-Probe bei Eiweiß. Iod mit Stärke wird blau-schwarz.") },
      { text: tx("It turns brick red.", "Sie färbt sich ziegelrot."), title: tx("That's Fehling", "Das ist Fehling"), say: tx("Brick red is Fehling's test for glucose (after heating). Iodine with starch turns blue-black.", "Ziegelrot zeigt die Fehling-Probe bei Glucose (nach dem Erhitzen). Iod mit Stärke wird blau-schwarz.") },
      { text: tx("It stays brown-yellow.", "Sie bleibt gelbbraun."), title: tx("Potatoes are full of starch", "Kartoffeln sind voller Stärke"), say: tx("That would be negative, but potatoes are full of starch.", "Das wäre negativ, aber Kartoffeln sind voller Stärke.") },
    ],
    hint: tx("Potatoes store a lot of starch.", "Kartoffeln speichern viel Stärke."),
    note: tx("Iodine + starch → **blue-black**. Potatoes are full of starch.", "Iod + Stärke → **blau-schwarz**. Kartoffeln sind voller Stärke."),
  },
  {
    q: tx("Which test shows protein?", "Welcher Nachweis zeigt Eiweiß?"),
    opts: [
      { text: tx("the biuret test (violet)", "die Biuret-Probe (violett)") },
      { text: tx("the iodine test (blue-black)", "die Iodprobe (blau-schwarz)"), title: tx("That's starch", "Das ist Stärke"), say: tx("Iodine shows starch.", "Iod zeigt Stärke.") },
      { text: tx("Fehling's test (brick red)", "die Fehling-Probe (ziegelrot)"), title: tx("That's glucose", "Das ist Glucose"), say: tx("Fehling's test shows glucose (and other reducing sugars).", "Die Fehling-Probe zeigt Glucose (und andere reduzierende Zucker).") },
      { text: tx("the grease spot test", "die Fettfleckprobe"), title: tx("That's fat", "Das ist Fett"), say: tx("A grease spot shows fat.", "Ein Fettfleck zeigt Fett.") },
    ],
    hint: tx("Copper sulfate in alkaline solution changes colour from blue to …", "Kupfersulfat in alkalischer Lösung wechselt von blau zu …"),
    note: tx("**Biuret test**: the blue copper solution turns **violet** with protein.", "**Biuret-Probe**: Die blaue Kupferlösung wird mit Eiweiß **violett**."),
  },
  {
    q: tx("In Fehling's test, glucose solution is heated with blue Fehling's solution. What do you see?", "Bei der Fehling-Probe wird Glucoselösung mit blauer Fehling-Lösung erhitzt. Was siehst du?"),
    opts: [
      { text: tx("a brick-red precipitate", "einen ziegelroten Niederschlag") },
      { text: tx("a blue-black colour", "eine blau-schwarze Farbe"), title: tx("That's iodine", "Das ist Iod"), say: tx("Blue-black is iodine with starch.", "Blau-schwarz ist Iod mit Stärke.") },
      { text: tx("a violet colour", "eine violette Farbe"), title: tx("That's biuret", "Das ist Biuret"), say: tx("Violet is the biuret test for protein.", "Violett ist die Biuret-Probe auf Eiweiß.") },
      { text: tx("no change at all", "gar keine Veränderung"), title: tx("Glucose reacts", "Glucose reagiert"), say: tx("Glucose does react: that's the point of the test.", "Glucose reagiert sehr wohl: Darum geht es ja bei dem Nachweis.") },
    ],
    hint: tx("Its colour is like a roof tile.", "Die Farbe ist wie ein Dachziegel."),
    note: tx("Fehling's test: blue → **brick red** when heated with glucose.", "Fehling-Probe: blau → **ziegelrot** beim Erhitzen mit Glucose."),
  },
  {
    q: tx("Why do you also test pure water in every food test?", "Warum testet man bei jedem Nachweis auch reines Wasser?"),
    opts: [
      { text: tx("As a control: it shows what a negative result looks like.", "Als Blindprobe: Sie zeigt, wie ein negatives Ergebnis aussieht.") },
      { text: tx("Water contains a little of every nutrient.", "Wasser enthält von jedem Nährstoff etwas."), title: tx("Pure water has none", "Reines Wasser hat keine"), say: tx("Pure water contains no nutrients. That's exactly why it's the comparison.", "Reines Wasser enthält keine Nährstoffe. Genau darum ist es der Vergleich.") },
      { text: tx("To dilute the reagent.", "Um das Nachweismittel zu verdünnen."), title: tx("It's a comparison", "Es ist ein Vergleich"), say: tx("It's a separate tube for comparison, not to dilute anything.", "Es ist ein eigenes Röhrchen zum Vergleich, nicht zum Verdünnen.") },
      { text: tx("Because the test only works in water.", "Weil der Test nur in Wasser funktioniert."), title: tx("It's a comparison", "Es ist ein Vergleich"), say: tx("The water tube is a control: the comparison for a negative result.", "Das Wasser-Röhrchen ist eine Blindprobe: der Vergleich für ein negatives Ergebnis.") },
    ],
    hint: tx("In science you always need a comparison.", "In der Naturwissenschaft brauchst du immer einen Vergleich."),
    note: tx("The **control** (Blindprobe) shows the colour without the nutrient. Only then can you see a change.", "Die **Blindprobe** zeigt die Farbe ohne Nährstoff. Erst dann erkennst du eine Veränderung."),
  },
  {
    q: tx("A drop of a food leaves a see-through spot on paper that doesn't dry away. What does the food contain?", "Ein Tropfen eines Lebensmittels hinterlässt auf Papier einen durchscheinenden Fleck, der nicht wegtrocknet. Was enthält das Lebensmittel?"),
    opts: [
      { text: tx("fat", "Fett") },
      { text: tx("water", "Wasser"), title: tx("Water dries away", "Wasser trocknet weg"), say: tx("A water spot disappears when it dries. A spot that stays shows fat.", "Ein Wasserfleck verschwindet beim Trocknen. Ein Fleck, der bleibt, zeigt Fett.") },
      { text: tx("starch", "Stärke"), title: tx("That's iodine", "Das ist Iod"), say: tx("Starch is shown with iodine, not with paper.", "Stärke weist man mit Iod nach, nicht mit Papier.") },
      { text: tx("glucose", "Glucose"), title: tx("That's the strip", "Das ist der Streifen"), say: tx("Glucose is shown with a test strip or Fehling's test.", "Glucose weist man mit Teststreifen oder Fehling-Probe nach.") },
    ],
    hint: tx("Think of a greasy chip paper.", "Denk an eine fettige Pommestüte."),
    note: tx("**Grease spot test**: fat leaves a see-through spot that stays after drying.", "**Fettfleckprobe**: Fett hinterlässt einen durchscheinenden Fleck, der nach dem Trocknen bleibt."),
  },
];

// ---------------------------------------------------------------------------
// Energy

type FoodRow = { name: Text; fat: number; carbs: number; protein: number };
const NUTRITION: FoodRow[] = [
  { name: tx("Milk chocolate", "Vollmilchschokolade"), fat: 31, carbs: 57, protein: 7 },
  { name: tx("Roasted peanuts", "Geröstete Erdnüsse"), fat: 49, carbs: 12, protein: 25 },
  { name: tx("Oat flakes", "Haferflocken"), fat: 7, carbs: 59, protein: 13 },
  { name: tx("Crisps", "Kartoffelchips"), fat: 34, carbs: 50, protein: 6 },
  { name: tx("Gouda cheese", "Gouda"), fat: 29, carbs: 0, protein: 25 },
  { name: tx("Salmon", "Lachs"), fat: 13, carbs: 0, protein: 20 },
  { name: tx("Wholemeal bread", "Vollkornbrot"), fat: 1, carbs: 40, protein: 7 },
  { name: tx("Banana", "Banane"), fat: 0, carbs: 20, protein: 1 },
  { name: tx("Cereal bar", "Müsliriegel"), fat: 15, carbs: 64, protein: 7 },
  { name: tx("Low-fat quark", "Magerquark"), fat: 0, carbs: 4, protein: 12 },
];

const kjOf = (f: number, c: number, p: number) => f * KJ.fat + c * KJ.carbs + p * KJ.protein;

function energyFrames(f: number, c: number, p: number, l: "en" | "de", label?: string): Frame[] {
  const total = kjOf(f, c, p);
  const n = (v: number) => dec(v, l, 1);
  return [
    {
      math: `E = ${n(f)} "g" \\cdot 39 "kJ/g" + ${n(c)} "g" \\cdot 17 "kJ/g" + ${n(p)} "g" \\cdot 17 "kJ/g"`,
      note: l === "de" ? `Jeder Nährstoff mit seinem Energiegehalt: Fett 39 kJ/g, Kohlenhydrate und Eiweiß je 17 kJ/g.${label ?? ""}` : `Each nutrient with its energy content: fat 39 kJ/g, carbohydrates and protein 17 kJ/g each.${label ?? ""}`,
    },
    {
      math: `E = ${n(f * 39)} "kJ" + ${n(c * 17)} "kJ" + ${n(p * 17)} "kJ"`,
      note: l === "de" ? "Ausrechnen." : "Multiply.",
    },
    {
      math: `E \\approx ${n(Math.round(total))} "kJ"`,
      note: l === "de" ? `Zusammen etwa **${n(Math.round(total))} kJ**.` : `Together about **${n(Math.round(total))} kJ**.`,
    },
  ];
}

const framesBoth = (make: (l: "en" | "de") => Frame[]): Frame[] => {
  const a = make("en");
  const b = make("de");
  return a.map((fr, i) => ({ math: { en: fr.math as string, de: b[i].math as string }, note: { en: fr.note as string, de: b[i].note as string } }));
};

function energyMistakes(f: number, c: number, p: number) {
  const total = Math.round(kjOf(f, c, p));
  const m = mistakes(num(total, 0.02, "kJ"));
  m.add(num(Math.round((f + c + p) * 17), 0.02, "kJ"), tx("Fat counted like sugar", "Fett wie Zucker gerechnet"), tx("Ah, you took 17 kJ/g for the fat too. But fat has more than twice as much: **39 kJ** per gram.", "Ah, du hast auch für das Fett 17 kJ/g genommen. Fett hat aber mehr als doppelt so viel: **39 kJ** pro Gramm."));
  m.add(num(Math.round((f + c + p) * 39), 0.02, "kJ"), tx("39 for everything", "Überall 39"), tx("39 kJ/g is only for fat. Carbohydrates and protein give 17 kJ per gram.", "39 kJ/g gilt nur für Fett. Kohlenhydrate und Eiweiß liefern 17 kJ pro Gramm."));
  if (p > 0) m.add(num(Math.round(f * 39 + c * 17), 0.02, "kJ"), tx("Protein forgotten", "Eiweiß vergessen"), tx("Nearly! Protein also gives energy: 17 kJ per gram.", "Fast! Auch Eiweiß liefert Energie: 17 kJ pro Gramm."), true);
  m.add(num(Math.round(f * 17 + c * 39 + p * 17), 0.02, "kJ"), tx("Values swapped", "Werte vertauscht"), tx("You swapped the values: fat has 39 kJ/g, carbohydrates 17 kJ/g.", "Du hast die Werte vertauscht: Fett hat 39 kJ/g, Kohlenhydrate 17 kJ/g."));
  return m;
}

function energyTask(rng: Rng): Exercise {
  const row = rng.pick(NUTRITION);
  const portion = rng.chance(0.5);
  const grams = portion ? rng.pick([20, 25, 30, 40, 50, 150, 200]) : 100;
  const k = grams / 100;
  const f = Math.round(row.fat * k * 10) / 10;
  const c = Math.round(row.carbs * k * 10) / 10;
  const p = Math.round(row.protein * k * 10) / 10;
  const total = Math.round(kjOf(f, c, p));
  const m = energyMistakes(f, c, p);
  if (portion) m.add(num(Math.round(kjOf(row.fat, row.carbs, row.protein)), 0.02, "kJ"), tx("That's per 100 g", "Das sind 100 g"), tx(`You worked out 100 g. The portion is ${grams} g, so scale the values first.`, `Du hast 100 g ausgerechnet. Die Portion hat aber ${grams} g, rechne die Werte erst um.`));
  return {
    instruction: tx("Energy content", "Energiegehalt"),
    text: portion
      ? tx(`How much energy (in kJ) is in **${grams} g** of this food? Use fat 39 kJ/g, carbohydrates and protein 17 kJ/g.`, `Wie viel Energie (in kJ) stecken in **${grams} g** dieses Lebensmittels? Rechne mit Fett 39 kJ/g, Kohlenhydrate und Eiweiß 17 kJ/g.`)
      : tx("How much energy (in kJ) is in 100 g of this food? Use fat 39 kJ/g, carbohydrates and protein 17 kJ/g.", "Wie viel Energie (in kJ) stecken in 100 g dieses Lebensmittels? Rechne mit Fett 39 kJ/g, Kohlenhydrate und Eiweiß 17 kJ/g."),
    visual: { component: DigestionLabel as never, props: { name: row.name, per: tx("per 100 g", "pro 100 g"), fat: row.fat, carbs: row.carbs, protein: row.protein } },
    answer: num(total, 0.02, "kJ"),
    hint: tx("Multiply each nutrient by its energy per gram and add up.", "Multipliziere jeden Nährstoff mit seiner Energie pro Gramm und addiere."),
    solution: framesBoth((l) => {
      const scale: Frame[] = portion
        ? [{ math: `${grams} "g" = ${dec(k, l, 2)} \\cdot 100 "g"`, note: l === "de" ? `Die Portion ist ${dec(k, l, 2)}-mal 100 g: Fett ${dec(f, l, 1)} g, Kohlenhydrate ${dec(c, l, 1)} g, Eiweiß ${dec(p, l, 1)} g.` : `The portion is ${dec(k, l, 2)} times 100 g: fat ${dec(f, l, 1)} g, carbohydrates ${dec(c, l, 1)} g, protein ${dec(p, l, 1)} g.` }]
        : [];
      return [...scale, ...energyFrames(f, c, p, l)];
    }),
    mistakes: m.list,
  };
}

function burnTask(rng: Rng): Exercise {
  const row = rng.pick(NUTRITION.filter((r) => r.fat + r.carbs > 30));
  const grams = rng.pick([50, 100]);
  const k = grams / 100;
  const f = row.fat * k;
  const c = row.carbs * k;
  const p = row.protein * k;
  const energy = Math.round(kjOf(f, c, p));
  const [act, rate] = rng.pick([
    [tx("cycling", "Radfahren"), 1500],
    [tx("swimming", "Schwimmen"), 1800],
    [tx("walking", "Spazierengehen"), 900],
    [tx("playing football", "Fußballspielen"), 2000],
  ] as [Text, number][]);
  const minutes = Math.round((energy / rate) * 60);
  const right = num(minutes, 0.04, "min");
  const m = mistakes(right);
  m.add(num(Math.round((energy / rate) * 100) / 100, 0.04, "min"), tx("That's hours", "Das sind Stunden"), tx("Your result is in **hours**. Multiply by 60 to get minutes.", "Dein Ergebnis ist in **Stunden**. Mal 60, dann hast du Minuten."), true);
  m.add(num(Math.round(((f + c + p) * 17 / rate) * 60), 0.04, "min"), tx("Fat counted like sugar", "Fett wie Zucker gerechnet"), tx("You took 17 kJ/g for the fat too. Fat has 39 kJ per gram, so you need longer.", "Du hast auch fürs Fett 17 kJ/g genommen. Fett hat 39 kJ pro Gramm, du brauchst also länger."));
  return {
    instruction: tx("Burn it off", "Wieder verbrauchen"),
    text: tx(
      `You eat **${grams} g** of this food. ${en(act).replace(/^./, (x) => x.toUpperCase())} uses about ${rate} kJ per hour. How many minutes of ${en(act)} use up the same energy?`,
      `Du isst **${grams} g** dieses Lebensmittels. ${de(act)} verbraucht etwa ${rate} kJ pro Stunde. Wie viele Minuten ${de(act)} verbrauchen die gleiche Energie?`,
    ),
    visual: { component: DigestionLabel as never, props: { name: row.name, per: tx("per 100 g", "pro 100 g"), fat: row.fat, carbs: row.carbs, protein: row.protein } },
    answer: right,
    hint: tx("First the energy of the portion (fat 39, the rest 17 kJ/g), then divide by the kJ per hour.", "Erst die Energie der Portion (Fett 39, der Rest 17 kJ/g), dann durch die kJ pro Stunde teilen."),
    solution: framesBoth((l) => [
      ...energyFrames(f, c, p, l).slice(0, 1),
      { math: `E \\approx ${energy} "kJ"`, note: l === "de" ? `Die Portion liefert etwa ${energy} kJ.` : `The portion gives about ${energy} kJ.` },
      { math: `t = \\frac{${energy} "kJ"}{${rate} "kJ/h"} \\approx ${dec(energy / rate, l, 2)} "h"`, note: l === "de" ? "Energie durch Verbrauch pro Stunde." : "Energy divided by the use per hour." },
      { math: `${dec(energy / rate, l, 2)} \\cdot 60 "min" \\approx ${minutes} "min"`, note: l === "de" ? `Etwa **${minutes} Minuten**.` : `About **${minutes} minutes**.` },
    ]),
    mistakes: m.list,
  };
}

function basalTask(rng: Rng): Exercise {
  const mass = rng.int(7, 16) * 5;
  const basal = Math.round(4.2 * mass * 24);
  const withExtra = rng.chance(0.5);
  const extra = rng.int(20, 60) * 100;
  const value = withExtra ? basal + extra : basal;
  const right = num(value, 0.01, "kJ");
  const m = mistakes(right);
  m.add(num(Math.round(4.2 * mass * 10) / 10, 0.01, "kJ"), tx("Only one hour", "Nur eine Stunde"), tx("That's the energy for **one hour**. The day has 24 of them.", "Das ist der Bedarf für **eine Stunde**. Der Tag hat 24 davon."));
  m.add(num(mass * 24, 0.01, "kJ"), tx("4.2 kJ forgotten", "4,2 kJ vergessen"), tx("You multiplied kg by hours. Each kg needs 4.2 kJ per hour.", "Du hast kg mal Stunden gerechnet. Jedes kg braucht 4,2 kJ pro Stunde."));
  if (withExtra) m.add(num(basal, 0.01, "kJ"), tx("Activity forgotten", "Leistungsumsatz vergessen"), tx("That's only the basal rate. Add the extra energy for activity.", "Das ist nur der Grundumsatz. Addiere noch den Leistungsumsatz."), true);
  return {
    instruction: tx("Energy need", "Energiebedarf"),
    text: withExtra
      ? txMap((t, l) =>
          t(
            `A teenager has a body mass of ${mass} kg. Basal metabolic rate: 4.2 kJ per kg and hour. School, cycling and sport add ${extra} kJ a day. What is the total energy need per day?`,
            `Eine Jugendliche hat eine Körpermasse von ${mass} kg. Grundumsatz: ${dec(4.2, l)} kJ pro kg und Stunde. Schule, Radfahren und Sport kosten zusätzlich ${extra} kJ am Tag (Leistungsumsatz). Wie groß ist der Gesamtbedarf pro Tag?`,
          ),
        )
      : txMap((t, l) => t(`Work out the basal metabolic rate per day for a body mass of ${mass} kg. Use 4.2 kJ per kg and hour.`, `Berechne den Grundumsatz pro Tag für eine Körpermasse von ${mass} kg. Rechne mit ${dec(4.2, l)} kJ pro kg und Stunde.`)),
    answer: right,
    hint: tx("Basal rate = 4.2 kJ × kg × 24 h. Total need = basal rate + extra for activity.", "Grundumsatz = 4,2 kJ · kg · 24 h. Gesamtbedarf = Grundumsatz + Leistungsumsatz."),
    solution: framesBoth((l) => [
      { math: `"${l === "de" ? "GU" : "BMR"}" = ${dec(4.2, l)} "kJ" \\cdot ${mass} \\cdot 24 = ${dec(basal, l, 0)} "kJ"`, note: l === "de" ? `Grundumsatz: ${dec(basal, l, 0)} kJ pro Tag, nur um am Leben zu bleiben.` : `Basal metabolic rate: ${dec(basal, l, 0)} kJ a day, just to stay alive.` },
      ...(withExtra
        ? [{ math: `${dec(basal, l, 0)} "kJ" + ${extra} "kJ" = ${dec(value, l, 0)} "kJ"`, note: l === "de" ? `Plus Leistungsumsatz: Gesamtbedarf **${dec(value, l, 0)} kJ** am Tag.` : `Plus the extra for activity: total need **${dec(value, l, 0)} kJ** a day.` }]
        : []),
    ]),
    mistakes: m.list,
  };
}

const ENERGY_QS: Q[] = [
  {
    q: tx("1 g of fat or 1 g of sugar: which contains more energy?", "1 g Fett oder 1 g Zucker: Was enthält mehr Energie?"),
    opts: [
      { text: tx("1 g of fat, more than twice as much", "1 g Fett, mehr als doppelt so viel") },
      { text: tx("both the same", "beide gleich viel"), title: tx("Fat has more", "Fett hat mehr"), say: tx("Classic trap! Per gram fat gives about 39 kJ, sugar only about 17 kJ.", "Die klassische Falle! Pro Gramm liefert Fett etwa 39 kJ, Zucker nur etwa 17 kJ.") },
      { text: tx("1 g of sugar", "1 g Zucker"), title: tx("Sugar is quick, not more", "Zucker ist schnell, nicht mehr"), say: tx("Sugar gives energy **quickly**, but less of it: 17 kJ instead of 39 kJ per gram.", "Zucker liefert Energie **schnell**, aber weniger: 17 kJ statt 39 kJ pro Gramm.") },
    ],
    hint: tx("Why does the body store energy as fat?", "Warum speichert der Körper Energie als Fett?"),
    note: tx("Fat: about **39 kJ/g**. Sugar (carbohydrates) and protein: about **17 kJ/g**.", "Fett: etwa **39 kJ/g**. Zucker (Kohlenhydrate) und Eiweiß: etwa **17 kJ/g**."),
  },
  {
    q: tx("What is the basal metabolic rate?", "Was ist der Grundumsatz?"),
    opts: [
      { text: tx("the energy the body needs at complete rest, just to stay alive", "die Energie, die der Körper in völliger Ruhe braucht, um am Leben zu bleiben") },
      { text: tx("the energy needed for sport", "die Energie für Sport"), title: tx("That's the extra", "Das ist der Leistungsumsatz"), say: tx("Energy for movement and sport is the **Leistungsumsatz**, which comes on top.", "Energie für Bewegung und Sport ist der **Leistungsumsatz**, der kommt obendrauf.") },
      { text: tx("the energy in one meal", "die Energie in einer Mahlzeit"), title: tx("That's energy intake", "Das ist Energiezufuhr"), say: tx("The basal rate is what the body **uses**, not what you eat.", "Der Grundumsatz ist, was der Körper **verbraucht**, nicht was du isst.") },
      { text: tx("the energy stored as fat", "die als Fett gespeicherte Energie"), title: tx("That's a store", "Das ist ein Speicher"), say: tx("Stored fat is a reserve. The basal rate is the energy used at rest.", "Gespeichertes Fett ist eine Reserve. Der Grundumsatz ist der Verbrauch in Ruhe.") },
    ],
    hint: tx("Even asleep you breathe, your heart beats and you stay warm.", "Auch im Schlaf atmest du, dein Herz schlägt und du bleibst warm."),
    note: tx("**Basal metabolic rate**: energy at rest (breathing, heartbeat, body heat). Plus the extra for activity = total need.", "**Grundumsatz**: Energie in Ruhe (Atmung, Herzschlag, Körperwärme). Plus **Leistungsumsatz** = Gesamtbedarf."),
  },
];

// ---------------------------------------------------------------------------
// Statements

const TRUE2: Stmt[] = [
  { text: tx("Enzymes are not used up by the reaction.", "Enzyme werden bei der Reaktion nicht verbraucht.") },
  { text: tx("Bile emulsifies fat but contains no digestive enzyme.", "Galle emulgiert Fett, enthält aber kein Verdauungsenzym.") },
  { text: tx("Glucose and amino acids pass into the blood capillaries of the villi.", "Glucose und Aminosäuren gelangen in die Blutkapillaren der Zotten.") },
  { text: tx("Pepsin works best in acid.", "Pepsin arbeitet am besten im Sauren.") },
  { text: tx("Only small building blocks can pass through the gut wall.", "Nur kleine Bausteine können die Darmwand passieren.") },
];
const FALSE2: Stmt[] = [
  { text: tx("Bile is an enzyme that splits fats.", "Galle ist ein Enzym, das Fette spaltet."), title: tx("Bile is not an enzyme", "Galle ist kein Enzym"), say: tx("Bile only emulsifies fat. Splitting is done by lipase.", "Galle emulgiert Fett nur. Spalten macht die Lipase.") },
  { text: tx("Most nutrients are absorbed in the stomach.", "Die meisten Nährstoffe werden im Magen resorbiert."), title: tx("Not in the stomach", "Nicht im Magen"), say: tx("Absorption happens in the **small intestine**, with its huge surface.", "Resorbiert wird im **Dünndarm** mit seiner riesigen Oberfläche.") },
  { text: tx("Digestion of all nutrients begins in the stomach.", "Die Verdauung aller Nährstoffe beginnt im Magen."), title: tx("Starch starts earlier", "Stärke startet früher"), say: tx("Starch digestion begins in the **mouth** with saliva amylase.", "Die Stärkeverdauung beginnt schon im **Mund** mit der Speichel-Amylase.") },
  { text: tx("Fat and sugar contain the same energy per gram.", "Fett und Zucker enthalten pro Gramm gleich viel Energie."), title: tx("Fat has more", "Fett hat mehr"), say: tx("Fat: 39 kJ/g, sugar: 17 kJ/g. More than twice as much.", "Fett: 39 kJ/g, Zucker: 17 kJ/g. Mehr als doppelt so viel.") },
  { text: tx("Enzymes are used up when they split food.", "Enzyme werden beim Spalten der Nahrung verbraucht."), title: tx("Enzymes are reused", "Enzyme werden wiederverwendet"), say: tx("Enzymes are catalysts: they come out of the reaction unchanged and work again and again.", "Enzyme sind Katalysatoren: Sie gehen unverändert aus der Reaktion hervor und arbeiten immer wieder.") },
];

function statements2Task(rng: Rng): Exercise {
  const trues = pickN(rng, TRUE2, rng.int(2, 3));
  const falses = pickN(rng, FALSE2, 5 - trues.length);
  const mu = multi(rng, trues, falses);
  return {
    instruction: tx("Select all true statements", "Wähle alle richtigen Aussagen"),
    text: tx("Which statements about digestion are true?", "Welche Aussagen zur Verdauung stimmen?"),
    answer: mu.answer,
    hint: tx("Check each one: who splits, where is absorbed, how much energy?", "Prüf jede einzeln: Wer spaltet, wo wird resorbiert, wie viel Energie?"),
    solution: [
      { math: tx('"bile" \\to "emulsifies" \\quad "lipase" \\to "splits"', '"Galle" \\to "emulgiert" \\quad "Lipase" \\to "spaltet"'), note: tx("Bile is no enzyme. Enzymes are catalysts and are not used up.", "Galle ist kein Enzym. Enzyme sind Katalysatoren und werden nicht verbraucht.") },
      { math: tx('"absorption:" \\; "small intestine"', '"Resorption:" \\; "Dünndarm"'), note: tx("Building blocks are absorbed in the small intestine. Fat has 39 kJ/g, sugar 17 kJ/g.", "Die Bausteine werden im Dünndarm resorbiert. Fett hat 39 kJ/g, Zucker 17 kJ/g.") },
    ],
    mistakes: mu.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => questionTask(rng, ENZYME_QS, tx("Enzymes and juices", "Enzyme und Verdauungssäfte"))],
    [1.3, () => enzymeMatchTask(rng)],
    [1.1, () => blockTask(rng)],
    [1.2, () => seqTask(rng)],
    [1, () => questionTask(rng, ABSORB_QS, tx("Absorption", "Resorption"))],
    [0.7, () => surfaceTask(rng)],
    [0.8, () => villusPartTask(rng)],
    [1.2, () => testResultsTask(rng)],
    [0.9, () => questionTask(rng, TEST_QS, tx("Food tests", "Nachweisreaktionen"))],
    [1.3, () => energyTask(rng)],
    [0.7, () => burnTask(rng)],
    [0.8, () => basalTask(rng)],
    [0.6, () => questionTask(rng, ENERGY_QS, tx("Energy", "Energie"))],
    [1, () => statements2Task(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const surfaceCheck = (() => {
  const c = fixedChoice(ABSORB_QS[0].opts, 1);
  return { instruction: tx("Absorption", "Resorption"), text: ABSORB_QS[0].q, answer: c.answer, hint: ABSORB_QS[0].hint, solution: [{ math: "3 \\cdot 10 \\cdot 20 = 600", note: ABSORB_QS[0].note }], mistakes: c.mistakes } satisfies Exercise;
})();

const testCheck = (() => {
  const results: [FoodTest, boolean][] = [
    ["iodine", true],
    ["strip", false],
    ["biuret", true],
    ["grease", false],
  ];
  const options = TEST_ORDER.map((t) => NUT[t]);
  const correct = [0, 2];
  return {
    instruction: tx("Evaluate the food tests", "Werte die Nachweise aus"),
    text: tx("A sample of lentil flour was tested. Which nutrients does it contain? Select all.", "Eine Probe Linsenmehl wurde untersucht. Welche Nährstoffe enthält sie? Wähle alle."),
    visual: { component: DigestionTestResults as never, props: { results } },
    answer: { kind: "multi", options, correct } as AnswerSpec,
    hint: tx("Only the tests that changed colour are positive.", "Nur die Nachweise mit Farbumschlag sind positiv."),
    solution: [
      { math: tx('"iodine: +" \\quad "biuret: +"', '"Iod: +" \\quad "Biuret: +"'), note: tx("Iodine turned blue-black (starch) and biuret violet (protein). Lentils are rich in both.", "Iod wurde blau-schwarz (Stärke), Biuret violett (Eiweiß). Linsen sind reich an beidem.") },
      { math: tx('"strip: –" \\quad "grease spot: –"', '"Streifen: –" \\quad "Fettfleck: –"'), note: tx("The strip stayed yellow and the spot dried away: no glucose, hardly any fat.", "Der Streifen blieb gelb, der Fleck trocknete weg: keine Glucose, kaum Fett.") },
    ],
    mistakes: [
      { when: { kind: "multi", options, correct: [0, 1, 2] } as AnswerSpec, title: tx("That test was negative", "Dieser Nachweis war negativ"), say: negSay("strip") },
      { when: { kind: "multi", options, correct: [0, 2, 3] } as AnswerSpec, title: tx("That test was negative", "Dieser Nachweis war negativ"), say: negSay("grease") },
    ],
  } satisfies Exercise;
})();

const energyCheck: Exercise = (() => {
  const f = 5;
  const c = 16;
  const p = 2;
  const m = energyMistakes(f, c, p);
  return {
    instruction: tx("Energy content", "Energiegehalt"),
    text: tx("A small cereal bar (25 g) contains 5 g fat, 16 g carbohydrates and 2 g protein. How much energy does it give, in kJ?", "Ein kleiner Müsliriegel (25 g) enthält 5 g Fett, 16 g Kohlenhydrate und 2 g Eiweiß. Wie viel Energie liefert er in kJ?"),
    answer: num(Math.round(kjOf(f, c, p)), 0.02, "kJ"),
    hint: tx("Fat 39 kJ/g, carbohydrates and protein 17 kJ/g each.", "Fett 39 kJ/g, Kohlenhydrate und Eiweiß je 17 kJ/g."),
    solution: framesBoth((l) => energyFrames(f, c, p, l)),
    mistakes: m.list,
  };
})();

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Digestion means cutting up", "Verdauung heißt Zerlegen"),
      blob: tx("Big molecules can't get through the gut wall. So: snip snap!", "Große Moleküle kommen nicht durch die Darmwand. Also: schnipp, schnapp!"),
      body: tx(
        "Nutrients are big molecules: long chains of many building blocks. Only the small building blocks can pass through the gut wall into the blood. **Enzymes** cut the chains: they are biocatalysts, work at body temperature and are not used up.",
        "Nährstoffe sind große Moleküle: lange Ketten aus vielen Bausteinen. Nur die kleinen Bausteine passen durch die Darmwand ins Blut. **Enzyme** zerschneiden die Ketten: Sie sind Biokatalysatoren, arbeiten bei Körpertemperatur und werden dabei nicht verbraucht.",
      ),
      frames: [
        { math: tx('"starch"#s \\to#s2 "glucose"#s3', '"Stärke"#s \\to#s2 "Glucose"#s3'), note: tx("**Starch** is a chain of many **glucose** units (grape sugar).", "**Stärke** ist eine Kette aus vielen **Glucose**-Einheiten (Traubenzucker).") },
        {
          math: tx('"starch"#s \\to#s2 "glucose"#s3 \\\\ "protein"#e \\to#e2 "amino acids"#e3', '"Stärke"#s \\to#s2 "Glucose"#s3 \\\\ "Eiweiß"#e \\to#e2 "Aminosäuren"#e3'),
          note: tx("**Proteins** are chains of **amino acids**, of 20 different kinds.", "**Eiweiße** (Proteine) sind Ketten aus **Aminosäuren**, von 20 verschiedenen Sorten."),
        },
        {
          math: tx(
            '"starch"#s \\to#s2 "glucose"#s3 \\\\ "protein"#e \\to#e2 "amino acids"#e3 \\\\ "fat"#f \\to#f2 "glycerol + fatty acids"#f3',
            '"Stärke"#s \\to#s2 "Glucose"#s3 \\\\ "Eiweiß"#e \\to#e2 "Aminosäuren"#e3 \\\\ "Fett"#f \\to#f2 "Glycerin + Fettsäuren"#f3',
          ),
          note: tx("A **fat** molecule is made of **glycerol** and three **fatty acids**.", "Ein **Fett**-Molekül besteht aus **Glycerin** und drei **Fettsäuren**."),
        },
        {
          math: tx(
            '"starch"#s \\to#s2 "glucose"#s3 \\\\ "protein"#e \\to#e2 "amino acids"#e3 \\\\ "fat"#f \\to#f2 "glycerol + fatty acids"#f3',
            '"Stärke"#s \\to#s2 "Glucose"#s3 \\\\ "Eiweiß"#e \\to#e2 "Aminosäuren"#e3 \\\\ "Fett"#f \\to#f2 "Glycerin + Fettsäuren"#f3',
          ),
          highlight: ["s3", "e3", "f3"],
          note: tx("Each enzyme only fits its own substrate, like a key fits a lock (**lock-and-key model**). That's why there are many digestive enzymes.", "Jedes Enzym passt nur zu seinem Substrat, wie ein Schlüssel zum Schloss (**Schlüssel-Schloss-Modell**). Darum gibt es viele verschiedene Verdauungsenzyme."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The enzyme scissors", "Die Enzym-Schere"),
      blob: tx("Pick a pair of scissors and snip! But not every pair fits.", "Such dir eine Schere aus und schnipp! Aber nicht jede passt."),
      body: tx(
        "Cut starch, protein and fat into their building blocks. Which enzyme fits which substrate? And what does bile do?",
        "Zerlege Stärke, Eiweiß und Fett in ihre Bausteine. Welches Enzym passt zu welchem Substrat? Und was macht die Galle?",
      ),
      widget: DigestionScissors,
    },
    {
      type: "widget",
      title: tx("Who cuts where?", "Wer schneidet wo?"),
      blob: tx("Same journey as before, but now we watch the enzymes at work.", "Dieselbe Reise wie früher, aber jetzt schauen wir den Enzymen bei der Arbeit zu."),
      body: tx(
        "Follow the bite again, this time with the digestive juices. The bars show how far starch, protein and fat are digested. Notice: the **hydrochloric acid** of the stomach kills germs and activates pepsin, and **bile** emulsifies fat but is **not an enzyme**.",
        "Folge dem Bissen noch einmal, diesmal mit den Verdauungssäften. Die Balken zeigen, wie weit Stärke, Eiweiß und Fett schon zerlegt sind. Achte darauf: Die **Salzsäure** des Magens tötet Keime und aktiviert Pepsin, und die **Galle** emulgiert Fett, ist aber **kein Enzym**.",
      ),
      widget: DigestionJourney2,
    },
    { type: "check", blob: tx("Who does what? Careful with the bile!", "Wer macht was? Vorsicht bei der Galle!"), exercise: enzymeMatchExercise(["amylase", "pepsin", "lipase", "bile"], "maltase") },
    {
      type: "explain",
      title: tx("Absorption in the small intestine", "Resorption im Dünndarm"),
      blob: tx("The building blocks are ready. Now they have to get into the blood!", "Die Bausteine sind fertig. Jetzt müssen sie ins Blut!"),
      body: tx(
        "Taking up the building blocks through the gut wall is called **absorption**. The bigger the surface, the faster it goes.",
        "Die Aufnahme der Bausteine durch die Darmwand heißt **Resorption**. Je größer die Oberfläche, desto schneller geht das.",
      ),
      frames: [
        { math: tx('"folds"#a \\times 3', '"Falten"#a \\times 3'), note: tx("The gut lining lies in big **folds**: about 3 times the surface.", "Die Schleimhaut liegt in großen **Ringfalten**: etwa 3-mal so viel Oberfläche.") },
        { math: tx('"folds"#a \\times 3 \\quad "villi"#b \\times 10', '"Falten"#a \\times 3 \\quad "Zotten"#b \\times 10'), note: tx("On the folds sit millions of **villi**, each about 1 mm high: 10 times more.", "Auf den Falten sitzen Millionen **Darmzotten**, jede etwa 1 mm hoch: noch einmal 10-mal mehr.") },
        {
          math: tx('"folds"#a \\times 3 \\quad "villi"#b \\times 10 \\quad "microvilli"#c \\times 20', '"Falten"#a \\times 3 \\quad "Zotten"#b \\times 10 \\quad "Mikrovilli"#c \\times 20'),
          note: tx("Every cell of the villi carries tiny **microvilli** (brush border): 20 times more.", "Jede Zelle der Zotten trägt winzige **Mikrovilli** (Bürstensaum): noch einmal 20-mal mehr."),
        },
        { math: "3 \\cdot 10 \\cdot 20 = 600", note: tx("Together about **600 times** the surface of a smooth tube: the principle of **surface enlargement**.", "Zusammen etwa **600-mal** so viel Oberfläche wie ein glattes Rohr: das Prinzip der **Oberflächenvergrößerung**.") },
        {
          math: tx('"glucose, amino acids" \\to "blood" \\\\ "fat building blocks" \\to "lymph"', '"Glucose, Aminosäuren" \\to "Blut" \\\\ "Fettbausteine" \\to "Lymphe"'),
          note: tx("Glucose and amino acids go into the blood capillaries of the villi, and with the blood to the liver. Fat building blocks go into the lymph vessel. Afterwards the **large intestine** takes back water.", "Glucose und Aminosäuren gehen in die Blutkapillaren der Zotten und mit dem Blut zur Leber. Fettbausteine gehen in das Lymphgefäß. Danach holt der **Dickdarm** Wasser zurück."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("A villus under the microscope", "Eine Darmzotte unter dem Mikroskop"),
      blob: tx("Zoom in! Tap the structures.", "Reinzoomen! Tipp die Strukturen an."),
      body: tx("Tap the markers or the names: what does each structure do?", "Tipp auf die Nummern oder die Namen: Was macht welche Struktur?"),
      widget: DigestionVillusExplore,
    },
    { type: "check", blob: tx("Why so many folds?", "Warum so viele Falten?"), exercise: surfaceCheck },
    {
      type: "widget",
      title: tx("Food tests: the mini lab", "Nachweisreaktionen: das Minilabor"),
      blob: tx("Lab coat on! Let's find out what's inside our food.", "Kittel an! Finden wir raus, was in unserem Essen steckt."),
      body: tx(
        "With **food tests** you find out which nutrients a food contains. Test every food and compare with the **control** (water). There is also **Fehling's test** for glucose: when heated, the blue Fehling's solution turns brick red.",
        "Mit **Nachweisreaktionen** findest du heraus, welche Nährstoffe in einem Lebensmittel stecken. Teste alle Lebensmittel und vergleiche mit der **Blindprobe** Wasser. Für Glucose gibt es außerdem die **Fehling-Probe**: Beim Erhitzen wird die blaue Fehling-Lösung ziegelrot.",
      ),
      widget: DigestionFoodLab,
    },
    { type: "check", blob: tx("Read the results like a scientist.", "Lies die Ergebnisse wie eine Forscherin."), exercise: testCheck },
    {
      type: "widget",
      title: tx("Energy from food", "Energie aus der Nahrung"),
      blob: tx("How much energy is in a bar of chocolate? Let's calculate!", "Wie viel Energie steckt in einer Tafel Schokolade? Rechnen wir nach!"),
      body: tx(
        "Food energy is given in **kilojoules (kJ)**. Per gram: **fat about 39 kJ**, **carbohydrates and protein about 17 kJ** each. Your **energy need** is the **basal metabolic rate** (energy at rest: breathing, heartbeat, body heat) plus the **extra for activity** (moving, sport). Food labels use 37 kJ for fat; we use the textbook value 39 kJ.",
        "Die Energie der Nahrung wird in **Kilojoule (kJ)** angegeben. Pro Gramm: **Fett etwa 39 kJ**, **Kohlenhydrate und Eiweiß je etwa 17 kJ**. Dein **Energiebedarf** ist der **Grundumsatz** (Energie in Ruhe: Atmung, Herzschlag, Körperwärme) plus der **Leistungsumsatz** (Bewegung, Sport). Auf Verpackungen wird für Fett mit 37 kJ gerechnet; wir nehmen den Schulbuchwert 39 kJ.",
      ),
      widget: DigestionEnergy,
    },
    { type: "check", blob: tx("Your turn to calculate!", "Jetzt rechnest du!"), exercise: energyCheck },
  ],
  summary: [
    {
      title: tx("Digestion = splitting", "Verdauung = Spaltung"),
      body: tx(
        "Enzymes split big nutrient molecules into small building blocks that can pass through the gut wall. Each enzyme fits only its substrate (lock-and-key model).",
        "Enzyme spalten große Nährstoffmoleküle in kleine Bausteine, die durch die Darmwand passen. Jedes Enzym passt nur zu seinem Substrat (Schlüssel-Schloss-Modell).",
      ),
      examples: [
        tx('"starch" \\to "maltose" \\to "glucose"', '"Stärke" \\to "Maltose" \\to "Glucose"'),
        tx('"protein" \\to "peptides" \\to "amino acids"', '"Eiweiß" \\to "Peptide" \\to "Aminosäuren"'),
        tx('"fat" \\to "glycerol + fatty acids"', '"Fett" \\to "Glycerin + Fettsäuren"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Who works where", "Wer arbeitet wo"),
      body: tx(
        "**Mouth**: amylase (saliva). **Stomach**: hydrochloric acid + pepsin. **Small intestine**: amylase, trypsin, lipase (pancreatic juice), bile, maltase and peptidases (gut wall).",
        "**Mund**: Amylase (Speichel). **Magen**: Salzsäure + Pepsin. **Dünndarm**: Amylase, Trypsin, Lipase (Bauchspeichel), Galle, Maltase und Peptidasen (Darmwand).",
      ),
      tone: "rule",
    },
    {
      title: tx("Bile is not an enzyme", "Galle ist kein Enzym"),
      body: tx(
        "Bile **emulsifies** fat into tiny droplets (bigger surface for lipase); it splits nothing. Stomach acid (pH 1 to 2) kills germs, denatures proteins and activates pepsin.",
        "Galle **emulgiert** Fett zu feinen Tröpfchen (größere Oberfläche für die Lipase); sie spaltet nichts. Magensäure (pH 1 bis 2) tötet Keime, denaturiert Eiweiße und aktiviert Pepsin.",
      ),
      tone: "warning",
    },
    {
      title: tx("Absorption", "Resorption"),
      body: tx(
        "In the small intestine: folds, villi and microvilli enlarge the surface. Glucose and amino acids into the blood, fat building blocks into the lymph. The large intestine takes back water.",
        "Im Dünndarm: Falten, Zotten und Mikrovilli vergrößern die Oberfläche. Glucose und Aminosäuren ins Blut, Fettbausteine in die Lymphe. Der Dickdarm holt Wasser zurück.",
      ),
      examples: ["3 \\cdot 10 \\cdot 20 = 600"],
      tone: "rule",
    },
    {
      title: tx("Food tests", "Nachweisreaktionen"),
      body: tx(
        "**Iodine**: starch → blue-black. **Glucose test strip**: green; **Fehling**: brick red. **Biuret**: protein → violet. **Grease spot**: see-through spot stays. Always with a control.",
        "**Iod**: Stärke → blau-schwarz. **Glucose-Teststreifen**: grün; **Fehling**: ziegelrot. **Biuret**: Eiweiß → violett. **Fettfleckprobe**: durchscheinender Fleck bleibt. Immer mit Blindprobe.",
      ),
      tone: "tip",
    },
    {
      title: tx("Energy", "Energie"),
      body: tx(
        "Fat about 39 kJ/g, carbohydrates and protein about 17 kJ/g. Total need = basal metabolic rate (about 4.2 kJ per kg and hour) + extra for activity.",
        "Fett etwa 39 kJ/g, Kohlenhydrate und Eiweiß etwa 17 kJ/g. Gesamtbedarf = Grundumsatz (etwa 4,2 kJ pro kg und Stunde) + Leistungsumsatz.",
      ),
      examples: [tx('E = m_"fat" \\cdot 39 + m_"carbs" \\cdot 17 + m_"protein" \\cdot 17', 'E = m_"Fett" \\cdot 39 + m_"KH" \\cdot 17 + m_"Eiweiß" \\cdot 17')],
      tone: "rule",
    },
  ],
};
