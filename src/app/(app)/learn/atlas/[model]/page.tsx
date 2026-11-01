import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { atlasKey, findAtlas } from "@/learn/atlas/catalog";
import { AtlasViewer } from "@/learn/atlas/components/AtlasViewer";
import { EMPTY_PROGRESS } from "@/learn/progress";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/learn/atlas/[model]">): Promise<Metadata> {
  const { model } = await params;
  const meta = findAtlas(model);
  const locale = await getLocale();
  return { title: meta ? atlasText[locale].meta.model(resolveText(meta.title, locale)) : learnText[locale].meta.notFound };
}

/** New for every render of the page: a fresh render (after Back/Forward) starts the viewer over (see AtlasViewer). */
const renderId = () => crypto.randomUUID();

// The view and item (?view=…&item=…) are read by the viewer itself, from the address.
export default async function AtlasModelPage({ params }: PageProps<"/learn/atlas/[model]">) {
  const { model } = await params;
  if (!findAtlas(model)) notFound();
  const { atlas, days } = await loadLearnState();
  return (
    <AtlasViewer
      nav={renderId()}
      slug={model}
      progress={atlas[model] ?? EMPTY_PROGRESS(atlasKey(model))}
      days={days}
    />
  );
}
