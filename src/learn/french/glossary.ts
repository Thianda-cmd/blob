import { ALL_WORDS, UNITS } from "./course";
import { fold } from "./text";

// The dictionary behind "tap a word to see what it means": the course's words, every unit's
// extra forms (gloss), and the small words every sentence needs.

type Gloss = { en: string; de: string };

/** Little words and common forms that aren't taught as words of their own. */
const BASE: Record<string, Gloss> = {
  je: { en: "I", de: "ich" },
  "j'": { en: "I", de: "ich" },
  tu: { en: "you", de: "du" },
  il: { en: "he / it", de: "er / es" },
  elle: { en: "she / it", de: "sie / es" },
  on: { en: "we / one", de: "wir / man" },
  nous: { en: "we", de: "wir" },
  vous: { en: "you", de: "ihr / Sie" },
  ils: { en: "they", de: "sie" },
  elles: { en: "they", de: "sie" },
  moi: { en: "me", de: "ich / mich" },
  toi: { en: "you", de: "du / dich" },
  lui: { en: "him", de: "er / ihm" },
  le: { en: "the", de: "der / das" },
  la: { en: "the", de: "die" },
  "l'": { en: "the", de: "der / die / das" },
  les: { en: "the", de: "die" },
  un: { en: "a", de: "ein" },
  une: { en: "a", de: "eine" },
  des: { en: "some", de: "(einige)" },
  du: { en: "some / of the", de: "etwas / vom" },
  de: { en: "of / from", de: "von / aus" },
  "d'": { en: "of / from", de: "von / aus" },
  à: { en: "to / at", de: "zu / in / an" },
  au: { en: "to the / at the", de: "zum / im" },
  aux: { en: "to the", de: "zu den" },
  en: { en: "in / to", de: "in / nach" },
  et: { en: "and", de: "und" },
  ou: { en: "or", de: "oder" },
  mais: { en: "but", de: "aber" },
  avec: { en: "with", de: "mit" },
  pour: { en: "for", de: "für" },
  dans: { en: "in", de: "in" },
  sur: { en: "on", de: "auf" },
  sous: { en: "under", de: "unter" },
  chez: { en: "at (someone's place)", de: "bei" },
  ne: { en: "not (part 1)", de: "nicht (Teil 1)" },
  "n'": { en: "not (part 1)", de: "nicht (Teil 1)" },
  pas: { en: "not", de: "nicht" },
  aussi: { en: "also / too", de: "auch" },
  très: { en: "very", de: "sehr" },
  oui: { en: "yes", de: "ja" },
  non: { en: "no", de: "nein" },
  est: { en: "is", de: "ist" },
  es: { en: "are (you)", de: "bist" },
  suis: { en: "am", de: "bin" },
  sont: { en: "are", de: "sind" },
  "c'est": { en: "it is / this is", de: "das ist" },
  ça: { en: "that / it", de: "das / es" },
  va: { en: "goes", de: "geht" },
  ai: { en: "have", de: "habe" },
  as: { en: "have (you)", de: "hast" },
  a: { en: "has", de: "hat" },
  "il y a": { en: "there is / there are", de: "es gibt" },
  qui: { en: "who", de: "wer" },
  que: { en: "that / what", de: "dass / was" },
  quoi: { en: "what", de: "was" },
  où: { en: "where", de: "wo" },
  comment: { en: "how", de: "wie" },
  quand: { en: "when", de: "wann" },
  pourquoi: { en: "why", de: "warum" },
  combien: { en: "how much / how many", de: "wie viel" },
  "est-ce que": { en: "(question)", de: "(Frage)" },
  mon: { en: "my", de: "mein" },
  ma: { en: "my", de: "meine" },
  mes: { en: "my", de: "meine" },
  ton: { en: "your", de: "dein" },
  ta: { en: "your", de: "deine" },
  tes: { en: "your", de: "deine" },
  son: { en: "his / her", de: "sein / ihr" },
  sa: { en: "his / her", de: "seine / ihre" },
  ses: { en: "his / her", de: "seine / ihre" },
  ce: { en: "this", de: "dieser / das" },
  cette: { en: "this", de: "diese" },
  ces: { en: "these", de: "diese" },
  "m'appelle": { en: "am called", de: "heiße" },
  "t'appelles": { en: "are called (you)", de: "heißt" },
  "s'appelle": { en: "is called", de: "heißt" },
  madame: { en: "Mrs / madam", de: "Frau" },
  monsieur: { en: "Mr / sir", de: "Herr" },
};

let dict: Map<string, Gloss> | null = null;

/** Every known French form, folded (no accents, no apostrophes) → its meaning. */
function dictionary(): Map<string, Gloss> {
  if (dict) return dict;
  dict = new Map();
  const add = (fr: string, g: Gloss) => {
    const k = fold(fr, "fr");
    if (k && !dict!.has(k)) dict!.set(k, g);
  };
  for (const w of ALL_WORDS) {
    const g = { en: w.en, de: w.de };
    add(w.fr, g);
    const bareForm = w.fr.replace(/^(le|la|les|un|une)\s+/i, "").replace(/^l['’]/i, "").replace(/\s*\?$/, "");
    add(bareForm, g);
  }
  for (const u of UNITS) for (const g of u.gloss ?? []) add(g.fr, { en: g.en, de: g.de });
  for (const [fr, g] of Object.entries(BASE)) add(fr, g);
  return dict;
}

export type GlossSegment = { text: string; gloss: Gloss | null };

/**
 * A French sentence cut into tappable pieces: the longest known phrase at each place (up to four
 * words, so "au revoir" and "il y a" stay together), the rest word by word.
 */
export function glossSegments(sentence: string): GlossSegment[] {
  const d = dictionary();
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const out: GlossSegment[] = [];
  for (let i = 0; i < tokens.length; ) {
    let found: GlossSegment | null = null;
    for (let len = Math.min(4, tokens.length - i); len >= 1 && !found; len--) {
      const text = tokens.slice(i, i + len).join(" ");
      const g = d.get(fold(text, "fr"));
      if (g) {
        found = { text, gloss: g };
        i += len;
      }
    }
    if (!found) {
      // "m'appelle" unknown as a whole: try without the elided part ("appelle").
      const tok = tokens[i];
      const m = /^([a-zà-ÿ]{1,3}['’])(.+)$/i.exec(tok.replace(/[.,!?;:»«]/g, ""));
      const g = m ? (d.get(fold(m[2], "fr")) ?? null) : null;
      found = { text: tok, gloss: g };
      i += 1;
    }
    out.push(found);
  }
  return out;
}
