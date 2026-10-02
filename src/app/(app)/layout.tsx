import { redirect } from "next/navigation";
import { BlobBoot } from "@/components/blob/BlobBoot";
import { AppShell } from "@/components/shell/AppShell";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { shellText } from "@/i18n/messages/shell";
import { getMessages } from "@/i18n/server";
import { isAdmin } from "@/lib/oauth/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { PAGE_META_COLUMNS, type PageMeta, type Profile, type Subject } from "@/lib/types";
import { firstName } from "@/lib/utils";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profileRes, subjectsRes, pagesRes, admin] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("subjects").select("*").order("position"),
    supabase.from("pages").select(PAGE_META_COLUMNS).is("trashed_at", null).order("position"),
    // Only decides whether the sidebar shows "Admin"; /admin itself checks again.
    isAdmin(user.id).catch(() => false),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile?.onboarded) redirect("/onboarding");

  const name = firstName(profile.full_name);
  const t = await getMessages(shellText);

  return (
    <WorkspaceProvider
      userId={user.id}
      email={user.email ?? ""}
      initialProfile={profile}
      initialSubjects={(subjectsRes.data ?? []) as Subject[]}
      initialPages={(pagesRes.data ?? []) as PageMeta[]}
    >
      <AppShell isAdmin={admin}>{children}</AppShell>
      <BlobBoot greeting={t.welcomeBack(name)} />
    </WorkspaceProvider>
  );
}
