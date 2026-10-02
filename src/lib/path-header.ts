/**
 * Request header with the page's path, set by the proxy (src/lib/supabase/proxy.ts) on every
 * request, so a client can't choose it. Layouts and getLocale don't get the path otherwise.
 */
export const PATH_HEADER = "x-blob-path";
