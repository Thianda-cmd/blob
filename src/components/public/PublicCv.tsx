"use client";

import { FileDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CvDocument, CvPrint, PAGE_W } from "@/cv/CvDocument";
import { cvFileName, normalizeCv } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import { publicText } from "@/i18n/messages/public";

const PX_PER_MM = 96 / 25.4;

/** A CV as anyone with its public link sees it: its pages, as wide as the screen allows, and "Save as PDF". */
export function PublicCv({ content }: { content: unknown }) {
  const t = useMessages(publicText).view.cv;
  const locale = useLocale();
  const cv = useMemo(() => normalizeCv(content, locale), [content, locale]);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [printing, setPrinting] = useState(false);

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
        <Button variant="primary" onClick={() => setPrinting(true)} loading={printing}>
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
