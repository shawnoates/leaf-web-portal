import type { Metadata, Viewport } from "next";
import MerchantOfferClient from "./MerchantOfferClient";

export const metadata: Metadata = {
  title: "Your night on the calendar",
  // The URL is a bearer credential: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

// Opened from an email on a phone: fit the screen, let the sticky button sit
// above the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function MerchantOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MerchantOfferClient token={token} />;
}
