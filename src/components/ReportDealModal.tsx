"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { getVerifiedUserCookie } from "@/lib/verified-user";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

const REPORT_COOKIE_KEY = "leaf_report_cookie";
const REASONS: [string, string, string][] = [
  ["misleading", "Misleading", "Promised discount doesn't match what's posted."],
  ["not_honored", "Not honored", "Business refused to apply the deal at checkout."],
  ["inappropriate", "Inappropriate", "Offensive, unsafe, or doesn't belong here."],
  ["other", "Other", "Something else worth telling Leaf about."],
];

function getOrCreateReporterCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`${REPORT_COOKIE_KEY}=([^;]+)`));
  if (match) return match[1];
  // 16 random hex chars — enough to dedup without being identifying.
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${REPORT_COOKIE_KEY}=${random}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return random;
}

export default function ReportDealModal({
  dealId,
  dealTitle,
  businessName,
  onClose,
}: {
  dealId: string;
  dealTitle: string;
  businessName: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("misleading");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const cookie = getOrCreateReporterCookie();
      const verified = getVerifiedUserCookie();
      await Parse.Cloud.run("reportDeal", {
        dealId,
        reason,
        notes: notes.trim() || undefined,
        reporterCookie: cookie,
        reporterPhone: verified?.phone || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Report this deal
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-700">Thanks. Reports help us keep deals honest.</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-zinc-900 text-white text-xs uppercase tracking-widest font-bold rounded-lg"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-zinc-600">
                Reporting <strong>{dealTitle}</strong>
                {businessName && (
                  <>
                    {" "}at <strong>{businessName}</strong>
                  </>
                )}
                .
              </p>

              <div className="space-y-2">
                {REASONS.map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${
                      reason === value
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
                    </div>
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What did you see? When?"
                  className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
                />
              </label>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                  {error}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50">
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-lg"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
