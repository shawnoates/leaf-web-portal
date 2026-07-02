"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Star, Users, MessageSquare, Loader2 } from "lucide-react";

interface Feedback {
  responseCount: number;
  avgRating: number | null;
  comments: { name: string; rating: number | null; comment: string }[];
}

interface Guarantee {
  tier: "unconditional_first" | "make_it_right" | string;
  windowEndsAt: string | null;
  eligible: boolean;
  claimStatus: string | null;
}

interface EventReport {
  eventGroupId: string;
  title: string;
  eventDate: string | null;
  rsvpCount: number;
  attendance: number | null;
  feedback: Feedback;
  recap: { headline: string | null; body: string | null; photoUrls: string[]; publishedAt: string | null } | null;
  guarantee: Guarantee;
}

const CLAIM_STATUS_LABEL: Record<string, string> = {
  auto_refunded: "This month refunded — check your statement.",
  pending_admin: "We're on it — the Leaf team will make this right.",
  resolved: "Resolved by the Leaf team.",
  declined: "Reviewed by the Leaf team.",
};

/**
 * Owner-facing post-event report for concierge calendars. Read-only: surfaces
 * the attendee feedback (ratings + comments collected at /m/), turnout, and the
 * admin-authored recap narrative. Renders nothing until there's a past event.
 */
export default function ConciergeEventReports({ calendarId }: { calendarId: string }) {
  const [reports, setReports] = useState<EventReport[] | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const fileClaim = async (eventGroupId: string) => {
    setClaimBusy(true);
    setClaimError(null);
    try {
      const r: { status: string } = await Parse.Cloud.run("submitConciergeGuaranteeClaim", {
        calendarId,
        eventGroupId,
        reasonNote: reason,
      });
      setReports((prev) =>
        prev
          ? prev.map((x) =>
              x.eventGroupId === eventGroupId
                ? { ...x, guarantee: { ...x.guarantee, eligible: false, claimStatus: r.status } }
                : x
            )
          : prev
      );
      setClaimingId(null);
      setReason("");
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Couldn't file the claim.");
    } finally {
      setClaimBusy(false);
    }
  };

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

                {/* Satisfaction guarantee */}
                {r.guarantee.claimStatus ? (
                  <p className="mt-3 text-xs text-emerald-700 border-t border-zinc-100 pt-3">
                    {CLAIM_STATUS_LABEL[r.guarantee.claimStatus] || "Claim received."}
                  </p>
                ) : r.guarantee.eligible ? (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    {claimingId === r.eventGroupId ? (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-600">
                          {r.guarantee.tier === "unconditional_first"
                            ? "First event — if you didn't love it, we'll refund this month, no questions asked."
                            : "We'll make it right — a refund this month or a comped event next month, your call."}
                        </p>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          placeholder="What didn't land? (optional)"
                          className="w-full resize-none border border-zinc-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-zinc-500"
                        />
                        {claimError && <p className="text-xs text-red-500">{claimError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => fileClaim(r.eventGroupId)}
                            disabled={claimBusy}
                            className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                          >
                            {claimBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Request the guarantee
                          </button>
                          <button
                            onClick={() => {
                              setClaimingId(null);
                              setReason("");
                              setClaimError(null);
                            }}
                            className="text-xs text-zinc-500 hover:text-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setClaimingId(r.eventGroupId)}
                        className="text-xs text-zinc-500 underline hover:text-zinc-800"
                      >
                        Not happy with this event?
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
