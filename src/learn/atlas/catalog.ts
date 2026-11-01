import { tx, type Text } from "@/i18n/text";

/**
 * The Atlas's models as plain data, safe for server components and search. The models
 * themselves (drawings, quiz) load on their own pages (see models/index.ts).
 */

export type AtlasArea = "micro" | "cell";

export type AtlasMeta = {
  slug: string;
  area: AtlasArea;
  title: Text;
  /** What's inside, one line: "Gram-positive, Gram-negative and murein". */
  subtitle: Text;
  /** One or two sentences for cards. */
  blurb: Text;
  /** Extra words that find it in search (both languages, lower case). */
  keywords: string;
  /** Learning topics this model goes with (their pages link here). */
  topics?: string[];
  /** Shown on cards: who it is for. */
  depth: Text;
};

export const ATLAS_AREAS: Record<AtlasArea, { title: Text; blurb: Text }> = {
  micro: {
    title: tx("Microbiology", "Mikrobiologie"),
    blurb: tx("Bacteria up close: structure, staining, spores and history", "Bakterien ganz nah: Aufbau, Färbung, Sporen und Geschichte"),
  },
  cell: {
    title: tx("Cell biology", "Zellbiologie"),
    blurb: tx("Organelles, and how substances cross membranes", "Organellen und wie Stoffe Membranen überwinden"),
  },
};

const UNI = tx("School, BTA and university", "Schule, BTA und Studium");

export const ATLAS: AtlasMeta[] = [
  {
    slug: "bacterial-cell",
    area: "micro",
    title: tx("The bacterial cell", "Die Bakterienzelle"),
    subtitle: tx("Structure, cell shapes, flagella and the flagellar motor", "Aufbau, Zellformen, Begeißelung und Geißelmotor"),
    blurb: tx(
      "Capsule to nucleoid: every structure of a prokaryote, the shapes you see under the microscope, and the motor that spins a flagellum.",
      "Von der Kapsel bis zum Nucleoid: jede Struktur einer Prokaryotenzelle, die Zellformen unterm Mikroskop und der Motor, der eine Geißel dreht.",
    ),
    keywords: "bakterium bakterien bacteria prokaryot prokaryote kokken stäbchen spirillen geißel geissel flagellum pili fimbrien plasmid nucleoid ribosomen 70s kapsel",
    topics: ["cell", "immune-system"],
    depth: UNI,
  },
  {
    slug: "cell-wall",
    area: "micro",
    title: tx("The bacterial cell wall", "Die Bakterienzellwand"),
    subtitle: tx("Gram-positive, Gram-negative and murein", "Grampositiv, gramnegativ und Murein"),
    blurb: tx(
      "Layer by layer through both kinds of cell envelope, down to the sugar chains and peptide bridges of murein.",
      "Schicht für Schicht durch beide Zellhüllen, bis hinunter zu den Zuckerketten und Peptidbrücken des Mureins.",
    ),
    keywords: "zellwand cell wall murein peptidoglykan peptidoglycan grampositiv gramnegativ gram lps lipid a o-antigen teichonsäure porin periplasma äußere membran outer membrane penicillin lysozym",
    topics: ["cell", "immune-system"],
    depth: UNI,
  },
  {
    slug: "gram-stain",
    area: "micro",
    title: tx("The Gram stain", "Die Gramfärbung"),
    subtitle: tx("Step by step, and why it works", "Schritt für Schritt und warum sie funktioniert"),
    blurb: tx(
      "Crystal violet, iodine, alcohol, safranin: watch what each step does to a Gram-positive and a Gram-negative cell.",
      "Kristallviolett, Lugol, Alkohol, Safranin: Sieh, was jeder Schritt mit einer grampositiven und einer gramnegativen Zelle macht.",
    ),
    keywords: "gramfärbung gram stain färbung kristallviolett lugol iod ethanol entfärben safranin fuchsin mikroskop ausstrich",
    topics: ["cell"],
    depth: UNI,
  },
  {
    slug: "endospores",
    area: "micro",
    title: tx("Endospores", "Endosporen"),
    subtitle: tx("Structure, sporulation, germination and position", "Aufbau, Sporulation, Keimung und Sporenlage"),
    blurb: tx(
      "How Bacillus and Clostridium survive boiling: the layers of a spore, how it forms in seven stages and how it wakes up again.",
      "Wie Bacillus und Clostridium Kochen überstehen: die Schichten einer Spore, ihre Bildung in sieben Stadien und wie sie wieder auskeimt.",
    ),
    keywords: "endospore sporen spore sporulation keimung bacillus clostridium dipicolinsäure cortex sporenhülle exosporium autoklav sterilisation tetanus",
    topics: ["cell", "immune-system"],
    depth: UNI,
  },
  {
    slug: "history",
    area: "micro",
    title: tx("The history of microbiology", "Geschichte der Mikrobiologie"),
    subtitle: tx("Timeline, Pasteur's flasks and Koch's postulates", "Zeitleiste, Pasteurs Kolben und Kochsche Postulate"),
    blurb: tx(
      "From Leeuwenhoek's tiny lens to CRISPR: who discovered what and when, and the two experiments every exam asks about.",
      "Von Leeuwenhoeks winziger Linse bis CRISPR: wer was wann entdeckt hat, und die zwei Experimente, nach denen jede Prüfung fragt.",
    ),
    keywords: "geschichte history ursprung leeuwenhoek pasteur koch postulate urzeugung schwanenhalskolben semmelweis lister jenner fleming penicillin petri gram",
    topics: ["immune-system", "evolution"],
    depth: UNI,
  },
  {
    slug: "eukaryotic-cell",
    area: "cell",
    title: tx("The eukaryotic cell", "Die eukaryotische Zelle"),
    subtitle: tx("Animal and plant cell with all organelles", "Tier- und Pflanzenzelle mit allen Organellen"),
    blurb: tx(
      "Nucleus, ER, Golgi, mitochondria and more: what every organelle does, and what only plant cells have.",
      "Zellkern, ER, Golgi, Mitochondrien und mehr: was jedes Organell leistet und was nur Pflanzenzellen haben.",
    ),
    keywords: "eukaryot eukaryote zelle cell tierzelle pflanzenzelle organellen organelle zellkern mitochondrium chloroplast golgi er lysosom vakuole zellwand",
    topics: ["cell", "photosynthesis"],
    depth: UNI,
  },
  {
    slug: "membrane-transport",
    area: "cell",
    title: tx("Transport across membranes", "Stofftransport an Membranen"),
    subtitle: tx("Passive, active and with vesicles", "Passiv, aktiv und mit Vesikeln"),
    blurb: tx(
      "Diffusion, channels, carriers, pumps, symport, antiport and group translocation, each one moving before your eyes.",
      "Diffusion, Kanäle, Carrier, Pumpen, Symport, Antiport und Gruppentranslokation, jedes davon in Bewegung.",
    ),
    keywords: "transport membrantransport diffusion osmose kanal carrier pumpe natrium kalium atpase symport antiport uniport gruppentranslokation pts endocytose exocytose phagocytose",
    topics: ["cell", "nervous-system", "digestion"],
    depth: UNI,
  },
];

export const findAtlas = (slug: string) => ATLAS.find((m) => m.slug === slug);

/** A model's page, optionally at a view and a structure. */
export const atlasHref = (slug: string, view?: string, item?: string) => {
  const q = new URLSearchParams();
  if (view) q.set("view", view);
  if (item) q.set("item", item);
  const s = q.toString();
  return `/learn/atlas/${slug}${s ? `?${s}` : ""}`;
};

/** Progress rows of the Atlas sit in learn_progress as "atlas:<slug>". */
export const atlasKey = (slug: string) => `atlas:${slug}`;
export const isAtlasKey = (key: string) => key.startsWith("atlas:");

/** Models that go with a learning topic. */
export const atlasForTopic = (topic: string) => ATLAS.filter((m) => m.topics?.includes(topic));
