import type { Metadata } from "next";
import RescheduleClient from "./RescheduleClient";

export const metadata: Metadata = {
  title: "Move this plan?",
  // The URL is a bearer credential; never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PlanReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { planId } = await params;
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  return <RescheduleClient planId={planId} token={token || ""} />;
}
