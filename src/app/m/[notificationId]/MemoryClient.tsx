"use client";

import { useState, useRef } from "react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import {
  Camera,
  Loader2,
  MapPin,
  Calendar,
  X,
  Upload,
  Check,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import HostTheNextOne from "@/components/HostTheNextOne";

type Photo = {
  objectId: string;
  url: string | null;
  caption: string | null;
  uploadedAt: string;
  uploaderName: string;
  uploaderId: string | null;
  eventGroupId: string | null;
};

type Attendee = {
  notificationId: string;
  name: string;
  checkedInViaMobile: boolean;
  checkedInAt: string | null;
  attendedAt: string | null;
  attendedSource: string | null;
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
  calendar?: {
    objectId: string;
    shareId: string | null;
    name: string | null;
    hidePlanIdeas?: boolean;
    hideCustomPlans?: boolean;
  } | null;
  viewerRole?: "owner" | "host" | "attendee";
  canMarkAttendance?: boolean;
  attendanceClosed?: boolean;
  nextPlanIdea?: {
    objectId: string;
    title: string;
    description: string;
    image: string | null;
    date: string | null;
    location: { name: string; address: string } | null;
  } | null;
  nextSeriesInstance?: {
    objectId: string;
    title: string;
    expiryDate: string | null;
  } | null;
  recap?: {
    rsvpCount: number;
    photoCount: number;
    dayOfWeek: string | null;
    timeOfDay: string | null;
    venueName: string | null;
    weeksSinceLastPlan: number | null;
  };
  attendee: { name: string };
  attendees?: Attendee[];
  photos: Photo[];
  photoCount: number;
  uploadsClosed?: boolean;
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
  initialError,
}: {
  notificationId: string;
  initialInfo: AttendeeMemoryInfo | null;
  initialError?: string | null;
}) {
  const [info, setInfo] = useState<AttendeeMemoryInfo | null>(initialInfo);
  const [staged, setStaged] = useState<
    { id: string; preview: string; base64: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHostOtp, setShowHostOtp] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshInfo() {
    try {
      const fresh = (await Parse.Cloud.run("getAttendeeMemoryInfo", {
        notificationId,
      })) as AttendeeMemoryInfo;
      setInfo(fresh);
    } catch (err) {
      console.error("[MemoryClient] refresh failed:", err);
    }
  }

  async function toggleAttendance(attendee: Attendee) {
    if (attendee.checkedInViaMobile) return; // mobile check-ins are read-only
    setMarkingId(attendee.notificationId);
    setError(null);
    const nextAttended = !attendee.attendedAt;
    try {
      await Parse.Cloud.run("markAttendance", {
        notificationId,
        attendeeNotificationId: attendee.notificationId,
        attended: nextAttended,
      });
      setInfo((prev) =>
        prev && prev.attendees
          ? {
              ...prev,
              attendees: prev.attendees.map((a) =>
                a.notificationId === attendee.notificationId
                  ? {
                      ...a,
                      attendedAt: nextAttended ? new Date().toISOString() : null,
                      attendedSource: nextAttended ? "host" : null,
                    }
                  : a
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't update attendance.");
    } finally {
      setMarkingId(null);
    }
  }

  if (!info) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-zinc-700 mb-2">
            We couldn&apos;t open this invitation.
          </p>
          {initialError && (
            <p className="text-xs text-zinc-500 font-mono break-words">
              {initialError}
            </p>
          )}
          <p className="text-[11px] text-zinc-400 mt-3">
            Link id: <span className="font-mono">{notificationId}</span>
          </p>
        </div>
      </div>
    );
  }

  const maxMb = Math.round(info.limits.maxBytes / 1024 / 1024);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining =
      info!.limits.maxPerAttendee - info!.photoCount - staged.length;
    const next: { id: string; preview: string; base64: string }[] = [];
    for (const file of Array.from(files)) {
      if (next.length >= remaining) {
        setError(
          `You can only add ${info!.limits.maxPerAttendee} photos to this event.`
        );
        break;
      }
      if (file.size > info!.limits.maxBytes) {
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

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
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
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                photos: [result, ...prev.photos],
                photoCount: prev.photoCount + 1,
              }
            : prev
        );
        setStaged((prev) => prev.filter((p) => p.id !== s.id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
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
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
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

      {/* Upload area — hidden once the 7-day upload window closes */}
      {info.uploadsClosed ? (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50 text-center">
          <p className="text-sm text-zinc-500">
            Photo uploads for this event have closed.
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            The gallery is still open for viewing.
          </p>
        </div>
      ) : (
      <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 mb-6 bg-zinc-50/50">
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="photo-upload-input"
        />
        <div className="text-center">
          <label
            htmlFor="photo-upload-input"
            className={`inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            {staged.length > 0 ? "Add more" : "Add photos"}
          </label>
          <p className="text-[11px] text-zinc-400 mt-3">
            Up to {info.limits.maxPerAttendee} photos · {maxMb} MB each
          </p>
        </div>

        {staged.length > 0 && (
          <div className="mt-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {staged.map((s) => (
                <div key={s.id} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.preview}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeStaged(s.id)}
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

        {error && (
          <p className="text-xs text-red-600 mt-3 text-center">{error}</p>
        )}
      </div>
      )}

      {/* Mark Attendance — host-only. Visible when the link belongs to the host
          (viewerRole === host|owner); writes require host-phone OTP verification. */}
      {(info.viewerRole === "host" || info.viewerRole === "owner") &&
        info.attendees && info.attendees.length > 0 && (
        <div className="border border-zinc-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Mark Attendance
            </h2>
            {(() => {
              const attended = info.attendees.filter(
                (a) => a.attendedAt || a.checkedInViaMobile
              ).length;
              return (
                <span className="text-[11px] text-zinc-400">
                  {attended}/{info.attendees.length}
                </span>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            {info.attendanceClosed
              ? "Attendance editing closed 7 days after the event. Existing marks are still counted."
              : "Check off who actually showed up. People who checked in on the Leaf app are already counted."}
          </p>

          {info.attendanceClosed ? (
            <ul className="divide-y divide-zinc-100">
              {info.attendees.map((a) => {
                const isMarked = !!a.attendedAt || a.checkedInViaMobile;
                return (
                  <li
                    key={a.notificationId}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isMarked ? "text-emerald-600" : "text-zinc-300"
                        }`}
                      />
                      <span className="text-sm text-zinc-800 truncate">
                        {a.name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        a.checkedInViaMobile
                          ? "text-emerald-700 bg-emerald-50"
                          : a.attendedAt
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-zinc-500 bg-zinc-100"
                      }`}
                    >
                      {a.checkedInViaMobile
                        ? "Checked in"
                        : a.attendedAt
                        ? "Attended"
                        : "No-show"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : !info.canMarkAttendance ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-center">
              <ShieldCheck className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs text-zinc-600 mb-3">
                Verify your phone to mark attendance.
              </p>
              <button
                type="button"
                onClick={() => setShowHostOtp(true)}
                className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
              >
                Verify as host
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {info.attendees.map((a) => {
                const isMarked = !!a.attendedAt || a.checkedInViaMobile;
                const isBusy = markingId === a.notificationId;
                return (
                  <li
                    key={a.notificationId}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isMarked ? "text-emerald-600" : "text-zinc-300"
                        }`}
                      />
                      <span className="text-sm text-zinc-800 truncate">
                        {a.name}
                      </span>
                      {a.checkedInViaMobile && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Checked in
                        </span>
                      )}
                    </div>
                    {a.checkedInViaMobile ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleAttendance(a)}
                        disabled={isBusy}
                        aria-pressed={!!a.attendedAt}
                        className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                          a.attendedAt ? "bg-emerald-600" : "bg-zinc-200"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            a.attendedAt ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {showHostOtp && (
        <HostOtpModal
          onClose={() => setShowHostOtp(false)}
          onVerified={async () => {
            setShowHostOtp(false);
            await refreshInfo();
          }}
        />
      )}

      {/* Gallery */}
      {info.photos.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
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

      {/* Host the next one — prefers a real plan idea, falls back to a
          repeat of this plan when custom plans are enabled. */}
      {info.recap && info.calendar && (
        <HostTheNextOne
          viewerRole={info.viewerRole || "attendee"}
          calendar={info.calendar}
          recap={info.recap}
          event={{
            title: info.event.title,
            description: info.event.description,
            image: info.event.image,
            location: info.event.location,
          }}
          nextPlanIdea={info.nextPlanIdea || null}
          nextSeriesInstance={info.nextSeriesInstance || null}
          returnTo={`/m/${notificationId}`}
        />
      )}

    </div>
  );
}

function HostOtpModal({
  onClose,
  onVerified,
}: {
  onClose: () => void;
  onVerified: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function sendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setErr("Enter a valid 10-digit phone number.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't send code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    const digits = phone.replace(/\D/g, "");
    if (code.length < 4) {
      setErr("Enter the full code.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const result = (await Parse.Cloud.run("verifyOTP", {
        phone: `+1${digits}`,
        code,
      })) as { sessionToken?: string } | string;
      const sessionToken =
        typeof result === "string" ? result : result?.sessionToken;
      if (!sessionToken || !sessionToken.startsWith("r:")) {
        throw new Error(
          typeof result === "string" && result
            ? result
            : "Verification failed. Try again."
        );
      }
      await Parse.User.become(sessionToken);
      await onVerified();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-zinc-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Verify as host</h3>
            <p className="text-xs text-zinc-500">
              {step === "phone"
                ? "Confirm the phone on your Leaf account."
                : `Sent to +1 ${phone}`}
            </p>
          </div>
        </div>

        {step === "phone" ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-zinc-400">+1</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(555) 123-4567"
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300"
                autoFocus
              />
            </div>
            {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
            <button
              onClick={sendCode}
              disabled={busy}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Enter code"
              className="w-full px-3 py-2 text-sm text-center tracking-widest border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 mb-3"
              autoFocus
            />
            {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
            <button
              onClick={submitCode}
              disabled={busy}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors mb-2"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              onClick={() => {
                setStep("phone");
                setCode("");
                setErr("");
              }}
              className="w-full text-xs text-zinc-400 hover:text-zinc-600"
            >
              Use a different number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
