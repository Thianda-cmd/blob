"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { CvDesign, CvPhotoCrop } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { cn } from "@/lib/utils";
import { useTrapFocus } from "./useTrapFocus";

export const DEFAULT_CROP: CvPhotoCrop = { x: 50, y: 40, zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 10) / 10;

type Size = { w: number; h: number };

/**
 * Where the picture lands in a W × H frame. The same as what the CV draws (src/cv/render.tsx,
 * Portrait): object-fit cover at object-position x% y%, then scale(zoom) around x% y%.
 */
function placeImage(img: Size, W: number, H: number, crop: CvPhotoCrop) {
  const s = Math.max(W / img.w, H / img.h);
  const dw = img.w * s;
  const dh = img.h * s;
  const ox = W * (crop.x / 100);
  const oy = H * (crop.y / 100);
  const left = ox + crop.zoom * (-(dw - W) * (crop.x / 100) - ox);
  const top = oy + crop.zoom * (-(dh - H) * (crop.y / 100) - oy);
  return { left, top, width: dw * crop.zoom, height: dh * crop.zoom, spareX: dw - W, spareY: dh - H };
}

/** How many % the focus point moves for one pixel of dragging (negative: drag right, picture follows). */
function perPixel(frame: number, spare: number, zoom: number) {
  const d = frame * (1 - zoom) - zoom * spare;
  return Math.abs(d) < 0.01 ? 0 : 100 / d;
}

/**
 * "Ausschnitt anpassen": drag the photo inside the frame (in the CV's photo shape) and zoom with
 * the slider, the mouse wheel or the keys. Shows the rest of the picture dimmed around the frame.
 */
export function CropDialog({
  open,
  src,
  crop,
  shape,
  onClose,
  onDone,
}: {
  open: boolean;
  src: string;
  crop: CvPhotoCrop;
  shape: CvDesign["photoShape"];
  onClose: () => void;
  onDone: (crop: CvPhotoCrop) => void;
}) {
  const t = useMessages(cvEditorText).crop;
  const [draft, setDraft] = useState(crop);
  const [img, setImg] = useState<Size | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; crop: CvPhotoCrop } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useTrapFocus(open, boxRef);
  const [dragging, setDragging] = useState(false);

  const W = shape === "circle" ? 216 : 196;
  const H = shape === "circle" ? 216 : 248;
  const M = 40;
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? 14 : 3;
  const place = img ? placeImage(img, W, H, draft) : null;

  // Zoom with the wheel (or a trackpad pinch) over the picture; needs a non-passive listener.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setDraft((c) => ({ ...c, zoom: Math.round(clamp(c.zoom - e.deltaY * (e.ctrlKey ? 0.01 : 0.0025), MIN_ZOOM, MAX_ZOOM) * 100) / 100 }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, img]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, crop: draft };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !img) return;
    const start = placeImage(img, W, H, d.crop);
    const kx = perPixel(W, start.spareX, d.crop.zoom);
    const ky = perPixel(H, start.spareY, d.crop.zoom);
    setDraft({
      ...d.crop,
      x: round(clamp(d.crop.x + (e.clientX - d.x) * kx, 0, 100)),
      y: round(clamp(d.crop.y + (e.clientY - d.y) * ky, 0, 100)),
    });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<CvPhotoCrop>> = {
      // The arrows move the picture, so the focus point goes the other way.
      ArrowLeft: { x: clamp(draft.x + step, 0, 100) },
      ArrowRight: { x: clamp(draft.x - step, 0, 100) },
      ArrowUp: { y: clamp(draft.y + step, 0, 100) },
      ArrowDown: { y: clamp(draft.y - step, 0, 100) },
      "+": { zoom: round(clamp(draft.zoom + 0.1, MIN_ZOOM, MAX_ZOOM)) },
      "=": { zoom: round(clamp(draft.zoom + 0.1, MIN_ZOOM, MAX_ZOOM)) },
      "-": { zoom: round(clamp(draft.zoom - 0.1, MIN_ZOOM, MAX_ZOOM)) },
      "0": { ...DEFAULT_CROP },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setDraft((c) => ({ ...c, ...move }));
  };

  const setZoom = (zoom: number) => setDraft((c) => ({ ...c, zoom: round(clamp(zoom, MIN_ZOOM, MAX_ZOOM) * 100) / 100 }));

  return (
    <Dialog open={open} onClose={onClose} labelledBy="cv-crop-title" className="max-w-[400px]">
      <div ref={boxRef} className="p-5">
        <h2 id="cv-crop-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {t.title}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.hint}</p>

        <div
          ref={stageRef}
          tabIndex={0}
          role="application"
          aria-label={t.frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            "relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-xl bg-[repeating-conic-gradient(var(--hover)_0_25%,var(--surface)_0_50%)] bg-[length:16px_16px] outline-none ring-blob/40 focus-visible:ring-4",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{ width: W + 2 * M, height: H + 2 * M }}
        >
          {/* The whole picture, dimmed: what is outside the frame. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- the student's own upload, shown as is */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setImg({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
            className="pointer-events-none absolute max-w-none opacity-30"
            style={place ? { left: M + place.left, top: M + place.top, width: place.width, height: place.height } : { left: M, top: M, width: W, height: H, objectFit: "cover" }}
          />
          {/* The frame: exactly what the CV shows. */}
          <div className="pointer-events-none absolute overflow-hidden bg-white shadow-[0_0_0_2px_rgb(255_255_255/0.95),0_6px_24px_rgb(0_0_0/0.3)]" style={{ left: M, top: M, width: W, height: H, borderRadius: radius }}>
            {place && (
              // eslint-disable-next-line @next/next/no-img-element -- the student's own upload, shown as is
              <img src={src} alt="" draggable={false} className="absolute max-w-none" style={{ left: place.left, top: place.top, width: place.width, height: place.height }} />
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[12px] text-ink-3">{t.tip}</p>

        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setZoom(draft.zoom - 0.25)}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
            aria-label={t.zoomOut}
          >
            <ZoomOut className="size-4" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={draft.zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={t.zoom}
            className="h-8 min-w-0 flex-1 cursor-pointer rounded-full accent-[var(--blob)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blob"
          />
          <button
            type="button"
            onClick={() => setZoom(draft.zoom + 0.25)}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
            aria-label={t.zoomIn}
          >
            <ZoomIn className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_CROP)}>
            {t.reset}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button variant="blob" onClick={() => onDone(draft)}>
              {t.done}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
