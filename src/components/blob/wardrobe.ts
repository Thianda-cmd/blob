import type { BlobEyes, BlobHat, BlobNeck, BlobSkin } from "./look";

// Blob's wardrobe: every item, and what unlocks it. Most things are earned by learning (XP,
// lessons, streaks, days), some come with the season, one is a secret.

/** What the student has done, for unlocking (made on the server from learn_progress / learn_days). */
export type BlobStats = {
  xp: number;
  lessons: number;
  frenchLessons: number;
  frenchUnits: number;
  /** The French unit "Bon appétit!" is finished (the chef's hat). */
  chef: boolean;
  bestStreak: number;
  activeDays: number;
};

export type Need =
  | { kind: "free" }
  | { kind: "xp" | "lessons" | "frenchLessons" | "frenchUnits" | "bestStreak" | "activeDays"; n: number }
  | { kind: "chef" }
  /** In this month (1-12); once worn, it stays. */
  | { kind: "month"; month: number }
  | { kind: "secret" };

export type Slot = "hat" | "eyes" | "neck" | "skin";

export type WardrobeItem =
  | { slot: "hat"; id: BlobHat; need: Need }
  | { slot: "eyes"; id: BlobEyes; need: Need }
  | { slot: "neck"; id: BlobNeck; need: Need }
  | { slot: "skin"; id: BlobSkin; need: Need };

const free: Need = { kind: "free" };

export const WARDROBE: WardrobeItem[] = [
  { slot: "hat", id: "party", need: free },
  { slot: "hat", id: "headphones", need: free },
  { slot: "hat", id: "flower", need: free },
  { slot: "hat", id: "bow", need: free },
  { slot: "hat", id: "nightcap", need: free },
  { slot: "hat", id: "cap", need: { kind: "lessons", n: 1 } },
  { slot: "hat", id: "beret", need: { kind: "frenchLessons", n: 1 } },
  { slot: "hat", id: "propeller", need: { kind: "xp", n: 300 } },
  { slot: "hat", id: "viking", need: { kind: "bestStreak", n: 3 } },
  { slot: "hat", id: "chef", need: { kind: "chef" } },
  { slot: "hat", id: "tophat", need: { kind: "bestStreak", n: 7 } },
  { slot: "hat", id: "wizard", need: { kind: "lessons", n: 25 } },
  { slot: "hat", id: "crown", need: { kind: "xp", n: 1000 } },
  { slot: "hat", id: "halo", need: { kind: "activeDays", n: 30 } },
  { slot: "hat", id: "witch", need: { kind: "month", month: 10 } },
  { slot: "hat", id: "santa", need: { kind: "month", month: 12 } },
  { slot: "eyes", id: "glasses", need: free },
  { slot: "eyes", id: "sunglasses", need: { kind: "xp", n: 150 } },
  { slot: "eyes", id: "starglasses", need: { kind: "lessons", n: 10 } },
  { slot: "neck", id: "bowtie", need: free },
  { slot: "neck", id: "medal", need: { kind: "bestStreak", n: 5 } },
  { slot: "neck", id: "scarf", need: { kind: "frenchUnits", n: 1 } },
  { slot: "skin", id: "classic", need: free },
  { slot: "skin", id: "mint", need: free },
  { slot: "skin", id: "sky", need: free },
  { slot: "skin", id: "sunset", need: { kind: "xp", n: 200 } },
  { slot: "skin", id: "bubblegum", need: { kind: "lessons", n: 5 } },
  { slot: "skin", id: "ghost", need: { kind: "activeDays", n: 14 } },
  { slot: "skin", id: "galaxy", need: { kind: "bestStreak", n: 14 } },
  { slot: "skin", id: "gold", need: { kind: "xp", n: 2000 } },
  { slot: "skin", id: "disco", need: { kind: "secret" } },
];

/** Whether an item is open, and how far along the student is (for a progress bar). */
export function itemProgress(item: WardrobeItem, stats: BlobStats, secrets: string[], month: number): { open: boolean; have: number; goal: number } {
  const need = item.need;
  switch (need.kind) {
    case "free":
      return { open: true, have: 1, goal: 1 };
    case "chef":
      return { open: stats.chef, have: stats.chef ? 1 : 0, goal: 1 };
    case "month": {
      const open = month === need.month || secrets.includes(item.id);
      return { open, have: open ? 1 : 0, goal: 1 };
    }
    case "secret": {
      const open = secrets.includes(item.id);
      return { open, have: open ? 1 : 0, goal: 1 };
    }
    default: {
      const have = stats[need.kind];
      return { open: have >= need.n, have: Math.min(have, need.n), goal: need.n };
    }
  }
}

/** The Konami code: ↑ ↑ ↓ ↓ ← → ← → B A. */
export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
