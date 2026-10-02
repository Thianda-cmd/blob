"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/oauth/admin";
import type { ActionResult, SaveResult } from "@/lib/oauth/admin-types";
import { parseAppInput } from "@/lib/oauth/app-input";
import { newClientId, newClientSecret } from "@/lib/oauth/crypto";
import { rotateSigningKey } from "@/lib/oauth/keys";
import { revokeGrant } from "@/lib/oauth/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Admin actions for "Sign in with Blob". Every one starts with requireAdmin() (a 404 for anyone
 * else), checks its input, and never sends an app's secret hash back to the browser.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function refreshApp(id?: string) {
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/apps/${id}`);
}

/** Registers a new app. For apps with a server it also makes a client secret, returned only this once. */
export async function createApp(input: unknown): Promise<SaveResult> {
  const admin = await requireAdmin();
  const parsed = parseAppInput(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const db = createAdminClient();
  const secret = parsed.value.confidential ? newClientSecret() : null;
  // Client ids end in 10 random characters; retry on the (very unlikely) clash.
  for (let attempt = 0; attempt < 3; attempt++) {
    const clientId = newClientId(parsed.value.name);
    const { data, error } = await db
      .from("oauth_apps")
      .insert({ ...parsed.value, client_id: clientId, secret_hash: secret?.hash ?? null, secret_hint: secret?.hint ?? null, created_by: admin.id })
      .select("id")
      .single();
    if (!error && data) {
      refreshApp();
      return { ok: true, id: data.id as string, clientId, secret: secret?.secret ?? null };
    }
    if (error?.code !== "23505") {
      console.error("createApp", error);
      break;
    }
  }
  return { ok: false, error: "failed" };
}

/**
 * Saves the settings form. Switching to "app with a server" makes a secret (returned once);
 * switching to "browser app" throws the old one away.
 */
export async function updateApp(id: unknown, input: unknown): Promise<SaveResult> {
  await requireAdmin();
  if (!isId(id)) return { ok: false, error: "not_found" };
  const parsed = parseAppInput(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const db = createAdminClient();
  const { data: current } = await db.from("oauth_apps").select("client_id, confidential, secret_hash").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "not_found" };

  const secret = parsed.value.confidential && !current.secret_hash ? newClientSecret() : null;
  const patch: Record<string, unknown> = { ...parsed.value };
  if (secret) Object.assign(patch, { secret_hash: secret.hash, secret_hint: secret.hint });
  if (!parsed.value.confidential) Object.assign(patch, { secret_hash: null, secret_hint: null });

  const { error } = await db.from("oauth_apps").update(patch).eq("id", id);
  if (error) {
    console.error("updateApp", error);
    return { ok: false, error: "failed" };
  }
  refreshApp(id);
  return { ok: true, id, clientId: current.client_id as string, secret: secret?.secret ?? null };
}

/** A new client secret for an app with a server. The old one stops working at once. */
export async function rotateAppSecret(id: unknown): Promise<{ ok: true; secret: string } | { ok: false; error: "not_found" | "public_app" | "failed" }> {
  await requireAdmin();
  if (!isId(id)) return { ok: false, error: "not_found" };
  const db = createAdminClient();
  const { data: app } = await db.from("oauth_apps").select("confidential").eq("id", id).maybeSingle();
  if (!app) return { ok: false, error: "not_found" };
  if (!app.confidential) return { ok: false, error: "public_app" };
  const secret = newClientSecret();
  const { error } = await db.from("oauth_apps").update({ secret_hash: secret.hash, secret_hint: secret.hint }).eq("id", id);
  if (error) return { ok: false, error: "failed" };
  refreshApp(id);
  return { ok: true, secret: secret.secret };
}

/** Switches an app off (sign-ins and tokens are refused) or back on. */
export async function setAppDisabled(id: unknown, disabled: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!isId(id) || typeof disabled !== "boolean") return { ok: false, error: "not_found" };
  const { data, error } = await createAdminClient().from("oauth_apps").update({ disabled }).eq("id", id).select("id");
  if (error) return { ok: false, error: "failed" };
  if (!data?.length) return { ok: false, error: "not_found" };
  refreshApp(id);
  return { ok: true };
}

/**
 * Deletes an app for good (codes, tokens, grants and events cascade). `confirmName` is what the
 * admin typed and must match the app's name. On success it goes back to /admin.
 */
export async function deleteApp(id: unknown, confirmName: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!isId(id)) return { ok: false, error: "not_found" };
  const db = createAdminClient();
  const { data: app } = await db.from("oauth_apps").select("name").eq("id", id).maybeSingle();
  if (!app) return { ok: false, error: "not_found" };
  if (typeof confirmName !== "string" || confirmName.trim() !== (app.name as string).trim()) return { ok: false, error: "confirm" };
  const { error } = await db.from("oauth_apps").delete().eq("id", id);
  if (error) {
    console.error("deleteApp", error);
    return { ok: false, error: "failed" };
  }
  refreshApp();
  redirect("/admin");
}

/** Removes one person's access to an app (signs the app out for them). */
export async function revokePersonAccess(appId: unknown, userId: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!isId(appId) || !isId(userId)) return { ok: false, error: "not_found" };
  const { data: grant } = await createAdminClient()
    .from("oauth_grants")
    .select("user_id")
    .eq("app_id", appId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!grant) return { ok: false, error: "not_found" };
  await revokeGrant(userId, appId);
  refreshApp(appId);
  return { ok: true };
}

/** Makes a new signing key; older ones stay in the JWKS for a grace period. */
export async function rotateKey(): Promise<ActionResult> {
  await requireAdmin();
  try {
    await rotateSigningKey();
  } catch (error) {
    console.error("rotateKey", error);
    return { ok: false, error: "failed" };
  }
  refreshApp();
  return { ok: true };
}
