// A small XML reader and writer for the parts of an .xlsx file (Node has no DOMParser, and the
// check script runs in Node). Reads well-formed XML into a light tree: elements with their
// attributes and children; comments, processing instructions and the DOCTYPE are skipped. Names
// keep their prefix ("r:id", "x:Row"); `local` drops it, so files in the "strict" OOXML namespace
// read the same.
//
// Files come from anywhere, so reading stays bounded: a budget caps the elements of one file (a
// few kilobytes of zip can hold millions of "<c/>"), an end tag of an element that isn't open is
// skipped at once, and attribute names from the file never reach an object's prototype.

export type XmlEl = { name: string; local: string; attrs: Record<string, string>; kids: XmlNode[] };
export type XmlNode = XmlEl | string;

/** A value of a lookup table for a key from a file: never one of Object's own ("constructor", "__proto__"). */
export function lookup<T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | undefined {
  return key != null && Object.hasOwn(table, key) ? table[key] : undefined;
}

const NAMED: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

/** "&lt;", "&#228;", "&#xE4;" → characters. Unknown named entities stay as they are. */
export function decodeEntities(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return lookup(NAMED, e) ?? m;
  });
}

export const localName = (name: string) => {
  const i = name.indexOf(":");
  return i < 0 ? name : name.slice(i + 1);
};

/**
 * Elements whose whitespace-only text is content (a cell's text " " or a run's line break). Elsewhere
 * whitespace between tags is layout and dropped, which keeps big sheets small in memory.
 */
const KEEPS_SPACE = new Set(["t"]);

export class XmlError extends Error {
  /** `tooBig`: the file has more elements than its budget allows (not broken, just too much). */
  constructor(
    message: string,
    public tooBig = false,
  ) {
    super(message);
  }
}

/**
 * How many more elements one file may have, shared by all its parts. A full sheet of 20,000 rows
 * and 200 columns stays below the default, and Blob can't save anything near that big anyway.
 */
export type XmlBudget = { elements: number };
export const MAX_XML_ELEMENTS = 8_000_000;
export const xmlBudget = (elements = MAX_XML_ELEMENTS): XmlBudget => ({ elements });

/** Space, tab, line feed, carriage return. */
const space = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
/** Where a tag or attribute name ends: whitespace, "/" or ">". */
const nameEnd = (c: number) => space(c) || c === 47 || c === 62;

/** What elements without attributes or children share (never changed after reading), so big parts stay small. */
const NO_ATTRS: Record<string, string> = Object.freeze(Object.create(null) as Record<string, string>);
const NO_KIDS: XmlNode[] = Object.freeze([] as XmlNode[]) as XmlNode[];

/**
 * The document's root element. Throws XmlError when the text isn't XML, or (with `tooBig` set)
 * when it has more elements than `budget` has left; the budget is shared by the parts of a file.
 */
export function parseXml(src: string, budget: XmlBudget = xmlBudget()): XmlEl {
  const doc: XmlEl = { name: "#document", local: "#document", attrs: NO_ATTRS, kids: [] };
  const stack: XmlEl[] = [doc];
  // How many elements of each name are open: an end tag of one that isn't is skipped at once
  // (looking for it through the whole stack each time made such files take minutes).
  const open = new Map<string, number>();
  // One string per tag name (a sheet repeats "c", "v" and "row" millions of times).
  const names = new Map<string, string>();
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf("<", i);
    const end = lt < 0 ? n : lt;
    if (end > i) {
      const raw = src.slice(i, end);
      const top = stack[stack.length - 1];
      if (top !== doc && (KEEPS_SPACE.has(top.local) || /\S/.test(raw))) top.kids.push(decodeEntities(raw));
    }
    if (lt < 0) break;
    const next = src.charCodeAt(lt + 1);
    if (next === 63 /* ? */) {
      const close = src.indexOf("?>", lt + 2);
      if (close < 0) throw new XmlError("xml: unclosed processing instruction");
      i = close + 2;
      continue;
    }
    if (next === 33 /* ! */) {
      if (src.startsWith("<!--", lt)) {
        const close = src.indexOf("-->", lt + 4);
        if (close < 0) throw new XmlError("xml: unclosed comment");
        i = close + 3;
        continue;
      }
      if (src.startsWith("<![CDATA[", lt)) {
        const close = src.indexOf("]]>", lt + 9);
        if (close < 0) throw new XmlError("xml: unclosed CDATA");
        const top = stack[stack.length - 1];
        if (top !== doc) top.kids.push(src.slice(lt + 9, close));
        i = close + 3;
        continue;
      }
      // <!DOCTYPE …> (with an internal subset in [ ] perhaps).
      let j = lt + 2;
      let depth = 0;
      while (j < n) {
        const c = src[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (next === 47 /* / */) {
      const close = src.indexOf(">", lt + 2);
      if (close < 0) throw new XmlError("xml: unclosed end tag");
      const name = src.slice(lt + 2, close).trim();
      // Close up to the matching element (forgiving about a missing end tag in between).
      if (open.get(name)) {
        for (;;) {
          const el = stack.pop()!;
          open.set(el.name, open.get(el.name)! - 1);
          if (el.name === name) break;
        }
      }
      i = close + 1;
      continue;
    }
    // A start tag: its name, then attributes up to ">" or "/>" (">" may appear inside quotes).
    let j = lt + 1;
    while (j < n && !nameEnd(src.charCodeAt(j))) j++;
    const raw = src.slice(lt + 1, j);
    if (!raw) throw new XmlError("xml: empty tag name");
    if (--budget.elements < 0) throw new XmlError("xml: too many elements", true);
    let name = names.get(raw);
    if (name === undefined) {
      name = raw;
      if (names.size < 10_000) names.set(raw, raw);
    }
    let attrs = NO_ATTRS;
    let selfClosing = false;
    for (;;) {
      while (j < n && space(src.charCodeAt(j))) j++;
      if (j >= n) throw new XmlError("xml: unclosed start tag");
      const c = src.charCodeAt(j);
      if (c === 62 /* > */) {
        j++;
        break;
      }
      if (c === 47 /* / */ && src.charCodeAt(j + 1) === 62) {
        selfClosing = true;
        j += 2;
        break;
      }
      const a0 = j;
      while (j < n && !nameEnd(src.charCodeAt(j)) && src.charCodeAt(j) !== 61 /* = */) j++;
      const attr = src.slice(a0, j);
      while (j < n && space(src.charCodeAt(j))) j++;
      if (src.charCodeAt(j) !== 61) {
        // An attribute without a value (not XML, but harmless): skip it.
        if (!attr) j++;
        continue;
      }
      j++;
      while (j < n && space(src.charCodeAt(j))) j++;
      const q = src[j];
      if (q !== '"' && q !== "'") throw new XmlError("xml: unquoted attribute");
      const close = src.indexOf(q, j + 1);
      if (close < 0) throw new XmlError("xml: unclosed attribute");
      const value = src.slice(j + 1, close);
      // Without a prototype, a file's attribute named "constructor" or "__proto__" is just a name.
      if (attrs === NO_ATTRS) attrs = Object.create(null) as Record<string, string>;
      attrs[attr] = decodeEntities(/[\t\n\r]/.test(value) ? value.replace(/[\t\n\r]/g, " ") : value);
      j = close + 1;
    }
    const el: XmlEl = { name, local: localName(name), attrs, kids: selfClosing ? NO_KIDS : [] };
    stack[stack.length - 1].kids.push(el);
    if (!selfClosing) {
      stack.push(el);
      open.set(name, (open.get(name) ?? 0) + 1);
    }
    i = j;
  }
  const root = doc.kids.find((k): k is XmlEl => typeof k !== "string");
  if (!root) throw new XmlError("xml: no root element");
  return root;
}

// Reading helpers -------------------------------------------------------------------------------

/** The first child element with this local name. */
export function child(el: XmlEl | null | undefined, local: string): XmlEl | null {
  if (!el) return null;
  for (const k of el.kids) if (typeof k !== "string" && k.local === local) return k;
  return null;
}

/** All child elements (with this local name, when given). */
export function children(el: XmlEl | null | undefined, local?: string): XmlEl[] {
  if (!el) return [];
  const out: XmlEl[] = [];
  for (const k of el.kids) if (typeof k !== "string" && (local === undefined || k.local === local)) out.push(k);
  return out;
}

/** Every descendant element with this local name, in document order. */
export function descendants(el: XmlEl | null | undefined, local: string, out: XmlEl[] = []): XmlEl[] {
  if (!el) return out;
  for (const k of el.kids) {
    if (typeof k === "string") continue;
    if (k.local === local) out.push(k);
    descendants(k, local, out);
  }
  return out;
}

/** All text inside an element. */
export function textOf(el: XmlEl | null | undefined): string {
  if (!el) return "";
  let s = "";
  for (const k of el.kids) s += typeof k === "string" ? k : textOf(k);
  return s;
}

/** An attribute by its name, or by its local name when the prefix differs ("r:id", "relationships:id"). */
export function attr(el: XmlEl | null | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const direct = el.attrs[name];
  if (direct !== undefined) return direct;
  const want = localName(name);
  for (const [k, v] of Object.entries(el.attrs)) if (localName(k) === want && (k.includes(":") || !name.includes(":"))) return v;
  return undefined;
}

export function numAttr(el: XmlEl | null | undefined, name: string): number | undefined {
  const v = attr(el, name);
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** "1", "true" (and "on" from some tools) are true; a missing attribute is `fallback`. */
export function boolAttr(el: XmlEl | null | undefined, name: string, fallback = false): boolean {
  const v = attr(el, name);
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "on";
}

// Writing helpers -------------------------------------------------------------------------------

/** Characters XML 1.0 can't carry at all (control characters other than tab and line breaks). */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Text for element content. */
export function escText(s: string): string {
  return s.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Text for an attribute value in double quotes (line breaks kept as character references). */
export function escAttr(s: string): string {
  return escText(s).replace(/"/g, "&quot;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;");
}

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
