import { tx } from "@/i18n/text";
import type { ModelContent, PartInfo, PartsContent } from "../../types";

/** The eukaryotic cell: an animal cell with all its organelles, and what a plant cell adds. */

const membrane: PartInfo = {
  name: tx("Cell membrane", "Zellmembran"),
  aka: tx("plasma membrane", "Plasmamembran"),
  role: tx("A phospholipid bilayer with proteins and sterols (cholesterol in animal cells): it bounds the cell and controls what goes in and out.", "Eine Phospholipid-Doppelschicht mit Proteinen und Sterolen (bei Tierzellen Cholesterin): Sie grenzt die Zelle ab und kontrolliert, was hinein- und hinausgeht."),
  facts: [
    tx("Fluid mosaic model (Singer and Nicolson, 1972).", "Flüssig-Mosaik-Modell (Singer und Nicolson, 1972)."),
    tx("Sugar chains on the outside (glycocalyx) let cells recognise each other, as with blood groups.", "Zuckerketten auf der Außenseite (Glykokalyx) dienen der Zellerkennung, etwa bei den Blutgruppen."),
    tx("Cholesterol keeps it from getting too stiff or too fluid. Plant cells use phytosterols such as sitosterol instead.", "Cholesterin verhindert, dass sie zu starr oder zu flüssig wird. Pflanzenzellen nutzen stattdessen Phytosterole wie Sitosterol."),
  ],
  clue: tx("bounds the cell and controls what gets in and out", "die Zelle abgrenzt und den Stoffaustausch kontrolliert"),
};

const cytoplasm: PartInfo = {
  name: tx("Cytoplasm", "Cytoplasma"),
  aka: tx("its fluid part: cytosol", "der flüssige Teil: Cytosol"),
  role: tx("Everything between cell membrane and nucleus: the fluid cytosol with the organelles in it. Glycolysis runs in the cytosol.", "Alles zwischen Zellmembran und Zellkern: das flüssige Cytosol mit den Organellen darin. Im Cytosol läuft die Glykolyse."),
  facts: [tx("Proteins for the cell itself are made here, on free ribosomes.", "Proteine für die Zelle selbst entstehen hier an freien Ribosomen.")],
  clue: tx("is the fluid space where glycolysis runs", "der flüssige Raum ist, in dem die Glykolyse abläuft"),
};

const nucleus: PartInfo = {
  name: tx("Nucleus", "Zellkern"),
  aka: tx("nucleus", "Nucleus"),
  tag: tx("control centre", "Steuerzentrale"),
  role: tx("Holds the genetic information (DNA as chromatin) and controls the cell. DNA is copied and transcribed into RNA here.", "Enthält die Erbinformation (DNA als Chromatin) und steuert die Zelle. Hier wird die DNA verdoppelt und in RNA umgeschrieben."),
  facts: [
    tx("Chromatin = DNA + histones; loose euchromatin is active, dense heterochromatin is silent.", "Chromatin = DNA + Histone; lockeres Euchromatin ist aktiv, dichtes Heterochromatin stumm."),
    tx("Mammalian red blood cells lose their nucleus.", "Rote Blutkörperchen von Säugetieren verlieren ihren Kern."),
  ],
  clue: tx("holds the DNA and controls the cell", "die DNA enthält und die Zelle steuert"),
};

const envelope: PartInfo = {
  name: tx("Nuclear envelope", "Kernhülle"),
  aka: tx("double membrane with nuclear pores", "Doppelmembran mit Kernporen"),
  role: tx("A double membrane around the nucleus. Its pores control the traffic: mRNA and ribosome subunits go out, proteins come in.", "Eine Doppelmembran um den Zellkern. Ihre Poren regeln den Verkehr: mRNA und Ribosomen-Untereinheiten hinaus, Proteine hinein."),
  facts: [
    tx("The outer membrane runs straight on into the rough ER.", "Die äußere Membran geht direkt in das raue ER über."),
    tx("Nuclear pore complexes are huge protein channels; big molecules need transport signals.", "Kernporenkomplexe sind riesige Proteinkanäle; große Moleküle brauchen Transportsignale."),
  ],
  clue: tx("wraps the nucleus as a double membrane with pores", "den Kern als Doppelmembran mit Poren umgibt"),
};

const nucleolus: PartInfo = {
  name: tx("Nucleolus", "Nucleolus"),
  aka: tx("in the nucleus", "Kernkörperchen"),
  role: tx("A dense spot in the nucleus without a membrane: rRNA is made here and the ribosome subunits are assembled.", "Ein dichter Bereich im Kern ohne Membran: Hier wird rRNA gebildet und die Ribosomen-Untereinheiten werden zusammengebaut."),
  facts: [tx("Large in cells that make a lot of protein.", "Groß in Zellen, die viel Protein bilden.")],
  clue: tx("assembles the ribosome subunits", "die Ribosomen-Untereinheiten zusammenbaut"),
};

const roughER: PartInfo = {
  name: tx("Rough ER", "Raues ER"),
  aka: tx("rough endoplasmic reticulum", "raues endoplasmatisches Retikulum"),
  role: tx("Membrane sacs with ribosomes on the outside: makes and folds proteins for membranes, lysosomes (in plants: the vacuole) and export.", "Membransäckchen mit Ribosomen auf der Außenseite: bildet und faltet Proteine für Membranen, Lysosomen (bei Pflanzen: die Vakuole) und den Export."),
  facts: [
    tx("A signal sequence leads the growing protein into the ER lumen.", "Eine Signalsequenz führt das wachsende Protein ins ER-Lumen."),
    tx("The first sugar chains are added here (glycosylation).", "Hier werden die ersten Zuckerketten angehängt (Glykosylierung)."),
    tx("Very large in gland cells and in antibody-making plasma cells.", "Sehr ausgeprägt in Drüsenzellen und in antikörperbildenden Plasmazellen."),
  ],
  clue: tx("carries ribosomes and makes proteins for export", "Ribosomen trägt und Proteine für den Export bildet"),
};

const smoothER: PartInfo = {
  name: tx("Smooth ER", "Glattes ER"),
  aka: tx("smooth endoplasmic reticulum", "glattes endoplasmatisches Retikulum"),
  role: tx("ER without ribosomes: makes lipids such as phospholipids and steroid hormones, detoxifies substances and stores calcium.", "ER ohne Ribosomen: bildet Lipide wie Phospholipide und Steroidhormone, entgiftet Stoffe und speichert Calcium."),
  facts: [
    tx("Liver cells: breaks down drugs and alcohol.", "Leberzellen: baut Medikamente und Alkohol ab."),
    tx("Muscle cells: the sarcoplasmic reticulum stores Ca²⁺ for contraction.", "Muskelzellen: Das sarkoplasmatische Retikulum speichert Ca²⁺ für die Kontraktion."),
  ],
  clue: tx("makes lipids and detoxifies, without ribosomes", "ohne Ribosomen Lipide bildet und entgiftet"),
};

const golgi: PartInfo = {
  name: tx("Golgi apparatus", "Golgi-Apparat"),
  aka: tx("one stack: dictyosome", "ein Stapel: Dictyosom"),
  role: tx("Stacks of flat membrane sacs: they modify, sort and pack proteins from the ER into vesicles.", "Stapel flacher Membransäckchen: Sie verändern, sortieren und verpacken Proteine aus dem ER in Vesikel."),
  facts: [
    tx("cis side (in, facing the ER) and trans side (out, facing the cell membrane).", "cis-Seite (Eingang, zum ER) und trans-Seite (Ausgang, zur Zellmembran)."),
    tx("Finishes the sugar chains and makes lysosomes (in plants it sends the digestive enzymes to the vacuole).", "Vollendet die Zuckerketten und bildet Lysosomen (bei Pflanzen schickt er die Verdauungsenzyme in die Vakuole)."),
  ],
  tip: tx("Secretion route: rough ER → vesicle → Golgi → vesicle → cell membrane (exocytosis).", "Sekretionsweg: raues ER → Vesikel → Golgi → Vesikel → Zellmembran (Exocytose)."),
  clue: tx("sorts and packs proteins into vesicles", "Proteine sortiert und in Vesikel verpackt"),
};

const vesicle: PartInfo = {
  name: tx("Vesicles", "Vesikel"),
  aka: tx("transport vesicles", "Transportbläschen"),
  role: tx("Small membrane bubbles that carry cargo: from ER to Golgi, from Golgi to the cell membrane, where they fuse and release it (exocytosis).", "Kleine Membranbläschen, die Fracht transportieren: vom ER zum Golgi, vom Golgi zur Zellmembran, wo sie verschmelzen und sie freigeben (Exocytose)."),
  facts: [tx("Motor proteins (kinesin, dynein) pull them along microtubules.", "Motorproteine (Kinesin, Dynein) ziehen sie an Mikrotubuli entlang.")],
  clue: tx("carries cargo in small membrane bubbles", "Fracht in kleinen Membranbläschen transportiert"),
};

const mito: PartInfo = {
  name: tx("Mitochondrion", "Mitochondrium"),
  aka: tx("plural: mitochondria", "Mehrzahl: Mitochondrien"),
  tag: tx("power station", "Kraftwerk"),
  role: tx("The cell's power station: cellular respiration releases the energy of nutrients and stores it as ATP.", "Das Kraftwerk der Zelle: Die Zellatmung setzt die Energie der Nährstoffe frei und speichert sie als ATP."),
  facts: [
    tx("Double membrane; the inner one is folded into cristae, a large surface for the respiratory chain.", "Doppelmembran; die innere ist zu Cristae gefaltet, eine große Fläche für die Atmungskette."),
    tx("Citric acid cycle in the matrix, respiratory chain and ATP synthase on the inner membrane.", "Citratzyklus in der Matrix, Atmungskette und ATP-Synthase an der inneren Membran."),
    tx("Own ring-shaped DNA and 70S ribosomes: evidence for the endosymbiotic theory.", "Eigene ringförmige DNA und 70S-Ribosomen: ein Beleg für die Endosymbiontentheorie."),
    tx("Inherited from the mother only, through the egg cell.", "Wird nur von der Mutter vererbt, über die Eizelle."),
  ],
  clue: tx("makes ATP by cellular respiration", "bei der Zellatmung ATP bildet"),
};

const lysosome: PartInfo = {
  name: tx("Lysosome", "Lysosom"),
  aka: tx("the cell's stomach", "Magen der Zelle"),
  role: tx("A bubble full of digestive enzymes (acid hydrolases): breaks down worn-out organelles, swallowed bacteria and large molecules.", "Ein Bläschen voller Verdauungsenzyme (saure Hydrolasen): baut alte Organellen, aufgenommene Bakterien und Makromoleküle ab."),
  facts: [
    tx("Acidic inside, about pH 5, kept up by proton pumps.", "Innen sauer, etwa pH 5, gehalten von Protonenpumpen."),
    tx("Autophagy: the cell digests its own parts.", "Autophagie: Die Zelle verdaut eigene Bestandteile."),
    tx("Faulty lysosomal enzymes cause storage diseases.", "Defekte lysosomale Enzyme verursachen Speicherkrankheiten."),
  ],
  clue: tx("digests old cell parts with acid hydrolases", "alte Zellbestandteile mit sauren Hydrolasen verdaut"),
};

const peroxisome: PartInfo = {
  name: tx("Peroxisome", "Peroxisom"),
  aka: tx("microbody", "Microbody"),
  role: tx("A small bubble with enzymes that break down fatty acids and oxidise toxins. The hydrogen peroxide this makes is split by catalase.", "Ein kleines Bläschen mit Enzymen, die Fettsäuren abbauen und Giftstoffe oxidieren. Das dabei entstehende Wasserstoffperoxid zerlegt die Katalase."),
  facts: [tx("Catalase: 2 H₂O₂ → 2 H₂O + O₂.", "Katalase: 2 H₂O₂ → 2 H₂O + O₂."), tx("Breaks down very long fatty acids.", "Baut sehr langkettige Fettsäuren ab.")],
  clue: tx("splits hydrogen peroxide with catalase", "Wasserstoffperoxid mit Katalase zerlegt"),
};

const ribosomes: PartInfo = {
  name: tx("Ribosomes (80S)", "Ribosomen (80S)"),
  aka: tx("60S + 40S subunit", "60S- + 40S-Untereinheit"),
  role: tx("Make proteins: free in the cytoplasm for the cell's own proteins, on the rough ER for proteins to export or to put into membranes.", "Bauen Proteine: frei im Cytoplasma für zelleigene Proteine, am rauen ER für Proteine zum Export oder für Membranen."),
  facts: [tx("Bacteria, mitochondria and chloroplasts have the smaller 70S ribosomes.", "Bakterien, Mitochondrien und Chloroplasten haben die kleineren 70S-Ribosomen.")],
  clue: tx("make proteins and are 80S in size", "Proteine bauen und 80S groß sind"),
};

const cytoskeleton: PartInfo = {
  name: tx("Cytoskeleton", "Cytoskelett"),
  aka: tx("microtubules, intermediate filaments, actin", "Mikrotubuli, Intermediärfilamente, Aktin"),
  role: tx("A network of protein fibres: gives shape, holds organelles in place and serves as rails for transport.", "Ein Netz aus Proteinfasern: gibt Form, hält Organellen an ihrem Platz und dient als Schiene für den Transport."),
  facts: [
    tx("Microtubules (tubulin, about 25 nm), intermediate filaments (about 10 nm, e.g. keratin), actin filaments (about 7 nm).", "Mikrotubuli (Tubulin, etwa 25 nm), Intermediärfilamente (etwa 10 nm, z. B. Keratin), Aktinfilamente (etwa 7 nm)."),
    tx("Microtubules form the spindle in cell division.", "Mikrotubuli bilden bei der Zellteilung den Spindelapparat."),
  ],
  clue: tx("gives the cell its shape and serves as rails for transport", "der Zelle Form gibt und als Schiene für den Transport dient"),
};

const centrosome: PartInfo = {
  name: tx("Centrosome", "Zentrosom"),
  aka: tx("with two centrioles", "mit zwei Zentriolen"),
  role: tx("The organising centre of the microtubules next to the nucleus. In division it makes the poles of the spindle.", "Das Organisationszentrum der Mikrotubuli neben dem Kern. Bei der Teilung bildet es die Pole des Spindelapparats."),
  facts: [tx("Centrioles: 9 triplets of microtubules, at right angles to each other.", "Zentriolen: 9 Mikrotubuli-Tripletts, im rechten Winkel zueinander."), tx("Most plant cells have none.", "Den meisten Pflanzenzellen fehlt es.")],
  clue: tx("organises the microtubules and forms the spindle poles", "die Mikrotubuli organisiert und die Spindelpole bildet"),
};

export const ANIMAL = {
  kind: "parts",
  title: tx("Animal cell", "Tierzelle"),
  intro: tx(
    "An animal cell as the electron microscope shows it, about 10 to 30 µm across, ten times bigger than a bacterium. Membranes divide it into compartments, each with its own job.",
    "Eine Tierzelle, wie das Elektronenmikroskop sie zeigt, etwa 10 bis 30 µm groß und damit zehnmal größer als ein Bakterium. Membranen teilen sie in Räume, jeder mit eigener Aufgabe.",
  ),
  parts: { membrane, cytoplasm, nucleus, envelope, nucleolus, roughER, smoothER, golgi, vesicle, mito, lysosome, peroxisome, ribosomes, cytoskeleton, centrosome },
  questions: [
    {
      q: tx("Which organelle makes ATP by cellular respiration?", "Welches Organell bildet durch Zellatmung ATP?"),
      options: [tx("Mitochondrion", "Mitochondrium"), tx("Golgi apparatus", "Golgi-Apparat"), tx("Lysosome", "Lysosom"), tx("Nucleolus", "Nucleolus")],
      correct: 0,
    },
    {
      q: tx("Where are proteins for export made?", "Wo entstehen Proteine für den Export?"),
      options: [tx("On the rough ER", "Am rauen ER"), tx("In the smooth ER", "Im glatten ER"), tx("In the nucleolus", "Im Nucleolus"), tx("In the lysosome", "Im Lysosom")],
      correct: 0,
    },
    {
      q: tx("Which ribosomes are in the cytoplasm of eukaryotes?", "Welche Ribosomen haben Eukaryoten im Cytoplasma?"),
      options: [tx("80S", "80S"), tx("70S", "70S"), tx("50S", "50S"), tx("100S", "100S")],
      correct: 0,
    },
    {
      q: tx("Which organelles have their own DNA?", "Welche Organellen haben eigene DNA?"),
      options: [tx("Mitochondria and chloroplasts", "Mitochondrien und Chloroplasten"), tx("Lysosomes and peroxisomes", "Lysosomen und Peroxisomen"), tx("Golgi and ER", "Golgi und ER"), tx("Vesicles", "Vesikel")],
      correct: 0,
      why: tx("A leftover of their past as free bacteria (endosymbiotic theory, Lynn Margulis).", "Ein Überbleibsel ihrer Vergangenheit als freie Bakterien (Endosymbiontentheorie, Lynn Margulis)."),
    },
    {
      q: tx("Where are the ribosome subunits assembled?", "Wo werden die Ribosomen-Untereinheiten zusammengebaut?"),
      options: [tx("In the nucleolus", "Im Nucleolus"), tx("In the Golgi", "Im Golgi"), tx("In the mitochondria", "In den Mitochondrien"), tx("At the cell membrane", "An der Zellmembran")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const PLANT = {
  kind: "parts",
  title: tx("Plant cell", "Pflanzenzelle"),
  intro: tx(
    "A plant cell from a leaf. It has what an animal cell has, except centrosomes and lysosomes (its vacuole does the digesting), and three things more: a cellulose wall, chloroplasts and a large central vacuole.",
    "Eine Pflanzenzelle aus einem Blatt. Sie hat, was eine Tierzelle hat, außer Zentrosomen und Lysosomen (das Verdauen übernimmt ihre Vakuole), und drei Dinge mehr: eine Zellwand aus Cellulose, Chloroplasten und eine große Zentralvakuole.",
  ),
  parts: {
    wall: {
      name: tx("Cell wall", "Zellwand"),
      aka: tx("cellulose", "aus Cellulose"),
      tag: tx("not in animal cells", "nicht in Tierzellen"),
      role: tx("A firm wall of cellulose fibres outside the membrane: gives shape, protects and withstands the pressure of the vacuole (turgor).", "Eine feste Wand aus Cellulosefasern außerhalb der Membran: gibt Form, schützt und hält dem Druck der Vakuole (Turgor) stand."),
      facts: [
        tx("Primary wall: stretchy, grows along. Secondary wall: later, thicker, often lignified (wood).", "Primärwand: dehnbar, wächst mit. Sekundärwand: später, dicker, oft verholzt (Lignin)."),
        tx("Neighbouring cells are glued together by the middle lamella (pectin).", "Benachbarte Zellen sind über die Mittellamelle (Pektin) verklebt."),
        tx("Made of cellulose (glucose with β-1,4 links), not of murein as in bacteria.", "Aus Cellulose (β-1,4-verknüpfte Glucose), nicht aus Murein wie bei Bakterien."),
      ],
      clue: tx("is made of cellulose and withstands the turgor", "aus Cellulose besteht und dem Turgor standhält"),
    },
    plasmodesmata: {
      name: tx("Plasmodesmata", "Plasmodesmen"),
      aka: tx("channels through the wall", "Kanäle durch die Zellwand"),
      tag: tx("only plants", "nur Pflanzen"),
      role: tx("Fine channels through the cell walls that join the cytoplasm of neighbouring cells: substances and signals pass straight from cell to cell.", "Feine Kanäle durch die Zellwände, die das Cytoplasma benachbarter Zellen verbinden: Stoffe und Signale wandern direkt von Zelle zu Zelle."),
      facts: [tx("A thin strand of ER (desmotubule) runs through the middle.", "In der Mitte läuft ein dünner ER-Strang (Desmotubulus)."), tx("They do the job of gap junctions in animal cells.", "Sie entsprechen den Gap Junctions tierischer Zellen.")],
      clue: tx("joins the cytoplasm of neighbouring plant cells", "das Cytoplasma benachbarter Pflanzenzellen verbindet"),
    },
    membrane,
    vacuole: {
      name: tx("Central vacuole", "Zentralvakuole"),
      aka: tx("with its membrane, the tonoplast", "mit ihrer Membran, dem Tonoplasten"),
      tag: tx("not in animal cells", "nicht in Tierzellen"),
      role: tx("A large space full of cell sap, up to 90 % of the cell. It stores water, ions, pigments and waste and builds up the turgor.", "Ein großer Raum voll Zellsaft, bis zu 90 % der Zelle. Er speichert Wasser, Ionen, Farb- und Abfallstoffe und baut den Turgor auf."),
      facts: [
        tx("Turgor: water flows in by osmosis and the vacuole presses the cytoplasm against the wall, so the plant stands upright.", "Turgor: Wasser strömt osmotisch ein und die Vakuole drückt das Cytoplasma gegen die Wand, so steht die Pflanze aufrecht."),
        tx("In a hypertonic solution (e.g. a strong salt solution) it loses water and the cytoplasm pulls away from the wall: plasmolysis.", "In einer hypertonischen Lösung (z. B. einer konzentrierten Salzlösung) verliert sie Wasser und das Cytoplasma löst sich von der Wand: Plasmolyse."),
        tx("Holds pigments such as anthocyanins (red and blue flowers).", "Enthält Farbstoffe wie Anthocyane (rote und blaue Blüten)."),
      ],
      clue: tx("fills up to 90 % of the cell and builds up the turgor", "bis zu 90 % der Zelle füllt und den Turgor aufbaut"),
    },
    chloroplast: {
      name: tx("Chloroplast", "Chloroplast"),
      aka: tx("plural: chloroplasts", "Mehrzahl: Chloroplasten"),
      tag: tx("photosynthesis", "Fotosynthese"),
      role: tx("Where photosynthesis happens: light energy is used to build glucose from CO₂ and water.", "Ort der Fotosynthese: Mit Lichtenergie wird aus CO₂ und Wasser Glucose aufgebaut."),
      facts: [
        tx("Double membrane; inside are thylakoids, stacked into grana, with chlorophyll: the light reactions.", "Doppelmembran; innen Thylakoide, gestapelt zu Grana, mit Chlorophyll: die Lichtreaktionen."),
        tx("The Calvin cycle runs in the stroma.", "Im Stroma läuft der Calvin-Zyklus."),
        tx("Own ring-shaped DNA and 70S ribosomes: once a free cyanobacterium.", "Eigene ringförmige DNA und 70S-Ribosomen: einst ein freies Cyanobakterium."),
      ],
      clue: tx("carries out photosynthesis", "die Fotosynthese betreibt"),
    },
    nucleus,
    mito,
    golgi,
    roughER,
    peroxisome,
  },
  questions: [
    {
      q: tx("What do plant cells have that animal cells don't?", "Was haben Pflanzenzellen, Tierzellen aber nicht?"),
      options: [
        tx("Cell wall, chloroplasts and a central vacuole", "Zellwand, Chloroplasten und Zentralvakuole"),
        tx("Mitochondria and ribosomes", "Mitochondrien und Ribosomen"),
        tx("A nucleus and ER", "Zellkern und ER"),
        tx("Centrosomes", "Zentrosomen"),
      ],
      correct: 0,
    },
    {
      q: tx("What is the plant cell wall made of?", "Woraus besteht die pflanzliche Zellwand?"),
      options: [tx("Cellulose", "Cellulose"), tx("Murein", "Murein"), tx("Chitin", "Chitin"), tx("Keratin", "Keratin")],
      correct: 0,
    },
    {
      q: tx("What happens in plasmolysis?", "Was passiert bei der Plasmolyse?"),
      options: [
        tx("The vacuole loses water and the cytoplasm pulls away from the wall", "Die Vakuole verliert Wasser und das Cytoplasma löst sich von der Wand"),
        tx("The cell wall dissolves", "Die Zellwand löst sich auf"),
        tx("The cell bursts", "Die Zelle platzt"),
        tx("The chloroplasts divide", "Die Chloroplasten teilen sich"),
      ],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const CONTENT: ModelContent = { slug: "eukaryotic-cell", views: { animal: ANIMAL, plant: PLANT } };
