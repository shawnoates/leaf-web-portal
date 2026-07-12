"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import Parse from "@/lib/parse-client";
import { SEED_POOL, type SeedCalendar } from "@/lib/aiCalendarSeed";
import { detectCity, isNYC, type DetectedCity } from "@/lib/detectCity";

interface GeneratedCalendar {
  slug: string;
  title: string;
  area: string | null;
  theme: string | null;
  events: {
    name: string;
    time: string;
    venueLine: string;
    tag: string;
    tagVariant?: "default" | "amber";
  }[];
  venuesVerified: boolean;
}

interface GenerateResponse {
  ok: boolean;
  reason?: string;
  fromCache?: boolean;
  calendar: GeneratedCalendar | null;
}

// AI-generator gallery + freeform generation destination.
//
//   /calendars           → gallery grid of cached public calendars.
//   /calendars?q=<...>   → generation surface. Phase 1 stub shows a
//                          skeleton, then a placeholder "we couldn't
//                          make this yet" state that pushes visitors
//                          back to the gallery. Real generation lands
//                          in Phase 2.

function trackCalendarsEvent(
  event:
    | "gallery_viewed"
    | "gallery_calendar_opened"
    | "gen_stub_shown"
    | "gen_stub_fallback_gallery",
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event: `calendars_${event}`, ...(detail || {}) });
}

export default function CalendarsPage() {
  return (
    <Suspense fallback={<CalendarsShell><ShellSkeleton /></CalendarsShell>}>
      <CalendarsInner />
    </Suspense>
  );
}

function CalendarsInner() {
  const searchParams = useSearchParams();
  // Read the query only post-mount so SSR and the client's first paint
  // both render the same "unknown" state. Reading during render was
  // producing React error #418 (hydration text mismatch) because SSR
  // sees no `q` while the client has one from the router.push.
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    setQuery(q);
    setMounted(true);
    if (q) trackCalendarsEvent("gen_stub_shown", { prompt: q });
    else trackCalendarsEvent("gallery_viewed");
  }, [searchParams]);

  if (!mounted) {
    return (
      <CalendarsShell>
        <ShellSkeleton />
      </CalendarsShell>
    );
  }

  return (
    <CalendarsShell>
      {query ? <GenerationSurface prompt={query} /> : <GallerySurface />}
    </CalendarsShell>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────

function CalendarsShell({ children }: { children: React.ReactNode }) {
  // Show "Your calendars" link only when signed in — otherwise the link
  // lands on the /dashboard sign-in bounce which is confusing for a
  // marketing-flow visitor.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!Parse.User.current());
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#FBFAF6" }}>
      <header className="sticky top-0 z-30" style={{ background: "#FBFAF6", borderBottom: "1px solid #E3E5DE" }}>
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
              href="/personal"
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: "#6B7168" }}
            >
              About
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">{children}</main>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-64 rounded" style={{ background: "#E8EFE9" }} />
      <div className="h-14 rounded-full" style={{ background: "#E8EFE9" }} />
    </div>
  );
}

// ─── Prompt bar (shared) ──────────────────────────────────────────

function PromptBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState(initial);
  const isTyping = typed.trim().length > 0;
  // Timezone-derived city for the placeholder — Chicago sees "Wicker
  // Park", NYC keeps "Fort Greene". SSR falls back to the generic
  // "your neighborhood" so a Chicago visitor never sees Fort Greene
  // flash before hydration.
  const [city, setCity] = useState<DetectedCity>({
    city: "your area",
    neighborhoods: ["your neighborhood", "your side of town"],
    fallback: true,
    lat: null,
    lng: null,
  });
  useEffect(() => {
    setCity(detectCity());
  }, []);
  const placeholder = `Try "date night in ${city.neighborhoods[0]}"`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isTyping) return;
        router.push(`/calendars?q=${encodeURIComponent(typed.trim())}`);
      }}
      autoComplete="off"
      className="flex items-center gap-2 bg-white rounded-full pl-6 pr-2 py-2 border transition-all"
      style={{
        borderColor: isTyping ? "#1B4332" : "#E3E5DE",
        boxShadow: isTyping
          ? "0 0 0 3px rgba(27,67,50,0.08), 0 8px 24px rgba(19,23,20,0.08)"
          : "0 1px 0 rgba(19,23,20,0.02), 0 8px 24px rgba(19,23,20,0.06)",
      }}
    >
      <input
        type="search"
        name="calendar-prompt"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={placeholder}
        aria-label="Describe a vibe"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        className="flex-1 border-0 outline-none bg-transparent py-2.5 text-base min-w-0"
        style={{ color: "#131714" }}
      />
      <button
        type="submit"
        disabled={!isTyping}
        className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default"
        style={{
          background: isTyping ? "#1B4332" : "#E3E5DE",
          color: isTyping ? "#ffffff" : "#6B7168",
        }}
      >
        Generate
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

// ─── Gallery surface ──────────────────────────────────────────────

function GallerySurface() {
  const ordered = useMemo(
    () => [...SEED_POOL].sort((a, b) => b.adoptionCount - a.adoptionCount),
    []
  );
  // Detect city for the "NYC-first gallery" hint. The seed pool is all
  // Brooklyn today; a Chicago visitor should see it's aspirational-ish
  // and pivot to typing their own prompt rather than tapping a card
  // for a city they don't live in.
  const [city, setCity] = useState<DetectedCity>({
    city: "your area",
    neighborhoods: [],
    fallback: true,
    lat: null,
    lng: null,
  });
  useEffect(() => {
    setCity(detectCity());
  }, []);
  const showNonNYCHint = !city.fallback && !isNYC(city);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.18em] inline-flex items-center gap-2.5"
          style={{ color: "#1B4332" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "#1B4332" }} />
          Gallery
        </span>
        <h1
          className="font-serif font-normal text-balance m-0"
          style={{
            color: "#131714",
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: "clamp(1.75rem, 3.4vw, 2.5rem)",
            lineHeight: 1.15,
          }}
        >
          Calendars people <em style={{ color: "#1B4332" }}>actually use</em>.
        </h1>
        <p className="text-[15px] leading-relaxed max-w-[54ch] m-0" style={{ color: "#6B7168" }}>
          Pick one to preview. Copy it to your own account — you can edit,
          share, and turn any event into a real plan.
        </p>
        {showNonNYCHint && (
          <p className="text-[13px] leading-relaxed max-w-[54ch] m-0" style={{ color: "#8A5F1E" }}>
            The gallery is Brooklyn-first for now. Type a prompt for {city.city}
            and we&rsquo;ll build one there.
          </p>
        )}
      </div>

      <PromptBar />

      <div className="grid gap-4 md:grid-cols-2">
        {ordered.map((c) => (
          <GalleryCard key={c.slug} calendar={c} />
        ))}
      </div>
    </div>
  );
}

function GalleryCard({ calendar }: { calendar: SeedCalendar }) {
  return (
    <Link
      href={`/cal/${calendar.slug}`}
      onClick={() =>
        trackCalendarsEvent("gallery_calendar_opened", { slug: calendar.slug })
      }
      className="group bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md"
      style={{ borderColor: "#E3E5DE" }}
    >
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "#6B7168" }}
            >
              {calendar.area}
            </span>
            <h3
              className="m-0 text-[20px] leading-tight tracking-tight text-balance"
              style={{
                color: "#131714",
                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                fontWeight: 400,
              }}
            >
              {calendar.title}
            </h3>
          </div>
          <span
            className="shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 tabular-nums"
            style={{ background: "#E8EFE9", color: "#1B4332" }}
          >
            {calendar.adoptionCount} using
          </span>
        </div>

        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {calendar.events.slice(0, 3).map((ev, i) => (
            <li key={i} className="flex items-baseline gap-3 text-[13px]">
              <span
                className="tabular-nums font-medium whitespace-nowrap"
                style={{ color: "#131714" }}
              >
                {ev.time}
              </span>
              <span className="truncate" style={{ color: "#6B7168" }}>
                {ev.name}
                <span style={{ color: "#B4B8B0" }}> · {ev.tag}</span>
              </span>
            </li>
          ))}
          {calendar.events.length > 3 && (
            <li className="text-[12px]" style={{ color: "#6B7168" }}>
              + {calendar.events.length - 3} more
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#E3E5DE" }}>
          <span className="text-[12px]" style={{ color: "#6B7168" }}>
            From <strong style={{ color: "#131714", fontWeight: 600 }}>{calendar.sourceName}</strong>
          </span>
          <span
            className="text-[13px] font-semibold inline-flex items-center gap-1.5 group-hover:gap-2 transition-all"
            style={{ color: "#1B4332" }}
          >
            View
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Generation surface — real Gemini via generateAICalendar ──────

function GenerationSurface({ prompt }: { prompt: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"working" | "success" | "fallback">(
    "working"
  );
  const [generated, setGenerated] = useState<GeneratedCalendar | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  // Detect city for the error-copy examples so a Chicago visitor with
  // an unmeaningful prompt sees "date night in Wicker Park", not
  // "Fort Greene".
  const [city, setCity] = useState<DetectedCity>({
    city: "your area",
    neighborhoods: ["your neighborhood"],
    fallback: true,
    lat: null,
    lng: null,
  });
  useEffect(() => {
    setCity(detectCity());
  }, []);
  const exampleNeighborhood = city.neighborhoods[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Regionalize server-side. City → LLM prompt system hint;
        // coords → Ticketmaster + Places bias. Server falls back to
        // NYC when either is missing so an SSR / bot request still
        // works.
        const detected = detectCity();
        const result = (await Parse.Cloud.run("generateAICalendar", {
          prompt,
          originCity: detected.fallback ? undefined : detected.city,
          originLat: detected.lat ?? undefined,
          originLng: detected.lng ?? undefined,
        })) as GenerateResponse;
        if (cancelled) return;
        if (result.ok && result.calendar) {
          setGenerated(result.calendar);
          setFromCache(!!result.fromCache);
          setPhase("success");
        } else {
          setReason(result.reason || "generation_failed");
          setPhase("fallback");
        }
      } catch (err) {
        if (cancelled) return;
        setReason(err instanceof Error ? err.message : "generation_failed");
        setPhase("fallback");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prompt]);

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-4">
      <div className="flex flex-col gap-3">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.18em] inline-flex items-center gap-2.5"
          style={{ color: "#1B4332" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "#1B4332" }} />
          {phase === "working" ? "Generating" : phase === "success" ? "Ready" : "Couldn't make it"}
        </span>
        <h1
          className="font-serif font-normal text-balance m-0"
          style={{
            color: "#131714",
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: "clamp(1.5rem, 2.6vw, 1.875rem)",
            lineHeight: 1.2,
          }}
        >
          &ldquo;{prompt}&rdquo;
        </h1>
      </div>

      {phase === "working" && (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow width="80%" />
          <SkeletonRow width="65%" />
          <SkeletonRow width="72%" />
          <div className="flex items-center gap-2 text-[13px] mt-4" style={{ color: "#6B7168" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#1B4332" }} />
            <span>Building your calendar with real venues…</span>
          </div>
        </div>
      )}

      {phase === "success" && generated && (
        <div
          className="bg-white rounded-2xl border p-6 md:p-8 flex flex-col gap-5"
          style={{ borderColor: "#E3E5DE" }}
        >
          {fromCache && (
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em] self-start rounded px-2 py-0.5"
              style={{ background: "#E8EFE9", color: "#1B4332" }}
            >
              From cache
            </span>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "#6B7168" }}
              >
                {generated.area || "New York"} · {generated.theme || "mix"}
              </span>
              <h2
                className="m-0 text-[24px] tracking-tight"
                style={{
                  color: "#131714",
                  fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                  fontWeight: 400,
                }}
              >
                {generated.title}
              </h2>
            </div>
          </div>

          {!generated.venuesVerified && (
            <p
              className="text-[12px] leading-relaxed rounded-lg px-3 py-2"
              style={{
                background: "rgba(200,138,59,0.08)",
                color: "#8A5F1E",
              }}
            >
              These venues weren&apos;t verified against Google Places — double-check hours before you go.
            </p>
          )}

          <ul className="flex flex-col gap-4 m-0 p-0 list-none">
            {generated.events.map((ev, i) => (
              <li
                key={i}
                className="flex items-start gap-4 pb-4"
                style={{
                  borderBottom:
                    i < generated.events.length - 1 ? "1px solid #E3E5DE" : "none",
                }}
              >
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
                    className="m-0 text-[17px] tracking-tight"
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
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/cal/${generated.slug}?adopt=1`}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold"
              style={{ background: "#131714", color: "#fff" }}
            >
              Make it yours
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/cal/${generated.slug}`}
              className="inline-flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: "#6B7168" }}
            >
              Or open the full page
            </Link>
          </div>
        </div>
      )}

      {phase === "fallback" && (
        <div
          className="bg-white rounded-2xl border p-6 md:p-8 flex flex-col gap-5"
          style={{ borderColor: "#E3E5DE" }}
        >
          <div className="flex flex-col gap-2">
            <h2
              className="m-0 text-[20px] tracking-tight"
              style={{
                color: "#131714",
                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                fontWeight: 400,
              }}
            >
              {reason === "prompt_not_meaningful"
                ? "Try a bit more detail."
                : reason === "no_events_found"
                  ? "Nothing on the schedule right now."
                  : reason === "thin_result" || reason === "generation_failed"
                    ? "Couldn't ground this one in real venues."
                    : "Something went sideways."}
            </h2>
            <p className="text-[14px] leading-relaxed m-0" style={{ color: "#6B7168" }}>
              {reason === "prompt_not_meaningful"
                ? `A neighborhood + a vibe usually works — like "date night in ${exampleNeighborhood}".`
                : reason === "no_events_found"
                  ? "We searched Ticketmaster in your area for the next 90 days but didn't find upcoming events matching your ask. Try a different team, artist, or window."
                  : reason === "thin_result" || reason === "generation_failed"
                    ? "Try a vibe grounded in venues — a neighborhood + a mood — and we'll build it. Or pick one of these popular calendars close to what you asked for."
                    : "Try another prompt, or pick one of these popular calendars close to what you asked for."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {SEED_POOL.slice(0, 3).map((c) => (
              <Link
                key={c.slug}
                href={`/cal/${c.slug}`}
                onClick={() =>
                  trackCalendarsEvent("gen_stub_fallback_gallery", {
                    slug: c.slug,
                    prompt,
                  })
                }
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-[#FBFAF6]"
                style={{ borderColor: "#E3E5DE" }}
              >
                <div className="min-w-0 flex flex-col">
                  <span className="text-[15px] font-medium truncate" style={{ color: "#131714" }}>
                    {c.title}
                  </span>
                  <span className="text-[12px]" style={{ color: "#6B7168" }}>
                    {c.area} · {c.adoptionCount} using
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "#1B4332" }} />
              </Link>
            ))}
          </div>

          <button
            onClick={() => router.push("/calendars")}
            className="self-start text-[13px] font-semibold underline underline-offset-4"
            style={{ color: "#6B7168" }}
          >
            Or browse the full gallery
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRow({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-4 rounded animate-pulse"
      style={{ background: "#E8EFE9", width }}
    />
  );
}
