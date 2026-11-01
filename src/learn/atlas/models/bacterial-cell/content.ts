import { tx } from "@/i18n/text";
import type { ModelContent, PartsContent } from "../../types";

/** The bacterial cell: its structures, the cell shapes, how flagella sit, and the flagellar motor. */

export const STRUCTURE = {
  kind: "parts",
  title: tx("Structure", "Aufbau"),
  intro: tx(
    "A rod-shaped bacterium such as E. coli (about 2 µm long), cut lengthwise. Prokaryotes have no nucleus and no organelles wrapped in membranes. The tour goes from the outside in.",
    "Ein stäbchenförmiges Bakterium wie E. coli (etwa 2 µm lang) im Längsschnitt. Prokaryoten haben keinen Zellkern und keine membranumhüllten Organellen. Der Rundgang geht von außen nach innen.",
  ),
  parts: {
    flagellum: {
      name: tx("Flagellum", "Geißel (Flagellum)"),
      aka: tx("plural: flagella", "Flagelle; Mehrzahl: Geißeln, Flagellen"),
      tag: tx("movement", "Bewegung"),
      role: tx(
        "Lets the bacterium swim: a long protein thread that rotates like a ship's propeller, driven by a motor in the membrane.",
        "Lässt das Bakterium schwimmen: ein langer Proteinfaden, der sich wie eine Schiffsschraube dreht, angetrieben von einem Motor in der Membran.",
      ),
      facts: [
        tx("Built from filament (the protein flagellin), hook and basal body (the motor with its rings).", "Aufbau: Filament (aus dem Protein Flagellin), Haken und Basalkörper (der Motor mit seinen Ringen)."),
        tx("Powered by the flow of protons into the cell (proton motive force), not directly by ATP.", "Angetrieben vom Einstrom von Protonen (protonenmotorische Kraft), nicht direkt durch ATP."),
        tx("Counter-clockwise: the cell swims straight (run). Clockwise: it tumbles and turns. That is how chemotaxis steers.", "Gegen den Uhrzeigersinn: Die Zelle schwimmt geradeaus (Run). Im Uhrzeigersinn: Sie taumelt und wendet (Tumble). So steuert die Chemotaxis."),
        tx("Flagellin is the H antigen used to type strains, as in E. coli O157:H7.", "Flagellin ist das H-Antigen zur Typisierung von Stämmen, z. B. E. coli O157:H7."),
      ],
      tip: tx(
        "Bacterial flagella rotate. Eukaryotic flagella (9 × 2 + 2 microtubules) beat like a whip. Completely different structures!",
        "Bakteriengeißeln rotieren, Eukaryotengeißeln (9 × 2 + 2 Mikrotubuli) schlagen wie eine Peitsche. Völlig verschiedene Strukturen!",
      ),
      clue: tx("rotates like a propeller and makes the cell swim", "sich wie ein Propeller dreht und die Zelle schwimmen lässt"),
    },
    fimbriae: {
      name: tx("Fimbriae", "Fimbrien"),
      aka: tx("also called (common) pili; adhesins at the tips", "auch (gewöhnliche) Pili; Haftproteine (Adhäsine) an der Spitze"),
      tag: tx("sticking", "Anheftung"),
      role: tx(
        "Short, thin protein hairs, often hundreds of them: the bacterium sticks to surfaces and host cells with them.",
        "Kurze, dünne Proteinhärchen, oft Hunderte: Damit haftet das Bakterium an Oberflächen und Wirtszellen.",
      ),
      facts: [
        tx("Shorter and thinner than flagella; made of protein subunits (pilin).", "Kürzer und dünner als Geißeln; aus Protein-Untereinheiten (Pilin)."),
        tx("An important virulence factor: uropathogenic E. coli hold on in the urinary tract with them.", "Wichtiger Virulenzfaktor: Uropathogene E. coli halten sich damit in den Harnwegen fest."),
        tx("Help to form biofilms.", "Helfen bei der Bildung von Biofilmen."),
        tx("Not for swimming. (Type IV pili can pull a cell along a surface: twitching motility.)", "Nicht zum Schwimmen. (Typ-IV-Pili können eine Zelle über Oberflächen ziehen: „twitching motility“.)"),
      ],
      tip: tx("Fimbriae stick, the sex pilus passes on DNA, the flagellum swims.", "Fimbrien haften, der Sexpilus überträgt DNA, die Geißel schwimmt."),
      clue: tx("lets the bacterium stick to host cells", "das Bakterium an Wirtszellen haften lässt"),
    },
    sexpilus: {
      name: tx("Sex pilus", "Sexpilus"),
      aka: tx("F pilus, conjugation pilus", "F-Pilus, Konjugationspilus"),
      tag: tx("DNA transfer", "DNA-Übertragung"),
      role: tx(
        "A longer tube that connects two bacteria for conjugation: a copy of a plasmid travels from the donor (F⁺) to the recipient (F⁻).",
        "Eine längere Röhre, die zwei Bakterien für die Konjugation verbindet: Eine Kopie eines Plasmids wandert vom Spender (F⁺) zum Empfänger (F⁻).",
      ),
      facts: [
        tx("Encoded by the F plasmid (fertility factor); only a few per cell.", "Vom F-Plasmid (Fertilitätsfaktor) codiert; nur wenige pro Zelle."),
        tx("It pulls the partners together; the DNA crosses as a single strand and both cells fill in the second strand.", "Er zieht die Partner zusammen; die DNA wandert als Einzelstrang hinüber und beide Zellen ergänzen den zweiten Strang."),
        tx("Conjugation is horizontal gene transfer, like transformation (free DNA) and transduction (via phages).", "Konjugation ist horizontaler Gentransfer, wie Transformation (freie DNA) und Transduktion (über Phagen)."),
      ],
      tip: tx("Conjugation is not reproduction: there are as many cells afterwards as before.", "Konjugation ist keine Fortpflanzung: Danach gibt es genauso viele Zellen wie vorher."),
      clue: tx("is the bridge that passes on plasmid DNA in conjugation", "bei der Konjugation die Brücke für die Plasmid-DNA ist"),
    },
    capsule: {
      name: tx("Capsule", "Kapsel"),
      aka: tx("glycocalyx; a loose, diffuse one is called a slime layer", "Glykokalyx; locker und diffus heißt sie Schleimschicht"),
      tag: tx("protection", "Schutz"),
      role: tx(
        "A slimy coat outside the cell wall: protects against drying out and against being eaten by phagocytes, and helps to stick and to form biofilms.",
        "Eine schleimige Hülle außen auf der Zellwand: schützt vor Austrocknung und davor, von Fresszellen gefressen zu werden, und hilft beim Anheften und bei Biofilmen.",
      ),
      facts: [
        tx("Mostly polysaccharides, rarely polypeptides (poly-D-glutamic acid in Bacillus anthracis).", "Meist aus Polysacchariden, selten aus Polypeptiden (Poly-D-Glutaminsäure bei Bacillus anthracis)."),
        tx("Not needed to live, but a major virulence factor: encapsulated pneumococci (S form) kill mice, those without (R form) don't (Griffith, 1928).", "Nicht lebensnotwendig, aber ein wichtiger Virulenzfaktor: Bekapselte Pneumokokken (S-Form) töten Mäuse, unbekapselte (R-Form) nicht (Griffith, 1928)."),
        tx("Shown by negative staining with India ink: the capsule stays a bright halo against the dark background.", "Nachweis mit Negativfärbung (Tuschepräparat): Die Kapsel bleibt als heller Hof vor dunklem Hintergrund sichtbar."),
        tx("Capsule antigens are called K antigens.", "Kapselantigene heißen K-Antigene."),
      ],
      tip: tx("The capsule sits on top of the cell wall and does not give the cell its shape. That is the wall's job.", "Die Kapsel liegt außen auf der Zellwand und gibt der Zelle nicht ihre Form. Das macht die Zellwand."),
      clue: tx("protects against drying out and against phagocytes", "vor Austrocknung und vor Fresszellen schützt"),
    },
    wall: {
      name: tx("Cell wall", "Zellwand"),
      aka: tx("murein (peptidoglycan) sacculus", "Murein- (Peptidoglykan-)Sacculus"),
      tag: tx("shape and stability", "Form und Stabilität"),
      role: tx(
        "A firm mesh around the cell: gives it its shape and keeps it from bursting under its own osmotic pressure (turgor).",
        "Ein festes Netz um die Zelle: gibt ihr die Form und verhindert, dass sie unter ihrem eigenen osmotischen Druck (Turgor) platzt.",
      ),
      facts: [
        tx("Made of murein: sugar chains of N-acetylglucosamine and N-acetylmuramic acid, cross-linked by short peptides.", "Aus Murein: Zuckerketten aus N-Acetylglucosamin und N-Acetylmuraminsäure, quervernetzt durch kurze Peptide."),
        tx("Gram-positive: a thick murein layer. Gram-negative: a thin one plus an outer membrane.", "Grampositiv: dicke Mureinschicht. Gramnegativ: dünne Mureinschicht und eine äußere Membran."),
        tx("Target of penicillin (blocks the cross-links) and lysozyme (cuts the sugar chains).", "Angriffspunkt von Penicillin (verhindert die Quervernetzung) und Lysozym (spaltet die Zuckerketten)."),
        tx("No wall at all: mycoplasmas. Archaea have no murein (some have pseudomurein).", "Ganz ohne Zellwand: Mykoplasmen. Archaeen haben kein Murein (manche Pseudomurein)."),
      ],
      tip: tx("Murein exists only in bacteria. Plant cell walls are cellulose, fungal walls chitin.", "Murein gibt es nur bei Bakterien. Pflanzenzellwände bestehen aus Cellulose, Pilzzellwände aus Chitin."),
      clue: tx("gives the cell its shape and keeps it from bursting", "der Zelle ihre Form gibt und sie vor dem Platzen schützt"),
    },
    membrane: {
      name: tx("Cytoplasmic membrane", "Cytoplasmamembran"),
      aka: tx("plasma membrane, cell membrane", "Plasmamembran, Zellmembran"),
      tag: tx("barrier and energy", "Barriere und Energie"),
      role: tx(
        "The real barrier of the cell: a phospholipid bilayer that controls what gets in and out. The respiratory chain and ATP synthase sit here too.",
        "Die eigentliche Grenze der Zelle: eine Phospholipid-Doppelschicht, die kontrolliert, was hinein- und hinausgeht. Hier sitzen auch Atmungskette und ATP-Synthase.",
      ),
      facts: [
        tx("Fluid mosaic: a lipid bilayer with proteins for transport, energy and sensing.", "Flüssig-Mosaik: Lipid-Doppelschicht mit Proteinen für Transport, Energie und Reizaufnahme."),
        tx("Bacteria have no mitochondria: respiration and ATP synthesis happen at this membrane.", "Bakterien haben keine Mitochondrien: Atmung und ATP-Bildung finden an dieser Membran statt."),
        tx("Usually no sterols (exception: mycoplasmas); hopanoids stabilise it instead of cholesterol.", "Meist ohne Sterole (Ausnahme: Mykoplasmen); statt Cholesterin stabilisieren Hopanoide."),
        tx("Mesosomes, folds once drawn here, turned out to be artefacts of preparing the samples.", "Mesosomen, früher hier eingezeichnete Einstülpungen, haben sich als Artefakte der Präparation herausgestellt."),
      ],
      tip: tx("The wall lets small molecules through. The membrane is the selective barrier.", "Die Zellwand lässt kleine Moleküle durch. Die selektive Barriere ist die Membran."),
      clue: tx("carries the respiratory chain in bacteria", "bei Bakterien die Atmungskette trägt"),
    },
    cytoplasm: {
      name: tx("Cytoplasm", "Cytoplasma"),
      aka: tx("its liquid part: cytosol", "Zellplasma; der flüssige Teil: Cytosol"),
      tag: tx("metabolism", "Stoffwechsel"),
      role: tx(
        "The gel-like inside of the cell, where most of the metabolism runs: glycolysis, protein synthesis and the building of new cell material.",
        "Das gelartige Innere der Zelle, in dem der meiste Stoffwechsel abläuft: Glykolyse, Proteinbiosynthese und der Aufbau neuer Zellbestandteile.",
      ),
      facts: [
        tx("About 70 to 80 % water, plus enzymes, RNA, metabolites and ions.", "Zu etwa 70 bis 80 % Wasser, dazu Enzyme, RNA, Stoffwechselprodukte und Ionen."),
        tx("No compartments: transcription and translation run at the same time, side by side.", "Keine Kompartimente: Transkription und Translation laufen gleichzeitig nebeneinander ab."),
        tx("Bacteria have a cytoskeleton too: FtsZ (like tubulin) forms the ring for division, MreB (like actin) keeps rods rod-shaped.", "Auch Bakterien haben ein Cytoskelett: FtsZ (ähnlich Tubulin) bildet den Teilungsring, MreB (ähnlich Aktin) hält Stäbchen in Form."),
      ],
      tip: tx("Coupled transcription and translation only work because nothing separates the DNA from the ribosomes.", "Gekoppelte Transkription und Translation geht nur, weil nichts die DNA von den Ribosomen trennt."),
      clue: tx("is where most of the metabolism runs", "der Ort für den meisten Stoffwechsel ist"),
    },
    nucleoid: {
      name: tx("Nucleoid", "Nucleoid"),
      aka: tx("bacterial chromosome; nuclear equivalent", "Bakterienchromosom; Kernäquivalent"),
      tag: tx("genetic information", "Erbinformation"),
      role: tx(
        "Holds the genetic information: usually one single, ring-shaped DNA molecule lying free in the cytoplasm, with no envelope around it.",
        "Enthält die Erbinformation: meist ein einziges, ringförmiges DNA-Molekül, das ohne Hülle frei im Cytoplasma liegt.",
      ),
      facts: [
        tx("Haploid. E. coli: about 4.6 million base pairs, about 1.5 mm long when stretched, a thousand times longer than the cell.", "Haploid. E. coli: rund 4,6 Millionen Basenpaare, ausgestreckt etwa 1,5 mm lang, also tausendmal länger als die Zelle."),
        tx("Packed by supercoiling (DNA gyrase) and histone-like proteins such as HU.", "Verpackt durch Verdrillung (Supercoiling durch die DNA-Gyrase) und histonähnliche Proteine wie HU."),
        tx("Genes lie close together, often in operons, and have practically no introns.", "Die Gene liegen dicht beieinander, oft in Operons, und haben praktisch keine Introns."),
        tx("DNA gyrase is the target of fluoroquinolones such as ciprofloxacin.", "Die DNA-Gyrase ist Angriffspunkt der Fluorchinolone wie Ciprofloxacin."),
      ],
      tip: tx("Nuclear equivalent: it does a nucleus's job, but has no membrane.", "Kernäquivalent: Es übernimmt die Aufgabe eines Zellkerns, hat aber keine Membran."),
      clue: tx("holds the chromosome without a nuclear envelope", "das Chromosom ohne Kernhülle enthält"),
    },
    plasmid: {
      name: tx("Plasmid", "Plasmid"),
      aka: tx("extrachromosomal DNA", "extrachromosomale DNA"),
      tag: tx("extra genes", "Zusatzgene"),
      role: tx(
        "A small extra ring of DNA with useful but not vital genes, such as antibiotic resistance. It copies itself independently of the chromosome.",
        "Ein kleiner zusätzlicher DNA-Ring mit nützlichen, aber nicht lebensnotwendigen Genen, etwa für Antibiotikaresistenz. Er verdoppelt sich unabhängig vom Chromosom.",
      ),
      facts: [
        tx("Has its own origin of replication (ori); one to hundreds of copies per cell.", "Hat einen eigenen Replikationsursprung (ori); eine bis Hunderte Kopien pro Zelle."),
        tx("R plasmids carry resistance genes; the F plasmid lets a cell form a sex pilus.", "R-Plasmide tragen Resistenzgene; das F-Plasmid befähigt zur Bildung eines Sexpilus."),
        tx("Passed on by conjugation: this is how resistance spreads between bacteria, even between species.", "Weitergabe durch Konjugation: So verbreiten sich Resistenzen zwischen Bakterien, sogar zwischen Arten."),
        tx("The workhorse of genetic engineering: vectors such as pUC19 carry foreign genes into bacteria.", "Arbeitspferd der Gentechnik: Vektoren wie pUC19 bringen fremde Gene in Bakterien."),
      ],
      tip: tx("A cell survives without its plasmids, as long as no antibiotic is around.", "Eine Zelle überlebt auch ohne ihre Plasmide, solange kein Antibiotikum da ist."),
      clue: tx("often carries antibiotic resistance genes", "oft Gene für Antibiotikaresistenz trägt"),
    },
    ribosomes: {
      name: tx("Ribosomes (70S)", "Ribosomen (70S)"),
      aka: tx("50S + 30S subunit", "50S- + 30S-Untereinheit"),
      tag: tx("protein synthesis", "Proteinbiosynthese"),
      role: tx(
        "Make the proteins: they read the mRNA and join amino acids into a chain (translation). Thousands of them fill the cytoplasm.",
        "Stellen die Proteine her: Sie lesen die mRNA ab und verknüpfen Aminosäuren zu einer Kette (Translation). Tausende davon füllen das Cytoplasma.",
      ),
      facts: [
        tx("70S = a large 50S and a small 30S subunit. S is the Svedberg unit of sedimentation and doesn't simply add up.", "70S = große 50S- und kleine 30S-Untereinheit. S ist die Svedberg-Einheit der Sedimentation und addiert sich nicht einfach."),
        tx("rRNAs: 23S and 5S in the large, 16S in the small subunit. The 16S rRNA sequence identifies bacteria.", "rRNAs: 23S und 5S in der großen, 16S in der kleinen Untereinheit. Die 16S-rRNA-Sequenz dient zur Bestimmung von Bakterien."),
        tx("Our cytoplasm has 80S ribosomes (60S + 40S). Mitochondria and chloroplasts have 70S: evidence for endosymbiosis.", "Unser Cytoplasma hat 80S-Ribosomen (60S + 40S). Mitochondrien und Chloroplasten haben 70S: ein Beleg für die Endosymbiontentheorie."),
        tx("Target of many antibiotics: tetracyclines and aminoglycosides (30S), macrolides and chloramphenicol (50S).", "Angriffspunkt vieler Antibiotika: Tetracycline und Aminoglykoside (30S), Makrolide und Chloramphenicol (50S)."),
      ],
      tip: tx("50S + 30S = 70S, not 80S!", "50S + 30S = 70S, nicht 80S!"),
      clue: tx("makes proteins and is a target of tetracycline", "Proteine herstellt und Angriffspunkt von Tetracyclin ist"),
    },
    inclusions: {
      name: tx("Storage granules", "Speicherstoffe"),
      aka: tx("inclusion bodies: glycogen, PHB, polyphosphate", "Einschlüsse, Granula: Glykogen, PHB, Polyphosphat"),
      tag: tx("reserves", "Vorrat"),
      role: tx(
        "Reserves for hard times: carbon, energy or phosphate stored as granules that don't upset the cell's osmotic balance.",
        "Vorräte für schlechte Zeiten: Kohlenstoff, Energie oder Phosphat, als Körnchen gespeichert, ohne den osmotischen Haushalt zu stören.",
      ),
      facts: [
        tx("Glycogen and poly-β-hydroxybutyric acid (PHB) store carbon and energy.", "Glykogen und Poly-β-Hydroxybuttersäure (PHB) speichern Kohlenstoff und Energie."),
        tx("Polyphosphate (volutin) granules store phosphate; in Corynebacterium diphtheriae they show as polar bodies with Neisser staining.", "Polyphosphat-Granula (Volutin) speichern Phosphat; bei Corynebacterium diphtheriae zeigt die Neisser-Färbung sie als Polkörperchen."),
        tx("Sulphur bacteria store globules of sulphur.", "Schwefelbakterien lagern Schwefelkügelchen ein."),
        tx("PHB is the raw material of biodegradable plastics.", "PHB ist ein Rohstoff für biologisch abbaubare Kunststoffe."),
      ],
      tip: tx("Storage as a polymer: one big molecule instead of many small ones keeps the osmotic pressure low.", "Speicher als Polymer: ein großes Molekül statt vieler kleiner hält den osmotischen Druck niedrig."),
      clue: tx("keeps carbon, energy or phosphate in stock", "Kohlenstoff, Energie oder Phosphat auf Vorrat hält"),
    },
  },
  questions: [
    {
      q: tx("Which ribosomes do bacteria have?", "Welche Ribosomen haben Bakterien?"),
      options: [tx("70S (50S + 30S)", "70S (50S + 30S)"), tx("80S (60S + 40S)", "80S (60S + 40S)"), tx("70S (40S + 30S)", "70S (40S + 30S)"), tx("80S (50S + 30S)", "80S (50S + 30S)")],
      correct: 0,
      why: tx("70S ribosomes from a 50S and a 30S subunit. Svedberg values don't simply add up.", "70S-Ribosomen aus einer 50S- und einer 30S-Untereinheit. Svedberg-Werte addieren sich nicht einfach."),
    },
    {
      q: tx("Where does a bacterium make most of its ATP by respiration?", "Wo bildet ein Bakterium bei der Atmung das meiste ATP?"),
      options: [tx("At the cytoplasmic membrane", "An der Cytoplasmamembran"), tx("In its mitochondria", "In seinen Mitochondrien"), tx("In the cell wall", "In der Zellwand"), tx("In the nucleoid", "Im Nucleoid")],
      correct: 0,
      why: tx("Bacteria have no mitochondria: the respiratory chain and ATP synthase sit in the cytoplasmic membrane.", "Bakterien haben keine Mitochondrien: Atmungskette und ATP-Synthase sitzen in der Cytoplasmamembran."),
    },
    {
      q: tx("What sets prokaryotes apart from eukaryotes?", "Was unterscheidet Prokaryoten grundsätzlich von Eukaryoten?"),
      options: [
        tx("No nucleus and no membrane-bound organelles", "Kein Zellkern und keine membranumhüllten Organellen"),
        tx("No DNA", "Keine DNA"),
        tx("No ribosomes", "Keine Ribosomen"),
        tx("No cell membrane", "Keine Zellmembran"),
      ],
      correct: 0,
    },
    {
      q: tx("How does DNA get from one bacterium to another in conjugation?", "Wie gelangt bei der Konjugation DNA von einem Bakterium zum anderen?"),
      options: [tx("Through a sex pilus, from cell to cell", "Über einen Sexpilus von Zelle zu Zelle"), tx("Carried by a bacteriophage", "Mit einem Bakteriophagen"), tx("As free DNA from the surroundings", "Als freie DNA aus der Umgebung"), tx("By cell division", "Durch Zellteilung")],
      correct: 0,
      why: tx("Conjugation: cell contact via the sex pilus. Transduction: via phages. Transformation: taking up free DNA.", "Konjugation: Zellkontakt über den Sexpilus. Transduktion: über Phagen. Transformation: Aufnahme freier DNA."),
    },
    {
      q: tx("Which stain shows a capsule?", "Mit welcher Färbung macht man eine Kapsel sichtbar?"),
      options: [tx("Negative staining with India ink", "Negativfärbung mit Tusche"), tx("Gram stain", "Gramfärbung"), tx("Ziehl-Neelsen stain", "Ziehl-Neelsen-Färbung"), tx("Spore stain", "Sporenfärbung")],
      correct: 0,
      why: tx("The capsule hardly takes up dye: in India ink it shows as a bright halo on a dark background.", "Die Kapsel nimmt kaum Farbstoff auf: Im Tuschepräparat erscheint sie als heller Hof vor dunklem Hintergrund."),
    },
    {
      q: tx("About how long is an E. coli cell?", "Wie lang ist eine E.-coli-Zelle ungefähr?"),
      options: [tx("about 2 µm", "etwa 2 µm"), tx("about 20 µm", "etwa 20 µm"), tx("about 200 nm", "etwa 200 nm"), tx("about 0.2 mm", "etwa 0,2 mm")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const SHAPES = {
  kind: "parts",
  title: tx("Cell shapes", "Zellformen"),
  intro: tx(
    "Under the microscope you first tell bacteria apart by shape and arrangement. The arrangement shows in which planes a species divides and whether the cells stay together afterwards.",
    "Unter dem Mikroskop unterscheidet man Bakterien zuerst nach Form und Lagerung. Die Lagerung zeigt, in welchen Ebenen sich eine Art teilt und ob die Zellen danach zusammenbleiben.",
  ),
  parts: {
    coccus: {
      name: tx("Cocci", "Kokken"),
      aka: tx("spherical bacteria; singular coccus", "Kugelbakterien; Einzahl: Kokkus"),
      tag: tx("sphere", "Kugel"),
      role: tx(
        "Round bacteria, about 0.5 to 1 µm across. Lying alone they are called monococci; how they stick together after dividing often gives away the genus.",
        "Runde Bakterien, etwa 0,5 bis 1 µm groß. Einzeln liegend heißen sie Monokokken; wie sie nach der Teilung zusammenhängen, verrät oft die Gattung.",
      ),
      facts: [
        tx("Arrangement = planes of division + whether the daughter cells stay together.", "Lagerung = Teilungsebene(n) + ob die Tochterzellen zusammenbleiben."),
        tx("Cocci almost never have flagella: most of them can't swim.", "Kokken haben fast nie Geißeln: Die meisten können nicht schwimmen."),
      ],
      clue: tx("are round and lie on their own", "rund sind und einzeln liegen"),
    },
    diplococcus: {
      name: tx("Diplococci", "Diplokokken"),
      aka: tx("cocci in pairs", "Kokken in Paaren"),
      tag: tx("pairs", "Paare"),
      role: tx("Cocci in pairs: after one division the two daughter cells stay together.", "Kokken in Paaren: Nach einer Teilung bleiben die beiden Tochterzellen zusammen."),
      facts: [
        tx("Neisseria (N. gonorrhoeae, N. meningitidis): shaped like coffee beans, Gram-negative.", "Neisserien (N. gonorrhoeae, N. meningitidis): kaffeebohnen- oder semmelförmig, gramnegativ."),
        tx("Streptococcus pneumoniae: lancet-shaped diplococci, Gram-positive, with a capsule.", "Streptococcus pneumoniae (Pneumokokken): lanzettförmige Diplokokken, grampositiv, mit Kapsel."),
      ],
      clue: tx("lie together as pairs", "als Paare zusammenliegen"),
    },
    streptococcus: {
      name: tx("Streptococci", "Streptokokken"),
      aka: tx("chains of cocci", "Kettenkokken"),
      tag: tx("chains", "Ketten"),
      role: tx("Cocci in chains: they always divide in the same plane and stay attached.", "Kokken in Ketten: Sie teilen sich immer in derselben Ebene und bleiben aneinander hängen."),
      facts: [
        tx("Greek streptós: twisted, like a chain.", "Griechisch streptós: gewunden, wie eine Kette."),
        tx("Streptococcus pyogenes (tonsillitis, scarlet fever), Enterococcus faecalis.", "Streptococcus pyogenes (Angina, Scharlach), Enterococcus faecalis."),
        tx("Gram-positive and catalase-negative.", "Grampositiv und Katalase-negativ."),
      ],
      tip: tx("Catalase test: staphylococci fizz with H₂O₂ (positive), streptococci don't (negative).", "Katalase-Test: Staphylokokken schäumen mit H₂O₂ (positiv), Streptokokken nicht (negativ)."),
      clue: tx("form chains because they always divide in the same plane", "Ketten bilden, weil sie sich immer in derselben Ebene teilen"),
    },
    staphylococcus: {
      name: tx("Staphylococci", "Staphylokokken"),
      aka: tx("clusters of cocci", "Haufenkokken, Traubenkokken"),
      tag: tx("clusters", "Haufen"),
      role: tx("Cocci in grape-like clusters: they divide in changing planes.", "Kokken in traubenförmigen Haufen: Sie teilen sich in wechselnden Ebenen."),
      facts: [
        tx("Greek staphylé: bunch of grapes.", "Griechisch staphylé: Weintraube."),
        tx("Staphylococcus aureus: pus, wound infections, MRSA. S. epidermidis lives on our skin.", "Staphylococcus aureus: Eiter, Wundinfektionen, MRSA. S. epidermidis lebt auf unserer Haut."),
        tx("Gram-positive and catalase-positive; S. aureus is also coagulase-positive.", "Grampositiv und Katalase-positiv; S. aureus zusätzlich Koagulase-positiv."),
      ],
      clue: tx("lie in clusters like grapes", "in Haufen wie Weintrauben liegen"),
    },
    tetrad: {
      name: tx("Tetrads", "Tetraden"),
      aka: tx("groups of four", "Vierergruppen"),
      tag: tx("fours", "Vierer"),
      role: tx("Four cocci in a flat square: they divide in two planes at right angles.", "Vier Kokken in einem flachen Quadrat: Teilung in zwei Ebenen, die senkrecht zueinander stehen."),
      facts: [tx("For example Micrococcus and Pediococcus.", "Zum Beispiel Micrococcus und Pediococcus.")],
      clue: tx("lie in fours, flat in one layer", "zu viert flach in einer Ebene liegen"),
    },
    sarcina: {
      name: tx("Sarcinae", "Sarcinen"),
      aka: tx("packets of eight", "Pakete"),
      tag: tx("cubes", "Würfel"),
      role: tx("Cube-shaped packets of eight cocci or more: they divide in three planes at right angles.", "Würfelförmige Pakete aus acht oder mehr Kokken: Teilung in drei senkrecht aufeinander stehenden Ebenen."),
      facts: [tx("Latin sarcina: bundle. Sarcina ventriculi lives in the stomach, among other places.", "Lateinisch sarcina: Bündel. Sarcina ventriculi kommt unter anderem im Magen vor.")],
      clue: tx("form cube-shaped packets of eight", "würfelförmige Pakete aus acht Zellen bilden"),
    },
    rod: {
      name: tx("Rods", "Stäbchen"),
      aka: tx("bacilli", "Bazillen"),
      tag: tx("cylinder", "Zylinder"),
      role: tx("Elongated, cylinder-shaped bacteria, usually 1 to 5 µm long. Many well-known pathogens are rods.", "Längliche, zylinderförmige Bakterien, meist 1 bis 5 µm lang. Viele bekannte Krankheitserreger sind Stäbchen."),
      facts: [
        tx("Gram-negative: Escherichia coli, Salmonella, Pseudomonas. Gram-positive: Bacillus, Clostridium, Listeria.", "Gramnegativ: Escherichia coli, Salmonella, Pseudomonas. Grampositiv: Bacillus, Clostridium, Listeria."),
        tx("In chains they are streptobacilli, such as Bacillus anthracis (\"bamboo cane\").", "In Ketten heißen sie Streptobazillen, etwa Bacillus anthracis („Bambusstab“)."),
        tx("Rounded or square ends help to identify them.", "Abgerundete oder kantige Enden helfen bei der Bestimmung."),
      ],
      tip: tx("Bacillus is also a genus: not every rod is a Bacillus!", "Bacillus ist auch ein Gattungsname: Nicht jedes Stäbchen ist ein Bacillus!"),
      clue: tx("are elongated like a small cylinder", "länglich wie ein kleiner Zylinder sind"),
    },
    coccobacillus: {
      name: tx("Coccobacilli", "Kokkobazillen"),
      aka: tx("very short rods", "kokkoide Stäbchen"),
      tag: tx("in between", "dazwischen"),
      role: tx("Very short, oval rods, halfway between coccus and rod: easy to mix up under the microscope.", "Sehr kurze, ovale Stäbchen, zwischen Kokkus und Stäbchen: unter dem Mikroskop leicht zu verwechseln."),
      facts: [tx("Haemophilus influenzae, Bordetella pertussis (whooping cough), Brucella. All Gram-negative.", "Haemophilus influenzae, Bordetella pertussis (Keuchhusten), Brucella. Alle gramnegativ.")],
      clue: tx("are so short and oval that they look almost like cocci", "so kurz und oval sind, dass sie fast wie Kokken aussehen"),
    },
    coryneform: {
      name: tx("Club-shaped rods", "Keulenförmige Stäbchen"),
      aka: tx("coryneform bacteria", "coryneforme Bakterien"),
      tag: tx("clubs", "Keulen"),
      role: tx(
        "Rods with a thickened end. They snap apart when dividing and end up in V and Y shapes, like Chinese characters.",
        "Stäbchen mit verdicktem Ende. Bei der Teilung knicken sie ab und liegen V- und Y-förmig, wie chinesische Schriftzeichen.",
      ),
      facts: [
        tx("Greek koryné: club. Corynebacterium diphtheriae causes diphtheria.", "Griechisch koryné: Keule. Corynebacterium diphtheriae ist der Erreger der Diphtherie."),
        tx("Typical arrangement: like a palisade or like characters, from snapping division.", "Typische Lagerung: palisadenförmig oder wie Schriftzeichen, durch Knickteilung."),
        tx("Polar bodies (polyphosphate) show with Neisser staining.", "Polkörperchen (Polyphosphat) werden mit der Neisser-Färbung sichtbar."),
      ],
      clue: tx("have a thickened end and lie like written characters", "ein verdicktes Ende haben und wie Schriftzeichen liegen"),
    },
    vibrio: {
      name: tx("Vibrios", "Vibrionen"),
      aka: tx("comma-shaped rods", "kommaförmige Stäbchen"),
      tag: tx("comma", "Komma"),
      role: tx("Short, curved rods shaped like a comma, usually with one flagellum at one end: very fast swimmers.", "Kurze, gekrümmte Stäbchen wie ein Komma, meist mit einer Geißel an einem Ende: sehr schnelle Schwimmer."),
      facts: [
        tx("Vibrio cholerae causes cholera; Robert Koch identified it in 1883/84.", "Vibrio cholerae ist der Erreger der Cholera; Robert Koch identifizierte ihn 1883/84."),
        tx("Gram-negative, monotrichous.", "Gramnegativ, monotrich begeißelt."),
      ],
      clue: tx("are bent like a comma", "wie ein Komma gekrümmt sind"),
    },
    spirillum: {
      name: tx("Spirilla", "Spirillen"),
      aka: tx("rigid spirals", "starre Schrauben"),
      tag: tx("rigid spiral", "starre Schraube"),
      role: tx("Rigid, corkscrew-shaped bacteria that swim with flagella at their ends.", "Starre, schraubenförmig gewundene Bakterien, die mit Geißeln an ihren Enden schwimmen."),
      facts: [
        tx("Rigid: the cell itself doesn't bend (unlike spirochaetes).", "Starr: Die Zelle selbst verbiegt sich nicht (anders als Spirochäten)."),
        tx("Spirillum volutans; spiral or curved too: Campylobacter and Helicobacter pylori (stomach ulcers).", "Spirillum volutans; schraubig bzw. gekrümmt auch Campylobacter und Helicobacter pylori (Magengeschwüre)."),
        tx("Their flagella are on the outside, often in tufts at the poles.", "Ihre Geißeln liegen außen, oft als Büschel an den Polen."),
      ],
      tip: tx("Spirilla: rigid, flagella outside. Spirochaetes: flexible, flagella inside.", "Spirillen: starr, Geißeln außen. Spirochäten: flexibel, Geißeln innen."),
      clue: tx("are rigid spirals with flagella on the outside", "starre Schrauben mit Geißeln außen sind"),
    },
    spirochete: {
      name: tx("Spirochaetes", "Spirochäten"),
      aka: tx("flexible spirals", "flexible Schrauben"),
      tag: tx("flexible spiral", "biegsame Schraube"),
      role: tx(
        "Long, thin, flexible spirals. Their flagella lie inside the cell envelope (endoflagella) and twist the whole cell like a corkscrew.",
        "Lange, dünne, biegsame Schrauben. Ihre Geißeln liegen innerhalb der Zellhülle (Endoflagellen) und verdrehen die ganze Zelle wie einen Korkenzieher.",
      ),
      facts: [
        tx("Treponema pallidum (syphilis), Borrelia burgdorferi (Lyme disease, from ticks), Leptospira (leptospirosis).", "Treponema pallidum (Syphilis), Borrelia burgdorferi (Lyme-Borreliose, durch Zecken), Leptospira (Leptospirose)."),
        tx("So thin that bright-field microscopes hardly show them: dark-field microscopy.", "So dünn, dass man sie im Hellfeld kaum sieht: Dunkelfeldmikroskopie."),
      ],
      clue: tx("are flexible and keep their flagella inside", "biegsam sind und ihre Geißeln innen haben"),
    },
  },
  questions: [
    {
      q: tx("In how many planes do sarcinae divide?", "In wie vielen Ebenen teilen sich Sarcinen?"),
      options: [tx("Three, at right angles", "In drei senkrecht zueinander stehenden Ebenen"), tx("One", "In einer Ebene"), tx("Two", "In zwei Ebenen"), tx("In changing, irregular planes", "In wechselnden, unregelmäßigen Ebenen")],
      correct: 0,
      why: tx("Sarcinae: 3 planes, cubes. Tetrads: 2 planes. Streptococci: 1 plane, chains. Staphylococci: irregular, clusters.", "Sarcinen: 3 Ebenen, Würfel. Tetraden: 2 Ebenen. Streptokokken: 1 Ebene, Ketten. Staphylokokken: unregelmäßig, Haufen."),
    },
    {
      q: tx("Which quick test tells staphylococci from streptococci?", "Welcher Schnelltest unterscheidet Staphylokokken von Streptokokken?"),
      options: [tx("Catalase test", "Katalase-Test"), tx("Oxidase test", "Oxidase-Test"), tx("Indole test", "Indol-Test"), tx("Gram stain", "Gramfärbung")],
      correct: 0,
      why: tx("Both are Gram-positive cocci. Staphylococci are catalase-positive (bubbles with H₂O₂), streptococci catalase-negative.", "Beide sind grampositive Kokken. Staphylokokken sind Katalase-positiv (Bläschen mit H₂O₂), Streptokokken Katalase-negativ."),
    },
    {
      q: tx("How do spirochaetes move?", "Wie bewegen sich Spirochäten fort?"),
      options: [tx("With endoflagella inside the envelope", "Mit Endoflagellen innerhalb der Zellhülle"), tx("With flagella outside at the poles", "Mit Geißeln außen an den Polen"), tx("With fimbriae", "Mit Fimbrien"), tx("They can't move", "Gar nicht")],
      correct: 0,
    },
    {
      q: tx("Which pathogen is a comma-shaped rod?", "Welcher Erreger ist ein kommaförmiges Stäbchen?"),
      options: [tx("Vibrio cholerae", "Vibrio cholerae"), tx("Staphylococcus aureus", "Staphylococcus aureus"), tx("Treponema pallidum", "Treponema pallidum"), tx("Neisseria meningitidis", "Neisseria meningitidis")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const FLAGELLA = {
  kind: "parts",
  title: tx("Flagella", "Begeißelung"),
  intro: tx(
    "How many flagella a bacterium has and where they sit is a key feature for identifying it. Greek thríx means hair.",
    "Wie viele Geißeln ein Bakterium hat und wo sie sitzen, ist ein wichtiges Bestimmungsmerkmal. Griechisch thríx heißt Haar.",
  ),
  parts: {
    atrichous: {
      name: tx("Atrichous", "Atrich"),
      aka: tx("no flagella", "unbegeißelt"),
      role: tx("No flagella at all: the bacterium can't swim on its own.", "Gar keine Geißeln: Das Bakterium kann nicht selbst schwimmen."),
      facts: [
        tx("For example Staphylococcus, Klebsiella and Shigella.", "Zum Beispiel Staphylococcus, Klebsiella und Shigella."),
        tx("Testing motility: the hanging drop, or a stab into semi-solid motility agar.", "Beweglichkeit prüfen: im hängenden Tropfen oder als Stich in halbfesten Beweglichkeitsagar."),
      ],
      tip: tx("Even non-motile cells jiggle under the microscope: that's Brownian motion, not swimming.", "Auch unbewegliche Zellen zittern unter dem Mikroskop: Das ist Brownsche Molekularbewegung, kein Schwimmen."),
      clue: tx("has no flagellum at all", "gar keine Geißel hat"),
    },
    monotrichous: {
      name: tx("Monotrichous", "Monotrich"),
      aka: tx("one polar flagellum", "eine polare Geißel"),
      role: tx("A single flagellum at one end of the cell.", "Eine einzige Geißel an einem Ende der Zelle."),
      facts: [
        tx("Vibrio cholerae, Pseudomonas aeruginosa.", "Vibrio cholerae, Pseudomonas aeruginosa."),
        tx("Greek mónos: alone. Fast, straight swimming.", "Griechisch mónos: allein. Schnelles, geradliniges Schwimmen."),
      ],
      clue: tx("has exactly one flagellum at one end", "genau eine Geißel an einem Ende hat"),
    },
    lophotrichous: {
      name: tx("Lophotrichous", "Lophotrich"),
      aka: tx("a tuft at one pole", "Büschel an einem Pol"),
      role: tx("A tuft of several flagella at one end.", "Ein Büschel aus mehreren Geißeln an einem Ende."),
      facts: [
        tx("Helicobacter pylori (a tuft of sheathed flagella), Pseudomonas fluorescens.", "Helicobacter pylori (ein Büschel umhüllter Geißeln), Pseudomonas fluorescens."),
        tx("Greek lóphos: tuft, crest.", "Griechisch lóphos: Schopf, Büschel."),
      ],
      clue: tx("has a tuft of flagella at one end", "ein Geißelbüschel an einem Ende hat"),
    },
    amphitrichous: {
      name: tx("Amphitrichous", "Amphitrich"),
      aka: tx("flagella at both poles", "Geißeln an beiden Polen"),
      role: tx("Flagella at both ends, single or in tufts.", "Geißeln an beiden Enden, einzeln oder als Büschel."),
      facts: [
        tx("Campylobacter jejuni (one at each end), Spirillum volutans (tufts at both ends).", "Campylobacter jejuni (je eine an beiden Enden), Spirillum volutans (Büschel an beiden Enden)."),
        tx("Greek amphí: on both sides.", "Griechisch amphí: auf beiden Seiten."),
      ],
      clue: tx("has flagella at both ends", "an beiden Enden Geißeln hat"),
    },
    peritrichous: {
      name: tx("Peritrichous", "Peritrich"),
      aka: tx("flagella all around", "rundum begeißelt"),
      role: tx("Many flagella all over the surface. To swim, they bundle up at the back of the cell.", "Viele Geißeln über die ganze Oberfläche verteilt. Zum Schwimmen bündeln sie sich am Hinterende."),
      facts: [
        tx("Escherichia coli, Salmonella, Proteus, Bacillus subtilis.", "Escherichia coli, Salmonella, Proteus, Bacillus subtilis."),
        tx("Bundle together: run. Bundle falls apart: tumble and new direction (chemotaxis).", "Bündel zusammen: Run. Bündel fällt auseinander: Taumeln und neue Richtung (Chemotaxis)."),
        tx("Greek perí: all around.", "Griechisch perí: ringsum."),
      ],
      tip: tx("Proteus swarms across the whole agar plate: a typical sight in the lab.", "Proteus schwärmt über die ganze Agarplatte: ein typisches Bild im Labor."),
      clue: tx("has flagella all over its surface", "überall auf der Oberfläche Geißeln hat"),
    },
    endoflagella: {
      name: tx("Endoflagella", "Endoflagellen"),
      aka: tx("periplasmic flagella, axial filaments", "periplasmatische Geißeln, Axialfilamente"),
      tag: tx("only spirochaetes", "nur Spirochäten"),
      role: tx("Flagella inside the cell envelope, between wall and outer sheath. Turning, they twist the whole cell like a corkscrew.", "Geißeln innerhalb der Zellhülle, zwischen Zellwand und äußerer Hülle. Wenn sie sich drehen, verdrehen sie die ganze Zelle wie einen Korkenzieher."),
      facts: [
        tx("Only in spirochaetes: Treponema, Borrelia, Leptospira.", "Nur bei Spirochäten: Treponema, Borrelia, Leptospira."),
        tx("Good for moving through thick, sticky media like tissue and mucus.", "Gut für die Bewegung in zähen Medien wie Gewebe und Schleim."),
      ],
      clue: tx("lies inside the envelope and twists the cell like a corkscrew", "innerhalb der Zellhülle liegt und die Zelle wie einen Korkenzieher verdreht"),
    },
  },
  questions: [
    {
      q: tx("How are the flagella of E. coli arranged?", "Wie ist E. coli begeißelt?"),
      options: [tx("Peritrichous", "Peritrich"), tx("Monotrichous", "Monotrich"), tx("Lophotrichous", "Lophotrich"), tx("Atrichous", "Atrich")],
      correct: 0,
    },
    {
      q: tx("What does lophotrichous mean?", "Was bedeutet lophotrich?"),
      options: [tx("A tuft of flagella at one pole", "Ein Geißelbüschel an einem Pol"), tx("One flagellum at each pole", "Je eine Geißel an beiden Polen"), tx("Flagella all around", "Geißeln rundum"), tx("A single polar flagellum", "Eine einzelne polare Geißel")],
      correct: 0,
    },
    {
      q: tx("How do you test in the lab whether bacteria can swim?", "Wie prüft man im Labor, ob Bakterien beweglich sind?"),
      options: [tx("Hanging drop or semi-solid motility agar", "Hängender Tropfen oder halbfester Beweglichkeitsagar"), tx("Gram stain", "Gramfärbung"), tx("Catalase test", "Katalase-Test"), tx("India ink", "Tuschepräparat")],
      correct: 0,
      why: tx("In a hanging drop you see directed swimming; in semi-solid agar a motile strain grows out from the stab and clouds the agar.", "Im hängenden Tropfen sieht man gerichtete Bewegung; im halbfesten Agar wächst ein bewegliches Bakterium vom Stich aus trüb in den Agar hinein."),
    },
  ],
} satisfies PartsContent;

export const MOTOR = {
  kind: "parts",
  title: tx("Flagellar motor", "Geißelmotor"),
  intro: tx(
    "The motor of a flagellum in a Gram-negative envelope: a real nanomachine with rotor, stator, drive shaft and bearings, driven by protons flowing into the cell.",
    "Der Motor einer Geißel in einer gramnegativen Zellhülle: eine echte Nanomaschine mit Rotor, Stator, Antriebswelle und Lagern, angetrieben von Protonen, die in die Zelle strömen.",
  ),
  parts: {
    filament: {
      name: tx("Filament", "Filament"),
      aka: tx("made of flagellin", "aus Flagellin"),
      role: tx("The propeller: a long, hollow, rigid helix of thousands of flagellin molecules. Turning, it pushes the cell forward.", "Der Propeller: eine lange, hohle, starre Schraube aus Tausenden Flagellin-Molekülen. Wenn sie sich dreht, schiebt sie die Zelle voran."),
      facts: [
        tx("Several µm long (longer than the cell), only about 20 nm thick.", "Mehrere µm lang (länger als die Zelle), nur etwa 20 nm dick."),
        tx("Grows at its tip: new flagellin travels through the hollow core to the end.", "Wächst an der Spitze: Neues Flagellin wandert durch den hohlen Kanal nach außen."),
        tx("Flagellin = H antigen.", "Flagellin = H-Antigen."),
      ],
      clue: tx("is the long propeller made of flagellin", "der lange Propeller aus Flagellin ist"),
    },
    cap: {
      name: tx("Cap", "Kappe"),
      aka: tx("FliD", "FliD"),
      role: tx("Sits on the tip of the filament and fits each new flagellin molecule into place.", "Sitzt auf der Spitze des Filaments und baut jedes neue Flagellin-Molekül an seinen Platz ein."),
      facts: [tx("Without the cap, flagellin leaks away and the filament can't grow.", "Ohne Kappe geht das Flagellin verloren, das Filament kann nicht wachsen.")],
      clue: tx("sits on the tip and builds in new subunits", "an der Spitze sitzt und neue Bausteine einbaut"),
    },
    hook: {
      name: tx("Hook", "Haken"),
      aka: tx("FlgE, universal joint", "FlgE, Kardangelenk"),
      role: tx("A short, bent, flexible joint between motor and filament that passes on the rotation, like a universal joint.", "Ein kurzes, gebogenes, biegsames Gelenk zwischen Motor und Filament, das die Drehung weitergibt, wie ein Kardangelenk."),
      facts: [tx("About 55 nm long; lets the filament turn at an angle to the shaft.", "Etwa 55 nm lang; erlaubt, dass sich das Filament schräg zur Welle dreht.")],
      clue: tx("joins motor and filament as a flexible joint", "Motor und Filament als biegsames Gelenk verbindet"),
    },
    rod: {
      name: tx("Rod (drive shaft)", "Stab (Antriebswelle)"),
      aka: tx("rod", "Welle"),
      role: tx("The drive shaft: runs through the rings and the envelope and turns the hook.", "Die Antriebswelle: läuft durch die Ringe und die Zellhülle und dreht den Haken."),
      facts: [tx("Turns together with the MS ring and the C ring.", "Dreht sich zusammen mit MS-Ring und C-Ring.")],
      clue: tx("is the drive shaft through the cell envelope", "die Antriebswelle durch die Zellhülle ist"),
    },
    lring: {
      name: tx("L ring", "L-Ring"),
      aka: tx("L for lipopolysaccharide", "L wie Lipopolysaccharid"),
      tag: tx("only Gram-negative", "nur gramnegativ"),
      role: tx("A bushing in the outer membrane that the shaft turns in. It doesn't turn itself.", "Eine Lagerbuchse in der äußeren Membran, in der sich die Welle dreht. Sie selbst dreht sich nicht."),
      facts: [tx("Only Gram-negative bacteria have it, because only they have an outer membrane.", "Nur gramnegative Bakterien haben ihn, weil nur sie eine äußere Membran haben.")],
      clue: tx("holds the shaft in the outer membrane", "die Welle in der äußeren Membran lagert"),
    },
    pring: {
      name: tx("P ring", "P-Ring"),
      aka: tx("P for peptidoglycan", "P wie Peptidoglykan"),
      tag: tx("only Gram-negative", "nur gramnegativ"),
      role: tx("A bushing in the murein layer.", "Eine Lagerbuchse in der Mureinschicht."),
      facts: [tx("Gram-positive bacteria have only the MS ring and the C ring.", "Grampositive Bakterien haben nur MS-Ring und C-Ring.")],
      clue: tx("holds the shaft in the murein layer", "die Welle in der Mureinschicht lagert"),
    },
    msring: {
      name: tx("MS ring", "MS-Ring"),
      aka: tx("FliF; membrane and supramembrane ring", "FliF; Membran- und supramembranöser Ring"),
      tag: tx("rotor", "Rotor"),
      role: tx("The rotor in the cytoplasmic membrane, and the foundation the whole flagellum is built on.", "Der Rotor in der Cytoplasmamembran und das Fundament, auf dem die ganze Geißel gebaut wird."),
      facts: [tx("Made of the protein FliF; turns with the shaft and the C ring.", "Aus dem Protein FliF; dreht sich mit Welle und C-Ring.")],
      clue: tx("is the rotor in the cytoplasmic membrane", "der Rotor in der Cytoplasmamembran ist"),
    },
    cring: {
      name: tx("C ring", "C-Ring"),
      aka: tx("switch complex: FliG, FliM, FliN", "Schaltkomplex: FliG, FliM, FliN"),
      tag: tx("switch", "Schalter"),
      role: tx("A ring in the cytoplasm that switches the direction of rotation.", "Ein Ring im Cytoplasma, der die Drehrichtung umschaltet."),
      facts: [
        tx("The chemotaxis signal CheY-P binds to it: the motor switches to clockwise and the cell tumbles.", "Das Chemotaxis-Signal CheY-P bindet daran: Der Motor schaltet auf Uhrzeigersinn, die Zelle taumelt."),
        tx("FliG meets the stator proteins here: this is where the torque is made.", "FliG trifft hier auf die Stator-Proteine: Hier entsteht das Drehmoment."),
      ],
      clue: tx("switches the direction of rotation", "die Drehrichtung umschaltet"),
    },
    stator: {
      name: tx("Stator (MotA/MotB)", "Stator (MotA/MotB)"),
      aka: tx("proton channels", "Protonenkanäle"),
      tag: tx("drive", "Antrieb"),
      role: tx("Protein complexes fixed in the membrane: protons flow through them into the cell, and each passage pushes the rotor a little further.", "Fest in der Membran verankerte Proteinkomplexe: Protonen strömen durch sie in die Zelle, und jeder Durchtritt schiebt den Rotor ein Stück weiter."),
      facts: [
        tx("Driven by the proton motive force (Δp), not by ATP; some vibrios use Na⁺ ions instead.", "Angetrieben von der protonenmotorischen Kraft (Δp), nicht von ATP; manche Vibrionen nutzen stattdessen Na⁺-Ionen."),
        tx("MotB anchors the stator to the murein.", "MotB verankert den Stator am Murein."),
        tx("Roughly 1000 protons per turn; up to several hundred turns per second.", "Rund 1000 Protonen pro Umdrehung; bis zu mehreren hundert Umdrehungen pro Sekunde."),
      ],
      clue: tx("lets protons flow in and so makes the rotation", "Protonen einströmen lässt und so die Drehung erzeugt"),
    },
    export: {
      name: tx("Export apparatus", "Exportapparat"),
      aka: tx("type III secretion system", "Typ-III-Sekretionssystem"),
      role: tx("Pushes the building blocks of rod, hook and filament out through the hollow channel.", "Schleust die Bausteine für Welle, Haken und Filament durch den hohlen Kanal nach außen."),
      facts: [tx("Related to the injection needle that pathogens such as Salmonella use to inject proteins into our cells.", "Verwandt mit der Injektionsnadel, mit der Erreger wie Salmonella Proteine in unsere Zellen spritzen.")],
      clue: tx("pushes the building blocks out through the channel", "die Bausteine durch den Kanal nach außen schleust"),
    },
  },
  questions: [
    {
      q: tx("What drives the flagellar motor?", "Was treibt den Geißelmotor an?"),
      options: [tx("A proton gradient (proton motive force)", "Ein Protonengradient (protonenmotorische Kraft)"), tx("ATP split at the filament", "ATP-Spaltung am Filament"), tx("Light", "Licht"), tx("Calcium ions from outside", "Calcium-Ionen von außen")],
      correct: 0,
    },
    {
      q: tx("Which rings do Gram-positive bacteria lack?", "Welche Ringe fehlen grampositiven Bakterien?"),
      options: [tx("The L and P rings", "L- und P-Ring"), tx("The MS and C rings", "MS- und C-Ring"), tx("Only the C ring", "Nur der C-Ring"), tx("None", "Keiner")],
      correct: 0,
      why: tx("No outer membrane, no thin murein layer in a periplasm: so no L ring and no P ring.", "Keine äußere Membran und keine dünne Mureinschicht im Periplasma: also kein L- und kein P-Ring."),
    },
    {
      q: tx("E. coli's motors switch to clockwise. What happens?", "Die Motoren von E. coli schalten auf Uhrzeigersinn. Was passiert?"),
      options: [tx("The cell tumbles and changes direction", "Die Zelle taumelt und ändert die Richtung"), tx("It swims straight on, faster", "Sie schwimmt schneller geradeaus"), tx("It sheds its flagella", "Sie wirft die Geißeln ab"), tx("It divides", "Sie teilt sich")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const CONTENT: ModelContent = { slug: "bacterial-cell", views: { structure: STRUCTURE, shapes: SHAPES, flagella: FLAGELLA, motor: MOTOR } };
