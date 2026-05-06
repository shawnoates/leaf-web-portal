"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { ArrowLeft, Calendar, Camera, Loader2, MapPin } from "lucide-react";

type PastEvent = {
  notificationId: string;
  eventGroupId: string;
  title: string;
  image: string | null;
  expiryDate: string;
  location: { name: string; address: string } | null;
  calendarName: string | null;
  photoCount: number;
};

export default function PastEventsClient({
  notificationId,
}: {
  notificationId: string;
}) {
  const [events, setEvents] = useState<PastEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getPastAttendedEvents", {
          notificationId,
        })) as { events: PastEvent[] };
        if (!cancelled) setEvents(result.events);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your events.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center">
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!events) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <Link
        href={`/m/${notificationId}`}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Link>

      <h1 className="text-2xl sm:text-3xl font-light text-zinc-900 mb-2">
        Your past events
      </h1>
      <p className="text-sm text-zinc-500 mb-8">
        Open any event to view its gallery or add your own photos.
      </p>

      {events.length === 0 ? (
        <p className="text-center text-sm text-zinc-400 py-12">
          No past events yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((evt) => (
            <li key={evt.notificationId}>
              <Link
                href={`/m/${evt.notificationId}`}
                className="flex gap-4 border border-zinc-200 rounded-xl p-3 hover:border-zinc-300 transition-colors"
              >
                <div className="w-20 h-20 rounded-lg bg-zinc-100 flex-shrink-0 overflow-hidden">
                  {evt.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={evt.image}
                      alt={evt.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {evt.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(evt.expiryDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  {evt.location?.name && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{evt.location.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1">
                    <Camera className="w-3 h-3" />
                    {evt.photoCount} {evt.photoCount === 1 ? "photo" : "photos"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
