"use client";

import { motion, useIsPresent } from "motion/react";
import { useCallback, useState, type ReactNode, type RefObject } from "react";
import { morph, stageVariants, type StageCustom } from "./motion";

/** Stage pieces shared by the presenter and the editor's motion preview. */

/** One slide on the stage. The incoming slide is painted above the outgoing one. */
export function StageSlide({ custom, children }: { custom: StageCustom; children: ReactNode }) {
  const present = useIsPresent();
  return (
    <motion.div custom={custom} variants={stageVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0" style={{ zIndex: present ? 2 : 1 }}>
      {children}
    </motion.div>
  );
}

/**
 * Registers the stage canvas for slide `index` (the laser needs it) and, when this slide
 * arrives by morph, starts the morph from the previous slide's canvas. Ref callbacks run
 * before the browser paints, so the first frame is already the start of the morph.
 */
export function StageCanvas({
  index,
  morphFrom,
  canvases,
  children,
}: {
  index: number;
  morphFrom: number | null;
  canvases: RefObject<Map<number, HTMLElement>>;
  children: (ref: (el: HTMLDivElement | null) => void) => ReactNode;
}) {
  const [from] = useState(morphFrom);
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      canvases.current.set(index, el);
      const previous = from === null ? undefined : canvases.current.get(from);
      if (previous && previous !== el && previous.isConnected) morph(previous, el);
      return () => {
        if (canvases.current.get(index) === el) canvases.current.delete(index);
      };
    },
    [index, from, canvases],
  );
  return <>{children(ref)}</>;
}
