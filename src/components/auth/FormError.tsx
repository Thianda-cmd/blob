"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function FormError({ message, children }: { message: string | null | undefined; children?: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-[13px] text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              {message}
              {children && <div>{children}</div>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
