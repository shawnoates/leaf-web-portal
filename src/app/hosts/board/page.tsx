import type { Metadata } from "next";
import HostBoardClient from "./HostBoardClient";

export const metadata: Metadata = {
  title: "Plans that need a host",
  // The link is a bearer credential for one host; never indexed or cached.
  robots: { index: false, follow: false, nocache: true },
};

export default async function HostBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return <HostBoardClient linkToken={typeof t === "string" ? t : null} />;
}
