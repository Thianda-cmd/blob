import "server-only";
import { publicApp, type PublicApp } from "./apps";
import { loadRequest } from "./authorize";

const OAUTH_NEXT = /^\/oauth\/(?:continue|consent)\?request=([0-9a-f-]{36})$/i;

/** True when `next` leads back into a "Sign in with Blob" flow. */
export const isOAuthNext = (next: string | null | undefined) => !!next && OAUTH_NEXT.test(next);

/** The app someone is signing in to, when the login/signup page was opened from "Sign in with Blob". */
export async function oauthAppForNext(next: string | null | undefined): Promise<PublicApp | null> {
  const id = next?.match(OAUTH_NEXT)?.[1];
  if (!id) return null;
  const request = await loadRequest(id);
  if (!request || request.expired || request.completed) return null;
  return publicApp(request.app);
}
