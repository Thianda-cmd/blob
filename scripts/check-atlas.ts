// Checks every model of the Atlas (src/learn/atlas) before you commit.
//
//   npm run check:atlas
//
// For every model in src/learn/atlas/catalog.ts it loads the full model (drawings and text) and checks:
//   - the catalog: unique slugs, a loader, text for the model (content registry), bilingual titles
//   - every view: unique id, an intro, at least one item; parts have a marker inside the drawing and
//     inside the narrow-screen crop (`fit`); a label pill (when placed) inside the drawing
//   - every Text has a non-empty English and German side; no stray "$" (inline maths) or "**" pairs
//   - quiz: at least 4 parts (or 3 steps) to build questions from, textbook questions have 2+ options,
//     a valid right answer and no duplicate options; clues don't give the name away
//   - timeline: years ascending once sorted, ids unique, who/when filled in
// Problems make the script exit with 1.
import { resolveText, type Text } from "@/i18n/text";
import { ATLAS } from "@/learn/atlas/catalog";
import { ATLAS_CONTENT, atlasSearchIndex } from "@/learn/atlas/content";
import { hasAtlasModel, loadAtlasModel } from "@/learn/atlas/models";
import type { AtlasView, Question } from "@/learn/atlas/types";

const problems: string[] = [];
const fail = (where: string, msg: string) => problems.push(`${where}: ${msg}`);

function text(where: string, t: Text | undefined, required = true) {
  if (t == null) {
    if (required) fail(where, "missing text");
    return;
  }
  for (const locale of ["en", "de"] as const) {
    const s = resolveText(t, locale);
    if (!s.trim()) fail(where, `empty ${locale} text`);
    if ((s.match(/\$/g) ?? []).length % 2) fail(where, `odd number of "$" in ${locale}: ${s.slice(0, 60)}`);
    if ((s.match(/\*\*/g) ?? []).length % 2) fail(where, `odd number of "**" in ${locale}`);
  }
}

function question(where: string, q: Question) {
  text(`${where} question`, q.q);
  if (q.options.length < 2) fail(where, "a question needs 2+ options");
  if (q.correct < 0 || q.correct >= q.options.length) fail(where, `correct index ${q.correct} out of range`);
  q.options.forEach((o, i) => text(`${where} option ${i + 1}`, o));
  for (const locale of ["en", "de"] as const) {
    const seen = new Set<string>();
    for (const o of q.options) {
      const k = resolveText(o, locale).toLowerCase();
      if (seen.has(k)) fail(where, `duplicate option (${locale}): ${k}`);
      seen.add(k);
    }
  }
  text(`${where} why`, q.why, false);
}

function view(where: string, v: AtlasView) {
  text(`${where} title`, v.title);
  text(`${where} intro`, v.intro);
  (v.questions ?? []).forEach((q, i) => question(`${where} q${i + 1}`, q));
  if (v.kind === "parts") {
    if (v.parts.length < 4) fail(where, "fewer than 4 parts: the quiz can't offer 4 names");
    const ids = new Set<string>();
    for (const p of v.parts) {
      const w = `${where}/${p.id}`;
      if (ids.has(p.id)) fail(w, "duplicate part id");
      ids.add(p.id);
      if (!p.spot) {
        fail(w, "no spot (marker position)");
        continue;
      }
      const [x, y] = p.spot.at;
      if (!(x >= 0 && y >= 0 && x <= v.width && y <= v.height)) fail(w, `marker (${x}, ${y}) outside the ${v.width}×${v.height} drawing`);
      if (v.fit) {
        const [fx, fy, fw, fh] = v.fit;
        if (!(x >= fx && y >= fy && x <= fx + fw && y <= fy + fh)) fail(w, `marker (${x}, ${y}) outside the narrow crop ${v.fit.join(", ")}`);
      }
      if (p.spot.label) {
        const [lx, ly] = p.spot.label;
        if (!(lx >= 0 && ly >= 0 && lx <= v.width && ly <= v.height)) fail(w, `label (${lx}, ${ly}) outside the drawing`);
      }
      text(`${w} name`, p.info.name);
      text(`${w} role`, p.info.role);
      text(`${w} aka`, p.info.aka, false);
      text(`${w} tag`, p.info.tag, false);
      text(`${w} tip`, p.info.tip, false);
      text(`${w} clue`, p.info.clue, false);
      p.info.facts.forEach((f, i) => text(`${w} fact ${i + 1}`, f));
      // A clue must not simply contain the name it asks for.
      if (p.info.clue) {
        for (const locale of ["en", "de"] as const) {
          const name = resolveText(p.info.name, locale).toLowerCase().replace(/\s*\(.*\)$/, "");
          if (name.length > 3 && resolveText(p.info.clue, locale).toLowerCase().includes(name)) fail(w, `clue gives the name away (${locale})`);
        }
      }
    }
  } else if (v.kind === "steps") {
    if (v.steps.length < 3) fail(where, "fewer than 3 steps");
    v.steps.forEach((s, i) => {
      const w = `${where}/step ${i + 1}`;
      text(`${w} title`, s.title);
      text(`${w} short`, s.short);
      text(`${w} body`, s.body);
      text(`${w} time`, s.time, false);
      text(`${w} tip`, s.tip, false);
      (s.facts ?? []).forEach((f, k) => text(`${w} fact ${k + 1}`, f));
    });
  } else {
    if (v.events.length < 5) fail(where, "fewer than 5 milestones");
    const ids = new Set<string>();
    v.events.forEach((e, i) => {
      const w = `${where}/${e.id}`;
      if (ids.has(e.id)) fail(w, "duplicate id");
      ids.add(e.id);
      if (i > 0 && e.year < v.events[i - 1].year) fail(w, "events not sorted by year");
      text(`${w} who`, e.who);
      text(`${w} title`, e.title);
      text(`${w} body`, e.body);
      text(`${w} when`, e.when, false);
      text(`${w} tip`, e.tip, false);
      (e.facts ?? []).forEach((f, k) => text(`${w} fact ${k + 1}`, f));
    });
  }
}

async function main() {
  const slugs = new Set<string>();
  for (const meta of ATLAS) {
    if (slugs.has(meta.slug)) fail(meta.slug, "duplicate slug");
    slugs.add(meta.slug);
    text(`${meta.slug} title`, meta.title);
    text(`${meta.slug} subtitle`, meta.subtitle);
    text(`${meta.slug} blurb`, meta.blurb);
    if (!hasAtlasModel(meta.slug)) {
      fail(meta.slug, "no loader in models/index.ts");
      continue;
    }
    if (!ATLAS_CONTENT[meta.slug]) fail(meta.slug, "no text in content.ts");
    const model = await loadAtlasModel(meta.slug);
    if (model.slug !== meta.slug) fail(meta.slug, `model says slug "${model.slug}"`);
    const ids = new Set<string>();
    for (const v of model.views) {
      if (ids.has(v.id)) fail(`${meta.slug}/${v.id}`, "duplicate view id");
      ids.add(v.id);
      view(`${meta.slug}/${v.id}`, v);
    }
    // The text registry must describe the same views as the model.
    const contentViews = Object.keys(ATLAS_CONTENT[meta.slug]?.views ?? {});
    if (contentViews.join() !== model.views.map((v) => v.id).join()) fail(meta.slug, `views differ: content ${contentViews.join()} vs model ${model.views.map((v) => v.id).join()}`);
  }
  const hits = atlasSearchIndex().length;
  if (problems.length) {
    console.log(`check:atlas: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const p of problems) console.log(`  ${p}`);
    process.exit(1);
  }
  console.log(`check:atlas: ${ATLAS.length} models, ${hits} searchable items, all fine`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
