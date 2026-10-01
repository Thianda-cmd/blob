"use client";

import { AnimatePresence, motion } from "motion/react";
import { FileText, House, ListChecks } from "lucide-react";
import { subjectColor } from "@/lib/subjects";
import { cn, firstName } from "@/lib/utils";
import type { Picked } from "./SubjectChip";

/** A small live mock of the sidebar that fills in as you answer. */
export function SpacePreview({
  name,
  school,
  grade,
  picked,
  showNote,
}: {
  name: string;
  school: string;
  grade: string;
  picked: Picked[];
  showNote: boolean;
}) {
  const initial = (name.trim() || "?")[0]!.toUpperCase();
  const meta = [school.trim(), grade.trim()].filter(Boolean).join(" · ");
  const shown = picked.slice(0, 6);
  const more = picked.length - shown.length;

  return (
    <div className="w-[300px] rounded-2xl border border-line bg-surface p-2.5 text-left shadow-pop">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
        <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-blob text-[13px] font-semibold text-white">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={initial}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
            >
              {initial}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold leading-tight">
            {name.trim() ? `${firstName(name)}'s space` : "Your space"}
          </span>
          <span className="block truncate text-[11.5px] leading-tight text-ink-3">{meta || "Notes, slides and homework"}</span>
        </span>
      </div>

      <div className="mt-2 space-y-px">
        <PreviewRow icon={<House className="size-3.5" />}>Home</PreviewRow>
        <PreviewRow icon={<ListChecks className="size-3.5" />}>Tasks</PreviewRow>
      </div>

      <div className="mt-2.5 px-1.5 text-[11px] font-medium text-ink-3">Subjects</div>
      <motion.div layout className="mt-0.5 min-h-7 space-y-px">
        <AnimatePresence initial={false}>
          {shown.map((s) => (
            <motion.div
              key={s.name}
              layout
              initial={{ opacity: 0, x: -10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9, transition: { duration: 0.14 } }}
              transition={{ type: "spring", stiffness: 520, damping: 30 }}
            >
              <PreviewRow
                icon={
                  s.emoji ? (
                    <span className="text-[12.5px] leading-none">{s.emoji}</span>
                  ) : (
                    <span className="size-2 rounded-full" style={{ background: subjectColor(s.color) }} />
                  )
                }
                dot={subjectColor(s.color)}
              >
                {s.name}
              </PreviewRow>
            </motion.div>
          ))}
        </AnimatePresence>
        {picked.length === 0 && (
          <div className="flex h-7 items-center gap-2 px-1.5">
            <span className="h-1.5 w-24 rounded-full bg-line" />
          </div>
        )}
        {more > 0 && <div className="px-1.5 pt-0.5 text-[11.5px] text-ink-3">and {more} more</div>}
      </motion.div>

      <motion.div layout className="mt-2.5 px-1.5 text-[11px] font-medium text-ink-3">
        Notes
      </motion.div>
      <motion.div layout className="mt-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {showNote ? (
            <motion.div
              key="note"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 30 }}
            >
              <PreviewRow icon={<FileText className="size-3.5" />}>Welcome to Blob 👋</PreviewRow>
            </motion.div>
          ) : (
            <motion.div key="empty" exit={{ opacity: 0 }} className="flex h-7 items-center px-1.5">
              <span className="h-1.5 w-20 rounded-full bg-line" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function PreviewRow({ icon, children, dot }: { icon: React.ReactNode; children: React.ReactNode; dot?: string }) {
  return (
    <div className={cn("flex h-7 items-center gap-2 rounded-md px-1.5 text-[12.5px] text-ink-2")}>
      <span className="grid size-4 shrink-0 place-items-center text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {dot && <span className="size-1.5 shrink-0 rounded-full opacity-80" style={{ background: dot }} />}
    </div>
  );
}
