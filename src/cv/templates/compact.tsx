import { Fragment, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatDay, formatRange, fullName, interestList, sectionTitle, visibleSections } from "../model";
import { Closing, ContactIcon, CvText, HEADING, LevelDots, Portrait } from "../render";
import type { Cv, CvEntry } from "../types";
import type { CvBlock, CvTemplate } from "./types";

// "Kompakt": fits a lot on one page and stays easy to read. A slim header across the page (name and
// headline, contact in two columns, a small portrait), then the main column on the left and a light
// panel on the right for skills, languages and interests. Section titles are small accent chips.

const MARGIN = 13;
/** The right-hand panel and the space before it, in mm. Its content keeps PAD from the panel's edges. */
const CARD = 62;
const PAD = 5;
const GAP = 7;

/** The accent for text and small marks on light backgrounds (light accents come darker, see cvStyle). */
const STRONG = "var(--cv-accent-ink)";
const HAIRLINE = "color-mix(in srgb, var(--cv-accent) 26%, transparent)";

/** The name's widest line, in em at the page's text size (about 62 mm at M; scaled with S and L like everything else). */
const NAME_EM = 18.5;

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
const nb = (s: string) => s.replace(/ /g, " ");

const hasSide = (cv: Cv) => visibleSections(cv).some((s) => s.kind === "skills" || s.kind === "languages" || s.kind === "interests");

function hasPortrait(cv: Cv) {
  const { portrait } = cv.design;
  if (portrait === "none") return false;
  if (portrait === "photo" && cv.person.photo) return true;
  return Boolean((cv.person.firstName.trim() + cv.person.lastName.trim()).length);
}

type Line = ReturnType<typeof contactLines>[number];

/**
 * One contact line in pieces that never split badly: the address as on an envelope (street, then
 * postcode and city), the birth line breaking only before "in", a phone number or a usual e-mail
 * address in one piece (so the header gives them room), links only after "/" and "@".
 */
function ContactLine({ line, cv }: { line: Line; cv: Cv }) {
  const p = cv.person;
  const street = p.street.trim().replace(/ (?=\S+$)/, " ");
  const town = [p.postalCode.trim(), p.city.trim()].filter(Boolean).join(" ");
  const value =
    line.kind === "address" ? (
      street && town ? (
        <>
          {street}
          <br />
          {town}
        </>
      ) : (
        street || town
      )
    ) : line.kind === "birth" ? (
      CV_LABELS[cv.lang].bornOn(nb(formatDay(p.birthDate, cv.lang)), p.birthPlace.trim()).replace(" in ", " in ")
    ) : line.kind === "phone" || (line.kind === "email" && line.value.length <= 30) ? (
      <span style={{ whiteSpace: "nowrap" }}>{line.value}</span>
    ) : line.kind === "email" || line.kind === "link" ? (
      breakable(line.value)
    ) : (
      line.value
    );
  return (
    <div style={{ display: "flex", gap: "0.6em", alignItems: "flex-start" }}>
      <span style={{ paddingTop: "0.2em", display: "flex" }}>
        <ContactIcon kind={line.kind} color={STRONG} />
      </span>
      {/* break-word, not anywhere: the pieces above set how narrow the column may get. */}
      <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{value}</span>
    </div>
  );
}

function Header({ cv }: { cv: Cv }) {
  const lines = contactLines(cv);
  // Two columns: how to reach you (phone, e-mail, links) and where you live and who you are.
  const reach = lines.filter((x) => x.kind === "phone" || x.kind === "email" || x.kind === "link");
  const about = lines.filter((x) => !reach.includes(x));
  const columns = [reach, about].filter((c) => c.length);
  const circle = cv.design.photoShape === "circle";
  const first = cv.person.firstName.trim();
  const last = cv.person.lastName.trim();
  const name = fullName(cv.person);
  // Short names on one line, long ones as first name over last name. The name never wraps (so the
  // contact columns give way first); its size keeps the widest line to NAME_EM, counting a generous
  // 0.6 em a letter.
  const split = name.length > 18 && Boolean(first && last);
  const longest = Math.max(...(split ? [first.length, last.length] : [name.length]), 1);
  const size = Math.min(2.2, NAME_EM / (longest * 0.6));
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "5mm" }}>
      <div style={{ flex: "1 1 0" }}>
        <div style={{ minWidth: "52mm" }}>
          <div style={{ ...HEADING, fontSize: `${size}em`, lineHeight: 1.08, letterSpacing: "-0.012em", color: "var(--cv-ink)", whiteSpace: "nowrap" }}>
            {split ? (
              <>
                <div>{first}</div>
                <div>{last}</div>
              </>
            ) : (
              name
            )}
          </div>
          {cv.person.headline.trim() && <div style={{ marginTop: "0.4em", fontWeight: 500, lineHeight: 1.35, color: STRONG }}>{cv.person.headline}</div>}
        </div>
      </div>
      {columns.length > 0 && (
        <div style={{ display: "flex", gap: "5mm", paddingTop: "0.3em", fontSize: "0.86em", color: "var(--cv-ink-2)" }}>
          {columns.map((column, i) => (
            <div key={i} style={{ display: "grid", rowGap: "0.4em", alignContent: "start" }}>
              {column.map((line, j) => (
                <ContactLine key={j} line={line} cv={cv} />
              ))}
            </div>
          ))}
        </div>
      )}
      {hasPortrait(cv) && (
        // Initials are drawn in --cv-accent: give them the readable accent.
        <div style={{ flexShrink: 0, "--cv-accent": STRONG } as CSSProperties}>
          <Portrait cv={cv} width={circle ? 24 : 22} height={circle ? 24 : 27} />
        </div>
      )}
    </div>
  );
}

/** A section title: a small accent chip and a hairline to the end of the column. */
function Heading({ children, side, first }: { children: ReactNode; side?: boolean; first?: boolean }) {
  return (
    <div style={{ paddingTop: first ? 0 : "1.2em", paddingBottom: "0.55em", display: "flex", alignItems: "center", gap: "2.4mm" }}>
      <span
        style={{
          ...HEADING,
          fontSize: "0.76em",
          lineHeight: 1.3,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "0.28em 0.75em 0.24em",
          borderRadius: "0.9mm",
          background: "var(--cv-accent)",
          color: "var(--cv-on-accent)",
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </span>
      <span style={{ flex: 1, minWidth: "4mm", height: "0.25mm", background: side ? HAIRLINE : "var(--cv-line)" }} />
    </div>
  );
}

/**
 * One block of the panel's content. The panel itself is drawn behind the side column on every page
 * (Background), so a page break inside it never cuts it; the content keeps PAD from its edges.
 */
function Card({ children, first }: { children: ReactNode; first: boolean }) {
  return <div style={{ padding: `${first ? PAD : 0}mm ${PAD}mm 0` }}>{children}</div>;
}

function Entry({ cv, entry, last }: { cv: Cv; entry: CvEntry; last: boolean }) {
  const dates = formatRange(entry, cv.lang, cv.design.dates);
  const title = entry.title.trim();
  const where = [entry.org.trim(), entry.place.trim()].filter(Boolean).join(", ");
  return (
    <div style={{ paddingBottom: last ? 0 : "0.75em", overflowWrap: "break-word" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4mm" }}>
        <div style={{ minWidth: 0, fontWeight: 650, lineHeight: 1.35, color: "var(--cv-ink)" }}>{title || where}</div>
        {dates && <div style={{ flexShrink: 0, fontSize: "0.86em", color: "var(--cv-ink-3)", fontVariantNumeric: "tabular-nums" }}>{dates}</div>}
      </div>
      {title && where && <div style={{ color: "var(--cv-ink-2)" }}>{where}</div>}
      <Details text={entry.text} style={{ marginTop: "0.15em" }} />
    </div>
  );
}

export const compact: CvTemplate = {
  id: "compact",
  geometry: (cv) => ({
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    marginNext: { top: MARGIN + 2, bottom: MARGIN },
    // Without skills, languages or interests the main column takes the whole width.
    side: hasSide(cv) ? { width: CARD, position: "right", gap: GAP } : undefined,
    header: "full",
    headerGap: 5,
  }),
  blocks: (cv) => {
    const l = CV_LABELS[cv.lang];
    const panel = hasSide(cv);
    const main: CvBlock[] = [];
    // The panel's content, put into Card blocks at the end (the first one needs to know it is first).
    const side: { key: string; node: ReactNode; keepWithNext?: boolean }[] = [];
    // The first title in the main column sits as far down as the first one in the panel, so both start on one line.
    const heading = (key: string, title: string, column: "main" | "side") => {
      if (column === "main") {
        const node = <Heading first={!main.length}>{title}</Heading>;
        main.push({ key: `${key}-h`, column, keepWithNext: true, node: main.length || !panel ? node : <div style={{ paddingTop: `${PAD}mm` }}>{node}</div> });
      } else side.push({ key: `${key}-h`, keepWithNext: true, node: <Heading side first={!side.length}>{title}</Heading> });
    };

    if (cv.summary.trim()) {
      heading("summary", l.profile, "main");
      main.push({ key: "summary", column: "main", node: <Details text={cv.summary} style={{ color: "var(--cv-ink-2)" }} /> });
    }

    for (const s of visibleSections(cv)) {
      const title = sectionTitle(s, cv.lang);
      if (s.kind === "skills") {
        heading(s.id, title, "side");
        s.skills.forEach((k, i) =>
          side.push({
            key: `${s.id}-${k.id}`,
            node: (
              <div style={{ paddingBottom: i === s.skills.length - 1 ? 0 : "0.35em", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "3mm" }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{k.name}</span>
                {s.showLevels && k.level > 0 && (
                  // The dots sit on the middle of the first line when a long name wraps.
                  <span style={{ display: "flex", flexShrink: 0, paddingTop: "0.44em" }}>
                    <LevelDots level={k.level} on={STRONG} off="color-mix(in srgb, var(--cv-ink) 13%, transparent)" />
                  </span>
                )}
              </div>
            ),
          }),
        );
      } else if (s.kind === "languages") {
        heading(s.id, title, "side");
        s.languages.forEach((x, i) =>
          side.push({
            key: `${s.id}-${x.id}`,
            node: (
              <div style={{ paddingBottom: i === s.languages.length - 1 ? 0 : "0.4em", lineHeight: 1.32, overflowWrap: "break-word" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "3mm" }}>
                  <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{x.name}</span>
                  {x.cefr && <span style={{ fontSize: "0.82em", fontWeight: 700, letterSpacing: "0.06em", color: STRONG }}>{x.cefr}</span>}
                </div>
                <div style={{ fontSize: "0.88em", color: "var(--cv-ink-2)" }}>{l.languageLevels[x.level]}</div>
              </div>
            ),
          }),
        );
      } else if (s.kind === "interests") {
        heading(s.id, title, "side");
        side.push({
          key: s.id,
          node: (
            <div style={{ overflowWrap: "break-word" }}>
              {interestList(s.text).map((item, i, all) => (
                <Fragment key={i}>
                  {item}
                  {/* The dot stays with the word before it, so no line starts with one; the last two items stay together. */}
                  {i < all.length - 1 && <span style={{ color: STRONG, fontWeight: 700 }}>{i === all.length - 2 ? " · " : " · "}</span>}
                </Fragment>
              ))}
            </div>
          ),
        });
      } else {
        heading(s.id, title, "main");
        s.entries.forEach((e, i) => main.push({ key: `${s.id}-${e.id}`, column: "main", node: <Entry cv={cv} entry={e} last={i === s.entries.length - 1} /> }));
      }
    }

    if (cv.closing.show) main.push({ key: "closing", column: "main", keepWithPrevious: true, node: <Closing cv={cv} /> });

    const card = side.map(
      (b, i): CvBlock => ({
        key: b.key,
        column: "side",
        keepWithNext: b.keepWithNext,
        node: <Card first={i === 0}>{b.node}</Card>,
      }),
    );
    return [{ key: "header", column: "header", node: <Header cv={cv} /> }, ...main, ...card];
  },
  // The accent strip along the top, and the panel behind the side column: from under the header on
  // page 1 (from the top margin on later pages) down to the bottom margin, PAD around the content.
  Background: ({ page, headerHeight, geometry: g }) => (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "2.2mm", background: "var(--cv-accent)" }} />
      {g.side && (
        <div
          style={{
            position: "absolute",
            right: `${g.margin.right}mm`,
            width: `${CARD}mm`,
            top: `${page === 0 ? g.margin.top + headerHeight + g.headerGap : (g.marginNext?.top ?? g.margin.top) - PAD}mm`,
            bottom: `${(page === 0 ? g.margin.bottom : (g.marginNext?.bottom ?? g.margin.bottom)) - PAD}mm`,
            borderRadius: "2.6mm",
            background: "var(--cv-accent-soft)",
          }}
        />
      )}
    </>
  ),
  // Under the main column (the panel reaches into the bottom margin on the right).
  Overlay: ({ cv, page, pages }) =>
    pages > 1 ? (
      <div style={{ position: "absolute", bottom: "6mm", left: `${MARGIN}mm`, fontSize: "0.78em", color: "var(--cv-ink-3)", fontVariantNumeric: "tabular-nums" }}>
        {fullName(cv.person) ? `${fullName(cv.person)} · ` : ""}
        {page + 1} / {pages}
      </div>
    ) : null,
};
