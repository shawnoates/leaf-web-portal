"use client";

import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";

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
  hidePlanIdeas?: boolean;
  hideCustomPlans?: boolean;
};

type Event = {
  title: string;
  description: string;
  image: string | null;
  location: { name: string; address: string } | null;
};

type PlanIdea = {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  date: string | null;
  location: { name: string; address: string } | null;
};

type NextSeriesInstance = {
  objectId: string;
  title: string;
  expiryDate: string | null;
};

interface Props {
  viewerRole: ViewerRole;
  calendar: CalendarInfo | null;
  recap: Recap;
  event: Event;
  nextPlanIdea?: PlanIdea | null;
  /** When the just-finished plan is part of a recurring series and the next
   *  instance has already been materialized, surface a direct RSVP CTA
   *  ("Join the next one") instead of the generic "Host another" prompt. */
  nextSeriesInstance?: NextSeriesInstance | null;
  /** When set, the create-plan flow returns here on cancel (not on create). */
  returnTo?: string;
}

function buildPrefillUrl(
  base: string,
  params: Record<string, string | undefined>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function formatIdeaDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function HostTheNextOne({
  viewerRole,
  calendar,
  event,
  nextPlanIdea,
  nextSeriesInstance,
  returnTo,
}: Props) {
  if (!calendar) return null;

  // Recurring series wins the slot — attendees get a direct RSVP link to the
  // next instance instead of a "host another" prompt. Different audience too:
  // shown to everyone (attendees AND host), since the host already isn't
  // creating it again — the cron did.
  if (nextSeriesInstance) {
    const nextDateLabel = (() => {
      if (!nextSeriesInstance.expiryDate) return null;
      const d = new Date(nextSeriesInstance.expiryDate);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    })();
    return (
      <div className="border-t border-zinc-100 mt-10 pt-8">
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
            Happening again
          </p>
          <h2 className="text-xl font-light text-zinc-900 mb-1">{nextSeriesInstance.title}</h2>
          {nextDateLabel && (
            <p className="text-sm text-zinc-500 mb-5 font-light flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{nextDateLabel}</span>
            </p>
          )}
          <Link
            href={`/p/${nextSeriesInstance.objectId}`}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            Join the Next One
          </Link>
        </div>
      </div>
    );
  }

  const hasPlanIdea = !!nextPlanIdea && !calendar.hidePlanIdeas;
  const canRepeatPlan = !calendar.hideCustomPlans;

  // If neither source is available, hide the card entirely.
  if (!hasPlanIdea && !canRepeatPlan) return null;

  const source = hasPlanIdea ? "idea" : "repeat";
  const isHost = viewerRole === "owner" || viewerRole === "host";

  // Pick the content shown in the card based on source.
  const cardTitle = hasPlanIdea ? nextPlanIdea!.title : event.title;
  const cardDescription = hasPlanIdea
    ? nextPlanIdea!.description
    : event.description;
  const cardLocation = hasPlanIdea ? nextPlanIdea!.location : event.location;
  const cardDateLabel = hasPlanIdea ? formatIdeaDate(nextPlanIdea!.date) : null;

  const venueAddress = cardLocation?.address || "";
  const venueName = cardLocation?.name || "";
  const venueJson = venueName
    ? JSON.stringify({ name: venueName, address: venueAddress })
    : "";

  const ctaHref = isHost
    ? buildPrefillUrl(`/dashboard/${calendar.objectId}/plans`, {
        prefillTitle: cardTitle,
        prefillDescription: cardDescription,
        prefillVenue: venueJson || undefined,
        returnTo: returnTo || undefined,
      })
    : calendar.shareId
    ? buildPrefillUrl(`/org/${calendar.shareId}`, {
        suggest: "1",
        prefillTitle: cardTitle,
        prefillDescription: cardDescription,
        prefillVenue: venueJson || undefined,
        returnTo: returnTo || undefined,
      })
    : null;

  if (!ctaHref) return null;

  const headline =
    source === "idea" ? "Host the next one" : "Host another like this";
  const ctaLabel = "Host Another";
  const subhead =
    source === "idea"
      ? "Pick this up — it's pre-loaded with details. Choose a date and confirm."
      : isHost
      ? "Pre-filled with what worked. Pick a new date."
      : `Send ${calendar.name || "the host"} a date for the next one. They approve, it goes live.`;

  // Stats — for plan ideas, show the suggested date + venue. For "repeat this
  // plan", omit RSVP count (per spec — that was last time's number, not this
  // future plan's) and just show venue if present.
  const stats: { icon: React.ReactNode; label: string }[] = [];
  if (cardDateLabel) {
    stats.push({
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: cardDateLabel,
    });
  }
  if (venueName) {
    stats.push({
      icon: <MapPin className="w-3.5 h-3.5" />,
      label: venueName,
    });
  }

  return (
    <div className="border-t border-zinc-100 mt-10 pt-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
          {headline}
        </p>
        <h2 className="text-xl font-light text-zinc-900 mb-1">{cardTitle}</h2>
        {cardDescription && (
          <p className="text-sm text-zinc-500 mb-3 font-light line-clamp-2">
            {cardDescription}
          </p>
        )}
        <p className="text-sm text-zinc-500 mb-5 font-light">{subhead}</p>

        {stats.length > 0 && (
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
        )}

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
