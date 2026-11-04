"use client";

// A spreadsheet page ("Tabelle"): the title, the toolbar and formula bar, the grid with its charts
// and smart tables, the sheet tabs and status bar, and the settings of the chart or table you're
// working on (beside the grid on wide screens, over the lower part of the editor on phones and
// tablets held upright). A new, empty spreadsheet starts with the lab templates. Saving, working together and
// the copy kept on this device are in useSheetSave.
//
// Viewers (and a spreadsheet that couldn't be read) see everything but can't change it.

import { ChartScatter, Eye, FileDown, FileSpreadsheet, FileUp, Gauge, Keyboard, NotebookPen, Printer, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { blob } from "@/components/blob/bus";
import { download } from "@/components/notes/transfer";
import { isSheetFile } from "@/components/notes/useImporter";
import { OpenSheetCopy } from "@/components/page/OpenSheetCopy";
import { takeJustCopied, useSaveAsCopy } from "@/components/page/useSaveAsCopy";
import { PageTopBar } from "@/components/page/PageTopBar";
import { PageSaidContext } from "@/components/page/SaveIndicator";
import { usePanes } from "@/components/shell/Panes";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { useIsMac, usePhone } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { panesText } from "@/i18n/messages/panes";
import { sheetText } from "@/i18n/messages/sheet";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import type { AccessRole, Member, Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { copyTies, ownVersion, tiedCopy } from "@/sheet/collab";
import { isBlankWorkbook, isUnreadableWorkbook, normalizeWorkbook } from "@/sheet/doc";
import type { SheetEmbedItem } from "@/sheet/embed";
import { createCalc } from "@/sheet/engine";
import { sheetToCsv } from "@/sheet/io/csv";
import { deleteSheet, setColWidths, sheetById } from "@/sheet/ops";
import { currentRegion, tableAt } from "@/sheet/table/model";
import type { Workbook } from "@/sheet/types";
import { chartDataBlock, makeChart } from "./chart/actions";
import { chartByKeys, ChartLayer } from "./chart/ChartLayer";
import { ChartPanel } from "./chart/ChartPanel";
import { chartUi } from "./chart/selection";
import { FormulaBar } from "./chrome/FormulaBar";
import { SheetTabs } from "./chrome/SheetTabs";
import { StatusBar } from "./chrome/StatusBar";
import { Toolbar } from "./chrome/Toolbar";
import { BannerVoice } from "./BannerVoice";
import { AddToNoteDialog } from "./embed/AddToNote";
import { letGoOf } from "./drafts";
import { HEADER_H } from "./grid/geometry";
import { focusCellEditor, focusSheetGrid, Grid, type GridGeometry } from "./grid/Grid";
import { afterPaint, appendFits, appendWorkbook, csvColumnWidths, importedBytes, MAX_SHEET_BYTES, readSheetFile, SHEET_FILE_ACCEPT, sheetPageContent, sheetRoom, type ReadProblem } from "./importFile";
import { currentSheetNotice, hideSheetNotice, showSheetNotice } from "./notice";
import { printSheet } from "./print";
import { storedContent } from "./saver";
import { SheetNotices } from "./SheetNotice";
import { activeArea, createSheetStore, SheetStoreContext, useSheet, type SheetStore } from "./store";
import { TableMenuItems } from "./table/TableMenuItems";
import { TablePanel } from "./table/TablePanel";
import { useTableDecor } from "./table/useTableDecor";
import { PANEL_MIN_WIDTH, PANEL_WIDTH } from "./panelLayout";
import { TemplatePicker } from "./TemplatePicker";
import { copyReaders, markOwnVersion, sameOwnVersion, takeOwnVersion, tooBigBecause, useSheetSave } from "./useSheetSave";

/** The docked panel's two heights: part of the editor (at most DOCK_LOW_MAX px) or nearly all of it (keep in step with the classes below). */
const DOCK_LOW = 0.58;
const DOCK_LOW_MAX = 600;
const DOCK_TALL = 0.88;
/** A low dock that leaves less than this of the cells above it (px, not even a row and a half) covers them all: a chart's settings start tall instead. */
const LOW_DOCK_ROOM = 40;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * While a file is dragged, only its type is known: could it be an Excel or CSV file (no type:
 * maybe)? LibreOffice and Numbers files count too: dropping one says how to save it as .xlsx.
 */
const mightBeSheet = (data: DataTransfer) => {
  const files = Array.from(data.items).filter((item) => item.kind === "file");
  return files.length === 0 || files.some((item) => !item.type || /csv|tab-separated|excel|spreadsheet|numbers/.test(item.type));
};

/** A file name from the title: no characters file systems refuse. */
const fileNameOf = (title: string) =>
  title
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

/**
 * Where F6 lands in the open settings: their first field or control, past the title row with its
 * close button (and the docked panel's handle); the close button when there is nothing else.
 */
function firstSetting(panel: HTMLElement): HTMLElement | null {
  const body = panel.querySelector<HTMLElement>("[data-table-panel], [data-chart-panel]") ?? panel;
  const header = body.querySelector("h2")?.parentElement ?? null;
  const controls = [...body.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]")].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
  return controls.find((el) => !header?.contains(el)) ?? controls[0] ?? null;
}

/**
 * Where F6 lands among the charts on the sheet on screen (`cards`): the chart selected, the one
 * whose settings are open, one drawn over the selected cells, one made from the cells the active
 * cell is in, one that can be seen already (the cells stay where they are), or else the first
 * (Tab goes on from a chart to its bar and to the next chart).
 */
function chartForKeys(store: SheetStore, cards: HTMLElement[]): HTMLElement {
  const s = store.get();
  const byId = (id: string | null | undefined) => (id ? cards.find((card) => card.dataset.chartCard === id) : undefined);
  const area = activeArea(s.selection);
  const p = s.selection.anchor;
  // The cells under a chart, as ChartLayer measures them ("r0,c0,r1,c1").
  const drawnOver = (card: HTMLElement) => {
    const [r0, c0, r1, c1] = (card.dataset.chartCells ?? "").split(",").map(Number);
    return r0 <= area.r1 && area.r0 <= r1 && c0 <= area.c1 && area.c0 <= c1;
  };
  const madeFrom = (card: HTMLElement) => {
    const spec = s.workbook.charts.find((c) => c.id === card.dataset.chartCard);
    const block = spec ? chartDataBlock(s.workbook, spec) : null;
    return !!block && p.row >= block.r0 && p.row <= block.r1 && p.col >= block.c0 && p.col <= block.c1;
  };
  const grid = cards[0]?.closest("[data-sheet-grid]")?.getBoundingClientRect();
  const shown = (card: HTMLElement) => {
    const r = card.getBoundingClientRect();
    return !!grid && r.right > grid.left && r.left < grid.right && r.bottom > grid.top && r.top < grid.bottom;
  };
  return (
    byId(chartUi(store).selected) ??
    byId(s.focus?.kind === "chart" ? s.focus.id : null) ??
    cards.find(drawnOver) ??
    cards.find(madeFrom) ??
    cards.find(shown) ??
    cards[0]
  );
}

export function SheetEditor({ page, role = "owner", members = [] }: { page: Page; role?: AccessRole; members?: Member[] }) {
  const locale = useLocale();
  const t = useMessages(sheetText);
  const shortcutsLabel = useMessages(panesText).shortcuts.open;
  const { pages, updatePage, userId, profile } = useWorkspace();
  const { showShortcuts } = usePanes();
  const mac = useIsMac();
  const modKey = mac ? "⌘" : locale === "de" ? "Strg+" : "Ctrl+";

  // The stored content, read once (normalizing never throws; a bug while reading opens it read-only).
  const [start] = useState(() => {
    const workbook = normalizeWorkbook(page.content, locale);
    return { workbook, unreadable: isUnreadableWorkbook(workbook) };
  });
  const readOnly = role === "viewer" || start.unreadable;
  const [store] = useState<SheetStore>(() => createSheetStore({ pageId: page.id, workbook: start.workbook, locale, readOnly }));
  const shared = members.length > 1;

  // The title: shown above the toolbar, in the sidebar at once, saved with the content.
  const [title, setTitle] = useState(page.title);
  const showTitle = useCallback(
    (next: string) => {
      setTitle(next);
      void updatePage(page.id, { title: next }, { local: true });
    },
    [page.id, updatePage],
  );
  const save = useSheetSave({
    store,
    pageId: page.id,
    rev: page.rev ?? 0,
    title: page.title,
    readOnly,
    shared,
    userId,
    me: { user_id: userId, name: profile.full_name ?? "", avatar_url: profile.avatar_url },
    onTitle: showTitle,
  });
  const saveTitle = save.setTitle;
  const onTitle = (value: string) => {
    if (readOnly) return;
    // 200 characters, not UTF-16 units: an emoji at the cut goes as a whole.
    const next = Array.from(value).slice(0, 200).join("");
    showTitle(next);
    saveTitle(next);
  };
  // Renamed somewhere else in this tab (the sidebar): the title here follows, and the next save keeps it.
  const workspaceTitle = pages.find((p) => p.id === page.id)?.title;
  const [seenTitle, setSeenTitle] = useState(workspaceTitle);
  if (workspaceTitle !== seenTitle) {
    setSeenTitle(workspaceTitle);
    if (workspaceTitle !== undefined && workspaceTitle !== title) setTitle(workspaceTitle);
  }
  useEffect(() => {
    if (!readOnly) saveTitle(title);
  }, [title, readOnly, saveTitle]);

  // Blob steps out of the corner: the status bar (sum, average) lives there.
  useEffect(() => {
    blob.away(true);
    return () => blob.away(false);
  }, []);

  // Wide enough for the settings beside the grid?
  const bodyRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= PANEL_MIN_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The height of the row with the sheet tabs and the status bar, as --sheet-foot on the editor: the
  // docked settings end above it (not on phones, where every row of the panel counts).
  const footRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const foot = footRef.current;
    const editor = bodyRef.current;
    if (!foot || !editor) return;
    const ro = new ResizeObserver(() => editor.style.setProperty("--sheet-foot", `${foot.offsetHeight}px`));
    ro.observe(foot);
    return () => ro.disconnect();
  }, []);
  // How high the docked settings reach (from the editor's bottom to their top), as --sheet-dock:
  // the notices (SheetNotice.tsx) sit above them instead of over their buttons.
  const dockTop = useCallback((dock: HTMLDivElement | null) => {
    const editor = bodyRef.current;
    if (!dock || !editor) return;
    const ro = new ResizeObserver(() => editor.style.setProperty("--sheet-dock", `${editor.clientHeight - dock.offsetTop}px`));
    ro.observe(dock);
    ro.observe(editor);
    return () => {
      ro.disconnect();
      editor.style.removeProperty("--sheet-dock");
    };
  }, []);

  // The chart or smart table whose settings are open.
  const focus = useSheet(store, (s) => s.focus);
  const closePanel = useCallback(() => {
    store.setFocus(null);
    focusSheetGrid();
  }, [store]);
  // The docked panel (narrow screens): about half the editor, or nearly all of it. Its handle
  // switches between the two with a tap, or is dragged (down to the bottom closes the panel). On
  // phones a chart's settings start tall: they show the chart themselves. So they do where a low
  // dock would leave no cells above it (a short window: 200 % zoom, a phone held sideways): low,
  // they would hide the chart and still have no room for their own settings.
  const phone = usePhone();
  const [dockTall, setDockTall] = useState<boolean | null>(null);
  const [lowHidesCells, setLowHidesCells] = useState(false);
  const zoom = useSheet(store, (s) => s.zoom);
  useEffect(() => {
    const editor = bodyRef.current;
    const grid = editor?.querySelector<HTMLElement>("[data-sheet-grid]");
    if (!editor || !grid) return;
    const measure = () => {
      // Where a low dock's top would be (it ends above the tabs row, on phones at the bottom), and
      // where the grid's cells start: below its column letters, which are HEADER_H tall at the
      // grid's zoom (worked out, as they may not be drawn yet when this first runs).
      const bottom = editor.getBoundingClientRect().top + editor.clientTop + editor.clientHeight - (phone ? 0 : (footRef.current?.offsetHeight ?? 0));
      const lowTop = bottom - Math.min(editor.clientHeight * DOCK_LOW, DOCK_LOW_MAX);
      const cellsTop = grid.getBoundingClientRect().top + grid.clientTop + Math.round(HEADER_H * zoom);
      setLowHidesCells(lowTop - cellsTop < LOW_DOCK_ROOM);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(editor);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [phone, zoom]);
  const tall = dockTall ?? (focus?.kind === "chart" && (phone || lowHidesCells));
  const [dragH, setDragH] = useState<number | null>(null);
  const dockDrag = useRef<{ id: number; startY: number; startH: number; max: number; room: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const startDockDrag = (e: React.PointerEvent<HTMLElement>) => {
    justDragged.current = false;
    const dock = e.currentTarget.parentElement;
    const max = bodyRef.current?.clientHeight ?? 0;
    if (!dock || !max || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Where the panel ends (above the tabs row, or the editor's bottom): its top may come up to 40 px below the editor's top.
    const room = dock.offsetTop + dock.offsetHeight;
    dockDrag.current = { id: e.pointerId, startY: e.clientY, startH: dock.getBoundingClientRect().height, max, room, moved: false };
  };
  const moveDockDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = dockDrag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    setDragH(Math.max(80, Math.min(d.room - 40, d.startH - dy)));
  };
  const endDockDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = dockDrag.current;
    if (!d || d.id !== e.pointerId) return;
    dockDrag.current = null;
    setDragH(null);
    if (!d.moved || e.type === "pointercancel") return;
    // The click that follows a drag doesn't toggle.
    justDragged.current = true;
    const h = d.startH - (e.clientY - d.startY);
    if (h < d.max * 0.22) return closePanel();
    setDockTall(Math.abs(h - d.max * DOCK_TALL) < Math.abs(h - Math.min(d.max * DOCK_LOW, DOCK_LOW_MAX)));
  };

  // The settings beside the grid or docked below it: Escape closes them and the keyboard goes back
  // to the cells. A field holding a draft takes its Escape first (it stops it); menus that open out
  // of the panel (elsewhere on the page, in the same React tree) keep theirs.
  const onPanelKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape" || e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
    e.stopPropagation();
    closePanel();
  };

  // F6 moves the keyboard between the parts of the editor, as in Excel: the cells, the charts on
  // the sheet, the open settings, the toolbar (Shift+F6 the other way round). Ctrl+F6 does the
  // same, for browsers that keep F6 for their address bar (Office on the web uses it too). A notice
  // with a button ("Als 1,234 lesen") is a part too while it shows, right after the cells it is
  // about: the grid keeps Tab for moving between cells, so this is how the keyboard gets to that
  // button (the notice says F6 gets there). So are the settings of a smart table just made, while
  // they show what became its header with the buttons to change that (TablePanel says F6 gets
  // there too). The charts come next, so a chart already on the sheet (from a template, or
  // inserted before) is reached as easily as a new one: Enter opens its settings, Tab goes on to
  // its bar and the next chart.
  const cycleParts = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "F6" || e.altKey || !e.currentTarget.contains(e.target as Node)) return;
    const editor = e.currentTarget;
    const toolbar = editor.querySelector<HTMLElement>("[data-sheet-toolbar]");
    const settings = editor.querySelector<HTMLElement>("[data-sheet-panel]");
    // The card showing now, not one still fading out.
    const shown = currentSheetNotice(store);
    const notice = shown?.action ? editor.querySelector<HTMLElement>(`[data-sheet-notice-id="${shown.id}"]`) : null;
    const freshTable = !!settings?.querySelector("[data-table-fresh]");
    // The charts on the sheet on screen (ChartLayer shows only those), each with its bar.
    const charts = [...editor.querySelectorAll<HTMLElement>("[data-chart-card]")];
    const at = document.activeElement;
    const parts = [
      "grid",
      ...(notice ? ["notice"] : []),
      ...(settings && freshTable ? ["panel"] : []),
      ...(charts.length ? ["charts"] : []),
      ...(settings && !freshTable ? ["panel"] : []),
      ...(toolbar ? ["toolbar"] : []),
    ];
    // (A chart and its bar lie inside the grid: they count as the charts.)
    const here = notice?.contains(at)
      ? "notice"
      : settings?.contains(at)
        ? "panel"
        : toolbar?.contains(at)
          ? "toolbar"
          : at?.closest("[data-chart-card]")
            ? "charts"
            : "grid";
    const next = parts[(parts.indexOf(here) + (e.shiftKey ? parts.length - 1 : 1)) % parts.length];
    e.preventDefault();
    e.stopPropagation();
    if (next === "toolbar") toolbar?.querySelector<HTMLElement>('button[tabindex="0"]')?.focus();
    else if (next === "notice") notice?.querySelector<HTMLElement>("[data-sheet-notice-action]")?.focus();
    // Selected, its frame showing where the keyboard is, and scrolled into view like a chart just
    // inserted (the cells come back as they were when the keyboard leaves it again).
    else if (next === "charts") chartByKeys(store, chartForKeys(store, charts));
    else if (next === "panel" && settings) firstSetting(settings)?.focus();
    else focusSheetGrid();
  };

  const panel: ReactNode = focus ? (
    focus.kind === "chart" ? (
      <ChartPanel key={`chart:${focus.id}`} store={store} chartId={focus.id} onClose={closePanel} dock={wide ? undefined : tall ? "tall" : "low"} />
    ) : (
      <TablePanel key={`table:${focus.id}`} store={store} tableId={focus.id} onClose={closePanel} />
    )
  ) : null;

  // A new spreadsheet starts with the templates (until one is picked, it's dismissed or something is typed).
  // Only one that was empty when it opened: a spreadsheet emptied later (Ctrl+A, Entf) stays an
  // empty sheet with the keyboard in it, so Ctrl+Z still brings everything back. Content that came
  // some other way ("arrived": work kept on this device put back, a partner's save) ends them for
  // good too.
  const blank = useSheet(store, (s) => isBlankWorkbook(s.workbook));
  const [startedBlank] = useState(() => isBlankWorkbook(start.workbook));
  const [dismissed, setDismissed] = useState<boolean | "arrived">(false);
  if (startedBlank && !blank && !dismissed) setDismissed("arrived");
  const showPicker = startedBlank && blank && !dismissed && !readOnly;
  // The templates gone that way while they had the keyboard (it fell back to the page with them):
  // with a keyboard at hand it goes to the cells, as when a spreadsheet with content opens (touch
  // screens wait for a tap).
  useEffect(() => {
    if (dismissed !== "arrived" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const frame = requestAnimationFrame(() => {
      const at = document.activeElement;
      if (!at || at === document.body || at.closest("[data-sheet-picker]")) focusSheetGrid();
    });
    return () => cancelAnimationFrame(frame);
  }, [dismissed]);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  });
  const pickTemplate = useCallback(
    (wb: Workbook, template?: { id: string; title: string }) => {
      setDismissed(true);
      // The template is where the spreadsheet starts (like a new file from a template in Excel),
      // not an undo step: Ctrl+Z right after picking it doesn't empty the sheet again.
      store.reset(wb);
      if (template && !titleRef.current.trim()) {
        showTitle(template.title);
        saveTitle(template.title);
      }
      requestAnimationFrame(() => focusSheetGrid());
    },
    [store, showTitle, saveTitle],
  );
  const dismissPicker = useCallback(() => {
    setDismissed(true);
    requestAnimationFrame(() => focusSheetGrid());
  }, []);
  // Typing while the templates show starts blank with what was typed, in A1: the keyboard moves
  // into the cell's editor during the key press, so the letter (and the next ones) land there. The
  // templates go at once (flushSync): until they do, the cells behind them are inert and the cell's
  // editor couldn't take the keyboard.
  const typeIntoBlank = useCallback(() => {
    flushSync(() => setDismissed(true));
    focusCellEditor();
  }, []);

  // With a keyboard at hand, typing starts right away when the spreadsheet opens (the templates
  // take the keys themselves when they show). Touch screens wait for a tap.
  const [typeOnOpen] = useState(() => readOnly || !isBlankWorkbook(start.workbook));
  useEffect(() => {
    if (!typeOnOpen || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const frame = requestAnimationFrame(() => focusSheetGrid());
    return () => cancelAnimationFrame(frame);
  }, [typeOnOpen]);

  // Saving, printing, a file or a note: what is still being typed in a cell counts, as in Excel (a
  // formula with a mistake stays open with its message and is left out).
  const commitTyping = useCallback(() => {
    if (store.get().edit) store.commitEdit(null);
  }, [store]);

  // "In Notiz einfügen": the selected cells (one cell: the block of data around it).
  const [embed, setEmbed] = useState<SheetEmbedItem | null>(null);
  const addRangeToNote = useCallback(() => {
    commitTyping();
    const s = store.get();
    let area = activeArea(s.selection);
    const sheet = sheetById(s.workbook, s.sheetId);
    if (sheet && area.r0 === area.r1 && area.c0 === area.c1) area = currentRegion(sheet, area.r0, area.c0);
    setEmbed({ kind: "range", sheetId: s.sheetId, area });
  }, [store, commitTyping]);

  // The grid's parts from charts and smart tables.
  const { decorate, menu } = useTableDecor(store);
  const overlay = useCallback((geom: GridGeometry) => <ChartLayer store={store} geom={geom} />, [store]);
  const contextMenu = useCallback((close: () => void) => <CellMenuItems store={store} close={close} onAddToNote={addRangeToNote} />, [store, addRangeToNote]);

  // Files ----------------------------------------------------------------------------------------

  const fileName = fileNameOf(title) || fileNameOf(t.untitled);
  const exportXlsxFile = async () => {
    commitTyping();
    showSheetNotice(store, t.exporting, "busy");
    try {
      const { exportXlsx } = await import("@/sheet/io/xlsx");
      const s = store.get();
      download(`${fileName}.xlsx`, await exportXlsx(s.workbook, s.calc, s.locale), XLSX_MIME);
      showSheetNotice(store, t.exported, "done");
    } catch (e) {
      console.error("sheet: xlsx export failed", e);
      showSheetNotice(store, t.exportFailed, "error");
    }
  };
  const exportCsvFile = () => {
    commitTyping();
    try {
      const s = store.get();
      const sheet = sheetById(s.workbook, s.sheetId);
      const name = s.workbook.sheets.length > 1 && sheet ? fileNameOf(`${fileName} – ${sheet.name}`) : fileName;
      download(`${name}.csv`, sheetToCsv(s.workbook, s.calc, s.sheetId, s.locale), "text/csv;charset=utf-8");
      showSheetNotice(store, t.exported, "done");
    } catch (e) {
      console.error("sheet: csv export failed", e);
      showSheetNotice(store, t.exportFailed, "error");
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  // A file dragged over the editor: a hint says what dropping it does (dragover keeps coming while
  // it is over the editor; the hint goes when it stops: the file left, or the drag was cancelled).
  const [dropping, setDropping] = useState(false);
  const dropTimer = useRef(0);
  const problemText = (r: { error: ReadProblem; bytes?: number }) => {
    const p = r.error;
    if (p === "sheetTooBig") return t.importTooBigSheet(r.bytes ?? 0);
    if (p === "noRoom") return t.importNoRoom(r.bytes ?? 0);
    return p === "tooBig" ? t.importTooBig : p === "oldXls" ? t.importOldXls : p === "empty" ? t.importEmpty : t.importFailed;
  };
  const importFile = async (file: File) => {
    if (readOnly) return;
    const busy = showSheetNotice(store, t.reading, "busy");
    try {
      // "Deine Datei wird gelesen…" shows first: measuring a big spreadsheet takes a moment.
      await afterPaint();
      // Only the sheets that still fit are read (the rest are named as not brought over), and a
      // file too big to save with what is here already is refused while it is read.
      const open = store.get();
      const openBytes = importedBytes(open.workbook, open.calc, locale);
      const r = await readSheetFile(file, locale, { sheetRoom: sheetRoom(open.workbook), maxBytes: MAX_SHEET_BYTES, openBytes });
      if ("error" in r) {
        // The reader's own words when it knows more (a password, a LibreOffice file, too much text,
        // took too long, no room for another sheet).
        showSheetNotice(store, r.message ?? problemText(r), "error");
        return;
      }
      const ids = r.workbook.sheets.map((s) => s.id);
      // Too big to save with the file in it (the reader only refused what is too big for sure):
      // nothing changes. Measured exactly, unless the sizes measured already say it fits. It can go
      // into a spreadsheet of its own, unless it is too big for that as well (measured as the
      // importer would).
      const before = store.get();
      const next = appendWorkbook(before.workbook, r.workbook, locale);
      if (before.workbook !== open.workbook || !appendFits(open.workbook, openBytes, r.workbook, r.bytes, next)) {
        const bytes = importedBytes(next, before.calc, locale);
        if (bytes > MAX_SHEET_BYTES) {
          const alone = sheetPageContent(r.workbook, locale).bytes;
          showSheetNotice(store, alone > MAX_SHEET_BYTES ? t.importTooBigSheet(alone) : t.importNoRoom(bytes), "error");
          return;
        }
      }
      setDismissed(true);
      store.apply(t.importLabel, (wb) => (wb === before.workbook ? next : appendWorkbook(wb, r.workbook, locale)));
      if (!ids.some((id) => sheetById(store.get().workbook, id))) return;
      store.setSheet(ids[0]);
      // A CSV comes without column widths: columns with longer content get the room they need.
      if (r.kind === "csv") {
        const s = store.get();
        const widths = csvColumnWidths(s.workbook, s.calc, ids[0], s.locale);
        if (widths.length) {
          store.apply(t.importLabel, (wb) => {
            let out = wb;
            for (const [c, w] of widths) out = setColWidths(out, ids[0], [c], w);
            return out;
          });
        }
      }
      const parts = [t.imported(ids.length)];
      if (r.cutRows) parts.push(t.importCut(r.cutRows.toLocaleString(locale === "de" ? "de-DE" : "en-US")));
      if (r.skipped.length) parts.push(t.importSkipped(r.skipped.join(", ")));
      // Something left behind is worth a closer look than a plain "done".
      showSheetNotice(store, parts.join(" "), parts.length > 1 ? "info" : "done");
      requestAnimationFrame(() => focusSheetGrid());
    } catch (e) {
      console.error("sheet: import failed", e);
      showSheetNotice(store, t.importFailed, "error");
    } finally {
      // "Deine Datei wird gelesen…" never stays behind: the result has replaced it, or nothing came
      // of the file (the spreadsheet turned read-only meanwhile).
      hideSheetNotice(store, busy);
    }
  };

  const printNow = async () => {
    commitTyping();
    const s = store.get();
    const sheet = sheetById(s.workbook, s.sheetId);
    const ok = await printSheet({
      wb: s.workbook,
      calc: s.calc,
      sheetId: s.sheetId,
      title: title.trim() || t.untitled,
      subtitle: s.workbook.sheets.length > 1 && sheet ? sheet.name : "",
      locale,
      isRowHidden: (row) => store.isRowHidden(s.sheetId, row),
    });
    if (!ok) showSheetNotice(store, t.printEmpty);
  };

  // Ctrl/⌘+S saves now (a habit from Excel; the browser's "save page" isn't wanted here), Ctrl/⌘+P prints the sheet.
  const keys = useRef({ flush: save.flush, print: printNow });
  useEffect(() => {
    keys.current = { flush: save.flush, print: printNow };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        commitTyping();
        void keys.current.flush();
      } else if (k === "p") {
        e.preventDefault();
        void keys.current.print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commitTyping]);

  const pageMenu = (close: () => void) => (
    <>
      <MenuItem icon={<FileSpreadsheet />} onSelect={() => (close(), void exportXlsxFile())}>
        {t.exportXlsx}
      </MenuItem>
      <MenuItem icon={<FileDown />} onSelect={() => (close(), exportCsvFile())}>
        {t.exportCsv}
      </MenuItem>
      {!readOnly && (
        <MenuItem icon={<FileUp />} onSelect={() => (close(), fileRef.current?.click())}>
          {t.importFile}
        </MenuItem>
      )}
      <MenuItem icon={<Printer />} shortcut={`${modKey}P`} onSelect={() => (close(), void printNow())}>
        {t.print}
      </MenuItem>
      <MenuItem icon={<NotebookPen />} onSelect={() => (close(), addRangeToNote())}>
        {t.addToNote}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<Keyboard />} shortcut={`${modKey}/`} onSelect={() => (close(), showShortcuts())}>
        {shortcutsLabel}
      </MenuItem>
      <MenuSeparator />
    </>
  );

  // The work can't be saved here (no access any more, or the save was refused as it is): kept as a
  // spreadsheet of your own, as it is on screen. This page's draft goes then: the copy has the work.
  const copyOf = useSaveAsCopy();
  const [copying, setCopying] = useState(false);
  const saveAsCopy = async () => {
    // (A formula with a mistake still in its cell, which now says what is wrong: no copy yet.)
    if (store.get().edit && !store.commitEdit(null)) return;
    const s = store.get();
    const { content, plain } = storedContent(s.workbook, s.calc, s.locale);
    setCopying(true);
    try {
      await copyOf({ title, content, plain_text: plain, beside: pages.find((p) => p.id === page.id) ?? page, made: () => letGoOf(page.id) });
    } finally {
      setCopying(false);
    }
  };
  // A copy just made that way (here, or from work left on the device: DeniedDrafts) says what it is,
  // and so does one made with my version of a sheet (saveOwnVersion).
  useEffect(() => {
    if (!takeJustCopied(page.id)) return;
    const sheet = takeOwnVersion(page.id);
    showSheetNotice(store, sheet === undefined ? t.savedAsCopy : t.savedOwnVersion(sheet), "done");
  }, [page.id, store, t]);

  // Too big to save with the conflict copy that holds my version of a sheet (both sides moved its
  // rows, collab.ts): my version kept as a spreadsheet of my own (ownVersion, with its charts and
  // smart tables), and the copy goes from this one, which is then saved with the other version as
  // its editor closes. (Not letGoOf: this page's work goes on being saved.) Only while nothing ties
  // the copy to other sheets (copyTies): deleting it would break what reads it. The copy stays when
  // it was changed while the new spreadsheet was being made (that change isn't in the new one), or
  // when something came to read it meanwhile.
  const tc = useMessages(sheetChromeText);
  const saveOwnVersion = async (copyId: string) => {
    if (store.get().edit && !store.commitEdit(null)) return;
    const then = store.get().workbook;
    if (tiedCopy(copyTies(then, copyId))) return;
    const own = ownVersion(then, copyId, locale);
    if (!own) return;
    const { content, plain } = storedContent(own, createCalc(own, { locale }), locale);
    setCopying(true);
    try {
      const made = await copyOf({
        title,
        content,
        plain_text: plain,
        beside: pages.find((p) => p.id === page.id) ?? page,
        made: () => {
          const now = store.get().workbook;
          if (sameOwnVersion(then, now, copyId) && !tiedCopy(copyTies(now, copyId))) store.apply(tc.steps.deleteSheet, (wb) => deleteSheet(wb, copyId));
        },
      });
      if (made) markOwnVersion(made.id, own.sheets[0].name);
    } finally {
      setCopying(false);
    }
  };
  // While it is too big to save, the workbook tells which words and button fit (read only then, so
  // typing doesn't draw the editor again): a copy this editor's merge made with my version is
  // offered as my own spreadsheet, unless something ties it to other sheets (copyTies). What reads
  // it from elsewhere (what I wrote for my version) would break here: the words name it, to be
  // moved over first. What it reads elsewhere wouldn't be in the new spreadsheet: only the words to
  // move what's needed. Any other copy may hold someone else's only version (after a reload it
  // isn't known whose), so the words only say to move what's needed first.
  const bigWb = useSheet(store, (s) => (save.notice === "tooBig" && !readOnly ? s.workbook : null));
  const big = bigWb && tooBigBecause(bigWb.sheets, save.ownCopies);
  const ties = bigWb && big?.kind === "own" ? copyTies(bigWb, big.copy.id) : null;
  const readers = bigWb && ties && (ties.cells.length > 0 || ties.charts.length > 0) ? copyReaders(bigWb, ties) : null;
  const ownCopy = big?.kind === "own" && ties && !tiedCopy(ties) ? big.copy : undefined;

  const notice = start.unreadable
    ? t.unreadable
    : role === "viewer"
      ? t.viewOnly
      : save.notice === "denied"
        ? t.denied
        : save.notice === "tooBig"
          ? big?.kind === "own"
            ? readers
              ? t.tooBigReaders(big.original.name, big.copy.name, readers)
              : t.tooBigConflict(big.original.name, big.copy.name)
            : big?.kind === "copies"
              ? t.tooBigCopies
              : t.tooBig
          : save.notice === "rejected"
            ? t.rejected
            : save.notice === "large"
              ? t.nearlyFull(save.bytes)
              : null;
  // (Close to the size limit is a heads-up, not yet a problem.)
  const noticeIsProblem = start.unreadable || save.notice === "denied" || save.notice === "tooBig" || save.notice === "rejected";
  // Ways to keep the work when it can't be saved here.
  const noticeActions = !readOnly && (save.notice === "denied" || save.notice === "rejected" || (save.notice === "tooBig" && !!ownCopy));
  // What the bar is about (for screen readers: BannerVoice).
  const noticeKind = start.unreadable ? "unreadable" : role === "viewer" ? "viewOnly" : save.notice;

  return (
    <SheetStoreContext.Provider value={store}>
      {/* (The editor's notices say when saving fails and when it works again: the top bar's indicator doesn't say it too.) */}
      <PageSaidContext.Provider value={save.said}>
        <PageTopBar pageId={page.id} saveState={save.state} peers={save.peers} role={role} members={members} menu={pageMenu} />
      </PageSaidContext.Provider>
      {/* "Duplizieren" copies the spreadsheet as it is on screen (part of this module: nothing to load later). */}
      <OpenSheetCopy pageId={page.id} />
      <BannerVoice kind={noticeKind} text={notice} state={save.state} />
      {/* (Not a live region itself: BannerVoice says what is new in it. Its words are read where it is.) */}
      {notice && (
        <p
          data-sheet-save-notice=""
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line px-4 py-2 text-[13px]",
            noticeIsProblem ? "bg-danger/8 text-ink" : "bg-blob-soft/60 text-blob-ink",
          )}
        >
          {noticeIsProblem ? (
            <TriangleAlert className="size-3.5 shrink-0 text-danger" />
          ) : save.notice === "large" && role !== "viewer" ? (
            <Gauge className="size-3.5 shrink-0" />
          ) : (
            <Eye className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 basis-60">{notice}</span>
          {noticeActions && (
            // (On phones below the words, at the right.)
            <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
              {save.notice === "rejected" && (
                <Button size="sm" onClick={() => void exportXlsxFile()}>
                  {t.exportXlsx}
                </Button>
              )}
              {ownCopy ? (
                <Button size="sm" onClick={() => void saveOwnVersion(ownCopy.id)} loading={copying}>
                  {t.saveOwnVersion}
                </Button>
              ) : (
                <Button size="sm" onClick={() => void saveAsCopy()} loading={copying}>
                  {t.saveAsCopy}
                </Button>
              )}
            </span>
          )}
        </p>
      )}
      <div
        ref={bodyRef}
        className="relative flex min-h-0 flex-1 border-t border-line bg-paper"
        data-sheet-editor=""
        onKeyDown={showPicker ? undefined : cycleParts}
        // An Excel or CSV file dropped on the spreadsheet comes in as new sheets (anything else, a
        // picture say, is left to Blob's own drop handling and its hint, src/components/notes/FileDrop.tsx).
        onDragOver={(e) => {
          if (!readOnly && e.dataTransfer.types.includes("Files") && mightBeSheet(e.dataTransfer)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropping(true);
            window.clearTimeout(dropTimer.current);
            dropTimer.current = window.setTimeout(() => setDropping(false), 250);
          }
        }}
        onDrop={(e) => {
          window.clearTimeout(dropTimer.current);
          setDropping(false);
          const file = Array.from(e.dataTransfer.files).find(isSheetFile);
          if (readOnly || !file) return;
          e.preventDefault();
          void importFile(file);
        }}
      >
        <section aria-label={t.editor} aria-roledescription={t.kind} className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-3 px-4 max-sm:h-11 max-sm:px-3">
            <input
              value={title}
              readOnly={readOnly}
              onChange={(e) => onTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  // While the templates show, the keyboard goes to their first choice ("Leere
                  // Tabelle", where typing starts a blank sheet): the cells behind them can't take it.
                  if (showPicker) bodyRef.current?.querySelector<HTMLElement>("[data-sheet-picker] [data-pick]")?.focus();
                  else focusSheetGrid();
                }
              }}
              maxLength={200}
              placeholder={t.untitled}
              aria-label={t.titleLabel}
              title={title || undefined}
              spellCheck
              // The placeholder (the name it gets) readable at 4.5:1 and more, even at a phone's 18 px.
              className="min-w-0 flex-1 truncate bg-transparent font-display text-[20px] font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] max-sm:text-[18px]"
            />
            <AnimatePresence>
              {save.writer && (
                <motion.span
                  key="writer"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="shrink-0 rounded-full bg-raised px-2.5 py-1 text-[12px] text-ink-2 shadow-card"
                >
                  {t.someoneChanged(save.writer)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* Two cards with a little room around them, like the rest of Blob; the grid below runs edge
                to edge. Only a little at the sides: on laptops every pixel of the toolbar counts
                (the words on "Als Tabelle" and "Diagramm", the tools beside them).
                Viewers keep the toolbar too: finding, the function list (it leaves out what changes cells).
                While the templates cover them, these, the grid and the row below are inert: Tab and
                Shift+Tab never go behind the templates, nor do keys change cells nobody can see. */}
            <div inert={showPicker} className="flex shrink-0 flex-col gap-1.5 px-1.5 pb-2 max-sm:gap-1 max-sm:px-2 max-sm:pb-1.5">
              <Toolbar store={store} />
              <FormulaBar store={store} />
            </div>
            {/* Its own stacking context: the grid's sticky headers stay under the templates and panels. */}
            <div inert={showPicker} className="relative isolate min-h-0 flex-1 border-t border-line">
              <div className="absolute inset-0">
                <Grid store={store} decorate={decorate} overlay={overlay} contextMenu={contextMenu} />
              </div>
            </div>
            {/* One row, also on phones: the tabs keep room for their list button, + and one tab; the
                status bar gets what its figures need of the rest. Settings docked at the bottom end
                above this row (--sheet-foot), so Summe and Mittelwert stay in sight. */}
            <div ref={footRef} inert={showPicker} className="flex shrink-0 items-stretch border-t border-line bg-surface">
              <div className="min-w-[9rem] flex-1">
                <SheetTabs store={store} />
              </div>
              {/* The status bar measures its room and drops whole figures that don't fit. */}
              <div className="flex min-w-0 justify-end">
                <StatusBar store={store} />
              </div>
            </div>

            {showPicker && (
              <div data-sheet-picker="" className="absolute inset-0 z-30 bg-paper">
                <TemplatePicker onPick={pickTemplate} onDismiss={dismissPicker} onType={typeIntoBlank} autoFocus />
              </div>
            )}
            <SheetNotices store={store} />
          </div>
        </section>

        {wide && panel && (
          <aside
            data-sheet-panel=""
            style={{ width: PANEL_WIDTH }}
            className="flex shrink-0 flex-col border-l border-line bg-surface"
            aria-label={focus?.kind === "chart" ? t.chartSettings : t.tableSettings}
            onKeyDown={onPanelKey}
          >
            {panel}
          </aside>
        )}

        <AnimatePresence>
          {dropping && (
            <motion.div
              key="drop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              role="status"
              className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-paper/55 p-6 backdrop-blur-[2px]"
            >
              <div className="flex max-w-[340px] flex-col items-center rounded-2xl border-2 border-dashed border-blob/60 bg-raised px-8 py-7 text-center shadow-pop">
                <span className="grid size-11 place-items-center rounded-xl bg-blob-soft text-blob-ink">
                  <FileSpreadsheet className="size-5" />
                </span>
                <span className="mt-3 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{t.dropHere}</span>
                <span className="mt-1 text-[13px] text-ink-3">{t.dropHint}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phones and tablets held upright: the settings over the lower part of the editor, not
            modal, so the chart above changes as you go and cells can still be picked for its data. */}
        <AnimatePresence>
          {!wide && panel && (
            <motion.div
              key="panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              role="region"
              // Low or tall: in the low dock a chart shows on the grid above it (ChartLayer), not in its settings.
              data-sheet-dock={tall ? "tall" : "low"}
              data-sheet-panel=""
              aria-label={focus?.kind === "chart" ? t.chartSettings : t.tableSettings}
              onKeyDown={onPanelKey}
              ref={dockTop}
              style={dragH !== null ? { height: dragH } : undefined}
              className={cn(
                "absolute inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface shadow-[0_-10px_30px_-12px_rgb(28_27_24/0.28)]",
                // Phones: over the tabs and status bar, to the screen's bottom edge. Larger: above them.
                phone ? "bottom-0 pb-[env(safe-area-inset-bottom)]" : "bottom-[var(--sheet-foot,0px)] max-h-[calc(100%_-_var(--sheet-foot,0px))]",
                dragH === null && "transition-[height] duration-200 ease-out",
                dragH === null && (tall ? "h-[88%]" : "h-[min(58%,600px)]"),
              )}
            >
              <button
                type="button"
                aria-label={tall ? t.dockSmaller : t.dockBigger}
                aria-expanded={tall}
                title={tall ? t.dockSmaller : t.dockBigger}
                onClick={() => {
                  if (justDragged.current) justDragged.current = false;
                  else setDockTall(!tall);
                }}
                onPointerDown={startDockDrag}
                onPointerMove={moveDockDrag}
                onPointerUp={endDockDrag}
                onPointerCancel={endDockDrag}
                // A finger gets 40 × 96 px to tap or drag; the bar it shows stays small.
                className="mx-auto flex h-5 w-16 shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blob [@media(hover:none)]:h-10 [@media(hover:none)]:w-24"
              >
                <span aria-hidden className="h-1 w-10 rounded-full bg-line-2" />
              </button>
              <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {menu}

      {embed && <AddToNoteDialog open onClose={() => setEmbed(null)} pageId={page.id} item={embed} />}

      <input
        ref={fileRef}
        type="file"
        accept={SHEET_FILE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </SheetStoreContext.Provider>
  );
}

/**
 * The entries the editor adds to the cells' context menu: smart table ones (make one, or the
 * table's own when inside one), a chart of the selection, and the selection into a note.
 */
function CellMenuItems({ store, close, onAddToNote }: { store: SheetStore; close: () => void; onAddToNote: () => void }) {
  const t = useMessages(sheetText);
  const inTable = useSheet(store, (s) => !!tableAt(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col));
  return (
    <>
      <TableMenuItems store={store} close={close} separator={false} />
      {!inTable && (
        <MenuItem
          icon={<ChartScatter />}
          onSelect={() => {
            close();
            makeChart(store);
          }}
        >
          {t.insertChart}
        </MenuItem>
      )}
      <MenuItem
        icon={<NotebookPen />}
        onSelect={() => {
          close();
          onAddToNote();
        }}
      >
        {t.addToNote}
      </MenuItem>
    </>
  );
}
