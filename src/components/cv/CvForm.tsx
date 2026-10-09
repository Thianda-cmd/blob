"use client";

import type { CvEditorProps } from "./types";

/** The CV's content, section by section. (Placeholder until the form is built.) */
export function CvForm({ cv }: CvEditorProps) {
  return <div className="p-4 text-[13px] text-ink-3">{cv.person.firstName} {cv.person.lastName}</div>;
}
