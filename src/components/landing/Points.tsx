"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type Point = { key: string; Icon: LucideIcon; title: string; body: string };

/** What a feature does, one point per line: an icon tile, a title and a sentence (as in the CV section). */
export function PointList({ points, className }: { points: Point[]; className?: string }) {
  return (
    <ul className={cn("grid gap-5", className)}>
      {points.map(({ key, Icon, title, body }, i) => (
        <motion.li
          key={key}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-raised text-blob-ink shadow-card">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{body}</p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
