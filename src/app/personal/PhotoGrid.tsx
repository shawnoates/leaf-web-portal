"use client";

import { useState } from "react";

// /personal photo row — a fanned deck of candid group photos sitting
// under the "Who it's for" copy, before "How It Works". Pure atmosphere
// / social proof: no captions, no lightbox, no autoplay, no carousel
// library. Static row on desktop; native horizontal scroll on narrow
// widths using the repo's `no-scrollbar` convention.
//
// Order alternates day/night and indoor/outdoor so the row reads with
// some rhythm rather than clumping all the evening shots together.
// Sources are 3:4 portrait (see public/photo-row/README.md) — the cards
// match that aspect so nothing gets cropped through a face.

const PHOTOS = [
  {
    src: "/photo-row/kitchen-dinner.jpg",
    alt: "Three friends cooking and pouring wine together in a kitchen at night",
    rotate: "-rotate-6",
  },
  {
    src: "/photo-row/backyard-lunch.jpg",
    alt: "A group sharing a long backyard lunch, one friend pouring drinks",
    rotate: "rotate-4",
  },
  {
    src: "/photo-row/trail-hike.jpg",
    alt: "Hikers laughing as they pull each other up a wooded trail",
    rotate: "-rotate-3",
  },
  {
    src: "/photo-row/restaurant-dinner.jpg",
    alt: "A packed table of friends mid-laugh over dinner at a restaurant",
    rotate: "rotate-5",
  },
  {
    src: "/photo-row/pickup-soccer.jpg",
    alt: "Friends playing pickup soccer on a lot at sunset",
    rotate: "-rotate-4",
  },
  {
    src: "/photo-row/bar-night.jpg",
    alt: "A group crowded into a bar booth, deep in a story",
    rotate: "rotate-3",
  },
  {
    src: "/photo-row/bike-ride.jpg",
    alt: "Three friends riding bikes side by side along a river path",
    rotate: "-rotate-5",
  },
  {
    src: "/photo-row/skatepark.jpg",
    alt: "Friends cheering on a skater at an outdoor skatepark",
    rotate: "rotate-6",
  },
];

export default function PhotoGrid() {
  const [broken, setBroken] = useState<string[]>([]);
  const photos = PHOTOS.filter((photo) => !broken.includes(photo.src));

  if (photos.length === 0) return null;

  return (
    <section className="py-16 md:py-20">
      {/* `w-max mx-auto` on the row rather than justify-center on the
          scroller: it centers at any width where the row fits, and when
          it doesn't, mx-auto simply does nothing and the row scrolls
          from its true left edge. justify-center would instead make the
          overflowing leading edge unreachable. */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex w-max mx-auto gap-2 2xl:gap-3 px-6 py-4">
          {photos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              width={480}
              height={640}
              loading={i < 2 ? "eager" : "lazy"}
              onError={() =>
                setBroken((prev) =>
                  prev.includes(photo.src) ? prev : [...prev, photo.src]
                )
              }
              className={`shrink-0 w-32 md:w-36 2xl:w-40 h-auto aspect-[3/4] object-cover rounded-xl border-4 border-white shadow-lg bg-zinc-100 ${photo.rotate}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
