"use client";

// Small pieces the spreadsheet chrome shares: tool buttons (plain, pressed, split), tooltips that
// name a button and its keyboard shortcut (on hover and on keyboard focus), and shortcut text for
// Mac and everything else.

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "@/components/ui/Kbd";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------------------------
// Keyboard shortcuts

/**
 * A shortcut as key caps: "Mod+Shift+Z" → ["⌘", "⇧", "Z"] on a Mac, ["Strg", "Umschalt", "Z"]
 * elsewhere. Mod is ⌘ / Ctrl, Alt is ⌥ / Alt.
 */
export function useKeys(): (spec: string) => string[] {
  const mac = useIsMac();
  const k = useMessages(sheetChromeText).keys;
  return (spec: string) =>
    spec.split("+").map((part, i, all) => {
      // "Alt+=" and "Mod++" split into an empty last part: the key is "+" or "=" itself.
      if (part === "" && i === all.length - 1) return "+";
      if (part === "Mod") return mac ? "⌘" : k.mod;
      if (part === "Shift") return mac ? "⇧" : k.shift;
      if (part === "Alt") return mac ? "⌥" : k.alt;
      return part;
    });
}

/** Key caps as plain text, for messages ("Strg+Z", "⌘Z"). */
export function keysText(keys: string[], mac: boolean): string {
  return mac ? keys.join("") : keys.join("+");
}

/** aria-keyshortcuts value for a spec ("Mod+B" → "Control+B Meta+B"). */
export function ariaKeys(spec: string | undefined): string | undefined {
  if (!spec) return undefined;
  const base = spec.replace(/Shift/g, "Shift").replace(/Alt/g, "Alt");
  return base.includes("Mod") ? `${base.replace(/Mod/g, "Control")} ${base.replace(/Mod/g, "Meta")}` : base;
}

// ----------------------------------------------------------------------------------------------
// Tooltips: one for the whole page, for every element with data-tip (and data-keys)

type Tip = { label: string; keys: string[]; x: number; top: number; bottom: number };

let tip: Tip | null = null;
const tipListeners = new Set<() => void>();
let owners: string[] = [];
const ownerListeners = new Set<() => void>();
let uninstall: (() => void) | null = null;

function setTip(next: Tip | null) {
  if (next === tip) return;
  tip = next;
  for (const l of [...tipListeners]) l();
}

/** A field the keyboard types into (text, numbers; not a checkbox or a slider). */
const takesTyping = (el: Element) =>
  el.matches("textarea, input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=color], [type=file])") || (el instanceof HTMLElement && el.isContentEditable);

function install() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cool: ReturnType<typeof setTimeout> | null = null;
  let target: HTMLElement | null = null;
  // Once a tooltip has shown, moving to the next button shows its tooltip at once.
  let warm = false;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (!el.isConnected || (r.width === 0 && r.height === 0)) return;
    setTip({ label: el.dataset.tip ?? "", keys: el.dataset.keys ? el.dataset.keys.split("|") : [], x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    warm = true;
    if (cool) clearTimeout(cool);
    cool = null;
  };
  const hide = () => {
    stop();
    target = null;
    setTip(null);
    if (cool) clearTimeout(cool);
    cool = setTimeout(() => (warm = false), 400);
  };
  const over = (e: PointerEvent) => {
    // Fingers have no hover; a pen hovering over the tablet does.
    if (e.pointerType === "touch") return;
    const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip]") ?? null;
    if (el === target) return;
    if (!el) {
      if (target) hide();
      return;
    }
    stop();
    target = el;
    if (warm) show(el);
    else timer = setTimeout(() => show(el), 450);
  };
  const press = () => {
    stop();
    target = null;
    setTip(null);
  };
  // The keyboard reaching a tool shows its name too (icon buttons have no words). Only for keyboard
  // focus (:focus-visible): a tap or click that focuses a button leaves tips to hovering. Fields
  // that take typing (the name box) match :focus-visible however they got the keyboard, a tap too,
  // and their tip would cover what is typed: theirs shows on hover only. Any key first hides the
  // old tip (press), then the newly focused tool shows its own.
  const focusIn = (e: FocusEvent) => {
    const at = e.target as Element | null;
    const el = at?.closest?.<HTMLElement>("[data-tip]") ?? null;
    if (!el || !at?.matches(":focus-visible") || takesTyping(at)) return;
    stop();
    target = el;
    if (warm) show(el);
    else timer = setTimeout(() => show(el), 450);
  };
  const focusOut = (e: FocusEvent) => {
    if (target && target.contains(e.target as Node)) hide();
  };
  document.addEventListener("pointerover", over, true);
  document.addEventListener("pointerdown", press, true);
  document.addEventListener("keydown", press, true);
  document.addEventListener("focusin", focusIn);
  document.addEventListener("focusout", focusOut);
  window.addEventListener("scroll", press, true);
  window.addEventListener("blur", press);
  uninstall = () => {
    stop();
    if (cool) clearTimeout(cool);
    document.removeEventListener("pointerover", over, true);
    document.removeEventListener("pointerdown", press, true);
    document.removeEventListener("keydown", press, true);
    document.removeEventListener("focusin", focusIn);
    document.removeEventListener("focusout", focusOut);
    window.removeEventListener("scroll", press, true);
    window.removeEventListener("blur", press);
    setTip(null);
  };
}

function own(id: string) {
  owners = [...owners, id];
  if (owners.length === 1) install();
  for (const l of [...ownerListeners]) l();
}

function disown(id: string) {
  owners = owners.filter((o) => o !== id);
  if (!owners.length) {
    uninstall?.();
    uninstall = null;
  }
  for (const l of [...ownerListeners]) l();
}

const subscribeTip = (l: () => void) => {
  tipListeners.add(l);
  return () => {
    tipListeners.delete(l);
  };
};
const subscribeOwners = (l: () => void) => {
  ownerListeners.add(l);
  return () => {
    ownerListeners.delete(l);
  };
};

/**
 * Tooltips for every [data-tip] element on the page (label, plus key caps from data-keys,
 * "Strg|B"). Each part of the chrome mounts one; only the first one mounted shows them.
 */
export function HoverTips() {
  const id = useId();
  useEffect(() => {
    own(id);
    return () => disown(id);
  }, [id]);
  const current = useSyncExternalStore(subscribeTip, () => tip, () => null);
  const shows = useSyncExternalStore(subscribeOwners, () => owners[0] === id, () => false);
  // Centred on its button, but inside the window: a tool at the window's edge (Undo, the name box
  // on a phone) has its tip beside the edge, not cut off by it. Measured before it is painted.
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !current) return;
    const w = el.offsetWidth;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - 8 - w, current.x - w / 2))}px`;
  }, [current, shows]);
  if (!shows || !current || typeof document === "undefined") return null;
  // Below the button, or above it near the bottom of the screen.
  const below = current.bottom + 44 < window.innerHeight;
  return createPortal(
    <div
      ref={box}
      role="tooltip"
      className="pointer-events-none fixed z-[95] flex w-max max-w-[min(280px,calc(100vw-16px))] items-center gap-2 rounded-lg border border-line bg-raised px-2 py-1 text-[12px] leading-snug text-ink shadow-pop"
      style={{ left: current.x, ...(below ? { top: current.bottom + 6 } : { bottom: window.innerHeight - current.top + 6 }) }}
    >
      <span>{current.label}</span>
      {current.keys.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5">
          {current.keys.map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </span>
      )}
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------------------------------------------
// The grid

/**
 * Give the grid the keyboard back (after the name box, a dialog, Enter in the formula bar). The
 * same as the grid's focusSheetGrid (grid/Grid.tsx), without loading the whole grid for it.
 */
export function focusGrid() {
  document.querySelector<HTMLElement>("[data-sheet-grid]")?.focus({ preventScroll: true });
}

// ----------------------------------------------------------------------------------------------
// Buttons

/** Keep the keyboard where it is (the grid, the cell being edited) when a tool is clicked. */
export const keepFocus = (e: ReactMouseEvent) => {
  if (!(e.target as HTMLElement).closest("input, textarea, select")) e.preventDefault();
};

const toolClass =
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 rounded-lg px-1.5 text-[13px] font-medium text-ink-2 outline-none transition-[background,color,transform] duration-150 hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-blob active:scale-[0.94] disabled:pointer-events-none disabled:opacity-35 [@media(hover:none)]:h-9 [@media(hover:none)]:min-w-9 [&_svg]:size-[17px] [&_svg]:shrink-0";

export function ToolButton({
  label,
  keys,
  shortcut,
  pressed,
  expanded,
  popup,
  disabled,
  onClick,
  children,
  className,
  buttonRef,
  tip,
  narrow,
}: {
  label: string;
  /** Key caps for the tooltip (from useKeys). */
  keys?: string[];
  /** The shortcut spec for screen readers ("Mod+B"). */
  shortcut?: string;
  pressed?: boolean;
  expanded?: boolean;
  popup?: "menu" | "dialog";
  disabled?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Tooltip text when it should say more than the label. */
  tip?: string;
  /** The main part of a split button: 28 px with a mouse, so its arrow can be 24 px. */
  narrow?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={popup}
      aria-keyshortcuts={ariaKeys(shortcut)}
      data-tip={tip ?? label}
      data-keys={keys?.length ? keys.join("|") : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(toolClass, narrow ? "min-w-7" : "min-w-8", pressed && "bg-blob-soft text-blob-ink hover:bg-blob-soft hover:text-blob-ink", expanded && !pressed && "bg-hover text-ink", className)}
    >
      {children}
    </button>
  );
}

/**
 * A button that does its thing (Σ: sum), with an arrow next to it for the choices (Mittelwert,
 * Anzahl…), big enough to hit on its own: 24 px wide, 32 px for fingers (a miss would run the main
 * button instead). The arrow is the popover's trigger.
 */
export function SplitButton({
  label,
  keys,
  shortcut,
  menuLabel,
  onClick,
  disabled,
  expanded,
  onMenu,
  menuRef,
  children,
  tip,
}: {
  label: string;
  keys?: string[];
  shortcut?: string;
  menuLabel: string;
  onClick: () => void;
  disabled?: boolean;
  expanded: boolean;
  onMenu: (e: ReactMouseEvent) => void;
  menuRef: Ref<HTMLButtonElement>;
  children: ReactNode;
  tip?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center rounded-lg transition-colors", expanded && "bg-hover")}>
      <ToolButton label={label} keys={keys} shortcut={shortcut} onClick={onClick} disabled={disabled} className="rounded-r-none pr-1" tip={tip} narrow>
        {children}
      </ToolButton>
      <button
        ref={menuRef}
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={expanded}
        data-tip={menuLabel}
        disabled={disabled}
        onClick={onMenu}
        className="grid h-8 w-6 shrink-0 place-items-center rounded-r-lg text-ink-2 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-blob disabled:pointer-events-none disabled:opacity-35 [@media(hover:none)]:h-9 [@media(hover:none)]:w-8"
      >
        <ChevronDown className="size-3" />
      </button>
    </div>
  );
}

export const Divider = () => <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line" />;

/** The title row of a panel opened from "Mehr", with a way back. */
export function PanelHeader({ title, onBack, backLabel }: { title: string; onBack?: () => void; backLabel: string }) {
  return (
    <div className="mb-1 flex items-center gap-1 px-1 pt-0.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
        >
          <ChevronDown className="size-4 rotate-90" />
        </button>
      )}
      <span className={cn("text-[12px] font-medium uppercase tracking-wide text-ink-2", !onBack && "px-1")}>{title}</span>
    </div>
  );
}

/** A choice in a panel: icon, label, something on the right (a preview), checked when it is the current one. */
export function Choice({
  icon,
  label,
  hint,
  right,
  checked,
  onSelect,
  disabled,
  role = "menuitemradio",
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: string;
  right?: ReactNode;
  checked?: boolean;
  onSelect: () => void;
  disabled?: boolean;
  role?: "menuitemradio" | "menuitem" | "menuitemcheckbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "menuitem" ? undefined : !!checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-[13px] transition-colors disabled:opacity-40 [@media(hover:none)]:min-h-10 [&_svg]:size-4 [&_svg]:shrink-0",
        checked ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {icon && <span className={checked ? "text-blob-ink" : "text-ink-3"}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="line-clamp-2 text-[12px] leading-snug text-ink-2">{hint}</span>}
      </span>
      {right !== undefined && <span className={cn("max-w-[45%] shrink-0 truncate text-[12px] tabular-nums", checked ? "text-blob-ink/80" : "text-ink-2")}>{right}</span>}
    </button>
  );
}
