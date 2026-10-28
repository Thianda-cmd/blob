"use client";

import { Ellipsis, Eraser, GalleryVerticalEnd, Hand, Highlighter, ImagePlus, Lasso, NotebookText, Plus, Redo2, Type, Undo2 } from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { inkText } from "@/i18n/messages/ink";
import type { EngineState, Settings, Tool } from "@/ink/engine";
import { INK, isPenTool, type InkColor, type PenTool } from "@/ink/model";
import { HIGHLIGHTER_COLORS } from "@/ink/pens";
import { inkColor } from "@/ink/render";
import { cn } from "@/lib/utils";
import { PEN_ICONS } from "./icons";
import { EraserPanel, HighlighterPanel, PenPanel, TextPanel } from "./Panels";

type Props = {
  settings: Settings;
  update: (fn: (s: Settings) => Settings) => void;
  state: EngineState;
  recent: InkColor[];
  remember: (c: InkColor) => void;
  dark: boolean;
  phone: boolean;
  touch: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPicture: () => void;
  onColor: (c: InkColor) => void;
  /** The paper panel and the "more" menu (built by the editor). */
  paper: (close: () => void) => ReactNode;
  more: (close: () => void) => ReactNode;
  onPages: () => void;
  /** The last pen used (what "Pen" goes back to from the eraser or the lasso). */
  lastPen: PenTool;
};

/** A round tool button; `on` shows it chosen, `dot` a colour under its icon. */
function ToolButton({
  label,
  on,
  onClick,
  children,
  dot,
  disabled,
  buttonRef,
  expanded,
  big,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  dot?: string;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  expanded?: boolean;
  big: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={on}
      aria-expanded={expanded}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl transition-[background,color,transform] duration-150 active:scale-[0.92] disabled:opacity-35 [&_svg]:size-[19px]",
        big ? "size-11" : "size-9",
        on ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
      {dot && <span className="absolute bottom-[5px] left-1/2 h-[3px] w-3.5 -translate-x-1/2 rounded-full" style={{ background: dot }} />}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-line" />;

export function Toolbar(p: Props) {
  const t = useMessages(inkText);
  const { settings, state, update } = p;
  const big = p.touch;
  const [open, setOpen] = useState<null | "pen" | "highlighter" | "eraser" | "text" | "colors" | "paper" | "more">(null);
  const tool = settings.tool;
  const penTool: PenTool = isPenTool(tool) && tool !== "highlighter" ? tool : p.lastPen;
  const PenIcon = PEN_ICONS[penTool];
  const pick = (next: Tool, panel: typeof open) => {
    if (tool === next && panel) setOpen(open === panel ? null : panel);
    else {
      update((s) => ({ ...s, tool: next }));
      setOpen(null);
    }
  };
  const color = (c: InkColor) => inkColor(c, p.dark);
  const activeColor = isPenTool(tool) ? settings.pens[tool].color : tool === "text" ? settings.text.color : settings.pens[penTool].color;
  // A few colours at hand: the usual ones for the tool, and the one in use.
  const quick = tool === "highlighter" ? HIGHLIGHTER_COLORS.slice(0, 4) : [INK, "#2563eb", "#dc2626", "#16a34a"];
  if (!quick.includes(activeColor)) quick.push(activeColor);
  const side = p.phone ? "top" : "bottom";

  const panel = (key: NonNullable<typeof open>, button: (ref: Ref<HTMLButtonElement>, expanded: boolean) => ReactNode, content: (close: () => void) => ReactNode, wide = true) => (
    <Popover
      open={open === key}
      onOpenChange={(v) => setOpen(v ? key : null)}
      side={side}
      align="start"
      role="dialog"
      label={key}
      className={cn("p-3", wide ? "w-[300px]" : "w-[248px]")}
      trigger={({ ref }) => button(ref, open === key)}
    >
      {(close) => content(close)}
    </Popover>
  );

  return (
    <div
      role="toolbar"
      aria-label={t.tools}
      className={cn(
        "pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line/80 bg-raised/92 p-1 shadow-pop backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        state.moving && "opacity-60",
      )}
      // A tap on the bar mustn't reach the page under it.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ToolButton big={big} label={t.undo} onClick={p.onUndo} disabled={!state.canUndo}>
        <Undo2 />
      </ToolButton>
      <ToolButton big={big} label={t.redo} onClick={p.onRedo} disabled={!state.canRedo}>
        <Redo2 />
      </ToolButton>
      <Divider />
      {panel(
        "pen",
        (ref, expanded) => (
          <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.pens[penTool]} on={tool === penTool} dot={color(settings.pens[penTool].color)} onClick={() => pick(penTool, "pen")}>
            <PenIcon />
          </ToolButton>
        ),
        () => <PenPanel settings={settings} update={update} dark={p.dark} recent={p.recent} remember={p.remember} />,
      )}
      {panel(
        "highlighter",
        (ref, expanded) => (
          <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.pens.highlighter} on={tool === "highlighter"} dot={settings.pens.highlighter.color} onClick={() => pick("highlighter", "highlighter")}>
            <Highlighter />
          </ToolButton>
        ),
        () => <HighlighterPanel settings={settings} update={update} recent={p.recent} remember={p.remember} />,
      )}
      {panel(
        "eraser",
        (ref, expanded) => (
          <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.eraser} on={tool === "eraser"} onClick={() => pick("eraser", "eraser")}>
            <Eraser />
          </ToolButton>
        ),
        (close) => <EraserPanel settings={settings} update={update} close={close} />,
        false,
      )}
      <ToolButton big={big} label={t.lasso} on={tool === "lasso"} onClick={() => pick("lasso", null)}>
        <Lasso />
      </ToolButton>
      {panel(
        "text",
        (ref, expanded) => (
          <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.text} on={tool === "text"} onClick={() => pick("text", "text")}>
            <Type />
          </ToolButton>
        ),
        () => <TextPanel settings={settings} update={update} dark={p.dark} recent={p.recent} remember={p.remember} />,
        false,
      )}
      <ToolButton big={big} label={t.picture} onClick={p.onPicture}>
        <ImagePlus />
      </ToolButton>
      {!p.phone && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center gap-0.5 px-0.5" role="radiogroup" aria-label={t.colour}>
            {quick.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === activeColor}
                aria-label={c === INK ? t.colour : c}
                title={c === INK ? t.colour : c}
                onClick={() => p.onColor(c)}
                className={cn("grid shrink-0 place-items-center rounded-full transition-transform active:scale-90", big ? "size-10" : "size-8")}
              >
                <span
                  className={cn("block rounded-full border border-black/10 transition-[box-shadow,transform] dark:border-white/15", big ? "size-6" : "size-5", c === activeColor && "scale-110 shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]")}
                  style={{ background: color(c) }}
                />
              </button>
            ))}
            {panel(
              "colors",
              (ref, expanded) => (
                <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.customColour} onClick={() => setOpen(open === "colors" ? null : "colors")}>
                  <Plus />
                </ToolButton>
              ),
              () => (tool === "highlighter" ? <HighlighterPanel settings={settings} update={update} recent={p.recent} remember={p.remember} only="colors" /> : tool === "text" ? <TextPanel settings={settings} update={update} dark={p.dark} recent={p.recent} remember={p.remember} only="colors" /> : <PenPanel settings={settings} update={update} dark={p.dark} recent={p.recent} remember={p.remember} only="colors" onPick={p.onColor} />),
            )}
          </div>
        </>
      )}
      <Divider />
      {!p.phone &&
        panel(
          "paper",
          (ref, expanded) => (
            <ToolButton big={big} buttonRef={ref} expanded={expanded} label={t.pageStyle} onClick={() => setOpen(open === "paper" ? null : "paper")}>
              <NotebookText />
            </ToolButton>
          ),
          (close) => p.paper(close),
        )}
      {!p.phone && (
        <ToolButton big={big} label={t.pages} onClick={p.onPages}>
          <GalleryVerticalEnd />
        </ToolButton>
      )}
      {p.touch && (
        <ToolButton big={big} label={state.fingersDraw ? t.fingersOn : t.fingersOff} on={state.fingersDraw} onClick={() => update((s) => ({ ...s, fingers: state.fingersDraw ? "pan" : "draw" }))}>
          <Hand />
        </ToolButton>
      )}
      <Popover
        open={open === "more"}
        onOpenChange={(v) => setOpen(v ? "more" : null)}
        side={side}
        align="end"
        label={t.more}
        className="w-[240px]"
        trigger={({ ref }) => (
          <ToolButton big={big} buttonRef={ref} expanded={open === "more"} label={t.more} onClick={() => setOpen(open === "more" ? null : "more")}>
            <Ellipsis />
          </ToolButton>
        )}
      >
        {(close) => p.more(close)}
      </Popover>
    </div>
  );
}
