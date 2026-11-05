"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, FileUser, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { midTone } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CV_TEMPLATES } from "@/cv/catalog";
import { cvPlainText, cvTitle, normalizeCv } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useLocale, useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CvCard, NewCvCard, type CvItem } from "./CvCard";
import { CvTips } from "./CvTips";
import { NewCvDialog } from "./NewCvDialog";
import { SampleFan } from "./SampleFan";
import { useRefreshOnBack } from "./useRefreshOnBack";

export type { CvItem };

const time = (iso: string) => Date.parse(iso) || 0;

/** /cv: the student's CVs as cards, a friendly start when there are none, and tips for a good CV. */
export function CvHome({ initialItems }: { initialItems: CvItem[] }) {
  const t = useMessages(cvHomeText);
  const locale = useLocale();
  const now = useNow();
  const params = useSearchParams();
  const { pages, createPage, updatePage, trashPage } = useWorkspace();
  // Copies made here, until the server's list has them too.
  const [made, setMade] = useState<CvItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ item: CvItem; cv: Cv } | null>(null);

  const fresh = useRefreshOnBack(initialItems);

  // Which CVs exist and what they are called comes from the workspace, which is current for everything
  // done in this tab (made, renamed, trashed). The server adds what the cards draw: the content and the
  // last save. A CV only the workspace knows is new (its card waits for the server's fresh copy after
  // Back), unless the server's list is fresh: then it was deleted elsewhere, e.g. in another tab.
  const items = useMemo(() => {
    const known = new Map<string, CvItem>();
    for (const i of [...made, ...initialItems]) {
      const k = known.get(i.id);
      if (!k || time(i.updated_at) > time(k.updated_at)) known.set(i.id, i);
    }
    return pages
      .filter((p) => p.kind === "cv" && (known.has(p.id) || !fresh))
      .map((p): CvItem => {
        const k = known.get(p.id);
        return { id: p.id, title: p.title, updated_at: k && time(k.updated_at) > time(p.updated_at) ? k.updated_at : p.updated_at, content: k?.content };
      })
      .sort((a, b) => time(b.updated_at) - time(a.updated_at));
  }, [pages, made, initialItems, fresh]);

  // /cv?new=1 (from Home or the command palette): open the dialog, then tidy the URL.
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (!wantsNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open once the page is in the browser
    setCreating(true);
    window.history.replaceState(null, "", "/cv");
  }, [wantsNew]);

  async function duplicate(item: CvItem) {
    // The editor saves as you type, so the latest version is in the database, not in this list.
    const { data } = await createClient().from("pages").select("title, content").eq("id", item.id).maybeSingle();
    const cv = normalizeCv(data?.content ?? item.content, locale);
    // A copy of an automatically named CV stays automatic, so it keeps following the name on it.
    const src = data?.title ?? item.title;
    // A long name is shortened before " (Kopie)" goes on, never the " (Kopie)": the copy must not
    // get the original's very name. (By characters, as the database counts them: 200 at most.)
    const room = 200 - Array.from(t.copyOf("")).length;
    const title = !src.trim() || src === cvTitle(cv) ? cvTitle(cv) : t.copyOf(Array.from(src).slice(0, room).join("").trimEnd());
    const page = await createPage({ kind: "cv", title, content: cv, plain_text: cvPlainText(cv) });
    if (!page) return blob.say(t.duplicateFailed, { mood: "worried" });
    setMade((list) => [{ id: page.id, title: page.title, updated_at: page.updated_at, content: cv }, ...list]);
    blob.say(t.duplicated, { mood: "happy" });
    blob.react("jump", "happy");
  }

  function rename(item: CvItem, cv: Cv, value: string) {
    // Empty: the title follows the name on the CV again ("Lebenslauf – Lena Schneider").
    updatePage(item.id, { title: value.trim().slice(0, 200) || cvTitle(cv) });
  }

  return (
    <>
      <TopBar
        crumbs={[{ label: t.title, icon: <FileUser className="size-3.5 text-ink-3" /> }]}
        actions={
          <Button variant="blob" size="bar" onClick={() => setCreating(true)}>
            <Plus className="size-4" strokeWidth={2.4} />
            <span className="max-sm:sr-only">{t.newCv}</span>
          </Button>
        }
      />
      <PageBody>
        <PageHeader title={t.title} meta={items.length > 0 ? t.count(items.length) : t.intro} />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {items.length === 0 ? (
              <EmptyHero onStart={() => setCreating(true)} />
            ) : (
              <section aria-labelledby="cv-list-title">
                {/* The count is in the page's header already; the heading is for screen readers. */}
                <h2 id="cv-list-title" className="sr-only">
                  {t.yours}
                </h2>
                {/* Three across beside the tips on a laptop, so ten CVs stay a few rows, not a long scroll. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:gap-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 32, delay: Math.min(i, 8) * 0.04 } }}
                        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
                      >
                        <CvCard
                          item={item}
                          now={now}
                          onRename={(cv) => setRenaming({ item, cv })}
                          onDuplicate={() => duplicate(item)}
                          onTrash={() => trashPage(item.id)}
                        />
                      </motion.div>
                    ))}
                    <motion.div key="new" layout>
                      <NewCvCard onClick={() => setCreating(true)} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </section>
            )}
          </div>
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <CvTips />
          </aside>
        </div>
      </PageBody>

      <NewCvDialog open={creating} onClose={() => setCreating(false)} />
      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} labelledBy="cv-rename-title">
        {renaming && (
          <RenameForm
            key={renaming.item.id}
            target={renaming}
            onClose={() => setRenaming(null)}
            onSave={(value) => {
              rename(renaming.item, renaming.cv, value);
              setRenaming(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function EmptyHero({ onStart }: { onStart: () => void }) {
  const t = useMessages(cvHomeText);
  const locale = useLocale();
  const ref = useRef<BlobHandle>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.wave(), 900);
    return () => window.clearTimeout(id);
  }, []);
  // The start screen: what you get and the one button, beside three example CVs on a desk.
  return (
    <section aria-labelledby="cv-start-title" className="rounded-2xl border border-line bg-raised p-5 shadow-card sm:p-6">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
        <div className="order-2 min-w-0 md:order-1">
          <h2 id="cv-start-title" className="text-balance font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {t.emptyTitle}
          </h2>
          <p className="mt-2 max-w-[520px] text-pretty text-[14px] leading-relaxed text-ink-2">{t.emptyBody}</p>
          <Button variant="blob" size="md" className="mt-5 max-sm:w-full" onClick={onStart} onPointerEnter={() => ref.current?.jump(0.5)}>
            <Plus className="size-4" /> {t.emptyCta}
          </Button>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
            {t.emptyPoints(CV_TEMPLATES.length).map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-ok" strokeWidth={2.5} /> {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative order-1 rounded-xl border border-line bg-surface px-3 pb-3 pt-4 md:order-2">
          <SampleFan lang={locale} designs={["modern", "classic", "creative"]} maxPaper={170} className="mx-auto w-full max-w-[400px]" />
          <div className="absolute bottom-1 left-1 z-10 sm:left-3">
            <Blob ref={ref} size={80} mood="happy" />
          </div>
        </div>
      </div>
    </section>
  );
}

function RenameForm({ target, onClose, onSave }: { target: { item: CvItem; cv: Cv }; onClose: () => void; onSave: (value: string) => void }) {
  const t = useMessages(cvHomeText);
  const auto = cvTitle(target.cv);
  // Starts with the current name (selected, so typing replaces it); clearing it goes back to the automatic one.
  const [value, setValue] = useState(() => target.item.title.trim() || auto);
  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <h2 id="cv-rename-title" className="font-display text-[18px] font-semibold tracking-[-0.01em]">
        {t.renameTitle}
      </h2>
      <label className="mt-3 block">
        <span className="sr-only">{t.renameLabel}</span>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          placeholder={auto}
          maxLength={200}
          className="h-10 text-[16px] sm:text-[14px]"
        />
      </label>
      <p className={cn("mt-2 text-[12.5px] leading-snug", midTone)}>{t.renameHint}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="blob">
          {t.save}
        </Button>
      </div>
    </form>
  );
}
