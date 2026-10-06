"use client";

// A human karyogram: metaphase chromosomes sorted into pairs by size and centromere position,
// numbered 1 to 22, plus the sex chromosomes. Can show trisomies and sex chromosome aberrations.

import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";

export type Karyotype = "46,XX" | "46,XY" | "47,XX,+21" | "47,XY,+21" | "47,XY,+18" | "47,XX,+13" | "45,X" | "47,XXY" | "47,XXX" | "47,XYY";

export const KARYOTYPES: Karyotype[] = ["46,XX", "46,XY", "47,XX,+21", "47,XY,+21", "47,XY,+18", "47,XX,+13", "45,X", "47,XXY", "47,XXX", "47,XYY"];

/** Length in Mb (rounded) and share of the short arm, chromosomes 1 to 22, then X and Y. */
const CHR: [number, number][] = [
  [248, 0.49], [242, 0.39], [198, 0.46], [190, 0.29], [181, 0.27], [171, 0.35], [159, 0.38], [145, 0.33], [138, 0.34], [134, 0.31], [135, 0.39], [133, 0.27],
  [114, 0.16], [107, 0.17], [102, 0.19], [90, 0.42], [83, 0.33], [80, 0.25], [59, 0.45], [64, 0.44], [47, 0.27], [51, 0.28], [156, 0.39], [57, 0.27],
];

/** Dark G bands (start, end) as shares of the chromosome from the top of the p arm; made up but stable. */
function bandsOf(i: number): [number, number][] {
  const out: [number, number][] = [];
  let h = (i + 7) * 2654435761;
  let pos = 0.06 + ((h >>> 3) % 7) / 100;
  while (pos < 0.9) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const w = 0.04 + (h % 6) / 100;
    out.push([pos, Math.min(0.95, pos + w)]);
    pos += w + 0.07 + ((h >>> 8) % 9) / 100;
  }
  return out;
}

const ROWS: (number | "sex")[][] = [
  [1, 2, 3, 0, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 0, 16, 17, 18],
  [19, 20, 0, 21, 22, 0, "sex"],
];
const ROW_Y = [50, 140, 216, 288];
const K = 0.3;
const W = 600;

/** How many copies of each autosome, and the sex chromosomes. */
export function karyoCounts(k: Karyotype) {
  const auto = Array.from({ length: 23 }, () => 2);
  const extra = k.match(/\+(\d+)/);
  if (extra) auto[Number(extra[1])] = 3;
  const sex = k.split(",")[1].split("");
  return { auto, sex };
}

function Chrom({ x, y, idx, mark }: { x: number; y: number; idx: number; mark?: boolean }) {
  const [mb, cf] = CHR[idx];
  const len = mb * K;
  const p = len * cf;
  const q = len - p;
  const w = 4.4;
  const bands = bandsOf(idx);
  return (
    <g>
      {[-1, 1].map((s) => {
        const cx = x + s * 2.3;
        const top = y - p;
        const seg = (a: number, b: number) => {
          // A band from share a to b, skipping the centromere gap.
          const y1 = top + a * len;
          const y2 = top + b * len;
          return `M${cx} ${y1.toFixed(1)}L${cx} ${y2.toFixed(1)}`;
        };
        return (
          <g key={s}>
            <path d={`M${cx} ${top + w / 2}L${cx} ${y - 1.6}M${cx} ${y + 1.6}L${cx} ${y + q - w / 2}`} stroke="var(--bio-outline)" strokeWidth={w + 1.8} strokeLinecap="round" />
            <path d={`M${cx} ${y - 2}L${cx} ${y + 2}`} stroke="var(--bio-outline)" strokeWidth={w * 0.5 + 1.8} />
            <path d={`M${cx} ${top + w / 2}L${cx} ${y - 1.6}M${cx} ${y + 1.6}L${cx} ${y + q - w / 2}`} stroke="var(--bio-nucleus)" strokeWidth={w} strokeLinecap="round" />
            <path d={`M${cx} ${y - 2}L${cx} ${y + 2}`} stroke="var(--bio-nucleus)" strokeWidth={w * 0.5} />
            <path d={bands.filter(([a, b]) => Math.abs(top + ((a + b) / 2) * len - y) > 2.5).map(([a, b]) => seg(a, b)).join("")} stroke="var(--bio-nucleus-deep)" strokeWidth={w} />
          </g>
        );
      })}
      {mark && <rect x={x - 9} y={y - p - 5} width={18} height={len + 10} rx={6} fill="none" stroke="var(--blob)" strokeWidth={2} />}
    </g>
  );
}

/** A karyogram. `mark` outlines what is unusual (for solutions and the lesson). */
export function DivisionKaryogram({ karyotype = "46,XX", mark = false }: { karyotype?: Karyotype; mark?: boolean }) {
  const t = useText();
  const { auto, sex } = karyoCounts(karyotype);
  const slot = 66;
  const gapGroup = 18;
  const label = (x: number, y: number, s: string, key: string, hot?: boolean) => (
    <text key={key} x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={hot ? 700 : 500} fill={hot ? "var(--blob)" : "var(--ink-2)"} style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );
  const title: Text = tx(`Karyogram of a person`, `Karyogramm eines Menschen`);
  return (
    <svg viewBox={`0 0 ${W} 340`} className="mx-auto block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(title)}>
      {ROWS.map((row, r) => {
        const items = row.map((c) => (c === "sex" ? Math.max(2, sex.length) * 17 + 10 : c === 0 ? gapGroup : slot));
        const total = items.reduce((a, b) => a + b, 0);
        let x = (W - total) / 2;
        const y = ROW_Y[r];
        const labelY = r === 0 ? 108 : r === 1 ? 188 : r === 2 ? 258 : 332;
        return (
          <g key={r}>
            <line x1={(W - total) / 2} x2={(W + total) / 2} y1={labelY - 13} y2={labelY - 13} stroke="var(--line)" strokeWidth={1} />
            {row.map((c, j) => {
              const wSlot = items[j];
              const x0 = x;
              x += wSlot;
              if (c === 0) return null;
              if (c === "sex") {
                const n = sex.length;
                const odd = karyotype !== "46,XX" && karyotype !== "46,XY" && !karyotype.includes("+");
                return (
                  <g key="sex">
                    {sex.map((s, i) => {
                      const cx = x0 + wSlot / 2 + (i - (n - 1) / 2) * 17;
                      return (
                        <g key={i}>
                          <Chrom x={cx} y={y} idx={s === "X" ? 22 : 23} />
                          {label(cx, labelY, s, `l${i}`, mark && odd)}
                        </g>
                      );
                    })}
                    {mark && odd && <rect x={x0 + 2} y={y - 24} width={wSlot - 4} height={labelY - y + 30} rx={8} fill="none" stroke="var(--blob)" strokeWidth={2} />}
                  </g>
                );
              }
              const n = auto[c];
              return (
                <g key={c}>
                  {Array.from({ length: n }, (_, i) => (
                    <Chrom key={i} x={x0 + wSlot / 2 + (i - (n - 1) / 2) * 17} y={y} idx={c - 1} mark={mark && n === 3 && i === 2} />
                  ))}
                  {label(x0 + wSlot / 2, labelY, String(c), `l${c}`, mark && n === 3)}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
