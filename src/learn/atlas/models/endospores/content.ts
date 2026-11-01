import { tx } from "@/i18n/text";
import type { ModelContent, PartsContent, StepsContent } from "../../types";

/** Endospores: their layers, how they form and wake up, and where they sit in the cell. */

export const STRUCTURE = {
  kind: "parts",
  title: tx("Structure", "Aufbau"),
  intro: tx(
    "A mature endospore of Bacillus in section, from the outside in. Endospores are dormant survival forms, not a way to multiply: one cell makes exactly one spore.",
    "Eine reife Endospore von Bacillus im Schnitt, von außen nach innen. Endosporen sind ruhende Dauerformen, keine Vermehrung: Aus einer Zelle entsteht genau eine Spore.",
  ),
  parts: {
    exosporium: {
      name: tx("Exosporium", "Exosporium"),
      aka: tx("outermost, loose layer", "äußerste, lockere Schicht"),
      tag: tx("not in every species", "nicht bei jeder Art"),
      role: tx("A thin, loose outer layer of proteins and glycoproteins. Only some species have it, such as Bacillus anthracis and B. cereus.", "Eine dünne, lockere Außenschicht aus Proteinen und Glykoproteinen. Nur manche Arten haben sie, etwa Bacillus anthracis und B. cereus."),
      facts: [tx("Helps the spore to stick to surfaces and plays a part in infection.", "Hilft der Spore beim Anheften an Oberflächen und spielt bei Infektionen eine Rolle.")],
      clue: tx("is the loose outer layer that not every spore has", "die lockere Außenschicht ist, die nicht jede Spore hat"),
    },
    coat: {
      name: tx("Spore coat", "Sporenhülle"),
      aka: tx("protein coat", "Sporenmantel"),
      tag: tx("chemical shield", "Schutz vor Chemikalien"),
      role: tx("Many layers of spore-specific proteins: they keep out many chemicals and enzymes such as lysozyme.", "Viele Schichten sporenspezifischer Proteine: Sie halten viele Chemikalien und Enzyme wie Lysozym ab."),
      facts: [
        tx("Rich in cross-linked, cysteine-rich proteins, a bit like keratin.", "Reich an quervernetzten, cysteinreichen Proteinen, ein wenig wie Keratin."),
        tx("Built by the mother cell layer by layer.", "Wird von der Mutterzelle Schicht für Schicht aufgebaut."),
        tx("Makes spores hard to stain: the spore stain needs heat (malachite green, Schaeffer-Fulton).", "Macht Sporen schwer anfärbbar: Die Sporenfärbung braucht Hitze (Malachitgrün nach Schaeffer-Fulton)."),
      ],
      clue: tx("is made of many protein layers and keeps out chemicals and lysozyme", "aus vielen Proteinschichten besteht und Chemikalien und Lysozym abhält"),
    },
    outermembrane: {
      name: tx("Outer spore membrane", "Äußere Sporenmembran"),
      aka: tx("from the mother cell", "aus der Mutterzelle"),
      role: tx("A membrane that comes from the mother cell during engulfment and wraps the forespore from outside.", "Eine Membran, die bei der Umschließung aus der Mutterzelle stammt und die Vorspore von außen umgibt."),
      facts: [tx("Lies between cortex and coat; in mature spores it hardly works as a barrier any more.", "Liegt zwischen Cortex und Hülle; bei reifen Sporen wirkt sie kaum noch als Barriere.")],
      clue: tx("comes from the mother cell and lies between cortex and coat", "aus der Mutterzelle stammt und zwischen Cortex und Hülle liegt"),
    },
    cortex: {
      name: tx("Cortex", "Cortex"),
      aka: tx("spore cortex, special murein", "Sporenrinde, besonderes Murein"),
      tag: tx("keeps the core dry", "hält den Kern trocken"),
      role: tx("A thick layer of loosely cross-linked, special murein. It keeps the core dehydrated, and that is the key to heat resistance.", "Eine dicke Schicht aus locker vernetztem, besonderem Murein. Sie hält den Kern entwässert, und das ist der Schlüssel zur Hitzeresistenz."),
      facts: [
        tx("Many NAM residues carry muramic δ-lactam instead of a peptide, so there are few cross-links.", "Viele NAM tragen Muramyl-δ-lactam statt eines Peptids, darum gibt es wenige Quervernetzungen."),
        tx("The first thing broken down when the spore germinates.", "Wird als Erstes abgebaut, wenn die Spore keimt."),
      ],
      clue: tx("keeps the spore core dry", "den Sporenkern trocken hält"),
    },
    germwall: {
      name: tx("Germ cell wall", "Keimzellwand"),
      aka: tx("primordial cell wall", "Primordialzellwand"),
      role: tx("A thin layer of ordinary murein right on the inner membrane: after germination it becomes the wall of the new cell.", "Eine dünne Schicht aus normalem Murein direkt auf der inneren Membran: Nach der Keimung wird sie zur Zellwand der neuen Zelle."),
      facts: [tx("Unlike the cortex, it survives germination.", "Anders als der Cortex übersteht sie die Keimung.")],
      clue: tx("becomes the cell wall of the new cell after germination", "nach der Keimung zur Zellwand der neuen Zelle wird"),
    },
    innermembrane: {
      name: tx("Inner spore membrane", "Innere Sporenmembran"),
      aka: tx("later the cytoplasmic membrane", "später die Cytoplasmamembran"),
      role: tx("The membrane around the core. Its lipids hardly move, so it lets almost nothing through, not even water.", "Die Membran um den Kern. Ihre Lipide sind kaum beweglich, darum lässt sie fast nichts durch, nicht einmal Wasser."),
      facts: [
        tx("Protects the core from chemicals such as many disinfectants.", "Schützt den Kern vor Chemikalien wie vielen Desinfektionsmitteln."),
        tx("Becomes the cytoplasmic membrane of the new cell.", "Wird zur Cytoplasmamembran der neuen Zelle."),
      ],
      clue: tx("surrounds the core and lets hardly anything through, not even water", "den Kern umgibt und kaum etwas durchlässt, nicht einmal Wasser"),
    },
    core: {
      name: tx("Spore core", "Sporenkern"),
      aka: tx("spore protoplast", "Sporenprotoplast, Core"),
      tag: tx("dormant", "ruhend"),
      role: tx("The inside: DNA, ribosomes and enzymes, but almost no free water, so the metabolism rests.", "Das Innere: DNA, Ribosomen und Enzyme, aber fast kein freies Wasser, darum ruht der Stoffwechsel."),
      facts: [
        tx("Only about 10 to 25 % of the water of a vegetative cell.", "Nur etwa 10 bis 25 % des Wassers einer vegetativen Zelle."),
        tx("Its pH is about one unit lower than in a growing cell.", "Sein pH-Wert liegt etwa eine Einheit tiefer als in einer wachsenden Zelle."),
        tx("Survives boiling. Only autoclaving (121 °C, 2 bar, at least 15 min) or dry heat (e.g. 180 °C for 30 min) kills spores for sure.", "Übersteht Kochen. Sicher töten nur Autoklavieren (121 °C, 2 bar, mindestens 15 min) oder trockene Hitze (z. B. 180 °C für 30 min)."),
      ],
      tip: tx("70 % ethanol doesn't kill spores: it can even be contaminated with them.", "70-prozentiger Alkohol tötet keine Sporen: Er kann sogar selbst Sporen enthalten."),
      clue: tx("holds DNA and ribosomes but hardly any water", "DNA und Ribosomen enthält, aber kaum Wasser"),
    },
    dpa: {
      name: tx("Calcium dipicolinate", "Calcium-Dipicolinat"),
      aka: tx("Ca-DPA, dipicolinic acid + Ca²⁺", "Ca-DPA, Dipicolinsäure + Ca²⁺"),
      tag: tx("only in spores", "nur in Sporen"),
      role: tx("A complex of dipicolinic acid and calcium ions in the core: it takes the place of water and stabilises DNA and proteins.", "Ein Komplex aus Dipicolinsäure und Calcium-Ionen im Kern: Er ersetzt Wasser und stabilisiert DNA und Proteine."),
      facts: [
        tx("About 10 % of the dry mass of the spore.", "Etwa 10 % der Trockenmasse der Spore."),
        tx("Made in the mother cell and pumped into the forespore.", "Wird in der Mutterzelle gebildet und in die Vorspore gepumpt."),
        tx("Released at the very start of germination.", "Wird ganz am Anfang der Keimung freigesetzt."),
      ],
      clue: tx("replaces water in the core and is found only in spores", "im Kern das Wasser ersetzt und nur in Sporen vorkommt"),
    },
    dna: {
      name: tx("DNA with SASPs", "DNA mit SASPs"),
      aka: tx("small acid-soluble spore proteins", "kleine säurelösliche Sporenproteine"),
      role: tx("The chromosome, tightly covered with small acid-soluble spore proteins (SASPs): they protect it from UV light, dry heat and chemicals.", "Das Chromosom, dicht bedeckt mit kleinen säurelöslichen Sporenproteinen (SASPs): Sie schützen es vor UV-Strahlung, trockener Hitze und Chemikalien."),
      facts: [tx("During germination the SASPs are broken down and supply amino acids for the new cell.", "Bei der Keimung werden die SASPs abgebaut und liefern Aminosäuren für die neue Zelle.")],
      clue: tx("is covered with small proteins that shield it from UV light", "mit kleinen Proteinen bedeckt ist, die sie vor UV-Licht schützen"),
    },
  },
  questions: [
    {
      q: tx("What do bacteria form endospores for?", "Wozu bilden Bakterien Endosporen?"),
      options: [tx("To survive bad conditions", "Um schlechte Bedingungen zu überdauern"), tx("To multiply", "Um sich zu vermehren"), tx("To swap DNA", "Um DNA auszutauschen"), tx("To store food", "Um Nahrung zu speichern")],
      correct: 0,
    },
    {
      q: tx("Which genera form endospores?", "Welche Gattungen bilden Endosporen?"),
      options: [tx("Bacillus and Clostridium", "Bacillus und Clostridium"), tx("Staphylococcus and Streptococcus", "Staphylococcus und Streptococcus"), tx("Escherichia and Salmonella", "Escherichia und Salmonella"), tx("Mycobacterium and Neisseria", "Mycobacterium und Neisseria")],
      correct: 0,
    },
    {
      q: tx("Which substance does the spore core contain that vegetative cells lack?", "Welchen Stoff enthält der Sporenkern, den vegetative Zellen nicht haben?"),
      options: [tx("Calcium dipicolinate", "Calcium-Dipicolinat"), tx("Glycogen", "Glykogen"), tx("Chlorophyll", "Chlorophyll"), tx("Cellulose", "Cellulose")],
      correct: 0,
    },
    {
      q: tx("How do you kill spores for sure?", "Wie tötet man Sporen sicher ab?"),
      options: [
        tx("Autoclave at 121 °C and 2 bar for at least 15 min", "Autoklavieren bei 121 °C und 2 bar, mindestens 15 min"),
        tx("Boil for 10 minutes", "10 Minuten kochen"),
        tx("Pasteurise at 72 °C", "Pasteurisieren bei 72 °C"),
        tx("Wipe with 70 % ethanol", "Mit 70 % Ethanol abwischen"),
      ],
      correct: 0,
      why: tx("Boiling, pasteurising and alcohol only kill vegetative cells. Autoclaves are checked with spores of Geobacillus stearothermophilus.", "Kochen, Pasteurisieren und Alkohol töten nur vegetative Zellen. Autoklaven prüft man mit Sporen von Geobacillus stearothermophilus."),
    },
    {
      q: tx("Which layer keeps the core dry?", "Welche Schicht hält den Kern trocken?"),
      options: [tx("The cortex", "Der Cortex"), tx("The exosporium", "Das Exosporium"), tx("The capsule", "Die Kapsel"), tx("The germ cell wall", "Die Keimzellwand")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const SPORULATION = {
  kind: "steps",
  title: tx("Sporulation", "Sporulation"),
  intro: tx(
    "How a Bacillus cell turns into a spore, stage by stage (0 to VII). It takes about eight hours, and the mother cell gives its life for the spore.",
    "Wie eine Bacillus-Zelle zur Spore wird, Stadium für Stadium (0 bis VII). Das dauert etwa acht Stunden, und die Mutterzelle opfert sich für die Spore.",
  ),
  steps: [
    {
      short: tx("0", "0"),
      title: tx("Stage 0: Starving cell", "Stadium 0: Hungernde Zelle"),
      body: tx("A growing cell runs short of nutrients, above all carbon or nitrogen. Instead of dividing, it starts the spore programme.", "Einer wachsenden Zelle gehen die Nährstoffe aus, vor allem Kohlenstoff oder Stickstoff. Statt sich zu teilen, startet sie das Sporenprogramm."),
      facts: [
        tx("The master switch is the regulator Spo0A, which is switched on by phosphorylation.", "Hauptschalter ist der Regulator Spo0A, der durch Phosphorylierung angeschaltet wird."),
        tx("Not reproduction: one cell becomes exactly one spore.", "Keine Vermehrung: Aus einer Zelle wird genau eine Spore."),
      ],
    },
    {
      short: tx("I", "I"),
      title: tx("Stage I: Axial filament", "Stadium I: Axialfilament"),
      body: tx("The DNA has been copied. The two chromosomes stretch into one long thread through the cell, the axial filament.", "Die DNA ist verdoppelt. Die beiden Chromosomen strecken sich zu einem langen Faden durch die Zelle, dem Axialfilament."),
    },
    {
      short: tx("II", "II"),
      title: tx("Stage II: Septum", "Stadium II: Septum"),
      body: tx("A wall (septum) splits the cell unevenly: a small forespore and a large mother cell, each with one chromosome.", "Eine Querwand (Septum) teilt die Zelle ungleich: eine kleine Vorspore und eine große Mutterzelle, jede mit einem Chromosom."),
      facts: [tx("From here on, the two compartments switch on different genes (sigma factors σF in the forespore, σE in the mother cell).", "Ab hier schalten beide Kompartimente unterschiedliche Gene an (Sigmafaktoren σF in der Vorspore, σE in der Mutterzelle).")],
    },
    {
      short: tx("III", "III"),
      title: tx("Stage III: Engulfment", "Stadium III: Umschließung"),
      body: tx("The mother cell grows around the forespore, a bit like phagocytosis. The forespore is now a cell inside a cell, wrapped in two membranes.", "Die Mutterzelle umwächst die Vorspore, ähnlich wie bei einer Phagozytose. Die Vorspore ist jetzt eine Zelle in der Zelle, umhüllt von zwei Membranen."),
      facts: [tx("Inner membrane: the forespore's own. Outer membrane: from the mother cell.", "Innere Membran: die eigene der Vorspore. Äußere Membran: aus der Mutterzelle.")],
    },
    {
      short: tx("IV", "IV"),
      title: tx("Stage IV: Cortex", "Stadium IV: Cortex"),
      body: tx("Between the two membranes the cortex and the germ cell wall are built. The forespore starts to lose water and takes up calcium dipicolinate from the mother cell.", "Zwischen den beiden Membranen entstehen Cortex und Keimzellwand. Die Vorspore beginnt Wasser zu verlieren und nimmt Calcium-Dipicolinat aus der Mutterzelle auf."),
    },
    {
      short: tx("V", "V"),
      title: tx("Stage V: Coat", "Stadium V: Sporenhülle"),
      body: tx("The mother cell lays layer upon layer of coat proteins around the spore, in some species also the exosporium.", "Die Mutterzelle legt Schicht um Schicht Hüllproteine um die Spore, bei manchen Arten auch das Exosporium."),
    },
    {
      short: tx("VI", "VI"),
      title: tx("Stage VI: Maturation", "Stadium VI: Reifung"),
      body: tx("The spore becomes resistant to heat and chemicals: the core dries out further and SASPs cover the DNA. In phase contrast it now shines bright.", "Die Spore wird resistent gegen Hitze und Chemikalien: Der Kern trocknet weiter aus, SASPs bedecken die DNA. Im Phasenkontrast leuchtet sie jetzt hell."),
      facts: [tx("Mature spores refract light strongly: phase-bright.", "Reife Sporen brechen das Licht stark: im Phasenkontrast hell.")],
    },
    {
      short: tx("VII", "VII"),
      title: tx("Stage VII: Release", "Stadium VII: Freisetzung"),
      body: tx("The mother cell bursts (lysis) and sets the finished spore free. It can now wait for years without any metabolism.", "Die Mutterzelle löst sich auf (Lyse) und gibt die fertige Spore frei. Sie kann jetzt jahrelang ohne Stoffwechsel überdauern."),
      facts: [tx("All of sporulation takes about 8 hours in Bacillus subtilis.", "Die ganze Sporulation dauert bei Bacillus subtilis etwa 8 Stunden.")],
      tip: tx("Order: axial filament, septum, engulfment, cortex, coat, maturation, lysis.", "Reihenfolge: Axialfilament, Septum, Umschließung, Cortex, Hülle, Reifung, Lyse."),
    },
  ],
  questions: [
    {
      q: tx("What sets off sporulation?", "Was löst die Sporulation aus?"),
      options: [tx("Lack of nutrients", "Nährstoffmangel"), tx("Plenty of nutrients", "Viele Nährstoffe"), tx("Light", "Licht"), tx("Antibiotics", "Antibiotika")],
      correct: 0,
    },
    {
      q: tx("How many spores does one cell make?", "Wie viele Sporen entstehen aus einer Zelle?"),
      options: [tx("Exactly one", "Genau eine"), tx("Two", "Zwei"), tx("Four", "Vier"), tx("Hundreds", "Hunderte")],
      correct: 0,
    },
    {
      q: tx("Who builds the spore coat?", "Wer baut die Sporenhülle?"),
      options: [tx("The mother cell", "Die Mutterzelle"), tx("The forespore itself", "Die Vorspore selbst"), tx("Neighbouring cells", "Nachbarzellen"), tx("Nobody: it forms by itself", "Niemand: sie entsteht von selbst")],
      correct: 0,
    },
    {
      q: tx("About how long does sporulation take in Bacillus subtilis?", "Wie lange dauert die Sporulation bei Bacillus subtilis ungefähr?"),
      options: [tx("About 8 hours", "Etwa 8 Stunden"), tx("About 10 minutes", "Etwa 10 Minuten"), tx("About 8 days", "Etwa 8 Tage"), tx("About 1 year", "Etwa 1 Jahr")],
      correct: 0,
    },
  ],
} satisfies StepsContent;

export const GERMINATION = {
  kind: "steps",
  title: tx("Germination", "Keimung"),
  intro: tx(
    "How a spore turns back into a growing cell: activation, germination and outgrowth.",
    "Wie aus einer Spore wieder eine wachsende Zelle wird: Aktivierung, Keimung und Auswachsen.",
  ),
  steps: [
    {
      short: tx("Activation", "Aktivierung"),
      title: tx("Activation", "Aktivierung"),
      body: tx("A dormant spore is woken up, for example by a short heat shock (about 60–80 °C for a few minutes).", "Eine ruhende Spore wird wachgerüttelt, zum Beispiel durch einen kurzen Hitzeschock (etwa 60–80 °C für einige Minuten)."),
      facts: [
        tx("Activation can be undone: the spore is still dormant.", "Die Aktivierung ist umkehrbar: Die Spore ruht noch."),
        tx("Labs use heat on purpose: 80 °C for 10 min kills vegetative cells and leaves only spore formers.", "Labore nutzen Hitze gezielt: 80 °C für 10 min tötet vegetative Zellen, übrig bleiben nur Sporenbildner."),
      ],
    },
    {
      short: tx("Germination", "Keimung"),
      title: tx("Germination", "Keimung"),
      body: tx(
        "Germinants such as L-alanine bind to receptors in the inner membrane. Calcium dipicolinate pours out, water rushes in and the cortex is broken down. The spore loses its resistance and turns dark in phase contrast.",
        "Keimungsauslöser wie L-Alanin binden an Rezeptoren in der inneren Membran. Calcium-Dipicolinat strömt hinaus, Wasser strömt hinein und der Cortex wird abgebaut. Die Spore verliert ihre Resistenz und wird im Phasenkontrast dunkel.",
      ),
      facts: [tx("Takes only minutes, and it can't be undone.", "Dauert nur Minuten und ist nicht umkehrbar."), tx("From here on the spore is sensitive to heat again.", "Ab hier ist die Spore wieder hitzeempfindlich.")],
    },
    {
      short: tx("Outgrowth", "Auswachsen"),
      title: tx("Outgrowth", "Auswachsen"),
      body: tx("The spore swells and its metabolism starts: RNA, proteins, then DNA. The new cell bursts out of the spore coat.", "Die Spore quillt auf und ihr Stoffwechsel startet: RNA, Proteine, dann DNA. Die neue Zelle sprengt die Sporenhülle."),
      facts: [tx("The SASPs are broken down and supply amino acids.", "Die SASPs werden abgebaut und liefern Aminosäuren.")],
    },
    {
      short: tx("Cell", "Zelle"),
      title: tx("Vegetative cell", "Vegetative Zelle"),
      body: tx("The young cell grows and divides normally again. The empty coat stays behind.", "Die junge Zelle wächst und teilt sich wieder ganz normal. Die leere Hülle bleibt zurück."),
      tip: tx(
        "This is why tyndallisation works: heat to 100 °C on three days in a row. In between, surviving spores germinate and die at the next heating.",
        "Darum funktioniert die Tyndallisation: an drei Tagen hintereinander auf 100 °C erhitzen. Dazwischen keimen überlebende Sporen aus und sterben beim nächsten Erhitzen.",
      ),
    },
  ],
  questions: [
    {
      q: tx("What activates dormant spores?", "Wodurch werden ruhende Sporen aktiviert?"),
      options: [tx("A short heat shock", "Einen kurzen Hitzeschock"), tx("Freezing", "Einfrieren"), tx("UV light", "UV-Licht"), tx("Penicillin", "Penicillin")],
      correct: 0,
    },
    {
      q: tx("What happens to calcium dipicolinate when a spore germinates?", "Was passiert bei der Keimung mit dem Calcium-Dipicolinat?"),
      options: [tx("It is released", "Es wird freigesetzt"), tx("It is made", "Es wird gebildet"), tx("It turns into murein", "Es wird zu Murein"), tx("Nothing", "Nichts")],
      correct: 0,
    },
    {
      q: tx("Why does tyndallisation also kill spores?", "Warum tötet die Tyndallisation auch Sporen?"),
      options: [
        tx("Between the heatings they germinate and die at the next one", "Zwischen den Erhitzungen keimen sie und sterben beim nächsten Erhitzen"),
        tx("100 °C kills spores at once", "100 °C tötet Sporen sofort"),
        tx("The cold between kills them", "Die Kälte dazwischen tötet sie"),
        tx("It doesn't", "Tut sie nicht"),
      ],
      correct: 0,
    },
  ],
} satisfies StepsContent;

export const POSITION = {
  kind: "parts",
  title: tx("Position", "Sporenlage"),
  intro: tx(
    "Where the spore sits in the cell, and whether it bulges the cell, helps to tell species apart under the microscope. The spore stain makes them visible.",
    "Wo die Spore in der Zelle liegt und ob sie die Zelle auftreibt, hilft beim Bestimmen unter dem Mikroskop. Die Sporenfärbung macht sie sichtbar.",
  ),
  parts: {
    central: {
      name: tx("Central", "Zentral"),
      aka: tx("in the middle", "mittelständig"),
      role: tx("The spore sits in the middle of the cell. Mostly it doesn't bulge the cell.", "Die Spore liegt in der Mitte der Zelle. Meist treibt sie die Zelle nicht auf."),
      facts: [tx("For example Bacillus anthracis and Bacillus subtilis.", "Zum Beispiel Bacillus anthracis und Bacillus subtilis.")],
      clue: tx("sits in the middle of the cell", "in der Mitte der Zelle liegt"),
    },
    subterminal: {
      name: tx("Subterminal", "Subterminal"),
      aka: tx("near one end", "nahe einem Ende"),
      role: tx("The spore sits close to one end, but not right at the end. It may bulge the cell a little.", "Die Spore liegt nahe einem Ende, aber nicht ganz am Ende. Sie kann die Zelle etwas auftreiben."),
      facts: [tx("For example Clostridium botulinum, often Bacillus cereus.", "Zum Beispiel Clostridium botulinum, oft Bacillus cereus.")],
      clue: tx("sits close to one end, but not right at it", "nahe einem Ende liegt, aber nicht ganz daran"),
    },
    terminal: {
      name: tx("Terminal", "Terminal"),
      aka: tx("right at the end", "endständig"),
      role: tx("The spore sits right at the end. When it is wider than the cell, the typical drumstick or tennis racket shape appears.", "Die Spore liegt ganz am Ende. Ist sie breiter als die Zelle, entsteht die typische Trommelschlegel- oder Tennisschlägerform."),
      facts: [
        tx("Clostridium tetani, the cause of tetanus: round terminal spore, drumstick shape.", "Clostridium tetani, Erreger des Wundstarrkrampfs: runde terminale Spore, Trommelschlegelform."),
        tx("Clostridium means little spindle: many clostridia bulge out where their spore sits.", "Clostridium heißt kleine Spindel: Viele Clostridien sind dort aufgetrieben, wo ihre Spore liegt."),
      ],
      clue: tx("sits right at the end and can give a drumstick shape", "ganz am Ende liegt und eine Trommelschlegelform geben kann"),
    },
    stain: {
      name: tx("Spore stain", "Sporenfärbung"),
      aka: tx("Schaeffer-Fulton", "nach Schaeffer-Fulton"),
      role: tx(
        "Malachite green is steamed into the spores. Water washes it out of the vegetative cells, then safranin stains them red: spores green, cells red.",
        "Malachitgrün wird unter Dampf in die Sporen gedrückt. Wasser wäscht es aus den vegetativen Zellen, dann färbt Safranin sie rot: Sporen grün, Zellen rot.",
      ),
      facts: [
        tx("The heat is needed because the spore coat keeps dyes out.", "Die Hitze ist nötig, weil die Sporenhülle Farbstoffe abhält."),
        tx("In a Gram stain, spores show only as unstained gaps in the cells.", "In der Gramfärbung erscheinen Sporen nur als ungefärbte Lücken in den Zellen."),
      ],
      clue: tx("shows spores green and cells red", "Sporen grün und Zellen rot zeigt"),
    },
  },
  questions: [
    {
      q: tx("Which pathogen has a terminal spore in a drumstick shape?", "Welcher Erreger hat eine terminale Spore in Trommelschlegelform?"),
      options: [tx("Clostridium tetani", "Clostridium tetani"), tx("Bacillus anthracis", "Bacillus anthracis"), tx("Escherichia coli", "Escherichia coli"), tx("Staphylococcus aureus", "Staphylococcus aureus")],
      correct: 0,
    },
    {
      q: tx("What colour are spores after the Schaeffer-Fulton stain?", "Welche Farbe haben Sporen nach der Färbung nach Schaeffer-Fulton?"),
      options: [tx("Green", "Grün"), tx("Red", "Rot"), tx("Violet", "Violett"), tx("Blue-black", "Blauschwarz")],
      correct: 0,
    },
  ],
} satisfies PartsContent;

export const CONTENT: ModelContent = { slug: "endospores", views: { structure: STRUCTURE, sporulation: SPORULATION, germination: GERMINATION, position: POSITION } };
