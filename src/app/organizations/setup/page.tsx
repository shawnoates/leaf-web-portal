"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import {
  ArrowRight,
  Check,
  Sparkles,
  X,
  Loader2,
  MapPin,
  Copy,
} from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// --- Constants ---

const ORG_TYPES = [
  { value: "community", label: "Friends / Community", emoji: "\u{1F31F}" },
  { value: "apartment_complex", label: "Apartment Complex", emoji: "\u{1F3E2}" },
  { value: "gym", label: "Gym / Fitness", emoji: "\u{1F3CB}\u{FE0F}" },
  { value: "church", label: "Church", emoji: "⛪" },
  { value: "school", label: "School / University", emoji: "\u{1F393}" },
  { value: "company", label: "Company", emoji: "\u{1F3E2}" },
  { value: "brick_and_mortar", label: "Brick & Mortar", emoji: "\u{1F3EA}" },
  { value: "consumer_brand", label: "Consumer Brand", emoji: "\u{1F4E6}" },
  { value: "other", label: "Other", emoji: "\u{1F4CC}" },
];

const GENERATION_MESSAGES = [
  "Finding venues near you...",
  "Crafting plan ideas...",
  "Matching activities to your vibe...",
  "Picking the best times and places...",
  "Almost ready...",
];

const TIER_LABELS: Record<
  string,
  { name: string; monthly: string; yearly: string }
> = {
  growth: { name: "The Social", monthly: "$4.99/mo", yearly: "$49.99/yr" },
  pro: { name: "The Organizer", monthly: "$9.99/mo", yearly: "$99.99/yr" },
};

// --- Types ---

interface FormData {
  name: string;
  orgType: string;
  description: string;
  primaryCity: string;
  primaryCitySelected: boolean;
  primaryLat: number | null;
  primaryLng: number | null;
  tier: string;
}

// --- Main Page ---

export default function SetupPage() {
  return (
    <Suspense>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const searchParams = useSearchParams();
  // Tier picked on the marketing pricing page (?tier=growth|pro). Defaults to
  // "starter" so direct visits to /organizations/setup never accidentally enroll
  // the user in a paid plan. If a paid tier is requested, we create the org as
  // starter first, then redirect to Stripe Checkout to upgrade.
  const requestedTier = searchParams.get("tier");
  const initialTier =
    requestedTier === "growth" || requestedTier === "pro" ? requestedTier : "starter";
  const requestedBillingPeriod = searchParams.get("billingPeriod");
  const initialBillingPeriod: "monthly" | "yearly" =
    requestedBillingPeriod === "yearly" ? "yearly" : "monthly";

  // Building-claim flow: rep onboarded an apartment, RM clicks email link →
  // /claim/{token} → here. We prefill name + type and complete the claim
  // after the EventGroup is created.
  const claimToken = searchParams.get("claim");
  const [claimInfo, setClaimInfo] = useState<{
    leadId: string;
    buildingName: string;
    formattedAddress: string;
    rmEmail: string;
  } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: "",
    orgType: "",
    description: "",
    primaryCity: "",
    primaryCitySelected: false,
    primaryLat: null,
    primaryLng: null,
    tier: initialTier,
  });

  // Load claim info on mount + prefill form
  useEffect(() => {
    if (!claimToken) return;
    Parse.Cloud.run("validateBuildingClaimToken", { token: claimToken })
      .then(
        (r: {
          valid: boolean;
          reason?: string;
          alreadyClaimed?: boolean;
          leadId?: string;
          buildingName?: string;
          formattedAddress?: string;
          rmEmail?: string;
          linkedOrgCalendarId?: string | null;
        }) => {
          if (!r.valid) {
            setClaimError(
              r.reason === "token_expired"
                ? "This claim link has expired."
                : "This claim link isn't valid."
            );
            return;
          }
          if (r.alreadyClaimed && r.linkedOrgCalendarId) {
            // Already claimed — bounce to the calendar
            window.location.assign(`/dashboard/${r.linkedOrgCalendarId}`);
            return;
          }
          setClaimInfo({
            leadId: r.leadId || "",
            buildingName: r.buildingName || "",
            formattedAddress: r.formattedAddress || "",
            rmEmail: r.rmEmail || "",
          });
          setForm((prev) => ({
            ...prev,
            name: prev.name || `${r.buildingName} Resident Events`,
            orgType: prev.orgType || "apartment_complex",
            description:
              prev.description ||
              `A shared calendar for residents of ${r.buildingName} to organize and RSVP to building events.`,
          }));
        }
      )
      .catch((e: unknown) => {
        setClaimError(e instanceof Error ? e.message : "Couldn't validate claim link.");
      });
  }, [claimToken]);
  const [shareId, setShareId] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parseUser, setParseUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState("");

  const updateForm = (updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const canGenerate =
    form.name.trim() !== "" &&
    form.orgType !== "" &&
    form.primaryCitySelected &&
    form.description.trim() !== "";

  const tierInfo = TIER_LABELS[form.tier];
  const tierPrice = tierInfo
    ? initialBillingPeriod === "yearly"
      ? tierInfo.yearly
      : tierInfo.monthly
    : null;

  // Check for existing Parse session on mount
  useEffect(() => {
    try {
      const currentUser = Parse.User.current();
      if (currentUser) {
        currentUser.fetch().then((fetched: typeof Parse.User) => {
          setParseUser(fetched);
        }).catch(async () => {
          try { await Parse.User.logOut(); } catch { /* ignore */ }
        });
      }
    } catch { /* Parse not initialized */ }
  }, []);

  // Rotate generation status messages
  useEffect(() => {
    if (!submitting) return;
    const interval = setInterval(() => {
      setGenerationMessageIndex((prev) =>
        prev < GENERATION_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [submitting]);

  const startGeneration = useCallback(async () => {
    setShowAuthModal(false);
    setSubmitting(true);
    setSubmitError("");
    setGenerationMessageIndex(0);
    setStep(1);

    try {
      // Always create the org as the free Starter tier. If the user came from
      // the pricing page wanting Growth/Pro, we redirect them to Stripe Checkout
      // immediately after creation; the webhook bumps the tier on payment.
      const result = await Parse.Cloud.run("createOrganization", {
        name: form.name,
        orgType: form.orgType,
        description: form.description,
        primaryCity: form.primaryCity,
        primaryLat: form.primaryLat ?? undefined,
        primaryLng: form.primaryLng ?? undefined,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        maxEvents: 5,
        capacityLimit: 50,
        vibes: [],
        blacklistCategories: [],
        tier: "starter",
      });
      setShareId(result.shareId);
      setCalendarId(result.calendarId);
      setGenerationDone(true);

      // If this came from a building claim, link the lead to the new
      // calendar and fire the rep's $25 RM-click bonus.
      if (claimToken && claimInfo) {
        try {
          await Parse.Cloud.run("completeBuildingClaim", {
            token: claimToken,
            linkedOrgCalendarId: result.calendarId,
          });
        } catch (claimErr) {
          console.error("Building claim completion failed:", claimErr);
          // Don't block the user — calendar was created successfully
        }
      }

      // If a paid tier was requested, kick off Stripe Checkout
      if (form.tier === "growth" || form.tier === "pro") {
        setRedirectingToCheckout(true);
        try {
          const checkout = await Parse.Cloud.run("createOrgSubscriptionCheckout", {
            calendarId: result.calendarId,
            tier: form.tier,
            billingPeriod: initialBillingPeriod,
            returnUrl: `${window.location.origin}/dashboard/${result.calendarId}`,
          });
          if (checkout?.url) {
            window.location.href = checkout.url;
            return;
          }
        } catch (checkoutErr: unknown) {
          // Don't block the success state — the org exists, user can upgrade later
          console.error("Checkout redirect failed:", checkoutErr);
          setRedirectingToCheckout(false);
        }
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to create your calendar. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, initialBillingPeriod]);

  const handleGenerateClick = useCallback(() => {
    if (parseUser) {
      // Already signed in — go straight to generation
      startGeneration();
    } else {
      // Show auth modal
      setShowAuthModal(true);
    }
  }, [parseUser, startGeneration]);

  const handleSignIn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user: any) => {
      setParseUser(user);
      setAuthError("");
      // Auto-start generation after sign-in
      setShowAuthModal(false);
      setTimeout(() => startGeneration(), 100);
    },
    [startGeneration]
  );

  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(`os.joinleaf.com/org/${shareId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareId]);

  // --- Step 1: Generating / Success ---
  if (step === 1) {
    const headline = redirectingToCheckout
      ? "Heading to checkout..."
      : generationDone
        ? "Your calendar is live."
        : "Generating your calendar...";

    const subtext = redirectingToCheckout
      ? "Hang tight — Stripe is loading your payment page."
      : generationDone
        ? `${form.name} is ready to go.`
        : GENERATION_MESSAGES[generationMessageIndex];

    const showLoader = !generationDone || redirectingToCheckout;

    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-6 py-24">
          <div className="text-center space-y-10">
            {/* Visual */}
            <div className="flex justify-center">
              {showLoader ? (
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-zinc-100 animate-ping opacity-60" />
                  <div className="relative w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                    <Loader2 className="w-9 h-9 animate-spin text-zinc-500" />
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Check className="w-12 h-12 text-white" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* Copy */}
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-light tracking-tight">
                {generationDone && !redirectingToCheckout ? (
                  <>
                    Your calendar is{" "}
                    <span className="italic">live.</span>
                  </>
                ) : (
                  headline
                )}
              </h1>
              <p className="text-zinc-500 font-light text-lg transition-opacity">
                {subtext}
              </p>
            </div>

            {/* URL display */}
            {generationDone && !redirectingToCheckout && shareId && (
              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 space-y-3 text-left">
                <p className="text-[11px] tracking-wider uppercase font-semibold text-zinc-400">
                  Your calendar URL
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base sm:text-lg font-mono text-zinc-800 truncate">
                    os.joinleaf.com/org/{shareId}
                  </p>
                  <button
                    onClick={copyShareUrl}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm text-left rounded-xl">
                {submitError}
                <button
                  onClick={() => {
                    setStep(0);
                    setSubmitError("");
                  }}
                  className="block mt-2 underline text-red-600"
                >
                  Go back and try again
                </button>
              </div>
            )}

            {/* CTAs */}
            {generationDone && !redirectingToCheckout && (
              <div className="flex flex-col items-center gap-4 pt-2">
                <Link
                  href={`/org/${shareId}?welcome=1`}
                  className="inline-flex items-center gap-2 bg-zinc-900 text-white px-8 py-4 text-sm font-semibold rounded-full hover:bg-zinc-800 transition-colors"
                >
                  View your calendar <ArrowRight className="w-4 h-4" />
                </Link>
                {calendarId && (
                  <Link
                    href={`/dashboard/${calendarId}`}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 transition-colors"
                  >
                    Go to dashboard
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // Step 2 success (unused fallback — preserved for backward compatibility)
  if (step === 2) {
    return (
      <Shell>
        <div className="min-h-[80vh] flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center space-y-8">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-light tracking-tight">
                Your calendar is <span className="italic">live.</span>
              </h1>
              <p className="text-zinc-500 font-light text-lg">
                AI is generating your first plan ideas. They&apos;ll appear on your calendar shortly.
              </p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 space-y-2">
              <p className="text-[11px] tracking-wider uppercase font-semibold text-zinc-400">
                Your calendar URL
              </p>
              <p className="text-lg font-mono">
                os.joinleaf.com/org/{shareId}
              </p>
            </div>
            <div className="flex flex-col gap-3 items-center">
              <Link
                href={`/org/${shareId}?welcome=1`}
                className="bg-zinc-900 text-white px-8 py-4 text-sm font-semibold rounded-full hover:bg-zinc-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                View your calendar <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={copyShareUrl}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 transition-colors"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // --- Step 0: Form ---
  return (
    <Shell>
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="space-y-4 mb-12">
          <p className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">
            Calendar setup
          </p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight leading-[1.05]">
            Let&apos;s spin up{" "}
            <span className="italic">your calendar.</span>
          </h1>
          <p className="text-lg text-zinc-500 font-light leading-relaxed max-w-xl">
            Tell us a bit about it. We&apos;ll generate your first week of plan
            ideas in seconds.
          </p>
        </div>

        {/* Claim banner — when arriving from a rep's building lead */}
        {claimInfo && (
          <div className="mb-10 flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <Sparkles className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
            <div className="text-sm leading-relaxed">
              <span className="font-semibold text-emerald-900">
                Setting up a calendar for {claimInfo.buildingName}.
              </span>{" "}
              <span className="text-emerald-700">
                We&apos;ve prefilled some details — edit anything before
                generating.
              </span>
            </div>
          </div>
        )}
        {claimError && (
          <div className="mb-10 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
            {claimError}
          </div>
        )}

        {/* Tier banner */}
        {tierInfo && tierPrice && (
          <div className="mb-10 flex items-start gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <Sparkles className="w-4 h-4 mt-0.5 text-zinc-700 shrink-0" />
            <div className="text-sm leading-relaxed">
              <span className="font-semibold">
                You&apos;re starting with {tierInfo.name} ({tierPrice}).
              </span>{" "}
              <span className="text-zinc-500">
                We&apos;ll create your calendar first, then hand you off to
                secure checkout.
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-10">
          {/* Calendar Name */}
          <Field
            label="Calendar name"
            hint="What you'd call it in a group chat."
          >
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g., Sunday Suppers"
              className="w-full border-b border-zinc-300 pb-3 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
            />
          </Field>

          {/* Type */}
          <Field
            label="What kind of calendar is it?"
            hint="We use this to shape the plan ideas."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ORG_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateForm({ orgType: type.value })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    form.orgType === type.value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50/50"
                  }`}
                >
                  <span className="text-xl mb-1.5 block">{type.emoji}</span>
                  <span className="text-sm font-medium leading-tight">
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {/* Location — accepts city, neighborhood, or full address. The
              user picks the granularity that fits their community. We capture
              lat/lng either way so radius-based features (nearby deals,
              boost audience) work regardless of zoom level. */}
          <Field
            label="Location"
            icon={<MapPin className="w-3.5 h-3.5" />}
            hint="City, neighborhood, or building address — your choice."
          >
            <CityAutocomplete
              value={form.primaryCity}
              onChange={(val) =>
                updateForm({
                  primaryCity: val,
                  primaryCitySelected: false,
                  primaryLat: null,
                  primaryLng: null,
                })
              }
              onSelect={(place) =>
                updateForm({
                  primaryCity: place.description,
                  primaryCitySelected: true,
                  primaryLat: place.lat ?? null,
                  primaryLng: place.lng ?? null,
                })
              }
              placeholder="e.g., 123 Main St · Bed-Stuy · Austin, TX"
              className="w-full border-b border-zinc-300 pb-3 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
            />
          </Field>

          {/* Description */}
          <Field label="Tell us about it">
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Who's it for, what kind of plans you'd actually go to, anything that makes it yours..."
              rows={4}
              className="w-full border border-zinc-200 rounded-xl p-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none placeholder:text-zinc-300"
            />
          </Field>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-10 mt-12 border-t border-zinc-100">
          <p className="text-xs text-zinc-400">
            Free to start. No credit card required.
          </p>
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate}
            className={`px-8 py-4 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2 transition-colors ${
              canGenerate
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            }`}
          >
            Create Calendar <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAuthModal(false)}
          />
          <div className="relative bg-white max-w-[820px] w-full mx-4 shadow-2xl rounded-2xl overflow-hidden flex">
            {/* Left panel — visual */}
            <div className="hidden sm:flex w-[340px] shrink-0 bg-zinc-950 text-white flex-col justify-between p-10">
              <div className="flex items-center gap-3">
                <img src="/leaf-logo-white.svg" alt="Leaf" className="h-7" />
                <span className="text-lg font-light tracking-wider uppercase">OS</span>
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-light leading-snug">
                  Your calendar, <span className="italic">a tap away.</span>
                </h3>
                <div className="space-y-3">
                  {[
                    "AI-generated plan ideas",
                    "Phone-number RSVPs",
                    "A shareable calendar link",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-zinc-400" />
                      </div>
                      <p className="text-sm text-zinc-400 font-light">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Trusted by 1,800+ members across local organizations.
              </p>
            </div>

            {/* Right panel — sign in */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 py-12 relative">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-xs tracking-wider uppercase font-semibold text-zinc-400">
                    Almost there
                  </p>
                  <h3 className="text-3xl font-light tracking-tight">
                    Sign in to <span className="italic">launch.</span>
                  </h3>
                  <p className="text-sm text-zinc-500 font-light leading-relaxed">
                    We&apos;ll save your work and link the calendar to your account so you can manage plans and RSVPs.
                  </p>
                </div>

                <GoogleSignInButton
                  onSignIn={handleSignIn}
                  onError={(err) => setAuthError(err)}
                />

                {authError && (
                  <p className="text-sm text-red-600">{authError}</p>
                )}

                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    By signing in, you agree to our Terms of Service and Privacy Policy. We&apos;ll never post without your permission.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// --- Shared shell ---

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/personal" className="flex items-center gap-3">
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
            <span className="text-lg font-light tracking-wider uppercase">OS</span>
            <div className="h-4 w-px bg-zinc-200" />
            <span className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">
              Setup
            </span>
          </Link>
          <Link
            href="/personal"
            className="text-zinc-400 hover:text-zinc-900 transition-colors"
            aria-label="Close setup"
          >
            <X className="w-5 h-5" />
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}

// --- Small helper component for form fields ---

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <label className="text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
