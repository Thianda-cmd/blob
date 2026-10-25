import type { Locale } from "@/i18n/config";
import { templateMeta } from "./catalog";
import { cvId, normalizeCv, SAMPLE_CONTACT } from "./model";
import type { Cv, CvTemplateId } from "./types";

// A made-up school student's CV, used for the design previews and "start with an example".
// Every name, address and number in it is invented.

const SIGNATURE = {
  w: 300,
  h: 90,
  d: "M14 62 C 22 30, 34 14, 40 22 C 46 32, 28 64, 30 70 C 34 76, 50 50, 58 46 C 64 44, 60 62, 66 62 C 74 62, 80 44, 86 46 C 92 48, 86 64, 94 63 C 104 62, 108 40, 116 42 C 124 44, 116 62, 126 62 C 136 62, 142 34, 150 36 M150 36 C 156 40, 146 66, 156 66 C 170 66, 176 30, 190 28 C 200 28, 194 54, 186 60 C 182 64, 196 50, 206 48 C 214 46, 210 62, 218 62 C 228 62, 236 48, 244 50 C 252 52, 246 62, 254 62 C 264 62, 272 52, 286 50",
};

const TEXT = {
  de: {
    headline: "Schülerin der 10. Klasse · auf dem Weg zur Ausbildung als Mediengestalterin",
    nationality: "deutsch",
    summary:
      "Ich bin kreativ, zuverlässig und arbeite gern im Team. Seit zwei Jahren gestalte ich das Layout unserer Schülerzeitung und habe dabei gemerkt, wie viel Spaß mir Gestaltung macht. Nach meinem Abschluss möchte ich eine Ausbildung zur Mediengestalterin Digital und Print beginnen.",
    education: [
      ["Mittlerer Schulabschluss (angestrebt, Sommer 2026)", "Realschule am Stadtpark", "Hamburg", "2019-08", "", true, "- Lieblingsfächer: Kunst, Deutsch und Informatik\n- Layout-Team der Schülerzeitung „Pausenhof“"],
      ["Grundschule", "Grundschule Lindenweg", "Hamburg", "2015-08", "2019-07", false, ""],
    ],
    internships: [
      ["Schülerpraktikum in der Grafikabteilung", "Nordlicht Werbeagentur GmbH", "Hamburg", "2025-01", "2025-01", false, "- Entwürfe für Flyer und Social-Media-Beiträge gestaltet\n- Bei Kundengesprächen und der Druckvorbereitung dabei gewesen"],
      ["Praktikum im Verkauf", "Buchhandlung Seitenweise", "Hamburg", "2024-02", "2024-02", false, "- Kundinnen und Kunden beraten, Ware angenommen und einsortiert"],
    ],
    experience: [["Zeitungszustellerin (Minijob)", "Hamburger Wochenblatt", "Hamburg", "2024-09", "", true, "- Jeden Samstag rund 120 Haushalte beliefert"]],
    volunteering: [["Co-Trainerin der F-Jugend (Handball)", "HSV Hamburg-Nord e. V.", "Hamburg", "2023-08", "", true, "- Training für zwölf Kinder mitgeplant und betreut"]],
    skills: [["Microsoft Word und PowerPoint", 4], ["Canva", 5], ["Adobe Photoshop (Grundlagen)", 3], ["Zehnfingersystem", 4]],
    languages: [["Deutsch", "native", ""], ["Englisch", "good", "B1"], ["Französisch", "school", "A2"]],
    interests: "Handball, Fotografie, Zeichnen, Lesen",
    letter: {
      company: "Nordlicht Werbeagentur GmbH",
      department: "Personalabteilung",
      contact: "Anna Berger",
      street: "Hafenstraße 8",
      postalCode: "20457",
      city: "Hamburg",
      subject: "Bewerbung um einen Ausbildungsplatz als Mediengestalterin Digital und Print",
      reference: "Ihre Anzeige auf ausbildung.de",
      opening:
        "in meinem Schülerpraktikum im Januar durfte ich zwei Wochen lang in Ihrer Grafikabteilung mitarbeiten. Seitdem weiß ich, dass ich Mediengestalterin werden möchte. Deshalb bewerbe ich mich bei Ihnen um einen Ausbildungsplatz ab August 2026.",
      body:
        "Zurzeit besuche ich die 10. Klasse der Realschule am Stadtpark, die ich im Sommer mit dem Mittleren Schulabschluss beende. Meine Lieblingsfächer sind Kunst, Deutsch und Informatik. Seit zwei Jahren gestalte ich das Layout unserer Schülerzeitung „Pausenhof“, mit Canva und inzwischen auch mit Photoshop.\nIn Ihrer Agentur hat mir besonders gefallen, wie eng Grafik, Text und Druck zusammenarbeiten. Ich habe eigene Entwürfe für Flyer und Social-Media-Beiträge gemacht und war bei Kundengesprächen dabei. Als Co-Trainerin einer Handballmannschaft habe ich gelernt, zuverlässig zu sein und Verantwortung zu übernehmen.",
      ending: "Über eine Einladung zu einem Vorstellungsgespräch freue ich mich sehr.",
      enclosures: "Lebenslauf\nZeugnisse\nPraktikumsbescheinigung",
    },
  },
  en: {
    headline: "Year 10 student · aiming for an apprenticeship in media design",
    nationality: "German",
    summary:
      "I am creative, reliable and enjoy working in a team. For two years I have done the layout of our school newspaper, which showed me how much I enjoy design. After finishing school I would like to start an apprenticeship as a media designer.",
    education: [
      ["Secondary school certificate (expected summer 2026)", "Realschule am Stadtpark", "Hamburg", "2019-08", "", true, "- Favourite subjects: art, German and computer science\n- Layout team of the school newspaper “Pausenhof”"],
      ["Primary school", "Grundschule Lindenweg", "Hamburg", "2015-08", "2019-07", false, ""],
    ],
    internships: [
      ["Work experience in the graphics department", "Nordlicht Werbeagentur GmbH", "Hamburg", "2025-01", "2025-01", false, "- Designed flyers and social media posts\n- Sat in on client meetings and print preparation"],
      ["Work experience in sales", "Seitenweise bookshop", "Hamburg", "2024-02", "2024-02", false, "- Advised customers, received and shelved stock"],
    ],
    experience: [["Newspaper delivery (part-time)", "Hamburger Wochenblatt", "Hamburg", "2024-09", "", true, "- Deliver to about 120 households every Saturday"]],
    volunteering: [["Assistant coach, under-9 handball team", "HSV Hamburg-Nord e. V.", "Hamburg", "2023-08", "", true, "- Help plan and run training for twelve children"]],
    skills: [["Microsoft Word and PowerPoint", 4], ["Canva", 5], ["Adobe Photoshop (basics)", 3], ["Touch typing", 4]],
    languages: [["German", "native", ""], ["English", "good", "B1"], ["French", "school", "A2"]],
    interests: "Handball, photography, drawing, reading",
    letter: {
      company: "Nordlicht Werbeagentur GmbH",
      department: "Human Resources",
      contact: "Anna Berger",
      street: "Hafenstraße 8",
      postalCode: "20457",
      city: "Hamburg",
      subject: "Application for an apprenticeship as a media designer",
      reference: "Your advertisement on ausbildung.de",
      opening:
        "During my work experience in January I spent two weeks in your graphics department. Since then I have known that I want to become a media designer, which is why I am applying for an apprenticeship with you starting in August 2026.",
      body:
        "I am currently in Year 10 at Realschule am Stadtpark and will finish with my secondary school certificate this summer. My favourite subjects are art, German and computer science. For two years I have done the layout of our school newspaper “Pausenhof”, first with Canva and now with Photoshop too.\nWhat I liked most about your agency was how closely design, copy and print work together. I created my own drafts for flyers and social media posts and sat in on client meetings. As an assistant coach of a handball team I have learned to be reliable and to take responsibility.",
      ending: "I would be delighted to be invited to an interview.",
      enclosures: "CV\nSchool reports\nWork experience certificate",
    },
  },
} as const;

type Row = readonly [string, string, string, string, string, boolean, string];
const entries = (rows: readonly Row[]) =>
  rows.map(([title, org, place, start, end, current, text]) => ({ id: cvId(), title, org, place, start, end, current, text }));

/** The example CV in `lang`, drawn with `template` in its default colours. */
export function sampleCv(lang: Locale, template: CvTemplateId = "classic"): Cv {
  const t = TEXT[lang];
  const meta = templateMeta(template);
  return normalizeCv(
    {
      lang,
      design: { template, accent: meta.accent, fonts: meta.fonts },
      person: {
        firstName: "Lena",
        lastName: "Schneider",
        headline: t.headline,
        photo: null,
        ...SAMPLE_CONTACT,
        city: "Hamburg",
        birthDate: "2009-03-12",
        birthPlace: "Hamburg",
        nationality: t.nationality,
        links: [],
      },
      summary: t.summary,
      sections: [
        { id: cvId(), kind: "education", entries: entries(t.education) },
        { id: cvId(), kind: "internships", entries: entries(t.internships) },
        { id: cvId(), kind: "experience", entries: entries(t.experience) },
        { id: cvId(), kind: "volunteering", entries: entries(t.volunteering) },
        { id: cvId(), kind: "skills", showLevels: true, skills: t.skills.map(([name, level]) => ({ id: cvId(), name, level })) },
        { id: cvId(), kind: "languages", languages: t.languages.map(([name, level, cefr]) => ({ id: cvId(), name, level, cefr })) },
        { id: cvId(), kind: "interests", text: t.interests },
      ],
      closing: { show: true, place: "Hamburg", date: "", signature: SIGNATURE },
      letter: { ...t.letter, salutation: "ms" },
    },
    lang,
  );
}
