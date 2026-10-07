"use client";

/**
 * The crew page — /crew/[token]
 *
 * Read on a phone, from a text. One job: let a member answer whatever the crew
 * needs from them right now (vote on dates, IN/OUT, mark it booked), and show
 * the nights coming up and the ones that happened. Members are names only;
 * no phone numbers reach this page.
 *
 * Desktop (lg+) splits into two columns: who the crew is and its settings on
 * the left, what needs you on the right.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, ChevronUp, MessageCircle, Plus, Settings, UserPlus, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import {
  Avatar, Button, Card, CrewShell, CrewTopBar, DeadState, DisplayTitle, Eyebrow, Mono, SectionTitle, Spinner, useInApp, useCrewEmbedded,
} from "@/components/crew/CrewShell";
import ProposeNight from "@/components/crew/ProposeNight";
import SeedPlaces from "@/components/crew/SeedPlaces";
import CrewPulseCard from "@/components/crew/CrewPulseCard";
import { EMPTY_PULSE } from "@/lib/crew-pulse";
import CrewMoneyCard from "@/components/crew/CrewMoneyCard";
import CrewAddOnCard from "@/components/crew/CrewAddOnCard";
import PlacePhoto from "@/components/crew/PlacePhoto";
import PhoneVerificationModal from "@/components/PhoneVerificationModal";
import { FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";
import {
  RHYTHM_LABELS, crewHref, cycleStatusLine, dayParts, rhythmLabel, cadenceLabel, run, spotHref, tellLeafReceipt, timeLabel, toDate,
  type BookSpot, type CrewAuth, type CrewPage, type CycleView, type Member, type TellLeafResult,
  type CrewAddOn,
} from "@/lib/crew";

export default function CrewClient({ token }: { token: string }) {
  const load = useCrewAuth(token);
  if (load.status === "loading") return <Spinner label="Loading your crew…" />;
  if (load.status === "expired") {
    return (
      <DeadState
        title="This link has expired."
        body="Links stop working when someone leaves a crew or asks Leaf to stop texting. If that's not you, text PLAN to the number Leaf wrote from and you'll get a fresh one."
      />
    );
  }
  if (load.status === "error") return <DeadState title="Couldn't load your crew." body={load.message} />;
  return <CrewPageView auth={load.auth} data={load.data} reload={load.reload} />;
}

/** "Thursday Dinner Club" → ["Thursday", "Dinner Club"]: the second half sets in italic. */
function splitName(name: string): [string, string | undefined] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name, undefined];
  const cut = Math.floor(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

function CrewPageView({ auth, data, reload }: { auth: CrewAuth; data: CrewPage; reload: () => Promise<void> }) {
  const embedded = useCrewEmbedded();
  const { crew, me, members, names, open, past, book } = data;
  // Money: the latest night's bill, and each set night's cost. Kept here so a
  // claim or "I paid" updates the card at once (the server returns the new view).
  const [split, setSplit] = useState(data.split ?? null);
  const [costs, setCosts] = useState(data.costs ?? {});
  const [addOns, setAddOns] = useState(data.addOns ?? []);
  useEffect(() => { setSplit(data.split ?? null); setCosts(data.costs ?? {}); setAddOns(data.addOns ?? []); }, [data]);
  const setAddOn = (cycleId: string, next: CrewAddOn | null) =>
    setAddOns((list) => (next ? list.map((x) => (x.cycleId === cycleId ? next : x)) : list.filter((x) => x.cycleId !== cycleId)));
  const addOnFor = (cycleId: string) => addOns.find((x) => x.cycleId === cycleId) || null;
  const pastAddOns = addOns.filter((x) => !open.some((c) => c.cycleId === x.cycleId));
  const pills = data.prefPills || [];
  const [allPills, setAllPills] = useState(false);
  const [pace, setPace] = useState<string>(me.rhythmDays ? String(me.rhythmDays) : "");
  const [proposing, setProposing] = useState(false);
  const inApp = useInApp();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState<string | null>(null);
  const [error, setError] = useState("");
  // "Text me about this crew's plans": never pre-ticked (10DLC).
  const [smsBox, setSmsBox] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Someone who joined by text or in the app never saw the tap-to-add step.
  // Offer it once here, dismissible, above the book it feeds.
  const [seedDone, setSeedDone] = useState(false);
  // "How often for you?" — asked once, right after joining.
  const [paceDone, setPaceDone] = useState(false);
  // Invite: the owner picks followers not yet invited; anyone in can share the link.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitable, setInvitable] = useState<{ userId: string; name: string; pending?: boolean }[] | null>(null);
  const [invitePicked, setInvitePicked] = useState<Set<string>>(new Set());
  const [inviteNote, setInviteNote] = useState("");
  const [linkDone, setLinkDone] = useState("");
  // Only a crew built on a real calendar has followers to pick from. A crew
  // from Start a crew has a calendar behind it that nobody ever sees, so the
  // sheet never mentions one.
  const hasFollowers = me.isOwner && crew.origin !== "friends";
  // Venue rotation off: the crew always meets at its own place, so there's
  // no book, no seeding and no booking.
  const fixedPlace = crew.placeMode === "fixed" ? crew.fixedPlace || null : null;
  const [placeOn, setPlaceOn] = useState(crew.placeMode === "fixed");
  const [placeLabel, setPlaceLabel] = useState(crew.fixedPlace?.label || "");
  const [placeAddress, setPlaceAddress] = useState(crew.fixedPlace?.address || "");
  const openInvite = () => {
    setInviteOpen(true);
    setInviteNote("");
    setLinkDone("");
    if (hasFollowers) {
      run<{ people: { userId: string; name: string; canInvite: boolean; pending?: boolean }[] }>("previewCrewInvites", auth)
        .then((r) => {
          const list = r.people.filter((p) => p.canInvite);
          setInvitable(list);
          setInvitePicked(new Set(list.map((p) => p.userId)));
        })
        .catch(() => setInvitable([]));
    }
  };
  const shareInviteLink = async () => {
    if (!me.inviteLink) return;
    // The link's preview already shows the crew (name, who invited you, how
    // often), so the message stays short: no name, no title field.
    const text = `Join our crew on Leaf so we can plan nights out together: ${me.inviteLink}`;
    try {
      if (navigator.share) { await navigator.share({ text }); setLinkDone("Shared"); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(me.inviteLink); setLinkDone("Link copied"); } catch { /* ignore */ }
  };
  // Calendar sync needs a Leaf sign-in (a crew link alone isn't an account session).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(Boolean(Parse.User.current())); }, []);

  // Calendar connect needs a real session, not just this crew link: a
  // forwarded link must not be able to attach someone else's Google
  // calendar to this account. Signed in as this member → straight to
  // Google; otherwise a phone code first, and only this member's account.
  const [verifyForCalendar, setVerifyForCalendar] = useState(false);
  const goConnectCalendar = async () => {
    const r = (await Parse.Cloud.run("createGoogleCalendarConnectUrl", { returnTo: window.location.href })) as { url: string };
    window.location.href = r.url;
  };
  const connectCalendar = () => {
    const current = Parse.User.current();
    if (current && (!me.userId || current.id === me.userId)) {
      void act("gcal", goConnectCalendar);
    } else {
      setVerifyForCalendar(true);
    }
  };
  const [smsPhone, setSmsPhone] = useState("");
  const phoneOk = !smsBox || Boolean(me.phoneLast4) || smsPhone.replace(/\D/g, "").length >= 10;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const joined = members.filter((m) => m.status === "in");
  const invited = members.filter((m) => m.status === "invited");
  // Nothing new starts while Friend Mode is off (the toggle, or Do it again).
  const canStart = crew.enabled !== false && open.length < 2 && !open.some((c) => c.state === "picking" && !c.waitingForQuorum);
  const [first, second] = splitName(crew.name);
  const summary = [`${joined.length} in`, invited.length ? `${invited.length} invited` : null, cadenceLabel(crew).toLowerCase(), crew.status === "paused" ? "paused" : null]
    .filter(Boolean)
    .join(" · ");

  // Leaf starts each night on the crew's rhythm by itself; the only manual
  // path is a member bringing their own place and dates.
  const startButtons = (
    <Button kind="ghost" onClick={() => setProposing(true)} small>
      I&rsquo;ve got one
    </Button>
  );

  // Invited (or said no): answer first. Nothing about the crew's nights,
  // book or members shows until they've joined.
  if (me.status === "invited" || me.status === "declined") {
    const declined = me.status === "declined";
    const inviter = (crew.ownerId && names[crew.ownerId]) || members.find((m) => m.userId === crew.ownerId)?.name || "A friend";
    const faces = joined.filter((m) => m.userId !== me.userId).slice(0, 5);
    return (
      <CrewShell>
        <div className="flex min-h-[70vh] flex-col justify-center py-6">
          <Eyebrow>{declined ? "You said no thanks" : `${inviter.split(" ")[0]} invited you`}</Eyebrow>
          <div className="mt-4">
            <DisplayTitle italic={second}>{first}</DisplayTitle>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-fm-ink-2">
            {crew.oneTime
              ? "One night out with this crew. Leaf finds a date that works for everyone and plans it."
              : `Nights out with this crew, ${rhythmLabel(crew.rhythmDays).toLowerCase()}. Leaf finds a date that works for everyone and plans it.`}
          </p>
          {faces.length > 0 && (
            <div className="mt-5 flex items-center gap-3">
              <div className="flex -space-x-2">
                {faces.map((m) => <Avatar key={m.membershipId} name={m.name} src={m.avatar} ring="ring-2 ring-fm-canvas" />)}
              </div>
              <span className="text-sm text-fm-muted">{joined.length} in so far</span>
            </div>
          )}

          <div className="mt-7 rounded-3xl border border-fm-line bg-fm-surface p-5">
            {declined ? (
              <p className="m-0 text-[15px] text-fm-ink-2">Changed your mind? You can still join.</p>
            ) : (
              <p className="m-0 text-[15px] text-fm-ink-2">Join to see what the crew is planning. Nobody sees your number.</p>
            )}
            {/* A number is asked for only when there's none on file. Texts can
                be turned off later (STOP, or the crew page's settings). */}
            {!me.phoneLast4 && (
              <label className="mt-3 block">
                <span className="block text-xs text-fm-muted">Mobile number, for texts</span>
                <input
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-[14px]"
                />
              </label>
            )}
            <div className={`mt-4 grid gap-2 ${declined ? "grid-cols-1" : "grid-cols-2"}`}>
              <Button
                onClick={() => act("join", () => run("respondToCrewInvite", auth, { accept: true, sms: true, phone: me.phoneLast4 ? null : smsPhone || null }))}
                disabled={busy !== null || (!me.phoneLast4 && smsPhone.replace(/\D/g, "").length < 10)}
              >
                {busy === "join" ? "Joining…" : "Join"}
              </Button>
              {!declined && (
                <Button kind="ghost" onClick={() => act("decline", () => run("respondToCrewInvite", auth, { accept: false }))} disabled={busy !== null}>
                  No thanks
                </Button>
              )}
            </div>
            {/* Joining turns on texts about this crew; the disclosure sits right
                under the button so the tap is the consent. */}
            <p className="mb-0 mt-3 text-[11px] leading-snug text-fm-muted">
              By joining, you agree to get texts about this crew&rsquo;s plans (date polls and the night&rsquo;s details){me.phoneLast4 ? ` at the number ending in ${me.phoneLast4}` : ""}. Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
            </p>
            {error && <p className="mb-0 mt-3 text-sm text-fm-danger">{error}</p>}
          </div>
          <p className="mt-4 text-xs text-fm-muted">No thanks just means Leaf won&rsquo;t ask you about this crew.</p>
        </div>
      </CrewShell>
    );
  }

  return (
    <CrewShell wide topBar={<CrewTopBar auth={auth} active="crew" />}>
      {verifyForCalendar && (
        <PhoneVerificationModal
          onClose={() => setVerifyForCalendar(false)}
          onVerified={() => {
            setVerifyForCalendar(false);
            setSignedIn(true);
            const current = Parse.User.current();
            if (me.userId && current?.id !== me.userId) {
              setError("That number belongs to a different Leaf account, so the calendar wasn't connected. Use the number this crew knows you by.");
              return;
            }
            void act("gcal", goConnectCalendar);
          }}
        />
      )}
      {error && <p className="mb-4 rounded-2xl bg-[#3A2321] px-4 py-3 text-sm text-fm-danger">{error}</p>}

      <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-[72px]">
        {/* Who the crew is */}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-8">
          <div className="flex flex-col gap-4">
            {/* Invite and Settings sit top right, beside the crew's name. */}
            <div className="flex items-start justify-between gap-3">
              <DisplayTitle italic={second && <span className="block">{second}</span>}>{first}</DisplayTitle>
              <div className="flex shrink-0 items-center gap-2 pt-1 lg:pt-3">
                {me.inviteLink && (
                  <button
                    type="button"
                    onClick={openInvite}
                    aria-label="Invite people"
                    title="Invite"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-fm-line text-fm-ink transition hover:bg-fm-card"
                  >
                    <UserPlus size={19} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Crew settings"
                  title="Settings"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-fm-line text-fm-ink transition hover:bg-fm-card"
                >
                  <Settings size={19} aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex lg:hidden">
                {[...joined, ...invited].slice(0, 5).map((m, i) => (
                  <span key={m.membershipId} className={i ? "-ml-2.5" : ""}>
                    <Avatar name={m.name} src={m.avatar} invited={m.status === "invited"} ring="ring-2 ring-fm-canvas" />
                  </span>
                ))}
              </div>
              <p className="m-0 text-sm text-fm-ink-2 lg:text-[15px]">{summary}</p>
            </div>
          </div>

          {me.isOwner && (
            <div className="flex items-center gap-4 rounded-full border border-fm-line bg-fm-surface py-2 pl-5 pr-2">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">Friend Mode</div>
                <div className="truncate text-[12px] text-fm-muted">
                  {crew.enabled === false ? "Off · nothing is planned or texted" : "On · Leaf plans nights for this group"}
                </div>
              </div>
              <FriendModeSwitch
                label="Friend Mode"
                checked={crew.enabled !== false}
                disabled={busy !== null}
                onChange={(v) => act("fm", () => run("setFriendModeOnCalendar", auth, { calendarId: crew.id, enabled: v }))}
              />
            </div>
          )}
          {crew.joinedCount < crew.quorum && (
            <p className="m-0 text-sm text-fm-ink-2">
              Waiting on {crew.quorum - crew.joinedCount} more to join before Leaf plans the first night.
            </p>
          )}
        </div>

        {/* What needs you */}
        <div className="mt-7 flex min-w-0 flex-col gap-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:gap-14">
          {crew.lastOneTime && (
            <section className="flex flex-col gap-3 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <Eyebrow>{crew.lastOneTime.happened ? "That was the night" : "It didn't come together"}</Eyebrow>
              <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-[1.05] lg:text-[36px]">
                {me.isOwner ? "Do it again?" : "One night out"}
              </h2>
              <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
                {me.isOwner
                  ? `Same people${crew.lastOneTime.venue ? `, and ${crew.lastOneTime.venue} is still in the book` : ""}. Leaf finds a new date that works.`
                  : `${(names[crew.ownerId || ""] || "The organizer").split(" ")[0]} can plan another one.`}
              </p>
              {me.isOwner && (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy !== null} onClick={() => act("again", () => run("runCrewAgain", auth, { calendarId: crew.id, oneTime: true }))}>
                    {busy === "again" ? "Starting…" : "Another night"}
                  </Button>
                  <Button kind="ghost" disabled={busy !== null} onClick={() => act("again", () => run("runCrewAgain", auth, { calendarId: crew.id, oneTime: false, rhythmDays: 28 }))}>
                    Make it monthly
                  </Button>
                </div>
              )}
            </section>
          )}
          <section className="flex flex-col gap-3 lg:gap-5">
            <div className="hidden items-center justify-between lg:flex">
              <SectionTitle>Up next</SectionTitle>
              {canStart && !proposing && !fixedPlace && <div className="flex gap-2">{startButtons}</div>}
            </div>

            {open.length === 0 && !crew.lastOneTime && (
              <Card>
                <Eyebrow>Nothing being planned</Eyebrow>
                <p className="mt-3 text-[15px] leading-relaxed text-fm-ink-2">
                  {crew.enabled === false ? "Friend Mode is off, so Leaf isn't planning anything for this crew." : crew.oneTime ? "Leaf starts planning the night as soon as enough people are in." : `Leaf starts the next night on its own (${rhythmLabel(crew.rhythmDays).toLowerCase()}). Got a place and a date in mind? Say so below.`}
                </p>
                {me.isOwner && crew.enabled !== false && !crew.oneTime && crew.nextRoundAt && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-fm-muted">
                      Next round starts around {new Date(crew.nextRoundAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}.
                    </span>
                    <Button small kind="ghost" disabled={busy !== null} onClick={() => act("skip", () => run("skipCrewRound", auth, { calendarId: crew.id }))}>
                      {busy === "skip" ? "Skipping…" : "Skip the next one"}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {open.length > 0 && (
              <div className={`grid grid-cols-1 gap-3 lg:gap-4 ${open.length > 1 ? "lg:grid-cols-2" : ""}`}>
                {open.map((c) => (
                  <div key={c.cycleId} className="flex min-w-0 flex-col gap-3">
                    <CycleCard cycle={c} names={names} members={members} busy={busy} onAct={act} auth={auth} quorum={crew.quorum} joined={joined.length} calendarSynced={Boolean(me.calendarSynced)} onConnectCalendar={connectCalendar} hostRotation={Boolean(crew.hostRotation)} isOwner={me.isOwner} canSkip={me.isOwner && !crew.oneTime && crew.enabled !== false} crewId={crew.id} />
                    {costs[c.cycleId] && (
                      <CrewMoneyCard kind="cost" split={costs[c.cycleId]!} auth={auth} onChange={(next) => setCosts((m) => ({ ...m, [c.cycleId]: next }))} />
                    )}
                    {addOnFor(c.cycleId) && (
                      <CrewAddOnCard addOn={addOnFor(c.cycleId)!} auth={auth} onChange={(next) => setAddOn(c.cycleId, next)} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {canStart && !proposing && !fixedPlace && <div className="flex lg:hidden">{startButtons}</div>}
            {proposing && (
              <ProposeNight
                auth={auth}
                onDone={async () => { setProposing(false); await reload(); }}
                onCancel={() => setProposing(false)}
              />
            )}
          </section>

          {split && (split.receipt || split.went) && (
            <CrewMoneyCard kind="after" split={split} auth={auth} onChange={setSplit} />
          )}
          {pastAddOns.map((x) => (
            <CrewAddOnCard key={x.cycleId} addOn={x} auth={auth} onChange={(next) => setAddOn(x.cycleId, next)} />
          ))}

          {me.needsPace && !paceDone && !crew.oneTime && (
            <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <label htmlFor="first-pace" className="block font-fm-serif text-[26px] leading-tight">How often for you?</label>
              <p className="mb-0 mt-2 text-[14px] leading-relaxed text-fm-ink-2">
                The crew goes out {cadenceLabel(crew).toLowerCase()}. Slower works too: Leaf only asks you on your pace.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  id="first-pace"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm"
                >
                  <option value="">Same as the crew ({cadenceLabel(crew).toLowerCase()})</option>
                  {Object.entries(RHYTHM_LABELS)
                    .filter(([d]) => Number(d) >= crew.rhythmDays)
                    .filter(([d]) => Number(d) !== crew.rhythmDays)
                    .map(([d, l]) => (
                      <option key={d} value={d}>{l}</option>
                    ))}
                </select>
                <Button
                  small
                  disabled={busy !== null}
                  onClick={() => act("pace", async () => { await run("setCrewPace", auth, { weeks: pace ? Number(pace) / 7 : null }); setPaceDone(true); })}
                >
                  {busy === "pace" ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="mb-0 mt-2 text-xs text-fm-muted">You can change it any time in your settings.</p>
            </section>
          )}

          {fixedPlace ? (
            <section className="flex flex-col gap-2 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <Eyebrow>Where</Eyebrow>
              <div className="font-fm-serif text-[28px] leading-tight">{fixedPlace.label}</div>
              {fixedPlace.address && <p className="m-0 text-sm text-fm-muted">{fixedPlace.address}</p>}
              <p className="m-0 text-xs text-fm-muted">Every night is here. Leaf just finds the date.</p>
            </section>
          ) : (
            <section className="flex flex-col gap-3.5 lg:gap-5">
              <div className="flex items-center justify-between">
                <SectionTitle>The book</SectionTitle>
                <Link href={crewHref(auth, "book")} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-fm-ink hover:text-white">
                  <Plus size={16} strokeWidth={2.2} aria-hidden /> Add<span className="hidden lg:inline"> a place</span>
                </Link>
              </div>
              {book.length === 0 ? (
                <Link
                  href={crewHref(auth, "book")}
                  className="flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-fm-line p-6 hover:border-fm-ink-2 lg:flex-row lg:items-center lg:justify-between lg:p-8"
                >
                  <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-fm-ink-2 lg:text-base">
                    No places yet. Add a few you&rsquo;ve been wanting to try and Leaf will plan nights around them.
                  </p>
                  <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-fm-ink px-5 text-sm font-semibold text-fm-canvas">
                    <Plus size={16} strokeWidth={2.2} aria-hidden /> Add a place
                  </span>
                </Link>
              ) : (
                <ul className="no-scrollbar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 scroll-pl-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0">
                  {book.map((s) => (
                    <li key={s.spotId} className="flex w-[148px] shrink-0 snap-start flex-col gap-2 lg:w-auto lg:gap-2.5 lg:[&:nth-child(n+5)]:hidden">
                     <a href={spotHref(s, inApp)} target={inApp ? undefined : "_blank"} rel="noreferrer" className="flex flex-col gap-2 lg:gap-2.5">
                      <div className="relative h-[148px] overflow-hidden rounded-[20px] border border-fm-line bg-fm-card lg:h-[168px] lg:rounded-[22px]">
                        <PlacePhoto
                          src={s.photo || s.plan?.imageUrl}
                          locationId={s.locationId}
                          fallback={<span aria-hidden className="absolute bottom-2.5 left-3 font-fm-serif text-[44px] leading-[0.8] text-fm-line lg:text-[52px]">{s.name.charAt(0)}</span>}
                        />
                        <span className="absolute bottom-2.5 right-2.5 flex h-[26px] items-center gap-1 rounded-full bg-fm-canvas px-2.5 text-xs font-semibold">
                          <ChevronUp size={13} strokeWidth={2.6} aria-hidden /> {s.upvotes}
                          <span className="sr-only"> want to go</span>
                        </span>
                      </div>
                      <div>
                        <div className="truncate text-[15px] font-semibold lg:text-base">{s.name}</div>
                        <div className="truncate text-[13px] text-fm-muted">{s.plan?.title || [s.neighborhood, s.triedAt ? "tried" : null].filter(Boolean).join(" · ") || s.category}</div>
                      </div>
                     </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2.5 lg:max-w-[640px] lg:gap-3">
            <SectionTitle>Tell Leaf</SectionTitle>
            <p className="m-0 text-sm text-fm-muted">
              Days that never work, places to avoid, anything. Only Leaf reads what you write; the crew sees the topics below with counts, never who said what.
            </p>
            {pills.length > 0 && me.status === "in" && (
              <div className="flex flex-wrap gap-2" aria-label="What the crew has told Leaf">
                {(allPills ? pills : pills.slice(0, 6)).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.mine}
                    disabled={busy !== null}
                    title={p.mine ? "Tap to take back your +1" : "Tap to +1"}
                    onClick={() => act("pill", () => run("toggleCrewPrefPill", auth, { pillId: p.id, on: !p.mine }))}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition disabled:opacity-60 ${
                      p.mine ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink hover:border-fm-ink-2"
                    }`}
                  >
                    {p.mine && <Check size={14} strokeWidth={2.4} aria-hidden />}
                    <span>{p.label}</span>
                    <span className={p.mine ? "font-semibold" : "text-fm-muted"}>{p.count}</span>
                  </button>
                ))}
                {!allPills && pills.length > 6 && (
                  <button type="button" onClick={() => setAllPills(true)} className="inline-flex min-h-10 items-center rounded-full border border-fm-line px-3.5 text-sm text-fm-ink hover:border-fm-ink-2">
                    +{pills.length - 6}
                  </button>
                )}
              </div>
            )}
            {noteSent ? (
              <p className="m-0 flex items-center gap-1.5 text-sm text-fm-ink-2"><Check size={16} aria-hidden /> {noteSent}</p>
            ) : (
              <form
                className="flex h-14 items-center gap-2 rounded-full border border-fm-line bg-fm-surface pl-[18px] pr-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  act("note", async () => {
                    const r = await run<TellLeafResult>("crewTellLeaf", auth, { text: note });
                    // Read the days back: it's the only way someone catches
                    // Leaf reading "Thursdays mostly" the wrong way round.
                    setNoteSent(tellLeafReceipt(r));
                  });
                }}
              >
                <label htmlFor="tell-leaf" className="sr-only">Message to Leaf</label>
                <input
                  id="tell-leaf"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Mondays never work for me"
                  className="min-w-0 flex-1 border-0 !bg-transparent text-[15px] text-fm-ink outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send to Leaf"
                  disabled={busy !== null || !note.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fm-ink text-fm-canvas disabled:opacity-40"
                >
                  <ArrowUp size={18} strokeWidth={2.2} aria-hidden />
                </button>
              </form>
            )}
          </section>

          {/* Always there: a new crew sees it warming up. */}
          <CrewPulseCard
            pulse={data.pulse && data.pulse.score == null ? { ...data.pulse, bandLabel: "Warming up" } : (data.pulse || EMPTY_PULSE)}
            crewName={crew.name}
            shareToken={me.token || null}
          />

          {me.needsSeed && !seedDone && (
            <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <SeedPlaces
                auth={auth}
                crewName={crew.name}
                heading="Where would you go?"
                onDone={() => { setSeedDone(true); void reload(); }}
              />
            </section>
          )}

          {past.length > 0 && (
            <section>
              <SectionTitle>Past nights</SectionTitle>
              <ul className="mt-1.5 divide-y divide-fm-line-dim">
                {past.map((p) => {
                  const d = toDate(p.startsAt);
                  return (
                    <li key={p.cycleId} className="flex items-center gap-4 py-3.5">
                      <Mono className="w-14 shrink-0 text-xs text-fm-muted">{d ? d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : ""}</Mono>
                      <span className="min-w-0 flex-1 truncate text-base font-medium">{p.venue?.name || "A night out"}</span>
                      <span className="text-[13px] text-fm-muted">{p.headcount} went</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

        </div>

        {/* Members (desktop). Personal settings live in the Settings pop-up. */}
        <div className="mt-10 lg:col-start-1 lg:row-start-2 lg:mt-8 lg:self-start">
          <div className="hidden lg:block">
            <Eyebrow>Members</Eyebrow>
            {/* Two columns so a big crew doesn't push settings below the fold. */}
            <ul className="mt-1.5 grid grid-cols-2 gap-x-6">
              {joined.map((m) => (
                <MemberRow key={m.membershipId} m={m} note={m.userId === crew.ownerId ? "Started it" : m.membershipId === me.membershipId ? "You" : undefined} />
              ))}
              {/* Invited reads from the dashed avatar; no label, so names get the room. */}
              {invited.map((m) => <MemberRow key={m.membershipId} m={m} />)}
            </ul>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setInviteOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Invite to ${crew.name}`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-fm-line bg-fm-surface px-5 pb-5 pt-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Invite to {crew.name}</div>
                <div className="text-[13px] text-fm-muted">Nobody joins until they say yes.</div>
              </div>
              <button type="button" aria-label="Close" className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fm-card text-fm-ink hover:bg-fm-line" onClick={() => setInviteOpen(false)}><X size={20} strokeWidth={2.2} aria-hidden /></button>
            </div>

            {inApp && (
              <a
                href={`leaf://crew-invite/${crew.id}`}
                className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-fm-line px-4 text-[15px] font-semibold text-fm-ink"
              >
                Choose from contacts
              </a>
            )}

            {hasFollowers && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <Eyebrow>Your followers not in yet</Eyebrow>
                  {invitable && invitable.length > 0 && (
                    <button
                      className="text-xs text-fm-ink underline underline-offset-4"
                      onClick={() => setInvitePicked(invitePicked.size === invitable.length ? new Set() : new Set(invitable.map((p) => p.userId)))}
                    >
                      {invitePicked.size === invitable.length ? "Clear" : "Select all"}
                    </button>
                  )}
                </div>
                {invitable === null ? (
                  <p className="mt-2 text-sm text-fm-muted">Loading…</p>
                ) : invitable.length === 0 ? (
                  <p className="mt-2 text-sm text-fm-muted">All your followers are in, or were invited in the last two weeks.</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1.5">
                      {invitable.map((p) => {
                        const sel = invitePicked.has(p.userId);
                        return (
                          <li key={p.userId}>
                            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-fm-line px-3 py-2 ${sel ? "bg-fm-card" : ""}`}>
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => { const n = new Set(invitePicked); if (sel) n.delete(p.userId); else n.add(p.userId); setInvitePicked(n); }}
                              />
                              <span className="flex-1 text-[15px]">{p.name}</span>
                              {p.pending && <span className="text-[11px] text-fm-muted">invited before · no answer</span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3">
                      <Button
                        small
                        disabled={busy !== null || invitePicked.size === 0}
                        onClick={() => act("invite", async () => {
                          const r = await run<{ invited: number }>("inviteCrewMembers", auth, { userIds: [...invitePicked] });
                          setInviteNote(`${r.invited} ${r.invited === 1 ? "person was" : "people were"} invited.`);
                          setInvitable((l) => (l || []).filter((p) => !invitePicked.has(p.userId)));
                          setInvitePicked(new Set());
                        })}
                      >
                        Invite {invitePicked.size || ""}
                      </Button>
                    </div>
                  </>
                )}
                {inviteNote && <p className="mt-2 text-sm text-fm-ink-2">{inviteNote}</p>}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-fm-line p-4">
              <div className="text-[15px] font-semibold">{hasFollowers || inApp ? "Or share the invite link" : "Share the invite link"}</div>
              <p className="mt-1 text-[13px] text-fm-muted">Send it from your phone to anyone you want in. They join with one tap.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button small onClick={shareInviteLink}>{linkDone || "Share the link"}</Button>
                <span className="min-w-0 truncate text-xs text-fm-muted">{me.inviteLink}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setSettingsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your settings"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-fm-line bg-fm-surface px-5 pb-5 pt-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Your settings</div>
                <div className="text-[13px] text-fm-muted">{crew.name} · only you see these</div>
              </div>
              <button type="button" aria-label="Close" className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fm-card text-fm-ink hover:bg-fm-line" onClick={() => setSettingsOpen(false)}><X size={20} strokeWidth={2.2} aria-hidden /></button>
            </div>

            <div className="mt-2 divide-y divide-fm-line-dim">
              {me.status === "in" && (
                <div className="py-4">
                  <div className="text-[15px] font-semibold">Texts about this crew</div>
                  <div className="text-[13px] text-fm-muted">
                    {me.smsOptIn ? `On${me.phoneLast4 ? ` · number ending ${me.phoneLast4}` : ""}` : "Off · you get these in the app or on this page"}
                  </div>
                  {me.smsOptIn ? (
                    <div className="mt-3">
                      <Button kind="ghost" small disabled={busy !== null} onClick={() => act("texts", () => run("setCrewTexts", auth, { on: false }))}>
                        Turn off texts
                      </Button>
                    </div>
                  ) : (
                    <>
                      <SmsOptInBox checked={smsBox} onChange={setSmsBox} phone={smsPhone} onPhone={setSmsPhone} last4={me.phoneLast4 ?? null} />
                      <div className="mt-3">
                        <Button small onClick={() => act("texts", () => run("setCrewTexts", auth, { on: true, phone: smsPhone || null }))} disabled={busy !== null || !smsBox || !phoneOk}>
                          Turn on texts
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {me.status === "in" && signedIn && (
              <div className="flex items-center gap-3.5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">Your calendar</div>
                  <div className="text-[13px] text-fm-muted">{me.calendarSynced ? "Synced · Leaf offers nights you're free" : "Sync Google Calendar and Leaf offers nights you're free"}</div>
                </div>
                {!me.calendarSynced && (
                  <Button
                    small
                    disabled={busy !== null}
                    onClick={() => act("gcal", async () => {
                      const r = (await Parse.Cloud.run("createGoogleCalendarConnectUrl", { returnTo: window.location.href })) as { url: string };
                      window.location.href = r.url;
                    })}
                  >
                    Connect
                  </Button>
                )}
              </div>
              )}

              {me.isOwner && (
                <div className="border-b border-fm-line-dim py-4">
                  <label htmlFor="crew-rhythm" className="block text-[15px] font-semibold">How often the crew goes out</label>
                  <select
                    id="crew-rhythm"
                    value={crew.oneTime ? "0" : String(crew.rhythmDays)}
                    disabled={busy !== null}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      act("rhythm", () => run("setCrewRhythm", auth, days === 0 ? { calendarId: crew.id, oneTime: true } : { calendarId: crew.id, rhythmDays: days }));
                    }}
                    className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                  >
                    {Object.entries(RHYTHM_LABELS).map(([d, l]) => (
                      <option key={d} value={d}>{l}</option>
                    ))}
                    <option value="0">Just once</option>
                  </select>
                  <p className="mb-0 mt-2 text-xs text-fm-muted">Leaf starts each night on this rhythm. Members can set a slower pace of their own below.</p>
                </div>
              )}

              {me.isOwner && (
                <div className="border-b border-fm-line-dim py-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold">Skip venue rotation</div>
                      <div className="text-[13px] text-fm-muted">Always meet at one place, like a family dinner at home.</div>
                    </div>
                    <FriendModeSwitch
                      label="Skip venue rotation"
                      checked={placeOn}
                      disabled={busy !== null}
                      onChange={(v) => {
                        setPlaceOn(v);
                        // Turning it off takes effect now; turning it on waits for the place.
                        if (!v && crew.placeMode === "fixed") act("place", () => run("setCrewPlaceMode", auth, { calendarId: crew.id, mode: "book" }));
                      }}
                    />
                  </div>
                  {placeOn && (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        value={placeLabel}
                        onChange={(e) => setPlaceLabel(e.target.value)}
                        placeholder="Name it, like Mom's"
                        maxLength={60}
                        aria-label="Place name"
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                      />
                      <input
                        value={placeAddress}
                        onChange={(e) => setPlaceAddress(e.target.value)}
                        placeholder="Address (optional)"
                        maxLength={200}
                        autoComplete="street-address"
                        aria-label="Address"
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                      />
                      <p className="m-0 text-xs text-fm-muted">Only people in the crew see the address.</p>
                      <div>
                        <Button
                          small
                          disabled={busy !== null || !placeLabel.trim()}
                          onClick={() => act("place", () => run("setCrewPlaceMode", auth, { calendarId: crew.id, mode: "fixed", label: placeLabel.trim(), address: placeAddress.trim() }))}
                        >
                          {busy === "place" ? "Saving…" : crew.placeMode === "fixed" ? "Update place" : "Save place"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {me.isOwner && (
                <div className="flex items-center gap-3 border-b border-fm-line-dim py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">Rotate who hosts</div>
                    <div className="text-[13px] text-fm-muted">Each night Leaf plans goes to the next person in the crew, you first.</div>
                  </div>
                  <FriendModeSwitch
                    label="Rotate who hosts"
                    checked={Boolean(crew.hostRotation)}
                    disabled={busy !== null}
                    onChange={(v) => act("rotation", () => run("setCrewHostRotation", auth, { calendarId: crew.id, enabled: v }))}
                  />
                </div>
              )}

              <div className="py-4">
                <label htmlFor="my-pace" className="block text-[15px] font-semibold">Your pace</label>
                <select
                  id="my-pace"
                  value={pace}
                  disabled={busy !== null}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPace(v);
                    act("pace", () => run("setCrewPace", auth, { weeks: v ? Number(v) / 7 : null }));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                >
                  <option value="">Same as the crew ({cadenceLabel(crew).toLowerCase()})</option>
                  {/* Only slower: Leaf runs rounds at the crew's pace, so a faster one would never happen. */}
                  {Object.entries(RHYTHM_LABELS)
                    .filter(([d]) => Number(d) > crew.rhythmDays)
                    .map(([d, l]) => (
                      <option key={d} value={d}>{l}</option>
                    ))}
                </select>
                <p className="mb-0 mt-2 text-xs text-fm-muted">Slower than the crew? Leaf only asks you on your pace.</p>
              </div>

              <div className="flex flex-wrap gap-1 pt-3">
                {crew.status === "active" ? (
                  <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-muted hover:bg-fm-card" onClick={() => act("pause", () => run("setCrewPaused", auth, { paused: true }))}>
                    Pause the crew
                  </button>
                ) : (
                  <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-ink hover:bg-fm-card" onClick={() => act("resume", () => run("setCrewPaused", auth, { paused: false }))}>
                    Resume the crew
                  </button>
                )}
                {/* Confirm in-page: window.confirm() is silently false inside the app's web view. */}
                {confirmLeave ? (
                  <>
                    <button className="h-11 rounded-full bg-fm-danger px-4 text-sm font-semibold text-fm-canvas" disabled={busy !== null} onClick={() => act("leave", async () => { await run("leaveCrew", auth); window.location.reload(); })}>
                      Yes, leave {crew.name}
                    </button>
                    <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-ink-2 hover:bg-fm-card" onClick={() => setConfirmLeave(false)}>
                      Stay
                    </button>
                  </>
                ) : (
                  <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-danger hover:bg-fm-card" onClick={() => setConfirmLeave(true)}>
                    Leave
                  </button>
                )}
              </div>
              {confirmLeave && <p className="mb-0 mt-1 text-xs text-fm-muted">Leaf will stop texting you about this crew.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Everyone here has other groups: the way to start one for them. In the
          app, the /friends link opens its own Start a crew screen. Not inside
          the dashboard, which has Start a crew in its sidebar. */}
      {!embedded && (
        <section className="mt-16 flex flex-col items-center gap-3 border-t border-fm-line-dim pt-10 text-center lg:mt-20">
          <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-tight lg:text-[36px]">Got another group you never see enough?</h2>
          <p className="m-0 max-w-md text-[15px] text-fm-ink-2">Start a crew for them. Leaf finds the nights that work and keeps them coming.</p>
          <a
            href="/friends#start"
            className="mt-2 inline-flex h-12 items-center rounded-full bg-fm-accent px-7 text-[15px] font-bold text-fm-canvas"
          >
            Start your own crew
          </a>
        </section>
      )}
    </CrewShell>
  );
}

function MemberRow({ m, note }: { m: Member; note?: string }) {
  const inv = m.status === "invited";
  return (
    <li className="flex items-center gap-3 border-b border-fm-line-dim py-2.5">
      <Avatar name={m.name} src={m.avatar} invited={inv} />
      <span className={`min-w-0 flex-1 truncate text-[15px] ${inv ? "text-fm-muted" : "font-medium"}`}>{m.name}</span>
      {note && <span className="text-xs text-fm-muted">{note}</span>}
    </li>
  );
}

function CycleCard({
  cycle: c, names, members, busy, onAct, auth, quorum, joined, calendarSynced, onConnectCalendar, hostRotation = false, isOwner = false, canSkip = false, crewId = "",
}: {
  cycle: CycleView;
  names: Record<string, string>;
  members: Member[];
  busy: string | null;
  onAct: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  auth: CrewAuth;
  quorum: number;
  joined: number;
  /** The member's Google Calendar is connected (Leaf pre-ticks their free nights). */
  calendarSynced: boolean;
  onConnectCalendar: () => void;
  /** Host rotation is on: say whose turn this night is. */
  hostRotation?: boolean;
  /** The crew's owner: may answer a combine offer like the round's host. */
  isOwner?: boolean;
  /** The organizer of a recurring crew: may skip a round being planned. */
  canSkip?: boolean;
  crewId?: string;
}) {
  const inApp = useInApp();
  // Not voted yet: start from the dates their calendar says they're free.
  // Nothing pre-ticked: Leaf already picked these dates around everyone's
  // calendars, so a tap here is a preference, and it saves by itself.
  const [picked, setPicked] = useState<Set<number>>(new Set(c.myVotes ?? []));
  const [voteState, setVoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVotes = (next: Set<number>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // A short pause so a few quick taps save once.
    saveTimer.current = setTimeout(async () => {
      setVoteState("saving");
      try {
        await run("crewVote", auth, { cycleId: c.cycleId, options: [...next] });
        setVoteState("saved");
        setTimeout(() => setVoteState((v) => (v === "saved" ? "idle" : v)), 2200);
      } catch {
        setVoteState("error");
      }
    }, 700);
  };
  const toggleDate = (i: number) => {
    const n = new Set(picked);
    if (n.has(i)) n.delete(i); else n.add(i);
    setPicked(n);
    saveVotes(n);
  };
  const goingIds = Object.entries(c.rsvps).filter(([, r]) => r === "in").map(([id]) => id);
  const going = goingIds.map((id) => names[id] || "Someone");
  const closes = toDate(c.pollClosesAt);
  const settled = c.state === "locked" || c.state === "booked";
  // Asked on the page itself: the app's web view has no confirm() dialog.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const stateWord = { picking: "Picking", polling: "Voting", locked: "Locked in", booked: "Booked" }[c.state as string];
  const who = c.trigger === "member_proposal" ? `${names[c.hostId || ""] || "A member"}'s idea` : "Up next";
  const chosen = c.chosenOption ? dayParts(c.chosenOption.date) : null;

  return (
    <Card className="flex flex-col gap-4 lg:gap-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{stateWord ? `${who} · ${stateWord}` : who}</Eyebrow>
        {c.state === "polling" && closes && (
          <span className="text-xs text-fm-muted lg:text-[13px]">Closes {closes.toLocaleDateString("en-US", { weekday: "short", hour: "numeric" })}</span>
        )}
      </div>

      <div className="flex items-start gap-4 lg:gap-[18px]">
        {settled && chosen && (
          <div className="flex h-[72px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-fm-line bg-fm-card lg:h-[84px] lg:w-[76px] lg:rounded-[18px]">
            <Mono className="text-[10px] text-fm-muted lg:text-[11px]">{chosen.month}</Mono>
            <span className="font-fm-serif text-[32px] leading-none lg:text-[38px]">{chosen.day}</span>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          {c.eventWindow?.title && (
            <Mono className="text-fm-accent">{c.eventWindow.kind === "movie" ? "Movie" : "Event"} · {c.eventWindow.title}</Mono>
          )}
          {settled && c.planId ? (
            // A set night is a plan: its title opens it (the app opens it natively).
            <a href={`/p/${c.planId}${c.myInviteId ? `?n=${c.myInviteId}` : ""}`} className="w-fit hover:underline decoration-fm-line underline-offset-4">
              <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name || "Your night"}</h2>
            </a>
          ) : (
            <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name || "Picking a place…"}</h2>
          )}
          <p className="m-0 text-sm text-fm-muted">
            {settled && c.chosenOption
              ? [chosen?.dow, timeLabel(c.chosenOption.time), c.venue?.address].filter(Boolean).join(" · ")
              : c.venue?.address || cycleStatusLine(c, names)}
          </p>
          {settled && c.chosenOption && c.showtimes?.[c.chosenOption.date]?.bookingUrl && (
            <a href={c.showtimes[c.chosenOption.date].bookingUrl!} target="_blank" rel="noreferrer" className="w-fit text-sm font-semibold text-fm-ink underline underline-offset-4">
              Get tickets for the {timeLabel(c.showtimes[c.chosenOption.date].time)} showing
            </a>
          )}
          {hostRotation && c.hostId && (
            <p className="m-0 text-sm text-fm-ink-2">{c.isHost ? "You're hosting this one" : `${names[c.hostId] || "Someone"} is hosting`}</p>
          )}
        </div>
      </div>

      {c.invited === false && (
        <p className="m-0 text-xs text-fm-muted">You&rsquo;re sitting this one out (your pace). Answer here anyway if you want in.</p>
      )}

      {c.state === "picking" && (
        <p className="m-0 text-[15px] text-fm-ink-2">
          {c.waitingForQuorum
            ? `${joined} of ${quorum} needed have joined. Leaf starts planning as soon as the rest say IN.`
            : c.placeSuggestion || !isOwner
              ? "Waiting on a place. Once it's in the book, Leaf finds dates that work for everyone."
              : "Leaf is picking a place. You'll get the dates to vote on next."}
        </p>
      )}

      {c.state === "picking" && c.placeSuggestion && (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-fm-line px-4 py-3.5">
          <p className="m-0 min-w-0 flex-1 text-sm leading-snug text-fm-ink">
            {c.placeSuggestion.why === "history" ? `Back to ${c.placeSuggestion.name}, like last time?` : `How about ${c.placeSuggestion.name}?`}
            {c.placeSuggestion.address && <span className="block text-xs text-fm-muted">{c.placeSuggestion.address}</span>}
          </p>
          <Button
            small
            disabled={busy !== null}
            onClick={() => onAct("addSuggested", () => run("addToCrewBook", auth, c.placeSuggestion!.locationId
              ? { locationId: c.placeSuggestion!.locationId }
              : { placeId: c.placeSuggestion!.placeId, venue: { name: c.placeSuggestion!.name, address: c.placeSuggestion!.address, lat: c.placeSuggestion!.lat, lng: c.placeSuggestion!.lng, placeId: c.placeSuggestion!.placeId } }))}
          >
            {busy === "addSuggested" ? "Adding…" : "Add it"}
          </Button>
          <Link href={crewHref(auth, "book")} className="text-sm text-fm-muted underline underline-offset-4">Somewhere else</Link>
        </div>
      )}

      {c.state === "polling" && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="m-0 text-[15px] text-fm-ink-2">
              {calendarSynced ? "Picked around everyone's calendars. Tap any you'd go to." : "Which nights work? Tap any you'd go to."}
            </p>
            <span role="status" aria-live="polite" className={`shrink-0 text-xs ${voteState === "error" ? "text-fm-danger" : "text-fm-muted"}`}>
              {voteState === "saving" ? "Saving…" : voteState === "saved" ? "Saved ✓" : voteState === "error" ? "Didn't save — tap again" : ""}
            </span>
          </div>
          {!calendarSynced && (
            <div className="flex items-center gap-3 rounded-2xl border border-fm-line-dim px-3.5 py-2.5">
              <p className="m-0 min-w-0 flex-1 text-[13px] leading-snug text-fm-ink-2">Connect Google Calendar and Leaf ticks the nights you&rsquo;re free.</p>
              <button
                type="button"
                onClick={onConnectCalendar}
                disabled={busy !== null}
                className="h-9 shrink-0 rounded-full border border-fm-line px-3.5 text-[13px] font-semibold text-fm-ink hover:bg-fm-card disabled:opacity-50"
              >
                Connect
              </button>
            </div>
          )}
          {c.combineOffer && (c.isHost || isOwner) && (
            <div className="flex flex-col gap-3 rounded-[18px] border border-fm-line bg-fm-card p-4">
              <p className="m-0 text-[15px] leading-snug text-fm-ink">
                {c.combineOffer.crewName} is already set for{" "}
                {c.options[c.combineOffer.optionIndex] ? `${dayParts(c.options[c.combineOffer.optionIndex].date).dow} ${dayParts(c.options[c.combineOffer.optionIndex].date).month} ${dayParts(c.options[c.combineOffer.optionIndex].date).day}` : "one of these nights"}
                {c.combineOffer.venue ? ` at ${c.combineOffer.venue}` : ""}, with some of the same people. Combine them into one night?
              </p>
              <p className="m-0 text-[13px] text-fm-muted">Combine invites everyone here to that night and skips this round. Keep separate drops that date from this poll.</p>
              <div className="flex flex-wrap gap-2">
                <Button small disabled={busy !== null} onClick={() => onAct("combine", () => run("resolveCrewClash", auth, { cycleId: c.cycleId, choice: "combine" }))}>
                  {busy === "combine" ? "Combining…" : "Combine"}
                </Button>
                <Button small kind="ghost" disabled={busy !== null} onClick={() => onAct("combine", () => run("resolveCrewClash", auth, { cycleId: c.cycleId, choice: "separate" }))}>
                  Keep separate
                </Button>
              </div>
            </div>
          )}
          <ul className="grid grid-cols-3 gap-2 lg:gap-2.5">
            {c.options.map((o, i) => {
              const clash = c.clashes?.[String(i)];
              const p = dayParts(o.date);
              const on = picked.has(i);
              const baseCount = c.votes ? Object.values(c.votes).filter((v) => v.includes(i)).length : 0;
              // The count including this member's own taps, saved or not.
              const count = baseCount - (c.myVotes?.includes(i) ? 1 : 0) + (on ? 1 : 0);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDate(i)}
                    className={`flex min-h-[116px] w-full flex-col items-start justify-between gap-1 rounded-[18px] border p-3 text-left transition lg:min-h-[124px] lg:rounded-[20px] lg:p-3.5 ${
                      on ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line bg-fm-canvas text-fm-ink hover:border-fm-ink-2"
                    }`}
                  >
                    <Mono className={`whitespace-nowrap ${on ? "" : "text-fm-muted"}`}>{p.dow}{o.time ? ` ${timeLabel(o.time)}` : ""}</Mono>
                    <span className="font-fm-serif text-[34px] leading-none lg:text-[38px]">{p.month} {p.day}</span>
                    <span className={`text-xs ${on ? "font-semibold" : "text-fm-muted"}`}>
                      {count} can
                      {c.fit?.[i] && c.fit[i].known > 0 ? ` · ${c.fit[i].free} of ${c.fit[i].known} free` : ""}
                      {clash && <span className={`mt-0.5 block truncate ${on ? "" : "text-fm-danger"}`}>Clashes with {clash.crewName}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {picked.size === 0 && (
            <button
              type="button"
              className="w-fit text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink"
              onClick={() => { setPicked(new Set()); saveVotes(new Set()); }}
            >
              {c.myVotes !== null && c.myVotes.length === 0 ? "You said none of these work" : "None of these work for me"}
            </button>
          )}
        </>
      )}

      {canSkip && (c.state === "polling" || c.state === "picking") && (
        confirmSkip ? (
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-fm-line px-4 py-3.5">
            <p className="m-0 text-sm leading-snug text-fm-ink">{"Skip this round? Leaf tells the crew and picks it back up next time."}</p>
            <div className="flex flex-wrap gap-2">
              <Button small disabled={busy !== null} onClick={() => onAct("skip", () => run("skipCrewRound", auth, { calendarId: crewId }))}>
                {busy === "skip" ? "Skipping…" : "Yes, skip it"}
              </Button>
              <Button small kind="ghost" disabled={busy !== null} onClick={() => setConfirmSkip(false)}>Keep it</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmSkip(true)} className="min-h-11 w-fit text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink">
            Skip this one
          </button>
        )
      )}
      {settled && (
        <>
          <div className="flex items-center gap-2.5">
            {goingIds.length > 0 && (
              <div className="flex">
                {goingIds.slice(0, 4).map((id, i) => {
                  const m = members.find((x) => x.userId === id);
                  return (
                    <span key={id} className={i ? "-ml-2" : ""}>
                      <Avatar name={names[id] || "?"} src={m?.avatar} size={28} ring="ring-2 ring-fm-surface" />
                    </span>
                  );
                })}
              </div>
            )}
            <span className="text-sm text-fm-ink-2">{going.length ? `${going.join(", ")} going` : "Nobody's said IN yet"}</span>
          </div>

          <div role="group" aria-label="Your RSVP" className="grid grid-cols-2 gap-1 rounded-full border border-fm-line-dim bg-fm-canvas p-1">
            {([["in", "I'm in", true],["out", c.myRsvp === "out" ? "You're out" : "Can't make it", false]] as const).map(([key, label, goingVal]) => {
              const on = c.myRsvp === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  disabled={busy !== null}
                  onClick={() => onAct(key, () => run("crewRsvp", auth, { cycleId: c.cycleId, going: goingVal }))}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-[15px] transition disabled:opacity-60 ${
                    on ? "bg-fm-ink font-semibold text-fm-canvas" : "font-medium text-fm-ink-2 hover:text-fm-ink"
                  }`}
                >
                  {on && key === "in" && <Check size={16} strokeWidth={2.4} aria-hidden />}
                  {label}
                </button>
              );
            })}
          </div>

          {c.isHost && c.state === "locked" && !c.venue?.fixed && !c.noBookingNeeded && (
            <div className="flex flex-col gap-3 rounded-[18px] bg-fm-card px-4 py-3.5">
              <p className="m-0 text-sm leading-snug text-fm-ink-2">You&rsquo;re booking this one. Tap when it&rsquo;s done and Leaf tells everyone.</p>
              <div className="flex flex-wrap gap-2">
                <Button kind="ghost" small disabled={busy !== null} onClick={() => onAct("booked", () => run("markCrewBooked", auth, { cycleId: c.cycleId }))}>
                  Booked
                </Button>
                <Button kind="ghost" small disabled={busy !== null} onClick={() => onAct("nobook", () => run("markCrewNoBooking", auth, { cycleId: c.cycleId }))}>
                  No booking needed
                </Button>
              </div>
            </div>
          )}
          {c.isHost && c.state === "locked" && c.noBookingNeeded && (
            <p className="m-0 text-sm text-fm-muted">No booking needed. Leaf won&rsquo;t remind you about it.</p>
          )}
          {c.state === "booked" && (
            <p className="m-0 flex items-center gap-1.5 text-sm text-fm-ink-2"><Check size={16} aria-hidden /> Booked</p>
          )}
          {c.myInviteId && (
            // The plan's own chat, same link Leaf texts: the app opens it
            // natively; on the web it offers the app (or the web chat if signed in).
            <a
              href={`/c/${c.myInviteId}${inApp ? "?inapp=1" : ""}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-fm-line text-[15px] font-semibold text-fm-ink hover:bg-fm-card"
            >
              <MessageCircle size={17} aria-hidden /> Chat with the group
            </a>
          )}
          {(c.isHost || isOwner) && (
            confirmCancel ? (
              <div className="flex flex-col gap-2.5 rounded-[18px] border border-fm-line px-4 py-3.5">
                <p className="m-0 text-sm leading-snug text-fm-ink">
                  {`Cancel ${chosen ? `${chosen.dow} ${chosen.month} ${chosen.day}` : "this night"} for everyone? Leaf tells the people invited it\u2019s off.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button small disabled={busy !== null} onClick={() => onAct("cancelNight", () => run("cancelCrewNight", auth, { cycleId: c.cycleId }))}>
                    {busy === "cancelNight" ? "Cancelling…" : "Yes, cancel it"}
                  </Button>
                  <Button small kind="ghost" disabled={busy !== null} onClick={() => setConfirmCancel(false)}>Keep it</Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="min-h-11 w-fit text-sm text-fm-muted underline underline-offset-4 hover:text-fm-danger"
              >
                Cancel this night
              </button>
            )
          )}
        </>
      )}
      {c.state === "polling" && (c.isHost || isOwner) && !c.venue?.fixed && (
        <ChangePlace cycle={c} auth={auth} busy={busy} onAct={onAct} />
      )}
    </Card>
  );
}

/**
 * Organizer or this round's host, while it's voting: switch the place to
 * another one in the book. Dates and votes stay; Leaf tells the crew. When
 * someone added a place before anyone voted, it's offered first.
 */
function ChangePlace({ cycle: c, auth, busy, onAct }: { cycle: CycleView; auth: CrewAuth; busy: string | null; onAct: (key: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<BookSpot[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const change = async (spotId: string) => {
    setPicked(spotId);
    await onAct("changePlace", () => run("changeCrewPlace", auth, { cycleId: c.cycleId, spotId }));
    // The card reloads with the new place; start fresh next time.
    setPicked(null);
    setOpen(false);
    setBook(null);
  };
  const show = async () => {
    setOpen(true);
    if (!book) {
      const r = await run<{ shared: BookSpot[] }>("getCrewBook", auth).catch(() => ({ shared: [] as BookSpot[] }));
      setBook(r.shared.filter((b) => !b.eventPassed));
    }
  };
  // Never offer the place it's already at.
  const choices = (book || []).filter((b) => b.name !== c.venue?.name);
  return (
    <div className="flex flex-col gap-2.5">
      {c.swapOffer && (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-fm-line px-4 py-3.5">
          <p className="m-0 min-w-0 flex-1 text-sm text-fm-ink">{c.swapOffer.name} was just added. Nobody has voted yet. Use it instead?</p>
          <Button small disabled={busy !== null} onClick={() => void change(c.swapOffer!.spotId)}>{busy === "changePlace" ? "Switching…" : `Use ${c.swapOffer.name}`}</Button>
        </div>
      )}
      {!open ? (
        <div><Button small kind="ghost" onClick={() => void show()}>Change the place</Button></div>
      ) : (
        <div className="flex flex-col gap-2 rounded-[18px] border border-fm-line p-3">
          <Mono className="px-1 text-fm-muted">Pick from the book · same dates</Mono>
          {!book ? (
            <p className="m-0 px-1 text-sm text-fm-muted">Loading the book…</p>
          ) : choices.length === 0 ? (
            <p className="m-0 px-1 text-sm text-fm-muted">Nothing else in the book yet. <Link href={crewHref(auth, "book")} className="underline">Add a place</Link></p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {choices.map((b) => (
                <li key={b.spotId} className="flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] text-fm-ink">{b.name}</span>
                    {(b.neighborhood || b.category) && <span className="truncate text-xs text-fm-muted">{b.neighborhood || b.category}</span>}
                  </span>
                  <Button small disabled={busy !== null} onClick={() => void change(b.spotId)}>
                    {picked === b.spotId ? "Switching…" : "Use this"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-fit px-1 text-sm text-fm-muted underline underline-offset-4">Never mind</button>
        </div>
      )}
    </div>
  );
}

/**
 * The one text-message opt-in, with the number it applies to on the same
 * form (10DLC). Starts unticked; joining never requires it. The number on
 * file is shown only by its last 4 digits (this page's link can be shared);
 * typing one replaces it for this crew's texts.
 */
function SmsOptInBox({ checked, onChange, phone, onPhone, last4 }: {
  checked: boolean; onChange: (v: boolean) => void; phone: string; onPhone: (v: string) => void; last4: string | null;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-fm-line p-3.5 text-[13px] leading-relaxed text-fm-ink-2">
      <label className="flex items-start gap-2.5">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-fm-ink" />
        <span>
          <span className="block font-semibold text-fm-ink">Text me about this crew&rsquo;s plans</span>
          Date polls and the night&rsquo;s details, so you don&rsquo;t have to open the app. Up to 5 msgs/wk. Msg &amp; data rates may apply.
          Reply HELP for help, STOP to opt out.
        </span>
      </label>
      <label className="mt-2.5 block pl-6">
        <span className="block text-xs text-fm-muted">Mobile number</span>
        <input
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder={last4 ? `Number on file ending in ${last4}` : "(555) 555-5555"}
          className="mt-1 h-11 w-full rounded-xl border px-3 text-[14px]"
        />
      </label>
    </div>
  );
}
