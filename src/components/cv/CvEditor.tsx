"use client";

import { FileDown } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave } from "@/components/page/useAutosave";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CvDocument, CvPrint, PAGE_W } from "@/cv/CvDocument";
import { cvFileName, cvPlainText, cvTitle, normalizeCv } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useLocale } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { Page } from "@/lib/types";
import { CvForm } from "./CvForm";
import type { CvChange } from "./types";

type CvPatch = { content: Cv; title: string; plain_text: string };

const MM = 96 / 25.4;

/** The CV editor: the form on the left, the A4 pages on the right (what prints is what you see). */
export function CvEditor({ page }: { page: Page }) {
  const locale = useLocale();
  const { updatePage } = useWorkspace();
  const [cv, setCv] = useState<Cv>(() => normalizeCv(page.content, locale));
  const cvRef = useRef(cv);
  // The page title follows the name ("Lebenslauf – Lena Schneider") until someone renames the page.
  const autoTitle = useRef(!page.title.trim() || page.title === cvTitle(cv));

  const save = useCallback(
    async (patch: Partial<CvPatch>) => {
      const { error } = await createClient().from("pages").update(patch).eq("id", page.id);
      return !error;
    },
    [page.id],
  );
  const { state, schedule } = useAutosave<CvPatch>(save);

  const change: CvChange = useCallback(
    (fn) => {
      const next = fn(cvRef.current);
      if (next === cvRef.current) return;
      cvRef.current = next;
      setCv(next);
      const patch: Partial<CvPatch> = { content: next, plain_text: cvPlainText(next) };
      if (autoTitle.current) {
        patch.title = cvTitle(next);
        updatePage(page.id, { title: patch.title }, { local: true });
      }
      schedule(patch);
    },
    [schedule, updatePage, page.id],
  );

  // Typing stays quick: the pages catch up a moment later.
  const preview = useDeferredValue(cv);
  const [printing, setPrinting] = useState(false);

  // Fit the pages to the preview column.
  const paneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, Math.max(0.25, (el.clientWidth - 48) / (PAGE_W * MM)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <PageTopBar
        pageId={page.id}
        saveState={state}
        actions={
          <Button size="sm" variant="primary" onClick={() => setPrinting(true)}>
            <FileDown className="size-3.5" /> PDF
          </Button>
        }
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,460px)_1fr]">
        <div className="min-h-0 overflow-y-auto border-r border-line">
          <CvForm cv={cv} change={change} />
        </div>
        <div ref={paneRef} className="min-h-0 overflow-y-auto bg-hover/50 py-6">
          <CvDocument cv={preview} scale={scale} pageClassName="shadow-pop" />
        </div>
      </div>
      {printing && <CvPrint cv={cv} fileName={cvFileName(cv)} onDone={() => setPrinting(false)} />}
    </div>
  );
}
