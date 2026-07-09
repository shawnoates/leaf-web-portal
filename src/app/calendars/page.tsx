"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { SEED_POOL, type SeedCalendar } from "@/lib/aiCalendarSeed";

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
  const query = searchParams.get("q")?.trim() || "";

  useEffect(() => {
    if (query) trackCalendarsEvent("gen_stub_shown", { prompt: query });
    else trackCalendarsEvent("gallery_viewed");
  }, [query]);

  return (
    <CalendarsShell>
      {query ? <GenerationSurface prompt={query} /> : <GallerySurface />}
    </CalendarsShell>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────

function CalendarsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FBFAF6" }}>
      <header className="sticky top-0 z-30" style={{ background: "#FBFAF6", borderBottom: "1px solid #E3E5DE" }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-6 w-6" />
            <span className="text-sm font-light tracking-[0.14em] uppercase" style={{ color: "#131714" }}>
              OS
            </span>
          </Link>
          <Link
            href="/personal"
            className="text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ color: "#6B7168" }}
          >
            About
          </Link>
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isTyping) return;
        router.push(`/calendars?q=${encodeURIComponent(typed.trim())}`);
      }}
      className="flex items-center gap-2 bg-white rounded-full pl-6 pr-2 py-2 border transition-all"
      style={{
        borderColor: isTyping ? "#1B4332" : "#E3E5DE",
        boxShadow: isTyping
          ? "0 0 0 3px rgba(27,67,50,0.08), 0 8px 24px rgba(19,23,20,0.08)"
          : "0 1px 0 rgba(19,23,20,0.02), 0 8px 24px rgba(19,23,20,0.06)",
      }}
    >
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder='Try "date night in Fort Greene"'
        aria-label="Describe a vibe"
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
          Calendars people <em style={{ color: "#1B4332" }}>actually adopted</em>.
        </h1>
        <p className="text-[15px] leading-relaxed max-w-[54ch] m-0" style={{ color: "#6B7168" }}>
          Pick one to preview. Adopt to save it as your own — you can edit,
          share, and turn any event into a real plan.
        </p>
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
      href={`/c/${calendar.slug}`}
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
            {calendar.adoptionCount} adopted
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

// ─── Generation surface (Phase 1 stub) ────────────────────────────

function GenerationSurface({ prompt }: { prompt: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"working" | "fallback">("working");

  useEffect(() => {
    // Phase 1 stub — pretend to generate for 3.5s, then fall back to
    // the gallery with a friendly "we couldn't make this yet" message.
    // Replaces with real streaming generation in Phase 2.
    const t = window.setTimeout(() => setPhase("fallback"), 3500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-8">
      <div className="flex flex-col gap-3">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.18em] inline-flex items-center gap-2.5"
          style={{ color: "#1B4332" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "#1B4332" }} />
          Generating
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

      {phase === "working" ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow width="80%" />
          <SkeletonRow width="65%" />
          <div className="flex items-center gap-2 text-[13px] mt-4" style={{ color: "#6B7168" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#1B4332" }} />
            <span>Grounding your calendar in real Brooklyn venues…</span>
          </div>
        </div>
      ) : (
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
              We couldn&apos;t make this one yet.
            </h2>
            <p className="text-[14px] leading-relaxed m-0" style={{ color: "#6B7168" }}>
              Freeform generation is coming soon. In the meantime, one of these
              adopted calendars is close to what you asked for.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {SEED_POOL.slice(0, 3).map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
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
                    {c.area} · {c.adoptionCount} adopted
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
