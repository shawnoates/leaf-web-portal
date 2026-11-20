"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import type { Photo, PhotoLimits } from "./types";

// Photo staging + upload, shared by /m/[notificationId] and the /me recap
// popup.
//
// The upload window (EVENT_PHOTO_UPLOAD_WINDOW_MS, 7 days from the event) is
// much shorter than the rating window (90 days), so `uploadsClosed` is a real
// state both surfaces hit — never render a picker that can only fail.
//
// There is no upload button here, and no waiting on one: a picked photo starts
// uploading the moment it is picked. They used to wait for the surface's
// Submit bar, and in the grid a waiting photo looked exactly like a saved one —
// people left with nothing uploaded. Uploaded photos stay in the grid with a
// check, so a finished upload never looks like the photos vanished, and photos
// added on an earlier visit are shown back the same way.
//
// A saved photo can be taken back from the same grid (deleteEventPhoto): the
// server row goes, and with it the photo from every gallery and the share kit.
// That outlives the upload window — a closed picker still shows your photos
// with their delete buttons.
//
// A photo only stays waiting if its upload FAILED. Those keep their remove
// button, the error says why, and submit() on the handle (the Submit bar)
// tries them again.

export type PhotoUploadHandle = {
  /** Waits for the uploads in flight, retrying any that failed. Resolves
   *  false if a photo still couldn't be uploaded. */
  submit: () => Promise<boolean>;
};

type Staged = { id: string; preview: string; base64: string };

export default function PhotoUpload({
  ref,
  notificationId,
  limits,
  myPhotos = [],
  uploadsClosed,
  variant = "card",
  onUploaded,
  onRemoved,
  onPendingChange,
}: {
  ref?: Ref<PhotoUploadHandle>;
  notificationId: string;
  limits: PhotoLimits;
  /** This attendee's photos from earlier visits (Photo.mine). Read once, on
   *  mount; they count against the per-attendee cap. */
  myPhotos?: Photo[];
  uploadsClosed: boolean;
  /** "card" is the /m page's dashed box; "bare" is the tighter modal version. */
  variant?: "card" | "bare";
  onUploaded?: (photo: Photo) => void;
  /** A saved photo was deleted from the server. */
  onRemoved?: (photoId: string) => void;
  /** Picked photos still waiting to upload. */
  onPendingChange?: (count: number) => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploaded, setUploaded] = useState<{ id: string; src: string }[]>(() =>
    myPhotos.flatMap((p) => (p.url ? [{ id: p.objectId, src: p.url }] : []))
  );
  const [earlierCount] = useState(myPhotos.length);
  const [sessionCount, setSessionCount] = useState(0);
  // Deleted photos give their place back under the per-attendee cap.
  const [removedCount, setRemovedCount] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // What is still to upload, ahead of the `staged` state that draws it: the
  // upload loop reads this, and a render hasn't happened yet when it starts.
  const queueRef = useRef<Staged[]>([]);
  const drainRef = useRef<Promise<boolean> | null>(null);
  const inputId = `photo-upload-${notificationId}`;

  const maxMb = Math.round(limits.maxBytes / 1024 / 1024);

  useEffect(() => {
    onPendingChange?.(staged.length);
  }, [staged, onPendingChange]);

  // Uploads the queue, one photo at a time, until it is empty or one fails.
  // One run at a time: a second caller gets the run already going.
  function drain(): Promise<boolean> {
    if (drainRef.current) return drainRef.current;
    if (queueRef.current.length === 0) return Promise.resolve(true);
    const run = (async () => {
      setError(null);
      setUploading(true);
      try {
        while (queueRef.current.length > 0) {
          const s = queueRef.current[0];
          const result = (await Parse.Cloud.run("uploadEventPhoto", {
            notificationId,
            fileBase64: s.base64,
            mimeType: "image/jpeg",
          })) as Photo;
          queueRef.current = queueRef.current.filter((p) => p.id !== s.id);
          // Keep the local preview: it's already decoded, so the tile doesn't
          // blink while the uploaded file loads from the CDN.
          setUploaded((prev) => [...prev, { id: result.objectId, src: s.preview }]);
          setSessionCount((n) => n + 1);
          setStaged((prev) => prev.filter((p) => p.id !== s.id));
          onUploaded?.(result);
        }
        return true;
      } catch (err: unknown) {
        setError(
          `${err instanceof Error ? err.message : "Upload failed."} Tap Submit to try again.`,
        );
        return false;
      } finally {
        setUploading(false);
        drainRef.current = null;
      }
    })();
    drainRef.current = run;
    return run;
  }

  useImperativeHandle(ref, () => ({ submit: drain }));

  // The tile stays, dimmed, until the server says the photo is gone: a tile
  // that vanished and then came back on a failure would read as a glitch.
  async function removeUploaded(id: string) {
    if (removingId) return;
    setError(null);
    setRemovingId(id);
    try {
      await Parse.Cloud.run("deleteEventPhoto", { notificationId, photoId: id });
      setUploaded((prev) => prev.filter((u) => u.id !== id));
      setRemovedCount((n) => n + 1);
      onRemoved?.(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't remove that photo.");
    } finally {
      setRemovingId(null);
    }
  }

  // This attendee's saved photos, each with its delete button. Drawn in the
  // open picker and, once uploads have closed, on their own: the window stops
  // new photos, not someone taking theirs back.
  const savedTiles = uploaded.map((u) => (
    <div key={u.id} className="relative aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={u.src}
        alt=""
        className={`w-full h-full object-cover rounded-lg ${removingId === u.id ? "opacity-50" : ""}`}
      />
      <span
        role="img"
        aria-label="Saved"
        className="absolute bottom-1 left-1 bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
      >
        <Check className="w-3 h-3" />
      </span>
      {removingId === u.id ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-white drop-shadow" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => removeUploaded(u.id)}
          disabled={removingId !== null}
          aria-label="Delete photo"
          className="absolute top-1 right-1 bg-zinc-900/80 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-zinc-900"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  ));

  if (uploadsClosed) {
    // The popup's tighter version: just your photos, if you have any left.
    if (variant === "bare") {
      if (uploaded.length === 0) return null;
      return (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50/50 text-center">
          <div className="grid grid-cols-3 gap-2 mb-3">{savedTiles}</div>
          <p className="text-[11px] text-zinc-400">
            Uploads have closed. You can still delete a photo of yours. Tap × on it.
          </p>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      );
    }
    return (
      <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50 text-center">
        {uploaded.length > 0 && <div className="grid grid-cols-3 gap-2 mb-5">{savedTiles}</div>}
        <p className="text-sm text-zinc-500">Photo uploads for this event have closed.</p>
        <p className="text-[11px] text-zinc-400 mt-1">
          {uploaded.length > 0
            ? "You can still delete a photo of yours. Tap × on it."
            : "The gallery is still open for viewing."}
        </p>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = limits.maxPerAttendee - earlierCount - sessionCount + removedCount - staged.length;
    const next: Staged[] = [];
    for (const file of Array.from(files)) {
      if (next.length >= remaining) {
        setError(`You can only add ${limits.maxPerAttendee} photos to this event.`);
        break;
      }
      if (file.size > limits.maxBytes) {
        setError(`"${file.name}" is over ${maxMb} MB. Skipping.`);
        continue;
      }
      try {
        const { preview, base64 } = await processImageFile(file);
        next.push({ id: crypto.randomUUID(), preview, base64 });
      } catch {
        setError(`Couldn't read "${file.name}".`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (next.length > 0) {
      queueRef.current = [...queueRef.current, ...next];
      setStaged((prev) => [...prev, ...next]);
      void drain();
    }
  }

  const shell =
    variant === "card"
      ? "border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50"
      : "border-2 border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50/50";

  const hasTiles = uploaded.length > 0 || staged.length > 0;

  return (
    <div className={shell}>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        id={inputId}
      />

      {hasTiles && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {savedTiles}
          {staged.map((s) => (
            <div key={s.id} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.preview}
                alt=""
                className={`w-full h-full object-cover rounded-lg ${uploading ? "opacity-60" : ""}`}
              />
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white drop-shadow" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    queueRef.current = queueRef.current.filter((p) => p.id !== s.id);
                    setStaged((prev) => prev.filter((p) => p.id !== s.id));
                  }}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 bg-zinc-900/80 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-zinc-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          {hasTiles ? "Add more" : "Add photos"}
        </label>
        <p className="text-[11px] text-zinc-400 mt-3">
          Up to {limits.maxPerAttendee} photos · {maxMb} MB each
        </p>
        {hasTiles && (
          <p className="text-[11px] text-zinc-400 mt-1" aria-live="polite">
            {uploading
              ? "Saving your photos…"
              : staged.length > 0
                ? "Some photos didn't save."
                : "Photos save as soon as you add them. Tap × to delete one."}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
