"use client";

// Level 2 (Fortgeschritten, Klasse 7–9): organelles and their jobs, the bacterial cell
// (prokaryote) versus our cells (eukaryotes), working out magnification and actual size,
// light versus electron microscope.

import { useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import type { LevelLesson } from "@/learn/types";
import { cn } from "@/lib/utils";
import { CellAnimalCell } from "@/learn/biology/visuals/CellAnimalCell";
import { CellBacterium } from "@/learn/biology/visuals/CellBacterium";
import { CellMagnifier } from "@/learn/biology/visuals/CellMagnifier";
import { CellPlantCell } from "@/learn/biology/visuals/CellPlantCell";
import { CellSizeScale } from "@/learn/biology/visuals/CellSizeScale";
import { generate2, l2 } from "./level2-tasks";

export { generate2 };

/** The organelles in the electron microscope: animal or plant cell, tap to explore. */
function OrganelleExplorer() {
  const t = useText();
  const [cell, setCell] = useState<"animal" | "plant">("animal");
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-line bg-surface p-1">
        {(["animal", "plant"] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cell === c} onClick={() => setCell(c)} className={cn("h-9 rounded-lg px-3.5 text-[14px] font-semibold transition-colors", cell === c ? "bg-blob text-white" : "text-ink-2 hover:text-ink")}>
            {c === "animal" ? t(tx("Animal cell", "Tierzelle")) : t(tx("Plant cell", "Pflanzenzelle"))}
          </button>
        ))}
      </div>
      {cell === "animal" ? <CellAnimalCell key="a" mode="explore" detail="em" /> : <CellPlantCell key="p" mode="explore" detail="em" />}
    </div>
  );
}

function BacteriumExplorer() {
  return <CellBacterium mode="explore" />;
}

const checkMatch = l2.organelleMatchTask(createRng(21));
const checkBacteria = l2.bacteriaMultiTask(createRng(7));
const checkSize = l2.actualSizeTask(createRng(4));

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("A look through the electron microscope", "Ein Blick durchs Elektronenmikroskop"),
      blob: tx("Time to zoom in much further than any light microscope can!", "Zeit, viel weiter hineinzuzoomen, als es ein Lichtmikroskop kann!"),
      frames: [
        {
          math: tx('"light microscope:"#a \\\\ "nucleus, wall, vacuole, chloroplasts"#b', '"Lichtmikroskop:"#a \\\\ "Zellkern, Zellwand, Vakuole, Chloroplasten"#b'),
          note: tx("In the light microscope you only see the bigger parts of a cell.", "Im Lichtmikroskop siehst du nur die größeren Bestandteile einer Zelle."),
        },
        {
          math: tx('"electron microscope:"#c \\\\ "+ mitochondria, ER, Golgi, ribosomes …"#d', '"Elektronenmikroskop:"#c \\\\ "+ Mitochondrien, ER, Golgi, Ribosomen …"#d'),
          note: tx("The electron microscope magnifies far more and reveals many small structures: the **organelles**.", "Das Elektronenmikroskop vergrößert viel stärker und zeigt viele kleine Strukturen: die **Organellen**."),
          highlight: ["d"],
        },
        {
          math: tx('"organelle"#e = "organ of the cell"#f', '"Organell"#e = "Organ der Zelle"#f'),
          note: tx("Organelles are parts of the cell with their own job, like the departments of a factory. Most are wrapped in a membrane, so different jobs can run side by side.", "Organellen sind Zellbestandteile mit einer eigenen Aufgabe, wie die Abteilungen einer Fabrik. Die meisten sind von einer Membran umhüllt, so laufen verschiedene Aufgaben nebeneinander ab."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Explore the organelles", "Erkunde die Organellen"),
      blob: tx("Tap the numbers and find out what each organelle does.", "Tipp auf die Nummern und finde heraus, was jedes Organell macht."),
      body: tx(
        "Mitochondria release energy (**cellular respiration**), ribosomes build proteins, the **ER** and the **Golgi apparatus** produce, pack and ship them, **lysosomes** digest. The nucleus is wrapped in a double membrane, the **nuclear envelope**, with **pores**. Switch to the plant cell: it has mitochondria too!",
        "Mitochondrien setzen Energie frei (**Zellatmung**), Ribosomen bauen Proteine, **ER** und **Golgi-Apparat** stellen sie her, verpacken und verschicken sie, **Lysosomen** verdauen. Der Zellkern ist von einer Doppelmembran umgeben, der **Kernhülle** mit **Kernporen**. Schalte auf die Pflanzenzelle: Auch sie hat Mitochondrien!",
      ),
      widget: OrganelleExplorer,
    },
    {
      type: "explain",
      title: tx("How a cell makes and exports a protein", "Wie eine Zelle ein Protein herstellt und abgibt"),
      blob: tx("Let's follow a digestive enzyme from plan to exit!", "Verfolgen wir ein Verdauungsenzym vom Bauplan bis zum Ausgang!"),
      frames: [
        { math: tx('"nucleus"#a', '"Zellkern"#a'), note: tx("In the **nucleus** the DNA holds the plan. A copy (mRNA) leaves the nucleus through the **nuclear pores**.", "Im **Zellkern** enthält die DNA den Bauplan. Eine Abschrift (mRNA) verlässt den Kern durch die **Kernporen**.") },
        { math: tx('"nucleus"#a \\to "rough ER"#b', '"Zellkern"#a \\to "raues ER"#b'), note: tx("The **ribosomes** on the rough ER join amino acids into the protein, which goes into the ER.", "Die **Ribosomen** am rauen ER verknüpfen Aminosäuren zum Protein, das ins ER gelangt."), highlight: ["b"] },
        { math: tx('"nucleus"#a \\to "rough ER"#b \\to "Golgi"#c', '"Zellkern"#a \\to "raues ER"#b \\to "Golgi"#c'), note: tx("Vesicles take it to the **Golgi apparatus**. There it is modified, sorted and packed again.", "Vesikel bringen es zum **Golgi-Apparat**. Dort wird es verändert, sortiert und neu verpackt."), highlight: ["c"] },
        {
          math: tx('"nucleus"#a \\to "rough ER"#b \\to "Golgi"#c \\\\ \\to "vesicle"#d \\to "membrane"#e', '"Zellkern"#a \\to "raues ER"#b \\to "Golgi"#c \\\\ \\to "Vesikel"#d \\to "Membran"#e'),
          note: tx("A **vesicle** carries it to the cell membrane, fuses with it and releases the enzyme to the outside.", "Ein **Vesikel** bringt es zur Zellmembran, verschmilzt mit ihr und gibt das Enzym nach außen ab."),
          highlight: ["d", "e"],
        },
        { math: tx('"mitochondria:"#f \\; "ATP"#g', '"Mitochondrien:"#f \\; "ATP"#g'), note: tx("And the energy for all this? The **mitochondria** supply it as ATP, from cellular respiration.", "Und die Energie für all das? Die liefern die **Mitochondrien** als ATP, aus der Zellatmung.") },
      ],
    },
    { type: "check", blob: tx("Which department does what?", "Welche Abteilung macht was?"), exercise: checkMatch },
    {
      type: "widget",
      title: tx("The bacterial cell", "Die Bakterienzelle"),
      blob: tx("Bacteria are the tiny ones, and they do things very differently.", "Bakterien sind die Winzlinge, und sie machen vieles ganz anders."),
      body: tx(
        "A bacterium has no nucleus. Its DNA is a single ring, the **bacterial chromosome**, lying free in the cytoplasm (**nucleoid**). Many bacteria also carry small extra rings, **plasmids**. Tap the numbers!",
        "Ein Bakterium hat keinen Zellkern. Seine DNA ist ein einzelner Ring, das **Bakterienchromosom**, das frei im Zellplasma liegt (**Nucleoid**). Viele Bakterien haben zusätzlich kleine Ringe, die **Plasmide**. Tipp auf die Nummern!",
      ),
      widget: BacteriumExplorer,
    },
    {
      type: "explain",
      title: tx("Prokaryotes and eukaryotes", "Prokaryoten und Eukaryoten"),
      blob: tx("Two big groups of cells. The names give it away!", "Zwei große Gruppen von Zellen. Die Namen verraten es!"),
      frames: [
        { math: tx('"pro-karyote"#a = "before the nucleus"#b', '"Pro-karyot"#a = "vor dem Kern"#b'), note: tx("Bacteria are **prokaryotes** (Greek: before the nucleus). Their DNA lies free in the cytoplasm.", "Bakterien sind **Prokaryoten** (griechisch: vor dem Kern). Ihre DNA liegt frei im Zellplasma.") },
        { math: tx('"eu-karyote"#c = "true nucleus"#d', '"Eu-karyot"#c = "echter Kern"#d'), note: tx("Plants, animals and fungi are **eukaryotes**: their DNA lies in a nucleus with an envelope, and they have organelles with membranes.", "Pflanzen, Tiere und Pilze sind **Eukaryoten**: Ihre DNA liegt in einem Zellkern mit Hülle, und sie haben Organellen mit Membran.") },
        { math: tx('"ribosomes:"#e \\; "70S"#f \\ne "80S"#g', '"Ribosomen:"#e \\; "70S"#f \\ne "80S"#g'), note: tx("Both have ribosomes, but those of bacteria are smaller (70S instead of 80S). Some antibiotics block only the 70S ones.", "Beide haben Ribosomen, aber die der Bakterien sind kleiner (70S statt 80S). Manche Antibiotika blockieren nur die 70S-Ribosomen.") },
        { math: tx('"bacterium:"#h \\; "1–5 µm" \\quad "our cells:"#i \\; "10–100 µm"', '"Bakterium:"#h \\; "1–5 µm" \\quad "unsere Zellen:"#i \\; "10–100 µm"'), note: tx("Bacteria are usually only 1 to 5 µm long, eukaryotic cells 10 to 100 µm. Bacteria have no mitochondria, no ER and no Golgi apparatus.", "Bakterien sind meist nur 1 bis 5 µm lang, Eukaryotenzellen 10 bis 100 µm. Bakterien haben keine Mitochondrien, kein ER und keinen Golgi-Apparat.") },
      ],
    },
    { type: "check", blob: tx("Careful: no nucleus doesn't mean no DNA!", "Vorsicht: Kein Kern heißt nicht keine DNA!"), exercise: checkBacteria },
    {
      type: "explain",
      title: tx("Working out magnification", "Vergrößerung berechnen"),
      blob: tx("A bit of maths for biologists. Promise, it's easy!", "Ein bisschen Mathe für Biologen. Versprochen, es ist leicht!"),
      frames: [
        { math: tx('"total"#g = "eyepiece"#o \\times "objective"#b', '"Gesamt"#g = "Okular"#o \\times "Objektiv"#b'), note: tx("The objective magnifies, and the eyepiece magnifies that image again. That's why you **multiply**, not add.", "Das Objektiv vergrößert, und das Okular vergrößert dieses Bild noch einmal. Deshalb wird **multipliziert**, nicht addiert.") },
        { math: tx('"total"#g = 10#o \\times 40#b = 400#r', '"Gesamt"#g = 10#o \\times 40#b = 400#r'), note: tx("10× eyepiece and 40× objective: **400×** magnification.", "Okular 10-fach, Objektiv 40-fach: **400-fache** Vergrößerung."), highlight: ["r"] },
        { math: '1 "mm" = 1000 "µm" \\quad 1 "µm" = 1000 "nm"', note: tx("Cells are measured in **micrometres** (µm). 1 µm is a thousandth of a millimetre.", "Zellen misst man in **Mikrometern** (µm). 1 µm ist ein Tausendstel Millimeter.") },
        { math: tx('"actual size"#t = \\frac{"image size"#i}{"magnification"#v}', '"tatsächliche Größe"#t = \\frac{"Bildgröße"#i}{"Vergrößerung"#v}'), note: tx("To find out how big a cell really is, divide its image size by the magnification.", "Wie groß eine Zelle wirklich ist, berechnest du so: Bildgröße geteilt durch Vergrößerung.") },
        { math: tx('\\frac{20 "mm"}{400} = 0.05 "mm" = 50#r "µm"', '\\frac{20 "mm"}{400} = 0,05 "mm" = 50#r "µm"'), note: tx("A cell that is 20 mm long on a photo at 400× is really 0.05 mm = **50 µm** long.", "Eine Zelle, die auf einem Foto mit 400-facher Vergrößerung 20 mm lang ist, ist in Wirklichkeit 0,05 mm = **50 µm** lang."), highlight: ["r"] },
      ],
    },
    {
      type: "widget",
      title: tx("The magnification lab", "Das Vergrößerungslabor"),
      blob: tx("Pick lenses and watch how big the object looks!", "Wähl die Linsen und schau, wie groß das Objekt erscheint!"),
      body: tx("Choose an eyepiece and an objective. The ruler shows how big the object looks at that magnification. Can you make a bacterium as big as a cheek cell at 40×?", "Wähle Okular und Objektiv. Das Lineal zeigt, wie groß das Objekt bei dieser Vergrößerung erscheint. Schaffst du es, ein Bakterium so groß erscheinen zu lassen wie eine Mundschleimhautzelle bei 40-fach?"),
      widget: CellMagnifier,
    },
    {
      type: "widget",
      title: tx("Resolution: why the light microscope has a limit", "Auflösung: Warum das Lichtmikroskop eine Grenze hat"),
      blob: tx("Bigger isn't always sharper. Let's see why.", "Größer heißt nicht immer schärfer. Schauen wir, warum."),
      body: tx(
        "**Resolution** is the smallest distance at which two points can still be seen as separate. The light microscope manages about **0.2 µm**, because light waves are too long for finer details. The electron microscope reaches about **0.1 nm**, but only with dead specimens in a vacuum. Pick an instrument!",
        "Das **Auflösungsvermögen** ist der kleinste Abstand, bei dem zwei Punkte noch getrennt erkennbar sind. Das Lichtmikroskop schafft etwa **0,2 µm**, weil Lichtwellen für feinere Details zu lang sind. Das Elektronenmikroskop erreicht etwa **0,1 nm**, aber nur mit toten Präparaten im Vakuum. Wähl ein Instrument!",
      ),
      widget: CellSizeScale,
    },
    { type: "check", blob: tx("Now you! Divide, then convert.", "Jetzt du! Erst teilen, dann umrechnen."), exercise: checkSize },
  ],
  summary: [
    {
      title: tx("Organelles and their jobs", "Organellen und ihre Aufgaben"),
      body: tx(
        "Nucleus (DNA, control; nuclear envelope with pores), mitochondria (cellular respiration, ATP), chloroplasts (photosynthesis), ribosomes (protein synthesis), rough ER (making and transporting proteins), smooth ER (lipids), Golgi apparatus (modifying, packing, shipping), lysosomes (digestion inside the cell).",
        "Zellkern (DNA, Steuerung; Kernhülle mit Kernporen), Mitochondrien (Zellatmung, ATP), Chloroplasten (Fotosynthese), Ribosomen (Proteinbiosynthese), raues ER (Proteine herstellen und transportieren), glattes ER (Lipide), Golgi-Apparat (verändern, verpacken, versenden), Lysosomen (Verdauung in der Zelle).",
      ),
      tone: "rule",
    },
    {
      title: tx("The way of a protein", "Der Weg eines Proteins"),
      examples: [tx('"nucleus" \\to "rough ER" \\to "Golgi" \\\\ \\to "vesicle" \\to "membrane"', '"Zellkern" \\to "raues ER" \\to "Golgi" \\\\ \\to "Vesikel" \\to "Membran"')],
      tone: "tip",
    },
    {
      title: tx("Prokaryotes and eukaryotes", "Prokaryoten und Eukaryoten"),
      body: tx(
        "Bacteria (prokaryotes): no nucleus, ring-shaped bacterial chromosome free in the cytoplasm (nucleoid), plasmids, 70S ribosomes, cell wall of murein, often a capsule and a flagellum; 1–5 µm. Eukaryotes: nucleus, organelles with membranes, 80S ribosomes; 10–100 µm.",
        "Bakterien (Prokaryoten): kein Zellkern, ringförmiges Bakterienchromosom frei im Zellplasma (Nucleoid), Plasmide, 70S-Ribosomen, Zellwand aus Murein, oft Kapsel und Geißel; 1–5 µm. Eukaryoten: Zellkern, Organellen mit Membran, 80S-Ribosomen; 10–100 µm.",
      ),
      tone: "rule",
    },
    {
      title: tx("Magnification", "Vergrößerung"),
      examples: [tx('"total" = "eyepiece" \\times "objective"', '"Gesamt" = "Okular" \\times "Objektiv"'), tx('"actual size" = \\frac{"image size"}{"magnification"}', '"tatsächliche Größe" = \\frac{"Bildgröße"}{"Vergrößerung"}'), '1 "mm" = 1000 "µm" = 1000000 "nm"'],
      tone: "rule",
    },
    {
      title: tx("Light and electron microscope", "Licht- und Elektronenmikroskop"),
      body: tx(
        "Light microscope: resolution about 0.2 µm, up to about 1000× useful magnification, living cells in colour. Electron microscope: resolution about 0.1 nm, dead specimens in a vacuum, black and white.",
        "Lichtmikroskop: Auflösung etwa 0,2 µm, bis etwa 1000-fach sinnvoll, lebende Zellen in Farbe. Elektronenmikroskop: Auflösung etwa 0,1 nm, tote Präparate im Vakuum, schwarz-weiß.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Magnifications are multiplied, not added. Plant cells have mitochondria too. Bacteria have DNA and ribosomes, just no nucleus. Viruses are much smaller than bacteria. Convert units before you divide.",
        "Vergrößerungen werden multipliziert, nicht addiert. Auch Pflanzenzellen haben Mitochondrien. Bakterien haben DNA und Ribosomen, nur keinen Zellkern. Viren sind viel kleiner als Bakterien. Erst Einheiten umrechnen, dann teilen.",
      ),
      tone: "warning",
    },
  ],
};
