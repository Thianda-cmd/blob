/** Where Supabase should send people back to after clicking an email link. */
export function callbackUrl(next = "/home") {
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
