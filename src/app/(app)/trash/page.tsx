import type { Metadata } from "next";
import { TrashView } from "@/components/trash/TrashView";
import { trashText } from "@/i18n/messages/trash";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PAGE_META_COLUMNS, type PageMeta } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(trashText)).title };
}

export default async function TrashPage() {
  // The (app) layout already checked the session; RLS keeps this to the user's own rows.
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select(PAGE_META_COLUMNS)
    .not("trashed_at", "is", null)
    .order("trashed_at", { ascending: false });

  return <TrashView initialPages={(data ?? []) as PageMeta[]} />;
}
