"use client";

import { Camera, Crop, ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { blob } from "@/components/blob/bus";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button, IconButton } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { templateMeta } from "@/cv/catalog";
import { useLocale, useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { CropDialog, DEFAULT_CROP } from "./editor/CropDialog";
import { PHOTO_MAX_BYTES, PHOTO_TYPES, preload, shrinkPhoto, uploadToStorage } from "./editor/upload";
import { useOfferUndo } from "./form/undo";
import type { CvEditorProps } from "./types";

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/** Upload, crop, replace and remove the photo. */
export function PhotoField({ cv, change }: CvEditorProps) {
  const all = useMessages(cvEditorText);
  const t = all.photo;
  const locale = useLocale();
  const { userId } = useWorkspace();
  const offerUndo = useOfferUndo();
  const p = cv.person;
  const d = cv.design;
  const meta = templateMeta(d.template);
  const fileRef = useRef<HTMLInputElement>(null);
  /** The picture on its way up (a local preview). */
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  // A fresh crop dialog every time it opens (its draft starts from the saved crop).
  const [crop, setCrop] = useState({ open: false, key: 0 });

  useEffect(() => () => void (uploading && URL.revokeObjectURL(uploading)), [uploading]);

  const fail = (message: string) => {
    setError(message);
    blob.say(message, { mood: "worried" });
  };

  async function upload(file: File) {
    if (!PHOTO_TYPES.includes(file.type)) return fail(t.badType);
    if (file.size > PHOTO_MAX_BYTES) return fail(t.tooBig);
    setError(null);
    setUploading(URL.createObjectURL(file));
    // A phone photo of several MB would make the PDF just as big.
    const url = await uploadToStorage(await shrinkPhoto(file), userId);
    if (url) await preload(url);
    setUploading(null);
    if (!url) {
      fail(t.failed);
      blob.react("shake", "worried");
      return;
    }
    change((c) => ({
      ...c,
      person: { ...c.person, photo: url, photoCrop: DEFAULT_CROP },
      // A new photo is meant to be seen.
      design: c.design.portrait === "photo" ? c.design : { ...c.design, portrait: "photo" },
    }));
    blob.react("jump", "happy");
  }

  const pick = () => fileRef.current?.click();
  const remove = () => {
    const before = { photo: p.photo, photoCrop: p.photoCrop };
    change((c) => ({ ...c, person: { ...c.person, photo: null, photoCrop: DEFAULT_CROP } }));
    offerUndo({ message: t.removed, restore: (c) => ({ ...c, person: { ...c.person, ...before } }) });
  };
  const openCrop = () => setCrop((c) => ({ open: true, key: c.key + 1 }));
  const src = uploading ?? p.photo;
  const shape = d.photoShape;
  const frame = shape === "circle" ? "size-[76px] rounded-full" : cn("h-[88px] w-[70px]", shape === "rounded" ? "rounded-[11px]" : "rounded-[3px]");
  const { x, y, zoom } = uploading ? DEFAULT_CROP : p.photoCrop;

  return (
    <div
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/")) ?? e.dataTransfer.files[0];
        if (file && !uploading) void upload(file);
      }}
      className="relative flex items-start gap-3.5"
    >
      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      <button
        type="button"
        data-cv-photo-button
        onClick={() => (p.photo && !uploading ? openCrop() : pick())}
        disabled={Boolean(uploading)}
        aria-label={p.photo ? t.adjustTitle : t.add}
        title={p.photo ? t.adjustTitle : t.add}
        className={cn(
          "group relative shrink-0 overflow-hidden transition-[box-shadow,transform] active:scale-[0.97]",
          frame,
          src ? "bg-hover shadow-card ring-1 ring-ink/10 dark:ring-white/15" : "border-[1.5px] border-dashed border-line-2 bg-raised text-ink-3 hover:border-blob hover:text-blob-ink",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- the student's own upload, cropped like on the CV
          <img
            src={src}
            alt={t.alt}
            draggable={false}
            className="size-full"
            style={{ objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: `${x}% ${y}%` }}
          />
        ) : (
          <span className="grid size-full place-items-center">
            <Camera className="size-6" strokeWidth={1.6} />
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-surface/70">
            <GooSpinner size={34} label={t.uploading} />
          </span>
        )}
        {p.photo && !uploading && (
          <span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Crop className="size-3.5" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[13.5px] font-medium text-ink">{t.title}</div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t.hint}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {p.photo ? (
            <>
              <Button size="sm" onClick={openCrop} disabled={Boolean(uploading)} title={t.adjustTitle}>
                <Crop className="size-3.5" /> {t.adjust}
              </Button>
              <Button size="sm" variant="ghost" onClick={pick} disabled={Boolean(uploading)}>
                <ImageUp className="size-3.5" /> {t.replace}
              </Button>
              <IconButton
                label={t.remove}
                disabled={Boolean(uploading)}
                onClick={remove}
                className="hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </>
          ) : (
            <Button size="sm" onClick={pick} loading={Boolean(uploading)}>
              <ImageUp className="size-3.5" /> {t.add}
            </Button>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-[12px] text-danger" role="alert">
            {error}
          </p>
        ) : uploading ? (
          <p className="mt-1.5 text-[12px] text-ink-3" role="status">
            {t.uploading}
          </p>
        ) : !p.photo ? (
          <p className="mt-1.5 text-[12px] text-ink-3">{t.addHint}</p>
        ) : !meta.photo ? (
          <p className="mt-1.5 text-[12px] text-ink-3">{all.noPhotoTemplate(resolveText(meta.name, locale))}</p>
        ) : d.portrait !== "photo" ? (
          <p className="mt-1.5 text-[12px] text-ink-2">
            {/* Minimal has no initials: "initials" shows nothing there. */}
            {t.hidden[d.portrait === "initials" && meta.initials === false ? "none" : d.portrait]}{" "}
            <button type="button" onClick={() => change((c) => ({ ...c, design: { ...c.design, portrait: "photo" } }))} className="font-medium text-blob-ink hover:underline">
              {t.showIt}
            </button>
          </p>
        ) : null}
      </div>

      {over && (
        <div className="pointer-events-none absolute -inset-2 grid place-items-center rounded-xl border-2 border-dashed border-blob bg-blob-soft/85 text-[13px] font-medium text-blob-ink">
          {t.drop}
        </div>
      )}

      {p.photo && (
        <CropDialog
          key={crop.key}
          open={crop.open}
          src={p.photo}
          crop={p.photoCrop}
          shape={shape}
          onClose={() => setCrop((c) => ({ ...c, open: false }))}
          onDone={(next) => {
            setCrop((c) => ({ ...c, open: false }));
            change((c) => ({ ...c, person: { ...c.person, photoCrop: next } }));
          }}
        />
      )}
    </div>
  );
}
