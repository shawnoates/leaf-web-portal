import type { Metadata } from "next";
import { Suspense } from "react";
import StartCrewClient from "./StartCrewClient";

export const metadata: Metadata = {
  title: "Start a crew · Leaf",
  description: "Leaf finds a night that works for your friends and plans it. You add the people; Leaf does the rest.",
};

/**
 * /crew/start — set up Friend Mode from the web.
 *
 * For people who don't use the app: name the crew, add friends, pick a
 * rhythm, verify your own phone, send the invites. Signed-in visitors from
 * /me skip the phone step.
 */
export default function StartCrewPage() {
  return (
    <Suspense fallback={null}>
      <StartCrewClient />
    </Suspense>
  );
}
