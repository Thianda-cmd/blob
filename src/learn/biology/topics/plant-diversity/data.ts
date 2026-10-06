// Content banks for the plant-diversity topic shared by the levels: trees and their leaves and
// fruits, conifers, early bloomers and their storage organs, plant families with features and
// examples. Facts follow German school biology (Natura, Linder, Markl).

import { resolveText, tx, type Text } from "@/i18n/text";
import type { BloomerId, OrganId } from "@/learn/biology/visuals/DiversityBloomers";
import type { FamilyId } from "@/learn/biology/visuals/DiversityFlowers";
import type { ConiferId } from "@/learn/biology/visuals/DiversityNeedles";
import type { TreeId } from "@/learn/biology/visuals/DiversityLeaves";

const E = (t: Text) => resolveText(t, "en");
const D = (t: Text) => resolveText(t, "de");

// ---------------------------------------------------------------------------
// Broadleaf trees

export const TREE_NAME: Record<TreeId, Text> = {
  oak: tx("oak", "Eiche"),
  beech: tx("beech", "Buche"),
  maple: tx("maple", "Ahorn"),
  lime: tx("lime", "Linde"),
  birch: tx("birch", "Birke"),
  chestnut: tx("horse chestnut", "Rosskastanie"),
  ash: tx("ash", "Esche"),
};
export const TREES: TreeId[] = ["oak", "beech", "maple", "lime", "birch", "chestnut", "ash"];
/** German article (nominative). */
export const TREE_ART: Record<TreeId, string> = { oak: "die", beech: "die", maple: "der", lime: "die", birch: "die", chestnut: "die", ash: "die" };
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** The trees a student most likely mixes up with this one (for distractors). */
export const TREE_CONFUSE: Record<TreeId, TreeId[]> = {
  oak: ["maple", "beech", "chestnut", "lime"],
  beech: ["lime", "birch", "oak", "ash"],
  maple: ["oak", "chestnut", "lime", "ash"],
  lime: ["birch", "beech", "maple", "oak"],
  birch: ["lime", "beech", "ash", "oak"],
  chestnut: ["maple", "ash", "oak", "beech"],
  ash: ["chestnut", "birch", "maple", "lime"],
};

/** Short leaf description (for Blob's notes). */
export const LEAF_SHORT: Record<TreeId, Text> = {
  oak: tx("round lobes and a very short stalk", "runde Lappen und einen sehr kurzen Stiel"),
  beech: tx("an oval leaf with a smooth, wavy edge", "ein eiförmiges Blatt mit glattem, gewelltem Rand"),
  maple: tx("five pointed lobes spread like a hand", "fünf spitze Lappen wie eine Hand"),
  lime: tx("a heart-shaped, saw-toothed leaf, lopsided at the base", "ein herzförmiges, gesägtes Blatt mit schiefem Grund"),
  birch: tx("a diamond-shaped, double saw-toothed leaf with a long tip", "ein rautenförmiges, doppelt gesägtes Blatt mit langer Spitze"),
  chestnut: tx("5 to 7 leaflets spread like fingers", "5 bis 7 gefingerte Teilblättchen"),
  ash: tx("many leaflets in pairs along a central stalk", "viele Fiederblättchen paarweise an einer Mittelachse"),
};

/** Blob's note when `picked` was chosen for a leaf of `right`. */
export function leafSay(right: TreeId, picked: TreeId): [Text, Text] {
  const special: Partial<Record<string, [Text, Text]>> = {
    "lime>birch": [tx("Heart or diamond?", "Herz oder Raute?"), tx("Both are saw-toothed. But a birch leaf is diamond-shaped with a long tip. Look at the base of this one: heart-shaped and lopsided.", "Beide sind gesägt. Ein Birkenblatt ist aber rautenförmig mit langer Spitze. Schau auf den Blattgrund: herzförmig und schief.")],
    "birch>lime": [tx("Heart or diamond?", "Herz oder Raute?"), tx("A lime leaf is heart-shaped with a lopsided base. This one is diamond-shaped, double saw-toothed, with a long tip.", "Ein Lindenblatt ist herzförmig mit schiefem Grund. Dieses ist rautenförmig, doppelt gesägt und lang zugespitzt.")],
    "oak>maple": [tx("Round or pointed lobes?", "Runde oder spitze Lappen?"), tx("Both are lobed. Maple lobes are pointed and spread like a hand. Here the lobes are round and the stalk is tiny.", "Beide sind gelappt. Ahornlappen sind spitz und stehen wie eine Hand. Hier sind die Lappen rund und der Stiel ist winzig.")],
    "maple>oak": [tx("Round or pointed lobes?", "Runde oder spitze Lappen?"), tx("Oak lobes are round and the leaf has hardly any stalk. Here the lobes are pointed and spread like a hand.", "Eichenlappen sind rund, das Blatt ist kaum gestielt. Hier sind die Lappen spitz und handförmig angeordnet.")],
    "chestnut>maple": [tx("Lobed or compound?", "Gelappt oder zusammengesetzt?"), tx("A maple leaf is one blade that is only cut in. Here there are separate leaflets on one stalk: a compound leaf.", "Ein Ahornblatt ist eine einzige Spreite, die nur eingeschnitten ist. Hier sitzen einzelne Teilblättchen an einem Stiel: ein zusammengesetztes Blatt.")],
    "maple>chestnut": [tx("Lobed or compound?", "Gelappt oder zusammengesetzt?"), tx("The horse chestnut has separate leaflets. This leaf hangs together in one piece, it is only lobed.", "Die Rosskastanie hat einzelne Teilblättchen. Dieses Blatt hängt zusammen, es ist nur gelappt.")],
    "chestnut>ash": [tx("Fingers or feather?", "Finger oder Feder?"), tx("In the ash the leaflets sit in pairs along a long central stalk (pinnate). Here they all start from one point like fingers.", "Bei der Esche sitzen die Fiederblättchen paarweise an einer langen Mittelachse (gefiedert). Hier gehen alle Teilblättchen von einem Punkt aus, wie Finger.")],
    "ash>chestnut": [tx("Fingers or feather?", "Finger oder Feder?"), tx("In the horse chestnut all leaflets start from one point (palmate). Here they sit in pairs along a central stalk.", "Bei der Rosskastanie gehen alle Teilblättchen von einem Punkt aus (gefingert). Hier sitzen sie paarweise an einer Mittelachse.")],
  };
  if (special[`${right}>${picked}`]) return special[`${right}>${picked}`]!;
  if (right === "beech") return [tx("Look at the edge", "Schau auf den Rand"), tx("This edge is smooth (entire), only a little wavy, without teeth. Which tree has leaves like that?", "Dieser Rand ist glatt (ganzrandig), nur leicht gewellt, ohne Zähne. Welcher Baum hat solche Blätter?")];
  return [
    tx(`That's the ${E(TREE_NAME[picked])}`, `Das wäre ${TREE_ART[picked]} ${D(TREE_NAME[picked])}`),
    tx(`A ${E(TREE_NAME[picked])} leaf has ${E(LEAF_SHORT[picked])}. Compare shape and edge with the picture.`, `${cap(TREE_ART[picked])} ${D(TREE_NAME[picked])} hat ${D(LEAF_SHORT[picked])}. Vergleich Form und Rand mit dem Bild.`),
  ];
}

export const FRUIT_NAME: Record<TreeId, Text> = {
  oak: tx("acorns in little cups", "Eicheln im Fruchtbecher"),
  beech: tx("beechnuts in a spiny husk", "Bucheckern in stacheliger Hülle"),
  maple: tx("winged fruits with two wings", "Flügelfrüchte mit zwei Flügeln"),
  lime: tx("small nuts hanging from a wing", "Nüsschen an einem Flugblatt"),
  birch: tx("tiny winged nuts from catkins", "winzige geflügelte Nüsschen aus Kätzchen"),
  chestnut: tx("shiny seeds in a spiny capsule", "glänzende Samen in stacheliger Kapsel"),
  ash: tx("bunches of nuts with one wing each", "Büschel von Nüssen mit je einem Flügel"),
};

export const FRUIT_CONFUSE: Record<TreeId, TreeId[]> = {
  oak: ["beech", "chestnut", "lime"],
  beech: ["chestnut", "oak", "birch"],
  maple: ["ash", "lime", "birch"],
  lime: ["maple", "ash", "oak"],
  birch: ["ash", "lime", "maple"],
  chestnut: ["beech", "oak", "maple"],
  ash: ["maple", "lime", "birch"],
};

export function fruitSay(right: TreeId, picked: TreeId): [Text, Text] {
  const special: Partial<Record<string, [Text, Text]>> = {
    "beech>chestnut": [tx("Two spiny husks", "Zwei stachelige Hüllen"), tx("Both have a spiny cover! But here small three-sided nuts sit in a husk that opens in four flaps: that's not a conker.", "Beide haben eine stachelige Hülle! Hier liegen aber kleine dreikantige Nüsse in einer Hülle, die sich mit vier Klappen öffnet: keine Kastanie.")],
    "chestnut>beech": [tx("Two spiny husks", "Zwei stachelige Hüllen"), tx("Beechnuts are small and three-sided. Here one big, round, shiny brown seed sits in a green spiny capsule.", "Bucheckern sind klein und dreikantig. Hier steckt ein großer, runder, glänzend brauner Samen in einer grünen stacheligen Kapsel.")],
    "maple>ash": [tx("Count the wings", "Zähl die Flügel"), tx("Ash fruits have only one wing each. Here two wings hang together like a propeller.", "Eschenfrüchte haben nur einen Flügel. Hier hängen zwei Flügel zusammen wie ein Propeller.")],
    "ash>maple": [tx("Count the wings", "Zähl die Flügel"), tx("Maple fruits come in pairs: two wings joined in the middle. Here every nut has one wing of its own.", "Ahornfrüchte hängen paarweise zusammen: zwei Flügel in der Mitte verbunden. Hier hat jede Nuss einen eigenen Flügel.")],
    "lime>maple": [tx("One wing for several nuts", "Ein Flügel für mehrere Nüsse"), tx("In the maple each nut has its own wing. Here several round nuts hang together from one pale wing.", "Beim Ahorn hat jede Nuss ihren eigenen Flügel. Hier hängen mehrere runde Nüsschen gemeinsam an einem hellen Flugblatt.")],
    "maple>lime": [tx("Own wing or shared wing?", "Eigener oder gemeinsamer Flügel?"), tx("Lime nuts share one pale wing. Here two nuts each have their own wing and stick together.", "Lindennüsschen hängen gemeinsam an einem hellen Flugblatt. Hier hat jede der zwei Nüsse ihren eigenen Flügel.")],
    "oak>beech": [tx("Cup or husk?", "Becher oder Hülle?"), tx("Beechnuts sit in a spiny husk. Here a smooth nut sits in a little scaly cup.", "Bucheckern stecken in einer stacheligen Hülle. Hier sitzt eine glatte Nuss in einem schuppigen Becher.")],
  };
  if (special[`${right}>${picked}`]) return special[`${right}>${picked}`]!;
  return [
    tx("Another fruit", "Eine andere Frucht"),
    tx(`The ${E(TREE_NAME[picked])} has ${E(FRUIT_NAME[picked])}. Does that match the picture?`, `${cap(TREE_ART[picked])} ${D(TREE_NAME[picked])} hat ${D(FRUIT_NAME[picked])}. Passt das zum Bild?`),
  ];
}

// ---------------------------------------------------------------------------
// Conifers

export const CONIFER_NAME: Record<ConiferId, Text> = {
  spruce: tx("spruce", "Fichte"),
  fir: tx("fir", "Tanne"),
  pine: tx("pine", "Kiefer"),
  larch: tx("larch", "Lärche"),
  yew: tx("yew", "Eibe"),
};
export const CONIFERS: ConiferId[] = ["spruce", "fir", "pine", "larch", "yew"];

export const CONIFER_CLUES: Record<ConiferId, Text[]> = {
  spruce: [
    tx("The needles are pointed and prick.", "Die Nadeln sind spitz und stechen."),
    tx("The needles grow singly all round the twig.", "Die Nadeln stehen einzeln rundum am Zweig."),
    tx("The cones hang down.", "Die Zapfen hängen nach unten."),
    tx("Each needle sits on a tiny peg; without needles the twig feels rough.", "Jede Nadel sitzt auf einem kleinen Stielchen; ohne Nadeln ist der Zweig rau."),
  ],
  fir: [
    tx("The needles are flat and soft and don't prick.", "Die Nadeln sind flach und weich und stechen nicht."),
    tx("Each needle has two white stripes underneath.", "Unter jeder Nadel verlaufen zwei weiße Streifen."),
    tx("The cones stand upright on the twigs.", "Die Zapfen stehen aufrecht auf den Zweigen."),
    tx("The tips of the needles are slightly notched.", "Die Nadeln sind vorne leicht eingekerbt."),
  ],
  pine: [
    tx("The needles always grow in pairs.", "Die Nadeln stehen immer zu zweit."),
    tx("The needles are long, 4 to 7 cm.", "Die Nadeln sind lang, 4 bis 7 cm."),
    tx("High up, the bark of the trunk is orange-red.", "Die Rinde oben am Stamm ist fuchsrot."),
    tx("The cones are small, egg-shaped and woody.", "Die Zapfen sind klein, eiförmig und holzig."),
  ],
  larch: [
    tx("The needles are soft and grow in tufts.", "Die Nadeln sind weich und stehen in Büscheln."),
    tx("In autumn the needles turn golden and fall off.", "Im Herbst werden die Nadeln goldgelb und fallen ab."),
    tx("In winter the tree is bare.", "Im Winter ist der Baum kahl."),
    tx("Small upright cones stay on the twig for years.", "Kleine aufrechte Zapfen bleiben jahrelang am Zweig."),
  ],
  yew: [
    tx("The needles are flat and dark green, pale green underneath without white stripes.", "Die Nadeln sind flach und dunkelgrün, unten hellgrün ohne weiße Streifen."),
    tx("Instead of cones it carries red, fleshy seed cups.", "Statt Zapfen trägt der Baum rote, fleischige Samenmäntel."),
    tx("Almost all parts are very poisonous.", "Fast alle Teile sind sehr giftig."),
  ],
};

export const CONIFER_CONFUSE: Record<ConiferId, ConiferId[]> = {
  spruce: ["fir", "pine", "yew", "larch"],
  fir: ["spruce", "yew", "larch", "pine"],
  pine: ["larch", "spruce", "fir", "yew"],
  larch: ["pine", "spruce", "fir", "yew"],
  yew: ["fir", "spruce", "pine", "larch"],
};

export function coniferSay(right: ConiferId, picked: ConiferId): [Text, Text] {
  const fs: [Text, Text] = [tx("Spruce stings, fir is kind", "Die Fichte sticht, die Tanne nicht"), tx("Spruce or fir? Spruce needles prick and the cones hang down. Fir needles are soft with two white stripes, and the cones stand upright.", "Fichte oder Tanne? Fichtennadeln stechen, die Zapfen hängen. Tannennadeln sind weich mit zwei weißen Streifen, die Zapfen stehen aufrecht.")];
  const special: Partial<Record<string, [Text, Text]>> = {
    "spruce>fir": fs,
    "fir>spruce": fs,
    "fir>yew": [tx("Look for the stripes", "Such die Streifen"), tx("Both have flat needles in two rows. But only the fir has two white stripes underneath and real cones.", "Beide haben flache Nadeln in zwei Reihen. Aber nur die Tanne hat unten zwei weiße Streifen und echte Zapfen.")],
    "yew>fir": [tx("Cones or red cups?", "Zapfen oder rote Becher?"), tx("The fir has two white stripes under its needles and cones. This tree has red seed cups instead of cones.", "Die Tanne hat zwei weiße Streifen unter den Nadeln und Zapfen. Dieser Baum hat rote Samenmäntel statt Zapfen.")],
    "pine>larch": [tx("Two or many?", "Zwei oder viele?"), tx("The larch has tufts of many soft needles. Exactly two needles together: that's only one tree.", "Die Lärche hat Büschel aus vielen weichen Nadeln. Genau zwei Nadeln zusammen gibt es nur bei einem Baum.")],
    "larch>pine": [tx("Two or many?", "Zwei oder viele?"), tx("The pine always has exactly two needles together and stays green in winter. Here many soft needles form a tuft.", "Die Kiefer hat immer genau zwei Nadeln zusammen und bleibt im Winter grün. Hier bilden viele weiche Nadeln ein Büschel.")],
  };
  if (special[`${right}>${picked}`]) return special[`${right}>${picked}`]!;
  if (right === "larch") return [tx("Not evergreen", "Nicht immergrün"), tx(`The ${E(CONIFER_NAME[picked])} stays green in winter. Only one native conifer drops its needles in autumn.`, `Die ${D(CONIFER_NAME[picked])} bleibt im Winter grün. Nur ein heimischer Nadelbaum wirft im Herbst seine Nadeln ab.`)];
  return [
    tx("Check the needles", "Prüf die Nadeln"),
    tx(`Typical ${E(CONIFER_NAME[picked])}: ${E(CONIFER_CLUES[picked][0])} Does that fit?`, `Typisch ${D(CONIFER_NAME[picked])}: ${D(CONIFER_CLUES[picked][0])} Passt das?`),
  ];
}

// ---------------------------------------------------------------------------
// Early bloomers

export type Bloomer = { name: Text; art: "der" | "die" | "das"; organ: OrganId; pic?: BloomerId };

export const BLOOMERS: Bloomer[] = [
  { name: tx("tulip", "Tulpe"), art: "die", organ: "bulb", pic: "tulip" },
  { name: tx("snowdrop", "Schneeglöckchen"), art: "das", organ: "bulb", pic: "snowdrop" },
  { name: tx("spring snowflake", "Märzenbecher"), art: "der", organ: "bulb" },
  { name: tx("daffodil", "Osterglocke (Narzisse)"), art: "die", organ: "bulb" },
  { name: tx("wild garlic", "Bärlauch"), art: "der", organ: "bulb" },
  { name: tx("hyacinth", "Hyazinthe"), art: "die", organ: "bulb" },
  { name: tx("squill", "Blaustern"), art: "der", organ: "bulb" },
  { name: tx("crocus", "Krokus"), art: "der", organ: "corm", pic: "crocus" },
  { name: tx("wood anemone", "Buschwindröschen"), art: "das", organ: "rhizome", pic: "anemone" },
  { name: tx("yellow anemone", "Gelbes Windröschen"), art: "das", organ: "rhizome" },
  { name: tx("liverleaf (hepatica)", "Leberblümchen"), art: "das", organ: "rhizome" },
  { name: tx("lily of the valley", "Maiglöckchen"), art: "das", organ: "rhizome" },
  { name: tx("lungwort", "Lungenkraut"), art: "das", organ: "rhizome" },
  { name: tx("lesser celandine", "Scharbockskraut"), art: "das", organ: "roottuber", pic: "celandine" },
];

export const ORGAN_SHORT: Record<OrganId, Text> = {
  bulb: tx("bulb", "Zwiebel"),
  corm: tx("corm (stem tuber)", "Sprossknolle"),
  rhizome: tx("rhizome (underground stem)", "Erdspross (Rhizom)"),
  roottuber: tx("root tubers", "Wurzelknollen"),
};

/** "das Buschwindröschen" / "the wood anemone" */
export const bloomerThe = (b: Bloomer): Text => tx(`the ${E(b.name)}`, `${b.art} ${D(b.name)}`);
const ORGAN_A: Record<OrganId, Text> = { bulb: tx("a bulb", "eine Zwiebel"), corm: tx("a corm", "eine Sprossknolle"), rhizome: tx("a rhizome", "ein Erdspross"), roottuber: tx("root tubers", "Wurzelknollen") };

export function organSay(right: OrganId, picked: OrganId, b: Bloomer): [Text, Text] {
  const the = bloomerThe(b);
  const p = { en: E(the), de: D(the) };
  const special: Partial<Record<string, [Text, Text]>> = {
    "corm>bulb": [tx("Looks like a bulb", "Sieht aus wie eine Zwiebel"), tx("The crocus looks as if it had a bulb. Cut it open: it is solid inside, without layers. That's a thickened stem.", "Der Krokus sieht aus, als hätte er eine Zwiebel. Schneid sie auf: Innen ist sie fest, ohne Schichten. Das ist eine verdickte Sprossachse.")],
    "bulb>corm": [tx("Layers inside", "Schichten innen"), tx(`A tuber is solid inside. But ${p.en} stores food in layers of thick leaves round a very short stem.`, `Eine Knolle ist innen fest. ${cap(p.de)} speichert aber in Schichten aus dicken Blättern um eine gestauchte Sprossachse.`)],
    "rhizome>roottuber": [tx("A stem, not a root", "Ein Spross, keine Wurzel"), tx("The storage organ grows sideways in the soil and carries buds. Roots never have buds: it is an underground stem.", "Das Speicherorgan wächst waagerecht im Boden und trägt Knospen. Wurzeln haben nie Knospen: Es ist ein unterirdischer Spross.")],
    "roottuber>corm": [tx("Thick roots", "Dicke Wurzeln"), tx("In the lesser celandine the little clubs are thickened roots, not a piece of stem.", "Beim Scharbockskraut sind die kleinen Keulen verdickte Wurzeln, kein Stück Sprossachse.")],
    "roottuber>rhizome": [tx("Thick roots", "Dicke Wurzeln"), tx("A rhizome is a sideways stem with buds. The lesser celandine stores food in thickened roots shaped like clubs.", "Ein Erdspross ist ein waagerechter Spross mit Knospen. Das Scharbockskraut speichert in keulenförmig verdickten Wurzeln.")],
    "rhizome>bulb": [tx("No layers", "Keine Schichten"), tx(`A bulb has layers of storage leaves. But ${p.en} has a long, thin stem lying sideways in the soil.`, `Eine Zwiebel hat Schichten aus Speicherblättern. ${cap(p.de)} hat dagegen einen langen, dünnen Spross, der waagerecht im Boden liegt.`)],
  };
  return (
    special[`${right}>${picked}`] ?? [
      tx("Another storage organ", "Ein anderes Speicherorgan"),
      tx(`That would be ${E(ORGAN_A[picked])}. Think about what ${p.en} has in the soil: layers, a solid tuber, a sideways stem or thick roots?`, `Das wäre ${D(ORGAN_A[picked])}. Überleg, was ${p.de} im Boden hat: Schichten, eine feste Knolle, einen waagerechten Spross oder dicke Wurzeln?`),
    ]
  );
}

// ---------------------------------------------------------------------------
// Plant families

export type FamilyAll = FamilyId | "liliaceae";

export const FAMILY_SHORT: Record<FamilyAll, Text> = {
  brassicaceae: tx("crucifers (cabbage family)", "Kreuzblütler"),
  lamiaceae: tx("mint family", "Lippenblütler"),
  fabaceae: tx("pea family (papilionaceous)", "Schmetterlingsblütler"),
  rosaceae: tx("rose family", "Rosengewächse"),
  asteraceae: tx("daisy family (composites)", "Korbblütler"),
  poaceae: tx("grass family", "Süßgräser"),
  liliaceae: tx("lily family", "Liliengewächse"),
};

/** What gives a family away, in a few words. */
export const FAMILY_SIGN: Record<FamilyAll, Text> = {
  brassicaceae: tx("4 petals in a cross, 6 stamens (4 long, 2 short), a silique", "4 Kronblätter über Kreuz, 6 Staubblätter (4 lange, 2 kurze), Schote"),
  lamiaceae: tx("upper and lower lip, square stem, opposite leaves", "Ober- und Unterlippe, vierkantiger Stängel, gegenständige Blätter"),
  fabaceae: tx("standard, wings and keel, a legume", "Fahne, Flügel und Schiffchen, Hülse"),
  rosaceae: tx("5 free petals and many stamens", "5 freie Kronblätter und viele Staubblätter"),
  asteraceae: tx("many tiny florets in one head", "viele kleine Blüten in einem Körbchen"),
  poaceae: tx("plain flowers in spikelets, hollow stalk with nodes", "unscheinbare Blüten in Ährchen, hohler Halm mit Knoten"),
  liliaceae: tx("6 equal tepals, everything in threes", "6 gleiche Blütenhüllblätter, alles dreizählig"),
};

export const FAMILIES: FamilyId[] = ["brassicaceae", "lamiaceae", "fabaceae", "rosaceae", "asteraceae", "poaceae"];

/** Features; the first `key` ones each give the family away on their own. */
export const FAMILY_FEATURES: Record<FamilyId, { key: number; list: Text[] }> = {
  brassicaceae: {
    key: 3,
    list: [
      tx("4 petals that form a cross", "4 Kronblätter, die ein Kreuz bilden"),
      tx("6 stamens: 4 long and 2 short", "6 Staubblätter: 4 lange und 2 kurze"),
      tx("fruit: a silique (pod with a partition)", "Frucht: eine Schote mit Scheidewand"),
      tx("4 sepals", "4 Kelchblätter"),
      tx("flowers often yellow or white", "Blüten oft gelb oder weiß"),
      tx("leaves often taste sharp (mustard oils)", "Blätter schmecken oft scharf (Senföle)"),
    ],
  },
  lamiaceae: {
    key: 3,
    list: [
      tx("flower with an upper and a lower lip", "Blüte mit Ober- und Unterlippe"),
      tx("square stem", "vierkantiger Stängel"),
      tx("fruit splits into 4 little nuts", "Frucht zerfällt in 4 Nüsschen"),
      tx("leaves opposite, each pair crossing the next", "Blätter kreuzgegenständig"),
      tx("4 stamens under the upper lip", "4 Staubblätter unter der Oberlippe"),
      tx("often fragrant (essential oils)", "oft duftend durch ätherische Öle"),
    ],
  },
  fabaceae: {
    key: 3,
    list: [
      tx("flower with standard, two wings and a keel", "Blüte mit Fahne, zwei Flügeln und Schiffchen"),
      tx("fruit: a legume (pod without a partition)", "Frucht: eine Hülse ohne Scheidewand"),
      tx("10 stamens, 9 of them fused into a tube", "10 Staubblätter, 9 davon zu einer Röhre verwachsen"),
      tx("root nodules with nitrogen-fixing bacteria", "Wurzelknöllchen mit stickstoffbindenden Bakterien"),
      tx("leaves often pinnate, some with tendrils", "Blätter oft gefiedert, manche mit Ranken"),
    ],
  },
  rosaceae: {
    key: 2,
    list: [
      tx("5 free petals and many stamens", "5 freie Kronblätter und viele Staubblätter"),
      tx("fruits: stone fruits, pomes or aggregate fruits", "Früchte: Steinfrüchte, Apfelfrüchte oder Sammelfrüchte"),
      tx("5 sepals", "5 Kelchblätter"),
      tx("leaves often with stipules", "Blätter oft mit Nebenblättern"),
      tx("radial flowers, often white or pink", "radiäre Blüten, oft weiß oder rosa"),
    ],
  },
  asteraceae: {
    key: 3,
    list: [
      tx("many tiny flowers packed into one head", "viele kleine Blüten in einem Körbchen"),
      tx("ray florets at the edge, disc florets in the middle", "Zungenblüten am Rand, Röhrenblüten in der Mitte"),
      tx("fruits often with a parachute of hairs (pappus)", "Früchte oft mit Haarschirm (Pappus)"),
      tx("green bracts surround the head", "grüne Hüllblätter umgeben das Körbchen"),
      tx("the head looks like a single flower", "das Körbchen sieht aus wie eine einzige Blüte"),
    ],
  },
  poaceae: {
    key: 2,
    list: [
      tx("stem: a hollow stalk with nodes", "Stängel: ein hohler Halm mit Knoten"),
      tx("plain flowers in spikelets, husks instead of petals", "unscheinbare Blüten in Ährchen, Spelzen statt Kronblättern"),
      tx("long, narrow leaves with parallel veins and a leaf sheath", "lange, schmale, parallelnervige Blätter mit Blattscheide"),
      tx("wind-pollinated: stamens hang out of the flowers", "windbestäubt: Staubblätter hängen heraus"),
      tx("fruit: a grain", "Frucht: ein Korn"),
    ],
  },
};

export const FAMILY_CONFUSE: Record<FamilyId, FamilyId[]> = {
  brassicaceae: ["rosaceae", "fabaceae", "asteraceae", "lamiaceae"],
  lamiaceae: ["fabaceae", "brassicaceae", "rosaceae", "asteraceae"],
  fabaceae: ["lamiaceae", "brassicaceae", "rosaceae", "asteraceae"],
  rosaceae: ["brassicaceae", "asteraceae", "fabaceae", "lamiaceae"],
  asteraceae: ["rosaceae", "fabaceae", "brassicaceae", "poaceae"],
  poaceae: ["asteraceae", "brassicaceae", "lamiaceae", "rosaceae"],
};

/** Blob's note when family `picked` was chosen instead of `right`. */
export function familySay(right: FamilyAll, picked: FamilyAll): [Text, Text] {
  const lipsVsPea: [Text, Text] = [
    tx("Two zygomorphic flowers", "Zwei zygomorphe Blüten"),
    tx("Both flowers have only one plane of symmetry. A pea flower has standard, wings and keel and makes a legume; a mint flower has two lips and a square stem.", "Beide Blüten haben nur eine Symmetrieebene. Die Schmetterlingsblüte hat Fahne, Flügel und Schiffchen und bildet eine Hülse; die Lippenblüte hat zwei Lippen und einen vierkantigen Stängel."),
  ];
  if ((right === "lamiaceae" && picked === "fabaceae") || (right === "fabaceae" && picked === "lamiaceae")) return lipsVsPea;
  const r = { en: E(FAMILY_SHORT[picked]), de: D(FAMILY_SHORT[picked]) };
  const s = { en: E(FAMILY_SIGN[picked]), de: D(FAMILY_SIGN[picked]) };
  return [tx(`Not the ${r.en}`, `Keine ${r.de}`), tx(`Typical ${r.en}: ${s.en}. Does that really fit? Look at the flower and the fruit once more.`, `Typisch ${r.de}: ${s.de}. Passt das wirklich? Schau dir Blüte und Frucht noch mal an.`)];
}

export type PlantExample = { name: Text; family: FamilyId; trap?: { family: FamilyId; title: Text; say: Text } };

export const PLANT_EXAMPLES: PlantExample[] = [
  { name: tx("oilseed rape", "Raps"), family: "brassicaceae" },
  { name: tx("mustard", "Senf"), family: "brassicaceae" },
  { name: tx("broccoli", "Brokkoli"), family: "brassicaceae", trap: { family: "asteraceae", title: tx("A head of buds", "Ein Kopf aus Knospen"), say: tx("Broccoli is a bunch of flower buds of the cabbage. Let it bloom and you see yellow flowers with four petals in a cross.", "Brokkoli sind Blütenknospen des Kohls. Lässt du ihn blühen, siehst du gelbe Blüten mit vier Kronblättern über Kreuz.") } },
  { name: tx("radish", "Radieschen"), family: "brassicaceae" },
  { name: tx("shepherd's purse", "Hirtentäschel"), family: "brassicaceae" },
  { name: tx("cuckooflower", "Wiesenschaumkraut"), family: "brassicaceae" },
  { name: tx("garden cress", "Gartenkresse"), family: "brassicaceae" },
  { name: tx("white dead-nettle", "Weiße Taubnessel"), family: "lamiaceae", trap: { family: "rosaceae", title: tx("Not a nettle", "Keine Brennnessel"), say: tx("The dead-nettle looks like a stinging nettle but doesn't sting. Its flower has an upper and a lower lip, its stem is square.", "Die Taubnessel sieht aus wie eine Brennnessel, brennt aber nicht. Ihre Blüte hat Ober- und Unterlippe, der Stängel ist vierkantig.") } },
  { name: tx("sage", "Salbei"), family: "lamiaceae" },
  { name: tx("peppermint", "Pfefferminze"), family: "lamiaceae" },
  { name: tx("thyme", "Thymian"), family: "lamiaceae" },
  { name: tx("lavender", "Lavendel"), family: "lamiaceae" },
  { name: tx("basil", "Basilikum"), family: "lamiaceae" },
  { name: tx("rosemary", "Rosmarin"), family: "lamiaceae" },
  { name: tx("pea", "Erbse"), family: "fabaceae" },
  { name: tx("runner bean", "Gartenbohne"), family: "fabaceae" },
  { name: tx("lentil", "Linse"), family: "fabaceae" },
  { name: tx("soya", "Sojabohne"), family: "fabaceae" },
  { name: tx("peanut", "Erdnuss"), family: "fabaceae", trap: { family: "rosaceae", title: tx("Not a real nut", "Keine echte Nuss"), say: tx("The peanut isn't a nut at all: it is a legume whose pods ripen in the soil.", "Die Erdnuss ist gar keine Nuss: Sie ist ein Hülsenfrüchtler, dessen Hülsen im Boden reifen.") } },
  { name: tx("red clover", "Rotklee"), family: "fabaceae", trap: { family: "asteraceae", title: tx("Not a composite head", "Kein Körbchen"), say: tx("A clover head looks like a composite flower head. Pull it apart: it is made of many small pea flowers with standard, wings and keel.", "Ein Kleeköpfchen sieht aus wie ein Körbchen. Zupf es auseinander: Es besteht aus vielen kleinen Schmetterlingsblüten mit Fahne, Flügeln und Schiffchen.") } },
  { name: tx("white clover", "Weißklee"), family: "fabaceae", trap: { family: "asteraceae", title: tx("Not a composite head", "Kein Körbchen"), say: tx("A clover head looks like a composite flower head. Pull it apart: it is made of many small pea flowers with standard, wings and keel.", "Ein Kleeköpfchen sieht aus wie ein Körbchen. Zupf es auseinander: Es besteht aus vielen kleinen Schmetterlingsblüten mit Fahne, Flügeln und Schiffchen.") } },
  { name: tx("lupin", "Lupine"), family: "fabaceae" },
  { name: tx("black locust (robinia)", "Robinie"), family: "fabaceae" },
  { name: tx("dog rose", "Hundsrose"), family: "rosaceae" },
  { name: tx("apple", "Apfel"), family: "rosaceae", trap: { family: "brassicaceae", title: tx("A surprise relative", "Überraschende Verwandtschaft"), say: tx("Apple, cherry and strawberry belong to the rose family. Look at an apple blossom: 5 petals and many stamens.", "Apfel, Kirsche und Erdbeere gehören zu den Rosengewächsen. Schau dir eine Apfelblüte an: 5 Kronblätter und viele Staubblätter.") } },
  { name: tx("cherry", "Kirsche"), family: "rosaceae" },
  { name: tx("plum", "Pflaume"), family: "rosaceae" },
  { name: tx("strawberry", "Erdbeere"), family: "rosaceae", trap: { family: "asteraceae", title: tx("A surprise relative", "Überraschende Verwandtschaft"), say: tx("A strawberry flower has 5 white petals and many stamens: typical of the rose family.", "Eine Erdbeerblüte hat 5 weiße Kronblätter und viele Staubblätter: typisch Rosengewächs.") } },
  { name: tx("raspberry", "Himbeere"), family: "rosaceae" },
  { name: tx("blackberry", "Brombeere"), family: "rosaceae" },
  { name: tx("hawthorn", "Weißdorn"), family: "rosaceae" },
  { name: tx("dandelion", "Löwenzahn"), family: "asteraceae", trap: { family: "rosaceae", title: tx("Not one flower", "Nicht eine Blüte"), say: tx("The yellow \"flower\" is a head of more than 100 ray florets. The dandelion clock shows the fruits with their parachutes.", "Die gelbe „Blüte“ ist ein Körbchen aus über 100 Zungenblüten. Die Pusteblume zeigt die Früchte mit ihren Haarschirmen.") } },
  { name: tx("daisy", "Gänseblümchen"), family: "asteraceae" },
  { name: tx("sunflower", "Sonnenblume"), family: "asteraceae", trap: { family: "rosaceae", title: tx("Not one flower", "Nicht eine Blüte"), say: tx("A sunflower is a head of hundreds of florets: the yellow ray florets at the edge and the disc florets in the middle, each giving a seed.", "Eine Sonnenblume ist ein Körbchen aus Hunderten Blüten: gelbe Zungenblüten am Rand und Röhrenblüten in der Mitte, aus jeder wird ein Kern.") } },
  { name: tx("chamomile", "Kamille"), family: "asteraceae" },
  { name: tx("oxeye daisy", "Margerite"), family: "asteraceae" },
  { name: tx("cornflower", "Kornblume"), family: "asteraceae" },
  { name: tx("marigold", "Ringelblume"), family: "asteraceae" },
  { name: tx("coltsfoot", "Huflattich"), family: "asteraceae" },
  { name: tx("wheat", "Weizen"), family: "poaceae" },
  { name: tx("rye", "Roggen"), family: "poaceae" },
  { name: tx("barley", "Gerste"), family: "poaceae" },
  { name: tx("oats", "Hafer"), family: "poaceae" },
  { name: tx("maize", "Mais"), family: "poaceae", trap: { family: "asteraceae", title: tx("Maize is a grass", "Mais ist ein Gras"), say: tx("Maize is a giant grass: a stalk with nodes, leaves with a leaf sheath, wind-pollinated flowers.", "Mais ist ein Riesengras: ein Halm mit Knoten, Blätter mit Blattscheide, windbestäubte Blüten.") } },
  { name: tx("rice", "Reis"), family: "poaceae" },
  { name: tx("bamboo", "Bambus"), family: "poaceae", trap: { family: "rosaceae", title: tx("A woody grass", "Ein verholztes Gras"), say: tx("Bamboo is a grass with a woody stalk: hollow between the nodes, like a giant blade of grass.", "Bambus ist ein Gras mit verholztem Halm: zwischen den Knoten hohl, wie ein riesiger Grashalm.") } },
];

export const FAMILY_FRUIT: Record<FamilyId, Text> = {
  brassicaceae: tx("silique (pod with a partition)", "Schote"),
  fabaceae: tx("legume (pod without a partition)", "Hülse"),
  lamiaceae: tx("four little nuts", "Klausenfrucht (4 Nüsschen)"),
  asteraceae: tx("achene, often with a parachute of hairs", "Achäne, oft mit Haarschirm"),
  poaceae: tx("grain (caryopsis)", "Korn (Karyopse)"),
  rosaceae: tx("stone fruit, pome or aggregate fruit", "Steinfrucht, Apfelfrucht oder Sammelfrucht"),
};
