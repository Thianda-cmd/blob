import { clsx, type ClassValue } from "clsx";
import type { Locale } from "@/i18n/config";
import type { PageKind } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid() {
  return crypto.randomUUID();
}

/** Only allow same-origin relative redirects such as "/home" (never "//evil.com"). */
export function safeNext(next: string | null | undefined, fallback = "/home") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const UNTITLED: Record<Locale, Record<PageKind, string>> = {
  en: { note: "Untitled", deck: "Untitled presentation", cv: "Untitled CV", folder: "New folder" },
  de: { note: "Ohne Titel", deck: "Unbenannte Präsentation", cv: "Unbenannter Lebenslauf", folder: "Neuer Ordner" },
};

/** The page's title, or "Untitled" in the reader's language. Client: pass `useLocale()`; server: `await getLocale()`. */
export function pageTitle(title: string | null | undefined, kind: PageKind, locale: Locale) {
  return title?.trim() || UNTITLED[locale][kind];
}

export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || "";
}

const GREETINGS: Record<Locale, { late: string; morning: string; afternoon: string; evening: string }> = {
  en: { late: "Up late", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  de: { late: "Noch wach", morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },
};

/** "Good morning" / "Guten Morgen"… for the time of `date`, in `locale`. */
export function greeting(date: Date, locale: Locale) {
  const g = GREETINGS[locale];
  const h = date.getHours();
  if (h < 5) return g.late;
  if (h < 12) return g.morning;
  if (h < 18) return g.afternoon;
  return g.evening;
}
