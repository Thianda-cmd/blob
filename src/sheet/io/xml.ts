// A small XML reader and writer for the parts of an .xlsx file (Node has no DOMParser, and the
// check script runs in Node). Reads well-formed XML into a light tree: elements with their
// attributes and children; comments, processing instructions and the DOCTYPE are skipped. Names
// keep their prefix ("r:id", "x:Row"); `local` drops it, so files in the "strict" OOXML namespace
// read the same.
//
// Files come from anywhere, so reading stays bounded: a budget caps the elements and attributes of
// one file (a few kilobytes of zip can hold millions of "<c/>", or of attributes on one element),
// an end tag of an element that isn't open is skipped at once, and attribute names from the file
// never reach an object's prototype.

import { lookup } from "./lookup";

export { lookup };

/**
 * An element: its name ("r:id" keeps the prefix) and the name without it, its attributes (read
 * them with attr()) and its children. Attributes are a list of name, value, name, value…: far
 * smaller than an object for each of a sheet's millions of elements, and no name from a file
 * ("constructor", "__proto__") can mean anything else.
 */
export type XmlEl = { name: string; local: string; attrs: readonly string[]; kids: XmlNode[] };
export type XmlNode = XmlEl | string;

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
  /** `tooBig`: the file has more elements and attributes than its budget allows (not broken, just too much). */
  constructor(
    message: string,
    public tooBig = false,
  ) {
    super(message);
  }
}

/**
 * How many more elements and attributes one file may have, shared by all its parts (each costs
 * about the same memory). A sheet of half a million cells stays below the default, twice what a
 * spreadsheet page can save (5 MB), and reading a file up to the limit takes 400 MB at most.
 */
export type XmlBudget = { nodes: number };
export const MAX_XML_NODES = 3_000_000;
export const xmlBudget = (nodes = MAX_XML_NODES): XmlBudget => ({ nodes });

/** Space, tab, line feed, carriage return. */
const space = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
/** Where a tag or attribute name ends: whitespace, "/" or ">". */
const nameEnd = (c: number) => space(c) || c === 47 || c === 62;

/**
 * What elements without attributes or children share (never changed after reading), so big parts
 * stay small: a sheet is millions of "<c>" with one "<v>" in each.
 */
const NO_ATTRS: readonly string[] = Object.freeze([]);
const NO_KIDS: XmlNode[] = Object.freeze([] as XmlNode[]) as XmlNode[];

/** A child added to an element (its own list made on the first one, exactly as long as needed). */
function addKid(parent: XmlEl, kid: XmlNode) {
  if (parent.kids === NO_KIDS) parent.kids = [kid];
  else parent.kids.push(kid);
}

/**
 * The document's root element. Throws XmlError when the text isn't XML, or (with `tooBig` set)
 * when it has more elements and attributes than `budget` has left; the budget is shared by the
 * parts of a file.
 */
export function parseXml(src: string, budget: XmlBudget = xmlBudget()): XmlEl {
  const doc: XmlEl = { name: "#document", local: "#document", attrs: NO_ATTRS, kids: [] };
  const stack: XmlEl[] = [doc];
  // How many elements of each name are open: an end tag of one that isn't is skipped at once
  // (looking for it through the whole stack each time made such files take minutes).
  const open = new Map<string, number>();
  // One string per tag name and its local name (a sheet repeats "c", "v" and "row" millions of
  // times), and per attribute name.
  const names = new Map<string, { name: string; local: string }>();
  const attrNames = new Map<string, string>();
  // The attributes of the tag being read.
  const found: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf("<", i);
    const end = lt < 0 ? n : lt;
    if (end > i) {
      const raw = src.slice(i, end);
      const top = stack[stack.length - 1];
      if (top !== doc && (KEEPS_SPACE.has(top.local) || /\S/.test(raw))) addKid(top, decodeEntities(raw));
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
        if (top !== doc) addKid(top, src.slice(lt + 9, close));
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
    if (--budget.nodes < 0) throw new XmlError("xml: too many elements", true);
    let tag = names.get(raw);
    if (!tag) {
      tag = { name: raw, local: localName(raw) };
      if (names.size < 10_000) names.set(raw, tag);
    }
    const { name, local } = tag;
    found.length = 0;
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
      const rawName = src.slice(a0, j);
      while (j < n && space(src.charCodeAt(j))) j++;
      if (src.charCodeAt(j) !== 61) {
        // An attribute without a value (not XML, but harmless): skip it.
        if (!rawName) j++;
        continue;
      }
      j++;
      while (j < n && space(src.charCodeAt(j))) j++;
      const q = src[j];
      if (q !== '"' && q !== "'") throw new XmlError("xml: unquoted attribute");
      const close = src.indexOf(q, j + 1);
      if (close < 0) throw new XmlError("xml: unclosed attribute");
      const value = src.slice(j + 1, close);
      if (--budget.nodes < 0) throw new XmlError("xml: too many attributes", true);
      let attrName = attrNames.get(rawName);
      if (attrName === undefined) {
        attrName = rawName;
        if (attrNames.size < 10_000) attrNames.set(rawName, rawName);
      }
      found.push(attrName, decodeEntities(/[\t\n\r]/.test(value) ? value.replace(/[\t\n\r]/g, " ") : value));
      j = close + 1;
    }
    // A copy exactly as long as needed (an array grown by push keeps room for more).
    const el: XmlEl = { name, local, attrs: found.length ? found.slice() : NO_ATTRS, kids: NO_KIDS };
    addKid(stack[stack.length - 1], el);
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
  const a = el.attrs;
  for (let i = 0; i < a.length; i += 2) if (a[i] === name) return a[i + 1];
  const want = localName(name);
  for (let i = 0; i < a.length; i += 2) if (localName(a[i]) === want && (a[i].includes(":") || !name.includes(":"))) return a[i + 1];
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
