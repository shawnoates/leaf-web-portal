"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import P2pPayCard from "@/components/P2pPayCard";
import FriendInviteCard from "@/components/FriendInviteCard";
import { inviteCodeFor } from "@/lib/plan-invite";
import { collectsMoney, p2pPriceLine, type P2pSplitSummary } from "@/lib/p2p";
import { track } from "@/lib/track";
import { setVerifiedUserCookie } from "@/lib/verified-user";
import { ContactStep, usePhoneVerify, type ContactChoice } from "@/components/ContactStep";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MessageCircle,
  X,
} from "lucide-react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

// Open the Plan Chat in the iOS app via custom-scheme deep link, falling
// back to the App Store if the app isn't installed. The visibility-change
// listener cancels the fallback when the app actually opens (iOS hides the
// page when switching apps). Tuned to 1.2s — shorter feels twitchy on
// installed phones; longer leaves uninstalled users staring at a blank tap.
function openPlanChatInApp(eventNotificationId: string) {
  if (typeof window === "undefined") return;
  const deepLink = `leaf://planChat?planId=${encodeURIComponent(eventNotificationId)}`;
  let didLeave = false;
  const onVisibilityChange = () => {
    if (document.hidden) {
      didLeave = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!didLeave) window.location.href = APP_STORE_URL;
  }, 1200);
  window.location.href = deepLink;
}

type Props = {
  eventGroupId: string;
  planTitle: string;
  planDescription: string;
  expiryDate: string | null;
  // Both `name` and `address` are null when the viewer hasn't RSVP'd yet
  // (server redacts the pair together). The card reveals them post-RSVP
  // via onLocationRevealed.
  location: { name: string | null; address: string | null; timezone: string | null } | null;
  requireApproval: boolean;
  /** Host collects peer to peer: the success step shows how to pay them. */
  p2pAmountCents?: number | null;
  p2pSplit?: P2pSplitSummary | null;
  /** A host hello was on the page when this RSVP happened. Reported with
   *  the event so the watch → RSVP funnel can tell those plans apart. */
  hadIntroVideo?: boolean;
  // Capacity reached — the CTA becomes "Join the Waitlist" and the server
  // queues the RSVP as a waitlisted request instead of confirming it.
  isFull: boolean;
  /** The plan has a capacity: the "Bring someone?" card can promise a held seat. */
  limitedSpots?: boolean;
  // RSVP closes at start time; the CTA becomes a disabled state.
  rsvpClosed: boolean;
  // True when the visitor was bounced back from /open/p/<id>?rsvp=1
  // because iOS didn't intercept the Universal Link (no app installed).
  // Opens the RSVP modal on mount so the tap that started the journey
  // doesn't get dropped on the floor.
  autoOpenRsvp: boolean;
  // Invoked when rsvpToPlanViaWeb returns location data on a confirmed
  // (Accepted/Owned) RSVP. Parent uses this to swap the redacted location
  // line for the real name/address inline, and to populate the ICS
  // download. Either field may be null if the host didn't set one.
  onLocationRevealed?: (loc: { name: string | null; address: string | null; meetingSpot?: string | null }) => void;
};

// Mirror of buildIcsHref in org/[shareId]/page.tsx — keeps the standalone
// landing decoupled from that page. Both call /api/ics with the same params.
function buildIcsHref(opts: {
  uid: string;
  title: string;
  dateISO: string;
  description?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  url?: string;
}): string | null {
  if (Number.isNaN(new Date(opts.dateISO).getTime())) return null;
  const sp = new URLSearchParams();
  sp.set("uid", opts.uid);
  sp.set("title", opts.title);
  sp.set("dateISO", opts.dateISO);
  if (opts.description) sp.set("description", opts.description);
  if (opts.locationName) sp.set("locationName", opts.locationName);
  if (opts.locationAddress) sp.set("locationAddress", opts.locationAddress);
  if (opts.url) sp.set("url", opts.url);
  return `/api/ics?${sp.toString()}`;
}

export default function StandalonePlanRsvp({
  eventGroupId,
  planTitle,
  planDescription,
  expiryDate,
  location,
  requireApproval,
  p2pAmountCents = null,
  p2pSplit = null,
  hadIntroVideo,
  isFull,
  limitedSpots = false,
  rsvpClosed,
  autoOpenRsvp,
  onLocationRevealed,
}: Props) {
  const [open, setOpen] = useState(autoOpenRsvp);

  // Strip the rsvp=1 query the bouncer added so a refresh / share doesn't
  // re-pop the modal. The cookie/state hydration inside RsvpModal still
  // works because we're only touching the URL, not the component tree.
  useEffect(() => {
    if (!autoOpenRsvp) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("rsvp")) {
      url.searchParams.delete("rsvp");
      window.history.replaceState(null, "", url.toString());
    }
  }, [autoOpenRsvp]);

  return (
    <>
      {/* /open/p/<id>?rsvp=1 is the Universal Link bouncer: iOS opens the
          Leaf app directly when installed; otherwise the bouncer page
          redirects to /p/<id>?rsvp=1, which re-renders this component
          with autoOpenRsvp=true so the verify-via-web modal opens
          automatically. Plain <a> (not next Link) so the browser does a
          full navigation that Safari can hand off to iOS's UL machinery. */}
      {rsvpClosed ? (
        <div
          aria-disabled="true"
          className="block w-full text-center bg-zinc-100 text-zinc-400 rounded-full py-3 text-sm font-medium cursor-not-allowed select-none"
        >
          No longer accepting RSVPs
        </div>
      ) : (
        <a
          href={`/open/p/${eventGroupId}?rsvp=1`}
          className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
        >
          {isFull ? "Join the Waitlist" : requireApproval ? "Request to Attend" : "Count me in"}
        </a>
      )}
      {open && !rsvpClosed ? (
        <RsvpModal
          eventGroupId={eventGroupId}
          planTitle={planTitle}
          planDescription={planDescription}
          expiryDate={expiryDate}
          location={location}
          requireApproval={requireApproval}
          p2pAmountCents={p2pAmountCents}
          p2pSplit={p2pSplit}
          hadIntroVideo={hadIntroVideo}
          isFull={isFull}
          limitedSpots={limitedSpots}
          onClose={() => setOpen(false)}
          onLocationRevealed={onLocationRevealed}
        />
      ) : null}
    </>
  );
}

function RsvpModal({
  eventGroupId,
  planTitle,
  planDescription,
  expiryDate,
  location,
  requireApproval,
  p2pAmountCents,
  p2pSplit,
  hadIntroVideo,
  isFull,
  limitedSpots,
  onClose,
  onLocationRevealed,
}: {
  p2pAmountCents: number | null;
  p2pSplit: P2pSplitSummary | null;
  hadIntroVideo?: boolean;
  eventGroupId: string;
  planTitle: string;
  planDescription: string;
  expiryDate: string | null;
  location: { name: string | null; address: string | null; timezone: string | null } | null;
  requireApproval: boolean;
  isFull: boolean;
  limitedSpots: boolean;
  onClose: () => void;
  onLocationRevealed?: (loc: { name: string | null; address: string | null; meetingSpot?: string | null }) => void;
}) {
  // Tracks the location pair the server hands back on a confirmed RSVP —
  // keeps the success modal's ICS download in sync with what the card
  // displays.
  const [revealedName, setRevealedName] = useState<string | null>(
    location?.name ?? null
  );
  const [revealedAddress, setRevealedAddress] = useState<string | null>(
    location?.address ?? null
  );
  const collectsP2p = collectsMoney(p2pAmountCents, p2pSplit);
  // Same contact step as the calendar page's sheets: Text me / Email me.
  const verify = usePhoneVerify();
  const [contact, setContact] = useState<ContactChoice | null>(null);
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [sharePhone, setSharePhone] = useState(true);
  const [isPendingResult, setIsPendingResult] = useState(false);
  const [isWaitlistResult, setIsWaitlistResult] = useState(false);
  const [isHostResult, setIsHostResult] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);

  /** `who.phone` is "" for an email RSVP (as the signed-in account). */
  const rsvp = async (who: ContactChoice) => {
    setContact(who);
    const digits = who.phone.replace(/\D/g, "");
    setFormStep("submitting");
    try {
      const result = (await Parse.Cloud.run("rsvpToPlanViaWeb", {
        ...(digits ? { phoneNumber: digits } : {}),
        ...(who.name ? { name: who.name } : {}),
        notify: who.notify,
        eventGroupId,
        rsvpNote: requireApproval && rsvpNote.trim() ? rsvpNote.trim() : undefined,
        sharePhoneWithHost: sharePhone,
        // A friend's personal link (?i=): credits them and claims their hold.
        inviteCode: inviteCodeFor(eventGroupId),
      })) as
        | {
            eventNotificationId?: string;
            pendingApproval?: boolean;
            waitlisted?: boolean;
            isHost?: boolean;
            locationName?: string | null;
            address?: string | null;
            meetingSpot?: string | null;
          }
        | null
        | undefined;
      if (digits) setVerifiedUserCookie(who.name, who.phone);
      // Closes the watch → RSVP funnel: joined to this browser's earlier
      // host_video_play on the same plan, it is what turns a play into a
      // path rather than a view count.
      track("plan_rsvp_web", {
        planId: eventGroupId,
        hadVideo: Boolean(hadIntroVideo),
        status: result?.waitlisted ? "waitlisted" : result?.pendingApproval ? "pending" : "going",
      });
      // Capture the EventNotification id so the success view's "Open Plan
      // Chat in Leaf" button can deep-link straight into the chat. Web chat
      // session minting is intentionally skipped — standalone plans push
      // everyone into the iOS app rather than offering a web chat fallback.
      if (result?.eventNotificationId) {
        setNotificationId(result.eventNotificationId);
      }
      if (result?.pendingApproval || result?.waitlisted) setIsPendingResult(true);
      if (result?.waitlisted) setIsWaitlistResult(true);
      if (result?.isHost) setIsHostResult(true);
      // Server returns name + address on confirmed (Accepted/Owned) RSVPs;
      // pending requests come back with both null and stay redacted until
      // the host approves.
      const revealedLoc = {
        name: result?.locationName ?? null,
        address: result?.address ?? null,
        meetingSpot: result?.meetingSpot ?? null,
      };
      if (revealedLoc.name) setRevealedName(revealedLoc.name);
      if (revealedLoc.address) setRevealedAddress(revealedLoc.address);
      if (revealedLoc.name || revealedLoc.address) {
        onLocationRevealed?.(revealedLoc);
      }
      setFormStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setFormStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl px-6 pt-7 pb-8 md:p-10 relative my-0 md:my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div className="pr-8">
              <h3 className="text-2xl font-light tracking-tight">
                {isFull ? "Join the waitlist for" : requireApproval ? "Request to attend" : "RSVP for"} {planTitle}
              </h3>
            </div>
            {collectsP2p ? (
              <p className="text-sm text-zinc-700">{p2pPriceLine(p2pAmountCents, p2pSplit)}</p>
            ) : null}
            <ContactStep
              verify={verify}
              actionLabel={isFull ? "Join the waitlist" : requireApproval ? "Send request" : "Confirm RSVP"}
              busy={formStep === "submitting"}
              notes={{
                text: "We'll text your confirmation and a reminder.",
                email: "We'll email your confirmation and a reminder.",
              }}
              onConfirmed={(who) => rsvp(who)}
              extras={({ method, verified }) => (
                <>
                  {requireApproval ? (
                    <div>
                      <label className="text-xs font-medium text-zinc-700 block mb-1">Note for the host (optional)</label>
                      <textarea
                        value={rsvpNote}
                        onChange={(e) => setRsvpNote(e.target.value)}
                        maxLength={200}
                        rows={2}
                        className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:outline-none focus:border-zinc-900 resize-none"
                        placeholder="Tell the host a bit about yourself..."
                      />
                      <p className="text-xs text-zinc-400 text-right mt-0.5">{rsvpNote.length}/200</p>
                    </div>
                  ) : null}
                  {method === "text" && verified ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sharePhone}
                        onChange={(e) => setSharePhone(e.target.checked)}
                        className="w-4 h-4 accent-zinc-900 rounded"
                      />
                      <span className="text-xs text-zinc-600">Share my phone number with the host</span>
                    </label>
                  ) : null}
                </>
              )}
            />
          </div>
        ) : formStep === "error" ? (
          <div className="py-8 text-center space-y-6">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setFormStep("form")}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-5">
            <div
              className={`w-14 h-14 border ${isPendingResult ? "border-amber-500" : "border-zinc-900"} rounded-full flex items-center justify-center mx-auto`}
            >
              {isPendingResult ? (
                <Clock className="w-7 h-7 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-7 h-7" />
              )}
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">
                {isWaitlistResult
                  ? "You’re on the waitlist!"
                  : isPendingResult
                    ? "Request Sent!"
                    : isHostResult
                      ? "You’re hosting this plan"
                      : collectsP2p
                        ? "Your spot is held"
                        : "You’re in!"}
              </h4>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                {isWaitlistResult
                  ? `You\u2019ll get ${contact?.notify === "email" ? "an email" : "a text"} the moment a spot opens up.`
                  : isPendingResult
                    ? `You\u2019ll get ${contact?.notify === "email" ? "an email" : "a text"} when your request is approved.`
                    : isHostResult
                      ? "Open the Plan Chat in Leaf to coordinate with your attendees."
                      : collectsP2p
                        ? (p2pSplit ? "You\u2019ll pay your share once the headcount is set." : "Pay the host below to keep it.")
                        : "Coordinate with the group. Join the Plan Chat."}
              </p>
            </div>

            {/* The card uses the session the contact step signed in with; the
                phone is its fallback for a session-less browser. */}
            {collectsP2p && !isPendingResult && !isHostResult && notificationId ? (
              <P2pPayCard planId={eventGroupId} eventNotificationId={notificationId} phoneNumber={contact?.phone || null} />
            ) : null}

            {/* Direct invites: the moment someone says yes is when a
                personal "come with me" text is easiest to send. */}
            {!isPendingResult && !isHostResult ? (
              <FriendInviteCard eventGroupId={eventGroupId} limitedSpots={limitedSpots} />
            ) : null}

            {!isPendingResult && notificationId ? (
              <button
                type="button"
                onClick={() => openPlanChatInApp(notificationId)}
                className="flex items-center justify-center gap-2 w-full bg-zinc-900 text-white py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-800 transition-colors rounded-lg"
              >
                <MessageCircle className="w-4 h-4" /> Open Plan Chat in Leaf
              </button>
            ) : null}

            {!isPendingResult && expiryDate ? (() => {
              const icsUrl = buildIcsHref({
                uid: eventGroupId,
                title: planTitle,
                dateISO: expiryDate,
                description: planDescription,
                // revealedName/revealedAddress are what the server handed
                // back on this RSVP — falls back to whatever prop value we
                // already had (non-null only for revisiting attendees or
                // followers).
                locationName: revealedName ?? location?.name ?? null,
                locationAddress: revealedAddress ?? location?.address ?? null,
                url: typeof window !== "undefined" ? `${window.location.origin}/p/${eventGroupId}` : undefined,
              });
              if (!icsUrl) return null;
              return (
                <a
                  href={icsUrl}
                  className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Add to Calendar
                </a>
              );
            })() : null}

            <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-900">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
