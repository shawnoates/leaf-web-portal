"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import VenueSearch from "@/components/VenueSearch";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import { detectCity } from "@/lib/detectCity";
import { zoneOffsetSuffix } from "@/lib/wall-clock";
import { APP_LINK_URL } from "@/lib/site";

// ============================================================================
// New plan — the quick-create flow reached from "+ New plan" (top bar / sticky
// mobile CTA) and "Make a plan" (prompt box A) on /me.
//
// Built to the /me handoff spec: desktop is the 720px centered modal (3a) with
// essentials left / optional right; mobile is the full-screen sheet (2a) whose
// two option groups expand in place (3b). One component, two layouts — the
// sheet isn't a scaled-down modal, so the branch is explicit rather than CSS.
//
// The plan lands on the author's OWN calendar by default ("Invite link only").
// If they don't have one yet we create it here, silently, on the way through —
// no org-setup detour, no second account. Guests still RSVP by phone with no
// account, which is the whole promise of the box that opens this thing.
// ============================================================================

export interface PostToOption {
  /** Groups objectId, or LINK_ONLY for "my own calendar". */
  id: string;
  name: string;
  /** Owner/co-host — only owned calendars can carry a repeating series. */
  owned: boolean;
}

interface Venue { name: string; address: string; placeId: string }

export const LINK_ONLY = "link-only";
/** Remembers which Groups row is this person's personal calendar, so a second
 *  plan doesn't have to re-guess it out of getMyOrganizations' owned-or-cohost
 *  list (which carries no role flag). */
const PERSONAL_CAL_KEY = "leaf_me_personal_calendar_id";
/** Draft snapshot parked before the Google Calendar OAuth full-page redirect.
 *  MeClient restores it when it sees ?openNewPlan=1 coming back. */
export const ME_PLAN_DRAFT_KEY = "leaf.mePlanDraftBeforeGoogleAuth";

const SERIES_DEFAULT_OCCURRENCES = 12;

// ---- Formatting ------------------------------------------------------------
function dateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function timeLabel(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m[2] === "00" ? `${h}:00 ${ap}` : `${h}:${m[2]} ${ap}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysOut(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

// ---- Timing hints ("what works for your followers") ------------------------
interface TimingHints {
  source: "category" | "calendar" | "global";
  sampleSize: number;
  bestDay: { day: string; dayIndex: number; sharePct: number } | null;
  bestTime: { bucket: string; sharePct: number; suggestedTime: string | null } | null;
}
const BUCKET_TIME: Record<string, string> = {
  morning: "10:00", afternoon: "14:00", evening: "18:30", night: "21:00",
};
/** Next occurrence of `dayIndex` (0=Sun) strictly in the future. */
function nextDateForDayIndex(dayIndex: number): string {
  const now = new Date();
  const delta = ((dayIndex - now.getDay()) + 7) % 7 || 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CreatedPlan { eventGroupId: string | null; inviteUrl: string | null; title: string }

export interface NewPlanDraftSnapshot {
  prompt?: string;
  draftApplied?: boolean;
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  venueQuery?: string;
  venue?: Venue | null;
  capacity?: string;
  hostNote?: string;
  postTo?: string;
  hideVenue?: boolean;
  requireApproval?: boolean;
  repeats?: boolean;
  seriesFreq?: "weekly" | "biweekly" | "monthly";
}

export default function NewPlanModal({
  options, firstName, restore, onClose, onCreated,
}: {
  /** Calendars this person can post to, beyond their own. */
  options: PostToOption[];
  firstName: string;
  restore?: NewPlanDraftSnapshot | null;
  onClose: () => void;
  onCreated: (plan: CreatedPlan) => void;
}) {
  // Layout branch. The modal only ever mounts on a click, so reading the
  // viewport in the initializer is safe (never part of the SSR pass).
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ---- Draft (the describe field) ----
  const [prompt, setPrompt] = useState(restore?.prompt ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draftApplied, setDraftApplied] = useState(restore?.draftApplied ?? false);
  const [draftError, setDraftError] = useState("");

  // ---- The plan ----
  const [title, setTitle] = useState(restore?.title ?? "");
  const [description, setDescription] = useState(restore?.description ?? "");
  const [date, setDate] = useState(restore?.date ?? "");
  const [time, setTime] = useState(restore?.time ?? "");
  const [venueQuery, setVenueQuery] = useState(restore?.venueQuery ?? "");
  const [venue, setVenue] = useState<Venue | null>(restore?.venue ?? null);
  const [venueKey, setVenueKey] = useState(0);
  const [capacity, setCapacity] = useState(restore?.capacity ?? "");
  const [hostNote, setHostNote] = useState(restore?.hostNote ?? "");
  const [postTo, setPostTo] = useState<string>(restore?.postTo ?? LINK_ONLY);
  const [hideVenue, setHideVenue] = useState(restore?.hideVenue ?? true);
  const [requireApproval, setRequireApproval] = useState(restore?.requireApproval ?? false);
  const [repeats, setRepeats] = useState(restore?.repeats ?? false);
  const [seriesFreq, setSeriesFreq] = useState<"weekly" | "biweekly" | "monthly">(
    restore?.seriesFreq ?? "weekly",
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fields the author edited by hand — a re-draft never overwrites these.
  const touchedRef = useRef<Set<string>>(new Set());
  const touch = (f: string) => { touchedRef.current.add(f); };

  // ---- Mobile option groups (2a collapsed → 3b expanded) ----
  const [moreOpen, setMoreOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [editingBasics, setEditingBasics] = useState(false);

  // ---- Submit ----
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedPlan | null>(null);
  const [copied, setCopied] = useState(false);

  // ---- Google Calendar sync (optional, never a gate) ----
  const [googleConnected, setGoogleConnected] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    Parse.Cloud.run("getGoogleCalendarStatus")
      .then((r: { connected?: boolean }) => { if (!cancelled) setGoogleConnected(r?.connected === true); })
      .catch(() => { /* neutral label */ });
    return () => { cancelled = true; };
  }, []);

  // ---- Timing hints — only when this person already runs a calendar and the
  // server has enough history to say something true. Spec: no card otherwise.
  const [hints, setHints] = useState<TimingHints | null>(null);
  useEffect(() => {
    const owned = options.find((o) => o.owned);
    if (!owned) return;
    let cancelled = false;
    Parse.Cloud.run("getPlanTimingHints", { calendarId: owned.id })
      .then((r: TimingHints | null) => {
        if (cancelled || !r || !r.bestDay || !r.bestTime) return;
        setHints(r);
      })
      .catch(() => { /* no card */ });
    return () => { cancelled = true; };
  }, [options]);

  const hintDate = hints?.bestDay ? nextDateForDayIndex(hints.bestDay.dayIndex) : null;
  const hintTime = hints?.bestTime
    ? hints.bestTime.suggestedTime || BUCKET_TIME[hints.bestTime.bucket] || null
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !!(prompt.trim() || title.trim() || date || venueQuery.trim() || description.trim());
  const requestClose = useCallback(() => {
    if (created) { onClose(); return; }
    if (dirty && !window.confirm("Discard this plan?")) return;
    onClose();
  }, [created, dirty, onClose]);

  // ---- AI draft ------------------------------------------------------------
  async function runDraft() {
    const text = prompt.trim();
    if (!text || drafting) return;
    setDrafting(true);
    setDraftError("");
    try {
      const detected = detectCity();
      const draft = (await Parse.Cloud.run("draftPlanFromPrompt", {
        prompt: text,
        todayISO: todayISO(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationHint: detected.resolvedCity ?? undefined,
      })) as {
        title?: string; description?: string; dateISO?: string;
        timeHHMM?: string; venueQuery?: string; unsplashQuery?: string;
      };
      const t = touchedRef.current;
      if (draft.title && !t.has("title")) setTitle(String(draft.title));
      if (draft.description && !t.has("description")) setDescription(String(draft.description));
      if (draft.dateISO && !t.has("date")) setDate(String(draft.dateISO));
      if (draft.timeHHMM && !t.has("time")) setTime(String(draft.timeHHMM));
      if (draft.venueQuery && !t.has("venue")) {
        setVenueQuery(String(draft.venueQuery));
        setVenue(null);
        // Remount VenueSearch so autoResolveInitial fires on the new phrase.
        setVenueKey((k) => k + 1);
      }
      setDraftApplied(true);
      setErrors({});
    } catch (e: unknown) {
      setDraftError(e instanceof Error ? e.message : "Couldn't draft that. Fill it in below.");
    } finally {
      setDrafting(false);
    }
  }

  async function pickCover(file: File | undefined) {
    if (!file) return;
    try {
      const { preview, base64 } = await processImageFile(file);
      setCoverPreview(preview);
      setCoverBase64(base64);
    } catch {
      setErrors((p) => ({ ...p, cover: "Couldn't read that image." }));
    }
  }

  // ---- Calendar resolution -------------------------------------------------
  // "Invite link only" means "my own calendar". Reuse the remembered one, else
  // the first calendar this account already owns, else create one now. This is
  // the whole no-org-setup promise — the author never sees this step.
  async function resolvePersonalCalendarId(): Promise<string> {
    try {
      const cached = localStorage.getItem(PERSONAL_CAL_KEY);
      if (cached) return cached;
    } catch { /* storage disabled */ }

    const mine = (await Parse.Cloud.run("getMyOrganizations")) as {
      organizations?: { objectId: string }[];
    };
    const existing = mine?.organizations?.[0]?.objectId;
    if (existing) {
      try { localStorage.setItem(PERSONAL_CAL_KEY, existing); } catch { /* ignore */ }
      return existing;
    }

    const detected = detectCity();
    const created = (await Parse.Cloud.run("createOrganization", {
      name: firstName ? `${firstName}'s Plans` : "My Plans",
      orgType: "community",
      description: "Personal plans on Leaf.",
      primaryCity: detected.resolvedCity || detected.city || "New York, NY",
      primaryLat: detected.lat ?? undefined,
      primaryLng: detected.lng ?? undefined,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      maxEvents: 5,
      capacityLimit: 50,
      vibes: [],
      blacklistCategories: [],
      tier: "starter",
    })) as { calendarId?: string };
    if (!created?.calendarId) throw new Error("Couldn't set up your calendar. Try again.");
    try { localStorage.setItem(PERSONAL_CAL_KEY, created.calendarId); } catch { /* ignore */ }
    return created.calendarId;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give the plan a name.";
    if (!date) next.date = "Pick a day.";
    else if (daysOut(date) < 0) next.date = "That date has already passed.";
    if (!time) next.time = "Pick a start time.";
    if (capacity.trim() && (!/^\d+$/.test(capacity.trim()) || Number(capacity) < 1)) {
      next.capacity = "Capacity must be 1 or more.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const calendarId = postTo === LINK_ONLY ? await resolvePersonalCalendarId() : postTo;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startTime = time || "12:00";
      const when = `${date}T${startTime}:00${zoneOffsetSuffix(date, startTime, tz)}`;
      const venuePayload = venue
        ? { name: venue.name, address: venue.address, placeId: venue.placeId }
        : null;
      const shared = {
        calendarId,
        title: title.trim(),
        description: description.trim() || undefined,
        venue: venuePayload,
        time: startTime,
        capacity: capacity.trim() ? parseInt(capacity, 10) : null,
        imageBase64: coverBase64 || undefined,
        hostNote: hostNote.trim() || undefined,
        hideVenueUntilRsvp: hideVenue,
        requireApproval,
      };

      let eventGroupId: string | null = null;
      if (repeats) {
        await Parse.Cloud.run("createPlanSeries", {
          ...shared,
          firstInstanceDate: when,
          freq: seriesFreq,
          maxOccurrences: SERIES_DEFAULT_OCCURRENCES,
        });
      } else {
        const res = (await Parse.Cloud.run("createManualPlan", {
          ...shared,
          date: when,
          isHosted: true,
          clientTimeZone: tz,
        })) as { eventGroupId?: string };
        eventGroupId = res?.eventGroupId || null;
      }

      // Sync is a bonus, never a gate — a Google failure can't fail the plan.
      if (eventGroupId && googleConnected) {
        Parse.Cloud.run("syncPlanToCalendar", {
          eventGroupId, action: "create", userTimezone: tz,
        }).catch(() => { /* logged server-side */ });
      }

      setCreated({
        eventGroupId,
        inviteUrl: eventGroupId ? `${APP_LINK_URL}/p/${eventGroupId}` : null,
        title: title.trim(),
      });
      onCreated({
        eventGroupId,
        inviteUrl: eventGroupId ? `${APP_LINK_URL}/p/${eventGroupId}` : null,
        title: title.trim(),
      });
    } catch (e: unknown) {
      setErrors({ form: e instanceof Error ? e.message : "Couldn't create the plan." });
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Google Calendar connect (full-page redirect) ------------------------
  async function connectGoogleCalendar() {
    try {
      const snapshot: NewPlanDraftSnapshot = {
        prompt, draftApplied, title, description, date, time,
        venueQuery, venue, capacity, hostNote, postTo,
        hideVenue, requireApproval, repeats, seriesFreq,
      };
      try { sessionStorage.setItem(ME_PLAN_DRAFT_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("openNewPlan", "1");
      const res = (await Parse.Cloud.run("createGoogleCalendarConnectUrl", {
        returnTo: returnUrl.toString(),
      })) as { url?: string };
      if (res?.url) { window.location.href = res.url; return; }
      setErrors((p) => ({ ...p, form: "Couldn't start the Google connect." }));
    } catch (e: unknown) {
      setErrors((p) => ({ ...p, form: e instanceof Error ? e.message : "Google connect failed." }));
    }
  }

  // ---- Pieces --------------------------------------------------------------
  const aiBlock = (
    <div className="np-ai">
      <div className="np-ai-label">Describe it, I&rsquo;ll draft the plan.</div>
      <div className="np-ai-row">
        <input
          className="np-ai-in"
          value={prompt}
          autoFocus
          placeholder="Sunset run in Prospect Park Sunday 6:30"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runDraft(); } }}
        />
        <button
          className="np-ai-go"
          onClick={runDraft}
          disabled={drafting || !prompt.trim()}
          aria-label="Draft the plan"
        >
          {drafting ? "…" : "→"}
        </button>
      </div>
      {!narrow && draftApplied && !draftError && (
        <div className="np-ai-ok">
          <span className="np-check">✓</span>
          <span>Drafted title, date, time and venue. Everything below is editable.</span>
        </div>
      )}
      {draftError && <div className="np-ai-err">{draftError}</div>}
    </div>
  );

  const basics = (
    <>
      <div className="np-label">TITLE</div>
      <input
        className={`np-under ${narrow ? "np-under-lg-m" : "np-under-lg"}`}
        value={title}
        placeholder="Plan title"
        onChange={(e) => { touch("title"); setTitle(e.target.value); }}
      />
      {errors.title && <div className="np-err">{errors.title}</div>}

      <div className="np-row" style={{ marginTop: 20 }}>
        <div className="np-col">
          <div className="np-label">DATE</div>
          <input
            type="date"
            className="np-under"
            value={date}
            min={todayISO()}
            onChange={(e) => { touch("date"); setDate(e.target.value); }}
          />
        </div>
        <div className={narrow ? "np-col" : "np-col-time"}>
          <div className="np-label">TIME</div>
          <input
            type="time"
            className="np-under"
            value={time}
            onChange={(e) => { touch("time"); setTime(e.target.value); }}
          />
        </div>
      </div>
      {(errors.date || errors.time) && <div className="np-err">{errors.date || errors.time}</div>}

      <div className="np-label" style={{ marginTop: 20 }}>VENUE</div>
      <VenueSearch
        key={venueKey}
        value={venueQuery}
        onChange={(v) => { touch("venue"); setVenueQuery(v); if (!v) setVenue(null); }}
        onSelect={(v) => { setVenue(v); setVenueQuery(v.name); }}
        placeholder="Search for a place, or leave it TBD"
        className="np-under"
        autoResolveInitial
      />
      {venueQuery.trim() && !venue && (
        <div className="np-hint">Pick a result so guests get directions.</div>
      )}
    </>
  );

  const suggestionCard = hints && hintDate && hintTime ? (
    <div className="np-card">
      <div className="np-card-label">WHAT WORKS FOR YOUR FOLLOWERS</div>
      <div className="np-card-line">
        {hints.bestDay!.day}s draw {hints.bestDay!.sharePct}% of RSVPs · {hints.bestTime!.bucket} starts work best
      </div>
      <button
        className="np-secondary"
        onClick={() => { touch("date"); touch("time"); setDate(hintDate); setTime(hintTime); }}
      >
        Use {dateLabel(hintDate)} · {timeLabel(hintTime)}
      </button>
    </div>
  ) : null;

  const coverDrop = (
    <>
      <button
        className={`np-drop ${coverPreview ? "np-drop-has" : ""}`}
        onClick={() => fileRef.current?.click()}
        type="button"
      >
        {coverPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverPreview} alt="" className="np-drop-img" />
        ) : (
          <>Add cover image <span className="np-optional">(optional)</span></>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => pickCover(e.target.files?.[0])}
      />
      {errors.cover && <div className="np-err">{errors.cover}</div>}
    </>
  );

  const capacityRow = (
    <>
      <div className="np-row">
        <div className="np-col">
          <div className="np-label sm">CAPACITY</div>
          <input
            className="np-under"
            inputMode="numeric"
            value={capacity}
            placeholder="No limit"
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <div className="np-col">
          <div className="np-label sm">AFTER FULL</div>
          {/* Waitlist is how Leaf behaves when a capped plan fills — it isn't a
              choice the server models, so this reports it rather than faking a
              select that would silently do nothing. */}
          <div className="np-under np-static">Waitlist</div>
        </div>
      </div>
      {errors.capacity && <div className="np-err">{errors.capacity}</div>}
    </>
  );

  const toggleRows = (
    <div className="np-toggles">
      <Toggle
        label="Hide venue until RSVP"
        helper={narrow ? "Only the neighborhood shows publicly" : undefined}
        on={hideVenue}
        onChange={setHideVenue}
        big={narrow}
      />
      <Toggle
        label={narrow ? "Require approval to attend" : "Require approval"}
        helper={narrow ? "Approve visitors before confirming" : undefined}
        on={requireApproval}
        onChange={setRequireApproval}
        big={narrow}
      />
      <Toggle
        label="Repeats"
        helper={narrow ? "Recreate this plan each cycle" : undefined}
        on={repeats}
        onChange={setRepeats}
        big={narrow}
        // A series is created by the calendar's owner/co-host — posting to a
        // calendar you only follow can't carry one.
        disabled={postTo !== LINK_ONLY && !(options.find((o) => o.id === postTo)?.owned ?? false)}
      />
      {repeats && (
        <div className="np-freq">
          <span>Every</span>
          <select
            value={seriesFreq}
            onChange={(e) => setSeriesFreq(e.target.value as "weekly" | "biweekly" | "monthly")}
          >
            <option value="weekly">week</option>
            <option value="biweekly">other week</option>
            <option value="monthly">month</option>
          </select>
          <span>· {SERIES_DEFAULT_OCCURRENCES} times</span>
        </div>
      )}
    </div>
  );

  const syncButton = (
    <button
      className={`np-sync ${googleConnected ? "on" : ""}`}
      disabled={googleConnected === true}
      onClick={connectGoogleCalendar}
    >
      {googleConnected === true ? "SYNCING TO GOOGLE CALENDAR" : "SYNC TO CALENDAR"}
    </button>
  );

  const postToChips = (
    <>
      <div className="np-label" style={{ marginBottom: 9 }}>POST TO</div>
      <div className="np-chips">
        <button
          className={`np-chip ${postTo === LINK_ONLY ? "on" : ""}`}
          onClick={() => setPostTo(LINK_ONLY)}
        >
          Invite link only
        </button>
        {options.map((o) => (
          <button
            key={o.id}
            className={`np-chip ${postTo === o.id ? "on" : ""}`}
            onClick={() => { setPostTo(o.id); if (!o.owned) setRepeats(false); }}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div className="np-hint">
        {postTo === LINK_ONLY
          ? "Lives on your own calendar. Share the link — guests RSVP by phone, no account."
          : "Posts to that calendar. Its followers see it, and its rules apply."}
      </div>
    </>
  );

  // ---- Success -------------------------------------------------------------
  if (created) {
    return (
      <div className="np-root">
        <style>{NP_CSS}</style>
        <div className="np-overlay" onClick={onClose}>
          <div
            className={`np-sheet ${narrow ? "m" : "d"}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="np-head">
              <span className="np-head-t">PLAN IS LIVE</span>
              <button className="np-x" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="np-body">
              <h2 className="np-done-title">{created.title}</h2>
              <p className="np-done-sub">
                {date && timeLabel(time)
                  ? `${dateLabel(date)} · ${timeLabel(time)}${venue ? ` · ${venue.name}` : ""}`
                  : "It's on your calendar."}
              </p>
              {created.inviteUrl ? (
                <>
                  <div className="np-link">
                    <span>{created.inviteUrl.replace(/^https?:\/\//, "")}</span>
                    <button
                      className="np-copy"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(created.inviteUrl!);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1600);
                        } catch { /* clipboard blocked */ }
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="np-done-foot">
                    Text it to whoever you want there. They tap Count me in — no account,
                    no app.
                  </p>
                </>
              ) : (
                <p className="np-done-foot">Your repeating plans are on the calendar.</p>
              )}
              <div className="np-done-actions">
                <button className="np-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Mobile sheet (2a / 3b) ---------------------------------------------
  const groupsExpanded = moreOpen || privacyOpen;
  const showSummary = narrow && draftApplied && groupsExpanded && !editingBasics && !!title;

  return (
    <div className="np-root">
      <style>{NP_CSS}</style>
      <div className="np-overlay" onClick={requestClose}>
        <div
          className={`np-sheet ${narrow ? "m" : "d"}`}
          role="dialog"
          aria-modal="true"
          aria-label="New plan"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="np-head">
            <span className="np-head-t">NEW PLAN</span>
            <button className="np-x" onClick={requestClose} aria-label="Close">×</button>
          </div>

          <div className="np-body">
            {errors.form && <div className="np-formerr">{errors.form}</div>}

            {narrow ? (
              <>
                {showSummary ? (
                  <div className="np-summary">
                    <div className="np-summary-t">{title}</div>
                    <div className="np-summary-l">
                      {[date && dateLabel(date), time && timeLabel(time), venue?.name || venueQuery]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <button className="np-editbasics" onClick={() => setEditingBasics(true)}>
                      Edit the basics
                    </button>
                  </div>
                ) : (
                  <>
                    {aiBlock}
                    {draftApplied && !draftError && (
                      <div className="np-ai-ok m">
                        <span className="np-check">✓</span>
                        <span>Drafted. Check the three below and you&rsquo;re done.</span>
                      </div>
                    )}
                    <div style={{ marginTop: draftApplied ? 0 : 16 }}>{basics}</div>
                  </>
                )}

                {suggestionCard && <div style={{ marginTop: 16 }}>{suggestionCard}</div>}

                <button
                  className="np-group"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                >
                  <span>
                    <span className="np-group-t">More options</span>
                    <span className="np-group-s">Description · cover image · capacity · host note</span>
                  </span>
                  <span className="np-chev">{moreOpen ? "⌃" : "⌄"}</span>
                </button>
                {moreOpen && (
                  <div className="np-group-body">
                    <div className="np-label">DESCRIPTION</div>
                    <textarea
                      className="np-box"
                      value={description}
                      placeholder="What's this plan about?"
                      onChange={(e) => { touch("description"); setDescription(e.target.value); }}
                    />
                    <div style={{ marginTop: 18 }}>{coverDrop}</div>
                    <div style={{ marginTop: 18 }}>{capacityRow}</div>
                    <div className="np-label" style={{ marginTop: 18 }}>HOST NOTE</div>
                    <textarea
                      className="np-box sm"
                      value={hostNote}
                      placeholder="A note for attendees (visible in the plan)"
                      onChange={(e) => setHostNote(e.target.value)}
                    />
                  </div>
                )}

                <button
                  className="np-group"
                  onClick={() => setPrivacyOpen((v) => !v)}
                  aria-expanded={privacyOpen}
                >
                  <span>
                    <span className="np-group-t">Privacy &amp; repeats</span>
                    <span className="np-group-s">
                      {hideVenue ? "Venue hidden until RSVP is on" : "Venue shows publicly"}
                      {requireApproval ? " · approval on" : ""}
                      {repeats ? " · repeating" : ""}
                    </span>
                  </span>
                  <span className="np-chev">{privacyOpen ? "⌃" : "⌄"}</span>
                </button>
                {privacyOpen && (
                  <div className="np-group-body">
                    {toggleRows}
                    {syncButton}
                  </div>
                )}

                <div style={{ marginTop: 18 }}>{postToChips}</div>
              </>
            ) : (
              <>
                {aiBlock}
                <div className="np-cols">
                  <div className="np-main">
                    {basics}
                    <div className="np-label" style={{ marginTop: 20 }}>DESCRIPTION</div>
                    <textarea
                      className="np-box"
                      value={description}
                      placeholder="What's this plan about?"
                      onChange={(e) => { touch("description"); setDescription(e.target.value); }}
                    />
                    <div style={{ marginTop: 20 }}>{postToChips}</div>
                  </div>
                  <div className="np-side">
                    {suggestionCard}
                    {coverDrop}
                    <div style={{ marginTop: 14 }}>{capacityRow}</div>
                    <div className="np-label sm" style={{ marginTop: 18 }}>HOST NOTE</div>
                    <textarea
                      className="np-box sm"
                      value={hostNote}
                      placeholder="A note for attendees"
                      onChange={(e) => setHostNote(e.target.value)}
                    />
                    <div style={{ marginTop: 14 }}>{toggleRows}</div>
                    {syncButton}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="np-foot">
            <button className="np-cancel" onClick={requestClose}>CANCEL</button>
            <button className="np-primary" disabled={submitting} onClick={submit}>
              {submitting ? "CREATING…" : "CREATE PLAN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Toggle ----------------------------------------------------------------
function Toggle({
  label, helper, on, onChange, big, disabled,
}: {
  label: string;
  helper?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  big?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`np-trow ${disabled ? "off" : ""}`}>
      <div>
        <div className="np-tlabel">{label}</div>
        {helper && <div className="np-thelp">{helper}</div>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        className={`np-switch ${big ? "big" : ""} ${on ? "on" : ""}`}
        onClick={() => !disabled && onChange(!on)}
      >
        <span className="np-knob" />
      </button>
    </div>
  );
}

// ---- Scoped CSS (design tokens from the /me handoff spec) ------------------
const NP_CSS = `
.np-root{
  --ink:#17150f; --body:#6f6a5f; --muted:#8b8578; --faint:#b5afa2;
  --green:#1f6b45; --green-soft:#7fb894; --orange:#c2410c;
  --surface:#fff; --recessed:#faf9f7;
  --sans:var(--font-me-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --serif:var(--font-me-serif),Georgia,serif;
  font-family:var(--sans);
}
.np-root *{box-sizing:border-box}
.np-overlay{position:fixed;inset:0;z-index:80;background:rgba(23,21,15,.55);
  display:flex;align-items:center;justify-content:center;padding:24px}
.np-sheet{background:var(--surface);width:100%;max-width:720px;max-height:92vh;
  display:flex;flex-direction:column;border-radius:14px;overflow:hidden;
  animation:npin .18s ease}
@keyframes npin{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}
.np-head{display:flex;align-items:center;justify-content:space-between;
  padding:16px 24px;border-bottom:1px solid rgba(0,0,0,.09);flex:none}
.np-head-t{font-size:12.5px;font-weight:600;letter-spacing:.13em;color:var(--muted)}
.np-x{width:44px;height:44px;margin:-10px -12px -10px 0;border:0;background:none;
  font-size:22px;line-height:1;color:var(--ink);cursor:pointer}
.np-body{padding:20px 24px 24px;overflow-y:auto;flex:1 1 auto}
.np-foot{display:flex;align-items:center;justify-content:flex-end;gap:16px;
  padding:14px 24px;border-top:1px solid rgba(0,0,0,.09);background:#fff;flex:none}
.np-cancel{border:0;background:none;cursor:pointer;font-family:var(--sans);
  font-size:12.5px;font-weight:600;letter-spacing:.09em;color:var(--body);padding:12px 6px}
.np-primary{border:0;background:var(--ink);color:#fff;cursor:pointer;
  font-family:var(--sans);font-size:12.5px;font-weight:600;letter-spacing:.09em;
  padding:14px 22px;border-radius:8px}
.np-primary:disabled{opacity:.55;cursor:default}
.np-formerr{background:#fdf0eb;border:1px solid rgba(194,65,12,.3);color:var(--orange);
  border-radius:8px;padding:10px 12px;font-size:12.5px;margin-bottom:16px}

/* AI draft block */
.np-ai{border:1px solid #bfe0cc;background:#f2faf5;border-radius:12px;padding:14px;margin-bottom:20px}
.np-ai-label{font-size:12.5px;font-weight:500;color:var(--green);margin-bottom:10px}
.np-ai-row{display:flex;gap:9px}
.np-ai-in{flex:1 1 auto;min-width:0;background:#fff;border:1px solid #cfe6d8;border-radius:9px;
  padding:12px 13px;font-family:var(--sans);font-size:13.5px;color:var(--ink)}
.np-ai-in:focus{outline:2px solid var(--green-soft);outline-offset:1px}
.np-ai-go{flex:none;width:46px;border:0;background:var(--green-soft);color:#fff;
  font-size:16px;border-radius:9px;cursor:pointer}
.np-ai-go:disabled{opacity:.5;cursor:default}
.np-ai-ok{display:flex;align-items:center;gap:7px;margin-top:11px;
  font-size:11.5px;color:#3f6b52}
.np-ai-ok.m{margin:14px 0 16px;color:var(--body)}
.np-check{width:15px;height:15px;flex:none;border-radius:999px;background:var(--green);
  color:#fff;font-size:9.5px;font-weight:500;display:flex;align-items:center;justify-content:center}
.np-ai-err{margin-top:10px;font-size:11.5px;color:var(--orange)}

/* Two-column desktop form */
.np-cols{display:flex;gap:26px}
.np-main{flex:1 1 0;min-width:0}
.np-side{width:264px;flex:none}
.np-row{display:flex;gap:14px}
.np-col{flex:1 1 0;min-width:0}
.np-col-time{width:104px;flex:none}

/* Fields */
.np-label{font-size:10.5px;font-weight:600;letter-spacing:.13em;color:var(--muted);
  margin-bottom:8px;text-transform:uppercase}
.np-label.sm{font-size:10px}
.np-under{display:block;width:100%;border:0;border-bottom:1px solid rgba(0,0,0,.18);
  border-radius:0;background:none;padding:0 0 9px;font-family:var(--sans);
  font-size:14.5px;color:var(--ink)}
.np-under::placeholder{color:var(--faint)}
.np-under:focus{outline:0;border-bottom-color:rgba(0,0,0,.55)}
.np-under-lg{font-size:18px}
.np-under-lg-m{font-size:17px}
.np-static{color:var(--body)}
.np-box{display:block;width:100%;border:1px solid rgba(0,0,0,.13);border-radius:10px;
  padding:11px 12px;min-height:62px;font-family:var(--sans);font-size:13px;line-height:1.5;
  color:var(--ink);resize:vertical}
.np-box.sm{min-height:52px}
.np-box::placeholder{color:var(--muted)}
.np-box:focus{outline:2px solid rgba(31,107,69,.35);outline-offset:1px}
.np-err{margin-top:6px;font-size:11px;color:var(--orange)}
.np-hint{margin-top:7px;font-size:11px;color:var(--muted)}

/* Suggestion card */
.np-card{border:1px solid rgba(0,0,0,.1);border-radius:11px;padding:12px 13px;margin-bottom:14px}
.np-card-label{font-size:10px;font-weight:600;letter-spacing:.13em;color:var(--muted);margin-bottom:6px}
.np-card-line{font-size:12.5px;line-height:1.45;color:var(--ink);margin-bottom:10px}
.np-secondary{border:1px solid rgba(0,0,0,.2);background:#fff;color:var(--ink);
  font-family:var(--sans);font-size:11.5px;font-weight:500;padding:8px 12px;
  border-radius:8px;cursor:pointer}
.np-secondary:hover{border-color:rgba(0,0,0,.35);background:var(--recessed)}

/* Cover dropzone */
.np-drop{display:block;width:100%;border:1px dashed rgba(0,0,0,.2);background:none;
  border-radius:11px;padding:26px 12px;text-align:center;font-family:var(--sans);
  font-size:12px;color:var(--muted);cursor:pointer}
.np-drop:hover{border-color:rgba(0,0,0,.35)}
.np-drop-has{padding:0;overflow:hidden;border-style:solid}
.np-drop-img{display:block;width:100%;height:120px;object-fit:cover}
.np-optional{color:var(--faint)}

/* Toggles */
.np-toggles{display:flex;flex-direction:column}
.np-trow{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:11px 0;border-top:1px solid rgba(0,0,0,.08)}
.np-trow:last-of-type{border-bottom:1px solid rgba(0,0,0,.08)}
.np-trow.off{opacity:.45}
.np-tlabel{font-size:12.5px;font-weight:500;color:var(--ink)}
.np-thelp{font-size:11px;color:var(--muted);margin-top:2px}
.np-switch{position:relative;flex:none;width:40px;height:23px;border:0;border-radius:999px;
  background:#e3e0d8;cursor:pointer;padding:0;transition:background 120ms ease}
.np-switch.on{background:var(--ink)}
.np-switch.big{width:44px;height:26px}
.np-switch:disabled{cursor:default}
.np-knob{position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:999px;
  background:#fff;transition:transform 120ms ease}
.np-switch.big .np-knob{width:20px;height:20px}
.np-switch.on .np-knob{transform:translateX(17px)}
.np-switch.big.on .np-knob{transform:translateX(18px)}
.np-freq{display:flex;align-items:center;gap:8px;padding:11px 0;font-size:12px;color:var(--body)}
.np-freq select{font-family:var(--sans);font-size:12px;border:1px solid rgba(0,0,0,.18);
  border-radius:6px;padding:6px 8px;background:#fff;color:var(--ink)}

.np-sync{display:block;width:100%;margin-top:14px;border:1px solid rgba(0,0,0,.2);
  background:#fff;color:var(--ink);font-family:var(--sans);font-size:11.5px;font-weight:600;
  letter-spacing:.11em;padding:12px 0;border-radius:9px;cursor:pointer}
.np-sync:hover{border-color:rgba(0,0,0,.35);background:var(--recessed)}
.np-sync.on{border-color:rgba(31,107,69,.45);color:var(--green);cursor:default}

/* Post-to chips */
.np-chips{display:flex;flex-wrap:wrap;gap:7px}
.np-chip{border:1px solid rgba(0,0,0,.14);background:#fff;color:var(--ink);
  border-radius:999px;padding:8px 13px;font-family:var(--sans);font-size:11.5px;cursor:pointer}
.np-chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
.np-chip:focus-visible{outline:2px solid var(--green);outline-offset:2px}

/* Mobile groups (2a → 3b) */
.np-group{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  border:1px solid rgba(0,0,0,.14);background:#fff;border-radius:11px;padding:14px 13px;
  margin-top:10px;cursor:pointer;text-align:left;font-family:var(--sans)}
.np-group-t{display:block;font-size:13px;font-weight:500;color:var(--ink)}
.np-group-s{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.np-chev{flex:none;font-size:13px;color:var(--muted)}
.np-group-body{padding:16px 2px 4px}
.np-summary{border:1px solid rgba(0,0,0,.1);background:var(--recessed);border-radius:11px;
  padding:12px 13px;margin-bottom:18px}
.np-summary-t{font-size:12.5px;color:var(--ink)}
.np-summary-l{font-size:11.5px;color:var(--muted);margin-top:3px}
.np-editbasics{display:inline-block;margin-top:9px;border:0;background:none;padding:0;
  font-family:var(--sans);font-size:11px;color:var(--body);text-decoration:underline;cursor:pointer}

/* Success */
.np-done-title{font-family:var(--serif);font-size:26px;font-weight:400;color:var(--ink);margin:4px 0 6px}
.np-done-sub{font-size:12.5px;color:var(--muted);margin-bottom:18px}
.np-link{display:flex;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.13);
  border-radius:10px;padding:10px 10px 10px 13px}
.np-link span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;
  font-family:var(--font-me-mono),ui-monospace,monospace;font-size:13px;color:var(--ink)}
.np-copy{flex:none;border:0;background:var(--ink);color:#fff;font-family:var(--sans);
  font-size:11.5px;font-weight:500;padding:9px 14px;border-radius:7px;cursor:pointer}
.np-done-foot{font-size:12px;line-height:1.6;color:var(--body);margin-top:14px}
.np-done-actions{display:flex;justify-content:flex-end;margin-top:20px}

@media(max-width:760px){
  .np-overlay{padding:0;align-items:stretch}
  .np-sheet{max-width:none;max-height:100vh;height:100vh;border-radius:0}
  .np-head{padding:14px 18px 12px}
  .np-body{padding:16px 18px 20px}
  .np-foot{padding:13px 18px calc(13px + env(safe-area-inset-bottom))}
  .np-cols{flex-direction:column;gap:0}
  .np-side{width:100%}
  .np-under{font-size:15px}
  .np-primary{padding:14px 20px}
  /* Every control clears 44px of thumb (spec: mobile hit targets) */
  .np-chip{padding:11px 15px;font-size:12px}
  .np-ai-go{min-height:44px}
  .np-secondary{padding:12px 14px}
  .np-sync{padding:14px 0;font-size:12px}
}
@media(prefers-reduced-motion:reduce){.np-root *{animation:none!important;transition:none!important}}
`;
