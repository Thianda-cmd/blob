export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Prefer the new publishable key; fall back to the legacy anon key.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
