-- Sign in with Blob: Blob as an OpenID Connect provider for other websites.
--
-- Only server code (with the service role) reads or writes these tables. RLS is on with no
-- policies and anon/authenticated get no grants, so the Data API can't reach them at all.

-- People who may open /admin and manage apps. Add rows by hand (SQL), never from the app.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Registered apps (OAuth clients), e.g. LernLabor.
create table public.oauth_apps (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique check (client_id ~ '^[a-z0-9_-]{6,64}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  homepage_url text check (homepage_url is null or char_length(homepage_url) <= 300),
  privacy_url text check (privacy_url is null or char_length(privacy_url) <= 300),
  logo_url text check (logo_url is null or char_length(logo_url) <= 500),
  -- Shown when there is no logo: an emoji or 1–2 letters on the app's colour.
  mark text not null default '' check (char_length(mark) <= 4),
  color text not null default '#6d3df5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  redirect_uris text[] not null default '{}',
  -- Extra origins allowed to call the token endpoint from a browser (redirect URI origins always are).
  allowed_origins text[] not null default '{}',
  scopes text[] not null default '{openid,profile,email,offline_access}',
  -- Confidential apps (with a server) authenticate with a secret; public apps (browser, mobile) use PKCE.
  confidential boolean not null default false,
  secret_hash text,
  secret_hint text,
  -- Trusted (first-party) apps skip the consent screen.
  trusted boolean not null default false,
  disabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger oauth_apps_touch before update on public.oauth_apps
  for each row execute function public.touch_updated_at();

-- An authorization request waiting for the person to sign in and say yes.
-- The consent page only ever sees this id, never the raw parameters.
create table public.oauth_requests (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null,
  state text check (state is null or char_length(state) <= 1000),
  nonce text check (nonce is null or char_length(nonce) <= 500),
  code_challenge text check (code_challenge is null or char_length(code_challenge) between 43 and 128),
  code_challenge_method text check (code_challenge_method is null or code_challenge_method = 'S256'),
  prompt text,
  max_age integer,
  login_hint text check (login_hint is null or char_length(login_hint) <= 320),
  created_at timestamptz not null default now(),
  -- Long enough to create an account and confirm the email on the way.
  expires_at timestamptz not null default now() + interval '1 hour',
  completed_at timestamptz
);

create index oauth_requests_expires on public.oauth_requests (expires_at);

-- One-time authorization codes (stored as SHA-256 hashes).
create table public.oauth_codes (
  code_hash text primary key,
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null,
  nonce text,
  code_challenge text,
  code_challenge_method text,
  auth_time timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  used_at timestamptz
);

create index oauth_codes_expires on public.oauth_codes (expires_at);

-- Refresh tokens (hashed). Each use returns a new one; reusing an old one revokes the whole family.
create table public.oauth_refresh_tokens (
  token_hash text primary key,
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scopes text[] not null,
  family uuid not null,
  auth_time timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz
);

create index oauth_refresh_tokens_family on public.oauth_refresh_tokens (family);
create index oauth_refresh_tokens_user_app on public.oauth_refresh_tokens (user_id, app_id);

-- What each person allowed each app to see. Revoking it signs the app out.
create table public.oauth_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id, app_id)
);

create index oauth_grants_app on public.oauth_grants (app_id);

-- Signing keys for ID and access tokens. The newest active key signs; retired keys stay in the
-- JWKS for a while so tokens signed with them can still be checked.
create table public.oauth_keys (
  kid text primary key,
  alg text not null default 'RS256',
  public_jwk jsonb not null,
  private_jwk jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

-- What happened, for the admin panel (sign-ins per day, errors, revocations).
create table public.oauth_events (
  id bigint generated always as identity primary key,
  app_id uuid references public.oauth_apps (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('consent', 'authorize', 'token', 'refresh', 'denied', 'revoked', 'error', 'reuse')),
  detail text check (detail is null or char_length(detail) <= 300),
  created_at timestamptz not null default now()
);

create index oauth_events_app_time on public.oauth_events (app_id, created_at desc);
create index oauth_events_time on public.oauth_events (created_at desc);

alter table public.admins enable row level security;
alter table public.oauth_apps enable row level security;
alter table public.oauth_requests enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_refresh_tokens enable row level security;
alter table public.oauth_grants enable row level security;
alter table public.oauth_keys enable row level security;
alter table public.oauth_events enable row level security;

revoke all on public.admins, public.oauth_apps, public.oauth_requests, public.oauth_codes,
  public.oauth_refresh_tokens, public.oauth_grants, public.oauth_keys, public.oauth_events
  from anon, authenticated;
revoke all on sequence public.oauth_events_id_seq from anon, authenticated;

-- Redeems an authorization code exactly once, even when two requests race for it.
create or replace function public.oauth_redeem_code(p_code_hash text)
returns setof public.oauth_codes
language sql
security definer
set search_path = ''
as $$
  update public.oauth_codes
     set used_at = now()
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > now()
  returning *;
$$;

-- Rotates a refresh token exactly once; a second use of the same token returns nothing.
create or replace function public.oauth_use_refresh_token(p_token_hash text)
returns setof public.oauth_refresh_tokens
language sql
security definer
set search_path = ''
as $$
  update public.oauth_refresh_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and revoked_at is null
     and expires_at > now()
  returning *;
$$;

revoke all on function public.oauth_redeem_code(text) from public, anon, authenticated;
revoke all on function public.oauth_use_refresh_token(text) from public, anon, authenticated;
grant execute on function public.oauth_redeem_code(text) to service_role;
grant execute on function public.oauth_use_refresh_token(text) to service_role;
