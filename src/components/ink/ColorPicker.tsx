"use client";

import { useState } from "react";
import { hsl } from "@/ink/render";

/** Hue 0–360, saturation and value 0–1. */
type Hsv = [number, number, number];

function hsvToHex([h, s, v]: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}

/** Any colour: a saturation/brightness square, a hue strip and the hex code. */
export function ColorPicker({ value, onChange, labels }: { value: string; onChange: (hex: string) => void; labels: { hex: string; colour: string } }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(/^#[0-9a-f]{6}$/i.test(value) ? value : "#2563eb"));
  const [text, setText] = useState(value.startsWith("#") ? value : "#2563eb");

  // A colour chosen elsewhere (a swatch) moves the picker there.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (/^#[0-9a-f]{6}$/i.test(value) && value.toLowerCase() !== hsvToHex(hsv)) {
      setHsv(hexToHsv(value));
      setText(value);
    }
  }

  const set = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setText(hex);
    onChange(hex);
  };

  const drag = (el: HTMLElement | null, fn: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    if (!el) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const at = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const hueColor = hsl(hsv[0], 1, 0.5);
  return (
    <div className="flex flex-col gap-2.5" role="group" aria-label={labels.colour}>
      <div
        className="relative h-36 w-full cursor-crosshair touch-none select-none rounded-lg"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        onPointerDown={(e) => drag(e.currentTarget, (x, y) => set([hsv[0], x, 1 - y]))(e)}
      >
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.4)]"
          style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: hsvToHex(hsv) }}
        />
      </div>
      <div
        className="relative h-4 w-full cursor-pointer touch-none select-none rounded-full"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        onPointerDown={(e) => drag(e.currentTarget, (x) => set([x * 359.9, hsv[1] || 0.85, hsv[2] || 0.85]))(e)}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.4)]"
          style={{ left: `${(hsv[0] / 360) * 100}%`, background: hueColor }}
        />
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <span className="size-6 shrink-0 rounded-md border border-line" style={{ background: hsvToHex(hsv) }} />
        <span className="sr-only">{labels.hex}</span>
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            const hex = v.startsWith("#") ? v : `#${v}`;
            if (/^#[0-9a-f]{6}$/i.test(hex)) {
              setHsv(hexToHsv(hex));
              onChange(hex.toLowerCase());
            }
          }}
          spellCheck={false}
          maxLength={7}
          className="h-7 w-24 rounded-md border border-line bg-surface px-2 font-mono text-[12.5px] text-ink outline-none focus:border-blob"
          aria-label={labels.hex}
        />
      </label>
    </div>
  );
}
