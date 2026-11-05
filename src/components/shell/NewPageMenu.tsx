"use client";

import { ChevronDown, FileText, FileUp, Folder, Plus, Presentation, Sheet as SheetIcon, Signature, type LucideIcon } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { card, cardLift } from "@/components/ui/surfaces";
import { useMessages } from "@/i18n/client";
import { newPageText } from "@/i18n/messages/newPage";
import { transferText } from "@/i18n/messages/transfer";
import { cn } from "@/lib/utils";
import { sheetColor, sheetFill } from "@/sheet/colors";

// Making a new page, the same everywhere (sidebar, Start, Notizen, Fächer, folders, tablets):
// one violet "+ Neu" (or "+ Neue Notiz" with a ▾ for the other kinds), a menu where every kind has
// its coloured tile and a one-line hint, and the create cards on Start and on empty pages. The
// order is the same everywhere: Notiz, Blobxcel-Tabelle, Handschrift, Präsentation, then Ordner.
// These only say which kind was picked (`onPick`); making the page stays with the caller (its
// subject, folder, filters, and its guard against a double click).

export type NewKind = "note" | "sheet" | "ink" | "deck" | "folder";
/** Every kind a create menu offers, in order. */
export const NEW_KINDS: readonly NewKind[] = ["note", "sheet", "ink", "deck", "folder"];
/** The kinds of page (no folder): the create cards. */
export const PAGE_KINDS: readonly NewKind[] = ["note", "sheet", "ink", "deck"];

const ICONS: Record<NewKind, LucideIcon> = { note: FileText, sheet: SheetIcon, ink: Signature, deck: Presentation, folder: Folder };

/** Each kind's colours (CSS variables that follow dark mode): a tile's background and its icon. */
export const KIND_LOOK: Record<NewKind, { bg: string; fg: string }> = {
  note: { bg: "var(--blob-soft)", fg: "var(--blob-ink)" },
  sheet: { bg: sheetFill("green"), fg: sheetColor("green") },
  ink: { bg: sheetFill("blue"), fg: sheetColor("blue") },
  deck: { bg: sheetFill("orange"), fg: sheetColor("orange") },
  folder: { bg: "var(--hover)", fg: "var(--ink-2)" },
};

/** A kind's icon (FileText, Sheet, Signature, Presentation, Folder). */
export function KindIcon({ kind, className }: { kind: NewKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} aria-hidden />;
}

/** A kind's icon on its coloured tile. sm 32 px (menus), md 40 px (cards), lg 44 px (empty states). */
export function KindTile({ kind, size = "md", className }: { kind: NewKind; size?: "sm" | "md" | "lg"; className?: string }) {
  const look = KIND_LOOK[kind];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "sm" ? "size-8 rounded-lg [&_svg]:size-4" : size === "md" ? "size-10 rounded-lg [&_svg]:size-5" : "size-11 rounded-xl [&_svg]:size-5",
        className,
      )}
      style={{ background: look.bg, color: look.fg }}
    >
      <KindIcon kind={kind} />
    </span>
  );
}

export type NewMenuTriggerProps = {
  onClick: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onPointerDown: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  ref: Ref<HTMLButtonElement>;
};

/**
 * The create menu: the kinds with their tiles and hints, then Ordner and "Datei importieren"
 * (when `onImport` is given). `trigger` gets the props for its button. Works from the keyboard:
 * opened with Enter or Space the keyboard goes into it, arrows move, Escape goes back.
 */
export function NewPageMenu({
  trigger,
  onPick,
  onImport,
  kinds = NEW_KINDS,
  align = "end",
  side = "bottom",
}: {
  trigger: (props: NewMenuTriggerProps) => ReactNode;
  onPick: (kind: NewKind) => void;
  onImport?: () => void;
  kinds?: readonly NewKind[];
  align?: "start" | "end";
  side?: "bottom" | "top" | "right";
}) {
  const t = useMessages(newPageText);
  const ti = useMessages(transferText).import;
  const [keyed, setKeyed] = useState(false);
  const pages = kinds.filter((k) => k !== "folder");
  const folder = kinds.includes("folder");
  return (
    <Popover
      align={align}
      side={side}
      label={t.label}
      keyboard
      focusOnOpen={keyed}
      className="w-[280px] p-1"
      trigger={(p) =>
        trigger({
          ...p,
          "aria-haspopup": "menu",
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") setKeyed(true);
          },
          onPointerDown: () => setKeyed(false),
        })
      }
    >
      {(close) => (
        <>
          {pages.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onPick(k);
              }}
              // (Keyboard focus: the violet outline every menu item has, also Ordner and "Datei importieren"
              // below; only the background fades, so the outline is violet at once.)
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-[background-color] hover:bg-hover"
            >
              <KindTile kind={k} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-ink">{t.kinds[k].name}</span>
                <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-2">{t.kinds[k].hint}</span>
              </span>
            </button>
          ))}
          {(folder || onImport) && pages.length > 0 && <MenuSeparator />}
          {folder && (
            <MenuItem
              icon={<KindIcon kind="folder" />}
              onSelect={() => {
                close();
                onPick("folder");
              }}
            >
              {t.kinds.folder.name}
            </MenuItem>
          )}
          {onImport && (
            <MenuItem
              icon={<FileUp />}
              onSelect={() => {
                close();
                onImport();
              }}
            >
              {ti.action}
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  );
}

/**
 * The violet create button for a page's TopBar (the calendar's "+ Neuer Termin").
 * - no `kind`: "+ Neu", which opens the menu;
 * - `kind`: "+ Neue Notiz" (that kind's create label) makes one at once, and a ▾ beside it opens
 *   the menu for the other kinds (`split={false}`: no ▾).
 * On phones only the "+" shows (the label stays for screen readers).
 */
export function NewPageButton({
  kind,
  onPick,
  onImport,
  kinds = NEW_KINDS,
  split = true,
  busy = false,
  label,
  labelOnPhones = false,
  align = "end",
  className,
}: {
  kind?: NewKind;
  onPick: (kind: NewKind) => void;
  onImport?: () => void;
  kinds?: readonly NewKind[];
  split?: boolean;
  busy?: boolean;
  /** Instead of the kind's create label. */
  label?: string;
  /** Keep the label on phones too (in a page's body, e.g. an empty state; in a TopBar only the "+" shows there). */
  labelOnPhones?: boolean;
  align?: "start" | "end";
  className?: string;
}) {
  const t = useMessages(newPageText);
  const phoneLabel = labelOnPhones ? undefined : "max-sm:sr-only";
  const plus = <Plus className="size-4" strokeWidth={2.4} aria-hidden />;
  if (!kind) {
    return (
      <NewPageMenu
        onPick={onPick}
        onImport={onImport}
        kinds={kinds}
        align={align}
        trigger={({ ref, ...p }) => (
          <Button ref={ref} {...p} variant="blob" size="bar" disabled={busy} title={t.title} className={className}>
            {plus}
            <span className={phoneLabel}>{label ?? t.button}</span>
          </Button>
        )}
      />
    );
  }
  const main = (
    <Button
      variant="blob"
      size="bar"
      loading={busy}
      onClick={() => onPick(kind)}
      className={cn(split && "rounded-r-none", !split && className)}
      title={label ?? t.kinds[kind].create}
    >
      {plus}
      <span className={phoneLabel}>{label ?? t.kinds[kind].create}</span>
    </Button>
  );
  if (!split) return main;
  return (
    <div className={cn("inline-flex shrink-0 items-center", className)}>
      {main}
      <NewPageMenu
        onPick={onPick}
        onImport={onImport}
        kinds={kinds}
        align={align}
        trigger={({ ref, ...p }) => (
          <Button
            ref={ref}
            {...p}
            variant="blob"
            size="bar"
            disabled={busy}
            aria-label={t.more}
            title={t.more}
            className="rounded-l-none border-l border-white/25 px-1.5 [@media(hover:none)]:px-2"
          >
            <ChevronDown className="size-3.5" strokeWidth={2.4} aria-hidden />
          </Button>
        )}
      />
    </div>
  );
}

/**
 * The create cards (Start, an empty Notizen page): one card per kind with its tile, its name and
 * hint. Two columns, four where the box they sit in has room for each hint on two lines (from about
 * 930 px: Start at 1280 px with the sidebar; not on tablets, nor beside the sidebar at 1024).
 * On phones only the names.
 */
export function CreateCards({
  onPick,
  kinds = PAGE_KINDS,
  busy = false,
  className,
}: {
  onPick: (kind: NewKind) => void;
  kinds?: readonly NewKind[];
  busy?: boolean;
  className?: string;
}) {
  const t = useMessages(newPageText);
  return (
    <section aria-label={t.cards} className={cn("@container", className)}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 @min-[58rem]:grid-cols-4">
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          disabled={busy}
          onClick={() => onPick(k)}
          title={t.kinds[k].create}
          className={cn(
            card,
            cardLift,
            "group flex min-w-0 items-center gap-3 p-3 text-left disabled:pointer-events-none disabled:opacity-60 max-sm:min-h-14 max-sm:gap-2.5 max-sm:p-2.5",
          )}
        >
          <KindTile kind={k} size="md" className="max-sm:size-9" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-tight text-ink">{t.kinds[k].short}</span>
            <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2 max-sm:sr-only">{t.kinds[k].hint}</span>
          </span>
        </button>
      ))}
      </div>
    </section>
  );
}
