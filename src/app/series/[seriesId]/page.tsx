import type { Metadata } from "next";
import SeriesHostClient from "./SeriesHostClient";

export const metadata: Metadata = {
  title: "Your series",
  // The URL is a bearer credential; never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function SeriesHostPage({
  params,
  searchParams,
}: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { seriesId } = await params;
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  return <SeriesHostClient seriesId={seriesId} token={token || ""} />;
}
