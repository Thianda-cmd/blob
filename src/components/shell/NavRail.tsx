"use client";

import { Plus, Search } from "lucide-react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useImporter } from "@/components/notes/useImporter";
import { useModKey } from "@/components/ui/ModKey";
import { useMessages } from "@/i18n/client";
import { newPageText } from "@/i18n/messages/newPage";
import { shellText } from "@/i18n/messages/shell";
import { cn } from "@/lib/utils";
import { NewPageMenu } from "./NewPageMenu";
import { AccountMenu, MainNav, NEW_PAGE_BUTTON, useNewPage } from "./Sidebar";

const ICON_BUTTON =
  "grid size-10 shrink-0 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover outline-none focus-visible:ring-2 focus-visible:ring-blob";

/**
 * Tablets and narrow windows (640–1023 px wide): a 56 px rail on the left, so the places stay one
 * tap away where there is no room for the sidebar and no phone tab bar. Blob's mark opens the whole
 * sidebar as a drawer, the violet "+" the create menu (to its right), then search, the places as
 * icons (their names as tooltips and for screen readers) and you at the bottom.
 */
export function NavRail({ onMenu, menuOpen, onSearch }: { onMenu: () => void; menuOpen: boolean; onSearch: () => void }) {
  const t = useMessages(shellText).sidebar;
  const tn = useMessages(newPageText);
  const importer = useImporter();
  const newPage = useNewPage();
  const mod = useModKey();
  return (
    <nav aria-label={t.navigation} className="note-focus-fade hidden w-14 shrink-0 flex-col items-center border-r border-line bg-paper sm:flex lg:hidden">
      <div className="flex shrink-0 flex-col items-center gap-1.5 py-2">
        <button type="button" onClick={onMenu} aria-label={t.openMenu} title={t.openMenu} aria-haspopup="dialog" aria-expanded={menuOpen} data-drawer-opener="rail" className={ICON_BUTTON}>
          <BlobMark size={26} />
        </button>
        <NewPageMenu
          side="right"
          align="start"
          onPick={(kind) => void newPage(kind)}
          onImport={() => importer.pick()}
          trigger={({ ref, ...p }) => (
            <button ref={ref} {...p} type="button" aria-label={tn.label} title={tn.title} className={cn(NEW_PAGE_BUTTON, "size-10 rounded-xl")}>
              <Plus className="size-5" strokeWidth={2.4} aria-hidden />
            </button>
          )}
        />
        <button type="button" onClick={onSearch} aria-label={t.searchLabel} title={t.searchTitle(mod)} className={ICON_BUTTON}>
          <Search className="size-[18px]" />
        </button>
      </div>
      <div className="h-px w-6 shrink-0 bg-line" aria-hidden />
      {/* (A phone turned sideways is short: the places scroll, the rest stays; the fade at the
          bottom says there is more. On a tall screen it falls on empty space.) */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-4 pt-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)] [scrollbar-width:none]">
        <MainNav variant="rail" />
      </div>
      <div className="flex w-full shrink-0 justify-center border-t border-line pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <AccountMenu variant="avatar" />
      </div>
    </nav>
  );
}
