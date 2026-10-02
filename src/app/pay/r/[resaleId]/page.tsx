import type { Metadata } from "next";
import PayResaleClient from "./PayResaleClient";

// The dropout swap, from the side of the guest who dropped (server:
// cloud/p2p-payment.js). They paid the host, left, and their seat went back
// up; whoever takes it pays them back instead of the host. This page shows
// who took it and lets them confirm the payment — reached from the texts the
// server sends them, signed with a per-listing `?t=` so no sign-in is needed.

type PageProps = {
  params: Promise<{ resaleId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export const metadata: Metadata = {
  title: "Your seat · Leaf",
  description: "Who took your seat, and whether they've paid you back.",
  robots: { index: false, follow: false },
};

export default async function PayResalePage({ params, searchParams }: PageProps) {
  const { resaleId } = await params;
  const { t } = await searchParams;
  return <PayResaleClient resaleId={resaleId} token={t || null} />;
}
