"use client";

// Level 3 (Experte, Oberstufe): humoral and cellular immune response, antigen presentation on
// MHC I and MHC II, cytokines (interleukins), clonal selection and expansion, antibody structure
// and classes, primary and secondary response (IgM, IgG, log titre), HIV and AIDS, allergy (IgE,
// mast cells, histamine), autoimmune diseases and the ELISA test.

import { tx, type Text } from "@/i18n/text";
import { ANTIBODY_PARTS, ImmuneAntibodyStructure, ImmuneElisaPlate } from "@/learn/biology/visuals/ImmuneAntibody";
import { ImmuneClonal } from "@/learn/biology/visuals/ImmuneClonal";
import { ImmuneMHC } from "@/learn/biology/visuals/ImmuneMHC";
import { ImmuneTiter, ImmuneTiterGraph } from "@/learn/biology/visuals/ImmuneTiter";
import { ImmuneVirusCycle } from "@/learn/biology/visuals/ImmuneVirusCycle";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { ALLERGY, AUTOIMMUNE, CLONAL, DISORDER_NAMES, DISORDERS, ELISA, HIV_CYCLE, HUMORAL, IG_CLASSES, MHC_PAIRS, PRESENTERS, type Disorder, type Presenter } from "./data";
import { capT, choice, de, en, join, listFrame, matchSlip, mistakes, orderSlip, q, solve, some, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Antigen presentation

const MHC_OPTS = {
  i_tk: tx("MHC I, recognised by T killer cells (CD8)", "MHC-I, erkannt von T-Killerzellen (CD8)"),
  ii_th: tx("MHC II, recognised by T helper cells (CD4)", "MHC-II, erkannt von T-Helferzellen (CD4)"),
  i_th: tx("MHC I, recognised by T helper cells (CD4)", "MHC-I, erkannt von T-Helferzellen (CD4)"),
  ii_tk: tx("MHC II, recognised by T killer cells (CD8)", "MHC-II, erkannt von T-Killerzellen (CD8)"),
};

function mhcTask(rng: Rng, p: Presenter = rng.pick(PRESENTERS)): Exercise {
  const one = p.mhc === 1;
  const opts: Opt[] = one
    ? [
        { text: MHC_OPTS.i_tk },
        { text: MHC_OPTS.ii_th, title: tx("MHC I and II swapped", "MHC-I und MHC-II vertauscht"), say: tx("This is a normal body cell presenting peptides of its own (here altered or viral) proteins: that's MHC I. MHC II only exists on antigen-presenting cells.", "Das ist eine normale Körperzelle, die Peptide ihrer eigenen (hier veränderten oder viralen) Proteine zeigt: Das ist MHC-I. MHC-II gibt es nur auf antigenpräsentierenden Zellen.") },
        { text: MHC_OPTS.i_th, title: tx("CD8 goes with MHC I", "CD8 gehört zu MHC-I"), say: tx("MHC I is the right molecule, but it is read by T killer cells with their co-receptor CD8. They must kill the cell.", "MHC-I stimmt, aber es wird von T-Killerzellen mit ihrem Corezeptor CD8 gelesen. Sie müssen die Zelle ja töten.") },
        { text: MHC_OPTS.ii_tk, title: tx("Check both parts", "Prüf beide Teile"), say: tx("T killer cells (CD8) only recognise MHC I. And a body cell like this one carries MHC I, not MHC II.", "T-Killerzellen (CD8) erkennen nur MHC-I. Und eine solche Körperzelle trägt MHC-I, nicht MHC-II.") },
      ]
    : [
        { text: MHC_OPTS.ii_th },
        { text: MHC_OPTS.i_tk, title: tx("MHC I and II swapped", "MHC-I und MHC-II vertauscht"), say: tx("Fragments of pathogens that an antigen-presenting cell has taken up are shown on MHC II, to T helper cells. MHC I is for the cell's own proteins.", "Bruchstücke von Erregern, die eine antigenpräsentierende Zelle aufgenommen hat, zeigt sie auf MHC-II, und zwar T-Helferzellen. MHC-I ist für die eigenen Proteine der Zelle da.") },
        { text: MHC_OPTS.ii_tk, title: tx("CD4 goes with MHC II", "CD4 gehört zu MHC-II"), say: tx("MHC II is right, but it is read by T helper cells with their co-receptor CD4.", "MHC-II stimmt, aber es wird von T-Helferzellen mit ihrem Corezeptor CD4 gelesen.") },
        { text: MHC_OPTS.i_th, title: tx("Check both parts", "Prüf beide Teile"), say: tx("T helper cells (CD4) recognise MHC II. Taken-up antigens end up on MHC II.", "T-Helferzellen (CD4) erkennen MHC-II. Aufgenommene Antigene landen auf MHC-II.") },
      ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Antigen presentation", "Antigenpräsentation"),
    text: tx(`${en(p.text)} On which molecule are the peptides presented, and which cell recognises them?`, `${de(p.text)} Auf welchem Molekül werden die Peptide präsentiert, und welche Zelle erkennt sie?`),
    answer,
    hint: tx("MHC I: all nucleated cells show their own proteins. MHC II: antigen-presenting cells show what they took up.", "MHC-I: Alle kernhaltigen Zellen zeigen ihre eigenen Proteine. MHC-II: Antigenpräsentierende Zellen zeigen, was sie aufgenommen haben."),
    solution: solve(
      one ? tx("protein made inside the cell", "in der Zelle gebildetes Protein") : tx("taken-up antigen", "aufgenommenes Antigen"),
      one ? tx("The peptides come from proteins the cell makes itself (viral or altered).", "Die Peptide stammen aus Proteinen, die die Zelle selbst herstellt (viral oder verändert).") : tx("The peptides come from material the cell took up and digested.", "Die Peptide stammen aus Material, das die Zelle aufgenommen und verdaut hat."),
      one ? tx("MHC I, T killer cell", "MHC-I, T-Killerzelle") : tx("MHC II, T helper cell", "MHC-II, T-Helferzelle"),
      one ? tx("**MHC I** presents to **T killer cells** (CD8), which kill the cell.", "**MHC-I** präsentiert den **T-Killerzellen** (CD8), die die Zelle töten.") : tx("**MHC II** presents to **T helper cells** (CD4), which then activate B cells and T killer cells.", "**MHC-II** präsentiert den **T-Helferzellen** (CD4), die dann B-Zellen und T-Killerzellen aktivieren."),
    ),
    mistakes: list,
  };
}

function mhcMatchTask(rng: Rng): Exercise {
  const pick = some(rng, MHC_PAIRS, 4);
  const pairs = pick.map((p) => [p[0], p[1]] as [Text, Text]);
  const unused = MHC_PAIRS.filter((p) => !pick.includes(p));
  const distractors = [rng.pick(unused)[1]];
  const all = [...pairs.map((p) => p[1]), ...distractors];
  const offered = (t: Text) => all.some((x) => en(x) === en(t));
  const find = (name: string) => MHC_PAIRS.find((p) => en(p[0]) === name)!;
  const has = (name: string) => pick.some((p) => en(p[0]) === name);
  const list: Mistake[] = [];
  if (has("CD4") && offered(find("CD8")[1])) list.push(matchSlip([[find("CD4")[0], find("CD8")[1]]], tx("CD4 and CD8 swapped", "CD4 und CD8 vertauscht"), tx("CD4 sits on T helper cells and binds MHC II; CD8 sits on T killer cells and binds MHC I. A memory aid: 4 × 2 = 8 × 1.", "CD4 sitzt auf T-Helferzellen und bindet MHC-II; CD8 sitzt auf T-Killerzellen und bindet MHC-I. Eselsbrücke: 4 · 2 = 8 · 1.")));
  if (has("MHC I") && offered(find("MHC II")[1])) list.push(matchSlip([[find("MHC I")[0], find("MHC II")[1]]], tx("MHC I and II swapped", "MHC-I und MHC-II vertauscht"), tx("MHC I is everywhere (all nucleated cells); MHC II only on macrophages, dendritic cells and B cells.", "MHC-I ist überall (alle kernhaltigen Zellen); MHC-II nur auf Makrophagen, dendritischen Zellen und B-Zellen.")));
  if (has("T cell receptor") && offered(find("B cell receptor")[1])) list.push(matchSlip([[find("T cell receptor")[0], find("B cell receptor")[1]]], tx("T cells need MHC", "T-Zellen brauchen MHC"), tx("T cell receptors can't see free antigen: they only recognise peptides presented on MHC. Free antigen is bound by B cell receptors.", "T-Zell-Rezeptoren erkennen kein freies Antigen, sondern nur Peptide auf MHC. Freies Antigen binden die B-Zell-Rezeptoren.")));
  return {
    instruction: tx("Match", "Ordne zu"),
    text: tx("Match each molecule with the right description.", "Ordne jedem Molekül die passende Beschreibung zu."),
    answer: { kind: "match", pairs, distractors },
    hint: tx("MHC I goes with CD8 (T killer cells), MHC II with CD4 (T helper cells).", "MHC-I gehört zu CD8 (T-Killerzellen), MHC-II zu CD4 (T-Helferzellen)."),
    solution: pairs.map(([a, b], i) => ({ math: join(q(a, `a${i}`), "\\to", q(b, `b${i}`)), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`) })),
    mistakes: list,
  };
}

const HUM: Text = tx("Humoral immune response", "Humorale Immunantwort");
const CELL: Text = tx("Cellular immune response", "Zelluläre Immunantwort");

function humoralTask(rng: Rng): Exercise {
  const h = rng.pick(HUMORAL);
  const options = [HUM, CELL];
  return {
    instruction: tx("Humoral or cellular?", "Humoral oder zellulär?"),
    text: tx(`${en(h.text)} Which part of the specific immune response is this?`, `${de(h.text)} Welcher Teil der spezifischen Immunantwort ist das?`),
    answer: { kind: "choice", options, correct: h.humoral ? 0 : 1 },
    hint: tx("Humoral: antibodies in body fluids. Cellular: T killer cells attack cells directly.", "Humoral: Antikörper in Körperflüssigkeiten. Zellulär: T-Killerzellen greifen Zellen direkt an."),
    solution: solve(h.humoral ? tx("antibodies in body fluids", "Antikörper in Körperflüssigkeiten") : tx("T cells against cells", "T-Zellen gegen Zellen"), h.humoral ? tx("This works through antibodies in blood and lymph.", "Das läuft über Antikörper in Blut und Lymphe.") : tx("Here T cells attack cells directly.", "Hier greifen T-Zellen direkt Zellen an."), h.humoral ? HUM : CELL, h.humoral ? tx("So it's the **humoral** response (humor: fluid).", "Also die **humorale** Antwort (humor: Flüssigkeit).") : tx("So it's the **cellular** response.", "Also die **zelluläre** Antwort.")),
    mistakes: [
      h.humoral
        ? { when: { kind: "choice", options, correct: 1 }, title: tx("Antibodies are humoral", "Antikörper sind humoral"), say: tx("Antibodies and plasma cells belong to the humoral response: it acts in the body fluids (humor: fluid).", "Antikörper und Plasmazellen gehören zur humoralen Antwort: Sie wirkt in den Körperflüssigkeiten (humor: Flüssigkeit).") }
        : { when: { kind: "choice", options, correct: 0 }, title: tx("Cells against cells", "Zellen gegen Zellen"), say: tx("Antibodies can't reach pathogens inside cells. Here T cells attack the cell itself: cellular response.", "An Erreger im Zellinneren kommen Antikörper nicht heran. Hier greifen T-Zellen die Zelle selbst an: zelluläre Antwort.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// Antibodies

const AB_CONFUSE: Record<string, Record<string, Text>> = {
  variable: { constant: tx("Swapped! The constant region forms the stem and is the same in all antibodies of a class. The variable region sits at the tips.", "Vertauscht! Die konstante Region bildet den Stamm und ist bei allen Antikörpern einer Klasse gleich. Die variable Region sitzt an den Spitzen.") },
  constant: { variable: tx("Swapped! The variable region sits at the tips and differs from antibody to antibody. The stem is constant.", "Vertauscht! Die variable Region sitzt an den Spitzen und ist bei jedem Antikörper anders. Der Stamm ist konstant.") },
  heavy: { light: tx("The light chains are the short ones on the outside of the arms. The long chains that also form the stem are the heavy chains.", "Die leichten Ketten sind die kurzen außen an den Armen. Die langen Ketten, die auch den Stamm bilden, sind die schweren.") },
  light: { heavy: tx("The heavy chains are the long ones forming the stem. The short ones on the outside of the arms are the light chains.", "Die schweren Ketten sind die langen, die den Stamm bilden. Die kurzen außen an den Armen sind die leichten Ketten.") },
  site: { antigen: tx("The antigen belongs to the pathogen. The ? marks the pocket of the antibody that holds it.", "Das Antigen gehört zum Erreger. Das ? zeigt auf die Tasche des Antikörpers, die es festhält.") },
  antigen: { site: tx("The binding site is part of the antibody. The ? marks what is bound: the structure on the pathogen.", "Die Bindungsstelle ist Teil des Antikörpers. Das ? zeigt auf das, was gebunden wird: die Struktur auf dem Erreger.") },
};

function antibodyFigureTask(rng: Rng, id = rng.pick(ANTIBODY_PARTS).id): Exercise {
  const part = ANTIBODY_PARTS.find((p) => p.id === id)!;
  const near = Object.keys(AB_CONFUSE[id] ?? {});
  const rest = some(rng, ANTIBODY_PARTS.filter((p) => p.id !== id && !near.includes(p.id)), 3 - near.length);
  const opts: Opt[] = [
    { text: capT(part.label) },
    ...[...near.map((n) => ANTIBODY_PARTS.find((p) => p.id === n)!), ...rest].map((p) => ({
      text: capT(p.label),
      title: tx("Another part", "Ein anderer Teil"),
      say: AB_CONFUSE[id]?.[p.id] ?? tx(`That's elsewhere: the ${en(p.label)} ${en(p.info!).charAt(0).toLowerCase()}${en(p.info!).slice(1)}`, `Das ist woanders. ${de(capT(p.label))}: ${de(p.info!)}`),
    })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Antibody structure", "Bau eines Antikörpers"),
    text: tx("What is the part marked with ? called?", "Wie heißt der mit ? markierte Teil?"),
    visual: visual(ImmuneAntibodyStructure, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("Two heavy and two light chains; variable regions at the tips, constant region in the stem.", "Zwei schwere und zwei leichte Ketten; variable Regionen an den Spitzen, konstante Region im Stamm."),
    solution: [{ math: q(capT(part.label), "a"), note: tx(`${id === "disulfide" ? "Those are" : "That's"} the **${en(part.label)}**. ${en(part.info!)}`, `${id === "disulfide" ? "Das sind die" : id === "antigen" ? "Das ist das" : "Das ist die"} **${de(part.label)}**. ${de(part.info!)}`), highlight: ["a"] }],
    mistakes: list,
  };
}

const IG_LEFT: Text[] = [tx("IgM antibodies", "IgM-Antikörper"), tx("IgG antibodies", "IgG-Antikörper"), tx("IgA antibodies", "IgA-Antikörper"), tx("IgE antibodies", "IgE-Antikörper"), tx("IgD antibodies", "IgD-Antikörper")];

function igClassTask(rng: Rng): Exercise {
  const idx = some(rng, [0, 1, 2, 3, 4], 4).sort((a, b) => a - b);
  const pairs = idx.map((i) => [IG_LEFT[i], IG_CLASSES[i][1]] as [Text, Text]);
  const list: Mistake[] = [];
  if (idx.includes(0) && idx.includes(1)) list.push(matchSlip([[IG_LEFT[1], IG_CLASSES[0][1]]], tx("IgM comes first", "IgM kommt zuerst"), tx("In the primary response IgM (the big pentamer) appears first. IgG follows and dominates the secondary response.", "In der Primärantwort erscheint zuerst IgM (das große Pentamer). IgG folgt und beherrscht die Sekundärantwort.")));
  if (idx.includes(3) && idx.includes(1)) list.push(matchSlip([[IG_LEFT[1], IG_CLASSES[3][1]]], tx("Allergy is IgE", "Allergie ist IgE"), tx("Antibodies on mast cells in allergies are IgE, not IgG.", "Die Antikörper auf den Mastzellen bei Allergien sind IgE, nicht IgG.")));
  return {
    instruction: tx("Antibody classes", "Antikörperklassen"),
    text: tx("Match the antibody classes with their features.", "Ordne den Antikörperklassen ihre Merkmale zu."),
    answer: { kind: "match", pairs },
    hint: tx("M like 'made first', G is the most common, A in secretions, E with mast cells, D on naive B cells.", "M wie „macht den Anfang“, G ist am häufigsten, A in Sekreten, E bei Mastzellen, D auf naiven B-Zellen."),
    solution: pairs.map(([a, b], i) => ({ math: join(q(a, `a${i}`), "\\to", q(b, `b${i}`)), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`) })),
    mistakes: list,
  };
}

function bindingTask(rng: Rng, form = rng.int(0, 3)): Exercise {
  const forms = [
    { text: tx("How many antigen-binding sites does one IgG antibody have?", "Wie viele Antigenbindungsstellen hat ein IgG-Antikörper?"), value: 2, slips: [[1, tx("Two arms", "Zwei Arme"), tx("Each arm of the Y carries a binding site: so there are two, and they are identical.", "Jeder Arm des Y trägt eine Bindungsstelle: Es sind also zwei, und sie sind identisch.")]] },
    { text: tx("How many polypeptide chains does one IgG antibody consist of?", "Aus wie vielen Polypeptidketten besteht ein IgG-Antikörper?"), value: 4, slips: [[2, tx("Light chains too", "Auch leichte Ketten"), tx("Two heavy chains, yes, but there are also two light chains on the outside of the arms.", "Zwei schwere Ketten, ja, aber außen an den Armen sitzen noch zwei leichte Ketten.")]] },
    { text: tx("IgM is a pentamer: five Y-shaped units joined together. How many antigen-binding sites does it have?", "IgM ist ein Pentamer: fünf Y-förmige Einheiten, die verbunden sind. Wie viele Antigenbindungsstellen hat es?"), value: 10, slips: [[5, tx("Two per unit", "Zwei pro Einheit"), tx("Each of the five units has two binding sites, like every Y.", "Jede der fünf Einheiten hat zwei Bindungsstellen, wie jedes Y.")]] },
    { text: tx("IgA in saliva is a dimer: two Y-shaped units. How many antigen-binding sites does it have?", "IgA im Speichel ist ein Dimer: zwei Y-förmige Einheiten. Wie viele Antigenbindungsstellen hat es?"), value: 4, slips: [[2, tx("Two per unit", "Zwei pro Einheit"), tx("Each of the two units has two binding sites.", "Jede der beiden Einheiten hat zwei Bindungsstellen.")]] },
  ] as const;
  const f = forms[form];
  const answer: AnswerSpec = { kind: "number", value: f.value };
  const m = mistakes(answer);
  for (const [v, title, say] of f.slips) m.add({ kind: "number", value: v }, title, say);
  return {
    instruction: tx("Antibody structure", "Bau eines Antikörpers"),
    text: f.text,
    answer,
    hint: tx("One Y: two heavy and two light chains, one binding site at each arm tip.", "Ein Y: zwei schwere und zwei leichte Ketten, an jeder Armspitze eine Bindungsstelle."),
    solution: [
      { math: tx('"one Y:"#y \\; 2 "binding sites," \\; 4 "chains"', '"ein Y:"#y \\; 2 "Bindungsstellen," \\; 4 "Ketten"'), note: tx("A single antibody unit (like IgG) has two identical binding sites and four chains.", "Eine einzelne Antikörper-Einheit (wie IgG) hat zwei identische Bindungsstellen und vier Ketten.") },
      { math: `${f.value}#r`, note: tx(`So the answer is **${f.value}**.`, `Die Antwort ist also **${f.value}**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Clonal selection

const CLONAL_SHORT: Text[] = [tx("diversity", "Vielfalt"), tx("selection", "Selektion"), tx("activation", "Aktivierung"), tx("expansion", "Expansion"), tx("differentiation", "Differenzierung")];

function clonalOrderTask(): Exercise {
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("Put the steps of clonal selection in order.", "Bring die Schritte der klonalen Selektion in die richtige Reihenfolge."),
    answer: { kind: "order", items: CLONAL },
    hint: tx("The diversity exists before the antigen arrives.", "Die Vielfalt gibt es schon, bevor das Antigen kommt."),
    solution: [{ math: listFrame(CLONAL_SHORT), note: tx("Diversity first (before any contact), then selection by the antigen, activation by a T helper cell, expansion by mitosis and differentiation into plasma and memory cells.", "Erst die Vielfalt (vor jedem Kontakt), dann die Selektion durch das Antigen, Aktivierung durch eine T-Helferzelle, Expansion durch Mitose und Differenzierung zu Plasma- und Gedächtniszellen.") }],
    mistakes: [
      orderSlip([CLONAL[1], CLONAL[0]], tx("Selection, not instruction", "Selektion, nicht Anleitung"), tx("The antigen isn't a template for the receptor! The matching clones exist before the first contact; the antigen only selects one of them.", "Das Antigen ist keine Vorlage für den Rezeptor! Die passenden Klone gibt es schon vor dem ersten Kontakt; das Antigen wählt nur einen davon aus.")),
      orderSlip([CLONAL[3], CLONAL[2]], tx("Activation first", "Erst aktivieren"), tx("Only the activation by a T helper cell (interleukins) starts the divisions.", "Erst die Aktivierung durch eine T-Helferzelle (Interleukine) löst die Teilungen aus.")),
      orderSlip([CLONAL[4], CLONAL[3]], tx("Divide first", "Erst teilen"), tx("First the cell multiplies into a large clone; then the clone's cells differentiate.", "Erst vermehrt sich die Zelle zu einem großen Klon, dann differenzieren sich dessen Zellen.")),
    ],
  };
}

function clonalConceptTask(rng: Rng, form = rng.int(0, 1)): Exercise {
  const forms: { text: Text; opts: Opt[] }[] = [
    {
      text: tx("What does the theory of clonal selection say?", "Was besagt die Theorie der klonalen Selektion?"),
      opts: [
        { text: tx("An antigen selects, among many existing lymphocytes, those with a matching receptor, which then multiply", "Ein Antigen wählt unter vielen schon vorhandenen Lymphozyten diejenigen mit passendem Rezeptor aus, die sich dann vermehren") },
        { text: tx("The antigen serves as a template from which B cells shape matching antibodies", "Das Antigen dient als Vorlage, nach der B-Zellen passende Antikörper formen"), title: tx("Selection, not instruction", "Selektion, nicht Anleitung"), say: tx("That's the old instruction idea. In fact the receptor shapes arise by chance before any contact; the antigen only selects.", "Das ist die alte Instruktions-Idee. Tatsächlich entstehen die Rezeptorformen zufällig vor jedem Kontakt; das Antigen wählt nur aus.") },
        { text: tx("All B cells divide during an infection, and only the matching antibodies remain", "Bei einer Infektion teilen sich alle B-Zellen, und nur die passenden Antikörper bleiben übrig"), title: tx("Only the selected clone", "Nur der ausgewählte Klon"), say: tx("Only the selected clone multiplies. That's why the response takes a few days the first time.", "Nur der ausgewählte Klon vermehrt sich. Deshalb dauert die Antwort beim ersten Mal einige Tage.") },
        { text: tx("Every B cell can make antibodies against any antigen as needed", "Jede B-Zelle kann je nach Bedarf Antikörper gegen jedes Antigen bilden"), title: tx("One cell, one specificity", "Eine Zelle, eine Spezifität"), say: tx("Each B cell (and its clone) makes antibodies with only one binding site shape.", "Jede B-Zelle (und ihr Klon) bildet Antikörper mit nur einer Form der Bindungsstelle.") },
      ],
    },
    {
      text: tx("Why does the primary immune response take several days?", "Warum dauert die primäre Immunantwort mehrere Tage?"),
      opts: [
        { text: tx("The few matching lymphocytes must first be selected, activated and multiplied into a large clone", "Die wenigen passenden Lymphozyten müssen erst ausgewählt, aktiviert und zu einem großen Klon vermehrt werden") },
        { text: tx("The B cells first have to learn the shape of the antigen", "Die B-Zellen müssen die Form des Antigens erst lernen"), title: tx("No learning", "Kein Lernen"), say: tx("No cell learns the shape: the matching receptor already exists. It just takes time until there are enough cells.", "Keine Zelle lernt die Form: Der passende Rezeptor existiert schon. Es dauert nur, bis es genug Zellen sind.") },
        { text: tx("The antigen has to be transported to the bone marrow first", "Das Antigen muss erst ins Knochenmark transportiert werden"), title: tx("Lymph nodes", "Lymphknoten"), say: tx("The response takes place in the lymph nodes and spleen. The delay comes from selection and multiplication.", "Die Antwort läuft in Lymphknoten und Milz ab. Die Verzögerung kommt von Auswahl und Vermehrung.") },
        { text: tx("Antibodies need several days to reach the blood", "Antikörper brauchen mehrere Tage, bis sie ins Blut gelangen"), title: tx("Fast once made", "Schnell, sobald gebildet"), say: tx("Once plasma cells exist, antibodies get into the blood quickly. The slow part is making enough plasma cells.", "Sobald es Plasmazellen gibt, gelangen Antikörper schnell ins Blut. Langsam ist, genug Plasmazellen zu bilden.") },
      ],
    },
  ];
  const f = forms[form];
  const { answer, mistakes: list } = choice(rng, f.opts);
  return {
    instruction: tx("Clonal selection", "Klonale Selektion"),
    text: f.text,
    answer,
    hint: tx("The receptor diversity exists before the antigen arrives.", "Die Rezeptorvielfalt gibt es schon, bevor das Antigen kommt."),
    solution: [
      { math: tx('"many clones"#v \\to "selection"#s', '"viele Klone"#v \\to "Selektion"#s'), note: tx("Millions of clones exist, each with one receptor. The antigen binds to the matching one.", "Es gibt Millionen Klone mit je einem Rezeptor. Das Antigen bindet an den passenden.") },
      { math: tx('"selection"#s \\to "expansion"#e \\to "plasma + memory cells"#p', '"Selektion"#s \\to "Expansion"#e \\to "Plasma- + Gedächtniszellen"#p'), note: tx("The selected clone multiplies and differentiates.", "Der ausgewählte Klon vermehrt sich und differenziert sich."), highlight: ["s"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Graphs

function factorTask(rng: Rng): Exercise {
  const [p1, p2] = rng.pick([
    [2, 3],
    [2, 4],
    [2, 5],
    [3, 4],
    [3, 5],
    [1, 3],
    [1, 4],
  ] as const);
  const value = 10 ** (p2 - p1);
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakes(answer);
  m.add({ kind: "number", value: p2 - p1 }, tx("Log scale!", "Logarithmische Achse!"), tx(`The axis is logarithmic: each grid line is ten times the one below. ${p2 - p1} lines higher means 10^${p2 - p1} times as much.`, `Die Achse ist logarithmisch: Jede Gitterlinie ist das Zehnfache der darunter. ${p2 - p1} Linien höher heißt 10^${p2 - p1}-mal so viel.`));
  m.add({ kind: "number", value: 10 ** p2 - 10 ** p1 }, tx("Factor, not difference", "Faktor, nicht Differenz"), tx("You subtracted. The question asks for the factor: divide the two peak values.", "Du hast subtrahiert. Gefragt ist der Faktor: Teil die beiden Maxima durcheinander."));
  m.add({ kind: "number", value: p2 / p1, tolerance: 0.001 }, tx("Exponents divided", "Exponenten geteilt"), tx("On a log scale you subtract the exponents: 10^a ÷ 10^b = 10^(a−b).", "Auf der logarithmischen Achse subtrahiert man die Exponenten: 10^a : 10^b = 10^(a−b)."));
  return {
    instruction: tx("Read the graph", "Lies das Diagramm ab"),
    text: tx("The graph shows the antibody titre after a first and a second contact with the same antigen (logarithmic axis). By what factor is the peak of the secondary response higher than that of the primary response?", "Das Diagramm zeigt den Antikörpertiter nach einem ersten und einem zweiten Kontakt mit demselben Antigen (logarithmische Achse). Um welchen Faktor ist das Maximum der Sekundärantwort höher als das der Primärantwort?"),
    visual: visual(ImmuneTiterGraph, { preset: "log", p1, p2 }),
    answer,
    hint: tx("Read off both peaks as powers of ten, then divide.", "Lies beide Maxima als Zehnerpotenzen ab und teile dann."),
    solution: [
      { math: `10^{${p1}}#a \\quad 10^{${p2}}#b`, note: tx(`Primary peak: 10^${p1}. Secondary peak: 10^${p2}.`, `Maximum primär: 10^${p1}. Maximum sekundär: 10^${p2}.`) },
      { math: `\\frac{10^{${p2}}}{10^{${p1}}} = 10^{${p2 - p1}} = ${value}#r`, note: tx(`The secondary response is **${value}** times higher, thanks to the memory cells.`, `Die Sekundärantwort ist **${value}**-mal höher, dank der Gedächtniszellen.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

function igmGraphTask(rng: Rng): Exercise {
  const swap = rng.chance(0.5);
  const askIgM = rng.chance(0.5);
  const igmLabel = swap ? "2" : "1";
  const iggLabel = swap ? "1" : "2";
  const C = (l: string): Text => tx(`Curve ${l}`, `Kurve ${l}`);
  const rightL = askIgM ? igmLabel : iggLabel;
  const wrongL = askIgM ? iggLabel : igmLabel;
  const { answer, mistakes: list } = choice(rng, [
    { text: C(rightL) },
    {
      text: C(wrongL),
      title: askIgM ? tx("IgM is the early one", "IgM ist früh dran") : tx("IgG dominates later", "IgG dominiert später"),
      say: askIgM ? tx("IgM appears first in the primary response and soon falls again; in the secondary response it hardly rises. The high, lasting curve is IgG.", "IgM erscheint in der Primärantwort zuerst und fällt bald wieder ab; in der Sekundärantwort steigt es kaum. Die hohe, anhaltende Kurve ist IgG.") : tx("IgG follows IgM in the primary response and dominates the secondary response, high and long-lasting.", "IgG folgt in der Primärantwort auf IgM und beherrscht die Sekundärantwort, hoch und lang anhaltend."),
    },
    { text: tx("Both curves show the same class", "Beide Kurven zeigen dieselbe Klasse"), title: tx("Two classes", "Zwei Klassen"), say: tx("The two curves behave quite differently: they are two antibody classes.", "Die beiden Kurven verlaufen ganz verschieden: Es sind zwei Antikörperklassen.") },
  ]);
  return {
    instruction: tx("Read the graph", "Lies das Diagramm ab"),
    text: askIgM ? tx("The graph shows two antibody classes after a first and a second contact with an antigen. Which curve shows **IgM**?", "Das Diagramm zeigt zwei Antikörperklassen nach einem ersten und einem zweiten Kontakt mit einem Antigen. Welche Kurve zeigt **IgM**?") : tx("The graph shows two antibody classes after a first and a second contact with an antigen. Which curve shows **IgG**?", "Das Diagramm zeigt zwei Antikörperklassen nach einem ersten und einem zweiten Kontakt mit einem Antigen. Welche Kurve zeigt **IgG**?"),
    visual: visual(ImmuneTiterGraph, { preset: "igm", swap }),
    answer,
    hint: tx("Which class is made first in a primary response, and which dominates the secondary response?", "Welche Klasse wird bei der Primärantwort zuerst gebildet, welche beherrscht die Sekundärantwort?"),
    solution: [
      { math: tx('"IgM:"#m \\; "early, short"#a', '"IgM:"#m \\; "früh, kurz"#a'), note: tx(`IgM appears first and falls again soon: curve ${igmLabel}.`, `IgM erscheint zuerst und fällt bald wieder: Kurve ${igmLabel}.`) },
      { math: tx('"IgG:"#g \\; "later, high, lasting"#b', '"IgG:"#g \\; "später, hoch, anhaltend"#b'), note: tx(`IgG follows and dominates the secondary response: curve ${iggLabel}.`, `IgG folgt und beherrscht die Sekundärantwort: Kurve ${iggLabel}.`) },
    ],
    mistakes: list,
  };
}

function twoAntigenTask(rng: Rng): Exercise {
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("There are no memory cells against B yet: a slow primary response takes place", "Gegen B gibt es noch keine Gedächtniszellen: Es läuft eine langsame Primärantwort ab") },
    { text: tx("Antigen B is less dangerous for the mouse, so it reacts more weakly", "Antigen B ist für die Maus weniger gefährlich, deshalb reagiert sie schwächer"), title: tx("Memory, not danger", "Gedächtnis, nicht Gefahr"), say: tx("The strength of the response doesn't depend on danger but on whether memory cells exist already.", "Die Stärke der Antwort hängt nicht von der Gefahr ab, sondern davon, ob es schon Gedächtniszellen gibt.") },
    { text: tx("The memory cells against A also attack B, but more slowly", "Die Gedächtniszellen gegen A greifen auch B an, nur langsamer"), title: tx("Memory is specific", "Gedächtnis ist spezifisch"), say: tx("Memory cells are specific: those against A don't recognise B at all.", "Gedächtniszellen sind spezifisch: Die gegen A erkennen B gar nicht.") },
    { text: tx("The antibodies against A block the response to B", "Die Antikörper gegen A blockieren die Antwort gegen B"), title: tx("No blocking", "Keine Blockade"), say: tx("Antibodies against A don't bind B and don't block anything. B simply meets the immune system for the first time.", "Antikörper gegen A binden B nicht und blockieren nichts. B trifft einfach zum ersten Mal auf das Immunsystem.") },
  ]);
  return {
    instruction: tx("Interpret the experiment", "Werte das Experiment aus"),
    text: tx("A mouse is immunised with antigen A on day 0. On day 40 it gets antigen A again and a new antigen B at the same time. Why does the curve for B rise so much more slowly than the curve for A after day 40?", "Eine Maus wird an Tag 0 mit Antigen A immunisiert. An Tag 40 bekommt sie erneut Antigen A und gleichzeitig ein neues Antigen B. Warum steigt die Kurve für B nach Tag 40 so viel langsamer an als die Kurve für A?"),
    visual: visual(ImmuneTiterGraph, { preset: "twoAntigens" }),
    answer,
    hint: tx("Against which antigen does the mouse already have memory cells?", "Gegen welches Antigen hat die Maus schon Gedächtniszellen?"),
    solution: solve(tx("A: second contact, B: first contact", "A: Zweitkontakt, B: Erstkontakt"), tx("For A it's the second contact, for B the first.", "Für A ist es der Zweitkontakt, für B der Erstkontakt."), tx("primary response against B", "Primärantwort gegen B"), tx("Memory cells are specific: only A gets a secondary response, B a slow **primary response**.", "Gedächtniszellen sind spezifisch: Nur A bekommt eine Sekundärantwort, B eine langsame **Primärantwort**.")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// HIV

const HIV_SHORT: Text[] = [tx("docking (CD4)", "Andocken (CD4)"), tx("fusion", "Fusion"), tx("RNA → DNA", "RNA → DNA"), tx("integration", "Integration"), tx("RNA, proteins", "RNA, Proteine"), tx("budding", "Knospung")];

function hivOrderTask(rng: Rng, n = rng.int(5, 6)): Exercise {
  const from = n === 6 ? 0 : rng.int(0, 1);
  const items = HIV_CYCLE.slice(from, from + n);
  const has = (i: number) => i >= from && i < from + n;
  const list: Mistake[] = [];
  if (has(2) && has(3)) list.push(orderSlip([HIV_CYCLE[3], HIV_CYCLE[2]], tx("RNA can't be built in", "RNA lässt sich nicht einbauen"), tx("The host genome is DNA: the viral RNA must first be rewritten into DNA by reverse transcriptase before integrase can insert it.", "Das Wirtsgenom ist DNA: Die Virus-RNA muss erst von der reversen Transkriptase in DNA umgeschrieben werden, bevor die Integrase sie einbauen kann.")));
  if (has(3) && has(4)) list.push(orderSlip([HIV_CYCLE[4], HIV_CYCLE[3]], tx("Provirus first", "Erst das Provirus"), tx("New viral RNA is transcribed from the provirus: so integration comes first.", "Neue Virus-RNA wird vom Provirus abgelesen: Also kommt die Integration zuerst.")));
  if (has(0) && has(1)) list.push(orderSlip([HIV_CYCLE[1], HIV_CYCLE[0]], tx("Docking first", "Erst andocken"), tx("The envelope can only fuse after gp120 has bound to CD4 and the co-receptor.", "Die Hülle kann erst verschmelzen, nachdem gp120 an CD4 und den Corezeptor gebunden hat.")));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("Put the steps of the HIV replication cycle in order.", "Bring die Schritte des HIV-Vermehrungszyklus in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("A retrovirus: RNA becomes DNA, and only DNA can be built into the host genome.", "Ein Retrovirus: Aus RNA wird DNA, und nur DNA lässt sich ins Wirtsgenom einbauen."),
    solution: [{ math: listFrame(HIV_SHORT.slice(from, from + n)), note: tx("Docking to CD4, fusion, reverse transcription, integration (provirus), transcription and translation, budding.", "Andocken an CD4, Fusion, reverse Transkription, Integration (Provirus), Transkription und Translation, Knospung.") }],
    mistakes: list,
  };
}

function hivTask(rng: Rng, form = rng.int(0, 4)): Exercise {
  const forms: { text: Text; opts: Opt[]; a: Text; note: Text }[] = [
    {
      text: tx("Which cells does HIV mainly infect?", "Welche Zellen befällt HIV vor allem?"),
      opts: [
        { text: tx("T helper cells (with the CD4 receptor)", "T-Helferzellen (mit dem CD4-Rezeptor)") },
        { text: tx("B cells", "B-Zellen"), title: tx("Not the B cells", "Nicht die B-Zellen"), say: tx("A classic mix-up! HIV needs the CD4 receptor, which T helper cells carry. B cells only suffer indirectly, because nobody activates them any more.", "Eine klassische Verwechslung! HIV braucht den CD4-Rezeptor, und den tragen T-Helferzellen. B-Zellen leiden nur indirekt, weil sie niemand mehr aktiviert.") },
        { text: tx("T killer cells", "T-Killerzellen"), title: tx("CD8, not CD4", "CD8, nicht CD4"), say: tx("T killer cells carry CD8. HIV docks onto CD4.", "T-Killerzellen tragen CD8. HIV dockt an CD4 an.") },
        { text: tx("Red blood cells", "Rote Blutkörperchen"), title: tx("Immune cells", "Immunzellen"), say: tx("Red blood cells have neither a nucleus nor CD4. HIV infects immune cells.", "Rote Blutkörperchen haben weder Zellkern noch CD4. HIV befällt Immunzellen.") },
      ],
      a: tx("T helper cells", "T-Helferzellen"),
      note: tx("gp120 binds to CD4 on **T helper cells** (and macrophages).", "gp120 bindet an CD4 auf **T-Helferzellen** (und Makrophagen)."),
    },
    {
      text: tx("Why do both the humoral and the cellular response collapse in AIDS?", "Warum bricht bei AIDS sowohl die humorale als auch die zelluläre Immunantwort zusammen?"),
      opts: [
        { text: tx("Without T helper cells neither B cells nor T killer cells are activated", "Ohne T-Helferzellen werden weder B-Zellen noch T-Killerzellen aktiviert") },
        { text: tx("HIV infects B cells and T killer cells directly", "HIV befällt B-Zellen und T-Killerzellen direkt"), title: tx("One target, two effects", "Ein Ziel, zwei Folgen"), say: tx("HIV mainly infects T helper cells. Because they activate both pathways, both fail.", "HIV befällt vor allem T-Helferzellen. Weil die beide Wege aktivieren, fallen beide aus.") },
        { text: tx("HIV destroys all antibodies in the blood", "HIV zerstört alle Antikörper im Blut"), title: tx("Antibodies aren't destroyed", "Antikörper werden nicht zerstört"), say: tx("HIV doesn't destroy antibodies. Hardly any new ones are made, because activation by T helper cells is missing.", "HIV zerstört keine Antikörper. Es werden kaum neue gebildet, weil die Aktivierung durch T-Helferzellen fehlt.") },
        { text: tx("HIV switches off all phagocytes", "HIV schaltet alle Fresszellen ab"), title: tx("The key is CD4", "Der Kern ist CD4"), say: tx("Macrophages can be infected too, but the crucial point is the loss of T helper cells, the coordinators.", "Makrophagen können zwar auch befallen werden, entscheidend ist aber der Verlust der T-Helferzellen, der Koordinatoren.") },
      ],
      a: tx("no T helper cells", "keine T-Helferzellen"),
      note: tx("T helper cells activate B cells (humoral) and T killer cells (cellular). Without them both fail: opportunistic infections become deadly.", "T-Helferzellen aktivieren B-Zellen (humoral) und T-Killerzellen (zellulär). Ohne sie fallen beide aus: Opportunistische Infektionen werden lebensgefährlich."),
    },
    {
      text: tx("Why is HIV called a retrovirus?", "Warum heißt HIV Retrovirus?"),
      opts: [
        { text: tx("It rewrites its RNA into DNA with reverse transcriptase", "Es schreibt seine RNA mit der reversen Transkriptase in DNA um") },
        { text: tx("Its genetic material is DNA, which it rewrites into RNA", "Seine Erbinformation ist DNA, die es in RNA umschreibt"), title: tx("The other way round", "Genau umgekehrt"), say: tx("The other way round: HIV carries RNA and rewrites it backwards into DNA.", "Genau umgekehrt: HIV trägt RNA und schreibt sie rückwärts in DNA um.") },
        { text: tx("It is a particularly old virus", "Es ist ein besonders altes Virus"), title: tx("'Retro' is the direction", "„Retro“ ist die Richtung"), say: tx("'Retro' refers to the direction of the information flow: from RNA back to DNA.", "„Retro“ bezieht sich auf die Richtung des Informationsflusses: von RNA zurück zu DNA.") },
        { text: tx("It keeps coming back after every treatment", "Es kommt nach jeder Behandlung zurück"), title: tx("'Retro' is the direction", "„Retro“ ist die Richtung"), say: tx("'Retro' refers to the direction of the information flow: from RNA back to DNA.", "„Retro“ bezieht sich auf die Richtung des Informationsflusses: von RNA zurück zu DNA.") },
      ],
      a: tx("RNA → DNA", "RNA → DNA"),
      note: tx("Reverse transcriptase rewrites the viral RNA into DNA, against the usual direction DNA → RNA.", "Die reverse Transkriptase schreibt die Virus-RNA in DNA um, entgegen der üblichen Richtung DNA → RNA."),
    },
    {
      text: tx("Why is an HIV antibody test often negative in the first weeks after infection?", "Warum ist ein HIV-Antikörpertest in den ersten Wochen nach einer Ansteckung oft negativ?"),
      opts: [
        { text: tx("The body hasn't made enough antibodies yet (diagnostic window)", "Der Körper hat noch nicht genug Antikörper gebildet (diagnostisches Fenster)") },
        { text: tx("There are no viruses in the blood in the first weeks", "In den ersten Wochen sind noch keine Viren im Blut"), title: tx("Plenty of viruses", "Viren gibt es reichlich"), say: tx("Right at the start the virus multiplies strongly. But the test looks for antibodies, and those take weeks.", "Gerade am Anfang vermehrt sich das Virus stark. Der Test sucht aber Antikörper, und die brauchen Wochen.") },
        { text: tx("The test only detects the virus itself, which hides as a provirus", "Der Test erkennt nur das Virus selbst, das sich als Provirus versteckt"), title: tx("It looks for antibodies", "Er sucht Antikörper"), say: tx("An antibody test (ELISA) detects antibodies against HIV, not the virus.", "Ein Antikörpertest (ELISA) weist Antikörper gegen HIV nach, nicht das Virus.") },
        { text: tx("The virus destroys the antibodies at once", "Das Virus zerstört die Antikörper sofort"), title: tx("Not destroyed", "Nicht zerstört"), say: tx("Antibodies aren't destroyed; they simply haven't been made yet.", "Antikörper werden nicht zerstört; sie sind einfach noch nicht gebildet.") },
      ],
      a: tx("primary response takes weeks", "Primärantwort braucht Wochen"),
      note: tx("The primary response takes time. Until enough antibodies exist, an antibody test can't find anything.", "Die Primärantwort braucht Zeit. Bis genug Antikörper da sind, findet ein Antikörpertest nichts."),
    },
    {
      text: tx("Why is there still no vaccine against HIV?", "Warum gibt es bis heute keinen Impfstoff gegen HIV?"),
      opts: [
        { text: tx("Reverse transcriptase makes many errors: the surface proteins keep changing", "Die reverse Transkriptase arbeitet fehlerhaft: Die Oberflächenproteine verändern sich ständig") },
        { text: tx("HIV has no antigens", "HIV hat keine Antigene"), title: tx("It has antigens", "Antigene hat es"), say: tx("It does, e.g. gp120. The problem: they keep changing.", "Doch, z. B. gp120. Das Problem: Sie verändern sich ständig.") },
        { text: tx("Antibodies can never bind viruses", "Antikörper können grundsätzlich keine Viren binden"), title: tx("They can", "Doch, können sie"), say: tx("Antibodies bind viruses all the time; that's how most vaccines work.", "Antikörper binden ständig Viren; so funktionieren die meisten Impfungen.") },
        { text: tx("A vaccine would make the T helper cells ill", "Ein Impfstoff würde die T-Helferzellen krank machen"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Vaccines with parts of HIV can't infect cells. The real problem is the variability of the virus.", "Impfstoffe mit Teilen von HIV können keine Zellen befallen. Das eigentliche Problem ist die Wandelbarkeit des Virus.") },
      ],
      a: tx("changing antigens", "veränderliche Antigene"),
      note: tx("The error-prone reverse transcriptase produces many mutants; the antigens keep changing and escape the memory.", "Die fehlerhafte reverse Transkriptase erzeugt viele Mutanten; die Antigene verändern sich ständig und entkommen dem Gedächtnis."),
    },
  ];
  const f = forms[form];
  const { answer, mistakes: list } = choice(rng, f.opts);
  return {
    instruction: tx("HIV and AIDS", "HIV und AIDS"),
    text: f.text,
    answer,
    hint: tx("HIV is a retrovirus that uses the CD4 receptor of T helper cells.", "HIV ist ein Retrovirus, das den CD4-Rezeptor der T-Helferzellen nutzt."),
    solution: [
      { math: tx('"HIV"#h \\to "CD4"#c \\to "T helper cells"#t', '"HIV"#h \\to "CD4"#c \\to "T-Helferzellen"#t'), note: tx("HIV infects T helper cells via CD4 and destroys them over years.", "HIV befällt über CD4 die T-Helferzellen und zerstört sie über Jahre.") },
      { math: q(f.a, "a"), note: f.note, highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Allergy, autoimmunity, ELISA

const ALLERGY_SHORT: Text[] = [tx("1st contact", "Erstkontakt"), tx("IgE", "IgE-Bildung"), tx("mast cells", "Mastzellen"), tx("2nd contact", "Zweitkontakt"), tx("histamine", "Histamin"), tx("symptoms", "Symptome")];

function allergyOrderTask(rng: Rng): Exercise {
  const from = rng.int(0, 1);
  const items = ALLERGY.slice(from, from + 5);
  const has = (i: number) => i >= from && i < from + 5;
  const list: Mistake[] = [];
  if (has(5) && has(1)) list.push(orderSlip([ALLERGY[5], ALLERGY[1]], tx("No symptoms at first contact", "Beim Erstkontakt keine Symptome"), tx("At the first contact there are no symptoms yet: the body is only sensitised (IgE on mast cells).", "Beim Erstkontakt gibt es noch keine Symptome: Der Körper wird erst sensibilisiert (IgE auf Mastzellen).")));
  if (has(4) && has(3)) list.push(orderSlip([ALLERGY[4], ALLERGY[3]], tx("Cross-linking triggers", "Die Vernetzung löst aus"), tx("Mast cells only release histamine once the allergen cross-links the IgE on their surface.", "Mastzellen schütten erst Histamin aus, wenn das Allergen die IgE auf ihrer Oberfläche vernetzt.")));
  if (has(2) && has(1)) list.push(orderSlip([ALLERGY[2], ALLERGY[1]], tx("IgE must exist first", "Erst muss es IgE geben"), tx("Plasma cells must first make IgE before it can bind to mast cells.", "Plasmazellen müssen erst IgE bilden, bevor es an Mastzellen binden kann.")));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("Put the course of an allergy (immediate type) in order.", "Bring den Ablauf einer Allergie (Soforttyp) in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("First contact: sensitisation without symptoms. Second contact: reaction.", "Erstkontakt: Sensibilisierung ohne Symptome. Zweitkontakt: Reaktion."),
    solution: [{ math: listFrame(ALLERGY_SHORT.slice(from, from + 5)), note: tx("Sensitisation at the first contact (IgE on mast cells), reaction at the second contact (cross-linking, histamine, symptoms).", "Sensibilisierung beim Erstkontakt (IgE auf Mastzellen), Reaktion beim Zweitkontakt (Vernetzung, Histamin, Symptome).") }],
    mistakes: list,
  };
}

function allergyTask(rng: Rng, form = rng.int(0, 2)): Exercise {
  const forms: { text: Text; opts: Opt[]; a: Text; note: Text }[] = [
    {
      text: tx("Why are there no symptoms at the very first contact with an allergen?", "Warum gibt es beim allerersten Kontakt mit einem Allergen noch keine Symptome?"),
      opts: [
        { text: tx("At the first contact IgE is only made and bound to mast cells (sensitisation)", "Beim Erstkontakt wird erst IgE gebildet und an Mastzellen gebunden (Sensibilisierung)") },
        { text: tx("There are no mast cells at the first contact", "Beim Erstkontakt gibt es noch keine Mastzellen"), title: tx("Mast cells are there", "Mastzellen sind da"), say: tx("Mast cells are always there. What's missing are the IgE antibodies on them.", "Mastzellen sind immer da. Was fehlt, sind die IgE-Antikörper auf ihnen.") },
        { text: tx("The allergen is still harmless the first time", "Das Allergen ist beim ersten Mal noch harmlos"), title: tx("Always harmless", "Immer harmlos"), say: tx("The allergen is always harmless (pollen, nuts). The problem is the overreaction of the immune system.", "Das Allergen ist immer harmlos (Pollen, Nüsse). Das Problem ist die Überreaktion des Immunsystems.") },
        { text: tx("Antibodies destroy the allergen at once the first time", "Antikörper zerstören das Allergen beim ersten Mal sofort"), title: tx("No antibodies yet", "Noch keine Antikörper"), say: tx("At the first contact there are no matching antibodies yet: they are only being made.", "Beim Erstkontakt gibt es noch keine passenden Antikörper: Sie werden erst gebildet.") },
      ],
      a: tx("sensitisation", "Sensibilisierung"),
      note: tx("The first contact only sensitises: IgE is made and sits on mast cells. Symptoms come from the second contact on.", "Der Erstkontakt sensibilisiert nur: IgE wird gebildet und sitzt auf Mastzellen. Symptome gibt es ab dem Zweitkontakt."),
    },
    {
      text: tx("Which substance directly causes symptoms like itching, swelling and a runny nose?", "Welcher Stoff löst Symptome wie Juckreiz, Schwellung und Fließschnupfen direkt aus?"),
      opts: [
        { text: tx("Histamine from mast cells", "Histamin aus Mastzellen") },
        { text: tx("The IgE antibodies themselves", "Die IgE-Antikörper selbst"), title: tx("IgE gives the signal", "IgE gibt das Signal"), say: tx("IgE sits on the mast cells and only triggers them. The symptoms come from the messenger they release.", "IgE sitzt auf den Mastzellen und löst sie nur aus. Die Symptome macht der Botenstoff, den sie ausschütten.") },
        { text: tx("Interleukin 2 from T helper cells", "Interleukin-2 aus T-Helferzellen"), title: tx("Wrong messenger", "Falscher Botenstoff"), say: tx("Interleukin 2 makes lymphocytes divide. The allergy symptoms come from the mast cells.", "Interleukin-2 lässt Lymphozyten sich teilen. Die Allergiesymptome kommen von den Mastzellen.") },
        { text: tx("Perforin from T killer cells", "Perforin aus T-Killerzellen"), title: tx("That's for killing", "Das ist zum Töten"), say: tx("Perforin punches holes into infected cells. Allergy symptoms come from histamine.", "Perforin stanzt Löcher in infizierte Zellen. Allergiesymptome kommen vom Histamin.") },
      ],
      a: tx("histamine", "Histamin"),
      note: tx("Mast cells release **histamine**: vessels widen and leak, mucous membranes swell, it itches.", "Mastzellen schütten **Histamin** aus: Gefäße weiten sich und werden durchlässig, Schleimhäute schwellen, es juckt."),
    },
    {
      text: tx("Which antibody class is involved in an immediate-type allergy?", "Welche Antikörperklasse ist an einer Allergie vom Soforttyp beteiligt?"),
      opts: [
        { text: IG_LEFT[3] },
        { text: IG_LEFT[1], title: tx("IgE on mast cells", "IgE auf Mastzellen"), say: tx("IgG is the main antibody in the blood. On the mast cells in an allergy sits IgE.", "IgG ist der Hauptantikörper im Blut. Auf den Mastzellen sitzt bei Allergien IgE.") },
        { text: IG_LEFT[0], title: tx("IgE on mast cells", "IgE auf Mastzellen"), say: tx("IgM is the first antibody of a primary response. Allergies work through IgE on mast cells.", "IgM ist der erste Antikörper einer Primärantwort. Allergien laufen über IgE auf Mastzellen.") },
        { text: IG_LEFT[2], title: tx("IgE on mast cells", "IgE auf Mastzellen"), say: tx("IgA protects the mucous membranes in secretions. Allergies work through IgE.", "IgA schützt in Sekreten die Schleimhäute. Allergien laufen über IgE.") },
      ],
      a: tx("IgE antibodies", "IgE-Antikörper"),
      note: tx("**IgE** binds with its stem to mast cells; the allergen cross-links it.", "**IgE** bindet mit dem Stamm an Mastzellen; das Allergen vernetzt es."),
    },
  ];
  const f = forms[form];
  const { answer, mistakes: list } = choice(rng, f.opts);
  return {
    instruction: tx("Allergy", "Allergie"),
    text: f.text,
    answer,
    hint: tx("Allergen, IgE, mast cell, histamine.", "Allergen, IgE, Mastzelle, Histamin."),
    solution: [
      { math: tx('"allergen"#a \\to "IgE"#e \\to "mast cell"#m \\to "histamine"#h', '"Allergen"#a \\to "IgE"#e \\to "Mastzelle"#m \\to "Histamin"#h'), note: tx("An allergy is an overreaction to a harmless substance.", "Eine Allergie ist eine Überreaktion auf einen harmlosen Stoff.") },
      { math: q(f.a, "x"), note: f.note, highlight: ["x"] },
    ],
    mistakes: list,
  };
}

const ELISA_SHORT: Text[] = [tx("antigen", "Antigen"), tx("serum", "Serum"), tx("wash", "Waschen"), tx("2nd antibody", "Zweitantikörper"), tx("colour", "Farbe")];

function elisaOrderTask(): Exercise {
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("An ELISA test looks for antibodies against HIV in a patient's blood serum. Put the steps in order.", "Ein ELISA-Test sucht im Blutserum eines Patienten nach Antikörpern gegen HIV. Bring die Schritte in die richtige Reihenfolge."),
    answer: { kind: "order", items: ELISA },
    hint: tx("The second antibody recognises human antibodies. What must be bound before it can stick?", "Der Zweitantikörper erkennt menschliche Antikörper. Was muss gebunden sein, bevor er haften kann?"),
    solution: [{ math: listFrame(ELISA_SHORT), note: tx("Antigen on the plate, serum (antibodies bind if present), wash, enzyme-linked second antibody, wash, substrate: colour means antibodies were there.", "Antigen auf der Platte, Serum (Antikörper binden, falls vorhanden), waschen, enzymgekoppelter Zweitantikörper, waschen, Substrat: Farbe heißt, es waren Antikörper da.") }],
    mistakes: [
      orderSlip([ELISA[3], ELISA[1]], tx("The patient's antibodies first", "Erst die Antikörper des Patienten"), tx("The second antibody binds to human antibodies: they must be bound to the antigen first, so the serum comes before it.", "Der Zweitantikörper bindet an menschliche Antikörper: Die müssen zuerst am Antigen gebunden sein, also kommt das Serum vorher.")),
      orderSlip([ELISA[1], ELISA[0]], tx("Antigen first", "Erst das Antigen"), tx("The antigen must be fixed in the well first; that's what the patient's antibodies bind to.", "Das Antigen muss zuerst in der Vertiefung gebunden sein; daran binden die Antikörper des Patienten.")),
      orderSlip([ELISA[3], ELISA[2]], tx("Wash before adding", "Erst waschen"), tx("Without washing, unbound antibodies from the serum would stay in the well and catch the second antibody.", "Ohne Waschen blieben ungebundene Antikörper aus dem Serum in der Vertiefung und würden den Zweitantikörper abfangen.")),
    ],
  };
}

const SAMPLE = (i: number): Text => tx(`Sample ${i}`, `Probe ${i}`);

function elisaPlateTask(rng: Rng): Exercise {
  let pos: boolean[] = [];
  for (let k = 0; k < 20; k++) {
    pos = [0, 1, 2, 3].map(() => rng.chance(0.45));
    if (pos.some(Boolean) && pos.some((p) => !p)) break;
  }
  if (!pos.some(Boolean)) pos[0] = true;
  if (pos.every(Boolean)) pos[3] = false;
  const wells = [0.92, 0.06, ...pos.map((p) => (p ? rng.int(72, 95) / 100 : rng.int(4, 10) / 100))];
  const options = [1, 2, 3, 4].map(SAMPLE);
  const correct = pos.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const negs = pos.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  m.add({ kind: "multi", options, correct: negs }, tx("Colour means positive", "Farbe heißt positiv"), tx("Inverted! Colour appears only where antibodies have bound and caught the enzyme-linked second antibody, like in the positive control (+).", "Vertauscht! Farbe entsteht nur, wo Antikörper gebunden haben und den enzymgekoppelten Zweitantikörper festhalten, wie in der Positivkontrolle (+)."));
  m.add({ kind: "multi", options, correct: [0, 1, 2, 3] }, tx("Compare with the controls", "Vergleich mit den Kontrollen"), tx("Compare each well with the controls: clear like (−) means no antibodies.", "Vergleich jede Vertiefung mit den Kontrollen: Klar wie (−) heißt keine Antikörper."));
  return {
    instruction: tx("Evaluate the ELISA", "Werte den ELISA aus"),
    text: tx("An ELISA for antibodies against HIV: well + is the positive control, well − the negative control, wells 1 to 4 are patient samples. Which samples contain antibodies against HIV?", "Ein ELISA auf Antikörper gegen HIV: Vertiefung + ist die Positivkontrolle, Vertiefung − die Negativkontrolle, 1 bis 4 sind Patientenproben. Welche Proben enthalten Antikörper gegen HIV?"),
    visual: visual(ImmuneElisaPlate, { wells }),
    answer,
    hint: tx("Colour appears where antibodies bound the antigen and caught the enzyme-linked second antibody.", "Farbe entsteht, wo Antikörper am Antigen gebunden haben und den enzymgekoppelten Zweitantikörper festhalten."),
    solution: [
      { math: tx('"colour"#f \\to "antibodies present"#a', '"Farbe"#f \\to "Antikörper vorhanden"#a'), note: tx("Coloured like the positive control: antibodies against HIV were bound. Clear like the negative control: none.", "Gefärbt wie die Positivkontrolle: Es waren Antikörper gegen HIV gebunden. Klar wie die Negativkontrolle: keine.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: tx("These samples are positive. In practice a positive screening test is confirmed by a second test.", "Diese Proben sind positiv. In der Praxis wird ein positiver Suchtest mit einem zweiten Test bestätigt.") },
    ],
    mistakes: m.list,
  };
}

function autoimmuneTask(rng: Rng): Exercise {
  const pick = some(rng, AUTOIMMUNE, 4);
  const pairs = pick.map((p) => [p[0], p[1]] as [Text, Text]);
  return {
    instruction: tx("Autoimmune diseases", "Autoimmunerkrankungen"),
    text: tx("In an autoimmune disease the immune system attacks the body's own structures. Match each disease with its target.", "Bei einer Autoimmunerkrankung greift das Immunsystem körpereigene Strukturen an. Ordne jeder Krankheit ihr Ziel zu."),
    answer: { kind: "match", pairs },
    hint: tx("Diabetes: insulin. Sclerosis: nerves. Arthritis: joints. Thyroiditis: thyroid. Coeliac: gut.", "Diabetes: Insulin. Sklerose: Nerven. Arthritis: Gelenke. Thyreoiditis: Schilddrüse. Zöliakie: Darm."),
    solution: pairs.map(([a, b], i) => ({ math: join(q(a, `a${i}`), "\\to", q(b, `b${i}`)), note: tx(`${en(a)}: the immune system attacks the ${en(b)}.`, `${de(a)}. Angriffsziel: ${de(b)}.`) })),
    mistakes: [],
  };
}

function disorderTask(rng: Rng): Exercise {
  const d = rng.pick(DISORDERS);
  const keys: Disorder[] = ["allergy", "autoimmune", "deficiency"];
  const say: Record<Disorder, Text> = {
    allergy: tx("An allergy is an overreaction against a harmless foreign substance, not against own structures.", "Eine Allergie ist eine Überreaktion gegen einen harmlosen fremden Stoff, nicht gegen Eigenes."),
    autoimmune: tx("In an autoimmune disease the immune system attacks the body's own structures.", "Bei einer Autoimmunerkrankung greift das Immunsystem körpereigene Strukturen an."),
    deficiency: tx("Immunodeficiency means the defence is too weak, like in AIDS.", "Immunschwäche heißt: Die Abwehr ist zu schwach, wie bei AIDS."),
  };
  const opts: Opt[] = [{ text: DISORDER_NAMES[d.kind] }, ...keys.filter((k) => k !== d.kind).map((k) => ({ text: DISORDER_NAMES[k], title: tx("Another disorder", "Eine andere Störung"), say: tx(`${en(say[k])} Which kind fits this case?`, `${de(say[k])} Welche Art passt zu diesem Fall?`) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Disorders of the immune system", "Störungen des Immunsystems"),
    text: tx(`**${en(d.text)}**: what kind of disorder of the immune system is this?`, `**${de(d.text)}**: Was für eine Störung des Immunsystems ist das?`),
    answer,
    hint: tx("Too strong against harmless things, against oneself, or too weak?", "Zu stark gegen Harmloses, gegen sich selbst oder zu schwach?"),
    solution: solve(capT(d.text), say[d.kind], DISORDER_NAMES[d.kind], tx(`So: **${en(DISORDER_NAMES[d.kind]).toLowerCase()}**.`, `Also: **${de(DISORDER_NAMES[d.kind])}**.`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Terms

type Term = { clue: Text; accept: Text[]; wrong: { accept: Text[]; title: Text; say: Text }[] };
const TERMS: Term[] = [
  { clue: tx("Messenger substances by which immune cells communicate, e.g. the interleukins.", "Botenstoffe, über die sich Immunzellen verständigen, z. B. die Interleukine."), accept: [tx("cytokines", "Zytokine"), tx("cytokine", "Cytokine"), "Interleukine", "Zytokin"], wrong: [{ accept: [tx("antibodies", "Antikörper")], title: tx("Not antibodies", "Keine Antikörper"), say: tx("Antibodies bind antigens. The signals between cells are other proteins.", "Antikörper binden Antigene. Die Signale zwischen den Zellen sind andere Proteine.") }] },
  { clue: tx("The protein with which T killer cells punch pores into the membrane of their target cell.", "Das Protein, mit dem T-Killerzellen Poren in die Membran ihrer Zielzelle stanzen."), accept: [tx("perforin", "Perforin")], wrong: [{ accept: [tx("histamine", "Histamin")], title: tx("That's from mast cells", "Das stammt aus Mastzellen"), say: tx("Histamine comes from mast cells in allergies. T killer cells use another protein.", "Histamin kommt bei Allergien aus Mastzellen. T-Killerzellen benutzen ein anderes Protein.") }] },
  { clue: tx("The programmed cell death that T killer cells trigger in an infected cell.", "Der programmierte Zelltod, den T-Killerzellen in einer infizierten Zelle auslösen."), accept: [tx("apoptosis", "Apoptose")], wrong: [] },
  { clue: tx("The messenger substance released by mast cells in an allergy.", "Der Botenstoff, den Mastzellen bei einer Allergie ausschütten."), accept: [tx("histamine", "Histamin")], wrong: [{ accept: ["IgE", "Immunglobulin E"], title: tx("IgE triggers it", "IgE löst es aus"), say: tx("IgE sits on the mast cell and triggers it. The substance it releases is …", "IgE sitzt auf der Mastzelle und löst sie aus. Der Stoff, den sie dann ausschüttet, ist …") }] },
  { clue: tx("The enzyme with which HIV rewrites its RNA into DNA.", "Das Enzym, mit dem HIV seine RNA in DNA umschreibt."), accept: [tx("reverse transcriptase", "reverse Transkriptase"), "Reverse-Transkriptase"], wrong: [{ accept: [tx("integrase", "Integrase")], title: tx("Integrase comes next", "Die Integrase kommt danach"), say: tx("Integrase inserts the finished DNA into the host genome. Which enzyme makes the DNA from RNA?", "Die Integrase baut die fertige DNA ins Wirtsgenom ein. Welches Enzym macht aus RNA DNA?") }] },
  { clue: tx("Viral DNA that has been built into the genome of the host cell.", "Virus-DNA, die in das Genom der Wirtszelle eingebaut wurde."), accept: [tx("provirus", "Provirus")], wrong: [] },
  { clue: tx("The organ in which T cells mature (and learn to tolerate self).", "Das Organ, in dem T-Zellen reifen (und lernen, Eigenes zu tolerieren)."), accept: [tx("thymus", "Thymus")], wrong: [{ accept: [tx("bone marrow", "Knochenmark")], title: tx("That's B", "Das ist B"), say: tx("All lymphocytes come from the bone marrow, and B cells mature there. T cells mature in the …", "Alle Lymphozyten entstehen im Knochenmark, und B-Zellen reifen dort. T-Zellen reifen im …") }] },
  { clue: tx("Cells such as macrophages, dendritic cells and B cells that show antigen fragments on MHC II.", "Zellen wie Makrophagen, dendritische Zellen und B-Zellen, die Antigen-Bruchstücke auf MHC-II zeigen."), accept: [tx("antigen-presenting cells", "antigenpräsentierende Zellen"), tx("antigen-presenting cell", "antigenpräsentierende Zelle"), "APC", "APZ"], wrong: [] },
];

function termTask(rng: Rng, term: Term = rng.pick(TERMS)): Exercise {
  const answer: AnswerSpec = { kind: "word", accept: term.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const w of term.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: term.clue,
    answer,
    hint: tx(`It starts with “${en(term.accept[0]).charAt(0).toUpperCase()}”.`, `Er beginnt mit „${de(term.accept[0]).charAt(0).toUpperCase()}“.`),
    solution: [{ math: q(term.accept[0], "a"), note: tx(`The term is **${en(term.accept[0])}**.`, `Der Fachbegriff ist **${de(term.accept[0])}**.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  switch (rng.int(0, 19)) {
    case 0:
    case 1:
      return mhcTask(rng);
    case 2:
      return mhcMatchTask(rng);
    case 3:
      return humoralTask(rng);
    case 4:
      return antibodyFigureTask(rng);
    case 5:
      return rng.chance(0.5) ? igClassTask(rng) : bindingTask(rng);
    case 6:
      return clonalOrderTask();
    case 7:
      return clonalConceptTask(rng);
    case 8:
      return factorTask(rng);
    case 9:
      return igmGraphTask(rng);
    case 10:
      return twoAntigenTask(rng);
    case 11:
      return hivOrderTask(rng);
    case 12:
    case 13:
      return hivTask(rng);
    case 14:
      return rng.chance(0.5) ? allergyOrderTask(rng) : allergyTask(rng);
    case 15:
      return allergyTask(rng);
    case 16:
      return rng.chance(0.4) ? elisaOrderTask() : elisaPlateTask(rng);
    case 17:
      return rng.chance(0.5) ? autoimmuneTask(rng) : disorderTask(rng);
    default:
      return termTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

function AntibodyWidget() {
  return <ImmuneAntibodyStructure mode="explore" />;
}
function TiterWidget() {
  return <ImmuneTiter level={3} />;
}
function HivWidget() {
  return <ImmuneVirusCycle hiv />;
}

const checkMhc = mhcTask(createRng(31), PRESENTERS[0]);
const checkClonal = clonalConceptTask(createRng(8), 0);
const checkFactor = factorTask(createRng(2));
const checkHiv = hivTask(createRng(14), 1);

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Humoral and cellular immune response", "Humorale und zelluläre Immunantwort"),
      blob: tx("Abitur level: two defence pathways and one conductor.", "Abitur-Niveau: zwei Abwehrwege und ein Dirigent."),
      frames: [
        { math: tx('"humoral response"#h', '"humorale Antwort"#h'), note: tx("The **humoral** response (Latin humor: fluid) acts against pathogens and toxins in blood and lymph: B cells, plasma cells, antibodies.", "Die **humorale** Antwort (lat. humor: Flüssigkeit) richtet sich gegen Erreger und Gifte in Blut und Lymphe: B-Zellen, Plasmazellen, Antikörper.") },
        { math: tx('"humoral"#h \\quad "cellular"#z', '"humoral"#h \\quad "zellulär"#z'), note: tx("The **cellular** response acts against cells: T killer cells (cytotoxic T cells) kill virus-infected cells, tumour cells and foreign cells with perforin, driving them into apoptosis.", "Die **zelluläre** Antwort richtet sich gegen Zellen: T-Killerzellen (zytotoxische T-Zellen) töten virusinfizierte Zellen, Tumorzellen und fremde Zellen mit Perforin und treiben sie in die Apoptose.") },
        { math: tx('"T helper cell"#t \\to "humoral" + "cellular"', '"T-Helferzelle"#t \\to "humoral" + "zellulär"'), note: tx("Both pathways are activated by **T helper cells** through cytokines (interleukins). If they fail, as in AIDS, both collapse.", "Beide Wege werden von **T-Helferzellen** über Zytokine (Interleukine) aktiviert. Fallen sie aus, wie bei AIDS, brechen beide zusammen.") },
        { math: tx('"peptide"#p \\; "in" \\; "MHC"#m \\to "T cell receptor"#r', '"Peptid"#p \\; "im" \\; "MHC"#m \\to "T-Zell-Rezeptor"#r'), note: tx("B cell receptors bind free antigen. **T cells**, however, only recognise fragments (peptides) presented on **MHC molecules** (in humans also called HLA).", "B-Zell-Rezeptoren binden freies Antigen. **T-Zellen** erkennen dagegen nur Bruchstücke (Peptide), die auf **MHC-Molekülen** präsentiert werden (beim Menschen auch HLA).") },
      ],
    },
    {
      type: "widget",
      title: tx("Antigen presentation: MHC I and MHC II", "Antigenpräsentation: MHC-I und MHC-II"),
      blob: tx("Every cell shows what it has inside. The T cells check.", "Jede Zelle zeigt, was in ihr steckt. Die T-Zellen kontrollieren."),
      body: tx(
        "**MHC I**: all nucleated body cells show peptides of their own proteins; T killer cells (co-receptor **CD8**) check them. **MHC II**: antigen-presenting cells show what they took up; T helper cells (**CD4**) recognise it. The cells talk to each other with **cytokines** such as interleukin 1 and 2.",
        "**MHC-I**: Alle kernhaltigen Körperzellen zeigen Peptide ihrer eigenen Proteine; T-Killerzellen (Corezeptor **CD8**) kontrollieren sie. **MHC-II**: Antigenpräsentierende Zellen zeigen, was sie aufgenommen haben; T-Helferzellen (**CD4**) erkennen es. Die Zellen verständigen sich mit **Zytokinen** wie Interleukin-1 und -2.",
      ),
      widget: ImmuneMHC,
    },
    { type: "check", blob: tx("Which pathway is needed here?", "Welcher Weg ist hier gefragt?"), exercise: checkMhc },
    {
      type: "widget",
      title: tx("Clonal selection and expansion", "Klonale Selektion und Expansion"),
      blob: tx("The fitting lymphocyte already exists. The antigen just has to find it.", "Der passende Lymphozyt existiert schon. Das Antigen muss ihn nur finden."),
      body: tx(
        "Random recombination of gene segments produces millions of B and T cell clones, each with **one** receptor; clones that react against self are removed while they mature. An antigen **selects** the matching clone, which multiplies (**clonal expansion**) and differentiates into plasma cells (effector cells) and memory cells.",
        "Durch zufällige Neukombination von Gen-Abschnitten entstehen Millionen B- und T-Zell-Klone mit je **einem** Rezeptor; Klone, die gegen Eigenes reagieren, werden bei der Reifung beseitigt. Ein Antigen **wählt** den passenden Klon **aus**, der sich vermehrt (**klonale Expansion**) und zu Plasmazellen (Effektorzellen) und Gedächtniszellen differenziert.",
      ),
      widget: ImmuneClonal,
    },
    { type: "check", blob: tx("A favourite exam trap: selection or instruction?", "Eine beliebte Klausurfalle: Selektion oder Anleitung?"), exercise: checkClonal },
    {
      type: "widget",
      title: tx("The structure of an antibody", "Der Bau eines Antikörpers"),
      blob: tx("Four chains, two binding sites, one big family.", "Vier Ketten, zwei Bindungsstellen, eine große Familie."),
      body: tx(
        "Antibodies (**immunoglobulins**) consist of two heavy and two light chains held together by disulphide bridges. The **variable regions** form the antigen-binding sites; the **constant region** decides the class: **IgM** (pentamer, made first), **IgG** (most common, main antibody of the secondary response, crosses the placenta), **IgA** (secretions), **IgE** (allergies), **IgD**.",
        "Antikörper (**Immunglobuline**) bestehen aus zwei schweren und zwei leichten Ketten, die Disulfidbrücken zusammenhalten. Die **variablen Regionen** bilden die Antigenbindungsstellen; die **konstante Region** bestimmt die Klasse: **IgM** (Pentamer, zuerst gebildet), **IgG** (häufigster, Hauptantikörper der Sekundärantwort, plazentagängig), **IgA** (Sekrete), **IgE** (Allergien), **IgD**.",
      ),
      widget: AntibodyWidget,
    },
    {
      type: "widget",
      title: tx("Primary and secondary response", "Primär- und Sekundärantwort"),
      blob: tx("Careful with the axis: it's logarithmic!", "Vorsicht bei der Achse: Sie ist logarithmisch!"),
      body: tx(
        "The **antibody titre** shows how much antibody is in the serum. Play the curves, then switch the second contact to a new antigen.",
        "Der **Antikörpertiter** zeigt, wie viel Antikörper im Serum ist. Spiel die Kurven ab und stell dann den Zweitkontakt auf ein neues Antigen um.",
      ),
      widget: TiterWidget,
    },
    { type: "check", blob: tx("Read it like in the exam.", "Lies es ab wie in der Klausur."), exercise: checkFactor },
    {
      type: "explain",
      title: tx("When the immune system errs: allergy, autoimmunity, ELISA", "Wenn das Immunsystem irrt: Allergie, Autoimmunität, ELISA"),
      blob: tx("Too much, against oneself, or measured in a test tube.", "Zu viel, gegen sich selbst, oder im Reagenzglas gemessen."),
      frames: [
        { math: tx('"allergen"#a \\to "IgE"#e \\to "mast cell"#m', '"Allergen"#a \\to "IgE"#e \\to "Mastzelle"#m'), note: tx("**Allergy**: an overreaction to harmless substances (pollen, house dust mites, nuts). At the first contact plasma cells make IgE, which binds to mast cells (sensitisation), still without symptoms.", "**Allergie**: eine Überreaktion auf harmlose Stoffe (Pollen, Hausstaubmilben, Nüsse). Beim Erstkontakt bilden Plasmazellen IgE, das an Mastzellen bindet (Sensibilisierung), noch ohne Symptome.") },
        { math: tx('"2nd contact"#z \\to "histamine"#h', '"Zweitkontakt"#z \\to "Histamin"#h'), note: tx("At the second contact the allergen cross-links the IgE on the mast cells. They release **histamine**: vessels widen, mucous membranes swell, it itches. In extreme cases: anaphylactic shock.", "Beim Zweitkontakt vernetzt das Allergen die IgE auf den Mastzellen. Sie schütten **Histamin** aus: Gefäße weiten sich, Schleimhäute schwellen, es juckt. Im Extremfall: anaphylaktischer Schock.") },
        { math: tx('"autoimmune disease"#a', '"Autoimmunerkrankung"#a'), note: tx("In an **autoimmune disease** self-tolerance fails and the immune system attacks the body's own structures: type 1 diabetes, multiple sclerosis, rheumatoid arthritis.", "Bei einer **Autoimmunerkrankung** versagt die Selbsttoleranz, und das Immunsystem greift körpereigene Strukturen an: Typ-1-Diabetes, Multiple Sklerose, rheumatoide Arthritis.") },
        { math: tx('"antigen"#e1 \\to "serum"#e2 \\to "2nd antibody"#e3 \\to "colour"#e4', '"Antigen"#e1 \\to "Serum"#e2 \\to "Zweitantikörper"#e3 \\to "Farbe"#e4'), note: tx("The **ELISA** test uses the antigen-antibody reaction: an enzyme-linked second antibody makes a colour if the serum contained matching antibodies, e.g. in the HIV test.", "Der **ELISA**-Test nutzt die Antigen-Antikörper-Reaktion: Ein enzymgekoppelter Zweitantikörper erzeugt Farbe, wenn im Serum passende Antikörper waren, z. B. beim HIV-Test.") },
      ],
    },
    {
      type: "widget",
      title: tx("HIV and AIDS", "HIV und AIDS"),
      blob: tx("This virus attacks the conductor of the immune system.", "Dieses Virus greift den Dirigenten des Immunsystems an."),
      body: tx(
        "HIV is a **retrovirus**: RNA, reverse transcriptase, integrase. It infects **T helper cells (CD4)**. After an acute phase it stays hidden for years as a provirus while the number of T helper cells falls. Below about 200 per µl blood **AIDS** begins: opportunistic infections become deadly. Antiretroviral therapy keeps the virus down, but there is no cure and no vaccine.",
        "HIV ist ein **Retrovirus**: RNA, reverse Transkriptase, Integrase. Es befällt **T-Helferzellen (CD4)**. Nach einer akuten Phase versteckt es sich jahrelang als Provirus, während die Zahl der T-Helferzellen sinkt. Unter etwa 200 pro µl Blut beginnt **AIDS**: Opportunistische Infektionen werden lebensgefährlich. Eine antiretrovirale Therapie hält das Virus in Schach, Heilung und Impfstoff gibt es aber nicht.",
      ),
      widget: HivWidget,
    },
    { type: "check", blob: tx("The final question: why does everything collapse?", "Die Abschlussfrage: Warum bricht alles zusammen?"), exercise: checkHiv },
  ],
  summary: [
    {
      title: tx("Humoral and cellular", "Humoral und zellulär"),
      body: tx(
        "Humoral: B cells, plasma cells, antibodies against pathogens and toxins in body fluids. Cellular: T killer cells kill infected cells (perforin, apoptosis). T helper cells activate both via cytokines (interleukins).",
        "Humoral: B-Zellen, Plasmazellen, Antikörper gegen Erreger und Gifte in Körperflüssigkeiten. Zellulär: T-Killerzellen töten infizierte Zellen (Perforin, Apoptose). T-Helferzellen aktivieren beide über Zytokine (Interleukine).",
      ),
      tone: "rule",
    },
    {
      title: tx("MHC molecules", "MHC-Moleküle"),
      body: tx("T cells only recognise peptides on MHC. MHC I: all nucleated cells, read by T killer cells (CD8). MHC II: antigen-presenting cells, read by T helper cells (CD4).", "T-Zellen erkennen nur Peptide auf MHC. MHC-I: alle kernhaltigen Zellen, gelesen von T-Killerzellen (CD8). MHC-II: antigenpräsentierende Zellen, gelesen von T-Helferzellen (CD4)."),
      examples: [tx('"MHC I" \\to "CD8" \\to "T killer"', '"MHC-I" \\to "CD8" \\to "T-Killer"'), tx('"MHC II" \\to "CD4" \\to "T helper"', '"MHC-II" \\to "CD4" \\to "T-Helfer"')],
      tone: "rule",
    },
    {
      title: tx("Clonal selection", "Klonale Selektion"),
      body: tx("Receptor diversity arises at random before any contact. The antigen selects the matching clone: activation, expansion (mitosis), differentiation into plasma cells and memory cells.", "Die Rezeptorvielfalt entsteht zufällig vor jedem Kontakt. Das Antigen wählt den passenden Klon aus: Aktivierung, Expansion (Mitose), Differenzierung zu Plasma- und Gedächtniszellen."),
      examples: [tx('"selection" \\to "expansion" \\to "differentiation"', '"Selektion" \\to "Expansion" \\to "Differenzierung"')],
      tone: "rule",
    },
    {
      title: tx("Antibodies", "Antikörper"),
      body: tx("2 heavy + 2 light chains, disulphide bridges; variable regions = 2 identical binding sites; constant region = class. IgM first, IgG in the secondary response, IgA in secretions, IgE in allergies.", "2 schwere + 2 leichte Ketten, Disulfidbrücken; variable Regionen = 2 identische Bindungsstellen; konstante Region = Klasse. IgM zuerst, IgG in der Sekundärantwort, IgA in Sekreten, IgE bei Allergien."),
      tone: "tip",
    },
    {
      title: tx("Primary and secondary response", "Primär- und Sekundärantwort"),
      body: tx("Secondary: shorter lag phase, titre about 100 times higher (log scale!), mainly IgG, lasts longer. The memory is specific to one antigen.", "Sekundär: kürzere Latenzphase, Titer etwa 100-mal höher (logarithmische Achse!), vor allem IgG, hält länger an. Das Gedächtnis gilt nur für ein Antigen."),
      examples: ["10^2 \\to 10^4"],
      tone: "rule",
    },
    {
      title: tx("HIV, allergy, autoimmunity", "HIV, Allergie, Autoimmunität"),
      body: tx(
        "HIV infects T helper cells (CD4), not B cells: retrovirus, reverse transcriptase, provirus; AIDS = both pathways fail. Allergy: IgE on mast cells, histamine, symptoms only from the second contact. Autoimmune: attack on self.",
        "HIV befällt T-Helferzellen (CD4), nicht B-Zellen: Retrovirus, reverse Transkriptase, Provirus; AIDS = beide Abwehrwege fallen aus. Allergie: IgE auf Mastzellen, Histamin, Symptome erst ab dem Zweitkontakt. Autoimmun: Angriff auf Eigenes.",
      ),
      tone: "warning",
    },
  ],
};
