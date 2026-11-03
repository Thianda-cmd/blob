// A small XML reader and writer for the parts of an .xlsx file (Node has no DOMParser, and the
// check script runs in Node). Reads well-formed XML into a light tree: elements with their
// attributes and children; comments, processing instructions and the DOCTYPE are skipped. Names
// keep their prefix ("r:id", "x:Row"); `local` drops it, so files in the "strict" OOXML namespace
// read the same.

export type XmlEl = { name: string; local: string; attrs: Record<string, string>; kids: XmlNode[] };
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
    return NAMED[e] ?? m;
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

export class XmlError extends Error {}

/** Space, tab, line feed, carriage return. */
const space = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
/** Where a tag or attribute name ends: whitespace, "/" or ">". */
const nameEnd = (c: number) => space(c) || c === 47 || c === 62;

/** The document's root element. Throws XmlError when the text isn't XML. */
export function parseXml(src: string): XmlEl {
  const doc: XmlEl = { name: "#document", local: "#document", attrs: {}, kids: [] };
  const stack: XmlEl[] = [doc];
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
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      i = close + 1;
      continue;
    }
    // A start tag: its name, then attributes up to ">" or "/>" (">" may appear inside quotes).
    let j = lt + 1;
    while (j < n && !nameEnd(src.charCodeAt(j))) j++;
    const name = src.slice(lt + 1, j);
    if (!name) throw new XmlError("xml: empty tag name");
    const attrs: Record<string, string> = {};
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
      attrs[attr] = decodeEntities(/[\t\n\r]/.test(value) ? value.replace(/[\t\n\r]/g, " ") : value);
      j = close + 1;
    }
    const el: XmlEl = { name, local: localName(name), attrs, kids: [] };
    stack[stack.length - 1].kids.push(el);
    if (!selfClosing) stack.push(el);
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
