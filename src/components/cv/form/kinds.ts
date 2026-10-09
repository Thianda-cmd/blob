import { BadgeCheck, Briefcase, GraduationCap, HandCoins, Heart, HeartHandshake, Languages, Shapes, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import type { CvSectionKind } from "@/cv/types";

/** The icon of each kind of section, in the form and the "add section" list. */
export const KIND_ICON: Record<CvSectionKind, LucideIcon> = {
  education: GraduationCap,
  internships: Briefcase,
  experience: HandCoins,
  volunteering: HeartHandshake,
  courses: BadgeCheck,
  awards: Trophy,
  custom: Shapes,
  skills: Sparkles,
  languages: Languages,
  interests: Heart,
};

/** Kinds a CV has at most once (the "add section" list greys them out when present). */
export const SINGLE_KINDS: CvSectionKind[] = ["skills", "languages", "interests"];

export const MAX_SECTIONS = 30;
