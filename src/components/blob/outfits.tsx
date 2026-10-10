import type { Ref } from "react";
import { CX, EYE_X, FACE_Y, INK } from "./geometry";
import type { BlobEyes, BlobHat, BlobNeck } from "./look";

// Blob's wardrobe, drawn in his 200 × 200 viewBox. The top of the head is at about y = 60; hats sit
// on it and ride along with the jelly. Parts that swing (tassels, pompoms) go in `swingRef`, which
// Blob's physics rotates around SWING_PIVOT.

/** Where a hat's swinging part hangs from. */
export const SWING_PIVOT: Partial<Record<BlobHat, [number, number]>> = {
  cap: [CX + 40, 54],
  // The nightcap is the Santa hat mirrored; inside the mirror its pompom hangs from the same point.
  santa: [CX + 31, 44],
  nightcap: [CX + 31, 44],
};

const GOLD = "#f6c431";
const GOLD_DEEP = "#c8920c";

/** A 5-pointed star. */
function star(x: number, y: number, outer: number, inner: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? "L" : "M"} ${(x + Math.cos(a) * r).toFixed(2)} ${(y + Math.sin(a) * r).toFixed(2)} `;
  }
  return `${d}Z`;
}

export function Hat({ hat, id, swingRef }: { hat: BlobHat; id: string; swingRef: Ref<SVGGElement> }) {
  switch (hat) {
    case "cap":
      return <GradCap swingRef={swingRef} />;
    case "beret":
      return <Beret />;
    case "party": {
      const cone = `M ${CX - 23} 68 L ${CX} 14 L ${CX + 23} 68 Q ${CX} 75 ${CX - 23} 68 Z`;
      return (
        <g transform={`rotate(-14 ${CX} 64)`}>
          <clipPath id={`${id}-cone`}>
            <path d={cone} />
          </clipPath>
          <path d={cone} fill="#ff6fae" />
          <g clipPath={`url(#${id}-cone)`} strokeLinecap="round">
            <path d={`M ${CX - 30} 64 L ${CX + 30} 50`} stroke="#ffd23f" strokeWidth={6} />
            <path d={`M ${CX - 30} 46 L ${CX + 30} 32`} stroke="#ffd23f" strokeWidth={5} />
            <path d={`M ${CX - 30} 29 L ${CX + 30} 15`} stroke="#ffd23f" strokeWidth={4} />
            <circle cx={CX - 8} cy={56} r={2.2} fill="#6fd3ff" />
            <circle cx={CX + 9} cy={40} r={2} fill="#6fd3ff" />
            <circle cx={CX - 3} cy={26} r={1.8} fill="#6fd3ff" />
            <path d={`M ${CX - 14} 66 L ${CX - 2} 18`} stroke="#fff" strokeOpacity={0.3} strokeWidth={3} />
          </g>
          <circle cx={CX} cy={13} r={6.8} fill="#ffd23f" />
          <circle cx={CX - 2} cy={11} r={2.2} fill="#fff" opacity={0.7} />
        </g>
      );
    }
    case "crown":
      return (
        <g transform={`rotate(-7 ${CX} 62)`}>
          <path
            d={`M ${CX - 29} 68 L ${CX - 31} 40 L ${CX - 15} 54 L ${CX} 33 L ${CX + 15} 54 L ${CX + 31} 40 L ${CX + 29} 68 Q ${CX} 73 ${CX - 29} 68 Z`}
            fill={GOLD}
            stroke={GOLD_DEEP}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path d={`M ${CX - 29.5} 60 Q ${CX} 65 ${CX + 29.5} 60`} stroke={GOLD_DEEP} strokeWidth={1.6} fill="none" />
          {[
            [CX - 31, 40],
            [CX, 33],
            [CX + 31, 40],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={3.4} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1.6} />
          ))}
          <circle cx={CX} cy={63} r={3.8} fill="#e5384f" stroke="#a51d31" strokeWidth={1} />
          <circle cx={CX - 17} cy={61.5} r={2.7} fill="#3f8cff" stroke="#2058b8" strokeWidth={1} />
          <circle cx={CX + 17} cy={61.5} r={2.7} fill="#3fcf9a" stroke="#1c8a63" strokeWidth={1} />
          <path d={`M ${CX - 24} 58 L ${CX - 25} 44`} stroke="#fff" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      );
    case "tophat":
      return (
        <g transform={`rotate(-8 ${CX} 64)`}>
          <ellipse cx={CX} cy={66} rx={37} ry={7.5} fill="#1f1d29" />
          <path d={`M ${CX - 23} 66 L ${CX - 21} 24 Q ${CX} 19 ${CX + 21} 24 L ${CX + 23} 66 Z`} fill="#2c2938" />
          <ellipse cx={CX} cy={24} rx={21} ry={4.6} fill="#3d394d" />
          <path d={`M ${CX - 22.6} 56 L ${CX + 22.6} 56 L ${CX + 23} 66 Q ${CX} 70 ${CX - 23} 66 Z`} fill="#7c4dff" />
          <rect x={CX - 16} y={28} width={4} height={24} rx={2} fill="#fff" opacity={0.14} />
        </g>
      );
    case "wizard":
      return (
        <g transform={`rotate(-10 ${CX} 64)`}>
          <ellipse cx={CX} cy={67} rx={40} ry={7} fill="#272b74" />
          <path d={`M ${CX - 26} 66 Q ${CX - 12} 40 ${CX + 2} 10 Q ${CX + 9} 0 ${CX + 24} 5 Q ${CX + 11} 12 ${CX + 11} 26 Q ${CX + 15} 48 ${CX + 26} 66 Z`} fill="#373e9e" />
          <path d={`M ${CX - 25} 62 Q ${CX} 67 ${CX + 25} 62`} stroke="#ffd84d" strokeWidth={3} fill="none" />
          <g fill="#ffd84d">
            <path d={star(CX - 7, 46, 5.2, 2.3)} />
            <path d={star(CX + 7, 30, 3.8, 1.7)} />
            <circle cx={CX + 9} cy={52} r={1.8} />
            <circle cx={CX - 4} cy={28} r={1.4} />
          </g>
        </g>
      );
    case "witch":
      return (
        <g transform={`rotate(-8 ${CX} 64)`}>
          <ellipse cx={CX} cy={67} rx={47} ry={8} fill="#211e2b" />
          <path d={`M ${CX - 22} 66 L ${CX + 1} 16 Q ${CX + 6} 7 ${CX + 21} 10 Q ${CX + 12} 16 ${CX + 12} 30 L ${CX + 22} 66 Z`} fill="#2f2b3d" />
          <path d={`M ${CX - 20.5} 57 L ${CX + 20.5} 57 L ${CX + 22} 66 L ${CX - 22} 66 Z`} fill="#8a4dff" />
          <rect x={CX - 5.5} y={56} width={11} height={10} rx={1.5} fill="none" stroke="#ffd84d" strokeWidth={2.2} />
          <path d={star(CX + 8, 38, 3.6, 1.6)} fill="#ff9f43" />
        </g>
      );
    case "santa":
      return <FloppyCap mirror={false} body="#e0283f" shade="#b81b30" trim="#fff" pom="#fff" swingRef={swingRef} />;
    case "nightcap":
      return <FloppyCap mirror body="#5b78e6" shade="#3e57b8" trim="#dfe6ff" pom="#ffd84d" stars swingRef={swingRef} />;
    case "chef":
      return (
        <g>
          {[
            [CX - 17, 41, 14],
            [CX + 17, 41, 14],
            [CX, 33, 17],
          ].map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill="#fff" stroke="#d3d7e2" strokeWidth={1.6} />
          ))}
          <path d={`M ${CX - 24} 68 L ${CX - 23} 48 L ${CX + 23} 48 L ${CX + 24} 68 Q ${CX} 73 ${CX - 24} 68 Z`} fill="#fff" stroke="#d3d7e2" strokeWidth={1.6} />
          <g stroke="#e2e5ee" strokeWidth={1.6} strokeLinecap="round">
            <path d={`M ${CX - 11} 53 L ${CX - 11} 66`} />
            <path d={`M ${CX} 53 L ${CX} 68`} />
            <path d={`M ${CX + 11} 53 L ${CX + 11} 66`} />
          </g>
        </g>
      );
    case "viking":
      return (
        <g>
          {[1, -1].map((side) => (
            <path
              key={side}
              transform={side === -1 ? `translate(${CX * 2} 0) scale(-1 1)` : undefined}
              d={`M ${CX - 25} 58 Q ${CX - 47} 56 ${CX - 53} 28 Q ${CX - 40} 44 ${CX - 24} 47 Z`}
              fill="#f3e8cc"
              stroke="#c9b98e"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ))}
          <path d={`M ${CX - 31} 68 Q ${CX - 31} 33 ${CX} 33 Q ${CX + 31} 33 ${CX + 31} 68 Z`} fill="#9aa4b8" />
          <path d={`M ${CX - 20} 60 Q ${CX - 20} 42 ${CX - 6} 38`} stroke="#fff" strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" fill="none" />
          <path d={`M ${CX - 33} 63 Q ${CX} 69 ${CX + 33} 63 L ${CX + 33} 70 Q ${CX} 76 ${CX - 33} 70 Z`} fill="#7a5a3a" />
          {[-22, -8, 8, 22].map((dx) => (
            <circle key={dx} cx={CX + dx} cy={68 + Math.abs(dx) * -0.05} r={1.6} fill="#d8c08a" />
          ))}
        </g>
      );
    case "propeller": {
      const dome = `M ${CX - 28} 68 Q ${CX - 28} 38 ${CX} 38 Q ${CX + 28} 38 ${CX + 28} 68 Z`;
      return (
        <g transform={`rotate(-6 ${CX} 64)`}>
          <clipPath id={`${id}-dome`}>
            <path d={dome} />
          </clipPath>
          <g clipPath={`url(#${id}-dome)`}>
            <rect x={CX - 30} y={36} width={15} height={34} fill="#ff5a5f" />
            <rect x={CX - 15} y={36} width={15} height={34} fill="#ffd23f" />
            <rect x={CX} y={36} width={15} height={34} fill="#4aa3f5" />
            <rect x={CX + 15} y={36} width={15} height={34} fill="#3fcf9a" />
          </g>
          <path d={`M ${CX - 4} 66 Q ${CX + 20} 63 ${CX + 36} 70 Q ${CX + 18} 75 ${CX - 4} 71 Z`} fill="#ff5a5f" />
          <rect x={CX - 1.6} y={27} width={3.2} height={12} rx={1.5} fill="#3b3848" />
          <ellipse cx={CX} cy={27} rx={22} ry={3.4} fill="#e23d5b">
            <animate attributeName="rx" values="22;3;22" dur="0.3s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx={CX} cy={27} rx={3} ry={3.4} fill="#4aa3f5">
            <animate attributeName="rx" values="3;22;3" dur="0.3s" repeatCount="indefinite" />
          </ellipse>
          <circle cx={CX} cy={27} r={3} fill="#3b3848" />
        </g>
      );
    }
    case "halo":
      return (
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="3s" repeatCount="indefinite" />
          <ellipse cx={CX} cy={34} rx={27} ry={7} fill="none" stroke="#ffe27a" strokeWidth={11} opacity={0.28} />
          <ellipse cx={CX} cy={34} rx={27} ry={7} fill="none" stroke="#ffd447" strokeWidth={4.6} />
          <path d={`M ${CX - 18} 30.5 Q ${CX - 6} 27.6 ${CX + 6} 27.8`} stroke="#fff" strokeOpacity={0.75} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d={`M ${CX - 58} 100 C ${CX - 62} 38 ${CX + 62} 38 ${CX + 58} 100`} stroke="#2b2934" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d={`M ${CX - 40} 62 C ${CX - 22} 47 ${CX + 22} 47 ${CX + 40} 62`} stroke="#5a566a" strokeWidth={2} fill="none" strokeLinecap="round" />
          {[CX - 69, CX + 52].map((x) => (
            <g key={x}>
              <rect x={x} y={86} width={17} height={30} rx={7.5} fill="#ff5c8a" stroke="#2b2934" strokeWidth={2.6} />
              <rect x={x + 4} y={91} width={4} height={14} rx={2} fill="#fff" opacity={0.35} />
            </g>
          ))}
        </g>
      );
    case "flower": {
      const fx = CX + 27;
      const fy = 63;
      return (
        <g>
          <ellipse cx={fx - 11} cy={fy + 6} rx={7} ry={3.4} fill="#4fb36b" transform={`rotate(-25 ${fx - 11} ${fy + 6})`} />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
            return <circle key={i} cx={fx + Math.cos(a) * 7.5} cy={fy + Math.sin(a) * 7.5} r={6.2} fill="#ff8fc1" stroke="#e8609c" strokeWidth={1.2} />;
          })}
          <circle cx={fx} cy={fy} r={4.8} fill="#ffd23f" stroke="#e0a800" strokeWidth={1.2} />
        </g>
      );
    }
    case "bow": {
      const bx = CX - 25;
      const by = 63;
      return (
        <g transform={`rotate(-18 ${bx} ${by})`}>
          <path d={`M ${bx} ${by} C ${bx - 6} ${by - 14} ${bx - 22} ${by - 12} ${bx - 18} ${by + 1} C ${bx - 16} ${by + 10} ${bx - 6} ${by + 6} ${bx} ${by} Z`} fill="#ff4f8b" stroke="#c92566" strokeWidth={1.6} />
          <path d={`M ${bx} ${by} C ${bx + 6} ${by - 14} ${bx + 22} ${by - 12} ${bx + 18} ${by + 1} C ${bx + 16} ${by + 10} ${bx + 6} ${by + 6} ${bx} ${by} Z`} fill="#ff4f8b" stroke="#c92566" strokeWidth={1.6} />
          <circle cx={bx} cy={by} r={4} fill="#e8357a" stroke="#c92566" strokeWidth={1.4} />
          <path d={`M ${bx - 14} ${by - 5} Q ${bx - 10} ${by - 8} ${bx - 6} ${by - 5}`} stroke="#fff" strokeOpacity={0.6} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      );
    }
  }
}

/** A floppy cap whose tip and pompom flop to one side (Santa's hat, the nightcap). */
function FloppyCap({ mirror, body, shade, trim, pom, stars, swingRef }: { mirror: boolean; body: string; shade: string; trim: string; pom: string; stars?: boolean; swingRef: Ref<SVGGElement> }) {
  return (
    <g transform={mirror ? `translate(${CX * 2} 0) scale(-1 1)` : undefined}>
      <path d={`M ${CX - 28} 64 C ${CX - 26} 40 ${CX - 6} 25 ${CX + 12} 28 C ${CX + 24} 30 ${CX + 31} 36 ${CX + 35} 42 L ${CX + 27} 47 C ${CX + 23} 43 ${CX + 18} 41 ${CX + 14} 43 C ${CX + 20} 50 ${CX + 25} 57 ${CX + 28} 64 Z`} fill={body} />
      <path d={`M ${CX - 14} 60 C ${CX - 12} 46 ${CX - 2} 36 ${CX + 10} 34`} stroke={shade} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      {stars && (
        <g fill="#ffd84d">
          <path d={star(CX - 8, 50, 3.4, 1.5)} />
          <path d={star(CX + 8, 38, 2.6, 1.2)} />
        </g>
      )}
      <path d={`M ${CX - 32} 60 Q ${CX} 53 ${CX + 32} 60 L ${CX + 32} 69 Q ${CX} 62 ${CX - 32} 69 Z`} fill={trim} stroke={shade} strokeOpacity={0.25} strokeWidth={1.2} />
      <g ref={swingRef}>
        <circle cx={CX + 34} cy={49} r={6.8} fill={pom} stroke={shade} strokeOpacity={0.25} strokeWidth={1.2} />
      </g>
    </g>
  );
}

/** Mortarboard tilted a little to one side, sitting on top of the head (learning). */
function GradCap({ swingRef }: { swingRef: Ref<SVGGElement> }) {
  return (
    <g transform={`rotate(-9 ${CX} 60)`}>
      <path d={`M ${CX - 22} 61 Q ${CX - 22} 74 ${CX} 75 Q ${CX + 22} 74 ${CX + 22} 61 Z`} fill={INK} />
      <path d={`M ${CX - 44} 56 L ${CX} 42 L ${CX + 44} 56 L ${CX} 70 Z`} fill={INK} />
      <path d={`M ${CX - 44} 56 L ${CX} 42 L ${CX + 44} 56`} stroke="#fff" strokeOpacity={0.18} strokeWidth={1.5} fill="none" />
      <circle cx={CX} cy={56} r={2.6} fill="var(--blob-light)" />
      <g ref={swingRef}>
        <path d={`M ${CX} 56 L ${CX + 40} 54 L ${CX + 40} 74`} stroke="var(--blob-light)" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d={`M ${CX + 36} 72 L ${CX + 44} 72 L ${CX + 45} 84 L ${CX + 35} 84 Z`} fill="var(--blob-light)" />
      </g>
    </g>
  );
}

/** Navy felt, with a faint light edge so it still shows on dark backgrounds. */
const BERET = "#262b48";

/** A French béret, worn at an angle (the French course). */
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

/** Things on the eyes; drawn in the face, so they look where Blob looks. */
export function EyeWear({ eyes }: { eyes: BlobEyes }) {
  const ey = FACE_Y;
  const xs = [CX - EYE_X, CX + EYE_X];
  if (eyes === "glasses")
    return (
      <g>
        {xs.map((x) => (
          <g key={x}>
            <circle cx={x} cy={ey} r={14} fill="#fff" fillOpacity={0.14} stroke={INK} strokeWidth={3} />
            <path d={`M ${x - 7} ${ey - 7} L ${x - 2} ${ey - 10}`} stroke="#fff" strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" />
          </g>
        ))}
        <path d={`M ${CX - EYE_X + 14} ${ey - 2} Q ${CX} ${ey - 7} ${CX + EYE_X - 14} ${ey - 2}`} stroke={INK} strokeWidth={3} fill="none" />
        <path d={`M ${CX - EYE_X - 14} ${ey - 3} L ${CX - EYE_X - 26} ${ey - 6}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${CX + EYE_X + 14} ${ey - 3} L ${CX + EYE_X + 26} ${ey - 6}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  if (eyes === "sunglasses")
    return (
      <g>
        {xs.map((x) => (
          <g key={x}>
            <rect x={x - 15} y={ey - 10} width={30} height={20} rx={8} fill="#17161f" stroke="#17161f" strokeWidth={2.4} />
            <path d={`M ${x - 9} ${ey + 5} L ${x + 4} ${ey - 7}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
        <path d={`M ${CX - EYE_X + 15} ${ey - 4} Q ${CX} ${ey - 9} ${CX + EYE_X - 15} ${ey - 4}`} stroke="#17161f" strokeWidth={3.4} fill="none" />
        <path d={`M ${CX - EYE_X - 15} ${ey - 5} L ${CX - EYE_X - 27} ${ey - 8}`} stroke="#17161f" strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${CX + EYE_X + 15} ${ey - 5} L ${CX + EYE_X + 27} ${ey - 8}`} stroke="#17161f" strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  return (
    <g>
      {xs.map((x) => (
        <path key={x} d={star(x, ey + 1, 17, 8.2)} fill="#ffd23f" fillOpacity={0.3} stroke="#ff4fa3" strokeWidth={3.2} strokeLinejoin="round" />
      ))}
      <path d={`M ${CX - EYE_X + 13} ${ey - 3} Q ${CX} ${ey - 8} ${CX + EYE_X - 13} ${ey - 3}`} stroke="#ff4fa3" strokeWidth={3} fill="none" />
    </g>
  );
}

/** Things round the neck (on the lower body). `clip` is the body's outline, for the scarf. */
export function NeckWear({ neck, clip }: { neck: BlobNeck; clip: string }) {
  if (neck === "bowtie")
    return (
      <g>
        <path d={`M ${CX - 3} 158 L ${CX - 17} 150 Q ${CX - 21} 158 ${CX - 17} 166 Z`} fill="#e23d5b" stroke="#a81f39" strokeWidth={1.4} strokeLinejoin="round" />
        <path d={`M ${CX + 3} 158 L ${CX + 17} 150 Q ${CX + 21} 158 ${CX + 17} 166 Z`} fill="#e23d5b" stroke="#a81f39" strokeWidth={1.4} strokeLinejoin="round" />
        <rect x={CX - 4.5} y={153.5} width={9} height={9} rx={3} fill="#c42a46" />
        <path d={`M ${CX - 14} 154 L ${CX - 8} 157`} stroke="#fff" strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
  if (neck === "scarf")
    return (
      <g>
        <g clipPath={`url(#${clip})`}>
          <path d={`M ${CX - 72} 144 Q ${CX} 157 ${CX + 72} 144 L ${CX + 72} 158 Q ${CX} 171 ${CX - 72} 158 Z`} fill="#e23d5b" />
          <path d={`M ${CX - 72} 148.5 Q ${CX} 161.5 ${CX + 72} 148.5`} stroke="#fff" strokeOpacity={0.85} strokeWidth={2.2} fill="none" strokeDasharray="7 5" />
          <path d={`M ${CX - 72} 154 Q ${CX} 167 ${CX + 72} 154`} stroke="#fff" strokeOpacity={0.85} strokeWidth={2.2} fill="none" strokeDasharray="7 5" />
        </g>
        <path d={`M ${CX + 20} 160 L ${CX + 34} 160 L ${CX + 38} 178 L ${CX + 25} 178 Z`} fill="#d23250" />
        <path d={`M ${CX + 26} 178 L ${CX + 26} 182 M ${CX + 30} 178 L ${CX + 30} 182 M ${CX + 34} 178 L ${CX + 34} 182`} stroke="#d23250" strokeWidth={1.8} strokeLinecap="round" />
      </g>
    );
  return (
    <g>
      <path d={`M ${CX - 22} 144 L ${CX - 4} 160 L ${CX + 4} 160 L ${CX + 22} 144 L ${CX + 14} 144 L ${CX} 155 L ${CX - 14} 144 Z`} fill="#3f78b3" stroke="#2c5a8a" strokeWidth={1} strokeLinejoin="round" />
      <circle cx={CX} cy={164} r={9.5} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={2} />
      <path d={star(CX, 164.5, 5.5, 2.4)} fill="#fff3bf" />
    </g>
  );
}
