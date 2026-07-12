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
  // Path aliases so joinleaf.com's public legal URLs keep working after
  // the domain merges into os.joinleaf.com. Internal code uses the short
  // /terms and /privacy paths (matches the existing /safety pattern);
  // these aliases catch anyone who bookmarked or was linked to the
  // marketing-site paths.
  async redirects() {
    return [
      { source: "/terms-conditions", destination: "/terms", permanent: true },
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
    ];
  },
};

export default nextConfig;
