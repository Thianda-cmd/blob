import { Fragment, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatDay, formatRange, fullName, interestList, sectionTitle, textBlocks, today, visibleSections } from "../model";
import { HEADING, Portrait, SignatureMark } from "../render";
import type { Cv, CvEntry, CvLanguage, CvSkill } from "../types";
import type { CvBackgroundProps, CvBlock, CvTemplate } from "./types";

// "Elegant": refined and timeless. A centred header (portrait or monogram, the name in the heading
// font, the headline in spaced capitals, the contact line with small diamonds) closed by a fine
// double rule; centred section titles between hairlines; small diamonds as the one ornament for
// separators, points and skill levels; a centred closing.

/** Page margins in mm. */
const M = { top: 17, right: 21, bottom: 19, left: 21 };

/** The accent for text and fine marks on white paper: very light accents (yellow) are darkened until they read. */
const STRONG = "var(--cv-accent-ink)";
/** Hairlines: the accent, softened. */
const HAIR = "color-mix(in srgb, var(--cv-accent-ink) 45%, var(--cv-paper))";

/** Long words break with a hyphen in the CV's language (set on every block); overflowWrap is the fallback. */
const HYPHENS: CSSProperties = { hyphens: "auto", hyphenateLimitChars: "10 4 4", overflowWrap: "break-word" };

/** Spaced capitals ("small caps" that look the same in every font pair). */
const caps = (size: string, spacing: string): CSSProperties => ({ textTransform: "uppercase", fontSize: size, letterSpacing: spacing });

/** Words only this design prints. */
const WORDS = {
  de: { born: "geb.", bornIn: "geb. in", page: (n: number, of: number) => `Seite ${n} von ${of}` },
  en: { born: "born", bornIn: "born in", page: (n: number, of: number) => `Page ${n} of ${of}` },
} as const;

/** A small diamond, `size` in em. */
function Diamond({ size = 0.42, color = STRONG, filled = true }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: `${size}em`,
        height: `${size}em`,
        transform: "rotate(45deg)",
        background: filled ? color : "transparent",
        boxShadow: filled ? undefined : `inset 0 0 0 0.075em ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Items on centred lines with a small diamond between them. The diamond is drawn behind a widened
 * space, and a space at the end or start of a line is dropped by the browser, so a wrapped line
 * never starts or ends with a diamond.
 */
function Flow({ items, style }: { items: ReactNode[]; style?: CSSProperties }) {
  const corner = (angle: number) => `linear-gradient(${angle}deg, var(--cv-paper) 25%, transparent 25% 75%, var(--cv-paper) 75%)`;
  return (
    <div style={{ textAlign: "center", ...style }}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden
              style={{
                wordSpacing: "1.15em",
                // An accent square with its corners painted over in paper colour: a diamond.
                backgroundImage: `${corner(45)}, ${corner(-45)}, linear-gradient(${STRONG}, ${STRONG})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "0.4em 0.4em",
                backgroundPosition: "center 54%",
              }}
            >
              {" "}
            </span>
          )}
          <span style={{ display: "inline-block", maxWidth: "100%", overflowWrap: "anywhere" }}>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}

/** Paragraphs and points; points hang on a small diamond. */
function Details({ text, style }: { text: string; style?: CSSProperties }) {
  const parts = textBlocks(text);
  if (!parts.length) return null;
  return (
    <div style={{ color: "var(--cv-ink-2)", ...HYPHENS, ...style }}>
      {parts.map((part, i) =>
        part.type === "p" ? (
          <p key={i} style={{ margin: i ? "0.3em 0 0" : 0 }}>
            {part.text}
          </p>
        ) : (
          <ul key={i} style={{ margin: i ? "0.3em 0 0" : 0, padding: 0, listStyle: "none" }}>
            {part.items.map((item, j) => (
              <li key={j} style={{ position: "relative", paddingLeft: "1.15em", marginTop: j ? "0.14em" : 0 }}>
                <span style={{ position: "absolute", left: "0.12em", top: "0.56em", display: "flex" }}>
                  <Diamond size={0.34} />
                </span>
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

const radius = (shape: Cv["design"]["photoShape"], mm: number) => (shape === "circle" ? "50%" : shape === "rounded" ? `${mm}mm` : 0);

/** The photo in a fine frame, or the initials as a monogram in a double ring, or nothing. */
function Picture({ cv }: { cv: Cv }) {
  const { portrait, photoShape: shape } = cv.design;
  if (portrait === "none") return null;
  const photo = portrait === "photo" && cv.person.photo;
  if (photo) {
    const w = shape === "circle" ? 30 : 27;
    const h = shape === "circle" ? 30 : 34;
    return (
      <div style={{ padding: "1.3mm", border: `0.25mm solid ${HAIR}`, borderRadius: radius(shape, 3.4) }}>
        <Portrait cv={cv} width={w} height={h} />
      </div>
    );
  }
  const letters = initials(cv);
  if (!letters) return null;
  const size = 23;
  return (
    <div aria-hidden style={{ width: `${size}mm`, height: `${size}mm`, padding: "1.1mm", border: `0.3mm solid ${STRONG}`, borderRadius: radius(shape, 3), boxSizing: "border-box" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          border: `0.15mm solid ${HAIR}`,
          borderRadius: radius(shape, 2),
          display: "grid",
          placeItems: "center",
          ...HEADING,
          fontSize: `${size * 0.32}mm`,
          letterSpacing: "0.06em",
          paddingLeft: "0.06em",
          color: STRONG,
        }}
      >
        {letters}
      </div>
    </div>
  );
}

function born(cv: Cv) {
  const w = WORDS[cv.lang];
  const date = formatDay(cv.person.birthDate, cv.lang);
  const place = cv.person.birthPlace.trim();
  if (date) return `${w.born} ${date}${place ? ` in ${place}` : ""}`;
  return place ? `${w.bornIn} ${place}` : "";
}

function contacts(cv: Cv): ReactNode[] {
  const l = CV_LABELS[cv.lang];
  return contactLines(cv).map((line) => {
    if (line.kind === "birth") return born(cv);
    if (line.kind === "nationality") return `${l.nationality}: ${line.value}`;
    return line.value;
  });
}

function Header({ cv }: { cv: Cv }) {
  const name = fullName(cv.person);
  const headline = cv.person.headline.trim();
  const items = contacts(cv);
  return (
    <div lang={cv.lang} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <Picture cv={cv} />
      {name && (
        <div
          style={{
            ...HEADING,
            marginTop: cv.design.portrait === "none" ? 0 : "4.5mm",
            fontSize: "2.75em",
            lineHeight: 1.08,
            letterSpacing: "0.035em",
            color: "var(--cv-ink)",
            overflowWrap: "break-word",
            maxWidth: "100%",
            textWrap: "balance",
          }}
        >
          {name}
        </div>
      )}
      {headline && <div style={{ ...caps("0.8em", "0.2em"), marginTop: "0.95em", lineHeight: 1.55, color: STRONG, maxWidth: "150mm", paddingLeft: "0.2em", textWrap: "balance" }}>{headline}</div>}
      {items.length > 0 && <Flow items={items} style={{ marginTop: "1.05em", fontSize: "0.9em", color: "var(--cv-ink-2)", maxWidth: "100%", textWrap: "balance" }} />}
      {/* Thick and thin, 3 : 1. An SVG keeps the exact weights in print (a box's height is rounded to whole pixels there). */}
      <svg aria-hidden viewBox="0 0 100 1.3" preserveAspectRatio="none" style={{ display: "block", alignSelf: "stretch", width: "100%", height: "1.3mm", marginTop: "5.5mm" }}>
        <rect width={100} height={0.45} style={{ fill: STRONG }} />
        <rect y={1.15} width={100} height={0.15} style={{ fill: STRONG }} />
      </svg>
    </div>
  );
}

function Heading({ cv, children }: { cv: Cv; children: ReactNode }) {
  const rule: CSSProperties = { flex: 1, minWidth: "8mm", height: "0.2mm", background: HAIR };
  return (
    <div lang={cv.lang} style={{ paddingTop: "1.9em", paddingBottom: "0.95em", display: "flex", alignItems: "center", gap: "4.5mm" }}>
      <span style={rule} />
      <span style={{ ...HEADING, ...caps("0.86em", "0.24em"), paddingLeft: "0.24em", color: "var(--cv-ink)", textAlign: "center", maxWidth: "75%", lineHeight: 1.3 }}>{children}</span>
      <span style={rule} />
    </div>
  );
}

function Entry({ cv, entry, last }: { cv: Cv; entry: CvEntry; last: boolean }) {
  const title = entry.title.trim();
  const where = [entry.org, entry.place]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const head = title || where;
  const sub = title ? where : "";
  const dates = formatRange(entry, cv.lang, cv.design.dates);
  return (
    <div lang={cv.lang} style={{ paddingBottom: last ? 0 : "1em" }}>
      {(head || dates) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6mm" }}>
          <div style={{ ...HEADING, fontSize: "1.07em", lineHeight: 1.3, color: "var(--cv-ink)", minWidth: 0, ...HYPHENS }}>{head}</div>
          {dates && <div style={{ ...caps("0.78em", "0.1em"), flexShrink: 0, whiteSpace: "nowrap", color: "var(--cv-ink-3)", fontVariantNumeric: "tabular-nums" }}>{dates}</div>}
        </div>
      )}
      {sub && <div style={{ color: "var(--cv-ink-2)", ...HYPHENS, marginTop: "0.05em" }}>{sub}</div>}
      <Details text={entry.text} style={{ paddingTop: head || dates ? "0.3em" : 0 }} />
    </div>
  );
}

/** Two columns of rows: a name on the left, something small on the right. */
function Pairs({ cv, rows }: { cv: Cv; rows: { id: string; name: string; right: ReactNode }[] }) {
  return (
    <div lang={cv.lang} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: "14mm", rowGap: "0.4em" }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "baseline", gap: "2mm", minWidth: 0 }}>
          <span style={{ minWidth: 0, ...HYPHENS }}>{r.name}</span>
          {/* A dotted leader carries the eye from the name to its level. */}
          <span aria-hidden style={{ flex: 1, minWidth: "3mm", position: "relative", top: "-0.08em", borderBottom: r.right ? `0.3mm dotted ${HAIR}` : undefined }} />
          {r.right}
        </div>
      ))}
    </div>
  );
}

function Level({ level }: { level: number }) {
  return (
    <span aria-label={`${level}/5`} style={{ display: "inline-flex", gap: "0.36em", alignItems: "center", flexShrink: 0, padding: "0 0.06em 0.04em" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Diamond key={n} size={0.4} filled={n <= level} color={n <= level ? STRONG : HAIR} />
      ))}
    </span>
  );
}

const skillRows = (skills: CvSkill[], levels: boolean) => skills.map((k) => ({ id: k.id, name: k.name, right: levels && k.level > 0 ? <Level level={k.level} /> : null }));

const languageRows = (cv: Cv, languages: CvLanguage[]) =>
  languages.map((x) => ({
    id: x.id,
    name: x.name,
    right: (
      <span style={{ flexShrink: 0, textAlign: "right", color: "var(--cv-ink-2)" }}>
        {CV_LABELS[cv.lang].languageLevels[x.level]}
        {x.cefr && <span style={{ ...caps("0.8em", "0.08em"), color: STRONG, marginLeft: "0.6em" }}>{x.cefr}</span>}
      </span>
    ),
  }));

/** "Hamburg, 09.10.2026", the signature over a fine line and the name under it, centred. */
function Signoff({ cv }: { cv: Cv }) {
  const l = CV_LABELS[cv.lang];
  const date = formatDay(cv.closing.date || today(), cv.lang);
  const place = cv.closing.place.trim() || cv.person.city.trim();
  const sig = cv.closing.signature;
  const width = 64;
  return (
    <div lang={cv.lang} style={{ paddingTop: "2.4em", display: "flex", justifyContent: "center" }}>
      <div style={{ width: `${width}mm`, textAlign: "center" }}>
        {/* Today's date can differ between the server's render and the browser's around midnight. */}
        <div suppressHydrationWarning style={{ color: "var(--cv-ink-2)" }}>
          {[place, date].filter(Boolean).join(", ") || l.placeDate}
        </div>
        <div style={{ height: "15mm", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingTop: "1mm" }}>
          {sig && <SignatureMark signature={sig} height={Math.min(13, ((width - 4) * sig.h) / sig.w)} />}
        </div>
        <div style={{ borderTop: "0.25mm solid var(--cv-ink-3)", paddingTop: "0.45em", ...caps("0.74em", "0.16em"), color: "var(--cv-ink-3)" }}>{fullName(cv.person) || l.signature}</div>
      </div>
    </div>
  );
}

export const elegant: CvTemplate = {
  id: "elegant",
  geometry: () => ({ margin: M, marginNext: { top: 18, bottom: M.bottom }, header: "full", headerGap: 0 }),
  blocks: (cv) => {
    const l = CV_LABELS[cv.lang];
    const blocks: CvBlock[] = [{ key: "header", column: "header", node: <Header cv={cv} /> }];
    const heading = (key: string, title: string) => blocks.push({ key: `${key}-h`, column: "main", keepWithNext: true, node: <Heading cv={cv}>{title}</Heading> });

    if (cv.summary.trim()) {
      heading("summary", l.profile);
      blocks.push({
        key: "summary",
        column: "main",
        node: (
          <div lang={cv.lang} style={{ display: "flex", justifyContent: "center" }}>
            {/* Centred like the header, unless it has points (they hang on the left). */}
            <Details text={cv.summary} style={{ maxWidth: "142mm", textAlign: textBlocks(cv.summary).some((p) => p.type === "ul") ? "left" : "center", color: "var(--cv-ink)" }} />
          </div>
        ),
      });
    }

    for (const s of visibleSections(cv)) {
      heading(s.id, sectionTitle(s, cv.lang));
      if (s.kind === "skills") {
        blocks.push({ key: s.id, column: "main", node: <Pairs cv={cv} rows={skillRows(s.skills, s.showLevels)} /> });
      } else if (s.kind === "languages") {
        blocks.push({ key: s.id, column: "main", node: <Pairs cv={cv} rows={languageRows(cv, s.languages)} /> });
      } else if (s.kind === "interests") {
        blocks.push({
          key: s.id,
          column: "main",
          node: (
            <div lang={cv.lang}>
              <Flow items={interestList(s.text)} />
            </div>
          ),
        });
      } else {
        s.entries.forEach((e, i) => blocks.push({ key: `${s.id}-${e.id}`, column: "main", node: <Entry cv={cv} entry={e} last={i === s.entries.length - 1} /> }));
      }
    }

    if (cv.closing.show) blocks.push({ key: "closing", column: "main", keepWithPrevious: true, node: <Signoff cv={cv} /> });
    return blocks;
  },
  Overlay: ({ cv, page, pages }: CvBackgroundProps) =>
    pages > 1 ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "9.5mm", display: "flex", justifyContent: "center", alignItems: "center", gap: "3mm", color: "var(--cv-ink-3)" }}>
        <span style={{ width: "8mm", height: "0.2mm", background: HAIR }} />
        <span style={{ ...caps("0.7em", "0.2em"), paddingLeft: "0.2em" }}>{WORDS[cv.lang].page(page + 1, pages)}</span>
        <span style={{ width: "8mm", height: "0.2mm", background: HAIR }} />
      </div>
    ) : null,
};
