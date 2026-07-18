import type { Metadata } from "next";
import MeClient from "./MeClient";

// Attendee dashboard (/me). The live destination for the weekly SMS link.
// Auth is resolved client-side from the tokenized magic link (or an existing
// Parse session, or an OTP step) — see MeClient. No server prefetch: the
// session lives only in the browser Parse SDK, so this stays a thin shell.
export const metadata: Metadata = {
  title: "Your week · Leaf",
  robots: { index: false, follow: false },
};

export default function MePage() {
  return <MeClient />;
}
