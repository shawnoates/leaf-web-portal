import type { Metadata } from "next";
import JoinCrewClient from "./JoinCrewClient";

export const metadata: Metadata = {
  title: "Join a crew · Leaf",
  description: "Recurring plans with your crew, on your schedule.",
};

/** /crew/join/<code> — where a crew's shareable invite link lands. */
export default async function JoinCrewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinCrewClient code={code} />;
}
