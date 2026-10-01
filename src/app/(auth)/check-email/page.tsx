import type { Metadata } from "next";
import { CheckEmail } from "@/components/auth/CheckEmail";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email } = await searchParams;
  return <CheckEmail email={typeof email === "string" ? email.slice(0, 200) : ""} />;
}
