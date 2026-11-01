import { tx } from "@/i18n/text";
import type { ModelContent, PartsContent } from "../../types";

/** The bacterial cell envelope: Gram-positive, Gram-negative, and murein down to the molecule. */

export const GRAM_POSITIVE = {
  kind: "parts",
  title: tx("Gram-positive", "Grampositiv"),
  intro: tx(
    "The cell envelope of a Gram-positive bacterium such as Staphylococcus or Bacillus, in section: a thick murein layer with teichoic acids on top of one single membrane. Outside is at the top.",
    "Die Zellhülle eines grampositiven Bakteriums wie Staphylococcus oder Bacillus im Schnitt: eine dicke Mureinschicht mit Teichonsäuren auf einer einzigen Membran. Außen ist oben.",
  ),
  parts: {
    murein: {
      name: tx("Thick murein layer", "Dicke Mureinschicht"),
      aka: tx("peptidoglycan, 20–80 nm, up to 40 layers", "Peptidoglykan, 20–80 nm, bis zu 40 Lagen"),
      tag: tx("Gram-positive", "grampositiv"),
      role: tx(
        "Up to 40 layers of murein on top of each other: makes the wall thick and strong, and in the Gram stain it holds on to the dye–iodine complex.",
        "Bis zu 40 Lagen Murein übereinander: macht die Wand dick und fest und hält bei der Gramfärbung den Farbstoff-Iod-Komplex fest.",
      ),
      facts: [
        tx("40 to 90 % of the dry mass of the wall.", "40 bis 90 % der Trockenmasse der Zellwand."),
        tx("In Staphylococcus aureus the peptides are linked by bridges of five glycines (pentaglycine).", "Bei Staphylococcus aureus sind die Peptide über Brücken aus fünf Glycinen verbunden (Pentaglycin)."),
        tx("Lies open on the outside: penicillin and lysozyme reach it easily.", "Liegt offen außen: Penicillin und Lysozym erreichen es leicht."),
      ],
      tip: tx("Thick murein = Gram-positive = violet.", "Dickes Murein = grampositiv = violett."),
      clue: tx("makes the Gram-positive wall thick and keeps the dye in the Gram stain", "die grampositive Wand dick macht und bei der Gramfärbung den Farbstoff festhält"),
    },
    teichoic: {
      name: tx("Teichoic acids", "Teichonsäuren"),
      aka: tx("wall teichoic acids", "Wandteichonsäuren"),
      tag: tx("only Gram-positive", "nur grampositiv"),
      role: tx(
        "Long chains of glycerol or ribitol phosphate, bound covalently to the murein: they give the wall a negative charge.",
        "Lange Ketten aus Glycerin- oder Ribitolphosphat, kovalent an das Murein gebunden: Sie geben der Wand eine negative Ladung.",
      ),
      facts: [
        tx("Anchored to N-acetylmuramic acid in the murein.", "An der N-Acetylmuraminsäure des Mureins verankert."),
        tx("Bind Mg²⁺ and Ca²⁺ ions and keep them at the cell surface.", "Binden Mg²⁺- und Ca²⁺-Ionen und halten sie an der Zelloberfläche."),
        tx("Important surface antigens; help to stick to host cells.", "Wichtige Oberflächenantigene; helfen beim Anheften an Wirtszellen."),
      ],
      clue: tx("is bound to the murein and gives the wall a negative charge", "an das Murein gebunden ist und der Wand eine negative Ladung gibt"),
    },
    lipoteichoic: {
      name: tx("Lipoteichoic acids", "Lipoteichonsäuren"),
      aka: tx("LTA", "LTA"),
      tag: tx("only Gram-positive", "nur grampositiv"),
      role: tx(
        "Teichoic acids with a lipid anchor in the cytoplasmic membrane: they run through the whole murein layer and tie membrane and wall together.",
        "Teichonsäuren mit einem Lipidanker in der Cytoplasmamembran: Sie ziehen durch die ganze Mureinschicht und verbinden Membran und Wand.",
      ),
      facts: [
        tx("Trigger inflammation in the host, like LPS in Gram-negatives, but weaker.", "Lösen beim Wirt Entzündungen aus, ähnlich wie LPS bei Gramnegativen, aber schwächer."),
      ],
      tip: tx("Teichoic acid: anchored in the murein. Lipoteichoic acid: anchored in the membrane.", "Teichonsäure: im Murein verankert. Lipoteichonsäure: in der Membran verankert."),
      clue: tx("is anchored with a lipid in the cytoplasmic membrane", "mit einem Lipid in der Cytoplasmamembran verankert ist"),
    },
    surface: {
      name: tx("Surface proteins", "Oberflächenproteine"),
      aka: tx("such as protein A and M protein", "z. B. Protein A und M-Protein"),
      role: tx(
        "Proteins anchored in the murein by the enzyme sortase: for sticking to hosts, for hiding from the immune system and for taking up nutrients.",
        "Proteine, die das Enzym Sortase im Murein verankert: zum Anheften an Wirte, zum Tarnen vor dem Immunsystem und zur Aufnahme von Nährstoffen.",
      ),
      facts: [
        tx("Protein A of Staphylococcus aureus binds antibodies the wrong way round (at the Fc part) and so disguises the bacterium.", "Protein A von Staphylococcus aureus bindet Antikörper falsch herum (am Fc-Teil) und tarnt so das Bakterium."),
        tx("M protein of Streptococcus pyogenes protects against phagocytosis.", "Das M-Protein von Streptococcus pyogenes schützt vor Phagozytose."),
      ],
      clue: tx("is anchored in the murein and helps to hide from antibodies", "im Murein verankert ist und hilft, sich vor Antikörpern zu tarnen"),
    },
    pbp: {
      name: tx("Penicillin-binding proteins", "Penicillin-bindende Proteine"),
      aka: tx("PBPs, transpeptidases", "PBP, Transpeptidasen"),
      tag: tx("target of penicillin", "Ziel von Penicillin"),
      role: tx(
        "Enzymes on the outer face of the membrane that build in new murein and link the peptides together (transpeptidation).",
        "Enzyme an der Außenseite der Membran, die neues Murein einbauen und die Peptide miteinander verknüpfen (Transpeptidierung).",
      ),
      facts: [
        tx("Penicillin binds to them and blocks the cross-linking: a growing cell bursts.", "Penicillin bindet an sie und blockiert die Quervernetzung: Eine wachsende Zelle platzt."),
        tx("MRSA has an altered PBP (PBP2a) that methicillin hardly binds to.", "MRSA hat ein verändertes PBP (PBP2a), an das Methicillin kaum bindet."),
      ],
      tip: tx("Penicillin only kills bacteria that grow: resting cells build no new murein.", "Penicillin tötet nur wachsende Bakterien: Ruhende Zellen bauen kein neues Murein ein."),
      clue: tx("builds new murein on the outer face of the membrane and links its peptides", "an der Außenseite der Membran neues Murein einbaut und seine Peptide verknüpft"),
    },
    membrane: {
      name: tx("Cytoplasmic membrane", "Cytoplasmamembran"),
      aka: tx("the only membrane here", "die einzige Membran hier"),
      role: tx("A phospholipid bilayer under the murein: the real barrier of the cell, with transporters and the respiratory chain.", "Eine Phospholipid-Doppelschicht unter dem Murein: die eigentliche Grenze der Zelle, mit Transportern und Atmungskette."),
      facts: [
        tx("Gram-positives have only this one membrane.", "Grampositive haben nur diese eine Membran."),
        tx("Between membrane and murein there is only a narrow gap, not a real periplasm as in Gram-negatives.", "Zwischen Membran und Murein liegt nur ein schmaler Spalt, kein echtes Periplasma wie bei Gramnegativen."),
      ],
      clue: tx("is the real barrier of the cell and carries the respiratory chain", "die eigentliche Grenze der Zelle ist und die Atmungskette trägt"),
    },
  },
  questions: [
    {
      q: tx("Why do Gram-positive bacteria stay violet in the Gram stain?", "Warum bleiben grampositive Bakterien bei der Gramfärbung violett?"),
      options: [
        tx("Their thick murein holds the crystal violet–iodine complex", "Ihr dickes Murein hält den Kristallviolett-Iod-Komplex fest"),
        tx("Their outer membrane keeps the alcohol out", "Ihre äußere Membran hält den Alkohol ab"),
        tx("They take up no safranin", "Sie nehmen kein Safranin auf"),
        tx("Their capsule stains violet", "Ihre Kapsel färbt sich violett"),
      ],
      correct: 0,
      why: tx("Alcohol dehydrates the thick murein and its pores shrink: the dye–iodine complex can't get out.", "Alkohol entwässert das dicke Murein, seine Poren ziehen sich zusammen: Der Farbstoff-Iod-Komplex kommt nicht mehr heraus."),
    },
    {
      q: tx("What are lipoteichoic acids?", "Was sind Lipoteichonsäuren?"),
      options: [
        tx("Teichoic acids anchored in the membrane by a lipid", "Teichonsäuren, die mit einem Lipid in der Membran verankert sind"),
        tx("Fats stored in the cytoplasm", "Im Cytoplasma gespeicherte Fette"),
        tx("The lipid part of LPS", "Der Lipidteil des LPS"),
        tx("Enzymes that build murein", "Enzyme, die Murein aufbauen"),
      ],
      correct: 0,
    },
    {
      q: tx("How does penicillin kill bacteria?", "Wie tötet Penicillin Bakterien?"),
      options: [
        tx("It blocks the cross-linking of murein", "Es blockiert die Quervernetzung des Mureins"),
        tx("It dissolves the cytoplasmic membrane", "Es löst die Cytoplasmamembran auf"),
        tx("It stops the 70S ribosomes", "Es hemmt die 70S-Ribosomen"),
        tx("It cuts the DNA", "Es zerschneidet die DNA"),
      ],
      correct: 0,
      why: tx("Penicillin binds the transpeptidases (PBPs). Without cross-links the wall gets weak and the growing cell bursts.", "Penicillin bindet die Transpeptidasen (PBP). Ohne Quervernetzung wird die Wand schwach und die wachsende Zelle platzt."),
    },
    {
      q: tx("Which enzyme in tears and saliva breaks down murein?", "Welches Enzym in Tränen und Speichel baut Murein ab?"),
      options: [tx("Lysozyme", "Lysozym"), tx("Amylase", "Amylase"), tx("Pepsin", "Pepsin"), tx("Lipase", "Lipase")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const GRAM_NEGATIVE = {
  kind: "parts",
  title: tx("Gram-negative", "Gramnegativ"),
  intro: tx(
    "The cell envelope of a Gram-negative bacterium such as E. coli or Salmonella: two membranes, and between them the periplasm with a thin murein layer. The outer membrane carries lipopolysaccharide (LPS). Outside is at the top.",
    "Die Zellhülle eines gramnegativen Bakteriums wie E. coli oder Salmonella: zwei Membranen und dazwischen das Periplasma mit einer dünnen Mureinschicht. Die äußere Membran trägt Lipopolysaccharid (LPS). Außen ist oben.",
  ),
  parts: {
    oantigen: {
      name: tx("O antigen", "O-Antigen"),
      aka: tx("O-specific polysaccharide chain of LPS", "O-spezifische Polysaccharidkette des LPS"),
      tag: tx("LPS, outer part", "LPS, äußerer Teil"),
      role: tx("The outermost sugar chain of LPS: it differs from strain to strain, so it is an important antigen.", "Die äußerste Zuckerkette des LPS: Sie ist von Stamm zu Stamm verschieden und darum ein wichtiges Antigen."),
      facts: [
        tx("Made of repeating units of a few sugars, often dozens of times.", "Aus sich wiederholenden Einheiten weniger Zucker, oft Dutzende Male."),
        tx("Basis of serotyping: E. coli O157, the Salmonella serovars (Kauffmann-White scheme).", "Grundlage der Serotypisierung: E. coli O157, die Salmonella-Serovare (Kauffmann-White-Schema)."),
        tx("Missing in rough (R) forms, which makes their colonies look rough.", "Fehlt bei rauen (R-)Formen, deren Kolonien darum rau aussehen."),
      ],
      clue: tx("is the outermost sugar chain and tells serotypes apart", "die äußerste Zuckerkette ist und Serotypen unterscheidet"),
    },
    core: {
      name: tx("Core oligosaccharide", "Kern-Oligosaccharid"),
      aka: tx("LPS core", "Core-Region des LPS"),
      tag: tx("LPS, middle part", "LPS, mittlerer Teil"),
      role: tx("A short, branched sugar chain that joins lipid A to the O antigen.", "Eine kurze, verzweigte Zuckerkette, die Lipid A mit dem O-Antigen verbindet."),
      facts: [
        tx("Contains unusual sugars such as KDO (keto-deoxyoctulosonic acid) and heptoses.", "Enthält besondere Zucker wie KDO (Ketodesoxyoctonsäure) und Heptosen."),
        tx("Fairly uniform within a genus.", "Innerhalb einer Gattung recht einheitlich."),
      ],
      clue: tx("joins lipid A to the O antigen", "Lipid A mit dem O-Antigen verbindet"),
    },
    lipida: {
      name: tx("Lipid A", "Lipid A"),
      aka: tx("endotoxin", "Endotoxin"),
      tag: tx("LPS anchor", "Anker des LPS"),
      role: tx(
        "The lipid anchor of LPS in the outer membrane. When bacteria fall apart it is set free and acts as endotoxin.",
        "Der Lipidanker des LPS in der äußeren Membran. Zerfallen die Bakterien, wird es frei und wirkt als Endotoxin.",
      ),
      facts: [
        tx("Two glucosamines with several fatty acids.", "Zwei Glucosamine mit mehreren Fettsäuren."),
        tx("Endotoxin causes fever (pyrogen) and, at worst, septic shock.", "Endotoxin löst Fieber aus (Pyrogen) und im schlimmsten Fall einen septischen Schock."),
        tx("Heat-stable: autoclaving doesn't destroy it. Glassware is depyrogenated with dry heat, for example 250 °C.", "Hitzestabil: Autoklavieren zerstört es nicht. Glas wird mit trockener Hitze depyrogenisiert, z. B. bei 250 °C."),
        tx("Detected with the LAL test (Limulus amoebocyte lysate), required for infusions.", "Nachweis mit dem LAL-Test (Limulus-Amöbozyten-Lysat), Pflicht für Infusionslösungen."),
      ],
      tip: tx("Endotoxin = lipid A, part of the wall. Exotoxins = proteins that bacteria release.", "Endotoxin = Lipid A, Teil der Zellwand. Exotoxine = Proteine, die Bakterien ausscheiden."),
      clue: tx("acts as endotoxin and causes fever", "als Endotoxin wirkt und Fieber auslöst"),
    },
    outer: {
      name: tx("Outer membrane", "Äußere Membran"),
      aka: tx("LPS outside, phospholipids inside", "außen LPS, innen Phospholipide"),
      tag: tx("only Gram-negative", "nur gramnegativ"),
      role: tx(
        "A second, lopsided lipid bilayer: LPS on the outer face, phospholipids on the inner one. It keeps out many antibiotics, detergents and bile salts.",
        "Eine zweite, asymmetrische Lipid-Doppelschicht: außen LPS, innen Phospholipide. Sie hält viele Antibiotika, Detergenzien und Gallensalze ab.",
      ),
      facts: [
        tx("Small molecules get through porins.", "Kleine Moleküle gelangen durch Porine hindurch."),
        tx("The reason why penicillin G and lysozyme work poorly on Gram-negatives.", "Der Grund, warum Penicillin G und Lysozym bei Gramnegativen schlecht wirken."),
        tx("In the Gram stain, the alcohol dissolves its lipids.", "Bei der Gramfärbung löst der Alkohol ihre Lipide heraus."),
      ],
      clue: tx("carries LPS and keeps out bile salts and many antibiotics", "LPS trägt und Gallensalze und viele Antibiotika abhält"),
    },
    porin: {
      name: tx("Porins", "Porine"),
      aka: tx("such as OmpF and OmpC in E. coli", "z. B. OmpF und OmpC bei E. coli"),
      role: tx("Channel proteins in the outer membrane, mostly in threes (trimers): they let small, water-soluble molecules pass by diffusion.", "Kanalproteine in der äußeren Membran, meist zu dritt (Trimere): Sie lassen kleine, wasserlösliche Moleküle durch Diffusion hindurch."),
      facts: [
        tx("Pass molecules up to about 600 Da: sugars, amino acids, ions.", "Lassen Moleküle bis etwa 600 Da durch: Zucker, Aminosäuren, Ionen."),
        tx("Fewer or altered porins make bacteria resistant to some antibiotics.", "Weniger oder veränderte Porine machen Bakterien gegen manche Antibiotika resistent."),
      ],
      clue: tx("lets small molecules through the outer membrane", "kleine Moleküle durch die äußere Membran lässt"),
    },
    lipoprotein: {
      name: tx("Braun's lipoprotein", "Braun-Lipoprotein"),
      aka: tx("murein lipoprotein, Lpp", "Mureinlipoprotein, Lpp"),
      role: tx("Ties the outer membrane to the murein: one end sits in the membrane by its lipid, the other is bound covalently to the murein.", "Verankert die äußere Membran am Murein: Ein Ende steckt mit seinem Lipid in der Membran, das andere ist kovalent ans Murein gebunden."),
      facts: [tx("One of the most common proteins of E. coli; it holds the envelope together.", "Eines der häufigsten Proteine von E. coli; es hält die Hülle zusammen.")],
      clue: tx("ties the outer membrane to the murein", "die äußere Membran am Murein verankert"),
    },
    periplasm: {
      name: tx("Periplasm", "Periplasma"),
      aka: tx("periplasmic space", "periplasmatischer Raum"),
      role: tx("The gel-like space between the outer and the cytoplasmic membrane, with the thin murein layer inside.", "Der gelartige Raum zwischen äußerer Membran und Cytoplasmamembran, mit der dünnen Mureinschicht darin."),
      facts: [
        tx("Holds binding proteins for transport and digestive enzymes such as phosphatases and proteases.", "Enthält Bindeproteine für den Transport und abbauende Enzyme wie Phosphatasen und Proteasen."),
        tx("Here β-lactamases wait that destroy penicillins before they reach the murein.", "Hier warten β-Lactamasen, die Penicilline zerstören, bevor sie das Murein erreichen."),
      ],
      clue: tx("is the space between the two membranes", "der Raum zwischen den beiden Membranen ist"),
    },
    thin: {
      name: tx("Thin murein layer", "Dünne Mureinschicht"),
      aka: tx("peptidoglycan, about 2–7 nm", "Peptidoglykan, etwa 2–7 nm"),
      tag: tx("Gram-negative", "gramnegativ"),
      role: tx("Only one or a few layers of murein, lying in the periplasm.", "Nur eine oder wenige Lagen Murein, die im Periplasma liegen."),
      facts: [
        tx("Only about 10 % of the dry mass of the wall.", "Nur etwa 10 % der Trockenmasse der Zellwand."),
        tx("Peptides linked directly (diaminopimelic acid to D-alanine), with no bridge.", "Peptide direkt verknüpft (Diaminopimelinsäure mit D-Alanin), ohne Brücke."),
        tx("Too thin to hold the dye in the Gram stain.", "Zu dünn, um bei der Gramfärbung den Farbstoff festzuhalten."),
      ],
      clue: tx("is the net of sugar chains and peptides that keeps the cell from bursting", "das Netz aus Zuckerketten und Peptiden ist, das die Zelle vor dem Platzen schützt"),
    },
    inner: {
      name: tx("Cytoplasmic membrane", "Cytoplasmamembran"),
      aka: tx("inner membrane", "innere Membran"),
      role: tx("The inner membrane: a phospholipid bilayer with the respiratory chain, transporters and the enzymes that build murein.", "Die innere Membran: eine Phospholipid-Doppelschicht mit Atmungskette, Transportern und den Enzymen für den Mureinaufbau."),
      facts: [tx("The real barrier for everything that gets past the outer membrane.", "Die eigentliche Barriere für alles, was durch die äußere Membran kommt.")],
      clue: tx("carries the respiratory chain and the enzymes that build murein", "die Atmungskette und die Enzyme für den Mureinaufbau trägt"),
    },
  },
  questions: [
    {
      q: tx("What is the endotoxin of Gram-negative bacteria?", "Was ist das Endotoxin gramnegativer Bakterien?"),
      options: [tx("Lipid A of LPS", "Lipid A des LPS"), tx("The O antigen", "Das O-Antigen"), tx("A protein they release", "Ein ausgeschiedenes Protein"), tx("The murein", "Das Murein")],
      correct: 0,
    },
    {
      q: tx("LPS from the inside out:", "Der Aufbau des LPS von innen nach außen:"),
      options: [
        tx("Lipid A, core oligosaccharide, O antigen", "Lipid A, Kern-Oligosaccharid, O-Antigen"),
        tx("O antigen, lipid A, core oligosaccharide", "O-Antigen, Lipid A, Kern-Oligosaccharid"),
        tx("Core oligosaccharide, O antigen, lipid A", "Kern-Oligosaccharid, O-Antigen, Lipid A"),
        tx("Lipid A, O antigen, core oligosaccharide", "Lipid A, O-Antigen, Kern-Oligosaccharid"),
      ],
      correct: 0,
    },
    {
      q: tx("Where is the murein in a Gram-negative bacterium?", "Wo liegt bei einem gramnegativen Bakterium das Murein?"),
      options: [tx("In the periplasm, between the two membranes", "Im Periplasma zwischen den beiden Membranen"), tx("Outside the outer membrane", "Außen auf der äußeren Membran"), tx("In the cytoplasm", "Im Cytoplasma"), tx("It has none", "Es hat keins")],
      correct: 0,
    },
    {
      q: tx("Why does penicillin G work poorly on many Gram-negatives?", "Warum wirkt Penicillin G bei vielen Gramnegativen schlecht?"),
      options: [
        tx("The outer membrane keeps it away from the murein", "Die äußere Membran hält es vom Murein fern"),
        tx("They have no murein", "Sie haben kein Murein"),
        tx("Their ribosomes are different", "Ihre Ribosomen sind anders"),
        tx("Their capsule digests it", "Ihre Kapsel verdaut es"),
      ],
      correct: 0,
      why: tx("The outer membrane lets little through, and β-lactamases in the periplasm destroy what gets in.", "Die äußere Membran lässt wenig durch, und β-Lactamasen im Periplasma zerstören, was hineinkommt."),
    },
    {
      q: tx("What gets through porins?", "Was gelangt durch Porine?"),
      options: [tx("Small, water-soluble molecules", "Kleine, wasserlösliche Moleküle"), tx("Large proteins", "Große Proteine"), tx("Only water", "Nur Wasser"), tx("Fats", "Fette")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const MUREIN = {
  kind: "parts",
  title: tx("Murein", "Murein"),
  intro: tx(
    "Murein up close: sugar chains of two alternating sugars, held together by short peptides. Together they form a single giant bag-shaped molecule around the cell, the sacculus.",
    "Murein ganz nah: Zuckerketten aus zwei abwechselnden Zuckern, zusammengehalten von kurzen Peptiden. Zusammen bilden sie ein einziges riesiges, sackförmiges Molekül um die Zelle, den Sacculus.",
  ),
  parts: {
    nag: {
      name: tx("N-acetylglucosamine", "N-Acetylglucosamin"),
      aka: tx("NAG, GlcNAc", "NAG, GlcNAc"),
      tag: tx("sugar", "Zucker"),
      role: tx("One of the two sugars of the murein backbone. It carries no peptide.", "Einer der beiden Zucker im Rückgrat des Mureins. Er trägt kein Peptid."),
      facts: [tx("Also the building block of chitin (fungal walls, insect shells).", "Auch Baustein von Chitin (Pilzzellwände, Insektenpanzer).")],
      clue: tx("is the sugar without a peptide", "der Zucker ohne Peptid ist"),
    },
    nam: {
      name: tx("N-acetylmuramic acid", "N-Acetylmuraminsäure"),
      aka: tx("NAM, MurNAc", "NAM, MurNAc"),
      tag: tx("sugar", "Zucker"),
      role: tx("The second sugar: it carries the peptide side chain on its lactic acid group.", "Der zweite Zucker: Er trägt an seiner Milchsäuregruppe die Peptid-Seitenkette."),
      facts: [
        tx("Found only in bacteria. Latin murus means wall.", "Kommt nur bei Bakterien vor. Lateinisch murus heißt Mauer."),
        tx("NAG and NAM alternate along the chain: NAG–NAM–NAG–NAM.", "NAG und NAM wechseln sich in der Kette ab: NAG–NAM–NAG–NAM."),
      ],
      clue: tx("carries the peptide side chain", "die Peptid-Seitenkette trägt"),
    },
    glycosidic: {
      name: tx("β-1,4-glycosidic bond", "β-1,4-glycosidische Bindung"),
      aka: tx("between NAM and NAG", "zwischen NAM und NAG"),
      role: tx("Joins the sugars into long glycan strands.", "Verbindet die Zucker zu langen Glykanketten."),
      facts: [tx("Lysozyme (in tears, saliva and egg white) cuts exactly this bond between NAM and NAG.", "Lysozym (in Tränen, Speichel und Eiklar) spaltet genau diese Bindung zwischen NAM und NAG.")],
      tip: tx("Lysozyme cuts the sugars, penicillin stops the peptide links: two ways to break murein.", "Lysozym spaltet die Zucker, Penicillin verhindert die Peptidbrücken: zwei Wege, Murein zu knacken."),
      clue: tx("is cut by lysozyme", "von Lysozym gespalten wird"),
    },
    peptide: {
      name: tx("Tetrapeptide", "Tetrapeptid"),
      aka: tx("peptide side chain", "Peptid-Seitenkette"),
      role: tx("A short chain of four amino acids on each NAM: L-alanine, D-glutamic acid, meso-diaminopimelic acid (or L-lysine) and D-alanine.", "Eine kurze Kette aus vier Aminosäuren an jeder NAM: L-Alanin, D-Glutaminsäure, meso-Diaminopimelinsäure (oder L-Lysin) und D-Alanin."),
      facts: [
        tx("Contains D-amino acids: unusual, because proteins are built only from L-amino acids.", "Enthält D-Aminosäuren: ungewöhnlich, denn Proteine bestehen nur aus L-Aminosäuren."),
        tx("Position 3: diaminopimelic acid (DAP) in Gram-negatives, often L-lysine in Gram-positives.", "Position 3: Diaminopimelinsäure (DAP) bei Gramnegativen, oft L-Lysin bei Grampositiven."),
        tx("It is first made with five amino acids (…–D-Ala–D-Ala); linking cuts off the last D-alanine.", "Sie entsteht zuerst mit fünf Aminosäuren (…–D-Ala–D-Ala); beim Verknüpfen wird das letzte D-Alanin abgespalten."),
      ],
      clue: tx("hangs on NAM and contains D-amino acids", "an der NAM hängt und D-Aminosäuren enthält"),
    },
    crosslink: {
      name: tx("Cross-link", "Quervernetzung"),
      aka: tx("peptide bridge, transpeptidation", "Peptidbrücke, Transpeptidierung"),
      tag: tx("target of penicillin", "Ziel von Penicillin"),
      role: tx("Joins the peptides of neighbouring strands: only this turns many chains into one strong net.", "Verbindet die Peptide benachbarter Ketten: Erst dadurch wird aus vielen Ketten ein festes Netz."),
      facts: [
        tx("Gram-negatives: a direct bond from DAP to D-alanine.", "Gramnegative: direkte Bindung von DAP an D-Alanin."),
        tx("Staphylococcus aureus: a bridge of five glycines (pentaglycine).", "Staphylococcus aureus: eine Brücke aus fünf Glycinen (Pentaglycin)."),
        tx("Made by transpeptidases (PBPs). Penicillin's β-lactam ring looks like D-Ala–D-Ala and blocks them.", "Geknüpft von Transpeptidasen (PBP). Der β-Lactam-Ring von Penicillin ähnelt D-Ala–D-Ala und blockiert sie."),
      ],
      clue: tx("links the strands into a net and is stopped by penicillin", "die Ketten zu einem Netz verknüpft und von Penicillin verhindert wird"),
    },
    glycan: {
      name: tx("Glycan strand", "Glykankette"),
      aka: tx("sugar backbone", "Zuckerrückgrat"),
      role: tx("The long sugar chain of alternating NAG and NAM. Strands run around the cell like hoops on a barrel.", "Die lange Zuckerkette aus abwechselnd NAG und NAM. Die Ketten laufen um die Zelle wie Reifen um ein Fass."),
      facts: [tx("Often dozens of sugar pairs long; the strands lie side by side and are linked by the peptides.", "Oft Dutzende Zuckerpaare lang; die Ketten liegen nebeneinander und werden über die Peptide verknüpft.")],
      clue: tx("is the long chain of alternating sugars", "die lange Kette aus abwechselnden Zuckern ist"),
    },
  },
  questions: [
    {
      q: tx("Which bond does lysozyme cut?", "Welche Bindung spaltet Lysozym?"),
      options: [
        tx("The β-1,4 bond between NAM and NAG", "Die β-1,4-Bindung zwischen NAM und NAG"),
        tx("The peptide cross-links", "Die Peptid-Quervernetzungen"),
        tx("Hydrogen bonds in the DNA", "Wasserstoffbrücken in der DNA"),
        tx("The ester bonds of the membrane", "Die Esterbindungen der Membran"),
      ],
      correct: 0,
    },
    {
      q: tx("Which sugar carries the peptide side chain?", "Welcher Zucker trägt die Peptid-Seitenkette?"),
      options: [tx("N-acetylmuramic acid (NAM)", "N-Acetylmuraminsäure (NAM)"), tx("N-acetylglucosamine (NAG)", "N-Acetylglucosamin (NAG)"), tx("Glucose", "Glucose"), tx("Ribose", "Ribose")],
      correct: 0,
    },
    {
      q: tx("Why does penicillin fit into the transpeptidases?", "Warum passt Penicillin in die Transpeptidasen?"),
      options: [
        tx("Its β-lactam ring looks like D-Ala–D-Ala", "Sein β-Lactam-Ring ähnelt D-Ala–D-Ala"),
        tx("It looks like NAG", "Es ähnelt NAG"),
        tx("It is a sugar", "Es ist ein Zucker"),
        tx("It looks like ATP", "Es ähnelt ATP"),
      ],
      correct: 0,
    },
    {
      q: tx("What is unusual about the peptides of murein?", "Was ist an den Peptiden des Mureins ungewöhnlich?"),
      options: [tx("They contain D-amino acids", "Sie enthalten D-Aminosäuren"), tx("They contain sulphur", "Sie enthalten Schwefel"), tx("They are hundreds of amino acids long", "Sie sind Hunderte Aminosäuren lang"), tx("They are made in the nucleus", "Sie werden im Zellkern gebildet")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const CONTENT: ModelContent = { slug: "cell-wall", views: { "gram-positive": GRAM_POSITIVE, "gram-negative": GRAM_NEGATIVE, murein: MUREIN } };
