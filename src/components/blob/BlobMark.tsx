import { cn } from "@/lib/utils";

/** Static Blob logo mark. Cheap to render anywhere (sidebar, buttons, favicons). */
export function BlobMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <radialGradient id="blobmark-g" cx="36%" cy="28%" r="80%">
          <stop offset="0%" style={{ stopColor: "var(--blob-light)" }} />
          <stop offset="45%" style={{ stopColor: "var(--blob)" }} />
          <stop offset="100%" style={{ stopColor: "var(--blob-deep)" }} />
        </radialGradient>
      </defs>
      <path
        d="M16 4.5c6.6 0 11.3 4.9 11.6 11.4.2 5-2.6 9.1-6.8 10.4-3 .9-6.6.9-9.6 0C7 25 4.2 20.9 4.4 15.9 4.7 9.4 9.4 4.5 16 4.5Z"
        fill="url(#blobmark-g)"
      />
      <ellipse cx="11.2" cy="10.4" rx="3" ry="1.5" transform="rotate(-28 11.2 10.4)" fill="#fff" opacity=".8" />
      <ellipse cx="12.6" cy="16.8" rx="1.35" ry="1.75" fill="#2a1a12" />
      <ellipse cx="19.4" cy="16.8" rx="1.35" ry="1.75" fill="#2a1a12" />
      <path d="M14.3 20.3q1.7 1.4 3.4 0" stroke="#2a1a12" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
