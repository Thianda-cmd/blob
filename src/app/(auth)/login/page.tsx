import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthBanner } from "@/components/oauth/OAuthBanner";
import { oauthAppForNext } from "@/lib/oauth/context";
import { safeNext } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.login };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  const notice = typeof params.notice === "string" ? params.notice.slice(0, 200) : undefined;
  const app = await oauthAppForNext(next);
  return (
    <>
      {app && <OAuthBanner app={app} mode="signin" />}
      <LoginForm next={next} initialError={error} notice={notice} />
    </>
  );
}
