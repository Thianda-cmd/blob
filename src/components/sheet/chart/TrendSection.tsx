"use client";

// The trendline part of the chart panel: the model (like Excel's "Trendlinie formatieren"),
// its options, the fitted equation and R² read out live, and "Probe berechnen": type a measured
// value and get x back (the concentration of a sample from its absorbance).

import { Calculator, Check, ClipboardCopy, Info, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/Segmented";
import type { Locale } from "@/i18n/config";
import type { SheetChartText } from "@/i18n/messages/sheetChart";
import { cn } from "@/lib/utils";
import type { ChartSeriesData } from "@/sheet/chart/data";
import { formatGeneral, formatSignificant, parseChartNumber } from "@/sheet/chart/format";
import { equationParts, equationText, isFitError, r2Text, solveForX, type Fit } from "@/sheet/chart/regression";
import { trendlineName } from "@/sheet/chart/scene";
import type { ChartSpec, SeriesSpec, TrendlineSpec } from "@/sheet/types";
import type { SheetStore } from "../store";
import { LINEAR_TRENDLINE, updateChart } from "./actions";
import { Chips, Field, Note, NumberField, TextField, Toggle } from "./PanelParts";

type TrendType = TrendlineSpec["type"];
const TYPES: (TrendType | "none")[] = ["none", "linear", "polynomial", "exponential", "logarithmic", "power", "movingAverage"];

/** Little drawings of each model (points and the curve through them). */
function TrendGlyph({ type }: { type: TrendType | "none" }) {
  const curve: Record<TrendType | "none", string | null> = {
    none: null,
    linear: "M3 17L29 4",
    polynomial: "M3 5C9 19 23 19 29 5",
    exponential: "M3 17C16 17 23 13 29 3",
    logarithmic: "M3 18C6 8 14 5 29 4",
    power: "M3 18C12 17 21 12 29 4",
    movingAverage: "M3 14L9 10L15 12L21 7L29 6",
  };
  const dots = type === "polynomial" ? [6, 11, 16, 21, 26].map((x, i) => [x, [10, 15, 16, 14, 9][i]]) : [6, 12, 18, 24].map((x, i) => [x, [14, 12, 9, 6][i]]);
  return (
    <svg viewBox="0 0 32 21" width="32" height="21" aria-hidden className="overflow-visible">
      {dots.map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r="1.6" fill="currentColor" opacity="0.55" />
      ))}
      {curve[type] && <path d={curve[type]!} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={type === "movingAverage" ? undefined : "3 2"} />}
    </svg>
  );
}

/** The equation with real superscripts. */
function Equation({ fit, locale, digits }: { fit: Fit; locale: Locale; digits?: number }) {
  return (
    <>
      {equationParts(fit, locale, digits).map((p, i) =>
        p.sup ? (
          <sup key={i} className="text-[0.72em]">
            {p.text}
          </sup>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function CopyButton({ text, label, t }: { text: string; label: string; t: SheetChartText }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-8 [&_svg]:size-3.5"
    >
      {done ? <Check className="text-ok" /> : <ClipboardCopy />}
      {done ? t.copied : t.copy}
    </button>
  );
}

export function TrendSection({
  store,
  spec,
  series,
  data,
  locale,
  t,
  readOnly,
  picker,
}: {
  store: SheetStore;
  spec: ChartSpec;
  series: SeriesSpec;
  data: ChartSeriesData | undefined;
  locale: Locale;
  t: SheetChartText;
  readOnly: boolean;
  picker: ReactNode;
}) {
  const tl = series.trendline;
  const fit = data?.fit ?? null;
  const [more, setMore] = useState(false);
  if (spec.kind === "pie") return <Note icon={<Info />}>{t.noTrendPie}</Note>;

  const set = (patch: Partial<TrendlineSpec> | null) =>
    updateChart(store, spec.id, t.undo.trend, (c) => ({
      ...c,
      series: c.series.map((s) => (s.id === series.id ? { ...s, trendline: patch === null ? null : { ...(s.trendline ?? LINEAR_TRENDLINE), ...patch } } : s)),
    }));
  const choose = (type: TrendType | "none") => {
    if (type === "none") return set(null);
    // A fixed intercept doesn't exist for logarithmic and power fits; exponential needs one above 0.
    const intercept = tl?.intercept ?? null;
    const fixed = type === "logarithmic" || type === "power" || type === "movingAverage" ? null : type === "exponential" && intercept !== null && intercept <= 0 ? 1 : intercept;
    set({ type, intercept: fixed });
  };
  const seriesName = data?.name ?? series.name;
  const canIntercept = tl && (tl.type === "linear" || tl.type === "polynomial" || tl.type === "exponential");
  const n = data?.points.length ?? 0;

  return (
    <div className="space-y-3.5">
      {picker}
      <Chips
        label={t.trendline}
        value={tl?.type ?? "none"}
        size="tile"
        columns={3}
        onChange={(v) => !readOnly && choose(v)}
        options={TYPES.map((v) => ({ value: v, label: v === "none" ? t.none : t.trendTypes[v], icon: <TrendGlyph type={v} />, disabled: readOnly }))}
      />
      {tl && (
        <>
          {tl.type === "polynomial" && (
            <Field label={t.order}>
              <Segmented
                label={t.order}
                value={String(Math.max(2, Math.min(6, tl.order))) as "2"}
                options={["2", "3", "4", "5", "6"].map((v) => ({ value: v as "2", label: v }))}
                onChange={(v) => set({ order: Number(v) })}
              />
            </Field>
          )}
          {tl.type === "movingAverage" && (
            <Field label={t.period}>
              <NumberField locale={locale} value={tl.period} min={2} max={Math.max(2, n - 1)} integer onCommit={(v) => v !== null && set({ period: v })} label={t.period} className="w-24" />
            </Field>
          )}

          {/* What the fit gives: equation, R², or why there is none. */}
          <div className="rounded-xl border border-line bg-paper/60 p-3" aria-live="polite">
            {fit && isFitError(fit) ? (
              <div className="flex gap-2 text-[12.5px] leading-snug text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {t.fitProblems[fit.error]}
              </div>
            ) : fit ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    {fit.type !== "movingAverage" && (
                      <div className="break-words font-medium tabular-nums text-ink text-[15px]">
                        <Equation fit={fit} locale={locale} digits={more ? 6 : undefined} />
                      </div>
                    )}
                    {fit.r2 !== null && <div className="tabular-nums text-[13.5px] text-ink-2">{r2Text(fit.r2, locale, more ? 6 : undefined)}</div>}
                    {fit.type === "movingAverage" && <div className="text-[13px] text-ink-2">{trendlineName(tl, seriesName, locale)}</div>}
                    <div className="text-[11.5px] text-ink-3">{t.points(fit.n)}</div>
                  </div>
                  {fit.type !== "movingAverage" && <CopyButton text={equationText(fit, locale, more ? 6 : undefined)} label={t.copyEquation} t={t} />}
                </div>
                {fit.type !== "movingAverage" && (
                  <button type="button" onClick={() => setMore((m) => !m)} className="mt-1.5 text-[11.5px] font-medium text-blob-ink hover:underline">
                    {more ? t.fewerDigits : t.moreDigits}
                  </button>
                )}
              </>
            ) : null}
          </div>
          {spec.kind !== "scatter" && <Note icon={<Info />}>{t.categoryX}</Note>}

          {fit && !isFitError(fit) && <Probe fit={fit} spec={spec} locale={locale} t={t} seriesName={seriesName} />}

          {tl.type !== "movingAverage" && (
            <div className="space-y-1">
              <Toggle label={t.showEquation} checked={tl.showEquation} disabled={readOnly} onChange={(v) => set({ showEquation: v })} />
              <Toggle label={t.showR2} checked={tl.showR2} disabled={readOnly} onChange={(v) => set({ showR2: v })} />
            </div>
          )}

          {canIntercept ? (
            <div className="space-y-2">
              <Toggle
                label={t.setIntercept}
                checked={tl.intercept !== null}
                disabled={readOnly}
                onChange={(v) => set({ intercept: v ? (tl.type === "exponential" ? 1 : 0) : null })}
              />
              {tl.intercept !== null && (
                <Field label={t.setIntercept} hint={t.interceptHint}>
                  <NumberField locale={locale} value={tl.intercept} onCommit={(v) => v !== null && set({ intercept: v })} label={t.setIntercept} className="w-32" />
                </Field>
              )}
            </div>
          ) : tl.type !== "movingAverage" ? (
            <p className="text-[11.5px] leading-snug text-ink-3">{t.interceptNotHere}</p>
          ) : null}

          {tl.type !== "movingAverage" && (
            <Field label={t.forecast}>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11.5px] text-ink-3">{t.forward}</span>
                  <NumberField locale={locale} value={tl.forward || null} placeholder="0" allowEmpty min={0} onCommit={(v) => set({ forward: v ?? 0 })} label={`${t.forecast}: ${t.forward}`} />
                </label>
                <label className="space-y-1">
                  <span className="text-[11.5px] text-ink-3">{t.backward}</span>
                  <NumberField locale={locale} value={tl.backward || null} placeholder="0" allowEmpty min={0} onCommit={(v) => set({ backward: v ?? 0 })} label={`${t.forecast}: ${t.backward}`} />
                </label>
              </div>
            </Field>
          )}

          <Field label={t.trendName}>
            <TextField value={tl.name} placeholder={trendlineName({ ...tl, name: "" }, seriesName, locale)} onCommit={(v) => set({ name: v.trim() })} label={t.trendName} />
          </Field>
        </>
      )}
    </div>
  );
}

/** The solution with the numbers put in: "x = (0,42 − 0,0015) / 0,0519 = 8,0685" (the models with a formula). */
function worked(fit: Fit, y: number, x: number, locale: Locale): string | null {
  const g = (v: number) => formatGeneral(v, locale);
  const c = fit.coefficients;
  const result = `= ${formatSignificant(x, locale, 5)}`;
  const minus = (a: string, v: number) => (v < 0 ? `${a} + ${g(-v)}` : `${a} − ${g(v)}`);
  switch (fit.type) {
    case "linear":
      return `x = (${minus(g(y), c[0])}) / ${g(c[1])} ${result}`;
    case "exponential":
      return `x = ln(${g(y)} / ${g(c[0])}) / ${g(c[1])} ${result}`;
    case "logarithmic":
      return `x = e^((${minus(g(y), c[0])}) / ${g(c[1])}) ${result}`;
    case "power":
      return `x = (${g(y)} / ${g(c[0])})^(1 / ${g(c[1])}) ${result}`;
    default:
      return null;
  }
}

/** "Probe berechnen": a measured y → x along the trendline, with how it is worked out. */
function Probe({ fit, spec, locale, t, seriesName }: { fit: Fit; spec: ChartSpec; locale: Locale; t: SheetChartText; seriesName: string }) {
  const [text, setText] = useState("");
  const y = parseChartNumber(text, locale);
  const x = y === null ? null : solveForX(fit, y);
  const yName = spec.yAxis.title.trim() || seriesName || "y";
  const xName = spec.kind === "scatter" ? spec.xAxis.title.trim() || "x" : "x";
  const outside = x !== null && fit.xMin !== undefined && fit.xMax !== undefined && (x < fit.xMin - 1e-9 * Math.abs(fit.xMin) || x > fit.xMax + 1e-9 * Math.abs(fit.xMax));
  const xText = x === null ? "" : formatSignificant(x, locale, 5);
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-ink">
        <Calculator className="size-4 text-ink-3" />
        {t.probe}
      </div>
      <p className="mb-2.5 text-[11.5px] leading-snug text-ink-3">{t.probeIntro}</p>
      <label className="block space-y-1">
        <span className="text-[12px] font-medium text-ink-2">
          {t.measured} ({yName})
        </span>
        <input
          inputMode="decimal"
          value={text}
          placeholder={locale === "de" ? "z. B. 0,42" : "e.g. 0.42"}
          onChange={(e) => setText(e.target.value)}
          className="h-9 w-full rounded-lg border border-line bg-raised px-3 text-[14px] tabular-nums text-ink outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] [@media(hover:none)]:h-10"
        />
      </label>
      {y !== null && (
        <div className="mt-2.5 space-y-1.5" aria-live="polite">
          {x === null ? (
            <p className="text-[12.5px] text-ink-2">{t.probeNone}</p>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-blob-soft px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[11.5px] text-blob-ink/80">{xName}</div>
                <div className={cn("truncate text-[18px] font-semibold tabular-nums leading-tight text-blob-ink")}>{xText}</div>
              </div>
              <CopyButton text={formatSignificant(x, locale, 6)} label={t.copy} t={t} />
            </div>
          )}
          <p className="font-mono text-[11.5px] leading-relaxed text-ink-3">{t.solveHow[fit.type]}</p>
          {x !== null && worked(fit, y, x, locale) && <p className="font-mono text-[11.5px] leading-relaxed text-ink-3">{worked(fit, y, x, locale)}</p>}
          {outside && (
            <Note tone="warn" icon={<TriangleAlert />}>
              {t.probeOutside(formatSignificant(fit.xMin!, locale, 4), formatSignificant(fit.xMax!, locale, 4))}
            </Note>
          )}
        </div>
      )}
    </div>
  );
}
