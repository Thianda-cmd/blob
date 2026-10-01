"use client";

import { ImageIcon, ImageOff, Link2, Plus, Trash2, Upload } from "lucide-react";
import { motion } from "motion/react";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { GooSpinner } from "@/components/blob/GooSpinner";
import type { DeckTheme, Slide, SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import { bodyLines, cleanImageUrl, SLIDE_H, SLIDE_W, THEME_COLORS } from "./deck";

/**
 * One renderer for every place a slide appears: rail thumbnails, the editor canvas
 * (editable) and the presenter. Slides are laid out on a fixed 1280×720 design canvas
 * and scaled with a CSS transform so typography is identical at every size.
 */

export type SlideMode = "edit" | "thumb" | "present";

type SlideViewProps = {
  slide: Slide;
  theme: DeckTheme;
  mode?: SlideMode;
  /** Rendered width in px. When omitted the slide fits (contain) inside its parent box. */
  width?: number;
  onChange?: (patch: Partial<Slide>) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
  className?: string;
  frameClassName?: string;
};

const ScaleCtx = createContext(1);

type FieldCtx = { mode: SlideMode; slide: Slide; onChange?: (patch: Partial<Slide>) => void; onUpload?: (file: File) => void; uploading?: boolean };
const SlideCtx = createContext<FieldCtx | null>(null);
const useSlide = () => useContext(SlideCtx)!;

const PLACEHOLDERS: Record<SlideLayout, { title: string; body: string }> = {
  title: { title: "Presentation title", body: "Subtitle, or your name" },
  bullets: { title: "Slide title", body: "Add a point" },
  split: { title: "Slide title", body: "Write a few sentences here, or add an image instead." },
  quote: { title: "A quote worth remembering", body: "Who said it" },
  image: { title: "Caption", body: "Add a little more detail (optional)" },
  big: { title: "42", body: "What the number means" },
};

export const SlideView = memo(function SlideView({
  slide,
  theme,
  mode = "present",
  width,
  onChange,
  onUpload,
  uploading,
  className,
  frameClassName,
}: SlideViewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (width || !outer.current) return;
    // The first observation is delivered before the next paint, so there is no flash.
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(outer.current);
    return () => ro.disconnect();
  }, [width]);

  const fit = width ? width / SLIDE_W : box ? Math.min(box.w / SLIDE_W, box.h / SLIDE_H) : 0;
  // Whole-pixel frame, and a canvas scaled to cover it, so no hairline of background peeks out at the edges.
  const frameW = Math.round(SLIDE_W * fit);
  const frameH = Math.round(SLIDE_H * fit);
  const scale = fit ? Math.max(frameW / SLIDE_W, frameH / SLIDE_H) : 0;
  const c = THEME_COLORS[theme];

  const frame = (
    <div className={cn("relative shrink-0 overflow-hidden", frameClassName)} style={{ width: frameW, height: frameH, background: c.bg }}>
      {scale > 0 && (
        <div
          data-slide-canvas
          className="group/canvas absolute left-0 top-0 origin-top-left font-sans antialiased"
          style={
            {
              width: SLIDE_W,
              height: SLIDE_H,
              transform: `scale(${scale})`,
              background: c.bg,
              color: c.fg,
              "--s-bg": c.bg,
              "--s-title": c.title,
              "--s-fg": c.fg,
              "--s-fg2": c.fg2,
              "--s-fg3": c.fg3,
              "--s-accent": c.accent,
              "--s-line": c.line,
              "--s-panel": c.panel,
            } as CSSProperties
          }
        >
          <ScaleCtx.Provider value={scale}>
            <SlideCtx.Provider value={{ mode, slide, onChange, onUpload, uploading }}>
              {mode === "edit" ? (
                // Keyed per slide so local UI state resets, with a quick crossfade when you switch.
                <motion.div key={slide.id} className="size-full" initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <SlideLayoutView layout={slide.layout} />
                </motion.div>
              ) : (
                <SlideLayoutView layout={slide.layout} />
              )}
            </SlideCtx.Provider>
          </ScaleCtx.Provider>
        </div>
      )}
    </div>
  );

  if (width) return className ? <div className={className}>{frame}</div> : frame;
  return (
    <div ref={outer} className={cn("relative grid size-full place-items-center", className)}>
      {box && frame}
    </div>
  );
});

// Layouts ---------------------------------------------------------------------

const RULE = "rounded-full bg-[var(--s-accent)]";
const TITLE = "font-display font-semibold text-[var(--s-title)]";

function SlideLayoutView({ layout }: { layout: SlideLayout }) {
  const { slide, mode } = useSlide();
  const hasImage = Boolean(slide.image);
  const empty = (t: string) => mode === "present" && !t.trim();

  switch (layout) {
    case "title":
      return (
        <div className="flex h-full flex-col justify-center px-[112px] pb-[24px]">
          <div className={cn(RULE, "mb-[44px] h-[8px] w-[80px] shrink-0")} />
          <Text field="title" className={cn(TITLE, "text-[88px] leading-[1.03] tracking-[-0.035em]")} />
          <Text field="body" className="mt-[30px] text-[32px] leading-[1.35] text-[var(--s-fg2)]" />
        </div>
      );

    case "bullets":
      return (
        <div className="flex h-full flex-col px-[104px] pb-[64px] pt-[84px]">
          <div className={cn(RULE, "mb-[30px] h-[6px] w-[56px] shrink-0")} />
          <Text field="title" className={cn(TITLE, "text-[58px] leading-[1.08] tracking-[-0.03em]")} />
          <Bullets />
        </div>
      );

    case "split":
      return hasImage ? (
        <div className="grid h-full grid-cols-2">
          <div className="flex min-w-0 flex-col justify-center pl-[96px] pr-[64px]">
            <div className={cn(RULE, "mb-[30px] h-[6px] w-[56px] shrink-0")} />
            <Text field="title" className={cn(TITLE, "text-[54px] leading-[1.08] tracking-[-0.03em]")} />
            <Text field="body" className="mt-[26px] text-[26px] leading-[1.5] text-[var(--s-fg2)]" />
          </div>
          <ImageSlot className="h-full" />
        </div>
      ) : (
        <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[80px] px-[104px]">
          <div className="flex min-w-0 flex-col justify-center">
            <div className={cn(RULE, "mb-[30px] h-[6px] w-[56px] shrink-0")} />
            <Text field="title" className={cn(TITLE, "text-[58px] leading-[1.08] tracking-[-0.03em]")} />
          </div>
          <div className="flex min-w-0 flex-col justify-center border-l-[3px] border-[var(--s-line)] pl-[56px]">
            <Text field="body" className="text-[28px] leading-[1.5] text-[var(--s-fg2)]" />
          </div>
          {mode === "edit" && <AddImageChip />}
        </div>
      );

    case "quote":
      return (
        <div className="flex h-full flex-col justify-center px-[136px] pb-[16px]">
          <svg viewBox="0 0 22 16" className="mb-[40px] h-[64px] w-auto shrink-0 self-start fill-[var(--s-accent)]" aria-hidden>
            <path d="M0 16V9.5C0 4.6 2.6 1.4 7.6 0L8.6 2.2C6.2 3.2 5 4.9 4.9 7H9v9zM13 16V9.5c0-4.9 2.6-8.1 7.6-9.5l1 2.2c-2.4 1-3.6 2.7-3.7 4.8H22v9z" />
          </svg>
          <Text field="title" className="font-display text-[60px] font-medium leading-[1.16] tracking-[-0.025em] text-[var(--s-title)]" />
          {!empty(slide.body) && (
            <div className="mt-[44px] flex items-center gap-[22px]">
              <div className={cn(RULE, "h-[4px] w-[48px] shrink-0")} />
              <div className="min-w-0 flex-1">
                <Text field="body" className="text-[26px] font-medium leading-[1.35] text-[var(--s-fg2)]" />
              </div>
            </div>
          )}
        </div>
      );

    case "image":
      return (
        <div className="flex h-full flex-col p-[56px] pb-[48px]">
          <ImageSlot className="min-h-0 flex-1 rounded-[22px]" />
          {!(empty(slide.title) && empty(slide.body)) && (
            <div className="mt-[30px] shrink-0">
              <Text field="title" className={cn(TITLE, "text-[34px] leading-[1.15] tracking-[-0.02em]")} />
              <Text field="body" className="mt-[14px] text-[22px] leading-[1.4] text-[var(--s-fg2)]" />
            </div>
          )}
        </div>
      );

    case "big": {
      const len = (slide.title.trim() || PLACEHOLDERS.big.title).length;
      const size = len <= 4 ? 260 : len <= 7 ? 200 : len <= 12 ? 136 : 96;
      return (
        <div className="flex h-full flex-col items-center justify-center px-[96px] pb-[16px] text-center">
          <Text
            field="title"
            className="w-full text-center font-display font-bold leading-[0.95] tracking-[-0.05em] text-[var(--s-accent)]"
            style={{ fontSize: size }}
          />
          <div className="mt-[36px] w-full max-w-[900px]">
            <Text field="body" className="text-center text-[36px] leading-[1.3] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
    }
  }
}

// Text fields -----------------------------------------------------------------

/** Wrapper that shows a soft outline on hover and focus while editing. */
function EditBox({ children, className }: { children: ReactNode; className?: string }) {
  const { mode } = useSlide();
  return (
    <div
      className={cn(
        "w-full",
        mode === "edit" &&
          "rounded-[10px] outline-offset-[12px] hover:outline-[3px] hover:outline-dashed hover:outline-[color-mix(in_oklab,var(--s-fg)_16%,transparent)] focus-within:outline-[3px]! focus-within:outline-solid! focus-within:outline-[color-mix(in_oklab,var(--s-accent)_55%,transparent)]!",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Text({ field, className, style }: { field: "title" | "body"; className: string; style?: CSSProperties }) {
  const { mode, slide, onChange } = useSlide();
  const value = slide[field];
  const placeholder = PLACEHOLDERS[slide.layout][field];

  if (mode !== "edit") {
    if (!value.trim()) {
      if (mode === "present") return null;
      return (
        <div className={cn(className, "whitespace-pre-wrap break-words opacity-35")} style={style}>
          {placeholder}
        </div>
      );
    }
    return (
      <div className={cn(className, "whitespace-pre-wrap break-words")} style={style}>
        {value}
      </div>
    );
  }

  return (
    <EditBox>
      <AutoTextarea
        value={value}
        onValue={(v) => onChange?.({ [field]: v })}
        placeholder={placeholder}
        aria-label={field === "title" ? "Slide title" : "Slide text"}
        className={className}
        style={style}
        onKeyDown={(e) => {
          // Enter in a title jumps to the next field; Shift+Enter keeps a line break.
          if (field === "title" && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            focusNextField(e.currentTarget);
          }
        }}
      />
    </EditBox>
  );
}

function focusNextField(from: HTMLTextAreaElement) {
  const canvas = from.closest("[data-slide-canvas]");
  if (!canvas) return;
  const fields = [...canvas.querySelectorAll("textarea")];
  const next = fields[fields.indexOf(from) + 1];
  if (next) {
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  }
}

function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

function AutoTextarea({
  value,
  onValue,
  className,
  style,
  inputRef,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValue: (value: string) => void;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fontSize = style?.fontSize;

  useLayoutEffect(() => {
    fitHeight(ref.current);
  }, [value, fontSize]);

  useEffect(() => {
    // Web fonts change line metrics once they load.
    let alive = true;
    document.fonts?.ready.then(() => alive && fitHeight(ref.current));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        inputRef?.(el);
      }}
      rows={1}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      className={cn(
        className,
        "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 caret-[var(--s-accent)] outline-none placeholder:text-[var(--s-fg3)] placeholder:opacity-60",
      )}
      style={style}
      {...props}
    />
  );
}

// Bullets ---------------------------------------------------------------------

const stripMarker = (line: string) => line.replace(/^\s*(?:[-*•‣◦]|\d+[.)])\s+/, "");

function Bullets() {
  const { mode, slide, onChange } = useSlide();
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const pending = useRef<{ i: number; caret: number } | null>(null);

  // Apply focus requested by the last edit (after the new lines rendered).
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const el = refs.current[p.i];
    if (!el) return;
    el.focus();
    el.setSelectionRange(p.caret, p.caret);
  });

  const count = bodyLines(slide.body).length;
  const size = count <= 5 ? 34 : count <= 7 ? 29 : 25;
  const text = "leading-[1.4] text-[var(--s-fg)]";
  const dot = "mt-[0.5em] size-[12px] shrink-0 rounded-full bg-[var(--s-accent)]";
  const gap = size >= 34 ? "gap-[20px]" : "gap-[14px]";

  if (mode !== "edit") {
    const lines = bodyLines(slide.body);
    if (!lines.length) {
      if (mode === "present") return null;
      return (
        <ul className={cn("mt-[44px] flex flex-col opacity-35", gap)} style={{ fontSize: size }}>
          <li className="flex gap-[26px]">
            <span className={dot} />
            <span className={text}>{PLACEHOLDERS.bullets.body}</span>
          </li>
        </ul>
      );
    }
    return (
      <ul className={cn("mt-[44px] flex flex-col", gap)} style={{ fontSize: size }}>
        {lines.map((line, i) => (
          <li key={i} className="flex gap-[26px]">
            <span className={dot} />
            <span className={cn(text, "min-w-0 flex-1 whitespace-pre-wrap break-words")}>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  const lines = slide.body.split("\n");
  const commit = (next: string[], focus?: { i: number; caret: number }) => {
    if (focus) pending.current = focus;
    onChange?.({ body: next.join("\n") });
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end, value } = el;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit([...lines.slice(0, i), value.slice(0, s), value.slice(end), ...lines.slice(i + 1)], { i: i + 1, caret: 0 });
    } else if (e.key === "Backspace" && s === 0 && end === 0 && i > 0) {
      e.preventDefault();
      const prev = lines[i - 1];
      commit([...lines.slice(0, i - 1), prev + value, ...lines.slice(i + 1)], { i: i - 1, caret: prev.length });
    } else if (e.key === "Delete" && s === value.length && end === value.length && i < lines.length - 1) {
      e.preventDefault();
      commit([...lines.slice(0, i), value + lines[i + 1], ...lines.slice(i + 2)], { i, caret: value.length });
    } else if (e.key === "ArrowUp" && s === 0 && end === 0 && i > 0) {
      e.preventDefault();
      const prev = refs.current[i - 1];
      prev?.focus();
      prev?.setSelectionRange(prev.value.length, prev.value.length);
    } else if (e.key === "ArrowDown" && s === value.length && i < lines.length - 1) {
      e.preventDefault();
      const next = refs.current[i + 1];
      next?.focus();
      next?.setSelectionRange(0, 0);
    }
  };

  const onPaste = (i: number) => (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted.includes("\n")) return;
    e.preventDefault();
    const parts = pasted.replace(/\r\n?/g, "\n").split("\n").map(stripMarker);
    const el = e.currentTarget;
    const before = el.value.slice(0, el.selectionStart);
    const after = el.value.slice(el.selectionEnd);
    const last = parts[parts.length - 1];
    const inserted = parts.length === 1 ? [before + parts[0] + after] : [before + parts[0], ...parts.slice(1, -1), last + after];
    commit([...lines.slice(0, i), ...inserted, ...lines.slice(i + 1)], { i: i + inserted.length - 1, caret: last.length + (parts.length === 1 ? before.length : 0) });
  };

  return (
    <EditBox className="mt-[44px]">
      <ul className={cn("flex flex-col", gap)} style={{ fontSize: size }}>
        {lines.map((line, i) => (
          <li key={i} className="flex gap-[26px]">
            <span className={dot} />
            <div className="min-w-0 flex-1">
              <AutoTextarea
                inputRef={(el) => {
                  refs.current[i] = el;
                }}
                value={line}
                onValue={(v) => {
                  if (!v.includes("\n")) return commit(lines.map((l, j) => (j === i ? v : l)));
                  const parts = v.split("\n");
                  commit([...lines.slice(0, i), ...parts, ...lines.slice(i + 1)], { i: i + parts.length - 1, caret: parts[parts.length - 1].length });
                }}
                onKeyDown={onKeyDown(i)}
                onPaste={onPaste(i)}
                placeholder={lines.length === 1 ? PLACEHOLDERS.bullets.body : ""}
                aria-label={`Bullet ${i + 1}`}
                className={text}
                style={{ fontSize: size }}
              />
            </div>
          </li>
        ))}
      </ul>
    </EditBox>
  );
}

// Images ----------------------------------------------------------------------

/** App-sized controls inside the scaled canvas: undo the slide scale so buttons stay crisp and clickable. */
function Ui({ children, className, origin = "center" }: { children: ReactNode; className?: string; origin?: string }) {
  const scale = useContext(ScaleCtx);
  return (
    <div className={className} style={{ transform: `scale(${1 / scale})`, transformOrigin: origin }}>
      {children}
    </div>
  );
}

const uiButton =
  "inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink shadow-card transition-colors hover:bg-hover [&_svg]:size-3.5";

function imageFromDrop(e: DragEvent): File | string | null {
  const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (file) return file;
  const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  return cleanImageUrl(uri.split("\n")[0] ?? "");
}

function ImageSlot({ className }: { className?: string }) {
  const { mode, slide, onChange, onUpload, uploading } = useSlide();
  const [failed, setFailed] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [linking, setLinking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const src = slide.image;
  const broken = src !== null && failed === src;
  const editing = mode === "edit";

  const accept = (value: File | string | null) => {
    if (!value) return;
    if (typeof value === "string") onChange?.({ image: value });
    else onUpload?.(value);
  };

  const handlers = editing
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setOver(false);
          accept(imageFromDrop(e));
        },
        onPaste: (e: ClipboardEvent) => {
          const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (file) {
            e.preventDefault();
            return accept(file);
          }
          const url = cleanImageUrl(e.clipboardData.getData("text/plain"));
          if (url && !(e.target instanceof HTMLInputElement)) {
            e.preventDefault();
            accept(url);
          }
        },
      }
    : {};

  return (
    <div
      {...handlers}
      tabIndex={editing ? 0 : undefined}
      aria-label={editing ? "Slide image. Drop or paste an image here." : undefined}
      style={{ outline: "none" }}
      className={cn(
        "group/img relative overflow-hidden outline-none",
        !src && "bg-[var(--s-panel)]",
        editing && !src && "border-[3px] border-dashed border-[color-mix(in_oklab,var(--s-fg)_18%,transparent)]",
        editing && "focus-visible:ring-[4px] focus-visible:ring-[var(--s-accent)]",
        over && "ring-[6px] ring-[var(--s-accent)]",
        className,
      )}
    >
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- user images from any host
        <img src={src} alt={slide.title || ""} draggable={false} onError={() => setFailed(src)} className="absolute inset-0 size-full object-cover" />
      )}

      {(!src || broken) && !editing && (
        <div className="absolute inset-0 grid place-items-center text-[var(--s-fg3)]">
          {broken ? <ImageOff className="size-[72px] opacity-60" strokeWidth={1.4} /> : <ImageIcon className="size-[72px] opacity-50" strokeWidth={1.4} />}
        </div>
      )}

      {editing && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) accept(file);
            }}
          />
          {!src || broken ? (
            <div className="absolute inset-0 grid place-items-center">
              <Ui className="flex flex-col items-center gap-2.5 text-center">
                <div className={cn("grid size-10 place-items-center rounded-full", broken ? "bg-danger/10 text-danger" : "bg-blob-soft text-blob-ink")}>
                  {broken ? <ImageOff className="size-5" /> : <ImageIcon className="size-5" />}
                </div>
                <p className="text-[13px] font-medium text-[var(--s-fg)]">{broken ? "That image didn't load" : "Drop, paste or upload an image"}</p>
                {linking ? (
                  <LinkInput
                    onDone={(url) => {
                      setLinking(false);
                      if (url) accept(url);
                    }}
                  />
                ) : (
                  <div className="flex gap-1.5">
                    <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
                      <Upload /> Upload
                    </button>
                    <button type="button" className={uiButton} onClick={() => setLinking(true)}>
                      <Link2 /> Paste link
                    </button>
                    {broken && (
                      <button type="button" className={uiButton} onClick={() => onChange?.({ image: null })} aria-label="Remove image">
                        <Trash2 />
                      </button>
                    )}
                  </div>
                )}
              </Ui>
            </div>
          ) : (
            <Ui
              origin="top right"
              className="absolute right-[20px] top-[20px] flex gap-1 opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-within/img:opacity-100"
            >
              {linking ? (
                <LinkInput
                  onDone={(url) => {
                    setLinking(false);
                    if (url) accept(url);
                  }}
                />
              ) : (
                <>
                  <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
                    <Upload /> Replace
                  </button>
                  <button type="button" className={uiButton} onClick={() => setLinking(true)} aria-label="Use an image link" title="Use an image link">
                    <Link2 />
                  </button>
                  <button type="button" className={cn(uiButton, "hover:text-danger")} onClick={() => onChange?.({ image: null })} aria-label="Remove image" title="Remove image">
                    <Trash2 />
                  </button>
                </>
              )}
            </Ui>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--s-bg)_70%,transparent)]">
              <Ui>
                <div className="grid size-16 place-items-center rounded-2xl border border-line bg-raised shadow-pop">
                  <GooSpinner size={44} label="Uploading image" />
                </div>
              </Ui>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LinkInput({ onDone }: { onDone: (url: string | null) => void }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    if (!value.trim()) return onDone(null);
    const url = cleanImageUrl(value);
    if (!url) return setInvalid(true);
    onDone(url);
  };
  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onDone(null);
          }
        }}
        onBlur={() => !value.trim() && onDone(null)}
        placeholder="https://…"
        aria-label="Image link"
        aria-invalid={invalid}
        className="h-7 w-[220px] rounded-lg border border-line bg-raised px-2.5 text-[12.5px] text-ink shadow-card outline-none placeholder:text-ink-3 focus:border-blob aria-[invalid=true]:border-danger"
      />
      <button type="submit" className={cn(uiButton, "border-transparent bg-ink text-paper hover:bg-ink/88")}>
        Add
      </button>
    </form>
  );
}

function AddImageChip() {
  const { onUpload, onChange } = useSlide();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  return (
    <Ui
      origin="bottom right"
      className="absolute bottom-[28px] right-[28px] opacity-0 transition-opacity group-hover/canvas:opacity-100 has-[input:focus]:opacity-100"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload?.(file);
        }}
      />
      {linking ? (
        <LinkInput
          onDone={(url) => {
            setLinking(false);
            if (url) onChange?.({ image: url });
          }}
        />
      ) : (
        <div className="flex gap-1">
          <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
            <Plus /> Image
          </button>
          <button type="button" className={uiButton} onClick={() => setLinking(true)} aria-label="Use an image link" title="Use an image link">
            <Link2 />
          </button>
        </div>
      )}
    </Ui>
  );
}
