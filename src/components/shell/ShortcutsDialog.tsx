"use client";

import { Keyboard, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { Locale } from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/client";
import { panesText } from "@/i18n/messages/panes";
import { sheetText } from "@/i18n/messages/sheet";
import { pageIdOfPath } from "./recent";

type Item = keyof (typeof panesText)["en"]["shortcuts"]["items"];
type Group = keyof (typeof panesText)["en"]["shortcuts"]["groups"];
type SheetItem = keyof (typeof sheetText)["en"]["shortcuts"]["items"];
type SheetGroup = keyof (typeof sheetText)["en"]["shortcuts"]["groups"];

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
      ["find", [["mod", "F"]]],
      ["replace", [["mod", "H"]]],
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
  {
    group: "blocks",
    items: [
      ["moveBlock", [["mod", "shift", "↑"], ["↓"]]],
      ["duplicate", [["mod", "D"]]],
      ["toggle", [["mod", "↵"]]],
      ["pasteMarkdown", [["mod", "shift", "V"]]],
    ],
  },
];

/**
 * A spreadsheet's keys, as the grid (src/components/sheet/grid/keys.ts), the cell editor (CellEditor.tsx)
 * and the editor (SheetEditor.tsx) handle them. The date is Strg+. on German keyboards, as in German
 * Excel (";" needs Shift there); Ctrl+; on English ones. ⌘H hides the app on a Mac, so ⌘⌥F replaces.
 * F6 moves between the cells, a notice with a button ("Als 1,234 lesen"), the open settings and the
 * toolbar (Shift+F6 the other way round).
 */
function sheetGroups(mac: boolean, locale: Locale): { group: SheetGroup; items: [SheetItem, string[][]][] }[] {
  const date = locale === "de" ? "." : ";";
  return [
    {
      group: "cells",
      items: [
        ["edit", [["F2"]]],
        ["absolute", [["F4"]]],
        ["newLine", [["alt", "↵"]]],
        ["fillTyped", [["mod", "↵"]]],
        ["fill", [["mod", "D"], ["mod", "R"]]],
        ["date", [["mod", date], ["mod", "shift", date]]],
        ["undo", [["mod", "Z"], mac ? ["mod", "shift", "Z"] : ["mod", "Y"]]],
      ],
    },
    {
      group: "tools",
      items: [
        ["table", [["mod", "T"]]],
        ["formats", [["mod", "1"]]],
        ["autoSum", [["alt", "="]]],
        ["chart", [["alt", "F1"]]],
        ["functions", [["shift", "F3"]]],
        ["find", [["mod", "F"]]],
        ["replace", [mac ? ["mod", "alt", "F"] : ["mod", "H"]]],
        ["save", [["mod", "S"]]],
        ["print", [["mod", "P"]]],
        // F6 as in Excel; Ctrl+F6 for browsers that keep F6 for their address bar.
        ["areas", [["F6"], ["mod", "F6"]]],
      ],
    },
  ];
}

/** Every keyboard shortcut, in one list (Ctrl/Cmd+/). In a spreadsheet its keys come first. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useMessages(panesText).shortcuts;
  const ts = useMessages(sheetText).shortcuts;
  const mac = useIsMac();
  const locale = useLocale();
  const { pages } = useWorkspace();
  const here = pageIdOfPath(usePathname());
  const inSheet = !!here && pages.some((p) => p.id === here && p.kind === "sheet");
  const name = (k: string) =>
    k === "mod" ? (mac ? "⌘" : locale === "de" ? "Strg" : "Ctrl") : k === "shift" ? (mac ? "⇧" : locale === "de" ? "Umschalt" : "Shift") : k === "alt" ? (mac ? "⌥" : "Alt") : k;
  const app = GROUPS.map(({ group, items }) => ({ id: group, title: t.groups[group], items: items.map(([item, combos]) => ({ id: item, label: t.items[item], combos })) }));
  const sheet = sheetGroups(mac, locale).map(({ group, items }) => ({
    id: `sheet-${group}`,
    title: ts.groups[group],
    items: items.map(([item, combos]) => ({ id: item, label: ts.items[item], combos })),
  }));
  const sections = inSheet ? [...sheet, ...app] : [...app, ...sheet];

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
        {sections.map(({ id, title, items }) => (
          <section key={id}>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
            <dl className="space-y-1">
              {items.map(({ id: item, label, combos }) => (
                <div key={item} className="flex items-center justify-between gap-3 py-0.5 text-[13px]">
                  <dt className="min-w-0 text-ink-2">{label}</dt>
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
