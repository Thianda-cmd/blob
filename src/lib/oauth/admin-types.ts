/**
 * Shapes the admin panel passes from the server to the browser. Safe to import anywhere:
 * nothing here carries a secret (an app's `secret_hash` never leaves the server).
 */

export type ScopeName = "openid" | "profile" | "email" | "offline_access";
export const SCOPE_NAMES: readonly ScopeName[] = ["openid", "profile", "email", "offline_access"];

/** An app as the admin panel sees it: everything except the secret's hash. */
export type AdminApp = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  homepage_url: string | null;
  privacy_url: string | null;
  logo_url: string | null;
  mark: string;
  color: string;
  redirect_uris: string[];
  allowed_origins: string[];
  scopes: string[];
  confidential: boolean;
  secret_hint: string | null;
  trusted: boolean;
  disabled: boolean;
  created_at: string;
  updated_at: string;
};

/** The tabs of /admin/apps/[id] (`?tab=`). */
export const APP_TABS = ["overview", "settings", "people", "integration"] as const;
export type AppTab = (typeof APP_TABS)[number];

export type DayCount = { day: string; count: number };

/** Sign-ins (`token` events) and problems (`error` / `reuse`) over the last days. */
export type SignInStats = {
  today: number;
  week: number;
  errors: number;
  /** One entry per calendar day (Europe/Berlin), oldest first, ending today. */
  series: DayCount[];
};

export type AppSummary = AdminApp & { people: number; lastSignIn: string | null };

export type KeyInfo = { kid: string; alg: string; active: boolean; created_at: string; retired_at: string | null };

export type Person = { name: string; email: string | null; avatar: string | null };

export type EventKind = "consent" | "authorize" | "token" | "refresh" | "denied" | "revoked" | "error" | "reuse";

export type AppEvent = { id: number; kind: EventKind; user_id: string | null; detail: string | null; created_at: string };

export type Connection = { user_id: string; scopes: string[]; created_at: string; last_used_at: string | null };

/** What the create / edit form sends. URIs are one per line, as typed. */
export type AppInput = {
  name: string;
  description: string;
  homepage_url: string;
  privacy_url: string;
  logo_url: string;
  mark: string;
  color: string;
  redirect_uris: string;
  allowed_origins: string;
  scopes: string[];
  confidential: boolean;
  trusted: boolean;
};

export type AppField = "name" | "description" | "homepage_url" | "privacy_url" | "logo_url" | "mark" | "color" | "redirect_uris" | "allowed_origins";
export type AppErrorCode = "required" | "too_long" | "url" | "color" | "redirect" | "origin" | "too_many";
export type AppErrors = Partial<Record<AppField, { code: AppErrorCode; value?: string }>>;

export type SaveResult =
  | { ok: true; id: string; clientId: string; /** Only when a new secret was made: shown once. */ secret: string | null }
  | { ok: false; errors: AppErrors }
  | { ok: false; error: ActionError };

export type ActionError = "not_found" | "failed" | "confirm" | "public_app";
export type ActionResult = { ok: true } | { ok: false; error: ActionError };
