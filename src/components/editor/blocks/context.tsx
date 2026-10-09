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
};

const Ctx = createContext<NoteBlocks>({ pageId: "", canEdit: false });

export const NoteBlocksProvider = Ctx.Provider;

export function useNoteBlocks() {
  return useContext(Ctx);
}
