import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Profile, Subject } from "@/lib/types";

export const metadata: Metadata = { title: "Set up your space" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/onboarding");

  const supabase = await createClient();
  const [profileRes, subjectsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("subjects").select("name, emoji, color").order("position"),
  ]);
  const profile = profileRes.data as Profile | null;
  if (profile?.onboarded) redirect("/home");

  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <Onboarding
      userId={user.id}
      initial={{
        name: profile?.full_name ?? metaName.trim(),
        school: profile?.school ?? "",
        grade: profile?.grade ?? "",
        theme: profile?.theme ?? "system",
      }}
      existingSubjects={(subjectsRes.data ?? []) as Pick<Subject, "name" | "emoji" | "color">[]}
    />
  );
}
