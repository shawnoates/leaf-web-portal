import type { Metadata, Viewport } from "next";
import PartnerClient from "./PartnerClient";

export const metadata: Metadata = {
  title: "Claim your free Neighbor Hour | Leaf for businesses",
  description: "Fill a slow hour with 8–15 neighbors from your Leaf neighborhood calendar. Your first Neighbor Hour is free: no listing fee, no RSVP fees.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2ea",
};

export default function PartnerPage() {
  return <PartnerClient />;
}
