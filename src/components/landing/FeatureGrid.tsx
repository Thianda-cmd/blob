import { BadgeQuestionMark, CalendarDays, FileUser, GraduationCap, ListChecks, NotebookPen, Presentation, Sheet, Signature, SquareKanban, type LucideIcon } from "lucide-react";
import { card, cardLift } from "@/components/ui/surfaces";
import type { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";
import { NewChip } from "./Section";

type Copy = (typeof landingText)["en"]["features"]["tiles"];

/** Every part of Blob, in the page's order, each linking to its section. */
const TILES: { key: keyof Copy; Icon: LucideIcon; fresh?: boolean }[] = [
  { key: "notes", Icon: NotebookPen },
  { key: "sheets", Icon: Sheet, fresh: true },
  { key: "handwriting", Icon: Signature },
  { key: "learn", Icon: GraduationCap },
  { key: "quiz", Icon: BadgeQuestionMark },
  { key: "calendar", Icon: CalendarDays },
  { key: "homework", Icon: ListChecks },
  { key: "together", Icon: SquareKanban },
  { key: "presentations", Icon: Presentation },
  { key: "cv", Icon: FileUser },
];

/** The overview under the hero: ten tiles, plain links (no client JS). Phones show the names only. */
export function FeatureGrid({ tiles, fresh }: { tiles: Copy; fresh: string }) {
  return (
    <ul className="reveal mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {TILES.map(({ key, Icon, fresh: isNew }) => (
        <li key={key} className="min-w-0">
          <a
            href={`#${key}`}
            className={cn(card, cardLift, "relative flex h-full min-h-14 items-center gap-2.5 p-2.5 sm:items-start sm:gap-3 sm:p-3.5 lg:flex-col lg:p-4")}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink sm:size-9">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              {/* Long names ("Präsentationen") hyphenate on the smallest phones rather than run out of the tile. */}
              <span className="block text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink hyphens-auto [overflow-wrap:anywhere] sm:text-[15px]">{tiles[key].title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-2 max-sm:hidden">{tiles[key].body}</span>
            </span>
            {/* On the corner like a badge (phones and tablets, where the name needs the room), inside from lg. */}
            {isNew && <NewChip label={fresh} className="absolute -right-1 -top-2 ring-2 ring-paper lg:right-3 lg:top-3 lg:ring-0" />}
          </a>
        </li>
      ))}
    </ul>
  );
}
