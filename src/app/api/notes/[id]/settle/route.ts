import type { NextRequest } from "next/server";
import { getLocale } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { settleNote, type Owed } from "@/notes/settle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The steps a closing editor sends along (optional): `{ version, steps, client }`. */
function owedOf(body: unknown): Owed | null {
  const b = body as Partial<Owed> | null;
  if (!b || typeof b !== "object") return null;
  if (!Number.isInteger(b.version) || (b.version as number) < 0) return null;
  if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > 500) return null;
  if (typeof b.client !== "string" || b.client.length < 1 || b.client.length > 64) return null;
  return { version: b.version as number, steps: b.steps, client: b.client };
}

/**
 * Settle a note edited together: send a closing editor's last steps and store the note with every
 * step applied, as the signed-in user. Called with navigator.sendBeacon when an editor closes, so
 * the stored note catches up even when the tab is gone a moment later.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/notes/[id]/settle">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const text = await request.text().catch(() => "");
  if (text.length > 256_000) return Response.json({ error: "too_large" }, { status: 413 });
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  const settled = await settleNote(supabase, id.toLowerCase(), await getLocale(), owedOf(body));
  if (!settled) return Response.json({ ok: false }, { status: 409 });
  return Response.json({ ok: settled.saved, version: settled.version });
}
