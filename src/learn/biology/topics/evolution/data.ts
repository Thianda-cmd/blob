// Facts shared by the evolution lessons, tasks and drawings: fossils with their ages,
// family trees (with approximate ages of the branching points) and the vertebrate cladogram.

import { tx, type Text } from "@/i18n/text";

// ---------------------------------------------------------------------------
// Fossils

export type FossilId = "tusk" | "horse" | "archaeopteryx" | "footprint" | "ammonite" | "fern" | "fish" | "trilobite" | "stromatolite";

export type Fossil = {
  name: Text;
  /** Age in million years. */
  age: number;
  ageText: Text;
  info: Text;
};

export const FOSSILS: Record<FossilId, Fossil> = {
  tusk: {
    name: tx("mammoth tusk", "Mammut-Stoßzahn"),
    age: 0.02,
    ageText: tx("about 20,000 years ago", "vor etwa 20.000 Jahren"),
    info: tx("Woolly mammoths lived in the last Ice Age. Their tusks were long, curved teeth.", "Wollhaarmammuts lebten in der letzten Eiszeit. Ihre Stoßzähne waren lange, gebogene Zähne."),
  },
  horse: {
    name: tx("primeval horse", "Urpferdchen"),
    age: 47,
    ageText: tx("about 47 million years ago", "vor etwa 47 Mio. Jahren"),
    info: tx(
      "Whole skeletons were found in the Messel Pit near Darmstadt. These early horses were only about as big as a fox and had several toes.",
      "In der Grube Messel bei Darmstadt fand man ganze Skelette. Diese frühen Pferde waren nur etwa so groß wie ein Fuchs und hatten mehrere Zehen.",
    ),
  },
  archaeopteryx: {
    name: tx("primeval bird Archaeopteryx", "Urvogel Archaeopteryx"),
    age: 150,
    ageText: tx("about 150 million years ago", "vor etwa 150 Mio. Jahren"),
    info: tx(
      "Found in the Solnhofen limestone in Bavaria: feathers like a bird, but teeth and a long bony tail like a reptile.",
      "Gefunden im Solnhofener Plattenkalk in Bayern: Federn wie ein Vogel, aber Zähne und ein langer Knochenschwanz wie ein Reptil.",
    ),
  },
  footprint: {
    name: tx("dinosaur footprint", "Dinosaurier-Fußspur"),
    age: 200,
    ageText: tx("about 200 million years ago", "vor etwa 200 Mio. Jahren"),
    info: tx("A dinosaur walked over soft mud. The mud hardened and the three-toed track was preserved.", "Ein Dinosaurier lief über weichen Schlamm. Der Schlamm wurde hart, und die dreizehige Spur blieb erhalten."),
  },
  ammonite: {
    name: tx("ammonite", "Ammonit"),
    age: 180,
    ageText: tx("about 180 million years ago", "vor etwa 180 Mio. Jahren"),
    info: tx(
      "Ammonites were sea animals with a spiral shell, related to today's squid. They died out at the same time as the dinosaurs.",
      "Ammoniten waren Meerestiere mit spiraligem Gehäuse, verwandt mit den heutigen Tintenfischen. Sie starben zur gleichen Zeit aus wie die Dinosaurier.",
    ),
  },
  fern: {
    name: tx("tree fern leaf", "Baumfarnblatt"),
    age: 300,
    ageText: tx("about 300 million years ago", "vor etwa 300 Mio. Jahren"),
    info: tx(
      "Huge tree ferns grew in the swamp forests of the Carboniferous. Their remains turned into the coal we mine today.",
      "In den Sumpfwäldern des Karbons wuchsen riesige Baumfarne. Aus ihren Resten entstand die Steinkohle, die heute abgebaut wird.",
    ),
  },
  fish: {
    name: tx("armoured fish", "Panzerfisch"),
    age: 380,
    ageText: tx("about 380 million years ago", "vor etwa 380 Mio. Jahren"),
    info: tx("Armoured fish had heads covered with bony plates. They lived in the seas of the Devonian.", "Panzerfische hatten einen Kopf aus Knochenplatten. Sie lebten in den Meeren des Devons."),
  },
  trilobite: {
    name: tx("trilobite", "Trilobit"),
    age: 500,
    ageText: tx("about 500 million years ago", "vor etwa 500 Mio. Jahren"),
    info: tx(
      "Trilobites were sea animals with an armour in three parts. They were arthropods, like today's insects, spiders and crabs.",
      "Trilobiten waren Meerestiere mit einem dreiteiligen Panzer. Sie gehörten zu den Gliederfüßern wie heute Insekten, Spinnen und Krebse.",
    ),
  },
  stromatolite: {
    name: tx("stromatolite (bacterial mats)", "Stromatolith (Bakterienmatten)"),
    age: 3500,
    ageText: tx("about 3.5 billion years ago", "vor etwa 3,5 Mrd. Jahren"),
    info: tx("Layered domes built by mats of bacteria. They are among the oldest traces of life.", "Geschichtete Kuppeln, die Bakterienmatten aufgebaut haben. Sie gehören zu den ältesten Lebensspuren."),
  },
};

/** The layers of the digging widget, from the top (youngest) to the bottom (oldest). */
export const DIG_LAYERS: FossilId[] = ["tusk", "horse", "archaeopteryx", "ammonite", "fern", "fish", "trilobite"];

export const FOSSIL_IDS = Object.keys(FOSSILS) as FossilId[];

// ---------------------------------------------------------------------------
// Family trees

export type LeafId =
  | "human"
  | "chimp"
  | "gorilla"
  | "orangutan"
  | "gibbon"
  | "shark"
  | "trout"
  | "frog"
  | "mouse"
  | "lizard"
  | "croc"
  | "bird"
  | "camel"
  | "pig"
  | "cow"
  | "hippo"
  | "whale";

export const LEAVES: Record<LeafId, Text> = {
  human: tx("human", "Mensch"),
  chimp: tx("chimpanzee", "Schimpanse"),
  gorilla: tx("gorilla", "Gorilla"),
  orangutan: tx("orangutan", "Orang-Utan"),
  gibbon: tx("gibbon", "Gibbon"),
  shark: tx("shark", "Hai"),
  trout: tx("trout", "Forelle"),
  frog: tx("frog", "Frosch"),
  mouse: tx("mouse", "Maus"),
  lizard: tx("lizard", "Eidechse"),
  croc: tx("crocodile", "Krokodil"),
  bird: tx("bird (pigeon)", "Vogel (Taube)"),
  camel: tx("camel", "Kamel"),
  pig: tx("pig", "Schwein"),
  cow: tx("cow", "Rind"),
  hippo: tx("hippo", "Flusspferd"),
  whale: tx("whale", "Wal"),
};

export type TreeNode = { id: string; age?: number; kids: (TreeNode | LeafId)[] };
export type TreeId = "apes" | "vertebrates" | "hoofed";

export const TREES: Record<TreeId, { title: Text; root: TreeNode }> = {
  apes: {
    title: tx("Great apes and humans", "Menschenaffen und Mensch"),
    root: { id: "a4", age: 18, kids: [{ id: "a3", age: 15, kids: [{ id: "a2", age: 9, kids: [{ id: "a1", age: 6.5, kids: ["human", "chimp"] }, "gorilla"] }, "orangutan"] }, "gibbon"] },
  },
  vertebrates: {
    title: tx("Vertebrates", "Wirbeltiere"),
    root: {
      id: "v1",
      age: 450,
      kids: ["shark", { id: "v2", age: 420, kids: ["trout", { id: "v3", age: 350, kids: ["frog", { id: "v4", age: 320, kids: ["mouse", { id: "v5", age: 280, kids: ["lizard", { id: "v6", age: 245, kids: ["croc", "bird"] }] }] }] }] }],
    },
  },
  hoofed: {
    title: tx("Hoofed animals and whales", "Paarhufer und Wale"),
    root: { id: "h1", kids: ["camel", { id: "h2", kids: ["pig", { id: "h3", kids: ["cow", { id: "h4", kids: ["hippo", "whale"] }] }] }] },
  },
};

export const isLeaf = (n: TreeNode | LeafId): n is LeafId => typeof n === "string";

/** Leaves under a node, top to bottom. */
export function leavesOf(n: TreeNode | LeafId): LeafId[] {
  return isLeaf(n) ? [n] : n.kids.flatMap(leavesOf);
}

/** All inner nodes, root first. */
export function nodesOf(n: TreeNode): TreeNode[] {
  return [n, ...n.kids.filter((k): k is TreeNode => !isLeaf(k)).flatMap(nodesOf)];
}

/** The last common ancestor of some leaves (the deepest node holding all of them). */
export function lca(root: TreeNode, leaves: LeafId[]): TreeNode {
  for (const k of root.kids) {
    if (!isLeaf(k) && leaves.every((l) => leavesOf(k).includes(l))) return lca(k, leaves);
  }
  return root;
}

/** How many branchings lie between the root and a node (more = a younger ancestor). */
export function depthOf(root: TreeNode, id: string, d = 0): number {
  if (root.id === id) return d;
  for (const k of root.kids) {
    if (isLeaf(k)) continue;
    const r = depthOf(k, id, d + 1);
    if (r >= 0) return r;
  }
  return -1;
}

/** "about 6.5 million years ago" for a node with an age. */
export function ageText(age: number): Text {
  const en = String(age);
  const de = String(age).replace(".", ",");
  return tx(`about ${en} million years ago`, `vor etwa ${de} Mio. Jahren`);
}

// ---------------------------------------------------------------------------
// The vertebrate cladogram (level 3): characters on the branches and named groups.

export type CharacterId = "jaws" | "bone" | "limbs" | "amnion" | "hair" | "window" | "feathers";

export type Character = {
  id: CharacterId;
  name: Text;
  /** The node (or leaf) whose stem carries the character: all leaves below it have it. */
  on: string;
};

export const CHARACTERS: Character[] = [
  { id: "jaws", name: tx("jaws", "Kiefer"), on: "v1" },
  { id: "bone", name: tx("bony skeleton", "Knochenskelett"), on: "v2" },
  { id: "limbs", name: tx("four limbs", "vier Gliedmaßen"), on: "v3" },
  { id: "amnion", name: tx("amniotic egg (amnion)", "Amnion (Embryonalhülle)"), on: "v4" },
  { id: "hair", name: tx("hair and mammary glands", "Haare und Milchdrüsen"), on: "mouse" },
  { id: "window", name: tx("opening in the skull in front of the eye", "Schädelöffnung vor dem Auge"), on: "v6" },
  { id: "feathers", name: tx("feathers", "Federn"), on: "bird" },
];

/** Leaves that carry a character. */
export function carriers(c: Character): LeafId[] {
  const root = TREES.vertebrates.root;
  if (c.on in LEAVES) return [c.on as LeafId];
  const node = nodesOf(root).find((n) => n.id === c.on);
  return node ? leavesOf(node) : [];
}

export type Phyly = "mono" | "para" | "poly";

export type Group = { id: string; name: Text; leaves: LeafId[]; phyly: Phyly; why: Text };

export const GROUPS: Group[] = [
  {
    id: "archosaurs",
    name: tx("crocodiles and birds (archosaurs)", "Krokodile und Vögel (Archosaurier)"),
    leaves: ["croc", "bird"],
    phyly: "mono",
    why: tx("The group holds their last common ancestor and all of its descendants.", "Die Gruppe enthält ihren letzten gemeinsamen Vorfahren und alle seine Nachfahren."),
  },
  {
    id: "amniotes",
    name: tx("amniotes", "Amnioten"),
    leaves: ["mouse", "lizard", "croc", "bird"],
    phyly: "mono",
    why: tx("All descendants of the first animal with an amnion: defined by the synapomorphy amnion.", "Alle Nachfahren des ersten Tiers mit Amnion: begründet durch die Synapomorphie Amnion."),
  },
  {
    id: "tetrapods",
    name: tx("tetrapods (land vertebrates)", "Tetrapoden (Landwirbeltiere)"),
    leaves: ["frog", "mouse", "lizard", "croc", "bird"],
    phyly: "mono",
    why: tx("All descendants of the first vertebrate with four limbs.", "Alle Nachfahren des ersten Wirbeltiers mit vier Gliedmaßen."),
  },
  {
    id: "reptiles",
    name: tx("reptiles (lizard and crocodile)", "Reptilien (Eidechse und Krokodil)"),
    leaves: ["lizard", "croc"],
    phyly: "para",
    why: tx(
      "Their last common ancestor is also the ancestor of birds, but birds are left out. Crocodiles are closer to birds than to lizards.",
      "Ihr letzter gemeinsamer Vorfahre ist auch der Vorfahre der Vögel, doch die Vögel fehlen. Krokodile sind näher mit Vögeln verwandt als mit Eidechsen.",
    ),
  },
  {
    id: "fish",
    name: tx("fish (shark and trout)", "Fische (Hai und Forelle)"),
    leaves: ["shark", "trout"],
    phyly: "para",
    why: tx("Their last common ancestor is the ancestor of all vertebrates here, but the land vertebrates are left out.", "Ihr letzter gemeinsamer Vorfahre ist der Vorfahre aller Wirbeltiere hier, doch die Landwirbeltiere fehlen."),
  },
  {
    id: "warm",
    name: tx("warm-blooded animals (mouse and bird)", "Gleichwarme (Maus und Vogel)"),
    leaves: ["mouse", "bird"],
    phyly: "poly",
    why: tx(
      "Being warm-blooded evolved twice, independently (convergence). Their last common ancestor was not warm-blooded and is not part of the group.",
      "Gleichwarm sein ist zweimal unabhängig entstanden (Konvergenz). Ihr letzter gemeinsamer Vorfahre war nicht gleichwarm und gehört nicht zur Gruppe.",
    ),
  },
];

export const PHYLY: Record<Phyly, Text> = {
  mono: tx("monophyletic", "monophyletisch"),
  para: tx("paraphyletic", "paraphyletisch"),
  poly: tx("polyphyletic", "polyphyletisch"),
};
