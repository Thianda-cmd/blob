import { DM_Sans, Fraunces, Instrument_Serif, Inter, JetBrains_Mono, Lora, Playfair_Display, Space_Grotesk } from "next/font/google";

/**
 * Extra typefaces for deck themes. Geist, Bricolage and Source Serif come from the root
 * layout. These are not preloaded: a browser only downloads the ones a slide actually uses.
 */

const inter = Inter({ subsets: ["latin"], variable: "--deck-inter", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--deck-dm-sans", display: "swap", preload: false });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--deck-space", display: "swap", preload: false });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--deck-fraunces", display: "swap", preload: false });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--deck-instrument", display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--deck-playfair", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--deck-lora", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--deck-mono", display: "swap", preload: false });

/** Put this class on any element that renders slide text so the --deck-* font variables resolve. */
export const deckFontVars = [inter, dmSans, space, fraunces, instrument, playfair, lora, mono].map((f) => f.variable).join(" ");
