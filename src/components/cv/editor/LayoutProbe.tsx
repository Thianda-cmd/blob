"use client";

import { useEffect, useMemo, useState } from "react";
import { CvDocument, type CvLayoutInfo } from "@/cv/CvDocument";
import type { Cv } from "@/cv/types";

/**
 * Lays the CV out off screen when no preview is on show (phones, in Edit or Design), so the editor
 * still knows the page count and whether something is cut off: the PDF dialog warns, the checklist
 * says so. It follows the typing half a second behind, to keep the phone quick.
 */
export function LayoutProbe({ cv, onLayout }: { cv: Cv; onLayout: (info: CvLayoutInfo) => void }) {
  const [calm, setCalm] = useState(cv);
  useEffect(() => {
    const id = window.setTimeout(() => setCalm(cv), 500);
    return () => window.clearTimeout(id);
  }, [cv]);
  // The same element between keystrokes: the pages are only drawn again once the typing pauses.
  const doc = useMemo(() => <CvDocument cv={calm} maxPages={1} scale={0.1} gap={0} onLayout={onLayout} />, [calm, onLayout]);
  return (
    <div aria-hidden inert className="pointer-events-none fixed left-[-10000px] top-0 h-0 overflow-hidden">
      {doc}
    </div>
  );
}
