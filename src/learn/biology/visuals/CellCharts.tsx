"use client";

// Small charts for cell-topic tasks: mass change of potato pieces in sugar solutions (finding the
// isotonic point) and uptake rate against concentration (simple diffusion versus carrier).

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useLocale } from "@/i18n/client";

const FONT = { fontFamily: "var(--font-sans)" };

/** Mass change (%) of potato cylinders after a while in sucrose solutions of different concentration. */
export function CellMassChart({ concs, changes }: { concs: number[]; changes: number[] }) {
  const t = useText();
  const locale = useLocale();
  const W = 520;
  const H = 300;
  const X0 = 64;
  const X1 = 496;
  const Y0 = 24;
  const Y1 = 244;
  const maxC = Math.max(...concs);
  const lim = Math.ceil(Math.max(...changes.map(Math.abs)) / 5) * 5 || 5;
  const x = (c: number) => X0 + (c / maxC) * (X1 - X0);
  const y = (v: number) => Y0 + ((lim - v) / (2 * lim)) * (Y1 - Y0);
  const fmt = (v: number, d = 1) => new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: d }).format(v);
  const ticksY = [-lim, -lim / 2, 0, lim / 2, lim];
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Mass change against sucrose concentration", "Massenänderung gegen Saccharosekonzentration"))}>
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.6 : 1} />
            <text x={X0 - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--ink)" opacity={0.7} style={FONT}>
              {v > 0 ? "+" : ""}
              {fmt(v)}
            </text>
          </g>
        ))}
        <line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--ink-2)" strokeWidth={1.4} />
        <line x1={X0} x2={X1} y1={y(0)} y2={y(0)} stroke="var(--ink-2)" strokeWidth={1.4} />
        {concs.map((c) => (
          <text key={c} x={x(c)} y={Y1 + 18} textAnchor="middle" fontSize={12} fill="var(--ink)" opacity={0.7} style={FONT}>
            {fmt(c, 2)}
          </text>
        ))}
        <text x={(X0 + X1) / 2} y={H - 6} textAnchor="middle" fontSize={12.5} fill="var(--ink)" style={FONT}>
          {t(tx("sucrose concentration (mol/L)", "Saccharosekonzentration (mol/L)"))}
        </text>
        <text x={16} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={12.5} fill="var(--ink)" style={FONT} transform={`rotate(-90 16 ${(Y0 + Y1) / 2})`}>
          {t(tx("change in mass (%)", "Massenänderung (%)"))}
        </text>
        <polyline points={concs.map((c, i) => `${x(c)},${y(changes[i])}`).join(" ")} fill="none" stroke="var(--bio-water-deep)" strokeWidth={2} strokeLinejoin="round" />
        {concs.map((c, i) => (
          <circle key={c} cx={x(c)} cy={y(changes[i])} r={5} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.6} />
        ))}
      </svg>
      <div className="overflow-x-auto">
        <table className="mx-auto border-collapse text-[13.5px]">
          <tbody>
            <tr>
              <th className="border border-line bg-surface px-2.5 py-1 text-left font-semibold text-ink-2">{t(tx("sucrose (mol/L)", "Saccharose (mol/L)"))}</th>
              {concs.map((c) => (
                <td key={c} className="border border-line px-2.5 py-1 text-center font-math">
                  {fmt(c, 2)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-line bg-surface px-2.5 py-1 text-left font-semibold text-ink-2">{t(tx("change in mass (%)", "Massenänderung (%)"))}</th>
              {changes.map((v, i) => (
                <td key={i} className="border border-line px-2.5 py-1 text-center font-math">
                  {v > 0 ? "+" : ""}
                  {fmt(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Uptake rate against outside concentration: one straight line (simple diffusion) and one curve
 * that levels off (carrier, saturation). `carrier` says which letter the carrier curve gets.
 */
export function CellUptakeChart({ carrier }: { carrier: "A" | "B" }) {
  const t = useText();
  const W = 460;
  const H = 280;
  const X0 = 56;
  const X1 = 430;
  const Y0 = 20;
  const Y1 = 236;
  const pts = (f: (u: number) => number) =>
    Array.from({ length: 41 }, (_, i) => {
      const u = i / 40;
      return `${X0 + u * (X1 - X0)},${Y1 - f(u) * (Y1 - Y0)}`;
    }).join(" ");
  const linear = (u: number) => 0.92 * u;
  const sat = (u: number) => (0.72 * u) / (u + 0.16) / (1 / 1.16);
  const curves = [
    { letter: carrier === "A" ? "A" : "B", f: sat, color: "var(--bio-petal-deep)" },
    { letter: carrier === "A" ? "B" : "A", f: linear, color: "var(--bio-water-deep)" },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[500px]" role="img" aria-label={t(tx("Uptake rate against concentration", "Aufnahmerate gegen Konzentration"))}>
      <line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--ink-2)" strokeWidth={1.5} />
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="var(--ink-2)" strokeWidth={1.5} />
      <path d={`M ${X0 - 5} ${Y0 + 8} L ${X0} ${Y0} L ${X0 + 5} ${Y0 + 8} M ${X1 - 8} ${Y1 - 5} L ${X1} ${Y1} L ${X1 - 8} ${Y1 + 5}`} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} />
      {curves.map((c) => (
        <g key={c.letter}>
          <polyline points={pts(c.f)} fill="none" stroke={c.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <text x={X1 - 6} y={Y1 - c.f(1) * (Y1 - Y0) - 10} textAnchor="end" fontSize={16} fontWeight={700} fill={c.color} style={FONT}>
            {c.letter}
          </text>
        </g>
      ))}
      <text x={(X0 + X1) / 2} y={H - 12} textAnchor="middle" fontSize={12.5} fill="var(--ink)" style={FONT}>
        {t(tx("concentration of the substance outside", "Konzentration des Stoffes außen"))}
      </text>
      <text x={20} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={12.5} fill="var(--ink)" style={FONT} transform={`rotate(-90 20 ${(Y0 + Y1) / 2})`}>
        {t(tx("uptake rate", "Aufnahmerate"))}
      </text>
    </svg>
  );
}
