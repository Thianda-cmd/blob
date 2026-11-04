"use client";

// A smart table's settings: name, colour, banded rows, totals row and each column's total, its
// filters; "Diagramm aus Tabelle" and "In Notiz einfügen" at the bottom; at the end of the list,
// with what they do spelled out, convert back to plain cells and delete.
//
// CONTRACT: <TablePanel store tableId onClose /> is placed by SheetEditor.
//
// Side panel on wide screens, bottom sheet on phones (SheetEditor decides); everything here fits
// both. Each change is one undo step. Right after a table is made, a card at the top says what
// became the header and offers the other choice with one tap.

import { ChartScatter, CircleCheck, Filter, Info, NotebookPen, TableProperties, Trash2, Undo2, Ungroup, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import type { Locale } from "@/i18n/config";
import { sheetText } from "@/i18n/messages/sheet";
import { sheetTableText, type SheetTableText } from "@/i18n/messages/sheetTable";
import { cn } from "@/lib/utils";
import { areaName, cellKey } from "@/sheet/a1";
import { sheetById } from "@/sheet/ops";
import { columnKind, columnNames, dataRows, filteredRows, TABLE_STYLES, tableNameProblem, TOTAL_FNS, totalOfCell } from "@/sheet/table/model";
import type { TableSpec, TableStyle, TotalFn } from "@/sheet/types";
import { AddToNoteDialog } from "../embed/AddToNote";
import { focusSheetGrid } from "../grid/Grid";
import { currentSheetNotice } from "../notice";
import { useSheet, type SheetStore } from "../store";
import {
  changeTableLook,
  chartFromTable,
  clearAllTableFilters,
  convertTableToRange,
  deleteTableWithCells,
  filterTableColumn,
  openTablePanel,
  setTableColumnTotal,
  setTableTotals,
  switchTableHeader,
  undoMakeTable,
} from "./actions";
import { describeFilter } from "./describe";
import { tableLook } from "./look";
import { setFreshTable, useFreshTable, type FreshTable } from "./notice";
import { ActionButton, Field, Group, Note, Select, TextField, Toggle } from "./parts";

/**
 * How long after the card about a table just made appears its words go into its status region
 * (ms): a region that comes with its words already in it isn't reliably read out.
 */
const SAY_AFTER = 150;

/** The table whose settings are opening with the keyboard going there too (see openTableSettings), per editor. */
const keysFor = new WeakMap<SheetStore, string>();

/**
 * Open a table's settings from its menus: the cells' menu ("Intelligente Tabelle bearbeiten") or a
 * column's menu. Chosen with the keyboard (`keys`: Enter or Space), the keyboard goes there too, to
 * their title, as when a chart's settings open from the chart: a screen reader reads the table's
 * name, Tab goes on through the settings, and Escape closes them and gives the keyboard back to
 * the cells. (A table just made with Ctrl+T keeps the keyboard in the cells: its card says F6 gets
 * there.)
 */
export function openTableSettings(store: SheetStore, tableId: string, keys: boolean) {
  const open = store.get().focus;
  if (open?.kind === "table" && open.id === tableId) {
    if (keys) document.querySelector<HTMLElement>(`[data-table-panel="${CSS.escape(tableId)}"] [data-table-panel-title]`)?.focus({ preventScroll: true });
    return;
  }
  if (keys) keysFor.set(store, tableId);
  openTablePanel(store, tableId);
  // (A table that is gone opens nothing.)
  if (store.get().focus?.id !== tableId) keysFor.delete(store);
}

export function TablePanel({ store, tableId, onClose }: { store: SheetStore; tableId: string; onClose: () => void }): ReactNode {
  const table = useSheet(store, (s) => s.workbook.tables.find((t) => t.id === tableId));
  const locale = useSheet(store, (s) => s.locale);
  const t = sheetTableText[locale];
  // Opened from a menu with the keyboard (openTableSettings): it goes to the title as they open.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (keysFor.get(store) !== tableId) return;
    keysFor.delete(store);
    title.current?.focus({ preventScroll: true });
  }, [store, tableId]);
  if (!table) {
    return (
      <div data-table-panel="" className="flex h-full min-h-0 flex-col bg-surface">
        <PanelHeader title={t.table} t={t} onClose={onClose} titleRef={title} />
        <div className="p-4">
          <Note icon={<Info />}>{t.gone}</Note>
        </div>
      </div>
    );
  }
  return <PanelBody key={table.id} store={store} table={table} locale={locale} t={t} onClose={onClose} titleRef={title} />;
}

function PanelHeader({ title, t, onClose, titleRef }: { title: string; t: SheetTableText; onClose: () => void; titleRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
      <TableProperties aria-hidden className="size-4 shrink-0 text-ink-3" />
      {/* Where the keyboard lands when the settings open from a menu with the keyboard (openTableSettings). */}
      <h2
        ref={titleRef}
        tabIndex={-1}
        data-table-panel-title=""
        className="-mx-1 min-w-0 flex-1 truncate rounded-md px-1 font-display text-[15px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-blob"
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        title={t.close}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function PanelBody({
  store,
  table,
  locale,
  t,
  onClose,
  titleRef,
}: {
  store: SheetStore;
  table: TableSpec;
  locale: Locale;
  t: SheetTableText;
  onClose: () => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const wb = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const pageId = useSheet(store, (s) => s.pageId);
  const fresh = useFreshTable(store, table.id);
  // The card about a table just made speaks once to screen readers, while the keyboard stays in
  // the cells: its words go into its status region a moment after the region came with the card.
  // From the cells, F6 gets to the card's first button (SheetEditor puts these settings right after
  // the cells while the card shows), and the words say so, unless the keyboard is elsewhere or a
  // notice's button comes first.
  const [said, setSaid] = useState<{ fresh: FreshTable; f6: boolean } | null>(null);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => {
      const f6 = !!document.activeElement?.closest("[data-sheet-grid]") && !currentSheetNotice(store)?.action;
      setSaid({ fresh, f6 });
    }, SAY_AFTER);
    return () => clearTimeout(timer);
  }, [fresh, store]);
  const nameId = useId();
  const unmakeHintId = useId();
  const removeConfirmId = useId();
  const [noteOpen, setNoteOpen] = useState(false);
  // Deleting asks first. The question takes the keyboard on its safe choice ("Abbrechen"), so a
  // screen reader reads it out; cancelling (or Escape) gives the keyboard back to the delete button.
  const [confirmDelete, setConfirmDelete] = useState<"no" | "ask" | "cancelled">("no");

  const sheet = sheetById(wb, table.sheetId);
  const names = useMemo(() => columnNames(wb, calc, table, locale), [wb, calc, table, locale]);
  const d = dataRows(table);
  const dataCount = Math.max(0, d.r1 - d.r0 + 1);
  // Rows you see: without the ones hidden by hand or by a filter (this table's or another's on the sheet).
  const shown = useMemo(() => {
    const s = sheetById(wb, table.sheetId);
    const filtering = wb.tables.some((x) => x.sheetId === table.sheetId && Object.keys(x.filters).length > 0);
    const byFilter = filtering ? filteredRows(wb, calc, table.sheetId, locale) : null;
    let n = 0;
    for (let r = table.area.r0 + 1; r <= (table.totals ? table.area.r1 - 1 : table.area.r1); r++) if (!byFilter?.has(r) && !s?.rows[String(r)]?.hidden) n++;
    return n;
  }, [wb, calc, table, locale]);
  const filters = Object.entries(table.filters).filter(([id]) => table.columns.some((c) => c.id === id));
  const sortIndex = table.sort ? table.columns.findIndex((c) => c.id === table.sort!.column) : -1;
  const headerText = fresh?.header === "found" ? t.headerFound(names.slice(0, 4), Math.max(0, names.length - 4)) : t.headerAdded;
  const switchLabel = fresh?.header === "found" ? t.headerIsData : t.headerIsHeader;
  // The card's buttons take it away (or put a new card in its place): the keyboard on one of them
  // doesn't drop to the top of the page. After switching the header choice it goes to the new
  // card's same button (to switch back); after undoing or dismissing, back to the cells.
  const keepKeys = (e: MouseEvent<HTMLButtonElement>, run: () => void, then: "switch" | "cells") => {
    const had = e.currentTarget === document.activeElement;
    run();
    if (!had) return;
    if (then === "cells") focusSheetGrid();
    else requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-table-fresh] button")?.focus());
  };

  return (
    // The panel sits in the editor's side panel or dock, which carry its name ("Einstellungen der intelligenten Tabelle").
    <div data-table-panel={table.id} className="flex h-full min-h-0 flex-col bg-surface">
      <PanelHeader title={table.name} t={t} onClose={onClose} titleRef={titleRef} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {fresh && !readOnly && (
          <div data-table-fresh="" className="border-b border-line bg-blob-soft/70 px-4 py-3">
            {/* For screen readers: the card's words (shown below for the eyes), once. */}
            <p role="status" className="sr-only">
              {said?.fresh === fresh ? `${t.made(table.name)}. ${headerText}${said.f6 ? ` ${sheetText[locale].noticeActionKey(switchLabel)}` : ""}` : ""}
            </p>
            <div className="flex items-start gap-2.5">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-blob-ink" />
              <div className="min-w-0 flex-1 space-y-1">
                <p aria-hidden className="text-[13px] font-medium text-ink">
                  {t.made(table.name)}
                </p>
                <p aria-hidden className="text-[12px] leading-snug text-ink-2">
                  {headerText}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <SmallButton onClick={(e) => keepKeys(e, () => switchTableHeader(store, table.id), "switch")}>{switchLabel}</SmallButton>
                  <SmallButton icon={<Undo2 />} onClick={(e) => keepKeys(e, () => undoMakeTable(store, table.id), "cells")}>
                    {t.undoMake}
                  </SmallButton>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => keepKeys(e, () => setFreshTable(store, null), "cells")}
                aria-label={t.dismiss}
                title={t.dismiss}
                className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {readOnly && (
          <div className="px-4 pt-4">
            <Note icon={<Info />}>{t.readOnly}</Note>
          </div>
        )}

        <Group title={t.table}>
          <Field label={t.name} htmlFor={nameId} hint={t.nameHint}>
            <TextField
              id={nameId}
              value={table.name}
              disabled={readOnly}
              check={(v) => {
                const problem = tableNameProblem(wb, table.id, v);
                return problem ? t.nameErrors[problem] : null;
              }}
              onCommit={(v) => changeTableLook(store, table.id, { name: v })}
            />
          </Field>
          <p className="text-[12px] tabular-nums text-ink-2">{t.size(areaName(table.area), table.columns.length, dataCount)}</p>
        </Group>

        <Group title={t.look}>
          <div role="radiogroup" aria-label={t.color} className="grid grid-cols-6 gap-1 max-[340px]:grid-cols-3">
            {TABLE_STYLES.map((style) => (
              <StyleSwatch
                key={style}
                style={style}
                banded={table.banded}
                selected={table.style === style}
                label={t.styles[style]}
                disabled={readOnly}
                onSelect={() => changeTableLook(store, table.id, { style })}
              />
            ))}
          </div>
          <Toggle label={t.banded} checked={table.banded} disabled={readOnly} onChange={(banded) => changeTableLook(store, table.id, { banded })} />
        </Group>

        <Group title={t.totalsRow}>
          <Toggle label={t.totalsRow} hint={t.totalsHint} checked={table.totals} disabled={readOnly} onChange={(on) => setTableTotals(store, table.id, on)} />
          {table.totals && (
            <div className="space-y-1.5 pt-0.5">
              {table.columns.map((c, i) => {
                const col = table.area.c0 + i;
                const fn = totalOfCell(sheet?.cells[cellKey(table.area.r1, col)], col);
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2" title={names[i]}>
                      {names[i]}
                    </span>
                    <Select<TotalFn | "custom">
                      className="w-[11.5rem] shrink-0 max-[360px]:w-36"
                      label={`${t.total}: ${names[i]}`}
                      value={fn}
                      disabled={readOnly}
                      onChange={(v) => v !== "custom" && setTableColumnTotal(store, table.id, c.id, v)}
                      options={[
                        ...TOTAL_FNS.map((x) => ({ value: x as TotalFn | "custom", label: t.totalFns[x] })),
                        ...(fn === "custom" ? [{ value: "custom" as const, label: t.custom, disabled: true }] : []),
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Group>

        <Group
          title={t.filters}
          action={
            filters.length > 0 && !readOnly ? (
              <button
                type="button"
                onClick={() => clearAllTableFilters(store, table.id)}
                className="inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-blob-ink transition-colors hover:bg-blob-soft [@media(hover:none)]:h-9"
              >
                {t.clearAll}
              </button>
            ) : null
          }
        >
          {filters.length === 0 ? (
            <p className="text-[12.5px] leading-snug text-ink-2">{t.noFilters}</p>
          ) : (
            <ul className="space-y-1.5">
              {filters.map(([columnId, spec]) => {
                const i = table.columns.findIndex((c) => c.id === columnId);
                const kind = sheet ? columnKind(calc, sheet, table, i, locale) : "text";
                return (
                  <li key={columnId} className="flex items-center gap-2 rounded-lg border border-line bg-raised py-1.5 pl-2.5 pr-1">
                    <Filter aria-hidden className="size-3.5 shrink-0 text-blob-ink" />
                    <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                      <span className="font-medium text-ink">{names[i]}:</span> <span className="text-ink-2">{describeFilter(spec, kind, locale, t)}</span>
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => filterTableColumn(store, table.id, columnId, null)}
                        aria-label={`${t.clearFilter}: ${names[i]}`}
                        title={t.clearFilter}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {(filters.length > 0 || shown < dataCount) && <p className="text-[12px] text-ink-2">{t.shownRows(shown, dataCount)}</p>}
          {table.sort && sortIndex >= 0 && <p className="text-[12px] text-ink-2">{t.sortedBy(names[sortIndex], table.sort.dir)}</p>}
        </Group>

        {/* Seldom needed, so at the end of the list, each on its own row with its whole name and
            (converting) what it keeps and what goes. */}
        {!readOnly && (
          <Group title={t.actions}>
            <div className="space-y-1.5">
              <ActionButton
                icon={<Ungroup />}
                describedBy={unmakeHintId}
                onClick={() => {
                  convertTableToRange(store, table.id);
                  onClose();
                }}
              >
                {t.unmake}
              </ActionButton>
              <p id={unmakeHintId} className="text-[12px] leading-snug text-ink-2">
                {t.unmakeHint}
              </p>
            </div>
            {confirmDelete === "ask" ? (
              <div
                className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5"
                role="alertdialog"
                aria-label={t.remove}
                aria-describedby={removeConfirmId}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  // Escape answers the question (no), it doesn't close the whole panel.
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmDelete("cancelled");
                }}
              >
                <p id={removeConfirmId} className="text-[12.5px] leading-snug text-ink">
                  {t.removeConfirm}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton icon={<X />} autoFocus onClick={() => setConfirmDelete("cancelled")}>
                    {t.cancel}
                  </ActionButton>
                  <ActionButton
                    icon={<Trash2 />}
                    className="border-transparent bg-danger text-white shadow-none hover:bg-danger/90 hover:text-white"
                    onClick={() => {
                      deleteTableWithCells(store, table.id);
                      onClose();
                    }}
                  >
                    {t.removeYes}
                  </ActionButton>
                </div>
              </div>
            ) : (
              <ActionButton tone="danger" icon={<Trash2 />} autoFocus={confirmDelete === "cancelled"} onClick={() => setConfirmDelete("ask")}>
                {t.remove}
              </ActionButton>
            )}
          </Group>
        )}
      </div>

      {!readOnly && (
        <div className="shrink-0 space-y-2 border-t border-line bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <ActionButton tone="primary" icon={<ChartScatter />} hint={t.chartHint} onClick={() => chartFromTable(store, table.id)}>
            {t.chart}
          </ActionButton>
          {pageId && (
            <ActionButton icon={<NotebookPen />} onClick={() => setNoteOpen(true)}>
              {t.addToNote}
            </ActionButton>
          )}
        </div>
      )}
      {pageId && <AddToNoteDialog open={noteOpen} onClose={() => setNoteOpen(false)} pageId={pageId} item={{ kind: "table", tableId: table.id }} />}
    </div>
  );
}

function SmallButton({ onClick, icon, children }: { onClick: (e: MouseEvent<HTMLButtonElement>) => void; icon?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-raised px-2.5 text-[12px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink [@media(hover:none)]:h-9 [&_svg]:size-3.5"
    >
      {icon}
      {children}
    </button>
  );
}

/** A colour choice drawn as a tiny table: the coloured header and (with banding) the shaded rows. */
function StyleSwatch({ style, banded, selected, label, disabled, onSelect }: { style: TableStyle; banded: boolean; selected: boolean; label: string; disabled?: boolean; onSelect: () => void }) {
  const look = tableLook(style);
  // A stronger band than on the grid, so it shows at this size.
  const band = `color-mix(in oklab, var(--sheet-${style}) 16%, var(--raised))`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "grid place-items-center rounded-lg border-2 p-1 transition-[border,transform] active:scale-95 disabled:opacity-50 [@media(hover:none)]:p-1.5",
        selected ? "border-blob" : "border-transparent hover:border-line-2",
      )}
    >
      <span aria-hidden className="block w-full max-w-[46px] overflow-hidden rounded-[5px] border border-line bg-raised">
        <span className="flex h-[9px]" style={{ background: look.headerFill, boxShadow: `inset 0 -2px 0 ${look.ink}` }} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex h-[6px] border-t border-line/60" style={{ background: banded && i % 2 === 1 ? band : undefined }} />
        ))}
      </span>
    </button>
  );
}
