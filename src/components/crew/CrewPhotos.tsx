"use client";

/**
 * A crew's photos. One store with the recap page (/m): EventPhoto rows on
 * each night's plan, so a photo added here shows there and back. Uploads go
 * through uploadEventPhoto with the member's own invite to that night, with
 * the same limits and the same 7-day window.
 *
 *   PhotoStrip / PhotoViewer  a night's photos, tap for full size
 *   AddPhotos                 the picker: pick several, they upload one by one
 *   CrewPhotosSection         every night's photos on the crew page
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import type { Photo } from "@/components/recap/types";
import { Mono } from "@/components/crew/CrewShell";
import { run, toDate, type CrewAuth } from "@/lib/crew";

export type PhotoLimits = { maxPerAttendee: number; maxPerEvent: number; maxBytes: number };

export function PhotoViewer({ photos, index, onClose }: { photos: Photo[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const p = photos[i];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, photos.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);
  if (!p?.url) return null;
  const nav = "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-30";
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt={p.caption || `Photo by ${p.uploaderName}`} className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      <p className="absolute bottom-5 left-0 right-0 m-0 text-center text-sm text-white/80">{p.caption || `From ${p.uploaderName.split(/\s+/)[0]}`} · {i + 1} of {photos.length}</p>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"><X size={20} /></button>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1); }} className={`${nav} left-3`}><ChevronLeft size={22} /></button>
          <button type="button" aria-label="Next photo" disabled={i === photos.length - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1); }} className={`${nav} right-3`}><ChevronRight size={22} /></button>
        </>
      )}
    </div>
  );
}

/** A row of square thumbnails; on desktop a grid. */
export function PhotoStrip({ photos, grid = false }: { photos: Photo[]; grid?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = photos.filter((p) => p.url);
  if (!shown.length) return null;
  return (
    <>
      <ul className={`m-0 list-none p-0 ${grid ? "grid grid-cols-3 gap-1.5 sm:grid-cols-4" : "-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"}`}>
        {shown.map((p, i) => (
          <li key={p.objectId} className={grid ? "" : "shrink-0"}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${shown.length}`} className={`block overflow-hidden rounded-xl bg-fm-card ${grid ? "aspect-square w-full" : "h-24 w-24"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url!} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <PhotoViewer photos={shown} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** "Add photos": pick one or several; each uploads as soon as it's read. */
export function AddPhotos({ inviteId, limits, mine, onUploaded, label = "Add photos" }: {
  inviteId: string;
  limits: PhotoLimits;
  /** Photos this member already added to the night (the per-person cap). */
  mine: number;
  onUploaded: (photo: Photo) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const left = Math.max(0, limits.maxPerAttendee - mine);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, left);
    if (files.length > left) setError(left ? `You can add ${left} more to this night.` : "You've added the most photos you can for this night.");
    setProgress({ done: 0, total: list.length });
    for (const [n, file] of list.entries()) {
      try {
        if (file.size > limits.maxBytes * 3) throw new Error(`"${file.name}" is too big.`);
        const { base64 } = await processImageFile(file);
        const photo = (await Parse.Cloud.run("uploadEventPhoto", { notificationId: inviteId, fileBase64: base64, mimeType: "image/jpeg" })) as Photo;
        onUploaded(photo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That photo didn't upload.");
      }
      setProgress({ done: n + 1, total: list.length });
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" id={`add-photos-${inviteId}`} onChange={(e) => void upload(e.target.files)} disabled={Boolean(progress) || left === 0} />
      <label
        htmlFor={`add-photos-${inviteId}`}
        className={`flex h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-fm-line px-4 text-sm font-semibold text-fm-ink hover:border-fm-ink-2 ${progress || left === 0 ? "pointer-events-none opacity-60" : ""}`}
      >
        {progress ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
        {progress ? `Adding ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : label}
      </label>
      {error && <p role="alert" className="m-0 text-xs text-fm-danger">{error}</p>}
    </div>
  );
}

type Night = { cycleId: string; planId: string; venue: string | null; startsAt: string | { iso: string } | null; photos: Photo[]; myInviteId: string | null; uploadsOpen: boolean };

/** Every night's photos, newest night first. Hidden until there's a photo or a night to add to. */
/** `skipCycleId`: the night the Last night card already shows. */
export function CrewPhotosSection({ auth, meId, title, skipCycleId = null }: { auth: CrewAuth; meId: string | null; title: string; skipCycleId?: string | null }) {
  const [nights, setNights] = useState<Night[] | null>(null);
  const [limits, setLimits] = useState<PhotoLimits | null>(null);
  const load = useCallback(() => {
    run<{ nights: Night[]; photoLimits: PhotoLimits }>("getCrewPhotos", auth)
      .then((r) => { setNights(r.nights); setLimits(r.photoLimits); })
      .catch(() => setNights([]));
  }, [auth]);
  useEffect(() => { load(); }, [load]);
  const shown = (nights || []).filter((n) => n.cycleId !== skipCycleId);
  if (!shown.length || !limits) return null;
  const add = (cycleId: string, photo: Photo) =>
    setNights((ns) => ns && ns.map((n) => (n.cycleId === cycleId ? { ...n, photos: [photo, ...n.photos] } : n)));
  return (
    <section className="flex flex-col gap-6">
      <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-tight lg:text-[34px]">{title}</h2>
      {shown.map((n) => {
        const d = toDate(n.startsAt);
        return (
          <div key={n.cycleId} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-base font-medium">{n.venue || "A night out"}</span>
              <Mono className="shrink-0 text-xs text-fm-muted">{d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}{n.photos.length ? ` · ${n.photos.length}` : ""}</Mono>
            </div>
            {n.photos.length ? <PhotoStrip photos={n.photos} grid /> : <p className="m-0 text-sm text-fm-muted">No photos yet. Be the first.</p>}
            {n.uploadsOpen && n.myInviteId && (
              <AddPhotos
                inviteId={n.myInviteId}
                limits={limits}
                mine={n.photos.filter((p) => p.uploaderId === meId).length}
                onUploaded={(p) => add(n.cycleId, p)}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
