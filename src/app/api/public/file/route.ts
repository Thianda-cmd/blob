import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_TOKEN, UUID } from "@/lib/publicLink";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A file attached to a page seen through a public link (src/lib/publicLink.ts publicFileHref):
// public_file() checks the link opens that page and the file belongs to it; then a short-lived
// signed link to the private files bucket.

const BUCKET = "files";

/** A download name in plain letters (Storage puts it in a header). */
function plain(name: string) {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .trim();
  return ascii.slice(0, 120) || "file";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const token = q.get("t") ?? "";
  const page = q.get("p") ?? "";
  const path = q.get("f") ?? "";
  const download = q.get("d");
  const gone = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!PUBLIC_TOKEN.test(token) || !UUID.test(page) || !path || path.length > 500) return gone();

  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("public_file", { p_token: token, p_page: page, p_path: path });
  if (ok !== true) return gone();

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 600, download ? { download: plain(download) } : undefined);
  if (error || !data) return gone();
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
