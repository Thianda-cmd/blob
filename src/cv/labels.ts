import type { Locale } from "@/i18n/config";
import type { CvLanguageLevel, CvSectionKind } from "./types";

// Words that appear on the CV itself, in the CV's own language (cv.lang). The editor's own
// buttons and hints live in src/i18n/messages/cv*.ts and follow the app's language.

type CvLabels = {
  /** Title some designs print above the name. */
  document: string;
  headings: Record<CvSectionKind, string>;
  profile: string;
  contact: string;
  personal: string;
  email: string;
  phone: string;
  address: string;
  birth: string;
  birthPlace: string;
  nationality: string;
  links: string;
  present: string;
  /** "seit 09/2024" / "since …" for something still going. */
  since: (date: string) => string;
  /** "bis 07/2025" / "until …" when only the end is known. */
  until: (date: string) => string;
  months: string[];
  languageLevels: Record<CvLanguageLevel, string>;
  /** "geboren am 12.03.2009 in Hamburg" */
  bornOn: (date: string, place: string) => string;
  placeDate: string;
  signature: string;
};

export const CV_LABELS: Record<Locale, CvLabels> = {
  de: {
    document: "Lebenslauf",
    headings: {
      education: "Schulbildung",
      internships: "Praktika",
      experience: "Nebenjobs & Erfahrung",
      volunteering: "Ehrenamt & Engagement",
      courses: "Kurse & Zertifikate",
      awards: "Auszeichnungen",
      custom: "Weiteres",
      skills: "Kenntnisse",
      languages: "Sprachen",
      interests: "Hobbys & Interessen",
    },
    profile: "Profil",
    contact: "Kontakt",
    personal: "Persönliche Daten",
    email: "E-Mail",
    phone: "Telefon",
    address: "Adresse",
    birth: "Geburtsdatum",
    birthPlace: "Geburtsort",
    nationality: "Staatsangehörigkeit",
    links: "Links",
    present: "heute",
    since: (d) => `seit ${d}`,
    until: (d) => `bis ${d}`,
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    languageLevels: {
      native: "Muttersprache",
      fluent: "Fließend",
      good: "Gute Kenntnisse",
      basic: "Grundkenntnisse",
      school: "Schulkenntnisse",
    },
    bornOn: (d, p) => (d && p ? `${d} in ${p}` : d || p),
    placeDate: "Ort, Datum",
    signature: "Unterschrift",
  },
  en: {
    document: "Curriculum Vitae",
    headings: {
      education: "Education",
      internships: "Internships",
      experience: "Work experience",
      volunteering: "Volunteering",
      courses: "Courses & certificates",
      awards: "Awards",
      custom: "More",
      skills: "Skills",
      languages: "Languages",
      interests: "Interests",
    },
    profile: "Profile",
    contact: "Contact",
    personal: "Personal details",
    email: "Email",
    phone: "Phone",
    address: "Address",
    birth: "Date of birth",
    birthPlace: "Place of birth",
    nationality: "Nationality",
    links: "Links",
    present: "present",
    since: (d) => `since ${d}`,
    until: (d) => `until ${d}`,
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    languageLevels: {
      native: "Native",
      fluent: "Fluent",
      good: "Good",
      basic: "Basic",
      school: "School level",
    },
    bornOn: (d, p) => (d && p ? `${d} in ${p}` : d || p),
    placeDate: "Place, date",
    signature: "Signature",
  },
};
