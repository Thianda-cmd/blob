"use client";

// Task pictures for the "particles" topic: a temperature scale with the melting and boiling
// temperature of a substance (and the temperature asked about), and a small data table.

import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { degC } from "../particles-data";

const W = 420;
const H = 104;
const L = 26;
const R = 26;
const Y = 62;

/** A thermometer lying on its side: melting and boiling temperature marked, plus the temperature asked about. */
export function ParticlesScale({ name, mp, bp, at, regions = false }: { name: Text; mp: number; bp: number; at?: number; regions?: boolean }) {
  const t = useText();
  const locale = useLocale();
  const values = [mp, bp, ...(at === undefined ? [] : [at])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 20);
  const min = lo - span * 0.18;
  const max = hi + span * 0.18;
  const x = (v: number) => L + ((v - min) / (max - min)) * (W - L - R);
  const close = Math.abs(x(mp) - x(bp)) < 70;
  const tick = (v: number, label: string, below: boolean, anchor: "start" | "middle" | "end") => (
    <g>
      <line x1={x(v)} x2={x(v)} y1={Y - 9} y2={Y + 9} stroke="var(--ink-2)" strokeWidth={2} />
      <text x={x(v)} y={below ? Y + 25 : Y + 25} textAnchor={anchor} fontSize={12.5} className="fill-ink-2 font-medium">
        {label}
      </text>
    </g>
  );
  const zones: [number, number, Text][] = [
    [min, mp, tx("solid", "fest")],
    [mp, bp, tx("liquid", "flüssig")],
    [bp, max, tx("gas", "gasförmig")],
  ];
  return (
    <div className="space-y-1">
      <div className="px-1 text-[13px] font-semibold text-ink">{t(name)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${t(name)}: ${t(tx("melting temperature", "Schmelztemperatur"))} ${degC(mp, locale)}, ${t(tx("boiling temperature", "Siedetemperatur"))} ${degC(bp, locale)}`}>
        {regions &&
          zones.map(([a, b, label]) => (
            <g key={t(label)}>
              <rect x={x(a)} y={Y - 7} width={Math.max(0, x(b) - x(a))} height={14} fill="color-mix(in oklab, var(--blob) 14%, transparent)" />
              <text x={(x(a) + x(b)) / 2} y={Y - 14} textAnchor="middle" fontSize={12} className="fill-blob-ink font-semibold">
                {t(label)}
              </text>
            </g>
          ))}
        <line x1={L - 10} x2={W - R + 10} y1={Y} y2={Y} stroke="var(--ink-3)" strokeWidth={2} strokeLinecap="round" />
        <path d={`M${W - R + 10} ${Y - 5} L${W - R + 18} ${Y} L${W - R + 10} ${Y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={2} />
        <text x={W - R + 18} y={Y + 26} textAnchor="end" fontSize={11.5} className="fill-ink-3">
          °C
        </text>
        {tick(mp, `${t(tx("m.p.", "Smt."))} ${degC(mp, locale)}`, false, close ? "end" : "middle")}
        {tick(bp, `${t(tx("b.p.", "Sdt."))} ${degC(bp, locale)}`, false, close ? "start" : "middle")}
        {at !== undefined && (
          <g>
            <path d={`M${x(at)} ${Y - 4} L${x(at) - 7} ${Y - 16} L${x(at) + 7} ${Y - 16} Z`} fill="var(--blob)" />
            <rect x={x(at) - 34} y={Y - 42} width={68} height={24} rx={8} fill="var(--blob)" />
            <text x={x(at)} y={Y - 25.5} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="#fff" className="tabular-nums">
              {degC(at, locale)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Melting and boiling temperatures of a few substances. */
export function ParticlesTable({ rows, highlight }: { rows: { name: Text; mp: number; bp: number }[]; highlight?: number }) {
  const t = useText();
  const locale = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            <th className="px-3 py-2">{t(tx("Substance", "Stoff"))}</th>
            <th className="px-3 py-2 text-right">{t(tx("Melting temp.", "Schmelztemp."))}</th>
            <th className="px-3 py-2 text-right">{t(tx("Boiling temp.", "Siedetemp."))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn("border-t border-line", highlight === i && "bg-blob-soft/50")}>
              <td className="px-3 py-2 font-medium text-ink">{t(r.name)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-2">{degC(r.mp, locale)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-2">{degC(r.bp, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 pt-1.5 text-[11.5px] text-ink-3">{t(tx("At normal pressure (1013 hPa)", "Bei Normaldruck (1013 hPa)"))}</p>
    </div>
  );
}
