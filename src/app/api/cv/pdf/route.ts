import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import type { CvPdfParts } from "@/cv/model";
import { PUBLIC_TOKEN, UUID, type PublicView } from "@/lib/publicLink";
import { createClient, getUser } from "@/lib/supabase/server";

// The CV as a PDF file: a headless Chrome opens /render/cv on this very site, hands it the CV,
// lets the editor's own layout engine draw the A4 pages and saves them as a PDF with real text.
// POST { cv, parts: "cv" | "letter" | "both", fileName } (signed in: the CV being edited), or
// { share: { token, page }, fileName } (anyone: a CV opened through its public link, read here)
// → application/pdf.

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY = 4_000_000;
const STORAGE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

let shared: Promise<Browser> | null = null;

/** One browser per instance, started on first use and kept while it lives. */
async function browser(): Promise<Browser> {
  if (shared) {
    const b = await shared.catch(() => null);
    if (b?.connected) return b;
  }
  shared = (async () => {
    // Locally (and in tests) a Chrome on this machine; on Vercel the serverless build.
    const local = process.env.CHROMIUM_PATH;
    if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  })();
  return shared;
}

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** "Lebenslauf_Mia_Schulz" stays; anything odd becomes "_" (the editor sends cvFileName's name). */
function safeName(raw: unknown) {
  const name = typeof raw === "string" ? raw.normalize("NFC").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_").slice(0, 120) : "";
  return name.replace(/^_+|_+$/g, "") || "CV";
}

/** The CV behind a public link (only a CV, only while the link is shared), or null. */
async function sharedCv(share: unknown): Promise<unknown> {
  const { token, page } = (share ?? {}) as { token?: unknown; page?: unknown };
  if (typeof token !== "string" || !PUBLIC_TOKEN.test(token)) return null;
  if (page != null && (typeof page !== "string" || !UUID.test(page))) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_page", { p_token: token, p_page: page ?? null });
  const view = data as PublicView | null;
  return error || !view || view.page.kind !== "cv" ? null : view.page.content;
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return fail(413, "too_large");
  let body: { cv?: unknown; share?: unknown; parts?: unknown; fileName?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "bad_request");
  }
  let cv: unknown;
  if (body.share) {
    cv = await sharedCv(body.share);
    if (!cv) return fail(404, "not_found");
  } else {
    if (!(await getUser())) return fail(401, "unauthorized");
    cv = body.cv;
  }
  if (!cv || typeof cv !== "object") return fail(400, "bad_request");
  // A shared CV is only the CV: its cover letter stays with its author.
  const parts: CvPdfParts = body.share ? "cv" : body.parts === "letter" || body.parts === "both" ? body.parts : "cv";
  const name = safeName(body.fileName);

  const origin = new URL(request.url).origin;
  // A preview deployment behind Vercel's login lets the headless browser in with the same pass.
  const vercelPass = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith("_vercel_jwt="));

  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    const b = await browser();
    page = await b.newPage();
    await page.setViewport({ width: 1000, height: 1400 });
    // Only this site's page and files, the photos in storage and inline data: nothing else, and none
    // of the student's cookies (the page needs no sign-in).
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return void req.continue();
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return void req.abort();
      }
      if (u.origin === origin && !u.pathname.startsWith("/api/") && req.method() === "GET") {
        return void req.continue(vercelPass ? { headers: { ...req.headers(), cookie: vercelPass } } : undefined);
      }
      if (STORAGE_HOST && u.host === STORAGE_HOST && req.method() === "GET" && u.pathname.startsWith("/storage/v1/object/public/")) return void req.continue();
      return void req.abort();
    });

    const res = await page.goto(`${origin}/render/cv`, { waitUntil: "load", timeout: 30_000 });
    if (!res?.ok()) throw new Error(`render page: ${res?.status()}`);
    await page.waitForFunction("typeof window.__blobRenderCv === 'function'", { timeout: 20_000 });
    await page.evaluate(
      (cv, p, title) => {
        window.__blobRenderCv?.(cv, p, title);
      },
      cv as Record<string, unknown>,
      parts,
      name,
    );
    await page.waitForFunction("window.__blobCvReady === true", { timeout: 25_000 });
    // Photos and signatures loaded too.
    await page.waitForNetworkIdle({ idleTime: 150, timeout: 10_000 }).catch(() => {});

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 30_000 });
    const ascii = name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "CV";
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("cv pdf", e);
    // A browser that broke is started again next time.
    if (page?.browser() && !page.browser().connected) shared = null;
    return fail(500, "failed");
  } finally {
    await page?.close().catch(() => {});
  }
}
