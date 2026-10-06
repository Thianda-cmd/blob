"use client";

// Blood: what it is made of (a centrifuged tube and a blood smear), the AB0 blood groups as a
// small lab (donor cells meet the recipient's antibodies), and a blood-group test card.

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { Chip, noise, SoftButton, svgText } from "./HeartShared";
import { cos, sin } from "@/lib/stableMath";

// ---------------------------------------------------------------------------
// Blood cells

const CELL_PARTS: FigurePart[] = [
  { id: "plasma", label: tx("blood plasma", "Blutplasma"), at: [64, 92], info: tx("The liquid part (about 55 %): mostly water with dissolved nutrients, salts, hormones, waste products and carbon dioxide.", "Der flüssige Teil (etwa 55 %): vor allem Wasser mit gelösten Nährstoffen, Salzen, Hormonen, Abfallstoffen und Kohlenstoffdioxid.") },
  { id: "rbc", label: tx("red blood cells (erythrocytes)", "rote Blutkörperchen (Erythrozyten)"), at: [262, 96], info: tx("Red discs without a nucleus, full of haemoglobin. They carry oxygen. About 5 million in one microlitre.", "Rote Scheiben ohne Zellkern, voller Hämoglobin. Sie transportieren Sauerstoff. Etwa 5 Millionen pro Mikroliter.") },
  { id: "wbc", label: tx("white blood cells (leucocytes)", "weiße Blutkörperchen (Leukozyten)"), at: [376, 118], info: tx("Cells with a nucleus. They fight pathogens. 4000 to 10 000 in one microlitre.", "Zellen mit Zellkern. Sie wehren Krankheitserreger ab. 4000 bis 10 000 pro Mikroliter.") },
  { id: "platelet", label: tx("platelets (thrombocytes)", "Blutplättchen (Thrombozyten)"), at: [306, 198], info: tx("Tiny cell fragments without a nucleus. They seal wounds: blood clotting.", "Winzige Zellbruchstücke ohne Zellkern. Sie verschließen Wunden: Blutgerinnung.") },
];

const RBCS: [number, number, number][] = [
  [262, 96, 0], [230, 140, 20], [276, 160, -10], [320, 92, 30], [246, 196, 0], [214, 92, 15], [352, 180, -20], [318, 140, 10],
  [204, 172, 40], [290, 228, -30], [362, 224, 0], [236, 240, 25], [394, 160, 10], [338, 262, 0], [276, 58, -15], [358, 64, 5],
];
const PLATELETS: [number, number][] = [[306, 198], [224, 118], [384, 112], [262, 266], [408, 206], [338, 48]];

function Erythrocyte({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={16} ry={15} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      <ellipse cx={x} cy={y} rx={7.5} ry={7} fill="var(--bio-flesh)" opacity={0.45} />
    </g>
  );
}

export function HeartBloodCells({ mode = "explore", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Blood: centrifuged in a tube (left) and under the microscope (right)", "Blut: zentrifugiert im Röhrchen (links) und unter dem Mikroskop (rechts)")} width={480} height={300} parts={CELL_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* Tube */}
      <g>
        <path d="M40 24 L40 252 C40 272 88 272 88 252 L88 24" fill="none" stroke="var(--bio-outline)" strokeWidth={2} />
        <g data-part="plasma">
          <rect x={41} y={40} width={46} height={118} fill="var(--bio-sun)" opacity={0.45} />
        </g>
        <rect x={41} y={158} width={46} height={5} fill="var(--bio-bone)" />
        <path d="M41 163 L41 252 C41 270 87 270 87 252 L87 163 Z" fill="var(--bio-blood)" />
        <g style={svgText} fontSize={12} fill="var(--ink-2)">
          <text x={96} y={104}>55 %</text>
          <text x={96} y={218}>45 %</text>
        </g>
        <path d="M94 40 L100 40 L100 156 L94 156 M94 164 L100 164 L100 266 L94 266" fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
      </g>
      {/* Smear */}
      <g data-part="plasma">
        <circle cx={310} cy={156} r={136} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={2} />
        <circle cx={310} cy={156} r={134} fill="var(--bio-sun)" opacity={0.18} />
      </g>
      <g data-part="rbc">
        {RBCS.map(([x, y, r], i) => (
          <Erythrocyte key={i} x={x} y={y} rot={r} />
        ))}
        {/* One seen from the side: a disc thinner in the middle */}
        <path d="M188 226 C188 214 200 214 206 220 C212 214 224 214 224 226 C224 238 212 238 206 232 C200 238 188 238 188 226 Z" transform="rotate(90 206 226)" fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      </g>
      <g data-part="wbc">
        {/* Neutrophil with a lobed nucleus */}
        <circle cx={378} cy={124} r={24} fill="var(--bio-nucleus)" opacity={0.45} stroke="var(--bio-outline)" strokeWidth={1.2} />
        <path d="M364 120 C364 110 374 110 376 118 C378 108 390 110 388 120 C394 124 390 136 380 132 C376 140 362 136 366 128 C360 128 360 122 364 120 Z" fill="var(--bio-nucleus-deep)" opacity={0.85} />
        {/* Lymphocyte: a big round nucleus */}
        <circle cx={236} cy={54} r={17} fill="var(--bio-nucleus)" opacity={0.45} stroke="var(--bio-outline)" strokeWidth={1.2} />
        <circle cx={237} cy={55} r={13} fill="var(--bio-nucleus-deep)" opacity={0.85} />
      </g>
      <g data-part="platelet">
        {PLATELETS.map(([x, y], i) => (
          <path key={i} d={`M${x - 5} ${y} C${x - 5} ${y - 4} ${x + 1} ${y - 5} ${x + 4} ${y - 2} C${x + 7} ${y + 1} ${x + 3} ${y + 5} ${x - 1} ${y + 4} C${x - 4} ${y + 4} ${x - 5} ${y + 2} ${x - 5} ${y} Z`} fill="var(--bio-nucleus-deep)" opacity={0.75} stroke="var(--bio-outline)" strokeWidth={0.8} />
        ))}
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// AB0 blood groups

export type BloodGroup = "A" | "B" | "AB" | "0";
export const GROUPS: BloodGroup[] = ["A", "B", "AB", "0"];
/** Antigens on the red blood cells. */
export const antigensOf = (g: BloodGroup): ("A" | "B")[] => (g === "AB" ? ["A", "B"] : g === "0" ? [] : [g]);
/** Antibodies in the plasma (against the antigens the person does not have). */
export const antibodiesOf = (g: BloodGroup): ("A" | "B")[] => (["A", "B"] as const).filter((x) => !antigensOf(g).includes(x));
/** Do the donor's red cells clump in the recipient's plasma? */
export const clumps = (donor: BloodGroup, recipient: BloodGroup) => antigensOf(donor).some((a) => antibodiesOf(recipient).includes(a));

const A_COL = "var(--bio-sun)";
const B_COL = "var(--bio-water)";

/** A red blood cell with its antigens (A: triangles, B: knobs). */
function GroupCell({ x, y, r, group }: { x: number; y: number; r: number; group: BloodGroup }) {
  const ag = antigensOf(group);
  const n = 10;
  return (
    <g>
      {ag.length > 0 &&
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + 0.3;
          const kind = ag.length === 2 ? ag[i % 2] : ag[0];
          const cx = x + cos(a) * (r + 2.5);
          const cy = y + sin(a) * (r + 2.5);
          const deg = (a * 180) / Math.PI + 90;
          return kind === "A" ? (
            <path key={i} d={`M${cx} ${cy - 4.2} L${cx + 3.8} ${cy + 2.6} L${cx - 3.8} ${cy + 2.6} Z`} transform={`rotate(${deg} ${cx} ${cy})`} fill={A_COL} stroke="var(--bio-outline)" strokeWidth={0.8} />
          ) : (
            <circle key={i} cx={cx} cy={cy} r={3.2} fill={B_COL} stroke="var(--bio-outline)" strokeWidth={0.8} />
          );
        })}
      <circle cx={x} cy={y} r={r} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      <circle cx={x} cy={y} r={r * 0.45} fill="var(--bio-flesh)" opacity={0.45} />
    </g>
  );
}

/** A Y-shaped antibody; its tips fit antigen A (notched) or B (cupped). */
function Antibody({ x, y, rot, kind, s = 1 }: { x: number; y: number; rot: number; kind: "A" | "B"; s?: number }) {
  const col = kind === "A" ? A_COL : B_COL;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 12 L0 0 L-8 -9 M0 0 L8 -9" fill="none" stroke="var(--bio-outline)" strokeWidth={4.2} strokeLinecap="round" />
      <path d="M0 12 L0 0 L-8 -9 M0 0 L8 -9" fill="none" stroke={col} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

const MIX_HOME: [number, number][] = [[-52, -20], [-14, -34], [28, -22], [56, 8], [-40, 22], [2, 6], [34, 34], [-8, 42]];
const MIX_CLUMP: [number, number][] = [[-22, -8], [-6, -16], [10, -8], [24, 4], [-16, 8], [0, 2], [16, 16], [-2, 20]];

export function HeartBloodGroupsWidget() {
  const t = useText();
  const [donor, setDonor] = useState<BloodGroup>("A");
  const [recipient, setRecipient] = useState<BloodGroup>("B");
  const [tried, setTried] = useState<Set<string>>(() => new Set(["A>B"]));
  const [all, setAll] = useState(false);
  const pick = (d: BloodGroup, r: BloodGroup) => {
    setDonor(d);
    setRecipient(r);
    setTried((s) => new Set(s).add(`${d}>${r}`));
  };
  const bad = clumps(donor, recipient);
  const abs = antibodiesOf(recipient);
  const ags = antigensOf(donor);
  const groupName = (g: BloodGroup) => (g === "0" ? "0" : g);
  const agText = (g: BloodGroup): Text => {
    const a = antigensOf(g);
    return a.length === 0 ? tx("no antigens", "keine Antigene") : a.length === 2 ? tx("antigens A and B", "Antigene A und B") : tx(`antigen ${a[0]}`, `Antigen ${a[0]}`);
  };
  const abText = (g: BloodGroup): Text => {
    const a = antibodiesOf(g);
    return a.length === 0 ? tx("no antibodies", "keine Antikörper") : a.length === 2 ? tx("anti-A and anti-B", "Anti-A und Anti-B") : tx(`anti-${a[0]}`, `Anti-${a[0]}`);
  };
  const why = bad
    ? tx(
        `The recipient's plasma contains ${t(abText(recipient))}. It fits the donor's ${t(agText(donor))}: the red cells clump together. Dangerous!`,
        `Im Plasma des Empfängers ist ${t(abText(recipient))}. Das passt zum ${t(agText(donor))} der Spenderzellen: Die roten Blutkörperchen verklumpen. Lebensgefährlich!`,
      )
    : ags.length === 0
      ? tx("The donor's red cells carry no antigens A or B, so no antibody can grab them. Compatible.", "Die Spenderzellen tragen weder Antigen A noch B, also kann kein Antikörper sie packen. Verträglich.")
      : abs.length === 0
        ? tx("The recipient's plasma has no anti-A or anti-B, so nothing clumps. Compatible.", "Im Plasma des Empfängers sind weder Anti-A noch Anti-B, also verklumpt nichts. Verträglich.")
        : tx(`The recipient has ${t(abText(recipient))}, but that doesn't fit the donor's ${t(agText(donor))}. Compatible.`, `Der Empfänger hat ${t(abText(recipient))}, das passt aber nicht zum ${t(agText(donor))} der Spenderzellen. Verträglich.`);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{t(tx("Donor (red cells)", "Spender (rote Blutkörperchen)"))}</div>
          <div className="flex gap-2">
            {GROUPS.map((g) => (
              <Chip key={g} on={donor === g} onClick={() => pick(g, recipient)} className="min-w-11 font-math">
                {groupName(g)}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{t(tx("Recipient (plasma)", "Empfänger (Blutplasma)"))}</div>
          <div className="flex gap-2">
            {GROUPS.map((g) => (
              <Chip key={g} on={recipient === g} onClick={() => pick(donor, g)} className="min-w-11 font-math">
                {groupName(g)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox="0 0 480 190" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Donor red cells mixed with recipient plasma", "Spenderzellen werden mit Empfängerplasma gemischt"))}>
        <g style={svgText} fontSize={12} fill="var(--ink-2)" textAnchor="middle">
          <text x={70} y={182}>{t(agText(donor))}</text>
          <text x={240} y={182}>{t(abText(recipient))}</text>
          <text x={406} y={182}>{t(tx("mixed", "gemischt"))}</text>
        </g>
        {/* Donor cell */}
        <GroupCell x={70} y={86} r={34} group={donor} />
        <text x={150} y={92} textAnchor="middle" fontSize={22} fill="var(--ink-3)">+</text>
        {/* Recipient plasma */}
        <circle cx={240} cy={86} r={62} fill="var(--bio-sun)" opacity={0.2} stroke="var(--bio-outline)" strokeWidth={1.5} />
        {abs.length === 0 ? (
          <text x={240} y={92} textAnchor="middle" fontSize={13} fill="var(--ink-3)" style={svgText}>
            {t(tx("none", "keine"))}
          </text>
        ) : (
          Array.from({ length: 8 }, (_, i) => {
            const kind = abs.length === 2 ? abs[i % 2] : abs[0];
            const a = (i / 8) * Math.PI * 2;
            return <Antibody key={i} x={240 + cos(a) * (22 + (i % 3) * 9)} y={86 + sin(a) * (22 + (i % 3) * 9)} rot={(i * 47) % 360} kind={kind} />;
          })
        )}
        <text x={326} y={92} textAnchor="middle" fontSize={22} fill="var(--ink-3)">→</text>
        {/* Mixture */}
        <circle cx={406} cy={86} r={66} fill="var(--bio-sun)" opacity={0.2} stroke="var(--bio-outline)" strokeWidth={1.5} />
        {MIX_HOME.map(([hx, hy], i) => {
          const [cx, cy] = bad ? MIX_CLUMP[i] : [hx, hy];
          return (
            <motion.g key={i} initial={false} animate={{ x: 406 + cx, y: 86 + cy }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: bad ? i * 0.03 : 0 }}>
              <GroupCell x={0} y={0} r={9} group={donor} />
            </motion.g>
          );
        })}
        {bad &&
          [0, 1, 2, 3].map((i) => (
            <motion.g key={`ab${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <Antibody x={406 + MIX_CLUMP[i * 2][0] / 2 + MIX_CLUMP[i * 2 + 1][0] / 2} y={86 + MIX_CLUMP[i * 2][1] / 2 + MIX_CLUMP[i * 2 + 1][1] / 2} rot={i * 90 + 20} kind={abs.find((x) => ags.includes(x)) ?? "A"} s={0.6} />
            </motion.g>
          ))}
      </svg>

      <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", bad ? "border-danger/40 bg-danger/5" : "border-ok/40 bg-ok/5")} aria-live="polite">
        <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", bad ? "bg-danger" : "bg-ok")}>{bad ? <X className="size-4" /> : <Check className="size-4" />}</span>
        <div className="text-[14.5px] leading-relaxed">
          <span className="font-semibold text-ink">{bad ? t(tx("Clumping: incompatible", "Verklumpung: unverträglich")) : t(tx("No clumping: compatible", "Keine Verklumpung: verträglich"))}</span>
          <span className="text-ink-2"> {t(why)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-1 text-center text-[13px]">
          <thead>
            <tr>
              <th className="px-2 text-left text-[11.5px] font-medium text-ink-3">{t(tx("recipient ↓ / donor →", "Empfänger ↓ / Spender →"))}</th>
              {GROUPS.map((d) => (
                <th key={d} className="w-10 font-math text-ink-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((r) => (
              <tr key={r}>
                <th className="px-2 text-left font-math text-ink-2">{r}</th>
                {GROUPS.map((d) => {
                  const seen = all || tried.has(`${d}>${r}`);
                  const ok = !clumps(d, r);
                  const now = d === donor && r === recipient;
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        onClick={() => pick(d, r)}
                        aria-label={`${t(tx("donor", "Spender"))} ${d}, ${t(tx("recipient", "Empfänger"))} ${r}`}
                        className={cn("grid size-9 place-items-center rounded-lg border transition-colors", now ? "border-blob" : "border-line", seen ? (ok ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger") : "bg-surface text-ink-3 hover:bg-hover")}
                      >
                        {seen ? ok ? <Check className="size-4" /> : <X className="size-4" /> : "?"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-center">
          <SoftButton onClick={() => setAll((v) => !v)} className="h-8 text-[12.5px]">
            {all ? t(tx("Hide untried", "Nur Ausprobiertes zeigen")) : t(tx("Show the whole table", "Ganze Tabelle zeigen"))}
          </SoftButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test card: a drop of blood in each field with test serum

function Well({ x, clumped, label, seed }: { x: number; clumped: boolean; label: string; seed: number }) {
  return (
    <g>
      <circle cx={x} cy={62} r={44} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.6} />
      {clumped ? (
        <g>
          <circle cx={x} cy={62} r={38} fill="var(--bio-sun)" opacity={0.25} />
          {Array.from({ length: 11 }, (_, i) => {
            const a = noise(i, seed) * Math.PI * 2;
            const d = 6 + noise(i, seed + 1) * 26;
            const cx = x + cos(a) * d;
            const cy = 62 + sin(a) * d;
            const r = 3 + noise(i, seed + 2) * 4;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={0.6} />
                <circle cx={cx + r * 0.7} cy={cy - r * 0.4} r={r * 0.6} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={0.6} />
              </g>
            );
          })}
        </g>
      ) : (
        <circle cx={x} cy={62} r={38} fill="var(--bio-blood)" opacity={0.85} />
      )}
      <text x={x} y={128} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--ink)" style={svgText}>
        {label}
      </text>
    </g>
  );
}

/** A blood-group test card: anti-A and anti-B (and anti-D for the rhesus factor). */
export function HeartBloodTest({ group, rh }: { group: BloodGroup; rh?: boolean }) {
  const t = useText();
  const fields: { label: string; clumped: boolean }[] = [
    { label: "Anti-A", clumped: antigensOf(group).includes("A") },
    { label: "Anti-B", clumped: antigensOf(group).includes("B") },
    ...(rh === undefined ? [] : [{ label: "Anti-D", clumped: rh }]),
  ];
  const w = fields.length * 110 + 20;
  return (
    <svg viewBox={`0 0 ${w} 140`} className="mx-auto block h-auto w-full" style={{ maxWidth: fields.length * 150 }} role="img" aria-label={t(tx("Blood group test card", "Testkarte zur Blutgruppenbestimmung"))}>
      {fields.map((f, i) => (
        <Well key={f.label} x={65 + i * 110} clumped={f.clumped} label={f.label} seed={i * 13 + 5} />
      ))}
    </svg>
  );
}
