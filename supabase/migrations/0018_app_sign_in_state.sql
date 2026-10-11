-- Signing in the app through the browser (src/lib/auth/appSignIn.ts): the app may also pick up an
-- approved sign-in itself, by asking with its `state` (and proving it holds the verifier), so it
-- doesn't depend on the browser opening the app's link. Only the state's SHA-256 is kept.
alter table public.app_sign_ins
  add column if not exists state_hash text check (state_hash is null or state_hash ~ '^[0-9a-f]{64}$');

create index if not exists app_sign_ins_state_idx on public.app_sign_ins (state_hash) where used_at is null;
