import type { Metadata } from "next";
import VenueProposalClient from "./VenueProposalClient";

export const metadata: Metadata = {
  title: "Host a night on the calendar",
  // The URL is a bearer credential: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function VenueProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VenueProposalClient token={token} />;
}
