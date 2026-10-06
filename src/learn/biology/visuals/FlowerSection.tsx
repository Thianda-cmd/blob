"use client";

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { CherryFlower } from "./FlowerKit";

// The cherry blossom in longitudinal section with all its parts: the lesson's explore widget
// and the picture for "what is this part called?" tasks.

export const FLOWER_PARTS: FigurePart[] = [
  { id: "petal", label: tx("petal", "Kronblatt"), at: [112, 128], info: tx("White or pink and eye-catching: attracts insects.", "Weiß oder rosa und auffällig: lockt Insekten an.") },
  { id: "sepal", label: tx("sepal", "Kelchblatt"), at: [160, 220], tag: [108, 228], info: tx("Green and small: protected the flower while it was a bud.", "Grün und klein: hat die Blüte in der Knospe geschützt.") },
  { id: "anther", label: tx("anther", "Staubbeutel"), at: [161, 103], tag: [124, 46], info: tx("Makes the pollen. Part of the stamen (male).", "Bildet den Pollen. Teil des Staubblatts (männlich).") },
  { id: "filament", label: tx("filament", "Staubfaden"), at: [304, 150], tag: [356, 46], info: tx("The stalk that holds the anther up. Part of the stamen.", "Der Stiel, der den Staubbeutel trägt. Teil des Staubblatts.") },
  { id: "pollen", label: tx("pollen grains", "Pollen"), at: [158, 88], tag: [64, 46], info: tx("Fine yellow grains (pollen grains). They carry the male sex cells.", "Feine gelbe Körner (Pollenkörner). Sie enthalten die männlichen Keimzellen.") },
  { id: "stigma", label: tx("stigma", "Narbe"), at: [240, 91], tag: [240, 38], info: tx("Sticky top of the pistil: catches the pollen.", "Klebrige Spitze des Stempels: fängt den Pollen auf.") },
  { id: "style", label: tx("style", "Griffel"), at: [241, 150], tag: [278, 58], info: tx("Connects the stigma with the ovary. The pollen tube grows down through it.", "Verbindet Narbe und Fruchtknoten. Der Pollenschlauch wächst durch ihn hindurch.") },
  { id: "ovary", label: tx("ovary", "Fruchtknoten"), at: [256, 238], tag: [368, 262], info: tx("Lowest part of the pistil (female). Becomes the fruit.", "Unterster Teil des Stempels (weiblich). Wird zur Frucht.") },
  { id: "ovule", label: tx("ovule", "Samenanlage"), at: [240, 229], tag: [126, 300], info: tx("Inside the ovary, holds the egg cell. Becomes the seed.", "Liegt im Fruchtknoten und enthält die Eizelle. Wird zum Samen.") },
  { id: "nectar", label: tx("nectar", "Nektar"), at: [207, 226], tag: [96, 266], info: tx("Sweet juice on the inside of the receptacle: the reward for insects.", "Süßer Saft innen am Blütenboden: die Belohnung für Insekten.") },
  { id: "receptacle", label: tx("receptacle", "Blütenboden"), at: [298, 212], tag: [384, 214], info: tx("Cup-shaped base that carries all the other parts of the flower.", "Becherförmiger Grund, der alle anderen Blütenteile trägt.") },
  { id: "stalk", label: tx("flower stalk", "Blütenstiel"), at: [236, 322], tag: [300, 330], info: tx("Connects the flower with the branch.", "Verbindet die Blüte mit dem Zweig.") },
];

/** Groups of parts that belong together (for highlighting from the lesson). */
export const FLOWER_GROUPS = {
  stamen: ["anther", "filament"],
  pistil: ["stigma", "style", "ovary", "ovule"],
};

export function FlowerSection({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure
      title={tx("Cherry blossom, longitudinal section", "Kirschblüte im Längsschnitt")}
      width={480}
      height={360}
      parts={FLOWER_PARTS}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <CherryFlower />
    </Figure>
  );
}

/** Lesson widget: tap the parts of the cherry blossom. */
export function FlowerSectionExplore() {
  return <FlowerSection mode="explore" />;
}
