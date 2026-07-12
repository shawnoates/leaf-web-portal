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
      // the marketing domain.
      //
      // Source uses a negative lookahead to skip /terms-conditions
      // and /privacy-policy so the legal deep-links continue to serve
      // their real pages on joinleaf.com. Next.js evaluates redirects
      // BEFORE page routing, so without this exclusion the catch-all
      // would eat those paths and bounce them to /personal. Anything
      // else — including the bare root — 308s to /personal.
      {
        source: "/((?!terms-conditions|privacy-policy).*)",
        has: [{ type: "host", value: "joinleaf.com" }],
        destination: "https://www.os.joinleaf.com/personal",
        permanent: true,
      },
      {
        source: "/((?!terms-conditions|privacy-policy).*)",
        has: [{ type: "host", value: "www.joinleaf.com" }],
        destination: "https://www.os.joinleaf.com/personal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
