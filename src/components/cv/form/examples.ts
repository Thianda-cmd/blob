import type { Locale } from "@/i18n/config";
import type { LetterPart } from "@/cv/model";
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
  /** The cover letter: subject lines, reference lines, the three parts per goal, regards, enclosures. */
  letter: {
    subjects: string[];
    references: string[];
    parts: Record<SummaryGoal, Record<LetterPart, string>>;
    regards: string[];
    enclosures: string[];
  };
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
    letter: {
      subjects: ["Bewerbung um ein Schülerpraktikum als …", "Bewerbung um einen Ausbildungsplatz als … ab …", "Bewerbung um einen Minijob als …"],
      references: ["Ihre Anzeige auf … vom …", "Unser Telefonat am … mit Frau …", "Ihr Stand auf der Ausbildungsmesse in …"],
      // After "Sehr geehrte Frau Berger," a German letter goes on in lower case.
      parts: {
        internship: {
          opening:
            "mit großem Interesse habe ich gesehen, dass Sie Schülerpraktika anbieten. Weil mich der Beruf … sehr interessiert, bewerbe ich mich bei Ihnen um ein Praktikum vom … bis zum ….",
          body: "Zurzeit gehe ich in die … Klasse der …. Meine Lieblingsfächer sind … und …, weil ich dort …. In meiner Freizeit …, dabei habe ich gelernt, ….\nIn einem Praktikum bei Ihnen möchte ich herausfinden, ob der Beruf … zu mir passt. Besonders gespannt bin ich auf ….",
          ending: "Über eine Zusage oder eine Einladung zu einem persönlichen Gespräch freue ich mich sehr.",
        },
        apprenticeship: {
          opening:
            "auf der Suche nach einem Ausbildungsplatz bin ich auf Ihre Anzeige auf … gestoßen. Weil mich der Beruf … schon lange begeistert, bewerbe ich mich bei Ihnen um einen Ausbildungsplatz ab ….",
          body: "Im Sommer … beende ich die … mit dem …. In der Schule mag ich besonders …, und in meinem Praktikum bei … habe ich gemerkt, wie viel Spaß mir … macht.\nIch bin zuverlässig, arbeite gern im Team und lerne schnell dazu. Das konnte ich zum Beispiel als … zeigen. Ihr Betrieb gefällt mir besonders, weil ….",
          ending: "Über eine Einladung zu einem Vorstellungsgespräch freue ich mich sehr.",
        },
        job: {
          opening: "ich habe gelesen, dass Sie eine Aushilfe für … suchen. Ich bin … Jahre alt, gehe in die … Klasse und habe nachmittags und am Wochenende Zeit.",
          body: "Ich bin pünktlich, freundlich und packe gern mit an. Erste Erfahrungen habe ich schon bei … gesammelt, wo ich …. Mit Menschen zu arbeiten macht mir Spaß.",
          ending: "Gern komme ich zum Probearbeiten vorbei. Über eine Rückmeldung freue ich mich.",
        },
      },
      regards: ["Mit freundlichen Grüßen", "Freundliche Grüße", "Viele Grüße"],
      enclosures: ["Lebenslauf", "Zeugnisse", "Praktikumsbescheinigung", "Zertifikate", "Empfehlungsschreiben"],
    },
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
    letter: {
      subjects: ["Application for work experience as a …", "Application for an apprenticeship as a … starting …", "Application for a part-time job as a …"],
      references: ["Your advertisement on … of …", "Our phone call on … with Ms …", "Your stand at the careers fair in …"],
      parts: {
        internship: {
          opening: "I was very pleased to see that you offer work experience for school students. As I am very interested in becoming a …, I would like to apply for a placement from … to ….",
          body: "I am currently in Year … at …. My favourite subjects are … and … because …. In my free time I …, which has taught me ….\nA placement with you would help me find out whether a career as a … is right for me. I am especially looking forward to ….",
          ending: "I would be very happy to hear from you or to be invited for an interview.",
        },
        apprenticeship: {
          opening:
            "While looking for an apprenticeship I came across your advertisement on …. I have been fascinated by … for a long time, so I would like to apply for an apprenticeship with you starting in ….",
          body: "This summer I will finish … with my …. At school I particularly enjoy …, and during my work experience at … I realised how much I enjoy ….\nI am reliable, enjoy working in a team and learn quickly, as I showed for example as a …. I would particularly like to work for your company because ….",
          ending: "I would be delighted to be invited to an interview.",
        },
        job: {
          opening: "I read that you are looking for a part-time helper for …. I am … years old, in Year … at school, and I am free in the afternoons and at weekends.",
          body: "I am punctual, friendly and happy to help out. I have already gained some experience at …, where I …. I enjoy working with people.",
          ending: "I would be glad to come in for a trial shift. I look forward to hearing from you.",
        },
      },
      regards: ["Kind regards", "Yours sincerely", "Best regards"],
      enclosures: ["CV", "School reports", "Work experience certificate", "Certificates", "Reference letter"],
    },
  },
};

/** The gap marker in the examples. */
export const BLANK = "…";
