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

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AtlasModelPage({ params, searchParams }: PageProps<"/learn/atlas/[model]">) {
  const [{ model }, query] = await Promise.all([params, searchParams]);
  if (!findAtlas(model)) notFound();
  const { atlas, days } = await loadLearnState();
  return (
    <AtlasViewer
      // A link to another view or structure of the same model starts the page fresh there.
      key={`${model}:${one(query.view) ?? ""}:${one(query.item) ?? ""}`}
      slug={model}
      initialView={one(query.view)}
      initialItem={one(query.item)}
      progress={atlas[model] ?? EMPTY_PROGRESS(atlasKey(model))}
      days={days}
    />
  );
}
