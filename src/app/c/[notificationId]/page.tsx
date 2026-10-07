import type { Metadata } from "next";
import ChatLanding from "./ChatLanding";

// Generic OG metadata — the notification id is opaque/private so we don't
// fetch plan details here. The host already knows what plan they hosted.
export const metadata: Metadata = {
  title: "Open the conversation · Leaf",
  description: "Tap to open the plan chat in the Leaf app.",
  openGraph: {
    title: "Open the conversation",
    description: "Tap to open the plan chat in the Leaf app.",
    type: "website",
    siteName: "Leaf",
  },
};

type PageProps = {
  params: Promise<{ notificationId: string }>;
  searchParams: Promise<{ inapp?: string }>;
};

export default async function ChatSharePage({ params, searchParams }: PageProps) {
  const { notificationId } = await params;
  const { inapp } = await searchParams;
  return <ChatLanding notificationId={notificationId} fromApp={inapp === "1"} />;
}
