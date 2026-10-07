// Lists every public lesson picture (/show/<subject>/<topic>/<level>/<id>) in src/learn/show-manifest.json, so
// server pages know a picture's title for link previews, can count a topic's pictures and can tell unknown ids.
// The lessons themselves are client modules, which server components can't read; this script can.
//
//   npx tsx --tsconfig tsconfig.json scripts/show-manifest.ts           rewrite the manifest (runs before every build)
//   npx tsx --tsconfig tsconfig.json scripts/show-manifest.ts --check   also list ids that would disappear
//
// A picture's id is its step's `id` or else the slug of its English title, so renaming a step changes its public
// link. --check names such links; give the step `id: "<old id>"` to keep them working.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveText } from "@/i18n/text";
import { CATALOG } from "@/learn/catalog";
import { showItems } from "@/learn/showcase";
import { loadTopic } from "@/learn/topics";
import type { ShowEntry, ShowManifest } from "@/learn/showManifest";

const OUT = resolve(process.cwd(), "src/learn/show-manifest.json");

/** Rich text as plain text for a description: no ** or $, one line, at most 200 characters. */
function plain(text: string) {
  const s = text.replace(/\*\*/g, "").replace(/\$([^$]*)\$/g, "$1").replace(/\s+/g, " ").trim();
  return s.length > 200 ? `${s.slice(0, 197).replace(/\s+\S*$/, "")} …` : s;
}

async function main() {
  const manifest: ShowManifest = {};
  let failed = 0;
  for (const meta of CATALOG) {
    try {
      const topic = await loadTopic(meta.slug);
      manifest[meta.slug] = showItems(topic).map(
        (item): ShowEntry => ({
          level: item.level,
          id: item.id,
          kind: item.kind,
          title: { en: resolveText(item.title, "en"), de: resolveText(item.title, "de") },
          ...(item.body ? { text: { en: plain(resolveText(item.body, "en")), de: plain(resolveText(item.body, "de")) } } : {}),
        }),
      );
    } catch (e) {
      // A topic that can't load here keeps its pictures out of the manifest; its pages still work in the browser.
      failed++;
      console.warn(`show-manifest: skipped ${meta.slug}: ${(e as Error).message}`);
    }
  }

  if (process.argv.includes("--check") && existsSync(OUT)) {
    const before = JSON.parse(readFileSync(OUT, "utf8")) as ShowManifest;
    const gone = Object.entries(before).flatMap(([slug, list]) =>
      list.filter((o) => !(manifest[slug] ?? []).some((n) => n.level === o.level && n.id === o.id)).map((o) => `${slug}/${o.level}/${o.id}`),
    );
    if (gone.length) console.log(`These public links stop working (give the step its old id to keep them):\n  ${gone.join("\n  ")}`);
  }

  writeFileSync(OUT, `${JSON.stringify(manifest, null, 1)}\n`);
  const count = Object.values(manifest).reduce((n, l) => n + l.length, 0);
  console.log(`show-manifest: ${count} pictures in ${Object.keys(manifest).length} topics${failed ? `, ${failed} topics skipped` : ""}`);
}

main().then(() => process.exit(0));
