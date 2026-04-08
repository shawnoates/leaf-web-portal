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
} from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// --- Constants ---

const ORG_TYPES = [
  { value: "church", label: "Church", emoji: "\u26ea" },
  { value: "gym", label: "Gym / Fitness", emoji: "\ud83c\udfcb\ufe0f" },
  { value: "company", label: "Company", emoji: "\ud83c\udfe2" },
  { value: "brick_and_mortar", label: "Brick & Mortar", emoji: "\ud83c\udfea" },
  { value: "community", label: "Community Group", emoji: "\ud83c\udf1f" },
  { value: "school", label: "School / University", emoji: "\ud83c\udf93" },
  { value: "consumer_brand", label: "Consumer Brand", emoji: "\ud83d\udce6" },
  { value: "other", label: "Other", emoji: "\ud83d\udccc" },
];

const TIERS = [
  {
    value: "starter",
    label: "Starter",
    price: "Free",
    features: ["1 city", "5 AI-generated plan ideas per week", "Up to 50 RSVPs", "Leaf-branded calendar page", "Phone Number RSVP"],
  },
  {
    value: "growth",
    label: "Growth",
    price: "$29/mo",
    features: ["1 city", "10 AI-generated plan ideas per week", "Up to 500 RSVPs per month", "Custom branded page", "Phone Number RSVP", "Blacklist categories", "Day-of-week preferences"],
  },
  {
    value: "pro",
    label: "Pro",
    price: "$99/mo",
    features: ["Up to 5 cities", "15 AI-generated plan ideas per week", "Unlimited RSVPs", "Custom branded page", "Phone Number RSVP", "Analytics dashboard", "On-demand plan generation"],
  },
];

const GENERATION_MESSAGES = [
  "Finding venues near your city...",
  "Crafting plan ideas for your community...",
  "Matching activities to your vibe...",
  "Picking the best times and places...",
  "Almost ready...",
];

// --- Types ---

interface FormData {
  name: string;
  orgType: string;
  description: string;
  primaryCity: string;
  primaryCitySelected: boolean;
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
  const initialTier = searchParams.get("tier") || "growth";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: "",
    orgType: "",
    description: "",
    primaryCity: "",
    primaryCitySelected: false,
    tier: initialTier,
  });
  const [shareId, setShareId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);
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

  // Check for existing Parse session on mount
  useEffect(() => {
    const currentUser = Parse.User.current();
    if (currentUser) {
      currentUser.fetch().then((fetched: typeof Parse.User) => {
        setParseUser(fetched);
      }).catch(async () => {
        try { await Parse.User.logOut(); } catch { /* ignore */ }
      });
    }
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
      const result = await Parse.Cloud.run("createOrganization", {
        name: form.name,
        orgType: form.orgType,
        description: form.description,
        primaryCity: form.primaryCity,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        maxEvents: 5,
        capacityLimit: 50,
        vibes: [],
        blacklistCategories: [],
        tier: form.tier,
      });
      setShareId(result.shareId);
      setGenerationDone(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to create organization. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [form]);

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

  // Step 2: Success
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="w-20 h-20 border-2 border-zinc-900 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-light tracking-tight">
              Your calendar is live!
            </h1>
            <p className="text-zinc-500 font-light text-lg">
              AI is generating your first plan ideas. They&apos;ll appear on your calendar shortly.
            </p>
          </div>
          <div className="bg-zinc-50 p-6 space-y-2">
            <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
              Your Calendar URL
            </p>
            <p className="text-lg font-mono">
              os.joinleaf.com/org/{shareId}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Link
              href={`/org/${shareId}`}
              className="bg-zinc-900 text-white px-8 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              View Your Calendar <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `os.joinleaf.com/org/${shareId}`
                )
              }
              className="border border-zinc-200 px-8 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-zinc-50 transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Generating + Pricing
  if (step === 1) {
    return (
      <div className="min-h-screen">
        <nav className="w-full bg-white border-b border-zinc-100 px-6 py-6">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <Link href="/organizations" className="flex items-center gap-3">
              <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
              <span className="text-lg font-light tracking-[0.2em] uppercase">OS</span>
              <div className="h-4 w-px bg-zinc-200" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
                Setup
              </span>
            </Link>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Generation Status */}
          <div className="text-center mb-16">
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              {generationDone ? (
                <div className="w-16 h-16 border-2 border-zinc-900 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
              ) : (
                <Loader2 className="w-12 h-12 animate-spin text-zinc-400" />
              )}
            </div>
            <h2 className="text-3xl font-light tracking-tight mb-3">
              {generationDone
                ? "Your calendar is ready!"
                : "Generating your calendar..."}
            </h2>
            <p className="text-zinc-500 font-light text-lg transition-opacity">
              {generationDone
                ? `Created calendar for ${form.name}`
                : GENERATION_MESSAGES[generationMessageIndex]}
            </p>
          </div>

          {/* Error */}
          {submitError && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 text-sm text-center">
              {submitError}
              <button
                onClick={() => {
                  setStep(0);
                  setSubmitError("");
                }}
                className="block mx-auto mt-2 underline text-red-600"
              >
                Go back and try again
              </button>
            </div>
          )}

          {/* Pricing Tiers */}
          <div className="space-y-4 mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-center text-zinc-400 mb-6">
              Choose your plan — you can always change later
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => updateForm({ tier: tier.value })}
                  className={`p-6 border text-left transition-all ${
                    form.tier === tier.value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-100 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs uppercase tracking-widest">
                      {tier.label}
                    </span>
                    {form.tier === tier.value && (
                      <div className="w-6 h-6 bg-zinc-900 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <span className="text-2xl font-light block mb-4">
                    {tier.price}
                  </span>
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="text-xs text-zinc-500 flex items-start gap-2"
                      >
                        <Check className="w-3 h-3 mt-0.5 shrink-0 text-zinc-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <div className="text-center pt-8">
            <button
              onClick={() => setStep(2)}
              disabled={!generationDone}
              className={`px-12 py-4 text-xs uppercase tracking-[0.3em] font-bold inline-flex items-center gap-2 transition-colors ${
                generationDone
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {generationDone ? (
                <>
                  View Your Calendar <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 0: Tell us about your community
  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="w-full bg-white border-b border-zinc-100 px-6 py-6">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <Link href="/organizations" className="flex items-center gap-3">
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
            <span className="text-lg font-light tracking-[0.2em] uppercase">OS</span>
            <div className="h-4 w-px bg-zinc-200" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
              Setup
            </span>
          </Link>
          <Link
            href="/organizations"
            className="text-zinc-400 hover:text-zinc-900"
          >
            <X className="w-5 h-5" />
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-10">
          <div>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              Tell us about your community
            </h2>
            <p className="text-zinc-500 font-light">
              We&apos;ll use this to generate personalized plan ideas for your calendar.
            </p>
          </div>

          <div className="space-y-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                Organization Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g., Yoga for Austin"
                className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Organization Type */}
            <div className="space-y-3">
              <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                Organization Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ORG_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateForm({ orgType: type.value })}
                    className={`p-4 border text-left transition-all ${
                      form.orgType === type.value
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-100 hover:border-zinc-300"
                    }`}
                  >
                    <span className="text-xl mb-1 block">{type.emoji}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.3em] uppercase font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                City
              </label>
              <CityAutocomplete
                value={form.primaryCity}
                onChange={(val) =>
                  updateForm({ primaryCity: val, primaryCitySelected: false })
                }
                onSelect={(place) =>
                  updateForm({
                    primaryCity: place.description,
                    primaryCitySelected: true,
                  })
                }
                placeholder="e.g., Austin, TX"
                className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Describe your community and the kind of gatherings you'd like..."
                rows={3}
                className="w-full border border-zinc-200 p-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end pt-12 mt-12 border-t border-zinc-100">
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate}
            className={`px-8 py-3.5 text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 transition-colors ${
              canGenerate
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
            }`}
          >
            Generate My First Plans <Sparkles className="w-4 h-4" />
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
          <div className="relative bg-white max-w-[820px] w-full mx-4 shadow-2xl overflow-hidden flex">
            {/* Left panel — visual */}
            <div className="hidden sm:flex w-[340px] shrink-0 bg-zinc-950 text-white flex-col justify-between p-10">
              <div className="flex items-center gap-3">
                <img src="/leaf-logo-white.svg" alt="Leaf" className="h-7" />
                <span className="text-lg font-light tracking-[0.2em] uppercase">OS</span>
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-light leading-snug">
                  Your AI-powered calendar awaits
                </h3>
                <div className="space-y-3">
                  {[
                    "AI-generated plan ideas",
                    "One-tap phone number RSVP",
                    "Shareable calendar link",
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
              <p className="text-[11px] text-zinc-600">
                Trusted by 1,800+ members across various local organizations
              </p>
            </div>

            {/* Right panel — sign in */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 py-12">
              {/* Close button */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                    Almost there
                  </p>
                  <h3 className="text-2xl font-light tracking-tight">
                    Sign in to create <br className="hidden sm:block" />
                    your calendar
                  </h3>
                  <p className="text-sm text-zinc-500 font-light leading-relaxed">
                    We&apos;ll link your account so you can manage plans, track RSVPs, and customize your page.
                  </p>
                </div>

                {/* Google Sign In */}
                <div>
                  <GoogleSignInButton
                    onSignIn={handleSignIn}
                    onError={(err) => setAuthError(err)}
                  />
                </div>

                {authError && (
                  <p className="text-sm text-red-600">
                    {authError}
                  </p>
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
    </div>
  );
}
