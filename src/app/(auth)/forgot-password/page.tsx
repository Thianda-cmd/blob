import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { ForgotForm } from "@/components/auth/ForgotForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.forgot };
}

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
