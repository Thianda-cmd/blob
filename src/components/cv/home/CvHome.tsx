"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, FileUser, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { TopBar } from "@/components/shell/TopBar";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cvPlainText, cvTitle, normalizeCv } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useLocale, useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { createClient } from "@/lib/supabase/client";
import { CvCard, NewCvCard, type CvItem } from "./CvCard";
import { CvTips } from "./CvTips";
import { NewCvDialog } from "./NewCvDialog";
import { SampleFan } from "./SampleFan";
import { useRefreshOnBack } from "./useRefreshOnBack";

export type { CvItem };

const time = (iso: string) => Date.parse(iso) || 0;

const rise = {
  hidden: { opacity: 0, y: 10 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.04 * i, type: "spring" as const, stiffness: 420, damping: 32 } }),
};

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
    const title = !src.trim() || src === cvTitle(cv) ? cvTitle(cv) : t.copyOf(src).slice(0, 200);
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
      <TopBar crumbs={[{ label: t.title, icon: <FileUser className="size-3.5 text-ink-3" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-3 sm:px-8 lg:pt-5">
          <motion.header initial="hidden" animate="shown" className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <motion.div variants={rise} custom={0} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <FileUser className="size-3.5" /> {t.eyebrow}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">{t.title}</h1>
              <p className="mt-2 max-w-[720px] text-[14.5px] leading-relaxed text-ink-2">{t.intro}</p>
            </motion.div>
            {items.length > 0 && (
              <motion.div variants={rise} custom={1}>
                <Button variant="blob" size="lg" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> {t.newCv}
                </Button>
              </motion.div>
            )}
          </motion.header>

          <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              {items.length === 0 ? (
                <EmptyHero onStart={() => setCreating(true)} />
              ) : (
                <section aria-labelledby="cv-list-title">
                  <div className="mb-3 flex items-baseline gap-3">
                    <h2 id="cv-list-title" className="font-display text-[19px] font-semibold tracking-[-0.01em]">
                      {t.yours}
                    </h2>
                    <span className="text-[13px] text-ink-3">{t.count(items.length)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4">
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
            <motion.aside initial="hidden" animate="shown" variants={rise} custom={3} className="xl:sticky xl:top-5 xl:self-start">
              <CvTips />
            </motion.aside>
          </div>
        </div>
      </div>

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
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-3xl border border-line bg-raised shadow-card"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" />
      <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative grid items-center gap-4 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
        <div className="relative order-2 md:order-1">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.emptyEyebrow}</div>
          <h2 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.015em] text-balance">{t.emptyTitle}</h2>
          <p className="mt-2 max-w-[520px] text-[14.5px] leading-relaxed text-ink-2">{t.emptyBody}</p>
          <Button variant="blob" size="lg" className="mt-5 max-sm:w-full" onClick={onStart} onPointerEnter={() => ref.current?.jump(0.5)}>
            <Plus className="size-4" /> {t.emptyCta}
          </Button>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
            {t.emptyPoints.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-ok" strokeWidth={2.5} /> {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative order-1 md:order-2">
          <SampleFan lang={locale} designs={["modern", "classic", "creative"]} maxPaper={180} className="mx-auto w-full max-w-[420px]" />
          <div className="absolute -bottom-2 left-0 z-10 sm:left-[4%]">
            <Blob ref={ref} size={92} mood="happy" />
          </div>
        </div>
      </div>
    </motion.section>
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
      <p className="mt-2 text-[12.5px] leading-snug text-ink-3">{t.renameHint}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {t.save}
        </Button>
      </div>
    </form>
  );
}
