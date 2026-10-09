import type { Cv } from "@/cv/types";

/** Every edit goes through this: a function from the current CV to the next one (autosaved). */
export type CvChange = (fn: (cv: Cv) => Cv) => void;

/** What the form and the side panels get from the editor. */
export type CvEditorProps = { cv: Cv; change: CvChange };
