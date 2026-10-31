import type { Metadata } from "next";
import { inter } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Leaf Calendar Widget",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="font-sans bg-transparent text-zinc-900">
        {children}
      </body>
    </html>
  );
}
