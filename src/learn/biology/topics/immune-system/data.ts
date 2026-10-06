// Facts and task banks for the immune-system topic (German school biology, Klasse 7 to Oberstufe).

import { tx, type Text } from "@/i18n/text";

// ---------------------------------------------------------------------------
// Pathogens and diseases

export type Kind = "bacteria" | "virus" | "fungus" | "parasite";
export const KINDS: Record<Kind, { name: Text; one: Text }> = {
  bacteria: { name: tx("Bacteria", "Bakterien"), one: tx("bacteria", "Bakterien") },
  virus: { name: tx("Viruses", "Viren"), one: tx("viruses", "Viren") },
  fungus: { name: tx("Fungi", "Pilze"), one: tx("fungi", "Pilze") },
  parasite: { name: tx("Parasites", "Parasiten"), one: tx("parasites", "Parasiten") },
};

export type Disease = { name: Text; kind: Kind };
export const DISEASES: Disease[] = [
  { name: tx("flu (influenza)", "Grippe (Influenza)"), kind: "virus" },
  { name: tx("a common cold", "Erkältung (Schnupfen)"), kind: "virus" },
  { name: tx("measles", "Masern"), kind: "virus" },
  { name: tx("chickenpox", "Windpocken"), kind: "virus" },
  { name: tx("mumps", "Mumps"), kind: "virus" },
  { name: tx("COVID-19", "Covid-19"), kind: "virus" },
  { name: tx("cold sores (herpes)", "Lippenherpes"), kind: "virus" },
  { name: tx("rabies", "Tollwut"), kind: "virus" },
  { name: tx("TBE (tick-borne encephalitis)", "FSME (Hirnhautentzündung nach Zeckenstich)"), kind: "virus" },
  { name: tx("HIV infection", "HIV-Infektion"), kind: "virus" },
  { name: tx("polio", "Kinderlähmung (Polio)"), kind: "virus" },
  { name: tx("scarlet fever", "Scharlach"), kind: "bacteria" },
  { name: tx("tuberculosis", "Tuberkulose"), kind: "bacteria" },
  { name: tx("whooping cough", "Keuchhusten"), kind: "bacteria" },
  { name: tx("salmonella food poisoning", "Salmonellen-Vergiftung"), kind: "bacteria" },
  { name: tx("cholera", "Cholera"), kind: "bacteria" },
  { name: tx("tetanus", "Wundstarrkrampf (Tetanus)"), kind: "bacteria" },
  { name: tx("Lyme disease", "Borreliose"), kind: "bacteria" },
  { name: tx("diphtheria", "Diphtherie"), kind: "bacteria" },
  { name: tx("athlete's foot", "Fußpilz"), kind: "fungus" },
  { name: tx("nail fungus", "Nagelpilz"), kind: "fungus" },
  { name: tx("oral thrush", "Mundsoor"), kind: "fungus" },
  { name: tx("tapeworm infection", "Bandwurmbefall"), kind: "parasite" },
  { name: tx("head lice", "Kopflausbefall"), kind: "parasite" },
  { name: tx("scabies (mites)", "Krätze (Milben)"), kind: "parasite" },
  { name: tx("malaria", "Malaria"), kind: "parasite" },
];

// ---------------------------------------------------------------------------
// Ways of infection and protection (level 1)

export type Route = "droplet" | "smear" | "food" | "animal";
export const ROUTES: Record<Route, Text> = {
  droplet: tx("Droplet infection", "Tröpfcheninfektion"),
  smear: tx("Smear (contact) infection", "Schmierinfektion (Kontakt)"),
  food: tx("Through food or water", "Über Nahrung oder Wasser"),
  animal: tx("Through animals (bite or sting)", "Über Tiere (Stich oder Biss)"),
};

export type Situation = { text: Text; route: Route; protect: Text };
export const SITUATIONS: Situation[] = [
  { text: tx("The person next to you in class sneezes right at you.", "Die Person neben dir in der Klasse niest dich direkt an."), route: "droplet", protect: tx("Keep your distance; ill people sneeze into the crook of their arm", "Abstand halten; Kranke niesen in die Armbeuge") },
  { text: tx("On a crowded bus someone keeps coughing.", "Im vollen Bus hustet jemand ständig."), route: "droplet", protect: tx("Keep your distance or wear a mask", "Abstand halten oder eine Maske tragen") },
  { text: tx("You touch a door handle that an ill person used and then rub your eyes.", "Du fasst eine Türklinke an, die eine kranke Person benutzt hat, und reibst dir dann die Augen."), route: "smear", protect: tx("Wash your hands thoroughly with soap", "Gründlich die Hände mit Seife waschen") },
  { text: tx("You share a towel with a friend who has athlete's foot.", "Du teilst dir ein Handtuch mit einem Freund, der Fußpilz hat."), route: "smear", protect: tx("Use your own towel and wear flip-flops in the shower", "Ein eigenes Handtuch benutzen und in der Dusche Badeschuhe tragen") },
  { text: tx("Your little brother has a stomach bug and you both use the same toilet.", "Dein kleiner Bruder hat einen Magen-Darm-Infekt, und ihr benutzt dieselbe Toilette."), route: "smear", protect: tx("Wash your hands thoroughly with soap", "Gründlich die Hände mit Seife waschen") },
  { text: tx("You eat tiramisu made with raw eggs that stood in the sun for hours.", "Du isst Tiramisu mit rohen Eiern, das stundenlang in der Sonne stand."), route: "food", protect: tx("Keep food cool and eat it fresh", "Lebensmittel kühl lagern und frisch essen") },
  { text: tx("On holiday you drink unboiled water from a well.", "Im Urlaub trinkst du ungekochtes Wasser aus einem Brunnen."), route: "food", protect: tx("Boil the water or drink bottled water", "Wasser abkochen oder Wasser aus Flaschen trinken") },
  { text: tx("You eat chicken that is still pink inside.", "Du isst Hähnchen, das innen noch rosa ist."), route: "food", protect: tx("Cook meat thoroughly", "Fleisch gut durchgaren") },
  { text: tx("A tick bites you while you walk through tall grass.", "Beim Wandern durch hohes Gras sticht dich eine Zecke."), route: "animal", protect: tx("Wear long clothes and check your skin for ticks", "Lange Kleidung tragen und die Haut nach Zecken absuchen") },
  { text: tx("A mosquito bites you on a trip to the tropics.", "Auf einer Reise in die Tropen sticht dich eine Mücke."), route: "animal", protect: tx("Use a mosquito net and insect repellent", "Moskitonetz und Mückenschutzmittel benutzen") },
  { text: tx("A stray dog that behaves strangely bites you.", "Ein streunender Hund, der sich seltsam verhält, beißt dich."), route: "animal", protect: tx("Don't touch unknown animals", "Fremde Tiere nicht anfassen") },
];

// ---------------------------------------------------------------------------
// Barriers (level 1)

export type Barrier = { id: string; name: Text; how: Text };
export const BARRIERS: Barrier[] = [
  { id: "skin", name: tx("Skin", "Haut"), how: tx("closed horny layer and acid mantle", "geschlossene Hornschicht und Säureschutzmantel") },
  { id: "mucosa", name: tx("Mucous membranes", "Schleimhäute"), how: tx("sticky mucus traps pathogens", "klebriger Schleim hält Erreger fest") },
  { id: "cilia", name: tx("Cilia in the windpipe", "Flimmerhärchen der Luftröhre"), how: tx("carry mucus with pathogens up to the throat", "befördern Schleim mit Erregern zum Rachen") },
  { id: "acid", name: tx("Stomach acid", "Magensäure"), how: tx("kills pathogens in food", "tötet Erreger in der Nahrung ab") },
  { id: "tears", name: tx("Tears", "Tränenflüssigkeit"), how: tx("lysozyme dissolves bacterial cell walls", "Lysozym löst Zellwände von Bakterien auf") },
  { id: "reflex", name: tx("Coughing and sneezing", "Husten und Niesen"), how: tx("throw pathogens out of the airways", "schleudern Erreger aus den Atemwegen") },
];

// ---------------------------------------------------------------------------
// Cells of the immune system (level 2 and 3)

export type CellId = "macro" | "th" | "b" | "plasma" | "tk" | "mem";
export const CELLS: Record<CellId, { name: Text; job: Text }> = {
  macro: { name: tx("Macrophage", "Makrophage"), job: tx("eats pathogens and presents their antigens", "frisst Erreger und präsentiert ihre Antigene") },
  th: { name: tx("T helper cell", "T-Helferzelle"), job: tx("recognises the presented antigen and activates other cells", "erkennt das präsentierte Antigen und aktiviert andere Zellen") },
  b: { name: tx("B cell", "B-Zelle"), job: tx("binds the antigen and becomes a plasma cell", "bindet das Antigen und wird zur Plasmazelle") },
  plasma: { name: tx("Plasma cell", "Plasmazelle"), job: tx("makes and releases antibodies", "bildet Antikörper und gibt sie ab") },
  tk: { name: tx("T killer cell", "T-Killerzelle"), job: tx("kills infected body cells", "tötet infizierte Körperzellen") },
  mem: { name: tx("Memory cell", "Gedächtniszelle"), job: tx("stays for years and allows a fast response", "bleibt jahrelang und ermöglicht eine schnelle Reaktion") },
};

export type Defence = { text: Text; specific: boolean };
export const DEFENCES: Defence[] = [
  { text: tx("the skin", "die Haut"), specific: false },
  { text: tx("stomach acid", "die Magensäure"), specific: false },
  { text: tx("lysozyme in tears", "Lysozym in der Tränenflüssigkeit"), specific: false },
  { text: tx("macrophages (phagocytes)", "Makrophagen (Fresszellen)"), specific: false },
  { text: tx("fever", "Fieber"), specific: false },
  { text: tx("an inflammation", "eine Entzündung"), specific: false },
  { text: tx("the mucus in the airways", "der Schleim der Atemwege"), specific: false },
  { text: tx("antibodies", "Antikörper"), specific: true },
  { text: tx("plasma cells", "Plasmazellen"), specific: true },
  { text: tx("B cells", "B-Zellen"), specific: true },
  { text: tx("T helper cells", "T-Helferzellen"), specific: true },
  { text: tx("T killer cells", "T-Killerzellen"), specific: true },
  { text: tx("memory cells", "Gedächtniszellen"), specific: true },
];

/** The course of a specific immune response, in order (level 2). */
export const RESPONSE: Text[] = [
  tx("Macrophages eat pathogens and present their antigens", "Makrophagen fressen Erreger und präsentieren ihre Antigene"),
  tx("A matching T helper cell recognises the antigen and is activated", "Eine passende T-Helferzelle erkennt das Antigen und wird aktiviert"),
  tx("The T helper cell activates the matching B cell", "Die T-Helferzelle aktiviert die passende B-Zelle"),
  tx("The B cell divides into plasma cells and memory cells", "Die B-Zelle teilt sich: Plasmazellen und Gedächtniszellen entstehen"),
  tx("Plasma cells release antibodies", "Plasmazellen geben Antikörper ab"),
  tx("Antibodies clump the pathogens together", "Antikörper verklumpen die Erreger"),
  tx("Phagocytes clear away the clumps", "Fresszellen beseitigen die Klumpen"),
];

/** Virus replication cycle (level 2). */
export const VIRUS_CYCLE: Text[] = [
  tx("The virus docks onto receptors of the host cell", "Das Virus dockt an Rezeptoren der Wirtszelle an"),
  tx("The virus enters the cell", "Das Virus dringt in die Zelle ein"),
  tx("The viral genetic material is released", "Die Erbinformation des Virus wird frei"),
  tx("The cell copies the genetic material and makes viral proteins", "Die Zelle kopiert die Erbinformation und bildet Virusproteine"),
  tx("New viruses are assembled", "Neue Viren werden zusammengebaut"),
  tx("The new viruses are released from the cell", "Die neuen Viren werden aus der Zelle freigesetzt"),
];

// ---------------------------------------------------------------------------
// Immunisation (level 2)

export const ACTIVE_CASES: Text[] = [
  tx("A baby gets the measles, mumps and rubella vaccine.", "Ein Baby bekommt die Impfung gegen Masern, Mumps und Röteln."),
  tx("Before a trip to the tropics you get vaccinated against yellow fever.", "Vor einer Reise in die Tropen lässt du dich gegen Gelbfieber impfen."),
  tx("You get a tetanus booster ten years after your last jab.", "Zehn Jahre nach der letzten Impfung bekommst du eine Tetanus-Auffrischung."),
  tx("A teenager gets an mRNA vaccine against COVID-19.", "Eine Jugendliche bekommt einen mRNA-Impfstoff gegen COVID-19."),
  tx("A nurse is vaccinated against hepatitis B with a viral surface protein.", "Ein Krankenpfleger wird mit einem Oberflächenprotein des Virus gegen Hepatitis B geimpft."),
];
export const PASSIVE_CASES: Text[] = [
  tx("An unvaccinated gardener with a dirty wound is injected with antibodies against tetanus.", "Ein ungeimpfter Gärtner mit einer verschmutzten Wunde bekommt Antikörper gegen Tetanus gespritzt."),
  tx("After a snake bite a hiker receives an antiserum (ready-made antibodies against the venom).", "Nach einem Schlangenbiss bekommt eine Wanderin ein Antiserum mit fertigen Antikörpern gegen das Gift."),
  tx("A newborn baby is protected by antibodies it received from its mother.", "Ein Neugeborenes ist durch Antikörper geschützt, die es von seiner Mutter bekommen hat."),
  tx("A patient with a severe infection gets a serum with antibodies from recovered people.", "Ein Patient mit einer schweren Infektion bekommt ein Serum mit Antikörpern von Genesenen."),
];

export type Claim = { text: Text; active: boolean };
export const IMMUNISATION_CLAIMS: Claim[] = [
  { text: tx("The body makes its own antibodies", "Der Körper bildet selbst Antikörper"), active: true },
  { text: tx("Memory cells are formed", "Es entstehen Gedächtniszellen"), active: true },
  { text: tx("Protection lasts for years", "Der Schutz hält jahrelang"), active: true },
  { text: tx("Protection only starts after one to two weeks", "Der Schutz beginnt erst nach ein bis zwei Wochen"), active: true },
  { text: tx("Ready-made antibodies are injected", "Fertige Antikörper werden gespritzt"), active: false },
  { text: tx("Protection starts at once", "Der Schutz wirkt sofort"), active: false },
  { text: tx("Protection only lasts a few weeks", "Der Schutz hält nur wenige Wochen"), active: false },
];

// ---------------------------------------------------------------------------
// Level 3

export const HUMORAL: { text: Text; humoral: boolean }[] = [
  { text: tx("Antibodies neutralise a bacterial toxin in the blood.", "Antikörper neutralisieren ein Bakteriengift im Blut."), humoral: true },
  { text: tx("Plasma cells release antibodies into the blood and lymph.", "Plasmazellen geben Antikörper in Blut und Lymphe ab."), humoral: true },
  { text: tx("Bacteria in the blood are clumped together (agglutination).", "Bakterien im Blut werden verklumpt (Agglutination)."), humoral: true },
  { text: tx("Free viruses are blocked by antibodies before they can enter cells.", "Freie Viren werden von Antikörpern blockiert, bevor sie Zellen befallen."), humoral: true },
  { text: tx("A T killer cell destroys a virus-infected cell.", "Eine T-Killerzelle zerstört eine virusinfizierte Zelle."), humoral: false },
  { text: tx("Perforin makes pores in the membrane of a tumour cell.", "Perforin bildet Poren in der Membran einer Tumorzelle."), humoral: false },
  { text: tx("T cells attack a transplanted kidney.", "T-Zellen greifen eine transplantierte Niere an."), humoral: false },
  { text: tx("A cell infected with herpes viruses is driven into apoptosis.", "Eine mit Herpesviren infizierte Zelle wird in die Apoptose getrieben."), humoral: false },
];

export type Presenter = { text: Text; mhc: 1 | 2 };
export const PRESENTERS: Presenter[] = [
  { text: tx("A liver cell is infected with hepatitis B viruses.", "Eine Leberzelle ist mit Hepatitis-B-Viren infiziert."), mhc: 1 },
  { text: tx("A cell of the lung lining is infected with flu viruses.", "Eine Zelle der Lungenschleimhaut ist mit Grippeviren infiziert."), mhc: 1 },
  { text: tx("A tumour cell makes altered proteins.", "Eine Tumorzelle stellt veränderte Proteine her."), mhc: 1 },
  { text: tx("A macrophage has eaten and digested bacteria.", "Eine Makrophage hat Bakterien gefressen und verdaut."), mhc: 2 },
  { text: tx("A dendritic cell in a lymph node carries fragments of a vaccine protein.", "Eine dendritische Zelle im Lymphknoten trägt Bruchstücke eines Impfstoff-Proteins."), mhc: 2 },
  { text: tx("A B cell has taken up the antigen bound to its receptor.", "Eine B-Zelle hat das an ihren Rezeptor gebundene Antigen aufgenommen."), mhc: 2 },
];

export const MHC_PAIRS: [Text, Text][] = [
  [tx("MHC I", "MHC-I"), tx("on all nucleated body cells", "auf allen kernhaltigen Körperzellen")],
  [tx("MHC II", "MHC-II"), tx("only on antigen-presenting cells", "nur auf antigenpräsentierenden Zellen")],
  [tx("CD4", "CD4"), tx("co-receptor of T helper cells", "Corezeptor der T-Helferzellen")],
  [tx("CD8", "CD8"), tx("co-receptor of T killer cells", "Corezeptor der T-Killerzellen")],
  [tx("T cell receptor", "T-Zell-Rezeptor"), tx("recognises a peptide held in an MHC molecule", "erkennt ein Peptid im MHC-Molekül")],
  [tx("B cell receptor", "B-Zell-Rezeptor"), tx("recognises the free, unprocessed antigen", "erkennt das freie, unveränderte Antigen")],
];

export const IG_CLASSES: [Text, Text][] = [
  [tx("IgM", "IgM"), tx("made first in the primary response (pentamer)", "wird bei der Primärantwort zuerst gebildet (Pentamer)")],
  [tx("IgG", "IgG"), tx("most common in the blood, crosses the placenta", "häufigster im Blut, gelangt über die Plazenta zum Kind")],
  [tx("IgA", "IgA"), tx("in secretions such as saliva, tears and breast milk", "in Sekreten wie Speichel, Tränen und Muttermilch")],
  [tx("IgE", "IgE"), tx("binds to mast cells, involved in allergies", "bindet an Mastzellen, beteiligt an Allergien")],
  [tx("IgD", "IgD"), tx("receptor on the surface of naive B cells", "Rezeptor auf der Oberfläche naiver B-Zellen")],
];

export const CLONAL: Text[] = [
  tx("Many B cell clones with different receptors arise by random recombination of gene segments", "Durch zufällige Neukombination von Gen-Abschnitten entstehen viele B-Zell-Klone mit verschiedenen Rezeptoren"),
  tx("An antigen binds to the B cell with the matching receptor", "Ein Antigen bindet an die B-Zelle mit dem passenden Rezeptor"),
  tx("A T helper cell activates this B cell with interleukins", "Eine T-Helferzelle aktiviert diese B-Zelle mit Interleukinen"),
  tx("The B cell divides again and again (clonal expansion)", "Die B-Zelle teilt sich immer wieder (klonale Expansion)"),
  tx("The daughter cells become plasma cells and memory cells", "Die Tochterzellen werden zu Plasmazellen und Gedächtniszellen"),
];

export const HIV_CYCLE: Text[] = [
  tx("gp120 binds to the CD4 receptor of a T helper cell", "gp120 bindet an den CD4-Rezeptor einer T-Helferzelle"),
  tx("The viral envelope fuses with the cell membrane", "Die Virushülle verschmilzt mit der Zellmembran"),
  tx("Reverse transcriptase rewrites the viral RNA into DNA", "Die reverse Transkriptase schreibt die Virus-RNA in DNA um"),
  tx("Integrase inserts the viral DNA into the host genome", "Die Integrase baut die Virus-DNA in das Genom der Wirtszelle ein"),
  tx("Viral RNA and viral proteins are made", "Virus-RNA und Virusproteine werden hergestellt"),
  tx("New viruses bud off from the cell", "Neue Viren schnüren sich von der Zelle ab"),
];

export const ALLERGY: Text[] = [
  tx("First contact: the allergen enters the body", "Erstkontakt: Das Allergen gelangt in den Körper"),
  tx("Plasma cells make IgE antibodies against the allergen", "Plasmazellen bilden IgE-Antikörper gegen das Allergen"),
  tx("IgE binds to mast cells (sensitisation)", "IgE bindet an Mastzellen (Sensibilisierung)"),
  tx("Second contact: the allergen cross-links IgE on the mast cells", "Zweitkontakt: Das Allergen vernetzt IgE auf den Mastzellen"),
  tx("Mast cells release histamine", "Mastzellen schütten Histamin aus"),
  tx("Symptoms: itching, swelling, runny nose", "Symptome: Juckreiz, Schwellung, Fließschnupfen"),
];

export const ELISA: Text[] = [
  tx("HIV proteins (antigen) are fixed to the bottom of the well", "HIV-Proteine (Antigen) sind am Boden der Vertiefung gebunden"),
  tx("The patient's serum is added", "Das Serum des Patienten wird zugegeben"),
  tx("Washing removes everything that hasn't bound", "Waschen entfernt alles, was nicht gebunden hat"),
  tx("An enzyme-linked second antibody against human antibodies is added", "Ein enzymgekoppelter Zweitantikörper gegen menschliche Antikörper wird zugegeben"),
  tx("After washing again, a substrate is added: a colour change shows bound antibodies", "Nach erneutem Waschen wird Substrat zugegeben: Ein Farbumschlag zeigt gebundene Antikörper an"),
];

export const AUTOIMMUNE: [Text, Text][] = [
  [tx("Type 1 diabetes", "Typ-1-Diabetes"), tx("insulin-producing cells of the pancreas", "insulinbildende Zellen der Bauchspeicheldrüse")],
  [tx("Multiple sclerosis", "Multiple Sklerose"), tx("myelin sheaths of nerve cells", "Myelinscheiden der Nervenzellen")],
  [tx("Rheumatoid arthritis", "Rheumatoide Arthritis"), tx("lining of the joints", "Gelenkinnenhaut")],
  [tx("Hashimoto's thyroiditis", "Hashimoto-Thyreoiditis"), tx("thyroid gland", "Schilddrüse")],
  [tx("Coeliac disease", "Zöliakie"), tx("lining of the small intestine", "Dünndarmschleimhaut")],
];

export type Disorder = "allergy" | "autoimmune" | "deficiency";
export const DISORDER_NAMES: Record<Disorder, Text> = {
  allergy: tx("Allergy", "Allergie"),
  autoimmune: tx("Autoimmune disease", "Autoimmunerkrankung"),
  deficiency: tx("Immunodeficiency", "Immunschwäche"),
};
export const DISORDERS: { text: Text; kind: Disorder }[] = [
  { text: tx("Hay fever in spring", "Heuschnupfen im Frühling"), kind: "allergy" },
  { text: tx("A peanut allergy", "Eine Erdnussallergie"), kind: "allergy" },
  { text: tx("A reaction to bee stings with swelling and shortness of breath", "Eine Reaktion auf Bienenstiche mit Schwellung und Atemnot"), kind: "allergy" },
  { text: tx("Type 1 diabetes", "Typ-1-Diabetes"), kind: "autoimmune" },
  { text: tx("Multiple sclerosis", "Multiple Sklerose"), kind: "autoimmune" },
  { text: tx("Rheumatoid arthritis", "Rheumatoide Arthritis"), kind: "autoimmune" },
  { text: tx("AIDS", "AIDS"), kind: "deficiency" },
  { text: tx("A congenital lack of B cells", "Ein angeborener Mangel an B-Zellen"), kind: "deficiency" },
];
