"use client";

import { Apple, Brain, Dna, Fish, Flower2, GitBranch, Grid2x2, HeartPulse, KeyRound, Leaf, Microscope, ShieldPlus, Split, Sprout, Sun, Trees, type LucideIcon } from "lucide-react";
import type { TopicMeta } from "@/learn/catalog";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";

/** Pictures for topics with `icon` in the catalog (biology). */
const ICONS: Record<string, LucideIcon> = {
  microscope: Microscope,
  split: Split,
  key: KeyRound,
  sprout: Sprout,
  sun: Sun,
  flower: Flower2,
  trees: Trees,
  fish: Fish,
  apple: Apple,
  heart: HeartPulse,
  brain: Brain,
  shield: ShieldPlus,
  grid: Grid2x2,
  dna: Dna,
  branch: GitBranch,
  leaf: Leaf,
};

const ICON_SIZE = { sm: "size-6", md: "size-8", lg: "size-11" } as const;

/** A topic's picture: its icon, or else its maths glyph. */
export function TopicGlyph({ topic, size, className }: { topic: Pick<TopicMeta, "glyph" | "icon">; size: "sm" | "md" | "lg"; className?: string }) {
  const Icon = topic.icon ? ICONS[topic.icon] : undefined;
  if (Icon) return <Icon className={cn(ICON_SIZE[size], "text-blob-ink", className)} strokeWidth={1.6} aria-hidden />;
  return <MathView src={topic.glyph} size={size} animate={false} className={className} />;
}
