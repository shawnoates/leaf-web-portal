"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Loader2, MapPin, Pencil, RefreshCw, Sparkles, Square, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import CityAutocomplete from "@/components/CityAutocomplete";
import { ORG_TYPES } from "@/lib/orgTypes";

// Create-calendar modal with two ways in: describe it (prompt → form is
// filled for review) or set it up manually (the original form). Both end
// at the same form and the same "Create calendar" button, so there is one
// submit path — createCalendarUnderOrg — exactly as before.
//
// The prompt path previews starters with generateAICalendar, and the preview
// is a promise: the template's id goes to createCalendarUnderOrg as
// starterCalendarId (with the rows the owner removed), and the server attaches
// that exact template instead of generating again. A server that predates
// starterCalendarId ignores it and re-runs generateAICalendar with the
// DESCRIPTION as the prompt — which is why Generate seeds the description
// with the prompt: same prompt + city + cohortSpread is a cache hit on the
// template shown here.

interface StarterEvent {
  title?: string;
  name: string;
  time: string;
  venueLine?: string;
}

interface GenerateResponse {
  ok: boolean;
  reason?: string;
  calendar: { objectId: string; title: string; events: StarterEvent[] } | null;
}

interface Props {
  organizationId: string;
  /** Parent org's category — what a blank Category inherits server-side. */
  parentOrgType?: string | null;
  onClose: () => void;
  onCreated: (calendarId?: string) => void;
}

const EXAMPLE_PROMPTS = [
  "Sunday runs in Prospect Park",
  "Date night in Fort Greene",
  "Thursday happy hour",
  "Family fun this month",
];

// Mirrors COHORT_ROTATION_EXCLUDED_ORG_TYPES in the server's
// audience-cohorts.js. createCalendarUnderOrg derives cohortSpread from the
// calendar's effective orgType; the preview has to send the same value or it
// lands in a different cache namespace and the created calendar gets a
// different slate than the one shown here.
const NO_COHORT_ORG_TYPES = ["school", "gym", "company", "brick_and_mortar"];

// The server skips the starter seed for descriptions shorter than this.
const MIN_PROMPT_LENGTH = 6;
const REVEAL_INTERVAL_MS = 260;

const LABEL = "text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 block";
const FIELD = "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900";
const SHIMMER = "rounded-md bg-[linear-gradient(90deg,#f0f0f1_0%,#e2e2e5_40%,#f0f0f1_80%)] bg-[length:200%_100%] animate-[leafShimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none";

function failureCopy(reason: string | undefined): string {
  switch (reason) {
    case "prompt_not_meaningful":
      return "We couldn't tell what that calendar is for. Add a little more detail — an activity and a place work best.";
    case "no_events_found":
    case "thin_result":
      return "We couldn't find enough real spots for that. Try a broader prompt or a different location, or fill in the details yourself.";
    default:
      return "Couldn't draft that one. Try again, or fill in the details yourself.";
  }
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative w-[38px] h-[22px] rounded-full transition-colors shrink-0 ${on ? "bg-zinc-900" : "bg-zinc-200"}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

function FromPromptTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-leaf-700">
      <Sparkles className="w-3 h-3" />
      From prompt
    </span>
  );
}

export default function CreateCalendarModal({ organizationId, parentOrgType, onClose, onCreated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [city, setCity] = useState("");
  const [citySelected, setCitySelected] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  // Empty = inherit the parent org's type (see createCalendarUnderOrg).
  const [orgType, setOrgType] = useState("");
  const [suggestStarters, setSuggestStarters] = useState(true);
  const [hideDeals, setHideDeals] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StarterEvent[]>([]);
  const [revealed, setRevealed] = useState(0);
  // The template behind the current preview and where it was generated for.
  // A preview for another location is stale: its venues are in the wrong place.
  const [preview, setPreview] = useState<{ calendarId: string; city: string } | null>(null);
  // Positions in `events` the owner removed. Indexes, because that is how the
  // server addresses the template's array (see excludedStarterIndexes).
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  // A field stays "from prompt" until the owner edits it; Regenerate only
  // overwrites fields that are still flagged (or empty).
  const [nameFromPrompt, setNameFromPrompt] = useState(false);
  const [descFromPrompt, setDescFromPrompt] = useState(false);
  const [locationNeeded, setLocationNeeded] = useState(false);
  const [creating, setCreating] = useState(false);

  // Bumped on Stop / Regenerate / unmount so a late response is dropped.
  const runRef = useRef(0);
  const locationRef = useRef<HTMLDivElement>(null);
  const startersRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { runRef.current += 1; }, []);

  // Generation answers in one response, so the one-by-one arrival is a
  // staggered reveal of rows we already hold.
  const revealing = phase === "done" && revealed < events.length;
  useEffect(() => {
    if (!revealing) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(
      () => setRevealed((n) => (reduceMotion ? events.length : n + 1)),
      REVEAL_INTERVAL_MS,
    );
    return () => window.clearTimeout(t);
  }, [revealing, revealed, events.length]);

  const generating = phase === "generating";
  const busy = generating || revealing;
  const hasPreview = phase === "done" && events.length > 0;
  const previewStale = hasPreview && !!preview && city !== preview.city;
  const canCreate = !!name && citySelected && !creating && !busy;

  function focusLocation() {
    setDetailsOpen(true);
    // Wait for the details section to mount before reaching for its input.
    window.setTimeout(() => {
      locationRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      locationRef.current?.querySelector("input")?.focus();
    }, 60);
  }

  async function handleGenerate() {
    const text = prompt.trim();
    if (text.length < MIN_PROMPT_LENGTH || generating) return;
    // Real venues need a real place, and creation requires one anyway — ask
    // for it up front instead of failing after the wait.
    if (!citySelected) {
      setLocationNeeded(true);
      focusLocation();
      return;
    }
    const run = ++runRef.current;
    setPhase("generating");
    setError(null);
    setEvents([]);
    setRevealed(0);
    setRemoved(new Set());
    setPreview(null);
    setDetailsOpen(true);
    // The form is taller than the modal, so bring the rows that are about to
    // shimmer into view — otherwise the wait happens below the fold.
    window.setTimeout(() => startersRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
    try {
      const effectiveOrgType = (orgType || parentOrgType || "").trim().toLowerCase();
      const result = (await Parse.Cloud.run("generateAICalendar", {
        prompt: text,
        originCity: city,
        originLat: lat ?? undefined,
        originLng: lng ?? undefined,
        cohortSpread: !NO_COHORT_ORG_TYPES.includes(effectiveOrgType),
      })) as GenerateResponse;
      if (run !== runRef.current) return;
      if (!result.ok || !result.calendar) {
        setError(failureCopy(result.reason));
        setPhase("error");
        if (!desc.trim()) setDesc(text);
        return;
      }
      if (!name.trim() || nameFromPrompt) {
        setName(result.calendar.title);
        setNameFromPrompt(true);
      }
      // Seeded with the owner's own words, not generated copy: on a server
      // without starterCalendarId the description is the starter prompt (see
      // the header), and the template carries no description to offer anyway.
      if (!desc.trim() || descFromPrompt) {
        setDesc(text);
        setDescFromPrompt(true);
      }
      setEvents(result.calendar.events || []);
      setPreview({ calendarId: result.calendar.objectId, city });
      setPhase("done");
    } catch (err: unknown) {
      if (run !== runRef.current) return;
      setError(err instanceof Error && err.message ? err.message : failureCopy(undefined));
      setPhase("error");
    }
  }

  function handleStop() {
    runRef.current += 1;
    setPhase("idle");
  }

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const params: Record<string, string | number | boolean | number[]> = {
        organizationId,
        name,
        description: desc,
        city,
      };
      if (lat != null && lng != null) {
        params.lat = lat;
        params.lng = lng;
      }
      if (hideDeals) params.hideDeals = true;
      // Only send suggestStarters when toggled off — server defaults to
      // true, so the wire stays minimal on the happy path.
      if (!suggestStarters) params.suggestStarters = false;
      // Omitted when blank so the server falls back to inheriting the parent
      // org's type rather than writing an untyped calendar — every type-aware
      // rule downstream keys off orgType.
      // Hand over the previewed template so the calendar gets the plans shown
      // here, minus the removed ones. Withheld when stale — the server then
      // generates from the description for the new location.
      if (suggestStarters && hasPreview && preview && !previewStale) {
        params.starterCalendarId = preview.calendarId;
        if (removed.size) params.excludedStarterIndexes = [...removed];
      }
      const created = (await Parse.Cloud.run("createCalendarUnderOrg", params)) as
        | { calendarId?: string }
        | undefined;
      onCreated(created?.calendarId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add calendar");
    } finally {
      setCreating(false);
    }
  }

  const promptReady = prompt.trim().length >= MIN_PROMPT_LENGTH;
  // Once the form is open the dark button belongs to "Create calendar";
  // the prompt's action steps down to secondary so they don't compete.
  const generateIsPrimary = !detailsOpen && phase === "idle";
  const generateLabel = phase === "done" || phase === "error" ? "Regenerate" : detailsOpen ? "Fill from prompt" : "Generate";
  const shownCount = Math.min(revealed, events.length);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-calendar-title"
        aria-busy={busy}
        className="bg-white w-full max-w-[640px] max-h-[92dvh] md:max-h-[85vh] rounded-t-[20px] md:rounded-[20px] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 md:px-10 pt-6 md:pt-8 pb-4">
          <div>
            <h2 id="create-calendar-title" className="text-[19px] md:text-[22px] font-semibold tracking-tight">Create calendar</h2>
            <p className="text-[13px] md:text-sm text-zinc-500 mt-1">
              Describe it and we&rsquo;ll set it up &mdash; or fill in the details yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 -mt-1 shrink-0 rounded-full flex items-center justify-center hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrolling body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-10 pb-6 space-y-5">
          {/* Prompt */}
          <div className="space-y-3">
            <div
              className={`rounded-[18px] border p-3.5 md:pl-5 transition-colors ${
                generateIsPrimary ? "border-zinc-900 shadow-[0_14px_44px_rgba(0,0,0,0.08)]" : "border-zinc-300"
              }`}
            >
              <label htmlFor="create-calendar-prompt" className="sr-only">Describe your calendar</label>
              <textarea
                id="create-calendar-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                rows={detailsOpen ? 2 : 3}
                disabled={generating}
                placeholder="Try “Sunday runs in Prospect Park for new parents”"
                className="w-full resize-none border-0 bg-transparent p-0 text-base md:text-[17px] leading-snug placeholder:text-zinc-400 focus:outline-none disabled:text-zinc-500"
              />
              <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={focusLocation}
                    className={`h-9 max-w-[180px] px-3 inline-flex items-center gap-1.5 rounded-full border text-[13px] ${
                      citySelected
                        ? "border-leaf-200 bg-leaf-50 text-leaf-800"
                        : locationNeeded
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-zinc-300 text-zinc-700 hover:border-zinc-900"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{citySelected ? city : "Add location"}</span>
                  </button>
                  <div className="relative">
                    <select
                      aria-label="Category"
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className="h-9 appearance-none rounded-full border border-zinc-300 bg-white pl-3 pr-7 text-[13px] text-zinc-700 hover:border-zinc-900 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="">Category: Auto</option>
                      {ORG_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>
                {generating ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full border border-zinc-300 text-[13px] font-medium hover:border-zinc-900"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!promptReady || revealing}
                    className={`h-11 inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full font-medium transition-colors disabled:opacity-40 ${
                      generateIsPrimary
                        ? "px-5 bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800"
                        : "px-4 border border-zinc-300 text-[13px] hover:border-zinc-900"
                    }`}
                  >
                    {phase === "done" || phase === "error" ? <RefreshCw className="w-3.5 h-3.5" /> : null}
                    {generateLabel}
                    {generateIsPrimary ? <ArrowRight className="w-3.5 h-3.5" /> : null}
                  </button>
                )}
              </div>
            </div>
            {!detailsOpen && (
              <div className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar md:mx-0 md:px-0 md:flex-wrap">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    // Fills rather than submits (unlike the marketing chips):
                    // a calendar here still needs a location and a review.
                    onClick={() => setPrompt(example)}
                    className="shrink-0 rounded-full border border-zinc-200 px-3.5 py-[7px] text-[13px] text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generation status */}
          {phase !== "idle" && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl px-3.5 py-3 ${phase === "error" ? "bg-amber-50 text-amber-900" : "bg-leaf-50 text-leaf-800"}`}
            >
              <div className="flex items-center gap-2.5 text-[13px]">
                {phase === "error" ? null : busy ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-leaf-700" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0 text-leaf-700" />
                )}
                <span className="flex-1">
                  {phase === "error"
                    ? error
                    : busy
                      ? `Drafting starter plans for ${city.split(",")[0]}…`
                      : "Filled in from your prompt. Review and edit anything, then create."}
                </span>
                {revealing && (
                  <span className="shrink-0 text-xs font-medium text-leaf-700">
                    {shownCount} of {events.length} plans
                  </span>
                )}
              </div>
              {busy && (
                <div className="mt-2.5 h-1 rounded-full bg-leaf-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#426c5e_0%,#74a494_50%,#426c5e_100%)] bg-[length:200%_100%] animate-[leafShimmer_1.6s_linear_infinite] motion-reduce:animate-none transition-[width] duration-500"
                    // The request gives no progress signal, so the bar holds
                    // at a third while waiting and only counts real rows.
                    style={{ width: generating ? "33%" : `${33 + (shownCount / Math.max(events.length, 1)) * 67}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Manual setup */}
          {!detailsOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">or</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setDetailsOpen(true)}
                className="w-full min-h-16 px-4 py-3 flex items-center gap-3.5 rounded-[14px] border border-zinc-200 bg-zinc-50 text-left hover:border-zinc-400"
              >
                <span className="w-9 h-9 shrink-0 rounded-[10px] border border-zinc-200 bg-white flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">Set up manually</span>
                  <span className="block text-[13px] text-zinc-500">Name, description, location and category</span>
                </span>
                <ChevronDown className="w-[18px] h-[18px] text-zinc-600" />
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="create-calendar-name" className={LABEL}>Name</label>
                  {nameFromPrompt && <FromPromptTag />}
                </div>
                {generating && (!name.trim() || nameFromPrompt) ? (
                  <div className={`h-[42px] ${SHIMMER}`} aria-hidden="true" />
                ) : (
                  <input
                    id="create-calendar-name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setNameFromPrompt(false); }}
                    className={`${FIELD} ${nameFromPrompt ? "border-leaf-200 bg-leaf-50" : "border-zinc-200"}`}
                    placeholder="Calendar name"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="create-calendar-desc" className={LABEL}>Description</label>
                  {descFromPrompt && <FromPromptTag />}
                </div>
                <textarea
                  id="create-calendar-desc"
                  value={desc}
                  onChange={(e) => { setDesc(e.target.value); setDescFromPrompt(false); }}
                  rows={2}
                  className={`${FIELD} p-3 resize-y ${descFromPrompt ? "border-leaf-200 bg-leaf-50" : "border-zinc-200"}`}
                  placeholder={suggestStarters
                    ? "Describe the vibe — e.g., date night ideas in Fort Greene"
                    : "What is this calendar about?"}
                />
                {suggestStarters && (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    We&rsquo;ll use this to suggest a few starter plans.
                  </p>
                )}
              </div>
              <div ref={locationRef}>
                <label className={`${LABEL} mb-1.5`}>
                  Location <span className="text-red-700">*</span>
                </label>
                <CityAutocomplete
                  value={city}
                  onChange={(v) => { setCity(v); setCitySelected(false); setLat(null); setLng(null); }}
                  onSelect={(place) => {
                    setCity(place.description);
                    setCitySelected(true);
                    setLocationNeeded(false);
                    if (place.lat != null && place.lng != null) {
                      setLat(place.lat);
                      setLng(place.lng);
                    }
                  }}
                  placeholder="City, neighborhood, or building address"
                  className={`${FIELD} ${locationNeeded && !citySelected ? "border-red-300" : "border-zinc-200"}`}
                />
                {/* CityAutocomplete shows its own "select from the suggestions"
                    warning once there is text, so ours only covers the empty field. */}
                <p className={`text-[11px] mt-1 ${locationNeeded && !city ? "text-red-700" : "text-zinc-500"}`}>
                  {locationNeeded && !city
                    ? "Pick a location so we can find real spots nearby."
                    : "More specific = more accurate nearby-deal matching."}
                </p>
              </div>
              <div>
                <label htmlFor="create-calendar-category" className={`${LABEL} mb-1.5`}>Category</label>
                <select
                  id="create-calendar-category"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className={`${FIELD} border-zinc-200 bg-white`}
                >
                  <option value="">Same as organization</option>
                  {ORG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.emoji} {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Shapes the plan suggestions. Leave as-is to match your organization.
                </p>
              </div>

              {/* Starter plans */}
              <div ref={startersRef}>
                <div className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Suggest starter plans</p>
                    <p className="text-xs text-zinc-500">Seed the calendar with a few AI-suggested plans your members can host. Off hides suggested and featured plans on this calendar.</p>
                  </div>
                  <Toggle on={suggestStarters} onChange={() => setSuggestStarters(!suggestStarters)} label="Suggest starter plans" />
                </div>
                {suggestStarters && (generating || hasPreview) && (
                  <div className="mt-1">
                    <ul className="rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                      {generating &&
                        ["w-[55%]", "w-[42%]", "w-[60%]"].map((w) => (
                          <li key={w} aria-hidden="true" className="min-h-[52px] px-4 flex items-center gap-3">
                            <div className={`h-3 ${w} ${SHIMMER}`} />
                            <div className="flex-1" />
                            <div className={`h-3 w-16 ${SHIMMER}`} />
                          </li>
                        ))}
                      {!generating &&
                        events.map((event, i) =>
                          removed.has(i) ? null : i < shownCount ? (
                            <li
                              key={`${event.name}-${i}`}
                              className="min-h-[52px] pl-4 pr-2 py-2 flex items-center gap-3 animate-[slideUp_320ms_ease-out_both] motion-reduce:animate-none"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{event.title || event.name}</p>
                                {event.title && <p className="text-xs text-zinc-500 truncate">{event.name}</p>}
                              </div>
                              <span className="shrink-0 text-[13px] text-zinc-500">{event.time}</span>
                              <button
                                type="button"
                                onClick={() => setRemoved((prev) => new Set(prev).add(i))}
                                aria-label={`Remove ${event.title || event.name}`}
                                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </li>
                          ) : (
                            <li key={`pending-${i}`} aria-hidden="true" className="min-h-[52px] px-4 flex items-center gap-3">
                              <div className={`h-3 w-1/2 ${SHIMMER}`} />
                              <div className="flex-1" />
                              <div className={`h-3 w-16 ${SHIMMER}`} />
                            </li>
                          ),
                        )}
                      {hasPreview && removed.size === events.length && (
                        <li className="min-h-[52px] px-4 flex items-center text-[13px] text-zinc-500">
                          All starter plans removed. The calendar will start empty.
                        </li>
                      )}
                    </ul>
                    {hasPreview && !revealing && (
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        {previewStale
                          ? "These were drafted for a different location, so the calendar will get a fresh set. Regenerate to preview it."
                          : "Members see these as suggested plans they can host."}
                        {removed.size > 0 && !previewStale && (
                          <>
                            {" "}{removed.size} removed.{" "}
                            <button type="button" onClick={() => setRemoved(new Set())} className="underline underline-offset-2 hover:text-zinc-900">
                              Restore
                            </button>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">Show local deals</p>
                  <p className="text-xs text-zinc-500">Surface a strip of deals from nearby businesses</p>
                </div>
                <Toggle on={!hideDeals} onChange={() => setHideDeals(!hideDeals)} label="Show local deals" />
              </div>
            </div>
          )}
        </div>

        {/* Footer — only once the form is showing, so the first screen has a
            single primary action (Generate). */}
        {detailsOpen && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 md:px-10 py-4 border-t border-zinc-200 bg-white">
            <span className="hidden sm:block text-xs text-zinc-500">
              {busy ? "You can edit details while plans draft" : !name || !citySelected ? "Name and location are required" : ""}
            </span>
            <div className="flex flex-1 sm:flex-none gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-5 rounded-full border border-zinc-300 text-[13px] font-medium hover:border-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="h-11 flex-1 sm:flex-none px-7 bg-zinc-900 text-white rounded-full text-[13px] font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create calendar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
