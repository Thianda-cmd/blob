"use client";

import type { CvPdfParts } from "@/cv/model";
import type { Cv } from "@/cv/types";

/** The CV being edited, or one opened through its public link (the server reads that one itself). */
export type PdfSource = { cv: Cv } | { share: { token: string; page: string | null } };

/**
 * Asks the server for the CV as a PDF file (src/app/api/cv/pdf) and saves it in Downloads, in
 * browsers and the apps alike. True when the file was saved.
 */
export async function savePdf(source: PdfSource, parts: CvPdfParts, fileName: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch("/api/cv/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...source, parts, fileName }),
    });
  } catch {
    return false;
  }
  if (!res.ok || !res.headers.get("Content-Type")?.includes("application/pdf")) return false;
  const file = await res.blob();
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
