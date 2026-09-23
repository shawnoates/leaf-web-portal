import type { Metadata } from "next";
import CrewBookClient from "./CrewBookClient";

export const metadata: Metadata = {
  title: "Crew Book · Leaf",
  robots: { index: false, follow: false, nocache: true },
};

/** /crew/[token]/book — the crew's shared list of places, plus your own saves. */
export default async function CrewBookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CrewBookClient token={token} />;
}
