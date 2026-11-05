"use client";

import { BookMarked, Check, Ellipsis, GraduationCap, Trash2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { groupLabel } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { shellText } from "@/i18n/messages/shell";
import { subjectsText } from "@/i18n/messages/subjects";
import { SUBJECT_COLOR_KEYS, subjectColor } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJIS = ["📐", "📖", "🌱", "⚗️", "🧲", "🏛️", "🗺️", "🎨", "🎵", "💻", "📈", "🦉", "🏃", "🥨", "🥐", "🌶️", "🧠", "✏️"];

/** Rename, recolor, pick an emoji or delete a subject. */
export function SubjectMenu({ subject, trigger }: { subject: Subject; trigger?: "dots" | "button" }) {
  const { updateSubject, deleteSubject } = useWorkspace();
  const t = useMessages(shellText).subjectMenu;
  const colorNames = useMessages(subjectsText).colors;
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState(subject.name);
  const [confirming, setConfirming] = useState(false);
  const notebook = subject.kind === "notebook";
  const options = notebook ? t.notebookOptions : t.options;

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
          <button
            {...props}
            className="grid size-7 place-items-center rounded-lg text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-blob aria-expanded:bg-hover [@media(hover:none)]:size-9"
            aria-label={options}
            title={options}
          >
            <Ellipsis className="size-4" />
          </button>
        ) : (
          <button
            {...props}
            className="grid size-5 place-items-center rounded text-ink-3 outline-none hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-blob aria-expanded:bg-line aria-expanded:text-ink [@media(hover:none)]:size-8"
            aria-label={options}
            title={options}
          >
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
              className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
              aria-label={notebook ? t.notebookName : t.name}
            />
          </form>
          <div className={cn("px-2 pb-1 pt-1.5", groupLabel)}>{t.color}</div>
          <div className="flex gap-1.5 px-2 pb-2">
            {SUBJECT_COLOR_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => updateSubject(subject.id, { color: c })}
                aria-pressed={subject.color === c}
                className="grid size-5 place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-1 focus-visible:ring-offset-raised motion-reduce:transition-none motion-reduce:hover:scale-100"
                style={{ background: subjectColor(c) }}
                aria-label={colorNames[c]}
                title={colorNames[c]}
              >
                {subject.color === c && <Check className="size-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className={cn("px-2 pb-1 pt-1.5", groupLabel)}>{t.icon}</div>
          <div className="grid grid-cols-9 gap-0.5 px-1 pb-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => updateSubject(subject.id, { emoji: subject.emoji === e ? null : e })}
                aria-pressed={subject.emoji === e}
                className={cn("grid size-6 place-items-center rounded-md text-[14px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-blob", subject.emoji === e && "bg-blob-soft ring-1 ring-blob/40")}
              >
                {e}
              </button>
            ))}
          </div>
          <MenuSeparator />
          {/* Notebooks are for everything outside school; a subject can become one (and back). */}
          <MenuItem
            icon={notebook ? <GraduationCap /> : <BookMarked />}
            onSelect={() => {
              updateSubject(subject.id, { kind: notebook ? "subject" : "notebook" });
              close();
            }}
          >
            {notebook ? t.asSubject : t.asNotebook}
          </MenuItem>
          {confirming ? (
            <div className="p-1.5">
              <p className="mb-2 text-[12px] text-ink-2">{t.confirm(subject.name)}</p>
              <div className="flex gap-1.5">
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    close();
                    await deleteSubject(subject.id);
                    if (pathname === `/subjects/${subject.id}`) router.push("/home");
                  }}
                >
                  {t.delete}
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                  {t.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <MenuItem icon={<Trash2 />} danger onSelect={() => setConfirming(true)}>
              {notebook ? t.deleteNotebook : t.deleteSubject}
            </MenuItem>
          )}
        </div>
      )}
    </Popover>
  );
}
