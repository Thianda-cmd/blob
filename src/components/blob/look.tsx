"use client";

import { createContext, useContext, type ReactNode } from "react";

// What Blob wears and which colour he is. The student picks it in Blob's corner (/blob); it's saved
// in profiles.blob_look and every Blob in the app wears it.

export const HATS = [
  "party",
  "crown",
  "tophat",
  "wizard",
  "witch",
  "santa",
  "chef",
  "viking",
  "propeller",
  "halo",
  "headphones",
  "flower",
  "bow",
  "nightcap",
  "cap",
  "beret",
] as const;
export const EYES = ["glasses", "sunglasses", "starglasses"] as const;
export const NECKS = ["bowtie", "scarf", "medal"] as const;
export const SKINS = ["classic", "mint", "sky", "sunset", "bubblegum", "gold", "ghost", "galaxy", "disco"] as const;

export type BlobHat = (typeof HATS)[number];
export type BlobEyes = (typeof EYES)[number];
export type BlobNeck = (typeof NECKS)[number];
export type BlobSkin = (typeof SKINS)[number];

/** A look: each part can be left out (nothing there). `secrets` are hidden items found. */
export type BlobLook = { hat?: BlobHat | null; eyes?: BlobEyes | null; neck?: BlobNeck | null; skin?: BlobSkin | null; secrets?: string[] };

/** Body colours per skin: light (highlight), base, deep (shadow). Classic follows the theme's purple. */
export const SKIN_COLORS: Record<Exclude<BlobSkin, "classic" | "disco">, { light: string; base: string; deep: string; face?: string }> = {
  mint: { light: "#c2f7e1", base: "#3fcf9a", deep: "#1c8a63" },
  sky: { light: "#cfe8ff", base: "#4aa3f5", deep: "#2364c4" },
  sunset: { light: "#ffe0b8", base: "#ff8a4c", deep: "#d24f24" },
  bubblegum: { light: "#ffd6ea", base: "#ff70b0", deep: "#cf3b80" },
  gold: { light: "#fff3bf", base: "#f0bf2e", deep: "#b07d0a" },
  ghost: { light: "#ffffff", base: "#e8ebf5", deep: "#aab2c8" },
  galaxy: { light: "#9c8cff", base: "#3a2a8c", deep: "#120c35", face: "#f3efff" },
};

/** Keep only known parts (the saved look is JSON from the database). */
export function cleanLook(raw: unknown): BlobLook {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = <T extends string>(list: readonly T[], v: unknown) => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);
  return {
    hat: pick(HATS, o.hat),
    eyes: pick(EYES, o.eyes),
    neck: pick(NECKS, o.neck),
    skin: pick(SKINS, o.skin),
    secrets: Array.isArray(o.secrets) ? o.secrets.filter((x): x is string => typeof x === "string").slice(0, 20) : [],
  };
}

const LookContext = createContext<BlobLook>({});

/** Every Blob inside wears this look (unless it's given its own). */
export function BlobLookProvider({ look, children }: { look: BlobLook; children: ReactNode }) {
  return <LookContext value={look}>{children}</LookContext>;
}

export const useBlobLook = () => useContext(LookContext);

/** A hat for the time of year (or night), when the student hasn't picked one. */
export function seasonalHat(now: Date): BlobHat | null {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  if (m === 10 && d >= 24) return "witch";
  if (m === 12 && d <= 26) return "santa";
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) return "party";
  if (h >= 23 || h < 5) return "nightcap";
  return null;
}
