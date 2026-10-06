"use client";

// Level 1 (Einsteiger, Klasse 5–6): cells as building blocks; plant and animal cells under the
// light microscope; using the microscope and making a slide; single-celled organisms; from
// cell to organism.

import { tx } from "@/i18n/text";
import { createRng } from "@/learn/engine/rng";
import type { LevelLesson } from "@/learn/types";
import { CellCompare } from "@/learn/biology/visuals/CellCompare";
import { CellMicroscope } from "@/learn/biology/visuals/CellMicroscope";
import { CellMicroscopeLab } from "@/learn/biology/visuals/CellMicroscopeLab";
import { CellParamecium } from "@/learn/biology/visuals/CellParamecium";
import { generate1, l1 } from "./level1-tasks";

export { generate1 };

function MicroscopeExplorer() {
  return <CellMicroscope mode="explore" />;
}

function ParameciumExplorer() {
  return <CellParamecium mode="explore" />;
}

const checkSlide = l1.procedureTask(createRng(11), 0);
const checkWall = l1.nameStructureTask(createRng(5), { plant: true, id: "wall" });
const checkLevels = l1.levelsTask(createRng(3), { chain: 1, down: false });

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Everything alive is made of cells", "Alles Lebendige besteht aus Zellen"),
      blob: tx("Welcome to the smallest unit of life!", "Willkommen bei der kleinsten Einheit des Lebens!"),
      body: tx(
        "Plants, animals, fungi and you: all living things are made of **cells**. Most cells are so small that you can only see them with a **microscope**. In 1665 Robert Hooke looked at cork and saw tiny chambers. He called them cells (Latin cella: small room).",
        "Pflanzen, Tiere, Pilze und du: Alle Lebewesen bestehen aus **Zellen**. Die meisten sind so klein, dass du sie nur mit einem **Mikroskop** siehst. 1665 betrachtete Robert Hooke Kork und sah winzige Kämmerchen. Er nannte sie Zellen (lateinisch cella: kleiner Raum).",
      ),
      frames: [
        {
          math: tx('"characteristics of living things"#t', '"Kennzeichen des Lebendigen"#t'),
          note: tx("How can you tell whether something is alive? Living things show **all** of these characteristics.", "Woran erkennst du, ob etwas lebt? Lebewesen zeigen **alle** diese Kennzeichen."),
        },
        {
          math: tx('"movement"#a , "response to stimuli"#b , "metabolism"#c', '"Bewegung"#a , "Reizbarkeit"#b , "Stoffwechsel"#c'),
          note: tx("They **move** (plants turn towards the light), **respond to stimuli**, and have a **metabolism**: they take in substances and give off others.", "Sie **bewegen** sich (Pflanzen drehen sich zum Licht), reagieren auf **Reize** und haben einen **Stoffwechsel**: Sie nehmen Stoffe auf und geben Stoffe ab."),
        },
        {
          math: tx('"movement"#a , "response to stimuli"#b , "metabolism"#c \\\\ "growth"#d , "development"#e , "reproduction"#f', '"Bewegung"#a , "Reizbarkeit"#b , "Stoffwechsel"#c \\\\ "Wachstum"#d , "Entwicklung"#e , "Fortpflanzung"#f'),
          note: tx("They **grow**, **develop** and **reproduce**.", "Sie **wachsen**, **entwickeln** sich und **pflanzen sich fort**."),
        },
        {
          math: tx(
            '"movement"#a , "response to stimuli"#b , "metabolism"#c \\\\ "growth"#d , "development"#e , "reproduction"#f \\\\ \\blob{"made of cells"#g}',
            '"Bewegung"#a , "Reizbarkeit"#b , "Stoffwechsel"#c \\\\ "Wachstum"#d , "Entwicklung"#e , "Fortpflanzung"#f \\\\ \\blob{"Aufbau aus Zellen"#g}',
          ),
          note: tx(
            "And they are all **made of cells**. A candle flame grows and uses oxygen, but it isn't made of cells and can't reproduce: it isn't alive.",
            "Und sie alle bestehen aus **Zellen**. Eine Kerzenflamme wächst und verbraucht Sauerstoff, aber sie besteht nicht aus Zellen und pflanzt sich nicht fort: Sie lebt nicht.",
          ),
          highlight: ["g"],
        },
      ],
    },
    {
      type: "widget",
      title: tx("The light microscope", "Das Lichtmikroskop"),
      blob: tx("Tap the numbers! Every part has a job.", "Tipp auf die Nummern! Jedes Teil hat eine Aufgabe."),
      body: tx(
        "Light shines from below through the thin **specimen**. The **objective** magnifies it, and the **eyepiece** magnifies the image again. You focus with the **coarse** and the **fine focus knob**.",
        "Licht scheint von unten durch das dünne **Präparat**. Das **Objektiv** vergrößert es, das **Okular** vergrößert das Bild noch einmal. Scharf stellst du mit **Grobtrieb** und **Feintrieb**.",
      ),
      widget: MicroscopeExplorer,
    },
    {
      type: "explain",
      title: tx("Making a slide", "Ein Präparat herstellen"),
      blob: tx("Onion, water, a bit of glass: let's build a slide!", "Zwiebel, Wasser, ein bisschen Glas: Wir bauen ein Präparat!"),
      body: tx("A specimen must be very thin, so that light can shine through it. Onion skin is perfect: it is only one layer of cells thick.", "Ein Präparat muss sehr dünn sein, damit Licht hindurchscheinen kann. Zwiebelhaut ist perfekt: Sie ist nur eine Zellschicht dick."),
      frames: [
        { math: tx('"1. water drop"#s1', '"1. Wassertropfen"#s1'), note: tx("Put a drop of water on a clean **slide**.", "Gib einen Tropfen Wasser auf einen sauberen **Objektträger**.") },
        {
          math: tx('"1. water drop"#s1 \\\\ "2. onion skin"#s2', '"1. Wassertropfen"#s1 \\\\ "2. Zwiebelhaut"#s2'),
          note: tx("Peel the thin skin off the inside of an onion layer with tweezers and lay it flat in the drop.", "Zieh mit der Pinzette das dünne Häutchen von der Innenseite einer Zwiebelschuppe ab und leg es glatt in den Tropfen."),
        },
        {
          math: tx('"1. water drop"#s1 \\\\ "2. onion skin"#s2 \\\\ "3. cover slip"#s3', '"1. Wassertropfen"#s1 \\\\ "2. Zwiebelhaut"#s2 \\\\ "3. Deckgläschen"#s3'),
          note: tx("Put the **cover slip** on at an angle and lower it slowly: that way no air bubbles get trapped.", "Setz das **Deckgläschen** schräg an und senke es langsam ab: So entstehen keine Luftblasen."),
        },
        {
          math: tx('"1. water drop"#s1 \\\\ "2. onion skin"#s2 \\\\ "3. cover slip"#s3 \\\\ "4. stain"#s4', '"1. Wassertropfen"#s1 \\\\ "2. Zwiebelhaut"#s2 \\\\ "3. Deckgläschen"#s3 \\\\ "4. Anfärben"#s4'),
          note: tx("With iodine solution or methylene blue the nuclei show up better. Then start with the **smallest objective**.", "Mit Iod-Kaliumiodid-Lösung oder Methylenblau werden die Zellkerne besser sichtbar. Dann beginnst du mit dem **kleinsten Objektiv**."),
          highlight: ["s4"],
        },
      ],
    },
    {
      type: "widget",
      title: tx("Focus!", "Scharf stellen!"),
      blob: tx("Your turn! Bring the cells into focus.", "Jetzt du! Bring die Zellen scharf ins Bild."),
      body: tx(
        "Start with the 4× objective and the **coarse focus**. Once the image is sharp, swing in a bigger objective and only use the **fine focus**. The **diaphragm** sets brightness and contrast. Try all four specimens!",
        "Beginne mit dem 4er-Objektiv und dem **Grobtrieb**. Ist das Bild scharf, schwenkst du ein größeres Objektiv ein und stellst nur noch mit dem **Feintrieb** nach. Die **Blende** regelt Helligkeit und Kontrast. Probier alle vier Präparate aus!",
      ),
      widget: CellMicroscopeLab,
    },
    { type: "check", blob: tx("You know how it's done. Put the steps in order!", "Du weißt jetzt, wie es geht. Bring die Schritte in Ordnung!"), exercise: checkSlide },
    {
      type: "explain",
      title: tx("Plant cell and animal cell", "Pflanzenzelle und Tierzelle"),
      blob: tx("Plants and animals look so different. Are their cells different too?", "Pflanzen und Tiere sehen so verschieden aus. Sind es ihre Zellen auch?"),
      frames: [
        {
          math: tx('"animal cell"#t = "membrane"#m + "cytoplasm"#p + "nucleus"#k', '"Tierzelle"#t = "Zellmembran"#m + "Zellplasma"#p + "Zellkern"#k'),
          note: tx("Every animal cell has a thin **cell membrane** as its boundary, **cytoplasm** as its filling and a **nucleus** as its control centre.", "Jede Tierzelle hat eine dünne **Zellmembran** als Grenze, **Zellplasma** als Füllung und einen **Zellkern** als Steuerzentrale."),
        },
        {
          math: tx('"plant cell"#pz = "animal cell"#t \\\\ + "cell wall"#w + "vacuole"#v + "chloroplasts"#c', '"Pflanzenzelle"#pz = "Tierzelle"#t \\\\ + "Zellwand"#w + "Vakuole"#v + "Chloroplasten"#c'),
          note: tx(
            "A plant cell has all of that **and** a firm **cell wall** of cellulose, a big **vacuole** with cell sap and, in green parts, **chloroplasts** for photosynthesis.",
            "Eine Pflanzenzelle hat all das **und dazu** eine feste **Zellwand** aus Cellulose, eine große **Vakuole** mit Zellsaft und in grünen Teilen **Chloroplasten** für die Fotosynthese.",
          ),
          highlight: ["w", "v", "c"],
        },
        {
          math: tx('"onion skin:"#z \\; \\strike{"chloroplasts"#c}', '"Zwiebelhaut:"#z \\; \\strike{"Chloroplasten"#c}'),
          note: tx("Careful: only green parts of plants have chloroplasts. An onion grows in the dark, so its cells have none.", "Vorsicht: Nur grüne Pflanzenteile haben Chloroplasten. Die Zwiebel wächst im Dunkeln, ihre Zellen haben keine."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Spot the difference", "Finde die Unterschiede"),
      blob: tx("Switch between the two cells and compare!", "Schalte zwischen den Zellen um und vergleiche!"),
      body: tx("Tap a row of the table: the part lights up in the drawing.", "Tipp auf eine Zeile der Tabelle: Der Bestandteil leuchtet in der Zeichnung auf."),
      widget: CellCompare,
    },
    { type: "check", blob: tx("A classic test question. Thick or thin?", "Eine klassische Testfrage. Dick oder dünn?"), exercise: checkWall },
    {
      type: "widget",
      title: tx("Single-celled organisms: everything in one cell", "Einzeller: alles in einer Zelle"),
      blob: tx("A whole animal in a single cell. Pretty impressive, right?", "Ein ganzes Tier in einer einzigen Zelle. Ziemlich beeindruckend, oder?"),
      body: tx(
        "Many living things consist of just **one cell**: **single-celled organisms** like the slipper animalcule from a pond. This one cell has to do everything: move, eat, digest, get rid of waste and reproduce. Tap the numbers!",
        "Viele Lebewesen bestehen aus nur **einer Zelle**: **Einzeller** wie das Pantoffeltierchen aus dem Teich. Diese eine Zelle muss alles können: sich bewegen, fressen, verdauen, ausscheiden und sich fortpflanzen. Tipp auf die Nummern!",
      ),
      widget: ParameciumExplorer,
    },
    {
      type: "explain",
      title: tx("From cell to organism", "Von der Zelle zum Organismus"),
      blob: tx("In your body, cells work as a team!", "In deinem Körper arbeiten Zellen im Team!"),
      body: tx("In **multicellular organisms** like you, cells share the work. Similar cells form a **tissue**, several tissues an **organ**, and so on.", "In **Vielzellern** wie dir teilen sich die Zellen die Arbeit. Gleichartige Zellen bilden ein **Gewebe**, mehrere Gewebe ein **Organ** und so weiter."),
      frames: [
        { math: tx('"cell"#a', '"Zelle"#a'), note: tx("A heart muscle cell can contract.", "Eine Herzmuskelzelle kann sich zusammenziehen.") },
        { math: tx('"cell"#a \\to "tissue"#b', '"Zelle"#a \\to "Gewebe"#b'), note: tx("Many similar heart muscle cells form **heart muscle tissue**.", "Viele gleichartige Herzmuskelzellen bilden das **Herzmuskelgewebe**."), highlight: ["b"] },
        { math: tx('"cell"#a \\to "tissue"#b \\to "organ"#c', '"Zelle"#a \\to "Gewebe"#b \\to "Organ"#c'), note: tx("Muscle tissue, connective tissue and nerve tissue together form an **organ**: the heart.", "Muskelgewebe, Bindegewebe und Nervengewebe bilden zusammen ein **Organ**: das Herz."), highlight: ["c"] },
        {
          math: tx('"cell"#a \\to "tissue"#b \\to "organ"#c \\\\ \\to "organ system"#d', '"Zelle"#a \\to "Gewebe"#b \\to "Organ"#c \\\\ \\to "Organsystem"#d'),
          note: tx("Heart and blood vessels work together as an **organ system**: the circulatory system.", "Herz und Blutgefäße arbeiten als **Organsystem** zusammen: das Herz-Kreislauf-System."),
          highlight: ["d"],
        },
        {
          math: tx('"cell"#a \\to "tissue"#b \\to "organ"#c \\\\ \\to "organ system"#d \\to "organism"#e', '"Zelle"#a \\to "Gewebe"#b \\to "Organ"#c \\\\ \\to "Organsystem"#d \\to "Organismus"#e'),
          note: tx("All organ systems together make the **organism**: you!", "Alle Organsysteme zusammen ergeben den **Organismus**: dich!"),
          highlight: ["e"],
        },
      ],
    },
    { type: "check", blob: tx("Last one: from tiny to whole!", "Zum Schluss: vom Winzigen zum Ganzen!"), exercise: checkLevels },
  ],
  summary: [
    {
      title: tx("Living things are made of cells", "Lebewesen bestehen aus Zellen"),
      body: tx(
        "Characteristics of living things: movement, response to stimuli, metabolism, growth, development, reproduction and being made of cells. The cell is the smallest unit of life.",
        "Kennzeichen des Lebendigen: Bewegung, Reizbarkeit, Stoffwechsel, Wachstum, Entwicklung, Fortpflanzung und Aufbau aus Zellen. Die Zelle ist die kleinste Einheit des Lebens.",
      ),
      tone: "rule",
    },
    {
      title: tx("Plant cell and animal cell", "Pflanzenzelle und Tierzelle"),
      body: tx(
        "Both: cell membrane, cytoplasm, nucleus. Only plant cells: cell wall, a large vacuole and chloroplasts (in green parts).",
        "Beide: Zellmembran, Zellplasma, Zellkern. Nur Pflanzenzellen: Zellwand, große Vakuole und Chloroplasten (in grünen Teilen).",
      ),
      examples: [tx('"plant cell" = "animal cell" \\\\ + "wall" + "vacuole" + "chloroplasts"', '"Pflanzenzelle" = "Tierzelle" \\\\ + "Zellwand" + "Vakuole" + "Chloroplasten"')],
      tone: "rule",
    },
    {
      title: tx("The light microscope", "Das Lichtmikroskop"),
      body: tx(
        "Eyepiece (where your eye goes), objective (near the object), stage, diaphragm (brightness), light source, coarse and fine focus. Always start with the smallest objective; with the big one only use the fine focus.",
        "Okular (am Auge), Objektiv (nah am Objekt), Objekttisch, Blende (Helligkeit), Lichtquelle, Grob- und Feintrieb. Immer mit dem kleinsten Objektiv beginnen; beim großen nur noch den Feintrieb benutzen.",
      ),
      tone: "tip",
    },
    {
      title: tx("Making a slide", "Präparat herstellen"),
      examples: [tx('"water drop" \\to "specimen" \\to "cover slip" \\to "stain"', '"Wassertropfen" \\to "Präparat" \\to "Deckgläschen" \\to "Anfärben"')],
      body: tx("Thin, so light gets through. Cover slip at an angle, so there are no air bubbles.", "Dünn, damit Licht hindurchkommt. Deckgläschen schräg auflegen, damit keine Luftblasen entstehen."),
      tone: "tip",
    },
    {
      title: tx("From cell to organism", "Von der Zelle zum Organismus"),
      body: tx("Single-celled organisms (slipper animalcule, yeast, bacteria) do everything in one cell. In multicellular organisms the cells share the work.", "Einzeller (Pantoffeltierchen, Hefe, Bakterien) erledigen alles in einer Zelle. In Vielzellern teilen sich die Zellen die Arbeit."),
      examples: [tx('"cell" \\to "tissue" \\to "organ" \\\\ \\to "organ system" \\to "organism"', '"Zelle" \\to "Gewebe" \\to "Organ" \\\\ \\to "Organsystem" \\to "Organismus"')],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Animal cells have no cell wall, only a membrane. Not every plant cell has chloroplasts: onion skin and root cells have none. The wall gives shape; the membrane decides what gets in.",
        "Tierzellen haben keine Zellwand, nur eine Membran. Nicht jede Pflanzenzelle hat Chloroplasten: Zwiebelhaut und Wurzelzellen haben keine. Die Wand gibt Form, die Membran entscheidet, was hineinkommt.",
      ),
      tone: "warning",
    },
  ],
};
