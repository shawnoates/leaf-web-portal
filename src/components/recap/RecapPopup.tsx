"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, X, Check, CalendarX } from "lucide-react";
import Parse from "@/lib/parse-client";
import SurveyCard from "./SurveyCard";
import PhotoUpload from "./PhotoUpload";
import type { PhotoLimits, SurveyState, VirtualHostInfo } from "./types";

// The post-event ask, shown over /me for a plan the viewer attended and hasn't
// rated. Same three actions as the /m memory page — rate the plan, rate the
// virtual host, add photos — plus the one thing /m has never had: "I didn't
// attend".
//
// It loads getAttendeeMemoryInfo on open rather than taking the survey state
// from the dashboard payload. That's one extra round trip, only when the popup
// actually opens, and it buys two things: /me can't drift from /m as the survey
// grows, and the dashboard query stays cheap for the (common) case where
// nobody opens the popup at all.
//
// Rendered through a portal into <body> on purpose: /me's styling is a scoped
// `.leafme` stylesheet that resets margins on headings and paragraphs, which
// would quietly reflow these Tailwind-styled shared components.

type MemoryInfo = {
  event: {
    objectId: string;
    title: string;
    image: string | null;
    expiryDate: string | null;
    location: { name: string; address: string } | null;
    calendarName: string | null;
  };
  attendee: { name: string };
  photoCount: number;
  uploadsClosed?: boolean;
  limits: PhotoLimits;
  survey?: SurveyState;
  virtualHost?: VirtualHostInfo | null;
};

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  const date = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  if (days <= 0) return `${date} · today`;
  if (days === 1) return `${date} · yesterday`;
  if (days < 7) return `${date} · ${days} days ago`;
  return date;
}

export default function RecapPopup({
  notificationId,
  planTitle,
  calendarName,
  image,
  endedAt,
  onClose,
  onAnswered,
}: {
  notificationId: string;
  /** Dashboard-supplied fallbacks so the header renders before the fetch lands. */
  planTitle: string;
  calendarName: string | null;
  image: string | null;
  endedAt: string | null;
  onClose: () => void;
  /** Fired once this plan no longer owes an answer — rated, or "didn't attend". */
  onAnswered: (notificationId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [info, setInfo] = useState<MemoryInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    Parse.Cloud.run("getAttendeeMemoryInfo", { notificationId })
      .then((res: MemoryInfo) => {
        if (cancelled) return;
        setInfo(res);
        setPhotoCount(res?.photoCount || 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Couldn't open this plan.");
      });
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  async function declineAttendance() {
    setDeclining(true);
    try {
      await Parse.Cloud.run("reportSelfAttendance", { notificationId, attended: false });
      setDeclined(true);
      onAnswered(notificationId);
      window.setTimeout(onClose, 1200);
    } catch {
      // A failed self-report shouldn't trap them in the modal — the ask simply
      // comes back next time, which is the safe direction to fail.
      onClose();
    } finally {
      setDeclining(false);
    }
  }

  if (!mounted) return null;

  const title = info?.event.title || planTitle;
  const calendar = info?.event.calendarName || calendarName;
  const img = info?.event.image || image;
  const when = whenLabel(info?.event.expiryDate || endedAt);
  const venue = info?.event.location?.name || null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-zinc-900/60 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`How was ${title}?`}
        className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-zinc-600 hover:text-zinc-900"
        >
          <X className="w-4 h-4" />
        </button>

        {img && (
          <div className="w-full h-32 sm:h-40 overflow-hidden rounded-t-2xl bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5 sm:p-6">
          {declined ? (
            <div className="py-10 text-center">
              <Check className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-700">Thanks — we won&apos;t ask about this one again.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {calendar || "Leaf"}
              </p>
              <h2 className="text-xl sm:text-2xl font-light text-zinc-900 mt-1">{title}</h2>
              <p className="text-xs text-zinc-500 mt-1">
                {[when, venue].filter(Boolean).join(" · ")}
              </p>

              {/* The escape hatch sits with the header, not under the form:
                  someone who wasn't there shouldn't have to scroll past a
                  rating they can't give to say so — and it's a real button,
                  because a text link reads as fine print you're meant to skip. */}
              <div className="mt-4">
                {confirmingDecline ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={declineAttendance}
                      disabled={declining}
                      className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      {declining && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {declining ? "Saving…" : "Yes, I didn't go"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDecline(false)}
                      className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                    >
                      Never mind
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDecline(true)}
                    className="inline-flex items-center gap-2 border border-zinc-300 text-zinc-700 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                  >
                    <CalendarX className="w-3.5 h-3.5" />
                    I didn&apos;t attend
                  </button>
                )}
              </div>

              {loadError ? (
                <p className="text-sm text-zinc-600 mt-6">{loadError}</p>
              ) : !info ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <>
                  {info.survey?.acceptingResponses && (
                    <div className="mt-5 pt-5 border-t border-zinc-100">
                      <SurveyCard
                        notificationId={notificationId}
                        survey={info.survey}
                        virtualHost={info.virtualHost}
                        attendeeName={info.attendee?.name || "you"}
                        variant="bare"
                        onSaved={() => {
                          setRated(true);
                          onAnswered(notificationId);
                        }}
                      />
                    </div>
                  )}

                  {!info.uploadsClosed && (
                    <div className="mt-5 pt-5 border-t border-zinc-100">
                      {/* Time-neutral on purpose — plenty of plans are a
                          morning run or a lunch, not a night out. */}
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                        Add your photos
                      </h3>
                      <PhotoUpload
                        notificationId={notificationId}
                        limits={info.limits}
                        photoCount={photoCount}
                        uploadsClosed={false}
                        variant="bare"
                        onUploaded={() => setPhotoCount((n) => n + 1)}
                      />
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-zinc-100 text-right">
                    <Link
                      href={`/m/${notificationId}`}
                      className="text-xs text-zinc-500 hover:text-zinc-800 underline"
                    >
                      {rated ? "See the gallery ↗" : "Open the full page ↗"}
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
