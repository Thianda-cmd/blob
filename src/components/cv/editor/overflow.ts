import { sectionTitle } from "@/cv/model";
import type { Cv } from "@/cv/types";

/** How much room a text takes, roughly: characters plus a line's worth for every line break. */
const weigh = (text: string) => text.trim().length + 70 * (text.trim().split("\n").length - 1);

const short = (s: string) => (s.length > 48 ? `${s.slice(0, 46).trimEnd()} …` : s);

/** What is too long: the profile, something with a name, or an entry without a title in a section. */
export type LongWhat = { type: "profile" } | { type: "named"; name: string } | { type: "untitled"; section: string };
export type LongPart = { what: LongWhat; part: string; entry?: { id: string; heading: string } };

/**
 * The engine only says that some block is taller than a page. The longest text is almost
 * always the one: this finds it, so the notice can name it and jump to its card.
 */
export function longestPart(cv: Cv): LongPart | null {
  let best: (LongPart & { weight: number }) | null = null;
  const consider = (weight: number, what: LongWhat, part: string, entry?: LongPart["entry"]) => {
    if (weight > 0 && (!best || weight > best.weight)) best = { weight, what, part, entry };
  };
  consider(weigh(cv.summary), { type: "profile" }, "summary");
  for (const s of cv.sections) {
    if (s.hidden) continue;
    const title = short(sectionTitle(s, cv.lang));
    if (s.kind === "interests") consider(weigh(s.text), { type: "named", name: title }, s.id);
    else if (s.kind === "skills") consider(s.skills.length * 28, { type: "named", name: title }, s.id);
    else if (s.kind === "languages") consider(s.languages.length * 28, { type: "named", name: title }, s.id);
    else
      for (const e of s.entries) {
        const heading = e.title.trim() || e.org.trim();
        const what: LongWhat = heading ? { type: "named", name: short(heading) } : { type: "untitled", section: title };
        consider(weigh(e.text) + e.title.length + e.org.length, what, s.id, { id: e.id, heading });
      }
  }
  const found = best as (LongPart & { weight: number }) | null;
  return found ? { what: found.what, part: found.part, entry: found.entry } : null;
}
