import type { Metadata } from "next";
import HostOfferClient from "./HostOfferClient";

export const metadata: Metadata = {
  title: "Can you host this one?",
  // Never indexed: the URL is a bearer credential, and a search engine that
  // crawled one would also stamp `viewedAt` on an offer nobody opened.
  robots: { index: false, follow: false, nocache: true },
};

export default async function HostOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <HostOfferClient token={token} />;
}
