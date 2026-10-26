import type { Locale } from "@/i18n/config";
import { newId, type Question } from "./model";

// The example quiz on /quiz: one question of every type, to see how it plays before making one.

type Spec = Omit<Question, "id" | "choices" | "accepted" | "slider" | "explain" | "image" | "multi"> & {
  choices?: [string, boolean][];
  accepted?: string[];
  slider?: Question["slider"];
  explain?: string;
  multi?: boolean;
};

const build = (s: Spec): Question => ({
  id: newId(),
  type: s.type,
  text: s.text,
  image: null,
  time: s.time,
  points: s.points,
  choices: (s.choices ?? []).map(([text, correct]) => ({ id: newId(), text, correct })),
  multi: s.multi ?? false,
  accepted: s.accepted ?? [],
  slider: s.slider ?? null,
  explain: s.explain ?? "",
});

export function sampleQuiz(locale: Locale): { title: string; description: string; questions: Question[] } {
  if (locale === "de")
    return {
      title: "Blobs Wissens-Mix",
      description: "Ein bisschen von allem: Bio, Erdkunde, Mathe und Weltall. Jede Art von Frage einmal.",
      questions: [
        build({ type: "quiz", text: "Welches Organell ist das Kraftwerk der Zelle?", time: 20, points: "standard", choices: [["Mitochondrium", true], ["Zellkern", false], ["Ribosom", false], ["Chloroplast", false]], explain: "In den Mitochondrien gewinnt die Zelle bei der Zellatmung Energie (ATP)." }),
        build({ type: "truefalse", text: "Wasser kocht auf Meereshöhe bei 100 °C.", time: 10, points: "standard", choices: [["Richtig", true], ["Falsch", false]] }),
        build({ type: "type", text: "Wie heißt die Hauptstadt von Australien?", time: 30, points: "standard", accepted: ["Canberra"], explain: "Nicht Sydney! Canberra wurde extra als Hauptstadt gebaut." }),
        build({ type: "puzzle", text: "Von der Sonne aus: Bring die Planeten in die richtige Reihenfolge.", time: 30, points: "standard", choices: [["Merkur", true], ["Venus", true], ["Erde", true], ["Mars", true]] }),
        build({ type: "slider", text: "Wie viele Knochen hat ein erwachsener Mensch?", time: 20, points: "double", slider: { min: 100, max: 400, step: 1, value: 206, margin: "medium", unit: "" }, explain: "206 – bei Babys sind es noch über 300, viele wachsen später zusammen." }),
        build({ type: "quiz", text: "Welche dieser Zahlen sind Primzahlen?", time: 20, points: "standard", multi: true, choices: [["2", true], ["9", false], ["11", true], ["15", false]] }),
        build({ type: "poll", text: "Und, wie hat dir das Quiz gefallen?", time: 20, points: "none", choices: [["Super!", false], ["Ganz gut", false], ["Geht so", false], ["Mehr Fragen!", false]] }),
      ],
    };
  return {
    title: "Blob's Brain Mix",
    description: "A bit of everything: biology, geography, maths and space. Every kind of question once.",
    questions: [
      build({ type: "quiz", text: "Which organelle is the powerhouse of the cell?", time: 20, points: "standard", choices: [["Mitochondrion", true], ["Nucleus", false], ["Ribosome", false], ["Chloroplast", false]], explain: "Mitochondria release energy (ATP) in cellular respiration." }),
      build({ type: "truefalse", text: "At sea level, water boils at 100 °C.", time: 10, points: "standard", choices: [["True", true], ["False", false]] }),
      build({ type: "type", text: "What is the capital of Australia?", time: 30, points: "standard", accepted: ["Canberra"], explain: "Not Sydney! Canberra was built to be the capital." }),
      build({ type: "puzzle", text: "Starting from the Sun: put the planets in order.", time: 30, points: "standard", choices: [["Mercury", true], ["Venus", true], ["Earth", true], ["Mars", true]] }),
      build({ type: "slider", text: "How many bones does an adult human have?", time: 20, points: "double", slider: { min: 100, max: 400, step: 1, value: 206, margin: "medium", unit: "" }, explain: "206 – babies have over 300, many of them fuse later." }),
      build({ type: "quiz", text: "Which of these numbers are prime?", time: 20, points: "standard", multi: true, choices: [["2", true], ["9", false], ["11", true], ["15", false]] }),
      build({ type: "poll", text: "So, how did you like the quiz?", time: 20, points: "none", choices: [["Loved it!", false], ["Pretty good", false], ["It was okay", false], ["More questions!", false]] }),
    ],
  };
}
