import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Short-slug aliases → real legal pages. Anyone with an old
      // /terms or /privacy bookmark still lands on real content.
      { source: "/terms", destination: "/terms-conditions", permanent: true },
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
      // joinleaf.com (apex + www) → os.joinleaf.com/personal.
      //
      // Scoped via `has: host` so os.joinleaf.com traffic never trips
      // these — they only fire when the incoming Host header matches
      // the marketing domain. Path-specific rules above run first, so
      // /terms-conditions and /privacy-policy on joinleaf.com continue
      // to serve their real pages (same codebase renders them). Every
      // other path on joinleaf.com — including the bare root — 301s
      // to /personal on the app domain.
      //
      // Requires joinleaf.com to be added as an alternate domain on
      // this Amplify app (Hosting → Domain management). Until then
      // these rules don't fire because the app never sees the
      // marketing hostname.
      {
        source: "/:path*",
        has: [{ type: "host", value: "joinleaf.com" }],
        destination: "https://www.os.joinleaf.com/personal",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.joinleaf.com" }],
        destination: "https://www.os.joinleaf.com/personal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
