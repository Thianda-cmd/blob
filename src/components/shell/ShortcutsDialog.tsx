"use client";

import { Keyboard, X } from "lucide-react";
import { Fragment } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useLocale, useMessages } from "@/i18n/client";
import { panesText } from "@/i18n/messages/panes";

type Item = keyof (typeof panesText)["en"]["shortcuts"]["items"];
type Group = keyof (typeof panesText)["en"]["shortcuts"]["groups"];

/** Keys as written in the list: "mod" and "shift" become ⌘ ⇧ on a Mac, Ctrl and Shift elsewhere. */
const GROUPS: { group: Group; items: [Item, string[][]][] }[] = [
  {
    group: "general",
    items: [
      ["search", [["mod", "K"]]],
      ["lastNote", [["mod", "shift", "L"]]],
      ["beside", [["mod", "shift", "D"]]],
      ["sidebar", [["mod", "\\"]]],
      ["shortcuts", [["mod", "/"]]],
    ],
  },
  {
    group: "notes",
    items: [
      ["slash", [["/"]]],
      ["link", [["[", "["]]],
      ["save", [["mod", "S"]]],
      ["pdf", [["mod", "P"]]],
      ["undo", [["mod", "Z"], ["mod", "shift", "Z"]]],
    ],
  },
  {
    group: "text",
    items: [
      ["bold", [["mod", "B"]]],
      ["italic", [["mod", "I"]]],
      ["underline", [["mod", "U"]]],
      ["strike", [["mod", "shift", "S"]]],
      ["highlight", [["mod", "shift", "H"]]],
      ["code", [["mod", "E"]]],
      ["formula", [["mod", "shift", "M"]]],
      ["bigger", [["mod", "shift", "."]]],
      ["smaller", [["mod", "shift", ","]]],
      ["headings", [["mod", "alt", "1"], ["2"], ["3"]]],
    ],
  },
  {
    group: "lists",
    items: [
      ["bullets", [["mod", "shift", "8"]]],
      ["numbers", [["mod", "shift", "7"]]],
      ["todo", [["mod", "shift", "9"]]],
      ["indent", [["Tab"], ["shift", "Tab"]]],
      ["textUnder", [["shift", "↵"]]],
      ["belowList", [["mod", "↵"]]],
      ["lineBreak", [["shift", "↵"]]],
    ],
  },
  { group: "blocks", items: [["toggle", [["mod", "↵"]]]] },
];

/** Every keyboard shortcut, in one list (Ctrl/Cmd+/). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useMessages(panesText).shortcuts;
  const mac = useIsMac();
  const locale = useLocale();
  const name = (k: string) =>
    k === "mod" ? (mac ? "⌘" : locale === "de" ? "Strg" : "Ctrl") : k === "shift" ? (mac ? "⇧" : locale === "de" ? "Umschalt" : "Shift") : k === "alt" ? (mac ? "⌥" : "Alt") : k;

  return (
    <Dialog open={open} onClose={onClose} labelledBy="shortcuts-title" className="max-w-[720px]!">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Keyboard className="size-4.5 text-blob-ink" />
        <h2 id="shortcuts-title" className="flex-1 font-display text-[16px] font-semibold tracking-[-0.01em]">
          {t.title}
        </h2>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label="Esc">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid max-h-[70vh] gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        {GROUPS.map(({ group, items }) => (
          <section key={group}>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.groups[group]}</h3>
            <dl className="space-y-1">
              {items.map(([item, combos]) => (
                <div key={item} className="flex items-center justify-between gap-3 py-0.5 text-[13px]">
                  <dt className="min-w-0 text-ink-2">{t.items[item]}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {combos.map((keys, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="text-[11px] text-ink-3">/</span>}
                        {keys.map((k, j) => (
                          <Kbd key={j} className="h-5 min-w-5 text-[11px]">
                            {name(k)}
                          </Kbd>
                        ))}
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
