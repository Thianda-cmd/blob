import type { Locale } from "@/i18n/config";
import { resolveText } from "@/i18n/text";
import type { TopicMeta } from "@/learn/catalog";
import { AREAS } from "@/learn/types";

/**
 * A topic's names for the reader: the title in their language, and for English
 * readers the German name from class as a subtitle (in German the title already is it).
 */
export function topicNames(meta: Pick<TopicMeta, "title" | "de" | "area">, locale: Locale) {
  return {
    title: resolveText(meta.title, locale),
    /** German school name, only when it differs from what the reader sees as the title. */
    school: locale === "en" ? meta.de : null,
    area: resolveText(AREAS[meta.area].title, locale),
  };
}
