import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The CV's PDF (src/app/api/cv/pdf): a headless Chrome. Loaded as-is from node_modules, with its
  // compressed browser files, which a trace of the code alone would leave out.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: { "/api/cv/pdf": ["./node_modules/@sparticuz/chromium/bin/**"] },
  async headers() {
    return [
      {
        // "Sign in with Blob" SDK: loaded as a module from other sites.
        source: "/sdk/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        // The apps' offline helper (public/sw.js): always the latest, for the whole site.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Only lesson pictures (/embed) are made to sit in other sites' frames. Everything else may be framed
        // by Blob itself at most, so no other site can trick a signed-in student into clicks (clickjacking).
        source: "/((?!embed/|oauth/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
      {
        // Confirming a sign-in for the Blob app: never inside any frame, not even Blob's own.
        source: "/auth/app/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // The consent screen must never be shown inside someone else's frame (clickjacking).
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
