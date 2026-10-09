"use client";

/**
 * "Your deals" on the merchant dashboard: post a deal for the neighborhood
 * calendars around them, $20 a month. A deal is reviewed first and charged
 * only once it's approved (any leftover Leaf balance first, then the card); it renews
 * monthly until they stop it. Server: offer-merchant-deal-functions.js.
 */

import { useCallback, useEffect, useState } from "react";
import { Field, dollars, input, textarea } from "./ui";
import { merchantRun } from "@/lib/merchant-session";

type Phase = "in_review" | "live" | "ending" | "ended" | "rejected" | "payment_failed";
type Deal = {
  id: string;
  title: string;
  description: string;
  terms: string;
  promoCode: string;
  phase: Phase;
  paidThrough: string | null;
  rejectionReason: string | null;
  priceCents: number;
  interestCount: number;
};
type DealsState = { deals: Deal[]; priceCents: number; periodDays: number; maxOpen: number; hasCard: boolean };

const OPEN: Phase[] = ["in_review", "live", "ending", "payment_failed"];

function day(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function phaseLine(d: Deal): { label: string; tone: string } {
  switch (d.phase) {
    case "in_review":
      return { label: "In review. You're charged once it's approved.", tone: "text-stone-600" };
    case "live":
      return { label: `Live. Renews ${day(d.paidThrough)}.`, tone: "text-leaf-700" };
    case "ending":
      return { label: `Live until ${day(d.paidThrough)}, then it stops.`, tone: "text-stone-600" };
    case "payment_failed":
      return { label: "Paused: your card didn't go through.", tone: "text-amber-800" };
    case "rejected":
      return { label: d.rejectionReason ? `Not approved: ${d.rejectionReason}` : "Not approved.", tone: "text-red-700" };
    default:
      return { label: "Ended.", tone: "text-stone-500" };
  }
}

export default function MerchantDeals({ token, preview }: { token: string; preview?: boolean }) {
  const [s, setS] = useState<DealsState | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", terms: "", promoCode: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    merchantRun("merchantListDeals", { token })
      .then((r: unknown) => setS(r as DealsState))
      .catch(() => setS(null));
  }, [token]);
  useEffect(load, [load]);

  if (!s) return null;
  const price = dollars(s.priceCents);
  const openCount = s.deals.filter((d) => OPEN.includes(d.phase)).length;
  const shown = s.deals.filter((d) => d.phase !== "ended").slice(0, 6);

  const post = async () => {
    setBusy("post");
    setError(null);
    try {
      await merchantRun("merchantCreateDeal", { token, ...form });
      setForm({ title: "", description: "", terms: "", promoCode: "" });
      setOpen(false);
      setNote("Sent for review. We'll email you when it's live, usually within a day.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post that deal");
    } finally {
      setBusy(null);
    }
  };

  const act = async (fn: "merchantStopDeal" | "merchantRestartDeal", dealId: string) => {
    setBusy(dealId);
    setError(null);
    try {
      await merchantRun(fn, { token, dealId });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that deal");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="deals" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">Your deals</h2>
      <p className="mt-1 text-[15px] leading-relaxed text-stone-600">
        {`Post a deal for the neighbors around you. It shows on your neighborhood's Leaf calendar. ${price} a month, charged once it's approved. One deal at a time; stop anytime.`}
      </p>

      {note && <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] font-semibold text-leaf-800">{note}</p>}

      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100">
          {shown.map((d) => {
            const line = phaseLine(d);
            return (
              <li key={d.id} className="py-3">
                <p className="text-[16px] font-semibold text-stone-900">{d.title}</p>
                {d.description && <p className="text-[14px] text-stone-600">{d.description}</p>}
                <p className={`mt-1 text-[13px] ${line.tone}`}>{line.label}</p>
                {d.phase === "live" && d.interestCount > 0 && (
                  <p className="text-[13px] text-stone-500">{`${d.interestCount} neighbor${d.interestCount === 1 ? "" : "s"} tapped "I'm interested"`}</p>
                )}
                <div className="mt-2 flex gap-4">
                  {(d.phase === "in_review" || d.phase === "live" || d.phase === "payment_failed") && (
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => act("merchantStopDeal", d.id)}
                      className="text-[14px] font-semibold text-stone-600 underline underline-offset-2"
                    >
                      {d.phase === "in_review" ? "Withdraw" : "Stop"}
                    </button>
                  )}
                  {(d.phase === "ending" || d.phase === "payment_failed") && (
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => act("merchantRestartDeal", d.id)}
                      className="text-[14px] font-semibold text-leaf-700 underline underline-offset-2"
                    >
                      {d.phase === "ending" ? "Keep it going" : `Restart (${price})`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}

      {!s.hasCard ? (
        <a href="#card" className="mt-3 block rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 ring-1 ring-amber-200">
          Add a card to post a deal. <span className="font-semibold underline">Add your card</span>
        </a>
      ) : openCount >= s.maxOpen ? (
        <p className="mt-3 text-[14px] text-stone-500">
          {s.maxOpen === 1 ? "One deal at a time. Stop this one to post a new one." : `You have ${s.maxOpen} deals going. Stop one to post another.`}
        </p>
      ) : open ? (
        <div className="mt-4 space-y-3">
          <Field label="The deal">
            <input
              value={form.title}
              maxLength={80}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="20% off your first visit"
              className={input}
            />
          </Field>
          <Field label="A line about it (optional)">
            <textarea
              value={form.description}
              maxLength={300}
              rows={2}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Weeknights only. Show this at the counter."
              className={textarea}
            />
          </Field>
          <Field label="Fine print (optional)">
            <input
              value={form.terms}
              maxLength={300}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="One per table. Not with other offers."
              className={input}
            />
          </Field>
          <Field label="Promo code (optional)">
            <input
              value={form.promoCode}
              maxLength={40}
              onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
              placeholder="NEIGHBOR20"
              className={input}
            />
          </Field>
          <p className="text-[13px] text-stone-500">
            {`${price} for ${s.periodDays} days, charged to your card once we approve it, then monthly until you stop it.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy === "post" || form.title.trim().length < 3 || preview}
              onClick={post}
              className="h-12 flex-1 rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {busy === "post" ? "Sending…" : "Send for review"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-xl border border-stone-300 px-4 text-[15px] font-semibold text-stone-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNote(null);
          }}
          className="mt-4 h-12 w-full rounded-xl border border-stone-300 text-[15px] font-semibold text-stone-800"
        >
          Post a deal
        </button>
      )}
    </section>
  );
}
