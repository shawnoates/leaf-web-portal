import type { Metadata, Viewport } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in | Leaf for local places",
  description: "Get the link to your Leaf nights: your dashboard, RSVPs and bookings.",
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
