"use client";

import { createContext, useContext } from "react";

/**
 * What the note's block views need from the page around them. Node views render through portals
 * inside <EditorContent>, so React context reaches them.
 */
export type NoteBlocks = {
  pageId: string;
  /** False for viewers of a shared note, while the note reloads, and for notes Blob can't read. */
  canEdit: boolean;
  /** Upload files (any allowed kind) and place them as blocks at `at` (or near the caret). */
  uploadFiles: (files: File[], at?: number) => void;
};

const Ctx = createContext<NoteBlocks>({ pageId: "", canEdit: false, uploadFiles: () => {} });

export const NoteBlocksProvider = Ctx.Provider;

export function useNoteBlocks() {
  return useContext(Ctx);
}
