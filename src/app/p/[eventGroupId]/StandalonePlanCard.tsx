"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import PlanWhen from "./PlanWhen";
import StandalonePlanRsvp from "./StandalonePlanRsvp";

type Variant = "standalone" | "copy" | "privateCalendar";

type Props = {
  variant: Variant;
  eventGroupId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string | null;
  // Both `name` and `address` are null when the viewer hasn't proven they
  // belong on the guest list — server-side gating in getPlanShareInfo
  // strips the pair together so a venue name like "Home" doesn't leak the
  // same signal the address does. After a successful RSVP,
  // rsvpToPlanViaWeb returns both fields and StandalonePlanRsvp hands
  // them back via onLocationRevealed so the card swaps in the values.
  location: { name: string | null; address: string | null; timezone: string | null } | null;
  hostName: string | null;
  // The roster host who will physically be there — a different person from
  // `hostName` (whose plan it is). Null unless one has been assigned.
  rosterHost: { name: string; photoUrl: string | null; bio: string } | null;
  calendarName: string | null;
  calendarProfilePhoto: string | null;
  // Only present when variant === "privateCalendar"
  shareId: string | null;
  // Affects "Count me in" vs "Request to Attend" button copy
  requireApproval: boolean;
  // Confirmed attendee count + optional group-size cap — renders the
  // "N going · M spots left" line and the full-plan state.
  rsvpCount: number;
  capacity: number | null;
  // Set when /p/<id>?rsvp=1 — the visitor was bounced back from
  // /open/p/<id>?rsvp=1 after iOS failed to intercept (no app installed),
  // so the StandalonePlanRsvp child opens its RSVP modal on mount.
  autoOpenRsvp: boolean;
};

export default function StandalonePlanCard({
  variant,
  eventGroupId,
  title,
  description,
  image,
  expiryDate,
  location,
  hostName,
  rosterHost,
  calendarName,
  calendarProfilePhoto,
  shareId,
  requireApproval,
  rsvpCount,
  capacity,
  autoOpenRsvp,
}: Props) {
  const showWhen = variant !== "copy" && expiryDate !== null;
  const blurDetails = variant === "privateCalendar";
  const isFull = capacity != null && rsvpCount >= capacity;
  const spotsLeft = capacity != null ? Math.max(0, capacity - rsvpCount) : null;

  // Server returns null for non-attendees; revealed once the RSVP child
  // reports a successful Accepted RSVP and hands us the location pair.
  const [revealedName, setRevealedName] = useState<string | null>(
    location?.name ?? null
  );
  const [revealedAddress, setRevealedAddress] = useState<string | null>(
    location?.address ?? null
  );
  const locationGated =
    !!location && !revealedName && !revealedAddress && variant === "standalone";

  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-6 md:py-10 flex flex-col justify-center items-center gap-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm overflow-hidden">
        {image ? (
          <div
            className="w-full aspect-[4/3] bg-zinc-200 bg-cover bg-center"
            style={{ backgroundImage: `url(${image})` }}
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-zinc-200" />
        )}
        <div className={`p-6 space-y-4 ${blurDetails ? "blur-[2px] select-none pointer-events-none" : ""}`}>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
            {calendarName && variant === "privateCalendar" ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                {calendarProfilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={calendarProfilePhoto}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : null}
                <span>{calendarName}</span>
              </div>
            ) : null}
          </div>

          {showWhen && expiryDate ? (
            <PlanWhen expiryDate={expiryDate} timezone={location?.timezone ?? null} />
          ) : null}

          {location ? (
            locationGated ? (
              <div className="flex items-center gap-1.5 text-sm text-zinc-400 italic">
                <Lock className="w-3 h-3" />
                <span>Location shared after you RSVP</span>
              </div>
            ) : (
              <div className="text-sm text-zinc-700">
                {revealedName ? <div>{revealedName}</div> : null}
                {revealedAddress ? (
                  <div className="text-zinc-500">{revealedAddress}</div>
                ) : null}
              </div>
            )
          ) : variant !== "copy" ? (
            // No Location on the plan at all (the host left the venue blank).
            // getPlanShareInfo returns null only in that case — gating keeps
            // the object and nulls the name/address pair — so this can't be
            // confused with the redacted state above. Copy mode strips
            // instance context, so a recipe fork says nothing about where.
            <div className="flex items-center gap-1.5 text-sm text-zinc-400 italic">
              <MapPin className="w-3 h-3" />
              <span>Location TBD</span>
            </div>
          ) : null}

          {hostName ? (
            <div className="text-sm text-zinc-500">Hosted by {hostName}</div>
          ) : null}

          {variant !== "copy" && (rsvpCount > 0 || capacity != null) ? (
            <div className="text-sm text-zinc-500">
              {rsvpCount} going
              {capacity != null
                ? isFull
                  ? " · Full — waitlist open"
                  : ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                : null}
            </div>
          ) : null}

          {description ? (
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">
              {description}
            </p>
          ) : null}

          {/*
            The assigned roster host. This block is the promise /hosts/apply
            makes to applicants — "your photo and your description are shown to
            the people attending that event" — so it renders their words
            verbatim, not a summary, and shows nothing else about them.

            Not gated behind RSVP like the address is. Knowing a friendly face
            will be there is exactly the thing that gets a stranger over the
            line into RSVPing, and unlike the venue it leaks nothing about who
            else is coming or where anyone lives.
          */}
          {variant !== "copy" && rosterHost ? (
            <div className="flex gap-3 rounded-lg bg-zinc-50 p-3">
              {rosterHost.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rosterHost.photoUrl}
                  alt={rosterHost.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  Your host, {rosterHost.name}
                </p>
                {rosterHost.bio ? (
                  <p className="mt-0.5 text-sm text-zinc-600 whitespace-pre-wrap">
                    {rosterHost.bio}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-6 pt-0 space-y-3">
          {variant === "privateCalendar" && shareId ? (
            <>
              <Link
                href={`/org/${shareId}`}
                className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Request to follow {calendarName ?? "calendar"}
              </Link>
              <p className="text-xs text-center text-zinc-500">
                Followers see plan details. You&apos;ll get notified when the host approves.
              </p>
            </>
          ) : null}

          {variant === "standalone" ? (
            <>
              <StandalonePlanRsvp
                eventGroupId={eventGroupId}
                planTitle={title}
                planDescription={description}
                expiryDate={expiryDate}
                location={
                  location
                    ? {
                        name: revealedName,
                        address: revealedAddress,
                        timezone: location.timezone,
                      }
                    : null
                }
                requireApproval={requireApproval}
                isFull={isFull}
                autoOpenRsvp={autoOpenRsvp}
                onLocationRevealed={(loc) => {
                  if (loc.name) setRevealedName(loc.name);
                  if (loc.address) setRevealedAddress(loc.address);
                }}
              />
              {/* /open/p/<id> is the Universal Link bouncer — iOS intercepts
                  and opens the Leaf app when installed; otherwise the bouncer
                  page server-redirects to the App Store. Plain <a> (not next
                  Link) so the browser does a full navigation that Safari can
                  hand off to iOS's UL machinery. */}
              <a
                href={`/open/p/${eventGroupId}`}
                className="block w-full text-center border border-zinc-200 text-zinc-900 rounded-full py-3 text-sm font-medium hover:bg-zinc-50 transition"
              >
                Open in Leaf
              </a>
              <p className="text-xs text-center text-zinc-500">
                RSVP in the browser, or open Leaf to chat with the host.
              </p>
            </>
          ) : null}

          {variant === "copy" ? (
            <>
              <a
                href={`/open/p/${eventGroupId}?copy=1`}
                className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Save this plan in Leaf
              </a>
              <p className="text-xs text-center text-zinc-500">
                Open Leaf to add this plan to your own calendar.
              </p>
            </>
          ) : null}
        </div>
      </div>

      <a
        href="https://www.joinleaf.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-zinc-500 hover:opacity-70 transition-opacity"
      >
        <span className="text-sm">Powered by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/leaf-logo-black.png" alt="Leaf" className="h-6 w-auto" />
      </a>
    </div>
  );
}
