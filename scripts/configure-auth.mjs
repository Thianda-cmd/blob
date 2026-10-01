// Configures Supabase Auth for Blob through the Supabase Management API:
// Site URL, allowed redirect URLs, branded email templates and (optionally) custom SMTP.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs            # apply
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs --dry-run  # show what would change
//   ... --rotate-smtp-pass                                                     # also replace the stored SMTP password
//
// Create the access token at https://supabase.com/dashboard/account/tokens.
// SMTP is applied when SMTP_PASS is set (for Resend: SMTP_PASS = a Resend API key).
//
// Optional env (defaults in brackets):
//   SITE_URL            [https://blob.bojes.org]
//   EXTRA_REDIRECTS     comma-separated extra redirect URL patterns
//   SMTP_HOST           [smtp.resend.com]
//   SMTP_PORT           [465]
//   SMTP_USER           [resend]
//   SMTP_PASS           (enables SMTP)
//   SMTP_SENDER_EMAIL   [noreply@blob.bojes.org]
//   SMTP_SENDER_NAME    [Blob]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { templates } from "../supabase/templates/templates.mjs";

const root = path.resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (!existsSync(full)) continue;
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const env = process.env;
const dryRun = process.argv.includes("--dry-run");
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF || new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "https://x.supabase.co").hostname.split(".")[0];
const site = (env.SITE_URL || "https://blob.bojes.org").replace(/\/$/, "");

if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (create one at https://supabase.com/dashboard/account/tokens).");
  process.exit(1);
}

const redirects = [
  `${site}/**`,
  "https://blob-umber.vercel.app/**",
  "https://*-steffanievoller-6064s-projects.vercel.app/**",
  "http://localhost:3000/**",
  ...(env.EXTRA_REDIRECTS ? env.EXTRA_REDIRECTS.split(",").map((s) => s.trim()) : []),
];

const config = {
  site_url: site,
  uri_allow_list: [...new Set(redirects)].join(","),
  password_min_length: 8,
  mailer_secure_email_change_enabled: true,
};

for (const [key, t] of Object.entries(templates)) {
  config[`mailer_subjects_${key}`] = t.subject;
  config[`mailer_templates_${key}_content`] = t.html;
}

if (env.SMTP_PASS) {
  Object.assign(config, {
    smtp_host: env.SMTP_HOST || "smtp.resend.com",
    smtp_port: String(env.SMTP_PORT || "465"),
    smtp_user: env.SMTP_USER || "resend",
    smtp_pass: env.SMTP_PASS,
    smtp_admin_email: env.SMTP_SENDER_EMAIL || "noreply@blob.bojes.org",
    smtp_sender_name: env.SMTP_SENDER_NAME || "Blob",
    // With your own SMTP the hourly email limit can go up from the built-in 2/hour.
    rate_limit_email_sent: 100,
  });
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const current = await fetch(api, { headers });
if (!current.ok) {
  console.error(`Could not read the auth config (${current.status}): ${await current.text()}`);
  process.exit(1);
}
const before = await current.json();

// Supabase never returns the stored SMTP password, so only count it when SMTP is being set up or moved.
const smtpMoving = !before.smtp_host || before.smtp_host !== config.smtp_host || before.smtp_user !== config.smtp_user;
const changed = Object.keys(config).filter((k) => {
  if (k === "smtp_pass") return smtpMoving || process.argv.includes("--rotate-smtp-pass");
  return JSON.stringify(before[k]) !== JSON.stringify(config[k]);
});
console.log(`Project ${ref}`);
console.log(`  site_url: ${before.site_url}  ->  ${config.site_url}`);
console.log(`  smtp:     ${before.smtp_host ? `${before.smtp_host} as ${before.smtp_admin_email}` : "built-in mailer"}  ->  ${config.smtp_host ? `${config.smtp_host} as ${config.smtp_admin_email}` : "unchanged"}`);
console.log(`  ${changed.length} setting(s) to change: ${changed.map((k) => k.replace(/_content$/, "")).join(", ") || "none"}`);

if (dryRun || changed.length === 0) process.exit(0);

const patch = Object.fromEntries(changed.map((k) => [k, config[k]]));
const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(patch) });
if (!res.ok) {
  console.error(`Update failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log("Auth settings updated.");
