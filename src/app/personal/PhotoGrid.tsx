"use client";

import { useState } from "react";

// /personal photo row — a fanned deck of candid group photos sitting
// directly under the hero, before "Who it's for". Pure atmosphere /
// social proof: no captions, no lightbox, no autoplay, no carousel
// library. Static row on desktop; native horizontal scroll on narrow
// widths using the repo's `no-scrollbar` convention.
//
// Drop the eight images into public/photo-row/ (see the README there
// for filenames and sizing). Any image that fails to load removes
// itself from the row, so a missing file never ships a broken tile.

const PHOTOS = [
  {
    src: "/photo-row/group-dinner-1.jpg",
    alt: "Friends laughing around a crowded dinner table",
    rotate: "-rotate-6",
  },
  {
    src: "/photo-row/coffee-walk-1.jpg",
    alt: "A small group walking together with coffees in hand",
    rotate: "rotate-4",
  },
  {
    src: "/photo-row/game-night-1.jpg",
    alt: "Friends crowded around a table mid-game night",
    rotate: "-rotate-3",
  },
  {
    src: "/photo-row/park-hangout-1.jpg",
    alt: "A group sprawled on a blanket in the park on a warm afternoon",
    rotate: "rotate-5",
  },
  {
    src: "/photo-row/rooftop-1.jpg",
    alt: "Friends gathered on a rooftop at sunset",
    rotate: "-rotate-4",
  },
  {
    src: "/photo-row/run-club-1.jpg",
    alt: "A run club catching their breath together after a morning route",
    rotate: "rotate-3",
  },
  {
    src: "/photo-row/potluck-1.jpg",
    alt: "Friends passing dishes around a potluck spread",
    rotate: "-rotate-5",
  },
  {
    src: "/photo-row/birthday-1.jpg",
    alt: "A group crowding in around a birthday cake",
    rotate: "rotate-6",
  },
];

export default function PhotoGrid() {
  const [broken, setBroken] = useState<string[]>([]);
  const photos = PHOTOS.filter((photo) => !broken.includes(photo.src));

  if (photos.length === 0) return null;

  return (
    <section className="py-16 md:py-20">
      {/* justify-start until the row actually fits — a centered flex row
          that overflows makes its leading edge unreachable on scroll. */}
      <div className="flex justify-start xl:justify-center -space-x-2 md:-space-x-3 overflow-x-auto no-scrollbar px-6">
        {photos.map((photo, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            loading={i < 2 ? "eager" : "lazy"}
            onError={() =>
              setBroken((prev) =>
                prev.includes(photo.src) ? prev : [...prev, photo.src]
              )
            }
            className={`shrink-0 w-32 h-56 md:w-36 md:h-64 xl:w-40 xl:h-72 object-cover rounded-xl shadow-lg bg-zinc-100 ${photo.rotate}`}
          />
        ))}
      </div>
    </section>
  );
}
