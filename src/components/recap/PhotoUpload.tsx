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
// There is no upload button here: picked photos wait in the grid until the
// surface's one Submit bar (RecapSubmitBar) calls submit() on this handle.
// Uploaded photos stay in the grid with a check, so a finished upload never
// looks like the photos vanished.

export type PhotoUploadHandle = {
  /** Uploads every waiting photo. Resolves false if any upload failed. */
  submit: () => Promise<boolean>;
};

type Staged = { id: string; preview: string; base64: string };

export default function PhotoUpload({
  ref,
  notificationId,
  limits,
  photoCount,
  uploadsClosed,
  variant = "card",
  onUploaded,
  onPendingChange,
}: {
  ref?: Ref<PhotoUploadHandle>;
  notificationId: string;
  limits: PhotoLimits;
  /** Photos this event already has, including ones uploaded here — callers
   *  bump it from onUploaded. Feeds the per-attendee cap. */
  photoCount: number;
  uploadsClosed: boolean;
  /** "card" is the /m page's dashed box; "bare" is the tighter modal version. */
  variant?: "card" | "bare";
  onUploaded?: (photo: Photo) => void;
  /** Picked photos still waiting to upload. */
  onPendingChange?: (count: number) => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploaded, setUploaded] = useState<{ id: string; src: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedRef = useRef<Staged[]>(staged);
  const inputId = `photo-upload-${notificationId}`;

  const maxMb = Math.round(limits.maxBytes / 1024 / 1024);

  useEffect(() => {
    stagedRef.current = staged;
    onPendingChange?.(staged.length);
  }, [staged, onPendingChange]);

  useImperativeHandle(ref, () => ({
    async submit() {
      const queue = stagedRef.current;
      if (queue.length === 0) return true;
      setError(null);
      setUploading(true);
      try {
        for (const s of queue) {
          const result = (await Parse.Cloud.run("uploadEventPhoto", {
            notificationId,
            fileBase64: s.base64,
            mimeType: "image/jpeg",
          })) as Photo;
          // Keep the local preview: it's already decoded, so the tile doesn't
          // blink while the uploaded file loads from the CDN.
          setUploaded((prev) => [...prev, { id: result.objectId, src: s.preview }]);
          setStaged((prev) => prev.filter((p) => p.id !== s.id));
          onUploaded?.(result);
        }
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        return false;
      } finally {
        setUploading(false);
      }
    },
  }));

  if (uploadsClosed) {
    if (variant === "bare") return null;
    return (
      <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50 text-center">
        <p className="text-sm text-zinc-500">Photo uploads for this event have closed.</p>
        <p className="text-[11px] text-zinc-400 mt-1">The gallery is still open for viewing.</p>
      </div>
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = limits.maxPerAttendee - photoCount - staged.length;
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
    if (next.length > 0) setStaged((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          {uploaded.map((u) => (
            <div key={u.id} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.src} alt="" className="w-full h-full object-cover rounded-lg" />
              <span
                role="img"
                aria-label="Uploaded"
                className="absolute top-1 right-1 bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
              >
                <Check className="w-3.5 h-3.5" />
              </span>
            </div>
          ))}
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
                  onClick={() => setStaged((prev) => prev.filter((p) => p.id !== s.id))}
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
      </div>

      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
