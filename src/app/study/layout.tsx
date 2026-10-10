import { redirect } from "next/navigation";
import { cleanLook } from "@/components/blob/look";
import { BlobLookProvider } from "@/components/blob/LookContext";
import { createClient, getUser } from "@/lib/supabase/server";

/** Full-screen study mode: no sidebar, just the lesson and Blob (in the student's look). */
export default async function StudyLayout({ children }: LayoutProps<"/study">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded) redirect("/onboarding");
  return (
    <BlobLookProvider look={cleanLook(profile.blob_look)}>
      <div className="min-h-dvh bg-paper text-ink">{children}</div>
    </BlobLookProvider>
  );
}
