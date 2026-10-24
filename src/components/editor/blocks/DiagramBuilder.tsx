"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  ChartPie,
  Circle,
  CodeXml,
  Diamond,
  IndentDecrease,
  IndentIncrease,
  Milestone,
  Network,
  Plus,
  RectangleHorizontal,
  RefreshCw,
  Square,
  Trash2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import {
  DIAGRAM_KINDS,
  FLOW_SHAPES,
  SECTION_VARS,
  cleanModel,
  depthRange,
  emptyRow,
  isOutline,
  normalizeDepths,
  pieShares,
  rowsFromText,
  subtree,
  type DiagramKind,
  type DiagramModel,
  type DiagramRow,
  type FlowShape,
} from "./diagramModel";

// The diagram builder: a gallery of kinds for a new diagram, and the rows that make one (an outline
// for mind maps and processes, fields for timelines, pie charts and sequences). Diagram.tsx draws
// the result next to it.

export const KIND_ICONS: Record<DiagramKind | "code", LucideIcon> = {
  mindmap: Network,
  flow: Workflow,
  cycle: RefreshCw,
  timeline: Milestone,
  pie: ChartPie,
  sequence: ArrowRightLeft,
  code: CodeXml,
};

/** What a new diagram can be: the builder's kinds and plain Mermaid code. */
export function DiagramGallery({ onPick, onDone }: { onPick: (kind: DiagramKind | "code") => void; onDone: () => void }) {
  const t = useMessages(noteBlocksText).diagram;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  return (
    <div
      className="blob-diagram-gallery"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <p className="blob-diagram-pick">{t.pick}</p>
      <div className="blob-diagram-kinds" role="group" aria-label={t.pick}>
        {[...DIAGRAM_KINDS, "code" as const].map((kind, i) => {
          const Icon = KIND_ICONS[kind];
          return (
            <button key={kind} ref={i === 0 ? first : undefined} type="button" className={cn("blob-diagram-kind", kind === "code" && "is-code")} onClick={() => onPick(kind)}>
              <span className="blob-diagram-kind-icon">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="blob-diagram-kind-name">{t.kinds[kind].name}</span>
                <span className="blob-diagram-kind-hint">{t.kinds[kind].hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Rows while editing: each with an id of its own (React keys, focus), dropped when saved -------------

export type EditRow = DiagramRow & { id: string };
export type Draft = Omit<DiagramModel, "rows"> & { rows: EditRow[] };

let rowCount = 0;
const newId = () => `r${++rowCount}`;
const withId = (r: DiagramRow): EditRow => ({ ...r, id: newId() });

export const toDraft = (model: DiagramModel): Draft => ({ ...model, rows: model.rows.map(withId) });

export function fromDraft(draft: Draft): DiagramModel {
  return cleanModel({
    ...draft,
    rows: draft.rows.map((r) => {
      const row: DiagramRow & { id?: string } = { ...r };
      delete row.id;
      return row;
    }),
  });
}

type Field = "text" | "when" | "value" | "from" | "to";
const FIELDS: Record<DiagramKind, Field[]> = {
  mindmap: ["text"],
  flow: ["text"],
  cycle: ["text"],
  timeline: ["when", "text"],
  pie: ["text", "value"],
  sequence: ["from", "to", "text"],
};

const SHAPE_ICONS: Record<Exclude<FlowShape, "auto">, LucideIcon> = { box: Square, round: RectangleHorizontal, diamond: Diamond, circle: Circle };

/** The shape a process step is drawn with. */
const effectiveShape = (row: DiagramRow): Exclude<FlowShape, "auto"> => (row.shape && row.shape !== "auto" ? row.shape : /[?？]\s*$/.test(row.text) ? "diamond" : "box");

/** Each mind map row's branch (its colour in the drawing): -1 for the centre. */
function branches(rows: DiagramRow[]): number[] {
  let branch = -1;
  return rows.map((r, i) => {
    if (i === 0) return -1;
    if ((r.depth ?? 1) <= 1) branch++;
    return Math.max(0, branch);
  });
}

/**
 * The builder's rows. Enter adds a row, Backspace in an empty one removes it, Tab and Shift+Tab
 * indent (mind map, process), ↑ and ↓ go between rows, Alt+↑ and Alt+↓ move a row (with what is
 * indented under it), Escape or Mod+Enter finish. A list pasted into a row becomes rows.
 */
export function DiagramRows({ draft, onChange, onDone }: { draft: Draft; onChange: (next: Draft) => void; onDone: () => void }) {
  const t = useMessages(noteBlocksText).diagram;
  const locale = useLocale();
  const { kind, rows } = draft;
  const outline = isOutline(kind);
  const fields = FIELDS[kind];
  const listId = useId();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  /** Where the caret goes once the rows have rendered. */
  const pending = useRef<{ id: string; field: Field; at: "start" | "end" } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // The first row has the caret when the builder opens (before the effect below places it).
  useLayoutEffect(() => {
    const id = rows[0]?.id;
    if (id) pending.current = { id, field: fields[0], at: "end" };
    // Once, when the builder opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const el = inputs.current.get(`${p.id}:${p.field}`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
    const at = p.at === "end" ? el.value.length : 0;
    el.setSelectionRange(at, at);
  });

  const set = (next: EditRow[], extra?: Partial<Draft>) => onChange({ ...draft, ...extra, rows: outline ? (normalizeDepths(kind, next) as EditRow[]) : next });
  const focus = (id: string | undefined, field: Field = fields[0], at: "start" | "end" = "end") => {
    if (id) pending.current = { id, field, at };
  };
  const index = (id: string | null) => rows.findIndex((r) => r.id === id);

  const update = (i: number, patch: Partial<DiagramRow>) => set(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const addAfter = (i: number) => {
    const depth = outline ? Math.max(depthRange(kind, rows, i + 1).min, i >= 0 ? (rows[i]?.depth ?? 0) : 0) : 0;
    const row = withId(emptyRow(kind, depth));
    // A sequence goes on from whoever got the last message.
    if (kind === "sequence" && i >= 0 && rows[i]) Object.assign(row, { from: rows[i].to ?? "", to: rows[i].from ?? "" });
    set([...rows.slice(0, i + 1), row, ...rows.slice(i + 1)]);
    focus(row.id, kind === "sequence" && row.from ? "text" : fields[0], "start");
    setActive(row.id);
  };

  const remove = (i: number) => {
    if (rows.length <= 1 || (kind === "mindmap" && i === 0)) {
      // The last row (or the centre) only empties.
      set(rows.map((r, k) => (k === i ? { ...withId(emptyRow(kind, r.depth ?? 0)), id: r.id } : r)));
      focus(rows[i].id);
      return;
    }
    // What was indented under it moves up a level.
    const [, end] = subtree(rows, i);
    const next = rows.map((r, k) => (k > i && k < end ? { ...r, depth: Math.max(0, (r.depth ?? 0) - 1) } : r)).filter((_, k) => k !== i);
    set(next);
    const target = rows[i - 1] ?? rows[i + 1];
    focus(target?.id, fields[fields.length - 1]);
    setActive(target?.id ?? null);
  };

  /** Indent (+1) or outdent (-1) a row together with its children. False when it can't go further. */
  const shift = (i: number, delta: 1 | -1) => {
    if (!outline) return false;
    const { min, max } = depthRange(kind, rows, i);
    const depth = rows[i].depth ?? 0;
    const to = Math.max(min, Math.min(max, depth + delta));
    if (to === depth) return false;
    const [, end] = subtree(rows, i);
    set(rows.map((r, k) => (k >= i && k < end ? { ...r, depth: (r.depth ?? 0) + (to - depth) } : r)));
    focus(rows[i].id);
    return true;
  };

  /** Move a row (in an outline: with its children, past the neighbouring one at its level). */
  const move = (i: number, dir: -1 | 1) => {
    if (kind === "mindmap" && i === 0) return;
    let next: EditRow[] | null = null;
    if (!outline) {
      const j = i + dir;
      if (j < 0 || j >= rows.length) return;
      next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
    } else {
      const depth = rows[i].depth ?? 0;
      const [, end] = subtree(rows, i);
      const block = rows.slice(i, end);
      if (dir < 0) {
        let p = -1;
        for (let k = i - 1; k >= 0; k--) {
          const d = rows[k].depth ?? 0;
          if (d < depth) break;
          if (d === depth) {
            p = k;
            break;
          }
        }
        if (p < 0 || (kind === "mindmap" && p === 0)) return;
        next = [...rows.slice(0, p), ...block, ...rows.slice(p, i), ...rows.slice(end)];
      } else {
        if (end >= rows.length || (rows[end].depth ?? 0) !== depth) return;
        const [, nextEnd] = subtree(rows, end);
        next = [...rows.slice(0, i), ...rows.slice(end, nextEnd), ...block, ...rows.slice(nextEnd)];
      }
    }
    set(next);
    focus(rows[i].id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number, field: Field) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const el = e.currentTarget;
    const f = fields.indexOf(field);
    if (e.key === "Escape" || (e.key === "Enter" && mod)) {
      e.preventDefault();
      e.stopPropagation();
      onDone();
    } else if (e.key === "Enter") {
      e.preventDefault();
      addAfter(i);
    } else if (e.key === "Tab" && outline && i > 0 && !mod && !e.altKey) {
      e.preventDefault();
      shift(i, e.shiftKey ? -1 : 1);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !mod && !e.shiftKey) {
      e.preventDefault();
      if (e.altKey) move(i, e.key === "ArrowUp" ? -1 : 1);
      else {
        const target = rows[i + (e.key === "ArrowUp" ? -1 : 1)];
        if (target) inputs.current.get(`${target.id}:${field}`)?.focus();
      }
    } else if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      const row = rows[i];
      if (el.value !== "") return;
      e.preventDefault();
      if (f > 0) {
        inputs.current.get(`${row.id}:${fields[f - 1]}`)?.focus();
        return;
      }
      const blank = fields.every((x) => !(row[x] ?? "").trim());
      if (!blank) return;
      if (outline && i > 0 && (row.depth ?? 0) > depthRange(kind, rows, i).min) shift(i, -1);
      else remove(i);
    }
  };

  /** A list pasted into a row: one row per line (indented lines stay indented). */
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    const text = e.clipboardData.getData("text/plain");
    if (!/\n/.test(text.trim())) return;
    e.preventDefault();
    const { rows: pasted, title } = rowsFromText(kind, text);
    if (!pasted.length) return;
    const base = rows[i];
    const offset = outline ? Math.max(depthRange(kind, rows, i).min, base.depth ?? 0) : 0;
    const added = pasted.map((r) => withId(outline ? { ...r, depth: (r.depth ?? 0) + offset } : r));
    const blank = fields.every((x) => !(base[x] ?? "").trim());
    // An empty row is replaced; otherwise the rows go in below it.
    const keepCentre = kind === "mindmap" && i === 0;
    const next = blank && !keepCentre ? [...rows.slice(0, i), ...added, ...rows.slice(i + 1)] : [...rows.slice(0, i + 1), ...added, ...rows.slice(i + 1)];
    set(next, title && !draft.title ? { title } : undefined);
    focus(added[added.length - 1].id);
  };

  const shares = useMemo(() => (kind === "pie" ? pieShares(rows) : []), [kind, rows]);
  const percent = useMemo(() => new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const colours = useMemo(() => (kind === "mindmap" ? branches(rows) : []), [kind, rows]);
  const people = useMemo(
    () => (kind === "sequence" ? [...new Set(rows.flatMap((r) => [r.from ?? "", r.to ?? ""]).map((s) => s.trim()).filter(Boolean))] : []),
    [kind, rows],
  );

  const placeholder = (field: Field, i: number) => {
    if (field === "text") {
      if (kind === "mindmap") return i === 0 ? t.centre : t.placeholder.mindmap;
      if (kind === "flow" || kind === "cycle") return t.placeholder[kind];
      return kind === "timeline" ? t.placeholder.what : kind === "pie" ? t.placeholder.label : t.placeholder.message;
    }
    return field === "when" ? t.placeholder.when : field === "value" ? t.placeholder.value : field === "from" ? t.placeholder.from : t.placeholder.to;
  };

  const input = (row: EditRow, i: number, field: Field, className?: string) => (
    <input
      key={field}
      ref={(el) => {
        const key = `${row.id}:${field}`;
        if (el) inputs.current.set(key, el);
        else inputs.current.delete(key);
      }}
      value={row[field] ?? ""}
      onChange={(e) => update(i, { [field]: e.target.value })}
      onKeyDown={(e) => onKeyDown(e, i, field)}
      onPaste={field === "text" || field === "when" ? (e) => onPaste(e, i) : undefined}
      onFocus={() => setActive(row.id)}
      placeholder={placeholder(field, i)}
      aria-label={`${t.row(i + 1)}: ${placeholder(field, i)}`}
      list={field === "from" || field === "to" ? listId : undefined}
      inputMode={field === "value" ? "decimal" : undefined}
      enterKeyHint="next"
      autoComplete="off"
      spellCheck={field === "text"}
      className={cn("blob-drow-input", className)}
    />
  );

  const at = index(active);
  const activeRow = at >= 0 ? rows[at] : null;
  const range = activeRow ? depthRange(kind, rows, at) : null;

  return (
    <div className="blob-drows-wrap">
      {(kind === "timeline" || kind === "pie") && (
        <div className="blob-drows-head">
          <input
            value={draft.title ?? ""}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                onDone();
              } else if (e.key === "Enter" || e.key === "ArrowDown") {
                e.preventDefault();
                inputs.current.get(`${rows[0]?.id}:${fields[0]}`)?.focus();
              }
            }}
            placeholder={t.title}
            aria-label={t.title}
            className="blob-drow-input is-title"
          />
          {kind === "pie" && (
            <button type="button" className={cn("blob-chip", draft.showData && "is-on")} aria-pressed={!!draft.showData} onClick={() => onChange({ ...draft, showData: !draft.showData })}>
              {t.showData}
            </button>
          )}
        </div>
      )}

      <div className={cn("blob-drows", `is-${kind}`)} role="list" aria-label={t.kinds[kind].name}>
        {rows.map((row, i) => (
          <div
            key={row.id}
            role="listitem"
            className={cn("blob-drow", active === row.id && "is-active", kind === "mindmap" && i === 0 && "is-centre")}
            style={outline ? { paddingLeft: `${(row.depth ?? 0) * 1.35}rem` } : undefined}
          >
            {kind === "mindmap" && (
              <span
                className="blob-drow-dot"
                aria-hidden
                style={{ background: i === 0 ? "var(--blob)" : `var(${SECTION_VARS[(colours[i] + 1) % SECTION_VARS.length]})` }}
              />
            )}
            {kind === "flow" && <ShapeButton row={row} onChange={(shape) => update(i, { shape })} />}
            {kind === "cycle" && (
              <span className="blob-drow-num" aria-hidden>
                {i + 1}
              </span>
            )}
            {kind === "sequence" ? (
              <>
                {input(row, i, "from", "is-who")}
                <button
                  type="button"
                  className={cn("blob-drow-arrow", row.reply && "is-reply")}
                  aria-pressed={!!row.reply}
                  aria-label={t.reply}
                  title={t.reply}
                  onClick={() => update(i, { reply: !row.reply })}
                >
                  <ArrowRight className="size-3.5" />
                </button>
                {input(row, i, "to", "is-who")}
                {input(row, i, "text", "is-message")}
              </>
            ) : (
              fields.map((field) => input(row, i, field, field === "when" ? "is-when" : field === "value" ? "is-value" : undefined))
            )}
            {kind === "pie" && (
              <span className="blob-drow-share" aria-hidden>
                {shares[i] !== null && shares[i] !== undefined ? percent.format(shares[i]!) : ""}
              </span>
            )}
          </div>
        ))}
      </div>
      {kind === "sequence" && (
        <datalist id={listId}>
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}

      <div className="blob-drows-foot" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" className="blob-drows-add" onClick={() => addAfter(at >= 0 ? at : rows.length - 1)}>
          <Plus className="size-3.5" />
          {t.addRow}
        </button>
        {activeRow && (
          <div className="blob-drows-tools" role="group" aria-label={t.rowTools}>
            {outline && (
              <>
                <RowTool icon={IndentDecrease} label={t.outdent} disabled={!range || (activeRow.depth ?? 0) <= range.min} onClick={() => shift(at, -1)} />
                <RowTool icon={IndentIncrease} label={t.indent} disabled={!range || (activeRow.depth ?? 0) >= range.max} onClick={() => shift(at, 1)} />
              </>
            )}
            <RowTool icon={ArrowUp} label={t.moveUp} disabled={at <= (kind === "mindmap" ? 1 : 0)} onClick={() => move(at, -1)} />
            <RowTool icon={ArrowDown} label={t.moveDown} disabled={at >= rows.length - 1 || (kind === "mindmap" && at === 0)} onClick={() => move(at, 1)} />
            <RowTool icon={Trash2} label={t.removeRow} danger onClick={() => remove(at)} />
          </div>
        )}
      </div>
      <p className="blob-drows-keys">{outline ? t.keys : t.keysFlat}</p>
      {kind === "flow" && <p className="blob-drows-tip">{t.flowTip}</p>}
    </div>
  );
}

function RowTool({ icon: Icon, label, onClick, disabled, danger }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn("blob-drows-tool", danger && "is-danger")}>
      <Icon className="size-3.5" />
    </button>
  );
}

/** A process step's shape: automatic (a question mark makes a question), or one picked by clicking through. */
function ShapeButton({ row, onChange }: { row: DiagramRow; onChange: (shape: FlowShape) => void }) {
  const t = useMessages(noteBlocksText).diagram;
  const shape = row.shape ?? "auto";
  const Icon = SHAPE_ICONS[effectiveShape(row)];
  const next = FLOW_SHAPES[(FLOW_SHAPES.indexOf(shape) + 1) % FLOW_SHAPES.length];
  const name = shape === "auto" ? `${t.shapes.auto} (${t.shapes[effectiveShape(row)]})` : t.shapes[shape];
  return (
    <button
      type="button"
      className={cn("blob-drow-shape", shape === "auto" && "is-auto")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange(next)}
      aria-label={t.shape(name)}
      title={t.shape(name)}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
