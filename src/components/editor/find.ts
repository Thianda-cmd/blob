import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

// Find and replace inside a note (the find bar: FindBar.tsx). Matches are searched line by line
// (each textblock's text, marks don't split a match; formulas and line breaks do), drawn as
// decorations, and found again whenever the note changes. Replacing keeps the marks of the text it
// replaces; "Replace all" is one change, so one undo brings everything back.

export type FindOptions = { caseSensitive: boolean; wholeWord: boolean; regex: boolean };
export const NO_OPTIONS: FindOptions = { caseSensitive: false, wholeWord: false, regex: false };

type Match = { from: number; to: number; /** The match and its groups, for "$1" in a replacement. */ groups: string[]; named?: Record<string, string> };

export type FindState = {
  query: string;
  options: FindOptions;
  matches: Match[];
  /** The match the bar is on (-1: none yet). */
  current: number;
  /** The pattern isn't a valid regular expression. */
  invalid: boolean;
  /** Big notes: the matches were only moved along with an edit, and are looked up again soon. */
  stale: boolean;
};

type Meta = { query?: string; options?: FindOptions; current?: number; /** Land on the first match from here. */ after?: number; clear?: true; refresh?: true };

export const findKey = new PluginKey<FindState>("blobFind");
const EMPTY: FindState = { query: "", options: NO_OPTIONS, matches: [], current: -1, invalid: false, stale: false };
/** More matches than this aren't drawn (a one-letter search in a long note). */
const MAX_MATCHES = 2000;
/** Notes bigger than this look their matches up a moment after typing, not on every key. */
const BIG_DOC = 60_000;
/** What stands in for a formula or a line break in a line's text: nothing matches across it. */
const STOP = "￼";
const WORD = "[\\p{L}\\p{N}_]";

/** The search as a regular expression (null: nothing to search; "invalid": a broken pattern). */
function pattern(query: string, o: FindOptions): RegExp | null | "invalid" {
  if (!query) return null;
  const source = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = `g${o.caseSensitive ? "" : "i"}`;
  try {
    return new RegExp(o.wholeWord ? `(?<!${WORD})(?:${source})(?!${WORD})` : source, `${flags}u`);
  } catch {
    // Some patterns are fine without the unicode flag (e.g. "\-"); words are then ASCII words.
    try {
      return new RegExp(o.wholeWord ? `\\b(?:${source})\\b` : source, flags);
    } catch {
      return "invalid";
    }
  }
}

/** Every match in the document, line by line. */
function search(doc: PMNode, query: string, options: FindOptions): { matches: Match[]; invalid: boolean } {
  const re = pattern(query, options);
  if (re === "invalid") return { matches: [], invalid: true };
  if (!re) return { matches: [], invalid: false };
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (matches.length >= MAX_MATCHES) return false;
    if (!node.isTextblock) return true;
    // The line's text, and where each piece of it starts in the document.
    let text = "";
    const starts: { at: number; pos: number }[] = [];
    node.forEach((child, offset) => {
      starts.push({ at: text.length, pos: pos + 1 + offset });
      text += child.isText ? child.text! : STOP.repeat(child.nodeSize);
    });
    if (!text) return false;
    const toPos = (i: number) => {
      let s = starts[0];
      for (const x of starts) if (x.at <= i) s = x;
      return s.pos + (i - s.at);
    };
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && matches.length < MAX_MATCHES) {
      if (!m[0].length) {
        // A pattern that can match nothing ("a*"): step on instead of finding nothing forever.
        re.lastIndex++;
        continue;
      }
      if (m[0].includes(STOP)) continue;
      matches.push({ from: toPos(m.index), to: toPos(m.index + m[0].length), groups: [...m].map((g) => g ?? ""), named: m.groups });
    }
    return false;
  });
  return { matches, invalid: false };
}

/** The first match at or after `pos` (wrapping to the first one). */
function firstFrom(matches: Match[], pos: number) {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i < 0 ? 0 : i;
}

function apply(tr: Transaction, prev: FindState, state: EditorState): FindState {
  const meta = tr.getMeta(findKey) as Meta | undefined;
  if (meta?.clear) return EMPTY;
  const query = meta?.query ?? prev.query;
  const options = meta?.options ?? prev.options;
  const changedSearch = meta?.query !== undefined || meta?.options !== undefined;
  if (!query) return { ...EMPTY, options };

  if (changedSearch || meta?.refresh || (tr.docChanged && state.doc.content.size <= BIG_DOC)) {
    const { matches, invalid } = search(state.doc, query, options);
    let current: number;
    if (meta?.current !== undefined) current = Math.min(meta.current, matches.length - 1);
    else if (meta?.after !== undefined) current = firstFrom(matches, meta.after);
    else if (changedSearch) current = firstFrom(matches, state.selection.from);
    else if (prev.current >= 0 && prev.matches[prev.current]) current = firstFrom(matches, tr.mapping.map(prev.matches[prev.current].from, -1));
    else current = -1;
    return { query, options, matches, current, invalid, stale: false };
  }
  if (tr.docChanged) {
    // A big note: the matches move with the edit now and are looked up again in a moment.
    const matches = prev.matches.map((m) => ({ ...m, from: tr.mapping.map(m.from, 1), to: tr.mapping.map(m.to, -1) })).filter((m) => m.to > m.from);
    return { ...prev, matches, current: Math.min(prev.current, matches.length - 1), stale: true };
  }
  if (meta?.current !== undefined) return { ...prev, current: prev.matches.length ? ((meta.current % prev.matches.length) + prev.matches.length) % prev.matches.length : -1 };
  return prev;
}

export const FindReplace = Extension.create({
  name: "blobFind",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: { init: () => EMPTY, apply: (tr, prev, _old, state) => apply(tr, prev, state) },
        props: {
          decorations(state) {
            const s = findKey.getState(state);
            if (!s?.matches.length) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? "blob-find-match is-current" : "blob-find-match" })),
            );
          },
        },
        view: () => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          return {
            update(view) {
              if (!findKey.getState(view.state)?.stale) return;
              clearTimeout(timer);
              timer = setTimeout(() => {
                if (!view.isDestroyed && findKey.getState(view.state)?.stale) view.dispatch(view.state.tr.setMeta(findKey, { refresh: true } satisfies Meta).setMeta("addToHistory", false));
              }, 250);
            },
            destroy() {
              clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});

// Using it ----------------------------------------------------------------------------------------

export const findState = (state: EditorState) => findKey.getState(state) ?? EMPTY;

/** The nearest scrolling ancestor (the note scrolls in its own box). */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === "auto" || y === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Brings the current match into sight (a third from the top), unless it already is. */
export function revealCurrent(view: EditorView) {
  const s = findState(view.state);
  const m = s.matches[s.current];
  if (!m) return;
  try {
    const at = view.coordsAtPos(m.from);
    const box = scroller(view.dom);
    if (!box) return;
    const r = box.getBoundingClientRect();
    // The find bar sits at the top: a match right under it counts as hidden.
    if (at.top >= r.top + 72 && at.bottom <= r.bottom - 32) return;
    box.scrollTo({ top: box.scrollTop + at.top - (r.top + r.height / 3), behavior: "smooth" });
  } catch {}
}

function send(view: EditorView, meta: Meta) {
  view.dispatch(view.state.tr.setMeta(findKey, meta).setMeta("addToHistory", false));
}

export function setFind(view: EditorView, query: string, options: FindOptions) {
  send(view, { query, options });
  revealCurrent(view);
}

/** The next (1) or previous (-1) match, wrapping around. */
export function stepFind(view: EditorView, dir: 1 | -1) {
  const s = findState(view.state);
  if (!s.matches.length) return;
  const current = s.current < 0 ? (dir > 0 ? firstFrom(s.matches, view.state.selection.from) : firstFrom(s.matches, view.state.selection.from) - 1) : s.current + dir;
  send(view, { current });
  revealCurrent(view);
}

export function clearFind(view: EditorView) {
  send(view, { clear: true });
}

/** The replacement for a match: "$1", "$<name>", "$&" and "$$" work for regular expressions. */
function replacementFor(m: Match, replacement: string, regex: boolean) {
  if (!regex) return replacement;
  return replacement.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (whole, what: string, name?: string) => {
    if (what === "$") return "$";
    if (what === "&") return m.groups[0];
    if (name !== undefined) return m.named?.[name] ?? whole;
    const n = Number(what);
    return n > 0 && n < m.groups.length ? m.groups[n] : whole;
  });
}

/** Replaces the current match and moves on to the next one. False when there was nothing to replace. */
export function replaceCurrent(view: EditorView, replacement: string) {
  const s = findState(view.state);
  const m = s.matches[s.current];
  if (!m || !view.editable) return false;
  const text = replacementFor(m, replacement, s.options.regex);
  const tr = view.state.tr;
  if (text) tr.insertText(text, m.from, m.to);
  else tr.delete(m.from, m.to);
  tr.setMeta(findKey, { after: m.from + text.length } satisfies Meta);
  view.dispatch(tr);
  revealCurrent(view);
  return true;
}

/** Replaces every match in one change (one undo brings them all back). Returns how many. */
export function replaceAll(view: EditorView, replacement: string) {
  const s = findState(view.state);
  if (!s.matches.length || !view.editable || s.stale) return 0;
  const tr = view.state.tr;
  // From the end, so the earlier positions stay right.
  for (const m of [...s.matches].reverse()) {
    const text = replacementFor(m, replacement, s.options.regex);
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  view.dispatch(tr);
  return s.matches.length;
}

/** Selects the current match (closing the bar leaves the caret there). */
export function selectCurrent(view: EditorView) {
  const s = findState(view.state);
  const m = s.matches[s.current];
  if (!m) return false;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView());
  return true;
}
