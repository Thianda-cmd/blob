"use client";

import { ArrowRight, BookOpenCheck, Check, FilePlus2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useMemo, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CV_TEMPLATES, templateMeta } from "@/cv/catalog";
import { CvThumbnail } from "@/cv/CvDocument";
import { cvPlainText, cvTitle } from "@/cv/model";
import { sampleCv } from "@/cv/samples";
import type { Cv, CvTemplateId } from "@/cv/types";
import { useLocale, useMessages } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { startCv, type CvStart } from "./start";
import { useWidth } from "./useWidth";

/** "New CV": pick a design (live thumbnails of the example), the CV's language and how to start. Then opens the editor. */
export function NewCvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="new-cv-title" className="max-w-[920px]! overflow-hidden">
      <NewCv onClose={onClose} />
    </Dialog>
  );
}

const Thumb = memo(function Thumb({ cv, width, className }: { cv: Cv; width: number; className?: string }) {
  return <CvThumbnail cv={cv} width={width} className={className} />;
});

function NewCv({ onClose }: { onClose: () => void }) {
  const t = useMessages(cvHomeText).dialog;
  const locale = useLocale();
  const tt = useText();
  const router = useRouter();
  const { createPage, profile, email } = useWorkspace();
  const [template, setTemplate] = useState<CvTemplateId>("classic");
  const [lang, setLang] = useState<Locale>(locale);
  const [start, setStart] = useState<CvStart>("blank");
  const [busy, setBusy] = useState(false);

  const me = useMemo(() => ({ name: profile.full_name, email }), [profile.full_name, email]);
  // The tiles show the example in every design; the big preview shows exactly what you'll get.
  const samples = useMemo(() => Object.fromEntries(CV_TEMPLATES.map((m) => [m.id, sampleCv(lang, m.id)])) as Record<CvTemplateId, Cv>, [lang]);
  const preview = useMemo(() => (start === "example" ? samples[template] : startCv("blank", lang, template, me)), [start, samples, template, lang, me]);
  const meta = templateMeta(template);
  const [previewRef, previewWidth] = useWidth<HTMLDivElement>();

  async function create() {
    if (busy) return;
    setBusy(true);
    const page = await createPage({ kind: "cv", title: cvTitle(preview), content: preview, plain_text: cvPlainText(preview) });
    if (!page) return setBusy(false);
    blob.react("jump", "excited", 1400);
    router.push(`/p/${page.id}`);
  }

  return (
    <form
      className="flex max-h-[calc(100dvh-12vh-16px)] flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="new-cv-title" className="font-display text-[21px] font-bold tracking-[-0.015em]">
            {t.title}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-ink-2">{t.intro}</p>
        </div>
        <IconButton type="button" label={t.close} onClick={onClose} className="-mr-1.5 -mt-1">
          <X className="size-4" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] md:overflow-hidden">
        {/* What you'll get (tablets and up) */}
        <div className="hidden min-h-0 flex-col items-center border-r border-line bg-paper px-6 py-5 md:flex md:overflow-y-auto">
          <div ref={previewRef} className="w-full max-w-[300px]" aria-label={t.preview} role="img">
            {previewWidth > 0 ? (
              <Thumb cv={preview} width={previewWidth} className="rounded-[4px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08),0_14px_32px_-12px_rgb(0_0_0/0.3)]" />
            ) : (
              <div className="aspect-[210/297] w-full rounded-[4px] bg-white" />
            )}
          </div>
          <div className="mt-4 w-full max-w-[300px]">
            <div className="font-display text-[15px] font-semibold">{tt(meta.name)}</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{tt(meta.blurb)}</p>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 md:overflow-y-auto">
          <fieldset>
            <Legend number={1}>{t.design}</Legend>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {CV_TEMPLATES.map((m, i) => (
                <DesignTile
                  key={m.id}
                  cv={samples[m.id]}
                  name={tt(m.name)}
                  checked={template === m.id}
                  onPick={() => setTemplate(m.id)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <Legend number={2}>{t.language}</Legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="inline-grid shrink-0 grid-cols-2 gap-0.5 rounded-xl bg-hover p-1">
                {LOCALES.map((l) => (
                  <label key={l} className="relative">
                    <input type="radio" name="cv-lang" value={l} checked={lang === l} onChange={() => setLang(l)} className="peer sr-only" />
                    <span className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-[14px] text-ink-2 transition-colors hover:text-ink peer-checked:bg-raised peer-checked:font-medium peer-checked:text-ink peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-blob">
                      <span className="rounded bg-ink/[0.07] px-1 text-[10.5px] font-semibold tracking-wide text-ink-3">{LOCALE_NAMES[l].short}</span>
                      {LOCALE_NAMES[l].name}
                    </span>
                  </label>
                ))}
              </div>
              <p className="min-w-[200px] flex-1 text-[12.5px] leading-snug text-ink-3">{t.languageHint}</p>
            </div>
          </fieldset>

          <fieldset>
            <Legend number={3}>{t.start}</Legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <StartOption
                value="blank"
                checked={start === "blank"}
                onPick={setStart}
                icon={<FilePlus2 />}
                title={t.blank}
                hint={t.blankHint(Boolean(profile.full_name?.trim()))}
              />
              <StartOption value="example" checked={start === "example"} onPick={setStart} icon={<BookOpenCheck />} title={t.example} hint={t.exampleHint} />
            </div>
          </fieldset>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="blob" loading={busy} className="max-sm:flex-1">
          {t.create} <ArrowRight className="size-4" />
        </Button>
      </footer>
    </form>
  );
}

function Legend({ number, children }: { number: number; children: ReactNode }) {
  return (
    <legend className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
      <span className="grid size-5 place-items-center rounded-full bg-blob-soft text-[11px] font-bold tabular-nums text-blob-ink">{number}</span>
      {children}
    </legend>
  );
}

function DesignTile({ cv, name, checked, onPick, autoFocus }: { cv: Cv; name: string; checked: boolean; onPick: () => void; autoFocus?: boolean }) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  return (
    <label className="group block cursor-pointer">
      <input type="radio" name="cv-design" checked={checked} onChange={onPick} autoFocus={autoFocus} className="peer sr-only" />
      <span
        ref={ref}
        className={cn(
          "relative block aspect-[3/4] overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow,transform] duration-150 group-hover:-translate-y-0.5 md:aspect-[3/2]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blob",
          checked ? "border-blob shadow-[0_0_0_2px_var(--blob)]" : "border-line shadow-card group-hover:border-line-2",
        )}
      >
        {width > 0 && <Thumb cv={cv} width={width} />}
        {checked && (
          <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-blob text-white shadow-card">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={cn("mt-1.5 block truncate text-center text-[12.5px] md:text-left", checked ? "font-semibold text-ink" : "text-ink-2 group-hover:text-ink")}>{name}</span>
    </label>
  );
}

function StartOption({
  value,
  checked,
  onPick,
  icon,
  title,
  hint,
}: {
  value: CvStart;
  checked: boolean;
  onPick: (v: CvStart) => void;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <label className="block cursor-pointer">
      <input type="radio" name="cv-start" value={value} checked={checked} onChange={() => onPick(value)} className="peer sr-only" />
      <span
        className={cn(
          "flex h-full gap-3 rounded-xl border p-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blob",
          checked ? "border-blob bg-blob-soft/50 shadow-[0_0_0_1px_var(--blob)]" : "border-line bg-raised hover:border-line-2 hover:bg-hover/40",
        )}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", checked ? "bg-blob text-white" : "bg-hover text-ink-2")}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-ink">{title}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{hint}</span>
        </span>
      </span>
    </label>
  );
}
