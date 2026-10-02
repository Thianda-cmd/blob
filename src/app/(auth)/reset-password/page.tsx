import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { ResetForm } from "@/components/auth/ResetForm";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.reset };
}

export default async function ResetPasswordPage() {
  // The recovery link signs the user in; without a session the link has expired.
  const user = await getUser();
  return <ResetForm email={user?.email ?? null} />;
}
