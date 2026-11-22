import type { Metadata } from "next";
import { hideAppBannerInApp } from "@/lib/in-app";
import BillClient from "./BillClient";

// A regular plan's bill, as one person on it sees it (server:
// cloud/plan-bill.js). Whoever paid puts the bill in, splits it (pick items,
// or evenly plus tip) and sends requests; everyone else sees what they owe and
// pays the payer back on Venmo / Zelle / Apple Cash / Cash App / PayPal.
//
// Reached from the request itself: a push that opens this page in the app's
// browser, or a text. The link is `/bill/<EventNotification id>?t=<HMAC>`,
// which stands in for that person's seat, so nobody signs in to see what they
// owe. Without `t`, a signed-in guest of the plan gets their own seat.

type PageProps = {
  params: Promise<{ notificationId: string }>;
  searchParams: Promise<{ t?: string }>;
};

const metadata: Metadata = {
  title: "Split the bill · Leaf",
  description: "What you owe for this plan, and how to pay it back.",
  // Private to one guest, token or not.
  robots: { index: false, follow: false },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<object> }): Promise<Metadata> {
  return hideAppBannerInApp(metadata, searchParams);
}

export default async function BillPage({ params, searchParams }: PageProps) {
  const { notificationId } = await params;
  const { t } = await searchParams;
  return <BillClient notificationId={notificationId} token={t || null} />;
}
