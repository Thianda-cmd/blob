"use client";

import { ArrowRight, Link2, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { ContextMenu, useContextMenu, useLastPointer, wantsOwnMenu } from "@/components/ui/ContextMenu";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { ColumnDot } from "./pickers";
import type { Board } from "./useBoard";

/**
 * Right-click on a card (an element with data-card) opens Blob's card menu: open it, move it to
 * another column, copy its link, delete it. No box of its own (display: contents).
 */
export function CardMenuArea({ board, readOnly, onOpen, children }: { board: Board; readOnly: boolean; onOpen: (id: string) => void; children: ReactNode }) {
  const t = useMessages(projectsText);
  const { at, open, close } = useContextMenu();
  const last = useLastPointer();
  const [id, setId] = useState<string | null>(null);
  const card = id ? board.cards.find((c) => c.id === id) : undefined;

  const act = (fn: () => unknown) => () => {
    close();
    void fn();
  };

  return (
    <div
      className="contents"
      onContextMenu={(e) => {
        const found = (e.target as HTMLElement).closest<HTMLElement>("[data-card]")?.dataset.card;
        if (!found || !board.cards.some((c) => c.id === found) || !wantsOwnMenu(e, last.current)) return;
        setId(found);
        open(e);
      }}
    >
      {children}
      <ContextMenu at={card ? at : null} onClose={close} label={t.cardMenu.label} className="w-[240px]">
        {card && (
          <>
            <MenuItem icon={<SquareArrowOutUpRight />} onSelect={act(() => onOpen(card.id))}>
              {t.open}
            </MenuItem>
            <MenuItem
              icon={<Link2 />}
              onSelect={act(async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/projects/${board.project.id}?card=${card.id}`);
                  blob.say(t.drawer.linkCopied, { mood: "happy" });
                } catch {}
              })}
            >
              {t.drawer.copyLink}
            </MenuItem>
            {!readOnly && board.columns.length > 1 && (
              <>
                <MenuSeparator />
                <MenuLabel>{t.cardMenu.moveTo}</MenuLabel>
                {board.columns
                  .filter((c) => c.id !== card.column_id)
                  .map((c) => (
                    <MenuItem key={c.id} icon={<ColumnDot column={c} />} shortcut={<ArrowRight className="size-3.5" />} onSelect={act(() => board.moveCard(card.id, c.id, Number.MAX_SAFE_INTEGER))}>
                      {c.title}
                    </MenuItem>
                  ))}
              </>
            )}
            {!readOnly && (
              <>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={act(() => board.deleteCard(card.id))}>
                  {t.drawer.delete}
                </MenuItem>
              </>
            )}
          </>
        )}
      </ContextMenu>
    </div>
  );
}
