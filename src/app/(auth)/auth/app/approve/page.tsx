import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppApproveCard } from "@/components/auth/AppApproveCard";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { isDevice } from "@/lib/auth/appSignIn";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.appSignIn, robots: { index: false } };
}

/** In the browser: confirm signing in the Blob app with the account you're signed in with here. */
export default async function ApproveAppPage({ searchParams }: PageProps<"/auth/app/approve">) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).slice(0, 200) : "");
  const challenge = get("challenge");
  const state = get("state");
  const device = get("device");
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/auth/app/approve?${new URLSearchParams({ challenge, state, device })}`)}`);
  return <AppApproveCard email={user.email ?? ""} challenge={challenge} state={state} device={isDevice(device) ? device : "other"} />;
}
