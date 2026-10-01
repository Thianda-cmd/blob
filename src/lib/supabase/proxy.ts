import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

const APP_PREFIXES = ["/home", "/p", "/tasks", "/subjects", "/settings", "/trash", "/present", "/onboarding"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Refreshes the Supabase session cookie and guards app routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && matches(pathname, APP_PREFIXES)) {
    const redirect = redirectTo("/login");
    const location = new URL(redirect.headers.get("location")!);
    location.searchParams.set("next", pathname + search);
    redirect.headers.set("location", location.toString());
    return redirect;
  }

  if (signedIn && matches(pathname, GUEST_ONLY)) {
    // The JWT can outlive its session (signed out elsewhere, account deleted).
    // Confirm with Supabase before bouncing to the app, otherwise /login <-> /home would loop.
    const { data: verified } = await supabase.auth.getUser();
    if (verified.user) return redirectTo("/home");
    await supabase.auth.signOut({ scope: "local" });
    return response;
  }

  return response;
}
