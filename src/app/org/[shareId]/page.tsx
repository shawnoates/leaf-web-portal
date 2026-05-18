"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import JoinChatPicker from "@/components/JoinChatPicker";
import PollVoteWidget from "@/components/PollVoteWidget";
import { setVerifiedUserCookie, getVerifiedUserCookie } from "@/lib/verified-user";
import { renderLinkedText } from "@/lib/linkify";
import {
  Plus,
  Users,
  Clock,
  Check,
  CheckCircle2,
  ArrowRight,
  Share2,
  Calendar,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Sparkles,
  Loader2,
  Lock,
  MapPin,
  Settings,
  Heart,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";


// --- Types ---

interface Plan {
  id: string;
  title: string;
  date: string;
  time: string;
  /** Raw ISO timestamp from the server (used to build .ics calendar invites). */
  dateISO?: string | null;
  description: string;
  image: string;
  hostId: string | null;
  hostName: string;
  hostAvatar: string | null;
  attendeeCount: number;
  location: {
    name: string | null;
    address: string | null;
    neighborhood?: string | null;
    isPrivate?: boolean;
  } | null;
  hostNote: string | null;
  requireApproval?: boolean;
  isPoll?: boolean;
  pollOptionCount?: number;
  pollVoteCount?: number;
  pollClosesAt?: string | null;
}

interface PlanIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  date: string | null;
  icebreakerQuestion: string | null;
  suggestedCapacity: number | null;
  centroid: string | null;
}

interface NearbyVenue {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  photoUrl: string | null;
  flagged?: boolean;
}

interface OrgData {
  objectId: string;
  parentOrgId: string | null;
  name: string;
  description: string;
  profilePhoto: string | null;
  tier: string;
  brandColor: string | null;
  orgType: string | null;
  orgCity: string | null;
  memberCount: number;
  pastPlanCount: number;
  rsvpLimitReached: boolean;
  isOwner: boolean;
  isHost: boolean;
  plans: Plan[];
  planIdeas: PlanIdea[];
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
  blacklistCategories: string[];
  excludeKeywords: string[];
  isPrivate?: boolean;
  isFollower?: boolean;
  followRequestPending?: boolean;
  requireApprovalDefault?: boolean;
}

// Maps human-readable blacklist labels (set in the org dashboard) to Google
// Places `types` strings and lowercase name keywords used to filter venue
// search results. Categories without reliable Places types fall back to
// keyword matching against the venue name.
const BLACKLIST_TYPE_MAP: Record<string, { types: string[]; keywords: string[] }> = {
  "Bars": { types: ["bar"], keywords: ["bar", "pub", "tavern", "brewery", "brewpub"] },
  "Nightclubs": { types: ["night_club"], keywords: ["nightclub", "night club", "lounge", "club"] },
  "Casinos": { types: ["casino"], keywords: ["casino"] },
  "Adult venues": { types: [], keywords: ["adult", "strip", "gentlemen", "xxx"] },
  "Smoking lounges": { types: [], keywords: ["hookah", "cigar", "smoke shop", "vape", "smoking"] },
  "Religious venues": {
    types: ["church", "synagogue", "mosque", "hindu_temple", "place_of_worship"],
    keywords: ["church", "synagogue", "mosque", "temple", "chapel", "cathedral"],
  },
  "Late-night venues": { types: [], keywords: ["late night", "after hours"] },
  "Fast food": {
    types: ["meal_takeaway"],
    keywords: ["mcdonald", "burger king", "wendy", "taco bell", "kfc", "subway", "chipotle", "popeyes", "arby", "sonic", "hardee", "carl's jr", "jack in the box", "white castle", "dairy queen", "fast food"],
  },
};

function isVenueBlacklisted(
  name: string,
  types: string[],
  blacklistCategories: string[],
  excludeKeywords?: string[]
): boolean {
  const lowerName = name.toLowerCase();
  // Check preset category blacklist
  if (blacklistCategories && blacklistCategories.length > 0) {
    const typeSet = new Set(types);
    for (const category of blacklistCategories) {
      const entry = BLACKLIST_TYPE_MAP[category];
      if (!entry) continue;
      if (entry.types.some((t) => typeSet.has(t))) return true;
      if (entry.keywords.some((k) => lowerName.includes(k))) return true;
    }
  }
  // Check custom excluded keywords
  if (excludeKeywords && excludeKeywords.length > 0) {
    for (const kw of excludeKeywords) {
      if (lowerName.includes(kw.toLowerCase())) return true;
    }
  }
  return false;
}

// --- Helpers ---

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Normalize a time string to 12-hour format (e.g. "19:00" → "7:00 PM") */
function normalizeTimeString(time: string): string {
  // Already in 12-hour format like "7:00 PM"
  if (/[APap][Mm]/.test(time)) return time;
  // 24-hour format like "19:00"
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`;
}

// Build an iCalendar (.ics) data URL for a plan. Imports cleanly into Apple
// Calendar (iOS/macOS), Outlook, Google Calendar (via download), and the
// default calendar app on Android/Windows.
//
// Link to the server-rendered .ics endpoint rather than a `data:` URL — iOS
// Safari only opens the Calendar "add event" sheet when the response comes
// over HTTP with `Content-Type: text/calendar`. Data URLs trigger a download
// instead. Server route lives at src/app/api/ics/route.ts and owns all the
// timezone/format handling (floating time, etc.).
function buildIcsHref(opts: {
  uid: string;
  title: string;
  dateISO: string;
  time?: string | null;
  durationHours?: number;
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
  if (opts.time) sp.set("time", opts.time);
  if (opts.durationHours != null) sp.set("durationHours", String(opts.durationHours));
  if (opts.description) sp.set("description", opts.description);
  if (opts.locationName) sp.set("locationName", opts.locationName);
  if (opts.locationAddress) sp.set("locationAddress", opts.locationAddress);
  if (opts.url) sp.set("url", opts.url);
  return `/api/ics?${sp.toString()}`;
}

// --- Components ---

function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 overflow-hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
          <Users className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </div>
      <span className="text-xs tracking-widest uppercase font-bold text-zinc-400">
        {count} Attending
      </span>
    </div>
  );
}

function RsvpModal({
  plan,
  onClose,
  brandColor,
  onRsvpSuccess,
  existingNotificationId,
}: {
  plan: Plan;
  brandColor?: string;
  onClose: () => void;
  onRsvpSuccess?: (planId: string, alreadyRsvpd: boolean, pendingApproval?: boolean) => void;
  existingNotificationId?: string | null;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [notificationId, setNotificationId] = useState<string | null>(existingNotificationId || null);
  const [rsvpNote, setRsvpNote] = useState("");
  const [isPendingResult, setIsPendingResult] = useState(false);
  const [sharePhone, setSharePhone] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      const result = await Parse.Cloud.run("rsvpToPlanViaWeb", {
        phoneNumber: verify.phone.replace(/\D/g, ""),
        name: verify.name,
        eventGroupId: plan.id,
        rsvpNote: plan.requireApproval && rsvpNote.trim() ? rsvpNote.trim() : undefined,
        sharePhoneWithHost: sharePhone,
      }) as { eventNotificationId?: string; alreadyRsvpd?: boolean; pendingApproval?: boolean } | null | undefined;
      console.log("[RSVP] result:", result);
      setVerifiedUserCookie(verify.name, verify.phone);
      if (result?.eventNotificationId) {
        setNotificationId(result.eventNotificationId);
        // Mint a Parse session for the phone-user so /chat/[eventGroupId]
        // can authenticate. Failure here is non-fatal — the user still sees
        // the success state; they just won't be able to load the web chat
        // until they complete Google SSO from the JoinChatPicker.
        try {
          const session = (await Parse.Cloud.run("getRsvpSession", {
            eventNotificationId: result.eventNotificationId,
            phoneNumber: verify.phone.replace(/\D/g, ""),
          })) as { sessionToken?: string };
          if (session?.sessionToken) {
            await Parse.User.become(session.sessionToken);
          }
        } catch (sessionErr) {
          console.warn("[RSVP] Could not mint chat session:", sessionErr);
        }
      }
      if (result?.pendingApproval) {
        setIsPendingResult(true);
      }
      onRsvpSuccess?.(plan.id, result?.alreadyRsvpd === true, result?.pendingApproval);
      setFormStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setFormStep("error");
    }
  };

  // Widen the modal once we're past the form so the JoinChatPicker can lay
  // its two options out side-by-side on desktop. Form step stays narrow so
  // the input fields aren't awkwardly stretched.
  const isJoinPickerStep = formStep === "success" && !isPendingResult && Boolean(notificationId);
  const maxWidthClass = isJoinPickerStep ? "max-w-3xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={`bg-white w-full ${maxWidthClass} rounded-t-2xl md:rounded-2xl p-8 md:p-12 relative my-0 md:my-8`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                {plan.requireApproval ? "Request to Attend" : "RSVP for"} {plan.title}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {plan.date}{plan.time ? ` at ${plan.time}` : ""}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <PhoneVerifyFields verify={verify} onSendOTP={verify.sendOTP} />
              {verify.isVerified && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sharePhone}
                    onChange={(e) => setSharePhone(e.target.checked)}
                    className="w-4 h-4 accent-zinc-900 rounded"
                  />
                  <span className="text-xs text-zinc-600">Share phone number with host</span>
                </label>
              )}
              {plan.requireApproval && (
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Note for the host (optional)</label>
                  <textarea
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                    placeholder="Tell the host a bit about yourself..."
                  />
                  <p className="text-xs text-zinc-400 text-right mt-0.5">{rsvpNote.length}/200</p>
                </div>
              )}
              <button
                type="submit"
                disabled={formStep === "submitting" || !verify.isVerified || !verify.name}
                className="w-full text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : plan.requireApproval ? (
                  <>Submit Request <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Confirm RSVP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
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
            <div className={`w-14 h-14 border ${isPendingResult ? "border-amber-500" : "border-zinc-900"} rounded-full flex items-center justify-center mx-auto`}>
              {isPendingResult ? <Clock className="w-7 h-7 text-amber-500" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">{isPendingResult ? "Request Sent!" : "You\u0027re in!"}</h4>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                {isPendingResult
                  ? "You\u0027ll receive a text when your request is approved."
                  : "Coordinate with the group. Join the Plan Chat."}
              </p>
            </div>

            {!isPendingResult && notificationId && (
              <div className="pt-2">
                <JoinChatPicker
                  eventGroupId={plan.id}
                  eventNotificationId={notificationId}
                  brandColor={brandColor}
                  onError={(msg) => setErrorMsg(msg)}
                />
              </div>
            )}

            {!isPendingResult && !notificationId && (
              <Link
                href={`/chat/${plan.id}`}
                className="flex items-center justify-center gap-2 w-full text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 rounded-lg"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                <MessageCircle className="w-4 h-4" /> Join Plan Chat
              </Link>
            )}

            {!isPendingResult && plan.dateISO && (() => {
              const icsUrl = buildIcsHref({
                uid: plan.id,
                title: plan.title,
                dateISO: plan.dateISO,
                time: plan.time,
                description: plan.description,
                locationName: plan.location?.isPrivate ? null : plan.location?.name,
                locationAddress: plan.location?.isPrivate ? null : plan.location?.address,
                url: typeof window !== "undefined" ? `${window.location.origin}/p/${plan.id}` : undefined,
              });
              if (!icsUrl) return null;
              return (
                <a
                  href={icsUrl}
                  className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg"
                >
                  <Calendar className="w-4 h-4" />
                  Add to Calendar
                </a>
              );
            })()}

            <button
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-zinc-900"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Cookie Helpers ---

// Keep legacy follower cookie for backward compat
function setFollowerCookie(calendarId: string, name: string, phone: string) {
  const data = JSON.stringify({ calendarId, name, phone });
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_follower=${encodeURIComponent(data)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getFollowerCookie(): { calendarId: string; name: string; phone: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/leaf_follower=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

// --- RSVP cookie helpers ---
function getRsvpCookieIds(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(/leaf_rsvps=([^;]+)/);
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return [];
  }
}

function addRsvpCookie(eventGroupId: string) {
  const ids = getRsvpCookieIds();
  if (!ids.includes(eventGroupId)) ids.push(eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeRsvpCookie(eventGroupId: string) {
  const ids = getRsvpCookieIds().filter((id) => id !== eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

// --- Pending RSVP cookie helpers ---
function getPendingRsvpCookieIds(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(/leaf_pending_rsvps=([^;]+)/);
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return [];
  }
}

function addPendingRsvpCookie(eventGroupId: string) {
  const ids = getPendingRsvpCookieIds();
  if (!ids.includes(eventGroupId)) ids.push(eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_pending_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

function removePendingRsvpCookie(eventGroupId: string) {
  const ids = getPendingRsvpCookieIds().filter((id) => id !== eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_pending_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

// --- Shared phone format helper ---
function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

// --- Phone Verify Hook ---
function usePhoneVerify() {
  const cached = getVerifiedUserCookie();
  const [name, setName] = useState(cached?.name || "");
  const [phone, setPhone] = useState(cached?.phone || "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "verified">(cached ? "verified" : "phone");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const isVerified = step === "verified";

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Please enter a valid phone number."); return; }
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally { setSending(false); }
  };

  const verifyOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    setError("");
    try {
      const result = await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code });
      if (result && typeof result === "object" && result.sessionToken) {
        setStep("verified");
        setVerifiedUserCookie(name, phone);
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally { setSending(false); }
  };

  const reset = () => {
    setStep("phone");
    setCode("");
    setError("");
  };

  return { name, setName, phone, setPhone, code, setCode, step, isVerified, sending, setSending, error, sendOTP, verifyOTP, reset };
}

// --- Shared Phone Verify Fields Component ---

function PhoneVerifyFields({ verify, onSendOTP }: { verify: ReturnType<typeof usePhoneVerify>; onSendOTP?: () => void }) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-xs tracking-wider uppercase font-bold">
          Your Name
        </label>
        <input
          type="text"
          required
          value={verify.name}
          onChange={(e) => verify.setName(e.target.value)}
          placeholder="Full name"
          disabled={verify.isVerified}
          className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors disabled:text-zinc-500"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs tracking-wider uppercase font-bold">
          Phone Number
        </label>
        {verify.step === "phone" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center flex-1 border-b border-zinc-300 focus-within:border-zinc-900 transition-colors">
              <Phone className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="tel"
                required
                value={verify.phone}
                onChange={(e) => verify.setPhone(formatPhoneNumber(e.target.value))}
                placeholder="555-555-5555"
                className="w-full py-3 text-lg font-light focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onSendOTP || verify.sendOTP}
              disabled={verify.sending || verify.phone.replace(/\D/g, "").length < 10 || !verify.name}
              className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {verify.sending ? "Sending..." : "Verify"}
            </button>
          </div>
        )}
        {verify.step === "code" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Enter the 6-digit code sent to {verify.phone}</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verify.code}
                onChange={(e) => verify.setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="flex-1 border-b border-zinc-300 py-3 text-lg font-light tracking-[0.5em] text-center focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <button
                type="button"
                onClick={verify.verifyOTP}
                disabled={verify.sending || verify.code.length < 6}
                className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {verify.sending ? "Checking..." : "Confirm"}
              </button>
            </div>
            <button
              type="button"
              onClick={verify.reset}
              className="text-xs text-zinc-400 hover:text-zinc-900 underline"
            >
              Change number
            </button>
          </div>
        )}
        {verify.step === "verified" && (
          <div className="flex items-center gap-2 py-3">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-600 font-medium">{verify.phone} verified</span>
          </div>
        )}
        {verify.error && (
          <p className="text-xs text-red-500 mt-1">{verify.error}</p>
        )}
      </div>
    </>
  );
}

// --- Cancel RSVP Modal (requires OTP when user hasn't verified in this session) ---

function CancelRsvpModal({
  planId,
  planTitle,
  onClose,
  onCancelled,
}: {
  planId: string;
  planTitle: string;
  onClose: () => void;
  onCancelled: (planId: string) => void;
}) {
  const verify = usePhoneVerify();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    if (!verify.isVerified) return;
    setCancelling(true);
    setError("");
    try {
      await Parse.Cloud.run("cancelRsvpViaWeb", {
        phoneNumber: verify.phone.replace(/\D/g, ""),
        eventGroupId: planId,
      });
      setVerifiedUserCookie(verify.name, verify.phone);
      onCancelled(planId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel RSVP.");
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-light tracking-tight">Cancel RSVP</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Verify your phone to cancel your RSVP for {planTitle}
            </p>
          </div>
          <PhoneVerifyFields verify={verify} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleCancel}
            disabled={!verify.isVerified || cancelling}
            className="w-full border border-red-200 text-red-600 py-3.5 text-xs uppercase tracking-wider font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Follow Modal ---

function FollowModal({
  calendarId,
  calendarName,
  onClose,
  onFollowed,
  brandColor,
  isPrivate,
}: {
  calendarId: string;
  calendarName: string;
  brandColor?: string;
  onClose: () => void;
  onFollowed: (name: string, phone: string, pending?: boolean) => void;
  isPrivate?: boolean;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "pending" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      const followResult = await Parse.Cloud.run("followCalendarViaWeb", {
        calendarId,
        name: verify.name,
        phoneNumber: verify.phone.replace(/\D/g, ""),
      });
      setFollowerCookie(calendarId, verify.name, verify.phone);
      setVerifiedUserCookie(verify.name, verify.phone);
      localStorage.setItem("leaf_follower_phone", verify.phone.replace(/\D/g, ""));
      if (followResult.pending) {
        onFollowed(verify.name, verify.phone, true);
        setFormStep("pending");
      } else {
        onFollowed(verify.name, verify.phone, false);
        setFormStep("success");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to follow. Please try again.");
      setFormStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                {isPrivate ? "Request to Follow" : "Follow"} {calendarName}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {isPrivate
                  ? "This is a private calendar. The host will review your request."
                  : "Get notified about new plans and events."}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PhoneVerifyFields verify={verify} />
              <button
                type="submit"
                disabled={formStep === "submitting" || !verify.isVerified || !verify.name}
                className="w-full text-white py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isPrivate ? (
                  "Request to Follow"
                ) : (
                  "Follow"
                )}
              </button>
            </form>
          </div>
        ) : formStep === "success" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-light">You&apos;re following!</h3>
            <p className="text-sm text-zinc-500">
              You&apos;ll be notified about new plans from {calendarName}.
            </p>
            <button
              onClick={onClose}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Done
            </button>
          </div>
        ) : formStep === "pending" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-light">Request Sent!</h3>
            <p className="text-sm text-zinc-500">
              The host will review your request. You&apos;ll receive a text when approved.
            </p>
            <button
              onClick={onClose}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setFormStep("form")}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function OrgCalendarPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Plan | null>(null);
  const [rsvpPlan, setRsvpPlan] = useState<Plan | null>(null);
  const [hostingIdea, setHostingIdea] = useState<PlanIdea | null>(null);
  const [hostSuccess, setHostSuccess] = useState<boolean | "pending">(false);
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostNote, setHostNote] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [hostRequireApproval, setHostRequireApproval] = useState(false);
  const hostVerify = usePhoneVerify();
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(null);
  // Custom plan creation state
  const [creatingCustomPlan, setCreatingCustomPlan] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customCapacity, setCustomCapacity] = useState("");
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState<false | true | "published">(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<{ id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customRequireApproval, setCustomRequireApproval] = useState(false);
  const customVerify = usePhoneVerify();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLDivElement>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showFollowPopup, setShowFollowPopup] = useState(false);
  const [followPopupLoading, setFollowPopupLoading] = useState(false);
  const [showPlanIdeaPopup, setShowPlanIdeaPopup] = useState(false);
  const [popupIdea, setPopupIdea] = useState<PlanIdea | null>(null);
  const [isInactive, setIsInactive] = useState<{ name: string } | null>(null);
  const [showHostLogin, setShowHostLogin] = useState(false);
  const [parseUser, setParseUser] = useState<Parse.User | null>(null);
  const [showWelcomeInvite, setShowWelcomeInvite] = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rsvpedPlanIds, setRsvpedPlanIds] = useState<Set<string>>(new Set());
  const [pendingRsvpIds, setPendingRsvpIds] = useState<Set<string>>(new Set());
  // planId → EventNotification.objectId for the viewer's own RSVP. Powers
  // the "Join Plan Chat" button (linked to /c/{notificationId}).
  const [rsvpNotificationIds, setRsvpNotificationIds] = useState<Map<string, string>>(new Map());
  const [hostedPlanIds, setHostedPlanIds] = useState<Set<string>>(new Set());
  const [hostNotificationId, setHostNotificationId] = useState<string | null>(null);
  const [cancellingRsvp, setCancellingRsvp] = useState<string | null>(null);
  const [cancelRsvpModalPlan, setCancelRsvpModalPlan] = useState<{ id: string; title: string } | null>(null);
  const [cancellingPlan, setCancellingPlan] = useState(false);

  const handleSharePlan = useCallback(async (planId: string, planTitle: string) => {
    const url = `https://os.joinleaf.com/p/${planId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: planTitle, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiedPlanId(planId);
      setTimeout(() => setCopiedPlanId(null), 2000);
    }
  }, []);

  async function loadHostNotificationId(eventGroupId: string) {
    // The attendee list itself is rendered on the dedicated /h/{id} page —
    // here we only need the host's notification id so the "Message Attendees"
    // button can deep-link to that page. Auth mirrors fetchOrg's chain
    // (Parse session → localStorage → verified-user cookie).
    const storedPhone = localStorage.getItem("leaf_follower_phone");
    const cachedUser = getVerifiedUserCookie();
    const phone = storedPhone || cachedUser?.phone?.replace(/\D/g, "") || null;
    const hasParseSession = !!Parse.User.current();
    if (!phone && !hasParseSession) return;
    try {
      const params: { eventGroupId: string; phoneNumber?: string } = { eventGroupId };
      if (phone) params.phoneNumber = phone;
      const result = (await Parse.Cloud.run("getPlanAttendeesForHost", params)) as
        | { hostNotificationId?: string | null }
        | unknown[]
        | null
        | undefined;
      // Old array-shaped response from pre-deploy servers won't have the id.
      if (result && !Array.isArray(result) && typeof result === "object") {
        setHostNotificationId((result as { hostNotificationId?: string | null }).hostNotificationId || null);
      } else {
        setHostNotificationId(null);
      }
    } catch (err) {
      console.error("Failed to load host notification id:", err);
      setHostNotificationId(null);
    }
  }

  async function handleCancelRsvp(planId: string) {
    const cached = getVerifiedUserCookie();
    if (!cached?.phone) {
      // No OTP-verified session — open CancelRsvpModal to require OTP first
      const plan = org?.plans.find((p) => p.id === planId);
      setCancelRsvpModalPlan({ id: planId, title: plan?.title || "this plan" });
      return;
    }
    if (!confirm("Cancel your RSVP? The host will be notified.")) return;
    setCancellingRsvp(planId);
    try {
      await Parse.Cloud.run("cancelRsvpViaWeb", {
        phoneNumber: cached.phone.replace(/\D/g, ""),
        eventGroupId: planId,
      });
      completeCancelRsvp(planId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No RSVP found")) {
        completeCancelRsvp(planId, "RSVP was already removed");
      } else {
        alert(msg || "Failed to cancel RSVP.");
      }
    } finally {
      setCancellingRsvp(null);
    }
  }

  function completeCancelRsvp(planId: string, message?: string) {
    removeRsvpCookie(planId);
    setRsvpedPlanIds((prev) => {
      const next = new Set(prev);
      next.delete(planId);
      return next;
    });
    setOrg((prev) => prev ? {
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === planId ? { ...p, attendeeCount: Math.max(0, p.attendeeCount - 1) } : p
      ),
    } : prev);
    setSelectedEvent((prev) =>
      prev && prev.id === planId ? { ...prev, attendeeCount: Math.max(0, prev.attendeeCount - 1) } : prev
    );
    setToast(message || "RSVP cancelled");
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCancelPlan(planId: string) {
    if (!confirm("Cancel this plan? All attendees will be notified.")) return;
    setCancellingPlan(true);
    try {
      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: planId });
      setOrg((prev) => prev ? {
        ...prev,
        plans: prev.plans.filter((p) => p.id !== planId),
      } : prev);
      setSelectedEvent(null);
      setToast("Plan cancelled");
      setTimeout(() => setToast(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel plan.");
    } finally {
      setCancellingPlan(false);
    }
  }

  // Check cookie on mount
  useEffect(() => {
    const cookie = getFollowerCookie();
    if (cookie) {
      setIsFollowing(true);
    }
  }, []);

  // Check for existing Parse session (returning owner/host from dashboard)
  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) setParseUser(current);
    } catch { /* no session */ }
  }, []);

  // Timed follow popup
  useEffect(() => {
    if (!org) return;
    // Suppress: already following, owner/host, or recently dismissed
    if (isFollowing) return;
    if (org.isOwner || org.isHost) return;
    const dismissKey = `leaf_follow_dismiss_${org.objectId}`;
    try {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    } catch { /* localStorage unavailable */ }
    const timer = setTimeout(() => setShowFollowPopup(true), 5000);
    return () => clearTimeout(timer);
  }, [org, isFollowing]);

  function dismissFollowPopup() {
    setShowFollowPopup(false);
    if (org) {
      try { localStorage.setItem(`leaf_follow_dismiss_${org.objectId}`, String(Date.now())); } catch { /* */ }
    }
  }

  // Scroll-triggered plan idea popup for followers
  useEffect(() => {
    if (!org) return;
    if (!isFollowing) return;
    if (org.isOwner || org.isHost) return;
    if (org.planIdeas.length === 0 || org.hidePlanIdeas) return;
    if (org.rsvpLimitReached) return;
    const dismissKey = `leaf_idea_popup_dismiss_${org.objectId}`;
    try {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    } catch { /* localStorage unavailable */ }

    const randomIdea = org.planIdeas[Math.floor(Math.random() * org.planIdeas.length)];
    setPopupIdea(randomIdea);

    const target = ctaSectionRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowPlanIdeaPopup(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [org, isFollowing]);

  function dismissPlanIdeaPopup() {
    setShowPlanIdeaPopup(false);
    if (org) {
      try { localStorage.setItem(`leaf_idea_popup_dismiss_${org.objectId}`, String(Date.now())); } catch { /* */ }
    }
  }

  async function handlePopupFollow() {
    if (!org) return;
    const cached = getVerifiedUserCookie();
    if (cached?.name && cached?.phone) {
      // One-tap follow for returning verified users
      setFollowPopupLoading(true);
      try {
        const followResult = await Parse.Cloud.run("followCalendarViaWeb", {
          calendarId: org.objectId,
          name: cached.name,
          phoneNumber: cached.phone.replace(/\D/g, ""),
        });
        setFollowerCookie(org.objectId, cached.name, cached.phone);
        setVerifiedUserCookie(cached.name, cached.phone);
        localStorage.setItem("leaf_follower_phone", cached.phone.replace(/\D/g, ""));
        if (followResult.pending) {
          setFollowRequestPending(true);
          setShowFollowPopup(false);
          setToast("Request sent! You\u2019ll be notified when approved.");
          setTimeout(() => setToast(null), 3000);
        } else {
          setIsFollowing(true);
          setFollowerCount((c) => c + 1);
          setShowFollowPopup(false);
          setToast(`You're now following ${org.name}`);
          setTimeout(() => setToast(null), 3000);
        }
      } catch {
        // Fallback to full modal if one-tap fails
        setShowFollowPopup(false);
        setShowFollowModal(true);
      } finally {
        setFollowPopupLoading(false);
      }
    } else {
      // New visitor — open full follow modal
      setShowFollowPopup(false);
      setShowFollowModal(true);
    }
  }

  async function handleUnfollow() {
    if (!org) return;
    if (!confirm("Unfollow this calendar? You will no longer receive notifications about new plans.")) return;
    const cookie = getFollowerCookie();
    if (!cookie?.phone) return;
    try {
      await Parse.Cloud.run("unfollowCalendarViaWeb", {
        calendarId: org.objectId,
        phoneNumber: cookie.phone,
      });
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
      // Clear the follower cookie
      document.cookie = "leaf_follower=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (err) {
      console.error("Failed to unfollow:", err);
    }
  }

  // Set page title when org loads
  useEffect(() => {
    if (org) {
      document.title = org.name;
      setFollowerCount(org.memberCount);
      if (org.followRequestPending) setFollowRequestPending(true);
      if (org.isFollower) setIsFollowing(true);
    }
    return () => { document.title = "Leaf"; };
  }, [org]);

  // Initialize RSVP state from cookie
  useEffect(() => {
    const ids = getRsvpCookieIds();
    if (ids.length > 0) setRsvpedPlanIds(new Set(ids));
    const pendingIds = getPendingRsvpCookieIds();
    if (pendingIds.length > 0) setPendingRsvpIds(new Set(pendingIds));
  }, []);

  const fetchOrg = useCallback(async (retried = false) => {
    try {
      setLoading(true);
      // Pass phone number if available for private calendar access & RSVP sync
      const storedPhone = typeof window !== "undefined" ? localStorage.getItem("leaf_follower_phone") : null;
      const cachedUser = typeof window !== "undefined" ? getVerifiedUserCookie() : null;
      const phoneNumber = storedPhone || cachedUser?.phone?.replace(/\D/g, "") || undefined;
      const result = await Parse.Cloud.run("getOrgCalendarPage", { shareId, phoneNumber });

      // Record page view (fire-and-forget)
      if (result.objectId) {
        Parse.Cloud.run("recordCalendarPageView", { calendarId: result.objectId }).catch(() => {});
      }

      // Handle inactive calendar
      if (result.isInactive) {
        setIsInactive({ name: result.name || "Calendar" });
        setLoading(false);
        return;
      }

      // Transform API response to our OrgData shape
      const plans: Plan[] = (result.plans || []).map((p: Record<string, unknown>) => ({
        id: p.objectId as string,
        title: p.title as string || "Untitled Plan",
        date: p.expiryDate ? formatDate(p.expiryDate as string) : "",
        time: p.time ? normalizeTimeString(p.time as string) : (p.expiryDate ? formatTime(p.expiryDate as string) : ""),
        dateISO: (p.expiryDate as string) || null,
        description: p.description as string || "",
        image: p.image as string || "",
        hostId: (p.host as Record<string, string>)?.objectId || null,
        hostName: (p.host as Record<string, string>)?.name || "Community Member",
        hostAvatar: (p.host as Record<string, string>)?.profilePictureUrl || null,
        // rsvpCount tracks RSVPs only; the host is always attending so add 1
        attendeeCount: ((p.rsvpCount as number) || 0) + 1,
        location: p.location ? {
          name: (p.location as Record<string, unknown>).name as string | null,
          address: (p.location as Record<string, unknown>).address as string | null,
          neighborhood: (p.location as Record<string, unknown>).neighborhood as string | null || null,
          isPrivate: (p.location as Record<string, unknown>).isPrivate as boolean || false,
        } : null,
        hostNote: p.hostNote as string || null,
        requireApproval: p.requireApproval as boolean || false,
        isPoll: p.isPoll as boolean || false,
        pollOptionCount: (p.pollOptionCount as number) || 0,
        pollVoteCount: (p.pollVoteCount as number) || 0,
        pollClosesAt: (p.pollClosesAt as string) || null,
      }));

      const planIdeas: PlanIdea[] = (result.planIdeas || []).map((idea: Record<string, unknown>) => ({
        id: idea.objectId as string,
        title: idea.title as string || "Plan Idea",
        description: idea.description as string || "",
        category: idea.category as string || "Activity",
        image: idea.image as string || "",
        date: idea.date as string || null,
        icebreakerQuestion: idea.icebreakerQuestion as string || null,
        suggestedCapacity: idea.suggestedCapacity as number || null,
        centroid: idea.centroid as string || null,
      }));

      setOrg({
        objectId: result.objectId,
        parentOrgId: result.parentOrgId || null,
        name: result.name || "Organization",
        description: result.description || "",
        profilePhoto: result.profilePhoto || null,
        tier: result.orgSubscriptionTier || "starter",
        brandColor: result.orgBrandColor || "#18181b",
        orgType: result.orgType || null,
        orgCity: result.orgCity || null,
        memberCount: result.memberCount || 0,
        pastPlanCount: result.pastPlanCount || 0,
        rsvpLimitReached: result.rsvpLimitReached || false,
        isOwner: result.isOwner || false,
        isHost: result.isHost || false,
        plans,
        planIdeas,
        hidePlanIdeas: result.hidePlanIdeas || false,
        hideCustomPlans: result.hideCustomPlans || false,
        blacklistCategories: result.orgBlacklistCategories || [],
        excludeKeywords: result.orgExcludeKeywords || [],
        isPrivate: result.isPrivate || false,
        isFollower: result.isFollower || false,
        followRequestPending: result.followRequestPending || false,
        requireApprovalDefault: result.requireApprovalDefault === true,
      });

      // Sync RSVP cookies with backend data (handles admin-removed RSVPs)
      if (result.userRsvpPlanIds && Array.isArray(result.userRsvpPlanIds)) {
        const rsvpEntries = result.userRsvpPlanIds as Array<{ planId: string; status: string; notificationId?: string }>;
        const confirmedIds = new Set<string>(rsvpEntries.filter((r) => r.status === "Accepted").map((r) => r.planId));
        const pendingIds = new Set<string>(rsvpEntries.filter((r) => r.status === "pendingRsvp" || r.status === "Requested").map((r) => r.planId));
        const notifIdMap = new Map<string, string>();
        for (const r of rsvpEntries) {
          if (r.notificationId) notifIdMap.set(r.planId, r.notificationId);
        }

        // Remove stale cookies for RSVPs that no longer exist
        for (const id of getRsvpCookieIds()) {
          if (!confirmedIds.has(id)) removeRsvpCookie(id);
        }
        for (const id of getPendingRsvpCookieIds()) {
          if (!pendingIds.has(id)) removePendingRsvpCookie(id);
        }

        // Add missing cookies for RSVPs the backend knows about
        for (const id of confirmedIds) addRsvpCookie(id);
        for (const id of pendingIds) addPendingRsvpCookie(id);

        setRsvpedPlanIds(confirmedIds);
        setPendingRsvpIds(pendingIds);
        setRsvpNotificationIds(notifIdMap);
      }

      if (result.userHostedPlanIds && Array.isArray(result.userHostedPlanIds)) {
        setHostedPlanIds(new Set(result.userHostedPlanIds));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Stale Parse session token — clear it and retry once
      if (msg.toLowerCase().includes("invalid session") && !retried) {
        retried = true;
        try { await Parse.User.logOut(); } catch { /* ignore */ }
        return fetchOrg();
      }
      setError(msg || "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (shareId) fetchOrg();
  }, [shareId, fetchOrg]);

  // Auto-open the plan details modal if the URL contains ?plan={eventGroupId}.
  // This is the landing target for the /p/[eventGroupId] share page used by
  // SMS notifications (e.g., approval SMS sent to a custom plan host).
  // Read directly from window.location to avoid the Suspense requirement
  // that next/navigation's useSearchParams imposes on this client page.
  const [planQueryId, setPlanQueryId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const id = search.get("plan");
    if (id) setPlanQueryId(id);
    if (search.get("welcome") === "1") setShowWelcomeInvite(true);

    // Auto-open the custom-plan ("Suggest the next one") form when arriving
    // from the memory page with ?suggest=1 and prefill params. The venue name
    // populates the category search so the user's previous spot likely shows
    // up at the top of nearby results — placeId still has to be picked from
    // Google Places, since the cloud function requires a real placeId.
    if (search.get("suggest") === "1") {
      const t = search.get("prefillTitle") || "";
      const d = search.get("prefillDescription") || "";
      let venueName = "";
      const venueStr = search.get("prefillVenue");
      if (venueStr) {
        try {
          const v = JSON.parse(venueStr);
          venueName = v.name || "";
        } catch {
          // ignore malformed venue JSON
        }
      }
      setCustomTitle(t);
      setCustomDescription(d);
      setCustomCategory(venueName);
      setCustomCapacity("");
      setHostNote("");
      setSelectedVenue(null);
      setCustomSubmitting(false);
      setCustomSuccess(false);
      setCreatingCustomPlan(true);
    }
  }, []);
  const autoOpenedPlanRef = useRef<string | null>(null);
  useEffect(() => {
    if (!org || !planQueryId) return;
    if (autoOpenedPlanRef.current === planQueryId) return;
    const match = org.plans.find((p) => p.id === planQueryId);
    if (match) {
      setSelectedEvent(match);
      autoOpenedPlanRef.current = planQueryId;
    }
  }, [org, planQueryId]);

  // Auto-load the host notification id when a host opens their own plan
  // (powers the "Message Attendees" button → /h/{id}).
  useEffect(() => {
    if (selectedEvent && hostedPlanIds.has(selectedEvent.id)) {
      loadHostNotificationId(selectedEvent.id);
    } else {
      setHostNotificationId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id]);

  // Fetch nearby venues when either host modal or custom plan modal opens
  useEffect(() => {
    if (!org) return;
    if (!hostingIdea && !creatingCustomPlan) return;

    const searchCity = hostingIdea?.centroid || org.orgCity || "";
    const searchCategory = hostingIdea
      ? hostingIdea.category
      : (customCategory.trim() || "");

    // Don't search until the user has typed something (custom plan) or a category exists (plan idea)
    if (!searchCategory) {
      setNearbyVenues([]);
      setVenuesLoading(false);
      return;
    }

    setNearbyVenues([]);
    setSelectedVenue(null);
    setVenuesLoading(true);

    // Debounce custom plan searches so we don't fire on every keystroke
    const debounceMs = hostingIdea ? 0 : 400;
    const timer = setTimeout(() => {

    // Load Google Maps if not already loaded, then search
    const doSearch = async () => {
      try {
        // Wait for Google Maps to be available
        if (!window.google?.maps?.places) {
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!key) { setVenuesLoading(false); return; }
          // Check if already loading
          if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
            await new Promise<void>((resolve) => {
              (window as unknown as Record<string, unknown>).__venueSearchCallback = () => resolve();
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__venueSearchCallback`;
              script.async = true;
              document.head.appendChild(script);
            });
          } else {
            // Script exists, wait for it
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (window.google?.maps?.places) { clearInterval(check); resolve(); }
              }, 100);
            });
          }
        }

        // Geocode the city to get coordinates for location-biased search
        // (25km / ~15mi radius so Brooklyn-based orgs can find Manhattan venues, etc.)
        let searchRequest: google.maps.places.TextSearchRequest = {
          query: searchCategory,
        };

        if (searchCity) {
          try {
            const geocoder = new window.google.maps.Geocoder();
            const geoResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: searchCity }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results?.length) {
                  resolve(results);
                } else {
                  reject(new Error("Geocode failed"));
                }
              });
            });
            const loc = geoResult[0].geometry.location;
            searchRequest = {
              ...searchRequest,
              location: loc,
              radius: 25000, // 25km (~15 miles)
            };
          } catch {
            // Geocode failed — fall back to city name in query text
            searchRequest.query = `${searchCategory} in ${searchCity}`;
          }
        }

        const service = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );

        service.textSearch(
          searchRequest,
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const blacklist = org.blacklistCategories || [];
              const kwBlacklist = org.excludeKeywords || [];
              const venues: NearbyVenue[] = results.slice(0, 8).map((place) => ({
                placeId: place.place_id || "",
                name: place.name || "",
                address: place.formatted_address || "",
                rating: place.rating || null,
                photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
                flagged: isVenueBlacklisted(place.name || "", place.types || [], blacklist, kwBlacklist),
              }));
              setNearbyVenues(venues);
            }
            setVenuesLoading(false);
          }
        );
      } catch {
        setVenuesLoading(false);
      }
    };

    doSearch();

    }, debounceMs); // end setTimeout
    return () => clearTimeout(timer);
  }, [hostingIdea, creatingCustomPlan, customCategory, org]);

  // Sync the proposer-side "require approval" toggles to the calendar default
  // whenever a proposal form opens. Owners/hosts editing on the dashboard get
  // their own toggle in CreatePlanModal; this only applies to follower
  // proposals from this page.
  useEffect(() => {
    if (hostingIdea) setHostRequireApproval(org?.requireApprovalDefault === true);
  }, [hostingIdea, org?.requireApprovalDefault]);
  useEffect(() => {
    if (creatingCustomPlan) setCustomRequireApproval(org?.requireApprovalDefault === true);
  }, [creatingCustomPlan, org?.requireApprovalDefault]);

  // Fetch Unsplash images when venue is selected and title is typed
  useEffect(() => {
    if (!selectedVenue || !customTitle.trim() || !creatingCustomPlan) {
      setUnsplashPhotos([]);
      return;
    }

    setUnsplashLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await Parse.Cloud.run("searchUnsplashPhotos", {
          query: customTitle.trim(),
        });
        setUnsplashPhotos(results || []);
      } catch {
        setUnsplashPhotos([]);
      } finally {
        setUnsplashLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [customTitle, selectedVenue, creatingCustomPlan]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth / 2
          : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostingIdea) return;
    const isOwnerOrHost = org && (org.isOwner || org.isHost);

    // Non-owners must verify phone first
    if (!isOwnerOrHost && !hostVerify.isVerified) return;

    setHostSubmitting(true);

    const form = e.target as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = form.querySelector('input[type="time"]') as HTMLInputElement;
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offset) % 60).padStart(2, "0");
    const dateTime = `${dateInput.value}T${timeInput.value || "18:00"}${sign}${absH}:${absM}`;

    try {
      const result = await Parse.Cloud.run("hostPlanIdea", {
        calendarPlanId: hostingIdea.id,
        date: dateTime,
        capacity: hostingIdea.suggestedCapacity || 20,
        hostNote: hostNote.trim() || undefined,
        hostName: !isOwnerOrHost ? hostVerify.name.trim() : undefined,
        hostPhone: !isOwnerOrHost ? `+1${hostVerify.phone.replace(/\D/g, "")}` : undefined,
        hostEmail: !isOwnerOrHost && hostEmail.trim() ? hostEmail.trim() : undefined,
        requireApproval: hostRequireApproval,
        venue: selectedVenue ? {
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          photoUrl: selectedVenue.photoUrl,
          rating: selectedVenue.rating,
        } : undefined,
      });
      setHostSuccess(result?.pendingApproval ? "pending" : true);
      setHostNote("");
      setHostEmail("");
      setSelectedVenue(null);
      // Auto-follow visual update for non-owners/hosts
      if (!isOwnerOrHost && !isFollowing && org) {
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
        setToast(`You're now following ${org.name}`);
        setTimeout(() => setToast(null), 3000);
      }
      // Refresh data to show the new plan
      fetchOrg();
      setTimeout(() => {
        setHostingIdea(null);
        setHostSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to host plan idea:", err);
      setHostSubmitting(false);
    }
  };

  const handleCustomPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    const isOwnerOrHost = org.isOwner || org.isHost;
    if (!isOwnerOrHost && !customVerify.isVerified) return;
    if (!selectedVenue) return;
    if (!customTitle.trim() || !customDescription.trim()) return;

    setCustomSubmitting(true);

    const form = e.target as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = form.querySelector('input[type="time"]') as HTMLInputElement;
    // Append local timezone offset so the server stores the correct UTC time
    // (e.g. "2026-09-13T18:00" + "-04:00" for Eastern Daylight Time)
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offset) % 60).padStart(2, "0");
    const dateTime = `${dateInput.value}T${timeInput.value || "18:00"}${sign}${absH}:${absM}`;

    try {
      const result = await Parse.Cloud.run("requestCustomPlanViaWeb", {
        shareId,
        name: isOwnerOrHost ? undefined : customVerify.name.trim(),
        phoneNumber: isOwnerOrHost ? undefined : `+1${customVerify.phone.replace(/\D/g, "")}`,
        email: !isOwnerOrHost && customEmail.trim() ? customEmail.trim() : undefined,
        requireApproval: customRequireApproval,
        title: customTitle.trim(),
        description: customDescription.trim(),
        date: dateTime,
        venue: {
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          photoUrl: selectedVenue.photoUrl,
          rating: selectedVenue.rating,
        },
        capacity: customCapacity ? parseInt(customCapacity, 10) : undefined,
        hostNote: hostNote.trim() || undefined,
        imageUrl: selectedImageUrl || undefined,
      });
      if (!isOwnerOrHost) {
        setVerifiedUserCookie(customVerify.name, customVerify.phone);
      }
      setCustomSuccess(result?.pendingApproval === false ? "published" : true);
      setHostNote("");
      setCustomEmail("");
      setSelectedVenue(null);
      setSelectedImageUrl(null);
      setUnsplashPhotos([]);
      // Auto-follow visual update for non-owners/hosts
      if (!isOwnerOrHost && !isFollowing && org) {
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
        setToast(`You're now following ${org.name}`);
        setTimeout(() => setToast(null), 3000);
      }
      // Refresh so a newly published plan shows up immediately.
      if (result?.pendingApproval === false) {
        fetchOrg();
      }
      setTimeout(() => {
        setCreatingCustomPlan(false);
        setCustomSuccess(false);
      }, 2500);
    } catch (err) {
      console.error("Failed to submit custom plan:", err);
      setCustomSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-400" />
          <p className="text-sm text-zinc-400 uppercase tracking-widest">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Inactive calendar state
  if (isInactive) {
    return (
      <div className="min-h-screen">
        <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-8">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-light tracking-wider uppercase">
              {isInactive.name}
            </h1>
            <span className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
              Calendar
            </span>
          </div>
        </nav>
        <div className="flex items-center justify-center px-6" style={{ minHeight: "calc(100vh - 100px)" }}>
          <div className="text-center space-y-4 max-w-md">
            <Calendar className="w-12 h-12 mx-auto text-zinc-300" />
            <h2 className="text-2xl font-light">This calendar is currently inactive</h2>
            <p className="text-zinc-400 text-sm">The calendar owner&apos;s plan does not include this calendar. Please check back later.</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-light">Calendar not found</h2>
          <p className="text-zinc-500 text-sm">{error || "This calendar doesn't exist or is no longer available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-6 md:py-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {org.profilePhoto && org.tier !== "starter" && (
              <img
                src={org.profilePhoto}
                alt={org.name}
                className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover shrink-0 self-stretch"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-sm md:text-2xl font-light tracking-[0.1em] md:tracking-wider uppercase line-clamp-2 md:truncate">
                {org.name}
              </h1>
              <span className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                {followerCount} followers
                {org.pastPlanCount > 0 && (
                  <>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    {org.pastPlanCount} past plan{org.pastPlanCount === 1 ? "" : "s"}
                  </>
                )}
              </span>
            </div>
            <div className="h-4 w-px bg-zinc-200 hidden md:block" />
            <span className="text-xs tracking-wider uppercase text-zinc-400 font-bold hidden md:block">
              Calendar
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {!org.isOwner && !org.isHost && (
              isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-3 py-1.5 rounded-full transition-colors group"
                >
                  <Check className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </button>
              ) : followRequestPending ? (
                <span className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </span>
              ) : (
                <button
                  onClick={() => setShowFollowModal(true)}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
                >
                  <Heart className="w-3.5 h-3.5" />
                  {org.isPrivate ? "Request to Follow" : "Follow"}
                </button>
              )
            )}
            {(org.isOwner || org.isHost) && (
              <Link
                href={`/dashboard/${org.parentOrgId || org.objectId}`}
                className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage
              </Link>
            )}
            {!org.isOwner && !org.isHost && (
              parseUser ? (
                <Link
                  href="/dashboard"
                  className="text-[9px] tracking-wider uppercase text-zinc-300 hover:text-zinc-500 transition-colors"
                >
                  My Dashboard
                </Link>
              ) : (
                <button
                  onClick={() => setShowHostLogin(true)}
                  className="text-[9px] tracking-wider uppercase text-zinc-300 hover:text-zinc-500 transition-colors"
                >
                  Host login
                </button>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Private calendar gate */}
      {org.isPrivate && !org.isFollower && !org.isOwner && !org.isHost ? (
        <main className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-2xl font-light tracking-tight mb-2">This is a private calendar</h2>
              <p className="text-sm text-zinc-500">
                Request to follow to see upcoming plans and ideas.
              </p>
            </div>
            {followRequestPending || org.followRequestPending ? (
              <div className="flex items-center justify-center gap-2 py-3 px-6 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 font-medium">Request pending</span>
              </div>
            ) : (
              <button
                onClick={() => setShowFollowModal(true)}
                className="text-white px-8 py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-90 rounded-lg"
                style={{ backgroundColor: org.brandColor || "#18181b" }}
              >
                Request to Follow
              </button>
            )}
          </div>
        </main>
      ) : (
      <>
      {/* Stream Header */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-6 flex justify-between items-end border-b border-zinc-100">
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
          Upcoming Plans
        </p>
      </div>

      {/* Plans Stream */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {org.plans.length === 0 ? (
          <div className={`${org.planIdeas.length > 0 ? "py-12" : "py-24"} text-center space-y-4`}>
            <Calendar className="w-12 h-12 text-zinc-300 mx-auto" />
            <h3 className="text-xl font-light">No upcoming plans yet</h3>
            <p className="text-zinc-400 text-sm">
              {org.planIdeas.length > 0
                ? "Browse curated plan ideas below and host one for your community."
                : `Check back soon for new events from ${org.name}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-32">
            {org.plans.map((plan, index) => (
              <article
                key={plan.id}
                className={`group flex flex-col md:flex-row gap-12 md:items-center ${
                  index % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div
                  className="w-full md:w-3/5 aspect-[16/10] overflow-hidden cursor-pointer bg-zinc-100 shadow-sm"
                  onClick={() => setSelectedEvent(plan)}
                >
                  {plan.image ? (
                    <img
                      src={plan.image}
                      alt={plan.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                </div>

                <div className="w-full md:w-2/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                      {plan.isPoll ? (
                        <>
                          Date Poll &bull; {plan.pollOptionCount || 0} {plan.pollOptionCount === 1 ? "option" : "options"}
                          {plan.pollClosesAt && (() => {
                            const ms = new Date(plan.pollClosesAt).getTime() - Date.now();
                            if (ms <= 0) return <> &bull; closed</>;
                            const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
                            return <> &bull; {days}d left</>;
                          })()}
                        </>
                      ) : (
                        <>{plan.date}{plan.time ? <> &bull; {plan.time}</> : ""}</>
                      )}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2">
                      <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: org.brandColor || "#18181b" }} />
                        Hosted by {plan.hostName}
                      </p>
                    </div>
                  </div>

                  <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                    {plan.description}
                  </p>

                  <div className="pt-2 flex flex-col gap-6">
                    {plan.isPoll ? (
                      <>
                        <p className="text-xs tracking-widest uppercase font-bold text-zinc-500">
                          {plan.pollVoteCount || 0} {plan.pollVoteCount === 1 ? "Vote" : "Votes"} so far
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
                            onClick={() => setSelectedEvent(plan)}
                            className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ backgroundColor: org.brandColor || "#18181b" }}
                          >
                            Vote on a Date <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSharePlan(plan.id, plan.title)}
                            className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative flex items-center justify-center gap-2"
                          >
                            {copiedPlanId === plan.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <AvatarStack count={plan.attendeeCount} />
                          {hostedPlanIds.has(plan.id) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Hosting
                            </span>
                          ) : pendingRsvpIds.has(plan.id) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : rsvpedPlanIds.has(plan.id) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Attending
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* "View Details" for everyone — RSVP'd, hosting, pending, or new.
                              The modal handles state-specific actions (Join Plan Chat for
                              attendees, Message Attendees for hosts, Cancel RSVP, etc.). */}
                          <button
                            onClick={() => setSelectedEvent(plan)}
                            className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ backgroundColor: org.brandColor || "#18181b" }}
                          >
                            View Details <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSharePlan(plan.id, plan.title)}
                            className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative flex items-center justify-center gap-2"
                          >
                            {copiedPlanId === plan.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Plan Ideas Carousel */}
        {/* Get Involved section — shows if plan ideas OR custom proposals are enabled */}
        {((org.planIdeas.length > 0 && !org.hidePlanIdeas) || (!org.rsvpLimitReached && !org.hideCustomPlans)) && (
          <section className={`${org.plans.length > 0 ? "mt-48" : "mt-8"} mb-24 space-y-12`}>
            <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
              <div className="space-y-2">
                <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
                  Get Involved
                </p>
                <h2 className="text-4xl font-light tracking-tight italic">
                  Host Something for the Community
                </h2>
              </div>
              {org.planIdeas.length > 0 && !org.hidePlanIdeas && (
                <div className="flex gap-4">
                  <button
                    onClick={() => scroll("left")}
                    className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => scroll("right")}
                    className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {org.rsvpLimitReached && (
              <div className="flex items-center gap-3 bg-zinc-100 border border-zinc-200 px-6 py-4">
                <Lock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <p className="text-sm text-zinc-500">
                  This calendar has reached its RSVP limit. New RSVPs and hosting are temporarily paused. Please contact the organization administrator.
                </p>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-8"
            >
              {/* Custom plan card — only if custom proposals enabled */}
              {!org.rsvpLimitReached && !org.hideCustomPlans && (
                <div
                  className="min-w-[280px] max-w-[300px] snap-start group cursor-pointer"
                  onClick={() => {
                    setCreatingCustomPlan(true);
                    setCustomTitle("");
                    setCustomDescription("");
                    setCustomCategory("");
                    setCustomCapacity("");
                    setHostNote("");
                    setSelectedVenue(null);
                    setCustomSubmitting(false);
                    setCustomSuccess(false);
                  }}
                >
                  <div className="aspect-[4/5] overflow-hidden mb-4 relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white transition-all group-hover:shadow-lg group-hover:border-emerald-300">
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Plus className="w-7 h-7" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs tracking-wider uppercase font-bold text-emerald-700">
                          Your Idea
                        </p>
                        <h4 className="text-lg font-medium tracking-tight text-zinc-900">
                          Suggest a Plan
                        </h4>
                        <p className="text-xs text-zinc-500 leading-relaxed font-light">
                          Have something in mind? Share your idea and we&apos;ll review it.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-medium tracking-tight group-hover:italic">
                      Custom Plan
                    </h4>
                    <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                      Pitch a date, venue, and details — pending organizer approval.
                    </p>
                  </div>
                </div>
              )}
              {/* Plan idea cards — only if plan ideas enabled */}
              {!org.hidePlanIdeas && org.planIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className={`min-w-[280px] max-w-[300px] snap-start group ${org.rsvpLimitReached ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => {
                    if (org.rsvpLimitReached) return;
                    setHostingIdea(idea);
                    setHostSubmitting(false);
                    setHostSuccess(false);
                    setHostNote("");
                    setSelectedVenue(null);
                  }}
                >
                  <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-4 relative">
                    {idea.image ? (
                      <img
                        src={idea.image}
                        className={`w-full h-full object-cover transition-transform duration-700 ${org.rsvpLimitReached ? "grayscale opacity-60" : "group-hover:scale-110"}`}
                        alt={idea.title}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className={`w-12 h-12 ${org.rsvpLimitReached ? "text-zinc-200" : "text-zinc-300"}`} />
                      </div>
                    )}
                    <div className={`absolute inset-0 transition-all duration-300 flex items-center justify-center ${
                      org.rsvpLimitReached
                        ? "bg-black/10 opacity-100"
                        : "bg-black/0 group-hover:bg-black/20 opacity-0 group-hover:opacity-100"
                    }`}>
                      {org.rsvpLimitReached ? (
                        <span className="bg-white/90 px-6 py-3 text-xs tracking-wider uppercase font-bold shadow-xl flex items-center gap-2 text-zinc-400">
                          <Lock className="w-3.5 h-3.5" /> Host This
                        </span>
                      ) : (
                        <span className="bg-white px-6 py-3 text-xs tracking-wider uppercase font-bold shadow-xl">
                          Host This
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className={`text-base font-medium tracking-tight ${org.rsvpLimitReached ? "text-zinc-400" : "group-hover:italic"}`}>
                      {idea.title}
                    </h4>
                    <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                      {idea.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Plan Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-zinc-100 text-zinc-600 md:bg-transparent md:text-zinc-900"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {selectedEvent.image ? (
                <img
                  src={selectedEvent.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
                  {selectedEvent.title}
                </h2>
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                  Hosted by {selectedEvent.hostName}
                </p>
                <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
                  {selectedEvent.isPoll ? (
                    <>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {selectedEvent.pollOptionCount || 0} {selectedEvent.pollOptionCount === 1 ? "option" : "options"}
                        {selectedEvent.pollClosesAt && (() => {
                          const ms = new Date(selectedEvent.pollClosesAt).getTime() - Date.now();
                          if (ms <= 0) return <> &middot; closed</>;
                          const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
                          return <> &middot; {days}d left</>;
                        })()}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> {selectedEvent.pollVoteCount || 0} {selectedEvent.pollVoteCount === 1 ? "vote" : "votes"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {selectedEvent.date}{selectedEvent.time ? ` at ${selectedEvent.time}` : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> {selectedEvent.attendeeCount} attending
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-xl font-light leading-relaxed text-zinc-600 whitespace-pre-wrap">
                  {renderLinkedText(selectedEvent.description)}
                </p>
                {selectedEvent.hostNote && (
                  <div className="space-y-2">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      Note from Host
                    </h4>
                    <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-200 pl-3">
                      &ldquo;{selectedEvent.hostNote}&rdquo;
                    </p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="space-y-2">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      Location
                    </h4>
                    {selectedEvent.isPoll ? (
                      // Polls don't gate location behind RSVP — date isn't picked yet
                      // and the venue (if set) is shown as informational context.
                      selectedEvent.location.name ? (
                        <>
                          <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                          {selectedEvent.location.address && (
                            <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                          )}
                        </>
                      ) : selectedEvent.location.neighborhood && (
                        <p className="text-sm text-zinc-700">{selectedEvent.location.neighborhood}</p>
                      )
                    ) : selectedEvent.location.isPrivate || (!selectedEvent.location.name && !selectedEvent.location.address) || (selectedEvent.requireApproval && !rsvpedPlanIds.has(selectedEvent.id)) ? (
                      <>
                        {selectedEvent.location.neighborhood && (
                          <p className="text-sm text-zinc-700">{selectedEvent.location.neighborhood}</p>
                        )}
                        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                          <Lock className="w-3 h-3" /> Location revealed after {selectedEvent.requireApproval ? "approval" : "RSVP"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                        <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-zinc-100 flex flex-col gap-4">
                {selectedEvent.isPoll ? (
                  <div className="space-y-4">
                    <PollVoteWidget
                      eventGroupId={selectedEvent.id}
                      brandColor={org.brandColor || "#18181b"}
                    />
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="w-full border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : org.rsvpLimitReached ? (
                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full bg-zinc-300 text-zinc-500 py-3 text-xs uppercase tracking-wider font-bold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" /> RSVPs Paused
                    </button>
                    <p className="text-xs text-zinc-400 text-center">
                      This calendar has reached its RSVP limit. Please contact the organization administrator.
                    </p>
                  </div>
                ) : pendingRsvpIds.has(selectedEvent.id) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Request Pending</span>
                    </div>
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : hostedPlanIds.has(selectedEvent.id) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">You&apos;re Hosting</span>
                    </div>
                    {hostNotificationId && (
                      <a
                        href={`/h/${hostNotificationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        <MessageCircle className="w-4 h-4" /> Message Attendees
                      </a>
                    )}
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : rsvpedPlanIds.has(selectedEvent.id) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">You&apos;re Attending</span>
                    </div>
                    {rsvpNotificationIds.get(selectedEvent.id) ? (
                      <div className="flex gap-4">
                        <a
                          href={`/c/${rsvpNotificationIds.get(selectedEvent.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                          style={{ backgroundColor: org.brandColor || "#18181b" }}
                        >
                          <MessageCircle className="w-4 h-4" /> Join Plan Chat
                        </a>
                        <button
                          onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                          className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors flex items-center gap-2 rounded-lg"
                        >
                          {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                          <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                        className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 rounded-lg"
                      >
                        {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                        <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setRsvpPlan(selectedEvent);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: org.brandColor || "#18181b" }}
                    >
                      {selectedEvent.requireApproval ? "Request to Attend" : "I\u0027m Attending"}
                    </button>
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                )}
                {/* Add to Calendar — only on real plans (not polls), only when we have a date,
                    and only when the viewer is actually attending or hosting (otherwise it's
                    misleading — they haven't agreed to go yet). Pending RSVPs are excluded
                    since approval might be denied. Venue address is omitted when the location
                    is gated behind RSVP/approval and the user hasn't unlocked it yet, so
                    private addresses don't leak into calendar entries. */}
                {!selectedEvent.isPoll
                  && selectedEvent.dateISO
                  && (rsvpedPlanIds.has(selectedEvent.id) || hostedPlanIds.has(selectedEvent.id))
                  && (() => {
                  const venueGated = !!(selectedEvent.location?.isPrivate
                    || (selectedEvent.requireApproval && !rsvpedPlanIds.has(selectedEvent.id)));
                  const icsUrl = buildIcsHref({
                    uid: selectedEvent.id,
                    title: selectedEvent.title,
                    dateISO: selectedEvent.dateISO,
                    time: selectedEvent.time,
                    description: selectedEvent.description,
                    locationName: venueGated ? selectedEvent.location?.neighborhood ?? null : selectedEvent.location?.name,
                    locationAddress: venueGated ? null : selectedEvent.location?.address,
                    url: typeof window !== "undefined" ? `${window.location.origin}/p/${selectedEvent.id}` : undefined,
                  });
                  if (!icsUrl) return null;
                  return (
                    <a
                      href={icsUrl}
                      className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg mt-3"
                    >
                      <Calendar className="w-4 h-4" />
                      Add to Calendar
                    </a>
                  );
                })()}
                {/* Attendee list lives on the dedicated /h/{notificationId}
                    page now (reached via the "Message Attendees" button
                    above) so it's not duplicated here. Single place to see
                    who's attending, who shared their number, and to message
                    everyone. */}
                {/* Cancel RSVP — red text link at the bottom for confirmed
                    attendees (mirrors the host's "Cancel this plan" treatment). */}
                {rsvpedPlanIds.has(selectedEvent.id) && (
                  <button
                    onClick={() => handleCancelRsvp(selectedEvent.id)}
                    disabled={cancellingRsvp === selectedEvent.id}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors pt-2 disabled:opacity-50"
                  >
                    {cancellingRsvp === selectedEvent.id ? "Cancelling..." : "Cancel RSVP"}
                  </button>
                )}
                {/* Cancel Plan — visible only to the actual host of this plan.
                    Owners/co-hosts can still cancel via the dashboard, but the
                    public org page is the attendee/host POV — owners showing up
                    here as RSVP'd shouldn't see admin-style cancel actions. */}
                {parseUser && selectedEvent.hostId === parseUser.id && (
                  <button
                    onClick={() => handleCancelPlan(selectedEvent.id)}
                    disabled={cancellingPlan}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors pt-2 disabled:opacity-50"
                  >
                    {cancellingPlan ? "Cancelling..." : "Cancel this plan"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Modal */}
      {rsvpPlan && (
        <RsvpModal
          plan={rsvpPlan}
          onClose={() => setRsvpPlan(null)}
          brandColor={org.brandColor || undefined}
          existingNotificationId={rsvpNotificationIds.get(rsvpPlan.id) || null}
          onRsvpSuccess={(planId, alreadyRsvpd, pendingApproval) => {
            if (pendingApproval) {
              addPendingRsvpCookie(planId);
              setPendingRsvpIds((prev) => new Set([...prev, planId]));
              return;
            }
            addRsvpCookie(planId);
            setRsvpedPlanIds((prev) => new Set([...prev, planId]));
            if (alreadyRsvpd) return;
            setOrg((prev) => prev ? {
              ...prev,
              plans: prev.plans.map((p) =>
                p.id === planId ? { ...p, attendeeCount: p.attendeeCount + 1 } : p
              ),
            } : prev);
            setSelectedEvent((prev) =>
              prev && prev.id === planId ? { ...prev, attendeeCount: prev.attendeeCount + 1 } : prev
            );
          }}
        />
      )}

      {cancelRsvpModalPlan && (
        <CancelRsvpModal
          planId={cancelRsvpModalPlan.id}
          planTitle={cancelRsvpModalPlan.title}
          onClose={() => setCancelRsvpModalPlan(null)}
          onCancelled={(planId) => {
            setCancelRsvpModalPlan(null);
            completeCancelRsvp(planId);
          }}
        />
      )}

      {/* Host Plan Idea Overlay */}
      {hostingIdea && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => {
                setHostingIdea(null);
                setHostSuccess(false);
              }}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {hostingIdea.image ? (
                <img
                  src={hostingIdea.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-8">
              {hostSuccess ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-light">
                    {hostSuccess === "pending" ? "Request submitted!" : "Your plan is scheduled."}
                  </h4>
                  {hostSuccess === "pending" && (
                    <p className="text-sm text-zinc-500">The organizer will review your request and get back to you.</p>
                  )}
                  <p className="text-zinc-400 uppercase tracking-widest text-xs">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-3xl font-light mb-2 italic">
                      Host this event
                    </h3>
                    <p className="text-zinc-500 font-light">
                      Bring &ldquo;{hostingIdea.title}&rdquo; to your community.
                    </p>
                  </div>

                  {/* Venue Carousel */}
                  <div className="space-y-3">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      Choose a Venue
                    </h4>
                    {venuesLoading ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                        ))}
                      </div>
                    ) : nearbyVenues.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {nearbyVenues.map((venue) => (
                          <button
                            key={venue.placeId}
                            type="button"
                            onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                            className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                              selectedVenue?.placeId === venue.placeId
                                ? "border-zinc-900 shadow-lg"
                                : venue.flagged
                                  ? "border-amber-300 hover:border-amber-400"
                                  : "border-zinc-200 hover:border-zinc-300"
                            }`}
                          >
                            {venue.flagged && (
                              <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 z-10">
                                <AlertTriangle className="w-3 h-3" />
                              </div>
                            )}
                            <div className="h-[100px] bg-zinc-100">
                              {venue.photoUrl ? (
                                <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <MapPin className="w-6 h-6 text-zinc-300" />
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold truncate">{venue.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {venue.rating && (
                                  <span className="text-xs text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400 truncate mt-0.5">{venue.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">No venues found nearby.</p>
                    )}
                    {selectedVenue && (
                      <div>
                        <p className="text-xs text-zinc-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                        </p>
                        {selectedVenue.flagged && (
                          <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> This venue type is restricted by the admin. Your request will need approval.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleHostSubmit} className="space-y-8">
                    {/* Name & Phone for non-owners */}
                    {!(org.isOwner || org.isHost) && (
                      <>
                        <PhoneVerifyFields verify={hostVerify} />
                        <div className="space-y-2">
                          <label className="text-xs tracking-wider uppercase font-bold">
                            Email (optional)
                          </label>
                          <input
                            type="email"
                            value={hostEmail}
                            onChange={(e) => setHostEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                          />
                          <p className="text-xs text-zinc-400">We&apos;ll send updates about your plan here.</p>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Preferred Date
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split("T")[0]}
                        max={org.tier === "starter" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : undefined}
                        defaultValue={hostingIdea.date ? new Date(hostingIdea.date).toISOString().split("T")[0] : ""}
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Start Time
                      </label>
                      <input
                        type="time"
                        required
                        defaultValue="18:00"
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Host&apos;s Note
                      </label>
                      <textarea
                        value={hostNote}
                        onChange={(e) => setHostNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                        placeholder="Add a personal note for attendees (optional)"
                      />
                      <p className="text-xs text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs tracking-wider uppercase font-bold">Require approval to attend</p>
                        <p className="text-xs text-zinc-400 font-light">Visitors must be approved before confirming</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHostRequireApproval(!hostRequireApproval)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${hostRequireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hostRequireApproval ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Visibility
                      </label>
                      <div className="p-6 border border-zinc-900 bg-zinc-50">
                        <span className="block font-bold text-xs uppercase tracking-widest mb-1">
                          Public Stream
                        </span>
                        <span className="text-sm font-light text-zinc-500">
                          Visible to all community members.
                        </span>
                      </div>
                    </div>
                    <div className="pt-8 flex gap-4">
                      <button
                        type="button"
                        onClick={() => setHostingIdea(null)}
                        className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={hostSubmitting || (!(org.isOwner || org.isHost) && !hostVerify.isVerified)}
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        {hostSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          org.isOwner || org.isHost ? "Host Plan" : "Request to Host"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Plan Request Overlay */}
      {creatingCustomPlan && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] md:h-[90vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => {
                setCreatingCustomPlan(false);
                setCustomSuccess(false);
                setSelectedImageUrl(null);
                setUnsplashPhotos([]);
              }}
              className="absolute top-6 right-6 z-50 p-2 rounded-full text-zinc-900"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-8">
              {customSuccess ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-light">
                    {customSuccess === "published" ? "Plan published!" : "Request submitted!"}
                  </h4>
                  <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                    {customSuccess === "published"
                      ? "Your plan is live. Followers will see it on the calendar."
                      : "The organizer will review your custom plan and get back to you."}
                  </p>
                  <p className="text-zinc-400 uppercase tracking-widest text-xs">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs tracking-wider uppercase font-bold text-emerald-700 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> Be the Host
                    </p>
                    <h3 className="text-3xl font-light italic">Propose a custom plan</h3>
                    <p className="text-zinc-500 font-light">
                      {org.isOwner || org.isHost
                        ? `Create a new plan for ${org.name}. It will go live immediately.`
                        : `Bring something new to ${org.name}. The organizer will review and approve.`}
                    </p>
                  </div>

                  {!org.hidePlanIdeas && org.planIdeas.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs tracking-wider uppercase font-bold text-zinc-500">
                        Or host one of these ideas
                      </p>
                      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-8 md:-mx-16 px-8 md:px-16 pb-2">
                        {org.planIdeas.map((idea) => (
                          <button
                            type="button"
                            key={idea.id}
                            onClick={() => {
                              setCreatingCustomPlan(false);
                              setHostingIdea(idea);
                              setHostSubmitting(false);
                              setHostSuccess(false);
                              setHostNote("");
                              setSelectedVenue(null);
                            }}
                            className="text-left min-w-[140px] max-w-[140px] snap-start group"
                          >
                            <div className="aspect-square overflow-hidden bg-zinc-100 mb-2 relative rounded-md">
                              {idea.image ? (
                                <img
                                  src={idea.image}
                                  alt={idea.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Sparkles className="w-7 h-7 text-zinc-300" />
                                </div>
                              )}
                            </div>
                            <h5 className="text-xs font-medium tracking-tight line-clamp-2 group-hover:italic leading-snug">
                              {idea.title}
                            </h5>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCustomPlanSubmit} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Plan Title
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="e.g. Saturday Morning Trail Run"
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Description
                      </label>
                      <textarea
                        required
                        rows={3}
                        maxLength={2000}
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="What is this plan about? Who is it for?"
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Date
                        </label>
                        <input
                          type="date"
                          required
                          min={new Date().toISOString().split("T")[0]}
                          max={org.tier === "starter" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : undefined}
                          className="w-full border-b border-zinc-300 py-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          defaultValue="18:00"
                          className="w-full border-b border-zinc-300 py-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Venue search */}
                    <div className="space-y-3">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Venue Type / Search
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. coffee shop, park, brewery"
                        className="w-full border-b border-zinc-300 py-3 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      <p className="text-[11px] text-zinc-400">
                        We&apos;ll search nearby venues in {org.orgCity || "your area"}.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Choose a Venue <span className="text-red-500">*</span>
                      </label>
                      {venuesLoading ? (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                          ))}
                        </div>
                      ) : nearbyVenues.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {nearbyVenues.map((venue) => (
                            <button
                              key={venue.placeId}
                              type="button"
                              onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedVenue?.placeId === venue.placeId
                                  ? "border-zinc-900 shadow-lg"
                                  : venue.flagged
                                    ? "border-amber-300 hover:border-amber-400"
                                    : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {venue.flagged && (
                                <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 z-10">
                                  <AlertTriangle className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[100px] bg-zinc-100">
                                {venue.photoUrl ? (
                                  <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-zinc-300" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-xs font-bold truncate">{venue.name}</p>
                                {venue.rating && (
                                  <span className="text-xs text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{venue.address}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400 italic">
                          {customCategory ? "No venues found. Try a different search." : "Type a venue type above to search."}
                        </p>
                      )}
                      {selectedVenue && (
                        <div>
                          <p className="text-xs text-zinc-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                          </p>
                          {selectedVenue.flagged && (
                            <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> This venue type is restricted by the admin. Your request will need approval.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cover Image Picker */}
                    {selectedVenue && customTitle.trim() && (
                      <div className="space-y-3">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Cover Image
                        </label>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {/* Venue photo option */}
                          {selectedVenue.photoUrl && (
                            <button
                              key="venue-photo"
                              type="button"
                              onClick={() => setSelectedImageUrl(
                                selectedImageUrl === selectedVenue.photoUrl ? null : selectedVenue.photoUrl!
                              )}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedImageUrl === selectedVenue.photoUrl
                                  ? "border-zinc-900 shadow-lg"
                                  : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {selectedImageUrl === selectedVenue.photoUrl && (
                                <div className="absolute top-1.5 right-1.5 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[120px] bg-zinc-100">
                                <img src={selectedVenue.photoUrl} className="w-full h-full object-cover" alt={selectedVenue.name} />
                              </div>
                            </button>
                          )}

                          {/* Unsplash skeleton loaders */}
                          {unsplashLoading && [0, 1, 2, 3].map((i) => (
                            <div key={`skel-${i}`} className="min-w-[160px] h-[140px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                          ))}

                          {/* Unsplash results */}
                          {!unsplashLoading && unsplashPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setSelectedImageUrl(
                                selectedImageUrl === photo.url ? null : photo.url
                              )}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedImageUrl === photo.url
                                  ? "border-zinc-900 shadow-lg"
                                  : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {selectedImageUrl === photo.url && (
                                <div className="absolute top-1.5 right-1.5 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[120px] bg-zinc-100">
                                <img src={photo.thumbUrl} className="w-full h-full object-cover" alt={photo.alt} />
                              </div>
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const selected = unsplashPhotos.find(p => p.url === selectedImageUrl);
                          if (!selected) return null;
                          return (
                            <p className="text-xs text-zinc-400">
                              Photo by{" "}
                              <a
                                href={`${selected.photographerUrl}?utm_source=leaf&utm_medium=referral`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-600"
                              >
                                {selected.photographerName}
                              </a>
                              {" / "}
                              <a
                                href="https://unsplash.com/?utm_source=leaf&utm_medium=referral"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-600"
                              >
                                Unsplash
                              </a>
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Capacity <span className="text-zinc-400 normal-case">(optional)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={customCapacity}
                          onChange={(e) => setCustomCapacity(e.target.value)}
                          placeholder="e.g. 20"
                          className="w-full border-b border-zinc-300 py-3 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Host&apos;s Note <span className="text-zinc-400 normal-case">(optional)</span>
                      </label>
                      <textarea
                        value={hostNote}
                        onChange={(e) => setHostNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                        placeholder="Add a personal note for attendees"
                      />
                      <p className="text-xs text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>

                    {!(org.isOwner || org.isHost) && (
                      <>
                        <PhoneVerifyFields verify={customVerify} />
                        <div className="space-y-2">
                          <label className="text-xs tracking-wider uppercase font-bold">
                            Email (optional)
                          </label>
                          <input
                            type="email"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                          />
                          <p className="text-xs text-zinc-400">We&apos;ll send updates about your plan here.</p>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs tracking-wider uppercase font-bold">Require approval to attend</p>
                        <p className="text-xs text-zinc-400 font-light">Visitors must be approved before confirming</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomRequireApproval(!customRequireApproval)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${customRequireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${customRequireApproval ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button
                        type="button"
                        onClick={() => setCreatingCustomPlan(false)}
                        className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          customSubmitting ||
                          (!(org.isOwner || org.isHost) && !customVerify.isVerified) ||
                          !selectedVenue ||
                          !customTitle.trim() ||
                          !customDescription.trim()
                        }
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        {customSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          org.isOwner || org.isHost ? "Create Plan" : "Submit for Approval"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Your Own Calendar CTA */}
      <section ref={ctaSectionRef} className="py-10 px-6 border-t border-zinc-100 bg-zinc-50/60">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs tracking-wider uppercase text-zinc-400 mb-1">
              Powered by Leaf
            </p>
            <p className="text-sm text-zinc-600 font-light">
              Create a free social calendar for your community.
            </p>
          </div>
          <a
            href="https://www.os.joinleaf.com/organizations/setup"
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-800 transition-colors shrink-0"
          >
            Get Started — It&apos;s Free <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      </>
      )}

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <span className="text-xl font-light tracking-wider uppercase">
              {org.name}
            </span>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              {org.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Platform
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <Link href="/about" className="hover:text-zinc-900 transition-colors">
                  About
                </Link>
                <Link href="/safety" className="hover:text-zinc-900 transition-colors">
                  Safety
                </Link>
                <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Connect
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <a
                  href="mailto:team@getleaflets.co"
                  className="hover:text-zinc-900 transition-colors"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Follow Modal */}
      {showFollowModal && (
        <FollowModal
          calendarId={org.objectId}
          calendarName={org.name}
          brandColor={org.brandColor || undefined}
          isPrivate={org.isPrivate}
          onClose={() => setShowFollowModal(false)}
          onFollowed={(_name, _phone, pending) => {
            if (pending) {
              setFollowRequestPending(true);
            } else {
              setIsFollowing(true);
              setFollowerCount((c) => c + 1);
            }
            setShowFollowModal(false);
          }}
        />
      )}

      {/* Host Login Modal */}
      {showHostLogin && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-xl p-8 relative">
            <button
              onClick={() => setShowHostLogin(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-light tracking-tight">Host Login</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Sign in to manage this calendar.
                </p>
              </div>
              <GoogleSignInButton
                onSignIn={(u) => {
                  setParseUser(u as unknown as Parse.User);
                  setShowHostLogin(false);
                  fetchOrg();
                  const name = (u as unknown as Parse.User)?.get?.("full_name") || (u as unknown as Parse.User)?.get?.("name") || "";
                  if (name) {
                    setToast(`Signed in as ${name}`);
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
                onError={(err) => console.error("Sign-in error:", err)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Welcome / "Make it your own" invite — shown after first calendar creation */}
      {showWelcomeInvite && org.isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWelcomeInvite(false)}
          />
          <div className="relative bg-white max-w-md w-full mx-4 shadow-2xl">
            <button
              onClick={() => setShowWelcomeInvite(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 space-y-6">
              <div className="w-14 h-14 border-2 border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-light tracking-tight">
                  Make it your own first
                </h3>
                <p className="text-zinc-500 font-light">
                  Before sharing your calendar, take a moment to manage your
                  settings — tune your preferred days, times, blacklist
                  categories, and brand.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href={`/dashboard/${org.parentOrgId || org.objectId}?tab=calendars`}
                  className="bg-zinc-900 text-white px-6 py-3.5 text-xs uppercase tracking-wider font-bold text-center hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  Manage Calendar Settings <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShowWelcomeInvite(false)}
                  className="px-6 py-3 text-xs uppercase tracking-wider font-medium text-zinc-500 hover:text-zinc-900 text-center transition-colors"
                >
                  Skip and view my calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow Popup */}
      {showFollowPopup && org && (
        <div
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-40"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-4">
            <button
              onClick={dismissFollowPopup}
              className="absolute top-3 right-3 p-1 text-zinc-300 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3 pr-6">
              {org.profilePhoto ? (
                <img src={org.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{org.name}</p>
                <p className="text-xs text-zinc-500">{org.isPrivate ? "Request access to see plans" : "Get notified about new plans"}</p>
              </div>
            </div>
            <button
              onClick={handlePopupFollow}
              disabled={followPopupLoading}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: org.brandColor || "#18181b" }}
            >
              {followPopupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                org.isPrivate ? "Request to Follow" : "Follow"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Plan Idea Popup for Followers */}
      {showPlanIdeaPopup && popupIdea && org && (
        <div
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-40"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
            <button
              onClick={dismissPlanIdeaPopup}
              className="absolute top-3 right-3 z-10 p-1 text-zinc-300 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            {popupIdea.image && (
              <div className="h-28 w-full overflow-hidden">
                <img
                  src={popupIdea.image}
                  alt={popupIdea.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold mb-1.5">
                {popupIdea.category}
              </p>
              <h4 className="text-sm font-medium tracking-tight text-zinc-900 mb-3 pr-6">
                {popupIdea.title}
              </h4>
              <button
                onClick={() => {
                  dismissPlanIdeaPopup();
                  setHostingIdea(popupIdea);
                  setHostSubmitting(false);
                  setHostSuccess(false);
                  setHostNote("");
                  setSelectedVenue(null);
                }}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: org.brandColor || "#18181b" }}
              >
                Host This Plan
              </button>
              <button
                onClick={dismissPlanIdeaPopup}
                className="w-full mt-2 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
