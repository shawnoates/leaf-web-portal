"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
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
} from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/app/leaf";

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// --- Types ---

interface Plan {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  image: string;
  hostName: string;
  hostAvatar: string | null;
  attendeeCount: number;
  location: {
    name: string;
    address: string;
  } | null;
  hostNote: string | null;
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
  name: string;
  description: string;
  profilePhoto: string | null;
  tier: string;
  brandColor: string | null;
  orgType: string | null;
  orgCity: string | null;
  memberCount: number;
  rsvpLimitReached: boolean;
  isOwner: boolean;
  isHost: boolean;
  plans: Plan[];
  planIdeas: PlanIdea[];
  blacklistCategories: string[];
  excludeKeywords: string[];
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

// --- Components ---

function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 overflow-hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
          <Users className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </div>
      <span className="text-[10px] tracking-widest uppercase font-bold text-zinc-400">
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
}: {
  plan: Plan;
  brandColor?: string;
  onClose: () => void;
  onRsvpSuccess?: (planId: string, alreadyRsvpd: boolean) => void;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [notificationId, setNotificationId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      const result = await Parse.Cloud.run("rsvpToPlanViaWeb", {
        phoneNumber: verify.phone.replace(/\D/g, ""),
        name: verify.name,
        eventGroupId: plan.id,
      }) as { eventNotificationId?: string; alreadyRsvpd?: boolean } | null | undefined;
      console.log("[RSVP] result:", result);
      setVerifiedUserCookie(verify.name, verify.phone);
      if (result?.eventNotificationId) {
        setNotificationId(result.eventNotificationId);
      }
      onRsvpSuccess?.(plan.id, result?.alreadyRsvpd === true);
      setFormStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setFormStep("error");
    }
  };

  const deepLink = notificationId ? `leaf://planChat?planId=${notificationId}` : null;
  const isIOS = isIOSDevice();

  const handleIOSDeepLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!deepLink) return;
    e.preventDefault();
    window.location.href = deepLink;
    // Fallback to App Store if the app isn't installed
    setTimeout(() => {
      window.location.href = APP_STORE_URL;
    }, 1500);
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
                RSVP for {plan.title}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {plan.date} at {plan.time}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <PhoneVerifyFields verify={verify} />
              <button
                type="submit"
                disabled={formStep === "submitting" || !verify.isVerified || !verify.name}
                className="w-full text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
            <div className="w-14 h-14 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">You&apos;re in!</h4>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                Coordinate with the group. Join the Plan Chat.
              </p>
            </div>

            {deepLink && isIOS && (
              <div className="pt-2 space-y-3">
                <a
                  href={deepLink}
                  onClick={handleIOSDeepLink}
                  className="block w-full text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90 rounded-lg"
                  style={{ backgroundColor: brandColor || "#18181b" }}
                >
                  Join the Plan Chat
                </a>
                <p className="text-[11px] text-zinc-400">
                  Don&apos;t have the app?{" "}
                  <a href={APP_STORE_URL} className="underline hover:text-zinc-900">
                    Download Leaf
                  </a>
                </p>
              </div>
            )}

            {deepLink && !isIOS && (
              <div className="pt-2 space-y-3">
                <div className="inline-block bg-white p-3 rounded-lg border border-zinc-200">
                  <QRCodeSVG value={deepLink} size={180} level="M" />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Scan with your phone to open the chat in the Leaf app
                </p>
              </div>
            )}

            {!deepLink && (
              <a
                href={APP_STORE_URL}
                className="block w-full border border-zinc-200 py-3 text-xs uppercase tracking-[0.2em] font-bold text-center hover:bg-zinc-50 transition-colors rounded-lg"
              >
                Open in Leaf App
              </a>
            )}

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

// --- Verified User Cookie (shared across Follow, RSVP, Host) ---

interface VerifiedUser {
  name: string;
  phone: string; // formatted like 555-555-5555
}

function setVerifiedUserCookie(name: string, phone: string) {
  const data = JSON.stringify({ name, phone });
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_verified_user=${encodeURIComponent(data)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getVerifiedUserCookie(): VerifiedUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/leaf_verified_user=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

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

  return { name, setName, phone, setPhone, code, setCode, step, isVerified, sending, error, sendOTP, verifyOTP, reset };
}

// --- Shared Phone Verify Fields Component ---

function PhoneVerifyFields({ verify }: { verify: ReturnType<typeof usePhoneVerify> }) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
              onClick={verify.sendOTP}
              disabled={verify.sending || verify.phone.replace(/\D/g, "").length < 10 || !verify.name}
              className="px-4 py-2.5 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
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
                className="px-4 py-2.5 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
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

// --- Follow Modal ---

function FollowModal({
  calendarId,
  calendarName,
  onClose,
  onFollowed,
  brandColor,
}: {
  calendarId: string;
  calendarName: string;
  brandColor?: string;
  onClose: () => void;
  onFollowed: (name: string, phone: string) => void;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      await Parse.Cloud.run("followCalendarViaWeb", {
        calendarId,
        name: verify.name,
        phoneNumber: verify.phone.replace(/\D/g, ""),
      });
      setFollowerCookie(calendarId, verify.name, verify.phone);
      setVerifiedUserCookie(verify.name, verify.phone);
      onFollowed(verify.name, verify.phone);
      setFormStep("success");
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
                Follow {calendarName}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                Get notified about new plans and events.
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
  const customVerify = usePhoneVerify();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isInactive, setIsInactive] = useState<{ name: string } | null>(null);
  const [showWelcomeInvite, setShowWelcomeInvite] = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  // Check cookie on mount
  useEffect(() => {
    const cookie = getFollowerCookie();
    if (cookie) {
      setIsFollowing(true);
    }
  }, []);

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
    }
    return () => { document.title = "Leaf"; };
  }, [org]);

  const fetchOrg = useCallback(async () => {
    try {
      setLoading(true);
      const result = await Parse.Cloud.run("getOrgCalendarPage", { shareId });

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
        time: p.expiryDate ? formatTime(p.expiryDate as string) : "",
        description: p.description as string || "",
        image: p.image as string || "",
        hostName: (p.host as Record<string, string>)?.name || "Community Member",
        hostAvatar: (p.host as Record<string, string>)?.profilePictureUrl || null,
        // rsvpCount tracks RSVPs only; the host is always attending so add 1
        attendeeCount: ((p.rsvpCount as number) || 0) + 1,
        location: p.location ? {
          name: (p.location as Record<string, string>).name || "",
          address: (p.location as Record<string, string>).address || "",
        } : null,
        hostNote: p.hostNote as string || null,
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
        name: result.name || "Organization",
        description: result.description || "",
        profilePhoto: result.profilePhoto || null,
        tier: result.orgSubscriptionTier || "starter",
        brandColor: result.orgBrandColor || "#18181b",
        orgType: result.orgType || null,
        orgCity: result.orgCity || null,
        memberCount: result.memberCount || 0,
        rsvpLimitReached: result.rsvpLimitReached || false,
        isOwner: result.isOwner || false,
        isHost: result.isHost || false,
        plans,
        planIdeas,
        blacklistCategories: result.orgBlacklistCategories || [],
        excludeKeywords: result.orgExcludeKeywords || [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
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
            <h1 className="text-2xl font-light tracking-[0.2em] uppercase">
              {isInactive.name}
            </h1>
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
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
                className="w-9 h-9 rounded-lg object-contain shrink-0"
              />
            )}
            <h1 className="text-sm md:text-2xl font-light tracking-[0.1em] md:tracking-[0.2em] uppercase line-clamp-2 md:truncate">
              {org.name}
            </h1>
            <div className="h-4 w-px bg-zinc-200 hidden md:block" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold hidden md:block">
              Calendar
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400 hidden sm:inline">
              {followerCount} followers
            </span>
            {!org.isOwner && (
              isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-3 py-1.5 rounded-full transition-colors group"
                >
                  <Check className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowFollowModal(true)}
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
                >
                  <Heart className="w-3.5 h-3.5" />
                  Follow
                </button>
              )
            )}
            {org.isOwner && (
              <Link
                href={`/dashboard/${org.objectId}`}
                className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Stream Header */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-6 flex justify-between items-end border-b border-zinc-100">
        <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
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
                    <p className="text-[11px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      {plan.date} &bull; {plan.time}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-900 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: org.brandColor || "#18181b" }} />
                        Hosted by {plan.hostName}
                      </p>
                    </div>
                  </div>

                  <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                    {plan.description}
                  </p>

                  <div className="pt-2 flex flex-col gap-6">
                    <AvatarStack count={plan.attendeeCount} />
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => setSelectedEvent(plan)}
                        className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        View Details <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSharePlan(plan.id, plan.title)}
                        className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative"
                      >
                        {copiedPlanId === plan.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Plan Ideas Carousel */}
        {org.planIdeas.length > 0 && (
          <section className={`${org.plans.length > 0 ? "mt-48" : "mt-8"} mb-24 space-y-12`}>
            <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
              <div className="space-y-2">
                <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Be the Host
                </p>
                <h2 className="text-4xl font-light tracking-tight italic">
                  Pick a Plan, Make It Happen
                </h2>
              </div>
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
              {org.planIdeas.map((idea) => (
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
                        <span className="bg-white/90 px-6 py-3 text-[10px] tracking-[0.3em] uppercase font-bold shadow-xl flex items-center gap-2 text-zinc-400">
                          <Lock className="w-3.5 h-3.5" /> Host This
                        </span>
                      ) : (
                        <span className="bg-white px-6 py-3 text-[10px] tracking-[0.3em] uppercase font-bold shadow-xl">
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
              {/* Custom plan card — let community members propose their own */}
              {!org.rsvpLimitReached && (
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
                        <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-emerald-700">
                          Be the Host
                        </p>
                        <h4 className="text-lg font-medium tracking-tight text-zinc-900">
                          Propose Your Own Plan
                        </h4>
                        <p className="text-xs text-zinc-500 leading-relaxed font-light">
                          Have an idea for the community? Submit it and the organizer will review.
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
            </div>
          </section>
        )}
      </main>

      {/* Plan Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
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
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {selectedEvent.date} at {selectedEvent.time}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> {selectedEvent.attendeeCount} attending
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-xl font-light leading-relaxed text-zinc-600">
                  {selectedEvent.description}
                </p>
                {selectedEvent.hostNote && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      Note from Host
                    </h4>
                    <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-200 pl-3">
                      &ldquo;{selectedEvent.hostNote}&rdquo;
                    </p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      Location
                    </h4>
                    <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                    <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-zinc-100 flex flex-col gap-4">
                {org.rsvpLimitReached ? (
                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full bg-zinc-300 text-zinc-500 py-3 text-xs uppercase tracking-[0.2em] font-bold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" /> RSVPs Paused
                    </button>
                    <p className="text-xs text-zinc-400 text-center">
                      This calendar has reached its RSVP limit. Please contact the organization administrator.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setRsvpPlan(selectedEvent);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 text-white py-3 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: org.brandColor || "#18181b" }}
                    >
                      I&apos;m Attending
                    </button>
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                    </button>
                  </div>
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
          onRsvpSuccess={(planId, alreadyRsvpd) => {
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

      {/* Host Plan Idea Overlay */}
      {hostingIdea && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
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
                  <p className="text-zinc-400 uppercase tracking-widest text-[10px]">
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
                    <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
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
                                  <span className="text-[10px] text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 truncate mt-0.5">{venue.address}</p>
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
                      <PhoneVerifyFields verify={hostVerify} />
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <p className="text-[10px] text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
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
          <div className="bg-white w-full max-w-3xl md:h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-t-3xl md:rounded-none relative">
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
                  <p className="text-zinc-400 uppercase tracking-widest text-[10px]">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-emerald-700 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> Be the Host
                    </p>
                    <h3 className="text-3xl font-light italic">Propose a custom plan</h3>
                    <p className="text-zinc-500 font-light">
                      {org.isOwner || org.isHost
                        ? `Create a new plan for ${org.name}. It will go live immediately.`
                        : `Bring something new to ${org.name}. The organizer will review and approve.`}
                    </p>
                  </div>

                  <form onSubmit={handleCustomPlanSubmit} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                                  <span className="text-[10px] text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                                <p className="text-[10px] text-zinc-400 truncate mt-0.5">{venue.address}</p>
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
                        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                            <p className="text-[10px] text-zinc-400">
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
                        <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
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
                      <p className="text-[10px] text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>

                    {!(org.isOwner || org.isHost) && (
                      <PhoneVerifyFields verify={customVerify} />
                    )}

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
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
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
      <section className="py-10 px-6 border-t border-zinc-100 bg-zinc-50/60">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 mb-1">
              Powered by Leaf
            </p>
            <p className="text-sm text-zinc-600 font-light">
              Bring your own community together.
            </p>
          </div>
          <a
            href="https://www.os.joinleaf.com/organizations/setup"
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-zinc-800 transition-colors shrink-0"
          >
            Create Your Own Calendar <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <span className="text-xl font-light tracking-[0.3em] uppercase">
              {org.name}
            </span>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              {org.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
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
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
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
          onClose={() => setShowFollowModal(false)}
          onFollowed={() => {
            setIsFollowing(true);
            setFollowerCount((c) => c + 1);
            setShowFollowModal(false);
          }}
        />
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
                  href={`/dashboard/${org.objectId}?tab=calendars`}
                  className="bg-zinc-900 text-white px-6 py-3.5 text-xs uppercase tracking-[0.2em] font-bold text-center hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  Manage Calendar Settings <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShowWelcomeInvite(false)}
                  className="px-6 py-3 text-xs uppercase tracking-[0.2em] font-medium text-zinc-500 hover:text-zinc-900 text-center transition-colors"
                >
                  Skip and view my calendar
                </button>
              </div>
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
