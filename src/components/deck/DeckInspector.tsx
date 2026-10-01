"use client";

import { Clock, ImageIcon, Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import type { DeckContent, Slide, SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cleanImageUrl, formatTalkTime, LAYOUTS, talkSeconds } from "./deck";
import { LayoutGlyph } from "./LayoutGlyph";

function Section({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-line px-4 py-4", className)}>
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/** Right-hand panel: layout, image, speaker notes and deck stats. */
export function DeckInspector({
  className,
  deck,
  slide,
  index,
  uploading,
  onLayout,
  onChange,
  onUpload,
}: {
  className?: string;
  deck: DeckContent;
  slide: Slide;
  index: number;
  uploading: boolean;
  onLayout: (layout: SlideLayout) => void;
  onChange: (patch: Partial<Slide>) => void;
  onUpload: (file: File) => void;
}) {
  const showImage = slide.layout === "image" || slide.layout === "split";
  const noteCount = deck.slides.filter((s) => s.notes.trim()).length;

  return (
    <aside className={cn("w-[248px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface", className)} aria-label="Slide settings">
      <Section title="Layout">
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Slide layout">
          {LAYOUTS.map((l) => {
            const active = l.id === slide.layout;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={l.hint}
                onClick={() => onLayout(l.id)}
                className="group rounded-lg p-1 text-center transition-colors hover:bg-hover"
              >
                <LayoutGlyph layout={l.id} active={active} className={cn(active ? "ring-2 ring-blob/25" : "group-hover:border-line-2")} />
                <div className={cn("mt-1 truncate text-[11.5px]", active ? "font-medium text-ink" : "text-ink-3 group-hover:text-ink-2")}>{l.label}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {showImage && <ImageSection key={slide.id} slide={slide} uploading={uploading} onChange={onChange} onUpload={onUpload} />}

      <Section
        title={
          <span className="flex items-center justify-between">
            Speaker notes <span className="font-normal normal-case tracking-normal">Slide {index + 1}</span>
          </span>
        }
      >
        <Textarea
          value={slide.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="What do you want to say on this slide?"
          aria-label="Speaker notes"
          className="min-h-[148px] px-2.5 text-[13px] leading-relaxed"
        />
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
          <Kbd>N</Kbd> shows them while presenting
        </p>
      </Section>

      <div className="space-y-2 px-4 py-4 pb-24 text-[12.5px] text-ink-2">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-ink-3" />
          <span>
            {deck.slides.length} {deck.slides.length === 1 ? "slide" : "slides"} · {formatTalkTime(talkSeconds(deck))}
          </span>
        </div>
        <div className="text-[12px] text-ink-3">
          {noteCount === 0 ? "No speaker notes yet." : `Notes on ${noteCount} of ${deck.slides.length} slides.`}
        </div>
      </div>
    </aside>
  );
}

function ImageSection({
  slide,
  uploading,
  onChange,
  onUpload,
}: {
  slide: Slide;
  uploading: boolean;
  onChange: (patch: Partial<Slide>) => void;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);

  const applyLink = () => {
    const url = cleanImageUrl(link);
    if (!url) return setInvalid(Boolean(link.trim()));
    onChange({ image: url });
    setLink("");
  };

  return (
    <Section title="Image">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <div className="relative mb-2.5 grid aspect-video place-items-center overflow-hidden rounded-lg border border-line bg-paper">
        {slide.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user images from any host
          <img src={slide.image} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-ink-3" strokeWidth={1.6} />
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-surface/80">
            <GooSpinner size={36} label="Uploading image" />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="size-3.5" /> {slide.image ? "Replace" : "Upload"}
        </Button>
        {slide.image && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ image: null })} aria-label="Remove image" title="Remove image">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <form
        className="relative mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          applyLink();
        }}
      >
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => link.trim() && applyLink()}
          placeholder="Or paste an image link"
          aria-label="Image link"
          aria-invalid={invalid}
          className="h-8 w-full rounded-lg border border-line bg-raised pl-8 pr-2.5 text-[12.5px] text-ink outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] aria-[invalid=true]:border-danger"
        />
      </form>
      {invalid ? (
        <p className="mt-1.5 text-[12px] text-danger">That doesn&apos;t look like a link.</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-ink-3">PNG, JPG, GIF or WebP, up to 10 MB.</p>
      )}
    </Section>
  );
}
