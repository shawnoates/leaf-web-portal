import type { Metadata } from "next";
import HostHypeClient from "./HostHypeClient";

export const metadata: Metadata = {
  title: "Hype your plan · Leaf",
  description: "Open the chat or message everyone before your plan starts.",
};

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export default async function HostHypePage({ params }: PageProps) {
  const { notificationId } = await params;
  return <HostHypeClient notificationId={notificationId} />;
}
