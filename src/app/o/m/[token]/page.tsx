import type { Metadata } from "next";
import MerchantOfferClient from "./MerchantOfferClient";

export const metadata: Metadata = {
  title: "Your night on the calendar",
  // The URL is a bearer credential: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function MerchantOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MerchantOfferClient token={token} />;
}
