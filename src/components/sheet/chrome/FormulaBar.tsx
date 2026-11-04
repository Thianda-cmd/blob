"use client";

// The formula bar: the name box (where you are; type B4, A1:C10 or a table's name to go there),
// fx (the function library), ✗ and ✓ while editing, and the cell's content as you'd edit it.
// Formulas are coloured as you type (each reference in the colour of its frame on the grid), with
// matching functions, the arguments of the one you are in, the result so far, and the reason when
// a formula doesn't work. Typing here is the same edit as typing in the cell (store.edit): clicking
// cells while a formula wants a reference inserts it (the grid does that), and the bar follows.
//
// CONTRACT: <FormulaBar store={store} /> is placed by SheetEditor. Implemented by the editor chrome.

import { Check, ChevronDown, Table2, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Popover } from "@/components/ui/Menu";
import { usePhone, useTouch } from "@/components/ui/useMediaQuery";
import { useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { sheetChromeText, type SheetChromeText } from "@/i18n/messages/sheetChrome";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { cn } from "@/lib/utils";
import { areaName, colIndex, colName, parseArea } from "@/sheet/a1";
import { sheetColor } from "@/sheet/colors";
import { cutText } from "@/sheet/doc";
import { editText, errorText, formatValue, isError, toCanonicalFormula, type Calc, type CellValue, type FormulaToken, type FunctionName } from "@/sheet/engine";
import { getCell, sheetById } from "@/sheet/ops";
import { MAX_COLS, MAX_ROWS, type Area, type NumberFormat, type Workbook } from "@/sheet/types";
import { SHEET_EVENT, type SheetEventDetail } from "../events";
import { fillSelectionWith } from "../grid/actions";
import { chooseKeypad, keypadContext, keypadFor, useKeypad } from "../grid/keypad";
import { cycleReference } from "../grid/point";
import { activeArea, growSheet, openParens, typingFormat, useSheet, type SheetStore } from "../store";
import { insertFunction } from "./actions";
import { ArgumentHint, localName, SuggestionList } from "./FormulaHelp";
import { applySuggestion, argumentAt, formulaTokensOf, matchingParens, refColors, suggestFunctions } from "./formulaInput";
import { FunctionBrowser } from "./FunctionBrowser";
import { focusGrid, HoverTips, keepFocus, useKeys } from "./parts";

// ----------------------------------------------------------------------------------------------
// The name box

/** What the name box shows: a smart table's name when exactly it is selected, else B4, B2:D9, B:B or 3:5. */
export function selectionName(wb: Workbook, sheetId: string, area: Area): string {
  const table = wb.tables.find((t) => t.sheetId === sheetId && t.area.r0 === area.r0 && t.area.c0 === area.c0 && t.area.r1 === area.r1 && t.area.c1 === area.c1);
  if (table) return table.name;
  const sheet = sheetById(wb, sheetId);
  if (sheet && area.r0 === 0 && area.r1 >= sheet.size.rows - 1 && sheet.size.rows > 1) return `${colName(area.c0)}:${colName(area.c1)}`;
  if (sheet && area.c0 === 0 && area.c1 >= sheet.size.cols - 1 && sheet.size.cols > 1) return `${area.r0 + 1}:${area.r1 + 1}`;
  return areaName(area);
}

/**
 * Where a name typed into the name box points: a table's name, a cell or range ("b4", "A1:C10"),
 * whole columns or rows ("B:D", "3:5"), each optionally on another sheet ("'Blatt 2'!A1").
 * null when it isn't any of these. Whole columns and rows reach to `size` of their sheet.
 */
export function resolveName(wb: Workbook, currentSheetId: string, text: string): { sheetId: string; area: Area } | null {
  const raw = text.trim();
  if (!raw) return null;
  const table = wb.tables.find((t) => t.name.toLowerCase() === raw.toLowerCase());
  if (table) return { sheetId: table.sheetId, area: table.area };
  let sheetId = currentSheetId;
  let rest = raw;
  const bang = raw.lastIndexOf("!");
  if (bang > 0) {
    let name = raw.slice(0, bang).trim();
    if (name.startsWith("'") && name.endsWith("'") && name.length >= 2) name = name.slice(1, -1).replace(/''/g, "'");
    const sheet = wb.sheets.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!sheet) return null;
    sheetId = sheet.id;
    rest = raw.slice(bang + 1).trim();
  }
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return null;
  const cols = /^\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})$/.exec(rest);
  if (cols) {
    const a = colIndex(cols[1]);
    const b = colIndex(cols[2]);
    if (a < 0 || b < 0 || Math.max(a, b) >= MAX_COLS) return null;
    return { sheetId, area: { r0: 0, c0: Math.min(a, b), r1: sheet.size.rows - 1, c1: Math.max(a, b) } };
  }
  const rows = /^\$?(\d{1,6}):\$?(\d{1,6})$/.exec(rest);
  if (rows) {
    const a = Number(rows[1]) - 1;
    const b = Number(rows[2]) - 1;
    if (a < 0 || b < 0 || Math.max(a, b) >= MAX_ROWS) return null;
    return { sheetId, area: { r0: Math.min(a, b), c0: 0, r1: Math.max(a, b), c1: sheet.size.cols - 1 } };
  }
  const area = parseArea(rest);
  if (!area || area.r1 >= MAX_ROWS || area.c1 >= MAX_COLS) return null;
  return { sheetId, area };
}

/** `bare`: without the tables button (a phone while editing: the formula needs the room). */
function NameBox({ store, t, phone, bare }: { store: SheetStore; t: SheetChromeText; phone: boolean; bare: boolean }) {
  const workbook = useSheet(store, (s) => s.workbook);
  const sheetId = useSheet(store, (s) => s.sheetId);
  const selection = useSheet(store, (s) => s.selection);
  const locale = useSheet(store, (s) => s.locale);
  const name = selectionName(workbook, sheetId, activeArea(selection));
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tablesOpen, setTablesOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const justFocused = useRef(false);
  const tables = workbook.tables;

  const go = (target: { sheetId: string; area: Area }) => {
    const s = store.get();
    const sheet = sheetById(s.workbook, target.sheetId);
    if (!sheet) return;
    // Further down or right than the sheet goes yet: it grows (like typing there would).
    if (!s.readOnly && (target.area.r1 >= sheet.size.rows || target.area.c1 >= sheet.size.cols)) {
      store.apply(sheetGridText[locale].labels.addRows, (wb) => growSheet(wb, target.sheetId, target.area.r1 + 1, target.area.c1 + 1));
    }
    if (s.sheetId !== target.sheetId) store.setSheet(target.sheetId);
    store.select(target.area);
    setDraft(null);
    setProblem(null);
    focusGrid();
  };

  const submit = () => {
    const text = (draft ?? "").trim();
    if (!text || text === name) {
      setDraft(null);
      focusGrid();
      return;
    }
    const target = resolveName(store.get().workbook, store.get().sheetId, text);
    if (!target) {
      setProblem(t.nameBoxInvalid(text));
      input.current?.select();
      return;
    }
    go(target);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(null);
      setProblem(null);
      focusGrid();
    }
  };

  return (
    <div className="relative flex shrink-0 items-center">
      <input
        ref={input}
        value={draft ?? name}
        onChange={(e) => {
          setDraft(e.target.value);
          setProblem(null);
        }}
        onFocus={(e) => {
          setDraft(name);
          e.currentTarget.select();
          justFocused.current = true;
        }}
        onMouseUp={(e) => {
          // The click that focused the box would put the caret where it landed: keep it all selected.
          if (justFocused.current) e.preventDefault();
          justFocused.current = false;
        }}
        onBlur={() => {
          setDraft(null);
          setProblem(null);
        }}
        onKeyDown={onKeyDown}
        aria-label={t.nameBox}
        aria-invalid={problem ? true : undefined}
        data-tip={t.nameBoxTip}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        enterKeyHint="go"
        // Touch screens: 16 px text, or an iPhone zooms the page when the box is tapped (in either
        // orientation, so not only on phone widths). Where there is room, the box grows with it, so
        // a table's name still fits.
        className={cn(
          "h-8 text-ellipsis rounded-lg border border-transparent bg-paper px-2 font-mono text-[12.5px] text-ink outline-none transition-[border,box-shadow] hover:border-line focus:border-blob focus:bg-raised focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] aria-[invalid=true]:border-danger [@media(hover:none)]:h-9 [@media(hover:none)]:px-1.5 [@media(hover:none)]:text-[16px]",
          phone ? "w-[68px] [@media(hover:none)]:w-[84px]" : "w-[104px] [@media(hover:none)]:w-[132px]",
          tables.length > 0 && !bare && "rounded-r-none",
        )}
      />
      {tables.length > 0 && !bare && (
        <Popover
          open={tablesOpen}
          onOpenChange={setTablesOpen}
          label={t.nameBoxTables}
          className="w-[240px]"
          trigger={({ ref }) => (
            <button
              ref={ref}
              type="button"
              aria-label={t.nameBoxTables}
              aria-haspopup="menu"
              aria-expanded={tablesOpen}
              data-tip={t.nameBoxTables}
              onMouseDown={keepFocus}
              onClick={() => setTablesOpen((v) => !v)}
              // A finger gets 40 × 40 px (the box looks 36 px wide; the rest reaches past its edges).
              className="relative grid h-8 w-5 place-items-center rounded-r-lg bg-paper text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-9 [@media(hover:none)]:w-9 [@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-0.5 [@media(hover:none)]:after:content-['']"
            >
              <ChevronDown className="size-3" />
            </button>
          )}
        >
          {(close) => (
            <div onMouseDown={keepFocus}>
              <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.nameBoxTables}</div>
              {tables.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    go({ sheetId: tb.sheetId, area: tb.area });
                  }}
                  className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10"
                >
                  <Table2 className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">{tb.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{sheetById(workbook, tb.sheetId)?.name}</span>
                </button>
              ))}
            </div>
          )}
        </Popover>
      )}
      {problem && (
        <div role="alert" className="absolute left-0 top-full z-[61] mt-1.5 w-[260px] rounded-lg border border-line bg-raised px-3 py-2 text-[12.5px] leading-snug text-danger shadow-pop">
          {problem}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// The formula's colours

/** The text a value shows (errors in the user's language), for the live result. */
function shown(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  if (value === null) return "";
  if (isError(value)) return errorText(value.error, locale);
  return formatValue(value, fmt, locale);
}

/**
 * The formula (canonical) the result shown while typing is worked out from, with parentheses still
 * open closed (like Excel's preview); undefined when it doesn't parse yet. What is still being typed
 * at the end (a separator, an operator) doesn't count yet: "=MITTELWERT(B2:B7;" shows the mean of
 * B2:B7, not of B2:B7 and an empty 0.
 */
export function previewFormula(text: string, locale: Locale): string | undefined {
  const body = text.slice(1).replace(/[\s;,:+\-*/^&=<>]+$/, "");
  if (!text.startsWith("=") || !body) return undefined;
  try {
    let canonical = toCanonicalFormula(body, locale);
    const open = openParens(body);
    if (!("formula" in canonical) && open > 0) canonical = toCanonicalFormula(body + ")".repeat(open), locale);
    return "formula" in canonical ? canonical.formula : undefined;
  } catch {
    return undefined;
  }
}

/** The result of a formula being typed (see previewFormula); undefined when it doesn't parse yet. */
export function previewValue(text: string, locale: Locale, calc: Calc, at: { sheetId: string; row: number; col: number }): CellValue | undefined {
  const formula = previewFormula(text, locale);
  if (formula === undefined) return undefined;
  try {
    return calc.evaluate(formula, at);
  } catch {
    return undefined;
  }
}

function tokenStyle(tk: FormulaToken): string {
  if (tk.kind === "ref") return "";
  if (tk.kind === "string") return "text-[var(--sheet-green)]";
  if (tk.kind === "error") return "text-[var(--sheet-red)]";
  if (tk.kind === "unknown") return "underline decoration-danger decoration-wavy underline-offset-[3px]";
  if (tk.kind === "function" && !tk.fn) return "underline decoration-danger decoration-wavy underline-offset-[3px]";
  if (tk.kind === "operator" || tk.kind === "separator" || tk.kind === "paren") return "text-ink-2";
  return "";
}

/** The formula as coloured spans; the pair of parentheses at the caret and the place of an error marked. */
function Mirror({ text, locale, caret, error, focused }: { text: string; locale: Locale; caret: number; error: number | null; focused: boolean }): ReactNode {
  const tokens = formulaTokensOf(text, locale) ?? [];
  const colors = refColors(tokens);
  const pair = focused ? matchingParens(text, caret, locale) : null;
  const out: ReactNode[] = [<span key="eq" className="text-ink-3">=</span>];
  let at = 1;
  tokens.forEach((tk, i) => {
    if (tk.start > at) out.push(text.slice(at, tk.start));
    const color = tk.kind === "ref" ? colors.get(tk) : undefined;
    const marked = pair && tk.kind === "paren" && (tk.start === pair[0] || tk.start === pair[1]);
    const wrong = error !== null && error >= tk.start && error < Math.max(tk.end, tk.start + 1);
    out.push(
      <span
        key={i}
        className={cn(tokenStyle(tk), marked && "rounded-[3px] bg-blob-soft text-blob-ink", wrong && "underline decoration-danger decoration-wavy underline-offset-[3px]")}
        style={color ? { color: sheetColor(color) } : undefined}
      >
        {text.slice(Math.max(at, tk.start), tk.end)}
      </span>,
    );
    at = Math.max(at, tk.end);
  });
  if (at < text.length) out.push(text.slice(at));
  // A trailing line break needs something after it to take up its line.
  if (text.endsWith("\n")) out.push(" ");
  return out;
}

// ----------------------------------------------------------------------------------------------

const LINE = 20;
const MAX_LINES = 8;

export function FormulaBar({ store }: { store: SheetStore }): ReactNode {
  const t = useMessages(sheetChromeText);
  const keys = useKeys();
  const phone = usePhone();
  const touch = useTouch();
  const keypad = useKeypad();
  const listId = useId();
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const edit = useSheet(store, (s) => s.edit);
  const sheetId = useSheet(store, (s) => s.sheetId);
  const anchor = useSheet(store, (s) => s.selection.anchor);
  const workbook = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);

  const area = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  /** The text and caret last read from the textarea, so changes made elsewhere (a cell pointed at, a suggestion taken) can be told apart. */
  const synced = useRef<{ text: string; caret: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [assist, setAssist] = useState<{ key: string; pick: number; closed: boolean }>({ key: "", pick: 0, closed: false });
  const [helpPos, setHelpPos] = useState<{ left: number; top: number; width: number } | null>(null);

  // What the bar shows: the running edit (in the bar or the cell), else the active cell as you'd edit it.
  const cellPos = edit ? { sheetId: edit.sheetId, row: edit.row, col: edit.col } : { sheetId, row: anchor.row, col: anchor.col };
  const cell = getCell(workbook, cellPos.sheetId, cellPos.row, cellPos.col);
  const text = edit ? edit.text : editText(cell, locale);
  const caret = edit ? edit.caret : text.length;
  const isFormula = text.startsWith("=");
  const inBar = !!edit && edit.via === "bar";
  const cellName = areaName({ r0: cellPos.row, c0: cellPos.col, r1: cellPos.row, c1: cellPos.col });

  // Help under the bar while typing here: why the formula fails, matching functions, or the arguments.
  const suggestions = inBar && focused && !edit.error && isFormula ? (() => {
    try {
      const s = suggestFunctions(text, caret, locale);
      return s ? { ...s, items: s.items.slice(0, 8) } : null;
    } catch {
      return null;
    }
  })() : null;
  const assistKey = suggestions ? `${suggestions.start}:${text.slice(suggestions.start, suggestions.end)}` : "";
  const listOpen = !!suggestions && !(assist.key === assistKey && assist.closed);
  const pick = assist.key === assistKey ? Math.min(assist.pick, (suggestions?.items.length ?? 1) - 1) : 0;
  const argument = inBar && focused && isFormula && !listOpen && !edit.error ? (() => {
    try {
      return argumentAt(text, caret, locale);
    } catch {
      return null;
    }
  })() : null;
  const error = edit?.error ?? null;

  const preview = useMemo(() => {
    if (!edit || !isFormula) return null;
    const v = previewValue(text, locale, calc, cellPos);
    const formula = previewFormula(text, locale);
    if (v === undefined || formula === undefined) return null;
    // As the cell will show it once entered: =B2-A2 of two times 06:30, not 0,270833333 (typingFormat).
    const s = shown(v, typingFormat({ workbook, calc }, cellPos.sheetId, cellPos, formula), locale);
    return s.length > 40 ? `${cutText(s, 40)}…` : s;
    // cellPos is rebuilt every render; its parts are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, isFormula, text, locale, calc, workbook, cellPos.sheetId, cellPos.row, cellPos.col]);

  // A phone's bar is narrow: while a formula is typed here the name box steps aside, the result
  // moves into the help, and the help is one line (the cells under it stay in view to be tapped).
  const roomy = phone && inBar;
  const helpOpen = inBar && focused && (!!error || listOpen || !!argument || (phone && preview !== null));

  // Touch screens, while the cell editor has the keyboard: "123" / "ABC" switches its keyboard.
  const keypadSheet = touch && keypad.open && !readOnly ? sheetById(workbook, cellPos.sheetId) : undefined;
  const padContext = keypadSheet ? keypadContext(keypadSheet, cellPos) : null;
  const pad = padContext ? keypadFor(padContext, keypad.choice) : null;

  // ---- keeping the textarea and the store in step

  // A change made elsewhere (a reference pointed at, a suggestion taken, typing in the cell) puts
  // the caret where the store says, while the bar has the keyboard; the user's own moves are left alone.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !edit) {
      synced.current = null;
      return;
    }
    const last = synced.current;
    if (last && last.text === edit.text && last.caret === edit.caret) return;
    synced.current = { text: edit.text, caret: edit.caret };
    if (edit.via !== "bar" || document.activeElement !== el) return;
    if (el.selectionStart !== edit.caret || el.selectionEnd !== edit.caret) el.setSelectionRange(edit.caret, edit.caret);
  }, [edit]);

  // An edit moved into the bar from elsewhere (a function picked, AutoSum's proposal): the bar takes the keyboard.
  useLayoutEffect(() => {
    const el = area.current;
    if (!inBar || !el || document.activeElement === el) return;
    // The caret first, so the focus handler reads the right place.
    const c = store.get().edit?.caret ?? el.value.length;
    el.setSelectionRange(c, c);
    el.focus({ preventScroll: true });
  }, [inBar, store]);

  // Height: one line, or (expanded) as many as the text needs up to eight; the coloured copy follows the scrolling.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = `${LINE + 12}px`;
    if (expanded) el.style.height = `${Math.min(MAX_LINES * LINE, Math.max(LINE, el.scrollHeight - 12)) + 12}px`;
    if (mirror.current) mirror.current.scrollTop = el.scrollTop;
  }, [text, expanded]);

  // The grid's Shift+F3 (and AutoSum's "Weitere Funktionen") open the function library here.
  useEffect(() => {
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<SheetEventDetail>).detail?.open === "functions") setFunctionsOpen(true);
    };
    window.addEventListener(SHEET_EVENT, onEvent);
    return () => window.removeEventListener(SHEET_EVENT, onEvent);
  }, []);

  // The help box sits under the formula, inside the window (on a phone as wide as the window).
  useLayoutEffect(() => {
    if (!helpOpen) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const width = phone ? window.innerWidth - 16 : Math.min(420, Math.max(260, r.width), window.innerWidth - 16);
      setHelpPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 6, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [helpOpen, expanded, phone]);

  // ---- actions

  const start = () => {
    const s = store.get();
    if (s.readOnly) return;
    if (!s.edit || s.edit.via !== "bar") store.startEdit({ via: "bar", replace: false });
  };

  const commit = (move: "down" | "up" | "right" | "left" | null) => {
    if (store.commitEdit(move)) focusGrid();
    else area.current?.focus();
  };
  const cancel = () => {
    store.cancelEdit();
    focusGrid();
  };

  const take = (fn: FunctionName) => {
    const e = store.get().edit;
    if (!e || !suggestions) return;
    const next = applySuggestion(e.text, suggestions, localName(fn, locale));
    store.updateEdit(next.text, next.caret);
  };

  const insertAtCaret = (insert: string) => {
    const el = area.current;
    const e = store.get().edit;
    if (!el || !e) return;
    const from = el.selectionStart;
    const to = el.selectionEnd;
    const next = e.text.slice(0, from) + insert + e.text.slice(to);
    store.updateEdit(next, from + insert.length);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const s = store.get();
    if (!s.edit) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        focusGrid();
      }
      return;
    }
    const mod = (e.ctrlKey || e.metaKey) && !(e.ctrlKey && e.altKey && !e.metaKey);
    if (listOpen && suggestions && !mod && !e.altKey) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = suggestions.items.length;
        setAssist({ key: assistKey, pick: (pick + (e.key === "ArrowDown" ? 1 : n - 1)) % n, closed: false });
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey) {
        e.preventDefault();
        take(suggestions.items[pick]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAssist({ key: assistKey, pick, closed: true });
        return;
      }
    }
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (e.altKey) insertAtCaret("\n");
        else if (mod) {
          if (fillSelectionWith(store, s.edit.text)) focusGrid();
        } else commit(e.shiftKey ? "up" : "down");
        return;
      case "Tab":
        e.preventDefault();
        commit(e.shiftKey ? "left" : "right");
        return;
      case "Escape":
        e.preventDefault();
        cancel();
        return;
      case "F4": {
        e.preventDefault();
        const next = cycleReference(s.edit.text, s.edit.caret, locale);
        if (next) store.updateEdit(next.text, next.caret);
        return;
      }
    }
  };

  const showMirror = isFormula;
  const lines = text.split("\n").length;
  // (A phone's bar has room for only about 20 characters on a line.)
  const canExpand = expanded || lines > 1 || text.length > (phone ? 20 : 60);
  // One line high, a long formula wraps out of sight: its lines are then as tall as the bar, so the
  // next one never peeks in under the first (the caret's line scrolls in whole). Expanded, normal lines.
  // (The textarea and its coloured copy share this, so they stay in step. Touch screens: 16 px
  // text, or an iPhone zooms the page when the bar is tapped.)
  const textStyle = cn(
    "px-2.5 text-[13.5px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] [@media(hover:none)]:text-[16px]",
    expanded ? "py-1.5 leading-[20px]" : "py-0 leading-[32px]",
  );

  const help: ReactNode = !helpOpen ? null : error ? (
    <div className="px-3 py-2">
      <div className="text-[12px] font-semibold text-danger">{t.formulaProblem}</div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{error.message}</div>
    </div>
  ) : listOpen && suggestions ? (
    <SuggestionList
      id={listId}
      items={suggestions.items}
      pick={pick}
      locale={locale}
      t={t}
      // (The same words as under the cell's own list.)
      tapHint={sheetGridText[locale].pickHintTouch}
      typed={text.slice(suggestions.start, caret)}
      onPick={take}
      onHover={(i) => setAssist({ key: assistKey, pick: i, closed: false })}
      compact={phone}
    />
  ) : phone ? (
    <div className="flex items-baseline gap-2 px-3 py-1.5 text-[12.5px] leading-snug">
      {argument ? <ArgumentHint fn={argument.fn} index={argument.index} locale={locale} t={t} compact /> : <span className="text-ink-2">{t.result}</span>}
      {preview !== null && <span className="ml-auto max-w-[50%] shrink-0 truncate tabular-nums text-ink">= {preview}</span>}
    </div>
  ) : argument ? (
    <ArgumentHint fn={argument.fn} index={argument.index} locale={locale} t={t} />
  ) : null;

  return (
    <>
      <div role="group" aria-label={t.formulaBar} className="flex min-w-0 items-start gap-1 rounded-xl border border-line bg-raised p-1 shadow-card">
        {!roomy && (
          <>
            <NameBox store={store} t={t} phone={phone} bare={phone && !!edit} />
            <span aria-hidden className="mx-0.5 mt-1.5 h-5 w-px shrink-0 bg-line" />
          </>
        )}
        {edit && !readOnly && (
          <>
            {/* A finger gets 36 × 40 px, like fx beside them: the rest reaches into the bar's padding
                (not sideways, which would take room from the phone's narrow text field). */}
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={cancel}
              aria-label={t.cancelEdit}
              data-tip={t.cancelEdit}
              data-keys={t.keys.esc}
              className="relative grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-danger [@media(hover:none)]:size-9 [@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-y-0.5 [@media(hover:none)]:after:inset-x-0 [@media(hover:none)]:after:content-['']"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => commit(null)}
              aria-label={t.enter}
              data-tip={t.enter}
              data-keys={t.keys.enter}
              className="relative grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ok [@media(hover:none)]:size-9 [@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-y-0.5 [@media(hover:none)]:after:inset-x-0 [@media(hover:none)]:after:content-['']"
            >
              <Check className="size-4" />
            </button>
          </>
        )}
        {pad && padContext && (
          <button
            type="button"
            // The cell editor keeps the keyboard (a tap here must not take the focus and close it).
            onMouseDown={keepFocus}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => chooseKeypad(padContext, pad === "decimal" ? "text" : "decimal")}
            aria-label={pad === "decimal" ? `ABC – ${sheetGridText[locale].letterPad}` : `123 – ${sheetGridText[locale].numberPad}`}
            className="relative grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-paper text-[13px] font-semibold tabular-nums text-ink-2 transition-colors after:absolute after:-inset-y-0.5 after:inset-x-0 after:content-[''] active:bg-hover"
          >
            {pad === "decimal" ? "ABC" : "123"}
          </button>
        )}
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setFunctionsOpen(true)}
          aria-label={t.insertFunction}
          data-tip={t.insertFunction}
          data-keys={keys("Shift+F3").join("|")}
          // A finger gets 40 × 40 px (the button looks 36 px high; the rest reaches into the bar's padding).
          className="relative grid h-8 shrink-0 place-items-center rounded-lg px-2 font-serif text-[15px] italic text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-9 [@media(hover:none)]:w-10 [@media(hover:none)]:px-0 [@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-y-0.5 [@media(hover:none)]:after:inset-x-0 [@media(hover:none)]:after:content-['']"
        >
          fx
        </button>
        <div ref={box} className="relative min-w-0 flex-1 rounded-lg">
          {showMirror && (
            <div ref={mirror} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden text-ink", textStyle)}>
              <Mirror text={text} locale={locale} caret={caret} error={error ? error.at : null} focused={focused && inBar} />
            </div>
          )}
          <textarea
            ref={area}
            value={text}
            rows={1}
            readOnly={readOnly}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            // Enter takes the entry and gives the sheet the keyboard back (it closes on a touch screen).
            enterKeyHint="done"
            placeholder={readOnly ? undefined : t.formulaPlaceholder}
            aria-label={t.formula(cellName)}
            aria-autocomplete={isFormula ? "list" : undefined}
            aria-controls={listOpen ? listId : undefined}
            aria-activedescendant={listOpen ? `${listId}-${pick}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={helpOpen ? `${listId}-help` : undefined}
            className={cn(
              // The first hint a student reads: the placeholder is dark enough to read (4.5:1 and more).
              "block w-full resize-none overflow-hidden rounded-lg bg-transparent outline-none transition-[box-shadow] placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] focus:shadow-[inset_0_0_0_1.5px_var(--blob)]",
              expanded && "overflow-y-auto",
              textStyle,
              showMirror ? "text-transparent caret-ink selection:bg-blob/25" : "text-ink",
            )}
            style={{ height: LINE + 12 }}
            onFocus={(e) => {
              setFocused(true);
              if (readOnly) return;
              const el = e.currentTarget;
              start();
              // Keep the caret where the click put it (startEdit puts it at the end).
              const c = el.selectionStart ?? el.value.length;
              synced.current = { text: el.value, caret: c };
              store.updateEdit(el.value, c);
            }}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const value = e.target.value;
              const at = e.target.selectionStart ?? value.length;
              synced.current = { text: value, caret: at };
              if (!store.get().edit) start();
              store.updateEdit(value, at);
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              const s = store.get();
              if (!s.edit || s.edit.via !== "bar" || el.selectionStart !== el.selectionEnd || el.value !== s.edit.text) return;
              if (el.selectionStart === s.edit.caret) return;
              synced.current = { text: el.value, caret: el.selectionStart };
              store.updateEdit(el.value, el.selectionStart);
            }}
            onScroll={(e) => {
              if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {preview !== null && !phone && (
          <span
            className="mt-1 max-w-[34%] shrink-0 truncate rounded-md bg-paper px-2 py-[3px] text-[12.5px] tabular-nums text-ink-2"
            title={`${t.result}: ${preview}`}
            aria-live="polite"
            aria-label={`${t.result}: ${preview}`}
          >
            = {preview || " "}
          </span>
        )}
        {canExpand && (
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? t.collapse : t.expand}
            aria-expanded={expanded}
            data-tip={expanded ? t.collapse : t.expand}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
          >
            <ChevronDown className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        )}
      </div>
      {help &&
        helpPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={`${listId}-help`}
            // Only the list of functions takes clicks: the hint and the error let them through to the
            // cells underneath, so pointing at B2:B7 works even where the hint covers them.
            className={cn("fixed z-[78] overflow-hidden rounded-xl border border-line bg-raised text-left shadow-pop", !listOpen && "pointer-events-none")}
            style={{ left: helpPos.left, top: helpPos.top, width: helpPos.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {help}
          </div>,
          document.body,
        )}
      <HoverTips />
      <FunctionBrowser
        open={functionsOpen}
        onClose={() => setFunctionsOpen(false)}
        canInsert={!readOnly}
        onPick={(fn) => {
          setFunctionsOpen(false);
          insertFunction(store, fn);
        }}
      />
    </>
  );
}
