"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#6d3df5", "#e5484d", "#3d74f0", "#d99000", "#26a269", "#ff70b0", "#0f9aa8"];

/** Paper confetti (strips and dots) raining down for `ms`; drawn on a canvas so hundreds stay smooth. */
export function Confetti({ ms = 5000, count = 160, className }: { ms?: number; count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    fit();
    window.addEventListener("resize", fit);
    const w = () => canvas.width;
    const h = () => canvas.height;
    const bits = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w(),
      y: -Math.random() * h() * 0.6 - 20,
      vx: (Math.random() - 0.5) * 2.4 * dpr,
      vy: (2 + Math.random() * 3) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: (6 + Math.random() * 7) * dpr,
      color: COLORS[i % COLORS.length],
      round: i % 4 === 0,
      wobble: Math.random() * Math.PI * 2,
    }));
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const age = t - start;
      ctx.clearRect(0, 0, w(), h());
      const fade = age > ms - 800 ? Math.max(0, (ms - age) / 800) : 1;
      for (const b of bits) {
        b.wobble += 0.08;
        b.x += b.vx + Math.sin(b.wobble) * 0.6 * dpr;
        b.y += b.vy;
        b.rot += b.vr;
        if (b.y > h() + 20 && age < ms - 1500) {
          b.y = -20;
          b.x = Math.random() * w();
        }
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        if (b.round) {
          ctx.beginPath();
          ctx.arc(0, 0, b.size / 2.6, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-b.size / 2, -b.size / 4, b.size, (b.size / 2) * Math.abs(Math.cos(b.wobble)) + 1);
        ctx.restore();
      }
      if (age < ms) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w(), h());
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, [ms, count]);
  return <canvas ref={ref} className={className ?? "pointer-events-none fixed inset-0 z-50 h-full w-full"} aria-hidden />;
}
