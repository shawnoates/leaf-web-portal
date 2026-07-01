"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Star, Users, MessageSquare, Loader2 } from "lucide-react";

interface Feedback {
  responseCount: number;
  avgRating: number | null;
  comments: { name: string; rating: number | null; comment: string }[];
}

interface EventReport {
  eventGroupId: string;
  title: string;
  eventDate: string | null;
  rsvpCount: number;
  attendance: number | null;
  feedback: Feedback;
  recap: { headline: string | null; body: string | null; photoUrls: string[]; publishedAt: string | null } | null;
}

/**
 * Owner-facing post-event report for concierge calendars. Read-only: surfaces
 * the attendee feedback (ratings + comments collected at /m/), turnout, and the
 * admin-authored recap narrative. Renders nothing until there's a past event.
 */
export default function ConciergeEventReports({ calendarId }: { calendarId: string }) {
  const [reports, setReports] = useState<EventReport[] | null>(null);

  useEffect(() => {
    let alive = true;
    Parse.Cloud.run("getConciergeEventReports", { calendarId })
      .then((r: { reports: EventReport[] }) => {
        if (alive) setReports(r.reports || []);
      })
      .catch(() => {
        if (alive) setReports([]);
      });
    return () => {
      alive = false;
    };
  }, [calendarId]);

  if (reports === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading event reports…
      </div>
    );
  }
  if (reports.length === 0) return null;

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3">Event reports</h2>
      <div className="space-y-4">
        {reports.map((r) => {
          const fb = r.feedback;
          return (
            <div key={r.eventGroupId} className="border border-zinc-200 rounded-xl overflow-hidden">
              {r.recap?.photoUrls?.length ? (
                <div className="flex gap-1 h-32 bg-zinc-100">
                  {r.recap.photoUrls.slice(0, 3).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="" className="flex-1 h-full object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-zinc-900">
                      {r.recap?.headline || r.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{fmtDate(r.eventDate)}</p>
                  </div>
                  {fb.avgRating != null && (
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-amber-500 font-semibold">
                        <Star className="w-4 h-4 fill-amber-500" />
                        {fb.avgRating.toFixed(1)}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {fb.responseCount} {fb.responseCount === 1 ? "rating" : "ratings"}
                      </div>
                    </div>
                  )}
                </div>

                {r.recap?.body && (
                  <p className="text-sm text-zinc-600 leading-relaxed mt-2">{r.recap.body}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {r.attendance != null ? `${r.attendance} attended` : `${r.rsvpCount} RSVPs`}
                  </span>
                  {fb.responseCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {fb.comments.length} {fb.comments.length === 1 ? "comment" : "comments"}
                    </span>
                  )}
                </div>

                {fb.comments.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                    {fb.comments.slice(0, 4).map((c, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-zinc-700">“{c.comment}”</span>{" "}
                        <span className="text-xs text-zinc-400">
                          — {c.name}
                          {c.rating != null ? ` · ${c.rating}★` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {fb.responseCount === 0 && !r.recap && (
                  <p className="text-xs text-zinc-400 mt-3">
                    Attendee ratings will appear here after the event.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
