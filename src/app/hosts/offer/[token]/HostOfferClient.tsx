"use client";

/**
 * The offer page — /hosts/offer/[token]
 *
 * The entire job of this screen is to give someone enough to answer, and
 * nothing else. It is read on a phone, probably standing up, by someone
 * deciding whether to spend a Thursday evening on this.
 *
 * Six things they need: when, where, how many people, what it pays, what
 * hosting actually means, and how long they have to answer. Deliberately NOT
 * here: the attendee list, other hosts' names, or anything about who else was
 * offered this night.
 *
 * Every dead-offer state renders a human sentence rather than an error. A 404
 * or a red box tells a person who did nothing wrong that they broke something.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

type OfferState =
  | "offered"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn"
  | "cancelled_by_host"
  | "plan_cancelled"
  | "filled"
  | "unavailable";

type PlanFacts = {
  planId: string;
  title: string;
  calendarName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  whenLabel: string;
  durationMinutes: number | null;
  venueName: string | null;
  venueAddress: string | null;
  mapUrl: string | null;
  neighborhoods: string[];
  planUrl: string;
};

type Offer = {
  state: OfferState;
  hostFirstName: string | null;
  hasPaymentDetails: boolean;
  rateLabel: string;
  expiresAt: string | null;
  jobDescription: string;
  contactEmail: string;
  plan: PlanFacts | null;
  counts: { interested: number; rsvpYes: number };
};

const card =
  "rounded-2xl border border-zinc-200 bg-white p-6";
const btnPrimary =
  "w-full rounded-lg bg-leaf-800 px-5 py-3.5 text-[16px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "w-full rounded-lg border border-zinc-300 bg-white px-5 py-3.5 text-[16px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 placeholder:text-zinc-400 outline-none " +
  "focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-10 pb-24">{children}</main>;
}

/** Terminal states. Plain sentence, no error styling, no blame. */
function Closed({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h1 className="text-xl font-semibold text-leaf-900">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">{body}</p>
      </div>
    </Shell>
  );
}

function fmtCountdown(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `about ${days} day${days === 1 ? "" : "s"}`;
}

export default function HostOfferClient({ token }: { token: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local view state once they've answered on this device.
  const [view, setView] = useState<"offer" | "declining" | "done" | "cancelling">("offer");
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalHandle, setPaypalHandle] = useState("");
  const [paymentSaved, setPaymentSaved] = useState(false);

  const load = useCallback(async (): Promise<Offer | null> => {
    setLoading(true);
    try {
      const r = (await Parse.Cloud.run("getHostOffer", { token })) as Offer;
      setOffer(r);
      setPaymentSaved(r.hasPaymentDetails);
      return r;
    } catch {
      setNotFound(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await Parse.Cloud.run("acceptHostOffer", { token });
      setPaymentSaved(Boolean(r.hasPaymentDetails));
      setView("done");
      await load();
    } catch (e) {
      // A double-tap loses the atomic claim, but the first tap already did the
      // work. Re-read: if the offer is no longer live, the answer landed and
      // showing an error would be a lie.
      const fresh = await load();
      if (fresh && fresh.state === "offered") {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("declineHostOffer", { token, reason: declineReason.trim() || undefined });
      await load();
      setView("done");
    } catch (e) {
      const fresh = await load();
      if (fresh && fresh.state === "offered") {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("cancelHostAssignment", { token, reason: cancelReason.trim() || undefined });
      await load();
      setView("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("submitHostPaymentDetails", {
        token,
        paypalEmail: paypalEmail.trim() || undefined,
        paypalMeHandle: paypalHandle.trim() || undefined,
      });
      setPaymentSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <p className="text-[15px] text-zinc-500">Loading…</p>
      </Shell>
    );
  }

  if (notFound || !offer) {
    return (
      <Closed
        title="We couldn't find this one."
        body="The link may have been mistyped. If you got it in an email, try tapping it again from there."
      />
    );
  }

  const p = offer.plan;

  // ── Terminal states ──────────────────────────────────────────────────────
  if (offer.state === "declined") {
    return (
      <Closed
        title="You passed on this one."
        body="No problem at all. You're still on the list, and we'll be in touch when the next one near you comes up."
      />
    );
  }
  if (offer.state === "expired" || offer.state === "withdrawn") {
    return (
      <Closed
        title="This one's been filled."
        body="Thanks for looking. You're still on the list, and we'll come back to you when there's another night near you."
      />
    );
  }
  if (offer.state === "filled") {
    return (
      <Closed
        title="This one's been filled."
        body="Someone else picked it up. You're still on the list for the next one."
      />
    );
  }
  if (offer.state === "plan_cancelled") {
    return (
      <Closed
        title="This night was called off."
        body="Nothing you need to do. We'll be in touch when the next one comes up."
      />
    );
  }
  if (offer.state === "unavailable") {
    // Never explain a block to the person blocked. True, sufficient, and it
    // does not hand someone a reason to argue with.
    return (
      <Closed
        title="This one's no longer available."
        body="Thanks for looking."
      />
    );
  }
  if (offer.state === "cancelled_by_host") {
    return (
      <Closed
        title="You're off this one."
        body="Thanks for telling us early. You're still on the list for future nights."
      />
    );
  }

  // ── Accepted ─────────────────────────────────────────────────────────────
  if (offer.state === "accepted") {
    if (view === "cancelling") {
      return (
        <Shell>
          <h1 className="text-[22px] font-semibold text-leaf-900">
            Can&rsquo;t make it any more?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
            That&rsquo;s fine, and telling us early genuinely helps. We&rsquo;ll
            find someone else.
          </p>
          <div className="mt-5 space-y-3">
            <textarea
              className={inputClass}
              rows={3}
              placeholder="Anything we should know? (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            {error && <p className="text-[14px] text-red-700">{error}</p>}
            <button onClick={cancel} disabled={busy} className={btnPrimary}>
              {busy ? "Sending…" : "I can't make this one"}
            </button>
            <button onClick={() => setView("done")} className={btnQuiet}>
              Never mind, I&rsquo;m still on
            </button>
          </div>
        </Shell>
      );
    }

    return (
      <Shell>
        <div className="rounded-2xl border border-leaf-200 bg-leaf-50 p-6">
          <h1 className="text-xl font-semibold text-leaf-900">
            You&rsquo;re hosting {p?.title}.
          </h1>
          {p && (
            <p className="mt-3 text-[15px] leading-relaxed text-leaf-800">
              {p.whenLabel}
              {p.venueName ? <><br />{p.venueName}</> : null}
              {p.venueAddress ? <><br />{p.venueAddress}</> : null}
              <br />
              {offer.rateLabel}, paid the same night or the next morning.
            </p>
          )}
          <p className="mt-3 text-[15px] leading-relaxed text-leaf-800">
            Your photo and description are on the plan page now, so people know
            who to look for.
          </p>
          {p && (
            <a
              href={p.planUrl}
              className="mt-3 inline-block text-[15px] font-medium text-leaf-800 underline"
            >
              See the plan page
            </a>
          )}
        </div>

        {/* Payment comes AFTER acceptance, never as a gate in front of it. */}
        {!paymentSaved ? (
          <div className={`${card} mt-6`}>
            <h2 className="text-[17px] font-semibold text-leaf-900">
              Where should we send the money?
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-zinc-500">
              Either one is fine. You only have to do this once.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className={inputClass}
                type="email"
                inputMode="email"
                placeholder="PayPal email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="or PayPal.me handle"
                value={paypalHandle}
                onChange={(e) => setPaypalHandle(e.target.value)}
              />
              {error && <p className="text-[14px] text-red-700">{error}</p>}
              <button onClick={savePayment} disabled={busy} className={btnPrimary}>
                {busy ? "Saving…" : "Save"}
              </button>
              <p className="text-[13px] text-zinc-500">
                You can do this later if you&rsquo;d rather. It won&rsquo;t
                affect the night.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-[15px] text-zinc-600">
            We&rsquo;ve got your payment details. Nothing else to do.
          </p>
        )}

        <div className="mt-8 border-t border-zinc-200 pt-5 text-[14px] text-zinc-500">
          <p>
            Questions? Email{" "}
            <a href={`mailto:${offer.contactEmail}`} className="underline">
              {offer.contactEmail}
            </a>
            .
          </p>
          <button
            onClick={() => setView("cancelling")}
            className="mt-2 underline hover:text-zinc-800"
          >
            Something come up?
          </button>
        </div>
      </Shell>
    );
  }

  // ── Declining ────────────────────────────────────────────────────────────
  if (view === "declining") {
    return (
      <Shell>
        <h1 className="text-[22px] font-semibold text-leaf-900">
          No problem.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          You&rsquo;ll stay on the list either way.
        </p>
        <div className="mt-5 space-y-3">
          {/* Optional and freeform on purpose. A required dropdown produces
              garbage; a blank box that half of them fill produces sentences
              worth reading. */}
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Anything we should know? (optional)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          {error && <p className="text-[14px] text-red-700">{error}</p>}
          <button onClick={decline} disabled={busy} className={btnPrimary}>
            {busy ? "Sending…" : "Send"}
          </button>
          <button onClick={() => setView("offer")} className={btnQuiet}>
            Back
          </button>
        </div>
      </Shell>
    );
  }

  // ── The live offer ───────────────────────────────────────────────────────
  const countdown = fmtCountdown(offer.expiresAt);

  return (
    <Shell>
      <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-700">
        Leaf{offer.plan?.calendarName ? ` · ${offer.plan.calendarName}` : ""}
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight text-leaf-900">
        {offer.hostFirstName ? `${offer.hostFirstName}, can you ` : "Can you "}
        host {p?.title}?
      </h1>

      {p && (
        <dl className={`${card} mt-6 space-y-4`}>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
              When
            </dt>
            <dd className="mt-0.5 text-[16px] text-leaf-900">
              {p.whenLabel}
              {p.durationMinutes ? (
                <span className="text-zinc-500">
                  {" "}
                  · about {Math.round(p.durationMinutes / 60)} hours
                </span>
              ) : null}
            </dd>
          </div>

          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
              Where
            </dt>
            <dd className="mt-0.5 text-[16px] text-leaf-900">
              {p.venueName || "Venue TBC"}
              {p.venueAddress ? (
                <span className="block text-[15px] text-zinc-600">
                  {p.venueAddress}
                </span>
              ) : null}
              {p.neighborhoods.length > 0 && (
                <span className="block text-[14px] text-zinc-500">
                  {p.neighborhoods.join(", ")}
                </span>
              )}
              {p.mapUrl && (
                <a
                  href={p.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[14px] text-leaf-700 underline"
                >
                  Open in Maps
                </a>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
              Who
            </dt>
            {/* Two numbers, not one. "12 interested / 4 going" is a different
                night from "12 / 11", and hosts know it. */}
            <dd className="mt-0.5 text-[16px] text-leaf-900">
              {offer.counts.rsvpYes} going
              {offer.counts.interested > 0 && (
                <span className="text-zinc-500">
                  {" "}
                  · {offer.counts.interested} interested
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
              Pay
            </dt>
            <dd className="mt-0.5 text-[16px] font-medium text-leaf-900">
              {offer.rateLabel}
              <span className="block text-[15px] font-normal text-zinc-600">
                Paid the same night or the next morning.
              </span>
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-6 rounded-xl bg-zinc-50 p-4">
        <p className="text-[14px] font-medium text-leaf-900">
          What hosting means
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-700">
          {offer.jobDescription}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mt-7 space-y-3">
        <button onClick={accept} disabled={busy} className={btnPrimary}>
          {busy ? "One moment…" : "Yes, I can host this"}
        </button>
        <button
          onClick={() => setView("declining")}
          disabled={busy}
          className={btnQuiet}
        >
          Can&rsquo;t make this one
        </button>
      </div>

      <div className="mt-6 space-y-1 text-[14px] text-zinc-500">
        {countdown && <p>This offer holds for {countdown}.</p>}
        <p>
          Questions? Email{" "}
          <a href={`mailto:${offer.contactEmail}`} className="underline">
            {offer.contactEmail}
          </a>
          .
        </p>
      </div>
    </Shell>
  );
}
