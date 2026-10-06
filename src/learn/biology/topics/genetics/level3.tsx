"use client";

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { GeneticsChromosomeMap, GeneticsGeneMap } from "@/learn/biology/visuals/GeneticsGeneMap";
import { GeneticsPedigreeChart, GeneticsPedigreeLab } from "@/learn/biology/visuals/GeneticsPedigree";
import { GeneticsCountTable, GeneticsRfTable } from "@/learn/biology/visuals/GeneticsTables";
import { GeneticsXLinked } from "@/learn/biology/visuals/GeneticsXLinked";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { xCross, X_DISEASES, type XDisease } from "./data";
import { choice, fraction, frac, matchTask, mistakeList, multi, percent, weighted, type Opt } from "./kit";
import { canDescend, exclusion, generatePedigree, MODES, options, possibleGenotypes, possibleModes, type Mode, type Pedigree, type Person, type Sex } from "./pedigree";
import { genoOf, MODE_NAME, reasonText } from "./pedigree-text";

const E = (t: Text) => resolveText(t, "en");
const D = (t: Text) => resolveText(t, "de");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });
const pctText = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return tx(`${r}%`, `${String(r).replace(".", ",")} %`);
};

// ---------------------------------------------------------------------------
// 1. X-linked crosses: probabilities

type XAsk = "sonAffected" | "affectedSon" | "daughterCarrier" | "daughterAffected" | "childAffected";

const MOTHER_TEXT = (d: XDisease, md: number): Text =>
  md === 0
    ? tx("a homozygous healthy woman ($X^A X^A$)", `eine reinerbig ${D(d.healthy)}e Frau ($X^A X^A$)`)
    : md === 1
      ? tx("a woman who is a carrier ($X^A X^a$)", "eine Konduktorin ($X^A X^a$)")
      : tx("an affected woman ($X^a X^a$)", "eine betroffene Frau ($X^a X^a$)");
const FATHER_TEXT = (d: XDisease, fd: number): Text => (fd === 0 ? tx(`a ${d.id === "colour" ? "man with normal colour vision" : "healthy man"} ($X^A Y$)`, `ein ${D(d.healthy)}er Mann ($X^A Y$)`) : tx("an affected man ($X^a Y$)", "ein betroffener Mann ($X^a Y$)"));

const X_QUESTION: Record<XAsk, Text> = {
  sonAffected: tx("What is the probability that a **son** of this couple is affected?", "Mit welcher Wahrscheinlichkeit ist ein **Sohn** dieses Paares betroffen?"),
  affectedSon: tx("What is the probability that their next child is an **affected son**?", "Mit welcher Wahrscheinlichkeit ist ihr nächstes Kind ein **betroffener Sohn**?"),
  daughterCarrier: tx("What is the probability that a **daughter** is a carrier?", "Mit welcher Wahrscheinlichkeit ist eine **Tochter** Konduktorin?"),
  daughterAffected: tx("What is the probability that a **daughter** is affected?", "Mit welcher Wahrscheinlichkeit ist eine **Tochter** betroffen?"),
  childAffected: tx("What is the probability that a child (son or daughter) is affected?", "Mit welcher Wahrscheinlichkeit ist ein Kind (Sohn oder Tochter) betroffen?"),
};

function xCrossExercise(rng: Rng | null, d: XDisease, md: number, fd: number, ask: XAsk): Exercise {
  const r = xCross(md, fd);
  const v = r[ask] * 100;
  const answer = percent(v);
  const m = mistakeList(answer);
  if (ask === "sonAffected") m.add(percent(r.affectedSon * 100), tx("Among sons, not all children", "Unter den Söhnen, nicht allen Kindern"), tx("That's the share of affected sons among **all** children. The question is only about sons, so don't multiply by $\\frac{1}{2}$.", "Das ist der Anteil betroffener Söhne an **allen** Kindern. Gefragt ist nur nach Söhnen, also nicht noch mit $\\frac{1}{2}$ multiplizieren."));
  if (ask === "affectedSon") {
    m.add(percent(r.sonAffected * 100), tx("First it must be a son", "Erst muss es ein Sohn sein"), tx("That's the chance **among sons**. The next child must be a son ($\\frac{1}{2}$) **and** affected: multiply both.", "Das ist die Wahrscheinlichkeit **unter den Söhnen**. Das nächste Kind muss ein Sohn sein ($\\frac{1}{2}$) **und** betroffen: beides multiplizieren."));
    if (r.sonAffected + 0.5 <= 1 && r.sonAffected > 0) m.add(percent((r.sonAffected + 0.5) * 100), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("Son **and** affected: both must happen, so multiply the probabilities. Adding is for “either … or”.", "Sohn **und** betroffen: Beides muss eintreten, also Wahrscheinlichkeiten multiplizieren. Addieren gilt für „entweder … oder“."));
  }
  if ((ask === "sonAffected" || ask === "affectedSon") && fd === 1 && md !== 2) {
    const wrong = ask === "sonAffected" ? 100 : 50;
    m.add(percent(wrong), tx("Fathers give sons a Y", "Väter geben Söhnen ein Y"), tx("Ooh, classic trap! A son gets the **Y** from his father, never the X. The father's $X^a$ can't reach a son.", "Oh, die klassische Falle! Ein Sohn bekommt vom Vater das **Y**, nie das X. Das $X^a$ des Vaters kann keinen Sohn erreichen."));
    if (md === 0) m.add(percent(ask === "sonAffected" ? 50 : 25), tx("Fathers give sons a Y", "Väter geben Söhnen ein Y"), tx("Sons get their only X from the mother, and she has two healthy ones. The father's $X^a$ goes to daughters only.", "Söhne bekommen ihr einziges X von der Mutter, und die hat zwei gesunde. Das $X^a$ des Vaters geht nur an Töchter."));
  }
  if (ask === "daughterAffected") {
    if (fd === 0 && md >= 1) m.add(percent(md === 2 ? 100 : 50), tx("Daughters get a healthy X from dad", "Töchter bekommen ein gesundes X vom Vater"), tx("Every daughter also gets her father's $X^A$. With one healthy X she is at most a carrier, not affected.", "Jede Tochter bekommt auch das $X^A$ ihres Vaters. Mit einem gesunden X ist sie höchstens Konduktorin, nicht betroffen."));
    if (fd === 1 && md >= 1) m.add(percent(0), tx("Daughters can be affected", "Töchter können krank sein"), tx("A daughter is affected when she gets $X^a$ from **both** parents. Here the father passes his $X^a$ to every daughter.", "Eine Tochter ist betroffen, wenn sie von **beiden** Eltern $X^a$ bekommt. Hier gibt der Vater sein $X^a$ an jede Tochter weiter."));
  }
  if (ask === "daughterCarrier" && fd === 1 && md === 0) m.add(percent(50), tx("Every daughter gets dad's X", "Jede Tochter bekommt Papas X"), tx("A father passes his only X to **every** daughter. So all daughters get his $X^a$.", "Ein Vater gibt sein einziges X an **jede** Tochter weiter. Alle Töchter bekommen also sein $X^a$."));
  if (ask === "childAffected" && fd === 1 && md === 0) m.add(percent(50), tx("Carriers aren't affected", "Konduktorinnen sind nicht krank"), tx("The daughters get $X^a$ from their father, but with their mother's $X^A$ they are healthy carriers. The sons get his Y.", "Die Töchter bekommen $X^a$ vom Vater, mit dem $X^A$ der Mutter sind sie aber gesunde Konduktorinnen. Die Söhne bekommen sein Y."));
  if (ask === "childAffected") {
    if (r.sonAffected !== r.childAffected) m.add(percent(r.sonAffected * 100), tx("Only the sons counted", "Nur die Söhne gezählt"), tx("That's the chance for sons. Half of the children are daughters: average both.", "Das ist die Wahrscheinlichkeit für Söhne. Die Hälfte der Kinder sind Töchter: Bilde den Mittelwert aus beiden."));
    if (r.affectedSon !== r.childAffected) m.add(percent(r.affectedSon * 100), tx("Daughters count too", "Töchter zählen auch"), tx("That's the chance for an affected son. Affected daughters also count as affected children.", "Das ist die Wahrscheinlichkeit für einen betroffenen Sohn. Betroffene Töchter zählen auch als betroffene Kinder."));
  }
  const dSet = r.daughters.map((x) => (x === 2 ? "X^a X^a" : x === 1 ? "X^A X^a" : "X^A X^A"));
  const sSet = r.sons.map((x) => (x ? "X^a Y" : "X^A Y"));
  const frames: Frame[] = [
    { math: `${md === 0 ? "X^A X^A" : md === 1 ? "X^A X^a" : "X^a X^a"} \\times ${fd ? "X^a Y" : "X^A Y"}`, note: tx("Mother × father. The mother gives one of her two X, the father gives his X (to daughters) or his Y (to sons).", "Mutter × Vater. Die Mutter gibt eines ihrer beiden X, der Vater sein X (an Töchter) oder sein Y (an Söhne).") },
    { math: tx(`"daughters:" \\; ${dSet.join(" , ")}`, `"Töchter:" \\; ${dSet.join(" , ")}`), note: tx(`Daughters: affected ${E(pctText(r.daughterAffected * 100))}, carriers ${E(pctText(r.daughterCarrier * 100))}.`, `Töchter: betroffen ${D(pctText(r.daughterAffected * 100))}, Konduktorinnen ${D(pctText(r.daughterCarrier * 100))}.`) },
    { math: tx(`"sons:" \\; ${sSet.join(" , ")}`, `"Söhne:" \\; ${sSet.join(" , ")}`), note: tx(`Sons: affected ${E(pctText(r.sonAffected * 100))}.`, `Söhne: betroffen ${D(pctText(r.sonAffected * 100))}.`) },
  ];
  const last: Record<XAsk, Frame> = {
    sonAffected: { math: `P = ${v} "%"`, note: tx(`Among the sons: **${E(pctText(v))}**.`, `Unter den Söhnen: **${D(pctText(v))}**.`) },
    affectedSon: { math: `\\frac{1}{2} \\cdot ${r.sonAffected === 1 ? "1" : r.sonAffected === 0.5 ? "\\frac{1}{2}" : "0"} = ${v} "%"`, note: tx(`Son ($\\frac{1}{2}$) **and** affected: **${E(pctText(v))}** of all children.`, `Sohn ($\\frac{1}{2}$) **und** betroffen: **${D(pctText(v))}** aller Kinder.`) },
    daughterCarrier: { math: `P = ${v} "%"`, note: tx(`Among the daughters: **${E(pctText(v))}** carriers.`, `Unter den Töchtern: **${D(pctText(v))}** Konduktorinnen.`) },
    daughterAffected: { math: `P = ${v} "%"`, note: tx(`Among the daughters: **${E(pctText(v))}** affected.`, `Unter den Töchtern: **${D(pctText(v))}** betroffen.`) },
    childAffected: { math: `\\frac{${r.sonAffected * 100} "%" + ${r.daughterAffected * 100} "%"}{2} = ${v} "%"`, note: tx(`Half sons, half daughters: **${E(pctText(v))}** of all children are affected.`, `Halb Söhne, halb Töchter: **${D(pctText(v))}** aller Kinder sind betroffen.`) },
  };
  frames.push(last[ask]);
  return {
    instruction: tx("X-linked inheritance", "X-chromosomale Vererbung"),
    text: tx(
      `${cap(E(d.name))} is inherited X-linked recessively. ${cap(E(MOTHER_TEXT(d, md)))} and ${E(FATHER_TEXT(d, fd))} have children. ${E(X_QUESTION[ask])}`,
      `Die ${D(d.name)} wird X-chromosomal-rezessiv vererbt. ${cap(D(MOTHER_TEXT(d, md)))} und ${D(FATHER_TEXT(d, fd))} bekommen Kinder. ${D(X_QUESTION[ask])}`,
    ),
    answer,
    hint: tx("Draw the square with the mother's X chromosomes and the father's X and Y. Look at daughters and sons separately.", "Zeichne das Quadrat mit den X-Chromosomen der Mutter und X und Y des Vaters. Betrachte Töchter und Söhne getrennt."),
    solution: frames,
    mistakes: m.list,
  };
}

function xCrossTask(rng: Rng): Exercise {
  for (;;) {
    const md = rng.pick([1, 1, 1, 0, 0, 2]);
    const fd = rng.pick([0, 1]);
    if (md === 0 && fd === 0) continue;
    const ask = rng.pick<XAsk>(["sonAffected", "sonAffected", "affectedSon", "affectedSon", "daughterCarrier", "daughterAffected", "childAffected"]);
    return xCrossExercise(rng, rng.pick(X_DISEASES), md, fd, ask);
  }
}

// ---------------------------------------------------------------------------
// 2. X-linked: deduce a genotype

type XScene = { q: (d: XDisease) => Text; right: string; opts: string[]; why: (d: XDisease) => Text; wrong: Record<string, [Text, Text]> };

const XG: Record<string, Text> = {
  "X^A X^A": "$X^A X^A$",
  "X^A X^a": "$X^A X^a$",
  "X^a X^a": "$X^a X^a$",
  "X^A Y": "$X^A Y$",
  "X^a Y": "$X^a Y$",
  mother: tx("from his mother", "von seiner Mutter"),
  father: tx("from his father", "von seinem Vater"),
  both: tx("one from each parent", "je eins von beiden Eltern"),
  new: tx("it must be a new mutation", "es muss eine Neumutation sein"),
};

const X_SCENES: XScene[] = [
  {
    q: (d) => tx(`A healthy woman and a healthy man have a son with ${E(d.short)}. What is the woman's genotype?`, `Eine gesunde Frau und ein gesunder Mann haben einen Sohn mit ${D(d.short)}. Welchen Genotyp hat die Frau?`),
    right: "X^A X^a",
    opts: ["X^A X^A", "X^a X^a", "X^A Y"],
    why: () => tx("The son's only X comes from his mother. It carries $X^a$, and she is healthy: she is a carrier, $X^A X^a$.", "Das einzige X des Sohnes stammt von der Mutter. Es trägt $X^a$, und sie ist gesund: Sie ist Konduktorin, $X^A X^a$."),
    wrong: {
      "X^A X^A": [tx("The son's X comes from her", "Das X des Sohnes kommt von ihr"), tx("A son gets his X from his mother. If she had only $X^A$, he couldn't be affected.", "Ein Sohn bekommt sein X von der Mutter. Hätte sie nur $X^A$, könnte er nicht krank sein.")],
      "X^a X^a": [tx("She's healthy", "Sie ist gesund"), tx("With $X^a X^a$ she would be affected herself.", "Mit $X^a X^a$ wäre sie selbst krank.")],
      "X^A Y": [tx("That's a man's genotype", "Das ist der Genotyp eines Mannes"), tx("A woman has two X chromosomes.", "Eine Frau hat zwei X-Chromosomen.")],
    },
  },
  {
    q: (d) => tx(`A healthy woman's father has ${E(d.short)}. What is her genotype?`, `Der Vater einer gesunden Frau hat ${D(d.short)}. Welchen Genotyp hat sie?`),
    right: "X^A X^a",
    opts: ["X^A X^A", "X^a X^a", "X^a Y"],
    why: () => tx("A father passes his only X to every daughter: she got his $X^a$. Being healthy, she is $X^A X^a$, a carrier.", "Ein Vater gibt sein einziges X an jede Tochter weiter: Sie hat sein $X^a$. Da sie gesund ist, ist sie $X^A X^a$, Konduktorin."),
    wrong: {
      "X^A X^A": [tx("Dad's X always goes to daughters", "Papas X geht immer an Töchter"), tx("Her father has only one X, $X^a$, and every daughter gets it.", "Ihr Vater hat nur ein X, $X^a$, und jede Tochter bekommt es.")],
      "X^a X^a": [tx("She's healthy", "Sie ist gesund"), tx("With $X^a X^a$ she would be affected herself.", "Mit $X^a X^a$ wäre sie selbst krank.")],
      "X^a Y": [tx("That's her father", "Das ist ihr Vater"), tx("$X^a Y$ is the father's genotype. She has two X chromosomes.", "$X^a Y$ ist der Genotyp des Vaters. Sie hat zwei X-Chromosomen.")],
    },
  },
  {
    q: (d) => tx(`A woman has ${E(d.short)}. What is the genotype of her father?`, `Eine Frau hat ${D(d.short)}. Welchen Genotyp hat ihr Vater?`),
    right: "X^a Y",
    opts: ["X^A Y", "X^A X^a", "X^a X^a"],
    why: () => tx("She is $X^a X^a$: one $X^a$ comes from her father. A man with $X^a$ is affected: $X^a Y$.", "Sie ist $X^a X^a$: Ein $X^a$ stammt vom Vater. Ein Mann mit $X^a$ ist krank: $X^a Y$."),
    wrong: {
      "X^A Y": [tx("She needs X^a from both", "Sie braucht X^a von beiden"), tx("An affected woman is $X^a X^a$: one $X^a$ must come from her father.", "Eine kranke Frau ist $X^a X^a$: Ein $X^a$ muss vom Vater kommen.")],
      "X^A X^a": [tx("Fathers have one X", "Väter haben ein X"), tx("A man has one X and one Y.", "Ein Mann hat ein X und ein Y.")],
      "X^a X^a": [tx("Fathers have one X", "Väter haben ein X"), tx("A man has one X and one Y.", "Ein Mann hat ein X und ein Y.")],
    },
  },
  {
    q: (d) => tx(`A man has ${E(d.short)}, both his parents are healthy. From whom did he get the allele?`, `Ein Mann hat ${D(d.short)}, seine Eltern sind beide gesund. Von wem hat er das Allel?`),
    right: "mother",
    opts: ["father", "both", "new"],
    why: () => tx("A son's only X comes from his mother. His healthy mother is a carrier ($X^A X^a$).", "Das einzige X eines Sohnes stammt von der Mutter. Seine gesunde Mutter ist Konduktorin ($X^A X^a$)."),
    wrong: {
      father: [tx("Fathers give sons a Y", "Väter geben Söhnen ein Y"), tx("Ooh, classic trap! From his father a son gets the Y chromosome, never the X.", "Oh, die klassische Falle! Vom Vater bekommt ein Sohn das Y-Chromosom, nie das X.")],
      both: [tx("Men have one X", "Männer haben ein X"), tx("A man has only one X (hemizygous). One $X^a$ is enough, and it comes from the mother.", "Ein Mann hat nur ein X (hemizygot). Ein $X^a$ reicht, und das kommt von der Mutter.")],
      new: [tx("The simple explanation first", "Erst die einfache Erklärung"), tx("A healthy mother can carry the allele hidden. That's much more likely than a new mutation.", "Eine gesunde Mutter kann das Allel verborgen tragen. Das ist viel wahrscheinlicher als eine Neumutation.")],
    },
  },
  {
    q: (d) => tx(`A man with ${E(d.short)} and a homozygous healthy woman have a daughter. What is her genotype?`, `Ein Mann mit ${D(d.short)} und eine reinerbig gesunde Frau bekommen eine Tochter. Welchen Genotyp hat sie?`),
    right: "X^A X^a",
    opts: ["X^A X^A", "X^a X^a", "X^a Y"],
    why: () => tx("The daughter gets $X^a$ from her father (always) and $X^A$ from her mother: $X^A X^a$, a healthy carrier.", "Die Tochter bekommt $X^a$ vom Vater (immer) und $X^A$ von der Mutter: $X^A X^a$, eine gesunde Konduktorin."),
    wrong: {
      "X^A X^A": [tx("Dad's X always goes to daughters", "Papas X geht immer an Töchter"), tx("The father has only $X^a$ to give, and every daughter gets his X.", "Der Vater hat nur $X^a$ zu geben, und jede Tochter bekommt sein X.")],
      "X^a X^a": [tx("Mum only has X^A", "Mama hat nur X^A"), tx("The mother is homozygous healthy: she can only pass on $X^A$.", "Die Mutter ist reinerbig gesund: Sie kann nur $X^A$ weitergeben.")],
      "X^a Y": [tx("A daughter has two X", "Eine Tochter hat zwei X"), tx("$X^a Y$ would be a son.", "$X^a Y$ wäre ein Sohn.")],
    },
  },
];

function xGenoTask(rng: Rng): Exercise {
  const s = rng.pick(X_SCENES);
  const d = rng.pick(X_DISEASES);
  const c = choice(rng, [{ text: XG[s.right] }, ...s.opts.map((o) => ({ text: XG[o], title: s.wrong[o][0], say: s.wrong[o][1] }))]);
  return {
    instruction: tx("Deduce the genotype", "Erschließe den Genotyp"),
    text: tx(`${cap(E(d.name))} is inherited X-linked recessively ($X^a$). ${E(s.q(d))}`, `Die ${D(d.name)} wird X-chromosomal-rezessiv vererbt ($X^a$). ${D(s.q(d))}`),
    answer: c.answer,
    hint: tx("Sons get their X from the mother, daughters get one X from each parent.", "Söhne bekommen ihr X von der Mutter, Töchter je ein X von beiden Eltern."),
    solution: [{ math: s.right.startsWith("X") ? s.right : tx(`"${E(XG[s.right])}"`, `"${D(XG[s.right])}"`), note: s.why(d) }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// 3./4./5. Pedigree analysis with all four modes


function modesPedigree(rng: Rng) {
  const mode = rng.pick(MODES);
  const want = rng.chance(0.5) ? 1 : 2;
  const ped = generatePedigree(rng, mode, MODES, (p) => p.length === want || (want === 2 && p.length === 1), 9);
  return { ped, mode, possible: possibleModes(ped) };
}

function modesExercise(rng: Rng | null, ped: Pedigree, mode: Mode, possible: Mode[]): Exercise {
  const P = ped.people;
  const idx = (ms: Mode[]) => ms.map((m) => MODES.indexOf(m));
  const wrong: { pick: number[]; title: Text; say: Text }[] = [];
  const excluded = MODES.filter((m) => !possible.includes(m));
  for (const m of excluded) {
    const trio = exclusion(ped, m);
    if (trio) wrong.push({ pick: idx([...possible, m]), title: tx(`${cap(E(MODE_NAME[m]))} is ruled out`, `${cap(D(MODE_NAME[m]))} ist ausgeschlossen`), say: reasonText(ped, m, trio) });
  }
  if (possible.length > 1) wrong.push({ pick: idx([mode]), title: tx("More than one fits", "Mehr als einer passt"), say: tx("That one fits, but the question asks for every mode that **can't be ruled out**. Test each mode against every family.", "Der passt, aber gefragt sind alle Erbgänge, die sich **nicht ausschließen** lassen. Prüf jeden Erbgang an jeder Familie.") });
  const affWoman = P.findIndex((p) => p.sex === "f" && p.affected);
  if (possible.includes("XR") && possible.length > 1 && affWoman >= 0) wrong.push({ pick: idx(possible.filter((m) => m !== "XR")), title: tx("Women can be affected too", "Auch Frauen können krank sein"), say: tx(`Woman ${affWoman + 1} is affected. That doesn't rule out X-linked recessive inheritance: she just needs $X^a$ from both parents.`, `Frau ${affWoman + 1} ist krank. Das schließt X-chromosomal-rezessiv nicht aus: Sie braucht nur von beiden Eltern ein $X^a$.`) });
  const fs = P.findIndex((p) => p.sex === "m" && p.affected && p.father !== null && P[p.father].affected);
  if (possible.includes("XR") && possible.length > 1 && fs >= 0) wrong.push({ pick: idx(possible.filter((m) => m !== "XR")), title: tx("Father and son both affected", "Vater und Sohn beide krank"), say: tx(`Son ${fs + 1} didn't get his X from his father. But his mother can be a carrier, so X-linked recessive still works.`, `Sohn ${fs + 1} hat sein X nicht vom Vater. Aber seine Mutter kann Konduktorin sein, also bleibt X-chromosomal-rezessiv möglich.`) });
  const mm = multi(rng, MODES.map((m) => ({ text: MODE_NAME[m], ok: possible.includes(m) })), wrong);
  const notes: Frame[] = MODES.map((m) => {
    const trio = exclusion(ped, m);
    return trio
      ? { math: tx(`"${E(MODE_NAME[m])}" \\; \\red{"ruled out"}`, `"${D(MODE_NAME[m])}" \\; \\red{"ausgeschlossen"}`), note: reasonText(ped, m, trio) }
      : { math: tx(`"${E(MODE_NAME[m])}" \\; \\green{"possible"}`, `"${D(MODE_NAME[m])}" \\; \\green{"möglich"}`), note: tx("No family in the tree contradicts it.", "Keine Familie im Stammbaum widerspricht.") };
  });
  return {
    instruction: tx("Exclusion method", "Ausschlussverfahren"),
    text: tx("Which modes of inheritance are possible for this pedigree, i.e. cannot be ruled out? (filled = affected)", "Welche Erbgänge sind für diesen Stammbaum möglich, lassen sich also nicht ausschließen? (gefüllt = krank)"),
    visual: visual(GeneticsPedigreeChart, { ped }),
    answer: mm.answer,
    hint: tx("Test each mode: dominant fails on healthy × healthy → affected; recessive fails on affected × affected → healthy; X-recessive fails on affected mother → healthy son; X-dominant fails on affected father → healthy daughter.", "Prüf jeden Erbgang: dominant scheitert an gesund × gesund → krank; rezessiv an krank × krank → gesund; X-rezessiv an kranker Mutter → gesunder Sohn; X-dominant an krankem Vater → gesunde Tochter."),
    solution: notes,
    mistakes: mm.mistakes,
  };
}

function modesTask(rng: Rng) {
  const { ped, mode, possible } = modesPedigree(rng);
  return modesExercise(rng, ped, mode, possible);
}

/** A family of three described in words. */
function trioSentence(ped: Pedigree, f: number, m: number, c: number): Text {
  const P = ped.people;
  const st = (i: number, en: boolean) => (P[i].affected ? (en ? "affected" : "krank") : en ? "healthy" : "gesund");
  const son = P[c].sex === "m";
  return tx(`Father ${f + 1} is ${st(f, true)}, mother ${m + 1} is ${st(m, true)}, their ${son ? "son" : "daughter"} ${c + 1} is ${st(c, true)}.`, `Vater ${f + 1} ist ${st(f, false)}, Mutter ${m + 1} ist ${st(m, false)}, ${son ? "ihr Sohn" : "ihre Tochter"} ${c + 1} ist ${st(c, false)}.`);
}

/** Genotypes for a trio that fit the mode (first found), or null. */
function trioFit(ped: Pedigree, mode: Mode, f: number, m: number, c: number): [string, string, string] | null {
  const P = ped.people;
  for (const fd of options(mode, P[f])) for (const md of options(mode, P[m])) for (const cd of options(mode, P[c])) if (canDescend(mode, P[c].sex, cd, fd, md)) return [genoOf(mode, "m", fd), genoOf(mode, "f", md), genoOf(mode, P[c].sex, cd)];
  return null;
}

function exclusionTask(rng: Rng): Exercise {
  for (let attempt = 0; ; attempt++) {
    if (attempt > 100) return modesTask(rng);
    const { ped } = modesPedigree(rng);
    const excluded = MODES.filter((m) => exclusion(ped, m));
    if (!excluded.length) continue;
    const target = rng.pick(excluded);
    const trio = exclusion(ped, target)!;
    const P = ped.people;
    const right = trioSentence(ped, trio.father, trio.mother, trio.child);
    const opts: Opt[] = [{ text: right }];
    const trios = P.map((p, c) => ({ p, c })).filter(({ p }) => p.father !== null && p.mother !== null);
    for (const { p, c } of rng.shuffle(trios)) {
      if (opts.length >= 4) break;
      const fit = trioFit(ped, target, p.father!, p.mother!, c);
      if (!fit) continue;
      const interesting = p.affected || P[p.father!].affected || P[p.mother!].affected;
      if (!interesting) continue;
      const text = trioSentence(ped, p.father!, p.mother!, c);
      if (opts.some((o) => E(o.text) === E(text))) continue;
      opts.push({
        text,
        title: tx("This family fits", "Diese Familie passt"),
        say: tx(`This family is possible with ${E(MODE_NAME[target])} inheritance, e.g. $${fit[0]}$ × $${fit[1]}$ → $${fit[2]}$. Look for a family that can't be explained.`, `Diese Familie ist beim ${D(MODE_NAME[target])}en Erbgang möglich, z. B. $${fit[0]}$ × $${fit[1]}$ → $${fit[2]}$. Such eine Familie, die sich nicht erklären lässt.`),
      });
    }
    const affWoman = P.findIndex((p) => p.sex === "f" && p.affected);
    if (opts.length < 4 && target === "XR" && affWoman >= 0)
      opts.push({ text: tx(`Woman ${affWoman + 1} is affected.`, `Frau ${affWoman + 1} ist krank.`), title: tx("Women can be affected too", "Auch Frauen können krank sein"), say: tx("With X-linked recessive inheritance women can be affected ($X^a X^a$). It's just rarer.", "Auch beim X-chromosomal-rezessiven Erbgang können Frauen krank sein ($X^a X^a$). Es ist nur seltener.") });
    if (opts.length < 3 && attempt < 30) continue;
    const c = choice(rng, opts);
    return {
      instruction: tx("Find the evidence", "Finde den Beleg"),
      text: tx(`Which observation rules out **${E(MODE_NAME[target])}** inheritance for this pedigree?`, `Welche Beobachtung schließt für diesen Stammbaum einen **${D(MODE_NAME[target])}en** Erbgang aus?`),
      visual: visual(GeneticsPedigreeChart, { ped }),
      answer: c.answer,
      hint: tx("Write down the genotypes the mode would require for each person of a family. Where does it break?", "Schreib für jede Person einer Familie die Genotypen auf, die der Erbgang verlangen würde. Wo geht es nicht auf?"),
      solution: [{ math: tx(`"parents ${trio.father + 1}, ${trio.mother + 1}" \\to "child ${trio.child + 1}"`, `"Eltern ${trio.father + 1}, ${trio.mother + 1}" \\to "Kind ${trio.child + 1}"`), note: reasonText(ped, target, trio) }],
      mistakes: c.mistakes,
    };
  }
}

function carrierTask(rng: Rng): Exercise {
  for (let attempt = 0; ; attempt++) {
    if (attempt > 200) return xGenoTask(rng);
    const ped = generatePedigree(rng, "XR", ["XR"], (p) => p.length === 1, 9);
    const sets = possibleGenotypes(ped, "XR");
    const P = ped.people;
    const women = P.map((p, i) => ({ p, i })).filter(({ p }) => p.sex === "f" && !p.affected);
    const sure = women.filter(({ i }) => sets[i].length === 1 && sets[i][0] === 1);
    const notSure = women.filter(({ i }) => !(sets[i].length === 1 && sets[i][0] === 1));
    if (sure.length !== 1 || notSure.length < 2) {
      if (attempt < 60) continue;
    }
    if (!sure.length || !notSure.length) continue;
    const who = sure[0].i;
    const kids = P.map((q, i) => ({ q, i })).filter(({ q }) => q.mother === who && q.sex === "m" && q.affected);
    const dad = P[who].father !== null && P[P[who].father!].affected ? P[who].father! : null;
    const why = kids.length
      ? tx(`Woman ${who + 1} is healthy, but her son ${kids[0].i + 1} is affected. His $X^a$ can only come from her: she must be $X^A X^a$.`, `Frau ${who + 1} ist gesund, aber ihr Sohn ${kids[0].i + 1} ist krank. Sein $X^a$ kann nur von ihr stammen: Sie muss $X^A X^a$ sein.`)
      : dad !== null
        ? tx(`Woman ${who + 1} is healthy, but her father ${dad + 1} is affected and gave her his only X, $X^a$: she must be $X^A X^a$.`, `Frau ${who + 1} ist gesund, aber ihr Vater ${dad + 1} ist krank und hat ihr sein einziges X gegeben, $X^a$: Sie muss $X^A X^a$ sein.`)
        : tx(`Woman ${who + 1} must be $X^A X^a$: the tree only works if she carries $X^a$.`, `Frau ${who + 1} muss $X^A X^a$ sein: Der Stammbaum geht nur auf, wenn sie $X^a$ trägt.`);
    const opts: Opt[] = [{ text: tx(`woman ${who + 1}`, `Frau ${who + 1}`) }];
    for (const { i } of rng.shuffle(notSure).slice(0, 2)) {
      const sibAffected = P.some((q, j) => j !== i && q.affected && q.sex === "m" && q.mother !== null && q.mother === P[i].mother);
      opts.push({
        text: tx(`woman ${i + 1}`, `Frau ${i + 1}`),
        title: sibAffected ? tx("Only 50%", "Nur zu 50 %") : tx("Possible, not certain", "Möglich, nicht sicher"),
        say: sibAffected
          ? tx(`Woman ${i + 1} has an affected brother, so her mother is a carrier. But she got either $X^A$ or $X^a$ from her mother: carrier only with 50%.`, `Frau ${i + 1} hat einen kranken Bruder, ihre Mutter ist also Konduktorin. Sie selbst hat aber entweder $X^A$ oder $X^a$ von der Mutter: nur zu 50 % Konduktorin.`)
          : tx(`Nothing in the tree forces woman ${i + 1} to carry $X^a$. She may be $X^A X^A$.`, `Nichts im Stammbaum zwingt Frau ${i + 1}, $X^a$ zu tragen. Sie kann $X^A X^A$ sein.`),
      });
    }
    const healthyMan = P.findIndex((p) => p.sex === "m" && !p.affected);
    if (healthyMan >= 0 && rng.chance(0.6)) opts.push({ text: tx(`man ${healthyMan + 1}`, `Mann ${healthyMan + 1}`), title: tx("No male carriers", "Keine männlichen Überträger"), say: tx("A man has only one X: with $X^a$ he would be affected, with $X^A$ he is healthy. Men can't be hidden carriers.", "Ein Mann hat nur ein X: Mit $X^a$ wäre er krank, mit $X^A$ ist er gesund. Männer können keine verborgenen Überträger sein.") });
    const c = choice(rng, opts);
    return {
      instruction: tx("Find the carrier", "Finde die Konduktorin"),
      text: tx("The disease in this family is inherited X-linked recessively. Which person is **certainly** a carrier (Konduktorin)?", "Die Krankheit in dieser Familie wird X-chromosomal-rezessiv vererbt. Welche Person ist **sicher** Konduktorin?"),
      visual: visual(GeneticsPedigreeChart, { ped }),
      answer: c.answer,
      hint: tx("A healthy woman is certainly a carrier if she has an affected son or an affected father.", "Eine gesunde Frau ist sicher Konduktorin, wenn sie einen kranken Sohn oder einen kranken Vater hat."),
      solution: [{ math: tx(`"woman ${who + 1}:" \\; X^A X^a`, `"Frau ${who + 1}:" \\; X^A X^a`), note: why }],
      mistakes: c.mistakes,
    };
  }
}

// ---------------------------------------------------------------------------
// 6. Probabilities in pedigrees

const opp = (s: Sex): Sex => (s === "m" ? "f" : "m");

/** The family for probability tasks: I-1, I-2; II-3 (affected or relevant sibling), II-4 (the person asked about), II-5 (partner); III-6 (expected child). */
function probPed(rng: Rng | null, s3: Sex, s4: Sex, a: { sib: boolean; partnerAffected?: boolean; partnerCarrier?: boolean; p1Affected?: boolean; p4Unknown?: boolean }): Pedigree {
  const people: Person[] = [
    { sex: "m", affected: !!a.p1Affected, father: null, mother: null, gen: 0, x: 0.75 },
    { sex: "f", affected: false, father: null, mother: null, gen: 0, x: 1.75 },
    { sex: s3, affected: a.sib, father: 0, mother: 1, gen: 1, x: 0.5 },
    { sex: s4, affected: false, unknown: a.p4Unknown, father: 0, mother: 1, gen: 1, x: 2 },
    { sex: opp(s4), affected: !!a.partnerAffected, carrier: a.partnerCarrier, father: null, mother: null, gen: 1, x: 3 },
    { sex: rng?.chance(0.5) ? "m" : "f", affected: false, unknown: true, unborn: true, father: s4 === "m" ? 3 : 4, mother: s4 === "m" ? 4 : 3, gen: 2, x: 2.5 },
  ];
  return { people, couples: [[0, 1], [3, 4]], width: 3.6 };
}

type ProbVariant = "carrier" | "affected" | "population" | "sibling";

function arProbExercise(rng: Rng | null, variant: ProbVariant, s3: Sex, s4: Sex): Exercise {
  const ped = probPed(rng, s3, s4, { sib: true, partnerAffected: variant === "affected", partnerCarrier: variant === "carrier" });
  const pPartner = { carrier: [1, 1], affected: [1, 1], population: [1, 25], sibling: [2, 3] }[variant];
  // P(child aa) = 2/3 * P(partner gives a)
  const [n, d] = variant === "affected" ? [2 * 1, 3 * 2] : [2 * pPartner[0], 3 * pPartner[1] * 4];
  const right = fraction(n, d);
  const m = mistakeList(right);
  const f = (a: number, b: number) => fraction(a, b);
  const pa = variant === "affected" ? [1, 2] : [pPartner[0], pPartner[1] * 4];
  m.add(f(pa[0], pa[1]), tx("Carrier status not certain", "Überträger nicht sicher"), tx("You treated person 4 as a certain carrier. 4 is healthy, so $aa$ is ruled out, but $AA$ is still possible: carrier with $\\frac{2}{3}$.", "Du hast Person 4 als sicheren Überträger behandelt. 4 ist gesund, $aa$ fällt also weg, aber $AA$ ist möglich: Überträger mit $\\frac{2}{3}$."));
  m.add(f(pa[0], pa[1] * 2), tx("1/2 instead of 2/3", "1/2 statt 2/3"), tx("Ooh, nearly! Of the four cells of $Aa \\times Aa$ only three fit a **healthy** person ($AA$, $Aa$, $Aa$). Two of these three are carriers: $\\frac{2}{3}$, not $\\frac{1}{2}$.", "Oh, fast! Von den vier Feldern von $Aa \\times Aa$ passen nur drei zu einer **gesunden** Person ($AA$, $Aa$, $Aa$). Zwei davon sind Überträger: $\\frac{2}{3}$, nicht $\\frac{1}{2}$."));
  if (variant === "sibling") m.add(f(1, 4), tx("Both carriers forgotten", "Beide Überträger-Wahrscheinlichkeiten vergessen"), tx("$\\frac{1}{4}$ only holds if both are certain carriers. Each is a carrier only with $\\frac{2}{3}$: multiply that in, twice.", "$\\frac{1}{4}$ gilt nur, wenn beide sicher Überträger sind. Jeder ist es nur mit $\\frac{2}{3}$: Das musst du zweimal mit einrechnen."));
  if (variant !== "affected") m.add(f(2 * pPartner[0], 3 * pPartner[1]), tx("The last 1/4 is missing", "Das letzte 1/4 fehlt"), tx("Even if both parents are carriers, the child is only affected if it gets $a$ from both: multiply by $\\frac{1}{4}$.", "Selbst wenn beide Eltern Überträger sind, ist das Kind nur krank, wenn es von beiden $a$ bekommt: mal $\\frac{1}{4}$."));
  if (variant === "population") {
    const sum = 2 / 3 + 1 / 25 + 1 / 4;
    if (sum < 1) m.add({ kind: "fraction", n: 287, d: 300 }, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("All three must happen together (4 is a carrier **and** 5 is a carrier **and** the child gets $a$ twice): multiply the probabilities.", "Alle drei Ereignisse müssen zusammen eintreten (4 ist Überträger **und** 5 ist Überträger **und** das Kind bekommt zweimal $a$): Wahrscheinlichkeiten multiplizieren."));
  }
  const partnerText: Record<ProbVariant, Text> = {
    carrier: tx("Person 5 is a known carrier (genetic test, half-filled).", "Person 5 ist nachweislich Überträger(in) (Gentest, halb gefüllt)."),
    affected: tx("Person 5 has the disease too.", "Person 5 ist ebenfalls krank."),
    population: tx("Person 5 comes from an unaffected family; assume that 1 in 25 people is a carrier.", "Person 5 stammt aus einer nicht betroffenen Familie; nimm an, dass jeder 25. Mensch Überträger ist."),
    sibling: tx("Person 5 also has an affected sibling; 5's parents are healthy.", "Person 5 hat ebenfalls ein krankes Geschwister; die Eltern von 5 sind gesund."),
  };
  const p5 = { carrier: "1", affected: "1", population: "\\frac{1}{25}", sibling: "\\frac{2}{3}" }[variant];
  const last = variant === "affected" ? "\\frac{1}{2}" : "\\frac{1}{4}";
  const frames: Frame[] = [
    { math: tx('"4:" \\; AA , Aa , Aa \\Rightarrow \\frac{2}{3}', '"4:" \\; AA , Aa , Aa \\Rightarrow \\frac{2}{3}'), note: tx("Persons 1 and 2 are healthy but have an affected child: both are $Aa$. Person 4 is healthy: $AA$ or $Aa$ (twice as likely). Carrier with $\\frac{2}{3}$.", "Personen 1 und 2 sind gesund, haben aber ein krankes Kind: Beide sind $Aa$. Person 4 ist gesund: $AA$ oder $Aa$ (doppelt so wahrscheinlich). Überträger mit $\\frac{2}{3}$.") },
    {
      math: variant === "affected" ? '"5:" \\; aa' : tx(`"5 carrier:" \\; ${p5}`, `"5 Überträger:" \\; ${p5}`),
      note: { carrier: tx("Person 5 is certainly $Aa$.", "Person 5 ist sicher $Aa$."), affected: tx("Person 5 is $aa$ and always passes on $a$.", "Person 5 ist $aa$ und gibt immer $a$ weiter."), population: tx("Person 5 is a carrier with $\\frac{1}{25}$.", "Person 5 ist mit $\\frac{1}{25}$ Überträger."), sibling: tx("Person 5 is in the same situation as 4: carrier with $\\frac{2}{3}$.", "Person 5 ist in derselben Lage wie 4: Überträger mit $\\frac{2}{3}$.") }[variant],
    },
    {
      math: variant === "affected" ? `\\frac{2}{3} \\cdot \\frac{1}{2} = \\frac{${frac(n, d).n}}{${frac(n, d).d}}` : `\\frac{2}{3} \\cdot ${p5} \\cdot ${last} = \\frac{${frac(n, d).n}}{${frac(n, d).d}}`,
      note: variant === "affected" ? tx("The child is affected if 4 passes on $a$: $\\frac{2}{3}$ (carrier) $\\cdot \\frac{1}{2}$. **Product rule**: multiply.", "Das Kind ist krank, wenn 4 ein $a$ weitergibt: $\\frac{2}{3}$ (Überträger) $\\cdot \\frac{1}{2}$. **Produktregel**: multiplizieren.") : tx("Child $aa$: both must be carriers **and** both must pass on $a$ ($\\frac{1}{4}$). **Product rule**: multiply.", "Kind $aa$: Beide müssen Überträger sein **und** beide $a$ weitergeben ($\\frac{1}{4}$). **Produktregel**: multiplizieren."),
    },
  ];
  return {
    instruction: tx("Calculate the risk", "Berechne das Risiko"),
    text: tx(
      `Cystic fibrosis is inherited autosomal recessively. Person 4 is healthy; their sibling 3 is affected. ${E(partnerText[variant])} What is the probability that the expected child 6 of persons 4 and 5 will be affected? Give a fraction.`,
      `Mukoviszidose wird autosomal-rezessiv vererbt. Person 4 ist gesund, ihr Geschwister 3 ist krank. ${D(partnerText[variant])} Mit welcher Wahrscheinlichkeit wird das erwartete Kind 6 von Person 4 und 5 krank sein? Gib einen Bruch an.`,
    ),
    visual: visual(GeneticsPedigreeChart, { ped }),
    answer: right,
    hint: tx("Healthy sibling of an affected person: carrier with $\\frac{2}{3}$. Then multiply everything that must happen.", "Gesundes Geschwister eines Kranken: Überträger mit $\\frac{2}{3}$. Dann alles multiplizieren, was eintreten muss."),
    solution: frames,
    mistakes: m.list,
  };
}

type XProbAsk = "carrier" | "son" | "affectedSon";

function xrProbExercise(ask: XProbAsk, d: XDisease): Exercise {
  const ped = probPed(null, "m", "f", { sib: true });
  const value = { carrier: [1, 2], son: [1, 4], affectedSon: [1, 8] }[ask];
  const right = fraction(value[0], value[1]);
  const m = mistakeList(right);
  if (ask === "carrier") {
    m.add(fraction(2, 3), tx("2/3 is for autosomal", "2/3 gilt bei autosomal"), tx("The 2/3 rule is for autosomal recessive traits. Here mother 2 is a carrier ($X^A X^a$, affected son 3, healthy father 1), and daughter 4 gets $X^a$ from her with $\\frac{1}{2}$.", "Die 2/3-Regel gilt bei autosomal-rezessiv. Hier ist Mutter 2 Konduktorin ($X^A X^a$, kranker Sohn 3, gesunder Vater 1), und Tochter 4 bekommt von ihr mit $\\frac{1}{2}$ das $X^a$."));
    m.add(fraction(1, 1), tx("Not certain", "Nicht sicher"), tx("4 gets one of her mother's two X chromosomes: $X^A$ or $X^a$, each with $\\frac{1}{2}$.", "4 bekommt eines der beiden X-Chromosomen ihrer Mutter: $X^A$ oder $X^a$, je mit $\\frac{1}{2}$."));
  } else {
    m.add(fraction(ask === "son" ? 1 : 1, ask === "son" ? 2 : 4), tx("Is she a carrier at all?", "Ist sie überhaupt Konduktorin?"), tx("You treated woman 4 as a certain carrier. She is one only with $\\frac{1}{2}$: multiply that in.", "Du hast Frau 4 als sichere Konduktorin behandelt. Sie ist es nur mit $\\frac{1}{2}$: Rechne das mit ein."));
    if (ask === "affectedSon") m.add(fraction(1, 4), tx("Among sons vs all children", "Unter Söhnen oder allen Kindern"), tx("That's the risk for a **son**. The next **child** must also be a son ($\\frac{1}{2}$): one more factor.", "Das ist das Risiko für einen **Sohn**. Das nächste **Kind** muss außerdem ein Sohn sein ($\\frac{1}{2}$): ein Faktor mehr."));
    if (ask === "son") m.add(fraction(1, 8), tx("Only sons count here", "Hier zählen nur Söhne"), tx("The question is about a son, so the $\\frac{1}{2}$ for “it's a boy” doesn't belong in it.", "Gefragt ist nach einem Sohn, also gehört das $\\frac{1}{2}$ für „es ist ein Junge“ nicht dazu."));
  }
  const q: Record<XProbAsk, Text> = {
    carrier: tx("What is the probability that woman 4 is a carrier?", "Mit welcher Wahrscheinlichkeit ist Frau 4 Konduktorin?"),
    son: tx("What is the probability that a son of persons 4 and 5 is affected?", "Mit welcher Wahrscheinlichkeit ist ein Sohn von Person 4 und 5 krank?"),
    affectedSon: tx("What is the probability that the expected child 6 is an affected son?", "Mit welcher Wahrscheinlichkeit ist das erwartete Kind 6 ein kranker Sohn?"),
  };
  const frames: Frame[] = [
    { math: '"2:" \\; X^A X^a', note: tx("Son 3 is affected, father 1 is healthy: son 3's $X^a$ comes from mother 2, who is a carrier.", "Sohn 3 ist krank, Vater 1 gesund: Das $X^a$ von Sohn 3 stammt von Mutter 2, sie ist Konduktorin.") },
    { math: '"4:" \\; X^A X^a \\; "?" \\Rightarrow \\frac{1}{2}', note: tx("Daughter 4 gets $X^A$ from her father and one of her mother's X: carrier with $\\frac{1}{2}$.", "Tochter 4 bekommt $X^A$ vom Vater und eins der X der Mutter: Konduktorin mit $\\frac{1}{2}$.") },
  ];
  if (ask !== "carrier") frames.push({ math: ask === "son" ? "\\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}" : "\\frac{1}{2} \\cdot \\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{8}", note: ask === "son" ? tx("A son is affected if 4 is a carrier ($\\frac{1}{2}$) **and** passes on $X^a$ ($\\frac{1}{2}$).", "Ein Sohn ist krank, wenn 4 Konduktorin ist ($\\frac{1}{2}$) **und** $X^a$ weitergibt ($\\frac{1}{2}$).") : tx("Carrier ($\\frac{1}{2}$) **and** passes on $X^a$ ($\\frac{1}{2}$) **and** the child is a boy ($\\frac{1}{2}$).", "Konduktorin ($\\frac{1}{2}$) **und** gibt $X^a$ weiter ($\\frac{1}{2}$) **und** das Kind ist ein Junge ($\\frac{1}{2}$).") });
  return {
    instruction: tx("Calculate the risk", "Berechne das Risiko"),
    text: tx(`${cap(E(d.name))} is inherited X-linked recessively. In this family son 3 is affected, everyone else is healthy. Woman 4 and her healthy partner 5 are expecting a child. ${E(q[ask])} Give a fraction.`, `Die ${D(d.name)} wird X-chromosomal-rezessiv vererbt. In dieser Familie ist Sohn 3 krank, alle anderen sind gesund. Frau 4 und ihr gesunder Partner 5 erwarten ein Kind. ${D(q[ask])} Gib einen Bruch an.`),
    visual: visual(GeneticsPedigreeChart, { ped }),
    answer: right,
    hint: tx("First: is mother 2 certainly a carrier? Then: is woman 4?", "Zuerst: Ist Mutter 2 sicher Konduktorin? Dann: Ist es Frau 4?"),
    solution: frames,
    mistakes: m.list,
  };
}

type AdAsk = "carrier" | "child";

function adProbExercise(ask: AdAsk, s3: Sex, s4: Sex): Exercise {
  const ped = probPed(null, s3, s4, { sib: true, p1Affected: true, p4Unknown: true });
  const right = ask === "carrier" ? fraction(1, 2) : fraction(1, 4);
  const m = mistakeList(right);
  if (ask === "child") {
    m.add(fraction(1, 2), tx("Does 4 even carry it?", "Trägt 4 es überhaupt?"), tx("$\\frac{1}{2}$ would be right if person 4 certainly had the allele. But 4 only got it with $\\frac{1}{2}$: multiply.", "$\\frac{1}{2}$ stimmt, wenn Person 4 das Allel sicher hätte. 4 hat es aber nur mit $\\frac{1}{2}$ geerbt: multiplizieren."));
    m.add(fraction(3, 4), tx("3 : 1 doesn't fit here", "3 : 1 passt hier nicht"), tx("3/4 belongs to $Aa \\times Aa$. Here only one parent can carry $A$.", "3/4 gehört zu $Aa \\times Aa$. Hier kann nur ein Elternteil $A$ tragen."));
  } else {
    m.add(fraction(3, 4), tx("3 : 1 doesn't fit here", "3 : 1 passt hier nicht"), tx("Only parent 1 has the allele ($Aa$), parent 2 is $aa$: $Aa \\times aa$ gives 1 : 1.", "Nur Elternteil 1 hat das Allel ($Aa$), Elternteil 2 ist $aa$: $Aa \\times aa$ ergibt 1 : 1."));
    m.add(fraction(2, 3), tx("2/3 is for healthy siblings", "2/3 gilt für gesunde Geschwister"), tx("2/3 is the carrier rule for a **healthy** sibling with recessive inheritance. Here: $Aa \\times aa$, so $\\frac{1}{2}$.", "2/3 ist die Überträger-Regel für ein **gesundes** Geschwister bei rezessivem Erbgang. Hier gilt: $Aa \\times aa$, also $\\frac{1}{2}$."));
  }
  return {
    instruction: tx("Calculate the risk", "Berechne das Risiko"),
    text: tx(
      `Huntington's disease is inherited autosomal dominantly and only breaks out in middle age. Parent 1 is affected (heterozygous $Aa$), parent 2 is healthy. Person 4 is still young, its status is unknown (?). ${ask === "carrier" ? "What is the probability that person 4 carries the disease allele?" : "What is the probability that the expected child 6 of persons 4 and 5 (healthy) carries the allele?"} Give a fraction.`,
      `Chorea Huntington wird autosomal-dominant vererbt und bricht erst im mittleren Alter aus. Elternteil 1 ist krank (mischerbig $Aa$), Elternteil 2 gesund. Person 4 ist noch jung, ihr Status ist unbekannt (?). ${ask === "carrier" ? "Mit welcher Wahrscheinlichkeit trägt Person 4 das Krankheitsallel?" : "Mit welcher Wahrscheinlichkeit trägt das erwartete Kind 6 von Person 4 und 5 (gesund) das Allel?"} Gib einen Bruch an.`,
    ),
    visual: visual(GeneticsPedigreeChart, { ped }),
    answer: right,
    hint: tx("$Aa \\times aa$: each child gets $A$ with $\\frac{1}{2}$.", "$Aa \\times aa$: Jedes Kind bekommt $A$ mit $\\frac{1}{2}$."),
    solution: [
      { math: "Aa \\times aa \\to \\frac{1}{2} Aa", note: tx("Parent 1 ($Aa$) × parent 2 ($aa$): each child gets $A$ with $\\frac{1}{2}$.", "Elternteil 1 ($Aa$) × Elternteil 2 ($aa$): Jedes Kind bekommt $A$ mit $\\frac{1}{2}$.") },
      ...(ask === "child" ? [{ math: "\\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}", note: tx("Person 4 carries $A$ ($\\frac{1}{2}$) **and** passes it on ($\\frac{1}{2}$): product rule.", "Person 4 trägt $A$ ($\\frac{1}{2}$) **und** gibt es weiter ($\\frac{1}{2}$): Produktregel.") }] : []),
    ],
    mistakes: m.list,
  };
}

type TwoAsk = "both" | "firstOnly" | "atLeastOne" | "none";

function twoChildrenExercise(ask: TwoAsk): Exercise {
  const v: Record<TwoAsk, [number, number]> = { both: [1, 16], firstOnly: [3, 16], atLeastOne: [7, 16], none: [9, 16] };
  const right = fraction(...v[ask]);
  const m = mistakeList(right);
  if (ask === "both") {
    m.add(fraction(1, 2), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("Child 1 affected **and** child 2 affected: multiply, $\\frac{1}{4} \\cdot \\frac{1}{4}$.", "Kind 1 krank **und** Kind 2 krank: multiplizieren, $\\frac{1}{4} \\cdot \\frac{1}{4}$."));
    m.add(fraction(1, 4), tx("Two children, two factors", "Zwei Kinder, zwei Faktoren"), tx("$\\frac{1}{4}$ is the risk for one child. For two children both must be affected: multiply.", "$\\frac{1}{4}$ ist das Risiko für ein Kind. Bei zwei Kindern müssen beide krank sein: multiplizieren."));
  }
  if (ask === "firstOnly") {
    m.add(fraction(1, 16), tx("The second one is healthy", "Das zweite ist gesund"), tx("The second child must be **healthy**: that's $\\frac{3}{4}$, not $\\frac{1}{4}$.", "Das zweite Kind soll **gesund** sein: Das sind $\\frac{3}{4}$, nicht $\\frac{1}{4}$."));
    m.add(fraction(3, 8), tx("Order matters here", "Die Reihenfolge zählt hier"), tx("The question fixes the order: the **first** child affected, the **second** healthy. Only one way.", "Die Frage legt die Reihenfolge fest: das **erste** Kind krank, das **zweite** gesund. Nur ein Weg."));
  }
  if (ask === "atLeastOne") {
    m.add(fraction(1, 2), tx("Added: counted twice", "Addiert: doppelt gezählt"), tx("$\\frac{1}{4} + \\frac{1}{4}$ counts “both affected” twice. Easier: $1 - P(\\text{none affected}) = 1 - \\frac{3}{4} \\cdot \\frac{3}{4}$.", "$\\frac{1}{4} + \\frac{1}{4}$ zählt „beide krank“ doppelt. Einfacher: $1 - P(\\text{keins krank}) = 1 - \\frac{3}{4} \\cdot \\frac{3}{4}$."));
    m.add(fraction(1, 16), tx("At least one, not both", "Mindestens eins, nicht beide"), tx("$\\frac{1}{16}$ is the chance that **both** are affected. At least one includes “only the first” and “only the second” too.", "$\\frac{1}{16}$ ist die Wahrscheinlichkeit, dass **beide** krank sind. Mindestens eins umfasst auch „nur das erste“ und „nur das zweite“."));
  }
  if (ask === "none") {
    m.add(fraction(3, 4), tx("Two children, two factors", "Zwei Kinder, zwei Faktoren"), tx("$\\frac{3}{4}$ is for one child. Both children must be healthy: multiply.", "$\\frac{3}{4}$ gilt für ein Kind. Beide Kinder müssen gesund sein: multiplizieren."));
  }
  const q: Record<TwoAsk, Text> = {
    both: tx("What is the probability that **both** children are affected?", "Mit welcher Wahrscheinlichkeit sind **beide** Kinder krank?"),
    firstOnly: tx("What is the probability that the **first** child is affected and the **second** is healthy?", "Mit welcher Wahrscheinlichkeit ist das **erste** Kind krank und das **zweite** gesund?"),
    atLeastOne: tx("What is the probability that **at least one** of the two children is affected?", "Mit welcher Wahrscheinlichkeit ist **mindestens eins** der beiden Kinder krank?"),
    none: tx("What is the probability that **neither** child is affected?", "Mit welcher Wahrscheinlichkeit ist **keins** der beiden Kinder krank?"),
  };
  const sol: Record<TwoAsk, string> = {
    both: "\\frac{1}{4} \\cdot \\frac{1}{4} = \\frac{1}{16}",
    firstOnly: "\\frac{1}{4} \\cdot \\frac{3}{4} = \\frac{3}{16}",
    atLeastOne: "1 - \\frac{3}{4} \\cdot \\frac{3}{4} = \\frac{7}{16}",
    none: "\\frac{3}{4} \\cdot \\frac{3}{4} = \\frac{9}{16}",
  };
  return {
    instruction: tx("Product rule", "Produktregel"),
    text: tx(`Both parents are healthy carriers of cystic fibrosis ($Aa \\times Aa$). They plan two children. ${E(q[ask])} Give a fraction.`, `Beide Eltern sind gesunde Überträger der Mukoviszidose ($Aa \\times Aa$). Sie planen zwei Kinder. ${D(q[ask])} Gib einen Bruch an.`),
    answer: right,
    hint: tx("Each child: affected $\\frac{1}{4}$, healthy $\\frac{3}{4}$. Births are independent: multiply.", "Jedes Kind: krank $\\frac{1}{4}$, gesund $\\frac{3}{4}$. Geburten sind unabhängig: multiplizieren."),
    solution: [
      { math: tx('"affected:" \\; \\frac{1}{4} \\quad "healthy:" \\; \\frac{3}{4}', '"krank:" \\; \\frac{1}{4} \\quad "gesund:" \\; \\frac{3}{4}'), note: tx("For each child anew, independent of the siblings.", "Für jedes Kind neu, unabhängig von den Geschwistern.") },
      { math: sol[ask], note: tx("Events that must **all** happen: multiply (product rule).", "Ereignisse, die **alle** eintreten müssen: multiplizieren (Produktregel).") },
    ],
    mistakes: m.list,
  };
}

function probTask(rng: Rng): Exercise {
  return weighted(rng, [
    [3, () => arProbExercise(rng, rng.pick<ProbVariant>(["carrier", "affected", "population", "sibling", "sibling"]), rng.chance(0.5) ? "m" : "f", rng.chance(0.5) ? "m" : "f")],
    [2, () => xrProbExercise(rng.pick<XProbAsk>(["carrier", "son", "affectedSon"]), rng.pick(X_DISEASES))],
    [1.2, () => adProbExercise(rng.pick<AdAsk>(["carrier", "child", "child"]), rng.chance(0.5) ? "m" : "f", rng.chance(0.5) ? "m" : "f")],
    [1.5, () => twoChildrenExercise(rng.pick<TwoAsk>(["both", "firstOnly", "atLeastOne", "none"]))],
  ]);
}

// ---------------------------------------------------------------------------
// 7./8. Recombination frequency

type TestCrossData = { rows: { geno: string; pheno?: Text; n: number }[]; rec: number; total: number; rf: number; genes: [string, string] };

function campbellData(): TestCrossData {
  const rows = [
    { geno: "b⁺b vg⁺vg", pheno: tx("grey body, normal wings", "grauer Körper, normale Flügel"), n: 965 },
    { geno: "bb vgvg", pheno: tx("black body, vestigial wings", "schwarzer Körper, Stummelflügel"), n: 944 },
    { geno: "b⁺b vgvg", pheno: tx("grey body, vestigial wings", "grauer Körper, Stummelflügel"), n: 206 },
    { geno: "bb vg⁺vg", pheno: tx("black body, normal wings", "schwarzer Körper, normale Flügel"), n: 185 },
  ];
  return { rows, rec: 391, total: 2300, rf: 17, genes: ["b", "vg"] };
}

function generatedData(rng: Rng): TestCrossData {
  const rf = rng.int(4, 38);
  const total = rng.int(8, 30) * 50;
  const rec = Math.round((total * rf) / 100) + rng.int(-3, 3);
  const r1 = Math.round(rec / 2) + rng.int(-6, 6);
  const p1 = Math.round((total - rec) / 2) + rng.int(-12, 12);
  const rows = [
    { geno: "AaBb", n: p1 },
    { geno: "aabb", n: total - rec - p1 },
    { geno: "Aabb", n: r1 },
    { geno: "aaBb", n: rec - r1 },
  ];
  return { rows: rng.chance(0.5) ? rows : [rows[0], rows[2], rows[1], rows[3]], rec, total, rf: Math.round((rec / total) * 1000) / 10, genes: ["A", "B"] };
}

function rfExercise(data: TestCrossData): Exercise {
  const v = Math.round((data.rec / data.total) * 1000) / 10;
  const answer: AnswerSpec = { kind: "number", value: v, tolerance: 0.11 / v, unit: "%" };
  const m = mistakeList(answer);
  const recRows = data.rows.filter((r) => r.n < data.total / 4);
  m.add({ kind: "number", value: Math.round(((data.total - data.rec) / data.total) * 1000) / 10, tolerance: 0.005, unit: "%" }, tx("Those are the parental types", "Das sind die Elterntypen"), tx("You calculated the share of the **large** classes: the parental combinations. Recombinants are the rare new combinations.", "Du hast den Anteil der **großen** Gruppen berechnet: die elterlichen Kombinationen. Rekombinanten sind die seltenen Neukombinationen."));
  m.add({ kind: "number", value: Math.round((recRows[0].n / data.total) * 1000) / 10, tolerance: 0.005, unit: "%" }, tx("Both recombinant classes", "Beide Rekombinanten-Gruppen"), tx("A crossing-over produces **two** new combinations. Add both small classes.", "Ein Crossing-over erzeugt **zwei** neue Kombinationen. Addiere beide kleinen Gruppen."));
  m.add({ kind: "number", value: Math.round((data.rec / (data.total - data.rec)) * 1000) / 10, tolerance: 0.005, unit: "%" }, tx("Divide by all offspring", "Durch alle Nachkommen teilen"), tx("You divided by the parental types only. The recombination frequency refers to **all** offspring.", "Du hast nur durch die Elterntypen geteilt. Die Rekombinationshäufigkeit bezieht sich auf **alle** Nachkommen."));
  return {
    instruction: tx("Calculate the recombination frequency", "Berechne die Rekombinationshäufigkeit"),
    text: data.genes[0] === "b"
      ? tx("Morgan-style experiment with Drosophila: a fly heterozygous for body colour ($b^+$ grey, $b$ black) and wing shape ($vg^+$ normal, $vg$ vestigial) is test-crossed with a black fly with vestigial wings. Calculate the recombination frequency between $b$ and $vg$ (one decimal place).", "Versuch nach Morgan mit Drosophila: Eine für Körperfarbe ($b^+$ grau, $b$ schwarz) und Flügelform ($vg^+$ normal, $vg$ Stummelflügel) mischerbige Fliege wird mit einer schwarzen Fliege mit Stummelflügeln rückgekreuzt. Berechne die Rekombinationshäufigkeit zwischen $b$ und $vg$ (eine Nachkommastelle).")
      : tx("A plant with $A$ and $B$ on one chromosome and $a$ and $b$ on the homologous one ($AB/ab$) is test-crossed with $aabb$. Calculate the recombination frequency between the genes (one decimal place).", "Eine Pflanze mit $A$ und $B$ auf einem Chromosom und $a$ und $b$ auf dem homologen ($AB/ab$) wird mit $aabb$ rückgekreuzt. Berechne die Rekombinationshäufigkeit zwischen den Genen (eine Nachkommastelle)."),
    visual: visual(GeneticsCountTable, { rows: data.rows, title: tx("Offspring of the test cross", "Nachkommen der Rückkreuzung") }),
    answer,
    hint: tx("The two small classes are the recombinants. RF = recombinants / all offspring · 100%.", "Die beiden kleinen Gruppen sind die Rekombinanten. RH = Rekombinanten / alle Nachkommen · 100 %."),
    solution: [
      { math: `${recRows[0].n} + ${recRows[1].n} = ${data.rec}`, note: tx("The two rare classes carry new combinations: they are the **recombinants**.", "Die beiden seltenen Gruppen tragen Neukombinationen: Das sind die **Rekombinanten**.") },
      { math: tx(`\\frac{${data.rec}}{${data.total}} \\cdot 100 "%" \\approx ${v} "%"`, `\\frac{${data.rec}}{${data.total}} \\cdot 100 "%" \\approx ${String(v).replace(".", ",")} "%"`), note: tx(`Recombination frequency about **${v}%**: the genes are about ${Math.round(v)} cM apart.`, `Rekombinationshäufigkeit etwa **${String(v).replace(".", ",")} %**: Die Gene liegen etwa ${Math.round(v)} cM auseinander.`) },
    ],
    mistakes: m.list,
  };
}

function rfTask(rng: Rng) {
  return rfExercise(rng.chance(0.2) ? campbellData() : generatedData(rng));
}

function expectedRecTask(rng: Rng): Exercise {
  const d = rng.int(2, 20) * 2;
  const n = rng.pick([200, 400, 500, 600, 800, 1000, 1200]);
  const one = rng.chance(0.55);
  const value = one ? (n * d) / 200 : (n * d) / 100;
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakeList(answer);
  if (one) m.add({ kind: "number", value: (n * d) / 100 }, tx("Two recombinant classes", "Zwei Rekombinanten-Gruppen"), tx(`${d}% recombinants are split between $Ab$ and $aB$: each class gets half.`, `Die ${d} % Rekombinanten verteilen sich auf $Ab$ und $aB$: Jede Gruppe bekommt die Hälfte.`));
  else m.add({ kind: "number", value: (n * d) / 200 }, tx("Both classes count", "Beide Gruppen zählen"), tx("Recombinants are $Ab$ **and** $aB$. Together they make up the full recombination frequency.", "Rekombinanten sind $Ab$ **und** $aB$. Zusammen ergeben sie die ganze Rekombinationshäufigkeit."));
  m.add({ kind: "number", value: (n * (100 - d)) / (one ? 200 : 100) }, tx("Those are the parental types", "Das sind die Elterntypen"), tx("You calculated the parental combinations $AB$ and $ab$. The recombinants are the rare ones.", "Du hast die elterlichen Kombinationen $AB$ und $ab$ berechnet. Die Rekombinanten sind die seltenen."));
  return {
    instruction: tx("Expected recombinants", "Erwartete Rekombinanten"),
    text: tx(
      `Genes $A$ and $B$ lie ${d} cM apart on the same chromosome. A fly $AB/ab$ is test-crossed with $ab/ab$; there are ${n} offspring. How many offspring do you expect ${one ? "with the combination $Ab$" : "with a recombinant combination in total"}?`,
      `Die Gene $A$ und $B$ liegen ${d} cM voneinander entfernt auf demselben Chromosom. Eine Fliege $AB/ab$ wird mit $ab/ab$ rückgekreuzt; es gibt ${n} Nachkommen. Wie viele Nachkommen erwartest du ${one ? "mit der Kombination $Ab$" : "insgesamt mit einer rekombinanten Kombination"}?`,
    ),
    answer,
    hint: tx(`${d} cM means ${d}% recombinants.`, `${d} cM heißt ${d} % Rekombinanten.`),
    solution: [
      { math: tx(`${d} \\text{cM} \\to ${d} "%"`, `${d} \\text{cM} \\to ${d} "%"`), note: tx(`1 cM = 1% recombination: ${d}% of the offspring are recombinant.`, `1 cM = 1 % Rekombination: ${d} % der Nachkommen sind rekombinant.`) },
      { math: tx(one ? `${n} \\cdot ${d / 100} : 2 = ${value}` : `${n} \\cdot ${d / 100} = ${value}`, one ? `${n} \\cdot ${String(d / 100).replace(".", ",")} : 2 = ${value}` : `${n} \\cdot ${String(d / 100).replace(".", ",")} = ${value}`), note: one ? tx(`${(n * d) / 100} recombinants, half of them $Ab$: **${value}**.`, `${(n * d) / 100} Rekombinanten, die Hälfte davon $Ab$: **${value}**.`) : tx(`**${value}** recombinant offspring ($Ab$ and $aB$ together).`, `**${value}** rekombinante Nachkommen ($Ab$ und $aB$ zusammen).`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 9./10. Gene maps

function threeGenes(rng: Rng) {
  const letters = rng.shuffle(["A", "B", "C", "D", "E", "F"]).slice(0, 3).sort();
  const order = rng.shuffle(letters);
  const d1 = rng.int(3, 18);
  const d2 = rng.int(3, 18);
  return { order, d1, d2 };
}

function middleTask(rng: Rng): Exercise {
  const { order, d1, d2 } = threeGenes(rng);
  const [a, b, c] = order;
  const mk = (x: string, y: string, v: number): [string, string, number] => {
    const [p, q] = [x, y].sort();
    return [p, q, v];
  };
  const pairs = [mk(a, b, d1), mk(b, c, d2), mk(a, c, d1 + d2)];
  pairs.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1]));
  const [la, lb] = [a, c].sort();
  const opts: Opt[] = [
    { text: tx(`gene ${b}`, `Gen ${b}`) },
    { text: tx(`gene ${a}`, `Gen ${a}`), title: tx("The largest value is the outside", "Der größte Wert liegt außen"), say: tx(`${la} and ${lb} have the **largest** recombination frequency (${d1 + d2}%): they are the two outer genes. The middle gene has the smaller distances to both.`, `${la} und ${lb} haben die **größte** Rekombinationshäufigkeit (${d1 + d2} %): Sie sind die beiden äußeren Gene. Das mittlere Gen hat zu beiden die kleineren Abstände.`) },
    { text: tx(`gene ${c}`, `Gen ${c}`), title: tx("The largest value is the outside", "Der größte Wert liegt außen"), say: tx(`${la} and ${lb} have the **largest** recombination frequency (${d1 + d2}%): they are the two outer genes. The middle gene has the smaller distances to both.`, `${la} und ${lb} haben die **größte** Rekombinationshäufigkeit (${d1 + d2} %): Sie sind die beiden äußeren Gene. Das mittlere Gen hat zu beiden die kleineren Abstände.`) },
    { text: tx("can't be determined from this", "lässt sich daraus nicht bestimmen"), title: tx("It can", "Doch, das geht"), say: tx("Distances add up along the chromosome: the two smaller values together give the largest one.", "Abstände addieren sich entlang des Chromosoms: Die beiden kleineren Werte ergeben zusammen den größten.") },
  ];
  const c2 = choice(rng, opts);
  return {
    instruction: tx("Build the gene map", "Erstelle die Genkarte"),
    text: tx("Three linked genes, recombination frequencies from test crosses (see table). Which gene lies between the other two?", "Drei gekoppelte Gene, Rekombinationshäufigkeiten aus Testkreuzungen (siehe Tabelle). Welches Gen liegt zwischen den beiden anderen?"),
    visual: visual(GeneticsRfTable, { pairs }),
    answer: c2.answer,
    hint: tx("The pair with the largest recombination frequency is farthest apart.", "Das Paar mit der größten Rekombinationshäufigkeit liegt am weitesten auseinander."),
    solution: [
      { math: `${d1} + ${d2} = ${d1 + d2}`, note: tx(`$${a}$–$${b}$ plus $${b}$–$${c}$ gives exactly $${a}$–$${c}$: so ${b} lies in the middle.`, `$${a}$–$${b}$ plus $${b}$–$${c}$ ergibt genau $${a}$–$${c}$: ${b} liegt also in der Mitte.`) },
      { math: `${a} \\quad ${b} \\quad ${c}`, note: tx(`Map: ${a} ( ${d1} cM ) ${b} ( ${d2} cM ) ${c}.`, `Karte: ${a} ( ${d1} cM ) ${b} ( ${d2} cM ) ${c}.`) },
    ],
    mistakes: c2.mistakes,
  };
}

function distanceTask(rng: Rng): Exercise {
  const { order, d1, d2 } = threeGenes(rng);
  const [a, b, c] = order;
  const inner = rng.chance(0.5);
  // inner: B between A and C, given A–B and B–C, ask A–C. Otherwise given A–C and A–B, ask B–C.
  const value = inner ? d1 + d2 : d2;
  const answer: AnswerSpec = { kind: "number", value, unit: "cM" };
  const m = mistakeList(answer);
  if (inner) m.add({ kind: "number", value: Math.abs(d1 - d2), unit: "cM" }, tx("Add along the chromosome", "Entlang des Chromosoms addieren"), tx(`${b} lies **between** ${a} and ${c}, so the distances add up.`, `${b} liegt **zwischen** ${a} und ${c}, also addieren sich die Abstände.`));
  else m.add({ kind: "number", value: d1 + d2 + d1, unit: "cM" }, tx("Subtract here", "Hier subtrahieren"), tx(`${b} lies between ${a} and ${c}: the distance ${b}–${c} is the rest of ${a}–${c} after ${a}–${b}.`, `${b} liegt zwischen ${a} und ${c}: Der Abstand ${b}–${c} ist der Rest von ${a}–${c} nach ${a}–${b}.`));
  const genes = [
    { name: a, pos: 0 },
    { name: b, pos: d1 },
    { name: c, pos: d1 + d2 },
  ];
  const brackets = inner
    ? [
        { from: 0, to: d1, label: `${d1} cM` },
        { from: d1, to: d1 + d2, label: `${d2} cM` },
        { from: 0, to: d1 + d2, label: null, lane: 1 },
      ]
    : [
        { from: 0, to: d1, label: `${d1} cM` },
        { from: d1, to: d1 + d2, label: null },
        { from: 0, to: d1 + d2, label: `${d1 + d2} cM`, lane: 1 },
      ];
  return {
    instruction: tx("Distances on the gene map", "Abstände auf der Genkarte"),
    text: inner
      ? tx(`Gene ${b} lies between ${a} and ${c}. ${a}–${b}: ${d1}% recombination, ${b}–${c}: ${d2}%. What distance do you expect between ${a} and ${c} (ignoring double crossing-over)?`, `Gen ${b} liegt zwischen ${a} und ${c}. ${a}–${b}: ${d1} % Rekombination, ${b}–${c}: ${d2} %. Welchen Abstand erwartest du zwischen ${a} und ${c} (ohne Doppel-Crossing-over)?`)
      : tx(`Gene ${b} lies between ${a} and ${c}. ${a}–${c}: ${d1 + d2}% recombination, ${a}–${b}: ${d1}%. How far apart are ${b} and ${c}?`, `Gen ${b} liegt zwischen ${a} und ${c}. ${a}–${c}: ${d1 + d2} % Rekombination, ${a}–${b}: ${d1} %. Wie weit liegen ${b} und ${c} auseinander?`),
    visual: visual(GeneticsChromosomeMap, { genes, brackets }),
    answer,
    hint: tx("1% recombination = 1 cM. Along the chromosome, distances add up.", "1 % Rekombination = 1 cM. Entlang des Chromosoms addieren sich die Abstände."),
    solution: [{ math: inner ? `${d1} + ${d2} = ${value} \\text{cM}` : `${d1 + d2} - ${d1} = ${value} \\text{cM}`, note: tx(`**${value} cM**.`, `**${value} cM**.`) }],
    mistakes: m.list,
  };
}

function mapOrderTask(rng: Rng): Exercise {
  const letters = rng.shuffle(["A", "B", "C", "D", "E", "F", "G"]).slice(0, 4);
  const gaps = [rng.int(3, 12), rng.int(3, 12), rng.int(3, 12)];
  const pos = [0, gaps[0], gaps[0] + gaps[1], gaps[0] + gaps[1] + gaps[2]];
  const ordered = letters; // left to right
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const [x, y] = [ordered[i], ordered[j]].sort();
    pairs.push([x, y, pos[j] - pos[i]]);
  }
  pairs.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1]));
  const items: Text[] = ordered.map((g) => `$${g}$`);
  const answer: AnswerSpec = { kind: "order", items, label: tx(`Start with gene ${ordered[0]}`, `Beginne mit Gen ${ordered[0]}`) };
  // the two middle genes swapped, and sorting by letters
  const mistakes: Mistake[] = [{ when: { kind: "order", items: [items[2], items[1]] }, title: tx("Check the distance to the start", "Prüf den Abstand zum Start"), say: tx(`Look at the distances from ${ordered[0]}: the closer gene comes first. ${ordered[0]}–${ordered[1]} is ${gaps[0]}%, ${ordered[0]}–${ordered[2]} is ${gaps[0] + gaps[1]}%.`, `Schau auf die Abstände zu ${ordered[0]}: Das nähere Gen kommt zuerst. ${ordered[0]}–${ordered[1]} sind ${gaps[0]} %, ${ordered[0]}–${ordered[2]} sind ${gaps[0] + gaps[1]} %.`) }];
  return {
    instruction: tx("Arrange the genes", "Ordne die Gene an"),
    text: tx(`Four linked genes, recombination frequencies in the table. Gene ${ordered[0]} lies at one end. Put the genes in their order along the chromosome.`, `Vier gekoppelte Gene, Rekombinationshäufigkeiten in der Tabelle. Gen ${ordered[0]} liegt an einem Ende. Bring die Gene in ihre Reihenfolge auf dem Chromosom.`),
    visual: visual(GeneticsRfTable, { pairs }),
    answer,
    hint: tx(`Sort the genes by their recombination frequency with ${ordered[0]}.`, `Sortiere die Gene nach ihrer Rekombinationshäufigkeit mit ${ordered[0]}.`),
    solution: [
      { math: ordered.join(" \\quad "), note: tx(`Distances from ${ordered[0]}: ${ordered.slice(1).map((g, i) => `${g} ${pos[i + 1]}%`).join(", ")}. Small to large.`, `Abstände zu ${ordered[0]}: ${ordered.slice(1).map((g, i) => `${g} ${pos[i + 1]} %`).join(", ")}. Von klein nach groß.`) },
      { math: `${ordered[0]} \\; (${gaps[0]}) \\; ${ordered[1]} \\; (${gaps[1]}) \\; ${ordered[2]} \\; (${gaps[2]}) \\; ${ordered[3]}`, note: tx("Check: the neighbouring distances add up to the larger values.", "Probe: Die Nachbarabstände addieren sich zu den größeren Werten.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// 11. Facts, 12. terms

type Fact = { q: Text; opts: Opt[]; hint: Text; math: Text; note: Text };

const FACTS: Fact[] = [
  {
    q: tx("Who determines the sex of a child?", "Wer bestimmt das Geschlecht eines Kindes?"),
    opts: [
      { text: tx("the father's sperm cell: it carries X or Y", "die Spermienzelle des Vaters: Sie trägt X oder Y") },
      { text: tx("the mother's egg cell", "die Eizelle der Mutter"), title: tx("The mother decides?", "Die Mutter entscheidet?"), say: tx("Egg cells always carry an X. Whether a boy or a girl develops depends on the sperm: X or Y.", "Eizellen tragen immer ein X. Ob ein Junge oder ein Mädchen entsteht, hängt vom Spermium ab: X oder Y.") },
      { text: tx("the dominant allele", "das dominante Allel"), title: tx("Sex isn't a dominance thing", "Geschlecht ist keine Dominanzfrage"), say: tx("Sex is determined by the sex chromosomes XX or XY, not by dominance.", "Das Geschlecht bestimmen die Geschlechtschromosomen XX oder XY, nicht Dominanz.") },
      { text: tx("both parents equally", "beide Eltern gleichermaßen"), title: tx("Only one varies", "Nur einer variiert"), say: tx("The mother always gives an X. Only the father's gametes differ (X or Y).", "Die Mutter gibt immer ein X. Nur die Keimzellen des Vaters unterscheiden sich (X oder Y).") },
    ],
    hint: tx("Which parent makes two kinds of gametes?", "Welcher Elternteil bildet zwei Sorten Keimzellen?"),
    math: "XX \\times XY \\to XX , XY",
    note: tx("The mother gives X, the father X or Y: the **sperm** decides. 50% girls, 50% boys.", "Die Mutter gibt X, der Vater X oder Y: Das **Spermium** entscheidet. 50 % Mädchen, 50 % Jungen."),
  },
  {
    q: tx("Why are far more men than women red-green colour-blind?", "Warum sind viel mehr Männer als Frauen rot-grün-sehschwach?"),
    opts: [
      { text: tx("Men have only one X: a single recessive allele shows.", "Männer haben nur ein X: Ein einziges rezessives Allel zeigt sich.") },
      { text: tx("The allele lies on the Y chromosome.", "Das Allel liegt auf dem Y-Chromosom."), title: tx("It's on the X", "Es liegt auf dem X"), say: tx("If it were on the Y, women could never be affected and every son of an affected father would be. It's on the X.", "Läge es auf dem Y, könnten Frauen nie betroffen sein, und jeder Sohn eines betroffenen Vaters wäre es. Es liegt auf dem X.") },
      { text: tx("The allele is dominant in men and recessive in women.", "Das Allel ist bei Männern dominant und bei Frauen rezessiv."), title: tx("Dominance doesn't change", "Dominanz ändert sich nicht"), say: tx("The allele is recessive in both. Men simply have no second X that could cover it: they're hemizygous.", "Das Allel ist bei beiden rezessiv. Männer haben nur kein zweites X, das es überdecken könnte: Sie sind hemizygot.") },
      { text: tx("Fathers pass it on to their sons.", "Väter vererben es an ihre Söhne."), title: tx("Fathers give sons a Y", "Väter geben Söhnen ein Y"), say: tx("Sons get the Y from their father. An X-linked allele never goes from father to son.", "Söhne bekommen vom Vater das Y. Ein X-chromosomales Allel geht nie vom Vater auf den Sohn.") },
    ],
    hint: tx("Count the X chromosomes of men and women.", "Zähl die X-Chromosomen von Männern und Frauen."),
    math: tx('X^a Y \\to "affected" \\quad X^A X^a \\to "healthy"', 'X^a Y \\to "krank" \\quad X^A X^a \\to "gesund"'),
    note: tx("Men are **hemizygous**: one $X^a$ is enough. Women need $X^a$ twice.", "Männer sind **hemizygot**: Ein $X^a$ reicht. Frauen brauchen $X^a$ doppelt."),
  },
  {
    q: tx("What is a Konduktorin (female carrier)?", "Was ist eine Konduktorin?"),
    opts: [
      { text: tx("a heterozygous woman who is healthy but can pass on an X-linked recessive allele", "eine mischerbige Frau, die gesund ist, aber ein X-chromosomal-rezessives Allel weitergeben kann") },
      { text: tx("a woman who has the X-linked disease", "eine Frau, die die X-chromosomale Krankheit hat"), title: tx("Carriers are healthy", "Konduktorinnen sind gesund"), say: tx("A carrier ($X^A X^a$) doesn't show the disease. Affected women are $X^a X^a$.", "Eine Konduktorin ($X^A X^a$) zeigt die Krankheit nicht. Kranke Frauen sind $X^a X^a$.") },
      { text: tx("a man who passes the allele on to his sons", "ein Mann, der das Allel an seine Söhne weitergibt"), title: tx("Only women", "Nur Frauen"), say: tx("Men have only one X and can't be hidden carriers. And they never pass an X to their sons.", "Männer haben nur ein X und können keine verborgenen Überträger sein. Und sie geben nie ein X an ihre Söhne weiter.") },
      { text: tx("a woman with two healthy X chromosomes", "eine Frau mit zwei gesunden X-Chromosomen"), title: tx("She carries the allele", "Sie trägt das Allel"), say: tx("A carrier has **one** $X^a$, hidden by $X^A$.", "Eine Konduktorin hat **ein** $X^a$, verdeckt durch $X^A$.") },
    ],
    hint: tx("Konduktor = conductor: it passes something on.", "Konduktor = Leiter: Er gibt etwas weiter."),
    math: tx('X^A X^a \\to "healthy carrier"', 'X^A X^a \\to "gesunde Konduktorin"'),
    note: tx("Konduktorin: heterozygous $X^A X^a$, healthy, passes $X^a$ to half of her children.", "Konduktorin: mischerbig $X^A X^a$, gesund, gibt $X^a$ an die Hälfte ihrer Kinder weiter."),
  },
  {
    q: tx("What does a recombination frequency of 8% between two genes mean?", "Was bedeutet eine Rekombinationshäufigkeit von 8 % zwischen zwei Genen?"),
    opts: [
      { text: tx("8% of the offspring of a test cross show new combinations: the genes are 8 cM apart.", "8 % der Nachkommen einer Testkreuzung zeigen Neukombinationen: Die Gene liegen 8 cM auseinander.") },
      { text: tx("The genes are 8% of the chromosome's length apart.", "Die Gene liegen 8 % der Chromosomenlänge auseinander."), title: tx("A relative measure", "Ein relatives Maß"), say: tx("cM is a map unit based on recombination, not a share of the physical length.", "cM ist eine Karteneinheit aus Rekombinationsdaten, kein Anteil der tatsächlichen Länge.") },
      { text: tx("8 crossing-overs happen per meiosis.", "Pro Meiose finden 8 Crossing-over statt."), title: tx("A percentage of gametes", "Ein Prozentsatz der Keimzellen"), say: tx("It's a share of gametes (or offspring), not a number of crossing-overs.", "Es ist ein Anteil der Keimzellen (bzw. Nachkommen), keine Zahl von Crossing-over.") },
      { text: tx("The genes are inherited independently in 8% of cases.", "Die Gene werden in 8 % der Fälle unabhängig vererbt."), title: tx("Independent would be 50%", "Unabhängig wären 50 %"), say: tx("Independent genes give 50% recombinants. 8% means: tightly linked.", "Unabhängige Gene ergeben 50 % Rekombinanten. 8 % heißt: eng gekoppelt.") },
    ],
    hint: tx("Recombinants are offspring with new combinations of alleles.", "Rekombinanten sind Nachkommen mit neuen Allelkombinationen."),
    math: '8 "%" = 8 \\text{cM}',
    note: tx("1% recombination = 1 centimorgan (cM). Small values: genes close together.", "1 % Rekombination = 1 Centimorgan (cM). Kleine Werte: Gene liegen dicht beieinander."),
  },
  {
    q: tx("Why is the recombination frequency never above 50%?", "Warum liegt die Rekombinationshäufigkeit nie über 50 %?"),
    opts: [
      { text: tx("Even unlinked genes recombine in only half of the gametes.", "Selbst ungekoppelte Gene rekombinieren nur in der Hälfte der Keimzellen.") },
      { text: tx("Chromosomes are too short for more.", "Chromosomen sind zu kurz für mehr."), title: tx("Not about length", "Nicht wegen der Länge"), say: tx("Long chromosomes can have genes far apart. Even then, at most 50% of gametes are recombinant, like for independent genes.", "Auf langen Chromosomen liegen Gene weit auseinander. Selbst dann sind höchstens 50 % der Keimzellen rekombinant, wie bei unabhängigen Genen.") },
      { text: tx("Crossing-over only happens in women.", "Crossing-over gibt es nur bei Frauen."), title: tx("Both sexes", "Bei beiden Geschlechtern"), say: tx("In humans crossing-over happens in both sexes. (Only male fruit flies are an exception.)", "Beim Menschen gibt es Crossing-over bei beiden Geschlechtern. (Nur männliche Taufliegen sind eine Ausnahme.)") },
      { text: tx("Every second meiosis fails.", "Jede zweite Meiose misslingt."), title: tx("Meiosis works", "Die Meiose klappt"), say: tx("It's about combinations: with very many crossing-overs, half of the gametes end up parental, half recombinant.", "Es geht um Kombinationen: Bei sehr vielen Crossing-over landet die Hälfte der Keimzellen elterlich, die Hälfte rekombinant.") },
    ],
    hint: tx("What do independently inherited genes give in a test cross?", "Was ergeben unabhängig vererbte Gene bei einer Rückkreuzung?"),
    math: tx('"RF" \\le 50 "%"', '"RH" \\le 50 "%"'),
    note: tx("Independent genes give 1 : 1 : 1 : 1, so 50% recombinants. That's the upper limit.", "Unabhängige Gene ergeben 1 : 1 : 1 : 1, also 50 % Rekombinanten. Das ist die Obergrenze."),
  },
  {
    q: tx("When and where does crossing-over happen?", "Wann und wo findet Crossing-over statt?"),
    opts: [
      { text: tx("in prophase I of meiosis, between non-sister chromatids of homologous chromosomes", "in der Prophase I der Meiose, zwischen Nicht-Schwesterchromatiden homologer Chromosomen") },
      { text: tx("in mitosis, between sister chromatids", "in der Mitose, zwischen Schwesterchromatiden"), title: tx("Meiosis, not mitosis", "Meiose, nicht Mitose"), say: tx("Exchange between identical sister chromatids would change nothing. It happens between homologous chromosomes in meiosis I.", "Ein Austausch zwischen identischen Schwesterchromatiden würde nichts ändern. Er findet zwischen homologen Chromosomen in der Meiose I statt.") },
      { text: tx("in meiosis II, when the chromatids separate", "in der Meiose II, wenn sich die Chromatiden trennen"), title: tx("Earlier", "Früher"), say: tx("The homologous chromosomes pair up in prophase I: that's when crossing-over happens.", "Die homologen Chromosomen paaren sich in der Prophase I: Dann findet Crossing-over statt.") },
      { text: tx("at fertilisation, when egg and sperm fuse", "bei der Befruchtung, wenn Ei und Spermium verschmelzen"), title: tx("Before the gametes exist", "Bevor die Keimzellen entstehen"), say: tx("Crossing-over happens while the gametes are made, in meiosis.", "Crossing-over findet statt, während die Keimzellen gebildet werden, in der Meiose.") },
    ],
    hint: tx("When do homologous chromosomes lie side by side?", "Wann liegen homologe Chromosomen nebeneinander?"),
    math: tx('"prophase I"', '"Prophase I"'),
    note: tx("Homologous chromosomes pair in prophase I; non-sister chromatids exchange pieces (chiasmata).", "Homologe Chromosomen paaren sich in der Prophase I; Nicht-Schwesterchromatiden tauschen Stücke aus (Chiasmata)."),
  },
  {
    q: tx("How many linkage groups does the fruit fly Drosophila melanogaster have (2n = 8)?", "Wie viele Kopplungsgruppen hat die Taufliege Drosophila melanogaster (2n = 8)?"),
    opts: [
      { text: "4" },
      { text: "8", title: tx("Pairs, not chromosomes", "Paare, nicht Chromosomen"), say: tx("Homologous chromosomes carry the same genes. Each pair forms one linkage group: 8 / 2 = 4.", "Homologe Chromosomen tragen dieselben Gene. Jedes Paar bildet eine Kopplungsgruppe: 8 / 2 = 4.") },
      { text: "2", title: tx("One per pair", "Eine pro Paar"), say: tx("There are as many linkage groups as chromosome pairs: 4.", "Es gibt so viele Kopplungsgruppen wie Chromosomenpaare: 4.") },
      { text: "23", title: tx("That's humans", "Das ist der Mensch"), say: tx("23 is for humans (23 chromosome pairs). The fruit fly has 4 pairs.", "23 gilt für den Menschen (23 Chromosomenpaare). Die Taufliege hat 4 Paare.") },
    ],
    hint: tx("Genes on one chromosome are inherited together.", "Gene auf einem Chromosom werden gemeinsam vererbt."),
    math: tx('2n = 8 \\Rightarrow 4 "linkage groups"', '2n = 8 \\Rightarrow 4 "Kopplungsgruppen"'),
    note: tx("Number of linkage groups = number of chromosome pairs: 4 in Drosophila, 23 in humans.", "Zahl der Kopplungsgruppen = Zahl der Chromosomenpaare: 4 bei Drosophila, 23 beim Menschen."),
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: tx("Pick the right answer", "Wähle die richtige Antwort"), text: f.q, answer: c.answer, hint: f.hint, solution: [{ math: f.math, note: f.note }], mistakes: c.mistakes };
}

type Term = { id: string; term: Text; def: Text; partner?: string };
const TERMS: Term[] = [
  { id: "gono", term: tx("sex chromosomes (gonosomes)", "Gonosomen"), def: tx("the chromosomes X and Y that determine sex", "die Chromosomen X und Y, die das Geschlecht bestimmen"), partner: "auto" },
  { id: "auto", term: tx("autosomes", "Autosomen"), def: tx("all other chromosomes: 22 pairs in humans", "alle übrigen Chromosomen: 22 Paare beim Menschen"), partner: "gono" },
  { id: "hemi", term: tx("hemizygous", "hemizygot"), def: tx("only one allele of a gene present, like X genes in men", "nur ein Allel eines Gens vorhanden, wie X-Gene beim Mann"), partner: "kond" },
  { id: "kond", term: tx("carrier woman (Konduktorin)", "Konduktorin"), def: tx("a healthy heterozygous woman who passes on an X-linked recessive allele", "eine gesunde mischerbige Frau, die ein X-chromosomal-rezessives Allel weitergibt"), partner: "hemi" },
  { id: "link", term: tx("linkage group", "Kopplungsgruppe"), def: tx("all genes on one chromosome, inherited together", "alle Gene auf einem Chromosom, die gemeinsam vererbt werden"), partner: "co" },
  { id: "co", term: tx("crossing-over", "Crossing-over"), def: tx("exchange of pieces between homologous chromosomes in meiosis I", "Stückaustausch zwischen homologen Chromosomen in der Meiose I"), partner: "link" },
  { id: "rf", term: tx("recombination frequency", "Rekombinationshäufigkeit"), def: tx("share of recombinant offspring in %", "Anteil der rekombinanten Nachkommen in %"), partner: "cm" },
  { id: "cm", term: tx("centimorgan (cM)", "Centimorgan (cM)"), def: tx("map unit: 1% recombination", "Karteneinheit: 1 % Rekombination"), partner: "rf" },
];

function termTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(TERMS).slice(0, 4);
  const extra = rng.pick(TERMS.filter((t) => !chosen.includes(t)));
  const wrong = chosen
    .filter((t) => t.partner && chosen.some((o) => o.id === t.partner))
    .map((t) => {
      const p = TERMS.find((o) => o.id === t.partner)!;
      return { pairs: [[t.term, p.def]] as [Text, Text][], title: tx("Close relatives", "Nahe Verwandte"), say: tx(`That's the description of “${E(p.term)}”. ${cap(E(t.term))}: ${E(t.def)}.`, `Das ist die Beschreibung von „${D(p.term)}“. ${cap(D(t.term))}: ${D(t.def)}.`) };
    });
  const m = matchTask(
    chosen.map((t) => [t.term, t.def]),
    [extra.def],
    wrong,
  );
  return {
    instruction: tx("Match term and meaning", "Ordne Begriff und Bedeutung zu"),
    text: tx("Which description belongs to which term? One description is left over.", "Welche Beschreibung gehört zu welchem Begriff? Eine Beschreibung bleibt übrig."),
    answer: m.answer,
    hint: tx("Gonosomes are X and Y. Hemi = half: only one copy.", "Gonosomen sind X und Y. Hemi = halb: nur eine Kopie."),
    solution: [{ math: tx(`"${E(chosen[0].term)}"`, `"${D(chosen[0].term)}"`), note: tx(chosen.map((t) => `**${cap(E(t.term))}**: ${E(t.def)}.`).join(" "), chosen.map((t) => `**${cap(D(t.term))}**: ${D(t.def)}.`).join(" ")) }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.5, () => xCrossTask(rng)],
    [0.9, () => xGenoTask(rng)],
    [1.3, () => modesTask(rng)],
    [0.9, () => exclusionTask(rng)],
    [0.7, () => carrierTask(rng)],
    [1.8, () => probTask(rng)],
    [1, () => rfTask(rng)],
    [0.6, () => expectedRecTask(rng)],
    [0.6, () => middleTask(rng)],
    [0.5, () => distanceTask(rng)],
    [0.5, () => mapOrderTask(rng)],
    [0.7, () => factTask(rng)],
    [0.5, () => termTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const lessonModes = (() => {
  const rng = createRng(31337);
  for (let i = 0; i < 50; i++) {
    const r = modesPedigree(rng);
    if (r.possible.length === 2) return r;
  }
  return modesPedigree(rng);
})();

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Sex chromosomes and X-linked inheritance", "Gonosomen und X-chromosomale Vererbung"),
      blob: tx("Why are some diseases almost only found in boys? The X has the answer.", "Warum treffen manche Krankheiten fast nur Jungen? Das X kennt die Antwort."),
      body: tx(
        "Humans have 22 pairs of **autosomes** and one pair of **sex chromosomes (gonosomes)**: women XX, men XY. The small Y carries hardly any of the X's genes. Alleles on the X are inherited **X-linked** (gonosomally).",
        "Der Mensch hat 22 Paare **Autosomen** und ein Paar **Geschlechtschromosomen (Gonosomen)**: Frauen XX, Männer XY. Das kleine Y trägt kaum eines der Gene des X. Allele auf dem X werden **X-chromosomal** (gonosomal) vererbt.",
      ),
      frames: [
        { math: "XX#m \\times XY#f", note: tx("Mother XX, father XY. Egg cells always carry an X, sperm cells X or Y.", "Mutter XX, Vater XY. Eizellen tragen immer ein X, Spermien X oder Y.") },
        { math: "XX#m \\times XY#f \\to XX , XY", note: tx("So the **father's sperm** decides the sex: 50% girls, 50% boys.", "Das **Spermium des Vaters** entscheidet also über das Geschlecht: 50 % Mädchen, 50 % Jungen.") },
        { math: "X^A Y \\quad X^a Y", note: tx("Men have only one X: one allele of each X gene. They are **hemizygous**: a single recessive $X^a$ shows.", "Männer haben nur ein X: ein Allel jedes X-Gens. Sie sind **hemizygot**: Ein einziges rezessives $X^a$ zeigt sich.") },
        { math: tx('X^A X^a \\to "healthy"', 'X^A X^a \\to "gesund"'), note: tx("A woman with one $X^a$ is healthy, but passes it on: she is a **carrier (Konduktorin)**.", "Eine Frau mit einem $X^a$ ist gesund, gibt es aber weiter: Sie ist **Konduktorin** (Überträgerin).") },
        { math: "X^A X^a \\times X^A Y \\to X^A X^A , X^A X^a , X^A Y , \\hl{X^a Y}", note: tx("Carrier × healthy man: all daughters healthy (half of them carriers), **half of the sons affected**.", "Konduktorin × gesunder Mann: alle Töchter gesund (die Hälfte Konduktorinnen), **die Hälfte der Söhne krank**.") },
        { math: tx('"father:" \\; X \\to "daughters only"', '"Vater:" \\; X \\to "nur an Töchter"'), note: tx("A father passes his X only to his daughters, never to his sons. An X-linked allele never goes from father to son!", "Ein Vater gibt sein X nur an seine Töchter, nie an seine Söhne. Ein X-chromosomales Allel geht nie vom Vater auf den Sohn!") },
      ],
    },
    {
      type: "widget",
      title: tx("X-linked crosses", "X-chromosomale Kreuzungen"),
      blob: tx("Sons and daughters, side by side. Spot the difference!", "Söhne und Töchter, nebeneinander. Finde den Unterschied!"),
      body: tx("Red-green colour blindness and haemophilia A are inherited X-linked recessively. Choose the mother and the father and compare daughters and sons.", "Rot-Grün-Sehschwäche und Bluterkrankheit (Hämophilie A) werden X-chromosomal-rezessiv vererbt. Wähle Mutter und Vater und vergleiche Töchter und Söhne."),
      widget: GeneticsXLinked,
    },
    { type: "check", blob: tx("A classic exam trap. Careful!", "Eine klassische Prüfungsfalle. Vorsicht!"), exercise: xCrossExercise(null, X_DISEASES[1], 0, 1, "sonAffected") },
    {
      type: "explain",
      title: tx("The exclusion method", "Das Ausschlussverfahren"),
      blob: tx("Four suspects, one family tree. Let's rule them out one by one.", "Vier Verdächtige, ein Stammbaum. Schließen wir sie einzeln aus."),
      body: tx("In the exam you test all four modes of inheritance. A single family that contradicts a mode rules it out.", "In der Prüfung testest du alle vier Erbgänge. Eine einzige Familie, die einem Erbgang widerspricht, schließt ihn aus."),
      frames: [
        { math: tx('"affected" \\times "affected" \\to "healthy"', '"krank" \\times "krank" \\to "gesund"'), note: tx("Two affected parents with a healthy child: **not recessive** (neither autosomal nor X-linked).", "Zwei kranke Eltern mit gesundem Kind: **nicht rezessiv** (weder autosomal noch X-chromosomal).") },
        { math: tx('"healthy" \\times "healthy" \\to "affected"', '"gesund" \\times "gesund" \\to "krank"'), note: tx("Two healthy parents with an affected child: **not dominant** (neither autosomal nor X-linked).", "Zwei gesunde Eltern mit krankem Kind: **nicht dominant** (weder autosomal noch X-chromosomal).") },
        { math: tx('"affected mother" \\to "healthy son"', '"kranke Mutter" \\to "gesunder Sohn"'), note: tx("An affected woman ($X^a X^a$) with a healthy son, or an affected daughter with a healthy father: **not X-linked recessive**.", "Eine kranke Frau ($X^a X^a$) mit gesundem Sohn oder eine kranke Tochter mit gesundem Vater: **nicht X-chromosomal-rezessiv**.") },
        { math: tx('"affected father" \\to "healthy daughter"', '"kranker Vater" \\to "gesunde Tochter"'), note: tx("An affected man with a healthy daughter, or an affected son with a healthy mother: **not X-linked dominant**.", "Ein kranker Mann mit gesunder Tochter oder ein kranker Sohn mit gesunder Mutter: **nicht X-chromosomal-dominant**.") },
        { math: tx('"not ruled out" \\to "possible"', '"nicht ausgeschlossen" \\to "möglich"'), note: tx("What can't be ruled out stays possible. Then weigh it up: many more affected men point to X-linked recessive; a rare disease makes carriers who marry in unlikely.", "Was sich nicht ausschließen lässt, bleibt möglich. Dann abwägen: Viel mehr kranke Männer sprechen für X-chromosomal-rezessiv; bei einer seltenen Krankheit sind eingeheiratete Überträger unwahrscheinlich.") },
      ],
    },
    {
      type: "widget",
      title: tx("Pedigree lab", "Stammbaum-Labor"),
      blob: tx("New family, four modes. Test them all!", "Neue Familie, vier Erbgänge. Teste sie alle!"),
      body: tx("Tap a mode of inheritance: the tree shows the family that rules it out, or the genotypes that fit. Half-filled symbols are certain carriers. Then load a new family.", "Tipp auf einen Erbgang: Der Stammbaum zeigt die Familie, die ihn ausschließt, oder die Genotypen, die passen. Halb gefüllte Symbole sind sichere Überträger(innen). Dann lade eine neue Familie."),
      widget: GeneticsPedigreeLab,
    },
    { type: "check", blob: tx("Your turn: which modes survive?", "Du bist dran: Welche Erbgänge bleiben übrig?"), exercise: modesExercise(createRng(4), lessonModes.ped, lessonModes.mode, lessonModes.possible) },
    {
      type: "explain",
      title: tx("Probabilities in pedigrees", "Wahrscheinlichkeiten im Stammbaum"),
      blob: tx("Now we calculate risks, just like genetic counsellors do.", "Jetzt rechnen wir Risiken aus, wie in der genetischen Beratung."),
      body: tx("Events that must **all** happen are multiplied (**product rule**). The trap: a healthy sibling of an affected person is **not** certainly a carrier.", "Ereignisse, die **alle** eintreten müssen, werden multipliziert (**Produktregel**). Die Falle: Ein gesundes Geschwister eines Kranken ist **nicht** sicher Überträger."),
      frames: [
        { math: "Aa \\times Aa \\to AA , Aa , Aa , aa", note: tx("Parents of a child with cystic fibrosis are both carriers. Their healthy child is $AA$, $Aa$ or $Aa$, never $aa$.", "Eltern eines Kindes mit Mukoviszidose sind beide Überträger. Ihr gesundes Kind ist $AA$, $Aa$ oder $Aa$, nie $aa$.") },
        { math: tx('P("carrier") = \\frac{2}{3}', 'P("Überträger") = \\frac{2}{3}'), note: tx("Of the three healthy options two are $Aa$: carrier with **2/3**, not 1/2!", "Von den drei gesunden Möglichkeiten sind zwei $Aa$: Überträger mit **2/3**, nicht 1/2!") },
        { math: "\\frac{2}{3} \\cdot \\frac{2}{3} \\cdot \\frac{1}{4} = \\frac{1}{9}", note: tx("Two such people (from different families) have a child: both must be carriers (2/3 each) **and** the child must get $a$ twice (1/4): **1/9**, about 11%.", "Zwei solche Personen (aus verschiedenen Familien) bekommen ein Kind: Beide müssen Überträger sein (je 2/3) **und** das Kind muss zweimal $a$ bekommen (1/4): **1/9**, etwa 11 %.") },
        { math: "\\frac{1}{4} \\cdot \\frac{1}{4} = \\frac{1}{16}", note: tx("Several children: each birth is independent. Both of two children affected: $\\frac{1}{16}$. An affected first child doesn't make the second one safer.", "Mehrere Kinder: Jede Geburt ist unabhängig. Beide von zwei Kindern krank: $\\frac{1}{16}$. Ein krankes erstes Kind macht das zweite nicht sicherer.") },
      ],
    },
    { type: "check", blob: tx("Calculate the risk. Remember the 2/3!", "Berechne das Risiko. Denk an die 2/3!"), exercise: arProbExercise(null, "carrier", "m", "f") },
    {
      type: "explain",
      title: tx("Gene linkage and crossing-over", "Genkopplung und Crossing-over"),
      blob: tx("Mendel's 3rd law has a catch. Morgan found it in fruit flies.", "Mendels 3. Regel hat einen Haken. Morgan fand ihn bei Taufliegen."),
      body: tx(
        "The independence rule only holds for genes on different chromosomes. Genes on the **same** chromosome are inherited together: they are **linked** and form a **linkage group** (as many as there are chromosome pairs). Thomas Hunt Morgan discovered this around 1910 in the fruit fly Drosophila.",
        "Die Unabhängigkeitsregel gilt nur für Gene auf verschiedenen Chromosomen. Gene auf **demselben** Chromosom werden gemeinsam vererbt: Sie sind **gekoppelt** und bilden eine **Kopplungsgruppe** (so viele wie Chromosomenpaare). Thomas Hunt Morgan entdeckte das um 1910 an der Taufliege Drosophila.",
      ),
      frames: [
        { math: "AB/ab \\times ab/ab", note: tx("Test cross of a fly with $A$ and $B$ on one chromosome and $a$ and $b$ on the homologous one.", "Rückkreuzung einer Fliege mit $A$ und $B$ auf einem Chromosom und $a$ und $b$ auf dem homologen.") },
        { math: tx('"unlinked:" \\; 1 : 1 : 1 : 1', '"ungekoppelt:" \\; 1 : 1 : 1 : 1'), note: tx("Independent genes would give four classes in equal numbers.", "Unabhängige Gene ergäben vier Gruppen in gleicher Zahl.") },
        { math: tx('AB , ab \\; "many" \\quad Ab , aB \\; "few"', 'AB , ab \\; "viele" \\quad Ab , aB \\; "wenige"'), note: tx("Linked: the parental combinations dominate. A few **recombinants** appear: in prophase I, homologous chromosomes swapped pieces by **crossing-over**.", "Gekoppelt: Die elterlichen Kombinationen überwiegen. Einige **Rekombinanten** treten auf: In der Prophase I haben homologe Chromosomen durch **Crossing-over** Stücke getauscht.") },
        { math: tx('"RF" = \\frac{"recombinants"}{"all offspring"} \\cdot 100 "%"', '"RH" = \\frac{"Rekombinanten"}{"alle Nachkommen"} \\cdot 100 "%"'), note: tx("The **recombination frequency** (RF).", "Die **Rekombinationshäufigkeit** (RH).") },
        { math: '1 "%" = 1 \\text{cM}', note: tx("The farther apart two genes are, the more often a crossing-over falls between them. 1% recombination = 1 **centimorgan** (cM), the unit of the **gene map**. Morgan's student Sturtevant drew the first one in 1913.", "Je weiter zwei Gene auseinanderliegen, desto öfter liegt ein Crossing-over zwischen ihnen. 1 % Rekombination = 1 **Centimorgan** (cM), die Einheit der **Genkarte**. Morgans Student Sturtevant zeichnete 1913 die erste.") },
      ],
    },
    {
      type: "widget",
      title: tx("Crossing-over and gene maps", "Crossing-over und Genkarten"),
      blob: tx("Run some meioses and then draw a map!", "Lass ein paar Meiosen laufen und zeichne dann eine Karte!"),
      body: tx("Tab 1: simulate meioses and watch the recombination frequency follow the distance. Tab 2: find the gene order from recombination frequencies, with real Drosophila data.", "Reiter 1: Simuliere Meiosen und beobachte, wie die Rekombinationshäufigkeit dem Abstand folgt. Reiter 2: Finde die Genreihenfolge aus Rekombinationshäufigkeiten, mit echten Drosophila-Daten."),
      widget: GeneticsGeneMap,
    },
    { type: "check", blob: tx("Last one: Morgan's own kind of data!", "Die letzte: Daten wie bei Morgan!"), exercise: rfExercise(campbellData()) },
  ],
  summary: [
    {
      title: tx("X-linked recessive", "X-chromosomal-rezessiv"),
      body: tx("Men are hemizygous: $X^a Y$ is affected. Women with $X^A X^a$ are healthy carriers (Konduktorinnen). Fathers pass their X only to daughters, never to sons. Sons get their X from the mother.", "Männer sind hemizygot: $X^a Y$ ist krank. Frauen mit $X^A X^a$ sind gesunde Konduktorinnen. Väter geben ihr X nur an Töchter, nie an Söhne. Söhne bekommen ihr X von der Mutter."),
      examples: [tx('X^A X^a \\times X^A Y \\to "50 % of sons affected"', 'X^A X^a \\times X^A Y \\to "50 % der Söhne krank"')],
      tone: "rule",
    },
    {
      title: tx("Exclusion method", "Ausschlussverfahren"),
      body: tx(
        "Healthy × healthy → affected: not dominant. Affected × affected → healthy: not recessive. Affected mother → healthy son, or affected daughter with healthy father: not X-recessive. Affected father → healthy daughter, or affected son with healthy mother: not X-dominant.",
        "Gesund × gesund → krank: nicht dominant. Krank × krank → gesund: nicht rezessiv. Kranke Mutter → gesunder Sohn oder kranke Tochter mit gesundem Vater: nicht X-rezessiv. Kranker Vater → gesunde Tochter oder kranker Sohn mit gesunder Mutter: nicht X-dominant.",
      ),
      tone: "rule",
    },
    {
      title: tx("Product rule and the 2/3", "Produktregel und die 2/3"),
      body: tx("Multiply everything that must happen together. A healthy sibling of someone with an autosomal recessive disease is a carrier with $\\frac{2}{3}$.", "Multipliziere alles, was zusammen eintreten muss. Ein gesundes Geschwister eines autosomal-rezessiv Kranken ist mit $\\frac{2}{3}$ Überträger."),
      examples: ["\\frac{2}{3} \\cdot \\frac{2}{3} \\cdot \\frac{1}{4} = \\frac{1}{9}"],
      tone: "rule",
    },
    {
      title: tx("Linkage and recombination", "Kopplung und Rekombination"),
      body: tx("Genes on one chromosome are linked. Crossing-over in prophase I creates recombinants. RF = recombinants / all offspring · 100%; 1% = 1 cM.", "Gene auf einem Chromosom sind gekoppelt. Crossing-over in der Prophase I erzeugt Rekombinanten. RH = Rekombinanten / alle Nachkommen · 100 %; 1 % = 1 cM."),
      examples: [tx('"RF" = \\frac{"recombinants"}{"all"} \\cdot 100 "%"', '"RH" = \\frac{"Rekombinanten"}{"alle"} \\cdot 100 "%"')],
      tone: "rule",
    },
    {
      title: tx("Gene maps", "Genkarten"),
      body: tx("The pair with the largest RF are the outer genes; distances add up along the chromosome. Long distances come out a bit too small (double crossing-over).", "Das Paar mit der größten RH sind die äußeren Gene; Abstände addieren sich entlang des Chromosoms. Große Abstände fallen etwas zu klein aus (Doppel-Crossing-over)."),
      examples: [tx('b \\; (9 \\text{cM}) \\; cn \\; (9.5 \\text{cM}) \\; vg', 'b \\; (9 \\text{cM}) \\; cn \\; (9,5 \\text{cM}) \\; vg')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("No X-linked inheritance from father to son. Multiply, don't add. Healthy sibling: 2/3, not 1/2. “A son is affected” (among sons) is not “an affected son” (among all children).", "Keine X-chromosomale Vererbung vom Vater auf den Sohn. Multiplizieren, nicht addieren. Gesundes Geschwister: 2/3, nicht 1/2. „Ein Sohn ist krank“ (unter Söhnen) ist nicht „ein kranker Sohn“ (unter allen Kindern)."),
      examples: [tx('P("son affected") = 2 \\cdot P("affected son")', 'P("Sohn krank") = 2 \\cdot P("kranker Sohn")')],
      tone: "warning",
    },
  ],
};
