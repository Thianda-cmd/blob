"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDark } from "@/components/editor/blocks/useDark";
import { useMessages } from "@/i18n/client";
import { publicText } from "@/i18n/messages/public";
import { InkDoc } from "@/ink/doc";
import { ImageCache } from "@/ink/images";
import { decodeItem, SHEET_H, SHEET_W, type Item, type Sheet, type WireItem } from "@/ink/model";
import { drawPaper, drawThing, lookOf } from "@/ink/render";
import { publicFileHref } from "@/lib/publicLink";
import { createClient } from "@/lib/supabase/client";

/** A handwritten note seen through its public link: its pages, one under the other. */
export function PublicInk({ token, pageId }: { token: string; pageId: string }) {
  const t = useMessages(publicText).view;
  const [doc, setDoc] = useState<InkDoc | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc("public_ink", { p_token: token, p_page: pageId })
      .then(({ data }) => {
        if (!alive) return;
        const d = new InkDoc();
        d.reset(((data ?? []) as WireItem[]).map((w) => decodeItem(w)).filter((i): i is Item => !!i));
        setDoc(d);
      });
    return () => {
      alive = false;
    };
  }, [token, pageId]);
  const images = useMemo(() => new ImageCache(async (path) => publicFileHref(token, pageId, path), () => setVersion((v) => v + 1)), [token, pageId]);
  if (!doc) return <div className="h-[60vh] animate-pulse rounded-xl bg-hover/60" aria-busy="true" />;
  if (!doc.sheets.length) return <p className="text-[14px] text-ink-3">{t.empty}</p>;
  return (
    <div className="space-y-5">
      {doc.sheets.map((s) => (
        <PublicSheet key={s.id} doc={doc} sheet={s} images={images} version={version} />
      ))}
    </div>
  );
}

function PublicSheet({ doc, sheet, images, version }: { doc: InkDoc; sheet: Sheet; images: ImageCache; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useDark();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
      const w = canvas.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(((w * SHEET_H) / SHEET_W) * dpr);
      const ctx = canvas.getContext("2d")!;
      const s = (w / SHEET_W) * dpr;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const look = lookOf(sheet.paper, dark);
      drawPaper(ctx, sheet.tpl, look, 1 / s);
      for (const thing of doc.on(sheet.id)) drawThing(ctx, thing, look.dark, images);
    };
    // Drawn when it comes into view (and again when the column changes width).
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        draw();
      }
    });
    io.observe(canvas);
    return () => io.disconnect();
  }, [doc, sheet, images, version, dark]);
  return <canvas ref={ref} className="block aspect-[1000/1414] w-full rounded-lg shadow-card ring-1 ring-black/[0.06]" />;
}
