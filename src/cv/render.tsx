import { Cake, Flag, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { CV_LABELS } from "./labels";
import { contactLines, formatDay, fullName, textBlocks, today } from "./model";
import type { Cv, CvSignature } from "./types";

/** Heading type: the design's heading font at its heading weight. */
export const HEADING: CSSProperties = { fontFamily: "var(--cv-heading)", fontWeight: "var(--cv-heading-weight)" as CSSProperties["fontWeight"] };

// Pieces every CV design uses. They follow the block rules in templates/types.ts: page variables for
// colours and fonts, em/mm sizes, no outer margins on a block's root.

/** Entry details: paragraphs and bullet points. */
export function CvText({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const parts = textBlocks(text);
  if (!parts.length) return null;
  return (
    <div className={className} style={{ color: "var(--cv-ink-2)", ...style }}>
      {parts.map((part, i) =>
        part.type === "p" ? (
          <p key={i} style={{ margin: i ? "0.25em 0 0" : 0 }}>
            {part.text}
          </p>
        ) : (
          <ul key={i} style={{ margin: i ? "0.25em 0 0" : 0, padding: 0, listStyle: "none" }}>
            {part.items.map((item, j) => (
              <li key={j} style={{ position: "relative", paddingLeft: "1em", marginTop: j ? "0.12em" : 0 }}>
                <span aria-hidden style={{ position: "absolute", left: "0.15em", top: "0.62em", width: "0.32em", height: "0.32em", borderRadius: 9, background: "var(--cv-accent)" }} />
                {item}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

const initials = (cv: Cv) =>
  [cv.person.firstName, cv.person.lastName]
    .map((s) => s.trim()[0] ?? "")
    .join("")
    .toUpperCase();

/**
 * The picture by the name: the photo (cropped as set in the editor), the initials while there is
 * no photo or when the design setting asks for them, or nothing. `width`/`height` in mm.
 */
export function Portrait({
  cv,
  width,
  height = width,
  shape = cv.design.photoShape,
  ring,
  tone = "soft",
}: {
  cv: Cv;
  width: number;
  height?: number;
  shape?: Cv["design"]["photoShape"];
  /** A white ring around it (for photos on a coloured band). */
  ring?: boolean;
  /** Initials on a light tint of the accent, or on the accent itself. */
  tone?: "soft" | "accent" | "onAccent";
}) {
  const { portrait } = cv.design;
  if (portrait === "none") return null;
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? "2.2mm" : "0.4mm";
  const box: CSSProperties = {
    width: `${width}mm`,
    height: `${height}mm`,
    borderRadius: radius,
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: ring ? "0 0 0 1.2mm var(--cv-paper)" : undefined,
  };
  const photo = portrait === "photo" ? cv.person.photo : null;
  if (photo) {
    const { x, y, zoom } = cv.person.photoCrop;
    return (
      <div style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- printed at its real size, no optimisation wanted */}
        <img
          src={photo}
          alt={fullName(cv.person)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: `${x}% ${y}%`, display: "block" }}
        />
      </div>
    );
  }
  const letters = initials(cv);
  if (!letters) return null;
  const colors =
    tone === "accent"
      ? { background: "var(--cv-accent)", color: "var(--cv-on-accent)" }
      : tone === "onAccent"
        ? { background: "color-mix(in srgb, var(--cv-on-accent) 18%, transparent)", color: "var(--cv-on-accent)" }
        : { background: "var(--cv-accent-soft)", color: "var(--cv-accent)" };
  return (
    <div
      aria-hidden
      style={{
        ...box,
        ...colors,
        display: "grid",
        placeItems: "center",
        ...HEADING,
        fontSize: `${Math.min(width, height) * 0.36}mm`,
        letterSpacing: "0.02em",
      }}
    >
      {letters}
    </div>
  );
}

/** A skill level as five dots. `on` and `off` colours default to the accent and a light grey. */
export function LevelDots({ level, on = "var(--cv-accent)", off = "var(--cv-line)", size = 0.55 }: { level: number; on?: string; off?: string; size?: number }) {
  return (
    <span aria-label={`${level}/5`} style={{ display: "inline-flex", gap: `${size * 0.45}em`, alignItems: "center", flexShrink: 0 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ width: `${size}em`, height: `${size}em`, borderRadius: 99, background: n <= level ? on : off }} />
      ))}
    </span>
  );
}

/** A skill level as a thin bar. */
export function LevelBar({ level, on = "var(--cv-accent)", off = "var(--cv-line)" }: { level: number; on?: string; off?: string }) {
  return (
    <span aria-label={`${level}/5`} style={{ display: "block", height: "0.32em", borderRadius: 99, background: off, overflow: "hidden" }}>
      <span style={{ display: "block", height: "100%", width: `${level * 20}%`, background: on, borderRadius: 99 }} />
    </span>
  );
}

/** The drawn signature, `height` in mm. */
export function SignatureMark({ signature, height = 13, color = "#1f2a44" }: { signature: CvSignature; height?: number; color?: string }) {
  return (
    <svg viewBox={`0 0 ${signature.w} ${signature.h}`} style={{ height: `${height}mm`, width: "auto", display: "block", overflow: "visible" }} aria-hidden>
      {/* Never thinner than 1/48 of the height: a short, tall signature printed with a hairline otherwise. */}
      <path d={signature.d} fill="none" stroke={color} strokeWidth={Math.max(signature.w / 160, signature.h / 48)} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = { phone: Phone, email: Mail, address: MapPin, birth: Cake, nationality: Flag, link: Globe } as const;

/** A small icon for a contact line. */
export function ContactIcon({ kind, color = "var(--cv-accent)" }: { kind: keyof typeof ICONS; color?: string }) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden style={{ width: "1em", height: "1em", flexShrink: 0, color, strokeWidth: 2 }} />;
}

/** Contact lines with icons, one per row (side columns, header strips). */
export function ContactList({ cv, color, iconColor, gap = "0.35em" }: { cv: Cv; color?: string; iconColor?: string; gap?: string }) {
  return (
    <div style={{ display: "grid", gap, color: color ?? "var(--cv-ink-2)" }}>
      {contactLines(cv).map((line, i) => (
        <div key={i} style={{ display: "flex", gap: "0.55em", alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ paddingTop: "0.2em", display: "flex" }}>
            <ContactIcon kind={line.kind} color={iconColor} />
          </span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{line.value}</span>
        </div>
      ))}
    </div>
  );
}

/** "Hamburg, 08.10.2026", the signature over a line, and the name under it. */
export function Closing({ cv, align = "left", children }: { cv: Cv; align?: "left" | "right"; children?: ReactNode }) {
  const l = CV_LABELS[cv.lang];
  const date = formatDay(cv.closing.date || today(), cv.lang);
  const place = cv.closing.place.trim() || cv.person.city.trim();
  return (
    <div style={{ paddingTop: "1.6em", display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      <div style={{ minWidth: "58mm" }}>
        {/* Today's date can differ between the server and the browser (time zones, midnight). */}
        <div style={{ color: "var(--cv-ink-2)" }} suppressHydrationWarning>
          {[place, date].filter(Boolean).join(", ") || l.placeDate}
        </div>
        <div style={{ height: "15mm", display: "flex", alignItems: "flex-end", paddingTop: "1mm" }}>
          {cv.closing.signature && <SignatureMark signature={cv.closing.signature} />}
        </div>
        <div style={{ borderTop: "0.25mm solid var(--cv-ink-3)", paddingTop: "0.3em", color: "var(--cv-ink-3)", fontSize: "0.86em" }}>{fullName(cv.person) || l.signature}</div>
        {children}
      </div>
    </div>
  );
}
