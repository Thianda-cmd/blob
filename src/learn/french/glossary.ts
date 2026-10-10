import { UNITS } from "./course";
import { fold, norm } from "./text";

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
  me: { en: "me / myself", de: "mich / mir" },
  "m'": { en: "me / myself", de: "mich / mir" },
  te: { en: "you / yourself", de: "dich / dir" },
  "t'": { en: "you / yourself", de: "dich / dir" },
  se: { en: "himself / herself / themselves", de: "sich" },
  "s'": { en: "himself / herself / themselves", de: "sich" },
  y: { en: "there", de: "dort / dahin" },
  le: { en: "the / it / him", de: "der / das / ihn / es" },
  la: { en: "the / it / her", de: "die / sie / es" },
  "l'": { en: "the / it", de: "der / die / das / ihn / sie / es" },
  les: { en: "the / them", de: "die / sie" },
  un: { en: "a / one", de: "ein / eins" },
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

type Dictionary = { exact: Map<string, Gloss>; folded: Map<string, Gloss> };
const dicts = new Map<number, Dictionary>();

/**
 * Every known French form → its meaning, from the units before `upTo` (all by default). Looked up
 * with its accents first ("où" is where, "ou" is or; "a" has, "à" to), then without.
 */
function dictionary(upTo = UNITS.length): Dictionary {
  const cached = dicts.get(upTo);
  if (cached) return cached;
  const d: Dictionary = { exact: new Map(), folded: new Map() };
  const add = (fr: string, g: Gloss) => {
    const e = norm(fr);
    if (e && !d.exact.has(e)) d.exact.set(e, g);
    const k = fold(fr, "fr");
    if (k && !d.folded.has(k)) d.folded.set(k, g);
  };
  // The little words first: "un" is "a" in every sentence, even once the number one is taught.
  for (const [fr, g] of Object.entries(BASE)) add(fr, g);
  // Then unit by unit, each with its forms: what a word means where students first meet it stays
  // ("porte" is "wears" from unit 9, even after unit 12 teaches "la porte", the door).
  for (const u of UNITS.slice(0, upTo)) {
    for (const w of u.words) {
      const g = { en: w.en, de: w.de };
      add(w.fr, g);
      const bareForm = w.fr.replace(/^(le|la|les|un|une)\s+/i, "").replace(/^l['’]/i, "").replace(/\s*\?$/, "");
      // "chien" alone (as in "un chien") means dog, not "the dog".
      if (bareForm !== w.fr) add(bareForm, { en: w.en.replace(/^(the|a|an)\s+/i, ""), de: w.de.replace(/^(der|die|das|den|ein|eine)\s+/i, "") });
    }
    for (const g of u.gloss ?? []) add(g.fr, { en: g.en, de: g.de });
  }
  dicts.set(upTo, d);
  return d;
}

const lookup = (d: Dictionary, text: string) => d.exact.get(norm(text)) ?? d.folded.get(fold(text, "fr")) ?? null;

export type GlossSegment = { text: string; gloss: Gloss | null };

/**
 * A French sentence cut into tappable pieces: the longest known phrase at each place (up to five
 * words, so "au revoir", "il y a" and "il n'y a pas de" stay together), the rest word by word.
 */
export function glossSegments(sentence: string, upTo?: number): GlossSegment[] {
  const d = dictionary(upTo);
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const out: GlossSegment[] = [];
  for (let i = 0; i < tokens.length; ) {
    let found: GlossSegment | null = null;
    for (let len = Math.min(5, tokens.length - i); len >= 1 && !found; len--) {
      const text = tokens.slice(i, i + len).join(" ");
      const g = lookup(d, text);
      if (g) {
        found = { text, gloss: g };
        i += len;
      }
    }
    if (!found) {
      // "m'appelle" unknown as a whole: try without the elided part ("appelle").
      const tok = tokens[i];
      const m = /^([a-zà-ÿ]{1,3}['’])(.+)$/i.exec(tok.replace(/[.,!?;:»«]/g, ""));
      const g = m ? lookup(d, m[2]) : null;
      found = { text: tok, gloss: g };
      i += 1;
    }
    out.push(found);
  }
  return out;
}
