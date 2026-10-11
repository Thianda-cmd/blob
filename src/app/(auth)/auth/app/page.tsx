import type { Metadata } from "next";
import { AppSignInFinish } from "@/components/auth/AppSignInFinish";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.appSignIn, robots: { index: false } };
}

/** In the app: where the browser's link (org.bojes.blob://auth/app?code=…&state=…) lands. */
export default async function AppSignInPage({ searchParams }: PageProps<"/auth/app">) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).slice(0, 200) : "");
  return <AppSignInFinish code={get("code")} state={get("state")} />;
}
