import type { Metadata } from "next";
import PastEventsClient from "./PastEventsClient";

export const metadata: Metadata = {
  title: "Your past events · Leaf",
  description: "Photos and memories from events you've attended.",
};

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export default async function PastEventsPage({ params }: PageProps) {
  const { notificationId } = await params;
  return <PastEventsClient notificationId={notificationId} />;
}
