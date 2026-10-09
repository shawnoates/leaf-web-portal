"use client";

/**
 * The Hosted night report, on the host's page: receipts (Leaf reads them, the
 * host checks the numbers), photos for the merchant, and a consent check
 * before any photo is shared. Only shows for Offer Pipeline nights.
 */

import { useCallback, useEffect, useState } from "react";
import { IMAGE_ACCEPT, processImageFile } from "@/lib/image-utils";
import { linkRun } from "@/lib/link-session";

type Receipt = { id: string; url: string | null; subtotalCents: number; checks: number; totalCents: number; estimated: boolean; readOk: boolean; isReceipt: boolean };
type Report = {
  eligible: boolean;
  started: boolean;
  merchantName: string;
  receipts: Receipt[];
  photos: { id: string; url: string | null }[];
  photoConsent: boolean;
  spend: { subtotalCents: number; receipts: number; checks: number };
  submittedAt: string | null;
};

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const btn = "w-full rounded-xl bg-leaf-800 py-3 text-[16px] font-semibold text-white disabled:opacity-50";
const quiet = "rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-zinc-800";

const dollars = (c: number) => `$${(c / 100).toFixed(2).replace(/\.00$/, "")}`;

export default function HostedNightReport({ token }: { token: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subtotal?: string; checks?: string }>>({});

  const load = useCallback(async () => {
    try {
      setR((await linkRun("getHostNightReport", { token })) as Report);
    } catch {
      setR(null);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!r?.eligible || !r.started) return null;

  const upload = async (files: FileList | null, fn: "addHostReceipt" | "addHostReportPhoto") => {
    if (!files?.length) return;
    setError(null);
    setBusy(fn);
    try {
      for (const f of Array.from(files)) {
        const p = await processImageFile(f);
        setR((await linkRun(fn, { token, fileBase64: p.base64, mimeType: "image/jpeg" })) as Report);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't upload.");
    } finally {
      setBusy(null);
    }
  };

  const save = async (patch: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const receipts = Object.entries(edits).map(([id, e]) => ({
        id,
        ...(e.subtotal !== undefined ? { subtotalCents: Math.round(Number(e.subtotal || 0) * 100) } : {}),
        ...(e.checks !== undefined ? { checks: Number(e.checks) || 1 } : {}),
      }));
      setR((await linkRun("updateHostNightReport", { token, receipts, ...patch })) as Report);
      setEdits({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(null);
    }
  };

  const liveSubtotal = r.receipts.reduce((s, x) => {
    const e = edits[x.id]?.subtotal;
    return s + (e !== undefined ? Math.round(Number(e || 0) * 100) : x.subtotalCents);
  }, 0);

  return (
    <div className={`${card} mt-6`}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-leaf-700">Hosted night report</p>
      <h2 className="mt-1 text-[19px] font-semibold text-leaf-900">For {r.merchantName}</h2>
      <p className="mt-1.5 text-[14px] leading-snug text-zinc-600">
        What {r.merchantName} gets from their Hosted night: what guests spent, photos for their socials, and how many became regulars (we count
        those ourselves).
      </p>
      {r.submittedAt && (
        <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] text-leaf-800">
          Sent {new Date(r.submittedAt).toLocaleDateString()}. You can still add or fix things and send again.
        </p>
      )}

      {/* 1. Receipts */}
      <h3 className="mt-5 text-[15px] font-semibold text-zinc-900">1. Receipts</h3>
      <p className="mt-1 text-[13px] leading-snug text-zinc-500">
        Snap the night&rsquo;s checks, or ask for the closeout of the group&rsquo;s tab. We read the numbers; check them below. Only the subtotal
        (before tax and tip) is shared.
      </p>
      <div className="mt-3 space-y-2">
        {r.receipts.map((x) => (
          <div key={x.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5">
            {x.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={x.url} alt="Receipt" className="h-14 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover" />
            )}
            <div className="grid min-w-0 flex-1 grid-cols-[1fr_4.5rem] gap-2">
              <label className="block">
                <span className="block text-[11px] font-medium text-zinc-500">
                  Subtotal{x.estimated ? " (estimated, check it)" : !x.readOk ? " (type it in)" : ""}
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-zinc-500">$</span>
                  <input
                    inputMode="decimal"
                    value={edits[x.id]?.subtotal ?? (x.subtotalCents ? (x.subtotalCents / 100).toFixed(2) : "")}
                    onChange={(e) => setEdits((p) => ({ ...p, [x.id]: { ...p[x.id], subtotal: e.target.value.replace(/[^\d.]/g, "") } }))}
                    className={`h-11 w-full rounded-lg border px-2.5 pl-6 text-[16px] ${x.estimated || !x.readOk ? "border-amber-400" : "border-zinc-300"}`}
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-zinc-500">Checks</span>
                <input
                  inputMode="numeric"
                  value={edits[x.id]?.checks ?? String(x.checks)}
                  onChange={(e) => setEdits((p) => ({ ...p, [x.id]: { ...p[x.id], checks: e.target.value.replace(/\D/g, "") } }))}
                  className="h-11 w-full rounded-lg border border-zinc-300 px-2.5 text-[16px]"
                />
              </label>
            </div>
            <button
              type="button"
              aria-label="Remove receipt"
              onClick={() => linkRun("updateHostNightReport", { token, receipts: [{ id: x.id, removed: true }] }).then((v: unknown) => setR(v as Report))}
              className="h-9 w-9 shrink-0 rounded-full text-[18px] text-zinc-400"
            >
              ×
            </button>
          </div>
        ))}
        {!hasNonReceipt(r) ? null : (
          <p className="text-[13px] text-amber-800">One of those doesn&rsquo;t look like a receipt. Remove it if it was a mistake.</p>
        )}
        <label className={`${quiet} block cursor-pointer text-center`}>
          {busy === "addHostReceipt" ? "Reading…" : r.receipts.length ? "Add another receipt" : "Add a receipt photo"}
          <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden" disabled={busy !== null} onChange={(e) => { upload(e.target.files, "addHostReceipt"); e.target.value = ""; }} />
        </label>
        {r.receipts.length > 0 && (
          <p className="text-[14px] text-zinc-700">
            Total so far: <strong>{dollars(liveSubtotal)}</strong> across {r.receipts.length} receipt{r.receipts.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* 2. Photos */}
      <h3 className="mt-6 text-[15px] font-semibold text-zinc-900">2. Photos for {r.merchantName}</h3>
      <p className="mt-1 text-[13px] leading-snug text-zinc-500">The room full of neighbors: the table, the bar, people having a good time. Up to 12.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.photos.map((ph) => (
          <div key={ph.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {ph.url && <img src={ph.url} alt="" className="h-20 w-20 rounded-lg border border-zinc-200 object-cover" />}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => save({ removePhotoIds: [ph.id] }, "photo")}
              className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-zinc-800 text-[12px] leading-6 text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {r.photos.length < 12 && (
        <label className={`${quiet} mt-3 block cursor-pointer text-center`}>
          {busy === "addHostReportPhoto" ? "Uploading…" : r.photos.length ? "Add more photos" : "Add photos"}
          <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden" disabled={busy !== null} onChange={(e) => { upload(e.target.files, "addHostReportPhoto"); e.target.value = ""; }} />
        </label>
      )}
      {r.photos.length > 0 && (
        <label className="mt-3 flex items-start gap-3 rounded-xl bg-zinc-50 p-3.5">
          <input
            type="checkbox"
            checked={r.photoConsent}
            onChange={(e) => save({ photoConsent: e.target.checked }, "consent")}
            className="mt-0.5 h-5 w-5 shrink-0 accent-leaf-800"
          />
          <span className="text-[13px] leading-snug text-zinc-700">
            Everyone recognizable in these photos said it&rsquo;s OK for {r.merchantName} to post them. Without this, {r.merchantName} doesn&rsquo;t
            see the photos.
          </span>
        </label>
      )}

      {error && <p className="mt-4 text-[14px] text-red-700">{error}</p>}
      <button
        type="button"
        disabled={busy !== null || (r.receipts.length === 0 && r.photos.length === 0)}
        onClick={() => save({ submit: true }, "submit")}
        className={`${btn} mt-5`}
      >
        {busy === "submit" ? "Sending…" : r.submittedAt ? "Send the updated report" : `Send the report to ${r.merchantName}`}
      </button>
    </div>
  );
}

function hasNonReceipt(r: Report) {
  return r.receipts.some((x) => !x.isReceipt);
}
