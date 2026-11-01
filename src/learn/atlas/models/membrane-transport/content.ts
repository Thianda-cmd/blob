import { tx } from "@/i18n/text";
import type { ModelContent, PartsContent } from "../../types";

/** Transport across membranes: passive, active and in vesicles. Outside is at the top. */

export const PASSIVE = {
  kind: "parts",
  title: tx("Passive", "Passiv"),
  intro: tx(
    "Passive transport always runs downhill, from high to low concentration, and needs no energy from the cell. Outside is at the top, the cell inside at the bottom.",
    "Passiver Transport läuft immer bergab, von hoher zu niedriger Konzentration, und braucht keine Energie der Zelle. Außen ist oben, das Zellinnere unten.",
  ),
  parts: {
    gradient: {
      name: tx("Concentration gradient", "Konzentrationsgefälle"),
      aka: tx("for ions: electrochemical gradient", "bei Ionen: elektrochemischer Gradient"),
      role: tx("The difference in concentration between outside and inside. It drives passive transport: particles move downhill until both sides are equal.", "Der Konzentrationsunterschied zwischen außen und innen. Er treibt den passiven Transport an: Teilchen bewegen sich bergab, bis beide Seiten gleich sind."),
      facts: [tx("For ions the charge counts too: membrane potential and concentration together make the electrochemical gradient.", "Bei Ionen zählt auch die Ladung: Membranspannung und Konzentration ergeben zusammen den elektrochemischen Gradienten.")],
      clue: tx("drives passive transport", "den passiven Transport antreibt"),
    },
    bilayer: {
      name: tx("Lipid bilayer", "Lipid-Doppelschicht"),
      aka: tx("phospholipids", "Phospholipide"),
      role: tx("The barrier: water-loving heads outside, water-repelling fatty tails inside. That is why ions and polar molecules only get through proteins.", "Die Barriere: wasserliebende Köpfe außen, wasserabweisende Fettsäureschwänze innen. Darum kommen Ionen und polare Moleküle nur über Proteine hindurch."),
      facts: [tx("Selectively permeable: lets some substances through, others not.", "Selektiv permeabel: lässt manche Stoffe durch, andere nicht.")],
      clue: tx("stops ions because its inside repels water", "Ionen aufhält, weil ihr Inneres wasserabweisend ist"),
    },
    diffusion: {
      name: tx("Simple diffusion", "Einfache Diffusion"),
      aka: tx("through the lipid bilayer", "durch die Lipid-Doppelschicht"),
      tag: tx("passive, no protein", "passiv, ohne Protein"),
      role: tx("Small, non-polar molecules such as O₂, CO₂ and N₂ (and small fat-soluble ones) pass straight through the lipid bilayer, from high to low concentration.", "Kleine, unpolare Moleküle wie O₂, CO₂ und N₂ (und kleine fettlösliche) gehen direkt durch die Lipid-Doppelschicht, von hoher zu niedriger Konzentration."),
      facts: [
        tx("No energy, no protein.", "Keine Energie, kein Protein."),
        tx("The rate rises in proportion to the concentration difference (Fick's law): no saturation.", "Die Rate steigt proportional zum Konzentrationsunterschied (Ficksches Gesetz): keine Sättigung."),
        tx("Also ethanol and steroid hormones. Ions and glucose can't get through this way.", "Auch Ethanol und Steroidhormone. Ionen und Glucose kommen so nicht durch."),
      ],
      tip: tx("Diffusion runs by itself until the concentrations are equal.", "Diffusion läuft von selbst, bis die Konzentrationen ausgeglichen sind."),
      clue: tx("lets O₂ and CO₂ straight through the lipid layer", "O₂ und CO₂ direkt durch die Lipidschicht lässt"),
    },
    osmosis: {
      name: tx("Osmosis (aquaporin)", "Osmose (Aquaporin)"),
      aka: tx("water channels", "Wasserkanäle"),
      tag: tx("only water", "nur Wasser"),
      role: tx("Water moves across a selectively permeable membrane towards the side with more dissolved particles. Aquaporins are channels only for water.", "Wasser wandert durch eine selektiv permeable Membran zu der Seite mit mehr gelösten Teilchen. Aquaporine sind Kanäle nur für Wasser."),
      facts: [
        tx("Hypotonic surroundings: water flows in (red blood cells burst: haemolysis). Hypertonic: water flows out (cells shrink; plants plasmolyse).", "Hypotone Umgebung: Wasser strömt hinein (rote Blutzellen platzen: Hämolyse). Hypertone: Wasser strömt hinaus (Zellen schrumpfen; Pflanzen: Plasmolyse)."),
        tx("Isotonic for our cells: 0.9 % saline.", "Isoton für unsere Zellen: 0,9-prozentige Kochsalzlösung."),
        tx("Peter Agre discovered aquaporins (Nobel Prize 2003).", "Peter Agre entdeckte die Aquaporine (Nobelpreis 2003)."),
      ],
      clue: tx("lets only water through the membrane", "nur Wasser durch die Membran lässt"),
    },
    channel: {
      name: tx("Channel protein", "Kanalprotein"),
      aka: tx("facilitated diffusion, ion channel", "erleichterte Diffusion, Ionenkanal"),
      tag: tx("passive, with protein", "passiv, mit Protein"),
      role: tx("A protein with a water-filled pore through which certain ions flow very fast. Many can open and close (gated channels).", "Ein Protein mit einer wassergefüllten Pore, durch die bestimmte Ionen sehr schnell strömen. Viele können sich öffnen und schließen (gesteuerte Kanäle)."),
      facts: [
        tx("Voltage-gated (Na⁺ channels in the action potential) or ligand-gated (acetylcholine receptor).", "Spannungsgesteuert (Na⁺-Kanäle beim Aktionspotenzial) oder ligandengesteuert (Acetylcholin-Rezeptor)."),
        tx("Very fast: up to about 100 million ions per second.", "Sehr schnell: bis zu etwa 100 Millionen Ionen pro Sekunde."),
        tx("Selective: K⁺ channels let hardly any Na⁺ through.", "Selektiv: K⁺-Kanäle lassen kaum Na⁺ durch."),
      ],
      clue: tx("lets ions flow through a pore and can open and close", "Ionen durch eine Pore strömen lässt und sich öffnen und schließen kann"),
    },
    carrier: {
      name: tx("Carrier", "Carrier"),
      aka: tx("transporter, e.g. GLUT for glucose", "Transporter, z. B. GLUT für Glucose"),
      tag: tx("passive, with protein", "passiv, mit Protein"),
      role: tx("Binds one particular molecule, changes its shape and releases it on the other side. Passive when it works downhill, like GLUT carrying glucose into the cell.", "Bindet ein bestimmtes Molekül, ändert seine Form und gibt es auf der anderen Seite frei. Passiv, wenn er bergab arbeitet, wie GLUT, der Glucose in die Zelle bringt."),
      facts: [
        tx("Saturable: once every carrier is busy, the rate rises no further (like an enzyme, Michaelis-Menten).", "Sättigbar: Sind alle Carrier besetzt, steigt die Rate nicht weiter (wie bei einem Enzym, Michaelis-Menten)."),
        tx("Very specific, like a key and its lock.", "Sehr spezifisch, wie Schlüssel und Schloss."),
        tx("One substance in one direction: uniport.", "Ein Stoff in eine Richtung: Uniport."),
      ],
      tip: tx("Channel: an open tunnel, fast. Carrier: a revolving door, slower and saturable.", "Kanal: ein offener Tunnel, schnell. Carrier: eine Drehtür, langsamer und sättigbar."),
      clue: tx("changes its shape to move a molecule across", "seine Form ändert, um ein Molekül hinüberzubringen"),
    },
  },
  questions: [
    {
      q: tx("Which substances diffuse freely through the lipid bilayer?", "Welche Stoffe diffundieren frei durch die Lipid-Doppelschicht?"),
      options: [tx("Small, non-polar ones such as O₂ and CO₂", "Kleine, unpolare wie O₂ und CO₂"), tx("Ions such as Na⁺", "Ionen wie Na⁺"), tx("Glucose", "Glucose"), tx("Proteins", "Proteine")],
      correct: 0,
    },
    {
      q: tx("What sets carriers apart from channels?", "Was unterscheidet Carrier von Kanalproteinen?"),
      options: [
        tx("They bind the substance, change shape and can be saturated", "Sie binden den Stoff, ändern ihre Form und sind sättigbar"),
        tx("They always use ATP", "Sie brauchen immer ATP"),
        tx("They are faster", "Sie sind schneller"),
        tx("They only carry water", "Sie transportieren nur Wasser"),
      ],
      correct: 0,
    },
    {
      q: tx("A red blood cell is put into distilled water. What happens?", "Eine rote Blutzelle kommt in destilliertes Wasser. Was passiert?"),
      options: [tx("It takes up water and bursts", "Sie nimmt Wasser auf und platzt"), tx("It shrinks", "Sie schrumpft"), tx("Nothing", "Nichts"), tx("It divides", "Sie teilt sich")],
      correct: 0,
      why: tx("Distilled water is hypotonic: water flows in by osmosis until the cell bursts (haemolysis).", "Destilliertes Wasser ist hypoton: Wasser strömt osmotisch ein, bis die Zelle platzt (Hämolyse)."),
    },
    {
      q: tx("Does facilitated diffusion need energy?", "Braucht erleichterte Diffusion Energie?"),
      options: [tx("No, it follows the gradient", "Nein, sie folgt dem Gefälle"), tx("Yes, ATP", "Ja, ATP"), tx("Yes, light", "Ja, Licht"), tx("Only for water", "Nur für Wasser")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const ACTIVE = {
  kind: "parts",
  title: tx("Active", "Aktiv"),
  intro: tx(
    "Active transport pushes substances uphill, against their gradient. That costs energy: directly from ATP (primary) or from the gradient of another ion (secondary).",
    "Aktiver Transport schiebt Stoffe bergauf, gegen ihr Gefälle. Das kostet Energie: direkt aus ATP (primär) oder aus dem Gefälle eines anderen Ions (sekundär).",
  ),
  parts: {
    pump: {
      name: tx("Sodium–potassium pump", "Natrium-Kalium-Pumpe"),
      aka: tx("Na⁺/K⁺-ATPase", "Na⁺/K⁺-ATPase"),
      tag: tx("primary active", "primär aktiv"),
      role: tx("Splits ATP and pumps 3 Na⁺ out of the cell and 2 K⁺ in, both against their gradients.", "Spaltet ATP und pumpt dabei 3 Na⁺ aus der Zelle und 2 K⁺ hinein, beide gegen ihr Gefälle."),
      facts: [
        tx("Uses a large share of our ATP, in nerve cells up to two thirds.", "Verbraucht einen großen Teil unseres ATP, in Nervenzellen bis zu zwei Drittel."),
        tx("Helps to build the resting potential (electrogenic: one net positive charge out per cycle).", "Baut das Ruhepotenzial mit auf (elektrogen: netto eine positive Ladung pro Zyklus hinaus)."),
        tx("Blocked by ouabain and digitalis (a heart drug).", "Gehemmt durch Ouabain und Digitalis (ein Herzmedikament)."),
      ],
      tip: tx("3 out, 2 in: three Na⁺ out, two K⁺ in.", "3 raus, 2 rein: drei Na⁺ hinaus, zwei K⁺ hinein."),
      clue: tx("uses ATP to pump 3 Na⁺ out and 2 K⁺ in", "mit ATP 3 Na⁺ hinaus- und 2 K⁺ hineinpumpt"),
    },
    abc: {
      name: tx("ABC transporter", "ABC-Transporter"),
      aka: tx("ATP-binding cassette", "ATP-binding cassette"),
      tag: tx("primary active", "primär aktiv"),
      role: tx("A large family of pumps with ATP-binding domains: in bacteria they bring in nutrients or pump substances out.", "Eine große Familie von Pumpen mit ATP-bindenden Domänen: Bei Bakterien holen sie Nährstoffe herein oder pumpen Stoffe hinaus."),
      facts: [
        tx("In Gram-negatives often with a binding protein in the periplasm.", "Bei Gramnegativen oft mit einem Bindeprotein im Periplasma."),
        tx("Multidrug efflux pumps throw out antibiotics and cancer drugs: resistance.", "Multidrug-Efflux-Pumpen werfen Antibiotika und Krebsmedikamente hinaus: Resistenz."),
        tx("A faulty ABC protein, CFTR (a chloride channel), causes cystic fibrosis.", "Ein defektes ABC-Protein, CFTR (ein Chloridkanal), verursacht Mukoviszidose."),
      ],
      clue: tx("uses ATP and can pump antibiotics out of bacteria", "ATP nutzt und Antibiotika aus Bakterien pumpen kann"),
    },
    symport: {
      name: tx("Symport", "Symport"),
      aka: tx("co-transport, same direction", "Cotransport, gleiche Richtung"),
      tag: tx("secondary active", "sekundär aktiv"),
      role: tx("A carrier uses an ion flowing downhill (Na⁺ or H⁺) to take a second substance along in the same direction, uphill.", "Ein Carrier nutzt ein Ion, das bergab strömt (Na⁺ oder H⁺), um einen zweiten Stoff in dieselbe Richtung bergauf mitzunehmen."),
      facts: [
        tx("SGLT1 in the small intestine takes up glucose together with Na⁺.", "SGLT1 im Dünndarm nimmt Glucose zusammen mit Na⁺ auf."),
        tx("E. coli takes up lactose with H⁺ (lactose permease, LacY).", "E. coli nimmt Lactose mit H⁺ auf (Lactose-Permease, LacY)."),
        tx("No ATP at the carrier, but the ion gradient was built with ATP before (Na⁺/K⁺ pump).", "Kein ATP am Carrier, aber der Ionengradient wurde vorher mit ATP aufgebaut (Na⁺/K⁺-Pumpe)."),
      ],
      clue: tx("takes two substances in the same direction", "zwei Stoffe in dieselbe Richtung mitnimmt"),
    },
    antiport: {
      name: tx("Antiport", "Antiport"),
      aka: tx("exchanger, opposite directions", "Austauscher, entgegengesetzte Richtung"),
      tag: tx("secondary active", "sekundär aktiv"),
      role: tx("A carrier swaps two substances in opposite directions: one flows downhill, the other is moved uphill.", "Ein Carrier tauscht zwei Stoffe in entgegengesetzte Richtungen: Der eine strömt bergab, der andere wird bergauf bewegt."),
      facts: [
        tx("Na⁺/Ca²⁺ exchanger in heart muscle: 3 Na⁺ in, 1 Ca²⁺ out.", "Na⁺/Ca²⁺-Austauscher im Herzmuskel: 3 Na⁺ hinein, 1 Ca²⁺ hinaus."),
        tx("The Na⁺/H⁺ exchanger keeps the pH of the cell right.", "Der Na⁺/H⁺-Austauscher hält den pH-Wert der Zelle im Lot."),
      ],
      clue: tx("swaps two substances in opposite directions", "zwei Stoffe in entgegengesetzte Richtungen tauscht"),
    },
    pts: {
      name: tx("Group translocation", "Gruppentranslokation"),
      aka: tx("phosphotransferase system, PTS", "Phosphotransferase-System, PTS"),
      tag: tx("only bacteria", "nur Bakterien"),
      role: tx("The sugar is changed on its way in: glucose arrives as glucose 6-phosphate. The energy comes from phosphoenolpyruvate (PEP).", "Der Zucker wird beim Durchtritt verändert: Glucose kommt als Glucose-6-phosphat an. Die Energie stammt aus Phosphoenolpyruvat (PEP)."),
      facts: [
        tx("The phosphate travels from PEP via the proteins enzyme I and HPr to enzyme II in the membrane, and on to the sugar.", "Das Phosphat wandert von PEP über die Proteine Enzym I und HPr zum Enzym II in der Membran und weiter auf den Zucker."),
        tx("Free glucose inside stays low, so uptake keeps running.", "Freie Glucose bleibt innen niedrig, darum läuft die Aufnahme weiter."),
        tx("Eukaryotes don't have it.", "Eukaryoten haben es nicht."),
      ],
      tip: tx("The only kind of transport where the substance itself is changed.", "Die einzige Transportform, bei der sich der Stoff selbst verändert."),
      clue: tx("changes the sugar on the way and takes its energy from PEP", "den Zucker beim Transport verändert und die Energie aus PEP nimmt"),
    },
    atp: {
      name: tx("ATP", "ATP"),
      aka: tx("adenosine triphosphate", "Adenosintriphosphat"),
      role: tx("The cell's energy currency: splitting it into ADP and phosphate releases the energy that drives pumps.", "Die Energiewährung der Zelle: Beim Spalten in ADP und Phosphat wird die Energie frei, die Pumpen antreibt."),
      facts: [tx("Primary active = ATP directly; secondary active = the gradient of an ion.", "Primär aktiv = ATP direkt; sekundär aktiv = das Gefälle eines Ions.")],
      clue: tx("supplies the energy for primary active pumps", "die Energie für primär aktive Pumpen liefert"),
    },
  },
  questions: [
    {
      q: tx("How many ions does the Na⁺/K⁺ pump move per ATP?", "Wie viele Ionen bewegt die Na⁺/K⁺-Pumpe pro ATP?"),
      options: [tx("3 Na⁺ out, 2 K⁺ in", "3 Na⁺ hinaus, 2 K⁺ hinein"), tx("2 Na⁺ out, 3 K⁺ in", "2 Na⁺ hinaus, 3 K⁺ hinein"), tx("1 Na⁺ out, 1 K⁺ in", "1 Na⁺ hinaus, 1 K⁺ hinein"), tx("3 K⁺ out, 2 Na⁺ in", "3 K⁺ hinaus, 2 Na⁺ hinein")],
      correct: 0,
    },
    {
      q: tx("What is secondary active transport?", "Was ist sekundär aktiver Transport?"),
      options: [
        tx("Transport driven by the gradient of another ion", "Transport, angetrieben vom Gefälle eines anderen Ions"),
        tx("Transport with two ATP", "Transport mit zwei ATP"),
        tx("Diffusion through a channel", "Diffusion durch einen Kanal"),
        tx("Transport in vesicles", "Transport in Vesikeln"),
      ],
      correct: 0,
    },
    {
      q: tx("Which kind of transport do only bacteria have?", "Welche Transportform gibt es nur bei Bakterien?"),
      options: [tx("Group translocation (PTS)", "Gruppentranslokation (PTS)"), tx("Symport", "Symport"), tx("Osmosis", "Osmose"), tx("Diffusion", "Diffusion")],
      correct: 0,
    },
    {
      q: tx("SGLT1 takes up glucose together with Na⁺. That is…", "SGLT1 nimmt Glucose zusammen mit Na⁺ auf. Das ist…"),
      options: [tx("symport", "Symport"), tx("antiport", "Antiport"), tx("uniport", "Uniport"), tx("simple diffusion", "einfache Diffusion")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const VESICLES = {
  kind: "parts",
  title: tx("Vesicles", "Vesikel"),
  intro: tx(
    "Big things, or a lot at once, cross in vesicles: the membrane folds in to take them up (endocytosis) or fuses to release them (exocytosis). Only eukaryotic cells can do this.",
    "Große Dinge oder viel auf einmal wandern in Vesikeln: Die Membran stülpt sich ein, um sie aufzunehmen (Endocytose), oder verschmilzt, um sie abzugeben (Exocytose). Das können nur eukaryotische Zellen.",
  ),
  parts: {
    phagocytosis: {
      name: tx("Phagocytosis", "Phagocytose"),
      aka: tx("cell eating", "Zellfressen"),
      tag: tx("endocytosis", "Endocytose"),
      role: tx("The cell flows around large particles such as bacteria with pseudopods and shuts them into a phagosome.", "Die Zelle umfließt große Partikel wie Bakterien mit Scheinfüßchen und schließt sie in ein Phagosom ein."),
      facts: [
        tx("Done by phagocytes: macrophages and neutrophils.", "Das machen Fresszellen: Makrophagen und neutrophile Granulozyten."),
        tx("The phagosome fuses with a lysosome (phagolysosome) and the content is digested.", "Das Phagosom verschmilzt mit einem Lysosom (Phagolysosom) und der Inhalt wird verdaut."),
      ],
      clue: tx("takes up large particles such as bacteria", "große Partikel wie Bakterien aufnimmt"),
    },
    pinocytosis: {
      name: tx("Pinocytosis", "Pinocytose"),
      aka: tx("cell drinking", "Zelltrinken"),
      tag: tx("endocytosis", "Endocytose"),
      role: tx("The membrane dips in and pinches off small bubbles of fluid with whatever is dissolved in it.", "Die Membran stülpt sich ein und schnürt kleine Bläschen mit Flüssigkeit und allem Gelösten darin ab."),
      facts: [tx("Not selective: everything dissolved comes along.", "Nicht wählerisch: Alles Gelöste kommt mit.")],
      clue: tx("takes up fluid in small bubbles", "Flüssigkeit in kleinen Bläschen aufnimmt"),
    },
    receptor: {
      name: tx("Receptor-mediated endocytosis", "Rezeptorvermittelte Endocytose"),
      aka: tx("clathrin-coated pits", "clathrinumhüllte Grübchen"),
      tag: tx("endocytosis", "Endocytose"),
      role: tx("Particular molecules bind to receptors. The spot is lined with clathrin, folds in and pinches off as a coated vesicle.", "Bestimmte Moleküle binden an Rezeptoren. Die Stelle wird mit Clathrin ausgekleidet, stülpt sich ein und schnürt sich als umhülltes Vesikel ab."),
      facts: [
        tx("Very specific and efficient: LDL cholesterol enters this way; a faulty LDL receptor causes familial hypercholesterolaemia.", "Sehr spezifisch und effizient: LDL-Cholesterin kommt so hinein; ein defekter LDL-Rezeptor verursacht familiäre Hypercholesterinämie."),
        tx("Many viruses, such as influenza, sneak in this way.", "Viele Viren, etwa Influenza, schleichen sich so ein."),
      ],
      clue: tx("takes up molecules that have bound to receptors", "Moleküle aufnimmt, die an Rezeptoren gebunden haben"),
    },
    exocytosis: {
      name: tx("Exocytosis", "Exocytose"),
      aka: tx("secretion", "Sekretion"),
      role: tx("Vesicles fuse with the cell membrane and release their content to the outside.", "Vesikel verschmelzen mit der Zellmembran und geben ihren Inhalt nach außen ab."),
      facts: [
        tx("How hormones (insulin), digestive enzymes and antibodies leave the cell.", "So verlassen Hormone (Insulin), Verdauungsenzyme und Antikörper die Zelle."),
        tx("Neurotransmitters at synapses, triggered by Ca²⁺.", "Neurotransmitter an Synapsen, ausgelöst durch Ca²⁺."),
        tx("Adds the vesicle's membrane to the cell membrane.", "Fügt die Vesikelmembran in die Zellmembran ein."),
      ],
      clue: tx("releases the content of vesicles to the outside", "den Inhalt von Vesikeln nach außen abgibt"),
    },
    lysosome: {
      name: tx("Lysosome", "Lysosom"),
      aka: tx("digestion", "Verdauung"),
      role: tx("Fuses with vesicles that came in and digests their content with acidic enzymes.", "Verschmilzt mit aufgenommenen Vesikeln und verdaut deren Inhalt mit sauren Enzymen."),
      facts: [tx("pH about 5 inside.", "Innen etwa pH 5.")],
      clue: tx("digests what the cell has taken up", "verdaut, was die Zelle aufgenommen hat"),
    },
  },
  questions: [
    {
      q: tx("What is the uptake of large particles such as bacteria called?", "Wie nennt man die Aufnahme großer Partikel wie Bakterien?"),
      options: [tx("Phagocytosis", "Phagocytose"), tx("Pinocytosis", "Pinocytose"), tx("Exocytosis", "Exocytose"), tx("Osmosis", "Osmose")],
      correct: 0,
    },
    {
      q: tx("How are neurotransmitters released at a synapse?", "Wie werden Neurotransmitter an der Synapse ausgeschüttet?"),
      options: [tx("By exocytosis", "Durch Exocytose"), tx("By diffusion through the membrane", "Durch Diffusion durch die Membran"), tx("By the Na⁺/K⁺ pump", "Durch die Na⁺/K⁺-Pumpe"), tx("By phagocytosis", "Durch Phagocytose")],
      correct: 0,
    },
    {
      q: tx("Which protein lines the pits of receptor-mediated endocytosis?", "Welches Protein kleidet die Grübchen der rezeptorvermittelten Endocytose aus?"),
      options: [tx("Clathrin", "Clathrin"), tx("Actin", "Aktin"), tx("Keratin", "Keratin"), tx("Haemoglobin", "Hämoglobin")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const CONTENT: ModelContent = { slug: "membrane-transport", views: { passive: PASSIVE, active: ACTIVE, vesicles: VESICLES } };
