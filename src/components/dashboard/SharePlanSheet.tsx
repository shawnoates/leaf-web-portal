"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Share2, X, Zap } from "lucide-react";
import Parse from "@/lib/parse-client";
import { track } from "@/lib/track";

// "Share with communities" — the owner picks other calendars to share one
// plan with, in one tap. Siblings, calendars they also own, and partners add
// instantly; nearby communities get a request their owner can Add or Skip.
// Everything eligible starts checked: the receiving owner is the gate, and
// the server caps how much can land on any one calendar.

type Kind = "sibling" | "owned" | "partner" | "nearby";

interface Target {
  calendarId: string;
  name: string;
  shareId: string | null;
  photoUrl: string | null;
  followerCount: number;
  distanceMiles: number | null;
  kind: Kind;
  autoAccept: boolean;
  status: "pending" | "accepted" | null;
  promotionId: string | null;
}

interface TargetsPayload {
  targets: Target[];
  maxTargets: number;
  planIsShareable: boolean;
}

interface RequestResult {
  results: { calendarId: string; status: string | null; promotionId: string | null; reason: string }[];
  instantCount: number;
  pendingCount: number;
}

const KIND_LABEL: Record<Kind, string> = {
  sibling: "Your calendar",
  owned: "Your calendar",
  partner: "Partner",
  nearby: "Nearby",
};

export default function SharePlanSheet({
  eventGroupId,
  planTitle,
  calendarId,
  onClose,
  onSent,
}: {
  eventGroupId: string;
  planTitle: string;
  calendarId?: string | null;
  onClose: () => void;
  /** Fires after a successful send with what happened, for a toast. */
  onSent?: (summary: { instant: number; pending: number }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TargetsPayload | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ instant: number; pending: number; skipped: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await Parse.Cloud.run("listPromotionTargets", { eventGroupId })) as TargetsPayload;
        if (cancelled) return;
        setData(res);
        const initial = new Set<string>();
        let n = 0;
        for (const t of res.targets) {
          if (t.status) continue; // already pending/added
          if (n >= res.maxTargets) break;
          initial.add(t.calendarId);
          n++;
        }
        setChecked(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load communities");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventGroupId]);

  const groups = useMemo(() => {
    const t = data?.targets ?? [];
    return {
      instant: t.filter((x) => x.autoAccept),
      nearby: t.filter((x) => !x.autoAccept),
    };
  }, [data]);

  const maxTargets = data?.maxTargets ?? 10;
  const selectable = (data?.targets ?? []).filter((t) => !t.status);
  const selectedCount = checked.size;
  const instantSelected = groups.instant.filter((t) => checked.has(t.calendarId)).length;
  const pendingSelected = selectedCount - instantSelected;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxTargets) next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!data || selectedCount === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = (await Parse.Cloud.run("requestPlanPromotions", {
        eventGroupId,
        calendarIds: [...checked],
      })) as RequestResult;
      const skipped = res.results.filter((r) => !r.promotionId).length;
      setDone({ instant: res.instantCount, pending: res.pendingCount, skipped });
      track("cross_promo_share_sent", {
        planId: eventGroupId,
        targets: selectedCount,
        instant: res.instantCount,
        pending: res.pendingCount,
      }, calendarId ?? null);
      onSent?.({ instant: res.instantCount, pending: res.pendingCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share the plan");
    } finally {
      setSending(false);
    }
  };

  const row = (t: Target) => {
    const disabled = Boolean(t.status);
    const on = checked.has(t.calendarId);
    const meta = [
      `${t.followerCount} follower${t.followerCount === 1 ? "" : "s"}`,
      t.distanceMiles != null ? `${t.distanceMiles} mi` : null,
      t.kind !== "nearby" ? KIND_LABEL[t.kind] : null,
    ].filter(Boolean).join(" · ");
    return (
      <label
        key={t.calendarId}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
          disabled ? "border-zinc-100 bg-zinc-50 cursor-default" : on ? "border-zinc-900 bg-white cursor-pointer" : "border-zinc-200 bg-white hover:border-zinc-300 cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={on}
          disabled={disabled}
          onChange={() => toggle(t.calendarId)}
        />
        <span
          aria-hidden
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
            disabled ? "border-zinc-200 bg-zinc-100" : on ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"
          }`}
        >
          {on && !disabled && <Check className="w-3.5 h-3.5 text-white" />}
        </span>
        {t.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        ) : (
          <span className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-500 text-xs font-semibold flex items-center justify-center shrink-0">
            {(t.name || "?").trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-zinc-900 truncate">{t.name}</span>
          <span className="block text-[11px] text-zinc-500 truncate">{meta}</span>
        </span>
        {t.status === "accepted" && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 shrink-0">Added</span>
        )}
        {t.status === "pending" && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 shrink-0">Pending</span>
        )}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-2 text-zinc-900">
            <Share2 className="w-4 h-4 text-zinc-500" />
            Share with communities
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-800 font-medium">{planTitle} is on its way.</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {done.instant > 0 && `Added to ${done.instant} calendar${done.instant === 1 ? "" : "s"} instantly. `}
              {done.pending > 0 && `${done.pending} owner${done.pending === 1 ? "" : "s"} will get a request to add it. `}
              {done.skipped > 0 && `${done.skipped} couldn't take it right now.`}
              {done.instant === 0 && done.pending === 0 && done.skipped === 0 && "Nothing new to send."}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-zinc-900 text-white text-xs font-medium rounded-full hover:bg-zinc-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="font-medium text-zinc-700">{planTitle}</span> stays one plan with one
                guest list. Other communities list it on their page and in their
                weekly digest, and their followers RSVP straight to you.
              </p>

              {loading ? (
                <div className="py-8 flex justify-center text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
              ) : data && !data.planIsShareable ? (
                <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-600 text-sm rounded-lg">
                  Only upcoming plans with at least half a day to go can be shared.
                </div>
              ) : data && data.targets.length === 0 ? (
                <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-600 text-sm rounded-lg">
                  No other communities nearby yet. Partnerships you form under Grow › Collabs will show up here.
                </div>
              ) : (
                <>
                  {groups.instant.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 inline-flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> Adds instantly
                      </p>
                      {groups.instant.map(row)}
                    </div>
                  )}
                  {groups.nearby.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400">
                        Nearby · needs their OK
                      </p>
                      {groups.nearby.map(row)}
                    </div>
                  )}
                  {selectable.length > maxTargets && (
                    <p className="text-[11px] text-zinc-400">Up to {maxTargets} communities per plan.</p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
              <span className="text-[11px] text-zinc-500">
                {selectedCount > 0
                  ? [instantSelected > 0 ? `${instantSelected} instant` : null, pendingSelected > 0 ? `${pendingSelected} need OK` : null].filter(Boolean).join(" · ")
                  : "Pick at least one"}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={sending || loading || selectedCount === 0 || !data?.planIsShareable}
                  className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-medium px-4 py-2.5 rounded-full transition-colors"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Share with {selectedCount} communit{selectedCount === 1 ? "y" : "ies"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
