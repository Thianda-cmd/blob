"use client";

import { tx } from "@/i18n/text";
import { createRng } from "@/learn/engine/rng";
import type { Frame, LevelLesson } from "@/learn/types";
import { joinT } from "./kit";
import { MotionLab } from "./MotionLab";
import { PairFinder } from "./PairFinder";
import { CATCH, COUNTED, catchTask, cvChoice, cvExercise, cvSetup, cvSolve, cvSystem, digitStory, meetFrames, MONEY, moneyCV, countedCV, ticketsCV, type CV } from "./stories2";
import { bar, sys } from "./sys";

export { generate2 } from "./stories2";

// Level 2: two unknowns. Two clues become a system of two equations; solve it by substitution
// or elimination and answer in words. Count and value, mixtures, digits, and motion problems.

/** The concert from the first step (8 adult and 12 child tickets). */
const CONCERT: CV = {
  ...ticketsCV(["At the school concert", "Beim Schulkonzert"], 8, 5, 8, 12),
  vars: tx("Let $x$ be the number of adult tickets and $y$ the number of child tickets.", "Sei $x$ die Anzahl der Erwachsenenkarten und $y$ die Anzahl der Kinderkarten."),
};

const setupFrames: Frame[] = [
  ...cvSetup(CONCERT),
  {
    math: cvSystem(CONCERT),
    highlight: ["L1", "L2"],
    note: tx(
      "Two equations with two unknowns form a **system of linear equations**. Its solution is a pair $(x \\,|\\, y)$ that makes **both** equations true.",
      "Zwei Gleichungen mit zwei Unbekannten bilden ein **lineares Gleichungssystem** (LGS). Seine Lösung ist ein Zahlenpaar $(x \\,|\\, y)$, das **beide** Gleichungen erfüllt.",
    ),
  },
];

const solveFrames: Frame[] = cvSolve(CONCERT, tx("Our system from the concert.", "Unser Gleichungssystem vom Konzert."));

const COINS = moneyCV(MONEY[0], 14, 11);
const HOSTEL = countedCV(COUNTED[3], 10, 8);

// Mixture by elimination: 8 €/kg and 13 €/kg to 10 kg at 11 €/kg → 4 kg and 6 kg.
const mixFrames: Frame[] = [
  { math: "x#x1 ,#cm \\quad y#y1", note: tx("Let $x$ be the kg of black tea and $y$ the kg of green tea.", "Sei $x$ die Menge Schwarztee in kg und $y$ die Menge grüner Tee in kg.") },
  {
    math: sys("x#x1 +#p1 y#y1 =#e1 10#n1", "8#a2 x#x2 +#p2 13#b2 y#y2 =#e2 110#n2"),
    note: tx(
      "(I) is the amount: 10 kg. (II) is the money: the mixture is worth $10 \\cdot 11 = 110$ €, exactly as much as its two parts together.",
      "(I) ist die Menge: 10 kg. (II) ist das Geld: Die Mischung ist $10 \\cdot 11 = 110$ € wert, genau so viel wie ihre beiden Teile zusammen.",
    ),
  },
  {
    math: sys(`8#a1 x#x1 +#p1 8#b1 y#y1 =#e1 80#n1`, "8#a2 x#x2 +#p2 13#b2 y#y2 =#e2 110#n2"),
    highlight: ["a1", "x1", "a2", "x2"],
    note: tx(
      "This time we **eliminate**: multiply (I) by 8. Now both equations contain $8x$.",
      "Diesmal nehmen wir das **Additionsverfahren**: Multipliziere (I) mit 8. Jetzt steht in beiden Gleichungen $8x$.",
    ),
  },
  {
    math: `5#b2 y#y2 =#e2 30#n2${bar(": 5")}`,
    note: tx(
      "(II) minus (I): $8x - 8x = 0$, $13y - 8y = 5y$ and $110 - 80 = 30$. The $x$ is gone!",
      "(II) minus (I): $8x - 8x = 0$, $13y - 8y = 5y$ und $110 - 80 = 30$. Das $x$ ist weg!",
    ),
  },
  { math: "y#y2 =#e2 6#n2", highlight: ["y2", "e2", "n2"], note: tx("So $y = 6$.", "Also ist $y = 6$.") },
  { math: `x#x1 +#p1 6#y2 =#e1 10#n1${bar("- 6")}`, note: tx("Put $y = 6$ into (I).", "Setze $y = 6$ in (I) ein.") },
  {
    math: "x#x1 =#e1 4#n1 ,#cm \\quad y#y1 =#e2 6#n2",
    highlight: ["x1", "e1", "n1", "y1", "e2", "n2"],
    note: tx(
      "**Answer:** The shop needs 4 kg of black tea and 6 kg of green tea. Check: $4 + 6 = 10$ and $8 \\cdot 4 + 13 \\cdot 6 = 32 + 78 = 110$.",
      "**Antwort:** Der Laden braucht 4 kg Schwarztee und 6 kg grünen Tee. Probe: $4 + 6 = 10$ und $8 \\cdot 4 + 13 \\cdot 6 = 32 + 78 = 110$.",
    ),
  },
];

const digitExample = digitStory(4, 7);
const digitCheck = digitStory(6, 2);

const meetLesson: Frame[] = (() => {
  const frames = meetFrames(280, 80, 60, false, tx("Car from A, lorry from B.", "Auto aus A, Lkw aus B."));
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = {
    ...last,
    note: joinT(last.note ?? "", tx("**Answer:** They meet at 11:00, 160 km from A.", "**Antwort:** Sie begegnen sich um 11:00 Uhr, 160 km von A entfernt.")),
  };
  return frames;
})();

/** Level 2: two unknowns, a system of two equations from a story, and motion problems. */
export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Two unknowns, two equations", "Zwei Unbekannte, zwei Gleichungen"),
      body: tx(
        "Name both unknowns: **Let $x$ be …, $y$ be …** Every piece of information becomes one equation. The solution is a pair that fits **both**.",
        "Benenne beide Unbekannten: **Sei $x$ …, $y$ …** Jede Information wird zu einer Gleichung. Die Lösung ist ein Zahlenpaar, das **beide** erfüllt.",
      ),
      examples: ['"(I)" \\; x + y = 20 \\quad "(II)" \\; 8x + 5y = 124'],
      tone: "rule",
    },
    {
      title: tx("Count and value", "Anzahl und Wert"),
      body: tx(
        "One equation **counts** (tickets, coins, heads, kg), the other adds up what each one is **worth** (price, value, legs). Mixtures: the mixture is worth as much as its parts.",
        "Eine Gleichung **zählt** (Karten, Münzen, Köpfe, kg), die andere addiert, was jedes einzelne **wert** ist (Preis, Wert, Beine). Mischungen: Die Mischung ist so viel wert wie ihre Teile.",
      ),
      examples: ["x + y = 10", "8x + 13y = 10 \\cdot 11"],
      tone: "rule",
    },
    {
      title: tx("Solve, answer, check", "Lösen, Antwortsatz, Probe"),
      body: tx(
        "**Substitution:** solve one equation for a variable and put it into the other. **Elimination:** add or subtract the equations so that one variable cancels. Then answer with both values and check them in the story.",
        "**Einsetzungsverfahren:** Löse eine Gleichung nach einer Variablen auf und setze sie in die andere ein. **Additionsverfahren:** Addiere oder subtrahiere die Gleichungen, sodass eine Variable wegfällt. Dann Antwortsatz mit beiden Werten und Probe im Text.",
      ),
      examples: ["y = 20 - x", "8x + 5(20 - x) = 124"],
      tone: "rule",
    },
    {
      title: tx("Two-digit numbers", "Zweistellige Zahlen"),
      body: tx("Tens digit $x$, units digit $y$: the number is $10x + y$, with swapped digits $10y + x$.", "Zehnerziffer $x$, Einerziffer $y$: Die Zahl ist $10x + y$, mit vertauschten Ziffern $10y + x$."),
      examples: ["47 = 10 \\cdot 4 + 7", "74 = 10 \\cdot 7 + 4"],
      tone: "tip",
    },
    {
      title: tx("Motion problems", "Bewegungsaufgaben"),
      body: tx(
        "$s = v \\cdot t$ for each one. Towards each other, the gap shrinks by **both** speeds together. Catching up: whoever starts later is on the way for $t$ minus the delay. Where they meet, the lines in the diagram cross.",
        "$s = v \\cdot t$ für jeden. Aufeinander zu schrumpft der Abstand um **beide** Geschwindigkeiten zusammen. Beim Einholen ist, wer später startet, $t$ minus die Verspätung unterwegs. Wo sie sich treffen, schneiden sich die Geraden im Diagramm.",
      ),
      examples: ["80t = 280 - 60t", "30(t - 1) = 15t"],
      tone: "rule",
    },
    {
      title: tx("Classic traps", "Klassische Fallen"),
      body: tx(
        "When you substitute, the number in front multiplies the **whole** bracket. And a pair is only a solution if it fits **both** equations.",
        "Beim Einsetzen multipliziert die Zahl davor die **ganze** Klammer. Und ein Zahlenpaar ist nur dann eine Lösung, wenn es **beide** Gleichungen erfüllt.",
      ),
      examples: ["5(20 - x) = 100 - 5x \\ne 100 - x"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Two unknowns, two clues", "Zwei Unbekannte, zwei Hinweise"),
      blob: tx("Two things are missing? Then you need two names and two equations!", "Zwei Dinge fehlen? Dann brauchst du zwei Namen und zwei Gleichungen!"),
      body: tx(
        "**At the school concert, 20 tickets were sold. Adults pay 8 €, children 5 €. Altogether 124 € came in. How many adult and how many child tickets were sold?** Two numbers are unknown, so you name **two** variables. Each clue becomes one equation.",
        "**Beim Schulkonzert wurden 20 Karten verkauft. Erwachsene zahlen 8 €, Kinder 5 €. Insgesamt kamen 124 € zusammen. Wie viele Erwachsenen- und wie viele Kinderkarten wurden verkauft?** Zwei Zahlen sind unbekannt, also brauchst du **zwei** Variablen. Jeder Hinweis wird zu einer Gleichung.",
      ),
      frames: setupFrames,
    },
    {
      type: "widget",
      title: tx("Find the pair that fits both clues", "Finde das Paar, das beide Hinweise erfüllt"),
      blob: tx("Try some pairs! How many fit just one clue?", "Probier ein paar Zahlenpaare aus! Wie viele passen zu nur einem Hinweis?"),
      body: tx(
        "Each clue on its own has lots of solutions. Change $x$ and $y$ until both clues light up. Then show the lines: every point on a line fits one clue, and the solution of the system is where the lines cross.",
        "Jeder Hinweis allein hat viele Lösungen. Ändere $x$ und $y$, bis beide Hinweise leuchten. Dann blende die Geraden ein: Jeder Punkt auf einer Geraden erfüllt einen Hinweis, und die Lösung des Gleichungssystems liegt dort, wo sich die Geraden schneiden.",
      ),
      widget: PairFinder,
    },
    {
      type: "check",
      blob: tx("Which equation counts, which one adds up the money?", "Welche Gleichung zählt, welche addiert das Geld?"),
      exercise: cvChoice(COINS, createRng(5)),
    },
    {
      type: "explain",
      title: tx("Substitute, solve, answer", "Einsetzen, lösen, antworten"),
      blob: tx("Trying pairs takes ages. Here's the fast way!", "Probieren dauert ewig. So geht es schnell!"),
      body: tx(
        "**Substitution** (Einsetzungsverfahren): solve one equation for a variable and put the result into the other equation. Then only one unknown is left. At the end, answer in a sentence and check **both** clues.",
        "**Einsetzungsverfahren:** Löse eine Gleichung nach einer Variablen auf und setze das Ergebnis in die andere Gleichung ein. Dann ist nur noch eine Unbekannte übrig. Zum Schluss schreibst du einen Antwortsatz und machst die Probe mit **beiden** Hinweisen.",
      ),
      frames: solveFrames,
    },
    {
      type: "check",
      blob: tx("Your turn: rooms and beds!", "Du bist dran: Zimmer und Betten!"),
      exercise: cvExercise(HOSTEL),
    },
    {
      type: "explain",
      title: tx("Mixtures: amount and money", "Mischungen: Menge und Geld"),
      blob: tx("Mixing tea is maths too. And there's a second method!", "Tee mischen ist auch Mathe. Und es gibt eine zweite Methode!"),
      body: tx(
        "**A tea shop mixes black tea at 8 € per kg with green tea at 13 € per kg. It wants 10 kg of mixture that costs 11 € per kg. How much of each does it need?** One equation for the amount, one for the money. This time we solve by **elimination**: make one variable cancel.",
        "**Ein Teeladen mischt Schwarztee für 8 € pro kg mit grünem Tee für 13 € pro kg. Es sollen 10 kg Mischung entstehen, die 11 € pro kg kostet. Wie viel braucht er von jeder Sorte?** Eine Gleichung für die Menge, eine für das Geld. Diesmal lösen wir mit dem **Additionsverfahren**: Eine Variable soll wegfallen.",
      ),
      frames: mixFrames,
    },
    {
      type: "explain",
      title: tx("Digit puzzles", "Ziffernrätsel"),
      blob: tx("47 is 4 tens and 7 ones. That's the whole trick!", "47 sind 4 Zehner und 7 Einer. Das ist schon der ganze Trick!"),
      body: digitExample.text,
      frames: digitExample.frames,
    },
    {
      type: "check",
      blob: tx("Tens digit x, units digit y. You've got this!", "Zehnerziffer x, Einerziffer y. Das schaffst du!"),
      exercise: {
        instruction: tx("Find the two-digit number", "Bestimme die zweistellige Zahl"),
        text: digitCheck.text,
        answer: digitCheck.answer,
        hint: tx("The number is $10x + y$, swapped $10y + x$. Write both clues as equations.", "Die Zahl ist $10x + y$, vertauscht $10y + x$. Schreib beide Hinweise als Gleichungen."),
        solution: digitCheck.frames,
        mistakes: digitCheck.mistakes,
      },
    },
    {
      type: "explain",
      title: tx("Motion problems: meeting", "Bewegungsaufgaben: Begegnung"),
      blob: tx("Two cars, one road. Where do they meet?", "Zwei Autos, eine Straße. Wo begegnen sie sich?"),
      body: tx(
        "**Town A and town B are 280 km apart. At 9:00 a car sets off from A towards B at 80 km/h, and a lorry sets off from B towards A at 60 km/h. When and where do they meet?** For each vehicle: distance = speed · time. Where they meet, both are at the same place.",
        "**Die Orte A und B liegen 280 km auseinander. Um 9:00 Uhr fährt ein Auto mit 80 km/h von A in Richtung B los und ein Lkw mit 60 km/h von B in Richtung A. Wann und wo begegnen sie sich?** Für jedes Fahrzeug gilt: Weg = Geschwindigkeit · Zeit. Wo sie sich begegnen, sind beide an derselben Stelle.",
      ),
      frames: meetLesson,
    },
    {
      type: "widget",
      title: tx("Meet or catch up", "Begegnen oder einholen"),
      blob: tx("Press play and watch the lines in the diagram!", "Drück auf Start und schau auf die Geraden im Diagramm!"),
      body: tx(
        "Two vehicles on one road, and their distance-time diagram. Choose the speeds and press play. Towards each other, the gap shrinks by both speeds together. When catching up, it only shrinks by the difference. The meeting point is where the two lines cross.",
        "Zwei Fahrzeuge auf einer Straße und ihr Weg-Zeit-Diagramm. Wähl die Geschwindigkeiten und drück auf Start. Aufeinander zu schrumpft der Abstand um beide Geschwindigkeiten zusammen, beim Einholen nur um die Differenz. Der Treffpunkt ist der Schnittpunkt der beiden Geraden.",
      ),
      widget: MotionLab,
    },
    {
      type: "check",
      blob: tx("Last one! Careful: who's on the way for how long?", "Die letzte! Vorsicht: Wer ist wie lange unterwegs?"),
      exercise: catchTask(CATCH[0], 15, 30, 1, "dist"),
    },
  ],
};
