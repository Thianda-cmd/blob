import type { CSSProperties, ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatRange, fullName, interestList, sectionTitle, visibleSections } from "../model";
import { Closing, ContactIcon, CvText, HEADING, LevelDots, Portrait } from "../render";
import type { Cv, CvEntry, CvLanguage } from "../types";
import type { CvBackgroundProps, CvBlock, CvTemplate } from "./types";

// "Kreativ": a full-bleed colour band with a big name and the contact details, the portrait
// sitting on the band's lower edge. Under it a timeline column on the left and a side column on
// the right with skills, languages and interests as dots, pills and chips.

/** Page geometry in mm. */
const MARGIN = { top: 12, right: 15, bottom: 16, left: 15 };
const SIDE = 58;
const GAP = 9;
const MAIN = 210 - MARGIN.left - MARGIN.right - SIDE - GAP;
/** Space between the band and the columns. */
const HEADER_GAP = 8;
/** The header block is at least this tall, so the band never looks thin (band = MARGIN.top + header). */
const HEADER_MIN = 45;
/** The accent strip at the top of later pages. */
const STRIP = 5;
/** The paper-coloured ring around the portrait. */
const RING = 1.2;

/** On-accent text, softened towards the band colour. */
const ON_SOFT = "color-mix(in srgb, var(--cv-on-accent) 84%, var(--cv-accent))";

/**
 * The accent's shades on white paper, worked out from the accent itself so every colour works: a
 * light accent (yellow, beige) is mixed with the ink until marks and text are readable, a dark or
 * greyish one gets a lighter marker so it never looks like a smudge behind the titles.
 */
type Tones = {
  /** Dots, lines and the quote mark: at least 3:1 on the paper. */
  mark: string;
  /** The same as a plain colour when it differs from the accent (it replaces --cv-accent for the bullets). */
  markColor: string | null;
  /** Text in the accent colour on the tint (date pills, initials): 4.5:1. */
  deep: string;
  /** Pills, chips and the initials' background. */
  tint: string;
  /** The highlighter stroke behind section titles. */
  marker: string;
  /** The CEFR pill. */
  solid: { background: string; color: string };
};

type Rgb = [number, number, number];
/** --cv-ink and --cv-paper of cvStyle (CvDocument.tsx), for the contrast sums. */
const INK: Rgb = [0x1d, 0x1e, 0x21];
const PAPER: Rgb = [255, 255, 255];

const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Like color-mix(in srgb, a p%, b). */
const mix = (a: Rgb, b: Rgb, p: number) => a.map((x, i) => (x * p + b[i] * (100 - p)) / 100) as Rgb;

let toneCache: [string, Tones] | null = null;

function tones(accent: string): Tones {
  if (toneCache?.[0] === accent) return toneCache[1];
  const n = /^#[0-9a-f]{6}$/i.test(accent) ? parseInt(accent.slice(1), 16) : 0x6d3df5;
  const a: Rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // The share of ink (in %) the accent needs to reach `ratio` against `on`; 0 for most accents.
  const inkShare = (ratio: number, on: Rgb) => {
    let k = 0;
    while (k < 100 && contrast(mix(INK, a, k), on) < ratio) k += 2;
    return k;
  };
  const withInk = (k: number) => (k ? `color-mix(in srgb, var(--cv-ink) ${k}%, var(--cv-accent))` : "var(--cv-accent)");
  const k = inkShare(3, PAPER);
  // Tints of an accent this close to white would vanish: they are made from the mark instead.
  const light = contrast(a, PAPER) < 1.3;
  const base = light ? mix(INK, a, k) : a;
  const baseCss = light ? withInk(k) : "var(--cv-accent)";
  const d = inkShare(4.5, mix(base, PAPER, 15));
  // Vivid colours make a good highlighter at a medium tint; dull and dark ones only at a light one.
  const chroma = (Math.max(...base) - Math.min(...base)) / 255;
  let p = 45;
  while (p > 10 && luminance(mix(base, PAPER, p)) < 0.72 - 0.25 * chroma) p--;
  const markRgb = mix(INK, a, k).map(Math.round);
  const result: Tones = {
    mark: withInk(k),
    markColor: k ? `rgb(${markRgb.join(" ")})` : null,
    deep: withInk(d),
    tint: `color-mix(in srgb, ${baseCss} 15%, var(--cv-paper))`,
    marker: `color-mix(in srgb, ${baseCss} ${p}%, var(--cv-paper))`,
    solid: light ? { background: withInk(d), color: "var(--cv-paper)" } : { background: "var(--cv-accent)", color: "var(--cv-on-accent)" },
  };
  toneCache = [accent, result];
  return result;
}

/** The portrait's size in mm: a circle, or a passport-like rectangle for the other shapes. */
function portraitBox(cv: Cv) {
  const circle = cv.design.photoShape === "circle";
  return { w: circle ? 38 : 35, h: circle ? 38 : 44 };
}

/** Whether the portrait shows anything (a photo or initials). */
function hasPortrait(cv: Cv) {
  if (cv.design.portrait === "none") return false;
  if (cv.design.portrait === "photo" && cv.person.photo) return true;
  return Boolean(cv.person.firstName.trim() || cv.person.lastName.trim());
}

/** A section title on a marker stroke. `first`: the first block of its column on page 1 (no space above). */
function Heading({ children, first, t }: { children: ReactNode; first?: boolean; t: Tones }) {
  return (
    <div style={{ paddingTop: first ? "0.1em" : "1.6em", paddingBottom: "0.75em" }}>
      <span
        style={{
          ...HEADING,
          fontSize: "1.3em",
          lineHeight: 1.25,
          color: "var(--cv-ink)",
          letterSpacing: "-0.01em",
          padding: "0 0.18em",
          margin: "0 -0.18em",
          backgroundImage: `linear-gradient(transparent 50%, ${t.marker} 50%, ${t.marker} 86%, transparent 86%)`,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </span>
    </div>
  );
}

/** Dates and language levels: a tinted pill, or a solid one for the CEFR level. */
function Pill({ children, solid, t }: { children: ReactNode; solid?: boolean; t: Tones }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "1.75em",
        padding: "0 0.75em",
        borderRadius: 99,
        fontSize: "0.8em",
        fontWeight: 600,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        ...(solid ? t.solid : { background: t.tint, color: t.deep }),
      }}
    >
      {children}
    </span>
  );
}

/** The opening quote mark in front of the profile. */
function QuoteMark({ t }: { t: Tones }) {
  return (
    <svg viewBox="0 0 32 24" aria-hidden style={{ position: "absolute", left: 0, top: "0.25em", width: "6.2mm", height: "4.65mm", color: t.mark, display: "block" }}>
      <path fill="currentColor" d="M0 24V13.5C0 6 4.2 1.4 11.5 0l1.3 3.2C8.6 4.6 6.6 7.4 6.4 11H13v13H0zM18 24V13.5C18 6 22.2 1.4 29.5 0l1.3 3.2C26.6 4.6 24.6 7.4 24.4 11H31v13H18z" />
    </svg>
  );
}

/** Timeline geometry: the dot's size and the indent of the entry text, in mm. */
const DOT = 2.5;
const INDENT = 6.5;
/** Height of the date pill's row (Pill is 1.75em at 0.8em = 1.4em of the entry). */
const PILL_ROW = 1.4;

/** The bullets of the shared CvText are drawn in --cv-accent: give them the readable mark instead. */
const bullets = (t: Tones): CSSProperties => (t.markColor ? ({ "--cv-accent": t.markColor } as CSSProperties) : {});

function Entry({ cv, entry, first, last, t }: { cv: Cv; entry: CvEntry; first: boolean; last: boolean; t: Tones }) {
  const dates = formatRange(entry, cv.lang, cv.design.dates);
  const title = entry.title.trim();
  const where = [entry.org, entry.place].filter((s) => s.trim()).join(", ");
  // The dot sits on the first row: the date pill, or the title when there are no dates.
  const dotY = dates ? `${PILL_ROW / 2}em` : "0.72em";
  return (
    <div style={{ position: "relative", paddingLeft: `${INDENT}mm`, paddingBottom: last ? "0.2em" : "1.15em" }}>
      {!(first && last) && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: `${DOT / 2 - 0.15}mm`,
            width: "0.3mm",
            top: first ? dotY : 0,
            height: first ? `calc(100% - ${dotY})` : last ? dotY : "100%",
            background: `color-mix(in srgb, ${t.mark} 30%, var(--cv-line))`,
          }}
        />
      )}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: `calc(${dotY} - ${DOT / 2}mm)`,
          width: `${DOT}mm`,
          height: `${DOT}mm`,
          boxSizing: "border-box",
          borderRadius: 99,
          border: `0.55mm solid ${t.mark}`,
          background: entry.current ? t.mark : "var(--cv-paper)",
        }}
      />
      {dates && (
        <div style={{ display: "flex", height: `${PILL_ROW}em`, alignItems: "center" }}>
          <Pill t={t}>{dates}</Pill>
        </div>
      )}
      {title && (
        <div style={{ paddingTop: dates ? "0.3em" : 0, fontSize: "1.04em", lineHeight: 1.32, fontWeight: 650, color: "var(--cv-ink)", overflowWrap: "anywhere" }}>{title}</div>
      )}
      {where && (
        <div
          style={{
            paddingTop: title ? "0.1em" : dates ? "0.3em" : 0,
            color: title ? "var(--cv-ink-2)" : "var(--cv-ink)",
            fontWeight: title ? 500 : 650,
            fontSize: title ? undefined : "1.04em",
            overflowWrap: "anywhere",
          }}
        >
          {where}
        </div>
      )}
      {/* Details alone start on the dot's line. */}
      <CvText text={entry.text} style={{ ...bullets(t), paddingTop: dates || title || where ? "0.3em" : 0, overflowWrap: "anywhere" }} />
    </div>
  );
}

/** The portrait on the band's edge: the photo, or the initials on a light tint, with a paper ring. */
function Badge({ cv, t }: { cv: Cv; t: Tones }) {
  const { w, h } = portraitBox(cv);
  const shape = cv.design.photoShape;
  const photo = cv.design.portrait === "photo" && cv.person.photo;
  const initials = [cv.person.firstName, cv.person.lastName].map((s) => s.trim()[0] ?? "").join("").toUpperCase();
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        borderRadius: shape === "circle" ? "50%" : shape === "rounded" ? "4.5mm" : "0.5mm",
        overflow: "hidden",
        boxShadow: `0 0 0 ${RING}mm var(--cv-paper)`,
        background: t.tint,
        color: "var(--cv-ink)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {photo ? (
        <Portrait cv={cv} width={w} height={h} shape="square" />
      ) : (
        <span aria-hidden style={{ ...HEADING, fontSize: `${Math.min(w, h) * 0.34}mm`, lineHeight: 1, letterSpacing: "0.01em", color: t.deep }}>
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * The name's size: smaller for long names, so it keeps to two lines and the band stays compact, and
 * small enough that the longest word fits on one line (about 0.6 em a letter in the widest fonts).
 */
function nameSize(name: string, wide: boolean) {
  const width = wide ? 180 : MAIN + GAP - 5;
  const longest = Math.max(...name.split(/\s+/).map((word) => word.length));
  const size = name.length > (wide ? 48 : 32) ? 2.5 : name.length > (wide ? 36 : 24) ? 2.8 : 3.2;
  return `clamp(1.8em, ${(width / (longest * 0.6)).toFixed(2)}mm, ${size}em)`;
}

/** A contact value. Addresses break only after a comma ("Lindenstraße 12, / 20095 Hamburg"). */
function ContactValue({ kind, value }: { kind: string; value: string }) {
  if (kind === "email" || kind === "link") return <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{value}</span>;
  if (kind === "phone") return <span style={{ whiteSpace: "nowrap" }}>{value}</span>;
  if (kind !== "address") return <span>{value}</span>;
  const parts = value.split(", ");
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          <span style={{ whiteSpace: parts.length > 1 && part.length <= 32 ? "nowrap" : undefined }}>{i < parts.length - 1 ? `${part},` : part}</span>
          {i < parts.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

function ContactItem({ kind, value }: { kind: Parameters<typeof ContactIcon>[0]["kind"]; value: string }) {
  return (
    <div style={{ display: "flex", gap: "0.55em", alignItems: "flex-start", minWidth: kind === "email" || kind === "link" ? 0 : undefined }}>
      {/* 1.55em tall on a 1.42em line: lifted a little so it centres on the first line. */}
      <span
        style={{
          width: "1.55em",
          height: "1.55em",
          marginTop: "-0.065em",
          borderRadius: 99,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--cv-on-accent) 15%, transparent)",
        }}
      >
        <span style={{ display: "flex", fontSize: "0.82em" }}>
          <ContactIcon kind={kind} color="var(--cv-on-accent)" />
        </span>
      </span>
      <ContactValue kind={kind} value={value} />
    </div>
  );
}

function Header({ cv, t }: { cv: Cv; t: Tones }) {
  const l = CV_LABELS[cv.lang];
  const { firstName, lastName, headline } = cv.person;
  const name = fullName(cv.person);
  const lines = contactLines(cv);
  // Links can be long: they get whole rows under the grid instead of squeezing a column.
  const grid = lines.filter((line) => line.kind !== "link");
  const links = lines.filter((line) => line.kind === "link");
  const box = portraitBox(cv);
  const portrait = hasPortrait(cv);
  return (
    <div style={{ position: "relative", minHeight: `${HEADER_MIN}mm`, paddingBottom: "6.5mm", display: "flex", flexDirection: "column", color: "var(--cv-on-accent)" }}>
      {/* The text stays clear of the portrait; without one it may use the whole width. */}
      <div style={{ width: portrait ? `${MAIN + GAP - 5}mm` : "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6em", fontSize: "0.72em", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: ON_SOFT }}>
          <span style={{ width: "6mm", height: "0.5mm", borderRadius: 9, background: "currentColor" }} />
          {l.document}
        </div>
        <div style={{ marginTop: "auto", paddingTop: "3.5mm" }}>
          {name && (
            <div style={{ ...HEADING, fontSize: nameSize(name, !portrait), lineHeight: 1.02, letterSpacing: "-0.025em", overflowWrap: "anywhere" }}>
              {firstName.trim() && <span style={{ fontWeight: 400 }}>{firstName.trim()}</span>}
              {firstName.trim() && lastName.trim() && " "}
              {lastName.trim() && <span style={{ fontWeight: 700 }}>{lastName.trim()}</span>}
            </div>
          )}
          {headline.trim() && <div style={{ paddingTop: "0.45em", fontSize: "1.06em", lineHeight: 1.35, color: ON_SOFT, overflowWrap: "anywhere" }}>{headline}</div>}
          {lines.length > 0 && (
            <div style={{ paddingTop: "1em", fontSize: "0.88em", display: "grid", rowGap: "0.35em" }}>
              {grid.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: portrait ? "auto auto" : "auto auto auto", justifyContent: "start", columnGap: "6mm", rowGap: "0.35em" }}>
                  {grid.map((line, i) => (
                    <ContactItem key={i} kind={line.kind} value={line.value} />
                  ))}
                </div>
              )}
              {links.map((line, i) => (
                <ContactItem key={i} kind={line.kind} value={line.value} />
              ))}
            </div>
          )}
        </div>
      </div>
      {portrait && (
        // Centred on the band's lower edge, over the side column.
        <div style={{ position: "absolute", left: `${MAIN + GAP}mm`, bottom: `${-box.h / 2}mm` }}>
          <Badge cv={cv} t={t} />
        </div>
      )}
    </div>
  );
}

/** One language: the name, its level and the CEFR level as pills. */
function Language({ cv, language, last, t }: { cv: Cv; language: CvLanguage; last: boolean; t: Tones }) {
  const l = CV_LABELS[cv.lang];
  return (
    <div style={{ paddingBottom: last ? 0 : "0.7em" }}>
      <div style={{ fontWeight: 600, color: "var(--cv-ink)", overflowWrap: "anywhere" }}>{language.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3em", paddingTop: "0.25em" }}>
        <Pill t={t}>{l.languageLevels[language.level]}</Pill>
        {language.cefr && (
          <Pill solid t={t}>
            {language.cefr}
          </Pill>
        )}
      </div>
    </div>
  );
}

export const creative: CvTemplate = {
  id: "creative",
  geometry: () => ({
    margin: MARGIN,
    marginNext: { top: STRIP + 12, bottom: MARGIN.bottom },
    side: { width: SIDE, position: "right", gap: GAP },
    header: "full",
    headerGap: HEADER_GAP,
  }),
  blocks: (cv) => {
    const t = tones(cv.design.accent);
    const blocks: CvBlock[] = [{ key: "header", column: "header", node: <Header cv={cv} t={t} /> }];
    const heading = (key: string, column: "main" | "side", title: string) => {
      const first = !blocks.some((b) => b.column === column && b.key !== "portrait");
      blocks.push({
        key: `${key}-h`,
        column,
        keepWithNext: true,
        node: (
          <Heading first={first} t={t}>
            {title}
          </Heading>
        ),
      });
    };

    // The lower half of the portrait reaches into the side column: keep that space free (and a
    // little more, the first side title has no space above).
    if (hasPortrait(cv)) {
      const spare = portraitBox(cv).h / 2 + RING - HEADER_GAP + 6;
      blocks.push({ key: "portrait", column: "side", node: <div style={{ height: `${spare}mm` }} /> });
    }

    if (cv.summary.trim()) {
      blocks.push({
        key: "summary",
        column: "main",
        node: (
          <div style={{ position: "relative", paddingLeft: "10mm", paddingBottom: "0.2em" }}>
            <QuoteMark t={t} />
            <CvText text={cv.summary} style={{ ...bullets(t), color: "var(--cv-ink)", fontSize: "1.04em", lineHeight: 1.5 }} />
          </div>
        ),
      });
    }

    for (const s of visibleSections(cv)) {
      const title = sectionTitle(s, cv.lang);
      if (s.kind === "skills") {
        // One block per skill, so a long list breaks between two skills.
        heading(s.id, "side", title);
        s.skills.forEach((k, i) =>
          blocks.push({
            key: `${s.id}-${k.id}`,
            column: "side",
            node: (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "3mm", paddingBottom: i === s.skills.length - 1 ? 0 : "0.5em" }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{k.name}</span>
                {s.showLevels && k.level > 0 && (
                  <span style={{ display: "flex", paddingTop: "0.44em" }}>
                    <LevelDots level={k.level} size={0.6} on={t.mark} off={`color-mix(in srgb, ${t.mark} 16%, var(--cv-line))`} />
                  </span>
                )}
              </div>
            ),
          }),
        );
      } else if (s.kind === "languages") {
        heading(s.id, "side", title);
        s.languages.forEach((x, i) =>
          blocks.push({ key: `${s.id}-${x.id}`, column: "side", node: <Language cv={cv} language={x} last={i === s.languages.length - 1} t={t} /> }),
        );
      } else if (s.kind === "interests") {
        heading(s.id, "side", title);
        blocks.push({
          key: s.id,
          column: "side",
          node: (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}>
              {interestList(s.text).map((item, i) => (
                <span key={i} style={{ padding: "0.2em 0.8em", borderRadius: 99, background: t.tint, color: "var(--cv-ink)", fontSize: "0.92em", overflowWrap: "anywhere", minWidth: 0 }}>
                  {item}
                </span>
              ))}
            </div>
          ),
        });
      } else {
        heading(s.id, "main", title);
        s.entries.forEach((e, i) =>
          blocks.push({ key: `${s.id}-${e.id}`, column: "main", node: <Entry cv={cv} entry={e} first={i === 0} last={i === s.entries.length - 1} t={t} /> }),
        );
      }
    }

    if (cv.closing.show) blocks.push({ key: "closing", column: "main", keepWithPrevious: true, node: <Closing cv={cv} /> });
    return blocks;
  },
  Background: ({ page, headerHeight, geometry }: CvBackgroundProps) => {
    if (page > 0) return <div style={{ position: "absolute", left: 0, top: 0, width: "210mm", height: `${STRIP}mm`, background: "var(--cv-accent)" }} />;
    const band = geometry.margin.top + headerHeight;
    const soft = "color-mix(in srgb, var(--cv-on-accent) 8%, transparent)";
    // Two soft circles in the band's top right corner, clear of the portrait and the contact details.
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: "210mm", height: `${band}mm`, background: "var(--cv-accent)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "162mm", top: "-62mm", width: "96mm", height: "96mm", borderRadius: "50%", background: soft }} />
        <div style={{ position: "absolute", left: "128mm", top: "-30mm", width: "46mm", height: "46mm", borderRadius: "50%", border: `0.6mm solid ${soft}` }} />
      </div>
    );
  },
  Overlay: ({ cv, page, pages }: CvBackgroundProps) =>
    pages > 1 ? (
      <div
        style={{
          position: "absolute",
          left: `${MARGIN.left}mm`,
          right: `${MARGIN.right}mm`,
          bottom: "7.5mm",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.78em",
          color: "var(--cv-ink-3)",
        }}
      >
        <span>{fullName(cv.person)}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {page + 1} / {pages}
        </span>
      </div>
    ) : null,
};
