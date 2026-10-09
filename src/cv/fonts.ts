import { FONTS } from "@/components/deck/deck";
import type { CvFontPair } from "./types";

/**
 * Typeface pairs for CVs, built from the presentation fonts. The page needs `deckFontVars`
 * (src/components/deck/fonts.ts) on an ancestor so the --deck-* variables resolve.
 */
export const CV_FONTS: Record<CvFontPair, { label: string; heading: string; body: string; headingWeight: number }> = {
  clean: { label: "Inter", heading: FONTS.inter.family, body: FONTS.inter.family, headingWeight: 650 },
  friendly: { label: "DM Sans", heading: FONTS["dm-sans"].family, body: FONTS["dm-sans"].family, headingWeight: 650 },
  modern: { label: "Space Grotesk · Inter", heading: FONTS.space.family, body: FONTS.inter.family, headingWeight: 600 },
  classic: { label: "Source Serif", heading: FONTS["source-serif"].family, body: FONTS["source-serif"].family, headingWeight: 600 },
  elegant: { label: "Playfair · Lora", heading: FONTS.playfair.family, body: FONTS.lora.family, headingWeight: 600 },
  editorial: { label: "Fraunces · Geist", heading: FONTS.fraunces.family, body: FONTS.geist.family, headingWeight: 600 },
};

export const CV_FONT_IDS = Object.keys(CV_FONTS) as CvFontPair[];
