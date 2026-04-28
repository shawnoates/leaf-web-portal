import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import UserActivityBeacon from "@/components/UserActivityBeacon";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leaf OS — Community Calendars for Organizations",
  description:
    "AI-powered community calendars that help organizations plan meaningful gatherings. Members host, people RSVP.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-zinc-900 selection:bg-zinc-200">
        <UserActivityBeacon />
        {children}
      </body>
    </html>
  );
}
