"use client";

// A spreadsheet page ("Tabelle"): the title, the toolbar and formula bar, the grid with its charts
// and smart tables, the sheet tabs and status bar, and the settings of the chart or table you're
// working on (beside the grid on wide screens, over the lower part of the editor on phones and
// tablets held upright). A new, empty spreadsheet starts with the lab templates. Saving, working together and
// the copy kept on this device are in useSheetSave.
//
// Viewers (and a spreadsheet that couldn't be read) see everything but can't change it.

import { ChartScatter, Eye, FileDown, FileSpreadsheet, FileUp, Keyboard, NotebookPen, Printer, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { download } from "@/components/notes/transfer";
import { isSheetFile } from "@/components/notes/useImporter";
import { PageTopBar } from "@/components/page/PageTopBar";
import { usePanes } from "@/components/shell/Panes";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { useIsMac, usePhone } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { panesText } from "@/i18n/messages/panes";
import { sheetText } from "@/i18n/messages/sheet";
import type { AccessRole, Member, Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isBlankWorkbook, isUnreadableWorkbook, normalizeWorkbook } from "@/sheet/doc";
import type { SheetEmbedItem } from "@/sheet/embed";
import { sheetToCsv } from "@/sheet/io/csv";
import { setColWidths, sheetById } from "@/sheet/ops";
import { currentRegion, tableAt } from "@/sheet/table/model";
import { DEFAULT_COL_W, type Workbook } from "@/sheet/types";
import { insertChart } from "./chart/actions";
import { ChartLayer } from "./chart/ChartLayer";
import { ChartPanel } from "./chart/ChartPanel";
import { FormulaBar } from "./chrome/FormulaBar";
import { SheetTabs } from "./chrome/SheetTabs";
import { StatusBar } from "./chrome/StatusBar";
import { Toolbar } from "./chrome/Toolbar";
import { AddToNoteDialog } from "./embed/AddToNote";
import { contentWidth } from "./grid/actions";
import { focusSheetGrid, Grid, type GridGeometry } from "./grid/Grid";
import { appendWorkbook, readSheetFile, SHEET_FILE_ACCEPT, type ReadProblem } from "./importFile";
import { printSheet } from "./print";
import { activeArea, createSheetStore, SheetStoreContext, useSheet, type SheetStore } from "./store";
import { TableMenuItems } from "./table/TableMenuItems";
import { TablePanel } from "./table/TablePanel";
import { useTableDecor } from "./table/useTableDecor";
import { PANEL_MIN_WIDTH, PANEL_WIDTH } from "./panelLayout";
import { TemplatePicker } from "./TemplatePicker";
import { useSheetSave } from "./useSheetSave";

/** The docked panel's two heights: part of the editor (at most DOCK_LOW_MAX px) or nearly all of it (keep in step with the classes below). */
const DOCK_LOW = 0.58;
const DOCK_LOW_MAX = 600;
const DOCK_TALL = 0.88;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** While a file is dragged, only its type is known: could it be an Excel or CSV file (no type: maybe)? */
const mightBeSheet = (data: DataTransfer) => {
  const files = Array.from(data.items).filter((item) => item.kind === "file");
  return files.length === 0 || files.some((item) => !item.type || /csv|tab-separated|excel|spreadsheet/.test(item.type));
};

/** A file name from the title: no characters file systems refuse. */
const fileNameOf = (title: string) =>
  title
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

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
    const next = value.slice(0, 200);
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

  // The chart or smart table whose settings are open.
  const focus = useSheet(store, (s) => s.focus);
  const closePanel = useCallback(() => {
    store.setFocus(null);
    focusSheetGrid();
  }, [store]);
  // The docked panel (narrow screens): about half the editor, or nearly all of it. Its handle
  // switches between the two with a tap, or is dragged (down to the bottom closes the panel). On
  // phones a chart's settings start tall: they show the chart themselves.
  const phone = usePhone();
  const [dockTall, setDockTall] = useState<boolean | null>(null);
  const tall = dockTall ?? (focus?.kind === "chart" && phone);
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

  const panel: ReactNode = focus ? (
    focus.kind === "chart" ? (
      <ChartPanel key={`chart:${focus.id}`} store={store} chartId={focus.id} onClose={closePanel} />
    ) : (
      <TablePanel key={`table:${focus.id}`} store={store} tableId={focus.id} onClose={closePanel} />
    )
  ) : null;

  // A new spreadsheet starts with the templates (until one is picked, it's dismissed or something is typed).
  const blank = useSheet(store, (s) => isBlankWorkbook(s.workbook));
  const [dismissed, setDismissed] = useState(false);
  const showPicker = blank && !dismissed && !readOnly;
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  });
  const pickTemplate = useCallback(
    (wb: Workbook, template?: { id: string; title: string }) => {
      setDismissed(true);
      store.apply(t.templateLabel, () => wb);
      if (template && !titleRef.current.trim()) {
        showTitle(template.title);
        saveTitle(template.title);
      }
      requestAnimationFrame(() => focusSheetGrid());
    },
    [store, t.templateLabel, showTitle, saveTitle],
  );
  const dismissPicker = useCallback(() => {
    setDismissed(true);
    requestAnimationFrame(() => focusSheetGrid());
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
    blob.say(t.exporting, { mood: "idle", ms: 2500 });
    try {
      const { exportXlsx } = await import("@/sheet/io/xlsx");
      const s = store.get();
      download(`${fileName}.xlsx`, await exportXlsx(s.workbook, s.calc, s.locale), XLSX_MIME);
      blob.say(t.exported, { mood: "happy" });
    } catch (e) {
      console.error("sheet: xlsx export failed", e);
      blob.say(t.exportFailed, { mood: "worried" });
    }
  };
  const exportCsvFile = () => {
    commitTyping();
    try {
      const s = store.get();
      const sheet = sheetById(s.workbook, s.sheetId);
      const name = s.workbook.sheets.length > 1 && sheet ? fileNameOf(`${fileName} – ${sheet.name}`) : fileName;
      download(`${name}.csv`, sheetToCsv(s.workbook, s.calc, s.sheetId, s.locale), "text/csv;charset=utf-8");
      blob.say(t.exported, { mood: "happy" });
    } catch (e) {
      console.error("sheet: csv export failed", e);
      blob.say(t.exportFailed, { mood: "worried" });
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  // A file dragged over the editor: a hint says what dropping it does (dragover keeps coming while
  // it is over the editor; the hint goes when it stops: the file left, or the drag was cancelled).
  const [dropping, setDropping] = useState(false);
  const dropTimer = useRef(0);
  const problemText = (p: ReadProblem) => (p === "tooBig" ? t.importTooBig : p === "oldXls" ? t.importOldXls : p === "empty" ? t.importEmpty : t.importFailed);
  const importFile = async (file: File) => {
    if (readOnly) return;
    blob.say(t.reading, { mood: "idle", ms: 3000 });
    const r = await readSheetFile(file, locale);
    if ("error" in r) {
      blob.say(problemText(r.error), { mood: "worried" });
      return;
    }
    const ids = r.workbook.sheets.map((s) => s.id);
    setDismissed(true);
    store.apply(t.importLabel, (wb) => appendWorkbook(wb, r.workbook, locale));
    if (!ids.some((id) => sheetById(store.get().workbook, id))) return;
    store.setSheet(ids[0]);
    // A CSV comes without column widths: columns with longer content get the room they need.
    if (r.kind === "csv") {
      const s = store.get();
      const sheet = sheetById(s.workbook, ids[0]);
      const cols = sheet ? Array.from({ length: Math.min(sheet.size.cols, 60) }, (_, i) => i) : [];
      const widths = cols.map((c) => [c, contentWidth(store, c)] as const).filter(([, w]) => w !== null && w > DEFAULT_COL_W);
      if (widths.length) {
        store.apply(t.importLabel, (wb) => {
          let out = wb;
          for (const [c, w] of widths) out = setColWidths(out, ids[0], [c], Math.min(w!, 360));
          return out;
        });
      }
    }
    const parts = [t.imported(ids.length)];
    if (r.cutRows) parts.push(t.importCut(r.cutRows.toLocaleString(locale === "de" ? "de-DE" : "en-US")));
    if (r.skipped.length) parts.push(t.importSkipped(r.skipped.join(", ")));
    blob.say(parts.join(" "), { mood: "happy", ms: r.skipped.length ? 9000 : 4000 });
    requestAnimationFrame(() => focusSheetGrid());
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
    if (!ok) blob.say(t.printEmpty, { mood: "thinking" });
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

  const notice = start.unreadable ? t.unreadable : role === "viewer" ? t.viewOnly : save.notice === "denied" ? t.denied : save.notice === "tooBig" ? t.tooBig : null;
  const noticeIsProblem = start.unreadable || save.notice !== null;

  return (
    <SheetStoreContext.Provider value={store}>
      <PageTopBar pageId={page.id} saveState={save.state} peers={save.peers} role={role} members={members} menu={pageMenu} />
      {notice && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 border-t border-line px-4 py-2 text-[13px]",
            noticeIsProblem ? "bg-danger/8 text-ink" : "bg-blob-soft/60 text-blob-ink",
          )}
        >
          {noticeIsProblem ? <TriangleAlert className="size-3.5 shrink-0 text-danger" /> : <Eye className="size-3.5 shrink-0" />}
          <span className="min-w-0">{notice}</span>
        </p>
      )}
      <div
        ref={bodyRef}
        className="relative flex min-h-0 flex-1 border-t border-line bg-paper"
        data-sheet-editor=""
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
                  focusSheetGrid();
                }
              }}
              maxLength={200}
              placeholder={t.untitled}
              aria-label={t.titleLabel}
              title={title || undefined}
              spellCheck
              className="min-w-0 flex-1 truncate bg-transparent font-display text-[20px] font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-ink-3/55 max-sm:text-[18px]"
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
                to edge. Only a little at the sides: from about 1440 px the toolbar fits "Tabelle" and
                "Diagramm" with their words, and every pixel counts there.
                Viewers keep the toolbar too: finding, the function list (it leaves out what changes cells). */}
            <div className="flex shrink-0 flex-col gap-1.5 px-1.5 pb-2 max-sm:gap-1 max-sm:px-2 max-sm:pb-1.5">
              <Toolbar store={store} />
              <FormulaBar store={store} />
            </div>
            {/* Its own stacking context: the grid's sticky headers stay under the templates and panels. */}
            <div className="relative isolate min-h-0 flex-1 border-t border-line">
              <div className="absolute inset-0">
                <Grid store={store} decorate={decorate} overlay={overlay} contextMenu={contextMenu} />
              </div>
            </div>
            {/* One row, also on phones: the tabs keep room for their list button, + and one tab; the
                status bar gets what its figures need of the rest. Settings docked at the bottom end
                above this row (--sheet-foot), so Summe and Mittelwert stay in sight. */}
            <div ref={footRef} className="flex shrink-0 items-stretch border-t border-line bg-surface">
              <div className="min-w-[9rem] flex-1">
                <SheetTabs store={store} />
              </div>
              {/* The status bar measures its room and drops whole figures that don't fit. */}
              <div className="flex min-w-0 justify-end">
                <StatusBar store={store} />
              </div>
            </div>

            {showPicker && (
              <div className="absolute inset-0 z-30 bg-paper">
                <TemplatePicker onPick={pickTemplate} onDismiss={dismissPicker} autoFocus />
              </div>
            )}
          </div>
        </section>

        {wide && panel && (
          <aside style={{ width: PANEL_WIDTH }} className="flex shrink-0 flex-col border-l border-line bg-surface" aria-label={focus?.kind === "chart" ? t.chartSettings : t.tableSettings}>
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
              data-sheet-dock=""
              aria-label={focus?.kind === "chart" ? t.chartSettings : t.tableSettings}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  closePanel();
                }
              }}
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
                className="mx-auto flex h-5 w-16 shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blob [@media(hover:none)]:h-7 [@media(hover:none)]:w-20"
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
            if (!insertChart(store)) blob.say(t.noChart, { mood: "thinking" });
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
