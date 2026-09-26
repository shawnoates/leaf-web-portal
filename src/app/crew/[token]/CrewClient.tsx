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

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, ChevronUp, Plus, Settings, UserPlus } from "lucide-react";
import Parse from "@/lib/parse-client";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import {
  Avatar, Button, Card, CrewShell, CrewTopBar, DeadState, DisplayTitle, Eyebrow, Mono, SectionTitle, Spinner, useInApp,
} from "@/components/crew/CrewShell";
import ProposeNight from "@/components/crew/ProposeNight";
import { FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";
import {
  RHYTHM_LABELS, crewHref, cycleStatusLine, dayParts, rhythmLabel, cadenceLabel, run, spotHref, timeLabel, toDate,
  type CrewAuth, type CrewPage, type CycleView, type Member,
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
  const { crew, me, members, names, open, past, book } = data;
  const [pace, setPace] = useState<string>(me.rhythmDays ? String(me.rhythmDays) : "");
  const [proposing, setProposing] = useState(false);
  const inApp = useInApp();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [error, setError] = useState("");
  // "Text me about this crew's plans": never pre-ticked (10DLC).
  const [smsBox, setSmsBox] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Invite: the owner picks followers not yet invited; anyone in can share the link.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitable, setInvitable] = useState<{ userId: string; name: string; pending?: boolean }[] | null>(null);
  const [invitePicked, setInvitePicked] = useState<Set<string>>(new Set());
  const [inviteNote, setInviteNote] = useState("");
  const [linkDone, setLinkDone] = useState("");
  const openInvite = () => {
    setInviteOpen(true);
    setInviteNote("");
    setLinkDone("");
    if (me.isOwner) {
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
    const text = `Join ${crew.name} on Leaf — we're planning get-togethers: ${me.inviteLink}`;
    try {
      if (navigator.share) { await navigator.share({ title: crew.name, text }); setLinkDone("Shared"); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(me.inviteLink); setLinkDone("Link copied"); } catch { /* ignore */ }
  };
  // Calendar sync needs a Leaf sign-in (a crew link alone isn't an account session).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(Boolean(Parse.User.current())); }, []);
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
  const canStart = open.length < 2 && !open.some((c) => c.state === "picking" && !c.waitingForQuorum);
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

  return (
    <CrewShell wide topBar={<CrewTopBar auth={auth} active="crew" />}>
      {error && <p className="mb-4 rounded-2xl bg-[#3A2321] px-4 py-3 text-sm text-fm-danger">{error}</p>}

      <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-[72px]">
        {/* Who the crew is */}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-8">
          <div className="flex flex-col gap-4">
            <DisplayTitle italic={second && <span className="block">{second}</span>}>{first}</DisplayTitle>
            <div className="flex items-center gap-3">
              <div className="flex lg:hidden">
                {[...joined, ...invited].slice(0, 5).map((m, i) => (
                  <span key={m.membershipId} className={i ? "-ml-2.5" : ""}>
                    <Avatar name={m.name} src={m.avatar} invited={m.status === "invited"} ring="ring-2 ring-fm-canvas" />
                  </span>
                ))}
              </div>
              <p className="m-0 text-sm text-fm-ink-2 lg:text-[15px]">{summary}</p>
              <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-2">
                {me.inviteLink && (
                  <button className="flex items-center gap-1.5 text-sm font-medium text-fm-ink hover:underline" onClick={openInvite}>
                    <UserPlus size={15} aria-hidden /> Invite
                  </button>
                )}
                <button className="flex items-center gap-1.5 text-sm font-medium text-fm-ink hover:underline" onClick={() => setSettingsOpen(true)}>
                  <Settings size={15} aria-hidden /> Settings
                </button>
              </div>
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
                onChange={(v) => act("fm", () => Parse.Cloud.run("setFriendModeOnCalendar", { calendarId: crew.id, enabled: v }))}
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
          <section className="flex flex-col gap-3 lg:gap-5">
            {me.status === "invited" && (
              <Card>
                <Eyebrow>You&rsquo;re invited</Eyebrow>
                <p className="mt-3 text-[15px] leading-relaxed text-fm-ink-2">
                  Join {crew.name} and Leaf finds a night that works for the group and plans it{crew.oneTime ? "" : `, ${rhythmLabel(crew.rhythmDays).toLowerCase()}`}.
                </p>
                <SmsOptInBox checked={smsBox} onChange={setSmsBox} phone={smsPhone} onPhone={setSmsPhone} last4={me.phoneLast4 ?? null} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => act("join", () => run("respondToCrewInvite", auth, { accept: true, sms: smsBox, phone: smsBox ? smsPhone || null : null }))} disabled={busy !== null || !phoneOk}>
                    Join
                  </Button>
                  <Button kind="ghost" onClick={() => act("decline", () => run("respondToCrewInvite", auth, { accept: false }))} disabled={busy !== null}>
                    No thanks
                  </Button>
                </div>
              </Card>
            )}

            <div className="hidden items-center justify-between lg:flex">
              <SectionTitle>Up next</SectionTitle>
              {canStart && !proposing && <div className="flex gap-2">{startButtons}</div>}
            </div>

            {open.length === 0 && (
              <Card>
                <Eyebrow>Nothing being planned</Eyebrow>
                <p className="mt-3 text-[15px] leading-relaxed text-fm-ink-2">
                  {crew.oneTime ? "Leaf starts planning the night as soon as enough people are in." : `Leaf starts the next night on its own (${rhythmLabel(crew.rhythmDays).toLowerCase()}). Got a place and a date in mind? Say so below.`}
                </p>
              </Card>
            )}

            {open.length > 0 && (
              <div className={`grid gap-3 lg:gap-4 ${open.length > 1 ? "lg:grid-cols-2" : ""}`}>
                {open.map((c) => (
                  <CycleCard key={c.cycleId} cycle={c} names={names} members={members} busy={busy} onAct={act} auth={auth} quorum={crew.quorum} joined={joined.length} />
                ))}
              </div>
            )}

            {canStart && !proposing && <div className="flex lg:hidden">{startButtons}</div>}
            {proposing && (
              <ProposeNight
                auth={auth}
                onDone={async () => { setProposing(false); await reload(); }}
                onCancel={() => setProposing(false)}
              />
            )}
          </section>

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
                      {s.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden className="absolute bottom-2.5 left-3 font-fm-serif text-[44px] leading-[0.8] text-fm-line lg:text-[52px]">{s.name.charAt(0)}</span>
                      )}
                      <span className="absolute bottom-2.5 right-2.5 flex h-[26px] items-center gap-1 rounded-full bg-fm-canvas px-2.5 text-xs font-semibold">
                        <ChevronUp size={13} strokeWidth={2.6} aria-hidden /> {s.upvotes}
                        <span className="sr-only"> want to go</span>
                      </span>
                    </div>
                    <div>
                      <div className="truncate text-[15px] font-semibold lg:text-base">{s.name}</div>
                      <div className="truncate text-[13px] text-fm-muted">{[s.neighborhood, s.triedAt ? "tried" : null].filter(Boolean).join(" · ") || s.category}</div>
                    </div>
                   </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={`grid gap-10 ${past.length > 0 ? "lg:grid-cols-2 lg:gap-12" : ""}`}>
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

            <section className="flex flex-col gap-2.5 lg:max-w-[640px] lg:gap-3">
              <SectionTitle>Tell Leaf</SectionTitle>
              <p className="m-0 text-sm text-fm-muted">Only Leaf sees this. Days that never work, places to avoid, anything.</p>
              {noteSent ? (
                <p className="m-0 flex items-center gap-1.5 text-sm text-fm-ink-2"><Check size={16} aria-hidden /> Got it. Thanks.</p>
              ) : (
                <form
                  className="flex h-14 items-center gap-2 rounded-full border border-fm-line bg-fm-surface pl-[18px] pr-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    act("note", async () => { await run("crewTellLeaf", auth, { text: note }); setNoteSent(true); });
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
          </div>
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
              <button aria-label="Close" className="text-xl leading-none text-fm-muted" onClick={() => setInviteOpen(false)}>×</button>
            </div>

            {me.isOwner && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <Eyebrow>Followers not in yet</Eyebrow>
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
                  <p className="mt-2 text-sm text-fm-muted">Everyone who follows the calendar is in, or was invited in the last two weeks.</p>
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
              <div className="text-[15px] font-semibold">{me.isOwner ? "Or share the invite link" : "Share the invite link"}</div>
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
              <button aria-label="Close" className="text-xl leading-none text-fm-muted" onClick={() => setSettingsOpen(false)}>×</button>
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
                  {Object.entries(RHYTHM_LABELS).map(([d, l]) => (
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
  cycle: c, names, members, busy, onAct, auth, quorum, joined,
}: {
  cycle: CycleView;
  names: Record<string, string>;
  members: Member[];
  busy: string | null;
  onAct: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  auth: CrewAuth;
  quorum: number;
  joined: number;
}) {
  // Not voted yet: start from the dates their calendar says they're free.
  const [picked, setPicked] = useState<Set<number>>(new Set(c.myVotes ?? c.myFree ?? []));
  const prefilled = c.myVotes === null && (c.myFree?.length ?? 0) > 0;
  const [saved, setSaved] = useState(c.myVotes !== null);
  const goingIds = Object.entries(c.rsvps).filter(([, r]) => r === "in").map(([id]) => id);
  const going = goingIds.map((id) => names[id] || "Someone");
  const closes = toDate(c.pollClosesAt);
  const settled = c.state === "locked" || c.state === "booked";
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
          <h2 className="m-0 font-fm-serif text-[34px] font-normal leading-[1.05] lg:text-[40px]">{c.venue?.name || "Picking a place…"}</h2>
          <p className="m-0 text-sm text-fm-muted">
            {settled && c.chosenOption
              ? [chosen?.dow, timeLabel(c.chosenOption.time), c.venue?.address].filter(Boolean).join(" · ")
              : c.venue?.address || cycleStatusLine(c, names)}
          </p>
        </div>
      </div>

      {c.invited === false && (
        <p className="m-0 text-xs text-fm-muted">You&rsquo;re sitting this one out (your pace). Answer here anyway if you want in.</p>
      )}

      {c.state === "picking" && (
        <p className="m-0 text-[15px] text-fm-ink-2">
          {c.waitingForQuorum
            ? `${joined} of ${quorum} needed have joined. Leaf starts planning as soon as the rest say IN.`
            : "Leaf is picking a place. You'll get the dates to vote on next."}
        </p>
      )}

      {c.state === "polling" && (
        <>
          <p className="m-0 text-[15px] text-fm-ink-2">
            {prefilled ? "Your calendar says you're free for the ones picked. Change anything, then save." : "Which nights work? Pick all that do."}
          </p>
          <ul className="grid grid-cols-3 gap-2 lg:gap-2.5">
            {c.options.map((o, i) => {
              const p = dayParts(o.date);
              const on = picked.has(i);
              const baseCount = c.votes ? Object.values(c.votes).filter((v) => v.includes(i)).length : 0;
              // Show the count as it will be once this member saves.
              const count = baseCount - (c.myVotes?.includes(i) ? 1 : 0) + (on ? 1 : 0);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => { const n = new Set(picked); if (on) n.delete(i); else n.add(i); setPicked(n); setSaved(false); }}
                    className={`flex h-[116px] w-full flex-col items-start justify-between rounded-[18px] border p-3 text-left transition lg:h-[124px] lg:rounded-[20px] lg:p-3.5 ${
                      on ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line bg-fm-canvas text-fm-ink hover:border-fm-ink-2"
                    }`}
                  >
                    <Mono className={`whitespace-nowrap ${on ? "" : "text-fm-muted"}`}>{p.dow}{o.time ? ` ${timeLabel(o.time)}` : ""}</Mono>
                    <span className="font-fm-serif text-[34px] leading-none lg:text-[38px]">{p.month} {p.day}</span>
                    <span className={`text-xs ${on ? "font-semibold" : "text-fm-muted"}`}>
                      {count} can
                      {c.fit?.[i] && c.fit[i].known > 0 ? ` · ${c.fit[i].free} of ${c.fit[i].known} free` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button
            block
            disabled={busy !== null || saved}
            onClick={() => onAct("vote", async () => { await run("crewVote", auth, { cycleId: c.cycleId, options: [...picked] }); setSaved(true); })}
          >
            {saved ? <><Check size={18} aria-hidden /> Saved</> : picked.size ? "Save my picks" : "None work for me"}
          </Button>
        </>
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

          {c.isHost && c.state === "locked" && (
            <div className="flex items-center gap-3 rounded-[18px] bg-fm-card px-4 py-3.5">
              <p className="m-0 flex-1 text-sm leading-snug text-fm-ink-2">You&rsquo;re booking this one. Tap when it&rsquo;s done and Leaf tells everyone.</p>
              <Button kind="ghost" small disabled={busy !== null} onClick={() => onAct("booked", () => run("markCrewBooked", auth, { cycleId: c.cycleId }))}>
                Booked
              </Button>
            </div>
          )}
          {c.state === "booked" && (
            <p className="m-0 flex items-center gap-1.5 text-sm text-fm-ink-2"><Check size={16} aria-hidden /> Booked</p>
          )}
        </>
      )}
    </Card>
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
