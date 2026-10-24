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
import { ArrowUp, CalendarDays, Check, ChevronRight, ChevronUp, Eye, MapPin, MessageCircle, Plus, Search, Settings, UserPlus, X } from "lucide-react";
import VenueSearch from "@/components/VenueSearch";
import Parse from "@/lib/parse-client";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import {
  Avatar, Button, Card, CrewShell, CrewTopBar, DeadState, DisplayTitle, Eyebrow, Mono, SectionTitle, Spinner, useInApp, useCrewEmbedded,
} from "@/components/crew/CrewShell";
import ProposeNight from "@/components/crew/ProposeNight";
import CrewPulseCard from "@/components/crew/CrewPulseCard";
import { EMPTY_PULSE } from "@/lib/crew-pulse";
import CrewMoneyCard from "@/components/crew/CrewMoneyCard";
import CrewAddOnCard from "@/components/crew/CrewAddOnCard";
import FixedPlacePicker from "@/components/crew/FixedPlacePicker";
import ShareFromInstagramHint from "@/components/crew/ShareFromInstagramHint";
import WatchingStrip from "@/components/crew/WatchingStrip";
import { DiscoverRow, HappeningsCards } from "@/components/crew/BookRows";
import SecondStop from "@/components/crew/SecondStop";
import { AddPhotos, CrewPhotosSection, PhotoStrip } from "@/components/crew/CrewPhotos";
import PlacePhoto from "@/components/crew/PlacePhoto";
import PhoneVerificationModal from "@/components/PhoneVerificationModal";
import { FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";
import {
  type EventMatch,
  RHYTHM_LABELS, crewHref, freeShareWords, pctLabel, crewIsEvening, cycleIsEvening, eveningAt, cycleStatusLine, dayParts, rhythmLabel, cadenceLabel, run, spotHref, tellLeafReceipt, timeLabel, toDate,
  type BookSpot, type CrewAuth, type CrewPage, type CycleView, type Member, type TellLeafResult,
  type CrewAddOn, type CrewSplit, type LastNight, type FreeRule,
} from "@/lib/crew";

/**
 * The app's "Choose from contacts" link. It carries who's already in, invited
 * or said no (user ids), so the app opens its picker right away with them
 * marked instead of loading the crew first.
 */
function crewInviteHref(crewId: string, crewName: string, members: Member[], myMembershipId: string) {
  const ids = (status: Member["status"]) => members.filter((m) => m.status === status && m.userId).map((m) => m.userId).join(",");
  const meId = members.find((m) => m.membershipId === myMembershipId)?.userId || "";
  // Slower paces, "userId:days", so the picker can say "In crew · every 2 weeks".
  const pace = members.filter((m) => m.status === "in" && m.userId && m.paceDays).map((m) => `${m.userId}:${m.paceDays}`).join(",");
  const q = new URLSearchParams({ in: ids("in"), invited: ids("invited"), declined: ids("declined"), me: meId, name: crewName, pace });
  return `leaf://crew-invite/${crewId}?${q.toString()}`;
}

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
  const { crew, me, members, names, open, past } = data;
  // The book's rows (newer servers): Places in the carousel, Happenings and
  // Discover under it. Older ones send one list.
  const book = data.bookPlaces ?? data.book;
  const happenings = data.bookHappenings ?? [];
  // Daytime crews (coffee, brunch) aren't "nights": go by the latest round's
  // time, else when the crew usually meets (what members said, or its name).
  const ev = crewIsEvening(data);
  const night = ev ? "night" : "get-together";
  const nights = ev ? "nights" : "get-togethers";
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
  // Whoever started a crew deletes it rather than leaving it.
  const canDelete = me.isOwner && crew.origin === "friends";
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // "It's a go" on an event another crew already has a night for: this crew joined it.
  const [eventNote, setEventNote] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState<string | null>(null);
  const [error, setError] = useState("");
  // "Text me about this crew's plans": never pre-ticked (10DLC).
  const [smsBox, setSmsBox] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Someone who joined by text or in the app never saw the tap-to-add step.
  // Offer it once here, dismissible, above the book it feeds.
  // "How often for you?" — asked once, right after joining.
  const [paceDone, setPaceDone] = useState(false);
  // The invite screen's "How often for you?": "" is the crew's own rhythm.
  const [joinPace, setJoinPace] = useState("");
  // Invite: the owner picks followers not yet invited; anyone in can share the link.
  const [inviteOpen, setInviteOpen] = useState(false);
  // Phones have no member list beside the page: the avatars open one.
  const [membersOpen, setMembersOpen] = useState(false);
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
    const text = `Join our crew on Leaf so we can ${ev ? "plan nights out together" : "get together"}: ${me.inviteLink}`;
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
  // Google or Outlook: Leaf reads either to find when you're free.
  const [calProvider, setCalProvider] = useState<"google" | "outlook">("google");
  const goConnectCalendar = async (provider: "google" | "outlook" = "google") => {
    const fn = provider === "outlook" ? "createOutlookCalendarConnectUrl" : "createGoogleCalendarConnectUrl";
    const r = (await Parse.Cloud.run(fn, { returnTo: window.location.href })) as { url: string };
    window.location.href = r.url;
  };
  const connectCalendar = (provider: "google" | "outlook" = "google") => {
    setCalProvider(provider);
    const current = Parse.User.current();
    if (current && (!me.userId || current.id === me.userId)) {
      void act("gcal", () => goConnectCalendar(provider));
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

  // "Connect your calendar": for members who haven't, when no vote is open
  // (the vote has its own prompt). Not now hides it for this crew on this device.
  const calKey = `crew-cal-nudge:${crew.id}`;
  const [calHidden, setCalHidden] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      try { setCalHidden(window.localStorage.getItem(calKey) === "1"); } catch { setCalHidden(false); }
    }, 0);
    return () => clearTimeout(t);
  }, [calKey]);
  const hideCal = () => {
    setCalHidden(true);
    try { window.localStorage.setItem(calKey, "1"); } catch { /* private mode */ }
  };
  // When we're free counts only synced calendars: that ask stays until they sync.
  const freeAsk = Boolean(me.needsCalendarForFree);
  const showCalNudge = me.status === "in" && !me.calendarSynced && (freeAsk || (!calHidden && !open.some((c) => c.state === "polling")));

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
    // Picking a pace is part of joining (a crew on a rhythm only): the crew's
    // own, or up to three slower ones. Leaf only asks them on that pace.
    const askPace = !declined && !crew.oneTime && !crew.triggerOnly;
    const slower = Object.entries(RHYTHM_LABELS).filter(([d]) => Number(d) > crew.rhythmDays).slice(0, 3);
    return (
      <CrewShell>
        <div className="flex min-h-[70vh] flex-col justify-center py-6">
          <Eyebrow>{declined ? "You said no thanks" : `${inviter.split(" ")[0]} invited you`}</Eyebrow>
          <div className="mt-4">
            <DisplayTitle italic={second}>{first}</DisplayTitle>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-fm-ink-2">
            {crew.oneTime
              ? `One ${ev ? "night out" : "get-together"} with this crew. Leaf finds a date that works for everyone and plans it.`
              : `${ev ? "Nights out" : "Get-togethers"} with this crew, ${rhythmLabel(crew.rhythmDays).toLowerCase()}. Leaf finds a date that works for everyone and plans it.`}
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
            {askPace && (
              <fieldset className="mt-4 border-0 p-0">
                <legend className="text-[15px] font-semibold text-fm-ink">How often for you?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[["", `${rhythmLabel(crew.rhythmDays)}, with the crew`] as const, ...slower].map(([d, l]) => (
                    <button
                      key={d || "crew"}
                      type="button"
                      aria-pressed={joinPace === d}
                      onClick={() => setJoinPace(d)}
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold ${joinPace === d ? "bg-fm-ink text-fm-canvas" : "border border-fm-line text-fm-ink"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="mb-0 mt-2 text-xs text-fm-muted">Leaf only asks you on your pace. Change it any time in settings.</p>
              </fieldset>
            )}
            <div className={`mt-4 grid gap-2 ${declined ? "grid-cols-1" : "grid-cols-2"}`}>
              <Button
                onClick={() => act("join", async () => {
                  await run("respondToCrewInvite", auth, { accept: true, sms: true, phone: me.phoneLast4 ? null : smsPhone || null });
                  if (askPace) await run("setCrewPace", auth, { weeks: joinPace ? Number(joinPace) / 7 : null }).catch(() => {});
                })}
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

  if (deleted) {
    return (
      <CrewShell>
        <div className="flex min-h-[60vh] flex-col justify-center gap-3 py-6">
          <Eyebrow>Deleted</Eyebrow>
          <DisplayTitle>{crew.name}</DisplayTitle>
          <p className="m-0 text-[15px] text-fm-ink-2">The crew, its book and anything being planned are gone. Nights already set stay on everyone&rsquo;s plans.</p>
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
            void act("gcal", () => goConnectCalendar(calProvider));
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
            <button type="button" onClick={() => setMembersOpen(true)} aria-label={`See who's in ${crew.name}`} className="flex items-center gap-3 text-left lg:pointer-events-none">
              <span className="flex lg:hidden">
                {[...joined, ...invited].slice(0, 5).map((m, i) => (
                  <span key={m.membershipId} className={i ? "-ml-2.5" : ""}>
                    <Avatar name={m.name} src={m.avatar} invited={m.status === "invited"} ring="ring-2 ring-fm-canvas" />
                  </span>
                ))}
              </span>
              <span className="text-sm text-fm-ink-2 underline decoration-fm-line underline-offset-4 lg:text-[15px] lg:no-underline">{summary}</span>
            </button>
          </div>

          {me.isOwner && (
            <div className="flex items-center gap-4 rounded-full border border-fm-line bg-fm-surface py-2 pl-5 pr-2">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">Friend Mode</div>
                <div className="truncate text-[12px] text-fm-muted">
                  {crew.enabled === false ? "Off · nothing is planned or texted" : `On · Leaf plans ${nights} for this group`}
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
              Waiting on {crew.quorum - crew.joinedCount} more to join before Leaf plans the first {night}.
            </p>
          )}
        </div>

        {/* What needs you */}
        <div className="mt-7 flex min-w-0 flex-col gap-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:gap-14">
          {crew.lastOneTime && (
            <section className="flex flex-col gap-3 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <Eyebrow>{crew.lastOneTime.happened ? `That was the ${ev ? "night" : "day"}` : "It didn't come together"}</Eyebrow>
              <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-[1.05] lg:text-[36px]">
                {me.isOwner ? "Do it again?" : ev ? "One night out" : "One get-together"}
              </h2>
              <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
                {me.isOwner
                  ? `Same people${crew.lastOneTime.venue ? `, and ${crew.lastOneTime.venue} is still in the book` : ""}. Leaf finds a new date that works.`
                  : `${(names[crew.ownerId || ""] || "The organizer").split(" ")[0]} can plan another one.`}
              </p>
              {me.isOwner && (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy !== null} onClick={() => act("again", () => run("runCrewAgain", auth, { calendarId: crew.id, oneTime: true }))}>
                    {busy === "again" ? "Starting…" : ev ? "Another night" : "Another one"}
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

            {(data.eventMatches || []).map((m) => (
              <EventMatchCard
                key={m.spotId}
                match={m}
                busy={busy}
                onAnswer={(go) => act(`ev-${m.spotId}`, async () => {
                  const r = await run<{ joined?: boolean; withCrew?: string | null }>("answerCrewEventMatch", auth, { spotId: m.spotId, go });
                  if (r?.joined) setEventNote(`${m.title} is already on with ${r.withCrew || "another crew"}, so it's one night, not two. Everyone here gets that plan's invite.`);
                })}
              />
            ))}
            {eventNote && <p className="m-0 rounded-2xl border border-fm-line px-4 py-3 text-sm text-fm-ink-2">{eventNote}</p>}

            {data.lastNight && (
              <LastNightCard
                night={data.lastNight}
                meId={me.userId || null}
                auth={auth}
                split={split && split.cycleId === data.lastNight.cycleId ? split : null}
                onSplit={setSplit}
                nextRoundAt={crew.enabled !== false && !crew.oneTime ? crew.nextRoundAt || null : null}
              />
            )}

            {open.length === 0 && !crew.lastOneTime && !data.lastNight && (
              <Card>
                <Eyebrow>Nothing being planned</Eyebrow>
                <p className="mt-3 text-[15px] leading-relaxed text-fm-ink-2">
                  {crew.enabled === false ? "Friend Mode is off, so Leaf isn't planning anything for this crew."
                    : crew.triggerOnly
                      ? `${crew.freeTrigger ? `Leaf plans a ${night} when ${freeShareWords(crew.freeTrigger)} of you are free the same day${crew.freeTriggerLabel ? ` (${crew.freeTriggerLabel.replace(/^When [^·]+ are free · /, "")})` : ""}.` : `Leaf plans a ${night} when one of this crew's triggers comes true.`}${crew.birthdays ? " Birthdays count too." : ""} Got a place and a date in mind? Say so below.`
                    : crew.oneTime ? `Leaf starts planning the ${night} as soon as enough people are in.`
                    : `Leaf starts the next ${night} on its own (${rhythmLabel(crew.rhythmDays).toLowerCase()})${crew.freeTrigger ? `, or sooner when ${freeShareWords(crew.freeTrigger)} of you are free` : ""}. Got a place and a date in mind? Say so below.`}
                </p>
                {me.isOwner && crew.enabled !== false && !crew.oneTime && !crew.triggerOnly && crew.nextRoundAt && (
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
                    <CycleCard key={`${c.cycleId}:${c.options.length}`} cycle={c} names={names} members={members} busy={busy} onAct={act} auth={auth} quorum={crew.quorum} joined={joined.length} calendarSynced={Boolean(me.calendarSynced)} onConnectCalendar={connectCalendar} hostRotation={Boolean(crew.hostRotation)} isOwner={me.isOwner} canSkip={me.isOwner && !crew.oneTime && crew.enabled !== false} crewId={crew.id} meName={me.name} />
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

          {showCalNudge && (
            <section className="flex items-start gap-3.5 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fm-card text-fm-accent" aria-hidden>
                <CalendarDays size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="m-0 text-[16px] font-semibold text-fm-ink">{freeAsk ? "Sync your calendar so Leaf counts you" : "Connect your calendar"}</p>
                  <p className="m-0 mt-1 text-[14px] leading-relaxed text-fm-ink-2">
                    {freeAsk
                      ? `This crew meets when ${freeShareWords(crew.freeTrigger) || "half"} of you are free the same day. Leaf can only count you if it can see when you're free.`
                      : `Leaf finds ${ev ? "nights" : "days"} that work for you and skips the ones you're busy.`}{" "}
                    Your crew never sees your calendar, just which dates work.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button small disabled={busy !== null} onClick={() => connectCalendar("google")}>{busy === "gcal" ? "Opening…" : "Connect Google Calendar"}</Button>
                  <Button small kind="ghost" disabled={busy !== null} onClick={() => connectCalendar("outlook")}>Connect Outlook</Button>
                  {!freeAsk && <button type="button" className="text-sm text-fm-muted underline underline-offset-4" onClick={hideCal}>Not now</button>}
                </div>
              </div>
            </section>
          )}

          {split && (split.receipt || split.went) && split.cycleId !== data.lastNight?.cycleId && (
            <CrewMoneyCard kind="after" split={split} auth={auth} onChange={setSplit} />
          )}
          {pastAddOns.map((x) => (
            <CrewAddOnCard key={x.cycleId} addOn={x} auth={auth} onChange={(next) => setAddOn(x.cycleId, next)} />
          ))}

          {me.birthdayAsk && (
            <BirthdayPick ask={me.birthdayAsk} auth={auth} book={book} onDone={() => void reload()} />
          )}
          {me.needsBirthday && !me.birthdayAsk && (
            <AddBirthday auth={auth} onDone={() => void reload()} />
          )}

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
              <p className="m-0 text-xs text-fm-muted">Every {night} is here. Leaf just finds the date.</p>
            </section>
          ) : (
            <section className="flex flex-col gap-3.5 lg:gap-5">
              <div className="flex items-center justify-between">
                <SectionTitle>The book</SectionTitle>
                <Link href={`${crewHref(auth, "book")}?add=1`} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-fm-ink hover:text-white">
                  <Plus size={16} strokeWidth={2.2} aria-hidden /> Add<span className="hidden lg:inline"> a place</span>
                </Link>
              </div>
              {!data.bookHappenings && (data.watching?.length ?? 0) > 0 && (
                <WatchingStrip items={data.watching!} auth={auth} isOwner={me.isOwner} onChange={reload} />
              )}
              {book.length === 0 && happenings.length === 0 ? (
                <div className="flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-fm-line p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
                  <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-fm-ink-2 lg:text-base">
                    No places yet. Add a few you&rsquo;ve been wanting to try and Leaf will plan {nights} around them. Or have Leaf watch for a game, a show or a tour.
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`${crewHref(auth, "book")}?add=1`} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-fm-ink px-5 text-sm font-semibold text-fm-canvas">
                      <Plus size={16} strokeWidth={2.2} aria-hidden /> Add a place
                    </Link>
                    {me.status === "in" && (
                      <Link href={`${crewHref(auth, "book")}?watch=1`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-fm-accent px-5 text-sm font-semibold text-fm-accent">
                        <Eye size={16} strokeWidth={2.2} aria-hidden /> Watch for an event <span className="font-fm-mono text-[9px]">BETA</span>
                      </Link>
                    )}
                  </div>
                </div>
              ) : book.length > 0 && (
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
                  {/* The rest of the book: newest are shown here, everything is there. */}
                  <li className="flex w-[148px] shrink-0 snap-start flex-col gap-2 lg:hidden">
                    <Link
                      href={crewHref(auth, "book")}
                      className="flex h-[148px] flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-fm-line text-center text-fm-ink hover:border-fm-ink-2"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fm-card" aria-hidden><ChevronRight size={18} strokeWidth={2.2} /></span>
                      <span className="text-[15px] font-semibold">{(data.bookTotal ?? book.length) > book.length ? "See more" : "See the book"}</span>
                      {(data.bookTotal ?? book.length) > book.length && <span className="text-xs text-fm-muted">{data.bookTotal} places</span>}
                    </Link>
                  </li>
                </ul>
              )}
              {book.length > 0 && (data.bookTotal ?? book.length) > 4 && (
                <Link href={crewHref(auth, "book")} className="hidden w-fit text-sm font-semibold text-fm-ink-2 underline underline-offset-4 hover:text-fm-ink lg:inline">
                  See all {data.bookTotal} places
                </Link>
              )}
              <HappeningsCards items={happenings.slice(0, 3)} total={data.bookHappeningsTotal ?? happenings.length} auth={auth} />
              {me.status === "in" && (
                <ShareFromInstagramHint crewName={crew.name} inApp={inApp} auth={auth} hiddenTips={me.hiddenTips} />
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
            evening={ev}
          />

          {/* Ideas for the book: the crew's saves, places like where it's been,
              events nearby and popular places, mixed (this replaced "Where would you go?"). */}
          {!fixedPlace && (data.discover?.length ?? 0) > 0 && (
            <DiscoverRow items={data.discover!} auth={auth} canAdd={me.status === "in"} onAdded={reload} />
          )}

          {me.status === "in" && <CrewPhotosSection auth={auth} meId={me.userId || null} title="Photos" skipCycleId={data.lastNight?.cycleId ?? null} />}

          {past.length > 0 && (
            <section>
              <SectionTitle>{ev ? "Past nights" : "Past get-togethers"}</SectionTitle>
              <ul className="mt-1.5 divide-y divide-fm-line-dim">
                {past.map((p) => {
                  const d = toDate(p.startsAt);
                  return (
                    <li key={p.cycleId} className="flex items-center gap-4 py-3.5">
                      <Mono className="w-14 shrink-0 text-xs text-fm-muted">{d ? d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : ""}</Mono>
                      <span className="min-w-0 flex-1 truncate text-base font-medium">{p.venue?.name || (eveningAt(p.startsAt) ? "A night out" : "A get-together")}</span>
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

      {membersOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setMembersOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Who's in ${crew.name}`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-fm-line bg-fm-surface px-5 pb-5 pt-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Who&rsquo;s in</div>
                <div className="text-[13px] text-fm-muted">{summary}</div>
              </div>
              <button type="button" aria-label="Close" className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fm-card text-fm-ink hover:bg-fm-line" onClick={() => setMembersOpen(false)}><X size={20} strokeWidth={2.2} aria-hidden /></button>
            </div>
            <ul className="mt-2">
              {joined.map((m) => (
                <MemberRow key={m.membershipId} m={m} note={m.userId === crew.ownerId ? "Started it" : m.membershipId === me.membershipId ? "You" : undefined} />
              ))}
              {invited.map((m) => <MemberRow key={m.membershipId} m={m} note="Invited" />)}
            </ul>
          </div>
        </div>
      )}

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
                href={crewInviteHref(crew.id, crew.name, members, me.membershipId)}
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
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-fm-line bg-fm-surface sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stays put while the settings scroll: only the body below scrolls (a sticky header left a gap on iOS that content showed through). */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-fm-line-dim px-5 pb-3 pt-4">
              <div>
                <div className="text-lg font-semibold">Your settings</div>
                <div className="text-[13px] text-fm-muted">{crew.name} · only you see these</div>
              </div>
              <button type="button" aria-label="Close" className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fm-card text-fm-ink hover:bg-fm-line" onClick={() => setSettingsOpen(false)}><X size={20} strokeWidth={2.2} aria-hidden /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
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
                  <div className="text-[13px] text-fm-muted">{me.calendarSynced ? `Synced · Leaf offers ${ev ? "nights" : "days"} you're free` : `Sync Google or Outlook and Leaf offers ${ev ? "nights" : "days"} you're free`}</div>
                </div>
                {!me.calendarSynced && (
                  <div className="flex shrink-0 gap-2">
                    <Button small disabled={busy !== null} onClick={() => act("gcal", () => goConnectCalendar("google"))}>Google</Button>
                    <Button small kind="ghost" disabled={busy !== null} onClick={() => act("gcal", () => goConnectCalendar("outlook"))}>Outlook</Button>
                  </div>
                )}
              </div>
              )}

              {me.isOwner && (
                <div className="border-b border-fm-line-dim py-4">
                  <label htmlFor="crew-rhythm" className="block text-[15px] font-semibold">How often the crew goes out</label>
                  <select
                    id="crew-rhythm"
                    value={crew.triggerOnly ? "-1" : crew.oneTime ? "0" : String(crew.rhythmDays)}
                    disabled={busy !== null}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      act("rhythm", () => run("setCrewRhythm", auth, days === -1
                        ? { calendarId: crew.id, triggerOnly: true }
                        : days === 0 ? { calendarId: crew.id, oneTime: true } : { calendarId: crew.id, rhythmDays: days }));
                    }}
                    className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                  >
                    {Object.entries(RHYTHM_LABELS).map(([d, l]) => (
                      <option key={d} value={d}>{l}</option>
                    ))}
                    <option value="0">Just once</option>
                    <option value="-1">On a trigger (BETA): only its triggers start nights</option>
                  </select>
                  <p className="mb-0 mt-2 text-xs text-fm-muted">
                    {crew.triggerOnly
                      ? `Only the crew's triggers start a ${night}: When we're free, Birthdays and anything the book watches for.`
                      : `Leaf starts each ${night} on this rhythm. Members can set a slower pace of their own below.`}
                  </p>
                </div>
              )}

              {me.isOwner && (
                <div className="border-b border-fm-line-dim py-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold">Skip venue rotation</div>
                      <div className="text-[13px] text-fm-muted">Always meet at one place: home, or the same spot every time.</div>
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
                    <FixedPlacePicker
                      auth={auth}
                      calendarId={crew.id}
                      current={crew.placeMode === "fixed" ? crew.fixedPlace || null : null}
                      busy={busy === "place"}
                      onSave={(params) => act("place", () => run("setCrewPlaceMode", auth, params))}
                    />
                  )}
                </div>
              )}

              {me.isOwner && (
                <div className="flex items-center gap-3 border-b border-fm-line-dim py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">Rotate who hosts</div>
                    <div className="text-[13px] text-fm-muted">Each {night} Leaf plans goes to the next person in the crew, you first.</div>
                  </div>
                  <FriendModeSwitch
                    label="Rotate who hosts"
                    checked={Boolean(crew.hostRotation)}
                    disabled={busy !== null}
                    onChange={(v) => act("rotation", () => run("setCrewHostRotation", auth, { calendarId: crew.id, enabled: v }))}
                  />
                </div>
              )}

              {me.isOwner && (
                <FreeRuleRow
                  rule={crew.freeTrigger || null}
                  label={crew.freeTriggerLabel || null}
                  usualTime={crew.usualTime || null}
                  busy={busy !== null}
                  onSave={(rule) => act("free", () => run("setCrewFreeTrigger", auth, { calendarId: crew.id, rule }))}
                />
              )}

              {me.isOwner && (
                <div className="flex items-center gap-3 border-b border-fm-line-dim py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-semibold">Birthdays <span className="rounded-full bg-fm-card px-1.5 py-0.5 font-fm-mono text-[9px] tracking-[0.06em] text-fm-accent">BETA</span></div>
                    <div className="text-[13px] text-fm-muted">The {night} nearest someone&rsquo;s birthday is theirs: they pick where, Leaf finds a date that week.</div>
                  </div>
                  <FriendModeSwitch
                    label="Birthdays"
                    checked={Boolean(crew.birthdays)}
                    disabled={busy !== null}
                    onChange={(v) => act("birthdays", () => run("setCrewBirthdays", auth, { calendarId: crew.id, on: v }))}
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
                    <button
                      className="h-11 rounded-full bg-fm-danger px-4 text-sm font-semibold text-fm-canvas"
                      disabled={busy !== null}
                      onClick={() => canDelete
                        ? act("delete", async () => { await run("deleteFriendCrew", auth, { crewId: crew.id }); setSettingsOpen(false); setDeleted(true); })
                        : act("leave", async () => { await run("leaveCrew", auth); window.location.reload(); })}
                    >
                      {canDelete ? (busy === "delete" ? "Deleting…" : `Yes, delete ${crew.name}`) : `Yes, leave ${crew.name}`}
                    </button>
                    <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-ink-2 hover:bg-fm-card" onClick={() => setConfirmLeave(false)}>
                      Stay
                    </button>
                  </>
                ) : (
                  <button className="h-11 rounded-full px-3 text-sm font-medium text-fm-danger hover:bg-fm-card" onClick={() => setConfirmLeave(true)}>
                    {canDelete ? "Delete crew" : "Leave"}
                  </button>
                )}
              </div>
              {confirmLeave && (
                <p className="mb-0 mt-1 text-xs text-fm-muted">
                  {canDelete
                    ? "Ends anything being planned, removes everyone, and deletes the crew's book. Nights already set stay on."
                    : "Leaf will stop texting you about this crew."}
                </p>
              )}
            </div>
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
  // A slower pace than the crew's shows next to them: "every 2 weeks".
  note = [note, m.paceDays ? rhythmLabel(m.paceDays).toLowerCase() : null].filter(Boolean).join(" · ") || undefined;
  return (
    <li className="flex items-center gap-3 border-b border-fm-line-dim py-2.5">
      <Avatar name={m.name} src={m.avatar} invited={inv} />
      <span className={`min-w-0 flex-1 truncate text-[15px] ${inv ? "text-fm-muted" : "font-medium"}`}>{m.name}</span>
      {note && <span className="text-xs text-fm-muted">{note}</span>}
    </li>
  );
}

function CycleCard({
  cycle: c, names, members, busy, onAct, auth, quorum, joined, calendarSynced, onConnectCalendar, hostRotation = false, isOwner = false, canSkip = false, crewId = "", meName = "",
}: {
  cycle: CycleView;
  /** This member's name, left out of "… sitting this one out" (they get their own line). */
  meName?: string;
  names: Record<string, string>;
  members: Member[];
  busy: string | null;
  onAct: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  auth: CrewAuth;
  quorum: number;
  joined: number;
  /** The member's Google Calendar is connected (Leaf pre-ticks their free nights). */
  calendarSynced: boolean;
  onConnectCalendar: (provider?: "google" | "outlook") => void;
  /** Host rotation is on: say whose turn this night is. */
  hostRotation?: boolean;
  /** The crew's owner: may answer a combine offer like the round's host. */
  isOwner?: boolean;
  /** The organizer of a recurring crew: may skip a round being planned. */
  canSkip?: boolean;
  crewId?: string;
}) {
  const inApp = useInApp();
  const ev = cycleIsEvening(c);
  // Where the place opens: its page in the app, Google Maps on the web.
  const placeHref = !c.venue?.name ? null
    : inApp && c.venueLocationId ? `leaf://location/${c.venueLocationId}`
    : c.venue.placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(c.venue.placeId)}`
    : c.venueLocationId || c.venue.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.venue.name, c.venue.address].filter(Boolean).join(" "))}`
    : null;
  // Not voted yet: start from the dates their calendar says they're free.
  // Nothing pre-ticked: Leaf already picked these dates around everyone's
  // calendars, so a tap here is a preference, and it saves by itself.
  const [picked, setPicked] = useState<Set<number>>(new Set(c.myVotes ?? []));
  const [voteState, setVoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // The page paints its saved copy first, then the fresh one: follow the
  // fresh votes when they arrive (unless a tap is still being saved), or a
  // copy from before you voted would keep your dates looking unpicked.
  const votesKey = JSON.stringify(c.myVotes ?? []);
  const [seenVotesKey, setSeenVotesKey] = useState(votesKey);
  if (votesKey !== seenVotesKey) {
    setSeenVotesKey(votesKey);
    if (voteState !== "saving") setPicked(new Set(c.myVotes ?? []));
  }
  // Saves on every tap, right away: waiting for taps to settle lost the vote
  // when someone tapped and left the page (the app closes its web view).
  // One save at a time; taps made meanwhile go in the next one.
  const saving = useRef(false);
  const queued = useRef<Set<number> | null>(null);
  const saveVotes = (next: Set<number>) => {
    queued.current = next;
    if (saving.current) return;
    saving.current = true;
    setVoteState("saving");
    void (async () => {
      let failed = false;
      while (queued.current) {
        const sending = queued.current;
        queued.current = null;
        try {
          await run("crewVote", auth, { cycleId: c.cycleId, options: [...sending] });
        } catch {
          failed = true;
        }
      }
      saving.current = false;
      setVoteState(failed ? "error" : "saved");
      if (!failed) setTimeout(() => setVoteState((v) => (v === "saved" ? "idle" : v)), 2200);
    })();
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
  const who = c.trigger === "member_proposal" ? `${names[c.hostId || ""] || "A member"}'s idea`
    : c.trigger === "weather" ? "Nice day ahead"
    : c.trigger === "birthday" ? `${names[c.birthdayOfId || ""] || "Someone"}'s birthday`
    : c.trigger === "event" ? "It's on"
    : c.trigger === "free" ? (c.freeCount ? `${c.freeCount} of you are free` : "You're free") : "Up next";
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
              <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name || (ev ? "Your night" : "Your plan")}</h2>
            </a>
          ) : placeHref ? (
            // While it's voting, the place opens its page: the app's location detail, else Google Maps.
            <a href={placeHref} target={inApp ? undefined : "_blank"} rel="noreferrer" className="w-fit underline decoration-fm-line decoration-1 underline-offset-[6px] hover:decoration-fm-ink-2">
              <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name}</h2>
            </a>
          ) : (
            <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name || "Picking a place…"}</h2>
          )}
          <p className="m-0 text-sm text-fm-muted">
            {settled && c.chosenOption
              ? [chosen?.dow, timeLabel(c.chosenOption.time), c.venue?.address].filter(Boolean).join(" · ")
              : c.venue?.address && placeHref
                ? <a href={placeHref} target={inApp ? undefined : "_blank"} rel="noreferrer" className="hover:underline underline-offset-4">{c.venue.address}</a>
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
      {(() => {
        // Others off this round on their own pace, so nobody wonders why they haven't voted.
        const out = [...(c.sittingOut || [])];
        const mine = c.invited === false && meName ? out.indexOf(meName) : -1;
        if (mine >= 0) out.splice(mine, 1);
        if (!out.length) return null;
        const firsts = out.map((n) => n.split(" ")[0]);
        const who = firsts.length === 1 ? firsts[0] : `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
        return <p className="m-0 text-xs text-fm-muted">{who} {firsts.length === 1 ? "is" : "are"} sitting this one out (their pace).</p>;
      })()}

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
        <>
          <div className="flex flex-col gap-3 rounded-[18px] border border-fm-line px-4 py-4">
            <p className="m-0 text-[15px] leading-snug text-fm-ink">
              {c.placeSuggestion.why === "history" ? `Back to ${c.placeSuggestion.name}, like last time?` : `How about ${c.placeSuggestion.name}?`}
              {c.placeSuggestion.address && <span className="mt-0.5 block text-xs text-fm-muted">{c.placeSuggestion.address}</span>}
            </p>
            <div>
              <Button
                small
                disabled={busy !== null}
                onClick={() => onAct("addSuggested", () => run("addToCrewBook", auth, c.placeSuggestion!.locationId
                  ? { locationId: c.placeSuggestion!.locationId }
                  : { placeId: c.placeSuggestion!.placeId, venue: { name: c.placeSuggestion!.name, address: c.placeSuggestion!.address, lat: c.placeSuggestion!.lat, lng: c.placeSuggestion!.lng, placeId: c.placeSuggestion!.placeId } }))}
              >
                {busy === "addSuggested" ? "Adding…" : `Add ${c.placeSuggestion.name}`}
              </Button>
            </div>
          </div>
          <Link href={crewHref(auth, "book")} className="w-fit text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink">Pick somewhere else</Link>
        </>
      )}

      {c.state === "polling" && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="m-0 text-[15px] text-fm-ink-2">
              {calendarSynced && c.fit?.some((f) => f.known > 0) ? "Picked around everyone's calendars. Tap any you'd go to." : `Which ${ev ? "nights" : "days"} work? Tap any you'd go to.`}
            </p>
            <span role="status" aria-live="polite" className={`shrink-0 text-xs ${voteState === "error" ? "text-fm-danger" : "text-fm-muted"}`}>
              {voteState === "saving" ? "Saving…" : voteState === "saved" ? "Saved ✓" : voteState === "error" ? "Didn't save — tap again" : ""}
            </span>
          </div>
          {!calendarSynced && (
            <div className="flex items-center gap-3 rounded-2xl border border-fm-line-dim px-3.5 py-2.5">
              <p className="m-0 min-w-0 flex-1 text-[13px] leading-snug text-fm-ink-2">Connect your calendar and Leaf ticks the {ev ? "nights" : "days"} you&rsquo;re free.</p>
              <button
                type="button"
                onClick={() => onConnectCalendar("google")}
                disabled={busy !== null}
                className="h-9 shrink-0 rounded-full border border-fm-line px-3.5 text-[13px] font-semibold text-fm-ink hover:bg-fm-card disabled:opacity-50"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => onConnectCalendar("outlook")}
                disabled={busy !== null}
                className="h-9 shrink-0 rounded-full border border-fm-line px-3.5 text-[13px] font-semibold text-fm-ink hover:bg-fm-card disabled:opacity-50"
              >
                Outlook
              </button>
            </div>
          )}
          {c.combineOffer && (c.isHost || isOwner) && (
            <div className="flex flex-col gap-3 rounded-[18px] border border-fm-line bg-fm-card p-4">
              <p className="m-0 text-[15px] leading-snug text-fm-ink">
                {c.combineOffer.crewName} is already set for{" "}
                {c.options[c.combineOffer.optionIndex] ? `${dayParts(c.options[c.combineOffer.optionIndex].date).dow} ${dayParts(c.options[c.combineOffer.optionIndex].date).month} ${dayParts(c.options[c.combineOffer.optionIndex].date).day}` : `one of these ${ev ? "nights" : "days"}`}
                {c.combineOffer.venue ? ` at ${c.combineOffer.venue}` : ""}, with some of the same people. Combine them into one {ev ? "night" : "plan"}?
              </p>
              <p className="m-0 text-[13px] text-fm-muted">Combine invites everyone here to that {ev ? "night" : "plan"} and skips this round. Keep separate drops that date from this poll.</p>
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
          {c.options.length < 5 && <SuggestDate cycle={c} auth={auth} busy={busy} onAct={onAct} />}
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
                  {`Cancel ${chosen ? `${chosen.dow} ${chosen.month} ${chosen.day}` : `this ${ev ? "night" : "plan"}`} for everyone? Leaf tells the people invited it\u2019s off.`}
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
                Cancel this {ev ? "night" : "plan"}
              </button>
            )
          )}
        </>
      )}
      {/* A stop after the night's place: suggestions to upvote, the host adds one. */}
      {["polling", "locked", "booked"].includes(c.state) && c.venueLocationId && !c.venue?.custom && (
        <SecondStop auth={auth} cycleId={c.cycleId} inApp={inApp} />
      )}
      {["polling", "locked", "booked"].includes(c.state) && (c.isHost || isOwner) && (!c.venue?.fixed || c.venue?.custom) && (
        <ChangePlace cycle={c} auth={auth} busy={busy} onAct={onAct} />
      )}
    </Card>
  );
}

/**
 * Organizer or this round's host, while it's voting or once the night is set:
 * switch the place. Dates (or the set day and time) stay; Leaf tells the crew. When
 * someone added a place before anyone voted, it's offered first.
 */
/**
 * The night that just happened (a day and a half after it starts): where, who
 * went, How was it? and the bill. The RSVP, booking, cancel and chat
 * controls are gone; underneath, when the next round starts.
 */
export function LastNightCard({ night, meId, auth, split, onSplit, nextRoundAt }: {
  night: LastNight; meId: string | null; auth: CrewAuth; split: CrewSplit | null; onSplit: (s: CrewSplit | null) => void; nextRoundAt: string | null;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(night.myRating);
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState<"yes" | "no" | null>(night.myAttendance ?? null);
  const [photos, setPhotos] = useState(night.photos ?? []);
  // Said they made it, or nothing yet and they'd said yes to the night.
  const wasThere = attendance === "yes" || (attendance === null && night.iWent);
  const answer = async (attended: boolean) => {
    const before = attendance;
    setAttendance(attended ? "yes" : "no");
    try { await run("setCrewNightAttendance", auth, { cycleId: night.cycleId, attended }); }
    catch { setAttendance(before); }
  };
  const start = toDate(night.startsAt);
  const evening = eveningAt(night.startsAt);
  const today = start && start.toDateString() === new Date().toDateString();
  const yesterday = start && start.toDateString() === new Date(Date.now() - 86_400_000).toDateString();
  const when = today ? (evening ? "Tonight" : "Today") : yesterday ? (evening ? "Last night" : "Yesterday") : start?.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) || "Last time";
  const first = (n: string) => n.split(/\s+/)[0];
  const wentLine = (() => {
    // "You and Gregory went": you first, when you were there.
    const names = [
      ...(night.went.some((p) => p.userId === meId) ? ["You"] : []),
      ...night.went.filter((p) => p.userId !== meId).map((p) => first(p.name)),
    ];
    if (!names.length) return null;
    const list = names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `${list} went`;
  })();
  const rate = async (value: "up" | "down") => {
    const next = rating === value ? null : value;
    setRating(next);
    setSaving(true);
    try { await run("rateCrewNight", auth, { cycleId: night.cycleId, rating: next }); }
    catch { setRating(rating); }
    finally { setSaving(false); }
  };
  const ratingBtn = (value: "up" | "down", label: string, emoji: string) => (
    <button
      type="button"
      aria-pressed={rating === value}
      disabled={saving}
      onClick={() => void rate(value)}
      className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-[15px] font-semibold transition ${
        rating === value ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink hover:border-fm-ink-2"
      }`}
    >
      <span aria-hidden>{emoji}</span> {label}
    </button>
  );
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>{when}</Eyebrow>
        <h3 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{night.venue?.name || "Your night out"}</h3>
        {wentLine && <p className="m-0 text-[15px] text-fm-ink-2">{wentLine}</p>}
      </div>

      {night.myInviteId && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 mr-1 text-[15px] text-fm-ink">Did you make it?</p>
          {([["yes", "I went", true], ["no", "Couldn't make it", false]] as const).map(([value, label, attended]) => (
            <button
              key={value}
              type="button"
              aria-pressed={attendance === value}
              onClick={() => void answer(attended)}
              className={`h-10 rounded-full border px-4 text-sm font-semibold transition ${
                attendance === value ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink hover:border-fm-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {wasThere && (
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-[15px] text-fm-ink">How was it?</p>
          <div className="flex gap-2">
            {ratingBtn("up", "Good one", "👍")}
            {ratingBtn("down", "Not again", "👎")}
          </div>
          {rating && <p className="m-0 text-xs text-fm-muted">{rating === "up" ? "Noted. Leaf keeps it in the mix." : "Noted. If most of the crew agrees, Leaf stops suggesting it."}</p>}
        </div>
      )}

      {(photos.length > 0 || (night.uploadsOpen && night.myInviteId && attendance !== "no")) && (
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-[15px] text-fm-ink">{photos.length ? `Photos · ${photos.length}` : "Got photos?"}</p>
          <PhotoStrip photos={photos} />
          {night.uploadsOpen && night.myInviteId && night.photoLimits && attendance !== "no" && (
            <AddPhotos
              inviteId={night.myInviteId}
              limits={night.photoLimits}
              mine={photos.filter((p) => p.uploaderId === meId).length}
              onUploaded={(p) => setPhotos((ps) => [p, ...ps])}
            />
          )}
        </div>
      )}

      {split && (split.receipt || split.went) && <CrewMoneyCard kind="after" split={split} auth={auth} onChange={onSplit} />}


      {nextRoundAt && (
        <p className="m-0 border-t border-fm-line-dim pt-4 text-sm text-fm-muted">
          What&rsquo;s next: Leaf starts the next round around {new Date(nextRoundAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}.
        </p>
      )}
    </Card>
  );
}

/**
 * Suggest another date: anyone in the crew adds one to the poll (up to 5).
 * One-tap dates from their own calendar when it's connected, or any day and
 * time. It goes on the end, so everyone's votes stay.
 */
function SuggestDate({ cycle: c, auth, busy, onAct }: { cycle: CycleView; auth: CrewAuth; busy: string | null; onAct: (key: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState<{ date: string; time: string }[] | null>(null);
  const [synced, setSynced] = useState(false);
  const usualTime = c.options.find((o) => o.time)?.time || "19:00";
  const [date, setDate] = useState("");
  const [time, setTime] = useState(usualTime);
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); })();
  const add = (d: string, t: string) => onAct("addDate", () => run("addCrewPollDate", auth, { cycleId: c.cycleId, date: d, time: t }));
  const show = async () => {
    setOpen(true);
    if (free === null) {
      const r = await run<{ synced: boolean; dates: { date: string; time: string }[] }>("getCrewFreeDates", auth, { cycleId: c.cycleId }).catch(() => ({ synced: false, dates: [] }));
      setFree(r.dates || []);
      setSynced(Boolean(r.synced));
    }
  };
  const label = (d: string) => { const p = dayParts(d); return `${p.dow} ${p.month} ${p.day}`; };
  if (!open) {
    return (
      <button type="button" onClick={() => void show()} className="flex min-h-11 w-fit items-center gap-1.5 text-sm text-fm-ink-2 underline underline-offset-4 hover:text-fm-ink">
        <Plus size={15} aria-hidden /> Suggest another date
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-fm-line p-3.5">
      <span className="text-sm font-semibold text-fm-ink">Suggest another date</span>
      {free && free.length > 0 && (
        <>
          <Mono className="text-fm-muted">{synced ? "You look free" : "Good days for the crew"}</Mono>
          <div className="flex flex-wrap gap-2">
            {free.map((f) => (
              <button
                key={f.date}
                type="button"
                disabled={busy !== null}
                onClick={() => void add(f.date, f.time)}
                className="inline-flex min-h-10 items-center rounded-full border border-fm-line px-3.5 text-sm text-fm-ink hover:border-fm-ink-2 disabled:opacity-60"
              >
                {label(f.date)}{f.time ? ` · ${timeLabel(f.time)}` : ""}
              </button>
            ))}
          </div>
        </>
      )}
      <Mono className="text-fm-muted">{free && free.length > 0 ? "Or any day" : "Pick a day"}</Mono>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (date) void add(date, time); }}
      >
        <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date"
          className="h-11 rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink [color-scheme:dark] focus:border-fm-accent focus:outline-none" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time"
          className="h-11 rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink [color-scheme:dark] focus:border-fm-accent focus:outline-none" />
        <Button small type="submit" disabled={busy !== null || !date}>{busy === "addDate" ? "Adding…" : "Add it"}</Button>
      </form>
      <p className="m-0 text-xs text-fm-muted">It joins the poll for everyone, counted as yours. Votes on the other dates stay.</p>
      <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-fit text-sm text-fm-muted underline underline-offset-4">Never mind</button>
    </div>
  );
}

function ChangePlace({ cycle: c, auth, busy, onAct }: { cycle: CycleView; auth: CrewAuth; busy: string | null; onAct: (key: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<BookSpot[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [elsewhere, setElsewhere] = useState(false);
  const [custom, setCustom] = useState({ name: "", address: "" });
  const done = () => {
    // The card reloads with the new place; start fresh next time.
    setPicked(null);
    setOpen(false);
    setBook(null);
    setQuery("");
    setElsewhere(false);
    setCustom({ name: "", address: "" });
  };
  const change = async (key: string, params: Record<string, unknown>) => {
    setPicked(key);
    await onAct("changePlace", () => run("changeCrewPlace", auth, { cycleId: c.cycleId, ...params }));
    done();
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
  const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
  return (
    <div className="flex flex-col gap-2.5">
      {c.swapOffer && (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-fm-line px-4 py-3.5">
          <p className="m-0 min-w-0 flex-1 text-sm text-fm-ink">{c.swapOffer.name} was just added. Nobody has voted yet. Use it instead?</p>
          <Button small disabled={busy !== null} onClick={() => void change(c.swapOffer!.spotId, { spotId: c.swapOffer!.spotId })}>{busy === "changePlace" ? "Switching…" : `Use ${c.swapOffer.name}`}</Button>
        </div>
      )}
      {!open ? (
        <div><Button small kind="ghost" onClick={() => void show()}>Change the place</Button></div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-fm-line p-3">
          <Mono className="px-1 text-fm-muted">{c.state === "polling" ? "Same dates · anywhere you like" : "Same day and time · anywhere you like"}</Mono>
          {c.state === "booked" && <p className="m-0 px-1 text-sm text-fm-ink-2">You booked {c.venue?.name || "the old place"}. Cancel that booking, then book the new place.</p>}
          <label className="relative block">
            <span className="sr-only">Search for a place</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-fm-muted" />
            <VenueSearch
              value={query}
              onChange={setQuery}
              onSelect={(v) => void change(`search:${v.placeId || v.name}`, { venue: v })}
              placeholder="Search any restaurant, bar, park…"
              className="h-11 w-full rounded-xl border pl-10 pr-3 text-[16px] outline-none"
            />
          </label>
          {picked?.startsWith("search:") && <p className="m-0 px-1 text-sm text-fm-muted">Switching…</p>}

          {!book ? (
            <p className="m-0 px-1 text-sm text-fm-muted">Loading the book…</p>
          ) : choices.length > 0 && (
            <>
              <Mono className="mt-1 px-1 text-fm-muted">From the book</Mono>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {choices.map((b) => (
                  <li key={b.spotId} className="flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] text-fm-ink">{b.name}</span>
                      {(b.neighborhood || b.category) && <span className="truncate text-xs text-fm-muted">{b.neighborhood || b.category}</span>}
                    </span>
                    <Button small disabled={busy !== null} onClick={() => void change(b.spotId, { spotId: b.spotId })}>
                      {picked === b.spotId ? "Switching…" : "Use this"}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!elsewhere ? (
            <button type="button" onClick={() => setElsewhere(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-fm-line px-3 text-left text-[15px] text-fm-ink hover:border-fm-ink-2">
              <MapPin size={16} aria-hidden className="text-fm-muted" /> Somewhere else, like someone&rsquo;s place
            </button>
          ) : (
            <form
              className="flex flex-col gap-2 rounded-xl border border-fm-line-dim p-3"
              onSubmit={(e) => { e.preventDefault(); void change("custom", { custom }); }}
            >
              <span className="text-sm font-semibold text-fm-ink">Somewhere else, just for this one</span>
              <input className={field} placeholder="What to call it (Maya's place)" maxLength={80} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} aria-label="Place name" />
              <input className={field} placeholder="Address (optional)" maxLength={200} value={custom.address} onChange={(e) => setCustom({ ...custom, address: e.target.value })} aria-label="Address, optional" />
              <p className="m-0 text-xs text-fm-muted">Only the crew sees it. It isn&rsquo;t added to the book.</p>
              <div className="flex gap-2">
                <Button small type="submit" disabled={busy !== null || custom.name.trim().length < 2}>{picked === "custom" ? "Switching…" : "Use this place"}</Button>
                <Button small kind="ghost" onClick={() => setElsewhere(false)}>Back</Button>
              </div>
            </form>
          )}
          <button type="button" onClick={() => done()} className="min-h-11 w-fit px-1 text-sm text-fm-muted underline underline-offset-4">Never mind</button>
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

/**
 * A watched event found a date (organizer only): "Apparently Kidding is Sat
 * 11/14 at Union Hall. You look free. It's a go?" Go starts the night and
 * sends the plan invites; Skip lets it pass. No answer in 2 days skips it.
 */
function EventMatchCard({ match: m, busy, onAnswer }: { match: EventMatch; busy: string | null; onAnswer: (go: boolean) => void }) {
  const d = dayParts(m.date);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{m.query ? `Watching for ${m.query}` : "An event"} · It&rsquo;s on</Eyebrow>
        <span className="rounded-full bg-fm-card px-2 py-0.5 font-fm-mono text-[10px] tracking-[0.06em] text-fm-accent">BETA</span>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-[72px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-fm-line bg-fm-card">
          <Mono className="text-[10px] text-fm-muted">{d.month}</Mono>
          <span className="font-fm-serif text-[32px] leading-none">{d.day}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 font-fm-serif text-[28px] font-normal leading-[1.05]">{m.title}</h2>
          <p className="m-0 text-sm text-fm-muted">
            {d.dow}{m.time ? ` · ${timeLabel(m.time)}` : ""} · {m.watchParty ? "Away game" : m.venueName}
          </p>
          {m.free && <p className="m-0 text-sm text-fm-accent">You look free.</p>}
        </div>
      </div>
      <p className="m-0 text-sm text-fm-ink-2">
        {m.watchParty
          ? "Watch it together? Leaf picks a spot from the book and the crew gets the invite for this date."
          : "It\u2019s a go? The crew gets the invite for this date, with the ticket link."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button small disabled={busy !== null} onClick={() => onAnswer(true)}>{busy === `ev-${m.spotId}` ? "Sending…" : "It\u2019s a go"}</Button>
        <Button small kind="ghost" disabled={busy !== null} onClick={() => onAnswer(false)}>Skip this one</Button>
        {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="ml-1 text-sm text-fm-ink-2 underline underline-offset-4">{m.watchParty ? "Game details" : "See tickets"}</a>}
      </div>
    </Card>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Birthdays on, your birthday's coming up: where do you want to go? A place
 * from the book, any place, or Leaf picks. Leaf then finds a date that week.
 */
function BirthdayPick({ ask, auth, book, onDone }: { ask: { date: string }; auth: CrewAuth; book: BookSpot[]; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const d = dayParts(ask.date);
  const pick = async (key: string, params: Record<string, unknown>) => {
    setBusy(key);
    setNote("");
    try {
      const r = await run<{ started: boolean; queued?: boolean }>("pickBirthdayPlace", auth, params);
      if (r.queued) setNote("Got it. The crew has a night in the works; Leaf starts yours right after.");
      onDone();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  };
  const places = book.filter((b) => b.locationId && !b.needsPlace).slice(0, 4);
  return (
    <Card className="flex flex-col gap-4">
      <Eyebrow>Your birthday · {d.dow}, {d.month} {d.day}</Eyebrow>
      <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-tight">Where do you want to go?</h2>
      <p className="m-0 text-sm text-fm-ink-2">Pick a spot. Leaf finds a night that week that works for everyone, and you don&rsquo;t have to organize your own party.</p>
      {places.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {places.map((b) => (
            <li key={b.spotId} className="flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[15px]">{b.name}</span>
              <Button small disabled={busy !== null} onClick={() => void pick(b.spotId, { spotId: b.spotId })}>{busy === b.spotId ? "Saving…" : "This one"}</Button>
            </li>
          ))}
        </ul>
      )}
      <label className="relative block">
        <span className="sr-only">Search for a place</span>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-fm-muted" />
        <VenueSearch
          value={query}
          onChange={setQuery}
          onSelect={(v) => void pick("search", { venue: v, placeId: v.placeId })}
          placeholder="Anywhere: a restaurant, a bar, a rooftop…"
          className="h-11 w-full rounded-xl border pl-10 pr-3 text-[16px] outline-none"
        />
      </label>
      <button type="button" disabled={busy !== null} onClick={() => void pick("leaf", { leafPicks: true })} className="w-fit text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink">
        {busy === "leaf" ? "Saving…" : "Surprise me: let Leaf pick"}
      </button>
      {note && <p className="m-0 text-sm text-fm-ink-2">{note}</p>}
    </Card>
  );
}

/** Birthdays on and Leaf doesn't know yours: month and day, no year. */
function AddBirthday({ auth, onDone }: { auth: CrewAuth; onDone: () => void }) {
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await run("setMyBirthday", auth, { month, day });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };
  const field = "h-11 rounded-xl border border-fm-line bg-fm-canvas px-3 text-[15px] text-fm-ink";
  return (
    <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
      <h2 className="m-0 font-fm-serif text-[24px] font-normal leading-tight">When&rsquo;s your birthday?</h2>
      <p className="mb-0 mt-2 text-[14px] leading-relaxed text-fm-ink-2">This crew celebrates birthdays: the night nearest yours is yours, and you pick where. Month and day only.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="bday-month">Month</label>
        <select id="bday-month" className={field} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          <option value={0}>Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <label className="sr-only" htmlFor="bday-day">Day</label>
        <select id="bday-day" className={field} value={day} onChange={(e) => setDay(Number(e.target.value))}>
          <option value={0}>Day</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <Button small disabled={busy || !month || !day} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
        <Button small kind="ghost" onClick={() => setHidden(true)}>Not now</Button>
      </div>
      {error && <p className="mb-0 mt-2 text-sm text-fm-danger">{error}</p>}
    </section>
  );
}

const FREE_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const FREE_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREE_TIMES = [{ time: "10:00", label: "Morning" }, { time: "14:00", label: "Afternoon" }, { time: "19:00", label: "Evening" }];

/**
 * Organizer: When we're free (BETA). On, Leaf plans a night when a share of
 * the crew (half, 60%…) are free the same day (synced calendars); turning it on asks the
 * members who haven't synced to sync.
 */
function FreeRuleRow({ rule, label, usualTime, busy, onSave }: {
  rule: FreeRule | null; label: string | null; usualTime: string | null; busy: boolean;
  onSave: (rule: Omit<FreeRule, "kind" | "everyDays"> | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [minPct, setMinPct] = useState(rule?.minPct ?? 50);
  const [days, setDays] = useState<number[]>(rule?.days ?? [5, 6]);
  const [time, setTime] = useState(rule?.time ?? (FREE_TIMES.some((t) => t.time === usualTime) ? usualTime! : "19:00"));
  return (
    <div className="border-b border-fm-line-dim py-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold">When we&rsquo;re free <span className="rounded-full bg-fm-card px-1.5 py-0.5 font-fm-mono text-[9px] tracking-[0.06em] text-fm-accent">BETA</span></div>
          <div className="text-[13px] text-fm-muted">
            {rule && label ? <>{label} · <button type="button" className="underline underline-offset-2" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit"}</button></>
              : "Leaf plans a night when enough of you are free the same day, from synced calendars."}
          </div>
        </div>
        <FriendModeSwitch
          label="When we're free"
          checked={Boolean(rule)}
          disabled={busy}
          onChange={(v) => {
            if (v) setEditing(true);
            else { setEditing(false); void onSave(null); }
          }}
        />
      </div>
      {editing && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-fm-line bg-fm-canvas p-3.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-fm-ink-2">When at least</span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="Fewer of the crew" onClick={() => setMinPct(Math.max(20, minPct - 10))} className="h-8 w-8 rounded-full border border-fm-line">&minus;</button>
              <span className="w-28 text-center font-fm-serif text-[19px]">{pctLabel(minPct)} free</span>
              <button type="button" aria-label="More of the crew" onClick={() => setMinPct(Math.min(100, minPct + 10))} className="h-8 w-8 rounded-full border border-fm-line">+</button>
            </span>
          </div>
          <div className="flex gap-1">
            {FREE_DAYS.map((d, i) => {
              const on = days.includes(i);
              return (
                <button key={i} type="button" aria-label={FREE_DAY_NAMES[i]} aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])}
                  className={`h-9 flex-1 rounded-lg border text-xs font-semibold ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}>
                  {d}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {FREE_TIMES.map((t) => (
              <button key={t.time} type="button" aria-pressed={time === t.time} onClick={() => setTime(t.time)}
                className={`h-8 flex-1 rounded-full border text-xs font-semibold ${time === t.time ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="m-0 text-xs text-fm-muted">Of the crew, so it keeps up as people join (never fewer than 2). Only Google Calendars count for now. Leaf asks everyone who hasn&rsquo;t synced theirs to sync.</p>
          <div className="flex gap-2">
            <Button small disabled={busy || days.length === 0} onClick={() => void onSave({ minPct, days, time }).then(() => setEditing(false))}>{rule ? "Save" : "Turn on"}</Button>
            <Button small kind="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
