import type { Metadata } from "next";
import PlacardClient from "./PlacardClient";

export const metadata: Metadata = {
  title: "A card for your counter",
  // The URL is a bearer credential: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PlacardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PlacardClient token={token} />;
}
