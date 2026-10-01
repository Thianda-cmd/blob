import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  const notice = typeof params.notice === "string" ? params.notice.slice(0, 200) : undefined;
  return <LoginForm next={next} initialError={error} notice={notice} />;
}
