import { Fragment, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatDay, formatRange, fullName, interestList, sectionTitle, visibleSections } from "../model";
import { Closing, ContactIcon, CvText, HEADING, LevelBar, Portrait } from "../render";
import type { Cv, CvEntry, CvLanguage } from "../types";
import type { CvBlock, CvTemplate } from "./types";

// "Modern": a coloured side column on the left, bleeding to the page edges on every page, with the
// portrait, contact, skills, languages and interests. The main column has a large name and the
// timeline sections: dates over the title, entries on a thin line with accent dots.

/** Width of the coloured column (from the page edge), its inner padding, and the white gap before the main column, in mm. */
const FILL = 64;
const PAD = 9;
const GAP = 12;

/** Main column grid: the timeline (line, dots, heading bars) lives in the first GUTTER mm, text starts after it. */
const GUTTER = "6.4mm";
const DOT = 2.3;

/** The accent for text and small marks on white paper (light accents come darker, see cvStyle). */
const STRONG = "var(--cv-accent-ink)";

/** Text on the side column, full strength and softer (the softer one still reads at 4.5:1). */
const ON = "var(--cv-on-accent)";
const ON_SOFT = "color-mix(in srgb, var(--cv-on-accent) 85%, transparent)";
const ON_FAINT = "color-mix(in srgb, var(--cv-on-accent) 24%, transparent)";

const caps: CSSProperties = { textTransform: "uppercase", letterSpacing: "0.16em" };

/** Paragraphs and bullet points; the bullets (drawn in --cv-accent) take the readable accent too. */
function Details({ text, style }: { text: string; style?: CSSProperties }) {
  return <CvText text={text} style={{ ...style, "--cv-accent": STRONG } as CSSProperties} />;
}

/**
 * Lets long e-mail addresses and links break after "@" and "/" only: each piece is an inline block, so
 * the browser can't add its own breaks (after a hyphen, which reads as hyphenation). A piece longer than
 * the whole column still wraps inside its block.
 */
function breakable(value: string): ReactNode {
  const parts = value.split(/(?<=[@/])/);
  return parts.map((part, i) => (
    <Fragment key={i}>
      <span style={{ display: "inline-block", maxWidth: "100%" }}>{part}</span>
      {i < parts.length - 1 && <wbr />}
    </Fragment>
  ));
}

/** Spaces that must not break: a house number stays with its street, a postcode with its city, a date in one piece. */
const nb = (s: string) => s.replace(/ /g, "\u00a0");

/**
 * A contact line in sensible pieces: the address as on an envelope (street, then postcode and city),
 * the birth line breaking only before "in", links and e-mail only after "/" and "@".
 */
function contactValue(cv: Cv, line: ReturnType<typeof contactLines>[number]): ReactNode {
  const p = cv.person;
  if (line.kind === "email" || line.kind === "link") return breakable(line.value);
  if (line.kind === "phone") return nb(line.value);
  if (line.kind === "address") {
    const street = p.street.trim().replace(/ (?=\S+$)/, "\u00a0");
    const town = [p.postalCode.trim(), p.city.trim()].filter(Boolean).join("\u00a0");
    return street && town ? (
      <>
        {street}
        <br />
        {town}
      </>
    ) : (
      street || town
    );
  }
  if (line.kind === "birth") return CV_LABELS[cv.lang].bornOn(nb(formatDay(p.birthDate, cv.lang)), p.birthPlace.trim()).replace(" in ", " in\u00a0");
  return line.value;
}

function hasPortrait(cv: Cv) {
  const { portrait } = cv.design;
  if (portrait === "none") return false;
  if (portrait === "photo" && cv.person.photo) return true;
  return Boolean((cv.person.firstName.trim() + cv.person.lastName.trim()).length);
}

// --- Side column -------------------------------------------------------------------------------

function SidePortrait({ cv }: { cv: Cv }) {
  const shape = cv.design.photoShape;
  const circle = shape === "circle";
  const w = circle ? 40 : 38;
  const h = circle ? 40 : 46;
  // A thin ring a little away from the picture, in the shape of the picture.
  const radius = circle ? "50%" : shape === "rounded" ? "3.6mm" : "0.6mm";
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingBottom: "8mm" }}>
      <div style={{ padding: "1.4mm", borderRadius: radius, border: `0.3mm solid ${ON_FAINT}` }}>
        <Portrait cv={cv} width={w} height={h} tone="onAccent" />
      </div>
    </div>
  );
}

function SideHeading({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <div style={{ paddingTop: first ? 0 : "1.7em", paddingBottom: "0.75em" }}>
      <div style={{ ...HEADING, ...caps, fontSize: "0.8em", color: ON }}>{children}</div>
      <div style={{ height: "0.25mm", background: ON_FAINT, marginTop: "0.55em" }} />
    </div>
  );
}

function Contact({ cv }: { cv: Cv }) {
  return (
    <div style={{ display: "grid", rowGap: "0.6em", fontSize: "0.85em", color: ON }}>
      {contactLines(cv).map((line, i) => (
        <div key={i} style={{ display: "flex", gap: "0.55em", alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ paddingTop: "0.2em", display: "flex" }}>
            <ContactIcon kind={line.kind} color={ON_SOFT} />
          </span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{contactValue(cv, line)}</span>
        </div>
      ))}
    </div>
  );
}

function Language({ cv, language, last }: { cv: Cv; language: CvLanguage; last: boolean }) {
  return (
    <div style={{ paddingBottom: last ? 0 : "0.6em", fontSize: "0.9em", color: ON }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "2mm" }}>
        <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{language.name}</span>
        {language.cefr && <span style={{ fontSize: "0.86em", fontWeight: 600, letterSpacing: "0.06em", color: ON_SOFT }}>{language.cefr}</span>}
      </div>
      <div style={{ color: ON_SOFT }}>{CV_LABELS[cv.lang].languageLevels[language.level]}</div>
    </div>
  );
}

function Interests({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.6mm", fontSize: "0.86em" }}>
      {items.map((item, i) => (
        <span key={i} style={{ padding: "0.2em 0.75em", borderRadius: 99, border: `0.25mm solid ${ON_FAINT}`, background: "color-mix(in srgb, var(--cv-on-accent) 9%, transparent)", color: ON, maxWidth: "100%", overflowWrap: "anywhere" }}>
          {item}
        </span>
      ))}
    </div>
  );
}

// --- Main column -------------------------------------------------------------------------------

function Header({ cv }: { cv: Cv }) {
  const first = cv.person.firstName.trim();
  const last = cv.person.lastName.trim();
  // The name is set very large; long names come down a little so each part still fits on its line.
  const longest = Math.max(first.length, last.length, 8);
  const size = Math.min(2.7, 32 / (longest * 0.6));
  return (
    <div style={{ paddingBottom: "0.4em" }}>
      <div style={{ ...HEADING, fontSize: `${size}em`, lineHeight: 1.04, letterSpacing: "-0.015em", color: "var(--cv-ink)", overflowWrap: "break-word" }}>
        {first && <div style={{ fontWeight: 400 }}>{first}</div>}
        {last && <div>{last}</div>}
      </div>
      {cv.person.headline.trim() && (
        <div style={{ marginTop: "0.65em", fontSize: "1.06em", fontWeight: 500, lineHeight: 1.35, color: STRONG }}>{cv.person.headline}</div>
      )}
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingTop: "1.25em", paddingBottom: "0.55em", display: "flex", alignItems: "flex-start" }}>
      {/* The bar stays on the first line when a long title wraps. */}
      <span style={{ width: GUTTER, height: `${0.84 * 1.42}em`, flexShrink: 0, display: "flex", alignItems: "center" }}>
        <span style={{ width: "4.2mm", height: "0.8mm", borderRadius: 9, background: STRONG }} />
      </span>
      <span style={{ ...HEADING, ...caps, fontSize: "0.84em", color: "var(--cv-ink)" }}>{children}</span>
    </div>
  );
}

function Entry({ cv, entry, first, last }: { cv: Cv; entry: CvEntry; first: boolean; last: boolean }) {
  const dates = formatRange(entry, cv.lang, cv.design.dates);
  const title = entry.title.trim();
  const org = entry.org.trim();
  const place = entry.place.trim();
  // The dot sits on the middle of the first line: the dates, or the title when there are none.
  const firstLine = dates ? 0.78 : title ? 1.04 : 1;
  const dotTop = `calc(${(firstLine * 1.42) / 2}em - ${DOT / 2}mm)`;
  return (
    <div style={{ position: "relative", paddingLeft: GUTTER, paddingBottom: last ? 0 : "0.85em", overflowWrap: "break-word" }}>
      <span
        aria-hidden
        style={{ position: "absolute", left: `${DOT / 2 - 0.15}mm`, width: "0.3mm", top: first ? `calc(${dotTop} + ${DOT / 2}mm)` : 0, bottom: 0, background: "var(--cv-line)" }}
      />
      <span
        aria-hidden
        style={{ position: "absolute", left: 0, top: dotTop, width: `${DOT}mm`, height: `${DOT}mm`, borderRadius: 99, background: STRONG, boxShadow: "0 0 0 0.7mm var(--cv-paper)" }}
      />
      {dates && <div style={{ ...caps, letterSpacing: "0.08em", fontSize: "0.78em", fontWeight: 600, color: STRONG, fontVariantNumeric: "tabular-nums" }}>{dates}</div>}
      {title && <div style={{ fontSize: "1.04em", fontWeight: 650, lineHeight: 1.35, color: "var(--cv-ink)", marginTop: dates ? "0.1em" : 0 }}>{title}</div>}
      {(org || place) && (
        <div style={{ color: title ? "var(--cv-ink-2)" : "var(--cv-ink)", fontWeight: title ? 400 : 600 }}>
          {org}
          {org && place && <span style={{ color: "var(--cv-ink-3)" }}> · </span>}
          {place && <span style={{ color: org ? "var(--cv-ink-3)" : undefined }}>{place}</span>}
        </div>
      )}
      <Details text={entry.text} style={{ marginTop: "0.22em" }} />
    </div>
  );
}

export const modern: CvTemplate = {
  id: "modern",
  geometry: () => ({
    margin: { top: 13, right: 15, bottom: 13, left: PAD },
    marginNext: { top: 14, bottom: 13 },
    side: { width: FILL - 2 * PAD, position: "left", gap: PAD + GAP },
    header: "main",
    headerGap: 1,
  }),
  blocks: (cv) => {
    const l = CV_LABELS[cv.lang];
    const blocks: CvBlock[] = [{ key: "header", column: "header", node: <Header cv={cv} /> }];
    let sideFirst = true;
    const side = (key: string, node: ReactNode, keepWithNext?: boolean) => blocks.push({ key, column: "side", node, keepWithNext });
    const sideHeading = (key: string, title: string) => {
      side(`${key}-h`, <SideHeading first={sideFirst}>{title}</SideHeading>, true);
      sideFirst = false;
    };
    const heading = (key: string, title: string) => blocks.push({ key: `${key}-h`, column: "main", keepWithNext: true, node: <Heading>{title}</Heading> });

    if (hasPortrait(cv)) {
      side("portrait", <SidePortrait cv={cv} />);
    }
    if (contactLines(cv).length) {
      sideHeading("contact", l.contact);
      side("contact", <Contact cv={cv} />);
    }
    if (cv.summary.trim()) {
      heading("summary", l.profile);
      blocks.push({ key: "summary", column: "main", node: <Details text={cv.summary} style={{ paddingLeft: GUTTER, color: "var(--cv-ink-2)" }} /> });
    }

    for (const s of visibleSections(cv)) {
      const title = sectionTitle(s, cv.lang);
      if (s.kind === "skills") {
        sideHeading(s.id, title);
        s.skills.forEach((k, i) => {
          const bar = s.showLevels && k.level > 0;
          side(
            `${s.id}-${k.id}`,
            <div style={{ paddingBottom: i === s.skills.length - 1 ? 0 : bar ? "0.75em" : "0.4em", fontSize: "0.9em", color: ON }}>
              <div style={{ overflowWrap: "anywhere" }}>{k.name}</div>
              {bar && (
                <div style={{ marginTop: "0.35em" }}>
                  <LevelBar level={k.level} on={ON} off={ON_FAINT} />
                </div>
              )}
            </div>,
          );
        });
      } else if (s.kind === "languages") {
        sideHeading(s.id, title);
        s.languages.forEach((x, i) => side(`${s.id}-${x.id}`, <Language cv={cv} language={x} last={i === s.languages.length - 1} />));
      } else if (s.kind === "interests") {
        sideHeading(s.id, title);
        side(s.id, <Interests items={interestList(s.text)} />);
      } else {
        heading(s.id, title);
        s.entries.forEach((e, i) =>
          blocks.push({ key: `${s.id}-${e.id}`, column: "main", node: <Entry cv={cv} entry={e} first={i === 0} last={i === s.entries.length - 1} /> }),
        );
      }
    }

    if (cv.closing.show) {
      blocks.push({ key: "closing", column: "main", keepWithPrevious: true, node: <div style={{ paddingLeft: GUTTER }}><Closing cv={cv} /></div> });
    }
    return blocks;
  },
  Background: () => <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${FILL}mm`, background: "var(--cv-accent)" }} />,
  Overlay: ({ cv, page, pages }) =>
    pages > 1 ? (
      <div style={{ position: "absolute", bottom: "6mm", right: "15mm", fontSize: "0.78em", color: "var(--cv-ink-3)", letterSpacing: "0.04em" }}>
        {fullName(cv.person) ? `${fullName(cv.person)} · ` : ""}
        {page + 1} / {pages}
      </div>
    ) : null,
};
