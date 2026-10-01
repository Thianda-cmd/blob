"use client";

import { useEffect, useId, useImperativeHandle, useRef, type Ref } from "react";
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

export type BlobHandle = {
  /** Hop. `power` 0..1.5 */
  jump: (power?: number) => void;
  /** Squash down like it was pressed. */
  squish: (amount?: number) => void;
  /** Jiggle the jelly from a direction (radians). */
  poke: (angle?: number, strength?: number) => void;
  /** Shake side to side (errors). */
  shake: () => void;
};

type BlobProps = {
  size?: number;
  mood?: BlobMood;
  /** Follow the mouse pointer with the eyes. */
  track?: boolean;
  /** Fixed gaze in -1..1, overrides tracking. */
  look?: { x: number; y: number } | null;
  className?: string;
  title?: string;
  onClick?: () => void;
  ref?: Ref<BlobHandle>;
};

// Geometry (viewBox 0 0 200 200)
const N = 12;
const CX = 100;
const R = 62;
const GROUND = 172;
const BOTTOM = R * 0.8;
const FACE_Y = GROUND - BOTTOM - 4;

// One shared pointer listener for every blob on the page.
const pointer = { x: 0, y: 0, seen: false };
let pointerUsers = 0;
function onPointerMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.seen = true;
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

export function Blob({
  size = 120,
  mood = "idle",
  track = true,
  look = null,
  className,
  title,
  onClick,
  ref,
}: BlobProps) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const clipRef = useRef<SVGPathElement>(null);
  const jellyRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
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
    nextBlink: 0,
    blinkUntil: 0,
    nextHop: 0,
  });
  const moodRef = useRef(mood);
  const lookRef = useRef(look);
  const trackRef = useRef(track);

  useEffect(() => {
    moodRef.current = mood;
    lookRef.current = look;
    trackRef.current = track;
  }, [mood, look, track]);

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
        const near = Math.cos(a - angle);
        st.voff[i] -= Math.max(0, near) * 1.6 * strength;
      }
      st.vs -= 0.9 * strength;
    },
    shake() {
      sim.current.vx += 520;
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

      if ((frame++ & 15) === 0) rect = svg!.getBoundingClientRect();

      if (!reduce) {
        // Excited blobs hop on their own.
        if (tune.hop && now > st.nextHop && st.y >= 0 && st.vy === 0) {
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

        // Squash & stretch spring. Airborne → stretch with velocity.
        const airborne = st.y < -0.5;
        const breathe = Math.sin(t * (currentMood === "sleepy" ? 1.3 : 2.1)) * tune.breathe;
        const target = airborne ? Math.max(-0.12, Math.min(0.16, -st.vy / 4200)) : breathe;
        st.vs += (-340 * (st.s - target) - 11 * st.vs) * dt;
        st.s += st.vs * dt;
        st.s = Math.max(-0.42, Math.min(0.4, st.s));

        // Horizontal shake spring.
        st.vx += (-900 * st.x - 14 * st.vx) * dt;
        st.x += st.vx * dt;

        // Jelly membrane: springs coupled to their neighbours make waves.
        for (let i = 0; i < N; i++) {
          const l = st.off[(i - 1 + N) % N];
          const r = st.off[(i + 1) % N];
          const a = -260 * st.off[i] - 6.5 * st.voff[i] + 140 * (l + r - 2 * st.off[i]);
          st.voff[i] += a * dt;
        }
        for (let i = 0; i < N; i++) st.off[i] = Math.max(-0.3, Math.min(0.3, st.off[i] + st.voff[i] * dt));
      }

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
        ys[i] = GROUND - BOTTOM + sin * r * (bottomHalf ? 0.8 : 1);
      }
      const d = smoothPath(xs, ys);
      bodyRef.current?.setAttribute("d", d);
      clipRef.current?.setAttribute("d", d);

      const sx = 1 - st.s * 0.62;
      const sy = 1 + st.s;
      jellyRef.current?.setAttribute(
        "transform",
        `translate(${(CX + st.x).toFixed(2)} ${(GROUND + st.y).toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-CX} ${-GROUND})`,
      );

      // Gaze.
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
      } else if (trackRef.current && pointer.seen) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.55;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy);
        const k = 1 / (dist + 160);
        gx = Math.max(-1, Math.min(1, dx * k * 1.25));
        gy = Math.max(-1, Math.min(1, dy * k * 1.25));
      }
      const ease = Math.min(1, dt * 9);
      st.lookX += (gx - st.lookX) * ease;
      st.lookY += (gy - st.lookY) * ease;
      faceRef.current?.setAttribute(
        "transform",
        `translate(${(st.lookX * 11).toFixed(2)} ${(st.lookY * 7).toFixed(2)})`,
      );

      // Blinking.
      if (now > st.nextBlink) {
        st.blinkUntil = now + 130;
        st.nextBlink = now + 2200 + Math.random() * 3800;
        if (Math.random() < 0.18) st.nextBlink = now + 260; // double blink
      }
      const blink = now < st.blinkUntil ? 0.1 : 1;
      eyesRef.current?.setAttribute(
        "transform",
        `translate(0 ${FACE_Y}) scale(1 ${blink}) translate(0 ${-FACE_Y})`,
      );

      // Ground shadow shrinks while airborne.
      const lift = Math.min(1, -st.y / 140);
      const shadow = shadowRef.current;
      if (shadow) {
        shadow.setAttribute("rx", (R * 1.02 * sx * (1 - lift * 0.45)).toFixed(2));
        shadow.setAttribute("opacity", (0.16 * (1 - lift * 0.6)).toFixed(3));
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
  }, []);

  function handlePointerEnter() {
    const st = sim.current;
    for (let i = 0; i < N; i++) st.voff[i] += (Math.random() - 0.5) * 0.9;
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(
      e.clientY - (rect.top + rect.height * 0.55),
      e.clientX - (rect.left + rect.width / 2),
    );
    const st = sim.current;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      st.voff[i] -= Math.max(0, Math.cos(a - angle)) * 1.4;
    }
    st.vs -= 1.4;
    onClick?.();
  }

  const gradient = `blob-grad-${id}`;
  const shine = `blob-shine-${id}`;
  const clip = `blob-clip-${id}`;
  const rim = `blob-rim-${id}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("select-none overflow-visible", onClick && "cursor-pointer", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      onPointerEnter={handlePointerEnter}
      onClick={handleClick}
    >
      <defs>
        <radialGradient id={gradient} cx="36%" cy="28%" r="78%">
          <stop offset="0%" style={{ stopColor: "var(--blob-light)" }} />
          <stop offset="42%" style={{ stopColor: "var(--blob)" }} />
          <stop offset="100%" style={{ stopColor: "var(--blob-deep)" }} />
        </radialGradient>
        <radialGradient id={rim} cx="50%" cy="92%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        <clipPath id={clip}>
          <path ref={clipRef} />
        </clipPath>
      </defs>

      <ellipse ref={shadowRef} cx={CX} cy={GROUND + 3} rx={R} ry={7} fill="var(--ink)" opacity={0.16} />

      <g ref={jellyRef}>
        <path ref={bodyRef} fill={`url(#${gradient})`} />

        <g clipPath={`url(#${clip})`}>
          {/* translucent glow at the base, like light passing through jelly */}
          <ellipse cx={CX} cy={GROUND - 10} rx={R * 0.95} ry={R * 0.5} fill={`url(#${rim})`} />
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
          {/* inner rim shading */}
          <path
            d={`M ${CX - R * 1.1} ${GROUND - 4} Q ${CX} ${GROUND + 16} ${CX + R * 1.1} ${GROUND - 4}`}
            stroke="var(--blob-deep)"
            strokeWidth={10}
            fill="none"
            opacity={0.35}
          />
        </g>

        {/* glossy highlight */}
        <ellipse
          cx={CX - 26}
          cy={GROUND - BOTTOM - 38}
          rx={17}
          ry={8.5}
          transform={`rotate(-28 ${CX - 26} ${GROUND - BOTTOM - 38})`}
          fill={`url(#${shine})`}
          opacity={0.85}
        />
        <circle cx={CX - 4} cy={GROUND - BOTTOM - 49} r={3.2} fill="#fff" opacity={0.75} />

        <g ref={faceRef}>
          <Face mood={mood} eyesRef={eyesRef} />
        </g>
      </g>

      <MoodExtras mood={mood} />
    </svg>
  );
}

function Face({ mood, eyesRef }: { mood: BlobMood; eyesRef: Ref<SVGGElement> }) {
  const ink = "#2a1a12";
  const ex = 22;
  const ey = FACE_Y;
  const my = FACE_Y + 20;

  const openEye = (x: number, scale = 1) => (
    <g key={x}>
      <ellipse cx={x} cy={ey} rx={7.4 * scale} ry={9.6 * scale} fill={ink} />
      <circle cx={x + 2.6 * scale} cy={ey - 3.4 * scale} r={2.7 * scale} fill="#fff" />
      <circle cx={x - 2.2 * scale} cy={ey + 3.6 * scale} r={1.1 * scale} fill="#fff" opacity={0.7} />
    </g>
  );

  let eyes: React.ReactNode;
  switch (mood) {
    case "excited":
    case "happy":
      eyes =
        mood === "excited" ? (
          <g stroke={ink} strokeWidth={4.6} strokeLinecap="round" fill="none">
            <path d={`M ${CX - ex - 8} ${ey + 3} Q ${CX - ex} ${ey - 8} ${CX - ex + 8} ${ey + 3}`} />
            <path d={`M ${CX + ex - 8} ${ey + 3} Q ${CX + ex} ${ey - 8} ${CX + ex + 8} ${ey + 3}`} />
          </g>
        ) : (
          <>
            {openEye(CX - ex, 1.04)}
            {openEye(CX + ex, 1.04)}
          </>
        );
      break;
    case "sleepy":
      eyes = (
        <g stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M ${CX - ex - 7} ${ey + 1} Q ${CX - ex} ${ey + 6} ${CX - ex + 7} ${ey + 1}`} />
          <path d={`M ${CX + ex - 7} ${ey + 1} Q ${CX + ex} ${ey + 6} ${CX + ex + 7} ${ey + 1}`} />
        </g>
      );
      break;
    case "shy":
      eyes = (
        <g stroke={ink} strokeWidth={4.4} strokeLinecap="round" fill="none">
          <path d={`M ${CX - ex - 7} ${ey + 2} L ${CX - ex + 6} ${ey - 1}`} />
          <path d={`M ${CX + ex - 6} ${ey - 1} L ${CX + ex + 7} ${ey + 2}`} />
        </g>
      );
      break;
    case "love":
      eyes = (
        <g fill="var(--blob-deep)" stroke={ink} strokeWidth={1.2}>
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
          {openEye(CX - ex, 1.22)}
          {openEye(CX + ex, 1.22)}
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
  switch (mood) {
    case "happy":
    case "love":
      mouth = (
        <path
          d={`M ${CX - 11} ${my - 2} Q ${CX} ${my + 13} ${CX + 11} ${my - 2} Q ${CX} ${my + 3} ${CX - 11} ${my - 2} Z`}
          fill={ink}
        />
      );
      break;
    case "excited":
      mouth = (
        <g>
          <path
            d={`M ${CX - 13} ${my - 3} Q ${CX} ${my + 18} ${CX + 13} ${my - 3} Z`}
            fill={ink}
          />
          <path d={`M ${CX - 6} ${my + 6} Q ${CX} ${my + 1} ${CX + 6} ${my + 6} Q ${CX} ${my + 11} ${CX - 6} ${my + 6} Z`} fill="#ff8f8f" />
        </g>
      );
      break;
    case "thinking":
      mouth = <path d={`M ${CX - 6} ${my + 2} Q ${CX + 1} ${my - 1} ${CX + 8} ${my - 3}`} stroke={ink} strokeWidth={3.6} strokeLinecap="round" fill="none" />;
      break;
    case "sleepy":
      mouth = <ellipse cx={CX + 2} cy={my + 2} rx={3.4} ry={4} fill={ink} />;
      break;
    case "worried":
      mouth = (
        <path
          d={`M ${CX - 10} ${my + 4} Q ${CX - 5} ${my - 1} ${CX} ${my + 3} Q ${CX + 5} ${my + 7} ${CX + 10} ${my + 2}`}
          stroke={ink}
          strokeWidth={3.4}
          strokeLinecap="round"
          fill="none"
        />
      );
      break;
    case "surprised":
      mouth = <ellipse cx={CX} cy={my + 3} rx={5.5} ry={7} fill={ink} />;
      break;
    case "shy":
      mouth = <path d={`M ${CX - 5} ${my} Q ${CX} ${my + 4} ${CX + 5} ${my}`} stroke={ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
      break;
    default:
      mouth = <path d={`M ${CX - 9} ${my} Q ${CX} ${my + 8} ${CX + 9} ${my}`} stroke={ink} strokeWidth={3.8} strokeLinecap="round" fill="none" />;
  }

  const blush = mood === "shy" || mood === "love" ? 0.55 : mood === "happy" || mood === "excited" ? 0.4 : 0.26;

  return (
    <>
      <g fill="#ff4f6d" opacity={blush}>
        <ellipse cx={CX - 37} cy={ey + 14} rx={8} ry={4.6} />
        <ellipse cx={CX + 37} cy={ey + 14} rx={8} ry={4.6} />
      </g>
      {mood === "worried" && (
        <g stroke={ink} strokeWidth={3.4} strokeLinecap="round">
          <path d={`M ${CX - ex - 8} ${ey - 15} L ${CX - ex + 6} ${ey - 19}`} />
          <path d={`M ${CX + ex - 6} ${ey - 19} L ${CX + ex + 8} ${ey - 15}`} />
        </g>
      )}
      <g ref={eyesRef}>{eyes}</g>
      {mouth}
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
  if (mood === "love" || mood === "excited") {
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
