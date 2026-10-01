import { clsx, type ClassValue } from "clsx";

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

export function pageTitle(title: string | null | undefined, kind: "note" | "deck" = "note") {
  return title?.trim() || (kind === "deck" ? "Untitled presentation" : "Untitled");
}

export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || "";
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
