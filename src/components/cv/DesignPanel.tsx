"use client";

import { Check, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deckFontVars } from "@/components/deck/fonts";
import { CV_ACCENTS, CV_TEMPLATES, templateMeta } from "@/cv/catalog";
import { CvThumbnail } from "@/cv/CvDocument";
import { CV_FONT_IDS, CV_FONTS } from "@/cv/fonts";
import { cvProgress, formatMonth, type CvCheck } from "@/cv/model";
import type { Cv, CvDesign, CvTemplateId } from "@/cv/types";
import { LOCALES } from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { Checklist, type LengthIssue } from "./editor/Checklist";
import { ProgressRing } from "./editor/ProgressRing";
import { Segmented } from "./editor/Segmented";
import type { CvEditorProps } from "./types";

export type PanelTab = "design" | "check";

/**
 * Another design keeps the colour and fonts the student picked; ones they never touched follow
 * the new design's own defaults.
 */
export function switchTemplate(cv: Cv, id: CvTemplateId): Cv {
  if (cv.design.template === id) return cv;
  const from = templateMeta(cv.design.template);
  const to = templateMeta(id);
  return {
    ...cv,
    design: {
      ...cv.design,
      template: id,
      accent: cv.design.accent === from.accent ? to.accent : cv.design.accent,
      fonts: cv.design.fonts === from.fonts ? to.fonts : cv.design.fonts,
    },
  };
}

/** Black or white for a check mark on a swatch. */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const y = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return y > 160 ? "#16171a" : "#ffffff";
}

/** The CV a little behind the typing: six live thumbnails don't need every keystroke. */
function useCalm<T>(value: T, ms: number) {
  const [calm, setCalm] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setCalm(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return calm;
}

const Thumb = memo(function Thumb({ cv, width }: { cv: Cv; width: number }) {
  return <CvThumbnail cv={cv} width={width} />;
});

function Block({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3.5 last:border-b-0">
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      {children}
      {hint && <p className="mt-2 text-[12px] leading-snug text-ink-3">{hint}</p>}
    </section>
  );
}

/**
 * Design, colour, fonts, photo shape, text size, dates and the CV's language, and the checklist
 * with the progress ring. A right-hand panel on wide screens, the "Design" view on phones.
 */
export function DesignPanel({
  cv,
  change,
  tab: tabProp,
  onTab,
  onJump,
  onClose,
  issue,
  className,
}: CvEditorProps & {
  tab?: PanelTab;
  onTab?: (tab: PanelTab) => void;
  onJump?: (check: CvCheck) => void;
  onClose?: () => void;
  /** Shown in the checklist: the CV is cut off or too long. */
  issue?: LengthIssue | null;
  className?: string;
}) {
  const t = useMessages(cvEditorText);
  const [ownTab, setOwnTab] = useState<PanelTab>("design");
  const tab = tabProp ?? ownTab;
  const setTab = onTab ?? setOwnTab;
  const progress = cvProgress(cv);

  return (
    <aside className={cn(deckFontVars, "flex min-h-0 flex-col bg-surface", className)} aria-label={t.panel}>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <Segmented
          kind="tabs"
          label={t.panel}
          value={tab}
          onChange={setTab}
          className="flex-1"
          options={[
            { id: "design", label: t.tabs.design },
            {
              id: "check",
              label: (
                <>
                  {t.tabs.check}
                  <ProgressRing value={progress} size={15} stroke={2.5} />
                </>
              ),
            },
          ]}
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink"
            aria-label={t.closePanel}
            title={t.closePanel}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20" role="tabpanel" aria-label={t.tabs[tab]}>
        {tab === "design" ? <DesignSettings cv={cv} change={change} /> : <Checklist cv={cv} onJump={(c) => onJump?.(c)} issue={issue} />}
      </div>
    </aside>
  );
}

function DesignSettings({ cv, change }: CvEditorProps) {
  const t = useMessages(cvEditorText);
  const locale = useLocale();
  const d = cv.design;
  const setDesign = (patch: Partial<CvDesign>) => change((c) => ({ ...c, design: { ...c.design, ...patch } }));
  const meta = templateMeta(d.template);
  const custom = !CV_ACCENTS.includes(d.accent);
  // Minimal draws a real photo only: "initials" leaves the place empty there.
  const noInitials = meta.initials === false;
  const noPicture = !meta.photo || d.portrait === "none" || (noInitials && d.portrait === "initials");

  // Thumbnails: as many columns as fit, each a whole number of pixels wide.
  const gridRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState({ cols: 2, width: 124 });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const cols = w >= 560 ? 4 : w >= 330 ? 3 : 2;
      const width = Math.floor((w - (cols - 1) * 10) / cols);
      setGrid((g) => (g.cols === cols && g.width === width ? g : { cols, width }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const calm = useCalm(cv, 350);
  const variants = useMemo(() => CV_TEMPLATES.map((m) => ({ meta: m, cv: switchTemplate(calm, m.id) })), [calm]);

  return (
    <>
      <Block title={t.template} hint={resolveText(meta.blurb, locale)}>
        <div ref={gridRef} role="radiogroup" aria-label={t.template} className="grid gap-x-2.5 gap-y-3" style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}>
          {variants.map(({ meta: m, cv: variant }) => {
            const active = m.id === d.template;
            const name = resolveText(m.name, locale);
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={resolveText(m.blurb, locale)}
                onClick={() => change((c) => switchTemplate(c, m.id))}
                className="group min-w-0 text-left outline-none"
              >
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-[5px] bg-white transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-blob",
                    active ? "ring-2 ring-blob" : "ring-1 ring-ink/10 group-hover:ring-ink/25 dark:ring-white/15",
                  )}
                >
                  <Thumb cv={variant} width={grid.width} />
                  {active && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-blob text-white shadow-card">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={cn("mt-1.5 block truncate px-0.5 text-[12.5px]", active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink")}>{name}</span>
              </button>
            );
          })}
        </div>
      </Block>

      <Block title={t.colour} hint={t.colourHint}>
        <div role="radiogroup" aria-label={t.colour} className="grid grid-cols-9 gap-1.5">
          {CV_ACCENTS.map((c) => {
            const active = c === d.accent;
            const name = t.accentNames[c] ?? c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name}
                title={name}
                onClick={() => setDesign({ accent: c })}
                className={cn(
                  "grid aspect-square place-items-center rounded-full ring-offset-2 ring-offset-surface inset-ring inset-ring-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob dark:inset-ring-white/20",
                  active && "ring-2 ring-ink/70",
                )}
                style={{ background: c }}
              >
                {active && <Check className="size-3.5" strokeWidth={3} style={{ color: inkOn(c) }} />}
              </button>
            );
          })}
          <label
            className={cn(
              "relative grid aspect-square cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface inset-ring inset-ring-black/10 transition-transform focus-within:ring-2 focus-within:ring-blob hover:scale-110 dark:inset-ring-white/20",
              custom && "ring-2 ring-ink/70",
            )}
            style={{ background: custom ? d.accent : "conic-gradient(from 90deg, #f2b8b8, #f5e3a3, #b9e3c2, #b4d3f5, #d6c2f7, #f2b8b8)" }}
            title={t.customColour}
          >
            {custom && <Check className="size-3.5" strokeWidth={3} style={{ color: inkOn(d.accent) }} />}
            <input
              type="color"
              value={d.accent}
              onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setDesign({ accent: e.target.value.toLowerCase() })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label={t.customColour}
            />
          </label>
        </div>
      </Block>

      <Block title={t.fonts}>
        <div role="radiogroup" aria-label={t.fonts} className="grid grid-cols-2 gap-1.5">
          {CV_FONT_IDS.map((id) => {
            const f = CV_FONTS[id];
            const active = id === d.fonts;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDesign({ fonts: id })}
                className={cn(
                  "min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active ? "border-blob bg-blob-soft/50 shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)]" : "border-line bg-raised hover:border-line-2",
                )}
              >
                <span className="block truncate text-[17px] leading-tight text-ink" style={{ fontFamily: f.heading, fontWeight: f.headingWeight }}>
                  {t.fontNames[id]}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-3" style={{ fontFamily: f.body }}>
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      </Block>

      <Block title={t.portrait} hint={!meta.photo ? t.noPhotoTemplate(resolveText(meta.name, locale)) : noInitials && d.portrait !== "none" ? t.photoOnlyTemplate : t.portraitHints[d.portrait]}>
        <Segmented
          label={t.portrait}
          value={d.portrait}
          onChange={(portrait) => setDesign({ portrait })}
          disabled={!meta.photo}
          options={(["photo", "initials", "none"] as const).map((id) => ({ id, label: t.portraitModes[id], disabled: id === "initials" && noInitials }))}
        />
        <div role="radiogroup" aria-label={t.shape} className={cn("mt-2 grid grid-cols-3 gap-1", noPicture && "pointer-events-none opacity-45")}>
          {(["circle", "rounded", "square"] as const).map((shape) => {
            const active = shape === d.photoShape;
            return (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={noPicture}
                onClick={() => setDesign({ photoShape: shape })}
                className={cn("flex flex-col items-center gap-1 rounded-lg py-1.5 transition-colors hover:bg-hover", active && "bg-hover/70")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "block border-2 transition-colors",
                    shape === "circle" ? "size-7 rounded-full" : shape === "rounded" ? "h-8 w-[26px] rounded-[7px]" : "h-8 w-[26px] rounded-[2px]",
                    active ? "border-blob bg-blob-soft" : "border-ink-3/45 bg-raised",
                  )}
                />
                <span className={cn("text-[11.5px]", active ? "font-medium text-ink" : "text-ink-3")}>{t.shapes[shape]}</span>
              </button>
            );
          })}
        </div>
      </Block>

      <Block title={t.size} hint={t.sizeHint}>
        <Segmented
          label={t.size}
          value={d.size}
          onChange={(size) => setDesign({ size })}
          options={(["s", "m", "l"] as const).map((id) => ({
            id,
            label: <span className={id === "s" ? "text-[11.5px]" : id === "l" ? "text-[14px]" : undefined}>{t.sizes[id]}</span>,
          }))}
        />
      </Block>

      <Block title={t.dates}>
        <Segmented
          label={t.dates}
          value={d.dates}
          onChange={(dates) => setDesign({ dates })}
          options={(["numeric", "long"] as const).map((id) => ({ id, label: formatMonth("2024-08", cv.lang, id) }))}
        />
      </Block>

      <Block title={t.cvLang} hint={t.cvLangHint}>
        <Segmented
          label={t.cvLang}
          value={cv.lang}
          onChange={(lang) => change((c) => (c.lang === lang ? c : { ...c, lang }))}
          options={LOCALES.map((id) => ({ id, label: t.langNames[id] }))}
        />
      </Block>
    </>
  );
}
