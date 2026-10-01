import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

/** Full-screen study mode: no sidebar, just the lesson and Blob. */
export default async function StudyLayout({ children }: LayoutProps<"/study">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded) redirect("/onboarding");
  return <div className="min-h-dvh bg-paper text-ink">{children}</div>;
}
