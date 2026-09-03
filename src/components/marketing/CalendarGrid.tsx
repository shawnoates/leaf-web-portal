"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { SEED_POOL, type SeedCalendar } from "@/lib/aiCalendarSeed";
import { coverFor } from "./covers";
import { assignCoverPhotos, PHOTO_FILTER, type Photo } from "./photos";
import { useDetectedCity } from "@/lib/useDetectedCity";
import { focusHeroInput } from "./useGenerate";
import { trackMarketingEvent } from "./analytics";

// "Real calendars first" — the grid that carries the page's social
// proof. 7 calendars plus a "your calendar here" slot in the first row's
// last column.
//
// Data honesty note: the spec's card meta ("Monthly · 24 members · 3
// upcoming", "18 going Saturday") has no endpoint behind it —
// listAICalendarsByCity is the only real calendar source and it returns
// title/prompt/area/theme/events, with no member or attendance counts.
// Rather than hardcode the mock's illustrative numbers, cards show what
// is actually true: the area and the number of stops, plus the real
// adoption count when the server supplied one. Restore the fuller meta
// line here once a featured-calendars endpoint exists.

interface GridCalendar extends SeedCalendar {
  /** True when this row came from the server rather than the local seed
   *  pool — gates display of adoptionCount, which is fabricated on
   *  seeds and real on server rows. */
  fromServer: boolean;
}

const seedRow = (c: SeedCalendar): GridCalendar => ({ ...c, fromServer: false });

function CoverArt({
  photo,
  index,
}: {
  photo: Photo | null;
  index: number;
}) {
  // A theme-matched photo when one is free; otherwise the gradient wash.
  // Never a stand-in from another subject, and never the same photo twice
  // on a page — these cards link to real calendars.
  if (!photo) {
    return (
      <div
        className="h-[120px] w-full sm:h-[190px]"
        style={{ background: coverFor(index).gradient }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={photo.alt}
      loading={index < 4 ? "eager" : "lazy"}
      className="h-[120px] w-full object-cover sm:h-[190px]"
      style={{ filter: PHOTO_FILTER, background: coverFor(index).gradient }}
    />
  );
}

function CalendarCard({
  calendar,
  index,
  photo,
}: {
  calendar: GridCalendar;
  index: number;
  photo: Photo | null;
}) {
  const stops = calendar.events?.length ?? 0;
  const meta = [
    calendar.area,
    stops ? `${stops} stop${stops === 1 ? "" : "s"}` : null,
    // A count of 1 or 2 reads as "nobody uses this" — worse than saying
    // nothing. Only surface adoption once it's actually social proof.
    calendar.fromServer && calendar.adoptionCount >= 5
      ? `${calendar.adoptionCount} adopted`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/cal/${calendar.slug}`}
      onClick={() =>
        trackMarketingEvent("calendar_card_opened", { slug: calendar.slug })
      }
      className="group block overflow-hidden rounded-[14px] bg-white transition-all sm:rounded-2xl"
      style={{ border: "1px solid var(--mkt-line)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <CoverArt photo={photo} index={index} />
      <div className="flex flex-col gap-1.5 p-3 sm:gap-1.5 sm:p-[18px]">
        {/* Clamped to two lines so a long title can't push one card
            taller than its neighbours and break the grid's baseline. */}
        <div
          className="mkt-serif overflow-hidden italic"
          style={{
            fontSize: "17px",
            lineHeight: 1.15,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
          title={calendar.title}
        >
          <span className="sm:hidden">{calendar.title}</span>
          <span className="hidden sm:inline" style={{ fontSize: "22px" }}>
            {calendar.title}
          </span>
        </div>
        <div
          className="text-[11.5px] sm:text-[13px]"
          style={{ color: "var(--mkt-ink-3)" }}
        >
          {meta}
        </div>
      </div>
    </Link>
  );
}

function YourCalendarSlot() {
  return (
    <button
      type="button"
      onClick={() => {
        trackMarketingEvent("generate_submit_intent", { source: "slot" });
        focusHeroInput();
      }}
      className="flex flex-col items-center justify-center gap-2 rounded-[14px] p-3.5 text-center transition-colors sm:gap-3 sm:rounded-2xl sm:p-[22px]"
      style={{
        border: "2px dashed var(--mkt-line-dash)",
        background: "var(--mkt-bg-tile)",
      }}
    >
      <span
        className="flex items-center justify-center rounded-full text-white"
        style={{
          width: 36,
          height: 36,
          background: "var(--mkt-ink)",
          fontSize: 20,
          fontWeight: 300,
        }}
      >
        +
      </span>
      <span className="mkt-serif italic text-[18px] sm:text-[26px]">
        Your calendar here
      </span>
      <span
        className="text-[11.5px] leading-[1.45] sm:text-[14px]"
        style={{ color: "var(--mkt-ink-2)" }}
      >
        <span className="hidden sm:inline">Type a vibe above.</span>
        <span className="hidden sm:inline">
          <br />
        </span>
        Free, no signup.
      </span>
    </button>
  );
}

export default function CalendarGrid() {
  const { city, ready } = useDetectedCity();
  const [calendars, setCalendars] = useState<GridCalendar[]>(() =>
    SEED_POOL.slice(0, 7).map(seedRow)
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("listAICalendarsByCity", {
          city: city.resolvedCity || city.city,
          limit: 7,
        })) as {
          calendars?: Array<{
            slug: string;
            title: string;
            prompt: string;
            area: string | null;
            theme: string | null;
            adoptionCount: number;
            events?: { time: string; title?: string; name: string; tag: string }[];
          }>;
        };
        const rows = result?.calendars || [];
        if (cancelled || rows.length === 0) return;
        setCalendars(
          rows.map((c) => ({
            slug: c.slug,
            chipLabel: c.prompt || c.title,
            title: c.title,
            prompt: c.prompt,
            area: c.area || city.city,
            theme: c.theme || "mix",
            sourceName: "Leaf",
            previewKicker: `${(c.events || []).length} stops`,
            adoptionCount: c.adoptionCount || 0,
            events: (c.events || []).map((ev) => ({
              title: ev.title,
              name: ev.name,
              time: ev.time,
              venueLine: "",
              tag: ev.tag,
            })),
            fromServer: true,
          }))
        );
      } catch {
        // Keep the seed pool — the grid is load-bearing social proof, so
        // an empty state here would gut the page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, city]);

  // Photos are allocated across the whole grid in one pass so no two
  // cards can land on the same image.
  const photos = assignCoverPhotos(calendars.map((c) => c.theme));

  // Slot sits at index 3 so it lands in the first row's last column at
  // the 4-column desktop width.
  const firstRow = calendars.slice(0, 3);
  const rest = calendars.slice(3);

  return (
    <section className="px-5 pb-10 pt-4 sm:px-12 sm:pb-[88px] sm:pt-6">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-[18px]">
        {firstRow.map((c, i) => (
          <CalendarCard key={c.slug} calendar={c} index={i} photo={photos[i]} />
        ))}
        <YourCalendarSlot />
        {/* Mobile shows the first 3 + slot only (spec §Mobile). */}
        {rest.map((c, i) => (
          <div key={c.slug} className="hidden md:block">
            <CalendarCard calendar={c} index={i + 3} photo={photos[i + 3]} />
          </div>
        ))}
      </div>
    </section>
  );
}
