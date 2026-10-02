import "server-only";
import type { AppErrors, AppField, AppInput } from "./admin-types";
import { validRedirectUri } from "./apps";
import { SCOPES, type Scope } from "./config";

/** Columns of `oauth_apps` the admin form may set. */
export type AppValues = {
  name: string;
  description: string;
  homepage_url: string | null;
  privacy_url: string | null;
  logo_url: string | null;
  mark: string;
  color: string;
  redirect_uris: string[];
  allowed_origins: string[];
  scopes: Scope[];
  confidential: boolean;
  trusted: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_URIS = 20;
const MAX_URI_LENGTH = 500;

/** Length in characters as Postgres counts them (code points, so an emoji is one). */
const chars = (s: string) => [...s].length;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** https, or http only for this computer (local development). */
function isWebUrl(u: URL) {
  return u.protocol === "https:" || (u.protocol === "http:" && LOCAL_HOSTS.has(u.hostname));
}

/** `null` when empty, `false` when it isn't a usable web address. Keeps the URL exactly as typed. */
function optionalUrl(raw: unknown, max: number): string | null | false {
  const s = str(raw).trim();
  if (!s) return null;
  if (s.length > max || /\s/.test(s)) return false;
  try {
    return isWebUrl(new URL(s)) ? s : false;
  } catch {
    return false;
  }
}

const lines = (raw: unknown) => [...new Set(str(raw).split(/\s+/).map((l) => l.trim()).filter(Boolean))];

/**
 * Checks everything the create / edit form sends (it's a server action, so anything can arrive).
 * Limits follow the check constraints in 0004_oauth.sql.
 */
export function parseAppInput(input: unknown): { ok: true; value: AppValues } | { ok: false; errors: AppErrors } {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof AppInput, unknown>>;
  const errors: AppErrors = {};
  const fail = (field: AppField, code: NonNullable<AppErrors[AppField]>["code"], value?: string) => {
    if (!errors[field]) errors[field] = value === undefined ? { code } : { code, value };
  };

  const name = str(raw.name).trim().replace(/\s+/g, " ");
  if (!name) fail("name", "required");
  else if (chars(name) > 60) fail("name", "too_long");

  const description = str(raw.description).trim();
  if (chars(description) > 300) fail("description", "too_long");

  const homepage = optionalUrl(raw.homepage_url, 300);
  if (homepage === false) fail("homepage_url", "url");
  const privacy = optionalUrl(raw.privacy_url, 300);
  if (privacy === false) fail("privacy_url", "url");
  const logo = optionalUrl(raw.logo_url, 500);
  if (logo === false) fail("logo_url", "url");

  const mark = str(raw.mark).trim();
  if (chars(mark) > 4) fail("mark", "too_long");

  const color = str(raw.color).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail("color", "color");

  const redirects = lines(raw.redirect_uris);
  if (!redirects.length) fail("redirect_uris", "required");
  else if (redirects.length > MAX_URIS) fail("redirect_uris", "too_many");
  for (const uri of redirects) {
    if (uri.length > MAX_URI_LENGTH || !validRedirectUri(uri)) fail("redirect_uris", "redirect", uri.slice(0, 120));
  }

  const origins: string[] = [];
  const typedOrigins = lines(raw.allowed_origins);
  if (typedOrigins.length > MAX_URIS) fail("allowed_origins", "too_many");
  for (const entry of typedOrigins) {
    try {
      const u = new URL(entry);
      // Just scheme://host[:port]; a trailing slash is fine, a path or query isn't.
      if (!isWebUrl(u) || u.pathname !== "/" || u.search || u.hash || u.username || u.password) throw new Error("not an origin");
      if (!origins.includes(u.origin)) origins.push(u.origin);
    } catch {
      fail("allowed_origins", "origin", entry.slice(0, 120));
    }
  }

  const asked = Array.isArray(raw.scopes) ? raw.scopes.filter((s): s is string => typeof s === "string") : [];
  // openid is always on: without it there is no "Sign in".
  const scopes = SCOPES.filter((s) => s === "openid" || asked.includes(s));

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description,
      homepage_url: homepage || null,
      privacy_url: privacy || null,
      logo_url: logo || null,
      mark,
      color: color.toLowerCase(),
      redirect_uris: redirects,
      allowed_origins: origins,
      scopes,
      confidential: raw.confidential === true,
      trusted: raw.trusted === true,
    },
  };
}
