"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { findSeed, type SeedCalendar } from "@/lib/aiCalendarSeed";
import SignInModal from "@/components/SignInModal";

// Public calendar detail view + owner editing surface.
//
// Resolution order:
//   1. Try findSeed(slug) — client-side seed pool. Fast for the
//      pre-populated gallery; every seed slug hits here first.
//   2. Fall back to Parse.Cloud.run("getAICalendar", {slug}) — real
//      persisted rows (owned copies, generated freeform prompts, and
//      seed calendars that have been adopted at least once).
//
// The owner-editing UI renders when viewerIsOwner is true. Templates
// (origin=generated) are always read-only.

interface AICalendarPayload {
  objectId: string;
  slug: string;
  title: string;
  prompt: string;
  theme: string | null;
  area: string | null;
  visibility: string;
  origin: "generated" | "adopted_copy";
  ownerId: string | null;
  sourceCalendarId: string | null;
  adoptionCount: number;
  derivedAdoptionCount: number;
  events: Event[];
  venuesVerified: boolean;
  // Cover image the LLM picked for the calendar-level avatar. Applied
  // to the Groups row's group_profile_photo_url at adopt time so the
  // /org page picks it up too.
  coverImageUrl?: string | null;
  viewerIsOwner: boolean;
}

interface Event {
  name: string;
  time: string;
  venueLine: string;
  tag: string;
  tagVariant?: "default" | "amber";
  // Server may lock a specific calendar date for Shape B cadence prompts
  // ("4 times over 6 weeks"). Present → treat as fixed date; missing →
  // display-only weekly recurrence.
  dateISO?: string | null;
  isoDatetime?: string | null;
}

interface AdoptResponse {
  ownedSlug: string;
  ownedCalendarId: string;
  // When the server successfully created a real Leaf sub-calendar
  // (Groups row) under the user's primary org, we get its shareId and
  // parentOrgId here — the client routes to /org/<shareId>?welcome=1
  // so the adopted calendar lands in the same UX as any other Leaf
  // calendar. Missing (null) when the user has no primary org or hit
  // the tier calendar limit — the client falls back to /cal/<owned-slug>.
  shareId?: string | null;
  parentOrgId?: string | null;
  subCalendarId?: string | null;
  alreadyAdopted?: boolean;
}

function trackCalendarEvent(
  event:
    | "calendar_viewed"
    | "adopt_clicked"
    | "sign_in_from_adopt"
    | "adopted"
    | "adopt_failed"
    | "title_saved"
    | "event_added"
    | "event_edited"
    | "event_deleted"
    | "calendar_deleted",
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event: `c_${event}`, ...(detail || {}) });
}

// Convert a client-side SeedCalendar to the same shape as the server
// payload so the rest of the component only reads one type.
function seedToPayload(seed: SeedCalendar): AICalendarPayload {
  return {
    objectId: `seed-${seed.slug}`,
    slug: seed.slug,
    title: seed.title,
    prompt: seed.prompt,
    theme: seed.theme,
    area: seed.area,
    visibility: "public",
    origin: "generated",
    ownerId: null,
    sourceCalendarId: null,
    adoptionCount: seed.adoptionCount,
    derivedAdoptionCount: 0,
    events: seed.events.map((e) => ({
      name: e.name,
      time: e.time,
      venueLine: e.venueLine,
      tag: e.tag,
      tagVariant: e.tagVariant,
    })),
    venuesVerified: true,
    viewerIsOwner: false,
  };
}

export default function PublicCalendarPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug;

  const [cal, setCal] = useState<AICalendarPayload | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound">(
    "loading"
  );
  const [adopting, setAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  // Welcome popup fires when the visitor lands on their newly-adopted
  // owned copy (adopt flow pushes ?welcome=1). Shows once, then the
  // param is stripped so a refresh doesn't re-open it.
  const [showWelcome, setShowWelcome] = useState(false);

  const loadCalendar = useCallback(async () => {
    // Seed first — fast, always available.
    const seed = findSeed(slug);
    if (seed) {
      const payload = seedToPayload(seed);
      // Even a seeded slug may have a persisted template row (once
      // someone adopts it, the server materializes it and adoptionCount
      // starts drifting from the seed's starter number). Try the
      // server too so we render the freshest data if available.
      try {
        const server = (await Parse.Cloud.run("getAICalendar", {
          slug,
        })) as AICalendarPayload;
        setCal(server);
      } catch {
        // Server has no row yet — use the seed.
        setCal(payload);
      }
      setLoadState("ready");
      trackCalendarEvent("calendar_viewed", { slug, source: "seed" });
      return;
    }
    // Not a seed — must be a persisted row.
    try {
      const server = (await Parse.Cloud.run("getAICalendar", {
        slug,
      })) as AICalendarPayload;
      setCal(server);
      setLoadState("ready");
      trackCalendarEvent("calendar_viewed", { slug, source: "db" });
    } catch {
      setLoadState("notfound");
    }
  }, [slug]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (loadState !== "ready" || !cal) return;
    if (searchParams.get("adopt") !== "1") return;
    if (cal.viewerIsOwner) return; // already owned; nothing to adopt
    handleAdopt();
    const url = new URL(window.location.href);
    url.searchParams.delete("adopt");
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, cal]);

  // Welcome popup — fires when the visitor just adopted and landed
  // here via /cal/<owned-slug>?welcome=1. Only shows for owners (a
  // shared link with ?welcome=1 to a stranger wouldn't do anything
  // meaningful). Strips the param after so a refresh doesn't re-fire.
  useEffect(() => {
    if (loadState !== "ready" || !cal) return;
    if (searchParams.get("welcome") !== "1") return;
    if (!cal.viewerIsOwner) return;
    setShowWelcome(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", url.toString());
  }, [loadState, cal, searchParams]);

  async function handleAdopt() {
    if (!cal || adopting) return;
    trackCalendarEvent("adopt_clicked", { slug: cal.slug });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (Parse as any).User?.current?.();
    if (!current) {
      // Show the sign-in popup in-place instead of routing to /dashboard.
      // Keeps the visitor on the calendar they're looking at — after
      // successful sign-in the modal's callback fires runAdopt() so the
      // fork happens without a second click.
      trackCalendarEvent("sign_in_from_adopt", { slug: cal.slug });
      setShowSignIn(true);
      return;
    }

    await runAdopt();
  }

  async function runAdopt() {
    if (!cal) return;
    setAdopting(true);
    setAdoptError(null);
    try {
      const result = (await Parse.Cloud.run("adoptCalendar", {
        templateSlug: cal.slug,
        sourceSeed:
          cal.origin === "generated"
            ? {
                title: cal.title,
                prompt: cal.prompt,
                theme: cal.theme,
                area: cal.area,
                adoptionCount: cal.adoptionCount,
                events: cal.events,
              }
            : undefined,
      })) as AdoptResponse;
      trackCalendarEvent("adopted", {
        templateSlug: cal.slug,
        ownedSlug: result.ownedSlug,
      });
      // Prefer the real Leaf /org URL when the server created a real
      // sub-calendar (has shareId). Falls back to /cal/<owned-slug> when
      // the server skipped creation (no primary org / hit tier limit).
      // ?welcome=1 triggers the "Make it your own" popup on either page.
      if (result.shareId) {
        router.push(`/org/${result.shareId}?welcome=1`);
      } else {
        router.push(`/cal/${result.ownedSlug}?welcome=1`);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      trackCalendarEvent("adopt_failed", { slug: cal.slug, message: msg });
      setAdoptError(msg);
      setAdopting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-[14px]" style={{ color: "#6B7168" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading calendar…
        </div>
      </Shell>
    );
  }
  if (loadState === "notfound" || !cal) {
    return (
      <Shell>
        <div className="flex flex-col gap-4 max-w-md">
          <h1
            className="m-0 text-[24px] tracking-tight"
            style={{
              color: "#131714",
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              fontWeight: 400,
            }}
          >
            We couldn&apos;t find that calendar.
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color: "#6B7168" }}>
            It may have been removed, or the link is off.
          </p>
          <Link
            href="/calendars"
            className="inline-flex self-start items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold"
            style={{ background: "#1B4332", color: "#ffffff" }}
          >
            Browse the gallery <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </Shell>
    );
  }

  const isOwner = cal.viewerIsOwner;

  return (
    <Shell>
      <div className="flex flex-col gap-8 max-w-3xl">
        <Link
          href="/calendars"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] self-start"
          style={{ color: "#6B7168" }}
        >
          <ArrowLeft className="w-3 h-3" /> Gallery
        </Link>

        <TitleBlock cal={cal} isOwner={isOwner} onSaved={loadCalendar} />

        {!cal.venuesVerified && (
          <div
            className="rounded-xl border px-4 py-3 text-[12px] leading-relaxed"
            style={{
              borderColor: "rgba(200,138,59,0.35)",
              background: "rgba(200,138,59,0.08)",
              color: "#8A5F1E",
            }}
          >
            These venues weren&apos;t verified against Google Places — double-check hours before you go.
          </div>
        )}

        <EventsList
          cal={cal}
          isOwner={isOwner}
          onChanged={loadCalendar}
        />

        {!isOwner ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAdopt}
              disabled={adopting}
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-[14px] font-semibold self-start disabled:opacity-70"
              style={{ background: "#131714", color: "#ffffff" }}
            >
              {adopting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Making it yours…
                </>
              ) : (
                <>
                  Make it yours <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {adoptError && (
              <p className="text-[13px]" style={{ color: "#B03030" }}>
                {adoptError}
              </p>
            )}
            <p className="text-[12px] max-w-md" style={{ color: "#6B7168" }}>
              Make it yours to save your own editable copy and start planning.
            </p>
          </div>
        ) : (
          <DangerZone cal={cal} />
        )}
      </div>

      {showSignIn && cal && (
        <SignInModal
          title={`Sign in to make "${cal.title}" yours`}
          subtitle="One tap creates your editable copy. You can edit, share, and turn any event into a real plan."
          onClose={() => setShowSignIn(false)}
          onSignedIn={async () => {
            setShowSignIn(false);
            await runAdopt();
          }}
        />
      )}

      {showWelcome && cal && (
        <WelcomePopup cal={cal} onClose={() => setShowWelcome(false)} />
      )}
    </Shell>
  );
}

// ─── Title block (view + inline edit) ─────────────────────────────

function TitleBlock({
  cal,
  isOwner,
  onSaved,
}: {
  cal: AICalendarPayload;
  isOwner: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cal.title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(cal.title);
  }, [cal.title]);

  async function handleSave() {
    if (!draft.trim() || draft.trim() === cal.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await Parse.Cloud.run("updateAICalendar", {
        slug: cal.slug,
        title: draft.trim(),
      });
      trackCalendarEvent("title_saved", { slug: cal.slug });
      await onSaved();
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: "#6B7168" }}
      >
        {cal.area || "Somewhere"} · {cal.theme || "mix"}
      </span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 border-b outline-none text-[28px] tracking-tight bg-transparent"
            style={{
              color: "#131714",
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              fontWeight: 400,
              borderColor: "#1B4332",
            }}
            autoFocus
            maxLength={120}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-2 rounded-full"
            title="Save"
            style={{ background: "#1B4332", color: "#fff" }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setDraft(cal.title);
              setEditing(false);
            }}
            className="p-2 rounded-full hover:bg-[#E8EFE9]"
            title="Cancel"
            style={{ color: "#6B7168" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <h1
            className="m-0 text-balance tracking-tight flex-1"
            style={{
              color: "#131714",
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 400,
              lineHeight: 1.1,
            }}
          >
            {cal.title}
          </h1>
          {isOwner && (
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-full hover:bg-[#E8EFE9] mt-2"
              title="Edit title"
              style={{ color: "#6B7168" }}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <p
        className="text-[15px] leading-relaxed max-w-[60ch] m-0"
        style={{ color: "#6B7168" }}
      >
        Originally prompted with <em>&ldquo;{cal.prompt}&rdquo;</em>. Adopted by{" "}
        <strong
          style={{ color: "#131714", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {cal.adoptionCount} people
        </strong>{" "}
        so far.
      </p>
    </div>
  );
}

// ─── Events list (view + owner edit/add/delete) ───────────────────

function EventsList({
  cal,
  isOwner,
  onChanged,
}: {
  cal: AICalendarPayload;
  isOwner: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const events = useMemo(() => cal.events || [], [cal.events]);

  async function persist(next: Event[]) {
    setSaving(true);
    try {
      await Parse.Cloud.run("updateAICalendar", {
        slug: cal.slug,
        events: next,
      });
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(idx: number) {
    if (!confirm(`Remove ${events[idx].name}?`)) return;
    const next = events.filter((_, i) => i !== idx);
    trackCalendarEvent("event_deleted", { slug: cal.slug, name: events[idx].name });
    await persist(next);
  }

  async function handleSaveEvent(idx: number | "new", draft: Event) {
    let next: Event[];
    if (idx === "new") {
      next = [...events, draft];
      trackCalendarEvent("event_added", { slug: cal.slug, name: draft.name });
    } else {
      next = events.map((e, i) => (i === idx ? draft : e));
      trackCalendarEvent("event_edited", { slug: cal.slug, name: draft.name });
    }
    await persist(next);
    setEditing(null);
    setAdding(false);
  }

  return (
    <div
      className="bg-white rounded-2xl border p-6 md:p-8 flex flex-col gap-5"
      style={{ borderColor: "#E3E5DE" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "#6B7168" }}
        >
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        {saving && (
          <span
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: "#6B7168" }}
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving…
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-4 m-0 p-0 list-none">
        {[...events]
          .map((ev, i) => ({ ev, i }))
          // Client-side chronological sort. Safety net for older AICalendar
          // rows persisted before the server sort landed; Shape B cadence
          // events came out in emit order and are now shown in date order.
          // Events without isoDatetime sink to the end so weekly Shape A
          // pointers don't get randomly displaced by fixed-date siblings.
          .sort((a, b) => {
            const at = a.ev.isoDatetime ? Date.parse(a.ev.isoDatetime) : Number.POSITIVE_INFINITY;
            const bt = b.ev.isoDatetime ? Date.parse(b.ev.isoDatetime) : Number.POSITIVE_INFINITY;
            return at - bt;
          })
          .map(({ ev, i }, renderIndex, arr) => (
          <li
            key={i}
            className="flex items-start gap-4 pb-4"
            style={{
              borderBottom:
                renderIndex < arr.length - 1 ? "1px solid #E3E5DE" : "none",
            }}
          >
            {editing === i ? (
              <EventEditor
                initial={ev}
                onCancel={() => setEditing(null)}
                onSave={(draft) => handleSaveEvent(i, draft)}
                saving={saving}
              />
            ) : (
              <>
                <div className="flex flex-col items-end w-20 shrink-0 pt-0.5">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.12em] rounded px-1.5 py-0.5"
                    style={{
                      background:
                        ev.tagVariant === "amber"
                          ? "rgba(200,138,59,0.14)"
                          : "#E8EFE9",
                      color: ev.tagVariant === "amber" ? "#C88A3B" : "#1B4332",
                    }}
                  >
                    {ev.tag}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span
                    className="tabular-nums text-[13px] font-medium"
                    style={{ color: "#131714" }}
                  >
                    {ev.time}
                  </span>
                  <h3
                    className="m-0 text-[18px] text-balance tracking-tight"
                    style={{
                      color: "#131714",
                      fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                      fontWeight: 400,
                    }}
                  >
                    {ev.name}
                  </h3>
                  <span className="text-[13px]" style={{ color: "#6B7168" }}>
                    {ev.venueLine}
                  </span>
                </div>
                {isOwner && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(i)}
                      className="p-1.5 rounded hover:bg-[#E8EFE9]"
                      title="Edit"
                      style={{ color: "#6B7168" }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(i)}
                      className="p-1.5 rounded hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                      style={{ color: "#6B7168" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <>
          {adding ? (
            <EventEditor
              initial={{
                name: "",
                time: "",
                venueLine: "",
                tag: "Event",
                tagVariant: "default",
              }}
              onCancel={() => setAdding(false)}
              onSave={(draft) => handleSaveEvent("new", draft)}
              saving={saving}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 text-[13px] font-semibold self-start rounded-full px-4 py-2 border"
              style={{
                borderColor: "#1B4332",
                color: "#1B4332",
                background: "#fff",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add event
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EventEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Event;
  onSave: (draft: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [time, setTime] = useState(initial.time);
  const [venueLine, setVenueLine] = useState(initial.venueLine);
  const [tag, setTag] = useState(initial.tag || "Event");
  const [tagVariant, setTagVariant] = useState<"default" | "amber">(
    initial.tagVariant === "amber" ? "amber" : "default"
  );

  return (
    <div
      className="flex-1 rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "#E3E5DE", background: "#FBFAF6" }}
    >
      <label className="flex flex-col gap-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "#6B7168" }}
        >
          Venue name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bar Camillo"
          className="border-b bg-transparent outline-none py-1.5 text-[15px]"
          style={{ color: "#131714", borderColor: "#E3E5DE" }}
          autoFocus
          maxLength={120}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#6B7168" }}
          >
            When
          </span>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="Fri · 7:30 PM"
            className="border-b bg-transparent outline-none py-1.5 text-[14px]"
            style={{ color: "#131714", borderColor: "#E3E5DE" }}
            maxLength={60}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#6B7168" }}
          >
            Tag
          </span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Cocktails"
            className="border-b bg-transparent outline-none py-1.5 text-[14px]"
            style={{ color: "#131714", borderColor: "#E3E5DE" }}
            maxLength={40}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "#6B7168" }}
        >
          Address / descriptor
        </span>
        <input
          value={venueLine}
          onChange={(e) => setVenueLine(e.target.value)}
          placeholder="210 Grand Ave · natural wine"
          className="border-b bg-transparent outline-none py-1.5 text-[14px]"
          style={{ color: "#131714", borderColor: "#E3E5DE" }}
          maxLength={200}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-[12px]" style={{ color: "#6B7168" }}>
        <input
          type="checkbox"
          checked={tagVariant === "amber"}
          onChange={(e) => setTagVariant(e.target.checked ? "amber" : "default")}
        />
        Highlight as the finale (amber tag)
      </label>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() =>
            onSave({
              name: name.trim() || "Untitled",
              time: time.trim(),
              venueLine: venueLine.trim(),
              tag: tag.trim() || "Event",
              tagVariant,
            })
          }
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
          style={{ background: "#1B4332", color: "#fff" }}
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Save event
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          className="text-[13px] font-semibold px-3 py-2"
          style={{ color: "#6B7168" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Danger zone (owner-only) ─────────────────────────────────────

function DangerZone({ cal }: { cal: AICalendarPayload }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${cal.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Parse.Cloud.run("deleteAICalendar", { slug: cal.slug });
      trackCalendarEvent("calendar_deleted", { slug: cal.slug });
      router.push("/calendars");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <div className="border-t pt-6 mt-4" style={{ borderColor: "#E3E5DE" }}>
      <p
        className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
        style={{ color: "#6B7168" }}
      >
        Danger zone
      </p>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 border rounded-full disabled:opacity-60"
        style={{
          borderColor: "#B03030",
          color: "#B03030",
          background: "#fff",
        }}
      >
        {deleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Delete this calendar
      </button>
    </div>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────

// ─── Welcome popup (post-adopt) ──────────────────────────────────
//
// Mirrors the "Make it your own" pattern the /org calendar-creation
// flow uses at /org/[shareId]?welcome=1. Three CTAs:
//   - Copy link (with a two-second "Copied" confirmation)
//   - Edit calendar (dismisses; the visitor is already on the surface
//     where editing happens, so we scroll to the top so the title
//     click-to-edit is in view)
//   - Skip and view my calendar (plain dismiss)

function WelcomePopup({
  cal,
  onClose,
}: {
  cal: AICalendarPayload;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cal/${cal.slug}`
      : `/cal/${cal.slug}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — do nothing; visitor can select the URL text.
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4"
      style={{ background: "rgba(15, 18, 16, 0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 transition-colors"
          aria-label="Close"
          style={{ color: "#6B7168" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 md:p-10 flex flex-col gap-6">
          <div
            className="self-center w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#E8EFE9", color: "#1B4332" }}
          >
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="text-center flex flex-col gap-2">
            <h2
              className="m-0 text-[24px] tracking-tight"
              style={{
                color: "#131714",
                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                fontWeight: 400,
                lineHeight: 1.15,
                textWrap: "balance",
              }}
            >
              It&apos;s yours.
            </h2>
            <p
              className="m-0 text-[14px] leading-relaxed"
              style={{ color: "#6B7168" }}
            >
              Share the link with your people, or edit the calendar first to
              make it your own.
            </p>
          </div>

          {/* Copy link — inline URL + copy button */}
          <div
            className="rounded-xl p-4 flex items-center justify-between gap-3"
            style={{ background: "#FBFAF6", border: "1px solid #E3E5DE" }}
          >
            <div className="min-w-0 flex flex-col gap-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "#6B7168" }}
              >
                Your calendar URL
              </span>
              <span
                className="text-[13px] truncate font-mono"
                style={{ color: "#131714" }}
                title={shareUrl}
              >
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors"
              style={{
                background: copied ? "#1B4332" : "#131714",
                color: "#ffffff",
              }}
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

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[13px] font-semibold transition-colors"
              style={{ background: "#131714", color: "#ffffff" }}
            >
              <Pencil className="w-3.5 h-3.5" /> Edit the calendar
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 text-[12px] uppercase tracking-widest font-medium transition-colors"
              style={{ color: "#6B7168" }}
            >
              Skip and view my calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // Show "Your calendars" link only when signed in — it goes to a page
  // that requires auth, and hiding it for signed-out visitors keeps
  // the /calendars marketing flow clean.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!Parse.User.current());
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#FBFAF6" }}>
      <header
        className="sticky top-0 z-30"
        style={{ background: "#FBFAF6", borderBottom: "1px solid #E3E5DE" }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
            <span
              className="text-base font-light tracking-[0.14em] uppercase"
              style={{ color: "#131714" }}
            >
              OS
            </span>
          </Link>
          <div className="flex items-center gap-5">
            {signedIn && (
              <Link
                href="/dashboard?tab=calendars"
                className="text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: "#1B4332" }}
              >
                Your calendars
              </Link>
            )}
            <Link
              href="/calendars"
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: "#6B7168" }}
            >
              Gallery
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">{children}</main>
    </div>
  );
}
