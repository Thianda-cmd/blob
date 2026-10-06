// Facts shared by the levels of "cell-division": chromosome numbers of living things.

import { tx, type Text } from "@/i18n/text";

export type Organism = {
  id: string;
  /** Name with article for a sentence: "A dog's body cells", "Die Körperzellen eines Hundes". */
  cells: Text;
  /** "in dogs" / "beim Hund" */
  at: Text;
  /** Short name for tables and options. */
  name: Text;
  n2: number;
  plant?: boolean;
  /** A body cell that divides by mitosis. */
  bodyCell: Text;
};

export const ORGANISMS: Organism[] = [
  { id: "human", cells: tx("Human body cells", "Die Körperzellen des Menschen"), at: tx("in humans", "beim Menschen"), name: tx("human", "Mensch"), n2: 46, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "chimp", cells: tx("A chimpanzee's body cells", "Die Körperzellen eines Schimpansen"), at: tx("in chimpanzees", "beim Schimpansen"), name: tx("chimpanzee", "Schimpanse"), n2: 48, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "dog", cells: tx("A dog's body cells", "Die Körperzellen eines Hundes"), at: tx("in dogs", "beim Hund"), name: tx("dog", "Hund"), n2: 78, bodyCell: tx("liver cell", "Leberzelle") },
  { id: "cat", cells: tx("A cat's body cells", "Die Körperzellen einer Katze"), at: tx("in cats", "bei der Katze"), name: tx("cat", "Katze"), n2: 38, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "horse", cells: tx("A horse's body cells", "Die Körperzellen eines Pferdes"), at: tx("in horses", "beim Pferd"), name: tx("horse", "Pferd"), n2: 64, bodyCell: tx("bone marrow cell", "Knochenmarkzelle") },
  { id: "cattle", cells: tx("A cow's body cells", "Die Körperzellen eines Rindes"), at: tx("in cattle", "beim Rind"), name: tx("cattle", "Rind"), n2: 60, bodyCell: tx("intestinal cell", "Darmzelle") },
  { id: "mouse", cells: tx("A mouse's body cells", "Die Körperzellen einer Maus"), at: tx("in mice", "bei der Maus"), name: tx("mouse", "Maus"), n2: 40, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "rabbit", cells: tx("A rabbit's body cells", "Die Körperzellen eines Kaninchens"), at: tx("in rabbits", "beim Kaninchen"), name: tx("rabbit", "Kaninchen"), n2: 44, bodyCell: tx("intestinal cell", "Darmzelle") },
  { id: "sheep", cells: tx("A sheep's body cells", "Die Körperzellen eines Schafes"), at: tx("in sheep", "beim Schaf"), name: tx("sheep", "Schaf"), n2: 54, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "chicken", cells: tx("A chicken's body cells", "Die Körperzellen eines Huhns"), at: tx("in chickens", "beim Huhn"), name: tx("chicken", "Huhn"), n2: 78, bodyCell: tx("skin cell", "Hautzelle") },
  { id: "fly", cells: tx("A fruit fly's body cells", "Die Körperzellen einer Taufliege"), at: tx("in the fruit fly", "bei der Taufliege"), name: tx("fruit fly", "Taufliege"), n2: 8, bodyCell: tx("gut cell", "Darmzelle") },
  { id: "pea", cells: tx("The body cells of a pea plant", "Die Körperzellen einer Erbsenpflanze"), at: tx("in peas", "bei der Erbse"), name: tx("pea", "Erbse"), n2: 14, plant: true, bodyCell: tx("root tip cell", "Zelle der Wurzelspitze") },
  { id: "maize", cells: tx("The body cells of a maize plant", "Die Körperzellen einer Maispflanze"), at: tx("in maize", "beim Mais"), name: tx("maize", "Mais"), n2: 20, plant: true, bodyCell: tx("root tip cell", "Zelle der Wurzelspitze") },
  { id: "rye", cells: tx("The body cells of a rye plant", "Die Körperzellen einer Roggenpflanze"), at: tx("in rye", "beim Roggen"), name: tx("rye", "Roggen"), n2: 14, plant: true, bodyCell: tx("shoot tip cell", "Zelle der Sprossspitze") },
  { id: "tomato", cells: tx("The body cells of a tomato plant", "Die Körperzellen einer Tomatenpflanze"), at: tx("in tomatoes", "bei der Tomate"), name: tx("tomato", "Tomate"), n2: 24, plant: true, bodyCell: tx("root tip cell", "Zelle der Wurzelspitze") },
];

export const HUMAN = ORGANISMS[0];
export const ANIMALS = ORGANISMS.filter((o) => !o.plant);
