"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MapPin, Wallet } from "lucide-react";
import PlanHeroMedia from "./PlanHeroMedia";
import { OnlyOnLeafLine, OnlyOnLeafPill, type OnlyOnLeafInfo } from "@/components/OnlyOnLeaf";
import HlsVideo from "@/components/HlsVideo";
import HostIntroInline from "@/components/HostIntroInline";
import { introVideoFrame } from "@/lib/intro-video-frame";
import PlanWhen from "./PlanWhen";
import StandalonePlanRsvp from "./StandalonePlanRsvp";
import PlanInviteBanner from "@/components/PlanInviteBanner";
import { p2pPriceShort, type P2pSplitSummary } from "@/lib/p2p";

type Variant = "standalone" | "copy" | "privateCalendar";

type Props = {
  variant: Variant;
  eventGroupId: string;
  title: string;
  description: string;
  image: string | null;
  // The invitation video's HLS stream; plays inline over `image` as poster.
  videoUrl: string | null;
  expiryDate: string | null;
  // Both `name` and `address` are null when the viewer hasn't proven they
  // belong on the guest list — server-side gating in getPlanShareInfo
  // strips the pair together so a venue name like "Home" doesn't leak the
  // same signal the address does. After a successful RSVP,
  // rsvpToPlanViaWeb returns both fields and StandalonePlanRsvp hands
  // them back via onLocationRevealed so the card swaps in the values.
  location: { name: string | null; address: string | null; timezone: string | null } | null;
  // Where exactly at the venue, from the host. Gated with the address and
  // revealed with it after RSVP; null when the host never set one.
  meetingSpot?: string | null;
  hostName: string | null;
  // The plan's own host's face: their photo and, when they recorded one,
  // their 30-second hello (intro-video.js). Rendered as a "Your host" block
  // only when there is a hello — a photo alone changes nothing on this page.
  hostIntro?: {
    photoUrl: string | null;
    introVideo: { url: string; posterUrl: string | null; aspectRatio?: string | null } | null;
  } | null;
  // The roster host who will physically be there — a different person from
  // `hostName` (whose plan it is). Null unless one has been assigned.
  rosterHost: {
    name: string;
    photoUrl: string | null;
    bio: string;
    // Their 30-second intro, once uploaded and playable. `aspectRatio` is
    // Mux's "W:H" for the stored take; the box follows it.
    introVideo?: { url: string; posterUrl: string | null; aspectRatio?: string | null } | null;
  } | null;
  calendarName: string | null;
  calendarProfilePhoto: string | null;
  /** A night a business made for Leaf: "Only on Leaf" on the photo and under the title. */
  onlyOnLeaf?: OnlyOnLeafInfo;
  // Only present when variant === "privateCalendar"
  shareId: string | null;
  // Affects "Count me in" vs "Request to Attend" button copy
  requireApproval: boolean;
  // Confirmed attendee count + optional group-size cap — renders the
  // "N going · M spots left" line and the full-plan state.
  rsvpCount: number;
  capacity: number | null;
  /** Host collects peer to peer: price per spot, paid to them after RSVP. */
  p2pAmountCents?: number | null;
  p2pSplit?: P2pSplitSummary | null;
  // RSVP closes at start time; replaces the button with a disabled state.
  rsvpClosed: boolean;
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
  videoUrl,
  expiryDate,
  location,
  meetingSpot = null,
  hostName,
  hostIntro,
  rosterHost,
  calendarName,
  calendarProfilePhoto,
  onlyOnLeaf = null,
  shareId,
  requireApproval,
  rsvpCount,
  capacity,
  p2pAmountCents = null,
  p2pSplit = null,
  rsvpClosed,
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
  const [revealedSpot, setRevealedSpot] = useState<string | null>(meetingSpot);
  const locationGated =
    !!location && !revealedName && !revealedAddress && variant === "standalone";

  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-6 md:py-10 flex flex-col justify-center items-center gap-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="relative">
          <PlanHeroMedia image={image} videoUrl={videoUrl} />
          {onlyOnLeaf && <OnlyOnLeafPill />}
        </div>
        <div className={`p-6 space-y-4 ${blurDetails ? "blur-[2px] select-none pointer-events-none" : ""}`}>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
            <OnlyOnLeafLine info={onlyOnLeaf} />
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
                {revealedSpot ? (
                  <div className="mt-1 text-zinc-900">
                    <span className="font-medium">Meet at:</span> {revealedSpot}
                  </div>
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

          {variant !== "copy" && p2pPriceShort(p2pAmountCents, p2pSplit) ? (
            <div className="flex items-center gap-1.5 text-sm text-zinc-900">
              <Wallet className="w-3.5 h-3.5" />
              <span>{p2pPriceShort(p2pAmountCents, p2pSplit)}, paid to the host</span>
            </div>
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
            <div className="flex flex-wrap gap-3 rounded-lg bg-zinc-50 p-3">
              {rosterHost.introVideo ? (
                // The intro stands in for the avatar: its poster is the face.
                // Sized from the take's real shape, never cropped to a tall box.
                <div
                  className={introVideoFrame(rosterHost.introVideo.aspectRatio).className}
                  style={introVideoFrame(rosterHost.introVideo.aspectRatio).style}
                >
                  <HostIntroInline
                    src={rosterHost.introVideo.url}
                    poster={rosterHost.introVideo.posterUrl ?? rosterHost.photoUrl}
                    className="h-full w-full object-cover"
                    planId={eventGroupId}
                    by="roster"
                    surface="plan_page"
                  />
                </div>
              ) : rosterHost.photoUrl ? (
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
                {rosterHost.introVideo ? (
                  <p className="mt-2 text-xs text-zinc-500">▶ A quick hello from {rosterHost.name}</p>
                ) : null}
              </div>
            </div>
          ) : variant !== "copy" && hostIntro?.introVideo && hostName ? (
            // The plan's own host said hello. Same block as the roster one,
            // minus the bio (a _User has none); the poster is the face.
            <div className="flex flex-wrap gap-3 rounded-lg bg-zinc-50 p-3">
              <div
                className={introVideoFrame(hostIntro.introVideo.aspectRatio).className}
                style={introVideoFrame(hostIntro.introVideo.aspectRatio).style}
              >
                <HostIntroInline
                  src={hostIntro.introVideo.url}
                  poster={hostIntro.introVideo.posterUrl ?? hostIntro.photoUrl}
                  className="h-full w-full object-cover"
                  planId={eventGroupId}
                  by="host"
                  surface="plan_page"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">Your host, {hostName}</p>
                <p className="mt-2 text-xs text-zinc-500">▶ A quick hello from {hostName}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-6 pt-0 space-y-3">
          {variant !== "copy" ? <PlanInviteBanner planId={eventGroupId} /> : null}
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
                hadIntroVideo={Boolean(rosterHost?.introVideo || hostIntro?.introVideo)}
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
                p2pAmountCents={p2pAmountCents}
                p2pSplit={p2pSplit}
                isFull={isFull}
                limitedSpots={capacity != null}
                rsvpClosed={rsvpClosed}
                autoOpenRsvp={autoOpenRsvp}
                onLocationRevealed={(loc) => {
                  if (loc.name) setRevealedName(loc.name);
                  if (loc.address) setRevealedAddress(loc.address);
                  if (loc.meetingSpot) setRevealedSpot(loc.meetingSpot);
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
