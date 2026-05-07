"use client";

import Link from "next/link";
import { Calendar, MapPin, Sparkles, Users } from "lucide-react";

type ViewerRole = "owner" | "host" | "attendee";

type Recap = {
  rsvpCount: number;
  photoCount: number;
  dayOfWeek: string | null;
  timeOfDay: string | null;
  venueName: string | null;
  weeksSinceLastPlan: number | null;
};

type CalendarInfo = {
  objectId: string;
  shareId: string | null;
  name: string | null;
};

type Event = {
  title: string;
  description: string;
  image: string | null;
  location: { name: string; address: string } | null;
};

interface Props {
  viewerRole: ViewerRole;
  calendar: CalendarInfo | null;
  recap: Recap;
  event: Event;
}

function buildPrefillUrl(base: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function HostTheNextOne({ viewerRole, calendar, recap, event }: Props) {
  if (!calendar) return null;

  const isHost = viewerRole === "owner" || viewerRole === "host";
  const venueAddress = event.location?.address || "";
  const venueName = event.location?.name || recap.venueName || "";

  const venueJson = venueName
    ? JSON.stringify({ name: venueName, address: venueAddress })
    : "";

  const ctaHref = isHost
    ? buildPrefillUrl(`/dashboard/${calendar.objectId}/plans`, {
        prefillTitle: event.title,
        prefillDescription: event.description,
        prefillVenue: venueJson || undefined,
      })
    : calendar.shareId
    ? buildPrefillUrl(`/org/${calendar.shareId}`, {
        suggest: "1",
        prefillTitle: event.title,
        prefillDescription: event.description,
        prefillVenue: venueJson || undefined,
      })
    : null;

  if (!ctaHref) return null;

  const headline = isHost ? "Host the next one" : "Suggest the next one";
  const ctaLabel = isHost ? "Host another like this" : "Suggest a follow-up";
  const subhead = isHost
    ? "Pre-filled with what worked. Pick a new date."
    : `Send ${calendar.name || "the host"} a date for the next one. They approve, it goes live.`;

  // Build the stat row — only include facts we actually have.
  const stats: { icon: React.ReactNode; label: string }[] = [];
  if (recap.rsvpCount > 0) {
    stats.push({
      icon: <Users className="w-3.5 h-3.5" />,
      label: `${recap.rsvpCount} RSVP${recap.rsvpCount === 1 ? "" : "s"}`,
    });
  }
  if (recap.dayOfWeek && recap.timeOfDay) {
    stats.push({
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: `${recap.dayOfWeek} ${recap.timeOfDay}`,
    });
  }
  if (venueName) {
    stats.push({
      icon: <MapPin className="w-3.5 h-3.5" />,
      label: venueName,
    });
  }
  if (recap.weeksSinceLastPlan != null && recap.weeksSinceLastPlan >= 2) {
    stats.push({
      icon: <Sparkles className="w-3.5 h-3.5" />,
      label: `${recap.weeksSinceLastPlan} weeks since the last one`,
    });
  }

  if (stats.length === 0) return null;

  return (
    <div className="border-t border-zinc-100 mt-10 pt-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
          {headline}
        </p>
        <h2 className="text-xl font-light text-zinc-900 mb-1">
          {event.title}
        </h2>
        <p className="text-sm text-zinc-500 mb-5 font-light">{subhead}</p>

        <div className="flex flex-col gap-2 mb-5">
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-zinc-600"
            >
              <span className="text-zinc-400">{s.icon}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
