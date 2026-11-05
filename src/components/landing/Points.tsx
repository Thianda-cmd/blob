import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Point = { key: string; Icon: LucideIcon; title: string; body: string };

/**
 * What a feature does, one point per line: an icon tile, a title and a sentence. Plain markup that
 * fades up with the CSS reveal, so it works from server and client components alike, without JS.
 */
export function PointList({ points, className }: { points: Point[]; className?: string }) {
  return (
    <ul className={cn("grid gap-5", className)}>
      {points.map(({ key, Icon, title, body }) => (
        <li key={key} className="reveal flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-raised text-blob-ink shadow-card">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
