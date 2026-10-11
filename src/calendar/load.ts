import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalEvent } from "@/lib/types";

/** The account's events (series once each, with their changed occurrences). Works with any client. */
export async function loadEvents(supabase: SupabaseClient): Promise<CalEvent[]> {
  const { data } = await supabase.from("events").select("*").is("deleted_at", null).order("starts_at").limit(5000);
  return (data ?? []) as CalEvent[];
}
