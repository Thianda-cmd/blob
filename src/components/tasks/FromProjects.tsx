"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { blob } from "@/components/blob/bus";
import { DueChip } from "@/components/projects/CardFace";
import { STEP, boardColor } from "@/components/projects/model";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { tasksText } from "@/i18n/messages/tasks";
import { createClient } from "@/lib/supabase/client";
import type { AssignedCard } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { TaskCheckbox } from "./TaskCheckbox";
import { useNow } from "./useNow";

/** How long the check animation plays before the card leaves the list. */
const SETTLE_MS = 560;

/** Tick off a project card from outside its board: it moves to the project's done column (at the end). */
export async function finishCard(card: Pick<AssignedCard, "id" | "project_id">) {
  const supabase = createClient();
  const { data: column } = await supabase
    .from("project_columns")
    .select("id")
    .eq("project_id", card.project_id!)
    .eq("done", true)
    .order("position")
    .limit(1)
    .maybeSingle();
  const patch: { done: true; column_id?: string; position?: number } = { done: true };
  if (column) {
    const { data: last } = await supabase.from("tasks").select("position").eq("column_id", column.id).order("position", { ascending: false }).limit(1).maybeSingle();
    patch.column_id = column.id as string;
    patch.position = ((last?.position as number | undefined) ?? 0) + STEP;
  }
  const { error } = await supabase.from("tasks").update(patch).eq("id", card.id);
  return !error;
}

/**
 * Cards assigned to you in projects, for the Tasks page and Home: tick one off right here, or open
 * it on its board. `limit` keeps the list short in narrow places.
 */
export function FromProjects({ initial, limit = 8, compact }: { initial: AssignedCard[]; limit?: number; compact?: boolean }) {
  const t = useMessages(tasksText);
  const untitled = useMessages(projectsText).untitled;
  const now = useNow();
  const [cards, setCards] = useState(initial);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const shown = cards.slice(0, limit);

  function tick(card: AssignedCard) {
    setTicked((s) => new Set(s).add(card.id));
    setTimeout(async () => {
      setCards((list) => list.filter((c) => c.id !== card.id));
      const ok = await finishCard(card);
      if (!ok) {
        setCards((list) => [card, ...list]);
        setTicked((s) => {
          const next = new Set(s);
          next.delete(card.id);
          return next;
        });
        blob.say(t.errSave, { mood: "worried" });
        return;
      }
      blob.react("jump", "excited");
    }, SETTLE_MS);
  }

  if (!cards.length) return <p className="text-[12.5px] leading-snug text-ink-3">{t.noProjectCards}</p>;
  return (
    <ul className={cn("-mx-1.5", compact ? "space-y-0" : "space-y-0.5")}>
      <AnimatePresence initial={false}>
        {shown.map((card) => {
          const done = ticked.has(card.id);
          return (
            <motion.li
              key={card.id}
              layout
              exit={{ opacity: 0, x: 16, transition: { duration: 0.18 } }}
              className="group flex min-h-10 items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-hover/60 [@media(hover:none)]:min-h-11"
            >
              <span className="pt-px">
                <TaskCheckbox checked={done} onChange={(next) => next && tick(card)} size={16} label={t.markCardDone(card.title)} />
              </span>
              <Link href={`/projects/${card.project.id}?card=${card.id}`} className="min-w-0 flex-1">
                <span className={cn("block truncate text-[13.5px] leading-snug", done ? "text-ink-3 line-through" : "text-ink")} title={card.title}>
                  {card.title}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11.5px] text-ink-3">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: boardColor(card.project.color) }} />
                    <span className="truncate">
                      {card.project.icon ? `${card.project.icon} ` : ""}
                      {card.project.title.trim() || untitled}
                    </span>
                  </span>
                  {card.due_at && <DueChip due={card.due_at} now={now} className="-my-0.5 shrink-0" />}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
