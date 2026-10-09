import type { CSSProperties, ReactNode } from "react";
import { CV_LABELS } from "../labels";
import { contactLines, formatRange, fullName, interestList, languageLevel, sectionTitle, visibleSections } from "../model";
import { Closing, CvText, HEADING, LevelDots, Portrait } from "../render";
import type { Cv, CvEntry } from "../types";
import type { CvBlock, CvTemplate } from "./types";

// "Klassisch": the tabular German CV (tabellarischer Lebenslauf). A title and the photo at the top,
// then every section as a two-column table: dates on the left, what and where on the right.

/** Width of the left (date) column, in mm. */
const LEFT = 36;

const row: CSSProperties = { display: "grid", gridTemplateColumns: `${LEFT}mm 1fr`, columnGap: "5mm" };

function Heading({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingTop: "1.5em", paddingBottom: "0.55em" }}>
      <div style={{ ...HEADING, fontSize: "1.28em", color: "var(--cv-accent)", letterSpacing: "0.01em" }}>{children}</div>
      <div style={{ height: "0.3mm", background: "var(--cv-accent)", opacity: 0.55, marginTop: "0.3em" }} />
    </div>
  );
}

function Entry({ cv, entry }: { cv: Cv; entry: CvEntry }) {
  const where = [entry.org, entry.place].filter((s) => s.trim()).join(", ");
  return (
    <div style={{ ...row, paddingBottom: "0.8em" }}>
      <div style={{ color: "var(--cv-ink-3)", fontVariantNumeric: "tabular-nums" }}>{formatRange(entry, cv.lang, cv.design.dates)}</div>
      <div>
        {entry.title.trim() && <div style={{ fontWeight: 600, color: "var(--cv-ink)" }}>{entry.title}</div>}
        {where && <div style={{ color: entry.title.trim() ? "var(--cv-ink-2)" : "var(--cv-ink)", fontWeight: entry.title.trim() ? 400 : 600 }}>{where}</div>}
        <CvText text={entry.text} style={{ marginTop: "0.2em" }} />
      </div>
    </div>
  );
}

function Header({ cv }: { cv: Cv }) {
  const l = CV_LABELS[cv.lang];
  return (
    <div style={{ display: "flex", gap: "8mm", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...HEADING, fontSize: "2.5em", lineHeight: 1.05, color: "var(--cv-ink)", letterSpacing: "-0.01em" }}>{l.document}</div>
        <div style={{ height: "0.6mm", width: "18mm", background: "var(--cv-accent)", margin: "0.7em 0 0.8em" }} />
        <div style={{ fontSize: "1.3em", fontWeight: 600 }}>{fullName(cv.person)}</div>
        {cv.person.headline.trim() && <div style={{ color: "var(--cv-ink-2)", marginTop: "0.15em" }}>{cv.person.headline}</div>}
      </div>
      <Portrait cv={cv} width={34} height={cv.design.photoShape === "circle" ? 34 : 43} />
    </div>
  );
}

function Personal({ cv }: { cv: Cv }) {
  const lines = contactLines(cv);
  if (!lines.length) return null;
  return (
    <div style={{ display: "grid", rowGap: "0.25em" }}>
      {lines.map((line, i) => (
        <div key={i} style={row}>
          <div style={{ color: "var(--cv-ink-3)" }}>{line.label}</div>
          <div style={{ overflowWrap: "anywhere" }}>{line.value}</div>
        </div>
      ))}
    </div>
  );
}

export const classic: CvTemplate = {
  id: "classic",
  geometry: () => ({ margin: { top: 17, right: 18, bottom: 16, left: 20 }, marginNext: { top: 16, bottom: 16 }, header: "full", headerGap: 2 }),
  blocks: (cv) => {
    const l = CV_LABELS[cv.lang];
    const blocks: CvBlock[] = [{ key: "header", column: "header", node: <Header cv={cv} /> }];
    const heading = (key: string, title: string) => blocks.push({ key: `${key}-h`, column: "main", keepWithNext: true, node: <Heading>{title}</Heading> });

    if (contactLines(cv).length) {
      heading("personal", l.personal);
      blocks.push({ key: "personal", column: "main", node: <Personal cv={cv} /> });
    }
    if (cv.summary.trim()) {
      heading("summary", l.profile);
      blocks.push({ key: "summary", column: "main", node: <CvText text={cv.summary} style={{ color: "var(--cv-ink)" }} /> });
    }

    for (const s of visibleSections(cv)) {
      heading(s.id, sectionTitle(s, cv.lang));
      if (s.kind === "skills") {
        blocks.push({
          key: s.id,
          column: "main",
          node: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8mm", rowGap: "0.35em" }}>
              {s.skills.map((k) => (
                <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "3mm" }}>
                  <span>{k.name}</span>
                  {s.showLevels && k.level > 0 && <LevelDots level={k.level} />}
                </div>
              ))}
            </div>
          ),
        });
      } else if (s.kind === "languages") {
        blocks.push({
          key: s.id,
          column: "main",
          node: (
            <div style={{ display: "grid", rowGap: "0.3em" }}>
              {s.languages.map((x) => (
                <div key={x.id} style={row}>
                  <div style={{ fontWeight: 600 }}>{x.name}</div>
                  <div style={{ color: "var(--cv-ink-2)" }}>{languageLevel(x, cv.lang)}</div>
                </div>
              ))}
            </div>
          ),
        });
      } else if (s.kind === "interests") {
        blocks.push({ key: s.id, column: "main", node: <div style={{ color: "var(--cv-ink)" }}>{interestList(s.text).join(" · ")}</div> });
      } else {
        for (const e of s.entries) blocks.push({ key: `${s.id}-${e.id}`, column: "main", node: <Entry cv={cv} entry={e} /> });
      }
    }

    if (cv.closing.show) blocks.push({ key: "closing", column: "main", keepWithPrevious: true, node: <Closing cv={cv} /> });
    return blocks;
  },
  Overlay: ({ page, pages }) =>
    pages > 1 ? (
      <div style={{ position: "absolute", bottom: "8mm", right: "18mm", fontSize: "0.8em", color: "var(--cv-ink-3)" }}>
        {page + 1} / {pages}
      </div>
    ) : null,
};
