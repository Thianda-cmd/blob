"use client";

import { useEffect, useRef } from "react";
import { blobApp, takeOpenedFiles } from "@/lib/native";
import { BLOB_MIME } from "@/notes/blobFile";
import { useImporter } from "./useImporter";

/**
 * In the Blob app: Blob files opened with it (double-click, "Open with", shared to it on Android)
 * are imported, and the first of them opens. The app keeps them until the site asks: when it
 * starts signed in, and whenever the app says new ones came ("blob-opened-files").
 */
export function useOpenedFiles() {
  const { importFiles } = useImporter();
  const importRef = useRef(importFiles);
  useEffect(() => {
    importRef.current = importFiles;
  });

  useEffect(() => {
    if (!blobApp()) return;
    let busy = false;
    const take = async () => {
      if (busy) return;
      busy = true;
      try {
        const files = await takeOpenedFiles();
        if (files.length) await importRef.current(files.map((f) => new File([f.text], f.name, { type: BLOB_MIME })));
      } finally {
        busy = false;
      }
    };
    void take();
    const onOpened = () => void take();
    window.addEventListener("blob-opened-files", onOpened);
    return () => window.removeEventListener("blob-opened-files", onOpened);
  }, []);
}
