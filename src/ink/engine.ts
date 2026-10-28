"use client";

// The handwriting surface: two canvases over a column of sheets. The base canvas shows the paper,
// the templates and the ink (from the tile cache); the "wet" canvas above it shows the stroke being
// drawn (low latency, redrawn as each pen sample arrives), the lasso and the pen's hover cursor.
//
// Input: a stylus draws (its side button or eraser end erases); fingers scroll and pinch to zoom,
// or draw when "draw with fingers" is on (or no pen was ever seen on this device). A pen near the
// screen, or a large touch (a palm), blocks fingers. Two fingers tapping undo, three redo. A mouse
// draws with the left button and scrolls with the wheel (ctrl + wheel zooms).
//
// Everything outside React: the editor (src/components/ink) sets tools and listens to `state`.

import { InkDoc, type Change } from "./doc";
import { applyPoint, applyPoints, centerline, cut, inPolygon, multiply, rotateAround, scaleAround, scaleOf, shareInside, touches, translate, type Affine } from "./geometry";
import { boxesTouch, encodeItem, newId, nextSeq, rotatedBox, seqBetween, SHEET_H, SHEET_W, textBoxHeight, tombstone, unionBox, type Box, type InkColor, type Item, type Paper, type PenTool, type Picture, type Sheet, type Stroke, type Template, type TextBox, type Thing } from "./model";
import { pencilOpacity, PENS, StrokeBuilder, type InputKind } from "./pens";
import { drawPaper, drawThing, inkColor, lookOf, type Images } from "./render";
import { recognize } from "./shapes";
import type { InkSync } from "./sync";
import { levelFor, levelScale, TILE, tileUnits, Tiles } from "./tiles";
import { clampView, columnHeight, fitScale, FOOT, MAX_ZOOM, MIN_ZOOM, PITCH, sheetAt, sheetTop, type View } from "./view";

export type Tool = PenTool | "eraser" | "lasso" | "text";
export type EraseMode = "stroke" | "area";
/** Fingers: "auto" draws until a pen is used on this device, then scrolls. */
export type FingerMode = "auto" | "draw" | "pan";

export type PenSetting = { color: InkColor; size: number };

export type Settings = {
  tool: Tool;
  pens: Record<PenTool, PenSetting>;
  eraser: { mode: EraseMode; size: number; highlighterOnly: boolean };
  fingers: FingerMode;
  /** Text boxes: size (units) and colour. */
  text: { size: number; color: InkColor };
};

export const DEFAULT_SETTINGS: Settings = {
  tool: "pen",
  pens: {
    pen: { color: "ink", size: PENS.pen.size },
    fountain: { color: "#1e3a8a", size: PENS.fountain.size },
    pencil: { color: "ink", size: PENS.pencil.size },
    calligraphy: { color: "ink", size: PENS.calligraphy.size },
    highlighter: { color: "#fde047", size: PENS.highlighter.size },
  },
  eraser: { mode: "stroke", size: 14, highlighterOnly: false },
  fingers: "auto",
  text: { size: 26, color: "ink" },
};

/** A selection's box on screen (CSS pixels, relative to the surface). */
export type ScreenRect = { x: number; y: number; w: number; h: number };

export type TextEdit = { id: string; isNew: boolean; text: string; rect: ScreenRect; fontPx: number; color: string };

export type EngineState = {
  /** The sheet in the middle of the screen, and how many there are. */
  page: number;
  pages: number;
  /** Zoomed in or out from the default size (rounded to whole percent). */
  zoomed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selection: { count: number; sheet: string; strokes: number } | null;
  /** The view is moving (floating buttons step aside). */
  moving: boolean;
  /** Fingers draw now (else they scroll). */
  fingersDraw: boolean;
  penSeen: boolean;
  text: { id: string; isNew: boolean } | null;
  /** A shape just snapped (a short moment, for a tiny animation). */
  snapped: number;
};

/** Where floating things go, every frame (CSS pixels in the surface). */
export type Frame = {
  view: View;
  zoom: number;
  /** The first sheet's top left corner and the column's width (the title sits above it). */
  head: { x: number; y: number; w: number };
  /** The "add a page" button under the last sheet. */
  foot: { x: number; y: number; w: number } | null;
  selection: ScreenRect | null;
  text: TextEdit | null;
};

type Pair = { id: string; before: Item | null; after: Item | null };

type Ptr = { id: number; kind: InputKind; x: number; y: number; sx: number; sy: number; t0: number };

type StrokeAction = {
  kind: "stroke";
  id: number;
  input: InputKind;
  sheet: Sheet;
  sheetIndex: number;
  tool: PenTool;
  color: InkColor;
  b: StrokeBuilder;
  predicted: [number, number][];
  /** Fingers: dropped if a second finger lands soon after (a pinch starting). */
  tentative: boolean;
  t0: number;
  /** Held still: snapped to a shape, which then follows the pen. */
  shape: { xs: number[]; ys: number[]; kind: string; cx: number; cy: number; gx: number; gy: number; line: boolean; width: number } | null;
  still: ReturnType<typeof setTimeout> | null;
  stillX: number;
  stillY: number;
};
type EraseAction = { kind: "erase"; id: number; x: number; y: number; pairs: Map<string, Pair> };
type LassoAction = { kind: "lasso"; id: number; sheetIndex: number; pts: number[] };
type PanAction = { kind: "pan"; id: number; sx: number; sy: number; tx: number; ty: number; samples: { x: number; y: number; t: number }[] };
type PinchAction = { kind: "pinch"; a: number; b: number; dist: number; mx: number; my: number; view: View };
type DragAction = { kind: "drag"; id: number; mode: "move" | "scale" | "rotate"; sx: number; sy: number; base: Affine; anchor: [number, number]; startAngle: number; startDist: number };
type TapAction = { kind: "tap"; id: number; x: number; y: number };
type Action = StrokeAction | EraseAction | LassoAction | PanAction | PinchAction | DragAction | TapAction;

type Selection = {
  sheet: string;
  ids: string[];
  /** Box of the selected things (sheet units), before `m`. */
  box: Box;
  /** The move/scale/turn being done (identity at rest). */
  m: Affine;
  /** The selected things drawn once, moved as one picture while dragged. */
  lifted: { canvas: OffscreenCanvas | HTMLCanvasElement; box: Box; scale: number } | null;
  /** After a drop: the picture stays until the tiles under it are drawn again. */
  settling: boolean;
};

const PEN_KEY = "blob-ink-pen";
const LONG_STROKE = 2500;

let clipboard: { items: Thing[]; box: Box } | null = null;

export class InkEngine {
  readonly doc: InkDoc;
  private sync: InkSync | null;
  readOnly: boolean;
  private root: HTMLElement;
  private base: HTMLCanvasElement;
  private wet: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private wctx: CanvasRenderingContext2D;
  private tiles: Tiles;
  private images: Images | null;
  private desync: boolean;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private rect = { left: 0, top: 0 };
  private coarse = false;
  private fit = 1;
  private view: View = { scale: 1, tx: 0, ty: 0 };
  private dark = false;
  settings: Settings = DEFAULT_SETTINGS;

  private history: Pair[][] = [];
  private future: Pair[][] = [];
  private pointers = new Map<number, Ptr>();
  private action: Action | null = null;
  /** Fingers on the screen since the first went down (two- and three-finger taps). */
  private taps: { t0: number; max: number; moved: boolean } | null = null;
  private hover: { x: number; y: number } | null = null;
  private lastPenAt = 0;
  private penSeen = false;
  private selection: Selection | null = null;
  private text: { item: TextBox; isNew: boolean } | null = null;
  private fling: number | null = null;
  private levelLock: number | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private frame: number | null = null;
  private wetDirty = false;
  private clearWetNext = false;
  private lastWetDraw = 0;
  private stops: (() => void)[] = [];
  private listeners = new Set<() => void>();
  private snapAt = 0;
  private placed = false;
  state: EngineState;

  constructor(root: HTMLElement, opts: { doc: InkDoc; sync: InkSync | null; readOnly: boolean; dark: boolean; images: Images | null }) {
    this.root = root;
    this.doc = opts.doc;
    this.sync = opts.sync;
    this.readOnly = opts.readOnly;
    this.dark = opts.dark;
    this.images = opts.images;
    this.base = document.createElement("canvas");
    this.wet = document.createElement("canvas");
    for (const c of [this.base, this.wet]) {
      c.style.position = "absolute";
      c.style.inset = "0";
      c.style.width = "100%";
      c.style.height = "100%";
      c.style.pointerEvents = "none";
      c.setAttribute("aria-hidden", "true");
      root.appendChild(c);
    }
    this.bctx = this.base.getContext("2d", { alpha: false })!;
    // Low latency: the browser may show the live stroke without waiting for the next frame.
    this.wctx = this.wet.getContext("2d", { desynchronized: true })!;
    this.desync = !!(this.wctx.getContextAttributes?.() as { desynchronized?: boolean } | undefined)?.desynchronized;
    this.tiles = new Tiles(this.doc, this.images);
    this.tiles.dark = this.dark;
    try {
      this.penSeen = localStorage.getItem(PEN_KEY) === "1";
    } catch {
      this.penSeen = false;
    }
    this.coarse = matchMedia("(pointer: coarse)").matches;
    this.state = this.snapshot();

    this.stops.push(this.doc.subscribe((c) => this.onDoc(c)));
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(root);
    this.stops.push(() => ro.disconnect());
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
      root.addEventListener(type, fn as EventListener, opt);
      this.stops.push(() => root.removeEventListener(type, fn as EventListener, opt));
    };
    on("pointerdown", (e) => this.down(e));
    on("pointermove", (e) => this.move(e));
    on("pointerup", (e) => this.up(e, false));
    on("pointercancel", (e) => this.up(e, true));
    // Capture lost without an up (the element went away, the system took the pointer): ended.
    on("lostpointercapture", (e) => {
      if (this.pointers.has(e.pointerId)) this.up(e, true);
    });
    on("pointerleave", (e) => {
      if (e.pointerType === "pen" && !this.pointers.has(e.pointerId)) this.setHover(null);
    });
    on("wheel", (e) => this.wheel(e), { passive: false });
    on("contextmenu", (e) => e.preventDefault());
    // Stop the browser from turning touches into scrolling, zooming or text selection.
    on("touchstart", (e) => e.preventDefault(), { passive: false });
    on("dblclick", (e) => e.preventDefault());
    this.resize();
  }

  destroy() {
    this.stops.forEach((fn) => fn());
    this.stops = [];
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.fling) cancelAnimationFrame(this.fling);
    if (this.settle) clearTimeout(this.settle);
    this.tiles.clear();
    this.base.remove();
    this.wet.remove();
    this.listeners.clear();
  }

  // State for the editor ------------------------------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = () => this.state;

  private snapshot(): EngineState {
    const sel = this.selection;
    const selection = sel && !this.text ? { count: sel.ids.length, sheet: sel.sheet, strokes: sel.ids.filter((id) => this.doc.get(id)?.kind === "stroke").length } : null;
    return {
      page: this.currentPage(),
      pages: this.doc.sheets.length,
      zoomed: Math.round((this.view.scale / this.fit) * 100) !== 100,
      canUndo: this.history.length > 0,
      canRedo: this.future.length > 0,
      selection,
      moving: !!this.fling || this.action?.kind === "pan" || this.action?.kind === "pinch" || this.action?.kind === "drag",
      fingersDraw: this.fingersDraw(),
      penSeen: this.penSeen,
      text: this.text ? { id: this.text.item.id, isNew: this.text.isNew } : null,
      snapped: this.snapAt,
    };
  }

  private publish() {
    this.frameDirty = true;
    this.request();
    const next = this.snapshot();
    const prev = this.state;
    const same =
      prev.page === next.page &&
      prev.pages === next.pages &&
      prev.zoomed === next.zoomed &&
      prev.canUndo === next.canUndo &&
      prev.canRedo === next.canRedo &&
      prev.moving === next.moving &&
      prev.fingersDraw === next.fingersDraw &&
      prev.penSeen === next.penSeen &&
      prev.snapped === next.snapped &&
      JSON.stringify(prev.selection) === JSON.stringify(next.selection) &&
      JSON.stringify(prev.text) === JSON.stringify(next.text);
    if (same) return;
    this.state = next;
    this.listeners.forEach((fn) => fn());
  }

  // Floating things follow the view every frame, without React.
  private frameListeners = new Set<(f: Frame) => void>();
  private frameDirty = true;

  onFrame(fn: (f: Frame) => void) {
    this.frameListeners.add(fn);
    fn(this.frameInfo());
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  /** Space above the first sheet (the title, a toolbar on top) and under the last (a toolbar at the bottom), CSS pixels. */
  private head = 0;
  private tail = 0;
  /** The screen's edges under floating bars (nothing being typed should hide there). */
  private cover = { top: 0, bottom: 0 };

  /** Bars floating over the top and bottom of the surface, and room for a title above the first sheet. */
  setInsets(top: number, bottom: number, title: number) {
    this.cover = { top, bottom };
    const head = title + top;
    if (head === this.head && bottom === this.tail) return;
    const atTop = this.view.ty >= this.clamp(this.view).ty - 1 && this.view.ty >= this.head - 1;
    this.head = head;
    this.tail = bottom;
    // At the top it stays at the top (the title shows); elsewhere the view stays where it is.
    this.view = atTop ? this.clamp({ ...this.view, ty: 1e9 }) : this.clamp(this.view);
    this.request();
    this.publish();
  }

  private frameInfo(): Frame {
    const { scale, tx, ty } = this.view;
    const n = this.doc.sheets.length;
    return {
      view: { ...this.view },
      zoom: scale / this.fit,
      head: { x: tx, y: ty, w: SHEET_W * scale },
      foot: n && !this.readOnly ? { x: tx, y: sheetTop(n) * scale + ty - 6, w: SHEET_W * scale } : null,
      selection: this.selection && !this.text && !(this.action?.kind === "drag") ? this.selectionRect(this.selection) : null,
      text: this.textState(),
    };
  }

  private fingersDraw() {
    if (this.readOnly) return false;
    if (this.settings.fingers === "draw") return true;
    if (this.settings.fingers === "pan") return false;
    return !this.penSeen;
  }

  // Settings ------------------------------------------------------------------------------------

  setSettings(next: Settings) {
    const toolChanged = next.tool !== this.settings.tool;
    this.settings = next;
    if (toolChanged && this.selection && next.tool !== "lasso") this.clearSelection();
    if (toolChanged && this.text) this.finishText();
    this.drawWet();
    this.publish();
  }

  setDark(dark: boolean) {
    if (dark === this.dark) return;
    this.dark = dark;
    this.tiles.dark = dark;
    this.tiles.invalidateAll();
    this.request();
  }

  setReadOnly(readOnly: boolean) {
    this.readOnly = readOnly;
    if (readOnly) {
      this.clearSelection();
      this.cancelAction();
    }
    this.publish();
  }

  /** A picture finished loading: draw it. */
  imageLoaded(path: string) {
    for (const s of this.doc.sheets) {
      for (const t of this.doc.on(s.id)) if (t.kind === "image" && t.path === path) this.tiles.invalidate(s.id, t.box);
    }
    this.request();
  }

  // Layout --------------------------------------------------------------------------------------

  private resize() {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    const firstTime = !this.width;
    // Keep what is in the middle of the screen in the middle.
    const cx = (this.width / 2 - this.view.tx) / this.view.scale;
    const cy = (this.height / 2 - this.view.ty) / this.view.scale;
    const zoom = this.view.scale / this.fit;
    const oldWidth = this.width;
    const oldDpr = this.dpr;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.rect = { left: r.left, top: r.top };
    for (const c of [this.base, this.wet]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    this.coarse = matchMedia("(pointer: coarse)").matches;
    this.fit = fitScale({ width: w, height: h }, this.coarse);
    // About 2.5 screens of tiles.
    this.tiles.max = Math.max(24, Math.min(80, Math.ceil(((w * dpr) / TILE + 1) * ((h * dpr) / TILE + 1) * 2.5)));
    if (firstTime || !this.placed) {
      this.view = this.clamp({ scale: this.fit, tx: 0, ty: 1e9 });
    } else if (w === oldWidth) {
      // Only the height changed (a keyboard came or went): the top stays where it is.
      this.view = this.clamp(this.view);
      if (this.text) this.revealText();
    } else {
      const scale = this.fit * zoom;
      this.view = this.clamp({ scale, tx: w / 2 - cx * scale, ty: h / 2 - cy * scale });
    }
    // Tiles are drawn for the sheets at zoom levels, not for the screen: only a new pixel density
    // needs them again.
    if (dpr !== oldDpr) this.tiles.invalidateAll();
    this.request();
    this.publish();
  }

  /** Puts the view where it was (zoom and the sheet at the top), once the note is loaded. */
  place(pos: { page: number; offset: number; zoom: number } | null) {
    this.placed = true;
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pos?.zoom ?? 1)) * this.fit;
    const page = Math.min(Math.max(0, pos?.page ?? 0), Math.max(0, this.doc.sheets.length - 1));
    // Above the first sheet's top means at the top, with the title (whatever room it has now).
    const top = !pos || (page === 0 && pos.offset < 0);
    const ty = top ? 1e9 : -(sheetTop(page) + pos.offset) * scale;
    this.view = this.clamp({ scale, tx: 0, ty });
    this.request();
    this.publish();
  }

  /** Where the view is (to come back to it): the sheet at the top, how far into it, the zoom. */
  position() {
    if (!this.placed) return null;
    const top = -this.view.ty / this.view.scale;
    const page = sheetAt(top, this.doc.sheets.length);
    return { page: Math.max(0, page), offset: top - sheetTop(Math.max(0, page)), zoom: this.view.scale / this.fit };
  }

  private clamp(v: View, give = 0): View {
    return clampView(v, { width: this.width, height: this.height }, this.doc.sheets.length, give, this.head, this.tail);
  }

  private currentPage() {
    const n = this.doc.sheets.length;
    if (!n) return 0;
    return sheetAt((this.height / 2 - this.view.ty) / this.view.scale, n);
  }

  /** Screen (CSS px in the surface) → doc units. */
  private toDoc(x: number, y: number): [number, number] {
    return [(x - this.view.tx) / this.view.scale, (y - this.view.ty) / this.view.scale];
  }

  private local(e: { clientX: number; clientY: number }): [number, number] {
    return [e.clientX - this.rect.left, e.clientY - this.rect.top];
  }

  // Doc changes --------------------------------------------------------------------------------

  private onDoc(c: Change) {
    if (c.all) this.tiles.invalidateAll();
    if (c.sheets) {
      const ids = new Set(this.doc.sheets.map((s) => s.id));
      for (const [id] of this.sheetCache) if (!ids.has(id)) this.tiles.drop(id);
      // Tiles belong to their sheet (moving sheets around doesn't change them); only ink colours
      // change, when the paper turns dark or light.
      for (const s of this.doc.sheets) {
        const old = this.sheetCache.get(s.id);
        if (old && old.paper !== s.paper && lookOf(old.paper, this.dark).dark !== lookOf(s.paper, this.dark).dark) this.tiles.invalidate(s.id, { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 });
      }
      this.sheetCache = new Map(this.doc.sheets.map((s) => [s.id, s]));
      if (this.selection && !ids.has(this.selection.sheet)) this.selection = null;
      this.view = this.clamp(this.view);
    }
    for (const [sheet, boxes] of c.dirty) for (const b of boxes) this.tiles.invalidate(sheet, b);
    if (c.top.length) this.tiles.paint(c.top);
    if (this.selection) {
      // Things removed elsewhere drop out of the selection.
      const ids = this.selection.ids.filter((id) => this.doc.has(id));
      if (!ids.length) this.selection = null;
      else if (ids.length !== this.selection.ids.length) this.selection = { ...this.selection, ids, box: this.boxOf(ids) };
    }
    this.request();
    this.publish();
  }

  private sheetCache = new Map<string, Sheet>();

  // Editing --------------------------------------------------------------------------------------

  /** Applies changes, sends them and makes them undoable (merged into the last step with `merge`). */
  private commit(pairs: Pair[], opts: { merge?: boolean; history?: boolean } = {}) {
    if (!pairs.length) return;
    const puts: Item[] = [];
    const removes: string[] = [];
    for (const p of pairs) {
      if (p.after) puts.push(p.after);
      else removes.push(p.id);
    }
    this.doc.apply(puts, removes);
    this.send(pairs);
    if (opts.history === false) return;
    this.future = [];
    if (opts.merge && this.history.length) {
      const last = this.history[this.history.length - 1];
      const byId = new Map(last.map((p) => [p.id, p]));
      for (const p of pairs) {
        const prev = byId.get(p.id);
        if (prev) prev.after = p.after;
        else {
          last.push(p);
          byId.set(p.id, p);
        }
      }
    } else {
      this.history.push(pairs);
      if (this.history.length > 200) this.history.shift();
    }
    this.publish();
  }

  private send(pairs: Pair[]) {
    if (!this.sync) return;
    const wire = pairs.map((p) => (p.after ? encodeItem(p.after) : p.before ? tombstone(p.before) : null)).filter((w): w is NonNullable<typeof w> => !!w);
    this.sync.local(wire);
  }

  undo() {
    if (this.action) this.cancelAction();
    if (this.text) this.finishText();
    const step = this.history.pop();
    if (!step) return;
    this.clearSelection();
    const back = step.map((p) => ({ id: p.id, before: p.after, after: p.before }));
    this.commit(back, { history: false });
    this.future.push(step);
    this.publish();
  }

  redo() {
    if (this.action) this.cancelAction();
    const step = this.future.pop();
    if (!step) return;
    this.clearSelection();
    this.commit(step, { history: false });
    this.history.push(step);
    this.publish();
  }

  /** The note's first sheet, made when a new note opens empty (its id is the page's, so two devices agree). */
  ensureSheet(pageId: string, tpl: Template = "lined") {
    if (this.readOnly || this.doc.sheets.length) return;
    const sheet: Sheet = { kind: "sheet", id: pageId, seq: 1, tpl, paper: "auto" };
    this.commit([{ id: sheet.id, before: null, after: sheet }], { history: false });
  }

  // Sheets ---------------------------------------------------------------------------------------

  addSheet(afterIndex = this.doc.sheets.length - 1, style?: { tpl: Template; paper: Paper }) {
    if (this.readOnly) return;
    const sheets = this.doc.sheets;
    const prev = sheets[afterIndex] ?? sheets[sheets.length - 1];
    const next = sheets[afterIndex + 1] ?? null;
    const like = style ?? (prev ? { tpl: prev.tpl, paper: prev.paper } : { tpl: "lined" as Template, paper: "auto" as Paper });
    const sheet: Sheet = { kind: "sheet", id: newId(), seq: seqBetween(prev?.seq ?? null, next?.seq ?? null), tpl: like.tpl, paper: like.paper };
    this.commit([{ id: sheet.id, before: null, after: sheet }]);
    return sheet;
  }

  deleteSheet(id: string) {
    if (this.readOnly || this.doc.sheets.length <= 1) return;
    const sheet = this.doc.get(id);
    if (!sheet || sheet.kind !== "sheet") return;
    const pairs: Pair[] = this.doc.on(id).map((t) => ({ id: t.id, before: t, after: null }));
    pairs.push({ id, before: sheet, after: null });
    if (this.selection?.sheet === id) this.clearSelection();
    this.commit(pairs);
  }

  duplicateSheet(id: string) {
    if (this.readOnly) return;
    const i = this.doc.sheetIndex(id);
    const sheet = this.doc.sheets[i];
    if (!sheet) return;
    const next = this.doc.sheets[i + 1] ?? null;
    const copy: Sheet = { ...sheet, id: newId(), seq: seqBetween(sheet.seq, next?.seq ?? null) };
    const pairs: Pair[] = [{ id: copy.id, before: null, after: copy }];
    for (const t of this.doc.on(id)) {
      const c = { ...t, id: newId(), sheet: copy.id } as Thing;
      pairs.push({ id: c.id, before: null, after: c });
    }
    this.commit(pairs);
  }

  moveSheet(id: string, to: number) {
    if (this.readOnly) return;
    const sheets = this.doc.sheets.filter((s) => s.id !== id);
    const sheet = this.doc.get(id);
    if (!sheet || sheet.kind !== "sheet") return;
    to = Math.max(0, Math.min(sheets.length, to));
    const seq = seqBetween(sheets[to - 1]?.seq ?? null, sheets[to]?.seq ?? null);
    this.commit([{ id, before: sheet, after: { ...sheet, seq } }]);
  }

  /** Template and paper for some sheets (or all). */
  styleSheets(ids: string[] | "all", style: { tpl?: Template; paper?: Paper }) {
    if (this.readOnly) return;
    const list = ids === "all" ? this.doc.sheets : this.doc.sheets.filter((s) => ids.includes(s.id));
    const pairs = list.filter((s) => (style.tpl && s.tpl !== style.tpl) || (style.paper && s.paper !== style.paper)).map((s) => ({ id: s.id, before: s as Item, after: { ...s, ...style } as Item }));
    this.commit(pairs);
  }

  /** Removes everything on a sheet. */
  clearSheet(id: string) {
    if (this.readOnly) return;
    this.clearSelection();
    this.commit(this.doc.on(id).map((t) => ({ id: t.id, before: t, after: null })));
  }

  /** Scrolls so the sheet's top shows. */
  goToSheet(index: number, smooth = true) {
    const scale = this.view.scale;
    // The first sheet with the title above it; the others just under the toolbar.
    const target = this.clamp({ scale, tx: this.view.tx, ty: index === 0 ? 1e9 : -(sheetTop(index) * scale) + 16 + this.cover.top });
    if (!smooth) {
      this.view = target;
      this.request();
      this.publish();
      return;
    }
    this.animateTo(target);
  }

  private animateTo(target: View, ms = 280) {
    if (this.fling) cancelAnimationFrame(this.fling);
    const from = { ...this.view };
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = 1 - Math.pow(1 - t, 3);
      this.view = { scale: from.scale + (target.scale - from.scale) * k, tx: from.tx + (target.tx - from.tx) * k, ty: from.ty + (target.ty - from.ty) * k };
      this.request();
      if (t < 1) this.fling = requestAnimationFrame(step);
      else {
        this.fling = null;
        this.settled();
      }
      this.publish();
    };
    this.fling = requestAnimationFrame(step);
  }

  zoomBy(factor: number, at?: [number, number]) {
    const [x, y] = at ?? [this.width / 2, this.height / 2];
    const scale = Math.min(MAX_ZOOM * this.fit, Math.max(MIN_ZOOM * this.fit, this.view.scale * factor));
    const [dx, dy] = this.toDoc(x, y);
    this.animateTo(this.clamp({ scale, tx: x - dx * scale, ty: y - dy * scale }), 200);
  }

  /** Back to the default size, keeping the middle of the screen. */
  resetZoom() {
    const [dx, dy] = this.toDoc(this.width / 2, this.height / 2);
    const scale = this.fit;
    this.animateTo(this.clamp({ scale, tx: this.width / 2 - dx * scale, ty: this.height / 2 - dy * scale }), 240);
  }

  // Things -------------------------------------------------------------------------------------

  /** A picture (already uploaded) in the middle of the screen's sheet, sized to fit. */
  insertPicture(path: string, w: number, h: number) {
    if (this.readOnly) return;
    const i = this.currentPage();
    const sheet = this.doc.sheets[i];
    if (!sheet) return;
    const maxW = SHEET_W * 0.7;
    const maxH = SHEET_H * 0.45;
    const k = Math.min(1, maxW / w, maxH / h);
    const pw = w * k;
    const ph = h * k;
    const [, my] = this.toDoc(this.width / 2, this.height / 2);
    const cy = Math.min(SHEET_H - ph / 2 - 20, Math.max(ph / 2 + 20, my - sheetTop(i)));
    const x = (SHEET_W - pw) / 2;
    const y = cy - ph / 2;
    const pic: Picture = { kind: "image", id: newId(), sheet: sheet.id, seq: nextSeq(), path, x, y, w: pw, h: ph, rot: 0, box: rotatedBox(x, y, pw, ph, 0) };
    this.commit([{ id: pic.id, before: null, after: pic }]);
    this.select(sheet.id, [pic.id]);
  }

  // Selection ------------------------------------------------------------------------------------

  private boxOf(ids: string[]): Box {
    let b: Box | null = null;
    for (const id of ids) {
      const t = this.doc.get(id);
      if (t && t.kind !== "sheet") b = b ? unionBox(b, t.box) : t.box;
    }
    return b ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  private select(sheet: string, ids: string[]) {
    this.selection = ids.length ? { sheet, ids, box: this.boxOf(ids), m: [1, 0, 0, 1, 0, 0], lifted: null, settling: false } : null;
    this.request();
    this.publish();
  }

  clearSelection() {
    if (!this.selection) return;
    const sel = this.selection;
    this.selection = null;
    if (sel.lifted) {
      this.tiles.hidden = new Set();
      this.tiles.invalidate(sel.sheet, sel.box);
    }
    this.request();
    this.publish();
  }

  /** The selection's corners on screen (with its current move/scale/turn). */
  private selectionCorners(sel: Selection): [number, number][] {
    const top = sheetTop(this.doc.sheetIndex(sel.sheet));
    const b = sel.box;
    return [
      [b.x0, b.y0],
      [b.x1, b.y0],
      [b.x1, b.y1],
      [b.x0, b.y1],
    ].map(([x, y]) => {
      const [mx, my] = applyPoint(sel.m, x, y);
      return [mx * this.view.scale + this.view.tx, (my + top) * this.view.scale + this.view.ty] as [number, number];
    });
  }

  private selectionRect(sel: Selection): ScreenRect | null {
    if (this.doc.sheetIndex(sel.sheet) < 0) return null;
    const c = this.selectionCorners(sel);
    const xs = c.map((p) => p[0]);
    const ys = c.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  deleteSelection() {
    const sel = this.selection;
    if (!sel || this.readOnly) return;
    this.clearSelection();
    this.commit(sel.ids.map((id) => ({ id, before: this.doc.get(id) ?? null, after: null })).filter((p) => p.before));
  }

  copySelection() {
    const sel = this.selection;
    if (!sel) return;
    clipboard = { items: sel.ids.map((id) => this.doc.get(id)).filter((t): t is Thing => !!t && t.kind !== "sheet"), box: sel.box };
  }

  cutSelection() {
    this.copySelection();
    this.deleteSelection();
  }

  get canPaste() {
    return !!clipboard?.items.length && !this.readOnly;
  }

  /** Pastes what was copied onto the sheet in view (a little offset when it would land on itself). */
  paste() {
    if (!clipboard || this.readOnly) return;
    const i = this.currentPage();
    const sheet = this.doc.sheets[i];
    if (!sheet) return;
    const [mx, my] = this.toDoc(this.width / 2, this.height / 2);
    const b = clipboard.box;
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    let dx = Math.min(SHEET_W, Math.max(0, mx)) - cx;
    let dy = Math.min(SHEET_H, Math.max(0, my - sheetTop(i))) - cy;
    // Where it came from, when that is in view: next to the original.
    const inView = (my - sheetTop(i)) > b.y0 - 400 && (my - sheetTop(i)) < b.y1 + 400;
    if (inView) {
      dx = 24;
      dy = 24;
    }
    const m = translate(dx, dy);
    const pairs: Pair[] = [];
    const ids: string[] = [];
    let seq = nextSeq();
    for (const t of clipboard.items) {
      const moved = this.transformed(t, m);
      const c = { ...moved, id: newId(), sheet: sheet.id, seq: (seq += 0.001) } as Thing;
      pairs.push({ id: c.id, before: null, after: c });
      ids.push(c.id);
    }
    this.commit(pairs);
    this.select(sheet.id, ids);
  }

  duplicateSelection() {
    this.copySelection();
    this.paste();
  }

  /** Colours the selected strokes and text. */
  recolorSelection(color: InkColor) {
    const sel = this.selection;
    if (!sel || this.readOnly) return;
    const pairs: Pair[] = [];
    for (const id of sel.ids) {
      const t = this.doc.get(id);
      if (t?.kind === "stroke" && t.color !== color) pairs.push({ id, before: t, after: { ...t, color } });
      if (t?.kind === "text" && t.color !== color) pairs.push({ id, before: t, after: { ...t, color } });
    }
    this.commit(pairs);
    this.select(sel.sheet, sel.ids);
  }

  /** A thing moved/scaled/turned by m (its box worked out again). */
  private transformed(t: Thing, m: Affine): Thing {
    if (t.kind === "stroke") {
      const p = applyPoints(m, t.xs, t.ys, t.ws);
      const box = boxOfPoints(p.xs, p.ys, p.ws);
      return { ...t, ...p, box, size: t.size * scaleOf(m) };
    }
    const s = scaleOf(m);
    const rot = Math.atan2(m[1], m[0]);
    if (t.kind === "image") {
      const [cx, cy] = applyPoint(m, t.x + t.w / 2, t.y + t.h / 2);
      const w = t.w * s;
      const h = t.h * s;
      const r = t.rot + rot;
      return { ...t, x: cx - w / 2, y: cy - h / 2, w, h, rot: r, box: rotatedBox(cx - w / 2, cy - h / 2, w, h, r) };
    }
    const [x, y] = applyPoint(m, t.x, t.y);
    const w = t.w * s;
    const fs = t.fs * s;
    return { ...t, x, y, w, fs, box: { x0: x, y0: y, x1: x + w, y1: y + textBoxHeight(t.text, w, fs) } };
  }

  // Text boxes --------------------------------------------------------------------------------

  private textState(): TextEdit | null {
    const t = this.text;
    if (!t) return null;
    const i = this.doc.sheetIndex(t.item.sheet);
    if (i < 0) return null;
    const s = this.view.scale;
    const top = sheetTop(i);
    return {
      id: t.item.id,
      isNew: t.isNew,
      text: t.item.text,
      rect: { x: t.item.x * s + this.view.tx, y: (t.item.y + top) * s + this.view.ty, w: t.item.w * s, h: Math.max(t.item.fs * 1.4, t.item.box.y1 - t.item.box.y0) * s },
      fontPx: t.item.fs * s,
      color: inkColor(t.item.color, lookOf(this.doc.sheets[i].paper, this.dark).dark),
    };
  }

  private startText(sheetIndex: number, x: number, y: number) {
    const sheet = this.doc.sheets[sheetIndex];
    if (!sheet) return;
    const hit = [...this.doc.on(sheet.id)].reverse().find((t): t is TextBox => t.kind === "text" && x >= t.box.x0 && x <= t.box.x1 && y >= t.box.y0 && y <= t.box.y1);
    if (hit) {
      this.text = { item: hit, isNew: false };
    } else {
      const fs = this.settings.text.size;
      // As wide as fits on the sheet, and on the screen (zoomed in, it scrolls into sight below).
      const w = Math.min(560, SHEET_W - x - 20, (this.width - 24) / this.view.scale);
      if (w < 60) return;
      const item: TextBox = { kind: "text", id: newId(), sheet: sheet.id, seq: nextSeq(), text: "", x, y: y - fs * 0.6, w, fs, color: this.settings.text.color, box: { x0: x, y0: y, x1: x + w, y1: y + fs * 1.35 } };
      this.text = { item, isNew: true };
    }
    this.caret = 1;
    this.tiles.hidden = new Set([this.text.item.id]);
    this.tiles.invalidate(sheet.id, this.text.item.box);
    this.revealText();
    this.request();
    this.publish();
  }

  /** How far into the text being typed the caret is (0–1, by characters: about where its line is). */
  private caret = 1;

  /** The text being typed (shown by the editor's text field until it is done). */
  updateText(text: string, heightPx?: number, caret = 1) {
    const t = this.text;
    if (!t) return;
    const h = heightPx ? heightPx / this.view.scale : textBoxHeight(text, t.item.w, t.item.fs);
    t.item = { ...t.item, text, box: { x0: t.item.x, y0: t.item.y, x1: t.item.x + t.item.w, y1: t.item.y + h } };
    this.caret = caret;
    this.revealText();
    this.publish();
  }

  /** Scrolls the caret's line into sight (the box grows a line at a time; a keyboard may cover the bottom). */
  private revealText() {
    const st = this.textState();
    if (!st || this.action) return;
    const r = st.rect;
    const line = st.fontPx * 1.35;
    const top = this.cover.top + 12;
    const bottom = this.height - this.cover.bottom - 12;
    const y = r.y + Math.max(line, r.h * this.caret);
    const dy = y > bottom ? y - bottom : y - line < top ? y - line - top : 0;
    // The box's right edge too, when it fits; never its left edge out of sight.
    const dx = Math.max(0, Math.min(r.x + r.w - (this.width - 12), r.x - 12));
    if (Math.abs(dy) <= 0.5 && dx <= 0.5) return;
    this.view = this.clamp({ ...this.view, tx: this.view.tx - dx, ty: this.view.ty - dy });
    this.request();
    this.publish();
  }

  finishText() {
    const t = this.text;
    if (!t) return;
    this.text = null;
    this.tiles.hidden = new Set();
    const text = t.item.text.replace(/\s+$/, "");
    const before = t.isNew ? null : (this.doc.get(t.item.id) ?? null);
    if (!text) {
      if (before) this.commit([{ id: t.item.id, before, after: null }]);
    } else {
      const item: TextBox = { ...t.item, text, box: { ...t.item.box, y1: t.item.y + textBoxHeight(text, t.item.w, t.item.fs) } };
      if (!before || before.kind !== "text" || before.text !== text) this.commit([{ id: item.id, before, after: item }]);
    }
    this.tiles.invalidate(t.item.sheet, unionBox(t.item.box, { x0: t.item.x, y0: t.item.y, x1: t.item.x + t.item.w, y1: t.item.y + 4000 }));
    this.request();
    this.publish();
  }

  // Input ----------------------------------------------------------------------------------------

  private markPen() {
    this.lastPenAt = performance.now();
    if (this.penSeen) return;
    this.penSeen = true;
    try {
      localStorage.setItem(PEN_KEY, "1");
    } catch {
      // Private window: remembered for this visit only.
    }
    this.publish();
  }

  /**
   * A palm or a resting hand: while the pen writes every touch is; while it hovers, touches near it
   * (the hand holding it); a very large contact always is. A finger elsewhere still scrolls.
   */
  private palm(e: PointerEvent) {
    if (e.pointerType !== "touch") return false;
    for (const p of this.pointers.values()) if (p.kind === "pen") return true;
    if (Math.max(e.width || 0, e.height || 0) > 46) return true;
    if (performance.now() - this.lastPenAt < 600) {
      const [x, y] = this.local(e);
      const at = this.penAt;
      if (!at || Math.hypot(x - at[0], y - at[1]) < 380 || y > at[1] - 40) return true;
    }
    return false;
  }

  /** Where the pen last was (CSS pixels). */
  private penAt: [number, number] | null = null;

  private down(e: PointerEvent) {
    const kind = (e.pointerType === "pen" || e.pointerType === "touch" ? e.pointerType : "mouse") as InputKind;
    this.rect = this.root.getBoundingClientRect();
    if (kind === "pen") {
      this.markPen();
      this.setHover(null);
      this.penAt = this.local(e);
      // The pen takes over from fingers (drawing, scrolling or zooming).
      const a = this.action;
      if (a?.kind === "stroke" && a.input === "touch") this.cancelAction();
      else if (a?.kind === "pan" || a?.kind === "pinch") {
        this.action = null;
        this.settled();
      }
    }
    // The first finger (or pen) of a new touch: whatever of that kind is still listed lost its up,
    // and what it was doing ends here (else nothing could be written any more).
    if (e.isPrimary) {
      for (const [id, p] of this.pointers) if (p.kind === kind && id !== e.pointerId) this.pointers.delete(id);
      const a = this.action;
      const lost = a ? (a.kind === "pinch" ? [a.a, a.b] : [a.id]).find((id) => !this.pointers.has(id)) : undefined;
      if (lost !== undefined) this.up({ pointerId: lost, pointerType: "" } as PointerEvent, true);
    }
    if (this.palm(e)) return;
    if (this.fling) {
      cancelAnimationFrame(this.fling);
      this.fling = null;
    }
    const [x, y] = this.local(e);
    const ptr: Ptr = { id: e.pointerId, kind, x, y, sx: x, sy: y, t0: performance.now() };
    this.pointers.set(e.pointerId, ptr);
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests can't be captured.
    }
    if (kind === "touch") {
      const touches = [...this.pointers.values()].filter((p) => p.kind === "touch");
      if (touches.length === 1) this.taps = { t0: performance.now(), max: 1, moved: false };
      else if (this.taps) this.taps.max = Math.max(this.taps.max, touches.length);
      if (touches.length >= 2) {
        // A second finger: zoom and scroll (a stroke the first finger only just began is dropped).
        if (this.action?.kind === "stroke" && this.action.input === "touch") {
          if (this.action.tentative || performance.now() - this.action.t0 < 250) this.cancelAction();
          else return;
        } else if (this.action && this.action.kind !== "pan" && this.action.kind !== "pinch") return;
        const [a, b] = touches.slice(-2);
        this.startPinch(a, b);
        return;
      }
      if (!this.fingersDraw()) {
        if (this.selectionHit(x, y)) this.startDrag(e.pointerId, x, y);
        else this.startPan(e.pointerId, x, y);
        return;
      }
    }
    if (kind === "mouse" && (e.button === 1 || e.button === 2 || this.space)) {
      this.startPan(e.pointerId, x, y);
      return;
    }
    if (kind === "mouse" && e.button !== 0) return;
    if (this.action) return;
    if (this.readOnly) {
      this.startPan(e.pointerId, x, y);
      return;
    }
    // The pen's eraser end, or its side button held: erase.
    const eraser = kind === "pen" && (e.button === 5 || (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0);
    const tool: Tool = eraser ? "eraser" : this.settings.tool;
    if (this.text) {
      this.finishText();
      if (tool === "text") return;
    }
    if (this.selection) {
      if (this.selectionHit(x, y)) {
        this.startDrag(e.pointerId, x, y);
        return;
      }
      this.clearSelection();
      if (tool !== "lasso") return;
    }
    const [dx, dy] = this.toDoc(x, y);
    const n = this.doc.sheets.length;
    if (!n) return;
    const index = sheetAt(dy, n);
    // Only on (or right beside) a sheet.
    if (dx < -20 || dx > SHEET_W + 20) {
      this.startPan(e.pointerId, x, y);
      return;
    }
    if (tool === "eraser") {
      this.action = { kind: "erase", id: e.pointerId, x: dx, y: dy, pairs: new Map() };
      this.eraseTo(dx, dy);
    } else if (tool === "lasso") {
      this.action = { kind: "lasso", id: e.pointerId, sheetIndex: index, pts: [dx, dy] };
    } else if (tool === "text") {
      this.action = { kind: "tap", id: e.pointerId, x: dx, y: dy };
    } else {
      this.startStroke(e, kind, tool, index, dx, dy);
    }
    this.request();
  }

  private space = false;
  /** Space held (desktops): the mouse scrolls instead of drawing. */
  setSpace(held: boolean) {
    this.space = held;
  }

  private startStroke(e: PointerEvent, kind: InputKind, tool: PenTool, index: number, dx: number, dy: number) {
    const sheet = this.doc.sheets[index];
    const pen = this.settings.pens[tool];
    const b = new StrokeBuilder(tool, pen.size, kind, this.view.scale);
    const top = sheetTop(index);
    b.add(dx, dy - top, e.pressure, e.timeStamp);
    this.action = { kind: "stroke", id: e.pointerId, input: kind, sheet, sheetIndex: index, tool, color: pen.color, b, predicted: [], tentative: kind === "touch", t0: performance.now(), shape: null, still: null, stillX: dx, stillY: dy };
    this.armStill();
    this.drawWet(true);
  }

  private move(e: PointerEvent) {
    const kind = e.pointerType;
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) {
      // A pen near the screen: show where it would write, and keep fingers away.
      if (kind === "pen" && !e.buttons) {
        this.lastPenAt = performance.now();
        this.penAt = this.local(e);
        this.setHover(this.penAt);
      }
      return;
    }
    const events = (typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null) ?? [];
    const samples = events.length ? events : [e];
    const [x, y] = this.local(e);
    ptr.x = x;
    ptr.y = y;
    if (kind === "pen") {
      this.lastPenAt = performance.now();
      this.penAt = [x, y];
    }
    if (this.taps && Math.hypot(x - ptr.sx, y - ptr.sy) > 12) this.taps.moved = true;
    const a = this.action;
    if (!a) return;
    switch (a.kind) {
      case "stroke": {
        if (a.id !== e.pointerId) return;
        if (a.tentative && Math.hypot(x - ptr.sx, y - ptr.sy) > 6) a.tentative = false;
        if (a.shape) {
          this.moveShape(a, ...this.toDoc(x, y));
          return;
        }
        const top = sheetTop(a.sheetIndex);
        for (const s of samples) {
          const [lx, ly] = this.local(s);
          const [dx, dy] = this.toDoc(lx, ly);
          a.b.add(dx, dy - top, s.pressure, s.timeStamp);
        }
        const [dx, dy] = this.toDoc(x, y);
        // Moving on: the shape timer starts again (still means within a few pixels).
        if (Math.hypot(dx - a.stillX, dy - a.stillY) * this.view.scale > 3) {
          a.stillX = dx;
          a.stillY = dy;
          this.armStill();
        }
        a.predicted = [];
        const predicted = typeof e.getPredictedEvents === "function" ? e.getPredictedEvents() : [];
        for (const p of predicted.slice(0, 2)) {
          const [px, py] = this.toDoc(...this.local(p));
          a.predicted.push([px, py - top]);
        }
        this.drawWet(true);
        return;
      }
      case "erase":
        if (a.id === e.pointerId) for (const s of samples) this.eraseTo(...this.toDoc(...this.local(s)));
        return;
      case "lasso":
        if (a.id === e.pointerId) {
          for (const s of samples) a.pts.push(...this.toDoc(...this.local(s)));
          this.drawWet(true);
        }
        return;
      case "pan":
        if (a.id === e.pointerId) this.panTo(a, x, y);
        return;
      case "pinch":
        if (e.pointerId === a.a || e.pointerId === a.b) this.pinchTo(a);
        return;
      case "drag":
        if (a.id === e.pointerId) this.dragTo(a, x, y);
        return;
      case "tap":
        return;
    }
  }

  private up(e: PointerEvent, cancelled: boolean) {
    const ptr = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (e.pointerType === "pen") this.lastPenAt = performance.now();
    const a = this.action;
    if (this.taps && ptr?.kind === "touch" && ![...this.pointers.values()].some((p) => p.kind === "touch")) {
      const t = this.taps;
      this.taps = null;
      // Two fingers tapped: undo. Three: redo.
      if (!t.moved && t.max >= 2 && performance.now() - t.t0 < 350 && !this.readOnly) {
        if (a?.kind === "pinch") this.view = a.view;
        if (a && (a.kind === "pan" || a.kind === "pinch" || (a.kind === "stroke" && a.input === "touch"))) {
          if (a.kind === "stroke" && a.still) clearTimeout(a.still);
          this.action = null;
          this.drawWet();
          this.settled();
        }
        if (t.max === 2) this.undo();
        else this.redo();
        this.request();
        this.publish();
        return;
      }
    }
    if (!a) return;
    switch (a.kind) {
      case "stroke":
        if (a.id !== e.pointerId) return;
        if (cancelled && a.input === "touch") this.cancelAction();
        else this.finishStroke(a);
        return;
      case "erase":
        if (a.id !== e.pointerId) return;
        this.action = null;
        this.commit([...a.pairs.values()].filter((p) => p.before || p.after), { history: true });
        this.drawWet();
        return;
      case "lasso":
        if (a.id !== e.pointerId) return;
        this.action = null;
        this.finishLasso(a);
        this.drawWet();
        return;
      case "pan":
        if (a.id !== e.pointerId) return;
        this.action = null;
        this.flingFrom(a);
        return;
      case "pinch": {
        if (e.pointerId !== a.a && e.pointerId !== a.b) return;
        // One finger left: it scrolls on from here.
        const rest = [...this.pointers.values()].filter((p) => p.kind === "touch");
        this.action = null;
        if (rest.length === 1 && !this.fingersDraw()) this.startPan(rest[0].id, rest[0].x, rest[0].y);
        else if (rest.length >= 2) this.startPinch(rest[0], rest[1]);
        else this.settled();
        this.view = this.clamp(this.view);
        this.request();
        this.publish();
        return;
      }
      case "drag":
        if (a.id !== e.pointerId) return;
        this.action = null;
        this.drop();
        return;
      case "tap":
        if (a.id !== e.pointerId) return;
        this.action = null;
        if (!cancelled && ptr && Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) < 10) {
          const i = sheetAt(a.y, this.doc.sheets.length);
          this.startText(i, a.x, a.y - sheetTop(i));
        }
        return;
    }
  }

  private cancelAction() {
    const a = this.action;
    this.action = null;
    if (a?.kind === "stroke" && a.still) clearTimeout(a.still);
    if (a?.kind === "erase") this.commit([...a.pairs.values()], { history: true });
    if (a?.kind === "drag") this.drop();
    this.drawWet();
    this.publish();
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    this.rect = this.root.getBoundingClientRect();
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? this.height : 1;
    if (this.fling) {
      cancelAnimationFrame(this.fling);
      this.fling = null;
    }
    if (e.ctrlKey || e.metaKey) {
      // Pinching on a trackpad, or ctrl + wheel.
      const [x, y] = this.local(e);
      const factor = Math.exp((-e.deltaY * unit) / 300);
      const scale = Math.min(MAX_ZOOM * this.fit, Math.max(MIN_ZOOM * this.fit, this.view.scale * factor));
      const [dx, dy] = this.toDoc(x, y);
      this.view = this.clamp({ scale, tx: x - dx * scale, ty: y - dy * scale });
      this.levelLock ??= levelFor(this.view.scale * this.dpr);
    } else {
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
      this.view = this.clamp({ ...this.view, tx: this.view.tx - dx, ty: this.view.ty - dy });
    }
    this.settledSoon();
    this.request();
    this.publish();
  }

  /** Scrolls by a number of screens (keys: Page Up/Down, arrows). */
  scrollBy(dy: number, smooth = true) {
    const target = this.clamp({ ...this.view, ty: this.view.ty - dy });
    if (smooth) this.animateTo(target, 180);
    else {
      this.view = target;
      this.request();
      this.publish();
    }
  }

  get screenHeight() {
    return this.height;
  }

  // Scrolling and zooming -------------------------------------------------------------------

  private startPan(id: number, x: number, y: number) {
    if (this.action && this.action.kind !== "pan") return;
    this.action = { kind: "pan", id, sx: x, sy: y, tx: this.view.tx, ty: this.view.ty, samples: [{ x, y, t: performance.now() }] };
    this.publish();
  }

  private panTo(a: PanAction, x: number, y: number) {
    const now = performance.now();
    a.samples.push({ x, y, t: now });
    while (a.samples.length > 2 && now - a.samples[0].t > 90) a.samples.shift();
    this.view = this.clamp({ scale: this.view.scale, tx: a.tx + x - a.sx, ty: a.ty + y - a.sy }, this.height * 0.4);
    this.request();
    this.publish();
  }

  /** A swipe goes on and slows down, like native scrolling; past the ends it springs back. */
  private flingFrom(a: PanAction) {
    const s = a.samples;
    const first = s[0];
    const last = s[s.length - 1];
    const dt = Math.max(1, last.t - first.t);
    let vx = (last.x - first.x) / dt;
    let vy = (last.y - first.y) / dt;
    const fast = Math.hypot(vx, vy) > 0.25 && performance.now() - last.t < 60;
    if (!fast) {
      this.springBack();
      return;
    }
    let t0 = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(32, now - t0);
      t0 = now;
      const decay = Math.exp(-dt / 325);
      vx *= decay;
      vy *= decay;
      const next = { scale: this.view.scale, tx: this.view.tx + vx * dt, ty: this.view.ty + vy * dt };
      const clamped = this.clamp(next);
      // Hitting an end stops it there.
      if (clamped.ty !== next.ty) vy = 0;
      if (clamped.tx !== next.tx) vx = 0;
      this.view = clamped;
      this.request();
      if (Math.hypot(vx, vy) > 0.02) this.fling = requestAnimationFrame(step);
      else {
        this.fling = null;
        this.settled();
      }
      this.publish();
    };
    this.fling = requestAnimationFrame(step);
  }

  private springBack() {
    const target = this.clamp(this.view);
    if (Math.abs(target.tx - this.view.tx) < 0.5 && Math.abs(target.ty - this.view.ty) < 0.5) {
      this.view = target;
      this.settled();
      this.request();
      this.publish();
      return;
    }
    this.animateTo(target, 260);
  }

  private startPinch(a: Ptr, b: Ptr) {
    this.levelLock = levelFor(this.view.scale * this.dpr);
    this.action = { kind: "pinch", a: a.id, b: b.id, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, view: { ...this.view } };
    this.publish();
  }

  private pinchTo(p: PinchAction) {
    const a = this.pointers.get(p.a);
    const b = this.pointers.get(p.b);
    if (!a || !b) return;
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (this.taps && Math.abs(dist / p.dist - 1) > 0.04) this.taps.moved = true;
    const v = p.view;
    let scale = v.scale * (dist / p.dist);
    // Past the limits it resists a little.
    const lo = MIN_ZOOM * this.fit;
    const hi = MAX_ZOOM * this.fit;
    if (scale > hi) scale = hi * Math.pow(scale / hi, 0.25);
    if (scale < lo) scale = lo * Math.pow(scale / lo, 0.25);
    // The point under the fingers' middle stays under it.
    const docX = (p.mx - v.tx) / v.scale;
    const docY = (p.my - v.ty) / v.scale;
    this.view = this.clamp({ scale, tx: mx - docX * scale, ty: my - docY * scale }, this.height * 0.3);
    this.request();
    this.publish();
  }

  /** The view stopped moving: draw the tiles sharp at this zoom. */
  private settled() {
    const lo = MIN_ZOOM * this.fit;
    const hi = MAX_ZOOM * this.fit;
    if (this.view.scale > hi + 1e-6 || this.view.scale < lo - 1e-6) {
      const scale = Math.min(hi, Math.max(lo, this.view.scale));
      const [dx, dy] = this.toDoc(this.width / 2, this.height / 2);
      this.animateTo(this.clamp({ scale, tx: this.width / 2 - dx * scale, ty: this.height / 2 - dy * scale }), 220);
      return;
    }
    if (this.levelLock !== null) {
      this.levelLock = null;
      this.request();
    }
    this.publish();
  }

  private settledSoon() {
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      this.settle = null;
      this.settled();
    }, 160);
  }

  // Strokes ---------------------------------------------------------------------------------------

  private armStill() {
    const a = this.action;
    if (a?.kind !== "stroke") return;
    if (a.still) clearTimeout(a.still);
    a.still = setTimeout(() => this.snapShape(), 520);
  }

  /** Held still at the end of a stroke: if it is a shape, it becomes exact. */
  private snapShape() {
    const a = this.action;
    if (a?.kind !== "stroke" || a.shape) return;
    a.still = null;
    const b = a.b;
    if (b.length < 3) return;
    const px = 1 / this.view.scale;
    const shape = recognize(b.xs, b.ys, px);
    if (!shape) return;
    const widths = [...b.ws].sort((x, y) => x - y);
    const width = widths[Math.floor(widths.length / 2)] ?? a.b.size;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < shape.xs.length; i++) {
      cx += shape.xs[i];
      cy += shape.ys[i];
    }
    cx /= shape.xs.length;
    cy /= shape.ys.length;
    const line = shape.kind === "line";
    a.shape = { xs: shape.xs, ys: shape.ys, kind: shape.kind, cx: line ? shape.xs[0] : cx, cy: line ? shape.ys[0] : cy, gx: b.lastX, gy: b.lastY, line, width };
    this.snapAt = performance.now();
    try {
      navigator.vibrate?.(8);
    } catch {
      // No vibration here.
    }
    this.drawWet(true);
    this.publish();
  }

  /** The snapped shape follows the pen: a line's end goes with it, other shapes grow and turn around their middle. */
  private moveShape(a: StrokeAction, dx: number, dy: number) {
    const s = a.shape!;
    const y = dy - sheetTop(a.sheetIndex);
    if (s.line) {
      s.xs = [s.cx, dx];
      s.ys = [s.cy, y];
      const ang = Math.atan2(y - s.cy, dx - s.cx);
      const step = Math.PI / 4;
      const snapped = Math.round(ang / step) * step;
      if (Math.abs(ang - snapped) < (3 * Math.PI) / 180) {
        const len = Math.hypot(dx - s.cx, y - s.cy);
        s.xs[1] = s.cx + Math.cos(snapped) * len;
        s.ys[1] = s.cy + Math.sin(snapped) * len;
      }
    } else {
      const g0 = Math.hypot(s.gx - s.cx, s.gy - s.cy);
      const g1 = Math.hypot(dx - s.cx, y - s.cy);
      if (g0 > 1e-3 && g1 > 1e-3) {
        const k = g1 / g0;
        const rot = Math.atan2(y - s.cy, dx - s.cx) - Math.atan2(s.gy - s.cy, s.gx - s.cx);
        const m = multiply(rotateAround(rot, s.cx, s.cy), scaleAround(k, s.cx, s.cy));
        const pts = s.xs.map((x, i) => applyPoint(m, x, s.ys[i]));
        s.xs = pts.map((p) => p[0]);
        s.ys = pts.map((p) => p[1]);
        s.gx = dx;
        s.gy = y;
      }
    }
    this.drawWet(true);
  }

  private finishStroke(a: StrokeAction) {
    if (a.still) clearTimeout(a.still);
    this.action = null;
    let xs: Float32Array;
    let ys: Float32Array;
    let ws: Float32Array;
    if (a.shape) {
      xs = Float32Array.from(a.shape.xs);
      ys = Float32Array.from(a.shape.ys);
      ws = new Float32Array(xs.length).fill(a.shape.width);
    } else {
      ({ xs, ys, ws } = a.b.finish());
    }
    if (!xs.length) {
      this.drawWet();
      return;
    }
    const opacity = a.tool === "pencil" ? pencilOpacity(a.b.pressures) : 1;
    // Very long strokes are kept in parts (each stays small enough to send).
    const parts: Stroke[] = [];
    let seq = nextSeq();
    for (let start = 0; start < xs.length; start += LONG_STROKE) {
      const end = Math.min(xs.length, start + LONG_STROKE + 1);
      const px = xs.subarray(start, end).slice();
      const py = ys.subarray(start, end).slice();
      const pw = ws.subarray(start, end).slice();
      parts.push({ kind: "stroke", id: newId(), sheet: a.sheet.id, seq, tool: a.tool, color: a.color, size: a.b.size, opacity, shape: a.shape ? (a.shape.kind as Stroke["shape"]) : null, xs: px, ys: py, ws: pw, box: boxOfPoints(px, py, pw) });
      seq += 0.001;
      if (end === xs.length) break;
    }
    this.commit(parts.map((s) => ({ id: s.id, before: null, after: s })));
    // The tiles have the stroke now; the live layer lets go of it on the next frame (no gap).
    this.clearWetNext = true;
    this.request();
  }

  // Erasing ---------------------------------------------------------------------------------------

  private eraseTo(dx: number, dy: number) {
    const a = this.action;
    if (a?.kind !== "erase") return;
    const { mode, size, highlighterOnly } = this.settings.eraser;
    const rad = size / this.view.scale;
    const x0 = a.x;
    const y0 = a.y;
    a.x = dx;
    a.y = dy;
    const n = this.doc.sheets.length;
    const first = sheetAt(Math.min(y0, dy) - rad, n);
    const last = sheetAt(Math.max(y0, dy) + rad, n);
    const puts: Item[] = [];
    const removes: string[] = [];
    for (let i = first; i <= last; i++) {
      const sheet = this.doc.sheets[i];
      if (!sheet) continue;
      const top = sheetTop(i);
      const ax = x0;
      const ay = y0 - top;
      const bx = dx;
      const by = dy - top;
      const reach = { x0: Math.min(ax, bx) - rad, y0: Math.min(ay, by) - rad, x1: Math.max(ax, bx) + rad, y1: Math.max(ay, by) + rad };
      for (const t of this.doc.within(sheet.id, reach)) {
        if (t.kind !== "stroke") continue;
        if (highlighterOnly && t.tool !== "highlighter") continue;
        if (!touches(t.xs, t.ys, t.ws, t.box, ax, ay, bx, by, rad)) continue;
        const pair = a.pairs.get(t.id) ?? { id: t.id, before: t, after: t };
        if (mode === "stroke") {
          pair.after = null;
          a.pairs.set(t.id, pair);
          removes.push(t.id);
          continue;
        }
        const pieces = cut(centerline(t.xs, t.ys, t.ws, !t.shape), ax, ay, bx, by, rad);
        if (!pieces) continue;
        pair.after = null;
        a.pairs.set(t.id, pair);
        removes.push(t.id);
        let seq = t.seq;
        for (const p of pieces) {
          seq += 1e-6;
          const piece: Stroke = { ...t, id: newId(), seq, xs: p.xs, ys: p.ys, ws: p.ws, box: boxOfPoints(p.xs, p.ys, p.ws) };
          puts.push(piece);
          a.pairs.set(piece.id, { id: piece.id, before: null, after: piece });
        }
      }
    }
    if (puts.length || removes.length) this.doc.apply(puts, removes);
    this.drawWet(true);
  }

  // Lasso -----------------------------------------------------------------------------------------

  private finishLasso(a: LassoAction) {
    const sheet = this.doc.sheets[a.sheetIndex];
    if (!sheet || a.pts.length < 6) return;
    const top = sheetTop(a.sheetIndex);
    const poly = a.pts.map((v, i) => (i % 2 ? v - top : v));
    const ids: string[] = [];
    for (const t of this.doc.on(sheet.id)) {
      if (t.kind === "stroke") {
        if (shareInside(t.xs, t.ys, poly) >= 0.5) ids.push(t.id);
      } else {
        const b = t.box;
        const corners = [
          [b.x0, b.y0],
          [b.x1, b.y0],
          [b.x1, b.y1],
          [b.x0, b.y1],
          [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2],
        ];
        if (corners.filter(([x, y]) => inPolygon(x, y, poly)).length >= 3) ids.push(t.id);
      }
    }
    this.select(sheet.id, ids);
  }

  // Moving a selection -----------------------------------------------------------------------

  /** What a press at (x, y) on screen does to the selection: a corner scales, the knob turns, inside moves. */
  private selectionHit(x: number, y: number): "move" | "scale" | "rotate" | null {
    const sel = this.selection;
    if (!sel || this.text) return null;
    const r = this.selectionRect(sel);
    if (!r) return null;
    const grab = this.coarse ? 26 : 16;
    const corners = this.selectionCorners(sel);
    if (corners.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < grab)) return "scale";
    const knob = this.knob(sel);
    if (knob && Math.hypot(x - knob[0], y - knob[1]) < grab) return "rotate";
    if (x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 8 && y <= r.y + r.h + 8) return "move";
    return null;
  }

  /** The turning knob: above the selection's top edge. */
  private knob(sel: Selection): [number, number] | null {
    const c = this.selectionCorners(sel);
    const mx = (c[0][0] + c[1][0]) / 2;
    const my = (c[0][1] + c[1][1]) / 2;
    const ex = c[0][0] - c[3][0];
    const ey = c[0][1] - c[3][1];
    const len = Math.hypot(ex, ey) || 1;
    return [mx + (ex / len) * 28, my + (ey / len) * 28];
  }

  private startDrag(id: number, x: number, y: number) {
    const sel = this.selection;
    const mode = this.selectionHit(x, y);
    if (!sel || !mode) return;
    const i = this.doc.sheetIndex(sel.sheet);
    const [dx, dy] = this.toDoc(x, y);
    const sx = dx;
    const sy = dy - sheetTop(i);
    // Scaling keeps the far corner where it is; turning goes around the middle.
    const b = sel.box;
    const corners: [number, number][] = [
      [b.x0, b.y0],
      [b.x1, b.y0],
      [b.x1, b.y1],
      [b.x0, b.y1],
    ];
    let anchor: [number, number] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    if (mode === "scale") {
      const screen = this.selectionCorners(sel);
      let near = 0;
      for (let k = 1; k < 4; k++) if (Math.hypot(screen[k][0] - x, screen[k][1] - y) < Math.hypot(screen[near][0] - x, screen[near][1] - y)) near = k;
      anchor = applyPoint(sel.m, ...corners[(near + 2) % 4]);
    } else {
      anchor = applyPoint(sel.m, ...anchor);
    }
    this.action = { kind: "drag", id, mode, sx, sy, base: sel.m, anchor, startAngle: Math.atan2(sy - anchor[1], sx - anchor[0]), startDist: Math.max(1e-3, Math.hypot(sx - anchor[0], sy - anchor[1])) };
    this.lift(sel);
    this.publish();
  }

  /** The selected things leave the tiles and are drawn as one picture while they move. */
  private lift(sel: Selection) {
    sel.settling = false;
    this.tiles.hidden = new Set(sel.ids);
    this.tiles.invalidate(sel.sheet, sel.box);
    const pad = 4;
    const box = { x0: sel.box.x0 - pad, y0: sel.box.y0 - pad, x1: sel.box.x1 + pad, y1: sel.box.y1 + pad };
    const want = this.view.scale * this.dpr;
    const scale = Math.min(want, 4096 / Math.max(1, box.x1 - box.x0), 4096 / Math.max(1, box.y1 - box.y0));
    const w = Math.max(1, Math.ceil((box.x1 - box.x0) * scale));
    const h = Math.max(1, Math.ceil((box.y1 - box.y0) * scale));
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.setTransform(scale, 0, 0, scale, -box.x0 * scale, -box.y0 * scale);
    const sheet = this.doc.get(sel.sheet) as Sheet | undefined;
    const dark = lookOf(sheet?.paper ?? "auto", this.dark).dark;
    for (const t of this.doc.on(sel.sheet)) if (sel.ids.includes(t.id)) drawThing(ctx, t, dark, this.images);
    sel.lifted = { canvas, box, scale };
  }

  private dragTo(a: DragAction, x: number, y: number) {
    const sel = this.selection;
    if (!sel) return;
    const i = this.doc.sheetIndex(sel.sheet);
    const [dx, dy] = this.toDoc(x, y);
    const px = dx;
    const py = dy - sheetTop(i);
    let step: [number, number, number, number, number, number];
    if (a.mode === "move") step = translate(px - a.sx, py - a.sy);
    else if (a.mode === "scale") {
      const k = Math.max(0.05, Math.hypot(px - a.anchor[0], py - a.anchor[1]) / a.startDist);
      step = scaleAround(k, a.anchor[0], a.anchor[1]);
    } else {
      let ang = Math.atan2(py - a.anchor[1], px - a.anchor[0]) - a.startAngle;
      // Snaps to quarter turns when close.
      const total = Math.atan2(a.base[1], a.base[0]) + ang;
      const q = Math.round(total / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(total - q) < 0.05) ang += q - total;
      step = rotateAround(ang, a.anchor[0], a.anchor[1]);
    }
    sel.m = multiply(step, a.base);
    this.request();
    this.publish();
  }

  /** Puts the moved things down where they are now. */
  private drop() {
    const sel = this.selection;
    if (!sel) return;
    const m = sel.m;
    const moved = m.some((v, k) => Math.abs(v - [1, 0, 0, 1, 0, 0][k]) > 1e-6);
    if (!moved) {
      this.tiles.hidden = new Set();
      this.tiles.invalidate(sel.sheet, sel.box);
      sel.lifted = null;
      this.request();
      this.publish();
      return;
    }
    const pairs: Pair[] = [];
    for (const id of sel.ids) {
      const t = this.doc.get(id);
      if (!t || t.kind === "sheet") continue;
      pairs.push({ id, before: t, after: this.transformed(t, m) });
    }
    // Keep showing the picture until the tiles have the things in their new place.
    sel.settling = true;
    sel.m = [1, 0, 0, 1, 0, 0];
    this.settleMatrix = m;
    this.tiles.hidden = new Set();
    this.commit(pairs);
    sel.box = this.boxOf(sel.ids);
    this.request();
    this.publish();
  }

  /** The move just dropped (the lifted picture shows with it until the tiles are ready). */
  private settleMatrix: Affine | null = null;

  // Drawing --------------------------------------------------------------------------------------

  /** The base canvas needs drawing again (the view, the ink or the selection changed). */
  private request() {
    this.baseDirty = true;
    this.requestFrame();
  }

  private requestFrame() {
    if (this.frame === null) this.frame = requestAnimationFrame(() => this.render());
  }

  private baseDirty = true;

  private setHover(p: [number, number] | null) {
    const next = p ? { x: p[0], y: p[1] } : null;
    if (!next && !this.hover) return;
    this.hover = next;
    this.drawWet();
  }

  /** Redraws the live layer: now when the browser shows it at once (low latency), else next frame. */
  private drawWet(now = false) {
    this.wetDirty = true;
    if (now && this.desync && performance.now() - this.lastWetDraw > 3) this.paintWet();
    else this.requestFrame();
  }

  private render() {
    this.frame = null;
    if (!this.width) return;
    let busy = false;
    if (this.baseDirty) {
      // While a stroke is drawn only the live layer changes: the base waits.
      this.baseDirty = false;
      this.tiles.tick();
      busy = this.paintBase();
    }
    if (this.frameDirty) {
      this.frameDirty = false;
      const info = this.frameInfo();
      this.frameListeners.forEach((fn) => fn(info));
    }
    if (this.clearWetNext && !busy) {
      // The tiles show the stroke now: the live layer lets go of it. A low-latency layer shows its
      // changes before this frame does, so it waits for the next one (no frame without the stroke).
      this.clearWetNext = false;
      if (this.desync) {
        this.wetDirty = true;
        this.requestFrame();
      } else this.paintWet();
    } else if (this.wetDirty && !this.clearWetNext) this.paintWet();
    if (busy) this.request();
    if (this.selection?.settling && !busy) {
      this.selection.settling = false;
      this.selection.lifted = null;
      this.settleMatrix = null;
      this.request();
    }
  }

  /** Paper, templates and ink of the sheets in view. True while tiles are still being drawn. */
  private paintBase(): boolean {
    const ctx = this.bctx;
    const { scale, tx, ty } = this.view;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.dark ? "#0f0f0e" : "#e9e7e1";
    ctx.fillRect(0, 0, this.width, this.height);
    const n = this.doc.sheets.length;
    if (!n) return false;
    const sDev = scale * dpr;
    const level = this.levelLock ?? levelFor(sDev);
    const units = tileUnits(level);
    const ls = levelScale(level);
    const viewTop = -ty / scale;
    const viewBottom = (this.height - ty) / scale;
    const first = Math.max(0, Math.floor(viewTop / PITCH));
    const last = Math.min(n - 1, Math.floor(viewBottom / PITCH));
    // Tiles in view first, the nearest to the middle first.
    const wanted: { sheet: Sheet; index: number; i: number; j: number }[] = [];
    for (let k = first; k <= last; k++) {
      const sheet = this.doc.sheets[k];
      const top = sheetTop(k);
      const x0 = Math.max(0, -tx / scale);
      const x1 = Math.min(SHEET_W, (this.width - tx) / scale);
      const y0 = Math.max(0, viewTop - top);
      const y1 = Math.min(SHEET_H, viewBottom - top);
      if (x1 <= x0 || y1 <= y0) continue;
      for (let j = Math.floor(y0 / units); j <= Math.floor((y1 - 1e-6) / units); j++) {
        for (let i = Math.floor(x0 / units); i <= Math.floor((x1 - 1e-6) / units); i++) wanted.push({ sheet, index: k, i, j });
      }
    }
    const midY = this.height / 2;
    wanted.sort((a, b) => Math.abs((sheetTop(a.index) + (a.j + 0.5) * units) * scale + ty - midY) - Math.abs((sheetTop(b.index) + (b.j + 0.5) * units) * scale + ty - midY));
    for (const w of wanted) this.tiles.need(w.sheet.id, level, w.i, w.j, true);
    this.tiles.prune();
    const interacting = this.action?.kind === "stroke" || this.action?.kind === "erase";
    const busy = this.tiles.work(interacting ? 4 : 10);

    for (let k = first; k <= last; k++) {
      const sheet = this.doc.sheets[k];
      const top = sheetTop(k);
      const sx = tx;
      const sy = top * scale + ty;
      const sw = SHEET_W * scale;
      const sh = SHEET_H * scale;
      if (sy > this.height || sy + sh < 0) continue;
      const look = lookOf(sheet.paper, this.dark);
      // A soft edge around the paper.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = this.dark ? "rgba(0,0,0,0.35)" : "rgba(40,36,28,0.07)";
      ctx.fillRect(sx - 1, sy, sw + 2, sh + 2);
      ctx.fillStyle = this.dark ? "rgba(0,0,0,0.18)" : "rgba(40,36,28,0.035)";
      ctx.fillRect(sx - 2, sy + 1, sw + 4, sh + 4);
      ctx.setTransform(sDev, 0, 0, sDev, sx * dpr, sy * dpr);
      const clip = { x0: Math.max(0, -tx / scale), y0: Math.max(0, viewTop - top), x1: Math.min(SHEET_W, (this.width - tx) / scale), y1: Math.min(SHEET_H, viewBottom - top) };
      drawPaper(ctx, sheet.tpl, look, 1 / sDev, clip);
      // The ink, from the tiles (device pixels).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.round(sx * dpr), Math.round(sy * dpr), Math.round(sw * dpr), Math.round(sh * dpr));
      ctx.clip();
      for (let j = Math.floor(clip.y0 / units); j <= Math.floor((clip.y1 - 1e-6) / units); j++) {
        for (let i = Math.floor(clip.x0 / units); i <= Math.floor((clip.x1 - 1e-6) / units); i++) {
          const dx0 = Math.round((sx + i * units * scale) * dpr);
          const dy0 = Math.round((sy + j * units * scale) * dpr);
          const dx1 = Math.round((sx + (i + 1) * units * scale) * dpr);
          const dy1 = Math.round((sy + (j + 1) * units * scale) * dpr);
          const tile = this.tiles.get(sheet.id, level, i, j);
          if (tile?.ready) {
            ctx.drawImage(tile.canvas, 0, 0, TILE, TILE, dx0, dy0, dx1 - dx0, dy1 - dy0);
            continue;
          }
          // Not drawn yet: the other zoom levels' tiles, scaled, until it is.
          const box = { x0: i * units, y0: j * units, x1: (i + 1) * units, y1: (j + 1) * units };
          const others = this.tiles.fallback(sheet.id, level, box);
          if (!others.length) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(dx0, dy0, dx1 - dx0, dy1 - dy0);
          ctx.clip();
          for (const o of others) {
            const ou = tileUnits(o.level);
            const ox0 = (sx + o.i * ou * scale) * dpr;
            const oy0 = (sy + o.j * ou * scale) * dpr;
            ctx.drawImage(o.canvas, 0, 0, TILE, TILE, ox0, oy0, ou * scale * dpr, ou * scale * dpr);
          }
          ctx.restore();
        }
      }
      ctx.restore();
      void ls;
      // A selection being moved: its picture, with the move applied.
      const sel = this.selection;
      if (sel?.sheet === sheet.id && sel.lifted && (this.action?.kind === "drag" || sel.settling)) {
        const m = sel.settling ? (this.settleMatrix ?? sel.m) : sel.m;
        const L = sel.lifted;
        ctx.save();
        ctx.setTransform(sDev, 0, 0, sDev, sx * dpr, sy * dpr);
        ctx.beginPath();
        ctx.rect(0, 0, SHEET_W, SHEET_H);
        ctx.clip();
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(L.canvas as CanvasImageSource, L.box.x0, L.box.y0, L.box.x1 - L.box.x0, L.box.y1 - L.box.y0);
        ctx.restore();
      }
    }
    this.paintSelection(ctx);
    return busy;
  }

  private paintSelection(ctx: CanvasRenderingContext2D) {
    const sel = this.selection;
    if (!sel || this.text) return;
    const c = this.selectionCorners(sel);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.strokeStyle = this.dark ? "#b8a1ff" : "#6d3df5";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(c[0][0], c[0][1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(c[k][0], c[k][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.readOnly) {
      ctx.restore();
      return;
    }
    const knob = this.knob(sel);
    if (knob) {
      ctx.beginPath();
      ctx.moveTo((c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2);
      ctx.lineTo(knob[0], knob[1]);
      ctx.stroke();
    }
    const handle = (x: number, y: number, round: boolean) => {
      ctx.beginPath();
      if (round) ctx.arc(x, y, 7, 0, Math.PI * 2);
      else ctx.rect(x - 6, y - 6, 12, 12);
      ctx.fillStyle = this.dark ? "#1a1a18" : "#ffffff";
      ctx.fill();
      ctx.stroke();
    };
    for (const [x, y] of c) handle(x, y, false);
    if (knob) handle(knob[0], knob[1], true);
    ctx.restore();
  }

  /** The live layer: the stroke being drawn, the eraser, the lasso, the pen's hover point. */
  private paintWet() {
    this.wetDirty = false;
    this.lastWetDraw = performance.now();
    const ctx = this.wctx;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wet.width, this.wet.height);
    const { scale, tx, ty } = this.view;
    const a = this.action;
    if (a?.kind === "stroke") {
      const top = sheetTop(a.sheetIndex);
      const sx = tx;
      const sy = top * scale + ty;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, sx * dpr, sy * dpr);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SHEET_W, SHEET_H);
      ctx.clip();
      const look = lookOf(a.sheet.paper, this.dark);
      const stroke = this.wetStroke(a);
      if (stroke) drawThing(ctx, stroke, look.dark, null);
      ctx.restore();
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (a?.kind === "lasso") {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < a.pts.length; i += 2) {
        const x = a.pts[i] * scale + tx;
        const y = a.pts[i + 1] * scale + ty;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = this.dark ? "rgba(184,161,255,0.08)" : "rgba(109,61,245,0.06)";
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.dark ? "#b8a1ff" : "#6d3df5";
      ctx.stroke();
      ctx.restore();
      return;
    }
    const eraserAt = a?.kind === "erase" ? [a.x * scale + tx, a.y * scale + ty] : null;
    const hover = this.hover;
    if (eraserAt || (hover && this.settings.tool === "eraser")) {
      const [x, y] = eraserAt ?? [hover!.x, hover!.y];
      const r = this.settings.eraser.size;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.dark ? "rgba(255,255,255,0.08)" : "rgba(28,27,24,0.06)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.dark ? "rgba(255,255,255,0.55)" : "rgba(28,27,24,0.45)";
      ctx.stroke();
      return;
    }
    if (hover && !this.readOnly) {
      const tool = this.settings.tool;
      if (tool === "lasso" || tool === "text" || tool === "eraser") return;
      const pen = this.settings.pens[tool];
      const r = Math.max(1.5, (pen.size * scale) / 2);
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, r, 0, Math.PI * 2);
      const i = Math.max(0, sheetAt(this.toDoc(hover.x, hover.y)[1], this.doc.sheets.length));
      const dark = lookOf(this.doc.sheets[i]?.paper ?? "auto", this.dark).dark;
      ctx.fillStyle = inkColor(pen.color, dark);
      ctx.globalAlpha = tool === "highlighter" ? 0.35 : 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** The stroke so far as a Stroke (with the predicted points on the end), to draw live. */
  private wetStroke(a: StrokeAction): Stroke | null {
    let xs: ArrayLike<number>;
    let ys: ArrayLike<number>;
    let ws: ArrayLike<number>;
    if (a.shape) {
      xs = a.shape.xs;
      ys = a.shape.ys;
      ws = new Array(a.shape.xs.length).fill(a.shape.width);
    } else {
      const b = a.b;
      if (!b.length) return null;
      const px = [...b.xs];
      const py = [...b.ys];
      const pw = [...b.ws];
      // Where the pen is now (smoothing may lag), then where it is about to be.
      if (Math.hypot(b.lastX - px[px.length - 1], b.lastY - py[py.length - 1]) > 0.2 / this.view.scale) {
        px.push(b.lastX);
        py.push(b.lastY);
        pw.push(pw[pw.length - 1]);
      }
      for (const [x, y] of a.predicted) {
        px.push(x);
        py.push(y);
        pw.push(pw[pw.length - 1]);
      }
      xs = px;
      ys = py;
      ws = pw;
    }
    const fx = Float32Array.from(xs);
    const fy = Float32Array.from(ys);
    const fw = Float32Array.from(ws);
    const opacity = a.tool === "pencil" ? pencilOpacity(a.b.pressures) : 1;
    return { kind: "stroke", id: "wet", sheet: a.sheet.id, seq: 0, tool: a.tool, color: a.color, size: a.b.size, opacity, shape: a.shape ? "line" : null, xs: fx, ys: fy, ws: fw, box: boxOfPoints(fx, fy, fw) };
  }
}

/** The box around points with widths. */
export function boxOfPoints(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const r = ws[i] / 2 + 1;
    x0 = Math.min(x0, xs[i] - r);
    y0 = Math.min(y0, ys[i] - r);
    x1 = Math.max(x1, xs[i] + r);
    y1 = Math.max(y1, ys[i] + r);
  }
  return { x0, y0, x1, y1 };
}

export { boxesTouch, columnHeight, FOOT };
