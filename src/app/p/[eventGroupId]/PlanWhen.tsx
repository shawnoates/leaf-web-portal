"use client";

import { useEffect, useState } from "react";

type FormattedWhen = { date: string; time: string };

function formatWhen(
  expiryDate: string,
  timezone: string | null,
): FormattedWhen | null {
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  // Pass timeZone when the cloud function returned the venue's IANA zone
  // (resolved from Location.timezone.timeZoneId). When it's null —
  // unlocated plan, legacy row with no timezone — fall through to the
  // viewer's local zone so we render something sensible instead of UTC.
  const opts: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...opts,
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...opts,
    }),
  };
}

// Date/time renders on the client to use a real timezone string. SSR Node
// defaults to UTC, so server-formatting an EDT event would show four hours
// ahead. Effect-then-set keeps the SSR HTML free of any locale-formatted
// string, dodging the hydration mismatch that would otherwise flash the
// wrong time.
export default function PlanWhen({
  expiryDate,
  timezone,
}: {
  expiryDate: string;
  timezone: string | null;
}) {
  const [when, setWhen] = useState<FormattedWhen | null>(null);
  useEffect(() => {
    setWhen(formatWhen(expiryDate, timezone));
  }, [expiryDate, timezone]);

  if (!when) {
    return (
      <div className="text-sm text-zinc-700" aria-busy="true">
        <div className="h-5 w-40 rounded bg-zinc-100" />
        <div className="h-5 w-24 rounded bg-zinc-100 mt-1" />
      </div>
    );
  }

  return (
    <div className="text-sm text-zinc-700">
      <div>{when.date}</div>
      <div className="text-zinc-500">{when.time}</div>
    </div>
  );
}
