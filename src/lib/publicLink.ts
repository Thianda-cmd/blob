import type { PageKind } from "@/lib/types";

// Public links (migration 0019): anyone with the link can view a page without an account, at
// /s/<token> (and the pages inside it at /s/<token>/<page id> when the link includes them).

/** A row of public.public_links, as its owner and editors see it. */
export type PublicLink = {
  token: string;
  page_id: string;
  created_by: string;
  created_at: string;
  sub_pages: boolean;
  views: number;
  viewed_at: string | null;
};

export type PublicPageRef = { id: string; title: string; icon: string | null; kind: PageKind };

/** What public_page() returns: the page, where it sits under the link's page, what's inside. */
export type PublicView = {
  page: PublicPageRef & { content: unknown; plain_text: string; updated_at: string };
  /** The link's own page. */
  root: string;
  sub_pages: boolean;
  /** From the link's page down to the page's parent (empty on the link's own page). */
  trail: PublicPageRef[];
  /** The pages right inside (empty when the link doesn't include them). */
  children: PublicPageRef[];
  /** Pages the page links to that the link opens too. */
  linked: PublicPageRef[];
};

export const PUBLIC_TOKEN = /^[0-9a-f]{64}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The address of a page through a link: the link's own page has the short one. */
export function publicHref(token: string, pageId?: string | null, root?: string | null) {
  return pageId && pageId !== root ? `/s/${token}/${pageId}` : `/s/${token}`;
}

/** A file of a page seen through a link (the server checks it belongs to the page, then hands it out). */
export function publicFileHref(token: string, pageId: string, path: string, download?: string | null) {
  const q = new URLSearchParams({ t: token, p: pageId, f: path });
  if (download) q.set("d", download);
  return `/api/public/file?${q.toString()}`;
}
