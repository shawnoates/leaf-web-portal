"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { findSeed, type SeedCalendar } from "@/lib/aiCalendarSeed";

// Public calendar detail view. Phase 1 reads calendars from the seed
// pool (no real AICalendar table yet); Phase 2 wires this to a real
// getCalendar cloud fn that handles both templates and adopted copies.
//
// Adopt flow:
//   1. Visitor taps "Make it yours" (or lands here with ?adopt=1 from
//      /personal).
//   2. If signed in — calls adoptCalendar({templateSlug}), routes to
//      /c/<owned-slug>.
//   3. If not — sign-in modal opens; on success, same call fires.
//
// Phase 1 stubs the sign-in modal as a route to /dashboard with a
// return query. Real modal ships with the auth surface refactor.

interface AdoptResponse {
  ownedSlug: string;
  ownedCalendarId: string;
}

function trackCalendarEvent(
  event:
    | "calendar_viewed"
    | "adopt_clicked"
    | "sign_in_from_adopt"
    | "adopted"
    | "adopt_failed",
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event: `c_${event}`, ...(detail || {}) });
}

export default function PublicCalendarPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug;

  const [cal, setCal] = useState<SeedCalendar | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound">(
    "loading"
  );
  const [adopting, setAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);

  useEffect(() => {
    // Phase 1: resolve from seed pool. Phase 2 swaps this for a
    // getCalendar cloud fn that returns either the seed or the real
    // AICalendar row.
    const found = findSeed(slug);
    if (found) {
      setCal(found);
      setLoadState("ready");
      trackCalendarEvent("calendar_viewed", { slug });
    } else {
      setLoadState("notfound");
    }
  }, [slug]);

  // Auto-trigger adopt when arrived via /personal's "Make it yours"
  // (?adopt=1). The visitor already clicked once; don't make them click
  // again on the destination page.
  useEffect(() => {
    if (loadState !== "ready") return;
    if (searchParams.get("adopt") !== "1") return;
    handleAdopt();
    // Strip the param so a refresh doesn't re-fire.
    const url = new URL(window.location.href);
    url.searchParams.delete("adopt");
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  async function handleAdopt() {
    if (!cal || adopting) return;
    trackCalendarEvent("adopt_clicked", { slug: cal.slug });

    // Phase 1 auth check via Parse SDK. If unauth, route to sign-in
    // with a return path that comes back here with ?adopt=1 so we
    // pick up where we left off.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (Parse as any).User?.current?.();
    if (!current) {
      trackCalendarEvent("sign_in_from_adopt", { slug: cal.slug });
      const returnTo = encodeURIComponent(`/c/${cal.slug}?adopt=1`);
      router.push(`/dashboard?signInReturnTo=${returnTo}`);
      return;
    }

    setAdopting(true);
    setAdoptError(null);
    try {
      // Send `sourceSeed` too so the server can materialize the
      // template row on first-ever adoption of this seeded calendar.
      // Once the AICalendar table has a row for this slug, subsequent
      // adopts ignore sourceSeed and use the persisted data.
      const result = (await Parse.Cloud.run("adoptCalendar", {
        templateSlug: cal.slug,
        sourceSeed: {
          title: cal.title,
          prompt: cal.prompt,
          theme: cal.theme,
          area: cal.area,
          adoptionCount: cal.adoptionCount,
          events: cal.events,
        },
      })) as AdoptResponse;
      trackCalendarEvent("adopted", {
        templateSlug: cal.slug,
        ownedSlug: result.ownedSlug,
      });
      router.push(`/c/${result.ownedSlug}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      trackCalendarEvent("adopt_failed", {
        slug: cal.slug,
        message: msg,
      });
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
            It may have been removed, or the link is off. Browse the gallery to
            find something similar.
          </p>
          <Link
            href="/calendars"
            className="inline-flex self-start items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold"
            style={{ background: "#1B4332", color: "#ffffff" }}
          >
            Browse the gallery
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </Shell>
    );
  }

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

        <div className="flex flex-col gap-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "#6B7168" }}
          >
            {cal.area} · {cal.theme}
          </span>
          <h1
            className="m-0 text-balance tracking-tight"
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
          <p className="text-[15px] leading-relaxed max-w-[60ch] m-0" style={{ color: "#6B7168" }}>
            Originally prompted with <em>&ldquo;{cal.prompt}&rdquo;</em>. Adopted by{" "}
            <strong style={{ color: "#131714", fontWeight: 600 }}>
              {cal.adoptionCount} people
            </strong>{" "}
            so far.
          </p>
        </div>

        <div
          className="bg-white rounded-2xl border p-6 md:p-8 flex flex-col gap-5"
          style={{ borderColor: "#E3E5DE" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "#6B7168" }}
            >
              {cal.previewKicker}
            </span>
            <span className="text-[12px]" style={{ color: "#6B7168" }}>
              From{" "}
              <strong style={{ color: "#131714", fontWeight: 600 }}>
                {cal.sourceName}
              </strong>
            </span>
          </div>

          <ul className="flex flex-col gap-4 m-0 p-0 list-none">
            {cal.events.map((ev, i) => (
              <li
                key={i}
                className="flex items-start gap-4 pb-4"
                style={{
                  borderBottom:
                    i < cal.events.length - 1 ? "1px solid #E3E5DE" : "none",
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
              </li>
            ))}
          </ul>
        </div>

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
                Make it yours
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          {adoptError && (
            <p className="text-[13px]" style={{ color: "#B03030" }}>
              {adoptError}
            </p>
          )}
          <p className="text-[12px] max-w-md" style={{ color: "#6B7168" }}>
            Adopting creates your own editable copy. The original template stays
            put for the next person.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FBFAF6" }}>
      <header
        className="sticky top-0 z-30"
        style={{ background: "#FBFAF6", borderBottom: "1px solid #E3E5DE" }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-6 w-6" />
            <span
              className="text-sm font-light tracking-[0.14em] uppercase"
              style={{ color: "#131714" }}
            >
              OS
            </span>
          </Link>
          <Link
            href="/calendars"
            className="text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ color: "#6B7168" }}
          >
            Gallery
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">{children}</main>
    </div>
  );
}
