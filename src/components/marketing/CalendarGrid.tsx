"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { SEED_POOL, type SeedCalendar } from "@/lib/aiCalendarSeed";
import { coverFor } from "./covers";
import {
  assignCoverPhotos,
  hasSubjectForTheme,
  PHOTO_FILTER,
  type Photo,
} from "./photos";
import { selectFeatured, type FeaturedRow } from "./featuredCalendars";
import { useDetectedCity } from "@/lib/useDetectedCity";
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
  /** The calendar's own cover, when the generator gave it one. Preferred
   *  over anything we'd pick for it. */
  coverImageUrl?: string | null;
}

const seedRow = (c: SeedCalendar): GridCalendar => ({ ...c, fromServer: false });

function CoverArt({
  calendar,
  photo,
  index,
}: {
  calendar: GridCalendar;
  photo: Photo | null;
  index: number;
}) {
  // The calendar's own cover first — it's what the generator actually
  // chose for it. Then a theme-matched photo, never repeated on the page.
  // Then the gradient: a card whose theme we can't read gets an abstract
  // wash rather than a confidently wrong picture, since it links to a
  // real calendar.
  const src = calendar.coverImageUrl || photo?.url || null;
  if (!src) {
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
      src={src}
      alt={calendar.coverImageUrl ? "" : (photo?.alt ?? "")}
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
      className="group flex h-full flex-col overflow-hidden rounded-[14px] bg-white transition-all sm:rounded-2xl"
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
      <CoverArt calendar={calendar} photo={photo} index={index} />
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-1.5 sm:p-[18px]">
        {/* Always two lines tall, clamped at two: a one-line title would
            otherwise pull its meta row up and leave the card shorter than
            the one beside it. Size is a class rather than an inline style
            so the em-based min-height tracks it at both breakpoints. */}
        <div
          className="mkt-serif overflow-hidden text-[17px] italic sm:text-[22px]"
          style={{
            lineHeight: 1.15,
            minHeight: "2.3em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
          title={calendar.title}
        >
          {calendar.title}
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

export default function CalendarGrid() {
  const { city, ready } = useDetectedCity();
  const [calendars, setCalendars] = useState<GridCalendar[]>(() =>
    SEED_POOL.slice(0, 8).map(seedRow)
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        // Ask for far more than we show: the endpoint buckets by the
        // generating visitor's city, not the calendar's own area, so most
        // of what comes back has to be filtered out.
        const result = (await Parse.Cloud.run("listAICalendarsByCity", {
          city: city.resolvedCity || city.city,
          limit: 24,
        })) as { calendars?: FeaturedRow[] };

        const picked = selectFeatured(result?.calendars || [], {
          visitorCity: city.fallback ? null : city.city,
          visitorNeighborhoods: city.neighborhoods,
          limit: 8,
          hasVisual: (row) =>
            !!row.coverImageUrl || hasSubjectForTheme(row.theme),
        });
        if (cancelled || picked.length === 0) return;

        setCalendars(
          picked.map((c) => ({
            slug: c.slug,
            chipLabel: c.prompt || c.title,
            title: c.title,
            prompt: c.prompt,
            area: c.area || city.city,
            theme: c.theme || "mix",
            sourceName: "Leaf",
            previewKicker: `${(c.events || []).length} stops`,
            adoptionCount: c.adoptionCount || 0,
            coverImageUrl: c.coverImageUrl || null,
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
  // cards can land on the same image. A calendar that brought its own
  // cover is passed a null theme so it consumes nothing from the pool.
  const photos = assignCoverPhotos(
    calendars.map((c) => (c.coverImageUrl ? null : c.theme)),
    calendars.map((c) => c.coverImageUrl).filter(Boolean) as string[]
  );

  return (
    <section className="px-5 pb-10 pt-4 sm:px-12 sm:pb-[88px] sm:pt-6">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-[18px]">
        {calendars.map((c, i) => (
          // Mobile shows the first four; the rest would push the RSVP
          // section too far down the fold on a phone.
          <div key={c.slug} className={i > 3 ? "hidden md:block" : undefined}>
            <CalendarCard calendar={c} index={i} photo={photos[i]} />
          </div>
        ))}
      </div>
    </section>
  );
}
