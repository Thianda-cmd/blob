"use client";

// Level 3 (Experte, Oberstufe): the biomembrane and the fluid mosaic model, compartmentalisation,
// diffusion and osmosis, plasmolysis, passive and active transport (sodium-potassium pump),
// endo- and exocytosis, the endosymbiotic theory and the resolution of microscopes.

import { tx } from "@/i18n/text";
import { createRng } from "@/learn/engine/rng";
import type { LevelLesson } from "@/learn/types";
import { CellEndosymbiosis } from "@/learn/biology/visuals/CellEndosymbiosis";
import { CellMembrane } from "@/learn/biology/visuals/CellMembrane";
import { CellOsmosisLab } from "@/learn/biology/visuals/CellOsmosisLab";
import { CellPump } from "@/learn/biology/visuals/CellPump";
import { generate3, l3 } from "./level3-tasks";

export { generate3 };

function MembraneExplorer() {
  return <CellMembrane mode="explore" />;
}

function EndosymbiosisWidget() {
  return <CellEndosymbiosis />;
}

function PumpWidget() {
  return <CellPump />;
}

const checkOsmosis = l3.osmosisTask(createRng(5), 0);
const checkTransport = l3.transportMatchTask(createRng(9), ["glut", "pump", "phago", "o2"]);
const checkEvidence = l3.evidenceTask(createRng(12));

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The biomembrane", "Die Biomembran"),
      blob: tx("Every cell, every organelle: all wrapped in the same clever skin.", "Jede Zelle, jedes Organell: alle in dieselbe raffinierte Hülle verpackt."),
      frames: [
        {
          math: tx('"phospholipid"#p = "hydrophilic head"#k + "2 hydrophobic tails"#s', '"Phospholipid"#p = "hydrophiler Kopf"#k + "2 hydrophobe Schwänze"#s'),
          note: tx("A phospholipid has a polar, **hydrophilic** head with a phosphate group and two nonpolar, **hydrophobic** fatty acid tails.", "Ein Phospholipid hat einen polaren, **hydrophilen** Kopf mit Phosphatgruppe und zwei unpolare, **hydrophobe** Fettsäurereste."),
        },
        {
          math: tx('"in water:"#w \\; "lipid bilayer"#d', '"in Wasser:"#w \\; "Lipiddoppelschicht"#d'),
          note: tx("In water, phospholipids arrange themselves into a **bilayer**: heads outwards to the water, tails inwards, away from it.", "In Wasser lagern sich Phospholipide von selbst zu einer **Doppelschicht** zusammen: Köpfe nach außen zum Wasser, Schwänze nach innen, weg vom Wasser."),
          highlight: ["d"],
        },
        {
          math: tx('"fluid mosaic model"#m', '"Flüssig-Mosaik-Modell"#m'),
          note: tx(
            "In the **fluid mosaic model** (Singer and Nicolson, 1972) proteins float like icebergs in a fluid sea of lipids. Lipids and many proteins can drift sideways. It is a model that explains many observations.",
            "Im **Flüssig-Mosaik-Modell** (Singer und Nicolson, 1972) schwimmen Proteine wie Eisberge in einem flüssigen Lipidmeer. Lipide und viele Proteine können seitlich wandern. Es ist ein Modell, das viele Beobachtungen erklärt.",
          ),
        },
        {
          math: tx('"thickness:"#t \\; "7–10" "nm" < 0.2 "µm"', '"Dicke:"#t \\; "7–10" "nm" < 0,2 "µm"'),
          note: tx(
            "A biomembrane is only 7 to 10 nm thick. The light microscope resolves only about 0.2 µm. Only the electron microscope (down to about 0.1 nm) shows it as a dark double line.",
            "Eine Biomembran ist nur 7 bis 10 nm dick. Das Lichtmikroskop löst nur etwa 0,2 µm auf. Erst das Elektronenmikroskop (bis etwa 0,1 nm) zeigt sie als dunkle Doppellinie.",
          ),
        },
        {
          math: tx('"compartmentalisation"#c', '"Kompartimentierung"#c'),
          note: tx(
            "Membranes divide the cell into separate **reaction spaces** (compartments): pH 5 inside a lysosome, pH 7 in the cytoplasm. That way opposite reactions can run at the same time without getting in each other's way.",
            "Membranen teilen die Zelle in getrennte **Reaktionsräume** (Kompartimente): pH 5 im Lysosom, pH 7 im Zellplasma. So können gegensätzliche Reaktionen gleichzeitig ablaufen, ohne sich zu stören.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Inside the membrane", "Ein Blick in die Membran"),
      blob: tx("Tap the numbers: who does what in the mosaic?", "Tipp auf die Nummern: Wer macht was im Mosaik?"),
      body: tx(
        "**Channel proteins** form pores, **carriers** bind their substance and change shape, **glycoproteins** carry sugar chains on the outside (**glycocalyx**), and **cholesterol** keeps the fluidity right.",
        "**Kanalproteine** bilden Poren, **Carrier** binden ihren Stoff und ändern ihre Form, **Glykoproteine** tragen außen Zuckerketten (**Glykokalyx**), und **Cholesterin** hält die Fluidität im richtigen Bereich.",
      ),
      widget: MembraneExplorer,
    },
    {
      type: "explain",
      title: tx("Diffusion and osmosis", "Diffusion und Osmose"),
      blob: tx("Particles never sit still. That's the key to everything here.", "Teilchen sitzen nie still. Das ist hier der Schlüssel zu allem."),
      frames: [
        {
          math: tx('"diffusion"#d', '"Diffusion"#d'),
          note: tx(
            "Particles are in constant random motion (Brownian motion). As a result they spread out, **net** from higher to lower concentration, until they are evenly distributed: **diffusion**. It needs no energy from the cell.",
            "Teilchen sind ständig in ungerichteter Bewegung (Brownsche Molekularbewegung). Dadurch verteilen sie sich **netto** vom Ort höherer zum Ort niedrigerer Konzentration, bis sie gleichmäßig verteilt sind: **Diffusion**. Sie braucht keine Energie aus der Zelle.",
          ),
        },
        {
          math: tx('"semipermeable"#s', '"semipermeabel"#s'),
          note: tx("A **semipermeable** (selectively permeable) membrane lets water through easily, but hardly any dissolved particles such as ions or sugar.", "Eine **semipermeable** (selektiv permeable) Membran lässt Wasser leicht durch, viele gelöste Teilchen wie Ionen oder Zucker aber kaum."),
        },
        {
          math: tx('"osmosis"#o = "diffusion of water"#w \\\\ "through a semipermeable membrane"#m', '"Osmose"#o = "Diffusion von Wasser"#w \\\\ "durch eine semipermeable Membran"#m'),
          note: tx("**Osmosis** is the diffusion of water through a semipermeable membrane. Water flows (net) towards the side with the **higher** concentration of dissolved particles.", "**Osmose** ist die Diffusion von Wasser durch eine semipermeable Membran. Wasser strömt netto zur Seite mit der **höheren** Konzentration gelöster Teilchen."),
          highlight: ["o"],
        },
        {
          math: tx('"hypotonic"#a < "isotonic"#b < "hypertonic"#c', '"hypotonisch"#a < "isotonisch"#b < "hypertonisch"#c'),
          note: tx(
            "Compared with the cell: **hypertonic** = more dissolved particles outside (water flows out), **hypotonic** = fewer outside (water flows in), **isotonic** = equal (no net flow).",
            "Im Vergleich zur Zelle: **hypertonisch** = außen mehr gelöste Teilchen (Wasser strömt hinaus), **hypotonisch** = außen weniger (Wasser strömt hinein), **isotonisch** = gleich viel (kein Netto-Strom).",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The osmosis lab: plasmolysis", "Das Osmose-Labor: Plasmolyse"),
      blob: tx("Salt water, fresh water: watch what the cells do!", "Salzwasser, Süßwasser: Schau, was die Zellen machen!"),
      body: tx(
        "Put a red onion cell into salt solution: water leaves the vacuole and the protoplast pulls away from the wall (**plasmolysis**). Back in water it recovers (**deplasmolysis**). Then try a red blood cell: it has no wall.",
        "Leg eine Zelle der roten Zwiebel in Salzlösung: Wasser strömt aus der Vakuole, der Protoplast löst sich von der Wand (**Plasmolyse**). Zurück im Wasser erholt sie sich (**Deplasmolyse**). Dann probier ein rotes Blutkörperchen: Es hat keine Wand.",
      ),
      widget: CellOsmosisLab,
    },
    { type: "check", blob: tx("A classic Abitur question. Think before you click!", "Eine klassische Abiturfrage. Erst denken, dann klicken!"), exercise: checkOsmosis },
    {
      type: "explain",
      title: tx("Passive and active transport", "Passiver und aktiver Transport"),
      blob: tx("Downhill is free. Uphill costs energy.", "Bergab ist gratis. Bergauf kostet Energie."),
      frames: [
        {
          math: tx('"passive:"#p \\; "down the gradient, no ATP"#q', '"passiv:"#p \\; "mit dem Gefälle, ohne ATP"#q'),
          note: tx(
            "**Passive transport** follows the concentration gradient and needs no energy: simple diffusion through the lipids (small nonpolar molecules such as O₂ and CO₂) and **facilitated diffusion** through channel proteins (ions, water through aquaporins) or carriers (e.g. glucose).",
            "**Passiver Transport** folgt dem Konzentrationsgefälle und braucht keine Energie: einfache Diffusion durch die Lipide (kleine unpolare Moleküle wie O₂ und CO₂) und **erleichterte Diffusion** durch Kanalproteine (Ionen, Wasser durch Aquaporine) oder über Carrier (z. B. Glucose).",
          ),
        },
        {
          math: tx('"carrier:"#c \\; "saturation"#s', '"Carrier:"#c \\; "Sättigung"#s'),
          note: tx("Carriers bind their substance specifically and change shape as they do so. As there are only so many, the transport rate only rises up to a maximum (saturation).", "Carrier binden ihren Stoff spezifisch und ändern dabei ihre Form. Weil es nur begrenzt viele gibt, steigt die Transportrate nur bis zu einem Maximum (Sättigung)."),
        },
        {
          math: tx('"active:"#a \\; "against the gradient, with ATP"#b', '"aktiv:"#a \\; "gegen das Gefälle, mit ATP"#b'),
          note: tx(
            "**Active transport** pumps substances against their concentration gradient and uses energy. **Primary active**: directly with ATP, like the sodium-potassium pump. **Secondary active**: driven by the Na⁺ gradient, like glucose uptake in the small intestine.",
            "**Aktiver Transport** pumpt Stoffe gegen ihr Konzentrationsgefälle und verbraucht Energie. **Primär aktiv**: direkt mit ATP, wie die Natrium-Kalium-Pumpe. **Sekundär aktiv**: angetrieben vom Na⁺-Gefälle, wie die Glucoseaufnahme im Dünndarm.",
          ),
          highlight: ["b"],
        },
        {
          math: tx('"endocytosis"#e \\quad "exocytosis"#x', '"Endocytose"#e \\quad "Exocytose"#x'),
          note: tx(
            "Large particles are moved in **vesicles**: the membrane flows around them and pinches off inwards (**endocytosis**, e.g. phagocytosis of bacteria). In **exocytosis** vesicles fuse with the membrane and release their contents outside.",
            "Große Partikel werden in **Vesikeln** transportiert: Die Membran umfließt sie und schnürt sich nach innen ab (**Endocytose**, z. B. Phagocytose von Bakterien). Bei der **Exocytose** verschmelzen Vesikel mit der Membran und geben ihren Inhalt nach außen ab.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The sodium-potassium pump", "Die Natrium-Kalium-Pumpe"),
      blob: tx("Step through one cycle of the most famous pump in biology.", "Geh einen Zyklus der berühmtesten Pumpe der Biologie Schritt für Schritt durch."),
      body: tx(
        "Per ATP it pumps **3 Na⁺ out** and **2 K⁺ in**, both against their gradients. It keeps Na⁺ high outside and K⁺ high inside, which nerve cells, for example, depend on.",
        "Pro ATP pumpt sie **3 Na⁺ hinaus** und **2 K⁺ hinein**, beide gegen ihr Gefälle. So bleibt außen viel Na⁺ und innen viel K⁺, worauf zum Beispiel Nervenzellen angewiesen sind.",
      ),
      widget: PumpWidget,
    },
    { type: "check", blob: tx("Down or up the gradient? Through the lipids, a protein or a vesicle?", "Mit oder gegen das Gefälle? Durch die Lipide, ein Protein oder ein Vesikel?"), exercise: checkTransport },
    {
      type: "widget",
      title: tx("The endosymbiotic theory", "Die Endosymbiontentheorie"),
      blob: tx("Your mitochondria were once free-living bacteria. Really!", "Deine Mitochondrien waren einmal freilebende Bakterien. Wirklich!"),
      body: tx(
        "According to the **endosymbiotic theory** (Lynn Margulis, 1967), mitochondria and chloroplasts come from bacteria that were taken up by a host cell and stayed. Step through the story.",
        "Nach der **Endosymbiontentheorie** (Lynn Margulis, 1967) stammen Mitochondrien und Chloroplasten von Bakterien ab, die eine Wirtszelle aufgenommen hat und die geblieben sind. Geh die Geschichte Schritt für Schritt durch.",
      ),
      widget: EndosymbiosisWidget,
    },
    { type: "check", blob: tx("What really counts as evidence? Careful, some are true but prove nothing.", "Was zählt wirklich als Beleg? Vorsicht, manches stimmt, beweist aber nichts."), exercise: checkEvidence },
  ],
  summary: [
    {
      title: tx("The biomembrane", "Die Biomembran"),
      body: tx(
        "Phospholipid bilayer (hydrophilic heads outside, hydrophobic tails inside) with proteins: channels, carriers, glycoproteins with the glycocalyx outside. Fluid mosaic model: lipids and proteins can move sideways. 7–10 nm thick. Membranes create compartments (separate reaction spaces).",
        "Phospholipid-Doppelschicht (hydrophile Köpfe außen, hydrophobe Schwänze innen) mit Proteinen: Kanäle, Carrier, Glykoproteine mit der Glykokalyx außen. Flüssig-Mosaik-Modell: Lipide und Proteine sind seitlich beweglich. 7–10 nm dick. Membranen bilden Kompartimente (getrennte Reaktionsräume).",
      ),
      tone: "rule",
    },
    {
      title: tx("Osmosis", "Osmose"),
      body: tx("Diffusion of water through a semipermeable membrane, net towards the higher concentration of dissolved particles.", "Diffusion von Wasser durch eine semipermeable Membran, netto zur höheren Konzentration gelöster Teilchen."),
      examples: [
        tx('"hypertonic outside:" \\; "water out" \\to "plasmolysis"', '"außen hypertonisch:" \\; "Wasser hinaus" \\to "Plasmolyse"'),
        tx('"hypotonic outside:" \\; "water in" \\to "turgor"', '"außen hypotonisch:" \\; "Wasser hinein" \\to "Turgor"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Transport across membranes", "Membrantransport"),
      body: tx(
        "Passive (down the gradient, no ATP): simple diffusion, facilitated diffusion via channels or carriers (saturation). Active (against the gradient): primary with ATP, secondary via an ion gradient. Big particles: endocytosis and exocytosis in vesicles.",
        "Passiv (mit dem Gefälle, ohne ATP): einfache Diffusion, erleichterte Diffusion über Kanäle oder Carrier (Sättigung). Aktiv (gegen das Gefälle): primär mit ATP, sekundär über ein Ionengefälle. Große Partikel: Endo- und Exocytose in Vesikeln.",
      ),
      examples: [tx('1 "ATP:" \\; 3 \\ce{Na+} "out" , 2 \\ce{K+} "in"', '1 "ATP:" \\; 3 \\ce{Na+} "hinaus" , 2 \\ce{K+} "hinein"')],
      tone: "rule",
    },
    {
      title: tx("Endosymbiotic theory", "Endosymbiontentheorie"),
      body: tx(
        "Mitochondria (from aerobic bacteria) and chloroplasts (from cyanobacteria) were once free-living prokaryotes. Evidence: double membrane, their own ring-shaped DNA, 70S ribosomes, they divide like bacteria and have about their size.",
        "Mitochondrien (aus aeroben Bakterien) und Chloroplasten (aus Cyanobakterien) waren einst freilebende Prokaryoten. Belege: Doppelmembran, eigene ringförmige DNA, 70S-Ribosomen, Teilung wie bei Bakterien und etwa deren Größe.",
      ),
      tone: "tip",
    },
    {
      title: tx("Resolution", "Auflösungsvermögen"),
      body: tx("Light microscope about 0.2 µm (limited by the wavelength of light), electron microscope about 0.1 nm. Magnifying beyond the resolution shows no new detail (empty magnification).", "Lichtmikroskop etwa 0,2 µm (begrenzt durch die Wellenlänge des Lichts), Elektronenmikroskop etwa 0,1 nm. Vergrößern über die Auflösung hinaus zeigt keine neuen Details (leere Vergrößerung)."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Water flows towards the higher concentration of dissolved particles, not away from it. In osmosis the water moves, not the salt. Plant cells don't burst (wall), red blood cells do. A carrier isn't automatically active. Mitochondria can no longer live on their own.",
        "Wasser strömt zur höheren Konzentration gelöster Teilchen, nicht weg davon. Bei der Osmose wandert das Wasser, nicht das Salz. Pflanzenzellen platzen nicht (Zellwand), rote Blutkörperchen schon. Ein Carrier ist nicht automatisch aktiv. Mitochondrien können nicht mehr allein leben.",
      ),
      tone: "warning",
    },
  ],
};
