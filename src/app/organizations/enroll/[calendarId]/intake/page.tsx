"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { Check, ChevronLeft } from "lucide-react";

/**
 * Concierge enrollment — Step 3 of 3: intake form.
 *
 * Six sections, save & continue per section, save & exit at any point.
 * Submits via `submitConciergeIntake` Cloud function which fires the
 * concierge_assigned transition and queues first menu curation.
 *
 * Reached after Stripe Checkout success returns the user here.
 */

type SectionId = "about" | "spaces" | "budget" | "vibe" | "members" | "wrap";

const SECTIONS: { id: SectionId; title: string; description: string }[] = [
  { id: "about", title: "About your building", description: "The basics so we can ground everything else." },
  { id: "spaces", title: "Spaces & logistics", description: "What's possible to run, and what's not." },
  { id: "budget", title: "Budget & autonomy", description: "How involved you want to be each month." },
  { id: "vibe", title: "Vibe & guardrails", description: "What lands at your building — and what doesn't." },
  { id: "members", title: "Members & branding", description: "How you reach members and how your building sounds." },
  { id: "wrap", title: "Last step", description: "Anything else, and a quick kickoff call." },
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
    budget: {},
    vibe: {},
    members: {},
    wrap: {},
  });
  const [completed, setCompleted] = useState<Set<SectionId>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ParseAny = Parse as any;

  // Load any prior partial intake on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cal = await new ParseAny.Query("Groups").get(calendarId);
        const intakeQ = new ParseAny.Query("ConciergeAccountIntake");
        intakeQ.equalTo("calendar", cal);
        const existing = await intakeQ.first();
        if (!mounted || !existing) return;
        const next: Record<SectionId, Values> = {
          about: {}, spaces: {}, budget: {}, vibe: {}, members: {}, wrap: {},
        };
        // We can't iterate Parse fields generically without a list — copy known ones lazily
        SECTIONS.forEach(({ id }) => {
          (next[id] as Record<string, unknown>)._loaded = true;
        });
        setValues(next);
        const sc = (existing.get("sectionsCompleted") as SectionId[]) || [];
        setCompleted(new Set(sc));
      } catch (err) {
        console.warn("[Concierge] intake prefetch failed:", err);
      }
    })();
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
        // Final step → submit
        await ParseAny.Cloud.run("submitConciergeIntake", { calendarId });
        router.push(`/dashboard/${calendarId}?concierge=welcome`);
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
        <Link
          href={`/dashboard/${calendarId}`}
          className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-900 mb-6"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Dashboard
        </Link>

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
              ? "Submit intake →"
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
            label="Building type"
            value={values.buildingType as string}
            onChange={(v) => onChange("buildingType", v)}
            options={[
              { value: "apartment", label: "Apartment" },
              { value: "condo", label: "Condo" },
              { value: "co_op", label: "Co-op" },
              { value: "congregation", label: "Religious / congregation" },
              { value: "community", label: "Community / club" },
              { value: "other", label: "Other" },
            ]}
          />
          <NumberField label="Unit count" value={values.unitCount as number} onChange={(v) => onChange("unitCount", v)} />
          <NumberField label="Estimated members" value={values.estimatedMembers as number} onChange={(v) => onChange("estimatedMembers", v)} />
        </div>
      );
    case "spaces":
      return (
        <div className="space-y-5">
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
        </div>
      );
    case "budget":
      return (
        <div className="space-y-5">
          <NumberField label="Budget ceiling per event ($)" value={values.budgetCeilingPerEvent as number} onChange={(v) => onChange("budgetCeilingPerEvent", v)} />
          <SelectField
            label="Cadence"
            value={values.cadencePreference as string}
            onChange={(v) => onChange("cadencePreference", v)}
            options={[
              { value: "one_signature", label: "One signature event per month" },
              { value: "two_smaller", label: "Two smaller events per month" },
              { value: "mix", label: "Mix" },
              { value: "let_host_decide", label: "Let Sara decide" },
            ]}
          />
          <SelectField
            label="How involved do you want to be?"
            value={values.autonomyMode as string}
            onChange={(v) => onChange("autonomyMode", v)}
            options={[
              { value: "approve", label: "I'll choose from the options each month" },
              { value: "veto_window", label: "Show me the plan — I'll speak up if I don't love it" },
              { value: "autopilot", label: "You decide; just keep me in the loop" },
            ]}
          />
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
          <SelectField
            label="Building voice"
            value={values.buildingVoice as string}
            onChange={(v) => onChange("buildingVoice", v)}
            options={[
              { value: "warm_casual", label: "Warm & casual" },
              { value: "polished_professional", label: "Polished & professional" },
              { value: "playful", label: "Playful" },
              { value: "neutral", label: "Neutral" },
            ]}
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
            After you submit, the Leaf team will reach out to schedule a 15-min kickoff call. Your first menu doesn&apos;t wait on it — Sara starts curating immediately.
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
