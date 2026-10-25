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
  /**
   * Where an attached file opens (or downloads): a signed link for the reader by default, the
   * public link's file address on a public page (src/components/public).
   */
  fileUrl?: (path: string, opts?: { download?: string | boolean }) => Promise<string | null>;
};

const Ctx = createContext<NoteBlocks>({ pageId: "", canEdit: false });

export const NoteBlocksProvider = Ctx.Provider;

export function useNoteBlocks() {
  return useContext(Ctx);
}
