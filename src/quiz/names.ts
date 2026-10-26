import type { Locale } from "@/i18n/config";

// Names for players: in games with "Blob names", everyone gets a funny one (and may roll again)
// instead of typing their own; elsewhere a typed name is checked against a short list of words
// that have no place on a class's big screen.

const EN_START = ["Wobbly", "Bouncy", "Giggly", "Squishy", "Bubbly", "Cuddly", "Zippy", "Dancing", "Jiggly", "Purring", "Fluffy", "Wiggly", "Sleepy", "Snappy", "Breezy", "Jolly"];
const EN_END = ["Jelly", "Pudding", "Bean", "Noodle", "Cookie", "Cloud", "Mango", "Kiwi", "Penguin", "Otter", "Toast", "Waffle", "Muffin", "Toad", "Carrot", "Dino"];
const DE_START = ["Wackel", "Hüpf", "Kicher", "Schlabber", "Blubber", "Kuschel", "Flitze", "Tanz", "Glibber", "Schnurr", "Knuddel", "Schwabbel", "Rassel", "Puste", "Brumm", "Zappel"];
const DE_END = ["qualle", "pudding", "bohne", "nudel", "keks", "wolke", "mango", "kiwi", "pinguin", "otter", "toast", "waffel", "muffin", "kröte", "möhre", "dino"];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** A random Blob name. */
export function blobName(locale: Locale): string {
  return locale === "de" ? pick(DE_START) + pick(DE_END) : `${pick(EN_START)} ${pick(EN_END)}`;
}

/** Whether a name is one of the Blob names (in either language). */
export function isBlobName(name: string): boolean {
  const en = name.split(" ");
  if (en.length === 2 && EN_START.includes(en[0]) && EN_END.includes(en[1])) return true;
  return DE_START.some((s) => name.startsWith(s) && DE_END.includes(name.slice(s.length)));
}

// Kept short and obvious: the host can still remove anyone from the game.
const BLOCKED = [
  "arsch", "fick", "fotze", "hure", "nutte", "schlampe", "wichser", "hurensohn", "spast", "missgeburt", "nazi", "hitler",
  "fuck", "shit", "bitch", "cunt", "cock", "pussy", "whore", "slut", "nigg", "fag", "rape", "porn", "sex", "penis", "vagina",
];

/** A typed name made tidy (spaces, length), or null when it isn't usable. */
export function cleanNickname(raw: unknown, max = 20): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  if (!name || !/[\p{L}\p{N}]/u.test(name)) return null;
  return name;
}

/** Whether a name contains a blocked word (also spelled with numbers or dots in between). */
export function isRude(name: string): boolean {
  const squashed = name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-zäöüß]/g, "");
  return BLOCKED.some((w) => squashed.includes(w));
}
