import { tx, type Text } from "@/i18n/text";
import type { CvFontPair, CvTemplateId } from "./types";

/** The CV designs: what the pickers show and what a design starts with. The drawing is in src/cv/templates. */
export type CvTemplateMeta = {
  id: CvTemplateId;
  name: Text;
  blurb: Text;
  accent: string;
  fonts: CvFontPair;
  /** Whether the design shows a photo (the photo can still be left out). */
  photo: boolean;
  /** One column, or a side column for contact, skills and languages. */
  columns: 1 | 2;
};

export const CV_TEMPLATES: CvTemplateMeta[] = [
  {
    id: "classic",
    name: tx("Classic", "Klassisch"),
    blurb: tx("The tabular German CV: dates on the left, details on the right.", "Der tabellarische Lebenslauf: Daten links, Angaben rechts."),
    accent: "#1f4e79",
    fonts: "classic",
    photo: true,
    columns: 1,
  },
  {
    id: "modern",
    name: tx("Modern", "Modern"),
    blurb: tx("A coloured side column with photo, contact and skills.", "Farbige Seitenspalte mit Foto, Kontakt und Kenntnissen."),
    accent: "#2f6f6a",
    fonts: "clean",
    photo: true,
    columns: 2,
  },
  {
    id: "minimal",
    name: tx("Minimal", "Minimal"),
    blurb: tx("Lots of white space and one thin accent line.", "Viel Weißraum und eine feine Akzentlinie."),
    accent: "#3a3a3a",
    fonts: "friendly",
    photo: false,
    columns: 1,
  },
  {
    id: "creative",
    name: tx("Creative", "Kreativ"),
    blurb: tx("A bold colour band with your name and a round photo.", "Ein kräftiges Farbband mit Name und rundem Foto."),
    accent: "#6d3df5",
    fonts: "modern",
    photo: true,
    columns: 2,
  },
  {
    id: "compact",
    name: tx("Compact", "Kompakt"),
    blurb: tx("Two columns that fit a lot on one page.", "Zwei Spalten, die viel auf eine Seite bringen."),
    accent: "#b4532a",
    fonts: "clean",
    photo: true,
    columns: 2,
  },
  {
    id: "elegant",
    name: tx("Elegant", "Elegant"),
    blurb: tx("Serif type, a centred header and fine rules.", "Serifenschrift, zentrierter Kopf und feine Linien."),
    accent: "#7a5c2e",
    fonts: "elegant",
    photo: true,
    columns: 1,
  },
];

export const templateMeta = (id: CvTemplateId) => CV_TEMPLATES.find((t) => t.id === id) ?? CV_TEMPLATES[0];

/** Accent colours offered next to the colour picker. */
export const CV_ACCENTS = ["#1f4e79", "#2f6f6a", "#6d3df5", "#b4532a", "#7a5c2e", "#a3324f", "#2e7d4f", "#3a3a3a"];
