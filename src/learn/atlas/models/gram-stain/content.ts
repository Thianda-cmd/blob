import { tx } from "@/i18n/text";
import type { ModelContent, StepsContent } from "../../types";

/** The Gram stain, step by step, with a Gram-positive and a Gram-negative cell side by side. */

export const PROCEDURE = {
  kind: "steps",
  title: tx("Step by step", "Ablauf"),
  intro: tx(
    "Hans Christian Gram found this stain in 1884. It sorts bacteria into two groups by their cell wall, and it is still the first thing a lab does with an unknown sample. Left: what goes on the slide. Right: what happens in a Gram-positive and a Gram-negative cell.",
    "Hans Christian Gram fand diese Färbung 1884. Sie teilt Bakterien nach ihrer Zellwand in zwei Gruppen ein und ist bis heute das Erste, was ein Labor mit einer unbekannten Probe macht. Links: was auf den Objektträger kommt. Rechts: was in einer grampositiven und einer gramnegativen Zelle passiert.",
  ),
  steps: [
    {
      short: tx("Smear", "Ausstrich"),
      title: tx("Smear and heat fixing", "Ausstrich und Hitzefixierung"),
      body: tx(
        "Spread the bacteria thinly on a slide, let it dry in the air, then pull it through the flame. That kills the bacteria and sticks them to the glass. They have no colour yet.",
        "Die Bakterien dünn auf einem Objektträger verteilen, an der Luft trocknen lassen und dann durch die Flamme ziehen. Das tötet sie ab und klebt sie aufs Glas. Noch haben sie keine Farbe.",
      ),
      facts: [
        tx("Spread thinly: thick smears don't decolourise evenly.", "Dünn ausstreichen: Dicke Ausstriche entfärben ungleichmäßig."),
        tx("Use young cultures (about 18–24 h): old Gram-positive cells can look Gram-negative.", "Junge Kulturen nehmen (etwa 18–24 h): Alte grampositive Zellen können gramnegativ erscheinen."),
        tx("Pull through the flame about three times, smear side up.", "Etwa dreimal durch die Flamme ziehen, Ausstrich nach oben."),
      ],
    },
    {
      short: tx("Violet", "Violett"),
      title: tx("Crystal violet", "Kristallviolett"),
      time: tx("1 min", "1 min"),
      body: tx(
        "Cover the smear with crystal violet (or gentian violet). The dye goes into every cell: now all of them are violet. Then rinse briefly with water.",
        "Den Ausstrich mit Kristallviolett (oder Gentianaviolett) bedecken. Der Farbstoff dringt in jede Zelle ein: Jetzt sind alle violett. Danach kurz mit Wasser abspülen.",
      ),
      facts: [
        tx("Crystal violet is a basic (cationic) dye: it binds to negatively charged parts of the cell.", "Kristallviolett ist ein basischer (kationischer) Farbstoff: Er bindet an negativ geladene Zellbestandteile."),
        tx("This is the primary stain.", "Das ist die Erstfärbung."),
      ],
    },
    {
      short: tx("Iodine", "Lugol"),
      title: tx("Lugol's iodine", "Lugolsche Lösung"),
      time: tx("1 min", "1 min"),
      body: tx(
        "Lugol's solution (iodine in potassium iodide) acts as a mordant: iodine and crystal violet form large dye–iodine complexes that get stuck in the cell.",
        "Lugolsche Lösung (Iod in Kaliumiodid) wirkt als Beize: Iod und Kristallviolett bilden große Farbstoff-Iod-Komplexe, die in der Zelle festsitzen.",
      ),
      facts: [
        tx("The complexes are much bigger than single dye molecules and harder to wash out.", "Die Komplexe sind viel größer als einzelne Farbstoffmoleküle und schwerer auszuwaschen."),
        tx("Both cells are still violet.", "Beide Zellen sind weiterhin violett."),
      ],
    },
    {
      short: tx("Alcohol", "Alkohol"),
      title: tx("Decolourising with alcohol", "Entfärben mit Alkohol"),
      time: tx("a few seconds", "wenige Sekunden"),
      body: tx(
        "Drip alcohol (usually 96 % ethanol, or acetone–alcohol) over the slide until no more colour runs off, then rinse at once. This is where the groups part: Gram-positives stay violet, Gram-negatives turn colourless.",
        "Alkohol (meist 96 % Ethanol, oder Aceton-Alkohol) auftropfen, bis keine Farbe mehr abläuft, dann sofort abspülen. Hier trennen sich die Gruppen: Grampositive bleiben violett, gramnegative werden farblos.",
      ),
      facts: [
        tx("Gram-positive: the alcohol dehydrates the thick murein, its pores shrink and the complex stays trapped.", "Grampositiv: Der Alkohol entwässert das dicke Murein, seine Poren schrumpfen und der Komplex bleibt gefangen."),
        tx("Gram-negative: the alcohol dissolves the lipids of the outer membrane; the thin murein can't hold the complex and it washes out.", "Gramnegativ: Der Alkohol löst die Lipide der äußeren Membran; die dünne Mureinschicht hält den Komplex nicht, er wird ausgewaschen."),
      ],
      tip: tx(
        "The trickiest step. Decolourise too long and Gram-positives look red too (falsely Gram-negative); too short and Gram-negatives stay violet.",
        "Der heikelste Schritt. Zu lange entfärbt, erscheinen auch Grampositive rot (falsch gramnegativ); zu kurz, bleiben Gramnegative violett.",
      ),
    },
    {
      short: tx("Red", "Rot"),
      title: tx("Counterstain with safranin", "Gegenfärbung mit Safranin"),
      time: tx("1 min", "1 min"),
      body: tx(
        "Finally stain with safranin (or dilute carbol fuchsin). The colourless Gram-negative cells turn red. Gram-positives take up the red dye too, but their dark violet hides it.",
        "Zum Schluss mit Safranin (oder verdünntem Karbolfuchsin) gegenfärben. Die farblosen gramnegativen Zellen werden rot. Grampositive nehmen den roten Farbstoff auch auf, aber ihr dunkles Violett überdeckt ihn.",
      ),
      facts: [tx("This is the counterstain: without it, Gram-negatives would be almost invisible.", "Das ist die Gegenfärbung: Ohne sie wären Gramnegative fast unsichtbar.")],
    },
    {
      short: tx("Result", "Ergebnis"),
      title: tx("Under the microscope", "Unter dem Mikroskop"),
      body: tx(
        "Rinse, dry and look with oil immersion (100× objective, 1000× magnification). Gram-positive: violet to blue. Gram-negative: red to pink.",
        "Abspülen, trocknen und mit Ölimmersion mikroskopieren (100er-Objektiv, 1000-fache Vergrößerung). Grampositiv: violett bis blau. Gramnegativ: rot bis rosa.",
      ),
      facts: [
        tx("Gram-positive: Staphylococcus, Streptococcus, Bacillus, Clostridium, Listeria.", "Grampositiv: Staphylococcus, Streptococcus, Bacillus, Clostridium, Listeria."),
        tx("Gram-negative: E. coli, Salmonella, Pseudomonas, Neisseria, Helicobacter.", "Gramnegativ: E. coli, Salmonella, Pseudomonas, Neisseria, Helicobacter."),
        tx("Not Gram-stainable: mycobacteria (waxy wall, use Ziehl-Neelsen) and mycoplasmas (no wall).", "Nicht nach Gram färbbar: Mykobakterien (wachsartige Wand, Ziehl-Neelsen-Färbung) und Mykoplasmen (keine Zellwand)."),
      ],
      tip: tx("Negative = red, like a bank account in the red.", "Negativ = rot, wie die roten Zahlen auf dem Konto."),
    },
  ],
  questions: [
    {
      q: tx("Which step decides whether a cell looks Gram-positive or Gram-negative?", "Welcher Schritt entscheidet, ob eine Zelle grampositiv oder gramnegativ erscheint?"),
      options: [tx("Decolourising with alcohol", "Das Entfärben mit Alkohol"), tx("Crystal violet", "Das Kristallviolett"), tx("Heat fixing", "Die Hitzefixierung"), tx("The counterstain", "Die Gegenfärbung")],
      correct: 0,
    },
    {
      q: tx("What does Lugol's solution do?", "Wozu dient die Lugolsche Lösung?"),
      options: [
        tx("It forms a large complex with crystal violet (mordant)", "Sie bildet mit Kristallviolett einen großen Komplex (Beize)"),
        tx("It removes the dye", "Sie entfernt den Farbstoff"),
        tx("It stains Gram-negatives red", "Sie färbt Gramnegative rot"),
        tx("It kills the bacteria", "Sie tötet die Bakterien ab"),
      ],
      correct: 0,
    },
    {
      q: tx("What colour are Gram-negative bacteria at the end?", "Welche Farbe haben gramnegative Bakterien am Ende?"),
      options: [tx("Red to pink", "Rot bis rosa"), tx("Violet", "Violett"), tx("Green", "Grün"), tx("Colourless", "Farblos")],
      correct: 0,
    },
    {
      q: tx("You decolourise for far too long. What happens?", "Du entfärbst viel zu lange. Was passiert?"),
      options: [
        tx("Gram-positives look falsely Gram-negative", "Grampositive erscheinen fälschlich gramnegativ"),
        tx("Gram-negatives look Gram-positive", "Gramnegative erscheinen grampositiv"),
        tx("Nothing changes", "Nichts ändert sich"),
        tx("All cells stay violet", "Alle Zellen bleiben violett"),
      ],
      correct: 0,
    },
    {
      q: tx("Why do mycobacteria stain poorly with Gram's method?", "Warum lassen sich Mykobakterien schlecht nach Gram färben?"),
      options: [
        tx("Their wall contains waxy mycolic acids", "Ihre Wand enthält wachsartige Mykolsäuren"),
        tx("They have no DNA", "Sie haben keine DNA"),
        tx("They are too big", "Sie sind zu groß"),
        tx("They have an outer membrane with LPS", "Sie haben eine äußere Membran mit LPS"),
      ],
      correct: 0,
      why: tx("Mycobacteria are stained with the Ziehl-Neelsen method (hot carbol fuchsin, acid alcohol): they are acid-fast.", "Mykobakterien färbt man nach Ziehl-Neelsen (heißes Karbolfuchsin, Salzsäure-Alkohol): Sie sind säurefest."),
    },
    {
      q: tx("Which objective do you look at a Gram stain with?", "Mit welchem Objektiv mikroskopiert man ein Gram-Präparat?"),
      options: [tx("100× oil immersion", "100er-Ölimmersion"), tx("10×, dry", "10er, trocken"), tx("40×, dry", "40er, trocken"), tx("A magnifying glass", "Eine Lupe")],
      correct: 0,
    },
  ],
} satisfies StepsContent;

export const CONTENT: ModelContent = { slug: "gram-stain", views: { procedure: PROCEDURE } };
