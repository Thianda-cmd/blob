import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Mistake } from "@/learn/types";

// Level 1 practice: "Write as a term". A phrase in words becomes a term in x, piece by piece,
// with the classic traps (order of a difference, brackets around a sum, half of what).

type TermCase = {
  phrase: Text;
  value: string;
  steps: Frame[];
  hint: Text;
  wrongs: { value: string; title: Text; say: Text }[];
};

const MULT: Record<number, [string, string]> = {
  2: ["twice", "das Doppelte"],
  3: ["three times", "das Dreifache"],
  4: ["four times", "das Vierfache"],
  5: ["five times", "das Fünffache"],
};

const LET: Frame = { math: "x#v", note: tx("Let $x$ be the number.", "Sei $x$ die Zahl.") };

const ORDER_FLIPPED = tx("Order flipped", "Reihenfolge vertauscht");
const BRACKET_MISSING = tx("Bracket missing", "Klammer vergessen");
const BRACKET_EXTRA = tx("Bracket too much", "Klammer zu viel");

function moreThan(rng: Rng): TermCase {
  const k = rng.int(3, 19);
  return {
    phrase: tx(`${k} more than a number`, `${k} mehr als eine Zahl`),
    value: `x + ${k}`,
    steps: [LET, { math: `x#v +#s ${k}#k`, note: tx(`${k} more: add ${k}. You read the ${k} first, but it comes after the $x$.`, `${k} mehr: ${k} addieren. Du liest die ${k} zuerst, sie kommt aber hinter das $x$.`) }],
    hint: tx(`"More than" means plus.`, `„Mehr als“ heißt plus.`),
    wrongs: [
      {
        value: `${k}x`,
        title: tx("Times instead of plus", "Mal statt Plus"),
        say: tx(`Hmm, $${k}x$ means ${k} **times** the number. "${k} more" just adds ${k}.`, `Hm, $${k}x$ heißt ${k} **mal** die Zahl. „${k} mehr“ addiert nur ${k}.`),
      },
    ],
  };
}

function lessThan(rng: Rng): TermCase {
  const k = rng.int(3, 19);
  return {
    phrase: tx(`${k} less than a number`, `${k} weniger als eine Zahl`),
    value: `x - ${k}`,
    steps: [LET, { math: `x#v -#s ${k}#k`, note: tx(`${k} less than the number: start with $x$ and take ${k} away.`, `${k} weniger als die Zahl: Fang mit $x$ an und nimm ${k} weg.`) }],
    hint: tx(`Start with the number. What happens to it?`, `Fang mit der Zahl an. Was passiert mit ihr?`),
    wrongs: [
      {
        value: `${k} - x`,
        title: ORDER_FLIPPED,
        say: tx(
          `Ooh, the classic trap! "${k} less than a number" starts with the **number** and takes ${k} away. Try it with $x = 20$.`,
          `Die klassische Falle! „${k} weniger als eine Zahl“ startet mit der **Zahl** und nimmt ${k} weg. Probier es mit $x = 20$ aus.`,
        ),
      },
    ],
  };
}

function differenceOf(rng: Rng): TermCase {
  const k = rng.int(3, 19);
  const numberFirst = rng.chance(0.5);
  return numberFirst
    ? {
        phrase: tx(`the difference of a number and ${k}`, `die Differenz aus einer Zahl und ${k}`),
        value: `x - ${k}`,
        steps: [LET, { math: `x#v -#s ${k}#k`, note: tx(`"The difference of A and B" is $A - B$, in this order.`, `„Die Differenz aus A und B“ ist $A - B$, in dieser Reihenfolge.`) }],
        hint: tx(`"The difference of A and B" means $A - B$.`, `„Die Differenz aus A und B“ heißt $A - B$.`),
        wrongs: [
          {
            value: `${k} - x`,
            title: ORDER_FLIPPED,
            say: tx(`Nearly! In "the difference of A and B" the **first** one comes first: $A - B$. Here A is the number.`, `Fast! Bei „der Differenz aus A und B“ kommt das **erste** zuerst: $A - B$. Hier ist A die Zahl.`),
          },
        ],
      }
    : {
        phrase: tx(`the difference of ${k} and a number`, `die Differenz aus ${k} und einer Zahl`),
        value: `${k} - x`,
        steps: [LET, { math: `${k}#k -#s x#v`, note: tx(`"The difference of A and B" is $A - B$. Here the ${k} comes first.`, `„Die Differenz aus A und B“ ist $A - B$. Hier steht die ${k} vorne.`) }],
        hint: tx(`"The difference of A and B" means $A - B$.`, `„Die Differenz aus A und B“ heißt $A - B$.`),
        wrongs: [
          {
            value: `x - ${k}`,
            title: ORDER_FLIPPED,
            say: tx(`Careful: in "the difference of ${k} and a number" the **${k}** comes first. You start at ${k} and take the number away.`, `Vorsicht: Bei „der Differenz aus ${k} und einer Zahl“ steht die **${k}** vorne. Du startest bei ${k} und ziehst die Zahl ab.`),
          },
        ],
      };
}

function timesMinus(rng: Rng): TermCase {
  const a = rng.int(2, 5);
  const k = rng.int(2, 12);
  const [en, de] = MULT[a];
  const less = rng.chance(0.5);
  return less
    ? {
        phrase: tx(`${k} less than ${en} a number`, `${k} weniger als ${de} einer Zahl`),
        value: `${a}x - ${k}`,
        steps: [
          LET,
          { math: `${a}#a x#v`, note: tx(`${en[0].toUpperCase()}${en.slice(1)} the number: $${a}x$.`, `${de[0].toUpperCase()}${de.slice(1)} der Zahl: $${a}x$.`) },
          { math: `${a}#a x#v -#s ${k}#k`, note: tx(`${k} less than that: take ${k} away **at the end**.`, `${k} weniger als das: Nimm ${k} **am Ende** weg.`) },
        ],
        hint: tx(`First ${en} the number, then ${k} less than that.`, `Zuerst ${de} der Zahl, dann ${k} weniger als das.`),
        wrongs: [
          {
            value: `${k} - ${a}x`,
            title: ORDER_FLIPPED,
            say: tx(`Ooh, the classic trap! "${k} less than ${en} a number" starts with $${a}x$ and takes ${k} away, not the other way round.`, `Die klassische Falle! „${k} weniger als ${de} einer Zahl“ startet bei $${a}x$ und nimmt ${k} weg, nicht andersherum.`),
          },
          {
            value: `${a}(x - ${k})`,
            title: BRACKET_EXTRA,
            say: tx(`Hmm, your bracket makes the ${k} get multiplied by ${a} too. Only the number is multiplied, the ${k} comes off afterwards.`, `Hm, durch deine Klammer wird die ${k} auch mit ${a} multipliziert. Nur die Zahl wird multipliziert, die ${k} kommt danach weg.`),
          },
        ],
      }
    : {
        phrase: tx(`${en} a number, decreased by ${k}`, `${de} einer Zahl, vermindert um ${k}`),
        value: `${a}x - ${k}`,
        steps: [
          LET,
          { math: `${a}#a x#v`, note: tx(`${en[0].toUpperCase()}${en.slice(1)} the number: $${a}x$.`, `${de[0].toUpperCase()}${de.slice(1)} der Zahl: $${a}x$.`) },
          { math: `${a}#a x#v -#s ${k}#k`, note: tx(`Decreased by ${k}: minus ${k}. No brackets needed.`, `Vermindert um ${k}: minus ${k}. Klammern brauchst du hier nicht.`) },
        ],
        hint: tx(`First ${en} the number, then subtract.`, `Zuerst ${de} der Zahl, dann subtrahieren.`),
        wrongs: [
          {
            value: `${a}(x - ${k})`,
            title: BRACKET_EXTRA,
            say: tx(`Hmm, your bracket makes the ${k} get multiplied by ${a} too. Only the number is multiplied, the ${k} comes off afterwards.`, `Hm, durch deine Klammer wird die ${k} auch mit ${a} multipliziert. Nur die Zahl wird multipliziert, die ${k} kommt danach weg.`),
          },
          {
            value: `x - ${k}`,
            title: tx(`${en[0].toUpperCase()}${en.slice(1)} forgotten`, `${de[0].toUpperCase()}${de.slice(1)} vergessen`),
            say: tx(`Nearly! The number has to be multiplied by ${a} first: "${en} a number" is $${a}x$.`, `Fast! Die Zahl muss zuerst mal ${a}: „${de} einer Zahl“ ist $${a}x$.`),
          },
        ],
      };
}

function timesSum(rng: Rng): TermCase {
  const a = rng.int(2, 5);
  const k = rng.int(2, 12);
  const [en, de] = MULT[a];
  const minus = rng.chance(0.4);
  const op = minus ? "-" : "+";
  const word = minus ? tx("difference", "Differenz") : tx("sum", "Summe");
  const w = (l: "en" | "de") => (typeof word === "string" ? word : word[l]);
  return {
    phrase: tx(`${en} the ${w("en")} of a number and ${k}`, `${de} der ${w("de")} aus einer Zahl und ${k}`),
    value: `${a}(x ${op} ${k})`,
    steps: [
      LET,
      { math: `x#v ${op}#s ${k}#k`, note: tx(`The ${w("en")} of the number and ${k}: $x ${op} ${k}$.`, `Die ${w("de")} aus der Zahl und ${k}: $x ${op} ${k}$.`) },
      { math: `${a}#a (x#v ${op}#s ${k}#k)#b`, note: tx(`The **whole** ${w("en")} is multiplied by ${a}, so it needs brackets.`, `Die **ganze** ${w("de")} wird mit ${a} multipliziert, deshalb braucht sie Klammern.`) },
    ],
    hint: tx(`What is multiplied by ${a}: only the number, or the whole ${w("en")}?`, `Was wird mit ${a} multipliziert: nur die Zahl oder die ganze ${w("de")}?`),
    wrongs: [
      {
        value: `${a}x ${op} ${k}`,
        title: BRACKET_MISSING,
        say: tx(`Ooh, the classic trap! In $${a}x ${op} ${k}$ only the number is multiplied. But the **whole** ${w("en")} is: brackets!`, `Die klassische Falle! Bei $${a}x ${op} ${k}$ wird nur die Zahl multipliziert. Es geht aber um die **ganze** ${w("de")}: Klammern!`),
      },
      {
        value: `x ${op} ${a * k}`,
        title: tx("Only one part multiplied", "Nur ein Teil multipliziert"),
        say: tx(`Nearly! Here only the ${k} got multiplied by ${a}. The number inside the ${w("en")} is multiplied too.`, `Fast! Hier wurde nur die ${k} mit ${a} multipliziert. Die Zahl in der ${w("de")} wird aber auch multipliziert.`),
      },
    ],
  };
}

function halfOf(rng: Rng): TermCase {
  const k = rng.int(2, 15);
  const d = rng.pick([2, 3, 4]);
  const part = { 2: ["half", "die Hälfte", "Die Hälfte"], 3: ["a third", "ein Drittel", "Ein Drittel"], 4: ["a quarter", "ein Viertel", "Ein Viertel"] }[d]!;
  const ofSum = rng.chance(0.5);
  return ofSum
    ? {
        phrase: tx(`${part[0]} of the sum of a number and ${k}`, `${part[1]} der Summe aus einer Zahl und ${k}`),
        value: `(x + ${k})/${d}`,
        steps: [
          LET,
          { math: `x#v +#s ${k}#k`, note: tx(`The sum of the number and ${k}: $x + ${k}$.`, `Die Summe aus der Zahl und ${k}: $x + ${k}$.`) },
          { math: `\\frac{x#v +#s ${k}#k}{${d}#d}`, note: tx(`${part[0][0].toUpperCase()}${part[0].slice(1)} of the **whole** sum: divide all of it by ${d}.`, `${part[2]} der **ganzen** Summe: Teile alles durch ${d}.`) },
        ],
        hint: tx(`First the sum, then divide the whole sum by ${d}.`, `Erst die Summe, dann die ganze Summe durch ${d} teilen.`),
        wrongs: [
          {
            value: `x/${d} + ${k}`,
            title: BRACKET_MISSING,
            say: tx(`Hmm, here only the number gets divided by ${d}. But it's ${part[0]} of the **whole** sum, the ${k} too.`, `Hm, hier wird nur die Zahl durch ${d} geteilt. Es geht aber um ${part[1]} der **ganzen** Summe, also auch die ${k}.`),
          },
        ],
      }
    : {
        phrase: tx(`${part[0]} of a number, increased by ${k}`, `${part[1]} einer Zahl, vermehrt um ${k}`),
        value: `x/${d} + ${k}`,
        steps: [
          LET,
          { math: `\\frac{x#v}{${d}#d}`, note: tx(`${part[0][0].toUpperCase()}${part[0].slice(1)} of the number: $\\frac{x}{${d}}$.`, `${part[2]} der Zahl: $\\frac{x}{${d}}$.`) },
          { math: `\\frac{x#v}{${d}#d} +#s ${k}#k`, note: tx(`Then plus ${k}. Only the number is divided.`, `Dann plus ${k}. Nur die Zahl wird geteilt.`) },
        ],
        hint: tx(`First ${part[0]} of the number, then add.`, `Erst ${part[1]} der Zahl, dann addieren.`),
        wrongs: [
          {
            value: `(x + ${k})/${d}`,
            title: BRACKET_EXTRA,
            say: tx(`Nearly! Your fraction divides the ${k} by ${d} too. Only the number is divided, the ${k} is added afterwards.`, `Fast! Dein Bruch teilt die ${k} auch durch ${d}. Nur die Zahl wird geteilt, die ${k} kommt danach dazu.`),
          },
          {
            value: `${d}x + ${k}`,
            title: tx("Times instead of divided", "Mal statt geteilt"),
            say: tx(`Careful: ${part[0]} of a number is **smaller** than the number. That's dividing by ${d}, not multiplying.`, `Vorsicht: ${part[1]} einer Zahl ist **kleiner** als die Zahl. Das heißt durch ${d} teilen, nicht mal ${d}.`),
          },
        ],
      };
}

function successor(rng: Rng): TermCase {
  const three = rng.chance(0.5);
  return three
    ? {
        phrase: tx("the sum of three consecutive numbers, if $x$ is the smallest", "die Summe von drei aufeinanderfolgenden Zahlen, wenn $x$ die kleinste ist"),
        value: "3x + 3",
        steps: [
          { math: "x#a ,#c1 \\quad x#b +#s1 1#k1 ,#c2 \\quad x#c +#s2 2#k2", note: tx("The numbers are $x$, $x + 1$ and $x + 2$.", "Die Zahlen sind $x$, $x + 1$ und $x + 2$.") },
          { math: "x#a +#p1 (x#b +#s1 1#k1)#B +#p2 (x#c +#s2 2#k2)#C", note: tx("Add them up.", "Addiere sie.") },
          { math: "3#n x#a +#p 3#k", note: tx("Three $x$ and $1 + 2 = 3$: $3x + 3$.", "Drei $x$ und $1 + 2 = 3$: $3x + 3$.") },
        ],
        hint: tx("Consecutive numbers: $x$, $x + 1$, $x + 2$.", "Aufeinanderfolgende Zahlen: $x$, $x + 1$, $x + 2$."),
        wrongs: [
          {
            value: "6x",
            title: tx("Not x, 2x, 3x", "Nicht x, 2x, 3x"),
            say: tx("I think you used $x$, $2x$, $3x$. But consecutive numbers go up by **1**, they don't double and triple.", "Ich glaub, du hast $x$, $2x$, $3x$ genommen. Aber aufeinanderfolgende Zahlen steigen um **1**, sie verdoppeln und verdreifachen sich nicht."),
          },
          {
            value: "3x",
            title: tx("The +1 and +2 got lost", "Das +1 und +2 fehlt"),
            say: tx("Nearly! $x + x + x$ would be the same number three times. Add the $+ 1$ and $+ 2$ of the next numbers.", "Fast! $x + x + x$ wäre dreimal dieselbe Zahl. Rechne das $+ 1$ und $+ 2$ der nächsten Zahlen mit."),
          },
        ],
      }
    : {
        phrase: tx("the sum of a number and the next number", "die Summe aus einer Zahl und ihrem Nachfolger"),
        value: "2x + 1",
        steps: [
          { math: "x#a ,#c1 \\quad x#b +#s1 1#k1", note: tx("The number is $x$, the next one is $x + 1$.", "Die Zahl ist $x$, ihr Nachfolger ist $x + 1$.") },
          { math: "x#a +#p (x#b +#s1 1#k1)#B", note: tx("Add both.", "Addiere beide.") },
          { math: "2#n x#a +#s1 1#k1", note: tx("Two $x$ and 1: $2x + 1$.", "Zwei $x$ und 1: $2x + 1$.") },
        ],
        hint: tx("The next number after $x$ is $x + 1$.", "Der Nachfolger von $x$ ist $x + 1$."),
        wrongs: [
          {
            value: "x + 1",
            title: tx("Only the next number", "Nur der Nachfolger"),
            say: tx("Nearly! $x + 1$ is just the next number. The sum adds the number **and** the next one.", "Fast! $x + 1$ ist nur der Nachfolger. Die Summe addiert die Zahl **und** den Nachfolger."),
          },
          {
            value: "3x",
            title: tx("Not x and 2x", "Nicht x und 2x"),
            say: tx("I think you wrote the next number as $2x$. But the next number is just **1 more**: $x + 1$.", "Ich glaub, du hast den Nachfolger als $2x$ geschrieben. Der Nachfolger ist aber nur **1 mehr**: $x + 1$."),
          },
        ],
      };
}

function priceTerm(rng: Rng): TermCase {
  const p = rng.int(3, 12);
  const f = rng.int(2, 6);
  return {
    phrase: tx(`the price of $x$ tickets at ${p} € each, plus a booking fee of ${f} € for the whole order`, `der Preis für $x$ Karten zu je ${p} €, plus ${f} € Servicegebühr für die ganze Bestellung`),
    value: `${p}x + ${f}`,
    steps: [
      { math: `${p}#p x#v`, note: tx(`$x$ tickets at ${p} € each: $${p}x$.`, `$x$ Karten zu je ${p} €: $${p}x$.`) },
      { math: `${p}#p x#v +#s ${f}#f`, note: tx(`The fee is paid **once**: plus ${f}.`, `Die Gebühr zahlt man **einmal**: plus ${f}.`) },
    ],
    hint: tx("Which part is paid per ticket, which only once?", "Welcher Teil wird pro Karte bezahlt, welcher nur einmal?"),
    wrongs: [
      {
        value: `${p}(x + ${f})`,
        title: tx("Fee for every ticket", "Gebühr für jede Karte"),
        say: tx(`Hmm, with the bracket the ${f} € fee is paid for **every** ticket. But it's paid once per order.`, `Hm, mit der Klammer zahlt man die ${f} € Gebühr für **jede** Karte. Sie fällt aber nur einmal pro Bestellung an.`),
      },
      {
        value: `${p + f}x`,
        title: tx("Fee for every ticket", "Gebühr für jede Karte"),
        say: tx(`Hmm, $${p + f}x$ adds the ${f} € fee to **every** ticket. But it's paid once per order.`, `Hm, $${p + f}x$ schlägt die ${f} € Gebühr auf **jede** Karte drauf. Sie fällt aber nur einmal pro Bestellung an.`),
      },
    ],
  };
}

/** The phrase in bold. "Use $x$ for the unknown number" only when the phrase doesn't say what $x$ is itself. */
function phraseText(phrase: Text): Text {
  const en = typeof phrase === "string" ? phrase : phrase.en;
  const de = typeof phrase === "string" ? phrase : phrase.de;
  if (en.includes("$x$")) return tx(`**${en}**`, `**${de}**`);
  return tx(`**${en}**\n\nUse $x$ for the unknown number.`, `**${de}**\n\nNimm $x$ für die unbekannte Zahl.`);
}

const CASES = [moreThan, lessThan, differenceOf, timesMinus, timesSum, halfOf, successor, priceTerm, lessThan, timesMinus];

/** "Write as a term": a phrase in words, the term in x, worked out piece by piece. */
export function termTask(rng: Rng): Exercise {
  const c = rng.pick(CASES)(rng);
  const mistakes: Mistake[] = c.wrongs.map((w) => ({ when: { kind: "expr", value: w.value }, title: w.title, say: w.say }));
  return {
    instruction: tx("Write as a term", "Schreib als Term"),
    text: phraseText(c.phrase),
    answer: { kind: "expr", value: c.value, form: "any" },
    hint: c.hint,
    solution: c.steps,
    mistakes,
  };
}
