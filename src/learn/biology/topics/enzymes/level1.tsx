"use client";

// Enzymes, level 1 (Klasse 7–8): enzymes as biocatalysts (proteins, speed up reactions, not used
// up), the lock and key model, amylase splitting starch with the iodine test, enzymes in daily life.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { EnzymeFit, EnzymeProcess } from "@/learn/biology/visuals/EnzymeFigures";
import { EnzymeLockKey } from "@/learn/biology/visuals/EnzymeLockKey";
import type { Tooth } from "@/learn/biology/visuals/EnzymeShapes";
import { EnzymeStarchLab, EnzymeTubes, type TubeSpec } from "@/learn/biology/visuals/EnzymeStarch";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { choice, letter, mistakes, multi, PICK, PICK_ALL, visual, weighted, type Opt, type Stmt } from "./data";

// ---------------------------------------------------------------------------
// Facts (choice)

type Fact = { q: Text; opts: Opt[]; hint: Text; frame: Frame };

const USED_UP: Text = tx("Not used up", "Wird nicht verbraucht");
const NOT_ALIVE: Text = tx("Enzymes aren't alive", "Enzyme leben nicht");

const FACTS: Fact[] = [
  {
    q: tx("What are enzymes made of?", "Woraus bestehen Enzyme?"),
    opts: [
      { text: tx("proteins", "aus Proteinen (Eiweißstoffen)") },
      { text: tx("sugar", "aus Zucker"), title: tx("Sugar can be a substrate", "Zucker kann Substrat sein"), say: tx("Sugar can be what an enzyme works on, but the enzyme itself is a **protein**.", "Zucker kann der Stoff sein, den ein Enzym umsetzt. Das Enzym selbst ist aber ein **Protein**.") },
      { text: tx("fat", "aus Fett"), title: tx("Fat is a substrate", "Fett ist ein Substrat"), say: tx("Fats are split by enzymes called lipases. The enzymes themselves are **proteins**.", "Fette werden von Enzymen gespalten, den Lipasen. Die Enzyme selbst sind **Proteine**.") },
      { text: tx("tiny living things", "aus winzigen Lebewesen"), title: NOT_ALIVE, say: tx("Enzymes are molecules, not living things. They are made of protein.", "Enzyme sind Moleküle, keine Lebewesen. Sie bestehen aus Protein.") },
    ],
    hint: tx("Think of the -ase enzymes in washing powder: they are the same kind of substance as egg white.", "Denk an die Enzyme im Waschmittel: Sie sind dieselbe Stoffgruppe wie Eiklar."),
    frame: { math: tx('"enzyme" = "protein"', '"Enzym" = "Protein"'), note: tx("Every enzyme is a **protein** (a protein substance). Cells make them.", "Jedes Enzym ist ein **Protein** (Eiweißstoff). Zellen bilden sie.") },
  },
  {
    q: tx("What do enzymes do to chemical reactions in living things?", "Was bewirken Enzyme bei chemischen Reaktionen in Lebewesen?"),
    opts: [
      { text: tx("They speed them up.", "Sie beschleunigen sie.") },
      { text: tx("They slow them down.", "Sie verlangsamen sie."), title: tx("The other way round", "Andersrum"), say: tx("Other way round: enzymes are **catalysts**, they make reactions much faster.", "Andersrum: Enzyme sind **Katalysatoren**, sie machen Reaktionen viel schneller.") },
      { text: tx("They provide the energy for them.", "Sie liefern die Energie dafür."), title: tx("No energy source", "Keine Energiequelle"), say: tx("Enzymes don't supply energy. They just make it much easier for the reaction to start.", "Enzyme liefern keine Energie. Sie sorgen nur dafür, dass die Reaktion viel leichter in Gang kommt.") },
      { text: tx("They are turned into the products.", "Sie werden selbst zu den Produkten."), title: USED_UP, say: tx("Enzymes come out of the reaction **unchanged**. The products come from the substrate.", "Enzyme gehen **unverändert** aus der Reaktion hervor. Die Produkte entstehen aus dem Substrat.") },
    ],
    hint: tx("Without amylase, splitting starch would take years.", "Ohne Amylase würde die Spaltung von Stärke Jahre dauern."),
    frame: { math: tx('"enzyme" \\Rightarrow "faster reaction"', '"Enzym" \\Rightarrow "schnellere Reaktion"'), note: tx("Enzymes are **biocatalysts**: they speed up reactions and are not used up.", "Enzyme sind **Biokatalysatoren**: Sie beschleunigen Reaktionen und werden nicht verbraucht.") },
  },
  {
    q: tx("What is the substance called that an enzyme works on?", "Wie heißt der Stoff, den ein Enzym umsetzt?"),
    opts: [
      { text: tx("substrate", "Substrat") },
      { text: tx("product", "Produkt"), title: tx("That's what comes out", "Das kommt heraus"), say: tx("Products only form in the reaction. The starting substance is the **substrate**.", "Produkte entstehen erst bei der Reaktion. Der Ausgangsstoff heißt **Substrat**.") },
      { text: tx("catalyst", "Katalysator"), title: tx("That's the enzyme", "Das ist das Enzym"), say: tx("The catalyst is the enzyme itself. The substance it works on is the **substrate**.", "Der Katalysator ist das Enzym selbst. Der Stoff, den es umsetzt, ist das **Substrat**.") },
      { text: tx("protein", "Protein") },
    ],
    hint: tx("It is the 'key' in the lock and key model.", "Es ist der „Schlüssel“ im Schlüssel-Schloss-Modell."),
    frame: { math: tx('"enzyme" + "substrate" \\to "enzyme" + "products"', '"Enzym" + "Substrat" \\to "Enzym" + "Produkte"'), note: tx("The enzyme converts its **substrate** into products.", "Das Enzym setzt sein **Substrat** zu Produkten um.") },
  },
  {
    q: tx("Which enzyme in saliva splits starch?", "Welches Enzym im Speichel spaltet Stärke?"),
    opts: [
      { text: tx("amylase", "Amylase") },
      { text: tx("lipase", "Lipase"), title: tx("Lipase splits fat", "Lipase spaltet Fett"), say: tx("Lipase splits **fats** (lipids). For starch you need amylase.", "Lipase spaltet **Fette** (Lipide). Für Stärke brauchst du Amylase.") },
      { text: tx("pepsin", "Pepsin"), title: tx("Pepsin is in the stomach", "Pepsin ist im Magen"), say: tx("Pepsin works in the stomach and splits proteins. In saliva you find amylase.", "Pepsin arbeitet im Magen und spaltet Proteine. Im Speichel steckt Amylase.") },
      { text: tx("iodine", "Iod"), title: tx("Iodine only detects", "Iod weist nur nach"), say: tx("Iodine solution only shows whether starch is there. It doesn't split anything.", "Iodlösung zeigt nur, ob Stärke da ist. Sie spaltet nichts.") },
    ],
    hint: tx("Its name comes from amylum, the Latin word for starch.", "Ihr Name kommt von amylum, dem lateinischen Wort für Stärke."),
    frame: { math: tx('"starch" \\to "maltose"', '"Stärke" \\to "Malzzucker"'), note: tx("**Amylase** in saliva splits starch into maltose.", "Die **Amylase** im Speichel spaltet Stärke in Malzzucker.") },
  },
  {
    q: tx("What does amylase split starch into?", "Wozu spaltet die Amylase die Stärke?"),
    opts: [
      { text: tx("maltose (malt sugar)", "zu Malzzucker (Maltose)") },
      { text: tx("protein building blocks", "zu Eiweißbausteinen"), title: tx("No protein in starch", "Stärke ist kein Eiweiß"), say: tx("Starch is a chain of sugar units, there's no protein in it. Amylase cuts it into **maltose**.", "Stärke ist eine Kette aus Zuckerbausteinen, darin steckt kein Eiweiß. Die Amylase schneidet sie in **Malzzucker**.") },
      { text: tx("fat", "zu Fett"), title: tx("No fat from starch", "Aus Stärke wird kein Fett"), say: tx("Amylase only cuts the starch chain into smaller pieces of sugar: **maltose**.", "Die Amylase schneidet die Stärkekette nur in kleinere Zuckerstücke: **Malzzucker**.") },
    ],
    hint: tx("Chew bread for a long time: it starts to taste sweet.", "Kau Brot lange: Es fängt an, süß zu schmecken."),
    frame: { math: tx('"starch" \\to "maltose"', '"Stärke" \\to "Malzzucker"'), note: tx("The long starch chain is cut into maltose, pieces of two glucose units. That tastes sweet.", "Die lange Stärkekette wird in Malzzucker zerschnitten, Stücke aus zwei Traubenzuckerbausteinen. Der schmeckt süß.") },
  },
  {
    q: tx("Iodine solution turns blue-black. What does that show?", "Iod-Kaliumiodid-Lösung färbt sich blau-schwarz. Was zeigt das?"),
    opts: [
      { text: tx("Starch is present.", "Es ist Stärke vorhanden.") },
      { text: tx("Sugar is present.", "Es ist Zucker vorhanden."), title: tx("Starch test, not sugar", "Stärke-, kein Zuckernachweis"), say: tx("Iodine solution detects **starch**, not sugar. Sugar has its own tests, such as Fehling's test.", "Iodlösung weist **Stärke** nach, keinen Zucker. Für Zucker gibt es eigene Nachweise, z. B. die Fehling-Probe.") },
      { text: tx("There is no starch left.", "Es ist keine Stärke mehr da."), title: tx("The other way round", "Andersrum"), say: tx("Other way round! Blue-black means starch is there. Without starch the solution stays yellow-brown.", "Andersrum! Blau-schwarz heißt: Stärke ist da. Ohne Stärke bleibt die Lösung gelb-braun.") },
      { text: tx("The enzyme has been destroyed.", "Das Enzym wurde zerstört."), title: tx("It only shows starch", "Es zeigt nur Stärke"), say: tx("The colour only tells you whether starch is there. Why it is still there is a second question.", "Die Farbe sagt nur, ob Stärke da ist. Warum sie noch da ist, ist eine zweite Frage.") },
    ],
    hint: tx("Iodine solution itself is yellow-brown.", "Die Iodlösung selbst ist gelb-braun."),
    frame: { math: tx('"starch" + "iodine" \\to "blue-black"', '"Stärke" + "Iod" \\to "blau-schwarz"'), note: tx("Blue-black: starch is present. Yellow-brown: no starch.", "Blau-schwarz: Stärke ist da. Gelb-braun: keine Stärke.") },
  },
  {
    q: tx("Why can't amylase split fat?", "Warum kann Amylase kein Fett spalten?"),
    opts: [
      { text: tx("Fat doesn't fit into its active site.", "Fett passt nicht in ihr aktives Zentrum.") },
      { text: tx("Amylase gets used up by fat.", "Amylase wird von Fett verbraucht."), title: USED_UP, say: tx("Enzymes are never used up. Fat simply doesn't **fit** into the amylase.", "Enzyme werden nie verbraucht. Fett **passt** einfach nicht in die Amylase.") },
      { text: tx("Fat is too heavy for amylase.", "Fett ist zu schwer für die Amylase."), title: tx("It's about shape", "Es geht um die Form"), say: tx("Weight doesn't matter. What matters is the **shape**: like a key that has to fit its lock.", "Das Gewicht spielt keine Rolle. Es kommt auf die **Form** an: wie bei einem Schlüssel, der ins Schloss passen muss.") },
      { text: tx("Amylase doesn't like fat.", "Die Amylase mag kein Fett."), title: NOT_ALIVE, say: tx("Enzymes have no likes or dislikes, they are molecules. It's all about the **shape** of the active site.", "Enzyme mögen nichts und lehnen nichts ab, sie sind Moleküle. Es geht nur um die **Form** des aktiven Zentrums.") },
    ],
    hint: tx("Think of the lock and key model.", "Denk an das Schlüssel-Schloss-Modell."),
    frame: { math: tx('"key" \\to "lock"', '"Schlüssel" \\to "Schloss"'), note: tx("Each enzyme only converts the substrate that fits its active site: **lock and key**.", "Jedes Enzym setzt nur das Substrat um, das in sein aktives Zentrum passt: **Schlüssel-Schloss-Prinzip**.") },
  },
  {
    q: tx("What happens to an enzyme when you boil it?", "Was passiert mit einem Enzym, wenn du es kochst?"),
    opts: [
      { text: tx("It is destroyed, because it is a protein.", "Es wird zerstört, weil es ein Protein ist.") },
      { text: tx("It works even faster.", "Es arbeitet noch schneller."), title: tx("Too hot", "Viel zu heiß"), say: tx("A little warmth speeds things up, but boiling **destroys** the protein. After that it doesn't work at all.", "Etwas Wärme beschleunigt, aber Kochen **zerstört** das Protein. Danach arbeitet es gar nicht mehr.") },
      { text: tx("It dies, like a living thing.", "Es stirbt, wie ein Lebewesen."), title: NOT_ALIVE, say: tx("Enzymes can't die, they aren't alive. But heat destroys their shape.", "Enzyme können nicht sterben, sie leben ja nicht. Aber Hitze zerstört ihre Form.") },
      { text: tx("Nothing at all.", "Gar nichts."), title: tx("Heat matters", "Hitze macht etwas"), say: tx("Look at the boiled saliva in the experiment: it no longer splits starch. Boiling destroys enzymes.", "Schau dir den abgekochten Speichel im Versuch an: Er spaltet keine Stärke mehr. Kochen zerstört Enzyme.") },
    ],
    hint: tx("What happens to egg white when you boil an egg?", "Was passiert mit dem Eiklar, wenn du ein Ei kochst?"),
    frame: { math: tx('100 \\deg"C" \\Rightarrow "enzyme destroyed"', '100 \\deg"C" \\Rightarrow "Enzym zerstört"'), note: tx("Like egg white in a boiled egg, the protein changes for good. The enzyme can't work any more.", "Wie das Eiklar beim gekochten Ei verändert sich das Protein dauerhaft. Das Enzym kann nicht mehr arbeiten.") },
  },
  {
    q: tx("An enzyme molecule has already split 1000 substrate particles. What is true?", "Ein Enzymmolekül hat schon 1000 Substratteilchen gespalten. Was stimmt?"),
    opts: [
      { text: tx("It can go on splitting substrate.", "Es kann weiter Substrat spalten.") },
      { text: tx("It is used up now.", "Es ist jetzt verbraucht."), title: USED_UP, say: tx("Classic trap! Enzymes are **not used up**. After each reaction they are free for the next substrate.", "Die klassische Falle! Enzyme werden **nicht verbraucht**. Nach jeder Reaktion sind sie frei für das nächste Substrat.") },
      { text: tx("It is tired and works more slowly.", "Es ist müde und arbeitet langsamer."), title: NOT_ALIVE, say: tx("Enzymes don't get tired, they aren't alive. They come out of every reaction unchanged.", "Enzyme werden nicht müde, sie leben nicht. Sie gehen aus jeder Reaktion unverändert hervor.") },
      { text: tx("It has turned into a product.", "Es ist zu einem Produkt geworden."), title: USED_UP, say: tx("The products come from the substrate. The enzyme stays the same.", "Die Produkte entstehen aus dem Substrat. Das Enzym bleibt, wie es ist.") },
    ],
    hint: tx("What does the enzyme look like after the reaction?", "Wie sieht das Enzym nach der Reaktion aus?"),
    frame: { math: tx('"enzyme before" = "enzyme after"', '"Enzym vorher" = "Enzym nachher"'), note: tx("The enzyme is unchanged after every reaction: it can work again and again.", "Das Enzym ist nach jeder Reaktion unverändert: Es kann immer wieder arbeiten.") },
  },
  {
    q: tx("Where are enzymes made?", "Wo werden Enzyme gebildet?"),
    opts: [
      { text: tx("in the cells of living things", "in den Zellen von Lebewesen") },
      { text: tx("only in the mouth", "nur im Mund"), title: tx("Not only in saliva", "Nicht nur im Speichel"), say: tx("Saliva contains amylase, but every cell makes enzymes: thousands of different ones.", "Im Speichel steckt Amylase, aber jede Zelle bildet Enzyme: Tausende verschiedene.") },
      { text: tx("only in factories", "nur in Fabriken"), title: tx("Made by living things", "Von Lebewesen gebildet"), say: tx("Enzymes for washing powder are produced in factories, but by bacteria or fungi. Enzymes are always made in cells.", "Enzyme für Waschmittel werden zwar in Fabriken gewonnen, aber von Bakterien oder Pilzen gebildet. Enzyme entstehen immer in Zellen.") },
    ],
    hint: tx("Bio-catalysts: the bio tells you where they come from.", "Biokatalysatoren: Das Bio verrät, woher sie kommen."),
    frame: { math: tx('"cell" \\to "enzymes"', '"Zelle" \\to "Enzyme"'), note: tx("All living cells make enzymes. That's why they're called **bio**catalysts.", "Alle lebenden Zellen bilden Enzyme. Darum heißen sie **Bio**katalysatoren.") },
  },
  {
    q: tx("Why does washing powder contain several different enzymes?", "Warum enthält Waschmittel mehrere verschiedene Enzyme?"),
    opts: [
      { text: tx("Each enzyme only splits one kind of stain.", "Jedes Enzym spaltet nur eine Sorte Flecken.") },
      { text: tx("So they can replace each other once one is used up.", "Damit sie sich ersetzen, wenn eines verbraucht ist."), title: USED_UP, say: tx("Enzymes aren't used up. Each one only fits its own substrate, so you need one for protein, one for fat and one for starch.", "Enzyme werden nicht verbraucht. Jedes passt nur zu seinem Substrat, darum braucht man eins für Eiweiß, eins für Fett und eins für Stärke.") },
      { text: tx("Because enzymes only live for a short time.", "Weil Enzyme nur kurz leben."), title: NOT_ALIVE, say: tx("Enzymes don't live at all, they are molecules. The reason is the lock and key: each one fits only one substrate.", "Enzyme leben gar nicht, sie sind Moleküle. Der Grund ist das Schlüssel-Schloss-Prinzip: Jedes passt nur zu einem Substrat.") },
      { text: tx("So the powder smells better.", "Damit das Waschmittel besser riecht.") },
    ],
    hint: tx("Blood, butter and pudding stains are made of different substances.", "Blut-, Butter- und Puddingflecken bestehen aus verschiedenen Stoffen."),
    frame: { math: tx('"protease, lipase, amylase"', '"Protease, Lipase, Amylase"'), note: tx("Protease for protein stains, lipase for fat stains, amylase for starch stains: each enzyme fits only its substrate.", "Protease für Eiweißflecken, Lipase für Fettflecken, Amylase für Stärkeflecken: Jedes Enzym passt nur zu seinem Substrat.") },
  },
  {
    q: tx("Which picture describes how an enzyme works best?", "Welches Bild beschreibt die Wirkung eines Enzyms am besten?"),
    opts: [
      { text: tx("a key that fits exactly one lock", "ein Schlüssel, der genau in ein Schloss passt") },
      { text: tx("a vacuum cleaner that sucks up everything", "ein Staubsauger, der alles aufsaugt"), title: tx("Not everything", "Nicht alles"), say: tx("An enzyme doesn't convert everything, only **its** substrate. That's why lock and key fits better.", "Ein Enzym setzt nicht alles um, nur **sein** Substrat. Darum passt das Bild vom Schlüssel besser.") },
      { text: tx("an oven that gives off heat", "ein Ofen, der Wärme abgibt"), title: tx("No heat source", "Keine Wärmequelle"), say: tx("Enzymes don't heat anything. They make reactions possible at body temperature.", "Enzyme heizen nichts. Sie machen Reaktionen bei Körpertemperatur möglich.") },
    ],
    hint: tx("The model's name says it.", "Der Name des Modells sagt es schon."),
    frame: { math: tx('"lock and key model"', '"Schlüssel-Schloss-Modell"'), note: tx("The substrate fits into the active site like a key into its lock. Remember: it's a **model**.", "Das Substrat passt ins aktive Zentrum wie ein Schlüssel in sein Schloss. Denk dran: Das ist ein **Modell**.") },
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: PICK, text: f.q, answer: c.answer, hint: f.hint, solution: [f.frame], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// True statements (multi)

const STMTS: Stmt[] = [
  { ok: true, text: tx("Enzymes are proteins.", "Enzyme sind Proteine."), title: tx("Enzymes are proteins", "Enzyme sind Proteine"), say: tx("That one is true too: every enzyme is a protein. That's why heat destroys them.", "Die stimmt auch: Jedes Enzym ist ein Protein. Darum zerstört Hitze sie.") },
  { ok: true, text: tx("Enzymes speed up reactions in living things.", "Enzyme beschleunigen Reaktionen in Lebewesen.") },
  { ok: true, text: tx("One enzyme can convert many substrate particles, one after the other.", "Ein Enzym kann viele Substratteilchen nacheinander umsetzen."), title: tx("Again and again", "Immer wieder"), say: tx("This one is true: the enzyme comes out of every reaction unchanged and keeps going.", "Die stimmt: Das Enzym geht aus jeder Reaktion unverändert hervor und macht weiter.") },
  { ok: true, text: tx("Each enzyme only converts a certain substrate.", "Jedes Enzym setzt nur ein bestimmtes Substrat um.") },
  { ok: true, text: tx("Amylase in saliva splits starch.", "Die Amylase im Speichel spaltet Stärke.") },
  { ok: true, text: tx("Boiling destroys enzymes.", "Kochen zerstört Enzyme.") },
  { ok: true, text: tx("The lock and key model is a model.", "Das Schlüssel-Schloss-Prinzip ist ein Modell.") },
  { ok: false, text: tx("Enzymes are used up in the reaction.", "Enzyme werden bei der Reaktion verbraucht."), title: USED_UP, say: tx("Careful: enzymes are **not used up**. After the reaction they are unchanged.", "Vorsicht: Enzyme werden **nicht verbraucht**. Nach der Reaktion sind sie unverändert.") },
  { ok: false, text: tx("Enzymes are tiny living things.", "Enzyme sind winzige Lebewesen."), title: NOT_ALIVE, say: tx("Enzymes are made **by** living cells, but they are molecules, not living things.", "Enzyme werden **von** lebenden Zellen gebildet, sind aber Moleküle, keine Lebewesen.") },
  { ok: false, text: tx("An enzyme fits every substance.", "Ein Enzym passt zu jedem Stoff."), title: tx("Lock and key", "Schlüssel und Schloss"), say: tx("No: like a key, each enzyme fits only its own substrate.", "Nein: Wie ein Schlüssel passt jedes Enzym nur zu seinem Substrat.") },
  { ok: false, text: tx("Enzymes slow reactions down.", "Enzyme verlangsamen Reaktionen."), title: tx("Faster, not slower", "Schneller, nicht langsamer"), say: tx("Enzymes are catalysts: they make reactions **faster**.", "Enzyme sind Katalysatoren: Sie machen Reaktionen **schneller**.") },
  { ok: false, text: tx("Amylase splits fats.", "Amylase spaltet Fette."), title: tx("Fats need lipase", "Fette brauchen Lipase"), say: tx("Amylase splits starch. Fats are split by lipase.", "Amylase spaltet Stärke. Fette spaltet die Lipase.") },
  { ok: false, text: tx("Iodine solution turns sugar blue-black.", "Iodlösung färbt Zucker blau-schwarz."), title: tx("Iodine detects starch", "Iod weist Stärke nach"), say: tx("Iodine solution turns **starch** blue-black, not sugar.", "Iodlösung färbt **Stärke** blau-schwarz, nicht Zucker.") },
  { ok: false, text: tx("Enzymes are made of sugar.", "Enzyme bestehen aus Zucker."), title: tx("Proteins", "Proteine"), say: tx("Enzymes are proteins. Sugar can at most be their substrate.", "Enzyme sind Proteine. Zucker kann höchstens ihr Substrat sein.") },
];

function statementsTask(rng: Rng): Exercise {
  const nTrue = rng.int(2, 3);
  const m = multi(rng, STMTS, nTrue, 5 - nTrue);
  const lines = m.trues.map((s) => s.text);
  return {
    instruction: PICK_ALL,
    text: tx("Which statements about enzymes are true?", "Welche Aussagen über Enzyme stimmen?"),
    answer: m.answer,
    hint: tx("Remember: protein, faster, not used up, one substrate each.", "Denk an: Protein, schneller, nicht verbraucht, jedes nur ein Substrat."),
    solution: [
      { math: tx('"true:"', '"richtig:"'), note: txMap((_, l) => lines.map((x) => `✓ ${resolveText(x, l)}`).join(" ")) },
      {
        math: tx('"enzyme" = "protein" \\quad "not used up"', '"Enzym" = "Protein" \\quad "nicht verbraucht"'),
        note: tx("Enzymes are proteins made by cells. They speed up reactions, fit only their own substrate and are not used up.", "Enzyme sind Proteine, die Zellen bilden. Sie beschleunigen Reaktionen, passen nur zu ihrem Substrat und werden nicht verbraucht."),
      },
    ],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// The starch experiment (tubes)

type Cond = "water" | "saliva" | "boiled";
const CONTENT: Record<Cond, Text> = {
  water: tx("starch + water", "Stärke + Wasser"),
  saliva: tx("starch + saliva", "Stärke + Speichel"),
  boiled: tx("starch + boiled saliva", "Stärke + abgekochter Speichel"),
};
const RESULT: Record<Cond, TubeSpec["colour"]> = { water: "starch", saliva: "iodine", boiled: "starch" };

const BLUE: Text = tx("blue-black", "blau-schwarz");
const BROWN: Text = tx("yellow-brown", "gelb-braun");
const BRICK: Text = tx("brick red", "ziegelrot");
const CLEAR: Text = tx("colourless", "farblos");

function tubesTask(rng: Rng): Exercise {
  const conds = rng.shuffle<Cond>(["water", "saliva", "boiled"]);
  const at = (c: Cond) => letter(conds.indexOf(c));
  const minutes = rng.pick([10, 15, 20]);
  const kind = rng.pick(["which", "predict", "colour", "why"] as const);
  const setup = (rest: Text) =>
    txMap(
      (tt, l) =>
        `${tt(`Three test tubes with starch solution stand in a water bath at 37 °C. After ${minutes} minutes`, `Drei Reagenzgläser mit Stärkelösung stehen im Wasserbad bei 37 °C. Nach ${minutes} Minuten`)} ${resolveText(rest, l)}`,
    );
  const solutionFrames = (): Frame[] => [
    {
      math: tx(`"${at("saliva")}:" "saliva" \\to "yellow-brown"`, `"${at("saliva")}:" "Speichel" \\to "gelb-braun"`),
      note: tx("The amylase in the saliva has split all the starch. The iodine solution keeps its own colour: yellow-brown.", "Die Amylase im Speichel hat die ganze Stärke gespalten. Die Iodlösung behält ihre eigene Farbe: gelb-braun."),
    },
    {
      math: tx(
        `"${at("saliva")}:" "saliva" \\to "yellow-brown" \\\\ "${at("water")}:" "water" \\to "blue-black" \\\\ "${at("boiled")}:" "boiled" \\to "blue-black"`,
        `"${at("saliva")}:" "Speichel" \\to "gelb-braun" \\\\ "${at("water")}:" "Wasser" \\to "blau-schwarz" \\\\ "${at("boiled")}:" "abgekocht" \\to "blau-schwarz"`,
      ),
      note: tx("Water contains no enzyme. In boiled saliva the amylase has been destroyed by the heat. In both, the starch stays.", "Wasser enthält kein Enzym. Im abgekochten Speichel hat die Hitze die Amylase zerstört. In beiden bleibt die Stärke erhalten."),
    },
  ];

  if (kind === "which" || kind === "predict") {
    const shown = kind === "which";
    const tubes: TubeSpec[] = conds.map((c, i) => ({ label: letter(i), content: CONTENT[c], colour: shown ? RESULT[c] : "clear" }));
    const why: Record<Cond, { title?: Text; say?: Text }> = {
      saliva: {},
      boiled: {
        title: tx("Boiled enzymes don't work", "Gekochte Enzyme arbeiten nicht"),
        say: shown
          ? tx("That tube is still blue-black, so the starch is still there. Boiling has destroyed the amylase.", "Dieses Glas ist noch blau-schwarz, die Stärke ist also noch da. Das Kochen hat die Amylase zerstört.")
          : tx("Boiling destroys the amylase, because it's a protein. So that starch isn't split.", "Kochen zerstört die Amylase, denn sie ist ein Protein. Diese Stärke wird also nicht gespalten."),
      },
      water: {
        title: tx("Water has no enzyme", "Wasser hat kein Enzym"),
        say: shown
          ? tx("Blue-black means starch is still there. Water can't split starch.", "Blau-schwarz heißt: Die Stärke ist noch da. Wasser kann Stärke nicht spalten.")
          : tx("Water contains no enzyme, so the starch stays. That tube is the control.", "Wasser enthält kein Enzym, die Stärke bleibt also. Dieses Glas ist der Kontrollansatz."),
      },
    };
    const options = conds.map((_, i) => tx(`tube ${letter(i)}`, `Glas ${letter(i)}`));
    const correct = conds.indexOf("saliva");
    const ms: Mistake[] = conds.flatMap((c, i) => {
      const w = why[c];
      return c !== "saliva" && w.say ? [{ when: { kind: "choice", options, correct: i } as AnswerSpec, title: w.title, say: w.say }] : [];
    });
    return {
      instruction: shown ? tx("Read the experiment", "Werte den Versuch aus") : tx("Predict the result", "Sag das Ergebnis voraus"),
      text: shown
        ? setup(tx("iodine solution was added. In which tube is there no starch left?", "wurde Iod-Kaliumiodid-Lösung zugegeben. In welchem Glas ist keine Stärke mehr?"))
        : setup(tx("iodine solution will be added. Which tube will turn yellow-brown?", "wird Iod-Kaliumiodid-Lösung zugegeben. Welches Glas wird gelb-braun?")),
      visual: visual(EnzymeTubes, { tubes }),
      answer: { kind: "choice", options, correct },
      hint: shown ? tx("Blue-black means starch. Yellow-brown is the colour of the iodine solution itself.", "Blau-schwarz bedeutet Stärke. Gelb-braun ist die Farbe der Iodlösung selbst.") : tx("Where is there an enzyme that still works?", "Wo gibt es ein Enzym, das noch funktioniert?"),
      solution: solutionFrames(),
      mistakes: ms,
    };
  }

  if (kind === "colour") {
    const target = rng.pick<Cond>(["water", "saliva", "boiled"]);
    const tubes: TubeSpec[] = conds.map((c, i) => ({ label: letter(i), content: CONTENT[c], colour: "clear" }));
    const opts: Opt[] =
      target !== "saliva"
        ? [
            { text: BLUE },
            {
              text: BROWN,
              title: target === "boiled" ? tx("Boiled enzymes don't work", "Gekochte Enzyme arbeiten nicht") : tx("Water has no enzyme", "Wasser hat kein Enzym"),
              say:
                target === "boiled"
                  ? tx("Yellow-brown would mean the starch has gone. But boiling destroyed the amylase, so the starch stays.", "Gelb-braun hieße: Die Stärke ist weg. Aber das Kochen hat die Amylase zerstört, die Stärke bleibt also.")
                  : tx("Yellow-brown would mean the starch has gone. But water contains no enzyme to split it.", "Gelb-braun hieße: Die Stärke ist weg. Aber Wasser enthält kein Enzym, das sie spalten könnte."),
            },
            { text: BRICK, title: tx("That's Fehling's test", "Das ist die Fehling-Probe"), say: tx("Brick red is the result of Fehling's test for sugar. Iodine shows starch.", "Ziegelrot ist das Ergebnis der Fehling-Probe auf Zucker. Iod zeigt Stärke an.") },
            { text: CLEAR },
          ]
        : [
            { text: BROWN },
            { text: BLUE, title: tx("The amylase worked", "Die Amylase hat gearbeitet"), say: tx("In this tube the amylase from the saliva had time to split all the starch. No starch, no blue-black.", "In diesem Glas hatte die Amylase aus dem Speichel Zeit, die ganze Stärke zu spalten. Keine Stärke, kein Blau-Schwarz.") },
            { text: BRICK, title: tx("That's Fehling's test", "Das ist die Fehling-Probe"), say: tx("Brick red is the result of Fehling's test for sugar. With iodine, no starch means the solution stays yellow-brown.", "Ziegelrot ist das Ergebnis der Fehling-Probe auf Zucker. Mit Iod bleibt die Lösung ohne Stärke gelb-braun.") },
            { text: CLEAR },
          ];
    const c = choice(rng, opts);
    return {
      instruction: tx("Predict the colour", "Sag die Farbe voraus"),
      text: setup(tx(`iodine solution is added. What colour will tube ${at(target)} be?`, `wird Iod-Kaliumiodid-Lösung zugegeben. Welche Farbe hat Glas ${at(target)}?`)),
      visual: visual(EnzymeTubes, { tubes }),
      answer: c.answer,
      hint: tx("Is there still starch in that tube? Starch turns iodine solution blue-black.", "Ist in dem Glas noch Stärke? Stärke färbt Iodlösung blau-schwarz."),
      solution: solutionFrames(),
      mistakes: c.mistakes,
    };
  }

  const tubes: TubeSpec[] = conds.map((c, i) => ({ label: letter(i), content: CONTENT[c], colour: RESULT[c] }));
  const c = choice(rng, BOILED_WHY);
  return {
    instruction: tx("Explain the result", "Erkläre das Ergebnis"),
    text: setup(tx(`iodine solution was added. Why is tube ${at("boiled")} still blue-black?`, `wurde Iod-Kaliumiodid-Lösung zugegeben. Warum ist Glas ${at("boiled")} noch blau-schwarz?`)),
    visual: visual(EnzymeTubes, { tubes }),
    answer: c.answer,
    hint: tx("Enzymes are proteins. What does heat do to proteins?", "Enzyme sind Proteine. Was macht Hitze mit Proteinen?"),
    solution: [
      { math: tx('"boiled" \\Rightarrow "amylase destroyed"', '"abgekocht" \\Rightarrow "Amylase zerstört"'), note: tx("Amylase is a protein. Boiling changes its shape for good, so it can't split starch any more.", "Amylase ist ein Protein. Kochen verändert seine Form dauerhaft, darum kann es keine Stärke mehr spalten.") },
      solutionFrames()[1],
    ],
    mistakes: c.mistakes,
  };
}

const BOILED_WHY: Opt[] = [
  { text: tx("Boiling has destroyed the amylase.", "Das Kochen hat die Amylase zerstört.") },
  { text: tx("The amylase has died from the heat.", "Die Amylase ist an der Hitze gestorben."), title: NOT_ALIVE, say: tx("Close, but enzymes can't die: they aren't alive. The heat has **destroyed** the protein.", "Fast, aber Enzyme können nicht sterben, sie leben ja nicht. Die Hitze hat das Protein **zerstört**.") },
  { text: tx("The amylase was used up while boiling.", "Die Amylase wurde beim Kochen verbraucht."), title: USED_UP, say: tx("Enzymes aren't used up. Heat changes the protein for good, so it can't work any more.", "Enzyme werden nicht verbraucht. Hitze verändert das Protein dauerhaft, darum kann es nicht mehr arbeiten.") },
  { text: tx("Boiled saliva contains extra starch.", "Abgekochter Speichel enthält zusätzliche Stärke."), title: tx("Saliva has no starch", "Speichel enthält keine Stärke"), say: tx("Saliva contains no starch, boiled or not. The difference is the enzyme.", "Speichel enthält keine Stärke, ob gekocht oder nicht. Der Unterschied ist das Enzym.") },
];

// ---------------------------------------------------------------------------
// Order

type Seq = { title: Text; items: Text[]; short: Text[]; wrong: { items: Text[]; title: Text; say: Text }[]; note: Text };

const S1 = {
  meet: tx("Enzyme and substrate meet.", "Enzym und Substrat treffen aufeinander."),
  bind: tx("The substrate binds in the active site.", "Das Substrat bindet im aktiven Zentrum."),
  split: tx("The substrate is split.", "Das Substrat wird gespalten."),
  leave: tx("The products leave the enzyme.", "Die Produkte lösen sich vom Enzym."),
  next: tx("The enzyme binds the next substrate.", "Das Enzym bindet das nächste Substrat."),
};
const S2 = {
  fill: tx("Pour starch solution into two test tubes.", "Stärkelösung in zwei Reagenzgläser füllen."),
  add: tx("Add saliva to one tube and water to the other.", "In ein Glas Speichel, in das andere Wasser geben."),
  wait: tx("Leave both tubes at 37 °C for 10 minutes.", "Beide Gläser 10 Minuten bei 37 °C stehen lassen."),
  iodine: tx("Add iodine solution to both.", "In beide Iod-Kaliumiodid-Lösung geben."),
  compare: tx("Compare the colours.", "Die Farben vergleichen."),
};
const S3 = {
  chew: tx("You chew a piece of bread.", "Du kaust ein Stück Brot."),
  mix: tx("Saliva mixes with the bread.", "Speichel vermischt sich mit dem Brot."),
  bind: tx("Amylase binds to the starch.", "Amylase bindet an die Stärke."),
  split: tx("The starch is split into maltose.", "Die Stärke wird in Malzzucker gespalten."),
  sweet: tx("The bread tastes sweet.", "Das Brot schmeckt süß."),
};

const SEQS: Seq[] = [
  {
    title: tx("Put the steps of an enzyme reaction in order.", "Bring die Schritte einer Enzymreaktion in die richtige Reihenfolge."),
    items: [S1.meet, S1.bind, S1.split, S1.leave, S1.next],
    short: [tx("meet", "treffen"), tx("bind", "binden"), tx("split", "spalten"), tx("release", "lösen"), tx("next", "nächstes")],
    wrong: [
      { items: [S1.split, S1.bind], title: tx("First bind, then split", "Erst binden, dann spalten"), say: tx("The enzyme can only split what sits in its active site. First the substrate binds, then it is split.", "Das Enzym kann nur spalten, was in seinem aktiven Zentrum sitzt. Erst bindet das Substrat, dann wird es gespalten.") },
      { items: [S1.leave, S1.split], title: tx("Products come later", "Produkte kommen später"), say: tx("The products only exist once the substrate has been split. Then they can leave.", "Die Produkte gibt es erst, wenn das Substrat gespalten ist. Dann können sie sich lösen.") },
      { items: [S1.next, S1.leave], title: tx("Active site still busy", "Aktives Zentrum noch besetzt"), say: tx("While the products are still sitting in the active site, no new substrate fits in. They have to leave first.", "Solange die Produkte noch im aktiven Zentrum sitzen, passt kein neues Substrat hinein. Sie müssen sich erst lösen.") },
    ],
    note: tx("Bind, split, release: then the unchanged enzyme is ready for the next substrate.", "Binden, spalten, freisetzen: Dann ist das unveränderte Enzym bereit für das nächste Substrat."),
  },
  {
    title: tx("Put the steps of the saliva experiment in order.", "Bring die Schritte des Speichelversuchs in die richtige Reihenfolge."),
    items: [S2.fill, S2.add, S2.wait, S2.iodine, S2.compare],
    short: [tx("starch", "Stärke"), tx("saliva / water", "Speichel / Wasser"), tx("wait", "warten"), tx("iodine", "Iod"), tx("compare", "vergleichen")],
    wrong: [
      { items: [S2.iodine, S2.wait], title: tx("The enzyme needs time", "Das Enzym braucht Zeit"), say: tx("If you test straight away, the amylase hasn't had any time yet: both tubes would be blue-black. First wait, then test.", "Testest du sofort, hatte die Amylase noch keine Zeit: Beide Gläser wären blau-schwarz. Erst warten, dann testen.") },
      { items: [S2.compare, S2.iodine], title: tx("No colour without iodine", "Ohne Iod keine Farbe"), say: tx("Without iodine solution there's no colour to compare. The test comes first.", "Ohne Iodlösung gibt es keine Farbe zum Vergleichen. Erst kommt der Nachweis.") },
    ],
    note: tx("Prepare, add saliva (and water as a control), wait at body temperature, then test with iodine and compare.", "Ansetzen, Speichel (und Wasser als Kontrolle) zugeben, bei Körpertemperatur warten, dann mit Iod testen und vergleichen."),
  },
  {
    title: tx("Put in order what happens when you chew bread.", "Bring in die richtige Reihenfolge, was beim Brotkauen passiert."),
    items: [S3.chew, S3.mix, S3.bind, S3.split, S3.sweet],
    short: [tx("chew", "kauen"), tx("saliva", "Speichel"), tx("bind", "binden"), tx("split", "spalten"), tx("sweet", "süß")],
    wrong: [
      { items: [S3.sweet, S3.split], title: tx("Sweet comes from maltose", "Süß kommt vom Malzzucker"), say: tx("Starch itself doesn't taste sweet. Only when maltose has formed does the bread taste sweet.", "Stärke selbst schmeckt nicht süß. Erst wenn Malzzucker entstanden ist, schmeckt das Brot süß.") },
      { items: [S3.split, S3.bind], title: tx("First bind, then split", "Erst binden, dann spalten"), say: tx("The amylase has to bind the starch first. Only then can it split it.", "Die Amylase muss die Stärke erst binden. Erst dann kann sie sie spalten.") },
    ],
    note: tx("Chewing mixes in saliva, amylase binds and splits starch into maltose: now it tastes sweet.", "Beim Kauen kommt Speichel dazu, Amylase bindet und spaltet Stärke in Malzzucker: Jetzt schmeckt es süß."),
  },
];

const sameItem = (a: Text, b: Text) => JSON.stringify(a) === JSON.stringify(b);

function orderTask(rng: Rng): Exercise {
  const s = rng.pick(SEQS);
  const drop = rng.int(0, 2); // 0: all five; 1: drop the first; 2: drop the last
  const items = drop === 1 ? s.items.slice(1) : drop === 2 ? s.items.slice(0, -1) : s.items;
  const short = drop === 1 ? s.short.slice(1) : drop === 2 ? s.short.slice(0, -1) : s.short;
  const ms: Mistake[] = s.wrong.filter((w) => w.items.every((it) => items.some((x) => sameItem(x, it)))).map((w) => ({ when: { kind: "order", items: w.items }, title: w.title, say: w.say }));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: s.title,
    answer: { kind: "order", items },
    hint: tx("Ask yourself for each step: what has to happen before it?", "Frag dich bei jedem Schritt: Was muss vorher passiert sein?"),
    solution: [{ math: txMap((_, l) => short.map((x) => `"${resolveText(x, l)}"`).join(" \\to ")), note: s.note }],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Match

type MatchBank = { text: Text; pairs: [Text, Text][]; extra: Text[]; wrong: { pair: [Text, Text]; title: Text; say: Text }[]; note: Text; hint: Text };

const E = {
  amylase: tx("amylase", "Amylase"),
  protease: tx("protease", "Protease"),
  lipase: tx("lipase", "Lipase"),
  lactase: tx("lactase", "Laktase"),
  maltase: tx("maltase", "Maltase"),
  cellulase: tx("cellulase", "Cellulase"),
};
const SUB = {
  starch: tx("starch", "Stärke"),
  protein: tx("protein", "Eiweiß (Protein)"),
  fat: tx("fat", "Fett"),
  lactose: tx("milk sugar (lactose)", "Milchzucker (Laktose)"),
  maltose: tx("malt sugar (maltose)", "Malzzucker (Maltose)"),
  cellulose: tx("cellulose", "Cellulose"),
};
const STAIN = {
  blood: tx("blood stain", "Blutfleck"),
  butter: tx("butter stain", "Butterfleck"),
  pudding: tx("pudding stain", "Puddingfleck"),
  bobbles: tx("bobbles on cotton", "Knötchen auf Baumwolle"),
  rust: tx("rust stain", "Rostfleck"),
  ink: tx("ink stain", "Tintenfleck"),
};

const MATCHES: MatchBank[] = [
  {
    text: tx("Match each enzyme with the substrate it splits.", "Ordne jedem Enzym das Substrat zu, das es spaltet."),
    pairs: [
      [E.amylase, SUB.starch],
      [E.protease, SUB.protein],
      [E.lipase, SUB.fat],
      [E.lactase, SUB.lactose],
      [E.maltase, SUB.maltose],
      [E.cellulase, SUB.cellulose],
    ],
    extra: [],
    wrong: [
      { pair: [E.lipase, SUB.protein], title: tx("Lipids are fats", "Lipide sind Fette"), say: tx("Lipase comes from lipid, that's fat. Proteins are split by proteases.", "Lipase kommt von Lipid, das ist Fett. Proteine spalten die Proteasen.") },
      { pair: [E.protease, SUB.fat], title: tx("Proteases split proteins", "Proteasen spalten Proteine"), say: tx("The name gives it away: a protease splits **proteins**. Fat is the job of lipase.", "Der Name verrät es: Eine Protease spaltet **Proteine**. Fett ist der Job der Lipase.") },
      { pair: [E.amylase, SUB.maltose], title: tx("Maltose is the product", "Malzzucker ist das Produkt"), say: tx("Amylase **makes** maltose: that's its product. Its substrate is starch. Maltose is split further by maltase.", "Amylase **stellt** Malzzucker her: Das ist ihr Produkt. Ihr Substrat ist Stärke. Malzzucker spaltet die Maltase weiter.") },
    ],
    note: tx("The name often tells you the substrate: amylase (amylum = starch), protease (protein), lipase (lipid = fat), lactase (lactose), maltase (maltose).", "Der Name verrät oft das Substrat: Amylase (amylum = Stärke), Protease (Protein), Lipase (Lipid = Fett), Laktase (Laktose), Maltase (Maltose)."),
    hint: tx("Look at the start of each name.", "Schau auf den Anfang jedes Namens."),
  },
  {
    text: tx("Match each enzyme in washing powder with the stain it removes.", "Ordne jedem Waschmittel-Enzym den Fleck zu, den es entfernt."),
    pairs: [
      [E.protease, STAIN.blood],
      [E.lipase, STAIN.butter],
      [E.amylase, STAIN.pudding],
      [E.cellulase, STAIN.bobbles],
    ],
    extra: [STAIN.rust, STAIN.ink],
    wrong: [
      { pair: [E.amylase, STAIN.blood], title: tx("Blood is mostly protein", "Blut ist vor allem Eiweiß"), say: tx("Blood stains are mainly protein. For them you need a **protease**. Amylase goes for starch, like in pudding.", "Blutflecken bestehen vor allem aus Eiweiß. Dafür brauchst du eine **Protease**. Amylase geht an Stärke, wie im Pudding.") },
      { pair: [E.lipase, STAIN.blood], title: tx("Lipase splits fat", "Lipase spaltet Fett"), say: tx("Lipase splits fat, like in butter. Blood is mostly protein: that's for the protease.", "Lipase spaltet Fett, wie in Butter. Blut ist vor allem Eiweiß: Das ist was für die Protease.") },
      { pair: [E.protease, STAIN.rust], title: tx("Rust isn't from living things", "Rost stammt nicht von Lebewesen"), say: tx("Rust is iron oxide, not a substance from living things. Enzymes can't split it.", "Rost ist Eisenoxid, kein Stoff aus Lebewesen. Enzyme können ihn nicht spalten.") },
    ],
    note: tx("Protease for protein (blood, egg), lipase for fat (butter, oil), amylase for starch (pudding, sauce), cellulase for cellulose fibres.", "Protease für Eiweiß (Blut, Ei), Lipase für Fett (Butter, Öl), Amylase für Stärke (Pudding, Soße), Cellulase für Cellulosefasern."),
    hint: tx("What is each stain mainly made of?", "Woraus besteht jeder Fleck vor allem?"),
  },
];

function matchTask(rng: Rng): Exercise {
  const b = rng.pick(MATCHES);
  const n = rng.int(3, 4);
  const pairs = rng.shuffle(b.pairs).slice(0, n);
  const unused = b.pairs.filter((p) => !pairs.includes(p)).map((p) => p[1]);
  const distractors = rng.shuffle([...b.extra, ...unused]).slice(0, 1);
  const lefts = pairs.map((p) => p[0]);
  const rights = [...pairs.map((p) => p[1]), ...distractors];
  const ms: Mistake[] = b.wrong
    .filter((w) => lefts.some((l) => sameItem(l, w.pair[0])) && rights.some((r) => sameItem(r, w.pair[1])) && !pairs.some((p) => sameItem(p[0], w.pair[0]) && sameItem(p[1], w.pair[1])))
    .map((w) => ({ when: { kind: "match", pairs: [w.pair] }, title: w.title, say: w.say }));
  return {
    instruction: tx("Match the pairs", "Ordne zu"),
    text: b.text,
    answer: { kind: "match", pairs, distractors },
    hint: b.hint,
    solution: [
      {
        math: txMap((_, l) => pairs.map(([a, c]) => `"${resolveText(a, l)}" \\to "${resolveText(c, l)}"`).join(" \\\\ ")),
        note: b.note,
      },
    ],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Terms (word)

type Term = { q: Text; accept: Text[]; hint: Text; note: Text; show: Text; wrong?: { word: Text; title: Text; say: Text; close?: boolean }[] };

const TERMS: Term[] = [
  {
    q: tx("What is the substance called that an enzyme converts?", "Wie heißt der Stoff, den ein Enzym umsetzt?"),
    accept: [tx("substrate", "Substrat"), "Substrate"],
    hint: tx("It's the key in the lock and key model.", "Es ist der Schlüssel im Schlüssel-Schloss-Modell."),
    show: tx('"substrate"', '"Substrat"'),
    note: tx("The **substrate** binds in the active site and is converted into the products.", "Das **Substrat** bindet im aktiven Zentrum und wird zu den Produkten umgesetzt."),
    wrong: [{ word: tx("product", "Produkt"), title: tx("That's what comes out", "Das kommt heraus"), say: tx("Products are what comes **out** of the reaction. The starting substance has its own name.", "Produkte kommen bei der Reaktion **heraus**. Der Ausgangsstoff hat einen eigenen Namen.") }],
  },
  {
    q: tx("Which enzyme in saliva splits starch?", "Welches Enzym im Speichel spaltet Stärke?"),
    accept: [tx("amylase", "Amylase"), tx("salivary amylase", "Speichelamylase"), "Ptyalin", "alpha-Amylase"],
    hint: tx("Amylum is Latin for starch, and enzyme names end in -ase.", "Amylum heißt Stärke, und Enzymnamen enden auf -ase."),
    show: tx('"amylase"', '"Amylase"'),
    note: tx("**Amylase** (from amylum, starch) splits starch into maltose.", "**Amylase** (von amylum, Stärke) spaltet Stärke in Malzzucker."),
    wrong: [
      { word: tx("lipase", "Lipase"), title: tx("Lipase splits fat", "Lipase spaltet Fett"), say: tx("Lipase splits fats. The starch enzyme is named after starch (amylum).", "Lipase spaltet Fette. Das Stärke-Enzym ist nach der Stärke (amylum) benannt.") },
      { word: tx("pepsin", "Pepsin"), title: tx("Pepsin is in the stomach", "Pepsin ist im Magen"), say: tx("Pepsin splits proteins in the stomach. In saliva it's a different enzyme.", "Pepsin spaltet Proteine im Magen. Im Speichel ist es ein anderes Enzym.") },
    ],
  },
  {
    q: tx("Enzymes speed up reactions in living things and are not used up. So they are called bio…?", "Enzyme beschleunigen Reaktionen in Lebewesen und werden nicht verbraucht. Man nennt sie deshalb Bio…?"),
    accept: [tx("biocatalysts", "Biokatalysatoren"), tx("biocatalyst", "Biokatalysator"), tx("catalyst", "Katalysator")],
    hint: tx("A substance that speeds up a reaction without being used up is a catalyst.", "Ein Stoff, der eine Reaktion beschleunigt, ohne verbraucht zu werden, ist ein Katalysator."),
    show: tx('"biocatalysts"', '"Biokatalysatoren"'),
    note: tx("Catalysts speed up reactions and are not used up. Enzymes come from living things: **biocatalysts**.", "Katalysatoren beschleunigen Reaktionen und werden nicht verbraucht. Enzyme stammen aus Lebewesen: **Biokatalysatoren**."),
  },
  {
    q: tx("Which group of substances do all enzymes belong to?", "Zu welcher Stoffgruppe gehören alle Enzyme?"),
    accept: [tx("proteins", "Proteine"), tx("protein", "Protein"), tx("proteins", "Eiweiße"), tx("protein", "Eiweiß"), tx("proteins", "Eiweißstoffe")],
    hint: tx("Egg white belongs to the same group.", "Eiklar gehört zur selben Stoffgruppe."),
    show: tx('"proteins"', '"Proteine (Eiweiße)"'),
    note: tx("All enzymes are **proteins**. That's why heat destroys them, just like it changes egg white.", "Alle Enzyme sind **Proteine**. Darum zerstört Hitze sie, so wie sie Eiklar verändert."),
    wrong: [
      { word: tx("carbohydrates", "Kohlenhydrate"), title: tx("Carbohydrates are substrates", "Kohlenhydrate sind Substrate"), say: tx("Carbohydrates like starch are what enzymes work **on**. The enzymes themselves are another group.", "Kohlenhydrate wie Stärke sind das, woran Enzyme arbeiten. Die Enzyme selbst gehören zu einer anderen Gruppe.") },
      { word: tx("fats", "Fette"), title: tx("Fats are substrates", "Fette sind Substrate"), say: tx("Fats are split by lipases. The enzymes themselves belong to another group.", "Fette werden von Lipasen gespalten. Die Enzyme selbst gehören zu einer anderen Gruppe.") },
    ],
  },
  {
    q: tx("Which solution do you use to test for starch?", "Mit welcher Lösung weist man Stärke nach?"),
    accept: [tx("iodine solution", "Iod-Kaliumiodid-Lösung"), tx("iodine solution", "Iodlösung"), tx("iodine", "Iod"), "Jod", "Jodlösung", tx("Lugol's iodine", "Lugolsche Lösung"), "Lugol"],
    hint: tx("Starch turns it blue-black.", "Stärke färbt sie blau-schwarz."),
    show: tx('"iodine solution"', '"Iod-Kaliumiodid-Lösung"'),
    note: tx("**Iodine solution** (iodine-potassium iodide) turns blue-black with starch.", "**Iod-Kaliumiodid-Lösung** färbt sich mit Stärke blau-schwarz."),
    wrong: [{ word: tx("Fehling's solution", "Fehling"), title: tx("Fehling tests for sugar", "Fehling weist Zucker nach"), say: tx("Fehling's test shows certain sugars (brick red). For starch you need another solution.", "Die Fehling-Probe zeigt bestimmte Zucker an (ziegelrot). Für Stärke brauchst du eine andere Lösung.") }],
  },
  {
    q: tx("What is the pocket of the enzyme called where the substrate fits in?", "Wie heißt die Tasche des Enzyms, in die das Substrat passt?"),
    accept: [tx("active site", "aktives Zentrum"), tx("active centre", "aktive Zentrum")],
    hint: tx("Two words: it's where the enzyme is active.", "Zwei Wörter: Hier ist das Enzym aktiv."),
    show: tx('"active site"', '"aktives Zentrum"'),
    note: tx("The substrate fits into the **active site** like a key into a lock.", "Das Substrat passt ins **aktive Zentrum** wie ein Schlüssel ins Schloss."),
  },
  {
    q: tx("Which sugar forms when amylase splits starch?", "Welcher Zucker entsteht, wenn Amylase Stärke spaltet?"),
    accept: [tx("maltose", "Malzzucker"), tx("maltose", "Maltose"), tx("malt sugar", "Malzzucker")],
    hint: tx("It's named after malt and is made of two glucose units.", "Er ist nach dem Malz benannt und besteht aus zwei Traubenzucker-Bausteinen."),
    show: tx('"maltose"', '"Malzzucker (Maltose)"'),
    note: tx("Amylase cuts starch into **maltose**: pieces of two glucose units.", "Amylase schneidet Stärke in **Malzzucker**: Stücke aus zwei Traubenzucker-Bausteinen."),
    wrong: [{ word: tx("glucose", "Traubenzucker"), title: tx("Two units, not one", "Zwei Bausteine, nicht einer"), say: tx("Nearly! Amylase cuts off pieces of **two** glucose units. That sugar has its own name.", "Fast! Die Amylase schneidet Stücke aus **zwei** Traubenzucker-Bausteinen ab. Dieser Zucker hat einen eigenen Namen."), close: true }],
  },
  {
    q: tx("What are the substances called that form in an enzyme reaction?", "Wie heißen die Stoffe, die bei einer Enzymreaktion entstehen?"),
    accept: [tx("products", "Produkte"), tx("product", "Produkt"), tx("reaction products", "Reaktionsprodukte")],
    hint: tx("They come out at the end.", "Sie kommen am Ende heraus."),
    show: tx('"products"', '"Produkte"'),
    note: tx("Substrate in, **products** out. The enzyme stays the same.", "Substrat hinein, **Produkte** heraus. Das Enzym bleibt gleich."),
    wrong: [{ word: tx("substrate", "Substrat"), title: tx("That's the starting substance", "Das ist der Ausgangsstoff"), say: tx("The substrate is what goes **in**. What comes out has another name.", "Das Substrat geht **hinein**. Was herauskommt, heißt anders.") }],
  },
];

function termTask(rng: Rng): Exercise {
  const q = rng.pick(TERMS);
  const right: AnswerSpec = { kind: "word", accept: q.accept };
  const m = mistakes(right);
  for (const w of q.wrong ?? []) m.add({ kind: "word", accept: [w.word] }, w.title, w.say, w.close);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: q.q,
    answer: right,
    hint: q.hint,
    solution: [{ math: q.show, note: q.note }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// The drawing: what is marked?

const PART_NAMES: Record<string, Text> = {
  substrate: tx("substrate", "Substrat"),
  enzyme: tx("enzyme", "Enzym"),
  active: tx("active site", "aktives Zentrum"),
  products: tx("products", "Produkte"),
};
const PART_WHY: Record<string, Text> = {
  substrate: tx("The substrate is the substance that comes to the enzyme and is split.", "Das Substrat ist der Stoff, der zum Enzym kommt und gespalten wird."),
  enzyme: tx("The big folded protein is the enzyme. It looks the same before and after.", "Das große gefaltete Protein ist das Enzym. Es sieht vorher und nachher gleich aus."),
  active: tx("The pocket in the enzyme where the substrate fits is the active site.", "Die Tasche im Enzym, in die das Substrat passt, ist das aktive Zentrum."),
  products: tx("The two pieces leaving the enzyme are the products.", "Die zwei Teile, die sich vom Enzym lösen, sind die Produkte."),
};
const PART_MIX: Record<string, Partial<Record<string, { title: Text; say: Text }>>> = {
  substrate: { products: { title: tx("Before, not after", "Vorher, nicht nachher"), say: tx("That piece is still whole and hasn't reached the enzyme yet. Products only exist after the reaction.", "Dieses Teil ist noch ganz und noch nicht am Enzym. Produkte gibt es erst nach der Reaktion.") } },
  products: { substrate: { title: tx("Already split", "Schon gespalten"), say: tx("These pieces have already been split and are leaving the enzyme. So they're no longer the substrate.", "Diese Teile sind schon gespalten und lösen sich vom Enzym. Sie sind also kein Substrat mehr.") } },
  active: { enzyme: { title: tx("Only part of it", "Nur ein Teil davon"), say: tx("Right area! But the question marks only the pocket where the substrate fits. That part has its own name.", "Richtige Gegend! Markiert ist aber nur die Tasche, in die das Substrat passt. Dieser Teil hat einen eigenen Namen.") } },
  enzyme: { substrate: { title: tx("The big one is the enzyme", "Das große ist das Enzym"), say: tx("The substrate is the small piece that gets split. The big folded molecule is the enzyme.", "Das Substrat ist das kleine Teil, das gespalten wird. Das große gefaltete Molekül ist das Enzym.") } },
};

function figureTask(rng: Rng): Exercise {
  const ask = rng.pick(["substrate", "enzyme", "active", "products"]);
  const others = Object.keys(PART_NAMES).filter((k) => k !== ask);
  const opts: Opt[] = [{ text: PART_NAMES[ask] }, ...others.map((k) => ({ text: PART_NAMES[k], ...(PART_MIX[ask]?.[k] ?? {}) }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Name the part", "Benenne das Teil"),
    text: tx("The drawing shows an enzyme reaction in three stages. What is marked with ?", "Die Zeichnung zeigt eine Enzymreaktion in drei Stufen. Was ist mit ? markiert?"),
    visual: visual(EnzymeProcess, { mode: "numbers", ask, legend: "none", show: [ask] }),
    answer: c.answer,
    hint: tx("Left: before the reaction. Middle: during. Right: after.", "Links: vor der Reaktion. Mitte: währenddessen. Rechts: danach."),
    solution: [{ math: txMap((_, l) => `"${resolveText(PART_NAMES[ask], l)}"`), note: PART_WHY[ask] }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Which substrate fits? (lock and key)

const TEETH: Tooth[] = ["tri", "round", "square"];

function fitTask(rng: Rng): Exercise {
  const [l, r] = rng.shuffle(TEETH).slice(0, 2) as [Tooth, Tooth];
  const third = TEETH.find((x) => x !== l && x !== r)!;
  const decoys: { teeth: [Tooth, Tooth]; title: Text; say: Text }[] = rng.shuffle([
    { teeth: [r, l], title: tx("Mirror image", "Seitenverkehrt"), say: tx("The shapes are right, but on the wrong sides. In the active site everything has to be in exactly its place.", "Die Formen stimmen, aber auf der falschen Seite. Im aktiven Zentrum muss alles genau an seinem Platz sitzen.") },
    { teeth: [l, third], title: tx("Only half fits", "Nur halb passend"), say: tx("The left side fits, but the right side doesn't. Like a key, the whole shape has to fit.", "Die linke Seite passt, die rechte nicht. Wie bei einem Schlüssel muss die ganze Form passen.") },
    { teeth: [third, r], title: tx("Only half fits", "Nur halb passend"), say: tx("The right side fits, but the left side doesn't. Like a key, the whole shape has to fit.", "Die rechte Seite passt, die linke nicht. Wie bei einem Schlüssel muss die ganze Form passen.") },
  ] as { teeth: [Tooth, Tooth]; title: Text; say: Text }[]).slice(0, 2);
  const all = rng.shuffle([{ teeth: [l, r] as [Tooth, Tooth], right: true as const }, ...decoys.map((d) => ({ ...d, right: false as const }))]);
  const options = all.map((_, i) => tx(`substrate ${i + 1}`, `Substrat ${i + 1}`));
  const correct = all.findIndex((a) => a.right);
  const ms: Mistake[] = all.flatMap((a, i) => (!a.right && "say" in a ? [{ when: { kind: "choice", options, correct: i } as AnswerSpec, title: a.title, say: a.say }] : []));
  return {
    instruction: tx("Find the matching substrate", "Finde das passende Substrat"),
    text: tx("Only one of the three substances is the substrate of this enzyme. Which one?", "Nur einer der drei Stoffe ist das Substrat dieses Enzyms. Welcher?"),
    visual: visual(EnzymeFit, { pocket: [l, r], options: all.map((a) => a.teeth) }),
    answer: { kind: "choice", options, correct },
    hint: tx("Compare the bottom of each substance with the pocket of the enzyme, left and right.", "Vergleich die Unterseite jedes Stoffs mit der Tasche des Enzyms, links und rechts."),
    solution: [
      {
        math: tx(`"substrate ${correct + 1}" \\to "active site"`, `"Substrat ${correct + 1}" \\to "aktives Zentrum"`),
        note: tx("Only this substance fits exactly into the active site, like a key into its lock. The others can't bind, so the enzyme can't convert them.", "Nur dieser Stoff passt genau ins aktive Zentrum, wie ein Schlüssel in sein Schloss. Die anderen können nicht binden, also kann das Enzym sie nicht umsetzen."),
      },
    ],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Numbers: enzymes keep working

function countTask(rng: Rng): Exercise {
  if (rng.chance(0.35)) {
    const enz = rng.pick([20, 50, 100, 200]);
    const sub = rng.pick([5000, 10000, 20000, 50000]);
    const right: AnswerSpec = { kind: "number", value: enz, unit: tx("molecules", "Moleküle") };
    const m = mistakes(right);
    m.add({ kind: "number", value: 0 }, USED_UP, tx("Ah, you thought the enzymes were used up. They come out of every reaction **unchanged**, so they're all still there.", "Ah, du dachtest, die Enzyme werden verbraucht. Sie gehen aber **unverändert** aus jeder Reaktion hervor, sind also alle noch da."));
    m.add({ kind: "number", value: sub }, tx("That's the substrate", "Das ist das Substrat"), tx("That's the number of substrate particles at the start. The question asks about the enzyme molecules.", "Das ist die Zahl der Substratteilchen am Anfang. Gefragt sind die Enzymmoleküle."));
    m.add({ kind: "number", value: Math.max(0, enz - sub) }, USED_UP, tx("You took one enzyme away for each substrate. But each enzyme can convert many substrates and stays unchanged.", "Du hast für jedes Substrat ein Enzym abgezogen. Jedes Enzym kann aber viele Substrate umsetzen und bleibt unverändert."));
    return {
      instruction: tx("Think it through", "Denk es durch"),
      text: txMap((tt) =>
        tt(
          `A test tube contains ${enz} amylase molecules and ${sub} starch molecules. After an hour all the starch is split. How many amylase molecules are in the tube now?`,
          `In einem Reagenzglas sind ${enz} Amylase-Moleküle und ${sub} Stärkemoleküle. Nach einer Stunde ist die ganze Stärke gespalten. Wie viele Amylase-Moleküle sind jetzt im Glas?`,
        ),
      ),
      answer: right,
      hint: tx("What happens to an enzyme in the reaction?", "Was passiert mit einem Enzym bei der Reaktion?"),
      solution: [{ math: tx(`"enzymes before" = "enzymes after" = ${enz}`, `"Enzyme vorher" = "Enzyme nachher" = ${enz}`), note: tx("Enzymes are not used up. All of them are still there and could split more starch.", "Enzyme werden nicht verbraucht. Alle sind noch da und könnten weitere Stärke spalten.") }],
      mistakes: m.list,
    };
  }
  const per = rng.pick([100, 200, 250, 300, 400, 500]);
  const minutes = rng.chance(0.4);
  const t = minutes ? rng.pick([1, 2, 3]) : rng.pick([5, 10, 20, 30]);
  const secs = minutes ? t * 60 : t;
  const value = per * secs;
  const right: AnswerSpec = { kind: "number", value, unit: tx("bonds", "Bindungen") };
  const m = mistakes(right);
  m.add({ kind: "number", value: 1 }, USED_UP, tx("You treated the enzyme as used up after one reaction. But it keeps working, again and again!", "Du hast so gerechnet, als wäre das Enzym nach einer Reaktion verbraucht. Es arbeitet aber immer weiter!"));
  m.add({ kind: "number", value: per }, tx("Only the first second", "Nur die erste Sekunde"), tx("That's just the first second. The enzyme keeps going for the whole time.", "Das ist nur die erste Sekunde. Das Enzym macht die ganze Zeit weiter."));
  if (minutes) m.add({ kind: "number", value: per * t }, tx("Minutes into seconds", "Minuten in Sekunden"), tx(`Nearly! The rate is per **second**. ${t} min are ${secs} s.`, `Fast! Die Angabe gilt pro **Sekunde**. ${t} min sind ${secs} s.`), true);
  m.add({ kind: "number", value: per + secs }, tx("Multiply, don't add", "Malnehmen statt addieren"), tx("Every second the enzyme splits the same number again, so multiply.", "In jeder Sekunde spaltet das Enzym wieder dieselbe Zahl, also malnehmen."));
  return {
    instruction: tx("Calculate", "Berechne"),
    text: txMap((tt) =>
      tt(
        `One amylase molecule splits about ${per} bonds in starch per second. How many bonds does it split in ${minutes ? `${t} minute${t > 1 ? "s" : ""}` : `${t} seconds`}?`,
        `Ein Amylase-Molekül spaltet pro Sekunde etwa ${per} Bindungen in der Stärke. Wie viele Bindungen spaltet es in ${minutes ? `${t} ${t > 1 ? "Minuten" : "Minute"}` : `${t} Sekunden`}?`,
      ),
    ),
    answer: right,
    hint: tx("The enzyme is not used up. It keeps splitting at the same speed.", "Das Enzym wird nicht verbraucht. Es spaltet im gleichen Tempo weiter."),
    solution: [
      ...(minutes ? [{ math: `${t} "min" = ${secs} "s"`, note: tx("First into seconds.", "Zuerst in Sekunden umrechnen.") }] : []),
      { math: `${per} \\cdot ${secs} = ${value}`, note: tx(`Every second ${per} bonds, for ${secs} seconds: **${value}** bonds. The enzyme is still unchanged.`, `Jede Sekunde ${per} Bindungen, ${secs} Sekunden lang: **${value}** Bindungen. Das Enzym ist danach immer noch unverändert.`) },
    ],
    mistakes: m.list,
  };
}

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [2, () => factTask(rng)],
    [1.3, () => statementsTask(rng)],
    [1.6, () => tubesTask(rng)],
    [1.1, () => orderTask(rng)],
    [1.2, () => matchTask(rng)],
    [1.2, () => termTask(rng)],
    [0.9, () => figureTask(rng)],
    [0.9, () => fitTask(rng)],
    [0.9, () => countTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const usedUpCheck = choice(createRng(11), [
  { text: tx("It stays unchanged and can split the next substrate.", "Es bleibt unverändert und kann das nächste Substrat spalten.") },
  { text: tx("It is used up and has to be made again.", "Es wird verbraucht und muss neu gebildet werden."), title: USED_UP, say: tx("Classic trap! Enzymes are **not used up**. Look at the counter in the animation: zero enzymes used up.", "Die klassische Falle! Enzyme werden **nicht verbraucht**. Schau auf den Zähler in der Animation: null verbrauchte Enzyme.") },
  { text: tx("It becomes one of the products.", "Es wird selbst zu einem der Produkte."), title: tx("Products come from the substrate", "Produkte kommen vom Substrat"), say: tx("The products are the two pieces of the **substrate**. The enzyme comes out unchanged.", "Die Produkte sind die zwei Teile des **Substrats**. Das Enzym geht unverändert hervor.") },
  { text: tx("It dies, because its work is done.", "Es stirbt ab, weil seine Arbeit getan ist."), title: NOT_ALIVE, say: tx("Enzymes can't die: they are molecules, not living things.", "Enzyme können nicht sterben: Sie sind Moleküle, keine Lebewesen.") },
]);

const boiledCheck = choice(createRng(5), BOILED_WHY);

const stainPairs: [Text, Text][] = [
  [E.protease, STAIN.blood],
  [E.lipase, STAIN.butter],
  [E.amylase, STAIN.pudding],
];

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Why bread turns sweet", "Warum Brot süß wird"),
      blob: tx("Chew a piece of bread for a really long time. Notice anything?", "Kau mal ein Stück Brot richtig lange. Merkst du was?"),
      body: tx(
        "Bread contains lots of **starch**, and starch doesn't taste sweet. But chew long enough and the bread starts to taste a little sweet. A helper in your saliva is at work: the **enzyme amylase**.",
        "Brot enthält viel **Stärke**, und Stärke schmeckt nicht süß. Kaust du aber lange genug, schmeckt das Brot plötzlich leicht süß. In deinem Speichel arbeitet ein Helfer: das **Enzym Amylase**.",
      ),
      frames: [
        { math: tx('"starch"#st', '"Stärke"#st'), note: tx("Starch is a huge molecule: a long chain of many glucose units.", "Stärke ist ein riesiges Molekül: eine lange Kette aus vielen Traubenzucker-Bausteinen.") },
        { math: tx('"starch"#st \\to#ar "maltose"#ma', '"Stärke"#st \\to#ar "Malzzucker"#ma'), note: tx("Amylase cuts the chain into small pieces of two units each: **maltose** (malt sugar). It tastes sweet.", "Die Amylase schneidet die Kette in kleine Stücke aus je zwei Bausteinen: **Malzzucker** (Maltose). Der schmeckt süß.") },
        {
          math: tx('"starch"#st \\to#ar "maltose"#ma \\quad \\blob{("amylase")}#am', '"Stärke"#st \\to#ar "Malzzucker"#ma \\quad \\blob{("Amylase")}#am'),
          note: tx("Without amylase this would take years. With amylase it takes minutes.", "Ohne Amylase würde das Jahre dauern. Mit Amylase dauert es nur Minuten."),
        },
        {
          math: tx('"amylase before"#a1 =#eq "amylase after"#a2', '"Amylase vorher"#a1 =#eq "Amylase nachher"#a2'),
          note: tx("And the best part: amylase is **not used up**. After each cut it is ready for the next starch chain.", "Und das Beste: Die Amylase wird dabei **nicht verbraucht**. Nach jedem Schnitt ist sie bereit für die nächste Stärkekette."),
        },
      ],
    },
    {
      type: "explain",
      title: tx("Enzymes are biocatalysts", "Enzyme sind Biokatalysatoren"),
      blob: tx("Enzymes are the busiest helpers in your body.", "Enzyme sind die fleißigsten Helfer in deinem Körper."),
      body: tx(
        "**Enzymes** are **proteins** made in cells. They **speed up** chemical reactions in living things without being used up themselves. Substances that can do this are called **catalysts**. Because enzymes come from living things, they are called **biocatalysts**.",
        "**Enzyme** sind **Proteine** (Eiweißstoffe), die in Zellen gebildet werden. Sie **beschleunigen** chemische Reaktionen in Lebewesen, ohne selbst verbraucht zu werden. Stoffe, die das können, heißen **Katalysatoren**. Weil Enzyme aus Lebewesen stammen, nennt man sie **Biokatalysatoren**.",
      ),
      frames: [
        { math: tx('"enzyme"#e =#eq "protein"#p', '"Enzym"#e =#eq "Protein"#p'), note: tx("Enzymes are proteins. They are molecules, not living things.", "Enzyme sind Proteine. Sie sind Moleküle, keine Lebewesen.") },
        { math: tx('"enzyme"#e \\Rightarrow#to "faster reaction"#r', '"Enzym"#e \\Rightarrow#to "schnellere Reaktion"#r'), note: tx("They speed up reactions, often by a factor of millions.", "Sie beschleunigen Reaktionen, oft um das Millionenfache.") },
        { math: tx('"enzyme before"#e =#eq "enzyme after"#a', '"Enzym vorher"#e =#eq "Enzym nachher"#a'), note: tx("After the reaction the enzyme is unchanged. It can carry on straight away.", "Nach der Reaktion liegt das Enzym unverändert vor. Es kann sofort weiterarbeiten.") },
        {
          math: tx('"amyl"\\blob{"ase"} \\quad "prote"\\blob{"ase"} \\quad "lip"\\blob{"ase"}', '"Amyl"\\blob{"ase"} \\quad "Prote"\\blob{"ase"} \\quad "Lip"\\blob{"ase"}'),
          note: tx("Most enzyme names end in **-ase**. The name often tells you the substance: amylase splits starch (Latin amylum), protease proteins, lipase lipids (fats).", "Die meisten Enzymnamen enden auf **-ase**. Der Name verrät oft den Stoff: Amylase spaltet Stärke (lateinisch amylum), Protease Proteine, Lipase Lipide (Fette)."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("An enzyme at work", "Ein Enzym bei der Arbeit"),
      blob: tx("Press Next step and watch closely!", "Drück auf Nächster Schritt und schau genau hin!"),
      body: tx(
        "Watch step by step how the enzyme splits its substrate. Keep an eye on the counter. Then try a different substance: does it fit too?",
        "Schau Schritt für Schritt zu, wie das Enzym sein Substrat spaltet. Behalte den Zähler im Blick. Probier dann einen anderen Stoff aus: Passt der auch?",
      ),
      widget: () => <EnzymeLockKey level={1} />,
    },
    {
      type: "explain",
      title: tx("The lock and key model", "Das Schlüssel-Schloss-Prinzip"),
      blob: tx("Not every key fits every lock!", "Nicht jeder Schlüssel passt in jedes Schloss!"),
      body: tx(
        "The substance an enzyme converts is its **substrate**. The substrate fits exactly into a pocket of the enzyme, the **active site**, like a key into its lock. That's why each enzyme converts only one particular substrate. This is a **model**: it shows the important idea, but real enzymes look different.",
        "Den Stoff, den ein Enzym umsetzt, nennt man **Substrat**. Das Substrat passt genau in eine Tasche des Enzyms, das **aktive Zentrum**, so wie ein Schlüssel in sein Schloss. Darum setzt jedes Enzym nur ein bestimmtes Substrat um. Das ist ein **Modell**: Es zeigt die wichtige Idee, aber echte Enzyme sehen anders aus.",
      ),
      frames: [
        { math: tx('"enzyme"#e +#p1 "substrate"#s', '"Enzym"#e +#p1 "Substrat"#s'), note: tx("Enzyme and substrate meet.", "Enzym und Substrat treffen aufeinander.") },
        { math: tx('"enzyme"#e +#p1 "substrate"#s \\to#a1 "enzyme with substrate"#es', '"Enzym"#e +#p1 "Substrat"#s \\to#a1 "Enzym mit Substrat"#es'), note: tx("If the shape fits, the substrate binds in the active site.", "Passt die Form, bindet das Substrat im aktiven Zentrum.") },
        {
          math: tx('"enzyme"#e +#p1 "substrate"#s \\to#a1 "enzyme with substrate"#es \\to#a2 "enzyme"#e2 +#p2 "products"#pr', '"Enzym"#e +#p1 "Substrat"#s \\to#a1 "Enzym mit Substrat"#es \\to#a2 "Enzym"#e2 +#p2 "Produkte"#pr'),
          note: tx("The substrate is converted, for example split. Out come the **products** and the unchanged enzyme.", "Das Substrat wird umgesetzt, zum Beispiel gespalten. Heraus kommen die **Produkte** und das unveränderte Enzym."),
        },
        {
          math: tx('"amylase:" "starch" \\quad \\strike{"fat"} \\quad \\strike{"protein"}', '"Amylase:" "Stärke" \\quad \\strike{"Fett"} \\quad \\strike{"Eiweiß"}'),
          note: tx("Each enzyme has its substrate: amylase splits starch, but no fat and no protein.", "Jedes Enzym hat sein Substrat: Amylase spaltet Stärke, aber kein Fett und kein Eiweiß."),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Quick check: what happens to the enzyme?", "Kurzer Check: Was passiert mit dem Enzym?"),
      exercise: {
        instruction: PICK,
        text: tx("An enzyme has just split a substrate. What happens to the enzyme?", "Ein Enzym hat gerade ein Substrat gespalten. Was passiert mit dem Enzym?"),
        visual: visual(EnzymeProcess, { mode: "plain" }),
        answer: usedUpCheck.answer,
        hint: tx("Compare the enzyme on the left with the one on the right.", "Vergleich das Enzym links mit dem rechts."),
        solution: [
          { math: tx('"enzyme before" = "enzyme after"', '"Enzym vorher" = "Enzym nachher"'), note: tx("The enzyme comes out of the reaction **unchanged** and can split the next substrate straight away. Enzymes are not used up.", "Das Enzym geht **unverändert** aus der Reaktion hervor und kann sofort das nächste Substrat spalten. Enzyme werden nicht verbraucht.") },
        ],
        mistakes: usedUpCheck.mistakes,
      },
    },
    {
      type: "widget",
      title: tx("The starch experiment", "Der Stärke-Versuch"),
      blob: tx("Time for an experiment! Let the clock run.", "Zeit für ein Experiment! Lass die Uhr laufen."),
      body: tx(
        "Iodine solution (iodine-potassium iodide) turns starch **blue-black**, so you can see whether starch is there. Three test tubes contain starch solution with a little iodine solution. Water, saliva or boiled saliva is added. All three stand at 37 °C.",
        "Iod-Kaliumiodid-Lösung färbt Stärke **blau-schwarz**. So siehst du, ob Stärke da ist. In drei Reagenzgläsern ist Stärkelösung mit etwas Iodlösung. Dazu kommt Wasser, Speichel oder abgekochter Speichel. Alle drei stehen bei 37 °C.",
      ),
      widget: EnzymeStarchLab,
    },
    {
      type: "explain",
      title: tx("What the experiment shows", "Was der Versuch zeigt"),
      blob: tx("A good experiment always needs something to compare with.", "Ein guter Versuch braucht immer einen Vergleich."),
      body: tx(
        "**Iodine test for starch**: iodine solution is yellow-brown. With starch it turns blue-black. If the blue-black colour disappears, there is no starch left.",
        "**Iod-Stärke-Nachweis**: Iod-Kaliumiodid-Lösung ist gelb-braun. Mit Stärke färbt sie sich blau-schwarz. Verschwindet die blau-schwarze Farbe, ist keine Stärke mehr da.",
      ),
      frames: [
        { math: tx('"A: water"#a \\to#a1 "blue-black"#a2', '"A: Wasser"#a \\to#a1 "blau-schwarz"#a2'), note: tx("Tube A (only water) stays blue-black: without an enzyme the starch isn't broken down. A is the **control**.", "Glas A (nur Wasser) bleibt blau-schwarz: Ohne Enzym wird die Stärke nicht abgebaut. A ist der **Kontrollansatz**.") },
        {
          math: tx('"A: water"#a \\to#a1 "blue-black"#a2 \\\\ "B: saliva"#b \\to#b1 \\green{"yellow-brown"}#b2', '"A: Wasser"#a \\to#a1 "blau-schwarz"#a2 \\\\ "B: Speichel"#b \\to#b1 \\green{"gelb-braun"}#b2'),
          note: tx("Tube B turns yellow-brown: the amylase in the saliva has split the starch.", "Glas B wird gelb-braun: Die Amylase im Speichel hat die Stärke gespalten."),
        },
        {
          math: tx(
            '"A: water"#a \\to#a1 "blue-black"#a2 \\\\ "B: saliva"#b \\to#b1 \\green{"yellow-brown"}#b2 \\\\ "C: boiled saliva"#c \\to#c1 "blue-black"#c2',
            '"A: Wasser"#a \\to#a1 "blau-schwarz"#a2 \\\\ "B: Speichel"#b \\to#b1 \\green{"gelb-braun"}#b2 \\\\ "C: abgekochter Speichel"#c \\to#c1 "blau-schwarz"#c2',
          ),
          note: tx("Tube C stays blue-black: boiling has destroyed the protein amylase. A destroyed enzyme no longer works.", "Glas C bleibt blau-schwarz: Beim Kochen wurde das Protein Amylase zerstört. Ein zerstörtes Enzym arbeitet nicht mehr."),
        },
        {
          math: tx('"saliva contains an enzyme that splits starch"', '"Speichel enthält ein Enzym, das Stärke spaltet"'),
          note: tx("Result: only active amylase removes the starch. Water alone doesn't, and neither does destroyed amylase.", "Ergebnis: Nur aktive Amylase baut die Stärke ab. Wasser allein schafft das nicht, zerstörte Amylase auch nicht."),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Now you're the scientist!", "Jetzt bist du die Forscherin oder der Forscher!"),
      exercise: {
        instruction: tx("Explain the result", "Erkläre das Ergebnis"),
        text: tx("After 10 minutes at 37 °C, iodine solution was added to all tubes. Why is tube C still blue-black?", "Nach 10 Minuten bei 37 °C wurde in alle Gläser Iodlösung gegeben. Warum ist Glas C noch blau-schwarz?"),
        visual: visual(EnzymeTubes, {
          tubes: [
            { label: "A", content: CONTENT.water, colour: "starch" },
            { label: "B", content: CONTENT.saliva, colour: "iodine" },
            { label: "C", content: CONTENT.boiled, colour: "starch" },
          ],
        }),
        answer: boiledCheck.answer,
        hint: tx("Enzymes are proteins. What does heat do to proteins?", "Enzyme sind Proteine. Was macht Hitze mit Proteinen?"),
        solution: [{ math: tx('"boiled" \\Rightarrow "amylase destroyed"', '"abgekocht" \\Rightarrow "Amylase zerstört"'), note: tx("Amylase is a protein. Boiling changes its shape for good, so it can't split starch any more. The starch stays, the solution stays blue-black.", "Amylase ist ein Protein. Kochen verändert seine Form dauerhaft, darum kann es keine Stärke mehr spalten. Die Stärke bleibt, die Lösung bleibt blau-schwarz.") }],
        mistakes: boiledCheck.mistakes,
      },
    },
    {
      type: "explain",
      title: tx("Enzymes in everyday life", "Enzyme im Alltag"),
      blob: tx("Enzymes even help you do the laundry!", "Enzyme helfen dir sogar beim Wäschewaschen!"),
      body: tx(
        "Many washing powders contain enzymes. They split stains into small, water-soluble pieces that wash out. Because each enzyme only converts its own substrate, a washing powder needs several enzymes.",
        "Viele Waschmittel enthalten Enzyme. Sie spalten Flecken in kleine, wasserlösliche Teile, die sich auswaschen lassen. Weil jedes Enzym nur sein eigenes Substrat umsetzt, braucht ein Waschmittel mehrere Enzyme.",
      ),
      frames: [
        { math: tx('"protease"#p1 \\to#t1 "protein stains (blood, egg)"#s1', '"Protease"#p1 \\to#t1 "Eiweißflecken (Blut, Ei)"#s1'), note: tx("Proteases split proteins, for example in blood or egg stains.", "Proteasen spalten Eiweiße (Proteine), zum Beispiel in Blut- oder Eiflecken.") },
        {
          math: tx('"protease"#p1 \\to#t1 "protein stains (blood, egg)"#s1 \\\\ "lipase"#p2 \\to#t2 "fat stains (butter, oil)"#s2', '"Protease"#p1 \\to#t1 "Eiweißflecken (Blut, Ei)"#s1 \\\\ "Lipase"#p2 \\to#t2 "Fettflecken (Butter, Öl)"#s2'),
          note: tx("Lipases split fats (lipids).", "Lipasen spalten Fette (Lipide)."),
        },
        {
          math: tx(
            '"protease"#p1 \\to#t1 "protein stains (blood, egg)"#s1 \\\\ "lipase"#p2 \\to#t2 "fat stains (butter, oil)"#s2 \\\\ "amylase"#p3 \\to#t3 "starch stains (pudding, sauce)"#s3',
            '"Protease"#p1 \\to#t1 "Eiweißflecken (Blut, Ei)"#s1 \\\\ "Lipase"#p2 \\to#t2 "Fettflecken (Butter, Öl)"#s2 \\\\ "Amylase"#p3 \\to#t3 "Stärkeflecken (Pudding, Soße)"#s3',
          ),
          note: tx("Amylases split starch. Lactase is used in food: it splits milk sugar and makes lactose-free milk.", "Amylasen spalten Stärke. Auch in Lebensmitteln stecken Enzyme: Laktase spaltet Milchzucker, so entsteht laktosefreie Milch."),
        },
        {
          math: tx('95 \\deg"C" \\Rightarrow "enzymes destroyed"', '95 \\deg"C" \\Rightarrow "Enzyme zerstört"'),
          note: tx("Most washing powder enzymes work best between 30 and 60 °C. A 95 °C hot wash destroys them, because they are proteins.", "Die meisten Waschmittel-Enzyme arbeiten am besten bei 30 bis 60 °C. Bei Kochwäsche mit 95 °C werden sie zerstört, denn sie sind Proteine."),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Last one: be the laundry expert!", "Die letzte: Sei Wäsche-Profi!"),
      exercise: {
        instruction: tx("Match the pairs", "Ordne zu"),
        text: tx("Which enzyme in washing powder removes which stain?", "Welches Waschmittel-Enzym entfernt welchen Fleck?"),
        answer: { kind: "match", pairs: stainPairs, distractors: [STAIN.rust] },
        hint: tx("What is each stain mainly made of: protein, fat or starch?", "Woraus besteht jeder Fleck vor allem: Eiweiß, Fett oder Stärke?"),
        solution: [
          {
            math: tx('"protease" \\to "blood stain" \\\\ "lipase" \\to "butter stain" \\\\ "amylase" \\to "pudding stain"', '"Protease" \\to "Blutfleck" \\\\ "Lipase" \\to "Butterfleck" \\\\ "Amylase" \\to "Puddingfleck"'),
            note: tx("Blood is mostly protein, butter is fat, pudding contains starch. Rust is iron oxide: no enzyme can split it.", "Blut ist vor allem Eiweiß, Butter ist Fett, Pudding enthält Stärke. Rost ist Eisenoxid: Das kann kein Enzym spalten."),
          },
        ],
        mistakes: [
          { when: { kind: "match", pairs: [[E.amylase, STAIN.blood]] }, title: tx("Blood is mostly protein", "Blut ist vor allem Eiweiß"), say: tx("Blood stains are mainly protein. For them you need a **protease**. Amylase goes for starch.", "Blutflecken bestehen vor allem aus Eiweiß. Dafür brauchst du eine **Protease**. Amylase geht an Stärke.") },
          { when: { kind: "match", pairs: [[E.lipase, STAIN.blood]] }, title: tx("Lipase splits fat", "Lipase spaltet Fett"), say: tx("Lipase splits fat, like in butter. Blood is mostly protein: that's for the protease.", "Lipase spaltet Fett, wie in Butter. Blut ist vor allem Eiweiß: Das ist was für die Protease.") },
        ],
      },
    },
  ],
  summary: [
    {
      title: tx("Enzymes are biocatalysts", "Enzyme sind Biokatalysatoren"),
      body: tx(
        "Enzymes are **proteins** made in cells. They **speed up** reactions in living things and are **not used up**: they can work again and again.",
        "Enzyme sind **Proteine**, die in Zellen gebildet werden. Sie **beschleunigen** Reaktionen in Lebewesen und werden dabei **nicht verbraucht**: Sie können immer wieder arbeiten.",
      ),
      examples: [tx('"enzyme before" = "enzyme after"', '"Enzym vorher" = "Enzym nachher"')],
      tone: "rule",
    },
    {
      title: tx("Lock and key model", "Schlüssel-Schloss-Prinzip"),
      body: tx(
        "The **substrate** fits exactly into the **active site** of the enzyme, like a key into its lock. So each enzyme converts only its own substrate. It's a model.",
        "Das **Substrat** passt genau ins **aktive Zentrum** des Enzyms, wie ein Schlüssel in sein Schloss. Darum setzt jedes Enzym nur sein Substrat um. Das ist ein Modell.",
      ),
      examples: [tx('"enzyme" + "substrate" \\to "enzyme" + "products"', '"Enzym" + "Substrat" \\to "Enzym" + "Produkte"')],
      tone: "rule",
    },
    {
      title: tx("Amylase splits starch", "Amylase spaltet Stärke"),
      body: tx("Amylase in saliva splits starch into maltose. That's why bread tastes sweet if you chew it for long.", "Die Amylase im Speichel spaltet Stärke in Malzzucker (Maltose). Darum schmeckt lange gekautes Brot süß."),
      examples: [tx('"starch" \\to "maltose"', '"Stärke" \\to "Malzzucker"')],
      tone: "rule",
    },
    {
      title: tx("Iodine test for starch", "Iod-Stärke-Nachweis"),
      body: tx(
        "Iodine solution (yellow-brown) turns starch **blue-black**. If it stays yellow-brown, there is no starch. Always compare with a control (starch + water).",
        "Iod-Kaliumiodid-Lösung (gelb-braun) färbt Stärke **blau-schwarz**. Bleibt sie gelb-braun, ist keine Stärke da. Vergleiche immer mit einem Kontrollansatz (Stärke + Wasser).",
      ),
      examples: [tx('"starch" + "iodine" \\to "blue-black"', '"Stärke" + "Iod" \\to "blau-schwarz"')],
      tone: "tip",
    },
    {
      title: tx("Enzymes in everyday life", "Enzyme im Alltag"),
      body: tx(
        "Washing powder: protease (protein stains), lipase (fat), amylase (starch). Lactase makes lactose-free milk. Enzyme names usually end in **-ase**.",
        "Waschmittel: Protease (Eiweißflecken), Lipase (Fett), Amylase (Stärke). Laktase macht laktosefreie Milch. Enzymnamen enden meist auf **-ase**.",
      ),
      tone: "tip",
    },
    {
      title: tx("Typical mistakes", "Typische Fehler"),
      body: tx(
        "Enzymes are **not alive** and are **not used up**. Boiling destroys them, because they are proteins. Iodine shows starch, not sugar.",
        "Enzyme sind **keine Lebewesen** und werden **nicht verbraucht**. Kochen zerstört sie, weil sie Proteine sind. Iod zeigt Stärke an, nicht Zucker.",
      ),
      tone: "warning",
    },
  ],
};
