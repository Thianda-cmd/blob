import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // (sw.js: the apps' offline helper, a plain file that needs no session.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|sdk/|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
