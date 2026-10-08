import type { Metadata, Viewport } from "next";
import PartnerClient from "./PartnerClient";

export const metadata: Metadata = {
  title: "Host neighbors at your place | Leaf",
  description: "Fill a slow night with 8–15 neighbors from your Leaf neighborhood calendar. Your first night is free: no listing fee, no RSVP fees.",
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
