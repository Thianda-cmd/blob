import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { CheckEmail } from "@/components/auth/CheckEmail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.checkEmail };
}

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email } = await searchParams;
  return <CheckEmail email={typeof email === "string" ? email.slice(0, 200) : ""} />;
}
