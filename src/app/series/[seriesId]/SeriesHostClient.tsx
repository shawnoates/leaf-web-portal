"use client";

/**
 * /series/[seriesId]?t=… — the series host's page (SERIES_HOST_DESIGN_SPEC.md).
 *
 * Opened from the invite and reminder texts by the follower who runs a
 * recurring plan on someone else's calendar. No login: the link reads the
 * page and confirms the proposed date; anything else asks once for a code
 * texted to the phone on file, which unlocks a session kept for this tab.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import VenueSearch from "@/components/VenueSearch";
import {
  everyOtherMonth,
  monthlyRuleOptionsForDate,
  ruleOptionKey,
  NTH_LABELS,
  WEEKDAY_NAMES,
  type RuleOption,
  type SeriesSummary,
} from "@/lib/series";

type Venue = { name: string; address: string; placeId?: string | null };

// "confirm"/"schedule" publish a date (and may put it somewhere else just this
// once), "move" changes a published date, "venue" only changes its place.
type PickerMode = "confirm" | "move" | "schedule" | "venue";

const card = "rounded-2xl border border-zinc-200 bg-white p-6";
const btnPrimary =
  "w-full rounded-lg bg-leaf-800 px-5 py-3.5 text-[16px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "w-full rounded-lg border border-zinc-300 bg-white px-5 py-3.5 text-[16px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const btnDanger =
  "w-full rounded-lg border border-red-200 bg-white px-5 py-3.5 text-[16px] " +
  "font-medium text-red-700 transition-colors hover:border-red-400 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";
const labelClass = "block text-[12px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5";

const INVALID_SESSION = 209;

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-10 pb-24">{children}</main>;
}

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

function fmtWallClock(wallClock: string) {
  const d = new Date(wallClock);
  if (Number.isNaN(d.getTime())) return wallClock;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Couldn't read that photo"));
    reader.readAsDataURL(file);
  });
}

type RuleKey = RuleOption["key"];

/** Repeat choices for a setup/settings form. Without a date the weekday rule is generic. */
function ruleOptionsFor(date: string, generic: { nth: number; weekday: number }): RuleOption[] {
  const monthly = monthlyRuleOptionsForDate(date);
  const genericNth: RuleOption = { key: "monthlyNth", label: "Monthly on a weekday", freq: "monthlyNthWeekday", nth: generic.nth, weekday: generic.weekday };
  const out: RuleOption[] = monthly.length
    ? [...monthly]
    : [genericNth, { ...everyOtherMonth(genericNth), label: "Every other month on a weekday" }];
  out.push({ key: "hostPicks", label: "I'll pick each date", freq: "hostPicks" });
  return out;
}

function keyForRule(rule: SeriesSummary["rule"]): RuleKey {
  return ruleOptionKey(rule);
}

export default function SeriesHostClient({ seriesId, token }: { seriesId: string; token: string }) {
  const [data, setData] = useState<SeriesSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Host session (from the one-time code), kept per tab.
  const sessionKey = `leafSeriesHost:${seriesId}`;
  const sessionRef = useRef<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    try {
      sessionRef.current = sessionStorage.getItem(sessionKey);
      setHasSession(Boolean(sessionRef.current));
    } catch {
      /* private mode */
    }
  }, [sessionKey]);
  const storeSession = useCallback(
    (t: string | null) => {
      sessionRef.current = t;
      setHasSession(Boolean(t));
      try {
        if (t) sessionStorage.setItem(sessionKey, t);
        else sessionStorage.removeItem(sessionKey);
      } catch {
        /* private mode */
      }
    },
    [sessionKey],
  );

  // Code step: opens the first time a protected action is tried.
  const [codeSheet, setCodeSheet] = useState<{ phase: "sending" | "enter"; after: () => Promise<void> } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const run = useCallback(
    async (fn: string, params: Record<string, unknown>) => {
      const t = sessionRef.current;
      return Parse.Cloud.run(fn, params, t ? { sessionToken: t } : undefined);
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getSeriesHostPage", { seriesId, token })) as { series: SeriesSummary };
      setData(r.series);
    } catch (e) {
      setLoadError(errMessage(e, "Could not load this series."));
    }
  }, [seriesId, token]);

  // A signed-in host can arrive without the texted link — accepting the invite
  // on /me lands here to finish setup. getSeriesHostPage takes that session in
  // place of the token, and refuses anyone who is neither. Resolved in an
  // effect, not during render: Parse.User.current() is null on the server pass
  // and truthy after hydration, which would swap the rendered branch under us.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { setSignedIn(Boolean(Parse.User.current())); }, []);
  useEffect(() => {
    if (signedIn === null) return;
    if (!token && !signedIn) {
      setLoadError("This link is missing its key.");
      return;
    }
    void load();
  }, [load, token, signedIn]);

  const requestCode = useCallback(async () => {
    setCodeError(null);
    try {
      await Parse.Cloud.run("requestSeriesHostCode", { seriesId, token });
      setCodeSheet((s) => (s ? { ...s, phase: "enter" } : s));
    } catch (e) {
      setCodeError(errMessage(e, "Couldn't send a code."));
      setCodeSheet((s) => (s ? { ...s, phase: "enter" } : s));
    }
  }, [seriesId, token]);

  /** Run `action` with a host session, asking for the code first if needed. */
  const withSession = useCallback(
    async (action: () => Promise<void>) => {
      // Arrived from /me with no link: the signed-in session IS the credential,
      // and the code step can't run anyway — requestSeriesHostCode is gated on
      // the token. Let the server's own 403 speak if they aren't the host.
      const ambient = !token && signedIn === true;
      if (sessionRef.current || ambient) {
        try {
          await action();
          return;
        } catch (e) {
          if ((e as { code?: number }).code !== INVALID_SESSION || ambient) throw e;
          storeSession(null);
        }
      }
      setCode("");
      setCodeSheet({ phase: "sending", after: action });
      void requestCode();
    },
    [requestCode, storeSession, token, signedIn],
  );

  const verifyCode = async () => {
    if (!codeSheet) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const r = (await Parse.Cloud.run("verifySeriesHostCode", { seriesId, token, code: code.trim() })) as { sessionToken: string };
      storeSession(r.sessionToken);
      const after = codeSheet.after;
      setCodeSheet(null);
      await after();
    } catch (e) {
      setCodeError(errMessage(e, "That code didn't match."));
    } finally {
      setCodeBusy(false);
    }
  };

  /** Wrap a mutation: busy state, error surface, refresh from the response or a reload. */
  const mutate = useCallback(
    (label: string, fn: () => Promise<{ series?: SeriesSummary } | void>, done?: string) => async () => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        const r = await fn();
        if (r && r.series) setData(r.series);
        else await load();
        if (done) setNotice(done);
      } catch (e) {
        setError(errMessage(e, "That didn't go through. Try again."));
        throw e;
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  // Date picker (confirm a different date / move / schedule).
  const [picker, setPicker] = useState<{ mode: PickerMode } | null>(null);
  const [pickDate, setPickDate] = useState("");
  const [pickTime, setPickTime] = useState("");
  // A place for this one date only. Left null, the occurrence takes the
  // series' own venue and the series keeps it for the months after.
  const [pickVenue, setPickVenue] = useState<Venue | null>(null);
  const [pickVenueQuery, setPickVenueQuery] = useState("");
  const pickWallClock = pickDate && pickTime ? `${pickDate}T${pickTime}` : "";

  const openPicker = (mode: PickerMode) => {
    setPickDate("");
    setPickTime(data?.nextOccurrence && mode === "move" ? data.nextOccurrence.wallClock.slice(11, 16) : data?.rule.wallTime || "19:00");
    setPickVenue(null);
    setPickVenueQuery(mode === "venue" ? data?.nextOccurrence?.venue?.name || "" : "");
    setPicker({ mode });
  };

  const submitPicker = async () => {
    if (!picker || !data) return;
    const mode = picker.mode;
    if (mode === "venue") {
      if (!pickVenue || !data.nextOccurrence) return;
      const id = data.nextOccurrence.id;
      const venue = pickVenue;
      await withSession(
        mutate(
          "picker",
          async () => (await run("setSeriesOccurrenceVenue", { eventGroupId: id, venue })) as { series: SeriesSummary },
          `Now at ${venue.name}. Everyone going gets a text.`,
        ),
      ).then(() => setPicker(null)).catch(() => {});
      return;
    }
    if (!pickWallClock) return;
    await withSession(
      mutate(
        "picker",
        async () => {
          if (mode === "move" && data.nextOccurrence) {
            await run("moveSeriesOccurrence", { eventGroupId: data.nextOccurrence.id, wallClock: pickWallClock });
            return undefined;
          }
          return (await run("confirmSeriesOccurrence", {
            seriesId,
            token,
            wallClock: pickWallClock,
            venue: pickVenue || undefined,
          })) as { series: SeriesSummary };
        },
        mode === "move" ? `Moved to ${fmtWallClock(pickWallClock)}. Everyone going gets a text.` : `${fmtWallClock(pickWallClock)} is on. Followers hear about it now.`,
      ),
    ).then(() => setPicker(null)).catch(() => {});
  };

  const keepDate = mutate(
    "keep",
    async () => (await Parse.Cloud.run("confirmSeriesOccurrence", { seriesId, token })) as { series: SeriesSummary },
    "Date kept. Followers hear about it now.",
  );

  const respond = (accept: boolean) =>
    withSession(
      mutate("respond", async () => (await run("respondToSeriesInvite", { seriesId, accept })) as { series: SeriesSummary }),
    ).catch(() => {});

  const skipNext = () => {
    if (!data?.nextOccurrence) return;
    if (!confirm(`Skip ${data.nextOccurrence.whenLabel}? Everyone going is told it's off.`)) return;
    const id = data.nextOccurrence.id;
    void withSession(
      mutate("skip", async () => (await run("skipSeriesOccurrence", { eventGroupId: id })) as { series: SeriesSummary }, "Skipped. Everyone going has been told."),
    ).catch(() => {});
  };

  const endSeries = () => {
    if (!data) return;
    if (!confirm(`End ${data.title}? Anything already scheduled stays unless you skip it. The owner is told.`)) return;
    void withSession(mutate("end", async () => { await run("cancelPlanSeries", { planSeriesId: seriesId }); })).catch(() => {});
  };

  const shareLink = async () => {
    const url = data?.nextOccurrence?.shareUrl;
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Link copied.");
      }
    } catch {
      /* dismissed */
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Closed
        title="We couldn't open this link"
        body="It may have been copied incompletely, or the series has a new host. Open it again from the most recent text."
      />
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-[15px] text-zinc-500">Loading…</p>
      </Shell>
    );
  }

  const header = (
    <header>
      <h1 className="text-2xl font-semibold leading-tight text-leaf-900">{data.title}</h1>
      <p className="mt-1 text-[15px] text-zinc-600">
        on {data.calendarName}
        {data.rule.label ? ` · ${data.rule.label}` : ""}
      </p>
    </header>
  );

  const codeOverlay = codeSheet ? (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/45 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6">
        <h2 className="text-lg font-semibold text-leaf-900">Enter the code we texted you</h2>
        <p className="mt-2 text-[14px] text-zinc-600">
          {codeSheet.phase === "sending"
            ? `Sending a code to the number ending in ${data.hostPhoneHint || "··"}…`
            : `Sent to the number ending in ${data.hostPhoneHint || "··"}. It's how we know it's you.`}
        </p>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputClass} mt-4 text-center tracking-[0.3em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          autoFocus
        />
        {codeError ? <p className="mt-2 text-[13px] text-red-700">{codeError}</p> : null}
        <button type="button" className={`${btnPrimary} mt-4`} disabled={codeBusy || code.length < 4} onClick={() => void verifyCode()}>
          {codeBusy ? "Checking…" : "Continue"}
        </button>
        <div className="mt-3 flex justify-between text-[13px]">
          <button type="button" className="text-zinc-500 hover:text-leaf-900" onClick={() => setCodeSheet(null)}>
            Cancel
          </button>
          <button type="button" className="text-leaf-800 hover:underline" onClick={() => void requestCode()}>
            Resend code
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const feedback = (
    <>
      {notice ? <p className="mt-4 rounded-lg bg-leaf-50 px-4 py-3 text-[14px] text-leaf-900">{notice}</p> : null}
      {error ? <p className="mt-4 text-[14px] text-red-700">{error}</p> : null}
    </>
  );

  if (!data.isActive) {
    return (
      <Closed
        title="This series has ended"
        body={`${data.title} on ${data.calendarName} is no longer running.${data.endedBy === "host" ? " You ended it." : ""}`}
      />
    );
  }

  if (data.pausedReason) {
    const body =
      data.pausedReason === "hostDeclined"
        ? "You passed on this one. If you change your mind, ask the calendar owner to send it again."
        : data.pausedReason === "repeatedSkips"
          ? `Two months went by without a date, so it's paused. ${data.ownerFirstName} has been told and can resume it or hand it to someone else.`
          : `It's paused for now. ${data.ownerFirstName} has been told and can resume it or hand it to someone else.`;
    return (
      <Shell>
        {header}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <h2 className="text-lg font-semibold text-leaf-900">Paused</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">{body}</p>
        </div>
      </Shell>
    );
  }

  if (data.hostStatus === "invited") {
    return (
      <Shell>
        {codeOverlay}
        {header}
        <section className={`${card} mt-6`}>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            <span className="font-medium text-leaf-900">{data.ownerFirstName}</span> from {data.calendarName} asked you to host{" "}
            <span className="font-medium text-leaf-900">{data.title}</span>
            {data.setupStatus === "needsDetails"
              ? ". You pick the date, place and details; before each one we text you to keep the date or pick another."
              : `${data.rule.label ? ` (${data.rule.label})` : ""}. Before each one we text you to keep the date or pick another.`}
          </p>
          {data.inviteNote ? (
            <blockquote className="mt-4 border-l-2 border-leaf-600 pl-3 text-[15px] italic text-zinc-700">“{data.inviteNote}”</blockquote>
          ) : null}
          {data.proposal?.whenLabel ? (
            <p className="mt-4 text-[14px] text-zinc-600">First one proposed for {data.proposal.whenLabel}.</p>
          ) : null}
          <div className="mt-5 space-y-3">
            <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void respond(true)}>
              {busy === "respond" ? "One moment…" : "Accept"}
            </button>
            <button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => confirm("Pass on hosting this?") && void respond(false)}>
              Decline
            </button>
          </div>
          {feedback}
        </section>
      </Shell>
    );
  }

  if (data.setupStatus === "needsDetails") {
    return (
      <Shell>
        {codeOverlay}
        {header}
        <SetupForm data={data} seriesId={seriesId} run={run} withSession={withSession} onPublished={(s) => { setData(s); setNotice("It's live. Followers hear about it now."); }} />
        {feedback}
      </Shell>
    );
  }

  const next = data.nextOccurrence;
  const proposal = data.proposal;

  return (
    <Shell>
      {codeOverlay}
      {header}

      <section className={`${card} mt-6`}>
        {proposal ? (
          proposal.proposedAt ? (
            <>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Waiting on you</h2>
              <p className="mt-2 text-3xl font-semibold leading-tight text-leaf-900">{proposal.whenLabel}</p>
              {proposal.skipDateLabel ? (
                <p className="mt-2 text-[14px] text-zinc-600">
                  Say by {proposal.skipDateLabel}, or we&apos;ll skip {proposal.monthLabel}.
                </p>
              ) : null}
              <div className="mt-5 space-y-3">
                <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void keepDate().catch(() => {})}>
                  {busy === "keep" ? "Confirming…" : "Keep this date"}
                </button>
                <button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => void withSession(async () => openPicker("confirm"))}>
                  Pick another date
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">When&apos;s the next one?</h2>
              <p className="mt-2 text-[15px] text-zinc-700">
                Pick a date and we&apos;ll tell everyone.
                {proposal.skipDateLabel ? ` Pick by ${proposal.skipDateLabel}, or we'll check back next month.` : ""}
              </p>
              <button type="button" className={`${btnPrimary} mt-5`} disabled={busy !== null} onClick={() => void withSession(async () => openPicker("confirm"))}>
                Pick a date
              </button>
            </>
          )
        ) : next ? (
          <>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Next up</h2>
            <p className="mt-2 text-2xl font-semibold leading-tight text-leaf-900">{next.whenLabel}</p>
            <p className="mt-1 text-[15px] text-zinc-600">
              {next.rsvps} going{next.capacity ? ` · ${next.capacity} spots` : ""}
            </p>
            {next.venue?.name ? (
              <p className="mt-1 text-[15px] text-zinc-600">
                at {next.venue.name}
                {next.venueDiffersFromSeries ? <span className="text-[13px] text-zinc-500"> · just this one</span> : null}
              </p>
            ) : null}
            {next.attendeeFirstNames && next.attendeeFirstNames.length ? (
              <p className="mt-1 text-[13px] text-zinc-500">{next.attendeeFirstNames.join(", ")}</p>
            ) : null}
            <div className="mt-5 space-y-3">
              <button type="button" className={btnPrimary} onClick={() => void shareLink()}>
                Share link
              </button>
              <button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => void withSession(async () => openPicker("move"))}>
                Move
              </button>
              <button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => void withSession(async () => openPicker("venue"))}>
                Change place
              </button>
              <button type="button" className={btnQuiet} disabled={busy !== null} onClick={skipNext}>
                Skip this one
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Nothing scheduled yet</h2>
            <p className="mt-2 text-[15px] text-zinc-700">
              {data.upcoming[0]
                ? `We'll text you three weeks before ${data.upcoming[0].label} to keep it or pick another date.`
                : "We'll text you when it's time to pick the next date."}
            </p>
            <button type="button" className={`${btnQuiet} mt-5`} disabled={busy !== null} onClick={() => void withSession(async () => openPicker("schedule"))}>
              Schedule the next one now
            </button>
          </>
        )}
        {feedback}
      </section>

      {picker ? (
        <section className={`${card} mt-4`}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
            {picker.mode === "venue" ? "Where is this one?" : picker.mode === "move" ? "Move it to" : "Pick a date"}
          </h2>
          {picker.mode === "venue" ? (
            <>
              <p className="mt-2 text-[13px] text-zinc-500">
                Just this one. {data.venue?.name ? `${data.venue.name} stays` : "The usual place stays"} the default for the others.
              </p>
              <div className="mt-3">
                <VenueSearch
                  value={pickVenueQuery}
                  onChange={setPickVenueQuery}
                  onSelect={(v) => { setPickVenueQuery(v.name); setPickVenue({ name: v.name, address: v.address, placeId: v.placeId }); }}
                  className={inputClass}
                  placeholder="Search for a place"
                />
              </div>
              <button type="button" className={`${btnPrimary} mt-3`} disabled={!pickVenue || busy !== null} onClick={() => void submitPicker()}>
                {busy === "picker" ? "Saving…" : pickVenue ? `Move it to ${pickVenue.name}` : "Pick a place"}
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-zinc-500">
                At least a day out and within 60 days. Times are in {data.rule.timeZone.replace(/_/g, " ")}.
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                <input type="date" aria-label="Date" className={inputClass} value={pickDate} min={data.minWallClock.slice(0, 10)} max={data.maxWallClock.slice(0, 10)} onChange={(e) => setPickDate(e.target.value)} />
                <input type="time" aria-label="Start time" className={inputClass} value={pickTime} onChange={(e) => setPickTime(e.target.value)} />
              </div>
              {picker.mode === "move" ? null : (
                <div className="mt-3">
                  <label className={labelClass}>Place (optional)</label>
                  <VenueSearch
                    value={pickVenueQuery}
                    onChange={(v) => { setPickVenueQuery(v); if (!v) setPickVenue(null); }}
                    onSelect={(v) => { setPickVenueQuery(v.name); setPickVenue({ name: v.name, address: v.address, placeId: v.placeId }); }}
                    className={inputClass}
                    placeholder={data.venue?.name ? `${data.venue.name} — search to change just this one` : "Search for a place"}
                  />
                  <p className="mt-1 text-[13px] text-zinc-500">
                    Leave it be and this one is at {data.venue?.name || "the usual place"}. Changing it here moves this date only.
                  </p>
                </div>
              )}
              <button type="button" className={`${btnPrimary} mt-3`} disabled={!pickWallClock || busy !== null} onClick={() => void submitPicker()}>
                {busy === "picker" ? "Saving…" : pickWallClock ? `${picker.mode === "move" ? "Move to" : "Set for"} ${fmtWallClock(pickWallClock)}` : "Choose a date"}
              </button>
            </>
          )}
          <button type="button" className={`${btnQuiet} mt-3`} onClick={() => setPicker(null)}>
            Cancel
          </button>
        </section>
      ) : null}

      {data.upcoming.length ? (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Coming up</h2>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {data.upcoming.map((u) => (
              <li key={u.ruleAt} className="flex items-center justify-between px-4 py-3 text-[15px]">
                <span className={u.skipped ? "text-zinc-400 line-through" : "text-leaf-900"}>{u.label}</span>
                {u.skipped ? <span className="text-[12px] text-zinc-400">skipped</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-zinc-500">Dates follow the rule; you can move each one when we text you.</p>
        </section>
      ) : data.rule.freq === "hostPicks" ? (
        <p className="mt-6 text-[13px] text-zinc-500">You pick each date. We check in the day after each one.</p>
      ) : null}

      <SettingsSection data={data} seriesId={seriesId} run={run} withSession={withSession} onSaved={(s) => { setData(s); setNotice("Saved."); }} />

      <section className="mt-8">
        <button type="button" className={btnDanger} disabled={busy !== null} onClick={endSeries}>
          End series
        </button>
        <p className="mt-2 text-[13px] text-zinc-500">Anything already scheduled stays unless you skip it. {data.ownerFirstName} is told.</p>
        {hasSession ? (
          <button type="button" className="mt-4 text-[13px] text-zinc-400 hover:text-zinc-700" onClick={() => storeSession(null)}>
            Forget this device
          </button>
        ) : null}
      </section>
    </Shell>
  );
}

// ── Set it up (Path B) ────────────────────────────────────────────────────────

type Runner = (fn: string, params: Record<string, unknown>) => Promise<unknown>;
type WithSession = (action: () => Promise<void>) => Promise<void>;

type Draft = {
  title: string;
  description: string;
  imageUrl: string | null;
  ruleKey: RuleKey;
  nth: number;
  weekday: number;
  date: string;
  time: string;
  venue: Venue | null;
  capacity: string;
  requireApproval: boolean;
};

function draftFrom(data: SeriesSummary): Draft {
  const d = (data.setupDraft || {}) as Partial<{
    title: string; description: string; imageUrl: string; freq: string; nth: number; weekday: number; dayOfMonth: number;
    intervalMonths: number; wallClock: string; venue: Venue; capacity: string | number; requireApproval: boolean;
  }>;
  const freq = (d.freq || data.rule.freq) as SeriesSummary["rule"]["freq"];
  const nth = d.nth ?? data.rule.nth ?? 2;
  const weekday = d.weekday ?? data.rule.weekday ?? 2;
  const intervalMonths = d.intervalMonths ?? data.rule.intervalMonths ?? 1;
  const ruleKey: RuleKey = ruleOptionKey({ freq, nth, intervalMonths });
  return {
    title: d.title || data.title,
    description: d.description || data.description || "",
    imageUrl: d.imageUrl || data.imageUrl || null,
    ruleKey,
    nth: nth === -1 ? 2 : nth,
    weekday,
    date: d.wallClock ? d.wallClock.slice(0, 10) : "",
    time: d.wallClock ? d.wallClock.slice(11, 16) : data.rule.wallTime || "19:00",
    venue: d.venue && d.venue.name ? d.venue : data.venue?.name ? { name: data.venue.name, address: data.venue.address || "" } : null,
    capacity: d.capacity ? String(d.capacity) : data.capacity ? String(data.capacity) : "",
    requireApproval: d.requireApproval ?? data.requireApproval,
  };
}

function SetupForm({ data, seriesId, run, withSession, onPublished }: {
  data: SeriesSummary;
  seriesId: string;
  run: Runner;
  withSession: WithSession;
  onPublished: (s: SeriesSummary) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(data));
  const [venueQuery, setVenueQuery] = useState(draft.venue?.name || "");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(draft.imageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const options = useMemo(() => ruleOptionsFor(draft.date, { nth: draft.nth, weekday: draft.weekday }), [draft.date, draft.nth, draft.weekday]);
  const rule = options.find((o) => o.key === draft.ruleKey) || options[0];
  useEffect(() => {
    if (!options.some((o) => o.key === draft.ruleKey)) setDraft((d) => ({ ...d, ruleKey: options[0].key }));
  }, [options, draft.ruleKey]);

  // Autosave the form so a host who leaves comes back to it. Needs the
  // session; until they've entered a code, the draft just lives in the tab.
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      run("saveSeriesSetupDraft", {
        seriesId,
        draft: {
          title: draft.title, description: draft.description, imageUrl: draft.imageUrl,
          freq: rule?.freq, nth: rule?.nth, weekday: rule?.weekday, dayOfMonth: rule?.dayOfMonth,
          intervalMonths: rule?.intervalMonths,
          wallClock: draft.date && draft.time ? `${draft.date}T${draft.time}` : undefined,
          venue: draft.venue, capacity: draft.capacity, requireApproval: draft.requireApproval,
        },
      })
        .then(() => setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })))
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [draft, rule, run, seriesId]);

  const update = (patch: Partial<Draft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("That photo is over 8MB. Pick a smaller one.");
      return;
    }
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
    setImagePreview(`data:${file.type};base64,${b64}`);
  };

  const canPublish = draft.title.trim() && draft.date && draft.time && draft.venue && rule;

  const publish = () => {
    if (!canPublish || !rule) return;
    void withSession(async () => {
      setBusy(true);
      setError(null);
      try {
        const r = (await run("completeSeriesSetup", {
          seriesId,
          title: draft.title.trim(),
          description: draft.description,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? draft.imageUrl || undefined : undefined,
          freq: rule.freq,
          nth: rule.nth,
          weekday: rule.weekday,
          dayOfMonth: rule.dayOfMonth,
          intervalMonths: rule.intervalMonths,
          wallClock: `${draft.date}T${draft.time}`,
          venue: draft.venue,
          capacity: draft.capacity ? parseInt(draft.capacity, 10) : undefined,
          requireApproval: draft.requireApproval,
          hideVenueUntilRsvp: data.hideVenueUntilRsvp,
        })) as { series: SeriesSummary };
        onPublished(r.series);
      } catch (e) {
        setError(errMessage(e, "Couldn't publish. Check the date and try again."));
        throw e;
      } finally {
        setBusy(false);
      }
    }).catch(() => {});
  };

  return (
    <section className={`${card} mt-6`}>
      <h2 className="text-lg font-semibold text-leaf-900">Set it up</h2>
      <p className="mt-1 text-[14px] text-zinc-600">
        {data.ownerFirstName} handed you this one. Fill it in and publish; followers of {data.calendarName} hear about the first date straight away.
      </p>
      {data.inviteNote ? <blockquote className="mt-3 border-l-2 border-leaf-600 pl-3 text-[14px] italic text-zinc-700">“{data.inviteNote}”</blockquote> : null}

      <div className="mt-5 space-y-5">
        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={draft.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea className={inputClass} rows={3} value={draft.description} maxLength={2000} onChange={(e) => update({ description: e.target.value })} placeholder="What it is, who it's for, what to bring." />
        </div>
        <div>
          <label className={labelClass}>Photo</label>
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="" className="mb-2 h-36 w-full rounded-lg object-cover" />
          ) : null}
          <input type="file" accept="image/*" className="text-[14px]" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        </div>
        <div>
          <label className={labelClass}>First date</label>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input type="date" className={inputClass} value={draft.date} min={data.minWallClock.slice(0, 10)} max={data.maxWallClock.slice(0, 10)} onChange={(e) => update({ date: e.target.value })} />
            <input type="time" className={inputClass} value={draft.time} onChange={(e) => update({ time: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Repeats</label>
          <select className={inputClass} value={draft.ruleKey} onChange={(e) => update({ ruleKey: e.target.value as RuleKey })}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          {(draft.ruleKey === "monthlyNth" || draft.ruleKey === "otherMonthNth") && !draft.date ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <select className={inputClass} value={draft.nth} onChange={(e) => update({ nth: parseInt(e.target.value, 10) })} aria-label="Which week">
                {[1, 2, 3, 4, -1].map((n) => <option key={n} value={n}>{NTH_LABELS[n]}</option>)}
              </select>
              <select className={inputClass} value={draft.weekday} onChange={(e) => update({ weekday: parseInt(e.target.value, 10) })} aria-label="Weekday">
                {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Venue</label>
          <VenueSearch
            value={venueQuery}
            onChange={(v) => { setVenueQuery(v); if (!v) update({ venue: null }); }}
            onSelect={(v) => { setVenueQuery(v.name); update({ venue: { name: v.name, address: v.address, placeId: v.placeId } }); }}
            className={inputClass}
            placeholder="Search for a place"
          />
          {draft.venue?.address ? <p className="mt-1 text-[13px] text-zinc-500">{draft.venue.address}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Capacity</label>
            <input type="number" min={1} className={inputClass} value={draft.capacity} placeholder="No limit" onChange={(e) => update({ capacity: e.target.value })} />
          </div>
          <label className="flex items-end gap-2 pb-3 text-[15px] text-leaf-900">
            <input type="checkbox" checked={draft.requireApproval} onChange={(e) => update({ requireApproval: e.target.checked })} className="h-4 w-4 accent-leaf-800" />
            Require approval
          </label>
        </div>
      </div>

      {error ? <p className="mt-4 text-[14px] text-red-700">{error}</p> : null}
      <button type="button" className={`${btnPrimary} mt-6`} disabled={!canPublish || busy} onClick={publish}>
        {busy ? "Publishing…" : "Publish"}
      </button>
      <p className="mt-2 text-[13px] text-zinc-500">
        {savedAt ? `Saved ${savedAt}. ` : "Your changes save as you go. "}
        Leave and come back any time from your link.
      </p>
    </section>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsSection({ data, seriesId, run, withSession, onSaved }: {
  data: SeriesSummary;
  seriesId: string;
  run: Runner;
  withSession: WithSession;
  onSaved: (s: SeriesSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wallTime, setWallTime] = useState(data.rule.wallTime || "19:00");
  const [description, setDescription] = useState(data.description || "");
  const [capacity, setCapacity] = useState(data.capacity ? String(data.capacity) : "");
  const [venueQuery, setVenueQuery] = useState(data.venue?.name || "");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [ruleKey, setRuleKey] = useState<RuleKey>(keyForRule(data.rule));
  const [nth, setNth] = useState(data.rule.nth && data.rule.nth > 0 ? data.rule.nth : 2);
  const [weekday, setWeekday] = useState(data.rule.weekday ?? 2);
  const [dayOfMonth] = useState(data.rule.dayOfMonth || 1);
  const [alsoNext, setAlsoNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyOptions: RuleOption[] = [
    { key: "monthlyDay", label: `Monthly on the ${dayOfMonth}${dayOfMonth === 1 ? "st" : dayOfMonth === 2 ? "nd" : dayOfMonth === 3 ? "rd" : "th"}`, freq: "monthly", dayOfMonth },
    { key: "monthlyNth", label: "Monthly on a weekday", freq: "monthlyNthWeekday", nth, weekday },
    { key: "monthlyLast", label: `Monthly on the last ${WEEKDAY_NAMES[weekday]}`, freq: "monthlyNthWeekday", nth: -1, weekday },
  ];
  const options: RuleOption[] = [
    ...monthlyOptions,
    ...monthlyOptions.map(everyOtherMonth),
    { key: "hostPicks", label: "I'll pick each date", freq: "hostPicks" },
  ];
  const rule = options.find((o) => o.key === ruleKey) || options[1];

  const save = () => {
    void withSession(async () => {
      setBusy(true);
      setError(null);
      try {
        const r = (await run("updatePlanSeries", {
          seriesId,
          description,
          wallTime,
          capacity: capacity ? parseInt(capacity, 10) : 0,
          venue: venue || undefined,
          freq: rule.freq,
          nth: rule.nth,
          weekday: rule.weekday,
          dayOfMonth: rule.dayOfMonth,
          intervalMonths: rule.intervalMonths || 1,
          alsoUpdateNext: alsoNext,
        })) as { series: SeriesSummary };
        onSaved(r.series);
        setOpen(false);
      } catch (e) {
        setError(errMessage(e, "Couldn't save."));
        throw e;
      } finally {
        setBusy(false);
      }
    }).catch(() => {});
  };

  return (
    <section className="mt-6">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Settings</h2>
        <span className="text-[13px] text-zinc-400">{open ? "Hide" : "Edit"}</span>
      </button>
      {open ? (
        <div className={`${card} mt-2 space-y-5`}>
          <div>
            <label className={labelClass}>Time</label>
            <input type="time" className={inputClass} value={wallTime} onChange={(e) => setWallTime(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Venue</label>
            <VenueSearch
              value={venueQuery}
              onChange={setVenueQuery}
              onSelect={(v) => { setVenueQuery(v.name); setVenue({ name: v.name, address: v.address, placeId: v.placeId }); }}
              className={inputClass}
              placeholder="Search for a place"
            />
          </div>
          <div>
            <label className={labelClass}>Capacity</label>
            <input type="number" min={1} className={inputClass} value={capacity} placeholder="No limit" onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Repeats</label>
            <select className={inputClass} value={ruleKey} onChange={(e) => setRuleKey(e.target.value as RuleKey)}>
              {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {ruleKey === "monthlyNth" || ruleKey === "monthlyLast" || ruleKey === "otherMonthNth" || ruleKey === "otherMonthLast" ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                {ruleKey === "monthlyNth" || ruleKey === "otherMonthNth" ? (
                  <select className={inputClass} value={nth} onChange={(e) => setNth(parseInt(e.target.value, 10))} aria-label="Which week">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{NTH_LABELS[n]}</option>)}
                  </select>
                ) : <span />}
                <select className={inputClass} value={weekday} onChange={(e) => setWeekday(parseInt(e.target.value, 10))} aria-label="Weekday">
                  {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
            ) : null}
            <p className="mt-1 text-[13px] text-zinc-500">Changing the rule restarts the reminders from the next matching date.</p>
          </div>
          {data.nextOccurrence ? (
            <label className="flex items-center gap-2 text-[15px] text-leaf-900">
              <input type="checkbox" checked={alsoNext} onChange={(e) => setAlsoNext(e.target.checked)} className="h-4 w-4 accent-leaf-800" />
              Also update the next one ({data.nextOccurrence.whenLabel})
            </label>
          ) : null}
          {error ? <p className="text-[14px] text-red-700">{error}</p> : null}
          <button type="button" className={btnPrimary} disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
