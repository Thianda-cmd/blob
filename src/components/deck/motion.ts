import type { Variants } from "motion/react";
import type { SlideBuild, SlideTransition } from "@/lib/types";
import { SLIDE_W } from "./deck";

/**
 * Slide motion shared by the presenter and the editor's preview:
 * stage transitions, build (one-click-at-a-time) reveals and the morph engine.
 */

export type StageCustom = { dir: number; kind: SlideTransition };

const EASE = [0.22, 1, 0.36, 1] as const;
const IN_OUT = [0.65, 0, 0.35, 1] as const;

export const MORPH_MS = 760;

// The original presenter motion, kept exactly for the "slide" transition.
const DRIFT = {
  x: { type: "spring", stiffness: 280, damping: 34, mass: 0.9 },
  scale: { type: "spring", stiffness: 280, damping: 30 },
  opacity: { duration: 0.22, ease: EASE },
} as const;

/**
 * Variants for one slide on the stage. The new slide is always painted above the old one,
 * so cross-fades never dip through black: the old slide simply waits underneath.
 */
export const stageVariants: Variants = {
  enter: ({ dir, kind }: StageCustom) => {
    switch (kind) {
      case "slide":
        return { x: dir === 0 ? 0 : `${dir * 12}%`, scale: 0.94, opacity: 0 };
      case "fade":
        return { x: 0, scale: 1, opacity: 0 };
      case "push":
        return { x: dir === 0 ? 0 : `${dir * 100}%`, scale: 1, opacity: 1 };
      case "zoom":
        return { x: 0, scale: dir < 0 ? 1.12 : 0.86, opacity: 0 };
      default:
        return { x: 0, scale: 1, opacity: 1 };
    }
  },
  center: ({ kind }: StageCustom) => {
    const at = { x: 0, scale: 1, opacity: 1 };
    switch (kind) {
      case "slide":
        return { ...at, transition: DRIFT };
      case "fade":
        return { ...at, transition: { duration: 0.5, ease: EASE } };
      case "push":
        return { ...at, transition: { duration: 0.62, ease: IN_OUT } };
      case "zoom":
        return { ...at, transition: { duration: 0.6, ease: EASE } };
      default:
        return { ...at, transition: { duration: 0 } };
    }
  },
  exit: ({ dir, kind }: StageCustom) => {
    switch (kind) {
      case "slide":
        return { x: dir === 0 ? 0 : `${dir * -12}%`, scale: 0.94, opacity: 0, transition: DRIFT };
      case "fade":
        return { opacity: 0, transition: { duration: 0.01, delay: 0.5 } };
      case "push":
        return { x: dir === 0 ? 0 : `${dir * -100}%`, transition: { duration: 0.62, ease: IN_OUT } };
      case "zoom":
        return { scale: dir < 0 ? 0.94 : 1.06, opacity: 1, transition: { duration: 0.6, ease: EASE } };
      case "morph":
        return { opacity: 0, transition: { duration: 0.01, delay: MORPH_MS / 1000 } };
      default:
        return { opacity: 0, transition: { duration: 0 } };
    }
  },
};

/** Reveal variants for build items. */
export function buildVariants(build: SlideBuild | "fade"): Variants {
  switch (build) {
    case "pop":
      return {
        hidden: { opacity: 0, scale: 0.72, transition: { duration: 0.2 } },
        shown: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 520, damping: 21 } },
      };
    case "wipe":
      return {
        hidden: { opacity: 0, clipPath: "inset(-25% 100% -25% -4%)", transition: { duration: 0.35, ease: IN_OUT } },
        shown: { opacity: 1, clipPath: "inset(-25% -4% -25% -4%)", transition: { duration: 0.65, ease: IN_OUT, opacity: { duration: 0.15 } } },
      };
    case "fade":
      return {
        hidden: { opacity: 0, transition: { duration: 0.2 } },
        shown: { opacity: 1, transition: { duration: 0.35 } },
      };
    default:
      return {
        hidden: { opacity: 0, y: 28, transition: { duration: 0.22 } },
        shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
      };
  }
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const morphed = new WeakSet<HTMLElement>();

/**
 * Morph from one slide canvas to the next. Elements tagged with the same `data-morph` id
 * on both slides glide from the old position and size to the new one (a FLIP done in
 * slide coordinates, so it is exact at any zoom). Everything else cross-fades.
 *
 * `data-morph-box` elements stretch to fit (images, rules); text scales uniformly by font size.
 */
export function morph(from: HTMLElement, to: HTMLElement, ms = MORPH_MS) {
  // Once per incoming canvas (ref callbacks can run twice in development).
  if (morphed.has(to)) return () => {};
  morphed.add(to);
  const fromBox = from.getBoundingClientRect();
  const toBox = to.getBoundingClientRect();
  const scale = toBox.width / SLIDE_W || 1;
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
  const anims: Animation[] = [];
  const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => anims.push(el.animate(keyframes, { easing, ...options }));

  const tagged = (root: HTMLElement) => {
    const map = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>("[data-morph]").forEach((el) => {
      const key = el.dataset.morph;
      if (key && !map.has(key)) map.set(key, el);
    });
    return map;
  };
  const a = tagged(from);
  const b = tagged(to);

  // The new background fades in over the old slide, which stays put underneath.
  const frame = to.parentElement;
  if (frame) {
    const color = getComputedStyle(frame).backgroundColor;
    play(frame, [{ backgroundColor: "transparent" }, { backgroundColor: color }], { duration: ms * 0.55, fill: "backwards" });
  }
  const bg = to.querySelector("[data-slide-bg]");
  if (bg) play(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: ms * 0.55, fill: "backwards" });

  const local = (r: DOMRect, base: DOMRect) => ({ x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale });

  const opacityOf = (el: Element) => {
    const v = Number(getComputedStyle(el).opacity);
    return Number.isNaN(v) ? 1 : v;
  };

  for (const [key, elB] of b) {
    const elA = a.get(key);
    const opB = opacityOf(elB);
    if (!elA) {
      play(elB, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: opB, transform: "none" }], { duration: ms * 0.7, delay: ms * 0.3, fill: "backwards" });
      continue;
    }
    const ra = local(elA.getBoundingClientRect(), fromBox);
    const rb = local(elB.getBoundingClientRect(), toBox);
    if (!rb.w || !rb.h || !ra.w || !ra.h) continue;
    const origin = "0 0";
    const opA = opacityOf(elA);
    const imgB = elB.querySelector("img");

    if (elB.dataset.morphBox !== undefined && imgB) {
      // Photos keep their proportions: scale uniformly to cover the old frame, clip to it, then open up.
      const s = Math.max(ra.w / rb.w, ra.h / rb.h);
      const tx = ra.x + ra.w / 2 - rb.x - (s * rb.w) / 2;
      const ty = ra.y + ra.h / 2 - rb.y - (s * rb.h) / 2;
      const left = (ra.x - rb.x - tx) / s;
      const top = (ra.y - rb.y - ty) / s;
      const right = rb.w - (ra.x + ra.w - rb.x - tx) / s;
      const bottom = rb.h - (ra.y + ra.h - rb.y - ty) / s;
      const same = elA.querySelector("img")?.src === imgB.src;
      play(
        elB,
        [
          { transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: origin, clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`, opacity: same ? opB : 0, offset: 0 },
          { opacity: opB, offset: same ? 0.01 : 0.5 },
          { transform: "none", transformOrigin: origin, clipPath: "inset(0px 0px 0px 0px)", opacity: opB, offset: 1 },
        ],
        { duration: ms, fill: "backwards" },
      );
      play(elA, same ? [{ opacity: 0 }, { opacity: 0 }] : [{ opacity: opA }, { opacity: 0 }], { duration: same ? ms : ms * 0.5, fill: "forwards" });
      continue;
    }

    let sx: number;
    let sy: number;
    if (elB.dataset.morphBox !== undefined) {
      sx = ra.w / rb.w;
      sy = ra.h / rb.h;
    } else {
      sx = sy = parseFloat(getComputedStyle(elA).fontSize) / parseFloat(getComputedStyle(elB).fontSize) || 1;
    }
    const dx = ra.x - rb.x;
    const dy = ra.y - rb.y;
    // Same content: the new copy simply travels. Different content: the two cross-fade on the way.
    const same = elA.textContent === elB.textContent && elA.tagName === elB.tagName;
    play(
      elB,
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: origin, opacity: same ? opA : 0, offset: 0 },
        { opacity: same ? opA : opB, offset: same ? 0.01 : 0.55 },
        { transform: "none", transformOrigin: origin, opacity: opB, offset: 1 },
      ],
      { duration: ms, fill: "backwards" },
    );
    play(
      elA,
      same
        ? [{ opacity: 0 }, { opacity: 0 }]
        : [
            { transform: "none", transformOrigin: origin, opacity: opA, offset: 0 },
            { opacity: 0, offset: 0.45 },
            { transform: `translate(${-dx}px, ${-dy}px) scale(${1 / sx}, ${1 / sy})`, transformOrigin: origin, opacity: 0, offset: 1 },
          ],
      { duration: ms, fill: "forwards" },
    );
  }
  for (const [key, elA] of a) {
    if (!b.has(key)) play(elA, [{ opacity: opacityOf(elA) }, { opacity: 0 }], { duration: ms * 0.4, fill: "forwards" });
  }

  return () => anims.forEach((anim) => anim.cancel());
}
