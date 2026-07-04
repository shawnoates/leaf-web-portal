"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy route. Plan management now lives inside the dashboard Calendars tab as
 * a slide-over (see PlansManager). This page just forwards there, preserving
 * the "Host Another" deep-link params (prefill/returnTo) so the create flow
 * still opens pre-filled and bounces back on cancel.
 */
export default function PlansRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarId = params.calendarId as string;

  useEffect(() => {
    // For child calendars the parent org was passed as ?orgId; the dashboard is
    // always mounted at the org id.
    const orgId = searchParams.get("orgId") || calendarId;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("orgId");
    next.set("tab", "calendars");
    next.set("managePlans", calendarId);
    router.replace(`/dashboard/${orgId}?${next.toString()}`);
  }, [calendarId, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );
}
