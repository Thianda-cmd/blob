"use client";

import { Check, ChevronDown, Ellipsis, Plus, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { inputClass } from "@/components/ui/Input";
import { Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import { enterToNext, focusNextField, OPEN_PART_EVENT } from "./edit";

/** The CV's language: fields carry it as `lang`, so the browser spell-checks in the language the CV is written in. */
export const CvTextLang = createContext<string | undefined>(undefined);

/** Inputs: 38 px on desktop, 44 px and 16 px text on phones and tablets (no iOS zoom, thumb-sized). */
export const fieldClass = cn(inputClass, "h-9.5 max-lg:h-11 max-lg:text-[16px]");

// --- Cards -------------------------------------------------------------------------------------

/**
 * One part of the form. Folds and unfolds from its header; unfolds itself when another part of the
 * editor asks (openCvPart), when the URL hash points at it, or when it gets focus while folded.
 */
export function FormCard({
  id,
  icon: Icon,
  title,
  subtitle,
  done,
  muted,
  actions,
  children,
}: {
  id: string;
  icon: LucideIcon;
  /** A string folds the card when clicked; a node (the section heading input) is rendered as is. */
  title: ReactNode;
  subtitle?: ReactNode;
  done?: boolean;
  /** Hidden from the CV: the card is dimmed. */
  muted?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = useMessages(cvFormText);
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const bodyId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unfold = () => setOpen(true);
    const onHash = () => window.location.hash === `#${id}` && setOpen(true);
    el.addEventListener(OPEN_PART_EVENT, unfold);
    window.addEventListener("hashchange", onHash);
    return () => {
      el.removeEventListener(OPEN_PART_EVENT, unfold);
      window.removeEventListener("hashchange", onHash);
    };
  }, [id]);

  const toggle = () => setOpen((o) => !o);

  return (
    <section
      ref={ref}
      id={id}
      tabIndex={-1}
      onFocus={(e) => e.target === e.currentTarget && setOpen(true)}
      aria-labelledby={`${id}-title`}
      className="@container scroll-mt-3 rounded-2xl border border-line bg-raised shadow-card outline-none"
    >
      <div className="flex items-center gap-1 py-2.5 pl-3 pr-2 @min-[380px]:pl-3.5">
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-hidden
          className={cn(
            "relative mr-2 grid size-9 shrink-0 place-items-center rounded-xl transition-[background,color,opacity]",
            muted ? "bg-hover text-ink-3" : "bg-blob-soft text-blob-ink",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
          <AnimatePresence>
            {done && !muted && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 22 }}
                className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-ok text-white ring-2 ring-raised"
                title={t.done}
              >
                <Check className="size-2.5" strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <div className="min-w-0 flex-1">
          {typeof title === "string" ? (
            <>
              <h2 id={`${id}-title`} className="font-display text-[15.5px] font-semibold tracking-[-0.01em] text-ink">
                <button type="button" onClick={toggle} aria-expanded={open} aria-controls={bodyId} className="block w-full min-w-0 truncate text-left">
                  {title}
                </button>
              </h2>
              {subtitle && <div className="truncate text-[12.5px] text-ink-3">{subtitle}</div>}
            </>
          ) : (
            <>
              {title}
              {subtitle && <div className="truncate text-[12.5px] text-ink-3">{subtitle}</div>}
            </>
          )}
        </div>
        {actions}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? t.collapse : t.expand}
          title={open ? t.collapse : t.expand}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink max-lg:size-10"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200", !open && "-rotate-90")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className={cn("space-y-4 border-t border-line px-3.5 pb-4 pt-3.5 transition-opacity @min-[380px]:px-4", muted && "opacity-55")}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// --- Blob's tips ---------------------------------------------------------------------------------

// Which tips the student folded away, remembered in this browser (a convenience, so it may be lost).
const TIPS_KEY = "blob-cv-tips-hidden";
const tipListeners = new Set<() => void>();
function readTips() {
  try {
    return localStorage.getItem(TIPS_KEY) ?? "";
  } catch {
    return "";
  }
}
function subscribeTips(fn: () => void) {
  tipListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    tipListeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function setTipHidden(id: string, hidden: boolean) {
  const ids = new Set(readTips().split(",").filter(Boolean));
  if (hidden) ids.add(id);
  else ids.delete(id);
  try {
    localStorage.setItem(TIPS_KEY, [...ids].join(","));
  } catch {
    // Private mode: the tip still folds until the page is reloaded.
  }
  tipListeners.forEach((fn) => fn());
}

/** A short tip from Blob at the top of a card. Folds into a one-line "Show tip" link. */
export function Tip({ id, children }: { id: string; children: ReactNode }) {
  const t = useMessages(cvFormText);
  const hiddenIds = useSyncExternalStore(subscribeTips, readTips, () => "");
  const hidden = hiddenIds.split(",").includes(id);
  return (
    <AnimatePresence initial={false} mode="wait">
      {hidden ? (
        <motion.button
          key="folded"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          onClick={() => setTipHidden(id, false)}
          className="-my-1 flex items-center gap-1.5 rounded-md py-1 pr-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-blob-ink"
        >
          <BlobMark size={16} />
          {t.tip.show}
        </motion.button>
      ) : (
        <motion.div
          key="open"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          className="relative flex gap-2.5 rounded-xl bg-blob-soft/70 py-2.5 pl-3 pr-9 text-[13px] leading-[1.5] text-ink-2 dark:bg-blob-soft/60"
        >
          <BlobMark size={22} className="mt-px" />
          <p>
            <span className="font-semibold text-blob-ink">{t.tip.label}: </span>
            {children}
          </p>
          <button
            type="button"
            onClick={() => setTipHidden(id, true)}
            aria-label={t.tip.hide}
            title={t.tip.hide}
            className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-raised/70 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Fields --------------------------------------------------------------------------------------

/** Small heading for a group of fields inside a card ("Kontakt", "Adresse"), with an optional note. */
export function Group({ title, optional, note, children }: { title: string; optional?: boolean; note?: string; children: ReactNode }) {
  const t = useMessages(cvFormText);
  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
          {title}
          {optional && <span className="rounded-full bg-hover px-1.5 py-px text-[10.5px] font-medium normal-case tracking-normal">{t.optional}</span>}
        </h3>
        {note && <p className="mt-0.5 text-[12.5px] text-ink-3">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  action,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex min-h-4 items-end justify-between gap-2">
        <label htmlFor={htmlFor} className="truncate text-[12.5px] font-medium text-ink-2">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <div className="text-[12px] leading-snug text-ink-3">{hint}</div>}
    </div>
  );
}

type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValue: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
};

/** A one-line field. Enter moves on to the next field; browser autofill is off unless asked for. */
export function TextInput({ value, onValue, className, onKeyDown, autoComplete = "off", ref, ...props }: TextInputProps) {
  const lang = useContext(CvTextLang);
  return (
    <input
      lang={lang}
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onValue(e.target.value)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) enterToNext(e);
      }}
      autoComplete={autoComplete}
      enterKeyHint="next"
      spellCheck
      className={cn(fieldClass, className)}
      {...props}
    />
  );
}

/** A native select (best on phones) dressed like the inputs. */
export function SelectBox({
  value,
  onValue,
  children,
  className,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & { value: string; onValue: (value: string) => void }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className={cn(fieldClass, "cursor-pointer appearance-none truncate pl-2.5 pr-7 focus-visible:outline-none", !value && "text-ink-3")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

/** A textarea that grows with its text, with bullet-list editing on Enter. */
export function AutoTextarea({
  value,
  onValue,
  className,
  minRows = 3,
  singleLine,
  ref: outerRef,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onValue: (value: string) => void;
  minRows?: number;
  /** One line of text that wraps instead of scrolling sideways: Enter moves on, line breaks are dropped. */
  singleLine?: boolean;
  ref?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const lang = useContext(CvTextLang);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = outerRef ?? ownRef;
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    fitHeight(el);
    if (caret.current !== null) {
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value, ref]);

  // A narrower field (a phone turned, the panel resized) needs more lines.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth === width) return;
      width = el.offsetWidth;
      fitHeight(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  // Bullet lists: Enter on a "- " line starts the next one; Enter on an empty bullet ends the list.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    props.onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (singleLine) {
      e.preventDefault();
      focusNextField(e.currentTarget);
      return;
    }
    if (e.shiftKey) return;
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end, value: text } = el;
    if (start !== end) return;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const bullet = /^(\s*[-•*–]\s+)(.*)$/.exec(text.slice(lineStart, start));
    if (!bullet) return;
    e.preventDefault();
    const rest = text.slice(start);
    if (!bullet[2].trim() && !rest.split("\n")[0].trim()) {
      caret.current = lineStart;
      onValue(text.slice(0, lineStart) + rest.replace(/^[^\n]*/, ""));
    } else {
      const insert = `\n${bullet[1]}`;
      caret.current = start + insert.length;
      onValue(text.slice(0, start) + insert + rest);
    }
  };

  return (
    <textarea
      lang={lang}
      ref={ref}
      value={value}
      rows={singleLine ? 1 : minRows}
      onChange={(e) => onValue(singleLine ? e.target.value.replace(/\s*\n+\s*/g, " ") : e.target.value)}
      enterKeyHint={singleLine ? "next" : undefined}
      {...props}
      onKeyDown={onKeyDown}
      className={cn(inputClass, "block resize-none overflow-hidden py-2 leading-[1.55] max-lg:text-[16px]", singleLine && "max-lg:py-2.5", className)}
    />
  );
}

/** "+ Canva": a tappable suggestion. */
export function Chip({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      onClick={onClick}
      title={title}
      className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-dashed border-line-2 bg-raised px-2.5 text-[12.5px] text-ink-2 transition-colors hover:border-solid hover:border-blob/50 hover:bg-blob-soft hover:text-blob-ink active:scale-[0.96] max-lg:h-8.5 max-lg:text-[13.5px]"
    >
      <Plus className="size-3 shrink-0" strokeWidth={2.4} />
      <span className="truncate">{children}</span>
    </motion.button>
  );
}

/** A row of suggestion chips under a small "Ideen" label, the first `limit` with a "more" button. Nothing when all are used. */
export function Suggestions({ items, onPick, limit = 99 }: { items: string[]; onPick: (item: string) => void; limit?: number }) {
  const t = useMessages(cvFormText);
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, limit);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t.suggestions}</span>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((item) => (
          <Chip key={item} onClick={() => onPick(item)}>
            {item}
          </Chip>
        ))}
      </AnimatePresence>
      {shown.length < items.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="h-7 rounded-full px-2 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink max-lg:h-8.5"
        >
          {t.moreIdeas(items.length - shown.length)}
        </button>
      )}
    </div>
  );
}

/** "+ Schule hinzufügen": the dashed add button at the end of a list. */
export function AddButton({ children, onClick, disabled, id }: { children: ReactNode; onClick: () => void; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-cv-add
      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-blob/60 hover:bg-blob-soft/50 hover:text-blob-ink active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 max-lg:h-11"
    >
      <Plus className="size-4" />
      {children}
    </button>
  );
}

/** The "⋯" button with a menu. */
export function MoreMenu({ label, children, size = "sm" }: { label: string; children: (close: () => void) => ReactNode; size?: "sm" | "xs" }) {
  return (
    <Popover
      align="end"
      label={label}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={label}
          title={label}
          className={cn(
            "grid shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink",
            size === "sm" ? "size-8 max-lg:size-10" : "size-7 max-lg:size-9",
          )}
        >
          <Ellipsis className="size-4" />
        </button>
      )}
    >
      {children}
    </Popover>
  );
}

// --- Dates ---------------------------------------------------------------------------------------

const THIS_YEAR = new Date().getFullYear();

/** Month names for the selects, in the app's language ("Jan.", "Feb." …). */
function useMonthNames() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { month: "short" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 15)));
}

/**
 * A CvDate ("YYYY", "YYYY-MM" or "") as a month select (optional) and a year select. Picking a month
 * before a year takes this year, so nothing the student picks gets lost.
 */
export function MonthYear({
  value,
  onValue,
  label,
  idPrefix,
  disabled,
}: {
  value: string;
  onValue: (value: string) => void;
  label: string;
  idPrefix: string;
  disabled?: boolean;
}) {
  const t = useMessages(cvFormText);
  const months = useMonthNames();
  const [year = "", month = ""] = value ? value.split("-") : [];
  const now = THIS_YEAR;
  const years: number[] = [];
  for (let y = now + 6; y >= now - 40; y--) years.push(y);
  if (year && !years.includes(Number(year))) years.push(Number(year));

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <SelectBox
        id={`${idPrefix}-month`}
        value={month}
        disabled={disabled}
        aria-label={t.entry.monthOf(label)}
        onValue={(m) => onValue(m ? `${year || now}-${m}` : year)}
      >
        <option value="">{t.entry.month}</option>
        {months.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>
            {name}
          </option>
        ))}
      </SelectBox>
      <SelectBox
        id={`${idPrefix}-year`}
        value={year}
        disabled={disabled}
        aria-label={t.entry.yearOf(label)}
        onValue={(y) => onValue(y ? (month ? `${y}-${month}` : y) : "")}
      >
        <option value="">{t.entry.year}</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </SelectBox>
    </div>
  );
}
