import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/ResetForm";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in; without a session the link has expired.
  const user = await getUser();
  return <ResetForm email={user?.email ?? null} />;
}
