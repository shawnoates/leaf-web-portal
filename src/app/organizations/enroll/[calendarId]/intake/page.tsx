"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { Check } from "lucide-react";

/**
 * Concierge enrollment — Step 2 of 3: intake questions (before payment).
 *
 * Save & continue per section, save & exit at any point. The final step calls
 * `submitConciergeIntake` (saves answers only — no enrollment) then
 * `createConciergeCheckout` to send the owner to Stripe. Enrollment goes live
 * in the checkout webhook once payment clears.
 */

type SectionId = "about" | "spaces" | "vibe" | "members" | "wrap";

const SECTIONS: { id: SectionId; title: string; description: string }[] = [
  { id: "about", title: "About your community", description: "The basics so we can ground everything else." },
  { id: "spaces", title: "Spaces & logistics", description: "Where events happen, and what's possible to run." },
  { id: "vibe", title: "Vibe & guardrails", description: "What lands with your community — and what doesn't." },
  { id: "members", title: "Members & branding", description: "How you reach members and how your community sounds." },
  { id: "wrap", title: "Last step", description: "Anything else before we get started." },
];

type Values = Record<string, unknown>;

export default function ConciergeIntakePage({
  params,
}: {
  params: Promise<{ calendarId: string }>;
}) {
  const { calendarId } = use(params);
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<SectionId, Values>>({
    about: {},
    spaces: {},
    vibe: {},
    members: {},
    wrap: {},
  });
  const [completed, setCompleted] = useState<Set<SectionId>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ParseAny = Parse as any;

  // Prefill on mount: merges what's already saved with the rep-entered lead
  // and the owner's account, so we never re-ask what we already know.
  useEffect(() => {
    let mounted = true;
    ParseAny.Cloud.run("getConciergeIntakePrefill", { calendarId })
      .then((r: { values?: Record<SectionId, Values>; sectionsCompleted?: SectionId[] }) => {
        if (!mounted) return;
        const next: Record<SectionId, Values> = {
          about: {}, spaces: {}, vibe: {}, members: {}, wrap: {},
        };
        SECTIONS.forEach(({ id }) => {
          next[id] = { ...(r?.values?.[id] || {}) };
        });
        setValues(next);
        setCompleted(new Set(r?.sectionsCompleted || []));
      })
      .catch((err: unknown) => console.warn("[Concierge] intake prefill failed:", err));
    return () => { mounted = false; };
  }, [calendarId, ParseAny]);

  const currentSection = SECTIONS[stepIndex];

  const updateField = useCallback((section: SectionId, key: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }, []);

  const saveCurrentSection = useCallback(async () => {
    const section = currentSection.id;
    const sectionValues = { ...values[section] };
    // strip internal loader marker
    delete (sectionValues as Record<string, unknown>)._loaded;
    await ParseAny.Cloud.run("saveConciergeIntakeSection", {
      calendarId,
      section,
      values: sectionValues,
    });
    setCompleted((prev) => new Set(prev).add(section));
  }, [calendarId, currentSection.id, values, ParseAny]);

  const handleContinue = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveCurrentSection();
      if (stepIndex < SECTIONS.length - 1) {
        setStepIndex(stepIndex + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Final step → save answers, then head to payment (Stripe). Enrollment
        // only goes live once payment clears (checkout webhook).
        await ParseAny.Cloud.run("submitConciergeIntake", { calendarId });
        const result = await ParseAny.Cloud.run("createConciergeCheckout", {
          calendarId,
          billingPeriod: "monthly",
          returnUrl: typeof window !== "undefined"
            ? `${window.location.origin}/dashboard/${calendarId}?concierge=welcome`
            : undefined,
        });
        if (result?.url) window.location.href = result.url;
        else throw new Error("Checkout URL missing from response");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveExit = async () => {
    setBusy(true);
    try {
      await saveCurrentSection();
      router.push(`/dashboard/${calendarId}?concierge=intake_incomplete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Progress */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Section {stepIndex + 1} of {SECTIONS.length}
          </p>
          <button
            onClick={handleSaveExit}
            disabled={busy}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline disabled:opacity-50"
          >
            Save & exit
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-6 pb-3 flex gap-1">
          {SECTIONS.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-1 rounded-full ${
                i < stepIndex || completed.has(s.id)
                  ? "bg-zinc-900"
                  : i === stepIndex
                  ? "bg-zinc-700"
                  : "bg-zinc-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-light tracking-tight mb-2">
          {currentSection.title}
        </h1>
        <p className="text-sm text-zinc-500 mb-10">{currentSection.description}</p>

        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <SectionFields
            sectionId={currentSection.id}
            values={values[currentSection.id]}
            onChange={(k, v) => updateField(currentSection.id, k, v)}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 mt-4 text-center">{error}</div>
        )}

        <div className="flex gap-3 mt-8">
          {stepIndex > 0 && (
            <button
              onClick={() => setStepIndex(stepIndex - 1)}
              disabled={busy}
              className="px-6 py-3 text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleContinue}
            disabled={busy}
            className="flex-1 bg-zinc-900 text-white font-semibold py-3 rounded-full hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy
              ? "Saving…"
              : stepIndex === SECTIONS.length - 1
              ? "Continue to payment →"
              : "Save & continue →"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Per-section field renderers — kept inline for readability of the funnel
// ---------------------------------------------------------------------------

interface FieldsProps {
  sectionId: SectionId;
  values: Values;
  onChange: (key: string, value: unknown) => void;
}

function SectionFields({ sectionId, values, onChange }: FieldsProps) {
  switch (sectionId) {
    case "about":
      return (
        <div className="space-y-5">
          <TextField label="Contact name" value={values.contactName as string} onChange={(v) => onChange("contactName", v)} />
          <TextField label="Contact email" type="email" value={values.contactEmail as string} onChange={(v) => onChange("contactEmail", v)} />
          <TextField label="Contact phone" value={values.contactPhone as string} onChange={(v) => onChange("contactPhone", v)} />
          <SelectField
            label="Community type"
            value={values.buildingType as string}
            onChange={(v) => onChange("buildingType", v)}
            options={[
              { value: "apartment", label: "Apartment complex" },
              { value: "condo", label: "Condo" },
              { value: "co_op", label: "Co-op" },
              { value: "congregation", label: "Religious / congregation" },
              { value: "community", label: "Community / club" },
              { value: "other", label: "Other" },
            ]}
          />
          {values.buildingType === "apartment" && (
            <NumberField label="Unit count" value={values.unitCount as number} onChange={(v) => onChange("unitCount", v)} />
          )}
          <NumberField label="Estimated members" value={values.estimatedMembers as number} onChange={(v) => onChange("estimatedMembers", v)} />
        </div>
      );
    case "spaces":
      return (
        <div className="space-y-5">
          <SelectField
            label="Where do events happen?"
            value={values.venueMode as string}
            onChange={(v) => onChange("venueMode", v)}
            options={[
              { value: "on_premise", label: "At our own spaces (on-site)" },
              { value: "off_premise", label: "At outside venues (off-site)" },
              { value: "mixed", label: "A mix of both" },
            ]}
          />
          {values.venueMode === "off_premise" ? (
            <p className="text-xs text-zinc-500 leading-relaxed">
              Since your events are off-site, we&apos;ll handle venue sourcing — nothing else needed here.
            </p>
          ) : values.venueMode ? (
            <>
              <ChipMultiField
                label="Available spaces"
                value={(values.availableSpaces as string[]) || []}
                onChange={(v) => onChange("availableSpaces", v)}
                options={["rooftop", "indoor_lounge", "courtyard", "gym", "lobby", "co_working", "pool_deck", "other"]}
              />
              <NumberField label="Largest space capacity" value={values.largestSpaceCapacity as number} onChange={(v) => onChange("largestSpaceCapacity", v)} />
              <SelectField
                label="Outdoor capability"
                value={values.outdoorCapability as string}
                onChange={(v) => onChange("outdoorCapability", v)}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "seasonal", label: "Seasonal" },
                  { value: "no", label: "No" },
                ]}
              />
              <TextField label="Access window" placeholder="e.g. weekdays after 6pm, weekends 10am–10pm" value={values.accessWindow as string} onChange={(v) => onChange("accessWindow", v)} />
              <ToggleField label="COI required for vendors" value={values.coiRequired as boolean} onChange={(v) => onChange("coiRequired", v)} />
            </>
          ) : null}
        </div>
      );
    case "vibe":
      return (
        <div className="space-y-5">
          <SelectField
            label="Vibe"
            value={values.vibePreference as string}
            onChange={(v) => onChange("vibePreference", v)}
            options={[
              { value: "small_intimate", label: "Small & intimate" },
              { value: "big_mixer", label: "Big mixer" },
              { value: "either", label: "Either works" },
            ]}
          />
          <ChipMultiField
            label="Categories you're drawn to"
            value={(values.categoriesDrawnTo as string[]) || []}
            onChange={(v) => onChange("categoriesDrawnTo", v)}
            options={["happy_hour", "fitness", "food_tasting", "family_kids", "games_trivia", "crafts_diy", "wellness", "professional", "seasonal", "outdoor", "pet", "movie_night", "music_live"]}
          />
          <ChipMultiField
            label="Categories to avoid"
            value={(values.categoriesToAvoid as string[]) || []}
            onChange={(v) => onChange("categoriesToAvoid", v)}
            options={["happy_hour", "fitness", "food_tasting", "family_kids", "games_trivia", "crafts_diy", "wellness", "professional", "seasonal", "outdoor", "pet", "movie_night", "music_live"]}
          />
          <TextField multiline label="What's worked here before?" value={values.pastEventWins as string} onChange={(v) => onChange("pastEventWins", v)} />
          <TextField multiline label="Anything that fell flat?" value={values.pastEventFlops as string} onChange={(v) => onChange("pastEventFlops", v)} />
        </div>
      );
    case "members":
      return (
        <div className="space-y-5">
          <SelectField
            label="Prior event frequency"
            value={values.priorEventFrequency as string}
            onChange={(v) => onChange("priorEventFrequency", v)}
            options={[
              { value: "never", label: "Never" },
              { value: "once_or_twice_a_year", label: "Once or twice a year" },
              { value: "quarterly", label: "Quarterly" },
              { value: "monthly", label: "Monthly" },
              { value: "more_than_monthly", label: "More than monthly" },
            ]}
          />
          <ChipMultiField
            label="How do you reach members?"
            value={(values.memberCommsChannels as string[]) || []}
            onChange={(v) => onChange("memberCommsChannels", v)}
            options={["email_list", "building_app", "printed_flyers", "text_blast", "word_of_mouth"]}
          />
          <ToggleField
            label="OK to photograph members at events for recaps/marketing?"
            value={values.photoConsentDefault as boolean}
            onChange={(v) => onChange("photoConsentDefault", v)}
          />
        </div>
      );
    case "wrap":
      return (
        <div className="space-y-5">
          <TextField
            multiline
            label="Anything else we should know?"
            value={values.anythingElse as string}
            onChange={(v) => onChange("anythingElse", v)}
          />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Once payment&apos;s set up, your concierge starts curating your first month&apos;s options right away — no call required. You can reach them anytime in Messages.
          </p>
        </div>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

function TextField({
  label, value, onChange, type = "text", placeholder, multiline,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-700 mb-1.5 block">{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      )}
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-700 mb-1.5 block">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-700 mb-1.5 block">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-zinc-900"
      />
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  );
}

function ChipMultiField({
  label, value, onChange, options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div>
      <span className="text-xs font-medium text-zinc-700 mb-2 block">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                active
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
              }`}
            >
              {active && <Check className="w-3 h-3 inline mr-1" />}
              {opt.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
