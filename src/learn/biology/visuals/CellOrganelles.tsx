"use client";

// Small SVG building blocks for cell drawings (topic "cell"), so a mitochondrion or a
// chloroplast looks the same in every picture. All colours come from the biology palette.

/** A mitochondrion: smooth outer membrane, inner membrane folded into cristae. Length 2·l. */
export function Mitochondrion({ x, y, rot = 0, l = 22, w = 10 }: { x: number; y: number; rot?: number; l?: number; w?: number }) {
  const n = Math.max(2, Math.round((2 * l - 10) / 9));
  const step = (2 * l - 12) / n;
  const folds = Array.from({ length: n }, (_, i) => -l + 6 + step * (i + 0.5));
  const top = -(w - 2.6);
  const bottom = w - 2.6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-l} y={-w} width={2 * l} height={2 * w} rx={w} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
      <rect x={-l + 2.6} y={top} width={2 * l - 5.2} height={2 * w - 5.2} rx={w - 2.6} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1.1} />
      {folds.map((fx, i) => {
        const fromTop = i % 2 === 0;
        const y0 = fromTop ? top : bottom;
        const y1 = fromTop ? w * 0.35 : -w * 0.35;
        return (
          <path
            key={i}
            d={`M ${fx - 1.6} ${y0} L ${fx - 1.6} ${y1} Q ${fx} ${y1 + (fromTop ? 2.4 : -2.4)} ${fx + 1.6} ${y1} L ${fx + 1.6} ${y0}`}
            fill="none"
            stroke="var(--bio-mito-deep)"
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

/**
 * A chloroplast. `em`: double membrane, grana stacks of thylakoids and stroma thylakoids
 * (electron microscope); otherwise a green lens with a few grana dots (light microscope).
 */
export function Chloroplast({ x, y, rot = 0, rx = 21, ry = 10, em = false }: { x: number; y: number; rot?: number; rx?: number; ry?: number; em?: boolean }) {
  const grana = [-rx * 0.5, 0, rx * 0.5];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx={rx} ry={ry} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
      {em ? (
        <>
          <ellipse rx={rx - 2.4} ry={ry - 2.4} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.9} />
          <path d={`M ${-rx * 0.72} 0 L ${rx * 0.72} 0`} stroke="var(--bio-leaf-deep)" strokeWidth={0.9} />
          {grana.map((gx, i) => (
            <g key={i} transform={`translate(${gx} ${i === 1 ? -0.6 : 0.6})`}>
              {[-3.6, -1.2, 1.2, 3.6].map((gy) => (
                <rect key={gy} x={-3.6} y={gy - 0.8} width={7.2} height={1.6} rx={0.8} fill="var(--bio-leaf-deep)" />
              ))}
            </g>
          ))}
        </>
      ) : (
        grana.map((gx, i) => <circle key={i} cx={gx} cy={i === 1 ? -1.5 : 1.5} r={2.1} fill="var(--bio-leaf-deep)" opacity={0.75} />)
      )}
    </g>
  );
}

/**
 * A nucleus with nucleolus and a hint of chromatin. `em` draws the nuclear envelope as a
 * double membrane with pores (the gaps).
 */
export function Nucleus({ x, y, r, em = false, nucleolus = true }: { x: number; y: number; r: number; em?: boolean; nucleolus?: boolean }) {
  const c = 2 * Math.PI * r;
  const pores = Math.max(8, Math.round(c / 34));
  const dash = `${c / pores - 4.5} 4.5`;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--bio-nucleus)" stroke={em ? "none" : "var(--bio-nucleus-deep)"} strokeWidth={2} />
      <path
        d={`M ${x - r * 0.55} ${y + r * 0.25} q ${r * 0.18} ${-r * 0.3} ${r * 0.36} 0 t ${r * 0.36} 0 M ${x - r * 0.2} ${y + r * 0.55} q ${r * 0.15} ${-r * 0.22} ${r * 0.3} 0 t ${r * 0.3} 0 M ${x + r * 0.05} ${y - r * 0.62} q ${r * 0.15} ${r * 0.2} ${r * 0.3} 0`}
        fill="none"
        stroke="var(--bio-nucleus-deep)"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.45}
      />
      {nucleolus && <circle cx={x + r * 0.22} cy={y - r * 0.12} r={r * 0.26} fill="var(--bio-nucleus-deep)" opacity={0.6} />}
      {em && (
        <>
          <circle cx={x} cy={y} r={r} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={5} strokeDasharray={dash} />
          <circle cx={x} cy={y} r={r} fill="none" stroke="var(--bio-nucleus)" strokeWidth={1.6} strokeDasharray={dash} />
        </>
      )}
    </g>
  );
}

/** Ribosomes: small dark dots. */
export function Ribosomes({ at, r = 2.2 }: { at: [number, number][]; r?: number }) {
  return (
    <g fill="var(--bio-outline)">
      {at.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  );
}

/** One cisterna of the rough ER: a flat membrane sac (a curve with a lumen), studded with ribosomes. */
export function RoughER({ d, dots }: { d: string[]; dots: [number, number][] }) {
  return (
    <g>
      {d.map((p, i) => (
        <g key={i}>
          <path d={p} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={6} strokeLinecap="round" />
          <path d={p} fill="none" stroke="var(--bio-petal)" strokeWidth={3.2} strokeLinecap="round" />
        </g>
      ))}
      <Ribosomes at={dots} r={1.9} />
    </g>
  );
}

/** Smooth ER: branched tubes without ribosomes. */
export function SmoothER({ d }: { d: string[] }) {
  return (
    <g>
      {d.map((p, i) => (
        <path key={`o${i}`} d={p} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {d.map((p, i) => (
        <path key={`i${i}`} d={p} fill="none" stroke="var(--bio-petal)" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

/**
 * The Golgi apparatus: a stack of curved, flattened sacs (cisternae) with vesicles budding off
 * the rims. Drawn around (x, y), opening towards `rot`.
 */
export function Golgi({ x, y, rot = 0, s = 1 }: { x: number; y: number; rot?: number; s?: number }) {
  const sacs = [0, 1, 2, 3];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {sacs.map((i) => {
        const yy = -15 + i * 9.5;
        const half = 26 - i * 2.5;
        const bend = 7 - i * 0.6;
        const p = `M ${-half} ${yy + bend} Q 0 ${yy - bend} ${half} ${yy + bend}`;
        return (
          <g key={i}>
            <path d={p} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={7} strokeLinecap="round" />
            <path d={p} fill="none" stroke="var(--bio-pollen)" strokeWidth={4.2} strokeLinecap="round" />
          </g>
        );
      })}
      {[
        [-33, 1, 3.6],
        [33, 1, 3.6],
        [-30, 18, 3.2],
        [30, 19, 3.2],
        [-12, 27, 3.8],
        [10, 29, 3.4],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.3} />
      ))}
    </g>
  );
}

/** A small membrane vesicle. */
export function Vesicle({ x, y, r = 4.5 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.3} />;
}

/** A lysosome: a membrane bag full of digestive enzymes (dots). */
export function Lysosome({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.6} />
      {[
        [-0.4, -0.3],
        [0.3, -0.35],
        [0, 0.15],
        [-0.35, 0.35],
        [0.4, 0.3],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx * r} cy={y + dy * r} r={r * 0.13} fill="var(--bio-flesh-deep)" />
      ))}
    </g>
  );
}
