import type { Metadata } from "next";
import { cache } from "react";
import { PublicGone } from "@/components/public/PublicGone";
import { PublicPage } from "@/components/public/PublicPage";
import { publicText } from "@/i18n/messages/public";
import { getLocale, getMessages } from "@/i18n/server";
import { PUBLIC_TOKEN, UUID, type PublicView } from "@/lib/publicLink";
import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/lib/utils";

/** The page a public link opens (its own, or one inside it), or null. Once per request. */
const loadPublic = cache(async (token: string, pageId: string | null): Promise<PublicView | null> => {
  if (!PUBLIC_TOKEN.test(token) || (pageId !== null && !UUID.test(pageId))) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_page", { p_token: token, p_page: pageId });
  return error || !data ? null : (data as PublicView);
});

async function read(params: PageProps<"/s/[token]/[[...page]]">["params"]) {
  const { token, page } = await params;
  // /s/<token> is the link's own page, /s/<token>/<id> one inside it; nothing deeper.
  if (page && page.length > 1) return null;
  return loadPublic(token, page?.[0] ?? null);
}

export async function generateMetadata({ params }: PageProps<"/s/[token]/[[...page]]">): Promise<Metadata> {
  const [view, locale, t] = await Promise.all([read(params), getLocale(), getMessages(publicText)]);
  // Never in search engines: a link someone sent is meant for whoever got it.
  const robots = { index: false, follow: false };
  if (!view) return { title: t.gone.metaTitle, robots };
  const title = pageTitle(view.page.title, view.page.kind, locale);
  const description = view.page.plain_text.replace(/\s+/g, " ").trim().slice(0, 180) || t.view.shared;
  return { title, description, robots, openGraph: { title, description, type: "article", siteName: "Blob" } };
}

export default async function PublicLinkPage({ params }: PageProps<"/s/[token]/[[...page]]">) {
  const [{ token }, view] = await Promise.all([params, read(params)]);
  return view ? <PublicPage token={token} view={view} /> : <PublicGone />;
}
