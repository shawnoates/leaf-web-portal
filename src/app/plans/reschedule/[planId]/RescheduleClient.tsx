"use client";

/**
 * /plans/reschedule/[planId]?t=… — "Nobody's RSVP'd. Move it?"
 *
 * Opened from the T-12h text or email by whoever is hosting an empty plan:
 * a follower who tapped Host This, or a paid roster host. Three suggested
 * slots from the calendar's own turnout, a picker for anything else, and the
 * honest alternative of leaving it where it is.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

type Slot = {
  startsAt: string;
  wallClock: string;
  label: string;
  reasons: string[];
  weather: { temp: string | null; text: string; icon: string; rainChance: number | null } | null;
};

type Options = {
  state: "open" | "has_rsvps" | "started" | "cancelled" | "no_host";
  kind: "roster" | "owner" | null;
  hostFirstName: string | null;
  rateLabel: string | null;
  rsvps: number;
  plan: {
    id: string;
    title: string;
    calendarName: string | null;
    startsAt: string | null;
    wallClock: string | null;
    whenLabel: string;
    timeZone: string;
    venueName: string | null;
    venueAddress: string | null;
    rescheduledAt: string | null;
  };
  slots: Slot[];
  callOffAt: string | null;
  chatUrl: string;
  shareUrl: string;
  checklistUrl: string | null;
  minWallClock: string;
  maxWallClock: string;
};

const card = "rounded-2xl border border-zinc-200 bg-white p-6";
const btnPrimary =
  "w-full rounded-lg bg-leaf-800 px-5 py-3.5 text-[16px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "w-full rounded-lg border border-zinc-300 bg-white px-5 py-3.5 text-[16px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-10 pb-24">{children}</main>;
}

type Link = { href: string; label: string };

function Closed({ title, body, link, links }: { title: string; body: string; link?: Link; links?: Link[] }) {
  const all = links ?? (link ? [link] : []);
  return (
    <Shell>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h1 className="text-xl font-semibold text-leaf-900">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">{body}</p>
        {all.length ? (
          <div className="mt-5 space-y-3">
            {all.map((l, i) => (
              <a key={l.href} href={l.href} className={`${i === 0 ? btnPrimary : btnQuiet} block text-center`}>
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function fmtWallClock(wallClock: string) {
  // A venue wall clock rendered as-is: parse as local, format as local, so the
  // digits the host typed are the digits they see.
  const d = new Date(wallClock);
  if (Number.isNaN(d.getTime())) return wallClock;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtCallOff(iso: string | null, tz: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export default function RescheduleClient({ planId, token }: { planId: string; token: string }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ wallClock: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ whenLabel: string; previousWhenLabel: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getPlanRescheduleOptions", { planId, token })) as Options;
      setOpts(result);
      // The time field starts on the plan's own time; only the date is the question.
      if (result.plan.wallClock) setCustomTime(result.plan.wallClock.slice(11, 16));
    } catch (e) {
      setLoadError((e as Error).message || "Could not load this plan.");
    }
  }, [planId, token]);

  useEffect(() => {
    if (!token) {
      setLoadError("This link is missing its key.");
      return;
    }
    void load();
  }, [load, token]);

  const move = useCallback(
    async (wallClock: string) => {
      setBusy(wallClock);
      setError(null);
      try {
        const r = (await Parse.Cloud.run("rescheduleNoRsvpPlan", { planId, token, wallClock })) as {
          whenLabel: string;
          previousWhenLabel: string;
        };
        setMoved({ whenLabel: r.whenLabel, previousWhenLabel: r.previousWhenLabel });
      } catch (e) {
        setError((e as Error).message || "That didn't go through. Try again.");
        setPending(null);
      } finally {
        setBusy(null);
      }
    },
    [planId, token],
  );

  if (loadError) {
    return (
      <Closed
        title="We couldn't open this link"
        body="It may have been copied incompletely. Open it again from the text or email, or reply to that message and we'll sort it."
      />
    );
  }
  if (!opts) {
    return (
      <Shell>
        <p className="text-[15px] text-zinc-500">Loading…</p>
      </Shell>
    );
  }

  const { plan, kind, slots } = opts;
  const name = opts.hostFirstName ? `${opts.hostFirstName}, ` : "";

  if (moved) {
    return (
      <Closed
        title={`Moved to ${moved.whenLabel}`}
        body={
          `${plan.title} now runs ${moved.whenLabel} (it was ${moved.previousWhenLabel}). ` +
          `Everyone who said they were interested hears about the new date, and your reminders start over from it.` +
          (kind === "roster" ? ` Your pay is unchanged${opts.rateLabel ? `: ${opts.rateLabel}` : ""}.` : "")
        }
        links={[
          { href: opts.shareUrl, label: "View the plan" },
          ...(opts.checklistUrl ? [{ href: opts.checklistUrl, label: "Open your checklist" }] : []),
        ]}
      />
    );
  }

  if (pending) {
    return (
      <Shell>
        <div className={card}>
          <h1 className="text-xl font-semibold leading-snug text-leaf-900">
            Move {plan.title} to {pending.label}?
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
            It was {plan.whenLabel}. Everyone who said they were interested is told the new date straight away, and your reminders reset to it.
            {kind === "roster" ? ` Your pay is unchanged${opts.rateLabel ? ` (${opts.rateLabel})` : ""}.` : ""}
          </p>
          <div className="mt-5 space-y-3">
            <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void move(pending.wallClock)}>
              {busy ? "Moving…" : "Yes, move it"}
            </button>
            <button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => setPending(null)}>
              Not yet
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (opts.state === "cancelled") {
    return <Closed title="This plan was cancelled" body={`${plan.title} is no longer on. Nothing to move.`} />;
  }
  if (opts.state === "started") {
    return (
      <Closed
        title="This one has already started"
        body={`${plan.title} was set for ${plan.whenLabel}. A plan can't be moved once its start has passed.`}
        link={{ href: opts.chatUrl, label: "Open the group chat" }}
      />
    );
  }
  if (opts.state === "no_host") {
    return <Closed title="Nothing to do here" body="This plan doesn't have a host attached, so there's nobody to move it for." />;
  }
  if (opts.state === "has_rsvps") {
    const n = opts.rsvps;
    return (
      <Closed
        title={`${n} ${n === 1 ? "person has" : "people have"} now RSVP'd`}
        body={`Since we texted you, ${n === 1 ? "someone" : "people"} signed up for ${plan.title} on ${plan.whenLabel}. Keep it where it is - moving it now would strand them.`}
        link={{ href: opts.chatUrl, label: "Say hello in the chat" }}
      />
    );
  }

  const callOff = fmtCallOff(opts.callOffAt, plan.timeZone);
  const custom = customDate && customTime ? `${customDate}T${customTime}` : "";

  return (
    <Shell>
      <h1 className="text-2xl font-semibold leading-tight text-leaf-900">
        {name}nobody&apos;s RSVP&apos;d yet. Move it?
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
        <span className="font-medium text-leaf-900">{plan.title}</span>
        {plan.calendarName ? ` on ${plan.calendarName}` : ""} is set for {plan.whenLabel}
        {plan.venueName ? ` at ${plan.venueName}` : ""}. Nobody has signed up. A better slot usually fixes that.
      </p>
      {kind === "roster" ? (
        <p className="mt-3 rounded-lg bg-leaf-50 px-4 py-3 text-[15px] leading-relaxed text-leaf-900">
          <span className="font-medium">Your pay doesn&apos;t change.</span>{" "}
          {opts.rateLabel
            ? `You're still paid ${opts.rateLabel} for hosting it on the new date, same as agreed.`
            : "You're paid the same rate for hosting it on the new date, same as agreed."}
        </p>
      ) : null}

      {slots.length > 0 ? (
        <section className={`${card} mt-6`}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
            Best slots from this calendar&apos;s own turnout
          </h2>
          <div className="mt-4 space-y-3">
            {slots.map((s) => (
              <button
                key={s.wallClock}
                type="button"
                disabled={busy !== null}
                onClick={() => setPending({ wallClock: s.wallClock, label: s.label })}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 text-left transition-colors hover:border-leaf-600 hover:bg-leaf-50 disabled:opacity-50"
              >
                <div className="text-[16px] font-medium text-leaf-900">{s.label}</div>
                {s.reasons.length ? (
                  <div className="mt-1 text-[13px] leading-snug text-zinc-600">{s.reasons.join(" · ")}</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`${card} mt-4`}>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
          {slots.length ? "Or pick any date" : "Pick a new date"}
        </h2>
        <p className="mt-2 text-[13px] text-zinc-500">
          Pick a date at least a week out. Times are in the venue&apos;s zone ({plan.timeZone.replace(/_/g, " ")}).
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <input
            type="date"
            aria-label="New date"
            className={inputClass}
            value={customDate}
            min={opts.minWallClock.slice(0, 10)}
            max={opts.maxWallClock.slice(0, 10)}
            onChange={(e) => setCustomDate(e.target.value)}
          />
          <input
            type="time"
            aria-label="Start time"
            className={inputClass}
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`${btnPrimary} mt-3`}
          disabled={!custom || busy !== null}
          onClick={() => setPending({ wallClock: custom, label: fmtWallClock(custom) })}
        >
          Move it here
        </button>
      </section>

      {error ? <p className="mt-4 text-[14px] text-red-700">{error}</p> : null}

      <section className="mt-6">
        {kind === "roster" ? (
          <p className="text-[13px] leading-relaxed text-zinc-500">
            If it&apos;s still empty at {callOff || "three hours before"}, we&apos;ll call it off and text you - please don&apos;t go to an empty plan.
          </p>
        ) : (
          <>
            <a href={opts.shareUrl} className={`${btnQuiet} block text-center`}>
              Keep the date and invite people directly
            </a>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
              Keeping it is fine too - it&apos;s your plan. Nobody is in the chat yet, so what fills an empty plan is sending the link to a few people yourself.
            </p>
          </>
        )}
      </section>
    </Shell>
  );
}
