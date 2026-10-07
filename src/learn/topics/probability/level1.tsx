"use client";

// Probability, level 1 (Klasse 5–7): chance experiments and outcomes, absolute and relative
// frequency, the law of large numbers (dice lab), Laplace probability with dice, urns, cards and
// spinners as fraction, decimal and percentage, impossible and certain events.

import { tx, type Text } from "@/i18n/text";
import { frac, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { choiceMistakes, fr, frChain, fracAnswer, fracMistakes, frS, numAnswer, numMistakes, say, visual } from "./kit";
import { BALL, ProbabilityScale, ProbabilitySpinner, ProbabilityUrn, type Ball, type Sector } from "./pictures";
import { ProbabilityDiceLab, ProbabilitySpinnerLab } from "./widgets1";

const I = {
  die: tx("Find the probability", "Berechne die Wahrscheinlichkeit"),
  urn: tx("Draw a ball: find the probability", "Kugel ziehen: Berechne die Wahrscheinlichkeit"),
  cards: tx("Draw a card: find the probability", "Karte ziehen: Berechne die Wahrscheinlichkeit"),
  spinner: tx("Give the probability as a percentage", "Gib die Wahrscheinlichkeit in Prozent an"),
  rel: tx("Find the relative frequency", "Bestimme die relative Häufigkeit"),
  estimate: tx("Estimate how often", "Schätze, wie oft"),
  classify: tx("Impossible, possible or certain?", "Unmöglich, möglich oder sicher?"),
  order: tx("Sort by probability", "Sortiere nach der Wahrscheinlichkeit"),
};

const PCT = "%";

// ---------------------------------------------------------------------------
// Shared mistake messages

const FAV_UNFAV = (fav: number, rest: number): { title: Text; say: Text } => ({
  title: tx("Favourable : unfavourable", "Günstig : ungünstig"),
  say: tx(
    `Nearly! You divided the ${fav} favourable outcomes by the ${rest} **other** ones. The bottom of the fraction is **all** possible outcomes.`,
    `Fast! Du hast die ${fav} günstigen Ergebnisse durch die ${rest} **anderen** geteilt. In den Nenner gehören **alle** möglichen Ergebnisse.`,
  ),
});

const COLOURS_COUNTED = (k: number, m = 1): { title: Text; say: Text } => ({
  title: tx("Colours counted", "Farben gezählt"),
  say: tx(
    `I think you counted the **colours**: ${m} of ${k} colours? But the colours aren't equally likely, there are different numbers of balls. Count the **balls**.`,
    `Ich glaub, du hast die **Farben** gezählt: ${m} von ${k} Farben? Die Farben sind aber nicht gleich wahrscheinlich, es gibt ja unterschiedlich viele Kugeln. Zähl die **Kugeln**.`,
  ),
});

const SPIN_COLOURS = (k: number): { title: Text; say: Text } => ({
  title: tx("Colours counted", "Farben gezählt"),
  say: tx(
    `I think you counted the **colours**: 1 of ${k}? But the colours don't cover the same area of the wheel. Count fields (or angles), not colours.`,
    `Ich glaub, du hast die **Farben** gezählt: 1 von ${k}? Die Farben nehmen aber nicht gleich viel vom Rad ein. Zähl Felder (oder Winkel), nicht Farben.`,
  ),
});

/** "1, 2, 3, 4, 5, 6" or "2, 4, 6, …, 20" for long regular lists. */
function listSrc(xs: number[]): string {
  if (xs.length > 6) {
    const d = xs[1] - xs[0];
    if (xs.every((x, i) => i === 0 || x - xs[i - 1] === d)) return `${xs[0]}, ${xs[1]}, ${xs[2]}, …, ${xs[xs.length - 1]}`;
  }
  return xs.join(", ");
}

// ---------------------------------------------------------------------------
// Dice

type DieEvent = {
  /** "the probability of …" */
  en: string;
  /** "die Wahrscheinlichkeit für …" */
  de: string;
  /** Short name for solution notes, e.g. "greater than 4". */
  fav: number[];
  trap?: { fav: number[]; title: Text; say: Text };
};

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19];

function dieEvent(rng: Rng, n: number): DieEvent {
  const all = Array.from({ length: n }, (_, i) => i + 1);
  const kind = rng.pick(["one", "even", "odd", "gt", "lt", "min", "max", "prime", "div3", "not", "gt", "min"] as const);
  if (kind === "one") {
    const k = rng.int(1, n);
    return { en: `the number $${k}$`, de: `die Zahl $${k}$`, fav: [k] };
  }
  if (kind === "even") return { en: "an even number", de: "eine gerade Zahl", fav: all.filter((x) => x % 2 === 0) };
  if (kind === "odd") return { en: "an odd number", de: "eine ungerade Zahl", fav: all.filter((x) => x % 2 === 1) };
  if (kind === "gt") {
    const k = rng.int(2, Math.min(n - 2, 9));
    return {
      en: `a number greater than $${k}$`,
      de: `eine Zahl größer als $${k}$`,
      fav: all.filter((x) => x > k),
      trap: {
        fav: all.filter((x) => x >= k),
        title: tx("Boundary counted", "Grenze mitgezählt"),
        say: tx(`Careful at the edge: “greater than $${k}$” starts at $${k + 1}$. The $${k}$ itself doesn't count.`, `Vorsicht an der Grenze: „größer als $${k}$“ fängt erst bei $${k + 1}$ an. Die $${k}$ selbst zählt nicht mit.`),
      },
    };
  }
  if (kind === "lt") {
    const k = rng.int(3, Math.min(n - 1, 9));
    return {
      en: `a number less than $${k}$`,
      de: `eine Zahl kleiner als $${k}$`,
      fav: all.filter((x) => x < k),
      trap: {
        fav: all.filter((x) => x <= k),
        title: tx("Boundary counted", "Grenze mitgezählt"),
        say: tx(`Careful at the edge: “less than $${k}$” stops at $${k - 1}$. The $${k}$ itself doesn't count.`, `Vorsicht an der Grenze: „kleiner als $${k}$“ hört bei $${k - 1}$ auf. Die $${k}$ selbst zählt nicht mit.`),
      },
    };
  }
  if (kind === "min") {
    const k = rng.int(2, Math.min(n - 1, 9));
    return {
      en: `a number of at least $${k}$`,
      de: `eine Augenzahl von mindestens $${k}$`,
      fav: all.filter((x) => x >= k),
      trap: {
        fav: all.filter((x) => x > k),
        title: tx("Boundary forgotten", "Grenze vergessen"),
        say: tx(`“At least $${k}$” includes the $${k}$ itself. Count it too.`, `„Mindestens $${k}$“ schließt die $${k}$ mit ein. Zähl sie mit.`),
      },
    };
  }
  if (kind === "max") {
    const k = rng.int(2, Math.min(n - 1, 9));
    return {
      en: `a number of at most $${k}$`,
      de: `eine Augenzahl von höchstens $${k}$`,
      fav: all.filter((x) => x <= k),
      trap: {
        fav: all.filter((x) => x < k),
        title: tx("Boundary forgotten", "Grenze vergessen"),
        say: tx(`“At most $${k}$” includes the $${k}$ itself. Count it too.`, `„Höchstens $${k}$“ schließt die $${k}$ mit ein. Zähl sie mit.`),
      },
    };
  }
  if (kind === "prime") {
    return {
      en: "a prime number",
      de: "eine Primzahl",
      fav: PRIMES.filter((x) => x <= n),
      trap: {
        fav: [1, ...PRIMES.filter((x) => x <= n)],
        title: tx("1 is not a prime", "1 ist keine Primzahl"),
        say: tx("Ah, the $1$ sneaked in! A prime number has exactly two divisors, and $1$ has only one. So $1$ is not prime.", "Ah, die $1$ hat sich reingeschmuggelt! Eine Primzahl hat genau zwei Teiler, die $1$ hat nur einen. Sie ist keine Primzahl."),
      },
    };
  }
  if (kind === "div3") return { en: "a number divisible by $3$", de: "eine durch $3$ teilbare Zahl", fav: all.filter((x) => x % 3 === 0) };
  const k = rng.int(1, n);
  return {
    en: `any number except $${k}$`,
    de: `eine Zahl außer der $${k}$`,
    fav: all.filter((x) => x !== k),
    trap: {
      fav: [k],
      title: tx("The opposite", "Das Gegenteil"),
      say: tx(`That's the probability of rolling the $${k}$. The question asks for everything **except** the $${k}$.`, `Das ist die Wahrscheinlichkeit für die $${k}$. Gefragt ist alles **außer** der $${k}$.`),
    },
  };
}

function dieText(n: number): { en: string; de: string } {
  return n === 6 ? { en: "a normal die", de: "einem normalen Würfel" } : { en: `a fair die with the numbers $1$ to $${n}$`, de: `einem fairen Würfel mit den Zahlen $1$ bis $${n}$` };
}

function dieTask(rng: Rng): Exercise {
  const n = rng.pick([6, 6, 6, 6, 8, 10, 12, 20]);
  let ev = dieEvent(rng, n);
  for (let i = 0; i < 20 && (ev.fav.length === 0 || ev.fav.length === n || (n > 8 && ev.fav.length > 10)); i++) ev = dieEvent(rng, n);
  const k = ev.fav.length;
  const right = frac(k, n);
  const d = dieText(n);
  const all = n === 6 ? "1, 2, 3, 4, 5, 6" : `1, 2, …, ${n}`;
  const mistakes: Mistake[] = fracMistakes(right, [
    ...(ev.trap ? [{ v: frac(ev.trap.fav.length, n), title: ev.trap.title, say: ev.trap.say }] : []),
    { v: k < n - k ? { n: k, d: n - k } : null, ...FAV_UNFAV(k, n - k) },
    {
      v: k > 1 ? { n: 1, d: n } : null,
      title: tx("Only one outcome counted", "Nur ein Ergebnis gezählt"),
      say: tx("You counted just one favourable number. Several numbers belong to this event: list them all.", "Du hast nur eine günstige Zahl gezählt. Zu diesem Ereignis gehören mehrere Zahlen: Schreib sie alle auf."),
    },
  ]);
  return {
    instruction: I.die,
    text: tx(`You roll ${d.en} once. What is the probability of ${ev.en}?`, `Du würfelst einmal mit ${d.de}. Wie groß ist die Wahrscheinlichkeit für ${ev.de}?`),
    answer: fracAnswer(right),
    hint: tx("Write down all favourable numbers and count them. Then: favourable : possible.", "Schreib alle günstigen Zahlen auf und zähle sie. Dann: günstige durch mögliche."),
    solution: [
      { math: `S#S =#eq \\{#o ${all} \\}#c`, note: tx(`The die is fair: all $${n}$ outcomes are equally likely.`, `Der Würfel ist fair: Alle $${n}$ Ergebnisse sind gleich wahrscheinlich.`) },
      { math: `E#S =#eq \\{#o ${listSrc(ev.fav)} \\}#c`, note: tx(`Favourable for ${ev.en}: $${k}$ ${k === 1 ? "number" : "numbers"}.`, `Günstig für ${ev.de}: $${k}$ ${k === 1 ? "Zahl" : "Zahlen"}.`) },
      { math: `P(E) = ${frChain(k, n)}`, note: tx("Laplace rule: favourable outcomes divided by possible outcomes.", "Laplace-Regel: günstige Ergebnisse durch mögliche Ergebnisse.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Urn

const COLOURS: Ball[] = ["red", "green", "purple"];
const en = (t: Text) => (typeof t === "string" ? t : t.en);
const de = (t: Text) => (typeof t === "string" ? t : t.de);

function urnTask(rng: Rng): Exercise {
  const cs = rng.shuffle(COLOURS).slice(0, rng.chance(0.55) ? 3 : 2);
  let counts = cs.map(() => rng.int(2, 8));
  for (let i = 0; i < 30 && (counts.reduce((a, b) => a + b, 0) > 16 || new Set(counts).size === 1); i++) counts = cs.map(() => rng.int(2, 8));
  const total = counts.reduce((a, b) => a + b, 0);
  const balls = cs.map((c, i) => ({ color: c, n: counts[i] }));
  const ask = cs.length === 3 ? rng.pick(["one", "one", "not", "or"] as const) : rng.pick(["one", "one", "not"] as const);
  const i = rng.int(0, cs.length - 1);
  const j = (i + 1) % cs.length;
  const c = cs[i];
  let fav: number;
  let qEn: string;
  let qDe: string;
  let label: Text;
  const extra: { v: Frac | null; title: Text; say: Text }[] = [];
  if (ask === "one") {
    fav = counts[i];
    qEn = `a ${en(BALL[c].adj)} ball`;
    qDe = `eine ${de(BALL[c].adj)} Kugel`;
    label = BALL[c].name;
    extra.push({ v: { n: 1, d: cs.length }, ...COLOURS_COUNTED(cs.length) });
  } else if (ask === "not") {
    fav = total - counts[i];
    qEn = `a ball that is **not** ${en(BALL[c].name)}`;
    qDe = `eine Kugel, die **nicht** ${de(BALL[c].name)} ist`;
    label = tx(`not ${en(BALL[c].name)}`, `nicht ${de(BALL[c].name)}`);
    extra.push({
      v: { n: counts[i], d: total },
      title: tx("The opposite", "Das Gegenteil"),
      say: tx(`That's the probability of a ${en(BALL[c].adj)} ball. The question asks for **not** ${en(BALL[c].name)}: count all the other balls.`, `Das ist die Wahrscheinlichkeit für eine ${de(BALL[c].adj)} Kugel. Gefragt ist **nicht** ${de(BALL[c].name)}: Zähl alle anderen Kugeln.`),
    });
  } else {
    fav = counts[i] + counts[j];
    const c2 = cs[j];
    qEn = `a ${en(BALL[c].adj)} or a ${en(BALL[c2].adj)} ball`;
    qDe = `eine ${de(BALL[c].adj)} oder eine ${de(BALL[c2].adj)} Kugel`;
    label = tx(`${en(BALL[c].name)} or ${en(BALL[c2].name)}`, `${de(BALL[c].name)} oder ${de(BALL[c2].name)}`);
    extra.push({ v: { n: 2, d: 3 }, ...COLOURS_COUNTED(3, 2) });
    extra.push({
      v: { n: counts[i], d: total },
      title: tx("Only one colour", "Nur eine Farbe"),
      say: tx(`You only counted the ${en(BALL[c].adj)} balls. “Or” means both colours are favourable.`, `Du hast nur die ${de(BALL[c].adjPl)} Kugeln gezählt. „Oder“ heißt: Beide Farben sind günstig.`),
    });
  }
  const right = frac(fav, total);
  const sum = counts.join(" + ");
  return {
    instruction: I.urn,
    text: tx(
      `An urn holds ${balls.map((b) => `$${b.n}$ ${en(BALL[b.color].adj)}`).join(", ").replace(/, ([^,]*)$/, " and $1")} balls. You draw one ball without looking. What is the probability of ${qEn}?`,
      `In einer Urne liegen ${balls.map((b) => `$${b.n}$ ${de(BALL[b.color].adj)}`).join(", ").replace(/, ([^,]*)$/, " und $1")} Kugeln. Du ziehst ohne hinzusehen eine Kugel. Wie groß ist die Wahrscheinlichkeit für ${qDe}?`,
    ),
    visual: visual(ProbabilityUrn, { balls }),
    answer: fracAnswer(right),
    hint: tx("Every **ball** is equally likely. Count all balls (possible) and the matching ones (favourable).", "Jede **Kugel** ist gleich wahrscheinlich. Zähle alle Kugeln (möglich) und die passenden (günstig)."),
    solution: [
      { math: tx(`"all balls:" \\; ${sum} = ${total}`, `"alle Kugeln:" \\; ${sum} = ${total}`), note: tx(`There are $${total}$ balls, each equally likely.`, `Es sind $${total}$ Kugeln, jede gleich wahrscheinlich.`) },
      { math: tx(`"favourable:" \\; ${fav}`, `"günstig:" \\; ${fav}`), note: tx(`$${fav}$ of them fit: ${qEn}.`, `$${fav}$ davon passen: ${qDe}.`) },
      { math: tx(`P("${en(label)}") = ${frChain(fav, total)}`, `P("${de(label)}") = ${frChain(fav, total)}`), note: tx("Favourable divided by possible.", "Günstige durch mögliche.") },
    ],
    mistakes: fracMistakes(right, [...extra, { v: fav < total - fav ? { n: fav, d: total - fav } : null, ...FAV_UNFAV(fav, total - fav) }]),
  };
}

// ---------------------------------------------------------------------------
// Skat deck (32 cards)

type CardEvent = { en: string; de: string; fav: number; trap?: { v: Frac; title: Text; say: Text } };
const CARD_EVENTS: CardEvent[] = [
  { en: "a heart", de: "eine Herzkarte", fav: 8 },
  {
    en: "a red card",
    de: "eine rote Karte",
    fav: 16,
    trap: { v: { n: 8, d: 32 }, title: tx("Diamonds are red too", "Karo ist auch rot"), say: tx("Hearts ♥ are red, right, but diamonds ♦ are red too. That makes two red suits.", "Herz ♥ ist rot, stimmt, aber Karo ♦ ist auch rot. Das sind zwei rote Farben.") },
  },
  { en: "an ace", de: "ein Ass", fav: 4 },
  {
    en: "a face card (jack, queen or king)",
    de: "ein Bild (Bube, Dame oder König)",
    fav: 12,
    trap: { v: { n: 3, d: 32 }, title: tx("Only one suit", "Nur eine Farbe"), say: tx("Jack, queen and king exist in **each** of the four suits. That's more than three cards.", "Bube, Dame und König gibt es in **jeder** der vier Farben. Das sind mehr als drei Karten.") },
  },
  { en: "the ace of hearts", de: "das Herz-Ass", fav: 1 },
  { en: "a number card (7, 8, 9 or 10)", de: "eine Zahlenkarte (7, 8, 9 oder 10)", fav: 16 },
  { en: "a queen or a king", de: "eine Dame oder einen König", fav: 8 },
  {
    en: "a red queen",
    de: "eine rote Dame",
    fav: 2,
    trap: { v: { n: 1, d: 32 }, title: tx("Two red queens", "Zwei rote Damen"), say: tx("There's a queen of hearts **and** a queen of diamonds: both are red.", "Es gibt die Herz-Dame **und** die Karo-Dame: Beide sind rot.") },
  },
  { en: "a card that is not a heart", de: "eine Karte, die kein Herz ist", fav: 24, trap: { v: { n: 8, d: 32 }, title: tx("The opposite", "Das Gegenteil"), say: tx("That's the probability of a heart. The question asks for all the **other** cards.", "Das ist die Wahrscheinlichkeit für Herz. Gefragt sind alle **anderen** Karten.") } },
  { en: "a black ace", de: "ein schwarzes Ass", fav: 2 },
];

function cardTask(rng: Rng): Exercise {
  const ev = rng.pick(CARD_EVENTS);
  const right = frac(ev.fav, 32);
  return {
    instruction: I.cards,
    text: tx(
      `A Skat deck has $32$ cards: the four suits clubs ♣, spades ♠, hearts ♥ and diamonds ♦, each with 7, 8, 9, 10, jack, queen, king and ace. Clubs and spades are black, hearts and diamonds are red. You draw one card at random. What is the probability of ${ev.en}?`,
      `Ein Skatblatt hat $32$ Karten: die vier Farben Kreuz ♣, Pik ♠, Herz ♥ und Karo ♦, jeweils mit 7, 8, 9, 10, Bube, Dame, König und Ass. Kreuz und Pik sind schwarz, Herz und Karo sind rot. Du ziehst zufällig eine Karte. Wie groß ist die Wahrscheinlichkeit für ${ev.de}?`,
    ),
    answer: fracAnswer(right),
    hint: tx("$4$ suits with $8$ cards each. How many cards fit the event?", "$4$ Farben mit je $8$ Karten. Wie viele Karten passen zum Ereignis?"),
    solution: [
      { math: tx(`4 \\cdot 8 = 32 \\; "cards"`, `4 \\cdot 8 = 32 \\; "Karten"`), note: tx("All $32$ cards are equally likely.", "Alle $32$ Karten sind gleich wahrscheinlich.") },
      { math: tx(`"favourable:" \\; ${ev.fav}`, `"günstig:" \\; ${ev.fav}`), note: tx(`Count the cards for ${ev.en}: $${ev.fav}$.`, `Zähle die Karten für ${ev.de}: $${ev.fav}$.`) },
      { math: `P(E) = ${frChain(ev.fav, 32)}`, note: tx("Favourable divided by possible.", "Günstige durch mögliche.") },
    ],
    mistakes: fracMistakes(right, [
      ...(ev.trap ? [{ v: ev.trap.v, title: ev.trap.title, say: ev.trap.say }] : []),
      {
        v: { n: ev.fav, d: 52 },
        title: tx("52 cards?", "52 Karten?"),
        say: tx("You used $52$ cards, like a poker deck. A Skat deck only has $32$: there are no 2s to 6s.", "Du hast mit $52$ Karten gerechnet wie bei einem Pokerblatt. Ein Skatblatt hat nur $32$: Es gibt keine 2 bis 6."),
      },
      { v: ev.fav < 32 - ev.fav ? { n: ev.fav, d: 32 - ev.fav } : null, ...FAV_UNFAV(ev.fav, 32 - ev.fav) },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Spinner in percent

const ANGLE_SETS: number[][] = [
  [180, 90, 90],
  [180, 90, 45, 45],
  [144, 72, 72, 72],
  [216, 72, 72],
  [108, 108, 72, 72],
  [144, 108, 72, 36],
  [90, 90, 180],
  [72, 144, 36, 108],
  [90, 45, 135, 90],
];

function spinnerTask(rng: Rng): Exercise {
  const equal = rng.chance(0.55);
  let sectors: Sector[];
  if (equal) {
    const n = rng.pick([4, 5, 8, 10]);
    const target = rng.pick(COLOURS);
    let k = rng.int(1, n - 1);
    if (n === 4 && k === 2) k = rng.pick([1, 3]);
    const others = COLOURS.filter((c) => c !== target);
    const cols: Ball[] = Array.from({ length: n }, (_, i) => (i < k ? target : others[i % 2]));
    sectors = rng.shuffle(cols).map((c) => ({ w: 1, color: c }));
  } else {
    const angles = rng.pick(ANGLE_SETS);
    const cols = rng.shuffle(COLOURS);
    sectors = angles.map((a, i) => ({ w: a, color: i < 3 ? cols[i] : cols[rng.int(0, 2)] }));
  }
  const present = COLOURS.filter((c) => sectors.some((s) => s.color === c));
  const target = rng.pick(present);
  const total = sectors.reduce((s, x) => s + x.w, 0);
  const share = sectors.filter((s) => s.color === target).reduce((s, x) => s + x.w, 0);
  const p = share / total;
  const fields = sectors.filter((s) => s.color === target).length;
  const right = Math.round(p * 1000) / 10;
  const name = BALL[target].name;
  const mistakes = numMistakes(
    right,
    0.06,
    [
      equal
        ? { v: fields, title: tx("Just counted", "Nur gezählt"), say: tx(`$${fields}$ is the number of fields. Percent means “out of $100$”: first write it as a fraction of all fields.`, `$${fields}$ ist die Anzahl der Felder. Prozent heißt „von $100$“: Schreib erst den Bruch „Felder durch alle Felder“.`) }
        : { v: (fields / sectors.length) * 100, title: tx("Fields counted", "Felder gezählt"), say: tx("The fields are **not** the same size! Count the angle, not the fields: angle : $360°$.", "Die Felder sind **nicht** gleich groß! Hier zählt der Winkel, nicht die Anzahl der Felder: Winkel durch $360°$.") },
      equal ? { v: share < total - share ? (share / (total - share)) * 100 : null, ...FAV_UNFAV(share, total - share) } : { v: share, title: tx("Angle, not percent", "Winkel statt Prozent"), say: tx(`$${share}°$ is the angle. A full turn is $360°$, so divide by $360$ first.`, `$${share}°$ ist der Winkel. Eine volle Umdrehung hat $360°$: Teile erst durch $360$.`) },
      { v: 100 / present.length, ...SPIN_COLOURS(present.length) },
      { v: 100 - right, title: tx("The other colours", "Die anderen Farben"), say: tx(`That's the probability of **not** ${en(name)}. Look again at which colour is asked.`, `Das ist die Wahrscheinlichkeit für **nicht** ${de(name)}. Schau noch mal, welche Farbe gefragt ist.`) },
    ],
    PCT,
  );
  const fracSrc = equal ? fr(fields, total) : fr(share, 360);
  return {
    instruction: I.spinner,
    text: equal
      ? tx(`The spinner has $${total}$ fields of the same size. What is the probability that it stops on **${en(name)}**?`, `Das Glücksrad hat $${total}$ gleich große Felder. Wie groß ist die Wahrscheinlichkeit, dass es auf **${de(BALL[target].noun)}** stehen bleibt?`)
      : tx(`The fields of this spinner have different sizes (the angles are written in them). What is the probability that it stops on **${en(name)}**?`, `Die Felder dieses Glücksrads sind unterschiedlich groß (die Winkel stehen darin). Wie groß ist die Wahrscheinlichkeit, dass es auf **${de(BALL[target].noun)}** stehen bleibt?`),
    visual: visual(ProbabilitySpinner, { sectors, angles: !equal }),
    answer: numAnswer(right, 0.01, PCT),
    hint: equal
      ? tx("Count the fields of that colour and divide by all fields. Then turn it into hundredths.", "Zähle die Felder dieser Farbe und teile durch alle Felder. Dann wandle in Hundertstel um.")
      : tx("Add the angles of that colour and divide by $360°$.", "Addiere die Winkel dieser Farbe und teile durch $360°$."),
    solution: [
      {
        math: equal ? tx(`P("${en(name)}") = ${fracSrc}`, `P("${de(name)}") = ${fracSrc}`) : tx(`P("${en(name)}") = \\frac{${share}°}{360°}`, `P("${de(name)}") = \\frac{${share}°}{360°}`),
        note: equal
          ? tx(`$${fields}$ of $${total}$ equal fields are ${en(name)}.`, `$${fields}$ von $${total}$ gleich großen Feldern sind ${de(name)}.`)
          : tx(`The ${en(name)} part covers $${share}°$ of the full $360°$.`, `Der ${de(BALL[target].adj)} Anteil hat zusammen $${share}°$ von $360°$.`),
      },
      { math: say((f) => `P = ${frS(frac(share, total))} = ${f.n(p, 4)}`), note: tx("Simplify and write it as a decimal.", "Kürzen und als Dezimalzahl schreiben.") },
      { math: say((f) => `${f.n(p, 4)} = \\group{${f.n(right, 1)} \\, %}`), note: tx("Times $100$ gives the percentage.", "Mal $100$ ergibt den Prozentsatz.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Relative frequency

type Story = { en: (n: number, k: number) => string; de: (n: number, k: number) => string; other: Text; thing: Text; range: [number, number] };
const STORIES: Story[] = [
  {
    en: (n, k) => `Ben throws a drawing pin $${n}$ times. It lands point up $${k}$ times.`,
    de: (n, k) => `Ben wirft eine Reißzwecke $${n}$-mal. Sie landet $${k}$-mal in Kopflage.`,
    thing: tx("point up", "Kopflage"),
    other: tx("on its side", "Seitenlage"),
    range: [0.45, 0.75],
  },
  {
    en: (n, k) => `Lea takes $${n}$ free throws in basketball and scores $${k}$ times.`,
    de: (n, k) => `Lea wirft beim Basketball $${n}$ Freiwürfe und trifft $${k}$-mal.`,
    thing: tx("a basket", "Treffer"),
    other: tx("a miss", "Fehlwurf"),
    range: [0.3, 0.85],
  },
  {
    en: (n, k) => `A raffle sold $${n}$ tickets so far, and $${k}$ of them were winners.`,
    de: (n, k) => `Bei einer Tombola wurden bisher $${n}$ Lose gezogen, $${k}$ davon waren Gewinne.`,
    thing: tx("a winner", "Gewinn"),
    other: tx("a blank", "Niete"),
    range: [0.1, 0.4],
  },
  {
    en: (n, k) => `Emil rolls a die $${n}$ times and gets a six $${k}$ times.`,
    de: (n, k) => `Emil würfelt $${n}$-mal und bekommt $${k}$-mal eine Sechs.`,
    thing: tx("six", "Sechs"),
    other: tx("no six", "keine Sechs"),
    range: [0.12, 0.22],
  },
  {
    en: (n, k) => `On $${n}$ school days, the traffic light by the school was green $${k}$ times when Mia arrived.`,
    de: (n, k) => `An $${n}$ Schultagen war die Ampel vor der Schule $${k}$-mal grün, als Mia ankam.`,
    thing: tx("green", "grün"),
    other: tx("not green", "nicht grün"),
    range: [0.25, 0.6],
  },
];

function relTask(rng: Rng): Exercise {
  const story = rng.pick(STORIES);
  const n = rng.pick([20, 25, 40, 50, 100, 200, 250, 500]);
  let k = rng.int(Math.max(1, Math.ceil(n * story.range[0])), Math.floor(n * story.range[1]));
  if (k === n - k) k += 1;
  const asPercent = rng.chance(0.4);
  const h = k / n;
  const right = asPercent ? Math.round(h * 1000) / 10 : h;
  const scale = asPercent ? 100 : 1;
  const thing = story.thing;
  const ask = asPercent
    ? tx(`What is the relative frequency of “${en(thing)}”? Give it as a percentage.`, `Wie groß ist die relative Häufigkeit für „${de(thing)}“? Gib sie in Prozent an.`)
    : tx(`What is the relative frequency of “${en(thing)}”? Give it as a decimal.`, `Wie groß ist die relative Häufigkeit für „${de(thing)}“? Gib sie als Dezimalzahl an.`);
  const mistakes = numMistakes(
    right,
    asPercent ? 0.06 : 0.0006,
    [
      { v: ((n - k) / n) * scale, title: tx("The other outcome", "Das andere Ergebnis"), say: tx(`You worked out the relative frequency of “${en(story.other)}”: $${n - k}$ of $${n}$. The question asks about “${en(thing)}”.`, `Du hast die relative Häufigkeit für „${de(story.other)}“ berechnet: $${n - k}$ von $${n}$. Gefragt ist „${de(thing)}“.`) },
      { v: k, title: tx("Absolute, not relative", "Absolut statt relativ"), say: tx(`$${k}$ is the **absolute** frequency, the count. For the relative frequency, divide by the number of trials.`, `$${k}$ ist die **absolute** Häufigkeit, also die Anzahl. Für die relative Häufigkeit teilst du noch durch die Anzahl der Versuche.`) },
      { v: (k / (n - k)) * scale, title: tx("Divided by the wrong number", "Durch die falsche Zahl geteilt"), say: tx(`You divided by the $${n - k}$ other results. Divide by **all** $${n}$ trials.`, `Du hast durch die $${n - k}$ anderen Ergebnisse geteilt. Teile durch **alle** $${n}$ Versuche.`) },
      ...(n !== 100 && !asPercent ? [{ v: k / 100, title: tx("Not out of 100", "Nicht von 100"), say: tx(`You wrote $${k}$ as hundredths. But there were $${n}$ trials, not $100$.`, `Du hast $${k}$ als Hundertstel geschrieben. Es waren aber $${n}$ Versuche, nicht $100$.`) }] : []),
    ],
    asPercent ? PCT : undefined,
  );
  return {
    instruction: I.rel,
    text: tx(`${story.en(n, k)} ${en(ask)}`, `${story.de(n, k)} ${de(ask)}`),
    answer: asPercent ? numAnswer(right, 0.01, PCT) : numAnswer(right),
    hint: tx("Relative frequency = absolute frequency : number of trials.", "Relative Häufigkeit = absolute Häufigkeit : Anzahl der Versuche."),
    solution: [
      { math: `h#h =#eq ${fr(k, n)}#f`, note: tx(`“${en(thing)}” happened $${k}$ times in $${n}$ trials.`, `„${de(thing)}“ kam $${k}$-mal in $${n}$ Versuchen vor.`) },
      { math: say((f) => `h#h =#eq ${fr(k, n)}#f =#e2 ${f.n(h, 4)}#d`), note: tx("Divide.", "Teilen.") },
      ...(asPercent ? [{ math: say((f) => `h#h =#eq ${f.n(h, 4)}#d =#e3 \\group{${f.n(right, 1)} \\, %}`), note: tx("Times $100$ gives the percentage.", "Mal $100$ ergibt den Prozentsatz.") }] : []),
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Estimating absolute frequencies

const SIMPLE_DIE: { en: string; de: string; fav: number }[] = [
  { en: "a six", de: "eine Sechs", fav: 1 },
  { en: "an even number", de: "eine gerade Zahl", fav: 3 },
  { en: "a number greater than $4$", de: "eine Zahl größer als $4$", fav: 2 },
  { en: "a number of at least $3$", de: "eine Augenzahl von mindestens $3$", fav: 4 },
  { en: "a one or a two", de: "eine Eins oder eine Zwei", fav: 2 },
  { en: "no six", de: "keine Sechs", fav: 5 },
];

function estimateTask(rng: Rng): Exercise {
  if (rng.chance(0.55)) {
    const ev = rng.pick(SIMPLE_DIE);
    const N = rng.pick([60, 120, 300, 600, 1200, 3000]);
    const right = (N * ev.fav) / 6;
    return {
      instruction: I.estimate,
      text: tx(`You roll a normal die $${N}$ times. About how often do you expect ${ev.en}?`, `Du würfelst $${N}$-mal mit einem normalen Würfel. Wie oft erwartest du ungefähr ${ev.de}?`),
      answer: numAnswer(right),
      hint: tx("First the probability (Laplace), then: probability · number of rolls.", "Erst die Wahrscheinlichkeit (Laplace), dann: Wahrscheinlichkeit · Anzahl der Würfe."),
      solution: [
        { math: `P(E) = ${frChain(ev.fav, 6)}`, note: tx(`$${ev.fav}$ of $6$ numbers ${ev.fav === 1 ? "is" : "are"} favourable for ${ev.en}.`, `$${ev.fav}$ von $6$ Augenzahlen ${ev.fav === 1 ? "ist" : "sind"} günstig für ${ev.de}.`) },
        { math: `${frS(frac(ev.fav, 6))} \\cdot ${N} = ${right}`, note: tx(`In the long run, about this share of the $${N}$ rolls: roughly $${right}$ times.`, `Auf lange Sicht kommt ungefähr dieser Anteil der $${N}$ Würfe: etwa $${right}$-mal.`) },
      ],
      mistakes: numMistakes(right, 1e-6, [
        { v: ev.fav > 1 ? N / 6 : null, title: tx("Only one number", "Nur eine Zahl"), say: tx(`$${N} : 6$ counts just one number. ${ev.en} has $${ev.fav}$ favourable numbers.`, `$${N} : 6$ zählt nur eine Augenzahl. Für ${ev.de} sind $${ev.fav}$ Augenzahlen günstig.`) },
        { v: N - right, title: tx("The opposite", "Das Gegenteil"), say: tx("That's how often the event does **not** happen. Swap it round.", "So oft tritt das Ereignis **nicht** ein. Andersrum!") },
        { v: N * ev.fav, title: tx("Forgot to divide by 6", "Durch 6 vergessen"), say: tx("More often than you roll? The probability is a fraction of the rolls: divide by $6$ too.", "Öfter, als du würfelst? Die Wahrscheinlichkeit ist ein Anteil der Würfe: Teile auch durch $6$.") },
      ]),
    };
  }
  const n = rng.pick([100, 200, 250, 500]);
  const pct = rng.pick([52, 56, 58, 60, 62, 64, 66]);
  const k = (n * pct) / 100;
  const N = rng.pick([1000, 2000, 5000]);
  const right = (N * pct) / 100;
  return {
    instruction: I.estimate,
    text: tx(
      `A drawing pin landed point up $${k}$ times in $${n}$ throws. About how often do you expect it to land point up in $${N}$ throws?`,
      `Eine Reißzwecke ist bei $${n}$ Würfen $${k}$-mal in Kopflage gelandet. Wie oft erwartest du ungefähr Kopflage bei $${N}$ Würfen?`,
    ),
    answer: numAnswer(right),
    hint: tx("Use the relative frequency as an estimate for the probability.", "Nimm die relative Häufigkeit als Schätzwert für die Wahrscheinlichkeit."),
    solution: [
      { math: say((f) => `h = ${fr(k, n)} = ${f.n(pct / 100)}`), note: tx("For a drawing pin there's no Laplace rule. The relative frequency is our best estimate.", "Für die Reißzwecke gibt es keine Laplace-Regel. Die relative Häufigkeit ist der beste Schätzwert.") },
      { math: say((f) => `${f.n(pct / 100)} \\cdot ${N} = ${right}`), note: tx(`So in $${N}$ throws: roughly $${right}$ times point up.`, `Bei $${N}$ Würfen also ungefähr $${right}$-mal Kopflage.`) },
    ],
    mistakes: numMistakes(right, 1e-6, [
      { v: k, title: tx("Same count", "Gleiche Anzahl"), say: tx(`$${k}$ was for $${n}$ throws. With $${N}$ throws you expect more.`, `$${k}$ galt für $${n}$ Würfe. Bei $${N}$ Würfen erwartest du mehr.`) },
      { v: N - right, title: tx("The other outcome", "Das andere Ergebnis"), say: tx("That's the number of side landings. The question asks for point up.", "Das ist die Anzahl der Seitenlagen. Gefragt ist die Kopflage.") },
      { v: N + k, title: tx("Added", "Addiert"), say: tx("Adding doesn't work here. Use the share: relative frequency · number of throws.", "Addieren klappt hier nicht. Nimm den Anteil: relative Häufigkeit · Anzahl der Würfe.") },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Impossible, possible or certain?

const LEVELS3: Text[] = [tx("impossible ($P = 0$)", "unmöglich ($P = 0$)"), tx("possible, but not certain", "möglich, aber nicht sicher"), tx("certain ($P = 1$)", "sicher ($P = 1$)")];

type Kind3 = 0 | 1 | 2;
const CLASSIFY: { en: string; de: string; is: Kind3; trap: Kind3; say: Text }[] = [
  { en: "You roll a normal die: a number greater than $6$.", de: "Du würfelst mit einem normalen Würfel: eine Zahl größer als $6$.", is: 0, trap: 1, say: tx("The largest number on a die is $6$. Nothing is greater, so this can never happen.", "Die größte Zahl auf dem Würfel ist die $6$. Größer geht nicht: Das kann nie passieren.") },
  { en: "You roll a normal die: a number less than $7$.", de: "Du würfelst mit einem normalen Würfel: eine Zahl kleiner als $7$.", is: 2, trap: 1, say: tx("Which number on a die is **not** less than $7$? None! So it always happens.", "Welche Zahl auf dem Würfel ist **nicht** kleiner als $7$? Keine! Also passiert es immer.") },
  { en: "You roll a normal die: a number less than $6$.", de: "Du würfelst mit einem normalen Würfel: eine Zahl kleiner als $6$.", is: 1, trap: 2, say: tx("And if you roll a $6$? The $6$ is not less than $6$. So it's not certain.", "Und wenn du eine $6$ würfelst? Die $6$ ist nicht kleiner als $6$. Also ist es nicht sicher.") },
  { en: "You roll a normal die: a number greater than $0$.", de: "Du würfelst mit einem normalen Würfel: eine Zahl größer als $0$.", is: 2, trap: 1, say: tx("Every number on a die, from $1$ to $6$, is greater than $0$. So it always happens.", "Jede Zahl auf dem Würfel, von $1$ bis $6$, ist größer als $0$. Also passiert es immer.") },
  { en: "You roll a normal die: the number $0$.", de: "Du würfelst mit einem normalen Würfel: die Zahl $0$.", is: 0, trap: 1, say: tx("There is no $0$ on a die. Impossible!", "Auf einem Würfel gibt es keine $0$. Unmöglich!") },
  { en: "An urn holds $4$ red and $3$ green balls. You draw a purple ball.", de: "In einer Urne liegen $4$ rote und $3$ grüne Kugeln. Du ziehst eine lila Kugel.", is: 0, trap: 1, say: tx("There are no purple balls in the urn at all. Impossible!", "In der Urne gibt es gar keine lila Kugel. Unmöglich!") },
  { en: "An urn holds $4$ red and $3$ green balls. You draw a red or a green ball.", de: "In einer Urne liegen $4$ rote und $3$ grüne Kugeln. Du ziehst eine rote oder eine grüne Kugel.", is: 2, trap: 1, say: tx("Every ball in the urn is red or green. Whatever you draw fits.", "Jede Kugel in der Urne ist rot oder grün. Egal, was du ziehst: Es passt.") },
  { en: "An urn holds $4$ red and $3$ green balls. You draw a red ball.", de: "In einer Urne liegen $4$ rote und $3$ grüne Kugeln. Du ziehst eine rote Kugel.", is: 1, trap: 2, say: tx("Red is likely, but you could also draw one of the $3$ green balls.", "Rot ist wahrscheinlich, aber du könntest auch eine der $3$ grünen Kugeln ziehen.") },
  { en: "You draw one card from a Skat deck (7 to ace): a $2$.", de: "Du ziehst eine Karte aus einem Skatblatt (7 bis Ass): eine $2$.", is: 0, trap: 1, say: tx("A Skat deck starts at $7$. There are no 2s in it.", "Ein Skatblatt fängt bei der $7$ an. Es gibt keine 2 darin.") },
  { en: "You toss a coin: heads or tails.", de: "Du wirfst eine Münze: Wappen oder Zahl.", is: 2, trap: 1, say: tx("A coin always shows heads or tails. Certain!", "Eine Münze zeigt immer Wappen oder Zahl. Sicher!") },
  { en: "You toss a coin twice: heads both times.", de: "Du wirfst eine Münze zweimal: zweimal Wappen.", is: 1, trap: 0, say: tx("Unlikely, but not impossible: heads, then heads again can happen.", "Unwahrscheinlich, aber nicht unmöglich: Wappen und dann noch mal Wappen kann passieren.") },
  { en: "A spinner has $8$ fields, all of them purple. It stops on purple.", de: "Ein Glücksrad hat $8$ Felder, alle sind lila. Es bleibt auf Lila stehen.", is: 2, trap: 1, say: tx("All fields are purple, so wherever it stops, it's purple.", "Alle Felder sind lila: Wo es auch stehen bleibt, es ist Lila.") },
];

function classifyTask(rng: Rng): Exercise {
  const c = rng.pick(CLASSIFY);
  const verdict = [tx("can never happen: impossible", "kann nie eintreten: unmöglich"), tx("can happen, but doesn't have to", "kann eintreten, muss aber nicht"), tx("always happens: certain", "tritt immer ein: sicher")][c.is];
  return {
    instruction: I.classify,
    text: tx(c.en, c.de),
    answer: { kind: "choice", options: LEVELS3, correct: c.is },
    hint: tx("Can it happen at all? Does it happen every single time?", "Kann es überhaupt passieren? Passiert es jedes Mal?"),
    solution: [
      { math: c.is === 0 ? "P(E) = 0" : c.is === 2 ? "P(E) = 1" : "0 < P(E) < 1", note: tx(`The event ${en(verdict)}.`, `Das Ereignis ${de(verdict)}.`) },
    ],
    mistakes: choiceMistakes(LEVELS3, c.is, [{ i: c.trap, title: c.is === 1 ? tx("Not so fast", "Nicht so schnell") : tx("Look again", "Schau noch mal"), say: c.say }]),
  };
}

// ---------------------------------------------------------------------------
// Sort events by probability

const BY_COUNT: { en: string; de: string; trapTo?: number }[][] = [
  [{ en: "a $7$", de: "eine $7$" }, { en: "a number greater than $6$", de: "eine Zahl größer als $6$", trapTo: 1 }, { en: "a $0$", de: "eine $0$" }],
  [{ en: "a $6$", de: "eine $6$" }, { en: "a $1$", de: "eine $1$" }],
  [{ en: "a number greater than $4$", de: "eine Zahl größer als $4$", trapTo: 3 }, { en: "a number divisible by $3$", de: "eine durch $3$ teilbare Zahl" }, { en: "a number less than $3$", de: "eine Zahl kleiner als $3$", trapTo: 3 }],
  [{ en: "an even number", de: "eine gerade Zahl" }, { en: "a prime number", de: "eine Primzahl", trapTo: 4 }, { en: "a number of at least $4$", de: "eine Augenzahl von mindestens $4$", trapTo: 2 }],
  [{ en: "a number of at least $3$", de: "eine Augenzahl von mindestens $3$", trapTo: 3 }, { en: "a number greater than $2$", de: "eine Zahl größer als $2$", trapTo: 5 }],
  [{ en: "no $6$", de: "keine $6$" }, { en: "a number less than $6$", de: "eine Zahl kleiner als $6$", trapTo: 6 }],
  [{ en: "a number less than $7$", de: "eine Zahl kleiner als $7$" }, { en: "a number greater than $0$", de: "eine Zahl größer als $0$" }, { en: "a number from $1$ to $6$", de: "eine Zahl von $1$ bis $6$" }],
];

function orderTask(rng: Rng): Exercise {
  // Mostly events in between; impossible or certain ones only now and then.
  const inner = rng.shuffle([1, 2, 3, 4, 5]);
  const counts = (rng.chance(0.5) ? [...inner.slice(0, 3), rng.pick([0, 6])] : inner.slice(0, 4)).sort((a, b) => a - b);
  const evs = counts.map((c) => ({ ...rng.pick(BY_COUNT[c]), count: c }));
  const items: Text[] = evs.map((e) => tx(e.en, e.de));
  // A boundary slip moves an event past its neighbour: that pair then comes out the wrong way round.
  const mistakes: Mistake[] = [];
  evs.forEach((e, i) => {
    if (e.trapTo === undefined || mistakes.length) return;
    const up = e.trapTo > e.count;
    const j = up ? i + 1 : i - 1;
    if (j < 0 || j >= evs.length) return;
    const passes = up ? e.trapTo > evs[j].count : e.trapTo < evs[j].count;
    if (!passes) return;
    const pair = up ? [items[j], items[i]] : [items[i], items[j]];
    mistakes.push({
      when: { kind: "order", items: pair },
      title: tx("Check the boundary", "Prüf die Grenze"),
      say: tx(
        `Count the numbers for ${e.en} again, one by one: it's exactly $${e.count}$ of the $6$ numbers.`,
        `Zähl die Zahlen für ${e.de} noch mal einzeln: Es sind genau $${e.count}$ der $6$ Augenzahlen.`,
      ),
    });
  });
  const chain = counts.map((c) => fr(c, 6)).join(" < ");
  return {
    instruction: I.order,
    text: tx("You roll a normal die once. Sort these events from the **least** likely to the **most** likely.", "Du würfelst einmal mit einem normalen Würfel. Sortiere die Ereignisse von **am unwahrscheinlichsten** bis **am wahrscheinlichsten**."),
    answer: { kind: "order", items, label: tx("Top: least likely. Bottom: most likely.", "Oben: am unwahrscheinlichsten. Unten: am wahrscheinlichsten.") },
    hint: tx("For each event, count the favourable numbers out of $6$.", "Zähle für jedes Ereignis die günstigen Augenzahlen von $6$."),
    solution: [
      ...evs.map((e): Frame => ({
        math: tx(`P("${e.en.replace(/\$/g, "")}") = ${fr(e.count, 6)}`, `P("${e.de.replace(/\$/g, "")}") = ${fr(e.count, 6)}`),
        note: tx(`${e.en.charAt(0).toUpperCase()}${e.en.slice(1)}: $${e.count}$ of $6$ numbers.`, `${e.de.charAt(0).toUpperCase()}${e.de.slice(1)}: $${e.count}$ von $6$ Augenzahlen.`),
      })),
      { math: chain, note: tx("The more favourable numbers, the more likely. That's the order.", "Je mehr günstige Zahlen, desto wahrscheinlicher. Das ist die Reihenfolge.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  const shape = rng.pick(["die", "die", "urn", "urn", "cards", "spinner", "spinner", "rel", "rel", "estimate", "classify", "order"] as const);
  switch (shape) {
    case "die":
      return dieTask(rng);
    case "urn":
      return urnTask(rng);
    case "cards":
      return cardTask(rng);
    case "spinner":
      return spinnerTask(rng);
    case "rel":
      return relTask(rng);
    case "estimate":
      return estimateTask(rng);
    case "classify":
      return classifyTask(rng);
    case "order":
      return orderTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const experiments: Frame[] = [
  {
    math: tx(`"Rolling a die:"#lab \\; S#S =#eq \\{#o 1#a ,#k1 2#b ,#k2 3#c ,#k3 4#d ,#k4 5#e ,#k5 6#f \\}#cl`, `"Würfeln:"#lab \\; S#S =#eq \\{#o 1#a ,#k1 2#b ,#k2 3#c ,#k3 4#d ,#k4 5#e ,#k5 6#f \\}#cl`),
    note: tx("Rolling a die is a **chance experiment**. It has six possible **outcomes**. Together they form the **sample space** $S$.", "Würfeln ist ein **Zufallsexperiment**. Es hat sechs mögliche **Ergebnisse**. Zusammen bilden sie die **Ergebnismenge** $S$."),
  },
  {
    math: tx(`"even number:"#lab \\; E#S =#eq \\{#o 2#b ,#k2 4#d ,#k4 6#f \\}#cl`, `"gerade Zahl:"#lab \\; E#S =#eq \\{#o 2#b ,#k2 4#d ,#k4 6#f \\}#cl`),
    note: tx("An **event** groups outcomes together. “Even number” happens if you roll a $2$, $4$ or $6$.", "Ein **Ereignis** fasst Ergebnisse zusammen. „Gerade Zahl“ tritt ein, wenn du $2$, $4$ oder $6$ würfelst."),
    highlight: ["b", "d", "f"],
  },
  {
    math: tx(`"Tossing a coin:"#lab \\; S#S =#eq \\{#o "heads"#h ,#k1 "tails"#z \\}#cl`, `"Münzwurf:"#lab \\; S#S =#eq \\{#o "Wappen"#h ,#k1 "Zahl"#z \\}#cl`),
    note: tx("Tossing a coin is a chance experiment too, with only two outcomes. You can't predict any single result.", "Auch der Münzwurf ist ein Zufallsexperiment, mit nur zwei Ergebnissen. Ein einzelnes Ergebnis kannst du nie vorhersagen."),
  },
];

const frequencies: Frame[] = [
  { math: "H#H =#eq 9#k", note: tx("Mia rolls $50$ times and gets a six $9$ times. The **absolute frequency** of the six is $H = 9$.", "Mia würfelt $50$-mal und bekommt $9$-mal eine Sechs. Die **absolute Häufigkeit** der Sechs ist $H = 9$.") },
  { math: "h#h =#eq \\frac{9#k}{50#n}#f", note: tx("The **relative frequency** is the share: absolute frequency divided by the number of rolls.", "Die **relative Häufigkeit** ist der Anteil: absolute Häufigkeit geteilt durch die Anzahl der Würfe.") },
  { math: "h#h =#eq \\frac{9#k}{50#n}#f =#e2 \\frac{18#k2}{100#n2}#g", note: tx("Expand by $2$ to get hundredths.", "Erweitere mit $2$ auf Hundertstel.") },
  {
    math: say((f) => `h#h =#eq \\frac{18#k2}{100#n2}#g =#e3 ${f.n(0.18)}#d =#e4 \\group{18#p \\, %#ps}`),
    note: say((f) => f.t(`So $h = ${f.n(0.18)} = \\group{18 \\, %}$. A relative frequency is always between $0$ and $1$.`, `Also $h = ${f.n(0.18)} = \\group{18 \\, %}$. Eine relative Häufigkeit liegt immer zwischen $0$ und $1$.`)),
  },
];

const laplace: Frame[] = [
  {
    math: tx(`P#P (E#E)#pa =#eq \\frac{"favourable outcomes"#gt}{"possible outcomes"#mt}#fr`, `P#P (E#E)#pa =#eq \\frac{"günstige Ergebnisse"#gt}{"mögliche Ergebnisse"#mt}#fr`),
    note: tx("When all outcomes are **equally likely**, you just count: favourable outcomes divided by possible outcomes.", "Wenn alle Ergebnisse **gleich wahrscheinlich** sind, zählst du einfach: günstige Ergebnisse durch mögliche Ergebnisse."),
  },
  {
    math: tx(`P#P ("even"#E)#pa =#eq \\frac{3#g}{6#m}#fr`, `P#P ("gerade"#E)#pa =#eq \\frac{3#g}{6#m}#fr`),
    note: tx("Even number: $2$, $4$ and $6$ are favourable, that's $3$. Possible are all $6$ numbers.", "Gerade Zahl: Günstig sind $2$, $4$ und $6$, also $3$. Möglich sind alle $6$ Augenzahlen."),
  },
  {
    math: tx(`P#P ("even"#E)#pa =#eq \\frac{3#g}{6#m}#fr =#e2 \\frac{1#g2}{2#m2}#fr2`, `P#P ("gerade"#E)#pa =#eq \\frac{3#g}{6#m}#fr =#e2 \\frac{1#g2}{2#m2}#fr2`),
    note: tx("Simplify: $\\frac{3}{6} = \\frac{1}{2}$.", "Kürzen: $\\frac{3}{6} = \\frac{1}{2}$."),
  },
  {
    math: say((f) => `P#P ("${f.t("even", "gerade")}"#E)#pa =#eq \\frac{1#g2}{2#m2}#fr2 =#e3 ${f.n(0.5)}#d =#e4 \\group{50 \\, %#ps}`),
    note: tx("You can write a probability as a fraction, a decimal or a percentage. All three are right.", "Eine Wahrscheinlichkeit kannst du als Bruch, als Dezimalzahl oder in Prozent angeben. Alle drei sind richtig."),
  },
];

const zeroOne: Frame[] = [
  {
    math: tx(`P#P ("roll a 7"#ev)#pa =#e1 \\frac{0#z}{6#m}#fr =#e2 0#r`, `P#P ("eine 7 würfeln"#ev)#pa =#e1 \\frac{0#z}{6#m}#fr =#e2 0#r`),
    note: tx("No face of a die shows a $7$: there are $0$ favourable outcomes. The event is **impossible**.", "Keine Seite des Würfels zeigt eine $7$: $0$ günstige Ergebnisse. Das Ereignis ist **unmöglich**."),
  },
  {
    math: tx(`P#P ("a number from 1 to 6"#ev)#pa =#e1 \\frac{6#z}{6#m}#fr =#e2 1#r`, `P#P ("eine Zahl von 1 bis 6"#ev)#pa =#e1 \\frac{6#z}{6#m}#fr =#e2 1#r`),
    note: tx("Some number from $1$ to $6$ comes up every time. All $6$ outcomes are favourable: the event is **certain**.", "Irgendeine Zahl von $1$ bis $6$ kommt jedes Mal. Alle $6$ Ergebnisse sind günstig: Das Ereignis ist **sicher**."),
  },
  {
    math: "0#z \\le#l1 P#P (E#ev)#pa \\le#l2 1#r",
    note: say((f) => f.t(`Every probability lies between $0$ (impossible) and $1$ (certain), so between $\\group{0 \\, %}$ and $\\group{100 \\, %}$.`, `Jede Wahrscheinlichkeit liegt zwischen $0$ (unmöglich) und $1$ (sicher), also zwischen $\\group{0 \\, %}$ und $\\group{100 \\, %}$.`)),
  },
];

const urnCheck: Exercise = {
  instruction: I.urn,
  text: tx(
    "An urn holds $3$ red, $5$ green and $2$ purple balls. You draw one ball without looking. What is the probability of a red ball?",
    "In einer Urne liegen $3$ rote, $5$ grüne und $2$ lila Kugeln. Du ziehst ohne hinzusehen eine Kugel. Wie groß ist die Wahrscheinlichkeit für eine rote Kugel?",
  ),
  visual: visual(ProbabilityUrn, { balls: [{ color: "red", n: 3 }, { color: "green", n: 5 }, { color: "purple", n: 2 }] }),
  answer: fracAnswer(frac(3, 10)),
  hint: tx("Count all balls: those are the possible outcomes. The red ones are favourable.", "Zähle alle Kugeln: Das sind die möglichen Ergebnisse. Die roten sind die günstigen."),
  solution: [
    { math: tx(`"all balls:" \\; 3 + 5 + 2 = 10`, `"alle Kugeln:" \\; 3 + 5 + 2 = 10`), note: tx("Every **ball** is equally likely, so there are $10$ possible outcomes.", "Jede **Kugel** ist gleich wahrscheinlich, also gibt es $10$ mögliche Ergebnisse.") },
    { math: tx(`P("red") = \\frac{3}{10}`, `P("rot") = \\frac{3}{10}`), note: tx("$3$ of them are red: favourable : possible.", "$3$ davon sind rot: günstige durch mögliche.") },
    { math: say((f) => f.t(`P("red") = \\frac{3}{10} = ${f.n(0.3)} = \\group{30 \\, %}`, `P("rot") = \\frac{3}{10} = ${f.n(0.3)} = \\group{30 \\, %}`)), note: tx("As a decimal and as a percentage.", "Als Dezimalzahl und in Prozent.") },
  ],
  mistakes: fracMistakes(frac(3, 10), [
    { v: { n: 1, d: 3 }, ...COLOURS_COUNTED(3) },
    { v: { n: 3, d: 7 }, ...FAV_UNFAV(3, 7) },
  ]),
};

const pinCheck: Exercise = {
  instruction: I.rel,
  text: tx(
    "Ben throws a drawing pin $40$ times. It lands point up $26$ times. What is the relative frequency of “point up”? Give it as a decimal.",
    "Ben wirft eine Reißzwecke $40$-mal. Sie landet $26$-mal in Kopflage. Wie groß ist die relative Häufigkeit für „Kopflage“? Gib sie als Dezimalzahl an.",
  ),
  answer: numAnswer(0.65),
  hint: tx("Relative frequency = absolute frequency : number of throws.", "Relative Häufigkeit = absolute Häufigkeit : Anzahl der Würfe."),
  solution: [
    { math: "h#h =#eq \\frac{26#k}{40#n}#f", note: tx("Point up $26$ times in $40$ throws.", "$26$-mal Kopflage bei $40$ Würfen.") },
    { math: "h#h =#eq \\frac{13#k}{20#n}#f =#e2 \\frac{65#k2}{100#n2}#g", note: tx("Simplify by $2$, then expand by $5$ to get hundredths.", "Mit $2$ kürzen, dann mit $5$ auf Hundertstel erweitern.") },
    { math: say((f) => `h#h =#eq \\frac{65#k2}{100#n2}#g =#e3 ${f.n(0.65)}#d`), note: say((f) => f.t(`$h = ${f.n(0.65)}$, that's $\\group{65 \\, %}$ of the throws.`, `$h = ${f.n(0.65)}$, das sind $\\group{65 \\, %}$ der Würfe.`)) },
  ],
  mistakes: numMistakes(0.65, 0.0006, [
    { v: 0.35, title: tx("The other outcome", "Das andere Ergebnis"), say: tx("You worked out “on its side”: $14$ of $40$. The question asks about point up.", "Du hast die Seitenlage berechnet: $14$ von $40$. Gefragt ist die Kopflage.") },
    { v: 26, title: tx("Absolute, not relative", "Absolut statt relativ"), say: tx("$26$ is the **absolute** frequency, the count. For the relative frequency, divide by the number of throws.", "$26$ ist die **absolute** Häufigkeit, also die Anzahl. Für die relative Häufigkeit teilst du noch durch die Anzahl der Würfe.") },
    { v: 26 / 14, title: tx("Divided by the wrong number", "Durch die falsche Zahl geteilt"), say: tx("You divided by the $14$ side landings. Divide by **all** $40$ throws.", "Du hast durch die $14$ Seitenlagen geteilt. Teile durch **alle** $40$ Würfe.") },
    { v: 0.26, title: tx("Not out of 100", "Nicht von 100"), say: tx("You wrote $26$ as hundredths. But there were $40$ throws, not $100$.", "Du hast $26$ als Hundertstel geschrieben. Es waren aber $40$ Würfe, nicht $100$.") },
  ]),
};

const certainOptions: Text[] = [
  tx("a number less than $6$", "eine Zahl kleiner als $6$"),
  tx("a $7$", "eine $7$"),
  tx("a number less than $7$", "eine Zahl kleiner als $7$"),
  tx("an even number", "eine gerade Zahl"),
];

const certainCheck: Exercise = {
  instruction: tx("Choose the certain event", "Wähle das sichere Ereignis"),
  text: tx("You roll a normal die once. Which event is **certain**?", "Du würfelst einmal mit einem normalen Würfel. Welches Ereignis ist **sicher**?"),
  answer: { kind: "choice", options: certainOptions, correct: 2 },
  hint: tx("Certain means: it happens with **every** possible outcome, $1$ to $6$.", "Sicher heißt: Es tritt bei **jedem** möglichen Ergebnis ein, von $1$ bis $6$."),
  solution: [
    { math: tx(`"less than 7:" \\; E = \\{ 1, 2, 3, 4, 5, 6 \\} = S`, `"kleiner als 7:" \\; E = \\{ 1, 2, 3, 4, 5, 6 \\} = S`), note: tx("Every number on the die is less than $7$. The event contains all outcomes.", "Jede Zahl auf dem Würfel ist kleiner als $7$. Das Ereignis enthält alle Ergebnisse.") },
    { math: "P(E) = \\frac{6}{6} = 1", note: tx("Probability $1$: certain.", "Wahrscheinlichkeit $1$: sicher.") },
  ],
  mistakes: choiceMistakes(certainOptions, 2, [
    { i: 0, title: tx("What about the 6?", "Und die 6?"), say: tx("Nearly! The $6$ is not less than $6$. If you roll a $6$, the event doesn't happen.", "Fast! Die $6$ ist nicht kleiner als $6$. Würfelst du eine $6$, tritt das Ereignis nicht ein.") },
    { i: 1, title: tx("Impossible, not certain", "Unmöglich, nicht sicher"), say: tx("There is no $7$ on a die. That event is **impossible**: $P = 0$.", "Eine $7$ gibt es auf dem Würfel gar nicht. Das Ereignis ist **unmöglich**: $P = 0$.") },
    { i: 3, title: tx("Only half the time", "Nur in der Hälfte der Fälle"), say: tx("Even numbers come up often, but not always: with $1$, $3$ or $5$ it doesn't happen.", "Gerade Zahlen kommen oft, aber nicht immer: Bei $1$, $3$ oder $5$ tritt das Ereignis nicht ein.") },
  ]),
};

const spinnerSectors: Sector[] = [
  { w: 1, color: "purple" },
  { w: 1, color: "green" },
  { w: 1, color: "red" },
  { w: 1, color: "purple" },
  { w: 1, color: "green" },
];

const spinnerCheck: Exercise = {
  instruction: I.spinner,
  text: tx("The spinner has $5$ fields of the same size. What is the probability that it stops on **purple**?", "Das Glücksrad hat $5$ gleich große Felder. Wie groß ist die Wahrscheinlichkeit, dass es auf **Lila** stehen bleibt?"),
  visual: visual(ProbabilitySpinner, { sectors: spinnerSectors }),
  answer: numAnswer(40, 0.01, PCT),
  hint: tx("Count the purple fields out of $5$. Then expand the fraction to hundredths.", "Zähle die lila Felder von $5$. Dann erweitere den Bruch auf Hundertstel."),
  solution: [
    { math: tx(`P#P ("purple"#c)#pa =#eq \\frac{2#a}{5#b}#f`, `P#P ("lila"#c)#pa =#eq \\frac{2#a}{5#b}#f`), note: tx("$2$ of the $5$ equal fields are purple.", "$2$ der $5$ gleich großen Felder sind lila.") },
    { math: tx(`P#P ("purple"#c)#pa =#eq \\frac{2#a}{5#b}#f =#e2 \\frac{40#a2}{100#b2}#g`, `P#P ("lila"#c)#pa =#eq \\frac{2#a}{5#b}#f =#e2 \\frac{40#a2}{100#b2}#g`), note: tx("Expand by $20$.", "Mit $20$ erweitern.") },
    { math: tx(`P#P ("purple"#c)#pa =#eq \\group{40#a2 \\, %#ps}`, `P#P ("lila"#c)#pa =#eq \\group{40#a2 \\, %#ps}`), note: tx("$40$ hundredths are $\\group{40 \\, %}$.", "$40$ Hundertstel sind $\\group{40 \\, %}$.") },
  ],
  mistakes: numMistakes(
    40,
    0.06,
    [
      { v: 2, title: tx("Just counted", "Nur gezählt"), say: tx("$2$ is the number of purple fields. Percent means “out of $100$”: write the fraction first.", "$2$ ist die Anzahl der lila Felder. Prozent heißt „von $100$“: Schreib erst den Bruch.") },
      { v: 200 / 3, ...FAV_UNFAV(2, 3) },
      { v: 100 / 3, ...COLOURS_COUNTED(3) },
      { v: 60, title: tx("The other colours", "Die anderen Farben"), say: tx("That's the probability of **not** purple. Look again at which colour is asked.", "Das ist die Wahrscheinlichkeit für **nicht** lila. Schau noch mal, welche Farbe gefragt ist.") },
    ],
    PCT,
  ),
};

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Chance experiments", "Zufallsexperimente"),
      blob: tx("Dice, coins, raffles: pure chance? Yes, but chance follows rules!", "Würfel, Münzen, Lose: alles Zufall? Ja, aber der Zufall hat Regeln!"),
      body: tx(
        "A **chance experiment** can be repeated as often as you like under the same conditions, and you can't predict its result. You do know all the possible **outcomes**.",
        "Ein **Zufallsexperiment** kann man beliebig oft unter gleichen Bedingungen wiederholen, und sein Ergebnis lässt sich nicht vorhersagen. Welche **Ergebnisse** möglich sind, weißt du aber.",
      ),
      frames: experiments,
    },
    {
      type: "explain",
      title: tx("Absolute and relative frequency", "Absolute und relative Häufigkeit"),
      blob: tx("Count first, then divide!", "Erst zählen, dann teilen!"),
      body: tx(
        "If you repeat an experiment $n$ times, the **absolute frequency** $H$ says how often an event happened. The **relative frequency** $h = \\frac{H}{n}$ says which share of the trials that was.",
        "Wiederholst du ein Experiment $n$-mal, sagt die **absolute Häufigkeit** $H$, wie oft ein Ereignis eingetreten ist. Die **relative Häufigkeit** $h = \\frac{H}{n}$ sagt, welcher Anteil der Versuche das war.",
      ),
      frames: frequencies,
    },
    { type: "check", blob: tx("A drawing pin has no fair sides. Just count!", "Eine Reißzwecke hat keine fairen Seiten. Einfach zählen!"), exercise: pinCheck },
    {
      type: "widget",
      title: tx("Roll a thousand times", "Würfle tausendmal"),
      blob: tx("Roll 10 times, then 100, then 1000. What happens to the bars?", "Würfle 10-mal, dann 100-mal, dann 1000-mal. Was passiert mit den Balken?"),
      body: say((f) =>
        f.t(
          `The more often you roll, the closer each number's relative frequency settles near $\\frac{1}{6} \\approx ${f.n(0.167)}$: the **law of large numbers**. A drawing pin has no such rule. There, the relative frequency after many throws is your best estimate of the probability.`,
          `Je öfter du würfelst, desto näher pendelt sich die relative Häufigkeit jeder Augenzahl bei $\\frac{1}{6} \\approx ${f.n(0.167)}$ ein: das **Gesetz der großen Zahlen**. Für eine Reißzwecke gibt es keine solche Regel. Dort ist die relative Häufigkeit nach vielen Würfen der beste Schätzwert für die Wahrscheinlichkeit.`,
        ),
      ),
      widget: ProbabilityDiceLab,
    },
    {
      type: "explain",
      title: tx("Laplace probability", "Die Laplace-Wahrscheinlichkeit"),
      blob: tx("If all outcomes are equally likely, counting is enough!", "Sind alle Ergebnisse gleich wahrscheinlich, reicht Zählen!"),
      body: tx(
        "A fair die, a fair coin, a well-shuffled deck: in a **Laplace experiment** every outcome has the same chance. Then the probability of an event $E$ is a simple fraction.",
        "Ein fairer Würfel, eine faire Münze, gut gemischte Karten: Bei einem **Laplace-Experiment** hat jedes Ergebnis dieselbe Chance. Dann ist die Wahrscheinlichkeit eines Ereignisses $E$ ein einfacher Bruch.",
      ),
      frames: laplace,
    },
    { type: "check", blob: tx("Three colours. But are they equally likely?", "Drei Farben. Aber sind die gleich wahrscheinlich?"), exercise: urnCheck },
    {
      type: "explain",
      title: tx("From impossible to certain", "Von unmöglich bis sicher"),
      blob: tx("Probabilities always live between 0 and 1.", "Wahrscheinlichkeiten wohnen immer zwischen 0 und 1."),
      body: tx(
        "An event that can never happen is **impossible**: $P = 0$. One that always happens is **certain**: $P = 1$. The scale shows some events of rolling a normal die.",
        "Ein Ereignis, das nie eintreten kann, ist **unmöglich**: $P = 0$. Eines, das immer eintritt, ist **sicher**: $P = 1$. Die Skala zeigt einige Ereignisse beim Würfeln mit einem normalen Würfel.",
      ),
      visual: visual(ProbabilityScale, {
        marks: [
          { p: 0, label: tx("a 7", "eine 7") },
          { p: 1 / 6, label: tx("a six", "eine Sechs"), frac: "1/6" },
          { p: 1 / 2, label: tx("even", "gerade"), frac: "1/2" },
          { p: 5 / 6, label: tx("no six", "keine Sechs"), frac: "5/6" },
          { p: 1, label: tx("1 to 6", "1 bis 6") },
        ],
      }),
      frames: zeroOne,
    },
    { type: "check", exercise: certainCheck },
    {
      type: "widget",
      title: tx("Build your own spinner", "Bau dein eigenes Glücksrad"),
      blob: tx("Colour the fields, then spin. Does the wheel keep its promise?", "Färbe die Felder ein und dreh. Hält das Rad, was die Rechnung verspricht?"),
      body: tx(
        "Tap a field to change its colour and choose how many fields the wheel has. Next to it you see each colour's probability as a fraction, a decimal and a percentage. Spin it many times and compare.",
        "Tippe auf ein Feld, um seine Farbe zu wechseln, und wähle, wie viele Felder das Rad hat. Daneben siehst du die Wahrscheinlichkeit jeder Farbe als Bruch, Dezimalzahl und in Prozent. Dreh oft und vergleiche.",
      ),
      widget: ProbabilitySpinnerLab,
    },
    { type: "check", blob: tx("Last one: in percent, please!", "Die letzte: bitte in Prozent!"), exercise: spinnerCheck },
  ],
  summary: [
    {
      title: tx("Chance experiment", "Zufallsexperiment"),
      body: tx(
        "The result can't be predicted. All possible outcomes form the sample space $S$. An event $E$ is a set of outcomes.",
        "Das Ergebnis lässt sich nicht vorhersagen. Alle möglichen Ergebnisse bilden die Ergebnismenge $S$. Ein Ereignis $E$ ist eine Menge von Ergebnissen.",
      ),
      examples: ["S = \\{ 1, 2, 3, 4, 5, 6 \\}", tx(`"even:" \\; E = \\{ 2, 4, 6 \\}`, `"gerade:" \\; E = \\{ 2, 4, 6 \\}`)],
      tone: "rule",
    },
    {
      title: tx("Relative frequency", "Relative Häufigkeit"),
      body: tx(
        "Absolute frequency $H$ divided by the number of trials $n$. After many trials it settles near the probability (law of large numbers).",
        "Absolute Häufigkeit $H$ geteilt durch die Anzahl der Versuche $n$. Nach vielen Versuchen pendelt sie sich bei der Wahrscheinlichkeit ein (Gesetz der großen Zahlen).",
      ),
      examples: ["h = \\frac{H}{n}", say((f) => `h = \\frac{9}{50} = ${f.n(0.18)} = \\group{18 \\, %}`)],
      tone: "rule",
    },
    {
      title: tx("Laplace rule", "Laplace-Regel"),
      body: tx("Only if all outcomes are equally likely (fair die, coin, urn, cards).", "Nur wenn alle Ergebnisse gleich wahrscheinlich sind (fairer Würfel, Münze, Urne, Karten)."),
      examples: [tx(`P(E) = \\frac{"favourable"}{"possible"}`, `P(E) = \\frac{"günstige"}{"mögliche"}`), tx(`P("even") = \\frac{3}{6} = \\frac{1}{2}`, `P("gerade") = \\frac{3}{6} = \\frac{1}{2}`)],
      tone: "rule",
    },
    {
      title: tx("Three ways to write it", "Drei Schreibweisen"),
      body: tx("Fraction, decimal or percentage. Impossible: $P = 0$. Certain: $P = 1$.", "Bruch, Dezimalzahl oder Prozent. Unmöglich: $P = 0$. Sicher: $P = 1$."),
      examples: [say((f) => `\\frac{1}{4} = ${f.n(0.25)} = \\group{25 \\, %}`), "0 \\le P(E) \\le 1"],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The bottom of the fraction is **all** outcomes, not just the unfavourable ones. And colours are not equally likely outcomes: count the balls.",
        "In den Nenner gehören **alle** Ergebnisse, nicht nur die ungünstigen. Und Farben sind keine gleich wahrscheinlichen Ergebnisse: Zähl die Kugeln.",
      ),
      examples: [tx(`"3 red, 7 green:" \\; P("red") = \\frac{3}{10} \\ne \\frac{3}{7}`, `"3 rote, 7 grüne:" \\; P("rot") = \\frac{3}{10} \\ne \\frac{3}{7}`)],
      tone: "warning",
    },
  ],
};
