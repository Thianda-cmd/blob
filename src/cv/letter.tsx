import type { CSSProperties } from "react";
import { CV_LABELS } from "./labels";
import { enclosureList, fullName, letterAddress, letterGreeting, letterPlaceDate, paragraphs } from "./model";
import { HEADING, SignatureMark } from "./render";
import type { Cv, CvTemplateId } from "./types";
import type { CvBlock, CvTemplate } from "./templates/types";

// The cover letter (Anschreiben), laid out by the CV engine like a CV design, so it is paginated,
// previewed and printed the same way. Its letterhead follows the CV's design (a colour band, a name
// over a line, or a centred name) in the CV's colour and fonts, so letter and CV read as one
// application. Below it the usual German order (DIN 5008, without the window-envelope fields: the
// letter is sent as a PDF): address, place and date, subject, greeting, text, regards, signature,
// enclosures.

type Letterhead = "band" | "line" | "centered";

const LETTERHEAD: Record<CvTemplateId, Letterhead> = {
  classic: "line",
  compact: "line",
  modern: "band",
  creative: "band",
  elegant: "centered",
  minimal: "centered",
};

/** Space under the letterhead on the colour band, in mm. */
const BAND_BOTTOM = 9;

/** Letters read a little larger than CVs, with roomier lines. */
const TEXT: CSSProperties = { fontSize: "1.1em", lineHeight: 1.5 };

const ON = "var(--cv-on-accent)";
const ON_SOFT = "color-mix(in srgb, var(--cv-on-accent) 85%, transparent)";

/** The sender's address, phone and email, for the letterhead. */
function senderLines(cv: Cv) {
  const p = cv.person;
  const town = [p.postalCode.trim(), p.city.trim()].filter(Boolean).join(" ");
  return [p.street.trim(), town, p.phone.trim(), p.email.trim()].filter(Boolean);
}

function Sender({ cv, color, align }: { cv: Cv; color: string; align: "left" | "right" }) {
  const lines = senderLines(cv);
  if (!lines.length) return null;
  return (
    <div style={{ fontSize: "0.88em", lineHeight: 1.45, color, textAlign: align, flexShrink: 0, maxWidth: "70mm", overflowWrap: "anywhere" }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

function Head({ cv }: { cv: Cv }) {
  const style = LETTERHEAD[cv.design.template];
  const name = fullName(cv.person);
  if (style === "centered") {
    const lines = senderLines(cv);
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ ...HEADING, fontSize: "2.1em", lineHeight: 1.1, letterSpacing: "0.03em", color: "var(--cv-ink)" }}>{name}</div>
        {lines.length > 0 && <div style={{ marginTop: "0.7em", fontSize: "0.88em", color: "var(--cv-ink-2)" }}>{lines.join("  ·  ")}</div>}
        <div style={{ height: "0.3mm", width: "28mm", background: "var(--cv-accent)", margin: "4.5mm auto 0" }} />
      </div>
    );
  }
  const band = style === "band";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "8mm" }}>
        <div style={{ ...HEADING, minWidth: 0, fontSize: "2.2em", lineHeight: 1.08, letterSpacing: "-0.01em", color: band ? ON : "var(--cv-ink)" }}>{name}</div>
        <Sender cv={cv} color={band ? ON_SOFT : "var(--cv-ink-2)"} align="right" />
      </div>
      {!band && <div style={{ height: "0.6mm", background: "var(--cv-accent)", marginTop: "4.5mm" }} />}
    </div>
  );
}

const text = (extra?: CSSProperties): CSSProperties => ({ ...TEXT, ...extra });

export const letterTemplate: CvTemplate = {
  id: "letter",
  geometry: (cv) =>
    LETTERHEAD[cv.design.template] === "band"
      ? { margin: { top: 13, right: 20, bottom: 18, left: 25 }, marginNext: { top: 20, bottom: 18 }, header: "full", headerGap: BAND_BOTTOM + 12 }
      : { margin: { top: 18, right: 20, bottom: 18, left: 25 }, marginNext: { top: 20, bottom: 18 }, header: "full", headerGap: 12 },
  blocks: (cv) => {
    const l = cv.letter;
    const labels = CV_LABELS[cv.lang];
    const blocks: CvBlock[] = [{ key: "head", column: "header", node: <Head cv={cv} /> }];
    const address = letterAddress(cv);
    if (address.length) {
      blocks.push({
        key: "address",
        column: "main",
        node: (
          <div style={text()}>
            {address.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ),
      });
    }
    blocks.push({
      key: "date",
      column: "main",
      // Today's date can differ between the server and the browser (time zones, midnight).
      node: (
        <div style={text({ paddingTop: address.length ? "2em" : 0, textAlign: "right", color: "var(--cv-ink-2)" })} suppressHydrationWarning>
          {letterPlaceDate(cv)}
        </div>
      ),
    });
    if (l.subject.trim() || l.reference.trim()) {
      blocks.push({
        key: "subject",
        column: "main",
        keepWithNext: true,
        node: (
          <div style={text({ paddingTop: "1.9em" })}>
            {l.subject.trim() && <div style={{ fontWeight: 700, color: "var(--cv-accent-ink)" }}>{l.subject}</div>}
            {l.reference.trim() && <div style={{ color: "var(--cv-ink-2)" }}>{l.reference}</div>}
          </div>
        ),
      });
    }
    blocks.push({ key: "greeting", column: "main", keepWithNext: true, node: <div style={text({ paddingTop: "1.9em" })}>{letterGreeting(cv)}</div> });
    (["opening", "body", "ending"] as const).forEach((part) =>
      paragraphs(l[part]).forEach((p, i) => blocks.push({ key: `${part}-${i}`, column: "main", node: <p style={text({ margin: 0, paddingTop: "1em" })}>{p}</p> })),
    );
    blocks.push({
      key: "regards",
      column: "main",
      keepWithPrevious: true,
      node: (
        <div style={text({ paddingTop: "1.5em" })}>
          <div>{l.regards.trim() || labels.regards}</div>
          <div style={{ height: "16mm", display: "flex", alignItems: "flex-end", paddingBottom: "1mm" }}>
            {cv.closing.signature && <SignatureMark signature={cv.closing.signature} height={13.5} />}
          </div>
          <div>{fullName(cv.person)}</div>
        </div>
      ),
    });
    const enclosures = enclosureList(l.enclosures);
    if (enclosures.length) {
      blocks.push({
        key: "enclosures",
        column: "main",
        keepWithPrevious: true,
        node: (
          <div style={text({ paddingTop: "1.6em", fontSize: "1em", color: "var(--cv-ink-2)" })}>
            <div style={{ fontWeight: 600, color: "var(--cv-ink)" }}>{labels.enclosures}</div>
            {enclosures.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ),
      });
    }
    return blocks;
  },
  Background: ({ cv, page, headerHeight, geometry }) =>
    page === 0 && LETTERHEAD[cv.design.template] === "band" ? (
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: `${geometry.margin.top + headerHeight + BAND_BOTTOM}mm`, background: "var(--cv-accent)" }} />
    ) : null,
  Overlay: ({ page, pages }) =>
    pages > 1 ? (
      <div style={{ position: "absolute", bottom: "8mm", right: "20mm", fontSize: "0.8em", color: "var(--cv-ink-3)" }}>
        {page + 1} / {pages}
      </div>
    ) : null,
};
