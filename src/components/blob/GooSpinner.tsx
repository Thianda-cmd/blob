import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A blob that keeps splitting into droplets and pulling them back in.
 * The metaball look comes from an SVG "goo" filter (blur + alpha threshold).
 */
export function GooSpinner({ size = 64, className, label = "Loading" }: { size?: number; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  const filter = `goo-${id}`;
  return (
    <div role="status" aria-label={label} className={cn("inline-grid place-items-center", className)}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="overflow-visible">
        <defs>
          <filter id={filter} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
            <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
        </defs>
        <g filter={`url(#${filter})`} fill="var(--blob)">
          <circle cx="60" cy="60" r="22" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx="60" cy="60" r={i % 2 ? 8 : 10.5} className="goo-orbit" style={{ animationDelay: `${i * -0.42}s` }} />
          ))}
        </g>
        <g fill="var(--blob-face)" className="goo-eyes">
          <ellipse cx="53" cy="58" rx="2.6" ry="3.4" />
          <ellipse cx="67" cy="58" rx="2.6" ry="3.4" />
        </g>
      </svg>
      <style>{`
        .goo-orbit { transform-origin: 60px 60px; animation: goo-orbit 1.7s cubic-bezier(.55,0,.45,1) infinite; }
        @keyframes goo-orbit {
          0% { transform: rotate(0deg) translateX(0px); }
          45% { transform: rotate(160deg) translateX(30px); }
          100% { transform: rotate(360deg) translateX(0px); }
        }
        .goo-eyes { transform-origin: 60px 58px; animation: goo-blink 3.2s infinite; }
        @keyframes goo-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
      `}</style>
    </div>
  );
}
