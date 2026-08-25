import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import UserActivityBeacon from "@/components/UserActivityBeacon";
import { SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_TITLE = "Leaf OS — Community Calendars";
const SITE_DESCRIPTION =
  "AI-powered community calendars that help organizations plan meaningful gatherings. Members host, people RSVP.";

export const metadata: Metadata = {
  // Lets URL-based metadata fields below (and in any child route) use a
  // relative path. Also required off-Vercel: without it Next resolves
  // relative og:image URLs against localhost:3000.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  // Domain-wide link preview. Metadata merging is shallow and per-key, so
  // any route that exports its own `openGraph` (/org, /p, /poll, /m, the
  // marketing landings) replaces this wholesale; every route that doesn't
  // — the bare domain, /personal, /about, /safety, /calendars, the legal
  // pages — inherits it and unfurls with a branded card instead of a
  // naked URL.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: "Leaf",
    images: [
      {
        url: "/api/og/default",
        width: 1200,
        height: 630,
        alt: "Leaf — community calendars for the people around you",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/api/og/default"],
  },
  // Apple-managed smart app banner shown across Safari on iOS — prompts
  // visitors to install the Leaf app. Universal links handle deep-linking
  // for already-installed users, so app-argument is unnecessary.
  other: {
    "apple-itunes-app": "app-id=1040588046",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* OpenAI Ads conversion pixel */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.oaiq = window.oaiq || function () {
                (window.oaiq.q = window.oaiq.q || []).push(arguments);
              };
              oaiq("init", { pixelId: "FVMLwvPMmn8xZGNNktSZ6H" });
            `,
          }}
        />
        <script async src="https://bzrcdn.openai.com/sdk/oaiq.min.js" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-white text-zinc-900 selection:bg-zinc-200">
        <UserActivityBeacon />
        {children}
      </body>
    </html>
  );
}
