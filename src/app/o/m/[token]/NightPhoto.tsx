"use client";

/**
 * The photo on a merchant's nights (2026-10-18): one of Leaf's own photos or
 * an Unsplash search, picked on their dashboard. Saved to their nights and any
 * plan already posted (merchantSetNightPhoto). Unsplash photos are credited
 * to the photographer.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { Loader2 } from "lucide-react";
import { merchantRun } from "@/lib/merchant-session";

export type NightImage = { url: string; credit?: string | null; creditUrl?: string | null } | null;
type Photo = { id?: string; url: string; thumbUrl: string; credit?: string | null; creditUrl?: string | null; alt?: string };

const LEAF_PHOTOS: Photo[] = [
  { url: "https://www.joinleaf.com/studio-taster.jpg", thumbUrl: "/studio-taster.jpg", alt: "A beginner class in a sunny studio" },
  { url: "https://www.joinleaf.com/shop-night.jpg", thumbUrl: "/shop-night.jpg", alt: "Neighbors in a shop after hours" },
  { url: "https://www.joinleaf.com/hosted-night.jpg", thumbUrl: "/hosted-night.jpg", alt: "Neighbors around a table" },
];

export default function NightPhoto({ token, image, query, preview, onSaved }: {
  token: string;
  image: NightImage;
  query?: string;
  preview: boolean;
  onSaved?: (image: NightImage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(query || "");
  const [results, setResults] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<NightImage>(image);

  const search = async () => {
    if (!q.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const r = (await Parse.Cloud.run("searchUnsplashPhotos", { query: q.trim(), perPage: 12 })) as { id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[];
      setResults(r.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, alt: p.alt, credit: p.photographerName, creditUrl: p.photographerUrl })));
      if (!r.length) setError("No photos for that. Try other words.");
    } catch {
      setError("Search didn’t work. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const pick = async (p: Photo | null) => {
    setBusy(p?.url || "clear");
    setError(null);
    try {
      const r = (await merchantRun("merchantSetNightPhoto", { token, url: p?.url ?? null, credit: p?.credit || "", creditUrl: p?.creditUrl || "", photoId: p?.id || "" })) as { night: { image: NightImage } };
      setShown(r.night.image);
      onSaved?.(r.night.image);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t save");
    } finally {
      setBusy(null);
    }
  };

  const tile = (p: Photo) => (
    <button key={p.url} type="button" onClick={() => pick(p)} disabled={busy !== null || preview} aria-label={p.alt || "Use this photo"}
      className={`relative h-20 overflow-hidden rounded-xl ring-1 ${shown?.url === p.url ? "ring-2 ring-leaf-700" : "ring-stone-200"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
      {busy === p.url && <span className="absolute inset-0 grid place-items-center bg-white/60"><Loader2 className="h-4 w-4 animate-spin" /></span>}
    </button>
  );

  return (
    <div className="mt-5 border-t border-stone-200 pt-5">
      <div className="flex items-center gap-3">
        {shown?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown.url} alt="" className="h-14 w-20 rounded-xl object-cover" />
        ) : (
          <span className="grid h-14 w-20 place-items-center rounded-xl bg-stone-100 text-[11px] text-stone-400">No photo</span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-stone-900">Photo</p>
          <p className="text-[13px] text-stone-500">
            {shown?.url ? (shown.credit ? `Photo by ${shown.credit} on Unsplash` : "On your nights’ pages") : "A photo makes more neighbors tap in."}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} disabled={preview} className="ml-auto shrink-0 text-[14px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          {open ? "Close" : shown?.url ? "Change" : "Add a photo"}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">Leaf photos</p>
            <div className="grid grid-cols-3 gap-2">{LEAF_PHOTOS.map(tile)}</div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">Find one on Unsplash</p>
            <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. yoga class, wine bar" className="h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-[15px] focus:border-leaf-600 focus:outline-none" />
              <button type="submit" disabled={busy !== null} className="h-11 rounded-xl bg-leaf-800 px-4 text-[14px] font-semibold text-white disabled:opacity-40">
                {busy === "search" ? "…" : "Search"}
              </button>
            </form>
            {results.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{results.map(tile)}</div>}
            {results.length > 0 && <p className="mt-2 text-[12px] text-stone-400">Free photos from Unsplash, credited to the photographer.</p>}
          </div>
          {shown?.url && (
            <button type="button" onClick={() => pick(null)} disabled={busy !== null} className="text-[13px] text-stone-500 underline">
              Remove the photo
            </button>
          )}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
