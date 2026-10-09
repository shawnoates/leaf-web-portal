"use client";

/**
 * How the night went — /o/r/[token] (Offer Pipeline step 8b)
 *
 * Linked from Shawn's email two days after a night. Each side sees its own
 * numbers only: a venue never sees what the merchant made. Three quick
 * questions. A merchant whose night worked can book the next one here: a
 * different offer on an open date, $75 plus the usual 10%, card saved now and
 * charged when the week is confirmed. A rebooked night with thin RSVPs two
 * days out asks the merchant to run it anyway or move it free.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import Parse from "@/lib/parse-client";
import { merchantAuth } from "@/lib/merchant-session";

type Results = {
  state: "ok" | "unavailable" | "dashboard";
  role: "merchant" | "venue";
  name: string;
  calendarName: string;
  dateLabel: string;
  taster: string;
  rsvps: number | null;
  attended: number | null;
  placardFollows: number | null;
  feedback: { rating: number | null; wentWell: string; change: string } | null;
  makeGood: { rsvps: number; choice: "run" | "move" | null } | null;
  hostedReport?: {
    sentAt: string;
    spend: { subtotalCents: number; receipts: number; checks: number; perGuestCents: number | null };
    photos: string[];
    regulars: { followsFromNight: number | null; returning: number | null };
  } | null;
  revenueCents?: number | null;
  payoutCents?: number | null;
  payoutStatus?: string | null;
  rebook?: {
    eligible: boolean;
    why: string | null;
    feeCents: number;
    booked: { dateLabel: string; title: string } | null;
    dates: { dateKey: string; label: string }[];
    lastTitle: string;
    lastPriceCents: number | null;
    ownSpace: boolean;
  };
};

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 focus:border-leaf-600 focus:outline-none";

function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  const d = cents / 100;
  return `$${d.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(d) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-leaf-900 tabular-nums">{value}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">{children}</span>;
}

/**
 * `embed`: shown inside the business's dashboard (one night, under its
 * sign-in). Without it this is the venue's page, or a business's old link,
 * which the server sends on to that night on their dashboard.
 */
export default function ResultsClient({ token, embed }: { token: string; embed?: { offerToken: string } }) {
  const auth = useCallback(() => (embed ? { embed: true, ...merchantAuth(embed.offerToken) } : {}), [embed]);
  const Wrap = embed ? EmbedWrap : PageWrap;
  const [r, setR] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState<number | null>(null);
  const [wentWell, setWentWell] = useState("");
  const [change, setChange] = useState("");
  const [counterSpend, setCounterSpend] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const [dateKey, setDateKey] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [leafHost, setLeafHost] = useState(false);
  const [setup, setSetup] = useState<{ rebookId: string; clientSecret: string; publishableKey: string | null } | null>(null);
  const [bookedLabel, setBookedLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makeGoodDone, setMakeGoodDone] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);

  const load = useCallback(async () => {
    try {
      const res = (await Parse.Cloud.run("getSlotResults", { token, ...auth() })) as Results & { dashboardUrl?: string };
      if (res.state === "dashboard" && res.dashboardUrl) {
        window.location.replace(res.dashboardUrl);
        return;
      }
      setR(res);
      if (res.feedback) {
        setRating(res.feedback.rating);
        setWentWell(res.feedback.wentWell);
        setChange(res.feedback.change);
        setFeedbackSaved(true);
      }
      if (res.rebook?.lastPriceCents != null) setPrice(String(res.rebook.lastPriceCents / 100));
    } catch {
      setR({ state: "unavailable" } as Results);
    } finally {
      setLoading(false);
    }
  }, [token, auth]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!setup || !mountRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (!setup.publishableKey) throw new Error("Payments are not configured.");
        const stripe = stripeRef.current || (await loadStripe(setup.publishableKey));
        if (cancelled || !stripe) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret: setup.clientSecret,
          appearance: { theme: "stripe", variables: { borderRadius: "12px", colorPrimary: "#253A33", fontFamily: "inherit" } },
        });
        elementsRef.current = elements;
        elements.create("payment", { layout: "tabs" }).mount(mountRef.current!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load card entry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setup]);

  const sendFeedback = async () => {
    setBusy(true);
    try {
      await Parse.Cloud.run("submitSlotFeedback", { ...auth(), token, rating, wentWell, change, counterSpendDollars: counterSpend || null });
      setFeedbackSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  const startRebook = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = (await Parse.Cloud.run("createRebookSetup", {
        ...auth(),
        token,
        dateKey,
        title,
        description,
        priceCents: Math.round(Number(price || 0) * 100),
        leafHost,
      })) as { rebookId: string; clientSecret: string; publishableKey: string | null };
      setSetup(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start that.");
    } finally {
      setBusy(false);
    }
  };

  const saveCard = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !setup) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (err) {
      setError(err.message || "That card didn't save.");
      setBusy(false);
      return;
    }
    try {
      const res = (await Parse.Cloud.run("confirmRebook", { ...auth(), token, rebookId: setup.rebookId })) as { dateLabel: string };
      setBookedLabel(res.dateLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't book that date.");
    } finally {
      setBusy(false);
    }
  };

  const chooseMakeGood = async (choice: "run" | "move") => {
    setBusy(true);
    try {
      await Parse.Cloud.run("chooseMakeGood", { ...auth(), token, choice });
      setMakeGoodDone(choice === "run" ? "Great, it's on. We'll keep pushing it this week." : "Got it. Shawn will move it and confirm the new week with you. No extra cost.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Wrap>
        <p className="text-[15px] text-zinc-500">Loading…</p>
      </Wrap>
    );
  }
  if (!r || r.state !== "ok") {
    return (
      <Wrap>
        <h1 className="text-xl font-semibold text-leaf-900">We couldn&rsquo;t find this one.</h1>
        <p className="mt-3 text-[15px] text-zinc-700">Try the link from Shawn&rsquo;s email again, or just reply to it.</p>
      </Wrap>
    );
  }

  const rb = r.rebook;
  const fee = rb ? money(rb.feeCents) : "$75";

  return (
    <Wrap last>
      <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-700">{r.calendarName}</p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-leaf-900">
        {r.attended != null ? `${r.attended} neighbors came` : "Your night"}
        {r.taster ? ` to your ${r.taster}` : ""}
      </h1>
      <p className="mt-2 text-[15px] text-zinc-600">{r.dateLabel}</p>

      {r.makeGood && !r.makeGood.choice && !makeGoodDone && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-[15px] text-zinc-800">
            RSVPs are light so far ({r.makeGood.rsvps}). Run it anyway, or move it to a later week at no cost?
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => chooseMakeGood("run")} className="flex-1 rounded-xl bg-leaf-800 px-3 py-2.5 text-[15px] font-semibold text-white">
              Run it
            </button>
            <button type="button" disabled={busy} onClick={() => chooseMakeGood("move")} className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[15px] font-medium text-zinc-800">
              Move it
            </button>
          </div>
        </section>
      )}
      {makeGoodDone && <p className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-[15px] text-zinc-700">{makeGoodDone}</p>}

      <section className="mt-8 grid grid-cols-2 gap-3">
        <Stat label="RSVPs" value={r.rsvps != null ? String(r.rsvps) : "—"} />
        <Stat label="Came" value={r.attended != null ? String(r.attended) : "—"} />
        {/* Bars and restaurants sell no tickets: only show money rows that exist. */}
        {r.role === "merchant" && r.revenueCents != null && <Stat label="Ticket sales" value={money(r.revenueCents)} />}
        {r.role === "merchant" && (r.revenueCents != null || r.payoutCents != null) && (
          <Stat label={r.payoutStatus === "paid" ? "Paid to you" : "Your payout"} value={money(r.payoutCents)} />
        )}
        {r.placardFollows != null && <Stat label="Followers from your card" value={String(r.placardFollows)} />}
      </section>
      {r.role === "merchant" && r.payoutStatus === "waiting_on_merchant" && (
        <p className="mt-3 text-[13px] text-amber-700">Your payout is waiting on payout setup. Use the link in your offer email to connect your bank.</p>
      )}

      {r.role === "merchant" && r.hostedReport && (
        <section className="mt-8 rounded-2xl bg-leaf-800 p-5 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-leaf-300">Your Hosted night</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[12px] text-leaf-200">Your Leaf guests spent</p>
              <p className="text-[28px] font-semibold leading-tight">{money(r.hostedReport.spend.subtotalCents)}</p>
              <p className="text-[12px] text-leaf-300">
                {r.hostedReport.spend.checks} check{r.hostedReport.spend.checks === 1 ? "" : "s"}, before tax and tip
              </p>
            </div>
            {r.hostedReport.spend.perGuestCents != null && (
              <div>
                <p className="text-[12px] text-leaf-200">Per guest</p>
                <p className="text-[28px] font-semibold leading-tight">{money(r.hostedReport.spend.perGuestCents)}</p>
              </div>
            )}
            {r.hostedReport.regulars.followsFromNight != null && (
              <div>
                <p className="text-[12px] text-leaf-200">Followed from the night</p>
                <p className="text-[28px] font-semibold leading-tight">{r.hostedReport.regulars.followsFromNight}</p>
              </div>
            )}
            {r.hostedReport.regulars.returning != null && (
              <div>
                <p className="text-[12px] text-leaf-200">Came back for another night</p>
                <p className="text-[28px] font-semibold leading-tight">{r.hostedReport.regulars.returning}</p>
              </div>
            )}
          </div>
          {r.hostedReport.photos.length > 0 && (
            <>
              <p className="mt-5 text-[13px] font-semibold text-leaf-100">Photos for your socials</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {r.hostedReport.photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" download className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-leaf-300">Tap a photo to save it. Everyone pictured said it&rsquo;s OK to post.</p>
            </>
          )}
        </section>
      )}

      <section className="mt-10 space-y-4">
        <p className="text-[15px] font-semibold text-leaf-900">Three quick questions</p>
        <div>
          <Label>How did it go?</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`flex-1 rounded-xl border py-2.5 text-[15px] font-medium ${rating === n ? "border-leaf-700 bg-leaf-800 text-white" : "border-zinc-300 bg-white text-zinc-800"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <Label>What went well?</Label>
          <input value={wentWell} onChange={(e) => setWentWell(e.target.value)} className={input} />
        </label>
        <label className="block">
          <Label>What would you change?</Label>
          <input value={change} onChange={(e) => setChange(e.target.value)} className={input} />
        </label>
        {r.role === "venue" && (
          <label className="block">
            <Label>Roughly what did the group spend at your counter? (optional)</Label>
            <input value={counterSpend} onChange={(e) => setCounterSpend(e.target.value)} inputMode="decimal" placeholder="$" className={input} />
          </label>
        )}
        <button type="button" onClick={sendFeedback} disabled={busy || !rating} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-zinc-800 disabled:opacity-40">
          {feedbackSaved ? "Saved. Update" : "Send"}
        </button>
      </section>

      {r.role === "merchant" && rb && (
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5">
          {rb.booked || bookedLabel ? (
            <>
              <p className="text-[15px] font-semibold text-leaf-900">You&rsquo;re booked for {bookedLabel || rb.booked?.dateLabel}.</p>
              <p className="mt-2 text-[15px] text-zinc-700">
                Your card is charged {fee} once the room and host are confirmed. Shawn will email you with the details.
              </p>
            </>
          ) : !rb.eligible ? (
            <p className="text-[15px] text-zinc-700">
              Want another night? Reply to Shawn&rsquo;s email and he&rsquo;ll bring you back when there&rsquo;s an opening.
            </p>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-leaf-900">
                {r.attended != null ? `${r.attended} neighbors came. ` : ""}Want to do it again?
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
                Choose your next date for {fee}, plus our usual 10% of tickets. Or we&rsquo;ll reach out when there&rsquo;s an opening.
              </p>
              {!setup ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <Label>Date</Label>
                    <select value={dateKey} onChange={(e) => setDateKey(e.target.value)} className={input}>
                      <option value="">Pick a date</option>
                      {rb.dates.map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <Label>What&rsquo;s different this time? (last time: {rb.lastTitle})</Label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A new taster, or the next step up" className={input} />
                  </label>
                  <label className="block">
                    <Label>In a sentence</Label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
                  </label>
                  <label className="block">
                    <Label>Price per person ($)</Label>
                    <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={input} />
                  </label>
                  <label className="flex items-center gap-2 text-[15px] text-zinc-700">
                    <input type="checkbox" checked={leafHost} onChange={(e) => setLeafHost(e.target.checked)} />
                    Make it a Hosted night (host at cost, on top of {fee})
                  </label>
                  <button
                    type="button"
                    onClick={startRebook}
                    disabled={busy || !dateKey || !title.trim()}
                    className="w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? "One moment…" : "Pick a date"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div ref={mountRef} />
                  <p className="text-[13px] text-zinc-500">
                    Nothing is charged now. Your card is charged {fee}
                    {leafHost ? " plus the host's rate" : ""} when the room and host are confirmed.
                  </p>
                  <button type="button" onClick={saveCard} disabled={busy} className="w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white disabled:opacity-40">
                    {busy ? "Saving…" : "Save card and book"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {error && <p className="mt-6 text-[14px] text-red-700">{error}</p>}
    </Wrap>
  );
}

function PageWrap({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <main className={`mx-auto max-w-lg px-5 py-10${last ? " pb-24" : ""}`}>{children}</main>;
}

function EmbedWrap({ children }: { children: React.ReactNode; last?: boolean }) {
  return <div className="pt-2">{children}</div>;
}
