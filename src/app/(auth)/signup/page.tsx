import type { Metadata } from "next";
import { authText } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { OAuthBanner } from "@/components/oauth/OAuthBanner";
import { isOAuthNext, oauthAppForNext } from "@/lib/oauth/context";
import { safeNext } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(authText)).meta.signup };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const raw = (await searchParams).next;
  // Only "Sign in with Blob" flows carry a next; a plain sign-up goes on to onboarding.
  const next = typeof raw === "string" && isOAuthNext(safeNext(raw)) ? raw : undefined;
  const app = await oauthAppForNext(next);
  return (
    <>
      {app && <OAuthBanner app={app} mode="signup" />}
      <SignupForm next={next} />
    </>
  );
}
