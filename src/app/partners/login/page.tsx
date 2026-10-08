import type { Metadata, Viewport } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Partner sign in | Leaf for businesses",
  description: "Get the link to your Neighbor Hours: your dashboard, RSVPs and bookings.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2ea",
};

export default function PartnerLoginPage() {
  return <LoginClient />;
}
