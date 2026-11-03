import type { Node as PMNode } from "@tiptap/pm/model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nodes whose `id` attribute points at another page. */
const LINKING_NODES = new Set(["pageLink", "deckEmbed"]);
/** Nodes whose `pageId` attribute does (a spreadsheet shown in the note). */
const PAGE_ID_NODES = new Set(["sheetEmbed"]);

/** The page a Blob link points at ("/p/<id>", with or without ?query or #hash), or null. */
export function pageIdFromHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const m = href.match(/^\/p\/([0-9a-f-]{36})(?:[?#].*)?$/i);
  return m && UUID.test(m[1]) ? m[1].toLowerCase() : null;
}

/**
 * Every page the document links to: page link blocks, [[ links (text linked to "/p/<id>"),
 * embedded presentations and spreadsheets. Saved as pages.links for backlinks and the knowledge
 * graph.
 */
export function collectLinks(doc: PMNode, self: string): string[] {
  const out = new Set<string>();
  doc.descendants((node) => {
    if (LINKING_NODES.has(node.type.name)) {
      const id = node.attrs.id;
      if (typeof id === "string" && UUID.test(id)) out.add(id.toLowerCase());
    }
    if (PAGE_ID_NODES.has(node.type.name)) {
      const id = node.attrs.pageId;
      if (typeof id === "string" && UUID.test(id)) out.add(id.toLowerCase());
    }
    for (const mark of node.marks) {
      if (mark.type.name !== "link") continue;
      const id = pageIdFromHref(mark.attrs.href);
      if (id) out.add(id);
    }
    return true;
  });
  out.delete(self.toLowerCase());
  return [...out].slice(0, 500);
}
