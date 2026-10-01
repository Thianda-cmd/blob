import type { Metadata } from "next";
import { ConfirmCard } from "@/components/auth/ConfirmCard";

export const metadata: Metadata = { title: "Confirm" };

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).slice(0, 500) : "");
  return <ConfirmCard tokenHash={get("token_hash")} type={get("type")} next={get("next")} />;
}
