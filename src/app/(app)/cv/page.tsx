import type { Metadata } from "next";
import { CvHome, type CvItem } from "@/components/cv/home/CvHome";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(cvHomeText)).title };
}

export default async function CvPage() {
  // The (app) layout already checked the session; RLS keeps this to the user's own rows.
  const supabase = await createClient();
  // The cards draw page 1 of each CV, so the content comes along (a CV is a few kilobytes).
  const { data } = await supabase
    .from("pages")
    .select("id, title, updated_at, content")
    .eq("kind", "cv")
    .is("trashed_at", null)
    .order("updated_at", { ascending: false });
  return <CvHome initialItems={(data ?? []) as CvItem[]} />;
}
