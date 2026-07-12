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
  // Real legal pages live at the joinleaf.com-matching slugs so the
  // marketing-site deep links keep working after the domain merges into
  // os.joinleaf.com. The short /terms + /privacy aliases stay so any
  // bookmarks or old internal links still resolve.
  async redirects() {
    return [
      { source: "/terms", destination: "/terms-conditions", permanent: true },
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
    ];
  },
};

export default nextConfig;
