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
  searchParams: Promise<{ t?: string; plan?: string }>;
}) {
  const { t, plan } = await searchParams;
  // `plan` comes from a plan's link in the digest: the board opens on it.
  return (
    <HostBoardClient
      linkToken={typeof t === "string" ? t : null}
      focusKey={typeof plan === "string" && plan ? plan : null}
    />
  );
}
