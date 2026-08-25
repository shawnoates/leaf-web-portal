"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X, Upload } from "lucide-react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import type { Photo, PhotoLimits } from "./types";

// Photo staging + upload, shared by /m/[notificationId] and the /me recap
// popup.
//
// The upload window (EVENT_PHOTO_UPLOAD_WINDOW_MS, 7 days from the event) is
// much shorter than the rating window (90 days), so `uploadsClosed` is a real
// state both surfaces hit — never render a picker that can only fail.

export default function PhotoUpload({
  notificationId,
  limits,
  photoCount,
  uploadsClosed,
  variant = "card",
  onUploaded,
}: {
  notificationId: string;
  limits: PhotoLimits;
  /** Photos this event already has — feeds the per-attendee cap. */
  photoCount: number;
  uploadsClosed: boolean;
  /** "card" is the /m page's dashed box; "bare" is the tighter modal version. */
  variant?: "card" | "bare";
  onUploaded?: (photo: Photo) => void;
}) {
  const [staged, setStaged] = useState<{ id: string; preview: string; base64: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = `photo-upload-${notificationId}`;

  const maxMb = Math.round(limits.maxBytes / 1024 / 1024);

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
    const remaining = limits.maxPerAttendee - photoCount - uploadedCount - staged.length;
    const next: { id: string; preview: string; base64: string }[] = [];
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

  async function submitStaged() {
    if (staged.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const s of staged) {
        const result = (await Parse.Cloud.run("uploadEventPhoto", {
          notificationId,
          fileBase64: s.base64,
          mimeType: "image/jpeg",
        })) as Photo;
        setUploadedCount((n) => n + 1);
        onUploaded?.(result);
        setStaged((prev) => prev.filter((p) => p.id !== s.id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const shell =
    variant === "card"
      ? "border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50"
      : "border-2 border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50/50";

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
      <div className="text-center">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          {staged.length > 0 ? "Add more" : "Add photos"}
        </label>
        <p className="text-[11px] text-zinc-400 mt-3">
          Up to {limits.maxPerAttendee} photos · {maxMb} MB each
        </p>
      </div>

      {staged.length > 0 && (
        <div className="mt-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {staged.map((s) => (
              <div key={s.id} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => setStaged((prev) => prev.filter((p) => p.id !== s.id))}
                  disabled={uploading}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 bg-zinc-900/80 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-zinc-900 disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={submitStaged}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploading
                ? "Uploading…"
                : `Submit ${staged.length} ${staged.length === 1 ? "photo" : "photos"}`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
