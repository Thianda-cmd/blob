"use client";

import { FileDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CvDocument, CvPrint, PAGE_W } from "@/cv/CvDocument";
import { cvFileName, normalizeCv } from "@/cv/model";
import { savePdf } from "@/components/cv/editor/savePdf";
import { useLocale, useMessages } from "@/i18n/client";
import { publicText } from "@/i18n/messages/public";

const PX_PER_MM = 96 / 25.4;

/**
 * A CV as anyone with its public link sees it: its pages, as wide as the screen allows, and a PDF
 * download (made by the server from the shared CV; the print window if that fails).
 */
export function PublicCv({ content, token, pageId }: { content: unknown; token: string; pageId: string | null }) {
  const t = useMessages(publicText).view.cv;
  const locale = useLocale();
  const cv = useMemo(() => normalizeCv(content, locale), [content, locale]);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const download = async () => {
    setBusy(true);
    const saved = await savePdf({ share: { token, page: pageId } }, "cv", cvFileName(cv));
    setBusy(false);
    if (!saved) setPrinting(true);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width ? Math.min(1, width / (PAGE_W * PX_PER_MM)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="blob" onClick={() => void download()} loading={busy || printing}>
          <FileDown className="size-4" /> {t.download}
        </Button>
      </div>
      <div ref={box} className="w-full">
        {scale > 0 && <CvDocument cv={cv} scale={scale} gap={20} pageClassName="shadow-pop" />}
      </div>
      {printing && <CvPrint cv={cv} fileName={cvFileName(cv)} onDone={() => setPrinting(false)} />}
    </div>
  );
}
