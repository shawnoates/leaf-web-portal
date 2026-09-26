import type { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export const metadata: Metadata = {
  title: "How your night went",
  // The URL is a bearer credential: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ResultsClient token={token} />;
}
