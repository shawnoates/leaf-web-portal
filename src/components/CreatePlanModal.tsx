"use client";

import { useState, useEffect, useRef } from "react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import { getDefaultCoverForSeed } from "@/lib/default-covers";
import VenueSearch from "@/components/VenueSearch";
import { detectCity } from "@/lib/detectCity";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Vote,
  X,
} from "lucide-react";

type PlanDraftField = "title" | "description" | "date" | "time" | "venue" | "mode" | "cover";

// Key under which the drawer snapshots its draft before the Google Cal
// OAuth full-page redirect. Dashboard restores from it on return so the
// manager doesn't lose everything they typed.
export const NEW_PLAN_DRAFT_SESSION_KEY = "leaf.newPlanDraftBeforeGoogleAuth";

type PlanMode = "plan" | "idea" | "poll";

type PollOptionDraft = { date: string; time: string };

type SeriesFreq = "weekly" | "biweekly" | "monthly";
type SeriesEndType = "occurrences" | "until";

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 6;
const SERIES_MAX_OCCURRENCES = 26;
const SERIES_DEFAULT_OCCURRENCES = 12;

function emptyPollOption(): PollOptionDraft {
  return { date: "", time: "" };
}

interface Venue {
  name: string;
  address: string;
  placeId: string;
}

/// Draft state for one stop past the primary — the primary uses the existing
/// `selectedVenue` / `venueQuery` state so all the ordinary create paths stay
/// single-venue. `time` is a 24h "HH:MM" that matches how iOS stores per-stop
/// time on eventDetail.locations[i].time. `objectId` preserves the pointer for
/// an existing DBLocation loaded from prefill so the server doesn't have to
/// re-resolve it via Google Places on save.
interface AdditionalStop {
  query: string;
  venue: Venue | null;
  time: string;
  objectId?: string | null;
}

export interface CreatePlanPrefill {
  title?: string;
  description?: string;
  venue?: { name: string; address: string; placeId?: string | null } | null;
  date?: string;
  time?: string;
  capacity?: string;
  imageUrl?: string | null;
  /** Why this plan is being suggested (shown as a banner at top of the modal). */
  justification?: string;
  /** Open the modal directly in a specific mode (used when editing/duplicating polls). */
  mode?: PlanMode;
  /** Prefilled poll options (used when editing/duplicating a poll). */
  pollOptions?: PollOptionDraft[];
  /** Prefilled poll close date as YYYY-MM-DD (used when editing a poll). */
  pollClosesAt?: string;
  /** Seed for the placeholder cover gradient — match the source card's color. */
  coverSeed?: string;
  /** Plan's current hideVenueUntilRsvp value (used when editing an existing plan). */
  hideVenueUntilRsvp?: boolean;
  /** Plan's current requireApproval value (used when editing an existing plan). */
  requireApproval?: boolean;
  /** Extra stops beyond the primary venue (multi-stop itineraries added on
   *  iOS). Rendered as a stops list under the primary Venue field; passed
   *  through as part of `locations` on save so the dashboard can edit them
   *  instead of silently collapsing to one stop. */
  additionalStops?: {
    objectId?: string | null;
    name: string;
    address: string;
    placeId?: string | null;
    time?: string | null;
  }[];
}

interface CreatePlanModalProps {
  calendarId: string;
  calendars?: { objectId: string; name: string }[];
  tier: string;
  prefill?: CreatePlanPrefill | null;
  hideVenueDefault?: boolean;
  requireApprovalDefault?: boolean;
  editMode?: boolean;
  eventGroupId?: string;
  /** Edit-and-approve mode for a pending follower-proposed plan. Submits via
   *  approveHostRequest with overrides instead of creating/updating a plan. */
  hostRequestMode?: boolean;
  hostRequestId?: string;
  /** Poll-to-plan conversion mode. Modal is pre-filled with the poll's data
   *  + the winning date; submit calls convertPollToPlan, which mutates the
   *  existing EventGroup in place (preserving /p/<id> links) and optionally
   *  attaches a PlanSeries when Repeats is toggled on. */
  pollConvertMode?: boolean;
  pollEventGroupId?: string;
  pollWinningDate?: string; // YYYY-MM-DD
  pollWinningTime?: string | null; // HH:MM
  onClose: () => void;
  onCreated: () => void;
  /** Optional — called when a starter-tier user clicks the locked Date Poll button. */
  onUpgrade?: () => void;
  /** When the drawer opens as a return from the Google Cal OAuth flow,
   *  the caller passes true so we auto-fire the Sync-to-Calendar fetch
   *  as soon as googleConnected resolves. Saves the manager one click
   *  after all that redirect ceremony. */
  autoSyncOnMount?: boolean;
}

// Convert display time ("6:30 PM") to 24h format ("18:30") for <input type="time">
function toTimeInputValue(t?: string | null): string {
  if (!t) return "";
  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return t;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

export default function CreatePlanModal({ calendarId, calendars, tier, prefill, hideVenueDefault, requireApprovalDefault, editMode, eventGroupId, hostRequestMode, hostRequestId, pollConvertMode, pollEventGroupId, pollWinningDate, pollWinningTime, onClose, onCreated, onUpgrade, autoSyncOnMount }: CreatePlanModalProps) {
  const [selectedCalendarId, setSelectedCalendarId] = useState(calendarId);
  const [hideVenue, setHideVenue] = useState(prefill?.hideVenueUntilRsvp ?? hideVenueDefault ?? true);
  const [title, setTitle] = useState(prefill?.title || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [venueQuery, setVenueQuery] = useState(prefill?.venue?.name || "");
  const [additionalStops, setAdditionalStops] = useState<AdditionalStop[]>(
    (prefill?.additionalStops || []).map((s) => ({
      query: s.name || "",
      venue: s.placeId
        ? { name: s.name, address: s.address, placeId: s.placeId }
        : null,
      time: s.time || "",
      objectId: s.objectId ?? null,
    })),
  );
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(
    prefill?.venue?.placeId
      ? { name: prefill.venue.name, address: prefill.venue.address, placeId: prefill.venue.placeId }
      : null
  );
  const [date, setDate] = useState(prefill?.date || "");
  const [time, setTime] = useState(toTimeInputValue(prefill?.time));
  const [capacity, setCapacity] = useState(prefill?.capacity || "");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(prefill?.imageUrl || null);
  const [hostNote, setHostNote] = useState("");
  const [mode, setMode] = useState<PlanMode>(prefill?.mode || "plan");
  const isHosted = mode === "plan";
  const isPoll = mode === "poll";
  const pollAllowed = tier !== "starter";
  const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>(
    prefill?.pollOptions && prefill.pollOptions.length >= MIN_POLL_OPTIONS
      ? prefill.pollOptions.map((o) => ({ date: o.date, time: o.time }))
      : [emptyPollOption(), emptyPollOption()]
  );
  const [pollClosesAt, setPollClosesAt] = useState(prefill?.pollClosesAt || "");
  const [requireApproval, setRequireApproval] = useState(prefill?.requireApproval ?? requireApprovalDefault ?? false);
  // Recurring plan series — only valid in create-mode for hosted plans.
  // Editing an existing plan or approving a host request doesn't currently
  // support converting to a series; that's a future flow.
  const [recurring, setRecurring] = useState(false);
  const [seriesFreq, setSeriesFreq] = useState<SeriesFreq>("weekly");
  const [seriesEndType, setSeriesEndType] = useState<SeriesEndType>("occurrences");
  const [seriesOccurrences, setSeriesOccurrences] = useState<string>(String(SERIES_DEFAULT_OCCURRENCES));
  const [seriesEndsAt, setSeriesEndsAt] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<{ id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  // When the prompt bar populates unsplashPhotos with the LLM's vibe-tuned
  // query, this stays true. Prevents the title-based useEffect from
  // overwriting those better-targeted results — the earlier bug where
  // clicking an alternative photo triggered a title-based refetch that
  // collapsed the carousel down to one weaker match.
  const [unsplashPhotosFromPrompt, setUnsplashPhotosFromPrompt] = useState(false);
  // We trigger VenueSearch's auto-resolve when prefill gives us a venue name
  // but no placeId. The lookup is fast (~500ms); show a neutral "confirming"
  // hint during that window so the amber warning doesn't flash unnecessarily.
  const autoResolvingVenue = !!prefill?.venue?.name && !prefill?.venue?.placeId;
  const [venueResolveSettled, setVenueResolveSettled] = useState(!autoResolvingVenue);

  // Prompt-first drawer: the manager types a sentence, the LLM extracts a
  // partial plan and we populate empty/AI-filled fields. Never clobber fields
  // the manager has typed into ("user-touched" wins).
  const showPromptBar = !editMode && !hostRequestMode && !pollConvertMode;
  const [promptInput, setPromptInput] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  // Recommendation pills under the prompt bar. Each `text` is a ready-to-send
  // sentence for draftPlanFromPrompt — tapping one runs the same path as
  // typing it. `reason` is the data justification, shown on hover.
  const [promptPills, setPromptPills] = useState<{ text: string; reason: string | null }[]>([]);
  const [pillsLoading, setPillsLoading] = useState(false);
  // Where this CALENDAR is, resolved server-side (its own city, else its
  // parent org's, else the browser's). Used as the drafter's location hint so
  // "a nearby taproom" resolves near the community — not near a manager who
  // happens to be working from another city today.
  const [calendarArea, setCalendarArea] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<PlanDraftField>>(() => new Set());
  const [userTouched, setUserTouched] = useState<Set<PlanDraftField>>(() => new Set());
  // Bumped whenever the prompt sets a new venue phrase — used as a `key` on
  // VenueSearch so it remounts and re-runs autoResolveInitial against the
  // new query (tier-1 fallback: single strong Places match → pre-fill).
  const [venueResolveKey, setVenueResolveKey] = useState(0);
  const [coverExpanded, setCoverExpanded] = useState(false);
  // Sync to calendar — carousel of ranked slots (past-behavior + Google
  // Cal busy) optionally filtered to the selected venue's opening hours.
  const [syncSlots, setSyncSlots] = useState<{ iso: string; label: string; reason: string }[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncVenueHours, setSyncVenueHours] = useState<{ weekdayDescriptions: string[] | null } | null>(null);
  // undefined = we haven't checked yet (label as neutral "Sync to Calendar");
  // false = confirmed no Google Cal auth (label becomes "Connect Google Calendar");
  // true = connected (label stays "Sync to Calendar").
  const [syncGoogleConnected, setSyncGoogleConnected] = useState<boolean | undefined>(undefined);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  // Fire the presence check as soon as the drawer opens in a "create"
  // context so the button label ships right the first time. Skipped for
  // edit / host-request / poll-convert modes where Sync isn't offered.
  useEffect(() => {
    if (pollConvertMode || editMode || hostRequestMode) return;
    let cancelled = false;
    Parse.Cloud.run("getGoogleCalendarStatus")
      .then((result: { connected?: boolean }) => {
        if (cancelled) return;
        setSyncGoogleConnected(result?.connected === true);
      })
      .catch(() => {
        // Non-fatal — leave undefined so the button uses the neutral
        // "Sync to Calendar" label rather than "Connect Google Calendar".
      });
    return () => { cancelled = true; };
  }, [pollConvertMode, editMode, hostRequestMode]);

  // Recommendation pills — grounded in this calendar's own history (best
  // weekday by RSVP share, typical start time, over-performing category, top
  // plans) and steered away from what's already on the books. Refetches when
  // the manager switches calendars, since the whole point is that they're
  // calendar-specific. Server caches per calendar, so this is cheap on reopen.
  useEffect(() => {
    if (!showPromptBar) return;
    if (!selectedCalendarId) return;
    let cancelled = false;
    setPillsLoading(true);
    setPromptPills([]);
    const detected = detectCity();
    Parse.Cloud.run("suggestPlanPrompts", {
      calendarId: selectedCalendarId,
      todayISO: new Date().toISOString().slice(0, 10),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locationHint: detected.fallback ? undefined : detected.city,
    })
      .then((result: { pills?: { text: string; reason: string | null }[]; area?: string | null }) => {
        if (cancelled) return;
        setPromptPills(Array.isArray(result?.pills) ? result.pills : []);
        setCalendarArea(result?.area || null);
      })
      .catch(() => {
        // Non-fatal — the prompt bar still works, the row just stays empty.
        if (!cancelled) setPromptPills([]);
      })
      .finally(() => {
        if (!cancelled) setPillsLoading(false);
      });
    return () => { cancelled = true; };
  }, [showPromptBar, selectedCalendarId]);

  async function handleConnectGoogleCalendar() {
    if (connectingGoogle) return;
    setConnectingGoogle(true);
    try {
      // Snapshot the in-flight draft so the manager doesn't lose what
      // they typed after the full-page redirect. Dashboard restores this
      // as `createPlanPrefill` when it detects openNewPlan=1 on return.
      try {
        const snapshot = {
          calendarId: selectedCalendarId,
          title,
          description,
          venue: selectedVenue,
          venueQuery,
          date,
          time,
          capacity,
          hostNote,
          mode,
          hideVenue,
          requireApproval,
          selectedImageUrl,
        };
        sessionStorage.setItem(NEW_PLAN_DRAFT_SESSION_KEY, JSON.stringify(snapshot));
      } catch {
        // sessionStorage may be disabled (Safari private mode etc.) —
        // still worth trying the redirect; draft loss is a lesser evil.
      }
      // returnTo → dashboard, Calendars tab, drawer reopened. The
      // openNewPlan=1 flag is what tells the dashboard to reopen; the
      // server also appends google_calendar=connected on success.
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("tab", "calendars");
      returnUrl.searchParams.set("openNewPlan", "1");
      const result = await Parse.Cloud.run("createGoogleCalendarConnectUrl", {
        returnTo: returnUrl.toString(),
      });
      if (result?.url) {
        // Full-page redirect — a popup gets blocked by strict browsers
        // and Google's consent screen doesn't play nice inside iframes.
        window.location.href = result.url;
        return;
      }
      alert("Could not start Google Calendar connect. Try again in a moment.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Google Calendar connect failed");
    } finally {
      setConnectingGoogle(false);
    }
  }
  function markTouched(field: PlanDraftField) {
    setUserTouched((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    setAiFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  // Header context line: "Adding to · <Calendar name>"
  const contextCalendarName =
    calendars?.find((c) => c.objectId === selectedCalendarId)?.name ||
    calendars?.[0]?.name ||
    null;
  useEffect(() => {
    if (!autoResolvingVenue) return;
    const t = setTimeout(() => setVenueResolveSettled(true), 2000);
    return () => clearTimeout(t);
  }, [autoResolvingVenue]);

  const placeholderCover = getDefaultCoverForSeed(prefill?.coverSeed || title.trim() || "default");

  // If prefill has an image URL, fetch and convert to base64 (once on mount)
  const prefillImageLoaded = useRef(false);
  useEffect(() => {
    if (prefill?.imageUrl && !prefillImageLoaded.current) {
      prefillImageLoaded.current = true;
      setLoadingImage(true);
      fetch(prefill.imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            setImageBase64(result.split(",")[1]);
            setImagePreview(result);
            setLoadingImage(false);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          // Keep the URL preview even if base64 conversion fails
          setLoadingImage(false);
        });
    }
  }, [prefill?.imageUrl]);

  // Fetch Unsplash photo suggestions when title changes
  useEffect(() => {
    if (!title.trim()) {
      setUnsplashPhotos([]);
      setUnsplashLoading(false);
      return;
    }
    // Don't overwrite prompt-sourced results. The LLM's unsplashQuery
    // ("sauna wooden steam") is better-targeted than a title-based search
    // ("Steam & Soak on Atlantic Ave"); once the prompt bar populates the
    // carousel, clicking an alternative chip (which flips userTouched
    // -> true) previously re-triggered a title-based refetch and
    // collapsed the carousel. Stay locked until the manager explicitly
    // clears the cover.
    if (unsplashPhotosFromPrompt) {
      setUnsplashLoading(false);
      return;
    }
    setUnsplashLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await Parse.Cloud.run("searchUnsplashPhotos", {
          query: title.trim(),
        });
        setUnsplashPhotos(results || []);
      } catch {
        setUnsplashPhotos([]);
      } finally {
        setUnsplashLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [title, unsplashPhotosFromPrompt]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    try {
      const { preview, base64 } = await processImageFile(file);
      setImagePreview(preview);
      setImageBase64(base64);
      setSelectedImageUrl(null);
      markTouched("cover");
    } catch {
      alert("Could not process this image. Please try a different file.");
    }
  }

  function validPollOptions(): PollOptionDraft[] {
    const cleaned = pollOptions
      .map((o) => ({ date: o.date.trim(), time: o.time }))
      .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date));
    const seen = new Set<string>();
    const unique: PollOptionDraft[] = [];
    for (const opt of cleaned) {
      const key = `${opt.date}|${opt.time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(opt);
    }
    return unique;
  }

  // `overrideText` is how a recommendation pill fires immediately — setState
  // is async, so reading promptInput back on the same tick would submit the
  // previous value (or empty on the first tap).
  async function handlePromptSubmit(overrideText?: string) {
    const trimmed = (overrideText ?? promptInput).trim();
    if (!trimmed || promptLoading) return;
    setPromptError(null);
    setPromptLoading(true);
    try {
      // Anchor grounded venue/showtime search to a real place. The calendar's
      // own area wins when we have it — a chip that says "a nearby taproom"
      // was written about the community's neighborhood, so it has to resolve
      // there. detectCity is the fallback: same timezone-derived signal the
      // server uses to bias Places grounding elsewhere, skipping its "your
      // area" case (fallback === true) so the server can use the tz region.
      const detected = detectCity();
      const locationHint = calendarArea || (detected.fallback ? undefined : detected.city);
      const draft = await Parse.Cloud.run("draftPlanFromPrompt", {
        prompt: trimmed,
        todayISO: new Date().toISOString().slice(0, 10),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationHint,
      });
      const nextAI = new Set(aiFilled);
      const apply = (field: PlanDraftField, setter: () => void, value: unknown) => {
        // Skip empty payloads.
        if (value == null || value === "") return;
        // Never clobber a field the manager typed into.
        if (userTouched.has(field)) return;
        setter();
        nextAI.add(field);
      };
      apply("title", () => setTitle(String(draft.title)), draft.title);
      apply("description", () => setDescription(String(draft.description)), draft.description);
      apply("date", () => setDate(String(draft.dateISO)), draft.dateISO);
      apply("time", () => setTime(String(draft.timeHHMM)), draft.timeHHMM);
      // Cover image auto-pick — LLM returns an unsplashQuery like
      // "sauna wooden steam" tuned for stock-photo results. Fire an
      // Unsplash search with THAT query (not the title) and use the
      // first result as the picked cover. The carousel still renders
      // the same batch as alternatives so the manager can swap.
      if (
        !userTouched.has("cover") &&
        !imageBase64 &&
        !selectedImageUrl &&
        typeof draft.unsplashQuery === "string" &&
        draft.unsplashQuery.trim()
      ) {
        // Fire-and-forget — don't block the prompt UI on the Unsplash call.
        Parse.Cloud.run("searchUnsplashPhotos", { query: draft.unsplashQuery.trim() })
          .then((results: { id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[]) => {
            if (!results || results.length === 0) return;
            // Skip if manager has typed / uploaded / selected since we fired.
            if (userTouched.has("cover")) return;
            if (imageBase64 || selectedImageUrl) return;
            setUnsplashPhotos(results);
            // Lock the carousel to these results — clicking an alternative
            // shouldn't kick off a title-based refetch that overwrites the
            // LLM's better-targeted query.
            setUnsplashPhotosFromPrompt(true);
            setSelectedImageUrl(results[0].url);
            setImagePreview(null);
            setImageBase64(null);
            // Auto-expand the cover section so the picked image + the
            // rest of the carousel are visible at a glance. Manager can
            // collapse if they want the space back.
            setCoverExpanded(true);
            nextAI.add("cover");
            setAiFilled(new Set(nextAI));
          })
          .catch(() => {
            // Silent — the debounced title-based search still runs.
          });
      }
      apply(
        "venue",
        () => {
          setVenueQuery(String(draft.venueQuery));
          setSelectedVenue(null);
          // Remount VenueSearch so its autoResolveInitial fires against the
          // fresh phrase (tier-1: single strong Places match → pre-fill).
          setVenueResolveKey((k) => k + 1);
          // Show the neutral "Confirming location…" hint until Places settles
          // instead of flashing the amber "Select this venue…" warning.
          setVenueResolveSettled(false);
          setTimeout(() => setVenueResolveSettled(true), 2000);
        },
        draft.venueQuery,
      );
      // Only nudge mode when the LLM picked non-default and the user hasn't
      // touched it — spec: default is Plan, never invent.
      if (
        !userTouched.has("mode") &&
        (draft.planType === "idea" || draft.planType === "poll") &&
        draft.planType !== mode
      ) {
        if (draft.planType === "poll" && !pollAllowed) {
          // Silently stay on plan — starter tier can't create polls.
        } else {
          setMode(draft.planType);
          nextAI.add("mode");
        }
      }
      setAiFilled(nextAI);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Draft failed";
      setPromptError(msg);
    } finally {
      setPromptLoading(false);
    }
  }

  // When the drawer re-opens as a return from Google Cal OAuth, the
  // caller passes autoSyncOnMount=true. As soon as syncGoogleConnected
  // resolves to true, fire handleSyncSlots once — the manager just
  // finished the connect flow and shouldn't have to click Sync again
  // to get the payoff.
  const autoSyncFiredRef = useRef(false);
  useEffect(() => {
    if (!autoSyncOnMount) return;
    if (autoSyncFiredRef.current) return;
    if (syncGoogleConnected !== true) return;
    autoSyncFiredRef.current = true;
    handleSyncSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncOnMount, syncGoogleConnected]);

  async function handleSyncSlots() {
    if (syncLoading) return;
    setSyncError(null);
    setSyncLoading(true);
    try {
      const result = await Parse.Cloud.run("suggestPlanSlots", {
        placeId: selectedVenue?.placeId || null,
        // 12 chips fills the carousel across a 14-day horizon so the
        // manager sees real range without doom-scrolling; horizon
        // bounded server-side so options past 2 weeks don't leak in.
        maxSlots: 12,
        horizonDays: 14,
      });
      const list = Array.isArray(result?.slots) ? result.slots : [];
      setSyncSlots(list);
      setSyncVenueHours(result?.venueHours || null);
      setSyncGoogleConnected(result?.googleConnected === true);
      if (list.length === 0) {
        setSyncError(
          selectedVenue
            ? "No open slots in the next few weeks match this venue's hours."
            : "No suggestions yet — try a venue or set a date manually.",
        );
      }
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncLoading(false);
    }
  }

  function pickSyncSlot(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    // Split into date + time using the browser's local timezone — the
    // manager typed everything else in local time; keep consistent.
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
    setTime(`${hh}:${mi}`);
    markTouched("date");
    markTouched("time");
  }

  // Unsaved-changes guard on dismiss (X, scrim, Esc). "Has changes" means
  // any user-touched field or AI-filled field currently holds a value.
  function hasUnsavedChanges(): boolean {
    if (creating) return false; // in-flight; don't nag
    if (title.trim()) return true;
    if (description.trim()) return true;
    if (venueQuery.trim()) return true;
    if (date) return true;
    if (time) return true;
    if (capacity.trim()) return true;
    if (hostNote.trim()) return true;
    if (imageBase64 || selectedImageUrl) return true;
    if (promptInput.trim()) return true;
    return false;
  }
  function requestDismiss() {
    if (creating) return;
    if (hasUnsavedChanges()) {
      const ok = window.confirm("Discard this plan draft?");
      if (!ok) return;
    }
    onClose();
  }

  // Esc key closes the drawer, matching the scrim/X behavior.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, title, description, venueQuery, date, time, capacity, hostNote, imageBase64, selectedImageUrl, promptInput]);

  async function handleCreate() {
    if (!title) return;

    // A venue name without a Google Places match means we'd save a Location with
    // no placeId/coords, breaking maps and dedupe downstream. Require selection.
    if (venueQuery.trim() && !selectedVenue) {
      alert("Please select the venue from the suggestions list so we can save its location details.");
      return;
    }

    if (isPoll) {
      // Edit-mode polls only update safe fields (title/description/image/venue) —
      // dates and close-date stay locked to avoid orphaning votes.
      const isPollEdit = !!(editMode && eventGroupId);
      const optsClean = isPollEdit ? [] : validPollOptions();
      if (!isPollEdit && optsClean.length < MIN_POLL_OPTIONS) {
        alert(`Add at least ${MIN_POLL_OPTIONS} valid date options for the poll.`);
        return;
      }
      // Polls still require a cover — the poll card is image-forward and the
      // fallback gradient looks broken next to the vote options.
      if (!imageBase64 && !prefill?.imageUrl && !selectedImageUrl) {
        alert("Please upload a cover image for your poll.");
        return;
      }
      setCreating(true);
      try {
        if (isPollEdit) {
          await Parse.Cloud.run("updateCalendarDatePoll", {
            eventGroupId,
            title,
            description,
            venue: selectedVenue
              ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId }
              : null,
            imageBase64: imageBase64 || undefined,
            imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          });
        } else {
          await Parse.Cloud.run("createCalendarDatePoll", {
            calendarId: selectedCalendarId,
            title,
            description,
            options: optsClean.map((o) => ({ date: o.date, time: o.time || null })),
            closesAt: pollClosesAt ? new Date(`${pollClosesAt}T23:59:59`).toISOString() : undefined,
            venue: selectedVenue
              ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId }
              : null,
            imageBase64: imageBase64 || undefined,
            imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          });
        }
        setSuccess(true);
        onCreated();
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : (editMode ? "Failed to update poll" : "Failed to create poll");
        alert(message);
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!date) return;
    // Cover image is optional in the drawer — the plan renders a placeholder
    // gradient seeded from the title when none is provided.
    setCreating(true);
    try {
      // Append local timezone offset so the server stores the correct UTC time
      // (e.g. "2026-04-28T18:00:00" + "-04:00" for Eastern Daylight Time)
      const offset = new Date().getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const absM = String(Math.abs(offset) % 60).padStart(2, "0");
      const tzSuffix = `${sign}${absH}:${absM}`;

      if (pollConvertMode && pollEventGroupId && pollWinningDate) {
        // The winning date is locked at the moment the owner picked the option;
        // we don't let them edit the date in the modal (that would orphan votes).
        // Recurrence is opt-in via the toggle.
        const occInt = Math.min(
          Math.max(parseInt(seriesOccurrences, 10) || SERIES_DEFAULT_OCCURRENCES, 1),
          SERIES_MAX_OCCURRENCES,
        );
        await Parse.Cloud.run("convertPollToPlan", {
          eventGroupId: pollEventGroupId,
          winningDate: pollWinningDate,
          winningTime: pollWinningTime || undefined,
          title,
          description,
          venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          capacity: capacity ? parseInt(capacity) : undefined,
          hostNote: hostNote.trim() || undefined,
          hideVenueUntilRsvp: hideVenue,
          requireApproval,
          ...(recurring
            ? {
                freq: seriesFreq,
                maxOccurrences: seriesEndType === "occurrences" ? occInt : undefined,
                endsAt: seriesEndType === "until" && seriesEndsAt ? `${seriesEndsAt}T23:59:59${tzSuffix}` : undefined,
              }
            : {}),
        });
      } else if (hostRequestMode && hostRequestId) {
        // Two-step: commit edits to the source EventDetail/EventGroup first,
        // then approve. Keeps approveHostRequest focused on the link-and-notify
        // flow and removes the override-application branch from approval.
        await Parse.Cloud.run("updateHostRequestPlan", {
          calendarPlanId: hostRequestId,
          edits: {
            title,
            description,
            date: `${date}T${time || "12:00"}:00${tzSuffix}`,
            time: time || null,
            venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
            capacity: capacity ? parseInt(capacity) : null,
            requireApproval,
            imageBase64: imageBase64 || undefined,
          },
        });
        await Parse.Cloud.run("approveHostRequest", { calendarPlanId: hostRequestId });
      } else if (editMode && eventGroupId) {
        // With extra stops present we send a `locations` array instead of the
        // single `venue` — the server treats `locations` as a full itinerary
        // replacement (with per-stop time). Lets the dashboard truly edit
        // multi-stop plans instead of clobbering stops 1..N via the
        // single-venue seatbelt.
        const hasMultiStop = additionalStops.length > 0;
        const primaryStopTime = time || "";
        const multiStopLocations = hasMultiStop
          ? [
              {
                objectId: null,
                name: selectedVenue?.name,
                address: selectedVenue?.address,
                placeId: selectedVenue?.placeId,
                time: primaryStopTime,
              },
              ...additionalStops.map((s) => ({
                objectId: s.objectId ?? null,
                name: s.venue?.name,
                address: s.venue?.address,
                placeId: s.venue?.placeId,
                time: s.time || "",
              })),
            ]
          : undefined;
        await Parse.Cloud.run("updatePlanDetails", {
          eventGroupId,
          title,
          description,
          date: `${date}T${time || "12:00"}:00${tzSuffix}`,
          time: time || null,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          // Pass EITHER `locations` (plural, full replacement) OR `venue`
          // (singular, preserves untouched stops via server seatbelt).
          ...(hasMultiStop
            ? { locations: multiStopLocations }
            : { venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null }
          ),
          capacity: capacity ? parseInt(capacity) : null,
          hostNote: hostNote.trim() || undefined,
          hideVenueUntilRsvp: hideVenue,
          requireApproval,
        });
        // Push the edit to the manager's Google Calendar too. Fire-and-forget:
        // if the token was only granted freebusy (pre-scope-upgrade), Google
        // returns 403 and we log it, but we don't block the plan update.
        Parse.Cloud.run("syncPlanToCalendar", {
          eventGroupId,
          action: "update",
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[syncPlanToCalendar] update failed:", msg);
        });
      } else if (recurring && isHosted) {
        const occInt = Math.min(
          Math.max(parseInt(seriesOccurrences, 10) || SERIES_DEFAULT_OCCURRENCES, 1),
          SERIES_MAX_OCCURRENCES,
        );
        await Parse.Cloud.run("createPlanSeries", {
          calendarId: selectedCalendarId,
          title,
          description,
          venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          firstInstanceDate: `${date}T${time || "12:00"}:00${tzSuffix}`,
          time: time || null,
          capacity: capacity ? parseInt(capacity) : null,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          hostNote: hostNote.trim() || undefined,
          hideVenueUntilRsvp: hideVenue,
          requireApproval,
          freq: seriesFreq,
          maxOccurrences: seriesEndType === "occurrences" ? occInt : undefined,
          endsAt: seriesEndType === "until" && seriesEndsAt ? `${seriesEndsAt}T23:59:59${tzSuffix}` : undefined,
        });
      } else if (recurring && mode === "idea") {
        const occInt = Math.min(
          Math.max(parseInt(seriesOccurrences, 10) || SERIES_DEFAULT_OCCURRENCES, 1),
          SERIES_MAX_OCCURRENCES,
        );
        await Parse.Cloud.run("createIdeaSeries", {
          calendarId: selectedCalendarId,
          title,
          description,
          suggestedVenue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          suggestedCapacity: capacity ? parseInt(capacity) : undefined,
          firstInstanceDate: `${date}T${time || "12:00"}:00${tzSuffix}`,
          time: time || null,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          freq: seriesFreq,
          maxOccurrences: seriesEndType === "occurrences" ? occInt : undefined,
          endsAt: seriesEndType === "until" && seriesEndsAt ? `${seriesEndsAt}T23:59:59${tzSuffix}` : undefined,
        });
      } else {
        const created = (await Parse.Cloud.run("createManualPlan", {
          calendarId: selectedCalendarId,
          title,
          description,
          venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          date: `${date}T${time || "12:00"}:00${tzSuffix}`,
          time: time || null,
          capacity: capacity ? parseInt(capacity) : null,
          isHosted,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          hostNote: isHosted && hostNote.trim() ? hostNote.trim() : undefined,
          hideVenueUntilRsvp: hideVenue,
          requireApproval: isHosted ? requireApproval : undefined,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })) as { success?: boolean; type?: string; eventGroupId?: string };
        // Only sync HOSTED plans — ideas don't have a fixed schedule to
        // put on the manager's calendar. Fire-and-forget: a 403 from
        // Google (token granted only freebusy pre-scope-upgrade) is
        // logged but doesn't block the plan creation.
        if (isHosted && created?.eventGroupId) {
          Parse.Cloud.run("syncPlanToCalendar", {
            eventGroupId: created.eventGroupId,
            action: "create",
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[syncPlanToCalendar] create failed:", msg);
          });
        }
      }
      setSuccess(true);
      onCreated();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : editMode ? "Failed to update plan" : "Failed to create plan";
      alert(message);
    } finally {
      setCreating(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const maxDate =
    tier === "starter"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : undefined;

  const headerTitle = pollConvertMode
    ? "Confirm & Convert Poll"
    : hostRequestMode
      ? "Review Plan Request"
      : editMode
        ? isPoll
          ? "Edit Date Poll"
          : "Edit Plan"
        : isPoll
          ? "New Date Poll"
          : mode === "idea"
            ? "New Suggestion"
            : "New Plan";

  return (
    <div className="fixed inset-0 z-50">
      {/* Scrim — the drawer sits on the right at md+, so the scrim covers the
          center plans column. On mobile the drawer is a full-screen sheet
          and this scrim is behind it (invisible but keeps the tap-to-close
          semantics consistent). */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={requestDismiss}
      />

      {/* Drawer body — right-slide half-viewport on lg+ (matches the
          concierge chat drawer), 480px on md, full-screen sheet on mobile. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        className="absolute inset-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-[480px] lg:w-1/2 bg-white shadow-2xl flex flex-col"
      >
        <div className="border-b border-zinc-100 px-6 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{headerTitle}</h2>
            {contextCalendarName && showPromptBar && (
              <p className="text-xs text-zinc-500 mt-1 truncate">
                Adding to · <span className="text-zinc-800 font-medium">{contextCalendarName}</span>
              </p>
            )}
          </div>
          <button
            onClick={requestDismiss}
            className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-sm">
              <Check className="w-4 h-4" /> {pollConvertMode ? "Poll converted — voters notified" : hostRequestMode ? "Approved — requester notified" : editMode ? (isPoll ? "Poll updated!" : "Plan updated!") : isPoll ? "Poll created — followers notified" : "Plan created successfully!"}
            </div>
          )}

          {/* Prompt bar — accent-tinted composer that turns a single sentence
              into a plan draft. Only surfaced in create mode; edit /
              host-request / poll-convert flows already have their subject
              locked, so the prompt would be misleading. */}
          {showPromptBar && (
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 space-y-2">
              <label htmlFor="new-plan-prompt" className="flex items-center gap-1.5 text-xs font-medium text-emerald-900/80">
                <Sparkles className="w-3.5 h-3.5" />
                Describe it, I&rsquo;ll draft the plan.
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="new-plan-prompt"
                  type="text"
                  value={promptInput}
                  onChange={(e) => { setPromptInput(e.target.value); setPromptError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePromptSubmit(); } }}
                  placeholder="Paint & sip next Thursday at 7pm on the rooftop"
                  disabled={promptLoading || creating}
                  className="flex-1 bg-white border border-emerald-200/70 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
                <button
                  type="button"
                  onClick={() => handlePromptSubmit()}
                  disabled={!promptInput.trim() || promptLoading || creating}
                  className="shrink-0 bg-emerald-600 text-white rounded-lg h-9 w-9 flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-40"
                  aria-label="Draft plan from prompt"
                >
                  {promptLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
              {promptError && (
                <p className="text-xs text-red-600">{promptError}</p>
              )}
              {aiFilled.size > 0 && !promptError && (
                <p className="text-xs text-emerald-800/70">
                  Drafted {aiFilled.size} field{aiFilled.size === 1 ? "" : "s"} — review before creating.
                </p>
              )}
            </div>
          )}

          {/* Recommendation pills — each one is a ready-to-send sentence built
              from THIS calendar's history (best weekday by RSVP share, typical
              start time, over-performing category, top plans) and filtered
              against what's already scheduled. Tapping sends it straight
              through the drafter, same path as typing it. Hidden once a draft
              has landed — the fields below are the subject at that point. */}
          {showPromptBar && aiFilled.size === 0 && (pillsLoading || promptPills.length > 0) && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {pillsLoading && [0, 1, 2, 3].map((i) => (
                <div
                  key={`pill-skel-${i}`}
                  className="h-[26px] rounded-full bg-zinc-100 animate-pulse"
                  style={{ width: `${[142, 116, 158, 128][i]}px` }}
                />
              ))}
              {!pillsLoading && promptPills.map((pill) => (
                <button
                  key={pill.text}
                  type="button"
                  title={pill.reason || undefined}
                  onClick={() => {
                    setPromptInput(pill.text);
                    setPromptError(null);
                    handlePromptSubmit(pill.text);
                  }}
                  disabled={promptLoading || creating}
                  className="rounded-full border border-emerald-200 bg-emerald-50/50 px-2.5 py-1 text-xs text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pill.text}
                </button>
              ))}
            </div>
          )}

          {prefill?.justification && !editMode && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs leading-snug">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{prefill.justification}</span>
            </div>
          )}

          {/* Calendar selector (only when multiple calendars, hidden in edit/host-request modes) */}
          {!editMode && !hostRequestMode && calendars && calendars.length > 1 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Calendar</label>
              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 bg-transparent"
              >
                {calendars.map((cal) => (
                  <option key={cal.objectId} value={cal.objectId}>{cal.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Plan type toggle (hidden in edit, host-request, and poll-convert modes) */}
          {!editMode && !hostRequestMode && !pollConvertMode && <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-3">Plan Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setMode("plan"); markTouched("mode"); }}
                className={`border rounded-lg p-2.5 text-left transition-all ${
                  mode === "plan" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Plan</span>
                </div>
                <p className="text-xs text-zinc-500 leading-tight">You host, members RSVP</p>
              </button>
              <button
                onClick={() => { setMode("idea"); markTouched("mode"); }}
                className={`border rounded-lg p-2.5 text-left transition-all ${
                  mode === "idea" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Suggestion</span>
                </div>
                <p className="text-xs text-zinc-500 leading-tight">Members can host</p>
              </button>
              <button
                onClick={() => {
                  if (pollAllowed) { setMode("poll"); markTouched("mode"); return; }
                  if (onUpgrade) onUpgrade();
                }}
                title={pollAllowed ? "" : "Date polls require the Pro plan"}
                className={`group border rounded-lg p-2.5 text-left transition-all ${
                  mode === "poll" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                } ${pollAllowed ? "" : "opacity-50 hover:opacity-100 hover:border-zinc-400"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {pollAllowed ? (
                    <Vote className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span className="text-xs font-medium">Date Poll</span>
                </div>
                <p className="text-xs text-zinc-500 leading-tight">
                  {pollAllowed ? (
                    "Followers vote on a date"
                  ) : (
                    <>
                      <span className="group-hover:hidden">Pro plan only</span>
                      <span className="hidden group-hover:inline-flex items-center gap-1 font-bold uppercase tracking-widest text-zinc-700">
                        <Lock className="w-2.5 h-2.5" /> Upgrade
                      </span>
                    </>
                  )}
                </p>
              </button>
            </div>
          </div>}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markTouched("title"); }}
              className={`w-full border-b py-2 text-lg font-light focus:outline-none focus:border-zinc-900 ${aiFilled.has("title") && !userTouched.has("title") ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-300"}`}
              placeholder="Plan title"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markTouched("description"); }}
              rows={2}
              className={`w-full border rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-y ${aiFilled.has("description") && !userTouched.has("description") ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-200"}`}
              placeholder="What's this plan about?"
            />
          </div>

          {/* Cover image — collapsed to a chip by default so the primary
              form fields (title, venue, date/time) claim the top of the drawer.
              Chip expands into the full uploader + Unsplash suggestions on click. */}
          {!coverExpanded && !imagePreview && !selectedImageUrl && (
            <button
              type="button"
              onClick={() => setCoverExpanded(true)}
              className="w-full inline-flex items-center justify-between gap-3 border border-dashed border-zinc-300 rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-zinc-500" />
                Add cover image
                <span className="text-xs text-zinc-400 font-normal">(optional)</span>
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>
          )}
          {!coverExpanded && (imagePreview || selectedImageUrl) && (
            <button
              type="button"
              onClick={() => setCoverExpanded(true)}
              className="w-full inline-flex items-center justify-between gap-3 border border-zinc-200 rounded-lg pl-1.5 pr-3 py-1.5 text-left text-sm text-zinc-700 hover:border-zinc-300 transition-colors"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview || selectedImageUrl || ""} alt="Cover" className="w-9 h-9 rounded-md object-cover shrink-0" />
                <span className="truncate">Cover selected · tap to change</span>
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {coverExpanded && <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Cover Image
            </label>
            {imagePreview || selectedImageUrl ? (
              <div className="relative w-full h-36 rounded-lg overflow-hidden">
                <img src={imagePreview || selectedImageUrl || ""} alt="Preview" className="w-full h-full object-cover" />
                {loadingImage && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                    setSelectedImageUrl(null);
                    // Clearing the picked cover releases the prompt-lock,
                    // so the title-based search re-fires (Photo Suggestions
                    // repopulate from whatever the manager typed).
                    setUnsplashPhotosFromPrompt(false);
                    markTouched("cover");
                  }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center w-full h-28 rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: placeholderCover.gradient }}
              >
                <ImagePlus className="w-6 h-6 text-white/90 mb-2" />
                <span className="text-xs text-white/90">Click to upload an image</span>
                <input type="file" accept={IMAGE_ACCEPT} onChange={handleImageSelect} className="hidden" />
              </label>
            )}

            {/* Photo suggestions from Unsplash */}
            {(unsplashLoading || unsplashPhotos.length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Photo suggestions</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {unsplashLoading && [0, 1, 2, 3].map((i) => (
                    <div key={`skel-${i}`} className="min-w-[120px] h-[80px] bg-zinc-100 rounded-lg animate-pulse shrink-0" />
                  ))}
                  {!unsplashLoading && unsplashPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        setSelectedImageUrl(selectedImageUrl === photo.url ? null : photo.url);
                        setImagePreview(null);
                        setImageBase64(null);
                        markTouched("cover");
                      }}
                      className={`min-w-[120px] max-w-[120px] h-[80px] shrink-0 rounded-lg overflow-hidden border-2 transition-all relative ${
                        selectedImageUrl === photo.url
                          ? "border-zinc-900 shadow-lg"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {selectedImageUrl === photo.url && (
                        <div className="absolute top-1 right-1 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <img src={photo.thumbUrl} className="w-full h-full object-cover" alt={photo.alt} />
                    </button>
                  ))}
                </div>
                {(() => {
                  const selected = unsplashPhotos.find(p => p.url === selectedImageUrl);
                  if (!selected) return null;
                  return (
                    <p className="text-xs text-zinc-400">
                      Photo by{" "}
                      <a href={`${selected.photographerUrl}?utm_source=leaf&utm_medium=referral`} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                        {selected.photographerName}
                      </a>
                      {" / "}
                      <a href="https://unsplash.com/?utm_source=leaf&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                        Unsplash
                      </a>
                    </p>
                  );
                })()}
              </div>
            )}
          </div>}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Venue</label>
            <VenueSearch
              key={`venue-${venueResolveKey}`}
              value={venueQuery}
              onChange={(v) => {
                setVenueQuery(v);
                markTouched("venue");
                if (selectedVenue && v !== selectedVenue.name) setSelectedVenue(null);
              }}
              onSelect={(v) => { setSelectedVenue(v); setVenueQuery(v.name); }}
              autoResolveInitial={(!!prefill?.venue?.name && !prefill?.venue?.placeId) || venueResolveKey > 0}
              className={`w-full border-b py-2 text-sm font-light focus:outline-none focus:border-zinc-900 ${aiFilled.has("venue") && !userTouched.has("venue") ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-300"}`}
            />
            {selectedVenue ? (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {selectedVenue.address}
              </p>
            ) : venueQuery.trim() ? (
              !venueResolveSettled ? (
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Confirming location with Google Places…
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Select this venue from the suggestions to confirm its location
                </p>
              )
            ) : pollConvertMode ? (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Pick a venue so voters know where to go
              </p>
            ) : null}

            {/* Multi-stop itinerary — one row per additional stop with its
                own VenueSearch + optional per-stop time. Polls and
                idea/host-request modes stay single-venue since their
                downstream flows collapse to a single card anyway. */}
            {!isPoll && mode !== "idea" && !hostRequestMode && (additionalStops.length > 0 || editMode) && (
              <div className="mt-4 space-y-3">
                {additionalStops.map((stop, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">
                        Stop {i + 2}
                      </label>
                      <VenueSearch
                        key={`stop-${i}-${stop.venue?.placeId || "empty"}`}
                        value={stop.query}
                        onChange={(v) => {
                          setAdditionalStops((prev) => prev.map((s, idx) =>
                            idx === i
                              ? { ...s, query: v, venue: s.venue && v !== s.venue.name ? null : s.venue }
                              : s
                          ));
                        }}
                        onSelect={(v) => {
                          setAdditionalStops((prev) => prev.map((s, idx) =>
                            idx === i ? { ...s, query: v.name, venue: v, objectId: null } : s
                          ));
                        }}
                        autoResolveInitial={!!stop.query && !stop.venue?.placeId}
                        className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                      />
                      {stop.venue?.address && (
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {stop.venue.address}
                        </p>
                      )}
                    </div>
                    <div className="w-20 shrink-0 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">
                        Time
                      </label>
                      <input
                        type="time"
                        value={stop.time}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAdditionalStops((prev) => prev.map((s, idx) =>
                            idx === i ? { ...s, time: v } : s
                          ));
                        }}
                        className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdditionalStops((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove stop ${i + 2}`}
                      className="mt-5 p-1 text-zinc-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAdditionalStops((prev) => [
                    ...prev,
                    { query: "", venue: null, time: "", objectId: null },
                  ])}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add stop
                </button>
              </div>
            )}
          </div>

          {!isPoll && (
            <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); markTouched("date"); }}
                  min={today}
                  max={maxDate}
                  disabled={pollConvertMode}
                  className={`w-full border-b py-2 text-sm font-light focus:outline-none focus:border-zinc-900 disabled:text-zinc-500 disabled:bg-transparent ${aiFilled.has("date") && !userTouched.has("date") ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-300"}`}
                />
                {pollConvertMode ? (
                  <p className="text-xs text-zinc-400 mt-1">Locked to the winning vote</p>
                ) : tier === "starter" ? (
                  <p className="text-xs text-amber-600 mt-1">Free plan: 2 weeks ahead max</p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => { setTime(e.target.value); markTouched("time"); }}
                  disabled={pollConvertMode}
                  className={`w-full border-b py-2 text-sm font-light focus:outline-none focus:border-zinc-900 disabled:text-zinc-500 disabled:bg-transparent ${aiFilled.has("time") && !userTouched.has("time") ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-300"}`}
                />
              </div>
            </div>
            {/* Sync to Calendar — one button that's either the connect
                CTA (when Google Cal isn't linked yet) or the actual sync
                fetch (once it is). Same button, same slot, no separate
                secondary CTA to compete with it. */}
            {!pollConvertMode && (() => {
              const needsConnect = syncGoogleConnected === false;
              const busy = needsConnect ? connectingGoogle : syncLoading;
              return (
              <div>
                <button
                  type="button"
                  onClick={needsConnect ? handleConnectGoogleCalendar : handleSyncSlots}
                  disabled={busy || creating}
                  className="w-full inline-flex items-center justify-center gap-2 border border-zinc-300 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  {busy ? (
                    <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  ) : needsConnect ? (
                    <Calendar className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {needsConnect ? "Connect Google Calendar" : "Sync to Calendar"}
                  {!needsConnect && selectedVenue && (
                    <span className="text-zinc-400 font-normal normal-case tracking-normal">· within venue hours</span>
                  )}
                </button>
                {needsConnect && (
                  <p className="text-[11px] text-zinc-500 mt-2">
                    We&rsquo;ll suggest times that don&rsquo;t clash with your Google Calendar
                    {selectedVenue ? " and stay within the venue's hours" : ""}, and
                    publish plans you host to your calendar too.
                  </p>
                )}
                {syncError && (
                  <p className="text-xs text-amber-600 mt-2">{syncError}</p>
                )}
                {syncSlots.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {syncSlots.map((slot) => {
                      const d = new Date(slot.iso);
                      if (Number.isNaN(d.getTime())) return null;
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      const hh = String(d.getHours()).padStart(2, "0");
                      const mi = String(d.getMinutes()).padStart(2, "0");
                      const active = date === `${yyyy}-${mm}-${dd}` && time === `${hh}:${mi}`;
                      // Build a richer label than the server's "Fri 7pm":
                      // "Fri, Jul 25" + "7pm" so the chip carries the
                      // actual calendar date, not just a weekday.
                      const dateStr = d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                      const displayHour = d.getHours() === 0
                        ? 12
                        : d.getHours() > 12
                          ? d.getHours() - 12
                          : d.getHours();
                      const ampm = d.getHours() >= 12 ? "pm" : "am";
                      const timeStr = d.getMinutes() === 0
                        ? `${displayHour}${ampm}`
                        : `${displayHour}:${String(d.getMinutes()).padStart(2, "0")}${ampm}`;
                      return (
                        <button
                          key={slot.iso}
                          type="button"
                          onClick={() => pickSyncSlot(slot.iso)}
                          className={`shrink-0 rounded-lg px-3 py-2 text-xs text-left border transition-colors ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 hover:border-zinc-400 text-zinc-700"
                          }`}
                        >
                          <div className="font-medium whitespace-nowrap">{dateStr}</div>
                          <div className={`text-[11px] mt-0.5 whitespace-nowrap ${active ? "text-zinc-300" : "text-zinc-500"}`}>
                            {timeStr}
                          </div>
                          {slot.reason && (
                            <div className={`text-[10px] mt-0.5 whitespace-nowrap ${active ? "text-zinc-400" : "text-zinc-400"}`}>
                              {slot.reason}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {syncVenueHours?.weekdayDescriptions && syncVenueHours.weekdayDescriptions.length > 0 && (
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Filtered to {selectedVenue?.name || "venue"} hours.
                  </p>
                )}
                {/* Sync-worked confirmation. Reads Google Cal busy times
                    when googleConnected; falls back to sensible defaults
                    when the manager has few past plans. The "we skipped
                    N conflicts" beat is what tells them Sync actually
                    hit their calendar — otherwise a thin list looks
                    like nothing happened. */}
                {syncSlots.length > 0 && syncGoogleConnected === true && (
                  <p className="text-[11px] text-emerald-700/80 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Synced to your Google Calendar — showing times that don&rsquo;t clash with your schedule.
                  </p>
                )}
                {syncSlots.length > 0 && syncSlots.length < 6 && (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Thin list? Host a few plans on this calendar and we&rsquo;ll learn your preferred times.
                  </p>
                )}
              </div>
              );
            })()}
            </>
          )}

          {isPoll && !editMode && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Date Options ({MIN_POLL_OPTIONS}–{MAX_POLL_OPTIONS})
                  </label>
                  {pollOptions.length < MAX_POLL_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => [...prev, emptyPollOption()])}
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-900"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={opt.date}
                        min={today}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPollOptions((prev) => prev.map((p, i) => i === idx ? { ...p, date: value } : p));
                        }}
                        className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                      />
                      <input
                        type="time"
                        value={opt.time}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPollOptions((prev) => prev.map((p, i) => i === idx ? { ...p, time: value } : p));
                        }}
                        className="w-28 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                      />
                      {pollOptions.length > MIN_POLL_OPTIONS && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700"
                          aria-label="Remove option"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 mt-2">Time is optional. Followers verify their phone via OTP, one vote per phone.</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Voting closes (optional)</label>
                <input
                  type="date"
                  value={pollClosesAt}
                  min={today}
                  onChange={(e) => setPollClosesAt(e.target.value)}
                  className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                />
                <p className="text-xs text-zinc-400 mt-1">Defaults to 7 days from now.</p>
              </div>
            </>
          )}

          {!isPoll && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Capacity (optional)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 max-w-[120px]"
                placeholder="—"
                min="1"
              />
            </div>
          )}

          {isHosted && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Host Note (optional)</label>
              <textarea
                value={hostNote}
                onChange={(e) => setHostNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                placeholder="A note for attendees (visible in the plan)"
              />
            </div>
          )}

          {/* Recurring series — create-mode only. For hosted plans, each
              materialized instance is a regular plan with its own RSVPs.
              For ideas, each instance is a CalendarGeneratedPlan that members
              can claim — counts against orgPlanIdeasPerWeek per instance, so
              series self-throttle when the quota is full. */}
          {(isHosted || mode === "idea") && !editMode && !hostRequestMode && (
            <div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-start gap-2">
                  <Repeat className="w-3.5 h-3.5 text-zinc-700 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Repeats</p>
                    <p className="text-xs text-zinc-400">{mode === "idea" ? "Automatically offer the same suggestion each cycle" : "Automatically create the same plan each cycle"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRecurring(!recurring)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${recurring ? "bg-zinc-900" : "bg-zinc-200"}`}
                  aria-label="Toggle recurring plan"
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              {recurring && (
                <div className="mt-3 space-y-3 pl-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Every</label>
                    <select
                      value={seriesFreq}
                      onChange={(e) => setSeriesFreq(e.target.value as SeriesFreq)}
                      className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 bg-transparent"
                    >
                      <option value="weekly">Week</option>
                      <option value="biweekly">Other week</option>
                      <option value="monthly">Month</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Ends</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={seriesEndType}
                        onChange={(e) => setSeriesEndType(e.target.value as SeriesEndType)}
                        className="border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 bg-transparent"
                      >
                        <option value="occurrences">After</option>
                        <option value="until">On</option>
                      </select>
                      {seriesEndType === "occurrences" ? (
                        <>
                          <input
                            type="number"
                            value={seriesOccurrences}
                            onChange={(e) => setSeriesOccurrences(e.target.value)}
                            min={1}
                            max={SERIES_MAX_OCCURRENCES}
                            className="w-16 border-b border-zinc-300 py-2 text-sm font-light text-center focus:outline-none focus:border-zinc-900"
                          />
                          <span className="text-sm text-zinc-500">occurrences</span>
                        </>
                      ) : (
                        <input
                          type="date"
                          value={seriesEndsAt}
                          min={date || today}
                          onChange={(e) => setSeriesEndsAt(e.target.value)}
                          className="flex-1 border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                        />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Max {SERIES_MAX_OCCURRENCES} occurrences.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Venue privacy toggle (not relevant for polls — venue isn't being voted on) */}
          {!isPoll && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-zinc-700">Hide venue until RSVP</p>
                <p className="text-xs text-zinc-400">Only show neighborhood on public page</p>
              </div>
              <button
                type="button"
                onClick={() => setHideVenue(!hideVenue)}
                className={`relative w-10 h-5 rounded-full transition-colors ${hideVenue ? "bg-zinc-900" : "bg-zinc-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideVenue ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          )}

          {/* Require approval toggle */}
          {isHosted && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-zinc-700">Require approval to attend</p>
                <p className="text-xs text-zinc-400">Visitors must be approved before confirming</p>
              </div>
              <button
                type="button"
                onClick={() => setRequireApproval(!requireApproval)}
                className={`relative w-10 h-5 rounded-full transition-colors ${requireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requireApproval ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          )}

        </div>

        {/* Sticky footer — always in view so the Create action never scrolls
            off-screen (mobile keyboard covers the bottom of the drawer). */}
        <div className="border-t border-zinc-100 px-6 py-3 flex items-center justify-end gap-2 bg-white shrink-0">
          <button
            type="button"
            onClick={requestDismiss}
            disabled={creating}
            className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={
              !title ||
              creating ||
              (isPoll
                ? (!editMode && validPollOptions().length < MIN_POLL_OPTIONS) || (!imageBase64 && !prefill?.imageUrl && !selectedImageUrl)
                : !date) ||
              (pollConvertMode && !selectedVenue) ||
              (recurring && (isHosted || mode === "idea") && seriesEndType === "until" && !seriesEndsAt)
            }
            className="bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {creating
              ? (pollConvertMode ? "Converting..." : hostRequestMode ? "Approving..." : editMode ? "Saving..." : recurring && (isHosted || mode === "idea") ? "Starting Series..." : "Creating...")
              : pollConvertMode
                ? (recurring ? "Convert & Start Series" : "Convert to Plan")
                : hostRequestMode
                  ? "Approve & Notify Requester"
                  : editMode
                    ? "Save Changes"
                    : isPoll
                      ? "Create Date Poll"
                      : isHosted
                        ? (recurring ? "Start Recurring Plan" : "Create plan")
                        : (recurring ? "Start Recurring Suggestion" : "Create plan suggestion")}
          </button>
        </div>
      </div>
    </div>
  );
}
