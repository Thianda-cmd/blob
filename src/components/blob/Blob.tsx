"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/lib/utils";

export type BlobMood =
  | "idle"
  | "happy"
  | "excited"
  | "thinking"
  | "sleepy"
  | "worried"
  | "shy"
  | "love"
  | "surprised";

export type BlobAccessory = "cap" | "glasses" | "beret";

export type BlobHandle = {
  /** Hop. `power` 0..1.5 */
  jump: (power?: number) => void;
  /** Squash down like it was pressed. */
  squish: (amount?: number) => void;
  /** Jiggle the jelly from a direction (radians). */
  poke: (angle?: number, strength?: number) => void;
  /** Shake side to side (errors). */
  shake: () => void;
  /** Wave hello with the right arm. */
  wave: () => void;
  /** Both arms up and a big hop. */
  celebrate: () => void;
  /** Stretch the right arm out towards something on the right (a board, an answer). */
  point: () => void;
};

type BlobProps = {
  size?: number;
  mood?: BlobMood;
  /** Follow the mouse pointer with the eyes (and look around when it's idle). */
  track?: boolean;
  /** Fixed gaze in -1..1, overrides tracking. */
  look?: { x: number; y: number } | null;
  /** Move the mouth like it's speaking. Pair with a typing speech bubble. */
  talking?: boolean;
  accessory?: BlobAccessory | null;
  /** Little jelly arms. On by default from 72px up. */
  arms?: boolean;
  /** Press-and-hold squish and petting. On by default. */
  interactive?: boolean;
  className?: string;
  title?: string;
  onClick?: () => void;
  /** Form out of falling jelly droplets when it mounts (the app intro). */
  intro?: boolean;
  /** Called once the droplets have merged into Blob. */
  onFormed?: () => void;
  ref?: Ref<BlobHandle>;
};

// Droplets for the intro: x offset, radius, delay (ms). Bigger drops grow the body more.
const INTRO_DROPS = [
  { dx: -6, r: 19, delay: 0 },
  { dx: 30, r: 13, delay: 240 },
  { dx: -34, r: 15, delay: 400 },
  { dx: 14, r: 12, delay: 540 },
  { dx: -16, r: 11, delay: 660 },
];
const INTRO_TOTAL = INTRO_DROPS.reduce((sum, d) => sum + d.r * d.r, 0);

type Drop = { x: number; y: number; vy: number; r: number; fromX: number; fromY: number; startAt: number; mergeAt: number; state: 0 | 1 | 2 | 3; share: number };

// Geometry (viewBox 0 0 200 200)
const N = 12;
const CX = 100;
const R = 62;
const GROUND = 172;
const BOTTOM = R * 0.8;
const BODY_Y = GROUND - BOTTOM;
const FACE_Y = BODY_Y - 4;
const MOUTH_Y = FACE_Y + 20;
const ARM_X = CX + 57;
const ARM_Y = FACE_Y + 21;
const INK = "var(--blob-face)";

// One shared pointer listener for every blob on the page.
const pointer = { x: 0, y: 0, seen: false, movedAt: 0 };
let pointerUsers = 0;
function onPointerMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.seen = true;
  pointer.movedAt = performance.now();
}

function smoothPath(xs: Float32Array, ys: Float32Array) {
  // Closed Catmull-Rom spline converted to cubic Béziers.
  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < N; i++) {
    const p0 = (i - 1 + N) % N;
    const p1 = i;
    const p2 = (i + 1) % N;
    const p3 = (i + 2) % N;
    const c1x = xs[p1] + (xs[p2] - xs[p0]) / 6;
    const c1y = ys[p1] + (ys[p2] - ys[p0]) / 6;
    const c2x = xs[p2] - (xs[p3] - xs[p1]) / 6;
    const c2y = ys[p2] - (ys[p3] - ys[p1]) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${xs[p2].toFixed(2)},${ys[p2].toFixed(2)}`;
  }
  return d + "Z";
}

/** The outline at rest, used for the server render before the physics loop starts. */
const REST_PATH = (() => {
  const xs = new Float32Array(N);
  const ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    const bottomHalf = Math.sin(a) > 0;
    xs[i] = CX + Math.cos(a) * R * (bottomHalf ? 1.08 : 1);
    ys[i] = BODY_Y + Math.sin(a) * R * (bottomHalf ? 0.8 : 1);
  }
  return smoothPath(xs, ys);
})();
const HIDDEN = `translate(${CX} ${GROUND}) scale(0) translate(${-CX} ${-GROUND})`;

/** A talking mouth, `open` 0..1. */
function mouthPath(open: number) {
  const w = 9.5 - open * 2.5;
  const h = 2.5 + open * 11;
  return `M${CX - w},${MOUTH_Y} Q${CX},${MOUTH_Y - 1.5} ${CX + w},${MOUTH_Y} Q${CX + w * 0.9},${MOUTH_Y + h} ${CX},${MOUTH_Y + h} Q${CX - w * 0.9},${MOUTH_Y + h} ${CX - w},${MOUTH_Y} Z`;
}

const MOOD_TUNING: Record<BlobMood, { wobble: number; breathe: number; hop: number }> = {
  idle: { wobble: 0.018, breathe: 0.014, hop: 0 },
  happy: { wobble: 0.024, breathe: 0.018, hop: 0 },
  excited: { wobble: 0.034, breathe: 0.02, hop: 0.85 },
  thinking: { wobble: 0.014, breathe: 0.01, hop: 0 },
  sleepy: { wobble: 0.008, breathe: 0.035, hop: 0 },
  worried: { wobble: 0.02, breathe: 0.012, hop: 0 },
  shy: { wobble: 0.012, breathe: 0.01, hop: 0 },
  love: { wobble: 0.026, breathe: 0.02, hop: 0 },
  surprised: { wobble: 0.03, breathe: 0.01, hop: 0 },
};

/** Arm angles in degrees, [left, right]. 0 points straight out, positive hangs down. */
const ARM_POSE: Record<BlobMood, [number, number]> = {
  idle: [56, 56],
  happy: [38, 38],
  excited: [-52, -52],
  thinking: [60, -30],
  sleepy: [80, 80],
  worried: [-6, -6],
  shy: [74, 74],
  love: [14, 14],
  surprised: [-64, -64],
};

export function Blob({
  size = 120,
  mood = "idle",
  track = true,
  look = null,
  talking = false,
  accessory = null,
  arms,
  interactive = true,
  className,
  title,
  onClick,
  intro = false,
  onFormed,
  ref,
}: BlobProps) {
  const id = useId().replace(/:/g, "");
  const gooId = `blob-goo-${id}`;
  const showArms = arms ?? size >= 72;
  const [reaction, setReaction] = useState<BlobMood | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shownMood = reaction ?? mood;
  const [forming, setForming] = useState(intro);

  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const clipRef = useRef<SVGPathElement>(null);
  const jellyRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const armLRef = useRef<SVGGElement>(null);
  const armRRef = useRef<SVGGElement>(null);
  const gooRef = useRef<SVGGElement>(null);
  const dropRefs = useRef<(SVGCircleElement | null)[]>([]);
  const introRef = useRef(intro);
  const onFormedRef = useRef(onFormed);
  const capRef = useRef<SVGGElement>(null);
  const tasselRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  // Mutable physics state, never rendered directly.
  const sim = useRef({
    y: 0,
    vy: 0,
    s: 0,
    vs: 0,
    x: 0,
    vx: 0,
    off: new Float32Array(N),
    voff: new Float32Array(N),
    lookX: 0,
    lookY: 0,
    idleX: 0,
    idleY: 0,
    nextIdleLook: 0,
    nextBlink: 0,
    blinkUntil: 0,
    nextHop: 0,
    armL: 56,
    armR: 56,
    vArmL: 0,
    vArmR: 0,
    waveUntil: 0,
    pointUntil: 0,
    cheerUntil: 0,
    tassel: 0,
    vTassel: 0,
    mouth: 0,
    pressed: false,
    pressedAt: 0,
    pet: 0,
    petAt: 0,
    petCooldown: 0,
    // Intro: body scale grows as droplets merge in; arms pop out at the end.
    form: intro ? 0 : 1,
    vForm: 0,
    formTarget: intro ? 0 : 1,
    armScale: intro ? 0 : 1,
    vArmScale: 0,
    formed: !intro,
    lastMerge: 0,
    drops: [] as Drop[],
  });
  const moodRef = useRef(shownMood);
  const lookRef = useRef(look);
  const trackRef = useRef(track);
  const talkingRef = useRef(talking);
  const firstMood = useRef(true);

  useEffect(() => {
    onFormedRef.current = onFormed;
  }, [onFormed]);

  useEffect(() => {
    lookRef.current = look;
    trackRef.current = track;
    talkingRef.current = talking;
  }, [look, track, talking]);

  // A little "pop" whenever the mood changes, so transitions feel physical.
  useEffect(() => {
    moodRef.current = shownMood;
    if (firstMood.current) {
      firstMood.current = false;
      return;
    }
    sim.current.vs -= 0.9;
  }, [shownMood]);

  useEffect(() => () => clearTimeout(reactionTimer.current), []);

  function react(next: BlobMood, ms: number) {
    clearTimeout(reactionTimer.current);
    setReaction(next);
    reactionTimer.current = setTimeout(() => setReaction(null), ms);
  }

  useImperativeHandle(ref, () => ({
    jump(power = 1) {
      const st = sim.current;
      st.vs -= 2.2 * power; // crouch before leaving the ground
      setTimeout(() => {
        if (st.y >= 0) st.vy = -620 * Math.min(1.5, power);
      }, 70);
    },
    squish(amount = 1) {
      sim.current.vs -= 3.2 * amount;
    },
    poke(angle = -Math.PI / 2, strength = 1) {
      const st = sim.current;
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        st.voff[i] -= Math.max(0, Math.cos(a - angle)) * 1.6 * strength;
      }
      st.vs -= 0.9 * strength;
    },
    shake() {
      sim.current.vx += 520;
    },
    wave() {
      sim.current.waveUntil = performance.now() + 1500;
    },
    point() {
      sim.current.pointUntil = performance.now() + 1800;
    },
    celebrate() {
      const st = sim.current;
      st.cheerUntil = performance.now() + 1300;
      st.vs -= 2.6;
      setTimeout(() => {
        if (st.y >= 0) st.vy = -720;
      }, 80);
    },
  }));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = sim.current;
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    const phase = Array.from({ length: N }, (_, i) => i * 1.31 + Math.random() * 0.4);

    pointerUsers++;
    if (pointerUsers === 1) window.addEventListener("pointermove", onPointerMove, { passive: true });

    let raf = 0;
    let last = performance.now();
    let t = Math.random() * 10;
    let rect = svg.getBoundingClientRect();
    let frame = 0;
    let visible = true;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(svg);

    st.nextBlink = last + 1500 + Math.random() * 2500;
    st.nextHop = last + 600;

    if (introRef.current && !st.formed) {
      if (reduce) {
        st.form = st.formTarget = st.armScale = 1;
        st.formed = true;
        setTimeout(() => onFormedRef.current?.(), 0);
      } else {
        gooRef.current?.setAttribute("filter", `url(#${gooId})`);
        st.drops = INTRO_DROPS.map((d, i) => ({
          x: CX + d.dx,
          y: -110 - i * 16,
          vy: 0,
          r: d.r,
          fromX: 0,
          fromY: 0,
          startAt: last + 60 + d.delay,
          mergeAt: 0,
          state: 0,
          share: (d.r * d.r) / INTRO_TOTAL,
        }));
      }
    }

    const spring = (pos: number, vel: number, target: number, k: number, c: number, dt: number) => {
      vel += (-k * (pos - target) - c * vel) * dt;
      return [pos + vel * dt, vel] as const;
    };

    function tick(now: number) {
      if (!visible) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      t += dt;
      const currentMood = moodRef.current;
      const tune = MOOD_TUNING[currentMood];
      const isTalking = talkingRef.current;

      if ((frame++ & 15) === 0) rect = svg!.getBoundingClientRect();

      const airborne = st.y < -0.5;

      if (!reduce) {
        // Excited blobs hop on their own.
        if (tune.hop && now > st.nextHop && st.y >= 0 && st.vy === 0 && !st.pressed) {
          st.vs -= 1.6;
          st.vy = -480 * tune.hop;
          st.nextHop = now + 700 + Math.random() * 500;
        }

        // Gravity and landing.
        if (st.y < 0 || st.vy !== 0) {
          st.vy += 2600 * dt;
          st.y += st.vy * dt;
          if (st.y >= 0) {
            const impact = st.vy;
            st.y = 0;
            st.vy = impact > 260 ? -impact * 0.22 : 0;
            st.vs -= impact * 0.0042;
            for (let i = 0; i < N; i++) st.voff[i] += (Math.random() - 0.5) * impact * 0.0012;
          }
        }

        // Squash & stretch. Airborne stretches with velocity, pressing flattens,
        // talking adds a gentle bob.
        const breathe = Math.sin(t * (currentMood === "sleepy" ? 1.3 : 2.1)) * tune.breathe;
        const bob = isTalking ? Math.sin(t * 9) * 0.012 : 0;
        const target = st.pressed
          ? -0.3
          : airborne
            ? Math.max(-0.12, Math.min(0.16, -st.vy / 4200))
            : breathe + bob;
        [st.s, st.vs] = spring(st.s, st.vs, target, st.pressed ? 520 : 340, 11, dt);
        st.s = Math.max(-0.42, Math.min(0.4, st.s));

        // Horizontal shake spring.
        [st.x, st.vx] = spring(st.x, st.vx, 0, 900, 14, dt);

        // Jelly membrane: springs coupled to their neighbours make waves.
        for (let i = 0; i < N; i++) {
          const l = st.off[(i - 1 + N) % N];
          const r = st.off[(i + 1) % N];
          const a = -260 * st.off[i] - 6.5 * st.voff[i] + 140 * (l + r - 2 * st.off[i]);
          st.voff[i] += a * dt;
        }
        for (let i = 0; i < N; i++) st.off[i] = Math.max(-0.3, Math.min(0.3, st.off[i] + st.voff[i] * dt));

        // Arms: mood pose, plus gestures.
        const pose = ARM_POSE[currentMood];
        let tl = pose[0] + Math.sin(t * 2.1) * 3;
        let tr = pose[1] + Math.sin(t * 2.1 + 0.7) * 3;
        if (currentMood === "excited") {
          tl += Math.sin(t * 11) * 14;
          tr += Math.sin(t * 11 + Math.PI) * 14;
        }
        if (airborne) {
          tl -= 34;
          tr -= 34;
        }
        if (isTalking) tr += Math.sin(t * 5.3) * 12 - 10;
        if (now < st.pointUntil) tr = -14 + Math.sin(t * 6) * 3;
        if (now < st.waveUntil) tr = -30 + Math.sin(t * 16) * 24;
        if (now < st.cheerUntil) {
          tl = -74 + Math.sin(t * 17) * 10;
          tr = -74 + Math.sin(t * 17 + Math.PI) * 10;
        }
        if (st.pressed) {
          tl = 4;
          tr = 4;
        }
        [st.armL, st.vArmL] = spring(st.armL, st.vArmL, tl, 190, 12, dt);
        [st.armR, st.vArmR] = spring(st.armR, st.vArmR, tr, 190, 12, dt);
      }

      // Intro: droplets fall, touch the jelly and get pulled in.
      if (st.drops.length) {
        const rx = R * 1.04 * st.form * (1 - st.s * 0.62);
        const ry = R * st.form * (1 + st.s);
        const cy = GROUND - BOTTOM * st.form * (1 + st.s);
        let done = 0;
        st.drops.forEach((d, i) => {
          const el = dropRefs.current[i];
          if (d.state === 0 && now >= d.startAt) d.state = 1;
          if (d.state === 1) {
            d.vy += 2600 * dt;
            d.y += d.vy * dt;
            const dx = d.x - CX;
            const surface = rx > 1 && Math.abs(dx) < rx ? cy - ry * Math.sqrt(1 - (dx / rx) ** 2) : GROUND;
            if (d.y + d.r * 0.55 >= surface) {
              d.state = 2;
              d.mergeAt = now;
              d.fromX = d.x;
              d.fromY = Math.min(d.y, surface);
              st.formTarget = Math.min(1, st.formTarget + d.share);
              st.vs -= 1.1 + d.r * 0.03;
              const angle = Math.atan2(d.fromY - cy, dx);
              for (let k = 0; k < N; k++) {
                const a = -Math.PI / 2 + (k / N) * Math.PI * 2;
                st.voff[k] -= Math.max(0, Math.cos(a - angle)) * 0.9;
              }
            }
          }
          if (d.state === 2) {
            const p = Math.min(1, (now - d.mergeAt) / 300);
            const e = p * p * (3 - 2 * p);
            d.x = d.fromX + (CX - d.fromX) * e * 0.6;
            d.y = d.fromY + (cy - d.fromY) * e;
            d.r = INTRO_DROPS[i].r * (1 - e);
            if (p >= 1) {
              d.state = 3;
              st.lastMerge = now;
            }
          }
          if (d.state === 3) done++;
          if (el) {
            el.setAttribute("cx", d.x.toFixed(2));
            el.setAttribute("cy", d.y.toFixed(2));
            el.setAttribute("r", d.state === 0 || d.state === 3 ? "0" : Math.max(0, d.r).toFixed(2));
          }
        });
        if (done === st.drops.length && now - st.lastMerge > 120 && !st.formed) {
          st.formed = true;
          st.drops = [];
          gooRef.current?.removeAttribute("filter");
          setForming(false);
          onFormedRef.current?.();
        }
      }
      [st.form, st.vForm] = spring(st.form, st.vForm, st.formTarget, 170, 12, dt);
      [st.armScale, st.vArmScale] = spring(st.armScale, st.vArmScale, st.formed ? 1 : 0, 260, 13, dt);

      // Body outline.
      const amp = reduce ? 0 : tune.wobble;
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const wob = amp * (Math.sin(t * 1.7 + phase[i]) * 0.6 + Math.sin(t * 2.9 + phase[i] * 1.7) * 0.4);
        const r = R * (1 + wob + st.off[i]);
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        const bottomHalf = sin > 0;
        xs[i] = CX + cos * r * (bottomHalf ? 1.08 : 1);
        ys[i] = BODY_Y + sin * r * (bottomHalf ? 0.8 : 1);
      }
      const d = smoothPath(xs, ys);
      bodyRef.current?.setAttribute("d", d);
      clipRef.current?.setAttribute("d", d);

      // Gaze: a fixed look, the pointer, or idle glances around the room.
      let gx = 0;
      let gy = 0;
      const fixed = lookRef.current;
      if (currentMood === "thinking") {
        gx = 0.55;
        gy = -0.75;
      } else if (currentMood === "sleepy") {
        gy = 0.35;
      } else if (fixed) {
        gx = fixed.x;
        gy = fixed.y;
      } else if (trackRef.current) {
        if (pointer.seen && now - pointer.movedAt < 2800) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height * 0.55;
          const dx = pointer.x - cx;
          const dy = pointer.y - cy;
          const k = 1 / (Math.hypot(dx, dy) + 160);
          gx = Math.max(-1, Math.min(1, dx * k * 1.25));
          gy = Math.max(-1, Math.min(1, dy * k * 1.25));
        } else if (!reduce) {
          if (now > st.nextIdleLook) {
            const atYou = Math.random() < 0.35;
            st.idleX = atYou ? 0 : (Math.random() * 2 - 1) * 0.85;
            st.idleY = atYou ? 0.05 : (Math.random() * 2 - 1) * 0.5;
            st.nextIdleLook = now + 1100 + Math.random() * 2600;
          }
          gx = st.idleX;
          gy = st.idleY;
        }
      }
      const ease = Math.min(1, dt * 9);
      st.lookX += (gx - st.lookX) * ease;
      st.lookY += (gy - st.lookY) * ease;

      // The jelly leans towards what it's looking at.
      const lean = reduce ? 0 : -st.lookX * 4.5 + st.vx * 0.006;
      const sx = 1 - st.s * 0.62;
      const sy = 1 + st.s;
      const form = Math.max(0, st.form);
      jellyRef.current?.setAttribute(
        "transform",
        `translate(${(CX + st.x).toFixed(2)} ${(GROUND + st.y).toFixed(2)}) skewX(${lean.toFixed(2)}) scale(${(sx * form).toFixed(4)} ${(sy * form).toFixed(4)}) translate(${-CX} ${-GROUND})`,
      );
      faceRef.current?.setAttribute(
        "transform",
        `translate(${(st.lookX * 11).toFixed(2)} ${(st.lookY * 7).toFixed(2)}) rotate(${(st.lookX * 4).toFixed(2)} ${CX} ${FACE_Y})`,
      );
      const armK = Math.max(0, st.armScale).toFixed(3);
      const armGrow = `translate(${ARM_X} ${ARM_Y}) scale(${armK}) translate(${-ARM_X} ${-ARM_Y})`;
      armLRef.current?.setAttribute("transform", `rotate(${st.armL.toFixed(1)} ${ARM_X} ${ARM_Y}) ${armGrow}`);
      armRRef.current?.setAttribute("transform", `rotate(${st.armR.toFixed(1)} ${ARM_X} ${ARM_Y}) ${armGrow}`);

      // Graduation cap rides along with a swinging tassel.
      if (capRef.current) {
        // Follow the top of the jelly so the cap never floats off when it wobbles.
        const dyTop = ys[0] - (BODY_Y - R);
        capRef.current.setAttribute("transform", `translate(${(st.lookX * 4).toFixed(2)} ${dyTop.toFixed(2)})`);
        [st.tassel, st.vTassel] = spring(st.tassel, st.vTassel, -lean * 2 + Math.sin(t * 1.7) * 5 - st.vy * 0.03, 60, 3, dt);
        tasselRef.current?.setAttribute("transform", `rotate(${st.tassel.toFixed(1)} ${CX + 40} 54)`);
      }

      // Talking mouth.
      const mouthTarget = isTalking && !reduce ? 0.2 + 0.8 * Math.abs(Math.sin(t * 13.3) * Math.sin(t * 4.9 + 1.3)) : 0;
      st.mouth += (mouthTarget - st.mouth) * Math.min(1, dt * (isTalking ? 26 : 12));
      mouthRef.current?.setAttribute("d", mouthPath(st.mouth));

      // Blinking.
      if (now > st.nextBlink) {
        st.blinkUntil = now + 130;
        st.nextBlink = now + 2200 + Math.random() * 3800;
        if (Math.random() < 0.18) st.nextBlink = now + 260; // double blink
      }
      const blink = now < st.blinkUntil ? 0.1 : 1;
      eyesRef.current?.setAttribute("transform", `translate(0 ${FACE_Y}) scale(1 ${blink}) translate(0 ${-FACE_Y})`);

      // Ground shadow shrinks while airborne.
      const lift = Math.min(1, -st.y / 140);
      const shadow = shadowRef.current;
      if (shadow) {
        shadow.setAttribute("rx", (R * 1.02 * sx * form * (1 - lift * 0.45)).toFixed(2));
        shadow.setAttribute("opacity", (0.16 * Math.min(1, form * 1.4) * (1 - lift * 0.6)).toFixed(3));
        shadow.setAttribute("cx", (CX + st.x).toFixed(2));
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      pointerUsers--;
      if (pointerUsers === 0) window.removeEventListener("pointermove", onPointerMove);
    };
  }, [gooId]);

  function handlePointerEnter() {
    const st = sim.current;
    for (let i = 0; i < N; i++) st.voff[i] += (Math.random() - 0.5) * 0.9;
  }

  // Rubbing the pointer back and forth over Blob counts as petting.
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || e.pointerType !== "mouse") return;
    const st = sim.current;
    const now = performance.now();
    st.pet = st.pet * Math.exp(-(now - st.petAt) / 500) + Math.hypot(e.movementX, e.movementY);
    st.petAt = now;
    if (st.pet > 320 && now > st.petCooldown) {
      st.pet = 0;
      st.petCooldown = now + 2400;
      for (let i = 0; i < N; i++) st.voff[i] += (Math.random() - 0.5) * 1.2;
      react("love", 1700);
    }
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || e.button !== 0) return;
    const st = sim.current;
    st.pressed = true;
    st.pressedAt = performance.now();
    react("excited", 60_000);
  }

  function handlePointerUp() {
    const st = sim.current;
    if (!st.pressed) return;
    st.pressed = false;
    const held = performance.now() - st.pressedAt;
    st.vs += held > 220 ? 4.2 : 1.6;
    if (held > 220) setTimeout(() => st.y >= 0 && (st.vy = -560), 40);
    react("happy", 900);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(e.clientY - (rect.top + rect.height * 0.55), e.clientX - (rect.left + rect.width / 2));
    const st = sim.current;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      st.voff[i] -= Math.max(0, Math.cos(a - angle)) * 1.4;
    }
    st.vs -= 1.4;
    onClick?.();
  }

  const gradient = `blob-grad-${id}`;
  const core = `blob-core-${id}`;
  const shine = `blob-shine-${id}`;
  const clip = `blob-clip-${id}`;
  const glow = `blob-glow-${id}`;
  const rimLight = `blob-rimlight-${id}`;
  const bodyId = `blob-body-${id}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("select-none overflow-visible", (onClick || interactive) && "cursor-pointer", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      <defs>
        {/* User-space gradients so the arms share the body's lighting. */}
        <radialGradient id={gradient} gradientUnits="userSpaceOnUse" cx={82} cy={80} r={118}>
          <stop offset="0%" style={{ stopColor: "var(--blob-light)" }} />
          <stop offset="40%" style={{ stopColor: "var(--blob)" }} />
          <stop offset="100%" style={{ stopColor: "var(--blob-deep)" }} />
        </radialGradient>
        <radialGradient id={core} gradientUnits="userSpaceOnUse" cx={108} cy={134} r={46}>
          <stop offset="0%" style={{ stopColor: "var(--blob-light)" }} stopOpacity="0.45" />
          <stop offset="100%" style={{ stopColor: "var(--blob-light)" }} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="92%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={rimLight} gradientUnits="userSpaceOnUse" x1={50} y1={60} x2={110} y2={130}>
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        {/* Goo: blur + alpha threshold bridges the droplets into the body; the crisp body is composited on top. */}
        <filter id={gooId} x="-40%" y="-80%" width="180%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        <clipPath id={clip}>
          <path ref={clipRef} d={REST_PATH} />
        </clipPath>
      </defs>

      <ellipse ref={shadowRef} cx={CX} cy={GROUND + 3} rx={intro ? 0 : R} ry={7} fill="var(--ink)" opacity={0.16} />

      <g ref={gooRef}>
      <g ref={jellyRef} transform={intro ? HIDDEN : undefined}>
        {showArms && (
          <>
            <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>
              <g ref={armLRef}>
                <Arm gradient={gradient} />
              </g>
            </g>
            <g ref={armRRef}>
              <Arm gradient={gradient} />
            </g>
          </>
        )}

        <path ref={bodyRef} id={bodyId} d={REST_PATH} fill={`url(#${gradient})`} />

        <g clipPath={`url(#${clip})`}>
          {/* light scattered inside the jelly */}
          <ellipse cx={108} cy={134} rx={46} ry={38} fill={`url(#${core})`} />
          {/* translucent glow at the base, like light passing through jelly */}
          <ellipse cx={CX} cy={GROUND - 10} rx={R * 0.95} ry={R * 0.5} fill={`url(#${glow})`} />
          {/* tiny suspended bubbles */}
          <g fill="#fff">
            <circle cx={CX + 34} cy={GROUND - 30} r={3.2} opacity={0.32}>
              <animate attributeName="cy" values={`${GROUND - 26};${GROUND - 62};${GROUND - 26}`} dur="7s" repeatCount="indefinite" />
            </circle>
            <circle cx={CX - 38} cy={GROUND - 22} r={2.2} opacity={0.28}>
              <animate attributeName="cy" values={`${GROUND - 18};${GROUND - 50};${GROUND - 18}`} dur="9s" repeatCount="indefinite" />
            </circle>
            <circle cx={CX + 18} cy={GROUND - 16} r={1.6} opacity={0.3}>
              <animate attributeName="cy" values={`${GROUND - 14};${GROUND - 40};${GROUND - 14}`} dur="6s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* inner rim shading at the bottom */}
          <path
            d={`M ${CX - R * 1.1} ${GROUND - 4} Q ${CX} ${GROUND + 16} ${CX + R * 1.1} ${GROUND - 4}`}
            stroke="var(--blob-deep)"
            strokeWidth={10}
            fill="none"
            opacity={0.35}
          />
          {/* glossy rim light along the upper-left edge */}
          <use href={`#${bodyId}`} fill="none" stroke={`url(#${rimLight})`} strokeWidth={6} opacity={0.75} />
        </g>

        {/* glossy highlight */}
        <ellipse
          cx={CX - 26}
          cy={BODY_Y - 38}
          rx={17}
          ry={8.5}
          transform={`rotate(-28 ${CX - 26} ${BODY_Y - 38})`}
          fill={`url(#${shine})`}
          opacity={0.85}
        />
        <circle cx={CX - 4} cy={BODY_Y - 49} r={3.2} fill="#fff" opacity={0.75} />

        <g ref={faceRef}>
          <Face mood={shownMood} talking={talking} glasses={accessory === "glasses"} eyesRef={eyesRef} mouthRef={mouthRef} />
        </g>

        {accessory === "cap" && (
          <g ref={capRef}>
            <GradCap tasselRef={tasselRef} />
          </g>
        )}
        {accessory === "beret" && (
          <g ref={capRef}>
            <Beret />
          </g>
        )}
      </g>

      {intro &&
        INTRO_DROPS.map((d, i) => (
          <circle
            key={i}
            ref={(el) => {
              dropRefs.current[i] = el;
            }}
            cx={CX + d.dx}
            cy={-150}
            r={0}
            fill={`url(#${gradient})`}
          />
        ))}
      </g>

      {!forming && <MoodExtras mood={shownMood} />}
    </svg>
  );
}

function Arm({ gradient }: { gradient: string }) {
  return (
    <>
      <ellipse cx={ARM_X + 15} cy={ARM_Y} rx={18} ry={9.5} fill={`url(#${gradient})`} />
      <ellipse cx={ARM_X + 21} cy={ARM_Y - 3.6} rx={6.5} ry={2.2} fill="#fff" opacity={0.35} />
    </>
  );
}

/** A French béret, worn at an angle (the French course). */
/** Navy felt, with a faint light edge so it still shows on dark backgrounds. */
const BERET = "#262b48";

function Beret() {
  return (
    <g transform={`rotate(-13 ${CX} 58)`}>
      {/* The soft rim that sits on the head. */}
      <path d={`M ${CX - 31} 62 Q ${CX} 71 ${CX + 33} 61 L ${CX + 31} 66 Q ${CX} 76 ${CX - 29} 67 Z`} fill={BERET} />
      {/* The puffy top, a little to one side. */}
      <ellipse cx={CX + 5} cy={54} rx={43} ry={14.5} fill={BERET} stroke="#fff" strokeOpacity={0.2} strokeWidth={1.4} />
      <ellipse cx={CX - 8} cy={48.5} rx={21} ry={4.6} fill="#fff" opacity={0.16} />
      {/* The little stalk on top. */}
      <path d={`M ${CX + 7} 41 q 1.5 -5.5 6.5 -7`} stroke={BERET} strokeWidth={4.2} strokeLinecap="round" fill="none" />
    </g>
  );
}

function GradCap({ tasselRef }: { tasselRef: Ref<SVGGElement> }) {
  // Mortarboard tilted a little to one side, sitting on top of the head.
  return (
    <g transform={`rotate(-9 ${CX} 60)`}>
      <path d={`M ${CX - 22} 61 Q ${CX - 22} 74 ${CX} 75 Q ${CX + 22} 74 ${CX + 22} 61 Z`} fill={INK} />
      <path d={`M ${CX - 44} 56 L ${CX} 42 L ${CX + 44} 56 L ${CX} 70 Z`} fill={INK} />
      <path d={`M ${CX - 44} 56 L ${CX} 42 L ${CX + 44} 56`} stroke="#fff" strokeOpacity={0.18} strokeWidth={1.5} fill="none" />
      <circle cx={CX} cy={56} r={2.6} fill="var(--blob-light)" />
      <g ref={tasselRef}>
        <path d={`M ${CX} 56 L ${CX + 40} 54 L ${CX + 40} 74`} stroke="var(--blob-light)" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d={`M ${CX + 36} 72 L ${CX + 44} 72 L ${CX + 45} 84 L ${CX + 35} 84 Z`} fill="var(--blob-light)" />
      </g>
    </g>
  );
}

function Face({
  mood,
  talking,
  glasses,
  eyesRef,
  mouthRef,
}: {
  mood: BlobMood;
  talking: boolean;
  glasses: boolean;
  eyesRef: Ref<SVGGElement>;
  mouthRef: Ref<SVGPathElement>;
}) {
  const ex = 22;
  const ey = FACE_Y;
  const my = MOUTH_Y;

  const openEye = (x: number, scale = 1) => (
    <g key={x}>
      <ellipse cx={x} cy={ey} rx={7.4 * scale} ry={9.6 * scale} fill={INK} />
      <circle cx={x + 2.6 * scale} cy={ey - 3.4 * scale} r={2.8 * scale} fill="#fff" />
      <circle cx={x - 2.2 * scale} cy={ey + 3.6 * scale} r={1.1 * scale} fill="#fff" opacity={0.7} />
    </g>
  );

  let eyes: React.ReactNode;
  switch (mood) {
    case "excited":
      eyes = (
        <g stroke={INK} strokeWidth={4.6} strokeLinecap="round" fill="none">
          <path d={`M ${CX - ex - 8} ${ey + 3} Q ${CX - ex} ${ey - 8} ${CX - ex + 8} ${ey + 3}`} />
          <path d={`M ${CX + ex - 8} ${ey + 3} Q ${CX + ex} ${ey - 8} ${CX + ex + 8} ${ey + 3}`} />
        </g>
      );
      break;
    case "happy":
      eyes = (
        <>
          {openEye(CX - ex, 1.06)}
          {openEye(CX + ex, 1.06)}
        </>
      );
      break;
    case "sleepy":
      eyes = (
        <g stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M ${CX - ex - 7} ${ey + 1} Q ${CX - ex} ${ey + 6} ${CX - ex + 7} ${ey + 1}`} />
          <path d={`M ${CX + ex - 7} ${ey + 1} Q ${CX + ex} ${ey + 6} ${CX + ex + 7} ${ey + 1}`} />
        </g>
      );
      break;
    case "shy":
      eyes = (
        <g stroke={INK} strokeWidth={4.4} strokeLinecap="round" fill="none">
          <path d={`M ${CX - ex - 7} ${ey + 2} L ${CX - ex + 6} ${ey - 1}`} />
          <path d={`M ${CX + ex - 6} ${ey - 1} L ${CX + ex + 7} ${ey + 2}`} />
        </g>
      );
      break;
    case "love":
      eyes = (
        <g fill="#ff4d7e" stroke={INK} strokeWidth={1.4}>
          {[CX - ex, CX + ex].map((x) => (
            <path
              key={x}
              d={`M ${x} ${ey + 8} C ${x - 14} ${ey - 2} ${x - 7} ${ey - 13} ${x} ${ey - 5} C ${x + 7} ${ey - 13} ${x + 14} ${ey - 2} ${x} ${ey + 8} Z`}
            />
          ))}
        </g>
      );
      break;
    case "surprised":
      eyes = (
        <>
          {openEye(CX - ex, 1.24)}
          {openEye(CX + ex, 1.24)}
        </>
      );
      break;
    default:
      eyes = (
        <>
          {openEye(CX - ex)}
          {openEye(CX + ex)}
        </>
      );
  }

  let mouth: React.ReactNode;
  if (talking) {
    mouth = (
      <g>
        <path ref={mouthRef} d={mouthPath(0)} fill={INK} />
      </g>
    );
  } else {
    switch (mood) {
      case "happy":
      case "love":
        mouth = <path d={`M ${CX - 11} ${my - 2} Q ${CX} ${my + 13} ${CX + 11} ${my - 2} Q ${CX} ${my + 3} ${CX - 11} ${my - 2} Z`} fill={INK} />;
        break;
      case "excited":
        mouth = (
          <g>
            <path d={`M ${CX - 13} ${my - 3} Q ${CX} ${my + 18} ${CX + 13} ${my - 3} Z`} fill={INK} />
            <path d={`M ${CX - 6} ${my + 6} Q ${CX} ${my + 1} ${CX + 6} ${my + 6} Q ${CX} ${my + 11} ${CX - 6} ${my + 6} Z`} fill="#ff8fb0" />
          </g>
        );
        break;
      case "thinking":
        mouth = <path d={`M ${CX - 6} ${my + 2} Q ${CX + 1} ${my - 1} ${CX + 8} ${my - 3}`} stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none" />;
        break;
      case "sleepy":
        mouth = <ellipse cx={CX + 2} cy={my + 2} rx={3.4} ry={4} fill={INK} />;
        break;
      case "worried":
        mouth = (
          <path
            d={`M ${CX - 10} ${my + 4} Q ${CX - 5} ${my - 1} ${CX} ${my + 3} Q ${CX + 5} ${my + 7} ${CX + 10} ${my + 2}`}
            stroke={INK}
            strokeWidth={3.4}
            strokeLinecap="round"
            fill="none"
          />
        );
        break;
      case "surprised":
        mouth = <ellipse cx={CX} cy={my + 3} rx={5.5} ry={7} fill={INK} />;
        break;
      case "shy":
        mouth = <path d={`M ${CX - 5} ${my} Q ${CX} ${my + 4} ${CX + 5} ${my}`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
        break;
      default:
        mouth = <path d={`M ${CX - 9} ${my} Q ${CX} ${my + 8} ${CX + 9} ${my}`} stroke={INK} strokeWidth={3.8} strokeLinecap="round" fill="none" />;
    }
  }

  const blush = mood === "shy" || mood === "love" ? 0.6 : mood === "happy" || mood === "excited" ? 0.45 : 0.3;

  return (
    <>
      <g fill="#ff5c8a" opacity={blush}>
        <ellipse cx={CX - 37} cy={ey + 14} rx={8} ry={4.6} />
        <ellipse cx={CX + 37} cy={ey + 14} rx={8} ry={4.6} />
      </g>
      {mood === "worried" && (
        <g stroke={INK} strokeWidth={3.4} strokeLinecap="round">
          <path d={`M ${CX - ex - 8} ${ey - 15} L ${CX - ex + 6} ${ey - 19}`} />
          <path d={`M ${CX + ex - 6} ${ey - 19} L ${CX + ex + 8} ${ey - 15}`} />
        </g>
      )}
      {mood === "thinking" && (
        <path d={`M ${CX + ex - 8} ${ey - 17} Q ${CX + ex} ${ey - 21} ${CX + ex + 8} ${ey - 16}`} stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}
      <g ref={eyesRef}>{eyes}</g>
      {mouth}
      {glasses && (
        <g>
          {[CX - ex, CX + ex].map((x) => (
            <g key={x}>
              <circle cx={x} cy={ey} r={14} fill="#fff" fillOpacity={0.14} stroke={INK} strokeWidth={3} />
              <path d={`M ${x - 7} ${ey - 7} L ${x - 2} ${ey - 10}`} stroke="#fff" strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" />
            </g>
          ))}
          <path d={`M ${CX - ex + 14} ${ey - 2} Q ${CX} ${ey - 7} ${CX + ex - 14} ${ey - 2}`} stroke={INK} strokeWidth={3} fill="none" />
          <path d={`M ${CX - ex - 14} ${ey - 3} L ${CX - ex - 26} ${ey - 6}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${CX + ex + 14} ${ey - 3} L ${CX + ex + 26} ${ey - 6}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
    </>
  );
}

function MoodExtras({ mood }: { mood: BlobMood }) {
  if (mood === "sleepy") {
    return (
      <g fontFamily="var(--font-display)" fontWeight={700} fill="var(--ink-3)">
        {[0, 1, 2].map((i) => (
          <text key={i} x={150 + i * 9} y={60 - i * 12} fontSize={12 + i * 4} opacity={0}>
            z
            <animate attributeName="opacity" values="0;0.9;0" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 8;6 -10" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
          </text>
        ))}
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g fill="var(--ink-3)">
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={148 + i * 12} cy={52} r={4}>
            <animate attributeName="cy" values="52;44;52" dur="1.1s" begin={`${i * 0.16}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;1;0.35" dur="1.1s" begin={`${i * 0.16}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
    );
  }
  if (mood === "worried") {
    return (
      <path d="M 156 58 C 151 68 150 74 156 77 C 162 74 161 68 156 58 Z" fill="#9fd0ff" stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1.2}>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 5;0 0" dur="1.8s" repeatCount="indefinite" />
      </path>
    );
  }
  if (mood === "love") {
    return (
      <g fill="#ff4d7e">
        {[
          [44, 58, 0],
          [158, 50, 0.7],
        ].map(([x, y, delay]) => (
          <path key={x} d={`M ${x} ${y + 6} C ${x - 9} ${y} ${x - 5} ${y - 7} ${x} ${y - 2} C ${x + 5} ${y - 7} ${x + 9} ${y} ${x} ${y + 6} Z`} opacity={0}>
            <animate attributeName="opacity" values="0;1;0" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 6;0 -12" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>
    );
  }
  if (mood === "excited") {
    return (
      <g fill="var(--blob)">
        {[
          [40, 52, 0],
          [162, 44, 0.5],
          [150, 88, 1],
        ].map(([x, y, delay]) => (
          <path
            key={`${x}-${y}`}
            d={`M ${x} ${y - 7} L ${x + 2} ${y - 2} L ${x + 7} ${y} L ${x + 2} ${y + 2} L ${x} ${y + 7} L ${x - 2} ${y + 2} L ${x - 7} ${y} L ${x - 2} ${y - 2} Z`}
            opacity={0}
          >
            <animate attributeName="opacity" values="0;1;0" dur="1.6s" begin={`${delay}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>
    );
  }
  return null;
}
