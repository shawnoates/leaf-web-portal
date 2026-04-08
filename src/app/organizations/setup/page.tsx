"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  MapPin,
  CalendarDays,
  Palette,
  CreditCard,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";

// --- Constants ---

const ORG_TYPES = [
  { value: "church", label: "Church", emoji: "\u26ea" },
  { value: "gym", label: "Gym / Fitness", emoji: "\ud83c\udfcb\ufe0f" },
  { value: "company", label: "Company", emoji: "\ud83c\udfe2" },
  { value: "community", label: "Community Group", emoji: "\ud83c\udf1f" },
  { value: "school", label: "School / University", emoji: "\ud83c\udf93" },
  { value: "other", label: "Other", emoji: "\ud83d\udccc" },
];

const VIBES = [
  "Food & Dining",
  "Nightlife & Social",
  "Activity & Fitness",
  "Arts & Culture",
  "Outdoor & Adventure",
  "Professional & Networking",
  "Learning & Workshops",
  "Gaming & Hobbies",
  "Wellness & Mindfulness",
  "Music & Entertainment",
];

const BLACKLIST_CATEGORIES = [
  { value: "bars", label: "Bars & Nightlife" },
  { value: "nightlife", label: "Clubs & Late Night" },
  { value: "fitness", label: "Fitness & Gyms" },
  { value: "restaurants", label: "Restaurants" },
  { value: "cafes", label: "Coffee & Cafes" },
  { value: "outdoors", label: "Outdoor Activities" },
  { value: "arts", label: "Arts & Museums" },
  { value: "sports", label: "Sports & Recreation" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const TIERS = [
  { value: "starter", label: "Starter", price: "Free" },
  { value: "growth", label: "Growth", price: "$29/mo" },
  { value: "pro", label: "Pro", price: "$99/mo" },
];

const STEPS = [
  { label: "Basics", icon: <Building2 className="w-4 h-4" /> },
  { label: "Location", icon: <MapPin className="w-4 h-4" /> },
  { label: "Schedule", icon: <CalendarDays className="w-4 h-4" /> },
  { label: "Preferences", icon: <Palette className="w-4 h-4" /> },
  { label: "Plan", icon: <CreditCard className="w-4 h-4" /> },
];

// --- Types ---

interface FormData {
  name: string;
  orgType: string;
  description: string;
  primaryCity: string;
  primaryCitySelected: boolean;
  additionalCities: string[];
  additionalCitiesSelected: boolean[];
  locationTypes: string[];
  daysOfWeek: number[];
  maxEvents: number;
  vibes: string[];
  capacityLimit: number;
  blacklistCategories: string[];
  brandColor: string;
  tier: string;
}

// --- Components ---

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: typeof STEPS;
}) {
  return (
    <div className="flex items-center gap-2 mb-12">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors ${
              i === currentStep
                ? "bg-zinc-900 text-white"
                : i < currentStep
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-300"
            }`}
          >
            {i < currentStep ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              step.icon
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-px ${i < currentStep ? "bg-zinc-900" : "bg-zinc-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
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
  const initialTier = searchParams.get("tier") || "starter";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: "",
    orgType: "",
    description: "",
    primaryCity: "",
    primaryCitySelected: false,
    additionalCities: [],
    additionalCitiesSelected: [],
    locationTypes: [],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    maxEvents: 5,
    vibes: [],
    capacityLimit: 50,
    blacklistCategories: [],
    brandColor: "#18181b",
    tier: initialTier,
  });
  const [complete, setComplete] = useState(false);
  const [shareId, setShareId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const updateForm = (updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const toggleArrayItem = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const canProceed = () => {
    if (submitting) return false;
    switch (step) {
      case 0:
        return form.name.trim() && form.orgType;
      case 1:
        return form.primaryCity.trim() && form.primaryCitySelected;
      case 2:
        return form.daysOfWeek.length > 0;
      case 3:
        return form.vibes.length > 0;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const cities = [form.primaryCity, ...form.additionalCities.filter(c => c.trim())];
      const result = await Parse.Cloud.run("createOrganization", {
        name: form.name,
        orgType: form.orgType,
        description: form.description,
        cities,
        daysOfWeek: form.daysOfWeek,
        maxEvents: form.maxEvents,
        capacityLimit: form.capacityLimit,
        vibes: form.vibes,
        blacklistCategories: form.blacklistCategories,
        brandColor: form.tier !== "starter" ? form.brandColor : undefined,
        tier: form.tier,
      });
      setShareId(result.shareId);
      setComplete(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create organization. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="w-20 h-20 border-2 border-zinc-900 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-light tracking-tight">
              You&apos;re all set!
            </h1>
            <p className="text-zinc-500 font-light text-lg">
              Your calendar is live and AI is generating your first plan ideas.
            </p>
          </div>
          <div className="bg-zinc-50 p-6 space-y-2">
            <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
              Your Calendar URL
            </p>
            <p className="text-lg font-mono">
              joinleaf.com/org/{shareId}
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
              onClick={() => navigator.clipboard.writeText(`joinleaf.com/org/${shareId}`)}
              className="border border-zinc-200 px-8 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-zinc-50 transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="w-full bg-white border-b border-zinc-100 px-6 py-6">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <Link href="/organizations" className="flex items-center gap-3">
            <span className="text-xl font-light tracking-[0.2em] uppercase">
              Leaf
            </span>
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
        <StepIndicator currentStep={step} steps={STEPS} />

        {/* Step 0: Basics */}
        {step === 0 && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-2">
                Tell us about your organization
              </h2>
              <p className="text-zinc-500 font-light">
                This helps us generate relevant plan ideas.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="e.g., Bridge Church"
                  className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Organization Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Describe your organization and the kind of community you're building..."
                  rows={3}
                  className="w-full border border-zinc-200 p-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-2">
                Where is your community?
              </h2>
              <p className="text-zinc-500 font-light">
                We&apos;ll find venues and create plans near your members.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Primary City
                </label>
                <CityAutocomplete
                  value={form.primaryCity}
                  onChange={(val) => updateForm({ primaryCity: val, primaryCitySelected: false })}
                  onSelect={(place) => updateForm({ primaryCity: place.description, primaryCitySelected: true })}
                  placeholder="e.g., Austin, TX"
                  className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              {form.tier === "pro" && (
                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                    Additional Cities{" "}
                    <span className="text-zinc-400">(Pro — up to 4 more)</span>
                  </label>
                  {form.additionalCities.map((city, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex-1">
                        <CityAutocomplete
                          value={city}
                          onChange={(val) => {
                            const updated = [...form.additionalCities];
                            const selectedUpdated = [...form.additionalCitiesSelected];
                            updated[i] = val;
                            selectedUpdated[i] = false;
                            updateForm({ additionalCities: updated, additionalCitiesSelected: selectedUpdated });
                          }}
                          onSelect={(place) => {
                            const updated = [...form.additionalCities];
                            const selectedUpdated = [...form.additionalCitiesSelected];
                            updated[i] = place.description;
                            selectedUpdated[i] = true;
                            updateForm({ additionalCities: updated, additionalCitiesSelected: selectedUpdated });
                          }}
                          placeholder="e.g., Brooklyn, NY"
                          className="w-full border-b border-zinc-200 py-3 text-base font-light focus:outline-none focus:border-zinc-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateForm({
                            additionalCities: form.additionalCities.filter((_, j) => j !== i),
                            additionalCitiesSelected: form.additionalCitiesSelected.filter((_, j) => j !== i),
                          })
                        }
                        className="text-zinc-400 hover:text-zinc-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {form.additionalCities.length < 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateForm({
                          additionalCities: [...form.additionalCities, ""],
                          additionalCitiesSelected: [...form.additionalCitiesSelected, false],
                        })
                      }
                      className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                    >
                      + Add another city
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-2">
                When should events happen?
              </h2>
              <p className="text-zinc-500 font-light">
                AI will only suggest plans on your preferred days.
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Preferred Days
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        updateForm({
                          daysOfWeek: toggleArrayItem(
                            form.daysOfWeek,
                            day.value
                          ),
                        })
                      }
                      className={`w-12 h-12 text-xs font-bold uppercase transition-all ${
                        form.daysOfWeek.includes(day.value)
                          ? "bg-zinc-900 text-white"
                          : "border border-zinc-200 text-zinc-400 hover:border-zinc-400"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Max Active Events at a Time
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={form.maxEvents}
                    onChange={(e) =>
                      updateForm({ maxEvents: parseInt(e.target.value) })
                    }
                    className="flex-1 accent-zinc-900"
                  />
                  <span className="text-2xl font-light w-12 text-right">
                    {form.maxEvents}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Default Capacity per Event
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={form.capacityLimit}
                    onChange={(e) =>
                      updateForm({ capacityLimit: parseInt(e.target.value) })
                    }
                    className="flex-1 accent-zinc-900"
                  />
                  <span className="text-2xl font-light w-12 text-right">
                    {form.capacityLimit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-2">
                What&apos;s your community&apos;s vibe?
              </h2>
              <p className="text-zinc-500 font-light">
                This drives what kind of plan ideas AI generates.
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Select Vibes{" "}
                  <span className="text-zinc-400">(pick 1-3)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {VIBES.map((vibe) => (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() =>
                        updateForm({
                          vibes:
                            form.vibes.length >= 3 && !form.vibes.includes(vibe)
                              ? form.vibes
                              : toggleArrayItem(form.vibes, vibe),
                        })
                      }
                      className={`p-4 border text-left text-sm transition-all ${
                        form.vibes.includes(vibe)
                          ? "border-zinc-900 bg-zinc-50 font-medium"
                          : "border-zinc-100 hover:border-zinc-300 font-light"
                      }`}
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Blacklist Categories{" "}
                  <span className="text-zinc-400">(types to avoid)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {BLACKLIST_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() =>
                        updateForm({
                          blacklistCategories: toggleArrayItem(
                            form.blacklistCategories,
                            cat.value
                          ),
                        })
                      }
                      className={`p-3 border text-left text-sm transition-all ${
                        form.blacklistCategories.includes(cat.value)
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-zinc-100 hover:border-zinc-300 text-zinc-600"
                      }`}
                    >
                      {form.blacklistCategories.includes(cat.value) && (
                        <X className="w-3 h-3 inline mr-1" />
                      )}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Plan Selection */}
        {step === 4 && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-2">
                Choose your plan
              </h2>
              <p className="text-zinc-500 font-light">
                You can always upgrade later.
              </p>
            </div>

            <div className="space-y-4">
              {TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => updateForm({ tier: tier.value })}
                  className={`w-full p-6 border text-left transition-all flex items-center justify-between ${
                    form.tier === tier.value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-100 hover:border-zinc-300"
                  }`}
                >
                  <div>
                    <span className="block font-bold text-xs uppercase tracking-widest mb-1">
                      {tier.label}
                    </span>
                    <span className="text-2xl font-light">{tier.price}</span>
                  </div>
                  {form.tier === tier.value && (
                    <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {(form.tier === "growth" || form.tier === "pro") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                    Brand Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.brandColor}
                      onChange={(e) =>
                        updateForm({ brandColor: e.target.value })
                      }
                      className="w-12 h-12 border border-zinc-200 cursor-pointer"
                    />
                    <span className="text-sm font-mono text-zinc-500">
                      {form.brandColor}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {submitError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            {submitError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-100">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              disabled={submitting}
              className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`px-8 py-3.5 text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 transition-colors ${
              canProceed()
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {step === STEPS.length - 1 ? "Create Calendar" : "Continue"}{" "}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
