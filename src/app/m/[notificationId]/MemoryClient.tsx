"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import { Camera, Loader2, MapPin, Calendar, History } from "lucide-react";

type Photo = {
  objectId: string;
  url: string | null;
  caption: string | null;
  uploadedAt: string;
  uploaderName: string;
  uploaderId: string | null;
  eventGroupId: string | null;
};

type AttendeeMemoryInfo = {
  event: {
    objectId: string;
    title: string;
    description: string;
    image: string | null;
    expiryDate: string | null;
    location: { name: string; address: string } | null;
    host: { name: string } | null;
    calendarName: string | null;
  };
  attendee: { name: string };
  photos: Photo[];
  photoCount: number;
  limits: { maxBytes: number; maxPerAttendee: number; maxPerEvent: number };
};

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MemoryClient({
  notificationId,
  initialInfo,
}: {
  notificationId: string;
  initialInfo: AttendeeMemoryInfo | null;
}) {
  const [info, setInfo] = useState<AttendeeMemoryInfo | null>(initialInfo);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!info) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center">
        <p className="text-sm text-zinc-500">
          We couldn&apos;t find this invitation. The link may have expired.
        </p>
      </div>
    );
  }

  const maxMb = Math.round(info.limits.maxBytes / 1024 / 1024);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > info!.limits.maxBytes) {
          setError(`"${file.name}" is over ${maxMb} MB. Skipping.`);
          continue;
        }
        const { base64 } = await processImageFile(file);
        const result = (await Parse.Cloud.run("uploadEventPhoto", {
          notificationId,
          fileBase64: base64,
          mimeType: "image/jpeg",
        })) as Photo;
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                photos: [result, ...prev.photos],
                photoCount: prev.photoCount + 1,
              }
            : prev
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Event header */}
      <div className="mb-8">
        {info.event.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.event.image}
            alt={info.event.title}
            className="w-full h-48 sm:h-56 object-cover rounded-xl mb-5"
          />
        )}
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
          You attended
        </p>
        <h1 className="text-2xl sm:text-3xl font-light text-zinc-900 mb-3">
          {info.event.title}
        </h1>
        <div className="flex flex-col gap-1.5 text-sm text-zinc-500">
          {info.event.expiryDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {formatEventDate(info.event.expiryDate)}
            </div>
          )}
          {info.event.location?.name && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              {info.event.location.name}
            </div>
          )}
        </div>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center mb-6 bg-zinc-50/50">
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="photo-upload-input"
        />
        <label
          htmlFor="photo-upload-input"
          className={`inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          {uploading ? "Uploading…" : "Add photos"}
        </label>
        <p className="text-[11px] text-zinc-400 mt-3">
          Up to {info.limits.maxPerAttendee} photos · {maxMb} MB each
        </p>
        {error && (
          <p className="text-xs text-red-600 mt-3">{error}</p>
        )}
      </div>

      {/* Gallery */}
      {info.photos.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Gallery ({info.photoCount})
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {info.photos.map((photo) =>
              photo.url ? (
                <a
                  key={photo.objectId}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden bg-zinc-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || `Photo by ${photo.uploaderName}`}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : null
            )}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-400 py-8">
          No photos yet. Be the first to share one.
        </p>
      )}

      {/* Past events link */}
      <div className="border-t border-zinc-100 mt-10 pt-6 text-center">
        <Link
          href={`/m/${notificationId}/all`}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          See all your past events
        </Link>
      </div>
    </div>
  );
}
