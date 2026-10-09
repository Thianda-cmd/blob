/**
 * The first words of a page's text for a card: lines joined with " · " (a list stays readable as
 * one line), sentences with a space, cut at a word near `max` characters.
 */
export function snippet(text: string | null | undefined, max = 220): string {
  const flat = (text ?? "")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .reduce((acc, line) => (!acc ? line : /[.!?:…]$/.test(acc) ? `${acc} ${line}` : `${acc} · ${line}`), "");
  return flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, "")}…` : flat;
}
