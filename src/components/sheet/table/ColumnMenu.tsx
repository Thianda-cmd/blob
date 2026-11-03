"use client";

// The menu of one smart table column, opened from the button in its header cell (or Alt+↓):
// sort (worded for what the column holds: A→Z, smallest first, oldest first), filter by values
// (a checklist with counts and a search) or by a condition (Zahlenfilter / Datumsfilter /
// Textfilter), clear the filter, the column's total when the table has a totals row, and the way
// to the table's settings. A popover under the button; a bottom sheet on phones.

import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, Check, FunnelX, Settings2, Sigma } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet as BottomSheet } from "@/components/ui/Sheet";
import { usePhone } from "@/components/ui/useMediaQuery";
import type { Locale } from "@/i18n/config";
import { sheetTableText, type SheetTableText } from "@/i18n/messages/sheetTable";
import { cn } from "@/lib/utils";
import type { Calc } from "@/sheet/engine";
import { sheetById } from "@/sheet/ops";
import { columnAverage, columnKind, columnNames, columnValues, TOTAL_FNS, totalOfCell } from "@/sheet/table/model";
import { cellKey } from "@/sheet/a1";
import type { FilterSpec, TableSpec, TotalFn, Workbook } from "@/sheet/types";
import { focusSheetGrid } from "../grid/Grid";
import { useSheet, type SheetStore } from "../store";
import { filterTableColumn, openTablePanel, setTableColumnTotal, sortTableColumn } from "./actions";
import type { ColumnMenuRequest } from "./decor";
import { FilterCondition } from "./FilterCondition";
import { FilterValues } from "./FilterValues";
import { Select } from "./parts";

export function ColumnMenu({ store, request, onClose }: { store: SheetStore; request: ColumnMenuRequest; onClose: () => void }) {
  const table = useSheet(store, (s) => s.workbook.tables.find((t) => t.id === request.tableId));
  const wb = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const phone = usePhone();
  const t = sheetTableText[locale];
  const index = table ? table.columns.findIndex((c) => c.id === request.columnId) : -1;
  const names = useMemo(() => (table ? columnNames(wb, calc, table, locale) : []), [wb, calc, table, locale]);
  if (!table || index < 0) return null;
  const name = names[index] ?? "";

  // Sorting, filtering and the menu's link close it and give the grid the keyboard back.
  const done = () => {
    onClose();
    focusSheetGrid();
  };
  const body = <ColumnMenuContent store={store} table={table} index={index} name={name} wb={wb} calc={calc} locale={locale} readOnly={readOnly} t={t} done={done} phone={phone} />;
  if (phone) {
    return (
      <BottomSheet open onClose={onClose} label={t.menuLabel(name)}>
        <div className="px-4 pb-2">{body}</div>
      </BottomSheet>
    );
  }
  return (
    <Anchored anchor={request.anchor} label={t.menuLabel(name)} onClose={onClose} onEscape={done}>
      {body}
    </Anchored>
  );
}

/** A panel hanging under the header button, kept on screen; closes on a click outside or Escape. */
function Anchored({ anchor, label, onClose, onEscape, children }: { anchor: HTMLElement; label: string; onClose: () => void; onEscape: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, onEscape });
  useEffect(() => {
    latest.current = { onClose, onEscape };
  });

  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    let box = anchor.getBoundingClientRect();
    const place = () => {
      // The button may scroll away (or the grid redraw it): keep the last place then.
      if (anchor.isConnected) {
        const r = anchor.getBoundingClientRect();
        if (r.width || r.height) box = r;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = el.offsetWidth;
      const natural = inner.current?.scrollHeight ?? el.scrollHeight;
      const below = vh - box.bottom - 12;
      const above = box.top - 12;
      const down = below >= Math.min(natural, 420) || below >= above;
      const room = Math.max(180, down ? below : above);
      const h = Math.min(natural, room);
      el.style.maxHeight = `${room}px`;
      el.style.left = `${Math.round(Math.max(8, Math.min(box.right - w, vw - w - 8)))}px`;
      el.style.top = `${Math.round(down ? Math.min(box.bottom + 6, vh - h - 8) : Math.max(8, box.top - 6 - h))}px`;
      el.style.transformOrigin = down ? "top right" : "bottom right";
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const grows = typeof ResizeObserver === "undefined" || !inner.current ? null : new ResizeObserver(place);
    if (grows && inner.current) grows.observe(inner.current);
    // Keyboard users land in the menu (Tab moves through it); a touch doesn't open the keyboard.
    el.focus({ preventScroll: true });
    return () => {
      grows?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || anchor.contains(target)) return;
      // A select's own popup reports clicks outside the page; those stay in.
      if (!(target instanceof Node) || !document.contains(target)) return;
      latest.current.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape inside a field with a draft first leaves the field alone (the field handles it).
      if (e.defaultPrevented) return;
      e.stopPropagation();
      e.preventDefault();
      latest.current.onEscape();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      ref={panel}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      data-table-menu=""
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      style={{ left: -9999, top: -9999 }}
      className="fixed z-[80] flex w-[304px] max-w-[calc(100vw-16px)] flex-col overflow-y-auto overscroll-contain rounded-xl border border-line bg-raised text-[13px] shadow-pop outline-none"
    >
      <div ref={inner} className="p-1.5">
        {children}
      </div>
    </motion.div>,
    document.body,
  );
}

/** What the menu holds (also usable without the popover around it). */
export function ColumnMenuContent({
  store,
  table,
  index,
  name,
  wb,
  calc,
  locale,
  readOnly,
  t,
  done,
  phone,
}: {
  store: SheetStore;
  table: TableSpec;
  index: number;
  name: string;
  wb: Workbook;
  calc: Calc;
  locale: Locale;
  readOnly: boolean;
  t: SheetTableText;
  done: () => void;
  phone: boolean;
}) {
  const column = table.columns[index];
  const sheet = sheetById(wb, table.sheetId);
  const kind = useMemo(() => (sheet ? columnKind(calc, sheet, table, index, locale) : "text"), [calc, sheet, table, index, locale]);
  const values = useMemo(() => (sheet ? columnValues(calc, sheet, table, index, locale) : []), [calc, sheet, table, index, locale]);
  const average = useMemo(() => (sheet && kind !== "text" ? columnAverage(calc, sheet, table, index, locale) : null), [calc, sheet, table, index, locale, kind]);
  const current = table.filters[column.id];
  const [mode, setMode] = useState<"values" | "condition">(current && current.kind !== "values" ? "condition" : "values");

  const sorted = table.sort?.column === column.id ? table.sort.dir : null;
  const sort = (dir: "asc" | "desc") => {
    sortTableColumn(store, table.id, column.id, dir);
    done();
  };
  const apply = (f: FilterSpec | null) => {
    filterTableColumn(store, table.id, column.id, f);
    done();
  };
  const ascIcon = kind === "text" ? <ArrowDownAZ /> : <ArrowDown01 />;
  const descIcon = kind === "text" ? <ArrowDownZA /> : <ArrowDown10 />;

  const totalsCell = table.totals ? sheet?.cells[cellKey(table.area.r1, table.area.c0 + index)] : undefined;
  const total = table.totals ? totalOfCell(totalsCell, table.area.c0 + index) : "none";

  return (
    <div className="space-y-1">
      <div className={cn("flex items-center gap-2 px-2 pb-1 pt-1", phone && "pt-0")}>
        <span className="min-w-0 flex-1 truncate font-display text-[14px] font-semibold text-ink" title={name}>
          {name}
        </span>
        <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-ink-3">{t.kinds[kind]}</span>
      </div>

      {readOnly && <p className="px-2 pb-1 text-[12px] leading-snug text-ink-3">{t.readOnly}</p>}

      <MenuRow icon={ascIcon} onClick={() => sort("asc")} disabled={readOnly} checked={sorted === "asc"}>
        {t.sortAsc[kind]}
      </MenuRow>
      <MenuRow icon={descIcon} onClick={() => sort("desc")} disabled={readOnly} checked={sorted === "desc"}>
        {t.sortDesc[kind]}
      </MenuRow>

      <div className="mx-1 my-1.5 h-px bg-line" />

      <div className="space-y-2.5 px-1.5 pb-1">
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            label={t.filter}
            value={mode}
            onChange={setMode}
            options={[
              { value: "values", label: t.filterBy.values },
              { value: "condition", label: t.filterBy[kind] },
            ]}
          />
          <span className="flex-1" />
          {current && !readOnly && (
            <button
              type="button"
              onClick={() => apply(null)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-blob-ink transition-colors hover:bg-blob-soft [@media(hover:none)]:h-9 [&_svg]:size-3.5"
            >
              <FunnelX />
              {t.clearFilter}
            </button>
          )}
        </div>
        {mode === "values" ? (
          <FilterValues values={values} current={current} locale={locale} t={t} disabled={readOnly} onApply={apply} onCancel={done} />
        ) : (
          <FilterCondition kind={kind} current={current} average={average} locale={locale} t={t} disabled={readOnly} onApply={apply} onCancel={done} />
        )}
      </div>

      {table.totals && (
        <>
          <div className="mx-1 my-1.5 h-px bg-line" />
          <div className="flex items-center gap-2.5 px-2 pb-1">
            <Sigma aria-hidden className="size-4 shrink-0 text-ink-3" />
            <span className="shrink-0 text-[13px] text-ink-2">{t.total}</span>
            <Select<TotalFn | "custom">
              label={`${t.total}: ${name}`}
              value={total}
              disabled={readOnly}
              className="min-w-0 flex-1"
              onChange={(fn) => fn !== "custom" && setTableColumnTotal(store, table.id, column.id, fn)}
              options={[...TOTAL_FNS.map((fn) => ({ value: fn as TotalFn | "custom", label: t.totalFns[fn] })), ...(total === "custom" ? [{ value: "custom" as const, label: t.custom, disabled: true }] : [])]}
            />
          </div>
        </>
      )}

      <div className="mx-1 my-1.5 h-px bg-line" />
      <MenuRow
        icon={<Settings2 />}
        onClick={() => {
          done();
          openTablePanel(store, table.id);
        }}
      >
        {t.tableSettings}
      </MenuRow>
    </div>
  );
}

function MenuRow({ icon, children, onClick, disabled, checked }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; checked?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked === undefined ? undefined : checked}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors disabled:opacity-45 [@media(hover:none)]:h-10 [&_svg]:size-4 [&_svg]:shrink-0",
        checked ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      <span className={checked ? "text-blob-ink" : "text-ink-3"}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Check className="text-blob-ink" />}
    </button>
  );
}
