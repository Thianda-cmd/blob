import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { ConfirmCard } from "@/components/auth/ConfirmCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.confirm };
}

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).slice(0, 500) : "");
  return <ConfirmCard tokenHash={get("token_hash")} type={get("type")} next={get("next")} />;
}
