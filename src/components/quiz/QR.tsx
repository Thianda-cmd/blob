import { encode } from "uqr";

/** A QR code as crisp SVG squares (dark on light, so every phone camera reads it). */
export function QR({ text, size = 160, className }: { text: string; size?: number; className?: string }) {
  const { data, size: n } = encode(text, { ecc: "M", border: 1 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} className={className} shapeRendering="crispEdges" role="img" aria-label={text}>
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#14121c" />
    </svg>
  );
}
