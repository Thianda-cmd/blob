"use client";

// Enzymes, level 2 (Klasse 9–10): active site and enzyme-substrate complex, substrate and reaction
// specificity, activation energy, temperature (RGT rule, optimum, denaturation), pH optimum,
// substrate concentration and saturation. Reading graphs.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { EnzymeActivity } from "@/learn/biology/visuals/EnzymeActivity";
import { EnzymeMMGraph, EnzymePhGraph, EnzymeTempGraph } from "@/learn/biology/visuals/EnzymeCharts";
import { EnzymeEnergy, EnzymeEnergyDiagram } from "@/learn/biology/visuals/EnzymeEnergy";
import { EnzymeLockKey } from "@/learn/biology/visuals/EnzymeLockKey";
import { EnzymeSaturation } from "@/learn/biology/visuals/EnzymeSaturation";
import { EnzymeTubes, type TubeSpec } from "@/learn/biology/visuals/EnzymeStarch";
import { dec } from "@/learn/chemistry/format";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { choice, letter, mistakes, multi, PH_ENZYMES, PICK, PICK_ALL, TEMP_SOURCES, visual, weighted, type Opt, type PhEnzyme, type Stmt } from "./data";

const USED_UP: Text = tx("Not used up", "Wird nicht verbraucht");
const COLD: Text = tx("Cold doesn't denature", "Kälte denaturiert nicht");
const IRREV: Text = tx("Denaturation is irreversible", "Denaturierung ist irreversibel");
const sameItem = (a: Text, b: Text) => JSON.stringify(a) === JSON.stringify(b);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Concepts (choice)

type Fact = { q: Text; opts: Opt[]; hint: Text; frame: Frame };

const FACTS: Fact[] = [
  {
    q: tx("What is the active site of an enzyme?", "Was ist das aktive Zentrum eines Enzyms?"),
    opts: [
      { text: tx("the region where the substrate binds and is converted", "der Bereich, in dem das Substrat bindet und umgesetzt wird") },
      { text: tx("the place in the cell where the enzyme is made", "der Ort in der Zelle, an dem das Enzym gebildet wird"), title: tx("Part of the enzyme", "Ein Teil des Enzyms"), say: tx("The active site is a part of the enzyme molecule itself: the pocket where the substrate binds.", "Das aktive Zentrum ist ein Teil des Enzymmoleküls selbst: die Tasche, in der das Substrat bindet.") },
      { text: tx("the substrate after binding", "das Substrat nach der Bindung"), title: tx("That's the complex", "Das ist der Komplex"), say: tx("Enzyme plus bound substrate is the enzyme-substrate complex. The active site is the pocket in the enzyme.", "Enzym plus gebundenes Substrat ist der Enzym-Substrat-Komplex. Das aktive Zentrum ist die Tasche im Enzym.") },
      { text: tx("the part of the enzyme that is used up", "der Teil des Enzyms, der verbraucht wird"), title: USED_UP, say: tx("No part of the enzyme is used up. The active site is ready again after every reaction.", "Kein Teil des Enzyms wird verbraucht. Das aktive Zentrum ist nach jeder Reaktion wieder frei.") },
    ],
    hint: tx("It's where the key goes in.", "Hier steckt der Schlüssel drin."),
    frame: { math: tx('"active site" = "binding pocket"', '"aktives Zentrum" = "Bindungstasche"'), note: tx("The **active site** is a pocket whose shape and chemical properties match the substrate.", "Das **aktive Zentrum** ist eine Tasche, deren Form und chemische Eigenschaften zum Substrat passen.") },
  },
  {
    q: tx("Why does an enzyme stop working above about 45 °C?", "Warum arbeitet ein menschliches Enzym oberhalb von etwa 45 °C nicht mehr richtig?"),
    opts: [
      { text: tx("Its folded structure breaks down and the active site is deformed.", "Seine räumliche Struktur zerfällt und das aktive Zentrum verformt sich.") },
      { text: tx("It is used up faster at high temperatures.", "Es wird bei hohen Temperaturen schneller verbraucht."), title: USED_UP, say: tx("Enzymes are never used up, not even when it's hot. Heat destroys their **shape** (denaturation).", "Enzyme werden nie verbraucht, auch nicht bei Hitze. Hitze zerstört ihre **Form** (Denaturierung).") },
      { text: tx("The enzyme dies of the heat.", "Das Enzym stirbt an der Hitze."), title: tx("Enzymes aren't alive", "Enzyme leben nicht"), say: tx("Enzymes are proteins, not living things. Heat destroys their spatial structure.", "Enzyme sind Proteine, keine Lebewesen. Hitze zerstört ihre räumliche Struktur.") },
      { text: tx("The particles move too slowly.", "Die Teilchen bewegen sich zu langsam."), title: tx("Too slow is cold", "Zu langsam ist Kälte"), say: tx("At high temperatures particles move **faster**. Slow particles are the problem in the cold.", "Bei hohen Temperaturen bewegen sich die Teilchen **schneller**. Langsame Teilchen sind das Problem bei Kälte.") },
    ],
    hint: tx("Think of what happens to egg white in a hot pan.", "Denk daran, was mit Eiklar in der heißen Pfanne passiert."),
    frame: { math: tx('"heat" \\Rightarrow "denaturation"', '"Hitze" \\Rightarrow "Denaturierung"'), note: tx("Heat breaks the bonds that hold the protein in shape. The active site is deformed: **denaturation**, irreversible.", "Hitze bricht die Bindungen, die das Protein in Form halten. Das aktive Zentrum verformt sich: **Denaturierung**, irreversibel.") },
  },
  {
    q: tx("What happens to an enzyme at 0 °C?", "Was passiert mit einem Enzym bei 0 °C?"),
    opts: [
      { text: tx("It works very slowly, but is not damaged.", "Es arbeitet sehr langsam, wird aber nicht geschädigt.") },
      { text: tx("It is denatured by the cold.", "Es wird durch die Kälte denaturiert."), title: COLD, say: tx("Classic trap! Cold only slows enzymes down: the particles move slowly. Warm it up and it works again. Only heat denatures.", "Die klassische Falle! Kälte bremst Enzyme nur: Die Teilchen bewegen sich langsam. Erwärmst du es, arbeitet es wieder. Nur Hitze denaturiert.") },
      { text: tx("It works faster, because the substrate is closer together.", "Es arbeitet schneller, weil das Substrat dichter beieinander ist."), title: tx("Cold slows down", "Kälte bremst"), say: tx("In the cold the particles move slowly and collide less often. The reaction gets slower.", "Bei Kälte bewegen sich die Teilchen langsam und stoßen seltener zusammen. Die Reaktion wird langsamer.") },
      { text: tx("It is used up more slowly.", "Es wird langsamer verbraucht."), title: USED_UP, say: tx("Enzymes are never used up, whatever the temperature.", "Enzyme werden nie verbraucht, egal bei welcher Temperatur.") },
    ],
    hint: tx("Why do we keep food in the fridge?", "Warum bewahren wir Lebensmittel im Kühlschrank auf?"),
    frame: { math: tx('0 \\deg"C" \\Rightarrow "slow, but intact"', '0 \\deg"C" \\Rightarrow "langsam, aber intakt"'), note: tx("Cold slows the particles down: few collisions, low activity. Warmed up again, the enzyme works normally (reversible).", "Kälte bremst die Teilchen: wenige Zusammenstöße, geringe Aktivität. Wieder erwärmt arbeitet das Enzym normal (reversibel).") },
  },
  {
    q: tx("What does an enzyme do in the energy diagram of a reaction?", "Was bewirkt ein Enzym im Energiediagramm einer Reaktion?"),
    opts: [
      { text: tx("It lowers the activation energy.", "Es senkt die Aktivierungsenergie.") },
      { text: tx("It supplies the activation energy.", "Es liefert die Aktivierungsenergie."), title: tx("No energy source", "Keine Energiequelle"), say: tx("Enzymes don't supply energy. They make the energy hill **lower**, so less energy is needed.", "Enzyme liefern keine Energie. Sie machen den Energieberg **niedriger**, sodass weniger Energie nötig ist.") },
      { text: tx("It increases the energy released.", "Es vergrößert die frei werdende Energie."), title: tx("ΔE stays the same", "ΔE bleibt gleich"), say: tx("The energy of substrate and products doesn't change, so ΔE stays exactly the same. Only the hill gets lower.", "Die Energie von Substrat und Produkten ändert sich nicht, ΔE bleibt also genau gleich. Nur der Berg wird niedriger.") },
      { text: tx("It raises the energy of the products.", "Es erhöht die Energie der Produkte."), title: tx("ΔE stays the same", "ΔE bleibt gleich"), say: tx("Substrate and products keep their energy. The enzyme only changes the path in between.", "Substrat und Produkte behalten ihre Energie. Das Enzym verändert nur den Weg dazwischen.") },
    ],
    hint: tx("The start and the end of the curve stay where they are.", "Anfang und Ende der Kurve bleiben, wo sie sind."),
    frame: { math: "E_A \\downarrow \\quad \\Delta E = \\Delta E", note: tx("Enzymes lower the **activation energy** $E_A$. The energy difference ΔE between substrate and products stays the same.", "Enzyme senken die **Aktivierungsenergie** $E_A$. Der Energieunterschied ΔE zwischen Substrat und Produkten bleibt gleich.") },
  },
  {
    q: tx("Amylase splits starch, but not cellulose, although both are made of glucose. What does this show?", "Amylase spaltet Stärke, aber keine Cellulose, obwohl beide aus Glucose bestehen. Was zeigt das?"),
    opts: [
      { text: tx("substrate specificity", "die Substratspezifität") },
      { text: tx("reaction specificity", "die Wirkungsspezifität"), title: tx("It's about which substrate", "Es geht ums Substrat"), say: tx("Reaction specificity is about **which reaction** happens. Here the question is **which substrate** is accepted at all.", "Bei der Wirkungsspezifität geht es darum, **welche Reaktion** abläuft. Hier geht es darum, **welches Substrat** überhaupt angenommen wird.") },
      { text: tx("denaturation", "die Denaturierung"), title: tx("Nothing is destroyed", "Nichts wird zerstört"), say: tx("The amylase is intact. Cellulose simply doesn't fit into its active site.", "Die Amylase ist intakt. Cellulose passt einfach nicht in ihr aktives Zentrum.") },
      { text: tx("saturation", "die Sättigung") },
    ],
    hint: tx("The bonds in cellulose don't fit the active site of amylase.", "Die Bindungen in der Cellulose passen nicht ins aktive Zentrum der Amylase."),
    frame: { math: tx('"amylase:" "starch" \\quad \\strike{"cellulose"}', '"Amylase:" "Stärke" \\quad \\strike{"Cellulose"}'), note: tx("**Substrate specificity**: an enzyme only accepts substrates that fit its active site (lock and key).", "**Substratspezifität**: Ein Enzym nimmt nur Substrate an, die in sein aktives Zentrum passen (Schlüssel-Schloss-Prinzip).") },
  },
  {
    q: tx("Two different enzymes convert the same amino acid: one splits off CO₂, the other removes the amino group. What does this show?", "Zwei verschiedene Enzyme setzen dieselbe Aminosäure um: Eines spaltet CO₂ ab, das andere entfernt die Aminogruppe. Was zeigt das?"),
    opts: [
      { text: tx("reaction specificity", "die Wirkungsspezifität") },
      { text: tx("substrate specificity", "die Substratspezifität"), title: tx("Same substrate here", "Hier gleiches Substrat"), say: tx("Both enzymes take the **same** substrate. The difference is the reaction each one catalyses: that's reaction specificity.", "Beide Enzyme nehmen **dasselbe** Substrat. Der Unterschied ist die Reaktion, die jedes katalysiert: Das ist Wirkungsspezifität.") },
      { text: tx("that enzymes are used up", "dass Enzyme verbraucht werden"), title: USED_UP, say: tx("Enzymes are never used up. Each one catalyses only its own reaction.", "Enzyme werden nie verbraucht. Jedes katalysiert nur seine eigene Reaktion.") },
    ],
    hint: tx("Same substrate, different products.", "Gleiches Substrat, verschiedene Produkte."),
    frame: { math: tx('"amino acid" \\to "amine" + \\ce{CO2} \\\\ "amino acid" \\to "keto acid" + \\ce{NH3}', '"Aminosäure" \\to "Amin" + \\ce{CO2} \\\\ "Aminosäure" \\to "Ketosäure" + \\ce{NH3}'), note: tx("**Reaction specificity**: each enzyme catalyses only one particular reaction of its substrate.", "**Wirkungsspezifität**: Jedes Enzym katalysiert nur eine bestimmte Reaktion seines Substrats.") },
  },
  {
    q: tx("Why does pepsin from the stomach stop working in the small intestine (pH 8)?", "Warum arbeitet Pepsin aus dem Magen im Dünndarm (pH 8) nicht mehr?"),
    opts: [
      { text: tx("Its pH optimum is about 2: at pH 8 the charges in the active site change.", "Sein pH-Optimum liegt bei etwa 2: Bei pH 8 ändern sich die Ladungen im aktiven Zentrum.") },
      { text: tx("It has been used up in the stomach.", "Es wurde im Magen verbraucht."), title: USED_UP, say: tx("Enzymes aren't used up. Pepsin needs an acidic environment: in the slightly basic small intestine it's far from its optimum.", "Enzyme werden nicht verbraucht. Pepsin braucht saure Umgebung: Im leicht basischen Dünndarm ist es weit weg von seinem Optimum.") },
      { text: tx("The small intestine is too warm.", "Im Dünndarm ist es zu warm."), title: tx("Same temperature", "Gleiche Temperatur"), say: tx("Stomach and small intestine are both at about 37 °C. The difference is the **pH**.", "Magen und Dünndarm haben beide etwa 37 °C. Der Unterschied ist der **pH-Wert**.") },
      { text: tx("Pepsin only splits starch.", "Pepsin spaltet nur Stärke."), title: tx("Pepsin splits proteins", "Pepsin spaltet Proteine"), say: tx("Pepsin splits proteins. The reason here is the pH.", "Pepsin spaltet Proteine. Der Grund hier ist der pH-Wert.") },
    ],
    hint: tx("The stomach contains hydrochloric acid.", "Im Magen ist Salzsäure."),
    frame: { math: tx('"pepsin:" "pH" 2 \\quad "small intestine:" "pH" 8', '"Pepsin:" "pH" 2 \\quad "Dünndarm:" "pH" 8'), note: tx("Every enzyme has its **pH optimum**. Far from it, the charges in the active site change and the substrate no longer binds well.", "Jedes Enzym hat sein **pH-Optimum**. Weit davon entfernt ändern sich die Ladungen im aktiven Zentrum, das Substrat bindet nicht mehr gut.") },
  },
  {
    q: tx("Nearly all active sites are occupied. How can you make the reaction faster?", "Fast alle aktiven Zentren sind besetzt. Wie machst du die Reaktion schneller?"),
    opts: [
      { text: tx("add more enzyme", "mehr Enzym zugeben") },
      { text: tx("add more substrate", "mehr Substrat zugeben"), title: tx("Saturated", "Gesättigt"), say: tx("At saturation every active site is already busy. More substrate just has to wait. More enzyme means more active sites.", "Bei Sättigung ist jedes aktive Zentrum schon beschäftigt. Mehr Substrat muss nur warten. Mehr Enzym heißt mehr aktive Zentren.") },
      { text: tx("heat it to 80 °C", "auf 80 °C erhitzen"), title: tx("Denatured", "Denaturiert"), say: tx("At 80 °C a human enzyme is denatured. Then nothing works any more.", "Bei 80 °C ist ein menschliches Enzym denaturiert. Dann geht gar nichts mehr.") },
      { text: tx("cool it to 5 °C", "auf 5 °C abkühlen"), title: tx("Cold slows down", "Kälte bremst"), say: tx("Cold makes the particles slower, so the reaction gets slower, not faster.", "Kälte macht die Teilchen langsamer, die Reaktion wird also langsamer, nicht schneller.") },
    ],
    hint: tx("What limits the rate when all enzymes are busy?", "Was begrenzt das Tempo, wenn alle Enzyme beschäftigt sind?"),
    frame: { math: tx('"saturation:" \\; "more enzyme" \\Rightarrow "faster"', '"Sättigung:" \\; "mehr Enzym" \\Rightarrow "schneller"'), note: tx("At **saturation** the amount of enzyme limits the rate. Twice the enzyme, twice the maximum rate.", "Bei **Sättigung** begrenzt die Enzymmenge das Tempo. Doppelt so viel Enzym, doppelte Höchstgeschwindigkeit.") },
  },
  {
    q: tx("What happens in the enzyme-substrate complex?", "Was passiert im Enzym-Substrat-Komplex?"),
    opts: [
      { text: tx("The bound substrate is converted into products.", "Das gebundene Substrat wird zu Produkten umgesetzt.") },
      { text: tx("The enzyme is converted into products.", "Das Enzym wird zu Produkten umgesetzt."), title: USED_UP, say: tx("The products come from the substrate. The enzyme comes out unchanged.", "Die Produkte entstehen aus dem Substrat. Das Enzym geht unverändert hervor.") },
      { text: tx("The enzyme is made.", "Das Enzym wird gebildet."), title: tx("Already there", "Schon fertig"), say: tx("The enzyme is made by the cell beforehand. In the complex it does its job: converting the substrate.", "Das Enzym bildet die Zelle vorher. Im Komplex erledigt es seine Arbeit: Es setzt das Substrat um.") },
      { text: tx("The enzyme is denatured.", "Das Enzym wird denaturiert.") },
    ],
    hint: tx("E + S → ES → E + P", "E + S → ES → E + P"),
    frame: { math: "E + S \\to ES \\to E + P", note: tx("In the complex ES the substrate is converted. Then the products P leave and the enzyme E is free again.", "Im Komplex ES wird das Substrat umgesetzt. Dann lösen sich die Produkte P, und das Enzym E ist wieder frei.") },
  },
  {
    q: tx("Biological washing powder works well at 40 °C but hardly at all at 95 °C. Why?", "Ein Waschmittel mit Enzymen wirkt bei 40 °C gut, bei 95 °C kaum. Warum?"),
    opts: [
      { text: tx("At 95 °C the enzymes are denatured.", "Bei 95 °C werden die Enzyme denaturiert.") },
      { text: tx("At 95 °C the stains are already dissolved.", "Bei 95 °C sind die Flecken schon gelöst.") },
      { text: tx("At 95 °C the enzymes are used up immediately.", "Bei 95 °C werden die Enzyme sofort verbraucht."), title: USED_UP, say: tx("Enzymes aren't used up. The heat destroys their spatial structure: denaturation.", "Enzyme werden nicht verbraucht. Die Hitze zerstört ihre räumliche Struktur: Denaturierung.") },
      { text: tx("Enzymes only work below 0 °C.", "Enzyme arbeiten nur unter 0 °C."), title: tx("Cold slows down", "Kälte bremst"), say: tx("Below 0 °C enzymes hardly work at all: the particles are too slow.", "Unter 0 °C arbeiten Enzyme kaum: Die Teilchen sind zu langsam.") },
    ],
    hint: tx("Enzymes are proteins.", "Enzyme sind Proteine."),
    frame: { math: tx('95 \\deg"C" \\Rightarrow "denaturation"', '95 \\deg"C" \\Rightarrow "Denaturierung"'), note: tx("The enzymes in washing powder are proteins too. At 95 °C they are denatured.", "Auch Waschmittel-Enzyme sind Proteine. Bei 95 °C werden sie denaturiert.") },
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: PICK, text: f.q, answer: c.answer, hint: f.hint, solution: [f.frame], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Temperature graph

type Origin = "cold" | "human" | "wash" | "hot";
const originOf = (opt: number): Origin => (opt <= 20 ? "cold" : opt <= 40 ? "human" : opt <= 60 ? "wash" : "hot");
const ORIGIN: Record<Origin, Text> = {
  cold: tx("a fish from the Arctic Sea", "einem Fisch aus dem Nordpolarmeer"),
  human: tx("a human", "einem Menschen"),
  wash: tx("a bacterium, used in washing powder", "einem Bakterium für Waschmittel"),
  hot: tx("a bacterium from a hot spring", "einem Bakterium aus einer heißen Quelle"),
};

function tempGraphTask(rng: Rng): Exercise {
  const src = rng.pick(TEMP_SOURCES);
  const opt = src.opt;
  const xMax = opt >= 60 ? 100 : 80;
  const kind = rng.pick(["read", "read", "origin", "after"] as const);
  const graph = visual(EnzymeTempGraph, { curves: [{ opt }], xMax });

  if (kind === "read") {
    const right: AnswerSpec = { kind: "number", value: opt, tolerance: 2.5 / opt, unit: "°C" };
    const m = mistakes(right);
    m.add({ kind: "number", value: 100 }, tx("That's the activity", "Das ist die Aktivität"), tx("100 is the activity on the y-axis. The optimum is the **temperature** below the peak: read it on the x-axis.", "100 ist die Aktivität auf der y-Achse. Das Optimum ist die **Temperatur** unter dem Gipfel: Lies sie auf der x-Achse ab."));
    if (Math.abs(opt - 37) > 4)
      m.add({ kind: "number", value: 37 }, tx("Not every enzyme likes 37 °C", "Nicht jedes Enzym mag 37 °C"), tx("37 °C is typical for human enzymes. This enzyme comes from somewhere else: read its optimum off the graph.", "37 °C ist typisch für Enzyme des Menschen. Dieses Enzym stammt aus einem anderen Lebewesen: Lies sein Optimum im Diagramm ab."));
    return {
      instruction: tx("Read off the optimum", "Lies das Optimum ab"),
      text: tx(`The graph shows the activity of an enzyme from ${resolveText(src.who, "en")}. At which temperature does it work fastest?`, `Das Diagramm zeigt die Aktivität eines Enzyms aus ${resolveText(src.who, "de")}. Bei welcher Temperatur arbeitet es am schnellsten?`),
      visual: graph,
      answer: right,
      hint: tx("Find the highest point of the curve and go straight down to the x-axis.", "Such den höchsten Punkt der Kurve und geh senkrecht nach unten zur x-Achse."),
      solution: [
        { math: tx(`"peak" \\Rightarrow ${opt} \\deg"C"`, `"Gipfel" \\Rightarrow ${opt} \\deg"C"`), note: tx(`The curve is highest at about **${opt} °C**: that's the temperature optimum.`, `Die Kurve ist bei etwa **${opt} °C** am höchsten: Das ist das Temperaturoptimum.`) },
        { math: tx(`< ${opt} \\deg"C": "RGT rule" \\quad > ${opt} \\deg"C": "denaturation"`, `< ${opt} \\deg"C": "RGT-Regel" \\quad > ${opt} \\deg"C": "Denaturierung"`), note: tx("Below the optimum the rate rises with temperature (RGT rule). Above it the enzyme is denatured and the activity drops steeply.", "Unter dem Optimum steigt die Geschwindigkeit mit der Temperatur (RGT-Regel). Darüber wird das Enzym denaturiert, die Aktivität fällt steil ab.") },
      ],
      mistakes: m.list,
    };
  }

  if (kind === "origin") {
    const right = originOf(opt);
    const opts: Opt[] = [
      { text: ORIGIN[right] },
      ...(["cold", "human", "wash", "hot"] as Origin[])
        .filter((o) => o !== right)
        .map((o) =>
          o === "human"
            ? { text: ORIGIN[o], title: tx("Not every enzyme likes 37 °C", "Nicht jedes Enzym mag 37 °C"), say: tx("Human enzymes have their optimum at about 37 °C. Look where the peak of this curve is.", "Enzyme des Menschen haben ihr Optimum bei etwa 37 °C. Schau, wo der Gipfel dieser Kurve liegt.") }
            : { text: ORIGIN[o] },
        ),
    ];
    const c = choice(rng, opts);
    return {
      instruction: PICK,
      text: tx("Which living thing does this enzyme most likely come from?", "Aus welchem Lebewesen stammt dieses Enzym am ehesten?"),
      visual: graph,
      answer: c.answer,
      hint: tx("An enzyme works best at the temperature at which its organism lives.", "Ein Enzym arbeitet am besten bei der Temperatur, bei der sein Lebewesen lebt."),
      solution: [{ math: tx(`"optimum" \\approx ${opt} \\deg"C"`, `"Optimum" \\approx ${opt} \\deg"C"`), note: tx(`The optimum is about ${opt} °C. That fits ${resolveText(ORIGIN[right], "en")}: enzymes are adapted to the temperature their organism lives at.`, `Das Optimum liegt bei etwa ${opt} °C. Das passt zu ${resolveText(ORIGIN[right], "de")}: Enzyme sind an die Temperatur angepasst, bei der ihr Lebewesen lebt.`) }],
      mistakes: c.mistakes,
    };
  }

  // heated or cooled first, then back to the optimum
  const hot = rng.chance(0.5);
  const t2 = hot ? opt + 25 : Math.max(0, opt - 30);
  const opts: Opt[] = hot
    ? [
        { text: tx("It stays almost inactive.", "Es bleibt fast inaktiv.") },
        { text: tx("It works as well as before.", "Es arbeitet wieder so gut wie vorher."), title: IRREV, say: tx("Once denatured, the protein doesn't fold back correctly. The damage stays, even after cooling down.", "Einmal denaturiert, faltet sich das Protein nicht wieder richtig zurück. Der Schaden bleibt, auch nach dem Abkühlen.") },
        { text: tx("It works faster than before.", "Es arbeitet schneller als vorher.") },
      ]
    : [
        { text: tx("It works as well as before.", "Es arbeitet wieder so gut wie vorher.") },
        { text: tx("It stays almost inactive.", "Es bleibt fast inaktiv."), title: COLD, say: tx("Cold doesn't denature enzymes, it only slows them down. Warmed up again they work normally.", "Kälte denaturiert Enzyme nicht, sie bremst sie nur. Wieder erwärmt arbeiten sie normal.") },
        { text: tx("It works faster than before.", "Es arbeitet schneller als vorher.") },
      ];
  const c = choice(rng, opts);
  return {
    instruction: PICK,
    text: txMap((tt) =>
      tt(
        `This enzyme is ${hot ? "heated" : "cooled"} to ${t2} °C for 10 minutes and then brought back to ${opt} °C. How does it work now?`,
        `Dieses Enzym wird 10 Minuten lang auf ${t2} °C ${hot ? "erhitzt" : "abgekühlt"} und dann wieder auf ${opt} °C gebracht. Wie arbeitet es jetzt?`,
      ),
    ),
    visual: graph,
    answer: c.answer,
    hint: hot ? tx("What happens to a protein far above the optimum?", "Was passiert mit einem Protein weit über dem Optimum?") : tx("Does cold change the shape of the enzyme?", "Verändert Kälte die Form des Enzyms?"),
    solution: [
      hot
        ? { math: tx(`${t2} \\deg"C" \\Rightarrow "denatured" \\Rightarrow "irreversible"`, `${t2} \\deg"C" \\Rightarrow "denaturiert" \\Rightarrow "irreversibel"`), note: tx("At this temperature the enzyme is denatured. Denaturation is irreversible: cooling down doesn't bring the active site back.", "Bei dieser Temperatur wird das Enzym denaturiert. Die Denaturierung ist irreversibel: Abkühlen bringt das aktive Zentrum nicht zurück.") }
        : { math: tx(`${t2} \\deg"C" \\Rightarrow "slow" \\Rightarrow "reversible"`, `${t2} \\deg"C" \\Rightarrow "langsam" \\Rightarrow "reversibel"`), note: tx("In the cold the particles are just slow. The enzyme keeps its shape, so back at the optimum it works normally again.", "In der Kälte sind die Teilchen nur langsam. Das Enzym behält seine Form, also arbeitet es am Optimum wieder normal.") },
    ],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// pH graph

const acidity = (ph: number): Text => (ph < 4 ? tx("very acidic", "sehr sauer") : ph < 6.5 ? tx("acidic", "sauer") : ph <= 7.5 ? tx("about neutral", "etwa neutral") : tx("basic", "basisch"));

function phGraphTask(rng: Rng): Exercise {
  const target = rng.pick(PH_ENZYMES);
  const others = rng.shuffle(PH_ENZYMES.filter((e) => e.id !== target.id && Math.abs(e.opt - target.opt) >= 2)).slice(0, 2);
  const shown: PhEnzyme[] = rng.shuffle([target, ...others]);
  const labels = shown.map((_, i) => String(i + 1));
  const graph = visual(EnzymePhGraph, { curves: shown.map((e, i) => ({ opt: e.opt, width: e.width, label: labels[i] })) });
  const k = shown.indexOf(target);

  if (rng.chance(0.6)) {
    const options = shown.map((_, i) => tx(`curve ${i + 1}`, `Kurve ${i + 1}`));
    const ms: Mistake[] = shown.flatMap((e, i) =>
      i === k
        ? []
        : [
            {
              when: { kind: "choice", options, correct: i } as AnswerSpec,
              title: tx("Look at where it works", "Schau, wo es arbeitet"),
              say: tx(
                `Curve ${i + 1} has its optimum at pH ${e.opt}. But ${resolveText(target.name, "en")} works ${resolveText(target.place, "en")}, where it is ${resolveText(acidity(target.opt), "en")}.`,
                `Kurve ${i + 1} hat ihr Optimum bei pH ${e.opt}. ${target.de.nom} arbeitet aber ${resolveText(target.place, "de")}, und dort ist es ${resolveText(acidity(target.opt), "de")}.`,
              ),
            },
          ],
    );
    return {
      instruction: tx("Match the curve", "Ordne die Kurve zu"),
      text: tx(
        `Which curve belongs to ${resolveText(target.name, "en")}? It works ${resolveText(target.place, "en")}, where it is ${resolveText(acidity(target.opt), "en")}.`,
        `Welche Kurve gehört ${target.de.zu}? ${target.de.pron} arbeitet ${resolveText(target.place, "de")}, dort ist es ${resolveText(acidity(target.opt), "de")}.`,
      ),
      visual: graph,
      answer: { kind: "choice", options, correct: k },
      hint: tx("Every enzyme works best at the pH of the place where it works.", "Jedes Enzym arbeitet am besten beim pH-Wert des Ortes, an dem es arbeitet."),
      solution: [
        {
          math: txMap((tt, l) => `"${tt("curve", "Kurve")} ${k + 1}:" \\; "${tt("pH", "pH")}" \\approx ${dec(target.opt, l)}`),
          note: tx(
            `${cap(resolveText(target.name, "en"))} works ${resolveText(target.place, "en")} (${resolveText(acidity(target.opt), "en")}): its optimum is about pH ${target.opt}. That's curve ${k + 1}.`,
            `${target.de.nom} arbeitet ${resolveText(target.place, "de")} (${resolveText(acidity(target.opt), "de")}): ${target.de.poss} Optimum liegt bei etwa pH ${target.opt}. Das ist Kurve ${k + 1}.`,
          ),
        },
      ],
      mistakes: ms,
    };
  }
  const right: AnswerSpec = { kind: "number", value: target.opt, tolerance: 0.4 / Math.max(1, target.opt) };
  const m = mistakes(right);
  m.add({ kind: "number", value: 100 }, tx("That's the activity", "Das ist die Aktivität"), tx("100 % is the activity at the peak. The pH optimum is the **x-value** below the peak.", "100 % ist die Aktivität am Gipfel. Das pH-Optimum ist der **x-Wert** unter dem Gipfel."));
  for (const e of others) m.add({ kind: "number", value: e.opt }, tx("Wrong curve", "Falsche Kurve"), tx(`That's the optimum of another curve. Read off curve ${k + 1}.`, `Das ist das Optimum einer anderen Kurve. Lies Kurve ${k + 1} ab.`));
  return {
    instruction: tx("Read off the pH optimum", "Lies das pH-Optimum ab"),
    text: tx(`At which pH does the enzyme of curve ${k + 1} work fastest?`, `Bei welchem pH-Wert arbeitet das Enzym von Kurve ${k + 1} am schnellsten?`),
    visual: graph,
    answer: right,
    hint: tx("Go from the peak of the curve straight down to the pH axis.", "Geh vom Gipfel der Kurve senkrecht nach unten zur pH-Achse."),
    solution: [
      {
        math: txMap((tt, l) => `"${tt("optimum", "Optimum")}" \\approx "${tt("pH", "pH")}" \\; ${dec(target.opt, l)}`),
        note: tx(
          `Curve ${k + 1} peaks at pH ${target.opt}. That fits ${resolveText(target.name, "en")}, which works ${resolveText(target.place, "en")}.`,
          `Kurve ${k + 1} hat ihren Gipfel bei pH ${target.opt}. Das passt ${target.de.zu}, ${target.de.rel} ${resolveText(target.place, "de")} arbeitet.`,
        ),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// RGT rule (numbers)

const PER_MIN: Text = tx("µmol per min", "µmol pro min");

function rgtTask(rng: Rng): Exercise {
  if (rng.chance(0.2)) {
    const t1 = rng.pick([20, 25, 30]);
    const t2 = t1 + 30;
    const c = choice(rng, [
      { text: tx("The RGT rule only applies below the optimum. At this temperature the enzyme is denatured.", "Die RGT-Regel gilt nur unterhalb des Optimums. Bei dieser Temperatur ist das Enzym denaturiert.") },
      { text: tx("Nothing, the calculation is right.", "Nichts, die Rechnung stimmt."), title: tx("Mind the optimum", "Achte aufs Optimum"), say: tx("Above about 45 °C a human enzyme is denatured. The rule can't go on forever.", "Über etwa 45 °C wird ein menschliches Enzym denaturiert. Die Regel kann nicht ewig weitergehen.") },
      { text: tx("The factor should be 10, not 2.", "Der Faktor müsste 10 sein, nicht 2."), title: tx("Factor 2 to 3", "Faktor 2 bis 3"), say: tx("The RGT rule says 2 to 3 times per 10 °C. The real problem is that the enzyme is denatured.", "Die RGT-Regel sagt 2- bis 3-mal pro 10 °C. Das eigentliche Problem ist, dass das Enzym denaturiert wird.") },
      { text: tx("Enzymes get used up faster when it's hot.", "Enzyme werden bei Wärme schneller verbraucht."), title: USED_UP, say: tx("Enzymes aren't used up. But too much heat denatures them.", "Enzyme werden nicht verbraucht. Aber zu viel Hitze denaturiert sie.") },
    ]);
    return {
      instruction: tx("Find the error", "Finde den Fehler"),
      text: txMap((tt) =>
        tt(
          `A human enzyme converts 4 µmol substrate per minute at ${t1} °C. Mia calculates with the RGT rule: at ${t2} °C it should be 4 · 2 · 2 · 2 = 32 µmol per minute. What's wrong?`,
          `Ein Enzym des Menschen setzt bei ${t1} °C 4 µmol Substrat pro Minute um. Mia rechnet mit der RGT-Regel: Bei ${t2} °C müssten es 4 · 2 · 2 · 2 = 32 µmol pro Minute sein. Was ist falsch?`,
        ),
      ),
      visual: visual(EnzymeTempGraph, { curves: [{ opt: 37 }], xMax: 80 }),
      answer: c.answer,
      hint: tx("Look at the graph: what happens above 40 °C?", "Schau ins Diagramm: Was passiert über 40 °C?"),
      solution: [{ math: tx(`${t2} \\deg"C" > "optimum" \\Rightarrow "denaturation"`, `${t2} \\deg"C" > "Optimum" \\Rightarrow "Denaturierung"`), note: tx(`The RGT rule only works below the optimum. At ${t2} °C the enzyme is largely denatured: the rate drops instead of rising.`, `Die RGT-Regel gilt nur unterhalb des Optimums. Bei ${t2} °C ist das Enzym weitgehend denaturiert: Die Geschwindigkeit sinkt, statt zu steigen.`) }],
      mistakes: c.mistakes,
    };
  }
  const f = rng.pick([2, 2, 3]);
  const k = rng.pick([1, 2, 2]);
  const down = rng.chance(0.25);
  const base = rng.pick([2, 3, 4, 5, 6, 8]);
  const fk = f ** k;
  const t1 = down ? rng.pick([30, 35]) : rng.pick([10, 15]);
  const t2 = down ? t1 - 10 * k : t1 + 10 * k;
  const v1 = down ? base * fk : base;
  const v2 = down ? base : base * fk;
  const right: AnswerSpec = { kind: "number", value: v2, unit: PER_MIN };
  const m = mistakes(right);
  if (down) {
    m.add({ kind: "number", value: v1 * fk }, tx("Colder means slower", "Kälter heißt langsamer"), tx(`It gets ${10 * k} °C **colder**, so divide by ${f}${k > 1 ? " twice" : ""}, don't multiply.`, `Es wird ${10 * k} °C **kälter**, also ${k > 1 ? "zweimal " : ""}durch ${f} teilen, nicht malnehmen.`));
    if (k === 2) m.add({ kind: "number", value: v1 / f }, tx("Twice 10 °C", "Zweimal 10 °C"), tx(`${10 * k} °C are two steps of 10 °C, so the factor ${f} applies **twice**.`, `${10 * k} °C sind zwei Schritte von je 10 °C, der Faktor ${f} gilt also **zweimal**.`), true);
  } else {
    if (k === 2) m.add({ kind: "number", value: v1 * f }, tx("Twice 10 °C", "Zweimal 10 °C"), tx(`${10 * k} °C are two steps of 10 °C, so the factor ${f} applies **twice**: ×${f}, then ×${f} again.`, `${10 * k} °C sind zwei Schritte von je 10 °C, der Faktor ${f} gilt also **zweimal**: ×${f} und dann noch mal ×${f}.`), true);
    m.add({ kind: "number", value: v1 + (f - 1) * v1 * k }, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx(`You added the same amount for each 10 °C. With the RGT rule the rate is **multiplied** by ${f} each time.`, `Du hast pro 10 °C immer denselben Betrag addiert. Bei der RGT-Regel wird die Geschwindigkeit jedes Mal **mal ${f}** genommen.`));
    m.add({ kind: "number", value: v1 * f * 10 * k }, tx("Degrees aren't the factor", "Grad sind nicht der Faktor"), tx(`You multiplied by the degrees. The rule counts steps of 10 °C: ${10 * k} °C are ${k} step${k > 1 ? "s" : ""}.`, `Du hast mit den Grad multipliziert. Die Regel zählt Schritte von 10 °C: ${10 * k} °C sind ${k} Schritt${k > 1 ? "e" : ""}.`));
  }
  const factorText = f === 2 ? tx("doubles", "verdoppelt") : tx("triples", "verdreifacht");
  return {
    instruction: tx("Use the RGT rule", "Wende die RGT-Regel an"),
    text: txMap((tt, l) =>
      tt(
        `An enzyme converts ${v1} µmol substrate per minute at ${t1} °C. Assume the rate ${resolveText(factorText, l)} with every 10 °C. How much does it convert at ${t2} °C?`,
        `Ein Enzym setzt bei ${t1} °C ${v1} µmol Substrat pro Minute um. Nimm an, dass sich die Geschwindigkeit pro 10 °C ${resolveText(factorText, l)}. Wie viel setzt es bei ${t2} °C um?`,
      ),
    ),
    answer: right,
    hint: down ? tx("Colder means slower: divide by the factor for each 10 °C step.", "Kälter heißt langsamer: Teile für jeden 10-°C-Schritt durch den Faktor.") : tx("Count the 10 °C steps, then multiply by the factor once per step.", "Zähl die 10-°C-Schritte und nimm für jeden Schritt einmal den Faktor."),
    solution: [
      { math: tx(`${t1} \\deg"C" \\to ${t2} \\deg"C": \\; ${k} "step${k > 1 ? "s" : ""}"`, `${t1} \\deg"C" \\to ${t2} \\deg"C": \\; ${k} "Schritt${k > 1 ? "e" : ""}"`), note: tx(`From ${t1} °C to ${t2} °C there ${k > 1 ? "are" : "is"} ${k} step${k > 1 ? "s" : ""} of 10 °C. Both temperatures are below the optimum, so the rule applies.`, `Von ${t1} °C bis ${t2} °C ${k > 1 ? "sind es" : "ist es"} ${k} Schritt${k > 1 ? "e" : ""} von 10 °C. Beide Temperaturen liegen unter dem Optimum, die Regel gilt also.`) },
      { math: down ? `${v1} : ${f}${k > 1 ? ` : ${f}` : ""} = ${v2}` : `${v1} \\cdot ${f}${k > 1 ? ` \\cdot ${f}` : ""} = ${v2}`, note: tx(`So **${v2} µmol per minute**.`, `Also **${v2} µmol pro Minute**.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Energy diagram

function energyTask(rng: Rng): Exercise {
  const exo = rng.chance(0.7);
  const nums = rng.shuffle(["1", "2", "3"]);
  const labels = nums as [string, string, string]; // [EA without, EA with, ΔE]
  const ask = rng.pick(["with", "without", "delta"] as const);
  const idx = { without: 0, with: 1, delta: 2 }[ask];
  const options = ["1", "2", "3"].map((d) => tx(`arrow ${d}`, `Pfeil ${d}`));
  const correct = Number(labels[idx]) - 1;
  const name = { without: 0, with: 1, delta: 2 };
  const say: Record<keyof typeof name, { title: Text; say: Text }> = {
    without: { title: tx("That's without enzyme", "Das ist ohne Enzym"), say: tx("That arrow goes up to the dashed curve: the reaction **without** enzyme. With enzyme the hill is lower.", "Dieser Pfeil reicht bis zur gestrichelten Kurve: die Reaktion **ohne** Enzym. Mit Enzym ist der Berg niedriger.") },
    with: { title: tx("That's with enzyme", "Das ist mit Enzym"), say: tx("That arrow goes up to the lower, solid curve: that's the activation energy **with** enzyme.", "Dieser Pfeil reicht bis zur niedrigeren, durchgezogenen Kurve: Das ist die Aktivierungsenergie **mit** Enzym.") },
    delta: { title: tx("That's ΔE", "Das ist ΔE"), say: tx("That arrow is the energy difference between substrate and products (ΔE). The enzyme doesn't change it. The activation energy is the hill from the substrate up to the peak.", "Dieser Pfeil ist der Energieunterschied zwischen Substrat und Produkten (ΔE). Den ändert das Enzym nicht. Die Aktivierungsenergie ist der Berg vom Substrat bis zum Gipfel.") },
  };
  const ms: Mistake[] = (["without", "with", "delta"] as const)
    .filter((k) => k !== ask)
    .map((k) => ({ when: { kind: "choice", options, correct: Number(labels[name[k]]) - 1 } as AnswerSpec, title: say[k].title, say: say[k].say }));
  const question: Text =
    ask === "with"
      ? tx("Which arrow shows the activation energy **with** enzyme?", "Welcher Pfeil zeigt die Aktivierungsenergie **mit** Enzym?")
      : ask === "without"
        ? tx("Which arrow shows the activation energy **without** enzyme?", "Welcher Pfeil zeigt die Aktivierungsenergie **ohne** Enzym?")
        : exo
          ? tx("Which arrow shows the energy released in the reaction (ΔE)?", "Welcher Pfeil zeigt die Energie, die bei der Reaktion frei wird (ΔE)?")
          : tx("Which arrow shows the energy taken in by the reaction (ΔE)?", "Welcher Pfeil zeigt die Energie, die bei der Reaktion aufgenommen wird (ΔE)?");
  return {
    instruction: tx("Read the energy diagram", "Lies das Energiediagramm"),
    text: question,
    visual: visual(EnzymeEnergyDiagram, { kind: exo ? "exo" : "endo", labels }),
    answer: { kind: "choice", options, correct },
    hint: tx("Activation energy: from the substrate up to the peak. ΔE: from the substrate to the products.", "Aktivierungsenergie: vom Substrat bis zum Gipfel. ΔE: vom Substrat bis zu den Produkten."),
    solution: [
      { math: tx(`"arrow" ${labels[0]}: E_A "without" \\quad "arrow" ${labels[1]}: E_A "with enzyme"`, `"Pfeil" ${labels[0]}: E_A "ohne" \\quad "Pfeil" ${labels[1]}: E_A "mit Enzym"`), note: tx("Both activation energies start at the substrate. With enzyme the hill is lower.", "Beide Aktivierungsenergien beginnen beim Substrat. Mit Enzym ist der Berg niedriger.") },
      { math: tx(`"arrow" ${labels[2]}: \\Delta E`, `"Pfeil" ${labels[2]}: \\Delta E`), note: tx("ΔE is the same with and without enzyme: the enzyme doesn't change the energy of substrate and products.", "ΔE ist mit und ohne Enzym gleich: Das Enzym ändert die Energie von Substrat und Produkten nicht.") },
    ],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Terms ↔ definitions (match)

const T = {
  site: tx("active site", "aktives Zentrum"),
  complex: tx("enzyme-substrate complex", "Enzym-Substrat-Komplex"),
  subSpec: tx("substrate specificity", "Substratspezifität"),
  actSpec: tx("reaction specificity", "Wirkungsspezifität"),
  ea: tx("activation energy", "Aktivierungsenergie"),
  denat: tx("denaturation", "Denaturierung"),
  opt: tx("temperature optimum", "Temperaturoptimum"),
  sat: tx("saturation", "Sättigung"),
};
const D = {
  site: tx("region of the enzyme where the substrate binds", "Bereich des Enzyms, in dem das Substrat bindet"),
  complex: tx("enzyme with the substrate bound to it", "Enzym mit gebundenem Substrat"),
  subSpec: tx("converts only one particular substrate", "setzt nur ein bestimmtes Substrat um"),
  actSpec: tx("catalyses only one particular reaction", "katalysiert nur eine bestimmte Reaktion"),
  ea: tx("energy needed to start a reaction", "Energie, die nötig ist, um eine Reaktion zu starten"),
  denat: tx("irreversible loss of the protein's shape", "irreversibler Verlust der räumlichen Struktur des Proteins"),
  opt: tx("temperature with the highest activity", "Temperatur mit der höchsten Aktivität"),
  sat: tx("all active sites are occupied", "alle aktiven Zentren sind besetzt"),
  dE: tx("energy released in the reaction", "Energie, die bei der Reaktion frei wird"),
};
type TKey = keyof typeof T;
const TERM_KEYS = Object.keys(T) as TKey[];
const TERM_WRONG: { left: TKey; right: keyof typeof D; title: Text; say: Text }[] = [
  { left: "subSpec", right: "actSpec", title: tx("Substrate or reaction?", "Substrat oder Reaktion?"), say: tx("Substrate specificity is about **which substrate**, reaction specificity about **which reaction**. You swapped them.", "Bei der Substratspezifität geht es um **das Substrat**, bei der Wirkungsspezifität um **die Reaktion**. Du hast sie vertauscht.") },
  { left: "actSpec", right: "subSpec", title: tx("Substrate or reaction?", "Substrat oder Reaktion?"), say: tx("Reaction specificity: one particular **reaction**. Which substrate fits is substrate specificity.", "Wirkungsspezifität: eine bestimmte **Reaktion**. Welches Substrat passt, ist Substratspezifität.") },
  { left: "ea", right: "dE", title: tx("That's ΔE", "Das ist ΔE"), say: tx("The energy released is ΔE. The activation energy is the hill you have to get over **first**.", "Die frei werdende Energie ist ΔE. Die Aktivierungsenergie ist der Berg, über den man **zuerst** muss.") },
  { left: "site", right: "complex", title: tx("Pocket or complex?", "Tasche oder Komplex?"), say: tx("The active site is just the pocket. Enzyme plus bound substrate is the complex.", "Das aktive Zentrum ist nur die Tasche. Enzym plus gebundenes Substrat ist der Komplex.") },
];

function termMatchTask(rng: Rng): Exercise {
  const keys = rng.shuffle(TERM_KEYS).slice(0, 4);
  const pairs: [Text, Text][] = keys.map((k) => [T[k], D[k]]);
  const pool: (keyof typeof D)[] = [...(TERM_KEYS.filter((k) => !keys.includes(k)) as (keyof typeof D)[]), "dE", "dE"];
  const distractor = keys.includes("ea") && rng.chance(0.6) ? "dE" : rng.pick(pool);
  const distractors = [D[distractor]];
  const rights = [...keys.map((k) => k as keyof typeof D), distractor];
  const ms: Mistake[] = TERM_WRONG.filter((w) => keys.includes(w.left) && rights.includes(w.right)).map((w) => ({ when: { kind: "match", pairs: [[T[w.left], D[w.right]]] }, title: w.title, say: w.say }));
  return {
    instruction: tx("Match the pairs", "Ordne zu"),
    text: tx("Match each term with its definition.", "Ordne jedem Fachbegriff seine Erklärung zu."),
    answer: { kind: "match", pairs, distractors },
    hint: tx("One definition is left over.", "Eine Erklärung bleibt übrig."),
    solution: [{ math: txMap((_, l) => pairs.map(([a]) => `"${resolveText(a, l)}"`).join(" \\\\ ")), note: txMap((_, l) => pairs.map(([a, b]) => `**${resolveText(a, l)}**: ${resolveText(b, l)}.`).join(" ")) }],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Order

const CYCLE = [
  tx("The substrate reaches the active site.", "Das Substrat gelangt zum aktiven Zentrum."),
  tx("The enzyme-substrate complex forms.", "Der Enzym-Substrat-Komplex entsteht."),
  tx("The substrate is converted.", "Das Substrat wird umgesetzt."),
  tx("The products are released.", "Die Produkte werden freigesetzt."),
  tx("The enzyme is free again, unchanged.", "Das Enzym liegt unverändert wieder frei vor."),
];
const DENAT = [
  tx("The temperature rises above 45 °C.", "Die Temperatur steigt über 45 °C."),
  tx("The enzyme molecule vibrates more and more.", "Das Enzymmolekül schwingt immer stärker."),
  tx("Bonds that hold its folded shape break.", "Bindungen, die die räumliche Struktur halten, brechen."),
  tx("The active site is deformed.", "Das aktive Zentrum verformt sich."),
  tx("The substrate no longer fits: no reaction.", "Das Substrat passt nicht mehr: keine Reaktion."),
];

function orderTask(rng: Rng): Exercise {
  const kind = rng.pick(["cycle", "denat", "ph", "ph"] as const);
  if (kind === "ph") {
    const n = rng.int(3, 4);
    const chosen = rng.shuffle(PH_ENZYMES).slice(0, n).sort((a, b) => a.opt - b.opt);
    const items = chosen.map((e) => txMap((_, l) => `${cap(resolveText(e.name, l))} (${resolveText(e.place, l)})`));
    const ms: Mistake[] = [];
    const pep = chosen.findIndex((e) => e.id === "pepsin");
    if (pep >= 0 && pep + 1 < n) ms.push({ when: { kind: "order", items: [items[pep + 1], items[pep]] }, title: tx("The stomach is very acidic", "Der Magen ist sehr sauer"), say: tx("Pepsin works in the stomach with its hydrochloric acid: its optimum is the most acidic of all, about pH 2.", "Pepsin arbeitet im Magen mit seiner Salzsäure: Sein Optimum ist das sauerste von allen, etwa pH 2.") });
    const tr = chosen.findIndex((e) => e.id === "trypsin");
    const am = chosen.findIndex((e) => e.id === "amylase");
    if (tr >= 0 && am >= 0) ms.push({ when: { kind: "order", items: [items[tr], items[am]] }, title: tx("The small intestine is basic", "Der Dünndarm ist basisch"), say: tx("In the small intestine it is slightly basic (about pH 8), in the mouth about neutral (pH 7). So trypsin comes after salivary amylase.", "Im Dünndarm ist es leicht basisch (etwa pH 8), im Mund etwa neutral (pH 7). Trypsin kommt also nach der Speichel-Amylase.") });
    return {
      instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
      text: tx("Sort the enzymes by their pH optimum, from the most acidic to the most basic.", "Sortiere die Enzyme nach ihrem pH-Optimum, vom sauersten zum basischsten."),
      answer: { kind: "order", items },
      hint: tx("Where does each enzyme work, and how acidic is it there?", "Wo arbeitet jedes Enzym, und wie sauer ist es dort?"),
      solution: [{ math: txMap((_, l) => chosen.map((e) => `"${cap(resolveText(e.name, l))}" \\; ${dec(e.opt, l)}`).join(" \\\\ ")), note: tx("Each enzyme's optimum fits the place where it works: stomach very acidic, lysosomes acidic, mouth neutral, small intestine slightly basic.", "Das Optimum jedes Enzyms passt zu seinem Arbeitsort: Magen sehr sauer, Lysosomen sauer, Mund neutral, Dünndarm leicht basisch.") }],
      mistakes: ms,
    };
  }
  const all = kind === "cycle" ? CYCLE : DENAT;
  const drop = rng.int(0, 2);
  const items = drop === 1 ? all.slice(1) : drop === 2 ? all.slice(0, -1) : all;
  const wrong =
    kind === "cycle"
      ? [
          { items: [CYCLE[2], CYCLE[1]], title: tx("First bind, then convert", "Erst binden, dann umsetzen"), say: tx("The substrate is only converted inside the enzyme-substrate complex. The complex comes first.", "Das Substrat wird erst im Enzym-Substrat-Komplex umgesetzt. Der Komplex kommt zuerst.") },
          { items: [CYCLE[4], CYCLE[3]], title: tx("Products first", "Erst die Produkte"), say: tx("The enzyme is only free once the products have left its active site.", "Das Enzym ist erst frei, wenn die Produkte sein aktives Zentrum verlassen haben.") },
        ]
      : [
          { items: [DENAT[3], DENAT[2]], title: tx("Cause before effect", "Ursache vor Wirkung"), say: tx("The active site is deformed **because** the bonds holding the shape break. Bonds break first.", "Das aktive Zentrum verformt sich, **weil** die Bindungen brechen, die die Form halten. Erst brechen die Bindungen.") },
          { items: [DENAT[4], DENAT[3]], title: tx("Cause before effect", "Ursache vor Wirkung"), say: tx("The substrate no longer fits because the active site has been deformed. That comes first.", "Das Substrat passt nicht mehr, weil das aktive Zentrum verformt ist. Das kommt zuerst.") },
        ];
  const ms: Mistake[] = wrong.filter((w) => w.items.every((it) => items.some((x) => sameItem(x, it)))).map((w) => ({ when: { kind: "order", items: w.items }, title: w.title, say: w.say }));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: kind === "cycle" ? tx("Put the steps of an enzyme reaction in order.", "Bring die Schritte einer Enzymreaktion in die richtige Reihenfolge.") : tx("Put the steps of heat denaturation in order.", "Bring die Schritte der Hitzedenaturierung in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: kind === "cycle" ? tx("E + S → ES → E + P", "E + S → ES → E + P") : tx("Think cause and effect: what happens to the molecule first?", "Denk an Ursache und Wirkung: Was passiert zuerst mit dem Molekül?"),
    solution:
      kind === "cycle"
        ? [{ math: "E + S \\to ES \\to E + P", note: tx("Substrate binds, the complex forms, the substrate is converted, the products leave, the enzyme is free and unchanged.", "Das Substrat bindet, der Komplex entsteht, das Substrat wird umgesetzt, die Produkte lösen sich, das Enzym ist frei und unverändert.") }]
        : [{ math: tx('"heat" \\to "bonds break" \\to "active site deformed"', '"Hitze" \\to "Bindungen brechen" \\to "aktives Zentrum verformt"'), note: tx("Heat makes the molecule vibrate until the bonds holding its shape break. The active site is deformed and the substrate no longer fits.", "Hitze lässt das Molekül so stark schwingen, dass die Bindungen brechen, die seine Form halten. Das aktive Zentrum verformt sich, das Substrat passt nicht mehr.") }],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Saturation

function saturationTask(rng: Rng): Exercise {
  if (rng.chance(0.55)) {
    const enz = rng.pick([20, 40, 50, 100, 200]);
    const kcat = rng.pick([100, 200, 300, 400, 500]);
    const sub = rng.pick([1000000, 5000000, 10000000]);
    const value = enz * kcat;
    const right: AnswerSpec = { kind: "number", value, unit: tx("per second", "pro Sekunde") };
    const m = mistakes(right);
    m.add({ kind: "number", value: kcat }, tx("All enzymes count", "Alle Enzyme zählen"), tx(`That's what **one** enzyme molecule manages. There are ${enz} of them working at the same time.`, `So viel schafft **ein** Enzymmolekül. Es arbeiten aber ${enz} gleichzeitig.`));
    m.add({ kind: "number", value: sub }, tx("Substrate isn't the limit", "Das Substrat begrenzt nicht"), tx("At saturation the amount of substrate doesn't set the pace: all active sites are already busy. The enzymes set the limit.", "Bei Sättigung bestimmt die Substratmenge nicht das Tempo: Alle aktiven Zentren sind schon beschäftigt. Die Enzyme setzen die Grenze."));
    m.add({ kind: "number", value: enz }, tx("Enzymes aren't used up", "Enzyme werden nicht verbraucht"), tx("Each enzyme converts many substrate molecules per second, not just one.", "Jedes Enzym setzt pro Sekunde viele Substratmoleküle um, nicht nur eines."));
    return {
      instruction: tx("Calculate", "Berechne"),
      text: txMap((tt) =>
        tt(
          `A solution contains ${enz} enzyme molecules and ${sub} substrate molecules. Each enzyme molecule can convert at most ${kcat} substrate molecules per second. All active sites are occupied (saturation). How many substrate molecules are converted per second?`,
          `Eine Lösung enthält ${enz} Enzymmoleküle und ${sub} Substratmoleküle. Jedes Enzymmolekül kann pro Sekunde höchstens ${kcat} Substratmoleküle umsetzen. Alle aktiven Zentren sind besetzt (Sättigung). Wie viele Substratmoleküle werden pro Sekunde umgesetzt?`,
        ),
      ),
      answer: right,
      hint: tx("At saturation every enzyme works at full speed. What limits the total?", "Bei Sättigung arbeitet jedes Enzym mit voller Geschwindigkeit. Was begrenzt die Summe?"),
      solution: [{ math: `${enz} \\cdot ${kcat} = ${value}`, note: tx(`All ${enz} enzymes work at their maximum: **${value} per second**. More substrate wouldn't change that, only more enzyme would.`, `Alle ${enz} Enzyme arbeiten am Maximum: **${value} pro Sekunde**. Mehr Substrat würde daran nichts ändern, nur mehr Enzym.`) }],
      mistakes: m.list,
    };
  }
  const which = rng.pick(["double-s", "double-e"] as const);
  const opts: Opt[] =
    which === "double-s"
      ? [
          { text: tx("It stays about the same.", "Sie bleibt etwa gleich.") },
          { text: tx("It doubles.", "Sie verdoppelt sich."), title: tx("Saturated", "Gesättigt"), say: tx("All active sites are already busy. Extra substrate just has to wait its turn.", "Alle aktiven Zentren sind schon beschäftigt. Zusätzliches Substrat muss nur warten, bis es dran ist.") },
          { text: tx("It halves.", "Sie halbiert sich.") },
          { text: tx("It drops to zero, because the enzyme is used up.", "Sie fällt auf null, weil das Enzym verbraucht ist."), title: USED_UP, say: tx("Enzymes aren't used up. At saturation they simply can't work any faster.", "Enzyme werden nicht verbraucht. Bei Sättigung können sie einfach nicht schneller arbeiten.") },
        ]
      : [
          { text: tx("It doubles.", "Sie verdoppelt sich.") },
          { text: tx("It stays the same.", "Sie bleibt gleich."), title: tx("More active sites", "Mehr aktive Zentren"), say: tx("Twice the enzyme means twice as many active sites working at the same time. With plenty of substrate the rate doubles.", "Doppelt so viel Enzym heißt doppelt so viele aktive Zentren, die gleichzeitig arbeiten. Bei genug Substrat verdoppelt sich die Geschwindigkeit.") },
          { text: tx("It halves.", "Sie halbiert sich.") },
        ];
  const c = choice(rng, opts);
  return {
    instruction: PICK,
    text:
      which === "double-s"
        ? tx("An enzyme reaction is saturated: nearly all active sites are occupied. You double the substrate concentration. What happens to the rate?", "Eine Enzymreaktion ist gesättigt: Fast alle aktiven Zentren sind besetzt. Du verdoppelst die Substratkonzentration. Was passiert mit der Geschwindigkeit?")
        : tx("An enzyme reaction is saturated: nearly all active sites are occupied. You double the amount of enzyme. What happens to the rate?", "Eine Enzymreaktion ist gesättigt: Fast alle aktiven Zentren sind besetzt. Du verdoppelst die Enzymmenge. Was passiert mit der Geschwindigkeit?"),
    answer: c.answer,
    hint: tx("What is the bottleneck when all active sites are busy?", "Was ist der Engpass, wenn alle aktiven Zentren beschäftigt sind?"),
    solution: [{ math: tx('"saturation:" \\; "rate" \\sim "amount of enzyme"', '"Sättigung:" \\; "Geschwindigkeit" \\sim "Enzymmenge"'), note: tx("At saturation the enzyme is the bottleneck: more substrate changes almost nothing, twice the enzyme doubles the rate.", "Bei Sättigung ist das Enzym der Engpass: Mehr Substrat ändert fast nichts, doppelt so viel Enzym verdoppelt die Geschwindigkeit.") }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Temperature experiment with amylase (tubes)

function experimentTask(rng: Rng): Exercise {
  const temps = rng.shuffle([0, 37, 80]);
  const at = (tC: number) => letter(temps.indexOf(tC));
  const content = (tC: number): Text => tx(`amylase + starch, ${tC} °C`, `Amylase + Stärke, ${tC} °C`);
  const result = (tC: number): TubeSpec["colour"] => (tC === 37 ? "iodine" : "starch");
  const shown: TubeSpec[] = temps.map((tC, i) => ({ label: letter(i), content: content(tC), colour: result(tC) }));
  const solution: Frame[] = [
    {
      math: tx(
        `"${at(0)}:" 0 \\deg"C" \\to "blue-black (slow)" \\\\ "${at(37)}:" 37 \\deg"C" \\to "yellow-brown" \\\\ "${at(80)}:" 80 \\deg"C" \\to "blue-black (denatured)"`,
        `"${at(0)}:" 0 \\deg"C" \\to "blau-schwarz (langsam)" \\\\ "${at(37)}:" 37 \\deg"C" \\to "gelb-braun" \\\\ "${at(80)}:" 80 \\deg"C" \\to "blau-schwarz (denaturiert)"`,
      ),
      note: tx("At 37 °C the amylase has split all the starch. At 0 °C it works far too slowly, at 80 °C it is denatured.", "Bei 37 °C hat die Amylase die ganze Stärke gespalten. Bei 0 °C arbeitet sie viel zu langsam, bei 80 °C ist sie denaturiert."),
    },
    {
      math: tx(`"warmed to" 37 \\deg"C": \\; "${at(0)}" \\to "yellow-brown" \\quad "${at(80)}" \\to "blue-black"`, `"auf" 37 \\deg"C" "gebracht:" \\; "${at(0)}" \\to "gelb-braun" \\quad "${at(80)}" \\to "blau-schwarz"`),
      note: tx("Cold is reversible: warmed up, the amylase from the cold tube gets to work. Denaturation is irreversible: the heated amylase stays inactive.", "Kälte ist reversibel: Erwärmt legt die Amylase aus dem kalten Glas los. Denaturierung ist irreversibel: Die erhitzte Amylase bleibt inaktiv."),
    },
  ];
  if (rng.chance(0.5)) {
    const options = temps.map((_, i) => tx(`tube ${letter(i)}`, `Glas ${letter(i)}`));
    const right: AnswerSpec = { kind: "multi", options, correct: [temps.indexOf(0), temps.indexOf(80)].sort() };
    const m = mistakes(right);
    m.add({ kind: "multi", options, correct: [temps.indexOf(80)] }, tx("Cold slows down too", "Kälte bremst auch"), tx("At 0 °C the amylase is intact, but it works so slowly that the starch is still there after 10 minutes.", "Bei 0 °C ist die Amylase zwar intakt, aber sie arbeitet so langsam, dass nach 10 Minuten noch Stärke da ist."));
    m.add({ kind: "multi", options, correct: [temps.indexOf(0)] }, tx("Heat denatures", "Hitze denaturiert"), tx("At 80 °C the amylase is denatured: the starch stays. Faster isn't always better.", "Bei 80 °C ist die Amylase denaturiert: Die Stärke bleibt. Wärmer ist nicht immer schneller."));
    m.add({ kind: "multi", options, correct: [temps.indexOf(37)] }, tx("The other way round", "Andersrum"), tx("Blue-black means starch is still there. At 37 °C the amylase works best, so that tube has no starch left.", "Blau-schwarz heißt: Die Stärke ist noch da. Bei 37 °C arbeitet die Amylase am besten, dort ist also keine Stärke mehr."));
    return {
      instruction: PICK_ALL,
      text: tx("Amylase and starch solution were kept at three temperatures for 10 minutes. Then iodine solution was added. Which tubes are blue-black?", "Amylase und Stärkelösung standen 10 Minuten bei drei Temperaturen. Dann wurde Iod-Kaliumiodid-Lösung zugegeben. Welche Gläser sind blau-schwarz?"),
      visual: visual(EnzymeTubes, { tubes: temps.map((tC, i) => ({ label: letter(i), content: content(tC), colour: "clear" as const })) }),
      answer: right,
      hint: tx("Where does amylase work too slowly, where is it destroyed?", "Wo arbeitet die Amylase zu langsam, wo wird sie zerstört?"),
      solution: solution.slice(0, 1),
      mistakes: m.list,
    };
  }
  const options = [tx(`tube ${at(0)}`, `Glas ${at(0)}`), tx(`tube ${at(80)}`, `Glas ${at(80)}`), tx("both", "beide"), tx("neither", "keines")];
  const c = choice(rng, [
    { text: options[0] },
    { text: options[1], title: IRREV, say: tx("The amylase heated to 80 °C is denatured. Cooling it to 37 °C doesn't bring it back.", "Die auf 80 °C erhitzte Amylase ist denaturiert. Abkühlen auf 37 °C macht sie nicht wieder aktiv.") },
    { text: options[2], title: IRREV, say: tx("Only one of them comes back: cold is reversible, but denaturation by heat is not.", "Nur eines kommt zurück: Kälte ist reversibel, Denaturierung durch Hitze nicht.") },
    { text: options[3], title: COLD, say: tx("Cold doesn't damage the amylase. Warmed to 37 °C, it gets to work.", "Kälte schädigt die Amylase nicht. Auf 37 °C erwärmt legt sie los.") },
  ]);
  return {
    instruction: tx("Predict the result", "Sag das Ergebnis voraus"),
    text: tx(
      `The tubes are tested with iodine after 10 minutes (picture). Then tubes ${at(0)} and ${at(80)} are kept at 37 °C for another 10 minutes and tested again. Which one turns yellow-brown now?`,
      `Die Gläser wurden nach 10 Minuten mit Iod getestet (Bild). Danach stehen die Gläser ${at(0)} und ${at(80)} weitere 10 Minuten bei 37 °C und werden noch einmal getestet. Welches wird jetzt gelb-braun?`,
    ),
    visual: visual(EnzymeTubes, { tubes: shown }),
    answer: c.answer,
    hint: tx("Which change to the enzyme can be undone, and which can't?", "Welche Veränderung am Enzym lässt sich rückgängig machen, welche nicht?"),
    solution,
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Terms (word)

type Term = { q: Text; accept: Text[]; show: Text; note: Text; hint: Text; wrong?: { word: Text; title: Text; say: Text }[] };

const TERMS: Term[] = [
  { q: tx("What is the region of an enzyme called where the substrate binds?", "Wie heißt der Bereich eines Enzyms, in dem das Substrat bindet?"), accept: [tx("active site", "aktives Zentrum"), tx("active centre", "aktive Zentrum")], show: tx('"active site"', '"aktives Zentrum"'), note: tx("The substrate binds in the **active site**.", "Das Substrat bindet im **aktiven Zentrum**."), hint: tx("Two words: the place where the enzyme is active.", "Zwei Wörter: der Ort, an dem das Enzym aktiv ist.") },
  {
    q: tx("What is an enzyme called while its substrate is bound to it?", "Wie heißt ein Enzym, solange sein Substrat daran gebunden ist?"),
    accept: [tx("enzyme-substrate complex", "Enzym-Substrat-Komplex"), "ES-Komplex", tx("ES complex", "ES-Komplex")],
    show: "E + S \\to \\hl{ES} \\to E + P",
    note: tx("Enzyme and bound substrate form the **enzyme-substrate complex** (ES).", "Enzym und gebundenes Substrat bilden den **Enzym-Substrat-Komplex** (ES)."),
    hint: tx("E + S → ? → E + P", "E + S → ? → E + P"),
  },
  {
    q: tx("What is the irreversible loss of an enzyme's folded shape, for example by heat, called?", "Wie nennt man den irreversiblen Verlust der räumlichen Struktur eines Enzyms, zum Beispiel durch Hitze?"),
    accept: [tx("denaturation", "Denaturierung"), "Denaturation", tx("denaturing", "denaturieren")],
    show: tx('"denaturation"', '"Denaturierung"'),
    note: tx("Heat, strong acids or bases destroy the shape: **denaturation**.", "Hitze, starke Säuren oder Basen zerstören die Form: **Denaturierung**."),
    hint: tx("It also happens to egg white in a hot pan.", "Das passiert auch mit Eiklar in der heißen Pfanne."),
  },
  {
    q: tx("What is the energy called that a reaction needs to get started?", "Wie heißt die Energie, die eine Reaktion braucht, um in Gang zu kommen?"),
    accept: [tx("activation energy", "Aktivierungsenergie")],
    show: "E_A",
    note: tx("Enzymes lower the **activation energy** $E_A$.", "Enzyme senken die **Aktivierungsenergie** $E_A$."),
    hint: tx("It's the energy hill in the diagram.", "Das ist der Energieberg im Diagramm."),
    wrong: [{ word: tx("reaction energy", "Reaktionsenergie"), title: tx("That's ΔE", "Das ist ΔE"), say: tx("The reaction energy is ΔE, the difference between start and end. The energy needed to get started has another name.", "Die Reaktionsenergie ist ΔE, der Unterschied zwischen Anfang und Ende. Die Startenergie heißt anders.") }],
  },
  {
    q: tx("What is the property called that an enzyme converts only one particular substrate?", "Wie nennt man die Eigenschaft, dass ein Enzym nur ein bestimmtes Substrat umsetzt?"),
    accept: [tx("substrate specificity", "Substratspezifität")],
    show: tx('"substrate specificity"', '"Substratspezifität"'),
    note: tx("**Substrate specificity**: only the fitting substrate binds (lock and key).", "**Substratspezifität**: Nur das passende Substrat bindet (Schlüssel-Schloss-Prinzip)."),
    hint: tx("…specificity, with the word for the substance the enzyme converts.", "…spezifität, mit dem Wort für den Stoff, den das Enzym umsetzt."),
    wrong: [{ word: tx("reaction specificity", "Wirkungsspezifität"), title: tx("Substrate or reaction?", "Substrat oder Reaktion?"), say: tx("Reaction specificity means only one particular **reaction**. Here it's about the **substrate**.", "Wirkungsspezifität heißt: nur eine bestimmte **Reaktion**. Hier geht es um das **Substrat**.") }],
  },
  {
    q: tx("What is the property called that an enzyme catalyses only one particular reaction of its substrate?", "Wie nennt man die Eigenschaft, dass ein Enzym nur eine bestimmte Reaktion seines Substrats katalysiert?"),
    accept: [tx("reaction specificity", "Wirkungsspezifität"), "Reaktionsspezifität"],
    show: tx('"reaction specificity"', '"Wirkungsspezifität"'),
    note: tx("**Reaction specificity**: the same substrate could react in several ways, but each enzyme catalyses only one of them.", "**Wirkungsspezifität**: Dasselbe Substrat könnte verschieden reagieren, aber jedes Enzym katalysiert nur eine dieser Reaktionen."),
    hint: tx("…specificity, about the effect (the reaction).", "…spezifität, es geht um die Wirkung (die Reaktion)."),
    wrong: [{ word: tx("substrate specificity", "Substratspezifität"), title: tx("Substrate or reaction?", "Substrat oder Reaktion?"), say: tx("Substrate specificity is about which **substrate** fits. Here it's about which **reaction** happens.", "Bei der Substratspezifität geht es darum, welches **Substrat** passt. Hier geht es darum, welche **Reaktion** abläuft.") }],
  },
  {
    q: tx("What is the temperature called at which an enzyme works fastest?", "Wie heißt die Temperatur, bei der ein Enzym am schnellsten arbeitet?"),
    accept: [tx("temperature optimum", "Temperaturoptimum"), tx("optimum", "Optimum"), tx("optimum temperature", "optimale Temperatur")],
    show: tx('"temperature optimum"', '"Temperaturoptimum"'),
    note: tx("For most human enzymes the **temperature optimum** is about 37 °C.", "Bei den meisten Enzymen des Menschen liegt das **Temperaturoptimum** bei etwa 37 °C."),
    hint: tx("The best temperature: temperature + a word for 'the best'.", "Die beste Temperatur: Temperatur + ein Wort für „das Beste“."),
  },
  {
    q: tx("What is the state called in which all active sites are occupied and more substrate no longer speeds things up?", "Wie heißt der Zustand, in dem alle aktiven Zentren besetzt sind und mehr Substrat nichts mehr beschleunigt?"),
    accept: [tx("saturation", "Sättigung"), tx("substrate saturation", "Substratsättigung")],
    show: tx('"saturation"', '"Sättigung"'),
    note: tx("At **saturation** every enzyme works at its maximum.", "Bei **Sättigung** arbeitet jedes Enzym am Maximum."),
    hint: tx("Like a sponge that can't take any more water.", "Wie ein Schwamm, der kein Wasser mehr aufnehmen kann."),
  },
];

function termTask(rng: Rng): Exercise {
  const q = rng.pick(TERMS);
  const right: AnswerSpec = { kind: "word", accept: q.accept };
  const m = mistakes(right);
  for (const w of q.wrong ?? []) m.add({ kind: "word", accept: [w.word] }, w.title, w.say);
  return { instruction: tx("Name the term", "Nenne den Fachbegriff"), text: q.q, answer: right, hint: q.hint, solution: [{ math: q.show, note: q.note }], mistakes: m.list };
}

// ---------------------------------------------------------------------------
// True statements (multi)

const STMTS: Stmt[] = [
  { ok: true, text: tx("Enzymes lower the activation energy.", "Enzyme senken die Aktivierungsenergie.") },
  { ok: true, text: tx("Above the optimum the activity drops steeply.", "Oberhalb des Optimums fällt die Aktivität steil ab.") },
  { ok: true, text: tx("Cold slows enzymes down, but doesn't damage them.", "Kälte bremst Enzyme, schädigt sie aber nicht."), title: COLD, say: tx("This one is true: cold is reversible. Only heat denatures.", "Die stimmt: Kälte ist reversibel. Nur Hitze denaturiert.") },
  { ok: true, text: tx("Pepsin works best at about pH 2.", "Pepsin arbeitet am besten bei etwa pH 2.") },
  { ok: true, text: tx("At saturation more enzyme increases the rate.", "Bei Sättigung erhöht mehr Enzym die Geschwindigkeit.") },
  { ok: true, text: tx("Heat denaturation is irreversible.", "Die Denaturierung durch Hitze ist irreversibel."), title: IRREV, say: tx("This one is true: a denatured enzyme doesn't recover when it cools down.", "Die stimmt: Ein denaturiertes Enzym erholt sich beim Abkühlen nicht.") },
  { ok: true, text: tx("The substrate binds in the active site.", "Das Substrat bindet im aktiven Zentrum.") },
  { ok: false, text: tx("At 0 °C enzymes are denatured.", "Bei 0 °C werden Enzyme denaturiert."), title: COLD, say: tx("Classic trap: cold only slows enzymes down. Denaturation happens with heat (or strong acids and bases).", "Die klassische Falle: Kälte bremst Enzyme nur. Denaturierung passiert durch Hitze (oder starke Säuren und Basen).") },
  { ok: false, text: tx("Enzymes change the energy released in a reaction.", "Enzyme verändern die Energie, die bei einer Reaktion frei wird."), title: tx("ΔE stays the same", "ΔE bleibt gleich"), say: tx("Enzymes lower only the activation energy. ΔE stays exactly the same.", "Enzyme senken nur die Aktivierungsenergie. ΔE bleibt genau gleich.") },
  { ok: false, text: tx("The higher the temperature, the faster an enzyme always works.", "Je höher die Temperatur, desto schneller arbeitet ein Enzym immer."), title: tx("Not above the optimum", "Nicht über dem Optimum"), say: tx("That's only true below the optimum (RGT rule). Above it, the enzyme is denatured.", "Das gilt nur unterhalb des Optimums (RGT-Regel). Darüber wird das Enzym denaturiert.") },
  { ok: false, text: tx("Enzymes are used up in the reaction.", "Enzyme werden bei der Reaktion verbraucht."), title: USED_UP, say: tx("Enzymes come out of every reaction unchanged.", "Enzyme gehen unverändert aus jeder Reaktion hervor.") },
  { ok: false, text: tx("At saturation more substrate doubles the rate.", "Bei Sättigung verdoppelt mehr Substrat die Geschwindigkeit."), title: tx("Saturated", "Gesättigt"), say: tx("At saturation all active sites are busy. More substrate hardly changes anything.", "Bei Sättigung sind alle aktiven Zentren beschäftigt. Mehr Substrat ändert kaum etwas.") },
  { ok: false, text: tx("All enzymes work best at pH 7.", "Alle Enzyme arbeiten am besten bei pH 7."), title: tx("Each has its own optimum", "Jedes hat sein Optimum"), say: tx("Each enzyme has the optimum of its workplace: pepsin pH 2, trypsin pH 8.", "Jedes Enzym hat das Optimum seines Arbeitsortes: Pepsin pH 2, Trypsin pH 8.") },
];

function statementsTask(rng: Rng): Exercise {
  const nTrue = rng.int(2, 3);
  const m = multi(rng, STMTS, nTrue, 5 - nTrue);
  return {
    instruction: PICK_ALL,
    text: tx("Which statements about enzyme activity are true?", "Welche Aussagen zur Enzymaktivität stimmen?"),
    answer: m.answer,
    hint: tx("Think of the activity curves for temperature and pH, and of saturation.", "Denk an die Aktivitätskurven für Temperatur und pH-Wert und an die Sättigung."),
    solution: [{ math: tx('"true:"', '"richtig:"'), note: txMap((_, l) => m.trues.map((x) => `✓ ${resolveText(x.text, l)}`).join(" ")) }],
    mistakes: m.mistakes,
  };
}

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => factTask(rng)],
    [1.5, () => tempGraphTask(rng)],
    [1.3, () => phGraphTask(rng)],
    [1.3, () => rgtTask(rng)],
    [1.1, () => energyTask(rng)],
    [1.0, () => termMatchTask(rng)],
    [1.0, () => orderTask(rng)],
    [1.0, () => saturationTask(rng)],
    [1.0, () => experimentTask(rng)],
    [0.9, () => termTask(rng)],
    [1.0, () => statementsTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const specPairs: [Text, Text][] = [
  [T.site, D.site],
  [T.complex, D.complex],
  [T.subSpec, D.subSpec],
  [T.actSpec, D.actSpec],
];

const rgtCheck: Exercise = (() => {
  const right: AnswerSpec = { kind: "number", value: 24, unit: PER_MIN };
  const m = mistakes(right);
  m.add({ kind: "number", value: 12 }, tx("Twice 10 °C", "Zweimal 10 °C"), tx("From 15 °C to 35 °C are **two** steps of 10 °C. So double twice.", "Von 15 °C bis 35 °C sind es **zwei** Schritte von 10 °C. Also zweimal verdoppeln."), true);
  m.add({ kind: "number", value: 18 }, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("You added 6 for each step. The RGT rule **multiplies**: 6 → 12 → 24.", "Du hast pro Schritt 6 addiert. Die RGT-Regel **multipliziert**: 6 → 12 → 24."));
  m.add({ kind: "number", value: 240 }, tx("Degrees aren't the factor", "Grad sind nicht der Faktor"), tx("You multiplied by the 20 degrees. The rule counts 10 °C steps: here there are two.", "Du hast mit den 20 Grad multipliziert. Die Regel zählt 10-°C-Schritte: Hier sind es zwei."));
  return {
    instruction: tx("Use the RGT rule", "Wende die RGT-Regel an"),
    text: tx("An enzyme converts 6 µmol substrate per minute at 15 °C. Assume the rate doubles with every 10 °C. How much does it convert at 35 °C?", "Ein Enzym setzt bei 15 °C 6 µmol Substrat pro Minute um. Nimm an, dass sich die Geschwindigkeit pro 10 °C verdoppelt. Wie viel setzt es bei 35 °C um?"),
    answer: right,
    hint: tx("How many steps of 10 °C are there from 15 °C to 35 °C?", "Wie viele 10-°C-Schritte sind es von 15 °C bis 35 °C?"),
    solution: [
      { math: tx('15 \\deg"C" \\to 25 \\deg"C" \\to 35 \\deg"C"', '15 \\deg"C" \\to 25 \\deg"C" \\to 35 \\deg"C"'), note: tx("Two steps of 10 °C, both below the optimum.", "Zwei Schritte von 10 °C, beide unter dem Optimum.") },
      { math: "6 \\cdot 2 \\cdot 2 = 24", note: tx("Double, then double again: **24 µmol per minute**.", "Verdoppeln und noch mal verdoppeln: **24 µmol pro Minute**.") },
    ],
    mistakes: m.list,
  };
})();

const energyCheck = (() => {
  const labels: [string, string, string] = ["1", "2", "3"];
  const options = labels.map((d) => tx(`arrow ${d}`, `Pfeil ${d}`));
  return {
    instruction: tx("Read the energy diagram", "Lies das Energiediagramm"),
    text: tx("Which arrow shows the activation energy **with** enzyme?", "Welcher Pfeil zeigt die Aktivierungsenergie **mit** Enzym?"),
    visual: visual(EnzymeEnergyDiagram, { kind: "exo", labels }),
    answer: { kind: "choice", options, correct: 1 } as AnswerSpec,
    hint: tx("Start at the substrate and go up to the peak of the solid curve.", "Starte beim Substrat und geh hoch bis zum Gipfel der durchgezogenen Kurve."),
    solution: [
      { math: tx('"arrow 2:" E_A "with enzyme"', '"Pfeil 2:" E_A "mit Enzym"'), note: tx("Arrow 2 goes from the substrate to the peak of the lower curve: the activation energy with enzyme. Arrow 1 is the higher one without enzyme.", "Pfeil 2 reicht vom Substrat bis zum Gipfel der niedrigeren Kurve: die Aktivierungsenergie mit Enzym. Pfeil 1 ist die höhere ohne Enzym.") },
      { math: tx('"arrow 3:" \\Delta E', '"Pfeil 3:" \\Delta E'), note: tx("Arrow 3 is ΔE, the same with and without enzyme.", "Pfeil 3 ist ΔE, mit und ohne Enzym gleich.") },
    ],
    mistakes: [
      { when: { kind: "choice", options, correct: 0 } as AnswerSpec, title: tx("That's without enzyme", "Das ist ohne Enzym"), say: tx("Arrow 1 reaches the dashed curve: that's the reaction **without** enzyme. With enzyme the hill is lower.", "Pfeil 1 reicht bis zur gestrichelten Kurve: Das ist die Reaktion **ohne** Enzym. Mit Enzym ist der Berg niedriger.") },
      { when: { kind: "choice", options, correct: 2 } as AnswerSpec, title: tx("That's ΔE", "Das ist ΔE"), say: tx("Arrow 3 is the energy difference between substrate and products. The enzyme doesn't change it at all.", "Pfeil 3 ist der Energieunterschied zwischen Substrat und Produkten. Den ändert das Enzym gar nicht.") },
    ],
  } satisfies Exercise;
})();

const saturationCheck = choice(createRng(21), [
  { text: tx("It stays about the same.", "Sie bleibt etwa gleich.") },
  { text: tx("It doubles.", "Sie verdoppelt sich."), title: tx("Saturated", "Gesättigt"), say: tx("All active sites are already busy. Extra substrate just has to wait its turn.", "Alle aktiven Zentren sind schon beschäftigt. Zusätzliches Substrat muss nur warten, bis es dran ist.") },
  { text: tx("It drops to zero, because the enzyme is used up.", "Sie fällt auf null, weil das Enzym verbraucht ist."), title: USED_UP, say: tx("Enzymes aren't used up. At saturation they simply can't work any faster.", "Enzyme werden nicht verbraucht. Bei Sättigung können sie einfach nicht schneller arbeiten.") },
]);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The active site", "Das aktive Zentrum"),
      blob: tx("Let's zoom right into an enzyme!", "Lass uns ganz nah an ein Enzym heranzoomen!"),
      body: tx(
        "An enzyme is a protein: a long chain of amino acids folded into a very particular spatial shape. One spot of this shape is the **active site**: a pocket whose shape and chemical properties match the substrate exactly.",
        "Ein Enzym ist ein Protein: eine lange Kette aus Aminosäuren, die zu einer ganz bestimmten räumlichen Form gefaltet ist. Eine Stelle dieser Form ist das **aktive Zentrum**: eine Tasche, deren Form und chemische Eigenschaften genau zum Substrat passen.",
      ),
      frames: [
        { math: "E#e1 +#p1 S#s1", note: tx("Enzyme (E) and substrate (S) collide at random in the solution.", "Enzym (E) und Substrat (S) treffen in der Lösung zufällig aufeinander.") },
        { math: "E#e1 +#p1 S#s1 \\to#a1 E#e2 S#s2", note: tx("The substrate binds in the active site: the **enzyme-substrate complex** (ES) forms.", "Das Substrat bindet im aktiven Zentrum: Der **Enzym-Substrat-Komplex** (ES) entsteht.") },
        { math: "E#e1 +#p1 S#s1 \\to#a1 E#e2 S#s2 \\to#a2 E#e3 +#p2 P#p3", note: tx("In the complex the substrate is converted. The **products** (P) leave, the enzyme (E) is unchanged.", "Im Komplex wird das Substrat umgesetzt. Die **Produkte** (P) lösen sich, das Enzym (E) liegt unverändert vor.") },
        {
          math: "\\hl{E#e1} +#p1 S#s1 \\to#a1 E#e2 S#s2 \\to#a2 \\hl{E#e3} +#p2 P#p3",
          note: tx("The same E on both sides: the enzyme is not used up. One enzyme molecule can convert hundreds to millions of substrate molecules per second.", "Links und rechts steht dasselbe E: Das Enzym wird nicht verbraucht. Ein Enzymmolekül kann pro Sekunde Hunderte bis Millionen Substratmoleküle umsetzen."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The enzyme-substrate complex", "Der Enzym-Substrat-Komplex"),
      blob: tx("Follow the equation as the enzyme works.", "Verfolge die Gleichung, während das Enzym arbeitet."),
      body: tx("Step through the reaction and watch which part of $E + S \\to ES \\to E + P$ lights up. Then try the other molecule.", "Geh die Reaktion Schritt für Schritt durch und schau, welcher Teil von $E + S \\to ES \\to E + P$ aufleuchtet. Probier dann das andere Molekül aus."),
      widget: () => <EnzymeLockKey level={2} />,
    },
    {
      type: "explain",
      title: tx("Specific in two ways", "Doppelt spezifisch"),
      blob: tx("Enzymes are real specialists.", "Enzyme sind echte Spezialisten."),
      body: tx("Enzymes are **specific** in two ways: in **which substrate** they accept and in **which reaction** they catalyse.", "Enzyme sind in zweierlei Hinsicht **spezifisch**: darin, **welches Substrat** sie annehmen, und darin, **welche Reaktion** sie katalysieren."),
      frames: [
        { math: tx('"urease:" "urea" \\to "split"', '"Urease:" "Harnstoff" \\to "gespalten"'), note: tx("**Substrate specificity**: an enzyme converts only one particular substrate. Urease splits only urea, nothing else.", "**Substratspezifität**: Ein Enzym setzt nur ein bestimmtes Substrat um. Urease spaltet nur Harnstoff, sonst nichts.") },
        {
          math: tx('"amylase:" "starch" \\to "maltose" \\\\ "amylase:" "cellulose" \\to \\strike{"split"}', '"Amylase:" "Stärke" \\to "Malzzucker" \\\\ "Amylase:" "Cellulose" \\to \\strike{"gespalten"}'),
          note: tx("Starch and cellulose are both made of glucose. Still, amylase only splits starch: the bonds in cellulose don't fit its active site.", "Stärke und Cellulose bestehen beide aus Glucose. Trotzdem spaltet Amylase nur Stärke: Die Bindungen in Cellulose passen nicht in ihr aktives Zentrum."),
        },
        {
          math: tx('"amino acid" \\to "amine" + \\ce{CO2} \\\\ "amino acid" \\to "keto acid" + \\ce{NH3}', '"Aminosäure" \\to "Amin" + \\ce{CO2} \\\\ "Aminosäure" \\to "Ketosäure" + \\ce{NH3}'),
          note: tx("**Reaction specificity**: one substrate could react in several ways. A decarboxylase only splits off CO₂, a deaminase only removes the amino group. Each enzyme catalyses just one reaction.", "**Wirkungsspezifität**: Ein Substrat könnte auf verschiedene Arten reagieren. Eine Decarboxylase spaltet nur CO₂ ab, eine Desaminase entfernt nur die Aminogruppe. Jedes Enzym katalysiert nur eine Reaktion."),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Sort out the new terms!", "Sortier die neuen Begriffe!"),
      exercise: {
        instruction: tx("Match the pairs", "Ordne zu"),
        text: tx("Match each term with its definition.", "Ordne jedem Fachbegriff seine Erklärung zu."),
        answer: { kind: "match", pairs: specPairs, distractors: [D.denat] },
        hint: tx("Substrate specificity is about the substance, reaction specificity about the reaction.", "Substratspezifität dreht sich um den Stoff, Wirkungsspezifität um die Reaktion."),
        solution: [
          {
            math: tx('"active site" \\\\ "enzyme-substrate complex" \\\\ "substrate specificity" \\\\ "reaction specificity"', '"aktives Zentrum" \\\\ "Enzym-Substrat-Komplex" \\\\ "Substratspezifität" \\\\ "Wirkungsspezifität"'),
            note: tx("Active site: the binding pocket. Complex: enzyme with bound substrate. Substrate specificity: one substrate. Reaction specificity: one reaction.", "Aktives Zentrum: die Bindungstasche. Komplex: Enzym mit gebundenem Substrat. Substratspezifität: ein Substrat. Wirkungsspezifität: eine Reaktion."),
          },
        ],
        mistakes: TERM_WRONG.filter((w) => ["subSpec", "actSpec", "site"].includes(w.left) && ["subSpec", "actSpec", "complex"].includes(w.right)).map((w) => ({ when: { kind: "match", pairs: [[T[w.left], D[w.right]]] }, title: w.title, say: w.say })),
      },
    },
    {
      type: "widget",
      title: tx("Activation energy", "Aktivierungsenergie"),
      blob: tx("Why don't reactions just happen by themselves?", "Warum laufen Reaktionen nicht einfach von selbst ab?"),
      body: tx(
        "To get a reaction going, the particles need a starting energy: the **activation energy** $E_A$. Enzymes **lower** it. That's why reactions run quickly at body temperature. Switch between with and without enzyme and count the particles that make it over the hill.",
        "Damit eine Reaktion startet, brauchen die Teilchen eine Startenergie: die **Aktivierungsenergie** $E_A$. Enzyme **senken** sie. Darum laufen Reaktionen schon bei Körpertemperatur schnell ab. Schalte zwischen mit und ohne Enzym um und zähl die Teilchen, die den Berg schaffen.",
      ),
      widget: EnzymeEnergy,
    },
    { type: "check", blob: tx("Read the diagram like a pro.", "Lies das Diagramm wie ein Profi."), exercise: energyCheck },
    {
      type: "widget",
      title: tx("Temperature and pH", "Temperatur und pH-Wert"),
      blob: tx("Turn up the heat, but carefully!", "Dreh die Hitze hoch, aber vorsichtig!"),
      body: tx(
        "Move the sliders and watch the activity curve. Heat the enzyme above 60 °C and then cool it down again. In the pH tab, compare pepsin, salivary amylase and trypsin.",
        "Beweg die Regler und beobachte die Aktivitätskurve. Erhitze das Enzym auf über 60 °C und kühl es dann wieder ab. Vergleich im pH-Tab Pepsin, Speichel-Amylase und Trypsin.",
      ),
      widget: EnzymeActivity,
    },
    {
      type: "explain",
      title: tx("RGT rule, optimum and denaturation", "RGT-Regel, Optimum und Denaturierung"),
      blob: tx("Every enzyme has its feel-good zone.", "Jedes Enzym hat seinen Wohlfühlbereich."),
      body: tx("Enzyme activity depends on temperature and pH. Each enzyme has an **optimum** at which it works fastest.", "Die Enzymaktivität hängt von Temperatur und pH-Wert ab. Jedes Enzym hat ein **Optimum**, bei dem es am schnellsten arbeitet."),
      frames: [
        { math: tx('"+10" \\deg"C" \\Rightarrow v \\cdot 2 "to" 3', '"+10" \\deg"C" \\Rightarrow v \\cdot 2 "bis" 3'), note: tx("**RGT rule** (reaction rate and temperature): 10 °C warmer makes a reaction 2 to 3 times as fast. The particles move faster and collide more often.", "**RGT-Regel** (Reaktionsgeschwindigkeit-Temperatur-Regel): 10 °C wärmer macht eine Reaktion 2- bis 3-mal so schnell. Die Teilchen bewegen sich schneller und stoßen häufiger zusammen.") },
        { math: tx('37 \\deg"C": "optimum"', '37 \\deg"C": "Optimum"'), note: tx("Most human enzymes work best at about 37 °C: their **temperature optimum**.", "Die meisten Enzyme des Menschen arbeiten bei etwa 37 °C am besten: ihr **Temperaturoptimum**.") },
        { math: tx('"above" 45 \\deg"C": "denaturation (irreversible)"', '"über" 45 \\deg"C": "Denaturierung (irreversibel)"'), note: tx("Above that, heat destroys the protein's spatial structure. The active site is deformed and the substrate no longer fits. This **denaturation** is irreversible.", "Darüber zerstört die Hitze die räumliche Struktur des Proteins. Das aktive Zentrum verformt sich, das Substrat passt nicht mehr. Diese **Denaturierung** ist irreversibel.") },
        { math: tx('0 \\deg"C": "slow, but intact (reversible)"', '0 \\deg"C": "langsam, aber intakt (reversibel)"'), note: tx("In the cold the particles move slowly and rarely meet. The enzyme is **not** denatured: warmed up, it works again.", "Bei Kälte bewegen sich die Teilchen langsam und treffen sich selten. Das Enzym wird aber **nicht** denaturiert: Erwärmt arbeitet es wieder.") },
        {
          math: tx('"pepsin" \\; 2 \\quad "amylase" \\; 7 \\quad "trypsin" \\; 8', '"Pepsin" \\; 2 \\quad "Amylase" \\; 7 \\quad "Trypsin" \\; 8'),
          note: tx("**pH optimum**: pepsin in the acidic stomach about pH 2, salivary amylase about pH 7, trypsin in the small intestine about pH 8. Away from it, the charges in the active site change; strong acids and bases denature.", "**pH-Optimum**: Pepsin im sauren Magen etwa pH 2, Speichel-Amylase etwa pH 7, Trypsin im Dünndarm etwa pH 8. Abseits davon ändern sich die Ladungen im aktiven Zentrum, starke Säuren und Basen denaturieren."),
        },
      ],
    },
    { type: "check", blob: tx("Time to calculate!", "Zeit zum Rechnen!"), exercise: rgtCheck },
    {
      type: "widget",
      title: tx("More substrate, more speed?", "Mehr Substrat, mehr Tempo?"),
      blob: tx("What happens when every enzyme is busy?", "Was passiert, wenn jedes Enzym beschäftigt ist?"),
      body: tx(
        "Add substrate bit by bit. At first the rate rises almost in proportion, then the curve flattens: **saturation**. Then try twice the enzyme.",
        "Gib nach und nach Substrat dazu. Zuerst steigt die Geschwindigkeit fast proportional, dann flacht die Kurve ab: **Sättigung**. Probier dann doppelt so viel Enzym.",
      ),
      widget: EnzymeSaturation,
    },
    {
      type: "check",
      blob: tx("Last one! Think of the busy active sites.", "Die letzte! Denk an die besetzten aktiven Zentren."),
      exercise: {
        instruction: PICK,
        text: tx("An enzyme reaction is saturated. You double the substrate concentration. What happens to the rate?", "Eine Enzymreaktion ist gesättigt. Du verdoppelst die Substratkonzentration. Was passiert mit der Geschwindigkeit?"),
        visual: visual(EnzymeMMGraph, { curves: [{ vmax: 80, km: 4 }], xMax: 60, xStep: 10, yMax: 100, yStep: 20, asymptote: 80, bare: true }),
        answer: saturationCheck.answer,
        hint: tx("Are there any free active sites left?", "Gibt es noch freie aktive Zentren?"),
        solution: [{ math: tx('"saturation:" \\; "more substrate" \\Rightarrow "no faster"', '"Sättigung:" \\; "mehr Substrat" \\Rightarrow "nicht schneller"'), note: tx("All active sites are busy. Extra substrate just waits. Only more enzyme would make it faster.", "Alle aktiven Zentren sind besetzt. Zusätzliches Substrat wartet nur. Schneller ginge es nur mit mehr Enzym.") }],
        mistakes: saturationCheck.mistakes,
      },
    },
  ],
  summary: [
    {
      title: tx("Enzyme-substrate complex", "Enzym-Substrat-Komplex"),
      body: tx(
        "The substrate binds in the **active site** and forms the **enzyme-substrate complex**. Then the products leave and the enzyme is unchanged.",
        "Das Substrat bindet im **aktiven Zentrum**, es entsteht der **Enzym-Substrat-Komplex**. Dann lösen sich die Produkte, das Enzym ist unverändert.",
      ),
      examples: ["E + S \\to ES \\to E + P"],
      tone: "rule",
    },
    {
      title: tx("Specificity", "Spezifität"),
      body: tx("**Substrate specificity**: only one particular substrate fits (lock and key). **Reaction specificity**: only one particular reaction is catalysed.", "**Substratspezifität**: Nur ein bestimmtes Substrat passt (Schlüssel-Schloss-Prinzip). **Wirkungsspezifität**: Nur eine bestimmte Reaktion wird katalysiert."),
      tone: "rule",
    },
    {
      title: tx("Activation energy", "Aktivierungsenergie"),
      body: tx("Enzymes **lower the activation energy** $E_A$, so reactions run fast at body temperature. ΔE between substrate and products stays the same.", "Enzyme **senken die Aktivierungsenergie** $E_A$, darum laufen Reaktionen bei Körpertemperatur schnell ab. ΔE zwischen Substrat und Produkten bleibt gleich."),
      examples: [tx('E_A "with enzyme" < E_A "without"', 'E_A "mit Enzym" < E_A "ohne"')],
      tone: "rule",
    },
    {
      title: tx("Temperature", "Temperatur"),
      body: tx(
        "**RGT rule**: +10 °C → 2 to 3 times as fast (only below the optimum). Optimum of human enzymes about 37 °C. Above about 45 °C **denaturation** (irreversible). Cold only slows down (reversible).",
        "**RGT-Regel**: +10 °C → 2- bis 3-mal so schnell (nur unterhalb des Optimums). Optimum menschlicher Enzyme etwa 37 °C. Ab etwa 45 °C **Denaturierung** (irreversibel). Kälte bremst nur (reversibel).",
      ),
      examples: [tx('"+10" \\deg"C" \\Rightarrow v \\cdot 2 "to" 3', '"+10" \\deg"C" \\Rightarrow v \\cdot 2 "bis" 3')],
      tone: "rule",
    },
    {
      title: tx("pH and substrate", "pH-Wert und Substrat"),
      body: tx(
        "pH optimum: pepsin (stomach) about 2, salivary amylase about 7, trypsin (small intestine) about 8. More substrate speeds up until **saturation**: then all active sites are busy and only more enzyme helps.",
        "pH-Optimum: Pepsin (Magen) etwa 2, Speichel-Amylase etwa 7, Trypsin (Dünndarm) etwa 8. Mehr Substrat beschleunigt bis zur **Sättigung**: Dann sind alle aktiven Zentren besetzt, und nur mehr Enzym hilft.",
      ),
      examples: [tx('"pepsin" \\; 2 \\quad "amylase" \\; 7 \\quad "trypsin" \\; 8', '"Pepsin" \\; 2 \\quad "Amylase" \\; 7 \\quad "Trypsin" \\; 8')],
      tone: "tip",
    },
    {
      title: tx("Typical mistakes", "Typische Fehler"),
      body: tx(
        "Cold does **not** denature. Hotter isn't always faster. Enzymes don't change ΔE. At saturation more substrate doesn't help. And enzymes are never used up.",
        "Kälte denaturiert **nicht**. Wärmer ist nicht immer schneller. Enzyme ändern ΔE nicht. Bei Sättigung hilft mehr Substrat nicht. Und Enzyme werden nie verbraucht.",
      ),
      tone: "warning",
    },
  ],
};
