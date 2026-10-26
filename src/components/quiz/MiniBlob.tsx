"use client";

import { useId, useRef } from "react";
import { BODY_Y, CX, EYE_X, FACE_Y, GROUND, MOUTH_Y, R } from "@/components/blob/geometry";
import { SKIN_COLORS } from "@/components/blob/look";
import { Hat } from "@/components/blob/outfits";
import type { Look } from "@/quiz/views";
import { cn } from "@/lib/utils";

// A player's Blob, cheap enough for a lobby full of them: the same body, colours and hats as the
// real Blob, drawn once, with a CSS jiggle instead of the physics.

const BODY = (() => {
  const n = 24;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const bottom = Math.sin(a) > 0;
    pts.push(`${(CX + Math.cos(a) * R * (bottom ? 1.08 : 1)).toFixed(1)},${(BODY_Y + Math.sin(a) * R * (bottom ? 0.8 : 1)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
})();

export function MiniBlob({ look, size = 56, mood = "happy", bounce = true, delay = 0, className }: { look: Look; size?: number; mood?: "happy" | "sad" | "wow"; bounce?: boolean; delay?: number; className?: string }) {
  const id = `mb${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const swing = useRef<SVGGElement>(null);
  const skin = look.skin && look.skin !== "classic" && look.skin !== "disco" ? SKIN_COLORS[look.skin] : null;
  const light = skin?.light ?? "var(--blob-light)";
  const base = skin?.base ?? "var(--blob)";
  const deep = skin?.deep ?? "var(--blob-deep)";
  const face = skin?.face ?? "var(--blob-face)";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn("shrink-0 overflow-visible", className)} aria-hidden>
      <defs>
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={82} cy={80} r={118}>
          <stop offset="0%" stopColor={light} />
          <stop offset="40%" stopColor={base} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
      </defs>
      <ellipse cx={CX} cy={GROUND + 3} rx={R * 0.9} ry={7} fill="var(--ink)" opacity={0.14} className={bounce ? "quiz-shadow" : undefined} style={{ animationDelay: `${delay}ms` }} />
      <g className={cn(bounce && "quiz-jiggle", look.skin === "disco" && "blob-disco")} style={{ animationDelay: `${delay}ms`, transformOrigin: `${CX}px ${GROUND}px` }}>
        <path d={BODY} fill={`url(#${id})`} />
        <ellipse cx={CX - 26} cy={BODY_Y - 38} rx={17} ry={8.5} transform={`rotate(-28 ${CX - 26} ${BODY_Y - 38})`} fill="#fff" opacity={0.7} />
        <g fill={face}>
          {mood === "wow" ? (
            <>
              <circle cx={CX - EYE_X} cy={FACE_Y} r={8} />
              <circle cx={CX + EYE_X} cy={FACE_Y} r={8} />
              <ellipse cx={CX} cy={MOUTH_Y + 2} rx={7} ry={9} />
            </>
          ) : (
            <>
              <ellipse cx={CX - EYE_X} cy={FACE_Y} rx={6.5} ry={mood === "sad" ? 6 : 8.5} />
              <ellipse cx={CX + EYE_X} cy={FACE_Y} rx={6.5} ry={mood === "sad" ? 6 : 8.5} />
              <circle cx={CX - EYE_X + 2.4} cy={FACE_Y - 3} r={2.2} fill="#fff" />
              <circle cx={CX + EYE_X + 2.4} cy={FACE_Y - 3} r={2.2} fill="#fff" />
              <path
                d={mood === "sad" ? `M${CX - 11} ${MOUTH_Y + 6} Q${CX} ${MOUTH_Y - 3} ${CX + 11} ${MOUTH_Y + 6}` : `M${CX - 12} ${MOUTH_Y} Q${CX} ${MOUTH_Y + 12} ${CX + 12} ${MOUTH_Y}`}
                stroke={face}
                strokeWidth={4.5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}
        </g>
        {look.hat && <Hat hat={look.hat} id={id} swingRef={swing} />}
      </g>
    </svg>
  );
}
