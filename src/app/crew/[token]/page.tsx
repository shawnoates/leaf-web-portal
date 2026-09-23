import type { Metadata } from "next";
import CrewClient from "./CrewClient";

export const metadata: Metadata = {
  title: "Your crew · Leaf",
  // The URL is a bearer credential for one member; never indexed.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * /crew/[token] — the member page for Friend Mode.
 *
 * `token` is either an HMAC member-link token (from a text) or, for someone
 * signed in on /me, the crew id. The client tries the token first and falls
 * back to the session + crewId, so both kinds of link render the same page.
 */
export default async function CrewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CrewClient token={token} />;
}
