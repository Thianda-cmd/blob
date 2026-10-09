import { Fragment, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatDay, formatRange, fullName, interestList, sectionTitle, textBlocks, visibleSections } from "../model";
import { Closing, HEADING, LevelDots, Portrait } from "../render";
import type { Cv, CvEntry, CvLanguage, CvSkill } from "../types";
import type { CvBackgroundProps, CvBlock, CvTemplate } from "./types";

// "Minimal": Swiss style. Wide margins, a large light name, the contact details on one flowing line
// and one short accent line under the header. Every section sits on the same grid: its title in
// small spaced capitals in a label column on the left, the content on the right.

/** Page margins in mm. */
const M = { top: 22, right: 22, bottom: 21, left: 24 };
/** The label column and the gap after it, in mm. */
const LABEL = 32;
const GAP = 6;
/** The content column, and the two half columns (with their gap) that skills and languages use, in mm. */
const CONTENT = 210 - M.left - M.right - LABEL - GAP;
const PAIR_GAP = 7;
const HALF = (CONTENT - PAIR_GAP) / 2;
/** The size of 1em for each text size, in mm (the engine's 8.9, 9.6 and 10.4 pt). */
const EM = { s: 3.14, m: 3.387, l: 3.669 } as const;
/** A section title longer than this gets its own line across the grid (the label column is narrow). */
const WIDE_TITLE = 32;

/** Space above a section and between entries. */
const SECTION_GAP = "1.95em";
const ENTRY_GAP = "0.92em";

/** The accent for small marks on white paper: very light accents (yellow) are darkened until they read. */
const STRONG = "var(--cv-accent-ink)";
/** The accent line keeps more of a light accent's colour (a 0.4 mm line in plain yellow disappears on white). */
const LINE = "color-mix(in srgb, var(--cv-accent) 55%, var(--cv-accent-ink))";

const grid: CSSProperties = { display: "grid", gridTemplateColumns: `${LABEL}mm minmax(0, 1fr)`, columnGap: `${GAP}mm`, alignItems: "baseline" };
const pairs: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: `${PAIR_GAP}mm`, rowGap: "0.32em", alignItems: "baseline" };
/** One row per item, the value on the axis of the second half column (further right only for a very long name). */
const table: CSSProperties = { ...pairs, gridTemplateColumns: `minmax(${HALF}mm, max-content) auto` };

/** Long words break with a hyphen in the CV's language (set on every block); overflowWrap is the fallback. */
const HYPHENS: CSSProperties = { hyphens: "auto", hyphenateLimitChars: "10 4 4", overflowWrap: "break-word" };

/**
 * A rough width of a text in em, to choose a layout: within about 4 % of the real width in the six
 * font pairs (narrow letters and spaces count less, capitals and m/w more).
 */
function textEm(text: string, bold = false) {
  let w = 0;
  for (const c of text) w += c === " " ? 0.27 : /[iljtfrI.,:;'’()[\]|!/-]/.test(c) ? 0.32 : c === "–" ? 0.5 : /[mwMW]/.test(c) ? 0.86 : /[A-ZÄÖÜ]/.test(c) ? 0.68 : 0.575;
  return w * (bold ? 1.02 : 1);
}

const label: CSSProperties = {
  ...HEADING,
  fontSize: "0.7em",
  lineHeight: 1.4,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--cv-ink-3)",
  overflowWrap: "anywhere",
  hyphens: "auto",
};

/**
 * Shows a section's title next to an entry that continues the section at the top of a new page
 * (the label column is how the reader finds their way). Hidden everywhere else by an inline style,
 * which only !important overrides; visibility keeps the height, so the measuring copy and the pages
 * stay the same.
 */
const CONTINUED_CSS = ".cv-page [data-cv-block]:first-child .cvmin-cont{visibility:visible !important}";

/** Words only this design prints. */
const WORDS = {
  de: { born: "geb.", bornIn: "geb. in", page: (n: number, of: number) => `${n} / ${of}` },
  en: { born: "born", bornIn: "born in", page: (n: number, of: number) => `${n} / ${of}` },
} as const;

/**
 * Items on one flowing line with a small separator between them. The separator is drawn behind a
 * widened space, and a space at the end or start of a line is dropped by the browser, so a wrapped
 * line never starts or ends with a dot.
 */
function Flow({ items, style }: { items: ReactNode[]; style?: CSSProperties }) {
  return (
    <div style={style}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden
              style={{
                wordSpacing: "0.95em",
                backgroundImage: "radial-gradient(circle, var(--cv-ink-3) 0 0.085em, transparent 0.105em)",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center 52%",
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

/** Paragraphs and points; points hang on a short dash. */
function Details({ text, color = "var(--cv-ink-2)", style }: { text: string; color?: string; style?: CSSProperties }) {
  const parts = textBlocks(text);
  if (!parts.length) return null;
  return (
    <div style={{ color, ...HYPHENS, ...style }}>
      {parts.map((part, i) =>
        part.type === "p" ? (
          <p key={i} style={{ margin: i ? "0.3em 0 0" : 0 }}>
            {part.text}
          </p>
        ) : (
          <ul key={i} style={{ margin: i ? "0.3em 0 0" : 0, padding: 0, listStyle: "none" }}>
            {part.items.map((item, j) => (
              <li key={j} style={{ position: "relative", paddingLeft: "1.05em", marginTop: j ? "0.14em" : 0 }}>
                <span aria-hidden style={{ position: "absolute", left: 0, color: STRONG }}>
                  –
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

/**
 * One row of the grid: the section title (or nothing) on the left, the content on the right. A long
 * title gets its own line across the grid. `continues` is the title of the section an entry belongs to,
 * shown only when the entry opens a page.
 */
function Row({ cv, title, continues, top, children }: { cv: Cv; title?: string; continues?: string; top: string; children: ReactNode }) {
  const wide = (title?.length ?? 0) > WIDE_TITLE;
  return (
    <div lang={cv.lang} style={{ ...grid, paddingTop: top }}>
      {wide ? (
        <div style={{ ...label, gridColumn: "1 / -1", paddingBottom: "0.7em" }}>{title}</div>
      ) : (
        // No height of its own: a two-line title next to a one-line entry would otherwise stretch the row
        // (the next rows' label cells are empty). Its first line still sits on the entry's first baseline.
        <div style={{ ...label, height: 0 }}>
          {title}
          {continues && (
            <div aria-hidden className="cvmin-cont" style={{ visibility: "hidden" }}>
              {shorten(continues)}
            </div>
          )}
        </div>
      )}
      <div style={{ minWidth: 0, gridColumn: wide ? 2 : undefined }}>{children}</div>
    </div>
  );
}

/** A long title cut at a word for the narrow label column. */
function shorten(title: string) {
  if (title.length <= WIDE_TITLE) return title;
  const cut = title.slice(0, WIDE_TITLE - 4);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 12)).replace(/[\s,;:–-]+$/, "")} …`;
}

function Entry({ cv, entry }: { cv: Cv; entry: CvEntry }) {
  const title = entry.title.trim();
  const where = [entry.org, entry.place]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
  const head = title || where;
  const sub = title ? where : "";
  const dates = formatRange(entry, cv.lang, cv.design.dates);
  return (
    <div>
      {(head || dates) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "5mm" }}>
          <div style={{ fontWeight: 600, color: "var(--cv-ink)", minWidth: 0, ...HYPHENS }}>{head}</div>
          {dates && <div style={{ flexShrink: 0, whiteSpace: "nowrap", color: "var(--cv-ink-3)", fontSize: "0.9em", fontVariantNumeric: "tabular-nums" }}>{dates}</div>}
        </div>
      )}
      {sub && <div style={{ color: "var(--cv-ink-2)", ...HYPHENS }}>{sub}</div>}
      <Details text={entry.text} style={{ paddingTop: head || dates ? "0.3em" : 0 }} />
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
  // Only a real photo: this design never draws initials.
  const photo = cv.design.portrait === "photo" && Boolean(cv.person.photo);
  return (
    <div lang={cv.lang}>
      <style>{CONTINUED_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8mm" }}>
        <div style={{ flex: 1, minWidth: 0, paddingTop: photo ? "1mm" : 0 }}>
          {name && (
            <div style={{ ...HEADING, fontWeight: 300, fontSize: "2.9em", lineHeight: 1.05, letterSpacing: "-0.022em", color: "var(--cv-ink)", overflowWrap: "break-word" }}>{name}</div>
          )}
          {headline && <div style={{ marginTop: name ? "0.5em" : 0, fontSize: "1.1em", lineHeight: 1.35, color: "var(--cv-ink-2)" }}>{headline}</div>}
          {items.length > 0 && <Flow items={items} style={{ marginTop: name || headline ? "1.05em" : 0, fontSize: "0.9em", color: "var(--cv-ink-2)" }} />}
        </div>
        {photo && <Portrait cv={cv} width={26} height={cv.design.photoShape === "circle" ? 26 : 32.5} />}
      </div>
      {/* An SVG line keeps its exact 0.4 mm in print (a box's height is rounded to whole pixels there). */}
      <svg aria-hidden viewBox="0 0 14 2" preserveAspectRatio="none" style={{ display: "block", width: "14mm", height: "2mm", marginTop: "5.9mm" }}>
        <rect y={1.6} width={14} height={0.4} style={{ fill: LINE }} />
      </svg>
    </div>
  );
}

/** Five dots, 0.42em each with 0.19em between them: 2.86em. */
const DOTS_EM = 2.86;

/**
 * Skills in two half columns, the dots at the end of each. When a name would not fit on one line
 * next to its dots, one skill per row instead, the dots on the axis of the second half column.
 */
function Skills({ cv, skills, levels }: { cv: Cv; skills: CvSkill[]; levels: boolean }) {
  const dots = (k: CvSkill) =>
    levels && k.level > 0 ? (
      <span style={{ display: "inline-flex", position: "relative", top: "-0.05em" }}>
        <LevelDots level={k.level} on={STRONG} size={0.42} />
      </span>
    ) : null;
  const em = EM[cv.design.size];
  const room = levels && skills.some((k) => k.level > 0) ? (HALF - 3) / em - DOTS_EM : HALF / em;
  const fits = skills.every((k) => textEm(k.name) <= room - 0.2);
  if (!fits) {
    return (
      <div style={table}>
        {skills.map((k) => (
          <Fragment key={k.id}>
            <span style={{ minWidth: 0, ...HYPHENS }}>{k.name}</span>
            <span>{dots(k)}</span>
          </Fragment>
        ))}
      </div>
    );
  }
  return (
    <div style={pairs}>
      {skills.map((k) => (
        <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "3mm" }}>
          <span style={{ minWidth: 0, ...HYPHENS }}>{k.name}</span>
          {dots(k)}
        </div>
      ))}
    </div>
  );
}

/**
 * "Englisch – Gute Kenntnisse (B1)" in two half columns; the dash stays with the name and the level
 * with its CEFR, so a line can only break after the dash. When a line would not fit, one language
 * per row instead, the level on the axis of the second half column.
 */
function Languages({ cv, languages }: { cv: Cv; languages: CvLanguage[] }) {
  const levels = CV_LABELS[cv.lang].languageLevels;
  const level = (x: CvLanguage) => `${levels[x.level]}${x.cefr ? ` (${x.cefr})` : ""}`;
  const room = HALF / EM[cv.design.size];
  const fits = languages.every((x) => textEm(x.name, true) + textEm(` – ${level(x)}`) <= room - 0.2);
  const name = (x: CvLanguage) => <span style={{ fontWeight: 600 }}>{x.name}</span>;
  if (!fits) {
    return (
      <div style={table}>
        {languages.map((x) => (
          <Fragment key={x.id}>
            <span style={{ minWidth: 0, ...HYPHENS }}>{name(x)}</span>
            <span style={{ color: "var(--cv-ink-2)", whiteSpace: "nowrap" }}>{level(x)}</span>
          </Fragment>
        ))}
      </div>
    );
  }
  return (
    <div style={pairs}>
      {languages.map((x) => (
        <div key={x.id} style={HYPHENS}>
          {name(x)}
          <span style={{ color: "var(--cv-ink-3)" }}>{"\u00a0– "}</span>
          <span style={{ color: "var(--cv-ink-2)", whiteSpace: "nowrap" }}>{level(x)}</span>
        </div>
      ))}
    </div>
  );
}

export const minimal: CvTemplate = {
  id: "minimal",
  geometry: () => ({ margin: M, marginNext: { top: M.top, bottom: M.bottom }, header: "full", headerGap: 0 }),
  blocks: (cv) => {
    const l = CV_LABELS[cv.lang];
    const blocks: CvBlock[] = [{ key: "header", column: "header", node: <Header cv={cv} /> }];
    // A section's title shares a row with its first block, so it can never be left alone at the bottom of a page.
    const row = (key: string, title: string | undefined, top: string, node: ReactNode, extra?: Partial<CvBlock>, continues?: string) =>
      blocks.push({
        key,
        column: "main",
        ...extra,
        node: (
          <Row cv={cv} title={title} continues={continues} top={top}>
            {node}
          </Row>
        ),
      });

    if (cv.summary.trim()) row("summary", l.profile, SECTION_GAP, <Details text={cv.summary} color="var(--cv-ink)" />);

    for (const s of visibleSections(cv)) {
      const title = sectionTitle(s, cv.lang);
      if (s.kind === "skills") {
        row(s.id, title, SECTION_GAP, <Skills cv={cv} skills={s.skills} levels={s.showLevels} />);
      } else if (s.kind === "languages") {
        row(s.id, title, SECTION_GAP, <Languages cv={cv} languages={s.languages} />);
      } else if (s.kind === "interests") {
        row(s.id, title, SECTION_GAP, <Flow items={interestList(s.text)} />);
      } else {
        s.entries.forEach((e, i) =>
          row(`${s.id}-${e.id}`, i === 0 ? title : undefined, i === 0 ? SECTION_GAP : ENTRY_GAP, <Entry cv={cv} entry={e} />, undefined, i === 0 ? undefined : title),
        );
      }
    }

    if (cv.closing.show) row("closing", undefined, "0.6em", <Closing cv={cv} />, { keepWithPrevious: true });
    return blocks;
  },
  Overlay: ({ cv, page, pages, geometry }: CvBackgroundProps) =>
    pages > 1 ? (
      <div
        style={{
          position: "absolute",
          left: `${geometry.margin.left}mm`,
          right: `${geometry.margin.right}mm`,
          bottom: "10mm",
          display: "grid",
          gridTemplateColumns: `${LABEL}mm minmax(0, 1fr) auto`,
          columnGap: `${GAP}mm`,
          fontSize: "0.74em",
          color: "var(--cv-ink-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span />
        {/* Page 1 opens with the name; from page 2 on it says whose page this is. */}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page > 0 ? fullName(cv.person) : ""}</span>
        <span>{WORDS[cv.lang].page(page + 1, pages)}</span>
      </div>
    ) : null,
};
