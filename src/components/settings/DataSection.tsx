"use client";

import { FileArchive, FileUp } from "lucide-react";
import { useState } from "react";
import { blob } from "@/components/blob/bus";
import { download, exportPages } from "@/components/notes/transfer";
import { useImporter } from "@/components/notes/useImporter";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { settingsText } from "@/i18n/messages/settings";
import { transferText } from "@/i18n/messages/transfer";
import { BLOB_EXT, BLOB_MIME, fileNameFor } from "@/notes/blobFile";
import { Card, Section } from "./primitives";

/** Your notes as one Blob file, and Blob files (or Markdown) back in. */
export function DataSection() {
  const t = useMessages(transferText);
  const s = useMessages(settingsText).nav;
  const { pages, userId } = useWorkspace();
  const { pick } = useImporter();
  const [busy, setBusy] = useState(false);

  const backup = async () => {
    // Your own pages at the top of their tree (their sub-pages come along).
    const mine = pages.filter((p) => p.user_id === userId && !p.trashed_at && p.kind !== "cv");
    const roots = mine.filter((p) => !p.parent_id || !mine.some((x) => x.id === p.parent_id)).map((p) => p.id);
    if (!roots.length) return;
    setBusy(true);
    blob.say(t.export.preparing, { mood: "thinking", ms: 5000 });
    const result = await exportPages(roots);
    setBusy(false);
    if (!result) return blob.say(t.export.failed, { mood: "worried" });
    const date = new Date().toISOString().slice(0, 10);
    download(fileNameFor(t.export.backupName(date), BLOB_EXT, "Blob"), JSON.stringify(result.file), BLOB_MIME);
    blob.say(result.missing ? t.export.missing(result.missing) : t.export.done(result.pages), { mood: "happy", ms: 6000 });
  };

  return (
    <Section id="data" title={s.data} description={t.export.backupHint}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{t.export.backup}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">{t.export.blobHint}</div>
          </div>
          <Button size="sm" onClick={() => void backup()} loading={busy}>
            <FileArchive className="size-3.5" /> {t.export.backupButton}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{t.import.action}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">{t.import.actionHint}</div>
          </div>
          <Button size="sm" onClick={() => pick()}>
            <FileUp className="size-3.5" /> {t.import.label}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
