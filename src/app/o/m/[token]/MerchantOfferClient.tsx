"use client";

/**
 * The merchant's acceptance form — /o/m/[token]
 *
 * Linked from Shawn's offer email. A shop owner reads it on a phone between
 * customers, so everything Leaf already knows is filled in: the taster we
 * suggested, its price, their address and phone, whether they have room.
 * They confirm or change it, tick the dates that work, and they're done.
 * No account. Their answer fills the week on Leaf's side without anyone
 * retyping it.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import PayoutSetup from "./PayoutSetup";

type DateOption = { dateKey: string; label: string };

type Form = {
  state: "drafted" | "sent" | "accepted" | "declined" | "expired" | "unavailable";
  merchantName: string;
  calendarName: string;
  neighborhood: string;
  calendarUrl: string | null;
  startTimeLabel: string;
  headcount: string;
  priceCeilingCents: number;
  offer: {
    title: string;
    description: string;
    durationMin: number;
    priceCents: number;
    existingOffering: string;
    hasSpace: boolean | null;
    capacity: number | null;
    address: string;
    merchantHosts: boolean | null;
    contactName: string;
    contactPhone: string;
    windows: string[];
    otherWindows: string;
  };
  dateOptions: DateOption[];
};

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-10 pb-24">{children}</main>;
}

function Closed({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h1 className="text-xl font-semibold text-leaf-900">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">{body}</p>
      </div>
      {children}
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

export default function MerchantOfferClient({ token }: { token: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ bookedDate: string | null; benched: boolean; updated?: boolean } | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [hasSpace, setHasSpace] = useState<boolean | null>(null);
  const [capacity, setCapacity] = useState("");
  const [address, setAddress] = useState("");
  const [merchantHosts, setMerchantHosts] = useState<boolean | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [windows, setWindows] = useState<string[]>([]);
  const [otherWindows, setOtherWindows] = useState("");

  const load = useCallback(async () => {
    try {
      const f = (await Parse.Cloud.run("getMerchantOfferForm", { token })) as Form;
      setForm(f);
      if (f.state !== "unavailable") {
        const o = f.offer;
        setTitle(o.title);
        setDescription(o.description);
        setPrice(String(o.priceCents / 100));
        setDurationMin(String(o.durationMin || 60));
        setHasSpace(o.hasSpace);
        setCapacity(o.capacity ? String(o.capacity) : "");
        setAddress(o.address);
        setMerchantHosts(o.merchantHosts);
        setContactName(o.contactName);
        setContactPhone(o.contactPhone);
        setWindows(o.windows);
        setOtherWindows(o.otherWindows);
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

  const toggle = (k: string) => setWindows((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = (await Parse.Cloud.run("submitMerchantOfferForm", {
        token,
        accept: true,
        title,
        description,
        priceCents: Math.round(Number(price || 0) * 100),
        durationMin: Number(durationMin),
        hasSpace,
        capacity: hasSpace ? Number(capacity) || null : null,
        address: hasSpace ? address : "",
        merchantHosts: merchantHosts === true,
        contactName,
        contactPhone,
        windows,
        otherWindows,
      })) as { state: string; bookedDate?: string | null; benched?: boolean; updated?: boolean };
      setDone({ bookedDate: r.bookedDate ?? null, benched: Boolean(r.benched), updated: r.updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await Parse.Cloud.run("submitMerchantOfferForm", { token, accept: false, declineReason });
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
    return (
      <Closed
        title="We couldn't find this one."
        body="The link may have been cut off. Try tapping it again from Shawn's email, or just reply to it."
      />
    );
  }
  if (form.state === "declined") {
    return (
      <Closed
        title="Thanks for letting us know."
        body="No problem at all. If the timing changes, reply to Shawn's email any time."
      />
    );
  }
  if (form.state === "expired") {
    return (
      <Closed
        title="This one has passed."
        body="Those dates have gone by. Reply to Shawn's email and he'll find you new ones."
      />
    );
  }
  if (done) {
    return (
      <Closed
        title={done.updated ? "Updated. Thank you." : "You're on the calendar. Thank you!"}
        body={
          done.updated
            ? "Your changes are saved. Shawn will be in touch with anything that affects the night."
            : done.bookedDate
              ? `We've got you down for ${done.bookedDate}. Shawn will email everyone involved with the details, and your ${title} goes up on the ${form.neighborhood} calendar.`
              : "We've saved your dates. Shawn will match you to the first open week that works and email you to confirm."
        }
      >
        {Number(price) > 0 && <PayoutSetup token={token} />}
      </Closed>
    );
  }

  const cents = Math.round(Number(price || 0) * 100);
  const overCeiling = cents > form.priceCeilingCents;
  const canSubmit = title.trim() && hasSpace !== null && contactPhone.trim() && (windows.length > 0 || otherWindows.trim());

  return (
    <Shell>
      <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-700">{form.neighborhood} calendar</p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-leaf-900">
        {form.merchantName ? `${form.merchantName}, ` : ""}here&rsquo;s your night
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
        A short version of your {form.offer.existingOffering || "class"}, for {form.headcount} neighbors at{" "}
        {form.startTimeLabel}. They RSVP and pay through Leaf, you see the headcount ahead, and you keep the ticket
        money minus our 10%. Change anything below.
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

      {form.state === "accepted" && form.offer.priceCents > 0 && <PayoutSetup token={token} />}

      <section className="mt-8 space-y-4">
        <label className="block">
          <Label>What people make or do</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        </label>
        <label className="block">
          <Label>In a sentence</Label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${input} resize-none`} />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <Label>Price per person ($)</Label>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
          </label>
          <label className="block w-32">
            <Label>Minutes</Label>
            <input inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={input} />
          </label>
        </div>
        {overCeiling && (
          <p className="text-[13px] text-amber-700">
            Totally your call. Above about ${form.priceCeilingCents / 100}, fewer people RSVP to a first taste.
          </p>
        )}
      </section>

      <section className="mt-8">
        <Label>Do you have room for {form.headcount} people?</Label>
        <div className="flex gap-2">
          <Choice on={hasSpace === true} onClick={() => setHasSpace(true)}>Yes, at our place</Choice>
          <Choice on={hasSpace === false} onClick={() => setHasSpace(false)}>We&rsquo;d need a room</Choice>
        </div>
        {hasSpace === true && (
          <div className="mt-3 flex gap-3">
            <label className="block flex-1">
              <Label>Address</Label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
            </label>
            <label className="block w-24">
              <Label>Fits</Label>
              <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="15" className={input} />
            </label>
          </div>
        )}
        {hasSpace === false && (
          <p className="mt-2 text-[13px] text-zinc-500">We&rsquo;ll find a café or bar nearby and confirm it with you.</p>
        )}
      </section>

      <section className="mt-8">
        <Label>Who welcomes people and keeps time?</Label>
        <div className="flex gap-2">
          <Choice on={merchantHosts === true} onClick={() => setMerchantHosts(true)}>We will</Choice>
          <Choice on={merchantHosts === false} onClick={() => setMerchantHosts(false)}>Send a Leaf host</Choice>
        </div>
      </section>

      <section className="mt-8">
        <Label>Which {form.dateOptions[0]?.label.split(",")[0] || "week"}s work? Pick a few.</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {form.dateOptions.map((d) => (
            <Choice key={d.dateKey} on={windows.includes(d.dateKey)} onClick={() => toggle(d.dateKey)}>
              {d.label.replace(/^\w+, /, "")}
            </Choice>
          ))}
        </div>
        <label className="mt-3 block">
          <Label>None of these? Tell us what works</Label>
          <input value={otherWindows} onChange={(e) => setOtherWindows(e.target.value)} placeholder="Tuesdays after 6 work better" className={input} />
        </label>
      </section>

      <section className="mt-8 flex gap-3">
        <label className="block flex-1">
          <Label>Your name</Label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" className={input} />
        </label>
        <label className="block flex-1">
          <Label>Phone for the night</Label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={input} />
        </label>
      </section>

      {error && <p className="mt-6 text-[14px] text-red-700">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canSubmit}
        className="mt-8 w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white hover:bg-leaf-900 disabled:opacity-40"
      >
        {busy ? "Saving…" : form.state === "accepted" ? "Save changes" : "Count me in"}
      </button>

      {form.state !== "accepted" && (
        <div className="mt-6 text-center">
          {declining ? (
            <div className="space-y-3 text-left">
              <label className="block">
                <Label>Anything we should know? (optional)</Label>
                <input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className={input} />
              </label>
              <button type="button" onClick={decline} disabled={busy} className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-[15px] font-medium text-zinc-700">
                Not for us right now
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setDeclining(true)} className="text-[14px] text-zinc-500 underline">
              Not for us right now
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}
