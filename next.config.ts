import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

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
      // /churches is the plural people reach for; the landing itself
      // lives at /church-leaders (parallel to /resident-managers, and
      // kept distinct from /church, which is the example calendar).
      { source: "/churches", destination: "/church-leaders", permanent: false },
      // joinleaf.com is the canonical product domain. It used to 308 every
      // path except the legal pages and /help over to
      // os.joinleaf.com/personal; that catch-all is gone, so the apex now
      // serves the whole app.
      //
      // os.joinleaf.com deliberately still serves every route too, rather
      // than redirecting here. Installed iOS builds only claim
      // `applinks:os.joinleaf.com` (see Leaflets.entitlements), so a blanket
      // os → joinleaf redirect would push /p/* and /open/p/* off the host
      // those builds intercept and break "open in app" for everyone who
      // hasn't updated. Add that redirect once the release carrying
      // `applinks:joinleaf.com` has broad adoption. Until then the two hosts
      // are twins and canonical tags (src/lib/site.ts) settle which one wins.
      //
      // Apex → www so one host is canonical, matching how os.joinleaf.com
      // already 302s to www.os.joinleaf.com.
      //
      // The negative lookahead on `.well-known` is load-bearing: Next
      // evaluates redirects BEFORE routing, and Apple does not follow
      // redirects when fetching apple-app-site-association. Without the
      // exclusion the apex would 308 that file to www and Universal Links
      // registered against the bare apex would silently never associate.
      //
      // Split in two because `/:path(...)` won't match the bare root — the
      // custom pattern still needs a segment to bind to — and the root is
      // the one URL that absolutely has to redirect.
      {
        source: "/",
        has: [{ type: "host", value: "joinleaf.com" }],
        destination: "https://www.joinleaf.com/",
        permanent: true,
      },
      {
        source: "/:path((?!\\.well-known).*)",
        has: [{ type: "host", value: "joinleaf.com" }],
        destination: "https://www.joinleaf.com/:path",
        permanent: true,
      },
    ];
  },
};

export default withMDX(nextConfig);
