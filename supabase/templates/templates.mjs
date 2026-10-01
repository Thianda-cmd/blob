// Branded Supabase Auth email templates for Blob.
//
// Every link points to /auth/confirm on the Site URL with a token hash. That page
// verifies the token only after a button click, so link scanners in school mail
// systems can't use the link up, and the link works on any device or browser.
//
// `node supabase/templates/templates.mjs` writes the .html files next to this one
// (handy for pasting into the dashboard). scripts/configure-auth.mjs uploads them.

import { writeFileSync } from "node:fs";
import path from "node:path";

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const C = {
  paper: "#f4f3ee",
  card: "#ffffff",
  line: "#e3e1d9",
  ink: "#1c1b18",
  ink2: "#4b4a44",
  ink3: "#8b8981",
  blob: "#6d3df5",
  blobInk: "#5a2bd6",
  soft: "#efe9ff",
};

const GREETING = "{{ if .Data.full_name }}Hi {{ .Data.full_name }}!{{ else }}Hi there!{{ end }}";

const confirmLink = (type, next) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${encodeURIComponent(next)}`;

function layout({ subject, preheader, title, body, button, link, code, footer }) {
  const action = link
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;">
            <tr>
              <td style="border-radius:10px;background:${C.blob};">
                <a href="${link}" target="_blank" style="display:inline-block;padding:13px 22px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${button} &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:22px 0 0;font:400 12.5px/1.6 ${FONT};color:${C.ink3};">
            Button not working? Paste this link into your browser:<br />
            <a href="${link}" target="_blank" style="color:${C.blobInk};word-break:break-all;">${link}</a>
          </p>`
    : `
          <div style="margin:0 0 8px;padding:16px 0;border-radius:12px;background:${C.soft};text-align:center;font:700 32px/1 ${FONT};letter-spacing:8px;color:${C.blobInk};">${code}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
      <tr>
        <td align="center" style="padding:36px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
            <tr>
              <td style="padding:0 8px 14px;">
                <img src="{{ .SiteURL }}/email/blob.png" width="105" height="79" alt="Blob" style="display:block;border:0;outline:none;" />
              </td>
            </tr>
            <tr>
              <td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:32px 32px 28px;">
                <h1 style="margin:0 0 10px;font:700 24px/1.25 ${FONT};letter-spacing:-0.4px;color:${C.ink};">${title}</h1>
                <p style="margin:0 0 24px;font:400 15px/1.6 ${FONT};color:${C.ink2};">${body}</p>${action}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 10px 0;font:400 12px/1.6 ${FONT};color:${C.ink3};">
                ${footer}<br />
                <span style="color:${C.blobInk};font-weight:600;">Blob</span> &middot; your school, saved &middot;
                <a href="{{ .SiteURL }}" target="_blank" style="color:${C.ink3};">blob.bojes.org</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** Keys match the Supabase Management API names: mailer_subjects_<key> and mailer_templates_<key>_content. */
export const templates = {
  confirmation: {
    subject: "Confirm your email for Blob",
    html: layout({
      subject: "Confirm your email for Blob",
      preheader: "One click and your Blob space is ready.",
      title: "Confirm your email",
      body: `${GREETING} I'm Blob, your new study buddy. Confirm your email address and I'll set up your space for notes, presentations and homework.`,
      button: "Confirm my email",
      link: confirmLink("email", "/onboarding"),
      footer: "You're getting this because someone signed up for Blob with {{ .Email }}. If that wasn't you, you can ignore this email.",
    }),
  },
  magic_link: {
    subject: "Your Blob sign-in link",
    html: layout({
      subject: "Your Blob sign-in link",
      preheader: "Your one-time link to sign in to Blob.",
      title: "Sign in to Blob",
      body: `${GREETING} Here's your sign-in link. It works once and expires soon.`,
      button: "Sign in to Blob",
      link: confirmLink("email", "/home"),
      footer: "Didn't ask to sign in? You can ignore this email. Your account is safe.",
    }),
  },
  recovery: {
    subject: "Reset your Blob password",
    html: layout({
      subject: "Reset your Blob password",
      preheader: "Choose a new password for your Blob account.",
      title: "Reset your password",
      body: `${GREETING} We got a request to reset the password for your Blob account. Choose a new one with the button below.`,
      button: "Choose a new password",
      link: confirmLink("recovery", "/reset-password"),
      footer: "Didn't ask for this? Ignore this email and your password stays the same.",
    }),
  },
  email_change: {
    subject: "Confirm your new email for Blob",
    html: layout({
      subject: "Confirm your new email for Blob",
      preheader: "Confirm the switch to your new email address.",
      title: "Confirm your new email",
      body: `${GREETING} Confirm that you want to use <b>{{ .NewEmail }}</b> for your Blob account instead of {{ .Email }}.`,
      button: "Confirm new email",
      link: confirmLink("email_change", "/settings"),
      footer: "Didn't ask for this? Ignore this email and change your password to be safe.",
    }),
  },
  invite: {
    subject: "You're invited to Blob",
    html: layout({
      subject: "You're invited to Blob",
      preheader: "Your invite to Blob, a calm workspace for school.",
      title: "You're invited to Blob",
      body: "Hi there! You've been invited to Blob, a calm workspace for school notes, presentations and homework. Accept the invite and choose a password.",
      button: "Accept invite",
      link: confirmLink("invite", "/reset-password"),
      footer: "Not expecting this? You can ignore this email.",
    }),
  },
  reauthentication: {
    subject: "Your Blob verification code",
    html: layout({
      subject: "Your Blob verification code",
      preheader: "Your Blob verification code.",
      title: "Confirm it's you",
      body: `${GREETING} Enter this code in Blob to confirm it's really you.`,
      code: "{{ .Token }}",
      footer: "Didn't ask for a code? You can ignore this email.",
    }),
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  for (const [key, t] of Object.entries(templates)) {
    writeFileSync(path.join(dir, `${key}.html`), t.html);
    console.log(`wrote ${key}.html  (subject: ${t.subject})`);
  }
}
