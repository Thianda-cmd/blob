import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { SignupForm } from "@/components/auth/SignupForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.signup };
}

export default function SignupPage() {
  return <SignupForm />;
}
