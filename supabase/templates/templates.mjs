// Branded Supabase Auth email templates for Blob.
//
// Every link points to /auth/confirm on the Site URL with a token hash. That page
// verifies the token only after a button click, so link scanners in school mail
// systems can't use the link up, and the link works on any device or browser.
//
// `node supabase/templates/templates.mjs` writes the .html files next to this one
// (handy for pasting into the dashboard). scripts/configure-auth.mjs uploads them.
//
// Bilingual: German by default, English when the account's user metadata says
// `locale: "en"` (set at sign-up and by the language switch). The check prints the
// value with printf first, so a missing or odd `locale` falls back to German instead
// of failing the template (and with it, the email).

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

/** True when the account's language is English. Declared once at the top of each template. */
const IS_EN = `{{- $en := eq (printf "%v" .Data.locale) "en" -}}`;

/** English or German text, picked by the account's language. */
const tr = (en, de) => `{{ if $en }}${en}{{ else }}${de}{{ end }}`;

/** A subject line: its own small template, so it declares nothing and checks inline. */
const subjectOf = (en, de) => `{{ if eq (printf "%v" .Data.locale) "en" }}${en}{{ else }}${de}{{ end }}`;

const GREETING = {
  en: "{{ if .Data.full_name }}Hi {{ .Data.full_name }}!{{ else }}Hi there!{{ end }}",
  de: "{{ if .Data.full_name }}Hallo {{ .Data.full_name }}!{{ else }}Hallo!{{ end }}",
};

const confirmLink = (type, next) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${encodeURIComponent(next)}`;

/** Every text field is `{ en, de }`. */
function layout(content) {
  const { link, code } = content;
  const [subject, preheader, title, body, button, footer] = ["subject", "preheader", "title", "body", "button", "footer"].map((key) =>
    content[key] ? tr(content[key].en, content[key].de) : "",
  );
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
            ${tr("Button not working? Paste this link into your browser:", "Der Button funktioniert nicht? Kopier diesen Link in deinen Browser:")}<br />
            <a href="${link}" target="_blank" style="color:${C.blobInk};word-break:break-all;">${link}</a>
          </p>`
    : `
          <div style="margin:0 0 8px;padding:16px 0;border-radius:12px;background:${C.soft};text-align:center;font:700 32px/1 ${FONT};letter-spacing:8px;color:${C.blobInk};">${code}</div>`;

  return `${IS_EN}<!doctype html>
<html lang="${tr("en", "de")}">
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
                <span style="color:${C.blobInk};font-weight:600;">Blob</span> &middot; ${tr("your school, saved", "deine Schule, gespeichert")} &middot;
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
const content = {
  confirmation: {
    subject: { en: "Confirm your email for Blob", de: "Bestätige deine E-Mail-Adresse für Blob" },
    preheader: { en: "One click and your Blob space is ready.", de: "Ein Klick und dein Blob-Bereich ist bereit." },
    title: { en: "Confirm your email", de: "Bestätige deine E-Mail-Adresse" },
    body: {
      en: `${GREETING.en} I'm Blob, your new study buddy. Confirm your email address and I'll set up your space for notes, presentations and homework.`,
      de: `${GREETING.de} Ich bin Blob, dein neuer Lernbuddy. Bestätige deine E-Mail-Adresse und ich richte deinen Bereich für Notizen, Präsentationen und Hausaufgaben ein.`,
    },
    button: { en: "Confirm my email", de: "E-Mail-Adresse bestätigen" },
    link: confirmLink("email", "/onboarding"),
    footer: {
      en: "You're getting this because someone signed up for Blob with {{ .Email }}. If that wasn't you, you can ignore this email.",
      de: "Du bekommst diese E-Mail, weil sich jemand mit {{ .Email }} bei Blob registriert hat. Warst du das nicht, kannst du sie einfach ignorieren.",
    },
  },
  magic_link: {
    subject: { en: "Your Blob sign-in link", de: "Dein Anmeldelink für Blob" },
    preheader: { en: "Your one-time link to sign in to Blob.", de: "Dein einmaliger Link, um dich bei Blob anzumelden." },
    title: { en: "Sign in to Blob", de: "Bei Blob anmelden" },
    body: {
      en: `${GREETING.en} Here's your sign-in link. It works once and expires soon.`,
      de: `${GREETING.de} Hier ist dein Anmeldelink. Er funktioniert nur einmal und läuft bald ab.`,
    },
    button: { en: "Sign in to Blob", de: "Bei Blob anmelden" },
    link: confirmLink("email", "/home"),
    footer: {
      en: "Didn't ask to sign in? You can ignore this email. Your account is safe.",
      de: "Du wolltest dich gar nicht anmelden? Dann ignorier diese E-Mail einfach. Dein Konto ist sicher.",
    },
  },
  recovery: {
    subject: { en: "Reset your Blob password", de: "Dein Blob-Passwort zurücksetzen" },
    preheader: { en: "Choose a new password for your Blob account.", de: "Leg ein neues Passwort für dein Blob-Konto fest." },
    title: { en: "Reset your password", de: "Passwort zurücksetzen" },
    body: {
      en: `${GREETING.en} We got a request to reset the password for your Blob account. Choose a new one with the button below.`,
      de: `${GREETING.de} Wir haben eine Anfrage bekommen, das Passwort für dein Blob-Konto zurückzusetzen. Mit dem Button unten legst du ein neues fest.`,
    },
    button: { en: "Choose a new password", de: "Neues Passwort festlegen" },
    link: confirmLink("recovery", "/reset-password"),
    footer: {
      en: "Didn't ask for this? Ignore this email and your password stays the same.",
      de: "Das warst du nicht? Dann ignorier diese E-Mail und dein Passwort bleibt, wie es ist.",
    },
  },
  email_change: {
    subject: { en: "Confirm your new email for Blob", de: "Bestätige deine neue E-Mail-Adresse für Blob" },
    preheader: { en: "Confirm the switch to your new email address.", de: "Bestätige den Wechsel zu deiner neuen E-Mail-Adresse." },
    title: { en: "Confirm your new email", de: "Bestätige deine neue E-Mail-Adresse" },
    body: {
      en: `${GREETING.en} Confirm that you want to use <b>{{ .NewEmail }}</b> for your Blob account instead of {{ .Email }}.`,
      de: `${GREETING.de} Bestätige, dass du für dein Blob-Konto ab jetzt <b>{{ .NewEmail }}</b> statt {{ .Email }} verwenden möchtest.`,
    },
    button: { en: "Confirm new email", de: "Neue E-Mail-Adresse bestätigen" },
    link: confirmLink("email_change", "/settings"),
    footer: {
      en: "Didn't ask for this? Ignore this email and change your password to be safe.",
      de: "Das warst du nicht? Dann ignorier diese E-Mail und ändere sicherheitshalber dein Passwort.",
    },
  },
  invite: {
    subject: { en: "You're invited to Blob", de: "Du bist zu Blob eingeladen" },
    preheader: { en: "Your invite to Blob, a calm workspace for school.", de: "Deine Einladung zu Blob, einem ruhigen Ort für die Schule." },
    title: { en: "You're invited to Blob", de: "Du bist zu Blob eingeladen" },
    body: {
      en: "Hi there! You've been invited to Blob, a calm workspace for school notes, presentations and homework. Accept the invite and choose a password.",
      de: "Hallo! Du wurdest zu Blob eingeladen, einem ruhigen Ort für Schulnotizen, Präsentationen und Hausaufgaben. Nimm die Einladung an und leg ein Passwort fest.",
    },
    button: { en: "Accept invite", de: "Einladung annehmen" },
    link: confirmLink("invite", "/reset-password"),
    footer: { en: "Not expecting this? You can ignore this email.", de: "Nicht erwartet? Dann kannst du diese E-Mail ignorieren." },
  },
  reauthentication: {
    subject: { en: "Your Blob verification code", de: "Dein Bestätigungscode für Blob" },
    preheader: { en: "Your Blob verification code.", de: "Dein Bestätigungscode für Blob." },
    title: { en: "Confirm it's you", de: "Bestätige, dass du es bist" },
    body: {
      en: `${GREETING.en} Enter this code in Blob to confirm it's really you.`,
      de: `${GREETING.de} Gib diesen Code in Blob ein, um zu bestätigen, dass du es wirklich bist.`,
    },
    code: "{{ .Token }}",
    footer: { en: "Didn't ask for a code? You can ignore this email.", de: "Du hast keinen Code angefordert? Dann kannst du diese E-Mail ignorieren." },
  },
};

export const templates = Object.fromEntries(
  Object.entries(content).map(([key, c]) => [key, { subject: subjectOf(c.subject.en, c.subject.de), html: layout(c) }]),
);

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  for (const [key, t] of Object.entries(templates)) {
    writeFileSync(path.join(dir, `${key}.html`), t.html);
    console.log(`wrote ${key}.html  (subject: ${t.subject})`);
  }
}
