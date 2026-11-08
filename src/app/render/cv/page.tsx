import type { Metadata } from "next";
import { CvRender } from "@/components/cv/CvRender";

export const metadata: Metadata = { title: { absolute: "CV" }, robots: { index: false, follow: false }, other: { "blob-no-offline": "1" } };

/** Where the server's headless browser lays out a CV to save it as a PDF (src/app/api/cv/pdf). */
export default function CvRenderPage() {
  return <CvRender />;
}
