// Facts and term lists for the cell topic, shared by the three levels. Ids match the
// `data-part` ids of the drawings in src/learn/biology/visuals/Cell*.tsx.

import { tx, type Text } from "@/i18n/text";

export type Part = {
  id: string;
  name: Text;
  /** Accepted answers when the student types the name. */
  accept: Text[];
  /** Its job, short (for match tasks). */
  job: Text;
  /** What it looks like in our drawings (for Blob's hints, never the name itself). */
  look: Text;
};

// ---------------------------------------------------------------------------
// Level 1: what the light microscope shows in plant and animal cells

export const L1_PARTS: Record<string, Part & { plant: boolean; animal: boolean }> = {
  wall: {
    id: "wall",
    name: tx("cell wall", "Zellwand"),
    accept: [tx("cell wall", "Zellwand"), "wall", "Wand"],
    job: tx("gives the cell a firm shape", "gibt der Zelle Form und Festigkeit"),
    look: tx("the thick green layer on the very outside", "die dicke grüne Schicht ganz außen"),
    plant: true,
    animal: false,
  },
  membrane: {
    id: "membrane",
    name: tx("cell membrane", "Zellmembran"),
    accept: [tx("cell membrane", "Zellmembran"), tx("membrane", "Membran"), tx("plasma membrane", "Plasmamembran"), "cell surface membrane", "Biomembran"],
    job: tx("controls what goes in and out", "kontrolliert, was hinein- und hinausgeht"),
    look: tx("the thin orange line that encloses the cytoplasm", "die dünne orange Linie, die das Zellplasma umschließt"),
    plant: true,
    animal: true,
  },
  cytoplasm: {
    id: "cytoplasm",
    name: tx("cytoplasm", "Zellplasma"),
    accept: [tx("cytoplasm", "Zellplasma"), "Cytoplasma", "Zytoplasma", "Plasma", "Grundplasma"],
    job: tx("jelly-like filling where the chemistry of life happens", "Grundsubstanz, in der Stoffwechselvorgänge ablaufen"),
    look: tx("the filling between all the other parts", "die Füllung zwischen allen anderen Teilen"),
    plant: true,
    animal: true,
  },
  nucleus: {
    id: "nucleus",
    name: tx("nucleus", "Zellkern"),
    accept: [tx("nucleus", "Zellkern"), "Kern", "Nukleus", "Nucleus", "cell nucleus"],
    job: tx("controls the cell and holds the genetic information", "steuert die Zelle und enthält die Erbinformation"),
    look: tx("the round purple body with a dark spot inside", "der runde lila Körper mit einem dunklen Fleck darin"),
    plant: true,
    animal: true,
  },
  vacuole: {
    id: "vacuole",
    name: tx("vacuole", "Vakuole"),
    accept: [tx("vacuole", "Vakuole"), "Zellsaftvakuole", "Zentralvakuole", "central vacuole", "Zellsaftraum"],
    job: tx("stores cell sap and keeps the cell firm", "speichert Zellsaft und hält die Zelle prall"),
    look: tx("the big blue space in the middle", "der große blaue Raum in der Mitte"),
    plant: true,
    animal: false,
  },
  chloroplast: {
    id: "chloroplast",
    name: tx("chloroplast", "Chloroplast"),
    accept: [tx("chloroplast", "Chloroplast"), "Chloroplasten", "chloroplasts", "Blattgrünkorn", "Blattgrünkörner", "Blattgrünkörnchen"],
    job: tx("makes sugar using light (photosynthesis)", "stellt mit Licht Zucker her (Fotosynthese)"),
    look: tx("the small green lenses near the edge", "die kleinen grünen Linsen am Rand"),
    plant: true,
    animal: false,
  },
};

// ---------------------------------------------------------------------------
// Level 2: organelles in the electron microscope

export const ORGANELLES: Record<string, Part> = {
  nucleus: { ...L1_PARTS.nucleus, job: tx("holds the DNA and controls the cell", "enthält die DNA und steuert die Zelle") },
  membrane: { ...L1_PARTS.membrane, job: tx("encloses the cell and controls the exchange of substances", "grenzt die Zelle ab und regelt den Stoffaustausch") },
  wall: { ...L1_PARTS.wall, job: tx("wall of cellulose: gives strength and shape", "Wand aus Cellulose: gibt Festigkeit und Form") },
  vacuole: { ...L1_PARTS.vacuole, job: tx("stores cell sap and keeps the cell firm (turgor)", "speichert Zellsaft und sorgt für Innendruck (Turgor)") },
  chloroplast: { ...L1_PARTS.chloroplast, job: tx("photosynthesis: builds glucose using light energy", "Fotosynthese: baut mit Lichtenergie Traubenzucker auf"), look: tx("the green bodies with stacks of membranes inside", "die grünen Körper mit Membranstapeln darin") },
  mitochondrion: {
    id: "mitochondrion",
    name: tx("mitochondrion", "Mitochondrium"),
    accept: [tx("mitochondrion", "Mitochondrium"), "Mitochondrien", "mitochondria", "Mitochondrion"],
    job: tx("cellular respiration: releases energy (ATP) from glucose", "Zellatmung: gewinnt Energie (ATP) aus Traubenzucker"),
    look: tx("the orange capsules with a folded inner membrane", "die orangen Kapseln mit gefalteter Innenmembran"),
  },
  ribosome: {
    id: "ribosome",
    name: tx("ribosomes", "Ribosomen"),
    accept: [tx("ribosomes", "Ribosomen"), "Ribosom", "ribosome"],
    job: tx("protein synthesis: join amino acids into proteins", "Proteinbiosynthese: verknüpfen Aminosäuren zu Proteinen"),
    look: tx("the many tiny dots", "die vielen winzigen Punkte"),
  },
  er: {
    id: "er",
    name: tx("rough ER", "raues ER"),
    accept: [tx("rough endoplasmic reticulum", "raues endoplasmatisches Retikulum"), "raues ER", "rough ER", "ER", "endoplasmatisches Retikulum", "endoplasmic reticulum", "rER", "raues Endoplasmatisches Retikulum"],
    job: tx("makes proteins with its ribosomes and passes them on", "stellt mit seinen Ribosomen Proteine her und leitet sie weiter"),
    look: tx("the curved pink channels next to the nucleus, dotted with ribosomes", "die gebogenen rosa Kanäle neben dem Kern, mit Ribosomen besetzt"),
  },
  ser: {
    id: "ser",
    name: tx("smooth ER", "glattes ER"),
    accept: [tx("smooth endoplasmic reticulum", "glattes endoplasmatisches Retikulum"), "glattes ER", "smooth ER", "sER"],
    job: tx("makes lipids", "bildet Lipide (Fette)"),
    look: tx("the pink tubes without any dots", "die rosa Röhren ohne Punkte"),
  },
  golgi: {
    id: "golgi",
    name: tx("Golgi apparatus", "Golgi-Apparat"),
    accept: [tx("Golgi apparatus", "Golgi-Apparat"), "Golgi", "Golgiapparat", "Golgi body", "Dictyosom", "Golgi complex"],
    job: tx("modifies, sorts and packs proteins into vesicles", "verändert, sortiert und verpackt Proteine in Vesikel"),
    look: tx("the stack of curved, flat sacs with little bubbles at the rims", "der Stapel gebogener, flacher Säckchen mit Bläschen am Rand"),
  },
  lysosome: {
    id: "lysosome",
    name: tx("lysosome", "Lysosom"),
    accept: [tx("lysosome", "Lysosom"), "Lysosomen", "lysosomes"],
    job: tx("digests worn-out parts and foreign matter with enzymes", "baut mit Enzymen alte Zellteile und Fremdstoffe ab"),
    look: tx("the small round bags with dots inside", "die kleinen runden Bläschen mit Pünktchen darin"),
  },
  vesicle: {
    id: "vesicle",
    name: tx("vesicle", "Vesikel"),
    accept: [tx("vesicle", "Vesikel"), "vesicles", "Bläschen", "Transportvesikel"],
    job: tx("carries substances through the cell", "transportiert Stoffe durch die Zelle"),
    look: tx("the tiny empty bubbles", "die winzigen leeren Bläschen"),
  },
  envelope: {
    id: "envelope",
    name: tx("nuclear envelope", "Kernhülle"),
    accept: [tx("nuclear envelope", "Kernhülle"), "Kernmembran", "nuclear membrane", "Kernhuelle"],
    job: tx("double membrane that separates the nucleus from the cytoplasm", "Doppelmembran, die den Kern vom Zellplasma trennt"),
    look: tx("the double line around the nucleus", "die Doppellinie um den Zellkern"),
  },
  pore: {
    id: "pore",
    name: tx("nuclear pore", "Kernpore"),
    accept: [tx("nuclear pore", "Kernpore"), "Kernporen", "nuclear pores", "Pore"],
    job: tx("lets mRNA out of the nucleus", "lässt mRNA aus dem Zellkern heraus"),
    look: tx("the gaps in the double line around the nucleus", "die Lücken in der Doppellinie um den Kern"),
  },
};

export const BACTERIUM: Record<string, Part> = {
  capsule: {
    id: "capsule",
    name: tx("capsule", "Kapsel"),
    accept: [tx("capsule", "Kapsel"), "Schleimkapsel", "slime layer", "Schleimhülle", "Schleimschicht"],
    job: tx("slimy outer layer: protects against drying out and immune cells", "schleimige Hülle: schützt vor Austrocknung und Abwehrzellen"),
    look: tx("the outermost layer with the dashed edge", "die äußerste Schicht mit dem gestrichelten Rand"),
  },
  wall: {
    id: "wall",
    name: tx("cell wall", "Zellwand"),
    accept: [tx("cell wall", "Zellwand"), "Mureinwand", "Murein", "Mureinzellwand"],
    job: tx("firm wall of murein", "feste Wand aus Murein"),
    look: tx("the firm brown layer", "die feste braune Schicht"),
  },
  membrane: { ...L1_PARTS.membrane, look: tx("the thin orange line just inside the wall", "die dünne orange Linie direkt innerhalb der Wand") },
  cytoplasm: { ...L1_PARTS.cytoplasm },
  nucleoid: {
    id: "nucleoid",
    name: tx("bacterial chromosome (nucleoid)", "Bakterienchromosom (Nucleoid)"),
    accept: [tx("bacterial chromosome", "Bakterienchromosom"), "Nucleoid", "Nukleoid", "nucleoid", "Kernäquivalent", "Ring-DNA", "circular DNA", "Bakterien-DNA", "bacterial DNA", "Chromosom", "chromosome"],
    job: tx("one ring of DNA, free in the cytoplasm", "ein DNA-Ring, frei im Zellplasma"),
    look: tx("the tangled loop in the middle, with no envelope around it", "die verknäulte Schleife in der Mitte, ohne Hülle drumherum"),
  },
  plasmid: {
    id: "plasmid",
    name: tx("plasmid", "Plasmid"),
    accept: [tx("plasmid", "Plasmid"), "Plasmide", "plasmids"],
    job: tx("small extra ring of DNA, e.g. with resistance genes", "kleiner zusätzlicher DNA-Ring, z. B. mit Resistenzgenen"),
    look: tx("the small separate rings", "die kleinen einzelnen Ringe"),
  },
  ribosome: {
    id: "ribosome",
    name: tx("ribosomes (70S)", "Ribosomen (70S)"),
    accept: [tx("ribosomes", "Ribosomen"), "Ribosom", "70S-Ribosomen", "ribosome", "70S ribosomes"],
    job: tx("make proteins (smaller 70S type)", "stellen Proteine her (kleinerer 70S-Typ)"),
    look: tx("the many tiny dots", "die vielen winzigen Punkte"),
  },
  flagellum: {
    id: "flagellum",
    name: tx("flagellum", "Geißel"),
    accept: [tx("flagellum", "Geißel"), "Flagellum", "Geissel", "flagella", "Flagelle"],
    job: tx("rotates like a propeller: swimming", "dreht sich wie ein Propeller: Fortbewegung"),
    look: tx("the long wavy thread", "der lange gewellte Faden"),
  },
  pili: {
    id: "pili",
    name: tx("pili", "Pili"),
    accept: [tx("pili", "Pili"), "Fimbrien", "Pilus", "pilus", "fimbriae"],
    job: tx("fine hairs for sticking to surfaces", "feine Härchen zum Anheften"),
    look: tx("the short straight hairs", "die kurzen geraden Härchen"),
  },
};

export const MICROSCOPE: Record<string, Part> = {
  eyepiece: {
    id: "eyepiece",
    name: tx("eyepiece", "Okular"),
    accept: [tx("eyepiece", "Okular"), "ocular", "Okularlinse"],
    job: tx("the lens you look through", "die Linse, durch die du schaust"),
    look: tx("the part at the very top, where you put your eye", "das Teil ganz oben, an das du dein Auge hältst"),
  },
  objective: {
    id: "objective",
    name: tx("objective", "Objektiv"),
    accept: [tx("objective", "Objektiv"), "objective lens", "Objektive", "objectives"],
    job: tx("the lens just above the specimen", "die Linse direkt über dem Präparat"),
    look: tx("the lens that points down at the specimen", "die Linse, die nach unten auf das Präparat zeigt"),
  },
  nosepiece: {
    id: "nosepiece",
    name: tx("revolving nosepiece", "Objektivrevolver"),
    accept: [tx("revolving nosepiece", "Objektivrevolver"), "Revolver", "nosepiece", "turret"],
    job: tx("turns to swap the objectives", "wird gedreht, um die Objektive zu wechseln"),
    look: tx("the turning disc that holds the objectives", "die drehbare Scheibe, an der die Objektive sitzen"),
  },
  tube: {
    id: "tube",
    name: tx("tube", "Tubus"),
    accept: [tx("tube", "Tubus"), "body tube"],
    job: tx("connects eyepiece and objective", "verbindet Okular und Objektiv"),
    look: tx("the long tube between eyepiece and nosepiece", "das lange Rohr zwischen Okular und Revolver"),
  },
  stage: {
    id: "stage",
    name: tx("stage", "Objekttisch"),
    accept: [tx("stage", "Objekttisch"), "Tisch"],
    job: tx("holds the slide", "trägt den Objektträger"),
    look: tx("the flat table with the two clips", "der flache Tisch mit den zwei Klammern"),
  },
  diaphragm: {
    id: "diaphragm",
    name: tx("diaphragm", "Blende"),
    accept: [tx("diaphragm", "Blende"), "iris diaphragm", "Irisblende"],
    job: tx("controls brightness and contrast", "regelt Helligkeit und Kontrast"),
    look: tx("the part with the little lever under the stage", "das Teil mit dem kleinen Hebel unter dem Tisch"),
  },
  light: {
    id: "light",
    name: tx("light source", "Lichtquelle"),
    accept: [tx("light source", "Lichtquelle"), "Beleuchtung", "Lampe", "lamp", "light", "Licht"],
    job: tx("shines through the specimen from below", "durchleuchtet das Präparat von unten"),
    look: tx("the lamp in the base", "die Lampe im Fuß"),
  },
  coarse: {
    id: "coarse",
    name: tx("coarse focus knob", "Grobtrieb"),
    accept: [tx("coarse focus knob", "Grobtrieb"), "coarse focus", "coarse adjustment", "coarse adjustment knob"],
    job: tx("rough focusing: moves the stage a lot", "grobes Scharfstellen: bewegt den Tisch stark"),
    look: tx("the big knob on the arm", "der große Drehknopf am Stativ"),
  },
  fine: {
    id: "fine",
    name: tx("fine focus knob", "Feintrieb"),
    accept: [tx("fine focus knob", "Feintrieb"), "fine focus", "fine adjustment", "fine adjustment knob"],
    job: tx("fine focusing: moves the stage just a little", "feines Scharfstellen: bewegt den Tisch nur wenig"),
    look: tx("the small knob on the arm", "der kleine Drehknopf am Stativ"),
  },
  arm: {
    id: "arm",
    name: tx("arm and base", "Stativ"),
    accept: [tx("arm", "Stativ"), "stand", "Stativ mit Fuß", "arm and base", "base", "Fuß"],
    job: tx("holds everything together; carry it by the arm", "hält alles zusammen; daran trägst du das Mikroskop"),
    look: tx("the curved stand with the base", "der gebogene Ständer mit dem Fuß"),
  },
  slide: {
    id: "slide",
    name: tx("slide", "Objektträger"),
    accept: [tx("slide", "Objektträger"), "microscope slide", "Objekttraeger"],
    job: tx("glass plate that carries the specimen", "Glasplättchen, das das Präparat trägt"),
    look: tx("the thin glass plate lying on the stage", "das dünne Glasplättchen auf dem Tisch"),
  },
};

export const PARAMECIUM: Record<string, Part> = {
  cilia: {
    id: "cilia",
    name: tx("cilia", "Wimpern"),
    accept: [tx("cilia", "Wimpern"), "Wimper", "cilium", "Zilien", "Cilien"],
    job: tx("swimming and sweeping in food", "Fortbewegung und Herbeistrudeln der Nahrung"),
    look: tx("the many short hairs all around the edge", "die vielen kurzen Härchen am ganzen Rand"),
  },
  mouth: {
    id: "mouth",
    name: tx("oral groove with cell mouth", "Mundfeld mit Zellmund"),
    accept: [tx("cell mouth", "Zellmund"), "Mundfeld", "oral groove", "Zellmund", "mouth"],
    job: tx("taking in food", "Nahrungsaufnahme"),
    look: tx("the groove on the underside that leads into a funnel", "die Rinne an der Unterseite, die in einen Trichter führt"),
  },
  food: {
    id: "food",
    name: tx("food vacuole", "Nahrungsvakuole"),
    accept: [tx("food vacuole", "Nahrungsvakuole"), "Nahrungsvakuolen", "food vacuoles", "Verdauungsvakuole"],
    job: tx("digesting the food", "Verdauung der Nahrung"),
    look: tx("the round bubbles with bits of food inside", "die runden Bläschen mit Nahrungsbrocken darin"),
  },
  contractile: {
    id: "contractile",
    name: tx("contractile vacuole", "pulsierende Vakuole"),
    accept: [tx("contractile vacuole", "pulsierende Vakuole"), "kontraktile Vakuole", "pulsierende Vakuolen", "contractile vacuoles"],
    job: tx("pumps out excess water", "pumpt überschüssiges Wasser hinaus"),
    look: tx("the star-shaped bubbles at both ends", "die sternförmigen Bläschen an beiden Enden"),
  },
  macro: {
    id: "macro",
    name: tx("macronucleus", "Großkern"),
    accept: [tx("macronucleus", "Großkern"), "Makronukleus", "Makronucleus"],
    job: tx("controls the metabolism", "steuert den Stoffwechsel"),
    look: tx("the big bean-shaped body", "der große bohnenförmige Körper"),
  },
  micro: {
    id: "micro",
    name: tx("micronucleus", "Kleinkern"),
    accept: [tx("micronucleus", "Kleinkern"), "Mikronukleus", "Mikronucleus"],
    job: tx("reproduction: passes on the genetic information", "Fortpflanzung: gibt die Erbinformation weiter"),
    look: tx("the small dark dot next to the big nucleus", "der kleine dunkle Punkt neben dem großen Kern"),
  },
  anus: {
    id: "anus",
    name: tx("anal pore", "Zellafter"),
    accept: [tx("anal pore", "Zellafter"), "cytoproct", "Zellafteröffnung"],
    job: tx("getting rid of undigested remains", "Abgabe unverdaulicher Reste"),
    look: tx("the spot at the back where remains come out", "die Stelle hinten, an der Reste austreten"),
  },
};

export const MEMBRANE: Record<string, Part> = {
  heads: {
    id: "heads",
    name: tx("hydrophilic head", "hydrophiler Kopf"),
    accept: [tx("hydrophilic head", "hydrophiler Kopf"), "Phosphatkopf", "Kopf", "head", "polar head", "polarer Kopf"],
    job: tx("polar, faces the water on both sides", "polar, zeigt auf beiden Seiten zum Wasser"),
    look: tx("the round heads facing the water", "die runden Köpfe, die zum Wasser zeigen"),
  },
  tails: {
    id: "tails",
    name: tx("hydrophobic tails", "hydrophobe Fettsäurereste"),
    accept: [tx("hydrophobic tails", "hydrophobe Fettsäurereste"), "Fettsäurereste", "Fettsäureschwänze", "fatty acid tails", "Schwänze", "tails"],
    job: tx("nonpolar, form the inside of the membrane", "unpolar, bilden das Innere der Membran"),
    look: tx("the pairs of lines inside the membrane", "die Linienpaare im Inneren der Membran"),
  },
  channel: {
    id: "channel",
    name: tx("channel protein", "Kanalprotein"),
    accept: [tx("channel protein", "Kanalprotein"), "Ionenkanal", "Kanal", "ion channel", "channel", "Tunnelprotein"],
    job: tx("a pore that lets certain ions through, down the gradient", "eine Pore, die bestimmte Ionen dem Gefälle nach durchlässt"),
    look: tx("the protein with a tunnel right through it", "das Protein mit einem Tunnel mittendurch"),
  },
  carrier: {
    id: "carrier",
    name: tx("carrier protein", "Carrier"),
    accept: [tx("carrier protein", "Carrier"), "Carrierprotein", "Carrier-Protein", "carrier", "Transportprotein", "transport protein", "Translokator"],
    job: tx("binds a particular substance, changes shape and lets it out on the other side", "bindet einen bestimmten Stoff, ändert seine Form und gibt ihn auf der anderen Seite ab"),
    look: tx("the protein with a pocket that holds a molecule", "das Protein mit einer Tasche, in der ein Molekül sitzt"),
  },
  glyco: {
    id: "glyco",
    name: tx("glycoprotein", "Glykoprotein"),
    accept: [tx("glycoprotein", "Glykoprotein"), "Glycoprotein"],
    job: tx("recognition tag of the cell", "Erkennungsmerkmal der Zelle"),
    look: tx("the protein with a sugar chain on top", "das Protein mit einer Zuckerkette obendrauf"),
  },
  sugar: {
    id: "sugar",
    name: tx("sugar chains (glycocalyx)", "Zuckerketten (Glykokalyx)"),
    accept: [tx("glycocalyx", "Glykokalyx"), "Glycocalyx", "Zuckerketten", "sugar chains", "Kohlenhydratketten", "carbohydrate chains"],
    job: tx("cell recognition and contact, outside only", "Zellerkennung und Zellkontakt, nur außen"),
    look: tx("the chains of little hexagons on the outside", "die Ketten aus kleinen Sechsecken auf der Außenseite"),
  },
  peripheral: {
    id: "peripheral",
    name: tx("peripheral protein", "peripheres Protein"),
    accept: [tx("peripheral protein", "peripheres Protein"), "peripheral protein", "Randprotein"],
    job: tx("sits only on the surface of the membrane", "sitzt nur außen an der Membranoberfläche"),
    look: tx("the protein that only sits on the inner surface", "das Protein, das nur an der Innenseite sitzt"),
  },
  cholesterol: {
    id: "cholesterol",
    name: tx("cholesterol", "Cholesterin"),
    accept: [tx("cholesterol", "Cholesterin"), "Cholesterol"],
    job: tx("keeps the fluidity of the membrane just right", "hält die Fluidität der Membran im richtigen Bereich"),
    look: tx("the small stiff molecules between the tails", "die kleinen steifen Moleküle zwischen den Schwänzen"),
  },
};

/** Things to compare by size, in µm. */
export const SIZES: { id: string; name: Text; um: number; shown: Text }[] = [
  { id: "atom", name: tx("atom", "Atom"), um: 0.0001, shown: tx("0.1 nm", "0,1 nm") },
  { id: "dna", name: tx("DNA double helix (width)", "DNA-Doppelhelix (Durchmesser)"), um: 0.002, shown: tx("2 nm", "2 nm") },
  { id: "ribosome", name: tx("ribosome", "Ribosom"), um: 0.025, shown: tx("25 nm", "25 nm") },
  { id: "virus", name: tx("flu virus", "Grippevirus"), um: 0.1, shown: tx("100 nm", "100 nm") },
  { id: "bacterium", name: tx("bacterium (E. coli)", "Bakterium (E. coli)"), um: 2, shown: tx("2 µm", "2 µm") },
  { id: "rbc", name: tx("red blood cell", "rotes Blutkörperchen"), um: 7.5, shown: tx("7.5 µm", "7,5 µm") },
  { id: "liver", name: tx("liver cell", "Leberzelle"), um: 25, shown: tx("25 µm", "25 µm") },
  { id: "egg", name: tx("human egg cell", "menschliche Eizelle"), um: 120, shown: tx("0.12 mm", "0,12 mm") },
  { id: "onion", name: tx("onion skin cell", "Zwiebelhautzelle"), um: 300, shown: tx("0.3 mm", "0,3 mm") },
  { id: "frogegg", name: tx("frog egg", "Froschei"), um: 2000, shown: tx("2 mm", "2 mm") },
];

/** Objects for magnification sums: actual size in µm. */
export const MAG_OBJECTS: { name: Text; um: number; it: Text }[] = [
  { name: tx("a slipper animalcule", "ein Pantoffeltierchen"), um: 200, it: tx("it", "es") },
  { name: tx("an onion skin cell", "eine Zwiebelhautzelle"), um: 250, it: tx("it", "sie") },
  { name: tx("a cheek cell", "eine Mundschleimhautzelle"), um: 60, it: tx("it", "sie") },
  { name: tx("a red blood cell", "ein rotes Blutkörperchen"), um: 7.5, it: tx("it", "es") },
  { name: tx("a liver cell", "eine Leberzelle"), um: 25, it: tx("it", "sie") },
  { name: tx("a yeast cell", "eine Hefezelle"), um: 8, it: tx("it", "sie") },
  { name: tx("a chloroplast", "ein Chloroplast"), um: 5, it: tx("it", "er") },
  { name: tx("a human egg cell", "eine menschliche Eizelle"), um: 120, it: tx("it", "sie") },
  { name: tx("a leaf cell", "eine Blattzelle"), um: 40, it: tx("it", "sie") },
  { name: tx("a bacterium", "ein Bakterium"), um: 2, it: tx("it", "es") },
];
