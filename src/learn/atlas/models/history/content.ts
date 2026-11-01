import { tx } from "@/i18n/text";
import type { ModelContent, StepsContent, TimelineContent } from "../../types";

/** The history of microbiology: the milestones, Pasteur's swan-neck flasks and Koch's postulates. */

export const TIMELINE = {
  kind: "timeline",
  title: tx("Timeline", "Zeitleiste"),
  intro: tx(
    "From the first idea of invisible germs to gene scissors: who discovered what, and why it mattered. Tap a milestone to read its story.",
    "Von der ersten Idee unsichtbarer Keime bis zur Genschere: wer was entdeckt hat und warum es wichtig war. Tippe auf einen Meilenstein und lies seine Geschichte.",
  ),
  events: {
    fracastoro: {
      year: 1546,
      who: tx("Girolamo Fracastoro", "Girolamo Fracastoro"),
      title: tx("A theory of contagion", "Eine Lehre von der Ansteckung"),
      body: tx(
        "The Italian physician writes in De contagione that diseases spread through tiny germs that multiply (seminaria): by touch, through objects or through the air.",
        "Der italienische Arzt schreibt in „De contagione“, dass Krankheiten durch winzige, sich vermehrende Keime (seminaria) übertragen werden: durch Berührung, über Gegenstände oder durch die Luft.",
      ),
      facts: [tx("A surprisingly modern idea, but without proof: nobody could see the germs.", "Eine erstaunlich moderne Idee, aber ohne Beweis: Niemand konnte die Keime sehen.")],
      icon: "hands",
    },
    hooke: {
      year: 1665,
      who: tx("Robert Hooke", "Robert Hooke"),
      title: tx("The word \"cell\"", "Das Wort „Zelle“"),
      body: tx(
        "In his book Micrographia, Hooke shows what his compound microscope sees. In cork he finds little chambers and calls them cells. He also describes moulds.",
        "In seinem Buch „Micrographia“ zeigt Hooke, was sein zusammengesetztes Mikroskop sieht. In Kork entdeckt er kleine Kammern und nennt sie „cells“ (Zellen). Er beschreibt auch Schimmelpilze.",
      ),
      facts: [tx("What he saw were the empty walls of dead cork cells.", "Was er sah, waren die leeren Wände toter Korkzellen.")],
      icon: "cells",
    },
    leeuwenhoek: {
      year: 1676,
      who: tx("Antoni van Leeuwenhoek", "Antoni van Leeuwenhoek"),
      title: tx("The first bacteria", "Die ersten Bakterien"),
      body: tx(
        "A cloth merchant from Delft grinds tiny lenses and builds single-lens microscopes that magnify up to about 270 times. In pepper water, pond water and the plaque on his teeth he sees \"animalcules\": bacteria and protozoa. He reports them in letters to the Royal Society.",
        "Ein Tuchhändler aus Delft schleift winzige Linsen und baut Einlinsen-Mikroskope mit bis zu etwa 270-facher Vergrößerung. In Pfefferwasser, Teichwasser und seinem Zahnbelag sieht er „animalcules“ (Tierchen): Bakterien und Protozoen. Er berichtet in Briefen an die Royal Society.",
      ),
      facts: [
        tx("Called the father of microbiology.", "Gilt als Vater der Mikrobiologie."),
        tx("His famous letter about the creatures in pepper water is dated 9 October 1676.", "Sein berühmter Brief über die Tierchen im Pfefferwasser stammt vom 9. Oktober 1676."),
        tx("In 1683 he drew cocci, rods and spirals from his own teeth.", "1683 zeichnete er Kokken, Stäbchen und Spiralen aus seinem eigenen Zahnbelag."),
      ],
      tip: tx("Hooke saw cells (in cork); Leeuwenhoek was the first to see living microorganisms.", "Hooke sah Zellen (im Kork); Leeuwenhoek sah als Erster lebende Mikroorganismen."),
      icon: "lens",
    },
    spallanzani: {
      year: 1768,
      when: tx("1765–1768", "1765–1768"),
      who: tx("Lazzaro Spallanzani", "Lazzaro Spallanzani"),
      title: tx("Boiled broth stays sterile", "Gekochte Brühe bleibt keimfrei"),
      body: tx(
        "He boils meat broth in flasks and seals them: nothing grows. An early blow against spontaneous generation.",
        "Er kocht Fleischbrühe in Kolben und schmilzt sie zu: Nichts wächst. Ein früher Schlag gegen die Urzeugung.",
      ),
      facts: [tx("Critics said sealing kept out the \"vital force\" of the air. Only Pasteur settled that.", "Kritiker meinten, das Zuschmelzen halte die „Lebenskraft“ der Luft fern. Erst Pasteur klärte das.")],
      icon: "flask",
    },
    jenner: {
      year: 1796,
      who: tx("Edward Jenner", "Edward Jenner"),
      title: tx("The first vaccination", "Die erste Impfung"),
      body: tx(
        "Jenner puts material from cowpox blisters into the boy James Phipps and so protects him from real smallpox. Latin vacca, cow, gave vaccination its name.",
        "Jenner überträgt Material aus Kuhpockenbläschen auf den Jungen James Phipps und schützt ihn so vor den echten Pocken. Lateinisch vacca, die Kuh, gab der Vakzination ihren Namen.",
      ),
      facts: [tx("Smallpox was declared eradicated worldwide in 1980.", "Die Pocken wurden 1980 für weltweit ausgerottet erklärt.")],
      icon: "vaccine",
    },
    semmelweis: {
      year: 1847,
      who: tx("Ignaz Semmelweis", "Ignaz Semmelweis"),
      title: tx("Washing hands", "Händedesinfektion"),
      body: tx(
        "In the Vienna maternity clinic many mothers die of childbed fever. Semmelweis sees that doctors carry it from the dissecting room, and has them wash their hands in chlorinated lime: deaths drop sharply.",
        "In der Wiener Geburtsklinik sterben viele Mütter am Kindbettfieber. Semmelweis erkennt, dass Ärzte es aus dem Sektionssaal mitbringen, und lässt sie die Hände in Chlorkalklösung waschen: Die Sterblichkeit fällt drastisch.",
      ),
      facts: [tx("Mocked in his lifetime, today he is called the saviour of mothers.", "Zu Lebzeiten verspottet, heute als „Retter der Mütter“ geehrt.")],
      icon: "hands",
    },
    fermentation: {
      year: 1857,
      who: tx("Louis Pasteur", "Louis Pasteur"),
      title: tx("Fermentation is done by microbes", "Gärung durch Mikroben"),
      body: tx(
        "Pasteur shows that fermentations are carried out by living microorganisms: yeasts make alcohol, bacteria make lactic acid. Spoilt wine comes from the wrong microbes.",
        "Pasteur zeigt, dass Gärungen von lebenden Mikroorganismen gemacht werden: Hefen bilden Alkohol, Bakterien Milchsäure. Verdorbener Wein kommt von den falschen Mikroben.",
      ),
      facts: [
        tx("This led to pasteurisation (from 1864): brief heating kills most germs; spores survive.", "Daraus entstand die Pasteurisierung (ab 1864): kurzes Erhitzen tötet die meisten Keime, Sporen überleben."),
        tx("He also found that some microbes live without oxygen (anaerobic).", "Er fand auch, dass manche Mikroben ohne Sauerstoff leben (anaerob)."),
      ],
      icon: "flask",
    },
    swan: {
      year: 1861,
      who: tx("Louis Pasteur", "Louis Pasteur"),
      title: tx("The end of spontaneous generation", "Das Ende der Urzeugung"),
      body: tx(
        "With his swan-neck flasks Pasteur shows that boiled broth stays sterile although air gets in. Germs don't arise by themselves, they come from outside.",
        "Mit seinen Schwanenhalskolben zeigt Pasteur: Abgekochte Nährlösung bleibt keimfrei, obwohl Luft hineinkommt. Keime entstehen nicht von selbst, sie kommen von außen.",
      ),
      facts: [tx("The curved neck traps dust and germs.", "Der gebogene Hals fängt Staub und Keime ab.")],
      tip: tx("Step through it in the view Pasteur's flasks.", "Schritt für Schritt in der Ansicht Pasteurs Kolben."),
      icon: "swan",
    },
    lister: {
      year: 1867,
      who: tx("Joseph Lister", "Joseph Lister"),
      title: tx("Antiseptic surgery", "Antiseptische Chirurgie"),
      body: tx(
        "Inspired by Pasteur, Lister disinfects wounds, instruments and even the air of the operating theatre with carbolic acid (phenol): wound infections become rare.",
        "Angeregt von Pasteur desinfiziert Lister Wunden, Instrumente und sogar die Luft im Operationssaal mit Karbolsäure (Phenol): Wundinfektionen werden selten.",
      ),
      facts: [tx("Antisepsis kills germs on the spot; today asepsis (keeping germs away from the start) is the standard.", "Antisepsis tötet Keime vor Ort; heute ist die Asepsis (Keime gar nicht erst hinlassen) der Standard.")],
      icon: "scalpel",
    },
    cohn: {
      year: 1876,
      who: tx("Ferdinand Cohn", "Ferdinand Cohn"),
      title: tx("Endospores", "Endosporen"),
      body: tx(
        "Cohn describes the heat-resistant endospores of Bacillus subtilis and explains why boiled hay infusions still turn cloudy again.",
        "Cohn beschreibt die hitzeresistenten Endosporen von Bacillus subtilis und erklärt, warum gekochte Heuaufgüsse trotzdem wieder trüb werden.",
      ),
      facts: [tx("He was the first to sort bacteria by shape (cocci, rods, spirals) and founded bacteriology as a subject.", "Er ordnete Bakterien als Erster nach Formen (Kokken, Stäbchen, Spiralen) und begründete die Bakteriologie als Fach.")],
      icon: "spore",
    },
    anthrax: {
      year: 1876,
      who: tx("Robert Koch", "Robert Koch"),
      title: tx("One germ, one disease", "Ein Erreger, eine Krankheit"),
      body: tx(
        "The country doctor Koch proves that Bacillus anthracis causes anthrax: the first proof that a particular bacterium causes a particular disease. He also describes its spores.",
        "Der Landarzt Koch weist nach, dass Bacillus anthracis den Milzbrand verursacht: der erste Beweis, dass ein bestimmtes Bakterium eine bestimmte Krankheit auslöst. Er beschreibt auch dessen Sporen.",
      ),
      icon: "rod",
    },
    agar: {
      year: 1882,
      when: tx("1881/82", "1881/82"),
      who: tx("Robert Koch, Fanny Hesse", "Robert Koch, Fanny Hesse"),
      title: tx("Pure cultures on solid media", "Reinkulturen auf festem Nährboden"),
      body: tx(
        "Koch grows bacteria on solid media, first on potato slices and gelatine. Fanny Hesse, the wife of his co-worker Walther Hesse, suggests agar from seaweed: it stays solid at body temperature and bacteria hardly break it down.",
        "Koch züchtet Bakterien auf festen Nährböden, zuerst auf Kartoffelscheiben und Gelatine. Fanny Hesse, Frau seines Mitarbeiters Walther Hesse, schlägt Agar aus Algen vor: Er bleibt bei Körpertemperatur fest und wird von Bakterien kaum abgebaut.",
      ),
      facts: [
        tx("Agar melts only at about 85 °C and sets at about 40 °C.", "Agar schmilzt erst bei etwa 85 °C und wird bei etwa 40 °C fest."),
        tx("On a solid medium one single cell grows into one colony: the basis of the pure culture.", "Auf festem Nährboden wächst aus einer einzelnen Zelle eine Kolonie: die Grundlage der Reinkultur."),
      ],
      icon: "dish",
    },
    tuberculosis: {
      year: 1882,
      who: tx("Robert Koch", "Robert Koch"),
      title: tx("The tuberculosis bacterium", "Der Tuberkulose-Erreger"),
      body: tx(
        "On 24 March 1882 Koch presents Mycobacterium tuberculosis in Berlin, the cause of tuberculosis, then one of the commonest causes of death.",
        "Am 24. März 1882 stellt Koch in Berlin Mycobacterium tuberculosis vor, den Erreger der Tuberkulose, damals eine der häufigsten Todesursachen.",
      ),
      facts: [
        tx("24 March is World Tuberculosis Day.", "Der 24. März ist heute Welttuberkulosetag."),
        tx("In 1883/84 he also identified the cholera bacterium, Vibrio cholerae.", "1883/84 identifizierte er auch den Cholera-Erreger Vibrio cholerae."),
        tx("Nobel Prize in Medicine 1905.", "Nobelpreis für Medizin 1905."),
      ],
      icon: "rod",
    },
    gram: {
      year: 1884,
      who: tx("Hans Christian Gram", "Hans Christian Gram"),
      title: tx("The Gram stain", "Die Gramfärbung"),
      body: tx(
        "The Danish physician, working in Berlin, develops a stain that splits bacteria into two groups: Gram-positive and Gram-negative. Still the first step in every lab.",
        "Der dänische Arzt entwickelt in Berlin eine Färbung, die Bakterien in zwei Gruppen teilt: grampositiv und gramnegativ. Bis heute der erste Schritt in jedem Labor.",
      ),
      icon: "stain",
    },
    postulates: {
      year: 1884,
      when: tx("1884/1890", "1884/1890"),
      who: tx("Robert Koch, Friedrich Loeffler", "Robert Koch, Friedrich Loeffler"),
      title: tx("Koch's postulates", "Die Kochschen Postulate"),
      body: tx(
        "Conditions that prove a microorganism causes a disease. Loeffler published them in 1884, Koch summed them up in 1890.",
        "Bedingungen, die beweisen, dass ein Mikroorganismus eine Krankheit verursacht. Loeffler veröffentlichte sie 1884, Koch fasste sie 1890 zusammen.",
      ),
      tip: tx("Step through them in the view Koch's postulates.", "Schritt für Schritt in der Ansicht Kochsche Postulate."),
      icon: "microscope",
    },
    rabies: {
      year: 1885,
      who: tx("Louis Pasteur", "Louis Pasteur"),
      title: tx("Vaccine against rabies", "Impfung gegen Tollwut"),
      body: tx(
        "Pasteur develops weakened (attenuated) vaccines, first against chicken cholera and anthrax (1881), then against rabies. In 1885 he saves the bitten boy Joseph Meister with it.",
        "Pasteur entwickelt abgeschwächte Impfstoffe, zuerst gegen Hühnercholera und Milzbrand (1881), dann gegen Tollwut. 1885 rettet er damit den gebissenen Jungen Joseph Meister.",
      ),
      icon: "vaccine",
    },
    petri: {
      year: 1887,
      who: tx("Julius Richard Petri", "Julius Richard Petri"),
      title: tx("The Petri dish", "Die Petrischale"),
      body: tx(
        "Koch's assistant invents the flat glass dish with an overlapping lid: media stay sterile and colonies are easy to count.",
        "Kochs Assistent erfindet die flache Glasschale mit übergreifendem Deckel: Nährböden bleiben steril, und Kolonien lassen sich leicht zählen.",
      ),
      icon: "dish",
    },
    behring: {
      year: 1890,
      who: tx("Emil von Behring, Kitasato Shibasaburō", "Emil von Behring, Kitasato Shibasaburō"),
      title: tx("Serum therapy", "Serumtherapie"),
      body: tx(
        "They show that the blood serum of immunised animals contains antitoxins against diphtheria and tetanus: passive immunisation.",
        "Sie zeigen, dass das Blutserum immunisierter Tiere Antitoxine gegen Diphtherie und Tetanus enthält: passive Immunisierung.",
      ),
      facts: [tx("Behring received the very first Nobel Prize in Medicine in 1901.", "Behring erhielt 1901 den allerersten Nobelpreis für Medizin.")],
      icon: "vaccine",
    },
    virus: {
      year: 1898,
      when: tx("1892/1898", "1892/1898"),
      who: tx("Dmitri Ivanovsky, Martinus Beijerinck", "Dmitri Iwanowski, Martinus Beijerinck"),
      title: tx("Viruses", "Viren"),
      body: tx(
        "The cause of tobacco mosaic disease passes through filters that hold back bacteria (Ivanovsky, 1892). Beijerinck sees in 1898 that it is a new kind of agent that multiplies only in living cells, and calls it a virus.",
        "Der Erreger der Tabakmosaikkrankheit geht durch Filter, die Bakterien zurückhalten (Iwanowski, 1892). Beijerinck erkennt 1898 einen neuen Typ Erreger, der sich nur in lebenden Zellen vermehrt, und nennt ihn Virus.",
      ),
      facts: [tx("Beijerinck and Winogradsky also founded environmental microbiology (enrichment cultures, nitrogen and sulphur bacteria).", "Beijerinck und Winogradsky begründeten außerdem die Umweltmikrobiologie (Anreicherungskulturen, Stickstoff- und Schwefelbakterien).")],
      icon: "filter",
    },
    ehrlich: {
      year: 1910,
      who: tx("Paul Ehrlich, Sahachiro Hata", "Paul Ehrlich, Sahachiro Hata"),
      title: tx("Salvarsan", "Salvarsan"),
      body: tx(
        "After testing hundreds of arsenic compounds they find Salvarsan against syphilis: the first drug designed to hit a germ, Ehrlich's \"magic bullet\".",
        "Nach dem Test Hunderter Arsenverbindungen finden sie Salvarsan gegen Syphilis: das erste gezielt entwickelte Chemotherapeutikum, Ehrlichs „Zauberkugel“.",
      ),
      icon: "pill",
    },
    phages: {
      year: 1917,
      when: tx("1915/1917", "1915/1917"),
      who: tx("Frederick Twort, Félix d'Hérelle", "Frederick Twort, Félix d'Hérelle"),
      title: tx("Bacteriophages", "Bakteriophagen"),
      body: tx(
        "Viruses that attack and dissolve bacteria: Twort sees them in 1915, d'Hérelle names them bacteriophages (bacteria eaters) in 1917.",
        "Viren, die Bakterien befallen und auflösen: Twort sieht sie 1915, d'Hérelle nennt sie 1917 Bakteriophagen (Bakterienfresser).",
      ),
      facts: [tx("Phage therapy is making a comeback against resistant bacteria.", "Die Phagentherapie erlebt ein Comeback gegen resistente Keime.")],
      icon: "phage",
    },
    griffith: {
      year: 1928,
      who: tx("Frederick Griffith", "Frederick Griffith"),
      title: tx("Transformation", "Transformation"),
      body: tx(
        "With pneumococci Griffith shows: harmless R strains turn deadly when mixed with killed S strains. Something passes on hereditary information.",
        "Mit Pneumokokken zeigt Griffith: Harmlose R-Stämme werden tödlich, wenn man ihnen abgetötete S-Stämme beimischt. Etwas überträgt Erbinformation.",
      ),
      facts: [tx("In 1944 Avery, MacLeod and McCarty show that this something is DNA.", "1944 zeigen Avery, MacLeod und McCarty: Dieses Etwas ist DNA.")],
      icon: "dna",
    },
    fleming: {
      year: 1928,
      who: tx("Alexander Fleming", "Alexander Fleming"),
      title: tx("Penicillin", "Penicillin"),
      body: tx(
        "On a forgotten plate of staphylococci a mould (Penicillium) grows, and around it the bacteria die: a zone of inhibition. Fleming calls the substance penicillin.",
        "Auf einer vergessenen Staphylokokken-Platte wächst ein Schimmelpilz (Penicillium), um den herum die Bakterien absterben: ein Hemmhof. Fleming nennt den Stoff Penicillin.",
      ),
      facts: [
        tx("Florey and Chain made it a usable drug around 1940; Nobel Prize 1945 for all three.", "Florey und Chain machten es um 1940 als Medikament nutzbar; Nobelpreis 1945 für alle drei."),
        tx("The start of the age of antibiotics.", "Der Beginn des Antibiotika-Zeitalters."),
      ],
      icon: "mould",
    },
    ruska: {
      year: 1931,
      who: tx("Ernst Ruska, Max Knoll", "Ernst Ruska, Max Knoll"),
      title: tx("The electron microscope", "Das Elektronenmikroskop"),
      body: tx(
        "Electrons instead of light: the electron microscope soon shows structures far below the limit of the light microscope (about 0.2 µm), such as viruses and ribosomes.",
        "Elektronen statt Licht: Das Elektronenmikroskop zeigt bald Strukturen weit unter der Grenze des Lichtmikroskops (etwa 0,2 µm), etwa Viren und Ribosomen.",
      ),
      facts: [tx("Ruska received the Nobel Prize in Physics in 1986.", "Ruska erhielt 1986 den Nobelpreis für Physik.")],
      icon: "microscope",
    },
    domagk: {
      year: 1935,
      who: tx("Gerhard Domagk", "Gerhard Domagk"),
      title: tx("Sulphonamides", "Sulfonamide"),
      body: tx("With Prontosil, Domagk finds the first drug that works broadly against bacterial infections: the sulphonamides.", "Mit Prontosil findet Domagk das erste breit wirksame Mittel gegen bakterielle Infektionen: die Sulfonamide."),
      facts: [tx("Nobel Prize 1939, which the Nazi regime forced him to refuse at first.", "Nobelpreis 1939, den er auf Druck der Nationalsozialisten zunächst ablehnen musste.")],
      icon: "pill",
    },
    waksman: {
      year: 1943,
      who: tx("Selman Waksman, Albert Schatz", "Selman Waksman, Albert Schatz"),
      title: tx("Streptomycin", "Streptomycin"),
      body: tx(
        "From the soil bacterium Streptomyces they win streptomycin, the first antibiotic that works against tuberculosis. Waksman coins the word antibiotic.",
        "Aus dem Bodenbakterium Streptomyces gewinnen sie Streptomycin, das erste Antibiotikum gegen Tuberkulose. Waksman prägt das Wort Antibiotikum.",
      ),
      icon: "pill",
    },
    helix: {
      year: 1953,
      who: tx("James Watson, Francis Crick, Rosalind Franklin", "James Watson, Francis Crick, Rosalind Franklin"),
      title: tx("The DNA double helix", "Die DNA-Doppelhelix"),
      body: tx(
        "Using Rosalind Franklin's X-ray pictures, Watson and Crick work out the structure of DNA: a double helix of base pairs. Molecular biology begins.",
        "Mit Röntgenbildern von Rosalind Franklin klären Watson und Crick die Struktur der DNA auf: eine Doppelhelix aus Basenpaaren. Die Molekularbiologie beginnt.",
      ),
      icon: "helix",
    },
    margulis: {
      year: 1967,
      who: tx("Lynn Margulis", "Lynn Margulis"),
      title: tx("Endosymbiotic theory", "Endosymbiontentheorie"),
      body: tx(
        "Margulis argues that mitochondria and chloroplasts descend from once free-living bacteria taken up by a host cell. Evidence: their own DNA, 70S ribosomes, a double membrane.",
        "Margulis vertritt, dass Mitochondrien und Chloroplasten von einst frei lebenden Bakterien abstammen, die eine Wirtszelle aufgenommen hat. Belege: eigene DNA, 70S-Ribosomen, Doppelmembran.",
      ),
      icon: "cells",
    },
    woese: {
      year: 1977,
      when: tx("1977/1990", "1977/1990"),
      who: tx("Carl Woese, George Fox", "Carl Woese, George Fox"),
      title: tx("Three domains of life", "Drei Domänen des Lebens"),
      body: tx(
        "Comparing 16S rRNA, they discover the archaea as a group of their own. In 1990 Woese proposes three domains: Bacteria, Archaea and Eukarya.",
        "Durch Vergleich der 16S-rRNA entdecken sie die Archaeen als eigene Gruppe. 1990 schlägt Woese drei Domänen vor: Bakterien, Archaeen und Eukaryoten.",
      ),
      icon: "tree",
    },
    pcr: {
      year: 1983,
      who: tx("Kary Mullis", "Kary Mullis"),
      title: tx("PCR", "PCR"),
      body: tx(
        "The polymerase chain reaction copies DNA millions of times. Its heat-stable Taq polymerase comes from Thermus aquaticus, a bacterium from hot springs.",
        "Die Polymerase-Kettenreaktion kopiert DNA millionenfach. Ihre hitzestabile Taq-Polymerase stammt aus Thermus aquaticus, einem Bakterium aus heißen Quellen.",
      ),
      facts: [tx("Nobel Prize 1993; today standard in diagnostics, for example to detect pathogens.", "Nobelpreis 1993; heute Standard in der Diagnostik, etwa beim Nachweis von Erregern.")],
      icon: "dna",
    },
    genome: {
      year: 1995,
      who: tx("Robert Fleischmann, Craig Venter and team", "Robert Fleischmann, Craig Venter und Team"),
      title: tx("The first bacterial genome", "Das erste Bakteriengenom"),
      body: tx(
        "Haemophilus influenzae becomes the first free-living organism whose genome is fully sequenced: about 1.8 million base pairs.",
        "Haemophilus influenzae ist der erste frei lebende Organismus, dessen Genom vollständig sequenziert wird: rund 1,8 Millionen Basenpaare.",
      ),
      icon: "plasmid",
    },
    crispr: {
      year: 2012,
      who: tx("Emmanuelle Charpentier, Jennifer Doudna", "Emmanuelle Charpentier, Jennifer Doudna"),
      title: tx("CRISPR-Cas9", "CRISPR-Cas9"),
      body: tx(
        "A bacterial immune system against phages becomes gene scissors: CRISPR-Cas9 cuts DNA at a chosen place so it can be changed.",
        "Ein Immunsystem der Bakterien gegen Phagen wird zur Genschere: CRISPR-Cas9 schneidet DNA an einer gewählten Stelle, sodass man sie verändern kann.",
      ),
      facts: [tx("Nobel Prize in Chemistry 2020.", "Nobelpreis für Chemie 2020.")],
      icon: "scissors",
    },
  },
  questions: [
    {
      q: tx("Who was the first to see bacteria?", "Wer sah als Erster Bakterien?"),
      options: [tx("Antoni van Leeuwenhoek", "Antoni van Leeuwenhoek"), tx("Robert Hooke", "Robert Hooke"), tx("Louis Pasteur", "Louis Pasteur"), tx("Robert Koch", "Robert Koch")],
      correct: 0,
    },
    {
      q: tx("Who suggested agar for solid media?", "Wer schlug Agar für feste Nährböden vor?"),
      options: [tx("Fanny Hesse", "Fanny Hesse"), tx("Julius Richard Petri", "Julius Richard Petri"), tx("Robert Koch", "Robert Koch"), tx("Ferdinand Cohn", "Ferdinand Cohn")],
      correct: 0,
    },
    {
      q: tx("What did Semmelweis bring in against childbed fever?", "Was führte Semmelweis gegen das Kindbettfieber ein?"),
      options: [tx("Disinfecting hands with chlorinated lime", "Händedesinfektion mit Chlorkalk"), tx("Penicillin", "Penicillin"), tx("Vaccination", "Impfung"), tx("Carbolic acid spray", "Karbolspray")],
      correct: 0,
    },
    {
      q: tx("Which germ did Koch present on 24 March 1882?", "Welchen Erreger stellte Koch am 24. März 1882 vor?"),
      options: [tx("Mycobacterium tuberculosis", "Mycobacterium tuberculosis"), tx("Bacillus anthracis", "Bacillus anthracis"), tx("Vibrio cholerae", "Vibrio cholerae"), tx("Treponema pallidum", "Treponema pallidum")],
      correct: 0,
    },
  ],
} satisfies TimelineContent;

export const PASTEUR = {
  kind: "steps",
  title: tx("Pasteur's flasks", "Pasteurs Kolben"),
  intro: tx(
    "The swan-neck flask experiment (1861) ended the old idea of spontaneous generation: that life arises by itself from lifeless matter, such as broth.",
    "Das Schwanenhalskolben-Experiment (1861) beendete die alte Idee der Urzeugung: dass Leben von selbst aus lebloser Materie entsteht, etwa aus Brühe.",
  ),
  steps: [
    {
      short: tx("Fill", "Füllen"),
      title: tx("Fill in the broth", "Nährlösung einfüllen"),
      body: tx("Pasteur fills meat broth, a nutrient solution, into a glass flask.", "Pasteur füllt Fleischbrühe, eine Nährlösung, in einen Glaskolben."),
    },
    {
      short: tx("Bend", "Biegen"),
      title: tx("Draw out the neck", "Hals ausziehen"),
      body: tx("He heats the neck of the flask and draws it out into an S-shaped swan neck. The flask stays open: air can get in.", "Er erhitzt den Hals des Kolbens und zieht ihn zu einem S-förmigen Schwanenhals aus. Der Kolben bleibt offen: Luft kann hinein."),
      tip: tx("The open neck is the trick: nobody can say the air was kept out.", "Der offene Hals ist der Trick: Niemand kann sagen, die Luft sei ferngehalten worden."),
    },
    {
      short: tx("Boil", "Kochen"),
      title: tx("Boil", "Abkochen"),
      body: tx("He boils the broth: all microorganisms in it die. The steam also drives air and germs out of the neck.", "Er kocht die Brühe: Alle Mikroorganismen darin sterben. Der Dampf treibt auch Luft und Keime aus dem Hals."),
    },
    {
      short: tx("Wait", "Warten"),
      title: tx("Wait", "Warten"),
      body: tx(
        "The flask stands open for weeks, even months. Dust and germs from the air stick in the bend of the neck, in the water that condenses there. The broth stays clear.",
        "Der Kolben steht wochen-, sogar monatelang offen. Staub und Keime aus der Luft bleiben in der Biegung des Halses hängen, im Wasser, das sich dort niederschlägt. Die Brühe bleibt klar.",
      ),
    },
    {
      short: tx("Break", "Abbrechen"),
      title: tx("Break off the neck", "Hals abbrechen"),
      body: tx(
        "If he breaks off the neck, or tips the flask so the broth wets the bend, germs get in: after a short time the broth turns cloudy.",
        "Bricht er den Hals ab oder kippt er den Kolben, sodass die Brühe die Biegung benetzt, gelangen Keime hinein: Nach kurzer Zeit wird die Brühe trüb.",
      ),
    },
    {
      short: tx("Result", "Ergebnis"),
      title: tx("No spontaneous generation", "Keine Urzeugung"),
      body: tx(
        "Life doesn't arise by itself from the broth. Microorganisms always come from other microorganisms, here from the dust in the air.",
        "Leben entsteht nicht von selbst aus der Brühe. Mikroorganismen stammen immer von anderen Mikroorganismen ab, hier vom Staub aus der Luft.",
      ),
      facts: [
        tx("It also settled the argument about a \"vital force\" in the air: the air got in all along.", "Damit war auch das Argument einer „Lebenskraft“ der Luft erledigt: Die Luft kam ja die ganze Zeit hinein."),
        tx("The basis of sterile working: boil, then keep germs out.", "Die Grundlage sterilen Arbeitens: abkochen, dann Keime fernhalten."),
      ],
      tip: tx("Germs come from germs (omne vivum ex vivo).", "Keime kommen von Keimen (omne vivum ex vivo)."),
    },
  ],
  questions: [
    {
      q: tx("Why did the broth in the swan-neck flask stay clear?", "Warum blieb die Brühe im Schwanenhalskolben klar?"),
      options: [tx("Germs stuck in the curved neck", "Keime blieben im gebogenen Hals hängen"), tx("No air got in", "Es kam keine Luft hinein"), tx("The flask was sealed", "Der Kolben war zugeschmolzen"), tx("The broth was poisoned", "Die Brühe war vergiftet")],
      correct: 0,
    },
    {
      q: tx("What did the experiment disprove?", "Was widerlegte das Experiment?"),
      options: [tx("Spontaneous generation", "Die Urzeugung"), tx("The cell theory", "Die Zelltheorie"), tx("Evolution", "Die Evolution"), tx("Fermentation", "Die Gärung")],
      correct: 0,
    },
    {
      q: tx("Why did the neck have to stay open?", "Warum musste der Hals offen bleiben?"),
      options: [
        tx("So nobody could claim the air had been kept out", "Damit niemand behaupten konnte, die Luft sei ferngehalten worden"),
        tx("So the steam could escape", "Damit der Dampf entweichen konnte"),
        tx("So germs could get in", "Damit Keime hineinkommen"),
        tx("To cool the broth", "Um die Brühe zu kühlen"),
      ],
      correct: 0,
    },
  ],
} satisfies StepsContent;

export const KOCH = {
  kind: "steps",
  title: tx("Koch's postulates", "Kochsche Postulate"),
  intro: tx(
    "How do you prove that a germ causes a disease? Koch's postulates set out the steps, here with anthrax in mice.",
    "Wie beweist man, dass ein Keim eine Krankheit verursacht? Die Kochschen Postulate legen die Schritte fest, hier am Beispiel Milzbrand bei Mäusen.",
  ),
  steps: [
    {
      short: tx("Found", "Gefunden"),
      title: tx("1. Always present in the sick", "1. Bei Kranken immer vorhanden"),
      body: tx("The germ is found in every individual with the disease, but not in healthy ones.", "Der Erreger lässt sich bei jedem Erkrankten nachweisen, bei Gesunden aber nicht."),
    },
    {
      short: tx("Isolated", "Isoliert"),
      title: tx("2. Pure culture", "2. Reinkultur"),
      body: tx("The germ is isolated from the sick individual and grown in pure culture outside the body.", "Der Erreger wird aus dem Kranken isoliert und außerhalb des Körpers in Reinkultur gezüchtet."),
      facts: [tx("This needs solid media, the reason Koch's lab invented them.", "Dafür braucht man feste Nährböden, darum wurden sie in Kochs Labor erfunden.")],
    },
    {
      short: tx("Infected", "Übertragen"),
      title: tx("3. Same disease again", "3. Dieselbe Krankheit"),
      body: tx("The pure culture, given to a healthy, susceptible individual, causes the same disease.", "Die Reinkultur löst bei einem gesunden, empfänglichen Organismus dieselbe Krankheit aus."),
    },
    {
      short: tx("Re-isolated", "Wiedergefunden"),
      title: tx("4. Found again", "4. Wieder isoliert"),
      body: tx("The same germ is isolated again from the newly sick individual.", "Aus dem neu erkrankten Organismus lässt sich derselbe Erreger wieder isolieren."),
      facts: [tx("This fourth postulate was added later.", "Dieses vierte Postulat wurde später ergänzt.")],
    },
    {
      short: tx("Limits", "Grenzen"),
      title: tx("Where they reach their limits", "Wo sie an Grenzen stoßen"),
      body: tx(
        "Not every disease fits: some germs can't be grown in pure culture, some people carry a germ without falling ill, and some diseases have several causes.",
        "Nicht jede Krankheit passt: Manche Erreger lassen sich nicht in Reinkultur züchten, manche Menschen tragen einen Erreger, ohne krank zu werden, und manche Krankheiten haben mehrere Ursachen.",
      ),
      facts: [
        tx("Not culturable: Treponema pallidum (syphilis), Mycobacterium leprae (leprosy), viruses without cells.", "Nicht anzüchtbar: Treponema pallidum (Syphilis), Mycobacterium leprae (Lepra), Viren ohne Zellen."),
        tx("Healthy carriers, such as with Salmonella Typhi (\"Typhoid Mary\") or cholera, break postulate 1.", "Gesunde Träger, etwa bei Salmonella Typhi („Typhoid Mary“) oder Cholera, verletzen Postulat 1."),
        tx("Today there are molecular postulates for virulence genes (Falkow, 1988).", "Heute gibt es molekulare Postulate für Virulenzgene (Falkow, 1988)."),
      ],
    },
  ],
  questions: [
    {
      q: tx("What does the second postulate ask for?", "Was fordert das zweite Postulat?"),
      options: [tx("Isolating the germ and growing a pure culture", "Den Erreger isolieren und in Reinkultur züchten"), tx("A vaccine", "Einen Impfstoff"), tx("A cure", "Eine Heilung"), tx("A Gram stain", "Eine Gramfärbung")],
      correct: 0,
    },
    {
      q: tx("Why does Treponema pallidum not fulfil the postulates?", "Warum erfüllt Treponema pallidum die Postulate nicht?"),
      options: [tx("It can't be grown in pure culture", "Es lässt sich nicht in Reinkultur züchten"), tx("It is a virus", "Es ist ein Virus"), tx("It causes no disease", "Es verursacht keine Krankheit"), tx("It is too big", "Es ist zu groß")],
      correct: 0,
    },
    {
      q: tx("A person carries a germ but isn't ill. Which postulate does that break?", "Ein Mensch trägt einen Erreger, ist aber nicht krank. Welches Postulat verletzt das?"),
      options: [tx("The first", "Das erste"), tx("The second", "Das zweite"), tx("The third", "Das dritte"), tx("None", "Keines")],
      correct: 0,
    },
  ],
} satisfies StepsContent;

export const CONTENT: ModelContent = { slug: "history", views: { timeline: TIMELINE, pasteur: PASTEUR, koch: KOCH } };
