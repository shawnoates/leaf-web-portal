"use client";

/**
 * The crew page — /crew/[token]
 *
 * Read on a phone, from a text. One job: let a member answer whatever the crew
 * needs from them right now (vote on dates, IN/OUT, mark it booked), and show
 * the nights coming up and the ones that happened. Members are names only;
 * no phone numbers reach this page.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import { Button, Card, CrewHeader, CrewShell, DeadState, Eyebrow, Spinner } from "@/components/crew/CrewShell";
import ProposeNight from "@/components/crew/ProposeNight";
import { FM, FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";
import {
  RHYTHM_LABELS, crewHref, cycleStatusLine, dayLabel, optionLabel, rhythmLabel, run, toDate,
  type CrewAuth, type CrewPage, type CycleView,
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

function CrewPageView({ auth, data, reload }: { auth: CrewAuth; data: CrewPage; reload: () => Promise<void> }) {
  const { crew, me, members, names, open, past, book } = data;
  const [pace, setPace] = useState<string>(me.rhythmDays ? String(me.rhythmDays) : "");
  const [proposing, setProposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <CrewShell>
      <CrewHeader
        crewName={crew.name}
        subtitle={`${rhythmLabel(crew.rhythmDays)} · ${joined.length} in${crew.status === "paused" ? " · paused" : ""}`}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {open.length === 0 && (
        <Card className="mb-4">
          <Eyebrow>Nothing being planned</Eyebrow>
          <p className="mt-2 text-[15px] text-zinc-700">
            Leaf will start the next night on its own ({rhythmLabel(crew.rhythmDays).toLowerCase()}). Or start one now.
          </p>
        </Card>
      )}

      {open.map((c) => (
        <CycleCard key={c.cycleId} cycle={c} names={names} busy={busy} onAct={act} auth={auth} quorum={crew.quorum} joined={joined.length} />
      ))}

      {canStart && !proposing && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button onClick={() => act("plan", () => run("startCrewCycleForMember", auth))} disabled={busy !== null}>
            Plan something
          </Button>
          <Button kind="ghost" onClick={() => setProposing(true)}>
            I&rsquo;ve got one
          </Button>
        </div>
      )}
      {proposing && (
        <ProposeNight
          auth={auth}
          onDone={async () => { setProposing(false); await reload(); }}
          onCancel={() => setProposing(false)}
        />
      )}

      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <Eyebrow>{crew.name}&rsquo;s book</Eyebrow>
          <Button href={crewHref(auth, "book")} kind="ghost" small>Open the book</Button>
        </div>
        {book.length === 0 ? (
          <p className="mt-2 text-[15px] text-zinc-700">
            No places yet. Add a few you&rsquo;ve been wanting to try and Leaf will plan nights around them.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {book.map((s) => (
              <li key={s.spotId} className="flex items-center justify-between py-2 text-[15px]">
                <span className="text-leaf-900">
                  {s.name}
                  {s.triedAt && <span className="ml-2 text-xs text-zinc-500">tried ✓</span>}
                </span>
                <span className="text-xs text-zinc-500">👍 {s.upvotes}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <Eyebrow>Members</Eyebrow>
        <ul className="mt-3 flex flex-wrap gap-2">
          {joined.map((m) => (
            <li key={m.membershipId} className="rounded-full bg-leaf-50 px-3 py-1 text-sm text-leaf-900">
              {m.name}{m.userId === crew.ownerId ? " · started it" : ""}
            </li>
          ))}
          {invited.map((m) => (
            <li key={m.membershipId} className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-sm text-zinc-500">
              {m.name} · invited
            </li>
          ))}
        </ul>
        {crew.joinedCount < crew.quorum && (
          <p className="mt-3 text-sm text-zinc-600">
            Waiting on {crew.quorum - crew.joinedCount} more to join before Leaf plans the first night.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
          <label htmlFor="my-pace">How often for you</label>
          <select
            id="my-pace"
            value={pace}
            disabled={busy !== null}
            onChange={(e) => {
              const v = e.target.value;
              setPace(v);
              act("pace", () => run("setCrewPace", auth, { weeks: v ? Number(v) / 7 : null }));
            }}
            className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Same as the crew ({rhythmLabel(crew.rhythmDays).toLowerCase()})</option>
            {Object.entries(RHYTHM_LABELS).map(([d, l]) => (
              <option key={d} value={d}>{l}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">Slower than the crew? Leaf only asks you on your pace.</span>
        </div>
      </Card>

      {past.length > 0 && (
        <Card className="mb-4">
          <Eyebrow>Past nights</Eyebrow>
          <ul className="mt-3 divide-y divide-zinc-100">
            {past.map((p) => {
              const d = toDate(p.startsAt);
              return (
                <li key={p.cycleId} className="flex items-center justify-between py-2 text-[15px]">
                  <span className="text-leaf-900">{p.venue?.name || "A night out"}</span>
                  <span className="text-xs text-zinc-500">
                    {d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} · {p.headcount} went
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <Eyebrow>Tell Leaf</Eyebrow>
        <p className="mt-1 text-sm text-zinc-600">Only Leaf sees this. Days that never work, places to avoid, anything.</p>
        {noteSent ? (
          <p className="mt-3 text-sm text-leaf-700">Got it. Thanks.</p>
        ) : (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              act("note", async () => { await run("crewTellLeaf", auth, { text: note }); setNoteSent(true); });
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Mondays never work for me"
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-[15px]"
            />
            <Button type="submit" small disabled={busy !== null || !note.trim()}>Send</Button>
          </form>
        )}
      </Card>

      {me.isOwner && (
        <Card className="mb-4">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-leaf-900">Friend Mode</p>
              <p className="mt-0.5 text-[13px]" style={{ color: crew.enabled === false ? FM.mutedText : FM.accent }}>
                {crew.enabled === false ? "Off · nothing is planned or texted" : "On · Leaf plans nights for this group"}
              </p>
            </div>
            <FriendModeSwitch
              label="Friend Mode"
              checked={crew.enabled !== false}
              disabled={busy !== null}
              onChange={(v) => act("fm", () => Parse.Cloud.run("setFriendModeOnCalendar", { calendarId: crew.id, enabled: v }))}
            />
          </div>
          {crew.enabled === false && <p className="mt-2 text-xs text-zinc-500">Turning it off ended any night being planned. Past nights stay.</p>}
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        {crew.status === "active" ? (
          <button className="text-zinc-500 hover:underline" onClick={() => act("pause", () => run("setCrewPaused", auth, { paused: true }))}>
            Pause the crew
          </button>
        ) : (
          <button className="text-leaf-700 hover:underline" onClick={() => act("resume", () => run("setCrewPaused", auth, { paused: false }))}>
            Resume the crew
          </button>
        )}
        <button
          className="text-zinc-500 hover:underline"
          onClick={() => {
            if (window.confirm(`Leave ${crew.name}? Leaf will stop texting you about it.`)) {
              act("leave", async () => { await run("leaveCrew", auth); window.location.reload(); });
            }
          }}
        >
          Leave
        </button>
      </div>
    </CrewShell>
  );
}

function CycleCard({
  cycle: c, names, busy, onAct, auth, quorum, joined,
}: {
  cycle: CycleView;
  names: Record<string, string>;
  busy: string | null;
  onAct: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  auth: CrewAuth;
  quorum: number;
  joined: number;
}) {
  const [picked, setPicked] = useState<Set<number>>(new Set(c.myVotes || []));
  const [saved, setSaved] = useState(c.myVotes !== null);
  const going = Object.entries(c.rsvps).filter(([, r]) => r === "in").map(([id]) => names[id] || "Someone");
  const closes = toDate(c.pollClosesAt);

  return (
    <Card className="mb-4 border-leaf-200">
      <Eyebrow>{c.trigger === "member_proposal" ? `${names[c.hostId || ""] || "A member"}'s idea` : "Next night"}</Eyebrow>
      <h2 className="mt-1 text-lg font-semibold text-leaf-900">{c.venue?.name || "Picking a place…"}</h2>
      {c.venue?.address && <p className="text-sm text-zinc-500">{c.venue.address}</p>}
      <p className="mt-1 text-sm text-zinc-600">{cycleStatusLine(c, names)}</p>
      {c.invited === false && (
        <p className="mt-1 text-xs text-zinc-500">You&rsquo;re sitting this one out (your pace). Answer here anyway if you want in.</p>
      )}

      {c.state === "picking" && c.waitingForQuorum && (
        <p className="mt-3 text-[15px] text-zinc-700">
          {joined} of {quorum} needed have joined. Leaf starts planning as soon as the rest say IN.
        </p>
      )}

      {c.state === "polling" && (
        <div className="mt-4">
          <p className="text-[15px] text-zinc-800">Which nights work? Pick all that do.</p>
          <ul className="mt-2 space-y-2">
            {c.options.map((o, i) => {
              const count = c.votes ? Object.values(c.votes).filter((v) => v.includes(i)).length : 0;
              const on = picked.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => { const n = new Set(picked); if (on) n.delete(i); else n.add(i); setPicked(n); setSaved(false); }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] ${
                      on ? "border-leaf-700 bg-leaf-50 text-leaf-900" : "border-zinc-300 text-zinc-800"
                    }`}
                  >
                    <span>{optionLabel(o)}</span>
                    <span className="text-xs text-zinc-500">{count} can</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null || saved}
              onClick={() => onAct("vote", async () => { await run("crewVote", auth, { cycleId: c.cycleId, options: [...picked] }); setSaved(true); })}
            >
              {saved ? "Saved" : picked.size ? "Save my picks" : "None work for me"}
            </Button>
            {closes && <span className="text-xs text-zinc-500">Closes {closes.toLocaleDateString("en-US", { weekday: "short", hour: "numeric" })}</span>}
          </div>
        </div>
      )}

      {(c.state === "locked" || c.state === "booked") && (
        <div className="mt-4">
          {c.chosenOption && <p className="text-[15px] font-medium text-leaf-900">{dayLabel(c.chosenOption.date)} at {c.venue?.name}</p>}
          <p className="mt-1 text-sm text-zinc-600">Going: {going.length ? going.join(", ") : "nobody yet"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              kind={c.myRsvp === "in" ? "primary" : "ghost"}
              disabled={busy !== null}
              onClick={() => onAct("in", () => run("crewRsvp", auth, { cycleId: c.cycleId, going: true }))}
            >
              {c.myRsvp === "in" ? "You're in ✓" : "I'm in"}
            </Button>
            <Button
              kind={c.myRsvp === "out" ? "primary" : "ghost"}
              disabled={busy !== null}
              onClick={() => onAct("out", () => run("crewRsvp", auth, { cycleId: c.cycleId, going: false }))}
            >
              {c.myRsvp === "out" ? "You're out" : "Can't make it"}
            </Button>
          </div>
          {c.isHost && c.state === "locked" && (
            <div className="mt-4 rounded-xl bg-leaf-50 p-3 text-sm">
              <p className="text-leaf-900">You&rsquo;re booking this one. Tap when it&rsquo;s done and Leaf tells everyone.</p>
              <div className="mt-2">
                <Button small disabled={busy !== null} onClick={() => onAct("booked", () => run("markCrewBooked", auth, { cycleId: c.cycleId }))}>
                  Booked ✓
                </Button>
              </div>
            </div>
          )}
          {c.state === "booked" && <p className="mt-3 text-sm text-leaf-700">Booked ✓</p>}
        </div>
      )}
    </Card>
  );
}
