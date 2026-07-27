"use client";

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Clock, Loader2, Minus, Plus, Sparkles, X } from "lucide-react";

// A representative host face for the "Add virtual host" CTA, shown before a
// specific persona is picked (that happens server-side on attach). The neutral
// persona (Jules) so it reads well for any audience.
export const DEFAULT_HOST_AVATAR =
  "https://leaf-storage.s3.us-west-2.amazonaws.com/concierge-personas/jules.png";

// Round host avatar that falls back to a sparkle glyph if the image is missing
// or 404s (persona avatar URLs can go stale) — so the UI never shows a broken
// image icon. `className` sets the size (e.g. "w-4 h-4").
export function HostAvatar({ src, className }: { src?: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} inline-flex items-center justify-center`}>
        <Sparkles className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover`}
    />
  );
}

// "What's included" info + capacity + pay sheet for attaching a Virtual Host
// (VIRTUAL_HOST_SPEC §6.2). One of planIdeaId / eventGroupId identifies the
// target. Concierge-tier calendars attach free; everyone else pays a flat $25
// via Stripe Checkout (we redirect, and the webhook completes the attach).
interface VhInfo {
  calendarName: string;
  persona: { id: string; name: string; avatarUrl: string | null } | null;
  feeUsd: number;
  included: boolean;
  maxCapacity: number;
  capacityDefault: number | null;
  replyLabel: string;
  eligible: boolean;
  reason: string | null;
  includes: string[];
}

export default function VirtualHostSheet({
  calendarId,
  planIdeaId,
  eventGroupId,
  returnTo,
  onClose,
  onAttached,
}: {
  calendarId: string;
  planIdeaId?: string;
  eventGroupId?: string;
  returnTo?: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [info, setInfo] = useState<VhInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r: VhInfo = await Parse.Cloud.run("getVirtualHostInfo", {
        calendarId,
        planIdeaId,
        eventGroupId,
      });
      setInfo(r);
      setCapacity(Math.min(r.capacityDefault || r.maxCapacity, r.maxCapacity));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load virtual host details.");
    } finally {
      setLoading(false);
    }
  }, [calendarId, planIdeaId, eventGroupId]);

  useEffect(() => { load(); }, [load]);

  async function handleAttach() {
    if (!info) return;
    setSubmitting(true);
    setError(null);
    try {
      const res: { attached: boolean; checkoutUrl?: string } = await Parse.Cloud.run("attachVirtualHost", {
        calendarId,
        planIdeaId,
        eventGroupId,
        capacity,
        // Attach the exact persona the sheet showed the owner.
        personaId: info.persona?.id,
        returnUrl: returnTo || (typeof window !== "undefined" ? window.location.href : undefined),
      });
      if (res.attached) {
        onAttached();
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl; // Stripe Checkout
      } else {
        setError("Something went wrong starting checkout.");
        setSubmitting(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't attach the virtual host.");
      setSubmitting(false);
    }
  }

  const persona = info?.persona;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      onClick={() => { if (!submitting) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 bg-gradient-to-br from-teal-600 to-emerald-700 px-6 pt-6 pb-5 text-white">
          <button
            onClick={() => { if (!submitting) onClose(); }}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-white/20 rounded-full pl-1 pr-2.5 py-1 mb-3">
            <HostAvatar src={persona?.avatarUrl} className="w-4 h-4" />
            AI-assisted host
          </div>
          <h3 className="text-xl font-semibold leading-tight">Add a virtual host</h3>
          {persona && (
            <div className="flex items-center gap-2 mt-3">
              {persona.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={persona.avatarUrl} alt={persona.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-sm font-semibold">{persona.name.charAt(0)}</div>
              )}
              <div className="text-sm">
                <div className="font-medium">Hosted by {persona.name}</div>
                {info?.replyLabel && (
                  <div className="text-white/75 text-xs inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {info.replyLabel}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
            </div>
          ) : error && !info ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : info ? (
            <>
              <ul className="space-y-2">
                {info.includes.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Capacity — owner sets/confirms at order (max 8). */}
              <div className="border-t border-zinc-100 pt-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Group size</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                    className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:border-zinc-400 disabled:opacity-40"
                    disabled={capacity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-semibold w-10 text-center">{capacity}</span>
                  <button
                    type="button"
                    onClick={() => setCapacity((c) => Math.min(info.maxCapacity, c + 1))}
                    className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:border-zinc-400 disabled:opacity-40"
                    disabled={capacity >= info.maxCapacity}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-zinc-400 ml-1">up to {info.maxCapacity} guests</span>
                </div>
              </div>

              {!info.eligible && info.reason && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{info.reason}</p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </>
          ) : null}
        </div>

        {/* Footer / CTA */}
        {info && info.eligible && (
          <div className="border-t border-zinc-100 p-4 shrink-0">
            <button
              onClick={handleAttach}
              disabled={submitting}
              className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : info.included ? (
                <>Included with Concierge — add host</>
              ) : (
                <>${info.feeUsd} · Pay &amp; attach</>
              )}
            </button>
            {!info.included && (
              <p className="text-[11px] text-zinc-400 text-center mt-2">One-time charge. You'll set up payment securely with Stripe.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
