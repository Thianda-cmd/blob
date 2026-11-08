"use client";

import { useEffect, useState } from "react";
import { CvSheets } from "@/cv/CvDocument";
import { normalizeCv, type CvPdfParts } from "@/cv/model";
import { sampleCv } from "@/cv/samples";
import type { Cv } from "@/cv/types";

declare global {
  interface Window {
    /** Called by the PDF maker (src/app/api/cv/pdf) with the CV to lay out. */
    __blobRenderCv?: (cv: unknown, parts: CvPdfParts, title: string) => void;
    /** True once the sheets are laid out with their fonts: the PDF can be made. */
    __blobCvReady?: boolean;
  }
}

/**
 * /render/cv: an empty page that lays out a CV it is handed, for the server's headless browser to
 * save as a PDF. The same engine as the editor, so the file is exactly what the editor shows.
 */
export function CvRender() {
  const [job, setJob] = useState<{ cv: Cv; parts: CvPdfParts } | null>(null);
  useEffect(() => {
    window.__blobRenderCv = (raw, parts, title) => {
      window.__blobCvReady = false;
      document.title = title;
      // { sample: "de" | "en" }: Blob's example CV (the server's self-check).
      const sample = (raw as { sample?: unknown } | null)?.sample;
      const cv = sample === "de" || sample === "en" ? sampleCv(sample) : normalizeCv(raw);
      setJob({ cv, parts: parts === "letter" || parts === "both" ? parts : "cv" });
    };
    return () => {
      delete window.__blobRenderCv;
    };
  }, []);
  if (!job) return null;
  return (
    <CvSheets
      cv={job.cv}
      parts={job.parts}
      onReady={() => {
        window.__blobCvReady = true;
      }}
    />
  );
}
