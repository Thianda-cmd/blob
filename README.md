# Blob

A calm, Notion-style workspace for school: notes, presentations and homework, with **Blob**, a jelly mascot who reacts to what you do and keeps everything saved.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, Tiptap 3 and Supabase (Postgres, Auth, Storage). Deployed on Vercel.

## Features

- **Auth**: sign up with email confirmation, password sign-in, magic links, forgot/reset password, change email/password, sign out everywhere, delete account. Blob watches you type and covers its eyes for passwords.
- **Onboarding**: name, school, subjects and theme in three steps; creates a welcome note and a first task.
- **Notes**: Tiptap editor with `/` commands, formatting bubble, checklists, callouts, images (paste/drop/upload), sub-pages, outline, autosave.
- **Presentations**: slide editor with six layouts, three themes, drag-to-reorder, speaker notes, and a fullscreen presenter (`/present/[id]`).
- **Tasks**: quick add with natural dates (`Bio test fri #biology`), groups by due date, two-week heatmap, jelly check-off animation.
- **Subjects**, **favorites**, **trash** with restore, **⌘K** search across titles and note contents, light/dark/system themes.
- **Animations**: a physics-driven SVG mascot (squash and stretch, jiggle, eye tracking, moods), a gooey intro animation once per session, gooey loaders.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase values
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` first runs `scripts/migrate.mjs`, which applies any new files in `supabase/migrations/` to the database in `POSTGRES_URL_NON_POOLING` and records them in `blob_meta.migrations`. Set `SKIP_MIGRATIONS=1` to build without touching the database. On Vercel, the Supabase integration provides the variable, so every deploy keeps the schema up to date.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run migrate`.

## Supabase setup (one time)

In the Supabase dashboard:

1. **Authentication → URL Configuration**
   - **Site URL**: your production URL, e.g. `https://blob-<team>.vercel.app`
   - **Redirect URLs**: add `https://blob-<team>.vercel.app/**`, `https://*-<team>.vercel.app/**` (previews) and `http://localhost:3000/**`
2. **Authentication → Emails → SMTP**: the built-in mailer only sends a few emails per hour. Connect your own SMTP provider (e.g. Resend) before inviting classmates.
3. Optional, more robust email links: in the email templates, link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding` (confirm signup),
   `...&type=recovery&next=/reset-password` (reset password) and `...&type=magiclink&next=/home` (magic link).
   These work even when the link is opened in a different browser. The default templates also work.

## Project layout

```
src/app/(auth)        sign in, sign up, password reset, check email
src/app/(app)         the signed-in workspace (home, notes /p/[id], tasks, subjects, settings, trash)
src/app/present       fullscreen presenter
src/app/onboarding    first-run flow
src/app/auth          email link callback and sign out route
src/components/blob   the mascot, intro animation, loaders, helper and event bus
src/lib/supabase      browser/server/admin clients and the session proxy
supabase/migrations   SQL schema with row-level security
```

All tables use row-level security, so every user can only read and write their own rows. Images go to the `uploads` storage bucket under the user's own folder.
