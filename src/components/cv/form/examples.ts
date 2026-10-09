import type { Locale } from "@/i18n/config";
import type { CvLanguageLevel } from "@/cv/types";

// Text the form puts ON the CV (headline ideas, starter profiles, skill / language / hobby chips).
// It is written in the CV's own language (cv.lang), not the app's. "…" marks a gap to fill in:
// the form selects it after inserting, so typing replaces it.

export type SummaryGoal = "internship" | "apprenticeship" | "job";

type Examples = {
  headlines: string[];
  summaries: Record<SummaryGoal, string>;
  skills: string[];
  languages: { name: string; level: CvLanguageLevel }[];
  interests: string[];
};

export const CV_EXAMPLES: Record<Locale, Examples> = {
  de: {
    headlines: [
      "Bewerbung um ein Schülerpraktikum als …",
      "Bewerbung um einen Ausbildungsplatz als …",
      "Schülerin der … Klasse",
      "Schüler der … Klasse",
    ],
    summaries: {
      internship:
        "Ich gehe in die … Klasse der … und bin neugierig, zuverlässig und hilfsbereit. Mein Lieblingsfach ist …, weil ich dort … kann. Meine Freizeit verbringe ich am liebsten mit …, dabei habe ich gelernt, im Team zu arbeiten und Verantwortung zu übernehmen. In einem Praktikum als … möchte ich herausfinden, ob dieser Beruf zu mir passt.",
      apprenticeship:
        "Im Sommer … schließe ich die … mit dem … ab. Schon lange begeistere ich mich für …, und in meinem Praktikum bei … habe ich gemerkt, wie viel Spaß mir diese Arbeit macht. Ich bin zuverlässig, packe gern mit an und lerne schnell dazu. Deshalb möchte ich eine Ausbildung als … beginnen.",
      job: "Ich bin … Jahre alt, gehe in die … Klasse der … und suche einen Nebenjob als …, am liebsten nachmittags oder am Wochenende. Ich bin pünktlich, freundlich und arbeite gern mit Menschen. Erste Erfahrungen habe ich schon beim … gesammelt.",
    },
    skills: [
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Microsoft Excel",
      "Canva",
      "Zehnfingersystem",
      "Bildbearbeitung",
      "Videoschnitt",
      "Programmieren (Scratch)",
      "Erste Hilfe",
      "Führerschein Klasse AM",
      "Führerschein Klasse B",
      "Teamfähigkeit",
      "Zuverlässigkeit",
    ],
    languages: [
      { name: "Deutsch", level: "native" },
      { name: "Englisch", level: "good" },
      { name: "Französisch", level: "school" },
      { name: "Spanisch", level: "school" },
      { name: "Latein", level: "school" },
      { name: "Türkisch", level: "native" },
      { name: "Arabisch", level: "native" },
      { name: "Russisch", level: "native" },
      { name: "Polnisch", level: "native" },
      { name: "Ukrainisch", level: "native" },
    ],
    interests: ["Fußball", "Handball", "Schwimmen", "Tanzen", "Lesen", "Zeichnen", "Fotografie", "Musik machen", "Kochen und Backen", "Programmieren", "Gaming", "Reiten"],
  },
  en: {
    headlines: [
      "Applying for work experience as a …",
      "Applying for an apprenticeship as a …",
      "Year … student at …",
      "Creative, reliable and a great team player",
    ],
    summaries: {
      internship:
        "I am in Year … at … and I am curious, reliable and helpful. My favourite subject is …, because I can … there. In my free time I love …, which has taught me to work in a team and to take responsibility. Through work experience as a … I would like to find out whether this career suits me.",
      apprenticeship:
        "In summer … I will leave … with my …, and I have been fascinated by … for a long time. During my work experience at … I noticed how much I enjoy this kind of work. I am reliable, happy to get stuck in and quick to learn, which is why I would like to start an apprenticeship as a … this year.",
      job: "I am … years old, in Year … at … and I am looking for a part-time job as a …, ideally in the afternoons or at weekends. I am punctual, friendly and enjoy working with people. I gained my first experience as a … last year and really enjoyed it.",
    },
    skills: [
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Microsoft Excel",
      "Canva",
      "Touch typing",
      "Photo editing",
      "Video editing",
      "Coding (Scratch)",
      "First aid",
      "Moped licence (AM)",
      "Driving licence (B)",
      "Teamwork",
      "Reliability",
    ],
    languages: [
      { name: "German", level: "native" },
      { name: "English", level: "good" },
      { name: "French", level: "school" },
      { name: "Spanish", level: "school" },
      { name: "Latin", level: "school" },
      { name: "Turkish", level: "native" },
      { name: "Arabic", level: "native" },
      { name: "Russian", level: "native" },
      { name: "Polish", level: "native" },
      { name: "Ukrainian", level: "native" },
    ],
    interests: ["Football", "Handball", "Swimming", "Dancing", "Reading", "Drawing", "Photography", "Making music", "Cooking and baking", "Coding", "Gaming", "Horse riding"],
  },
};

/** The gap marker in the examples. */
export const BLANK = "…";
