"use client";

import { useEffect, useState } from "react";

type FormattedWhen = { date: string; time: string };

function formatWhen(expiryDate: string): FormattedWhen | null {
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

// Date/time has to render on the client. Node defaults to UTC, so SSR
// formatting an EDT event time renders four hours ahead. Effect-then-set
// keeps the SSR HTML free of any locale-formatted string, dodging the
// hydration mismatch that would otherwise flash the wrong time.
export default function PlanWhen({ expiryDate }: { expiryDate: string }) {
  const [when, setWhen] = useState<FormattedWhen | null>(null);
  useEffect(() => {
    setWhen(formatWhen(expiryDate));
  }, [expiryDate]);

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
