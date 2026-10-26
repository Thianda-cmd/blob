# Blob

A calm, Notion-style workspace for school: notes, presentations, homework, a learning center and a CV builder, with **Blob**, a jelly mascot who reacts to what you do and keeps everything saved.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, Tiptap 3 and Supabase (Postgres, Auth, Storage). Deployed on Vercel.

## Features

- **Auth**: sign up with email confirmation, password sign-in, magic links, forgot/reset password, change email/password, sign out everywhere, delete account. Blob watches you type and covers its eyes for passwords.
- **Onboarding**: name, school, subjects and theme in three steps; creates a welcome note and a first task.
- **Notes**: Tiptap editor with `/` commands, formatting bubble, checklists, callouts, images (paste/drop/upload), sub-pages, outline, autosave.
  - Text sizes in px, theme colours, highlighter colours and alignment; lists with their own size, marker style and start number, text under an item (Shift+Enter) and Ctrl/Cmd+Enter to go on below a list. Formatting lives in `src/components/editor/formatting.ts` (part of the shared schema).
  - Diagrams without code: a builder for mind maps, processes, cycles, timelines, pie charts and sequences (Mermaid code underneath), a large view and SVG/PNG downloads.
  - Find and replace (Ctrl/Cmd+F), moving and duplicating blocks (Ctrl/Cmd+Shift+↑/↓, Ctrl/Cmd+D), Markdown pasted as formatting, templates for a fresh note, a view menu (text size, width, Blob's own thick text cursor, focus mode).
  - Two notes side by side (Ctrl/Cmd+Shift+D) and switching to the last page (Ctrl/Cmd+Shift+L, hold for more); Ctrl/Cmd+/ lists every shortcut.
  - Export as PDF (Ctrl/Cmd+P, through the print window), **Word** (`.docx`, `src/notes/docx.ts`: formulas as editable Word equations, diagrams, plots and sketches as pictures in the light theme), Markdown, text or a **Blob file** (`.blob`, `src/notes/blobFile.ts`): JSON with the note, its sub-pages, pictures and attached files, which imports into any account. Settings → Export & import downloads everything as one Blob file.
  - Import: Blob files, Markdown and text from the New menus, or dropped anywhere in Blob outside a note (`FileDrop`); the apps also open `.blob` files with a double-click. Templates include lesson notes, Cornell notes, a lab report, vocabulary, an essay plan, a talk, exam prep and a book report.
  - **Public links** (Share → Public link): anyone with the link sees a note (with its sub-pages if you like), a presentation or a CV read-only at `/s/<token>`, without an account. Only the owner makes or stops one; viewers only go through `public_page()` and `public_file()` (migration 0019), never the tables.
- **Learning center** (`/learn`) in maths (15 topics), chemistry (12) and biology (16):
  - Every topic has a guided lesson with Blob as tutor (animated step-by-step boards, interactive widgets, checks), a cheat sheet, endless adaptive practice and a graded quick test. Maths and biology topics have all three levels (Einsteiger, Fortgeschritten, Experte) with a lesson each; chemistry topics have one lesson and practice at every level. XP, daily goal, streaks and mastery are saved per topic and level.
  - Blob reads wrong answers and says what probably went wrong ("expanded, but not simplified yet", "the 2 belongs to the whole OH group"): generic diagnoses in `src/learn/engine/diagnose.ts` and `src/learn/chemistry/check.ts`, plus each topic's typical misconceptions (`mistakes`), simulated from the task's own numbers.
  - **Public pictures** (`/show`): every lesson picture and widget has its own page that works without signing in, with share links, link previews and embed code (`/embed/…`, resized by `public/sdk/blob-embed.js`).
- **CV builder** (`/cv`): six designs (Klassisch, Modern, Kreativ, Kompakt, Minimal, Elegant), a guided form with tips and examples for school students, photo with cropping, drawn signature, a checklist, CVs in German or English, and a PDF through the print dialog. The engine (`src/cv/CvDocument.tsx`) measures the CV and fills A4 pages, so preview and PDF are the same pages.
  - A **cover letter** (Anschreiben) next to each CV: recipient with an automatic greeting, subject, the text in three parts with starter texts, regards and enclosures, drawn by the same engine (`src/cv/letter.tsx`) with a letterhead in the CV's design. The PDF can hold the letter, the CV or both.
- **Projects** (`/projects`): boards with columns, cards (assignees, labels, checklists, files, links and attached pages), members with live presence, and templates. A note's bar shows the cards it is on and adds it to a project (sharing it with the group); a project lists its materials and starts a shared note; subjects list their projects (`src/components/projects/links.ts`).
- **Calendar** (`/calendar`): events, lessons and repeating series (also in even or odd calendar weeks) next to tasks and the project cards assigned to you. Home shows today's events (tomorrow's once today's are over).
  - **Timetable import**: the BTA926A timetable from [bta.bojes.org](https://bta.bojes.org) (button "Timetable", or link to `/calendar?import=bta`). Every lesson becomes one weekly series until the summer, without holidays, public holidays and bridge days; fortnightly lessons keep to even weeks, quarter lessons end with their quarter. Exams become exam tasks, holidays all-day events. Importing again replaces the earlier import from the chosen day on. `api/timetable/bta` reads the site (its TanStack Start server function and the school year in its scripts, `src/calendar/bta.ts`); `src/calendar/timetable.ts` plans the changes (one undo).
- **Live quiz** (`/quiz`, `/live/[game]`, `/play`): Kahoot-style quizzes. Six question types (quiz with one or several right answers, true/false, type answer with typo tolerance, poll, puzzle, slider), pictures, time limits, double points and explanations. The host's big screen shows the PIN and a QR code, everyone's Blob, each question, the answers with how the class voted, a scoreboard and a podium, with music made in the browser. Players join at `/play` without an account, pick a name and a Blob, and see right/wrong, points, streaks and their place. The server decides everything (`src/quiz/server.ts`, service role only, migration 0021): speed points from when it got the answer, the right answers stay hidden until the question is over, live updates on a channel only the server may send on. Results per game with a CSV download. A quiz can also start from a note (*Lernen → Live-Quiz*, or *From a note* on `/quiz`): the note's own study questions become live ones (`src/quiz/fromNote.ts`). The big screen shows who has answered, the points each player just won, who moved up and how many questions are left; screens stay awake while a game runs.
- **Presentations**: 17 layouts (incl. stats, timeline, compare, formula), 10 themes plus a custom theme editor, slide transitions (incl. morph), click-by-click builds, drag-to-reorder, and a presenter (`/present/[id]`) with speaker view, second window, overview, laser and black/white screen.
- **Tasks**: quick add with natural dates (`Bio test fri #biology`), groups by due date, two-week heatmap, jelly check-off animation.
- **Subjects**, **favorites**, **trash** with restore, **⌘K** search across titles and note contents, light/dark/system themes.
- **Sign in with Blob**: Blob is an OpenID Connect provider for other school apps (developer docs at `/developers`, apps managed in `/admin`).
- **German and English**: the whole site, lessons and auth emails in both languages. German is the default; the browser's language decides for new visitors, and the switch in Settings (or DE | EN on the public pages) is remembered per browser and on the account.
- **Animations**: a physics-driven SVG mascot (squash and stretch, jiggle, eye tracking, moods), a gooey intro animation once per session, gooey loaders.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase values
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` first runs `scripts/migrate.mjs`, which applies any new files in `supabase/migrations/` to the database in `POSTGRES_URL_NON_POOLING` and records them in `blob_meta.migrations`. Set `SKIP_MIGRATIONS=1` to build without touching the database. On Vercel, the Supabase integration provides the variable, so every deploy keeps the schema up to date.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run migrate`, `npm run check:learn` (checks every lesson, cheat sheet and task generator in both languages; run it before committing learning content), `npm run check:calendar` (repeating events and the timetable import), `npm run check:quiz` (the live quiz's grading, points and quizzes from notes) and `npm run show-manifest` (the list of public pictures; also runs before every build).

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
src/learn             learning center: engine (maths parser, checker, display language), players, maths topics
src/learn/chemistry   elements, formula and equation parser, chemistry checkers, visuals, topics
src/learn/biology     biology visuals and topics
src/app/show, embed   public picture pages and embeds
src/cv                CV builder: CV format, page engine, designs (templates/), sample CV
src/components/cv     CV editor, form, design panel and the /cv home
src/quiz              live quiz: questions, grading, names, the game server; src/components/quiz: editor, big screen, phones, results
src/app/onboarding    first-run flow
src/app/auth          PKCE callback and sign out route
src/components/blob   the mascot, intro animation, loaders, helper and event bus
src/lib/supabase      browser/server/admin clients and the session proxy
supabase/migrations   SQL schema with row-level security
supabase/templates     branded auth email templates
scripts               build-time migrations, auth/email configuration, picture manifest, learning content checks
docs                  guides (docs/learning-center.md: how the learning center works and how to add topics)
```

### Languages

`src/i18n/` holds the setup: `getLocale()` (server) reads the `blob-locale` cookie or the `Accept-Language` header; the proxy copies the account's language (`user_metadata.locale`) into the cookie on a new device. UI strings live in typed dictionaries in `src/i18n/messages/` (`defineMessages({ en, de })`, read with `useMessages` on the client and `getMessages` on the server; a missing German key is a type error). Learning content uses inline `tx("English", "Deutsch")` values instead, because it is built in code.

### Adding a learning topic

Read `docs/learning-center.md`: it explains the catalog (`src/learn/catalog.ts`), the topic folders with one file per level, the seeded task generators, typical mistakes, the display language (tokens keep keys, so they glide between the steps of a worked solution; chemistry uses `\ce{…}`), bilingual text with `tx("English", "Deutsch")`, how to add a whole subject, and how public picture links stay stable. Run `npm run check:learn` before committing.

All tables use row-level security, so every user can only read and write their own rows. Images go to the `uploads` storage bucket under the user's own folder.
