"use client";

/**
 * The venue's proposal form — /o/v/[token]
 *
 * Linked from Shawn's venue offer email. Read by a manager on a phone during
 * a shift, so what Leaf found about the room is filled in ("we found this,
 * fix anything wrong"), and the rest is taps: does the date work, how many
 * fit, what you'd like in return, house rules, would you do it again. No
 * account. The answer lands on Leaf's side next to the other rooms, so Shawn
 * picks without retyping anything.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

type InReturn = "nothing" | "minimum_tab" | "purchase_expected";
type Repeat = "yes" | "maybe" | "one_off";
type Placard = "yes" | "maybe" | "no";

type Form = {
  state: "invited" | "submitted" | "chosen" | "declined" | "declined_next_time" | "expired" | "unavailable";
  dateLabel: string;
  timeLabel: string;
  durationMin: number;
  headcount: string;
  merchantName: string;
  taster: string;
  neighborhood: string;
  calendarUrl: string | null;
  venue: { name: string; address: string; categoryLabel: string; hoursText: string[] };
  answers: {
    dateWorks: boolean | null;
    otherTime: string;
    capacity: number | null;
    wantsInReturn: InReturn | null;
    wantsInReturnNote: string;
    conditions: string;
    wantsRepeat: Repeat | null;
    runsWorkshops: boolean | null;
    placard: Placard | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
};

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

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 focus:border-leaf-600 focus:outline-none";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">{children}</span>;
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-[15px] font-medium transition-colors ${
        on ? "border-leaf-700 bg-leaf-800 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function VenueProposalClient({ token }: { token: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [declining, setDeclining] = useState(false);

  const [address, setAddress] = useState("");
  const [dateWorks, setDateWorks] = useState<boolean | null>(null);
  const [otherTime, setOtherTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [wantsInReturn, setWantsInReturn] = useState<InReturn | null>(null);
  const [wantsInReturnNote, setWantsInReturnNote] = useState("");
  const [conditions, setConditions] = useState("");
  const [wantsRepeat, setWantsRepeat] = useState<Repeat | null>(null);
  const [runsWorkshops, setRunsWorkshops] = useState<boolean | null>(null);
  const [placard, setPlacard] = useState<Placard | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const load = useCallback(async () => {
    try {
      const f = (await Parse.Cloud.run("getVenueProposalForm", { token })) as Form;
      setForm(f);
      if (f.state !== "unavailable") {
        const a = f.answers;
        setAddress(f.venue.address);
        setDateWorks(a.dateWorks);
        setOtherTime(a.otherTime);
        setCapacity(a.capacity ? String(a.capacity) : "");
        setWantsInReturn(a.wantsInReturn);
        setWantsInReturnNote(a.wantsInReturnNote);
        setConditions(a.conditions);
        setWantsRepeat(a.wantsRepeat);
        setRunsWorkshops(a.runsWorkshops);
        setPlacard(a.placard);
        setContactName(a.contactName);
        setContactEmail(a.contactEmail);
        setContactPhone(a.contactPhone);
      }
    } catch {
      setForm({ state: "unavailable" } as Form);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await Parse.Cloud.run("submitVenueProposalForm", {
        token,
        address,
        dateWorks,
        otherTime,
        capacity: Number(capacity),
        wantsInReturn: wantsInReturn || "nothing",
        wantsInReturnNote,
        conditions,
        wantsRepeat,
        runsWorkshops: runsWorkshops === true,
        placard,
        contactName,
        contactEmail,
        contactPhone,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await Parse.Cloud.run("submitVenueProposalForm", { token, decline: true });
      setForm((f) => (f ? { ...f, state: "declined" } : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again?");
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
  if (!form || form.state === "unavailable") {
    return <Closed title="We couldn't find this one." body="The link may have been cut off. Try tapping it again from Shawn's email, or just reply to it." />;
  }
  if (form.state === "declined") {
    return <Closed title="Thanks for letting us know." body="No problem at all. We won't ask again for a while." />;
  }
  if (form.state === "expired") {
    return <Closed title="This one has passed." body="We've sorted a room for this night. Shawn will be in touch about the next one." />;
  }
  if (form.state === "chosen") {
    return <Closed title="You're hosting this one. Thank you!" body="Shawn has emailed everyone involved with the details. Reply to that email with anything that changes." />;
  }
  if (form.state === "declined_next_time") {
    return <Closed title="We went with another spot this time." body="Thank you for coming back to us. Shawn has emailed you a date next month." />;
  }
  if (done) {
    return (
      <Closed
        title="Got it. Thank you!"
        body={`Shawn will confirm within a day. If it's you, he'll send one email with ${form.merchantName || "the host"}, the host and every detail for ${form.dateLabel}.`}
      />
    );
  }

  const canSubmit = dateWorks !== null && (dateWorks || otherTime.trim()) && Number(capacity) > 0 && contactEmail.trim() && contactPhone.trim();

  return (
    <Shell>
      <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-700">{form.neighborhood} calendar</p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-leaf-900">
        {form.dateLabel}, {form.timeLabel} at {form.venue.name}?
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
        {form.merchantName ? `${form.merchantName} runs` : "A local maker runs"} a {form.taster || "short workshop"} for {form.headcount}{" "}
        neighbors, about {form.durationMin} minutes. Everyone buys their own drinks and food, and we handle setup and cleanup.
        {form.calendarUrl && (
          <>
            {" "}
            <a href={form.calendarUrl} className="text-leaf-700 underline" target="_blank" rel="noreferrer">
              See the calendar
            </a>
            .
          </>
        )}
      </p>

      <section className="mt-8">
        <Label>Does {form.dateLabel.replace(/^\w+, /, "")} at {form.timeLabel} work?</Label>
        <div className="flex gap-2">
          <Choice on={dateWorks === true} onClick={() => setDateWorks(true)}>Yes</Choice>
          <Choice on={dateWorks === false} onClick={() => setDateWorks(false)}>Another time</Choice>
        </div>
        {dateWorks === false && (
          <input value={otherTime} onChange={(e) => setOtherTime(e.target.value)} placeholder="Tuesdays 6 to 8 are quiet for us" className={`${input} mt-3`} />
        )}
      </section>

      <section className="mt-8 flex gap-3">
        <label className="block w-32">
          <Label>How many fit?</Label>
          <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="15" className={input} />
        </label>
        <label className="block flex-1">
          <Label>Address (we found this, fix it if wrong)</Label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
        </label>
      </section>

      <section className="mt-8">
        <Label>Anything you&rsquo;d like in return?</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Choice on={wantsInReturn === "nothing"} onClick={() => setWantsInReturn("nothing")}>Nothing</Choice>
          <Choice on={wantsInReturn === "purchase_expected"} onClick={() => setWantsInReturn("purchase_expected")}>Everyone orders</Choice>
          <Choice on={wantsInReturn === "minimum_tab"} onClick={() => setWantsInReturn("minimum_tab")}>A minimum tab</Choice>
        </div>
        {wantsInReturn === "minimum_tab" && (
          <input value={wantsInReturnNote} onChange={(e) => setWantsInReturnNote(e.target.value)} placeholder="$150 across the group" className={`${input} mt-3`} />
        )}
      </section>

      <label className="mt-8 block">
        <Label>House rules (optional)</Label>
        <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Ends by 9, no outside food" className={input} />
      </label>

      <section className="mt-8">
        <Label>If it goes well, would you do it again?</Label>
        <div className="flex gap-2">
          <Choice on={wantsRepeat === "yes"} onClick={() => setWantsRepeat("yes")}>Yes</Choice>
          <Choice on={wantsRepeat === "maybe"} onClick={() => setWantsRepeat("maybe")}>Maybe</Choice>
          <Choice on={wantsRepeat === "one_off"} onClick={() => setWantsRepeat("one_off")}>Just once</Choice>
        </div>
      </section>

      <section className="mt-8">
        <Label>Do you run your own classes or workshops?</Label>
        <div className="flex gap-2">
          <Choice on={runsWorkshops === true} onClick={() => setRunsWorkshops(true)}>We do</Choice>
          <Choice on={runsWorkshops === false} onClick={() => setRunsWorkshops(false)}>No</Choice>
        </div>
      </section>

      <section className="mt-8">
        <Label>Would you keep a small Leaf card at the counter?</Label>
        <div className="flex gap-2">
          <Choice on={placard === "yes"} onClick={() => setPlacard("yes")}>Sure</Choice>
          <Choice on={placard === "maybe"} onClick={() => setPlacard("maybe")}>Maybe</Choice>
          <Choice on={placard === "no"} onClick={() => setPlacard("no")}>No thanks</Choice>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex gap-3">
          <label className="block flex-1">
            <Label>Your name</Label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" className={input} />
          </label>
          <label className="block flex-1">
            <Label>Phone for the night</Label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={input} />
          </label>
        </div>
        <label className="block">
          <Label>Best email</Label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} inputMode="email" autoComplete="email" className={input} />
        </label>
      </section>

      {error && <p className="mt-6 text-[14px] text-red-700">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canSubmit}
        className="mt-8 w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white hover:bg-leaf-900 disabled:opacity-40"
      >
        {busy ? "Sending…" : form.state === "submitted" ? "Update" : "Send"}
      </button>

      {form.state === "invited" && (
        <div className="mt-6 text-center">
          {declining ? (
            <button type="button" onClick={decline} disabled={busy} className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-[15px] font-medium text-zinc-700">
              Not for us
            </button>
          ) : (
            <button type="button" onClick={() => setDeclining(true)} className="text-[14px] text-zinc-500 underline">
              Not for us
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}
