"use client";

import { Check, Ellipsis, Trash2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SUBJECT_COLOR_KEYS, subjectColor } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJIS = ["📐", "📖", "🌱", "⚗️", "🧲", "🏛️", "🗺️", "🎨", "🎵", "💻", "📈", "🦉", "🏃", "🥨", "🥐", "🌶️", "🧠", "✏️"];

/** Rename, recolor, pick an emoji or delete a subject. */
export function SubjectMenu({ subject, trigger }: { subject: Subject; trigger?: "dots" | "button" }) {
  const { updateSubject, deleteSubject } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState(subject.name);
  const [confirming, setConfirming] = useState(false);

  return (
    <Popover
      align="start"
      className="w-[248px]"
      onOpenChange={(open) => {
        if (open) setName(subject.name);
        setConfirming(false);
      }}
      trigger={(props) =>
        trigger === "button" ? (
          <button {...props} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label="Subject options">
            <Ellipsis className="size-4" />
          </button>
        ) : (
          <button {...props} className="grid size-5 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink" aria-label="Subject options" title="Subject options">
            <Ellipsis className="size-3.5" />
          </button>
        )
      }
    >
      {(close) => (
        <div>
          <form
            className="p-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== subject.name) updateSubject(subject.id, { name: name.trim().slice(0, 60) });
              close();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== subject.name && updateSubject(subject.id, { name: name.trim().slice(0, 60) })}
              maxLength={60}
              className="h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
              aria-label="Subject name"
            />
          </form>
          <MenuLabel>Color</MenuLabel>
          <div className="flex gap-1.5 px-2 pb-2">
            {SUBJECT_COLOR_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => updateSubject(subject.id, { color: c })}
                className="grid size-5 place-items-center rounded-full transition-transform hover:scale-110"
                style={{ background: subjectColor(c) }}
                aria-label={c}
              >
                {subject.color === c && <Check className="size-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <MenuLabel>Icon</MenuLabel>
          <div className="grid grid-cols-9 gap-0.5 px-1 pb-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => updateSubject(subject.id, { emoji: subject.emoji === e ? null : e })}
                className={cn("grid size-6 place-items-center rounded-md text-[14px] hover:bg-hover", subject.emoji === e && "bg-hover ring-1 ring-line-2")}
              >
                {e}
              </button>
            ))}
          </div>
          <MenuSeparator />
          {confirming ? (
            <div className="p-1.5">
              <p className="mb-2 text-[12px] text-ink-2">Delete “{subject.name}”? Its notes stay, they just move to Notes.</p>
              <div className="flex gap-1.5">
                <button
                  onClick={async () => {
                    close();
                    await deleteSubject(subject.id);
                    if (pathname === `/subjects/${subject.id}`) router.push("/home");
                  }}
                  className="h-7 flex-1 rounded-md bg-danger text-[12.5px] font-medium text-white"
                >
                  Delete
                </button>
                <button onClick={() => setConfirming(false)} className="h-7 flex-1 rounded-md border border-line text-[12.5px]">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <MenuItem icon={<Trash2 />} danger onSelect={() => setConfirming(true)}>
              Delete subject
            </MenuItem>
          )}
        </div>
      )}
    </Popover>
  );
}
