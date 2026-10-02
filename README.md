# Blob

A calm, Notion-style workspace for school: notes, presentations and homework, with **Blob**, a jelly mascot who reacts to what you do and keeps everything saved.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, Tiptap 3 and Supabase (Postgres, Auth, Storage). Deployed on Vercel.

## Features

- **Auth**: sign up with email confirmation, password sign-in, magic links, forgot/reset password, change email/password, sign out everywhere, delete account. Blob watches you type and covers its eyes for passwords.
- **Onboarding**: name, school, subjects and theme in three steps; creates a welcome note and a first task.
- **Notes**: Tiptap editor with `/` commands, formatting bubble, checklists, callouts, images (paste/drop/upload), sub-pages, outline, autosave.
- **Learning center** (`/learn`), in maths and chemistry, 12 topics each:
  - Maths: Klammern auflösen, Ausmultiplizieren, Formeln umstellen, Bruchrechnung, Potenzen und Wurzeln, Prozentrechnung, Gleichungen und Ungleichungen, Lineare Gleichungssysteme, pq-Formel, Geraden, Textaufgaben, Textaufgaben mit Unbekannten.
  - Chemistry: Teilchenmodell, Stoffgemische, Atombau, Periodensystem, Ionenbindung, Elektronenpaarbindung, Chemische Reaktionen, Reaktionsgleichungen, Säuren und Basen, Redoxreaktionen, Stoffmenge, Alkane.
  - Each topic has a guided lesson with Blob as tutor (animated step-by-step boards, interactive widgets, checks), endless adaptive practice in three levels, a graded quick test and a printable cheat sheet. XP, daily goal, streaks and mastery are saved per topic.
  - Blob reads wrong answers and says what probably went wrong ("expanded, but not simplified yet", "the 2 belongs to the whole OH group", "count the O atoms"): generic diagnoses in `src/learn/engine/diagnose.ts` and `src/learn/chemistry/check.ts`, plus each topic's typical misconceptions (`mistakes`), simulated from the task's own numbers.
- **Presentations**: 17 layouts (incl. stats, timeline, compare, formula), 10 themes plus a custom theme editor, slide transitions (incl. morph), click-by-click builds, drag-to-reorder, and a presenter (`/present/[id]`) with speaker view, second window, overview, laser and black/white screen.
- **Tasks**: quick add with natural dates (`Bio test fri #biology`), groups by due date, two-week heatmap, jelly check-off animation.
- **Subjects**, **favorites**, **trash** with restore, **⌘K** search across titles and note contents, light/dark/system themes.
- **German and English**: the whole site, lessons and auth emails in both languages. German is the default; the browser's language decides for new visitors, and the switch in Settings (or DE | EN on the public pages) is remembered per browser and on the account.
- **Animations**: a physics-driven SVG mascot (squash and stretch, jiggle, eye tracking, moods), a gooey intro animation once per session, gooey loaders.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase values
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` first runs `scripts/migrate.mjs`, which applies any new files in `supabase/migrations/` to the database in `POSTGRES_URL_NON_POOLING` and records them in `blob_meta.migrations`. Set `SKIP_MIGRATIONS=1` to build without touching the database. On Vercel, the Supabase integration provides the variable, so every deploy keeps the schema up to date.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run migrate`.

## Auth emails (blob.bojes.org)

Every auth email (confirm sign up, magic link, password reset, email change, invite) uses the branded templates in `supabase/templates/`. Their buttons open `https://blob.bojes.org/auth/confirm?...`, which verifies the link only after a click, so email scanners (common on school accounts) can't use it up, and it works on any device.

`scripts/configure-auth.mjs` applies everything through the Supabase Management API: Site URL, allowed redirect URLs, templates and, optionally, SMTP.

```bash
# 1. Site URL, redirect URLs and templates (emails still go out through Supabase's built-in mailer)
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs

# 2. Once the domain is verified in Resend, send from noreply@blob.bojes.org
SUPABASE_ACCESS_TOKEN=sbp_... SMTP_PASS=re_... node scripts/configure-auth.mjs
```

Add `--dry-run` to see what would change, and `--rotate-smtp-pass` after creating a new Resend key. Create the access token at https://supabase.com/dashboard/account/tokens (you can delete it afterwards).

### Sending from @blob.bojes.org with Resend

1. Create an account at https://resend.com (the free plan covers 3,000 emails a month).
2. **Domains → Add domain**: `blob.bojes.org`, region **EU (Ireland)**.
3. Add the DNS records Resend shows at IONOS (**Domains & SSL → bojes.org → DNS → Add record**). IONOS host names are relative to `bojes.org`, so they look like this (copy the exact values from Resend):

   | Type | Host name (IONOS) | Value |
   | --- | --- | --- |
   | TXT | `resend._domainkey.blob` | `p=MIGf...` (DKIM key from Resend) |
   | MX | `send.blob` | `feedback-smtp.eu-west-1.amazonses.com`, priority 10 |
   | TXT | `send.blob` | `v=spf1 include:amazonses.com ~all` |
   | TXT | `_dmarc.blob` | `v=DMARC1; p=none;` (optional: without it, the `_dmarc.bojes.org` policy applies) |

   These sit under `blob.bojes.org`, so they don't clash with the CNAME that points the site to Vercel.
4. Press **Verify** in Resend (usually a few minutes).
5. **API Keys → Create**: permission *Sending access*, domain `blob.bojes.org`. Use the `re_...` key as `SMTP_PASS` above.

Doing it by hand instead? In the Supabase dashboard set **Authentication → URL Configuration** (Site URL `https://blob.bojes.org`, redirect URLs `https://blob.bojes.org/**`, `https://blob-umber.vercel.app/**`, `http://localhost:3000/**`), paste each `supabase/templates/*.html` into **Authentication → Emails → Templates**, and under **SMTP Settings** use host `smtp.resend.com`, port `465`, user `resend`, password = the Resend key, sender `noreply@blob.bojes.org`, name `Blob`.

## Project layout

```
src/app/(auth)        sign in, sign up, password reset, check email, email link confirmation
src/app/(app)         the signed-in workspace (home, notes /p/[id], tasks, subjects, settings, trash)
src/app/present       fullscreen presenter
src/app/study         full-screen lessons, practice and tests
src/learn             learning center: engine (maths parser, checker, display language), players, topics
src/learn/chemistry   elements, formula and equation parser, chemistry checkers, visuals, topics
src/app/onboarding    first-run flow
src/app/auth          PKCE callback and sign out route
src/components/blob   the mascot, intro animation, loaders, helper and event bus
src/lib/supabase      browser/server/admin clients and the session proxy
supabase/migrations   SQL schema with row-level security
supabase/templates     branded auth email templates
scripts               build-time migrations, auth/email configuration
```

### Languages

`src/i18n/` holds the setup: `getLocale()` (server) reads the `blob-locale` cookie or the `Accept-Language` header; the proxy copies the account's language (`user_metadata.locale`) into the cookie on a new device. UI strings live in typed dictionaries in `src/i18n/messages/` (`defineMessages({ en, de })`, read with `useMessages` on the client and `getMessages` on the server; a missing German key is a type error). Learning content uses inline `tx("English", "Deutsch")` values instead, because it is built in code.

### Adding a learning topic

Topic metadata lives in `src/learn/catalog.ts` (with its subject); the content (lesson, cheat sheet, seeded exercise generator and typical mistakes) is one file per topic in `src/learn/topics/` (maths) or `src/learn/chemistry/topics/` (chemistry). Chemical notation uses `\ce{…}` inside the display language (`\ce{2H2 + O2 -> 2H2O}`, `\ce{SO4^2-}`). Maths is written in a small display language (`src/learn/engine/display.ts`) where tokens keep keys, so they glide between the steps of a worked solution. All student-facing text sits in those files, ready for translation.

All tables use row-level security, so every user can only read and write their own rows. Images go to the `uploads` storage bucket under the user's own folder.
