import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import JoinCrewClient from "./JoinCrewClient";
import { fetchCrewInvite, firstName, paceLabel } from "./fetch-invite";

type PageProps = { params: Promise<{ code: string }> };

// og:image / twitter:image come from the colocated opengraph-image.tsx.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const invite = await fetchCrewInvite(code);
  const title = invite ? `Join ${invite.name} on Leaf` : "Join a crew · Leaf";
  const description = invite
    ? `${firstName(invite.ownerName)} invited you. ${paceLabel(invite)}, Leaf finds a night that works for everyone and plans it. Tap to join or say no thanks.`
    : "Recurring plans with your crew, on your schedule.";
  return {
    title,
    description,
    // An invite link is for the people it was sent to.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", url: `${SITE_URL}/crew/join/${code}`, siteName: "Leaf" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** /crew/join/<code> — where a crew's shareable invite link lands. */
export default async function JoinCrewPage({ params }: PageProps) {
  const { code } = await params;
  return <JoinCrewClient code={code} />;
}
