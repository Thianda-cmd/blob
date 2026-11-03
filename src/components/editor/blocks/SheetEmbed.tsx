"use client";

import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import {
  ArrowUpRight,
  Captions,
  ChartArea,
  ChartBarBig,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  Check,
  ChevronLeft,
  CloudOff,
  FileSpreadsheet,
  FileX,
  Lock,
  Pencil,
  RefreshCw,
  Scaling,
  Table2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePublicPages } from "@/components/public/context";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { publicHref } from "@/lib/publicLink";
import { cn } from "@/lib/utils";
import { areaName, parseArea } from "@/sheet/a1";
import { ChartView } from "@/sheet/chart/ChartView";
import { chartData, type ChartData } from "@/sheet/chart/data";
import {
  CHART_WIDTH,
  EMBED_SIZES,
  embedPageId,
  embedTableModel,
  embedTarget,
  readEmbedItem,
  sameItem,
  usedArea,
  type EmbedCell,
  type EmbedTableModel,
  type SheetEmbedItem,
  type SheetEmbedSize,
} from "@/sheet/embed";
import type { Calc } from "@/sheet/engine";
import type { ChartKind, ChartSpec, Workbook } from "@/sheet/types";
import { useNoteBlocks } from "./context";
import { Picker } from "./Picker";
import { SheetEmbedSpec } from "./schema";
import { calcOf, setSheetLocale, sheetDocs, useSheetDoc, type SheetDocs, type SheetLoad } from "./sheetEmbedData";
import "./sheetEmbed.css";

type T = NoteBlocksText["sheet"];
type Tab = "chart" | "table" | "range";

const KIND_ICON: Record<ChartKind, LucideIcon> = { scatter: ChartScatter, line: ChartLine, column: ChartColumn, bar: ChartBarBig, area: ChartArea, pie: ChartPie };

/** Text size of a table at each block size, in px. */
const TABLE_FONT: Record<SheetEmbedSize, number> = { s: 12.5, m: 13.5, l: 15, full: 13.5 };

const sizeOf = (x: unknown): SheetEmbedSize => (EMBED_SIZES.includes(x as SheetEmbedSize) ? (x as SheetEmbedSize) : "m");

/** The kind a fresh block was asked for ("/Diagramm aus einer Tabelle" stores { kind: "chart" } until you pick). */
function wantedTab(raw: unknown): Tab | null {
  const kind = raw && typeof raw === "object" ? (raw as { kind?: unknown }).kind : null;
  return kind === "chart" || kind === "table" || kind === "range" ? kind : null;
}

function SheetEmbedView(props: ReactNodeViewProps) {
  const { token } = usePublicPages();
  return token ? <PublicView {...props} /> : <PrivateView {...props} />;
}

// In a note you can open --------------------------------------------------------------------------

function PrivateView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).sheet;
  const locale = useLocale();
  const router = useRouter();
  const { pages } = useWorkspace();
  const { canEdit } = useNoteBlocks();
  const pageId = embedPageId(node.attrs.pageId);
  const item = readEmbedItem(node.attrs.item);
  const size = sizeOf(node.attrs.size);
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const [picking, setPicking] = useState(false);
  const meta = pageId ? pages.find((p) => p.id === pageId) : undefined;

  if (!pageId || !item || picking) {
    if (!canEdit) {
      return (
        <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
          <div className="blob-sheet-card">
            <Notice icon={FileSpreadsheet} text={t.nothing} />
          </div>
        </NodeViewWrapper>
      );
    }
    return (
      <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
        <SheetPicker
          t={t}
          locale={locale}
          current={pageId && item ? { pageId, item } : null}
          hint={wantedTab(node.attrs.item)}
          onPick={(next) => {
            setPicking(false);
            updateAttributes({ pageId: next.pageId, item: next.item });
          }}
          onCancel={pageId && item ? () => setPicking(false) : undefined}
        />
      </NodeViewWrapper>
    );
  }

  const title = meta?.title?.trim() || "";
  return (
    <NodeViewWrapper className={cn("blob-embed blob-object", selected && "blob-node-selected")} contentEditable={false}>
      <EmbedBody
        t={t}
        locale={locale}
        docs={sheetDocs(null)}
        pageId={pageId}
        item={item}
        size={size}
        caption={caption}
        canEdit={canEdit}
        knownTitle={title}
        changedAt={meta?.updated_at ?? null}
        open={() => router.push(`/p/${pageId}`)}
        onChange={() => setPicking(true)}
        onSize={(s) => updateAttributes({ size: s })}
        onCaption={(c) => updateAttributes({ caption: c })}
      />
    </NodeViewWrapper>
  );
}

// Through a public link ---------------------------------------------------------------------------

function PublicView({ node }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).sheet;
  const locale = useLocale();
  const { token, root, pages } = usePublicPages();
  const pageId = embedPageId(node.attrs.pageId);
  const item = readEmbedItem(node.attrs.item);
  if (!pageId || !item) return <NodeViewWrapper className="blob-embed" contentEditable={false} />;
  const page = pages.get(pageId);
  return (
    <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
      <EmbedBody
        t={t}
        locale={locale}
        docs={sheetDocs(token)}
        pageId={pageId}
        item={item}
        size={sizeOf(node.attrs.size)}
        caption={typeof node.attrs.caption === "string" ? node.attrs.caption : ""}
        canEdit={false}
        knownTitle={page?.title ?? ""}
        changedAt={null}
        openHref={page ? publicHref(token, page.id, root) : undefined}
      />
    </NodeViewWrapper>
  );
}

// The block: chart or table, its buttons and caption -----------------------------------------------

function EmbedBody({
  t,
  locale,
  docs,
  pageId,
  item,
  size,
  caption,
  canEdit,
  knownTitle,
  changedAt,
  open,
  openHref,
  onChange,
  onSize,
  onCaption,
}: {
  t: T;
  locale: Locale;
  docs: SheetDocs;
  pageId: string;
  item: SheetEmbedItem;
  size: SheetEmbedSize;
  caption: string;
  canEdit: boolean;
  knownTitle: string;
  changedAt: string | null;
  open?: () => void;
  openHref?: string;
  onChange?: () => void;
  onSize?: (size: SheetEmbedSize) => void;
  onCaption?: (caption: string) => void;
}) {
  useEffect(() => setSheetLocale(locale), [locale]);
  const load = useSheetDoc(pageId, docs, changedAt);
  const [editingCaption, setEditingCaption] = useState(false);
  const [measure, available] = useWidth();
  const title = (load.status === "ready" ? load.doc.title.trim() : "") || knownTitle || t.untitled;
  const refreshing = load.status === "ready" && load.refreshing;
  const canOpen = !!open || !!openHref;

  const openButton = (label: string, className: string, children: ReactNode) =>
    openHref ? (
      <Link href={openHref} className={className} aria-label={label} title={label}>
        {children}
      </Link>
    ) : (
      <button type="button" className={className} onClick={open} aria-label={label} title={label}>
        {children}
      </button>
    );

  const actions = (
    <div className="blob-sheet-actions">
      <button type="button" className="blob-block-edit is-icon" onClick={() => void docs.reload(pageId)} aria-label={t.refresh} title={refreshing ? t.loading : t.refresh} disabled={refreshing}>
        <RefreshCw className={cn("size-3.5", refreshing && "blob-sheet-spin")} />
      </button>
      {canOpen && openButton(t.openTitle(title), "blob-block-edit is-icon", <ArrowUpRight className="size-3.5" />)}
      {canEdit && onSize && (
        <Popover
          align="end"
          className="w-[190px]"
          trigger={(p) => (
            <button {...p} type="button" className="blob-block-edit is-icon" aria-label={t.sizeLabel} title={t.sizeLabel}>
              <Scaling className="size-3.5" />
            </button>
          )}
        >
          {(close) => (
            <>
              {EMBED_SIZES.map((s) => (
                <MenuItem
                  key={s}
                  active={s === size}
                  icon={s === size ? <Check /> : <span className="block size-4" />}
                  onSelect={() => {
                    close();
                    onSize(s);
                  }}
                >
                  {t.sizes[s]}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
      )}
      {canEdit && onCaption && !caption && !editingCaption && (
        <button type="button" className="blob-block-edit is-icon" onClick={() => setEditingCaption(true)} aria-label={t.addCaption} title={t.addCaption}>
          <Captions className="size-3.5" />
        </button>
      )}
      {canEdit && onChange && (
        <button type="button" className="blob-block-edit" onClick={onChange} aria-label={t.change} title={t.change}>
          <Pencil className="size-3.5" />
          <span className="max-sm:sr-only">{t.change}</span>
        </button>
      )}
    </div>
  );

  // The bar above: where it comes from (a smart table's name first), and the buttons.
  const wbReady = load.status === "ready" ? load.doc.wb : null;
  const target = wbReady ? embedTarget(wbReady, item) : null;
  const tableName = target?.kind === "table" ? target.table.name : null;
  const where = target?.kind === "table" ? `${target.sheet.name} · ${areaName(target.table.area)}` : target?.kind === "range" ? `${target.sheet.name} · ${areaName(target.area)}` : null;
  const KindIcon = target?.kind === "chart" ? (KIND_ICON[target.chart.kind] ?? ChartScatter) : target?.kind === "table" || target?.kind === "range" ? Table2 : FileSpreadsheet;
  const label = (
    <>
      <KindIcon className="size-3.5 shrink-0" />
      {tableName && <strong className="blob-sheet-name">{tableName}</strong>}
      <span className="blob-sheet-from">{tableName ? title : t.source(title)}</span>
      {where && <span className="blob-sheet-where">{where}</span>}
    </>
  );
  const bar = (
    <div className="blob-sheet-bar">
      {canOpen ? openButton(t.openTitle(title), "blob-sheet-source-link", label) : <span className="blob-sheet-source-link">{label}</span>}
      {actions}
    </div>
  );

  let content: ReactNode;
  if (load.status !== "ready") {
    content = <LoadNotice t={t} load={load} canEdit={canEdit} onRetry={() => void docs.reload(pageId)} onChange={onChange} />;
  } else if (target && wbReady) {
    const wb = wbReady;
    if (target.kind === "gone") {
      content = (
        <Notice icon={FileX} text={target.what === "chart" ? t.goneChart : target.what === "table" ? t.goneTable : t.goneSheet}>
          {canOpen && openButton(t.openTitle(title), "blob-btn", <><ArrowUpRight className="size-3.5" /> {t.open}</>)}
          {canEdit && onChange && (
            <button type="button" className="blob-btn" onClick={onChange}>
              <Pencil className="size-3.5" /> {t.change}
            </button>
          )}
        </Notice>
      );
    } else if (target.kind === "chart") {
      content = <EmbedChart t={t} spec={target.chart} wb={wb} locale={locale} size={size} available={available} />;
    } else {
      content = <EmbedTable t={t} wb={wb} item={item} locale={locale} size={size} more={canOpen ? openButton(t.openTitle(title), "blob-btn is-quiet", <>{t.openToSee} <ArrowUpRight className="size-3.5" /></>) : null} />;
    }
  }

  // A chart's card hugs the chart (small, medium, large); tables and full-width charts span the note.
  const hug = target?.kind === "chart" && size !== "full";
  return (
    <div className="blob-sheet" ref={measure}>
      <div className={cn("blob-sheet-card", refreshing && "is-refreshing", hug && "is-hugging")}>
        {bar}
        {content}
      </div>
      <CaptionLine t={t} caption={caption} editing={editingCaption} canEdit={canEdit && !!onCaption} onEdit={setEditingCaption} onSave={(c) => onCaption?.(c)} />
    </div>
  );
}

function CaptionLine({ t, caption, editing, canEdit, onEdit, onSave }: { t: T; caption: string; editing: boolean; canEdit: boolean; onEdit: (on: boolean) => void; onSave: (caption: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const finished = useRef(false);
  if (editing && canEdit) {
    const value = draft ?? caption;
    // Enter and Escape finish; the blur that follows when the field goes must not finish again.
    const finish = (save: boolean) => {
      if (finished.current) return;
      finished.current = true;
      const next = value.replace(/\s+/g, " ").trim().slice(0, 300);
      if (save && next !== caption) onSave(next);
      setDraft(null);
      onEdit(false);
    };
    return (
      <input
        ref={(el) => {
          if (el && !el.dataset.focused) {
            el.dataset.focused = "1";
            finished.current = false;
            requestAnimationFrame(() => el.focus({ preventScroll: true }));
          }
        }}
        className="blob-sheet-caption"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false);
          }
        }}
        placeholder={t.captionPlaceholder}
        aria-label={t.caption}
        maxLength={300}
      />
    );
  }
  if (!caption) return null;
  if (!canEdit) return <p className="blob-sheet-caption">{caption}</p>;
  return (
    <button type="button" className="blob-sheet-caption is-editable" onClick={() => onEdit(true)} title={t.caption}>
      {caption}
    </button>
  );
}

function Notice({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children?: ReactNode }) {
  return (
    <div className="blob-sheet-notice" role="status">
      <Icon className="size-4" />
      <div className="min-w-0">
        <p className="m-0">{text}</p>
        {children && <div className="blob-sheet-notice-actions">{children}</div>}
      </div>
    </div>
  );
}

function LoadNotice({ t, load, canEdit, onRetry, onChange }: { t: T; load: SheetLoad; canEdit: boolean; onRetry: () => void; onChange?: () => void }) {
  if (load.status === "loading") {
    return (
      <div className="blob-sheet-loading" role="status" aria-live="polite">
        <span className="blob-sheet-shimmer" />
        <span>{t.loading}</span>
      </div>
    );
  }
  const change =
    canEdit && onChange ? (
      <button type="button" className="blob-btn" onClick={onChange}>
        <Pencil className="size-3.5" /> {t.change}
      </button>
    ) : null;
  const retry = (
    <button type="button" className="blob-btn" onClick={onRetry}>
      <RefreshCw className="size-3.5" /> {t.retry}
    </button>
  );
  switch (load.status) {
    case "missing":
      return <Notice icon={FileX} text={t.missing}>{change}</Notice>;
    case "trashed":
      return <Notice icon={FileX} text={t.trashed}>{change}</Notice>;
    case "notSheet":
      return <Notice icon={FileX} text={t.notSheet}>{change}</Notice>;
    case "private":
      return <Notice icon={Lock} text={t.publicHidden} />;
    case "offline":
      return (
        <Notice icon={CloudOff} text={t.offline}>
          {retry}
        </Notice>
      );
    default:
      return (
        <Notice icon={TriangleAlert} text={t.failed}>
          {retry}
          {change}
        </Notice>
      );
  }
}

// A chart -----------------------------------------------------------------------------------------

/** The available width of an element, kept up to date. */
function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setWidth((old) => (old === w ? old : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

function safeChartData(spec: ChartSpec, calc: Calc, locale: Locale): ChartData | null {
  try {
    return chartData(spec, calc, locale);
  } catch (e) {
    console.error("sheet embed: chart data failed", e);
    return null;
  }
}

/**
 * A chart at the size chosen, never wider than the note: `available` is the block's width (the
 * card around the chart hugs the chart, so the block is what is measured).
 */
function EmbedChart({ t, spec, wb, locale, size, available }: { t: T; spec: ChartSpec; wb: Workbook; locale: Locale; size: SheetEmbedSize; available: number }) {
  const calc = calcOf(wb, locale);
  const data = useMemo(() => safeChartData(spec, calc, locale), [spec, calc, locale]);
  // The card's padding and border take 26 px.
  const room = Math.max(200, available - 26);
  const w = size === "full" ? room : Math.min(CHART_WIDTH[size], room);
  const aspect = Math.min(0.95, Math.max(0.42, spec.size.h / Math.max(1, spec.size.w)));
  const h = Math.round(w * aspect);
  if (!data) return <Notice icon={TriangleAlert} text={t.chartFailed} />;
  if (available <= 0) return <div style={{ width: CHART_WIDTH.m, maxWidth: "100%", height: Math.round(CHART_WIDTH.m * aspect) }} />;
  return (
    <div className="blob-sheet-chart">
      <ChartView spec={spec} data={data} width={w} height={h} locale={locale} interactive />
    </div>
  );
}

// A table -----------------------------------------------------------------------------------------

function cellStyle(c: EmbedCell): CSSProperties | undefined {
  const s: CSSProperties = {};
  if (c.align !== "left") s.textAlign = c.align;
  if (c.valign) s.verticalAlign = c.valign === "middle" ? "middle" : c.valign;
  if (c.bold) s.fontWeight = 650;
  if (c.italic) s.fontStyle = "italic";
  if (c.underline || c.strike) s.textDecoration = [c.underline && "underline", c.strike && "line-through"].filter(Boolean).join(" ");
  if (c.color) s.color = `var(--sheet-${c.color})`;
  if (c.fill) s.background = `var(--sheet-${c.fill}-fill)`;
  if (c.size) s.fontSize = `${(c.size / 13).toFixed(3)}em`;
  const line = (l: string | undefined) => (l === "thick" ? "2px solid var(--ink-2)" : l === "double" ? "3px double var(--ink-2)" : l === "dashed" ? "1px dashed var(--ink-2)" : l ? "1px solid var(--ink-2)" : undefined);
  if (c.border) {
    if (c.border.top) s.borderTop = line(c.border.top);
    if (c.border.right) s.borderRight = line(c.border.right);
    if (c.border.bottom) s.borderBottom = line(c.border.bottom);
    if (c.border.left) s.borderLeft = line(c.border.left);
  }
  return Object.keys(s).length ? s : undefined;
}

export function TableView({ model, size, compact }: { model: EmbedTableModel; size: SheetEmbedSize; compact?: boolean }) {
  const header = model.kind === "table" ? model.rows.find((r) => r.part === "header") : undefined;
  const body = header ? model.rows.filter((r) => r !== header) : model.rows;
  const vars: Record<string, string> = { "--blob-sheet-font": `${compact ? 12.5 : TABLE_FONT[size]}px` };
  if (model.style) {
    vars["--blob-sheet-tint"] = `var(--sheet-${model.style}-fill)`;
    vars["--blob-sheet-accent"] = `var(--sheet-${model.style})`;
  }
  const cell = (c: EmbedCell, i: number, head: boolean) => {
    const className = cn(c.wrap && "is-wrap", c.error && "is-error") || undefined;
    return head ? (
      <th key={i} scope="col" className={className} style={cellStyle(c)}>
        {c.text}
      </th>
    ) : (
      <td key={i} className={className} style={cellStyle(c)}>
        {c.text}
      </td>
    );
  };
  return (
    <table className={cn("blob-sheet-table", model.kind === "range" && "is-range", size === "full" && !compact && "is-full")} style={vars as CSSProperties} aria-label={model.title}>
      {header && (
        <thead>
          <tr>{header.cells.map((c, i) => cell(c, i, true))}</tr>
        </thead>
      )}
      <tbody>
        {body.map((r, ri) => (
          <tr key={ri} className={cn(r.part === "totals" && "is-totals", model.banded && r.part === "data" && r.band === 1 && "is-band") || undefined}>
            {r.cells.map((c, i) => cell(c, i, false))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmbedTable({ t, wb, item, locale, size, more }: { t: T; wb: Workbook; item: SheetEmbedItem; locale: Locale; size: SheetEmbedSize; more: ReactNode }) {
  const calc = calcOf(wb, locale);
  const model = useMemo(() => {
    try {
      return embedTableModel(wb, calc, item, locale);
    } catch (e) {
      console.error("sheet embed: table failed", e);
      return null;
    }
  }, [wb, calc, item, locale]);
  if (!model) return <Notice icon={TriangleAlert} text={t.failed} />;
  const empty = model.rows.every((r) => r.cells.every((c) => c.text === ""));
  return (
    <>
      {empty ? (
        <p className="blob-sheet-empty m-0">{t.emptyCells}</p>
      ) : (
        <div className="blob-sheet-scroll">
          <TableView model={model} size={size} />
        </div>
      )}
      {(model.moreRows > 0 || model.moreCols > 0) && (
        <div className="blob-sheet-more">
          <span>{[model.moreRows > 0 ? t.more(model.moreRows) : null, model.moreCols > 0 ? t.moreCols(model.moreCols) : null].filter(Boolean).join(" ")}</span>
          {more}
        </div>
      )}
    </>
  );
}

// Choosing what to show ---------------------------------------------------------------------------

function SheetPicker({
  t,
  locale,
  current,
  hint,
  onPick,
  onCancel,
}: {
  t: T;
  locale: Locale;
  current: { pageId: string; item: SheetEmbedItem } | null;
  hint: Tab | null;
  onPick: (next: { pageId: string; item: SheetEmbedItem }) => void;
  onCancel?: () => void;
}) {
  const { pages, subjects } = useWorkspace();
  const [chosen, setChosen] = useState<string | null>(current?.pageId ?? null);
  const sheets = useMemo(
    () =>
      pages
        // (Compared as text: the page kind "sheet" is new.)
        .filter((p) => String(p.kind) === "sheet" && !p.trashed_at)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    [pages],
  );

  if (chosen) {
    const meta = pages.find((p) => p.id === chosen);
    return (
      <WhatToShow
        t={t}
        locale={locale}
        pageId={chosen}
        title={meta?.title?.trim() || ""}
        changedAt={meta?.updated_at ?? null}
        current={current?.pageId === chosen ? current.item : null}
        hint={hint}
        onBack={() => setChosen(null)}
        onPick={(item) => onPick({ pageId: chosen, item })}
        onCancel={onCancel}
      />
    );
  }

  const items = sheets.map((p) => {
    const parent = p.parent_id ? pages.find((x) => x.id === p.parent_id) : undefined;
    const subject = subjects.find((s) => s.id === p.subject_id);
    return {
      key: p.id,
      label: p.title?.trim() || t.untitled,
      sub: parent?.title?.trim() || subject?.name || undefined,
      icon: p.icon ? <span className="text-[15px] leading-none">{p.icon}</span> : <FileSpreadsheet className="size-4" />,
    };
  });
  return (
    <div className="blob-embed-pick">
      <div className="blob-embed-pick-head">
        <FileSpreadsheet className="size-4" />
        {t.pick}
      </div>
      {items.length ? (
        <Picker items={items} placeholder={t.search} empty={t.noMatch} onPick={setChosen} onCancel={onCancel} listClassName="max-h-[280px]" />
      ) : (
        <p className="m-0 px-1.5 pb-2 text-[13px] leading-snug text-ink-3">{t.none}</p>
      )}
    </div>
  );
}

function WhatToShow({
  t,
  locale,
  pageId,
  title,
  changedAt,
  current,
  hint,
  onBack,
  onPick,
  onCancel,
}: {
  t: T;
  locale: Locale;
  pageId: string;
  title: string;
  changedAt: string | null;
  current: SheetEmbedItem | null;
  hint: Tab | null;
  onBack: () => void;
  onPick: (item: SheetEmbedItem) => void;
  onCancel?: () => void;
}) {
  useEffect(() => setSheetLocale(locale), [locale]);
  const docs = sheetDocs(null);
  const load = useSheetDoc(pageId, docs, changedAt);
  const [tab, setTab] = useState<Tab | null>(current?.kind ?? null);
  const name = (load.status === "ready" ? load.doc.title.trim() : "") || title || t.untitled;

  const head = (
    <div className="blob-sheet-pick-head">
      <button type="button" className="blob-sheet-back" onClick={onBack}>
        <ChevronLeft className="size-4" />
        {t.otherSheet}
      </button>
      <span className="text-ink-3">·</span>
      <FileSpreadsheet className="size-4 shrink-0 text-ink-3" />
      <span className="blob-sheet-pick-title">{name}</span>
    </div>
  );

  let body: ReactNode;
  if (load.status !== "ready") {
    body = (
      <div className="blob-sheet-card">
        <LoadNotice t={t} load={load} canEdit={false} onRetry={() => void docs.reload(pageId)} />
      </div>
    );
  } else {
    const wb = load.doc.wb;
    // The first tab with something in it (a fresh block asked for charts or for cells first).
    const auto: Tab = hint === "chart" && wb.charts.length ? "chart" : hint && hint !== "chart" ? (wb.tables.length ? "table" : "range") : wb.charts.length ? "chart" : wb.tables.length ? "table" : "range";
    const shown = tab ?? auto;
    body = (
      <>
        <div className="blob-sheet-tabs">
          <Segmented<Tab>
            value={shown}
            onChange={setTab}
            label={t.what}
            size="sm"
            options={[
              { value: "chart", label: `${t.tabs.chart}${wb.charts.length ? ` (${wb.charts.length})` : ""}` },
              { value: "table", label: `${t.tabs.table}${wb.tables.length ? ` (${wb.tables.length})` : ""}` },
              { value: "range", label: t.tabs.range },
            ]}
          />
        </div>
        {shown === "chart" ? (
          <ChartChoices t={t} wb={wb} locale={locale} current={current} onPick={onPick} />
        ) : shown === "table" ? (
          <TableChoices t={t} wb={wb} current={current} onPick={onPick} />
        ) : (
          <RangeChoice t={t} wb={wb} locale={locale} current={current} onPick={onPick} />
        )}
      </>
    );
  }

  return (
    <div
      className="blob-embed-pick"
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {head}
      {body}
    </div>
  );
}

function ChartChoice({ spec, wb, locale, t, current, onPick }: { spec: ChartSpec; wb: Workbook; locale: Locale; t: T; current: boolean; onPick: () => void }) {
  const calc = calcOf(wb, locale);
  const data = useMemo(() => safeChartData(spec, calc, locale), [spec, calc, locale]);
  const Icon = KIND_ICON[spec.kind] ?? ChartScatter;
  const sheet = wb.sheets.find((s) => s.id === spec.sheetId);
  const name = spec.title.trim() || t.untitledChart;
  return (
    <button type="button" className={cn("blob-sheet-option", current && "is-current")} onClick={onPick} aria-label={name}>
      <span className="blob-sheet-option-preview">{data ? <ChartView spec={spec} data={data} width={236} height={132} locale={locale} /> : <Icon className="size-6 text-ink-3" />}</span>
      <span className="blob-sheet-option-name">{name}</span>
      <span className="blob-sheet-option-meta">
        {t.chartKinds[spec.kind] ?? spec.kind}
        {sheet ? ` · ${sheet.name}` : ""}
      </span>
    </button>
  );
}

function ChartChoices({ t, wb, locale, current, onPick }: { t: T; wb: Workbook; locale: Locale; current: SheetEmbedItem | null; onPick: (item: SheetEmbedItem) => void }) {
  if (!wb.charts.length) return <p className="blob-sheet-empty m-0">{t.noCharts}</p>;
  return (
    <div className="blob-sheet-grid">
      {wb.charts.map((c) => {
        const item: SheetEmbedItem = { kind: "chart", chartId: c.id };
        return <ChartChoice key={c.id} spec={c} wb={wb} locale={locale} t={t} current={sameItem(current, item)} onPick={() => onPick(item)} />;
      })}
    </div>
  );
}

function TableChoices({ t, wb, current, onPick }: { t: T; wb: Workbook; current: SheetEmbedItem | null; onPick: (item: SheetEmbedItem) => void }) {
  if (!wb.tables.length) return <p className="blob-sheet-empty m-0">{t.noTables}</p>;
  return (
    <div className="blob-sheet-list">
      {wb.tables.map((table) => {
        const item: SheetEmbedItem = { kind: "table", tableId: table.id };
        const sheet = wb.sheets.find((s) => s.id === table.sheetId);
        const rows = table.area.r1 - table.area.r0 + 1 - 1 - (table.totals ? 1 : 0);
        const cols = table.area.c1 - table.area.c0 + 1;
        return (
          <button
            key={table.id}
            type="button"
            className={cn("blob-sheet-option", sameItem(current, item) && "is-current")}
            onClick={() => onPick(item)}
            style={{ "--blob-sheet-tint": `var(--sheet-${table.style}-fill)`, "--blob-sheet-accent": `var(--sheet-${table.style})` } as CSSProperties}
          >
            <span className="blob-sheet-option-icon">
              <Table2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="blob-sheet-option-name block">{table.name}</span>
              <span className="blob-sheet-option-meta block">
                {sheet ? `${sheet.name} · ` : ""}
                {areaName(table.area)} · {t.size(Math.max(0, rows), cols)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RangeChoice({ t, wb, locale, current, onPick }: { t: T; wb: Workbook; locale: Locale; current: SheetEmbedItem | null; onPick: (item: SheetEmbedItem) => void }) {
  const currentRange = current?.kind === "range" ? current : null;
  const [sheetId, setSheetId] = useState<string>(() => (currentRange && wb.sheets.some((s) => s.id === currentRange.sheetId) ? currentRange.sheetId : wb.sheets[0].id));
  const sheet = wb.sheets.find((s) => s.id === sheetId) ?? wb.sheets[0];
  const guess = currentRange?.sheetId === sheet.id ? areaName(currentRange.area) : areaName(usedArea(sheet) ?? { r0: 0, c0: 0, r1: 9, c1: 3 });
  const [typed, setTyped] = useState<{ sheet: string; text: string } | null>(null);
  const text = typed?.sheet === sheet.id ? typed.text : guess;
  const item = useMemo<SheetEmbedItem | null>(() => {
    const area = parseArea(text.replace(/\$/g, ""));
    return area ? { kind: "range", sheetId: sheet.id, area } : null;
  }, [text, sheet.id]);
  const area = item?.kind === "range" ? item.area : null;
  const calc = calcOf(wb, locale);
  const preview = useMemo(() => {
    if (!item) return null;
    try {
      return embedTableModel(wb, calc, item, locale, { maxRows: 6, maxCols: 8 });
    } catch {
      return null;
    }
  }, [wb, calc, item, locale]);
  const empty = !!preview && preview.rows.every((r) => r.cells.every((c) => c.text === ""));
  const hintId = `sheet-range-hint-${sheet.id}`;
  return (
    <div className="blob-sheet-range">
      <div className="blob-sheet-range-row">
        {wb.sheets.length > 1 && (
          <label className="blob-sheet-field">
            {t.sheetLabel}
            <select className="blob-sheet-input" value={sheet.id} onChange={(e) => setSheetId(e.target.value)}>
              {wb.sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="blob-sheet-field">
          {t.rangeLabel}
          <input
            className="blob-sheet-input is-ref w-[150px]"
            value={text}
            onChange={(e) => setTyped({ sheet: sheet.id, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && item) {
                e.preventDefault();
                onPick(item);
              }
            }}
            placeholder={t.rangePlaceholder}
            aria-invalid={!area}
            aria-describedby={hintId}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </label>
        <button type="button" className="blob-btn-primary" disabled={!item} onClick={() => item && onPick(item)}>
          {t.show}
        </button>
      </div>
      <p id={hintId} className={cn("blob-sheet-hint m-0", !area && "is-error")}>
        {!area ? t.rangeInvalid : empty ? t.rangeEmpty : t.rangeHint}
      </p>
      {preview && !empty && (
        <div className="blob-sheet-preview">
          <TableView model={preview} size="s" compact />
        </div>
      )}
    </div>
  );
}

/** A chart, smart table or cells of one of your spreadsheets, live in the note. */
export const SheetEmbed = SheetEmbedSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SheetEmbedView);
  },
});

/** The same block for public pages: it notices the public link and reads through it. */
export const PublicSheetEmbed = SheetEmbed;
