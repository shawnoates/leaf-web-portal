"use client";

/**
 * The merchant's page — /o/m/[token]
 *
 * Linked from Shawn's offer email and read on a phone between customers, so
 * it's one column, one scroll, and one button that stays in reach. Everything
 * Leaf already knows is filled in (the night we suggested, their address and
 * phone, how many fit); they confirm, tick dates, and they're done. No account.
 *
 * Two deals, set on the offer:
 *  - ticket: workshops and tastings. They set a price; neighbors buy tickets.
 *  - per_rsvp: bars and restaurants. Free for neighbors, everyone orders their
 *    own, and the merchant pays a flat fee per RSVP after the night. They add
 *    a card to accept; the first night is free.
 *
 * After accepting, the same link is their settings page: card, notifications,
 * and (ticketed) payouts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import PayoutSetup from "./PayoutSetup";
import CardSetup, { type Card, type CardSetupHandle } from "./CardSetup";
import NoticePrefs, { noticePayload, type Notices } from "./NoticePrefs";
import { Brand, BusinessPhoto, Choice, Closed, Field, Section, Shell, dollars, formatPhone, input, textarea } from "./ui";
import NightPicker, { nightMeta, type Suggested } from "./NightPicker";
import MerchantDashboard from "./MerchantDashboard";
import { forgetPartner, rememberPartner } from "./remember";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
import FreeNightCountdown, { CountdownText, TYPICAL_RSVPS, useCountdown } from "./FreeNightCountdown";

type DateOption = { dateKey: string; label: string };

type Form = {
  /** What a Leaf host costs for a night (Hosted night). */
  leafHostFeeCents?: number;
  state: "drafted" | "sent" | "accepted" | "declined" | "expired" | "unavailable";
  merchantName: string;
  /** Their own Google photo, saved by Leaf; shown at the top. */
  photoUrl?: string | null;
  /** Google requires the photographer's name next to it. */
  photoCredit?: { name: string; uri: string } | null;
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
  billing?: {
    model: "ticket" | "per_rsvp";
    rsvpFeeCents: number;
    firstNightFree: boolean;
    freeNightState?: "open" | "lapsed" | "granted" | "used";
    freeNightDeadline?: string | null;
    card: Card | null;
    cardFailed: boolean;
  };
  spendEstimate?: { lowCents: number; highCents: number; source: string } | null;
  categoryLabel?: string | null;
  notices?: Notices;
  suggested?: Suggested | null;
};

const EXAMPLE_RSVPS = 12;

/** "the X calendar", without doubling up when the name already starts with "The". */
function theCalendar(name: string) {
  return /^the\s/i.test(name) ? name : `the ${name}`;
}

function OfferCard({ form }: { form: Form }) {
  const b = form.billing!;
  const fee = dollars(b.rsvpFeeCents);
  const spend = form.spendEstimate;
  const rows: [string, string][] = [
    [b.firstNightFree ? "Your first night is on us" : "Free for neighbors", "Neighbors join free and everyone orders their own."],
    [b.firstNightFree ? `${fee} per RSVP after that` : `${fee} per RSVP`, "Charged after the night, counted 2 hours before, never more than you seat."],
    ["No crowd, no charge", "Under 5 RSVPs costs nothing, and we set up another night."],
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-leaf-800 text-white">
      <div className="p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">How it works</p>
        <ol className="mt-4 space-y-4">
          {rows.map(([head, body], i) => (
            <li key={head} className="flex gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-fm-serif text-[16px] text-leaf-100">{i + 1}</span>
              <span>
                <span className="block font-fm-serif text-[21px] leading-tight">{head}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-leaf-200">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      {spend && (
        <div className="border-t border-white/10 bg-black/15 px-5 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-leaf-300">{EXAMPLE_RSVPS} neighbors spend about</p>
              <p className="mt-0.5 font-fm-serif text-[30px] leading-none">
                {dollars(spend.lowCents * EXAMPLE_RSVPS)}–{dollars(spend.highCents * EXAMPLE_RSVPS)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-leaf-300">You pay</p>
              <p className="mt-0.5 font-fm-serif text-[30px] leading-none">{dollars(b.rsvpFeeCents * EXAMPLE_RSVPS)}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[12px] leading-snug text-leaf-300">
            {`About ${dollars(spend.lowCents)}–${dollars(spend.highCents)} a person at ${
              form.categoryLabel ? `${form.categoryLabel.toLowerCase()}s` : "places"
            } like yours. An estimate from Google’s price level for your listing.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function MerchantOfferClient({ token }: { token: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // ?preview=1: Shawn checking the page from the admin. Not counted as their open; nothing submits.
  const [preview, setPreview] = useState(false);
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
  // New sign-ups give us a day; Shawn sets the date and time.
  const [preferredDay, setPreferredDay] = useState<number | null>(null);
  const [otherWindows, setOtherWindows] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [useOwn, setUseOwn] = useState(false);
  const [notices, setNotices] = useState<Notices | null>(null);
  // Merchants who said yes land on their dashboard; the form is one tap away.
  const [view, setView] = useState<"dashboard" | "form">("dashboard");
  const [noDashboard, setNoDashboard] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const showForm = useCallback(() => setView("form"), []);
  const dashboardUnavailable = useCallback(() => {
    setNoDashboard(true);
    setView("form");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.hash) window.scrollTo(0, 0);
  }, [view]);
  const cardRef = useRef<CardSetupHandle>(null);

  const load = useCallback(async () => {
    try {
      const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
      setPreview(isPreview);
      const f = (await Parse.Cloud.run("getMerchantOfferForm", { token, preview: isPreview })) as Form;
      setForm(f);
      // Keep a working link handy on this device; drop one that stopped working.
      // A preview is Shawn's device, not theirs: leave it alone.
      if (isPreview) {
        // they land on their dashboard, so the preview does too
      } else if (f.state === "sent" || f.state === "drafted" || f.state === "accepted") rememberPartner(token, f.merchantName || "");
      else forgetPartner(token);
      if (f.state !== "unavailable") {
        const o = f.offer;
        const perRsvp = f.billing?.model === "per_rsvp";
        // The suggestion stays selected unless they already wrote their own.
        const own = Boolean(f.suggested && o.title && o.title !== f.suggested.title);
        setUseOwn(own);
        setTitle(own ? o.title : "");
        setDescription(own ? o.description : "");
        setPrice(String(o.priceCents / 100));
        setDurationMin(String(o.durationMin || 60));
        setHasSpace(perRsvp ? true : o.hasSpace);
        // Bars seat the group themselves: default to the top of the range.
        const top = Number(String(f.headcount).split(/\D+/).filter(Boolean).pop()) || 15;
        setCapacity(o.capacity ? String(o.capacity) : perRsvp ? String(top) : "");
        setAddress(o.address);
        setMerchantHosts(perRsvp && o.merchantHosts === null ? true : o.merchantHosts);
        setContactName(o.contactName);
        setContactPhone(formatPhone(o.contactPhone));
        setWindows(o.windows);
        setOtherWindows(o.otherWindows);
        setCard(f.billing?.card ?? null);
        if (f.notices) {
          // Texts go to the night's phone unless they've set another.
          setNotices({ ...f.notices, smsPhone: f.notices.smsPhone || o.contactPhone || "" });
        }
      }
    } catch {
      setForm({ state: "unavailable" } as Form);
      forgetPartner(token);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // #card and #notifications links from receipts and reminders land on the right section.
  useEffect(() => {
    if (!form || typeof window === "undefined" || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [form]);


  const perRsvp = form?.billing?.model === "per_rsvp";
  // "$99": what a Leaf host costs, shown on the Hosted night choice.
  const hostFee = form?.leafHostFeeCents ? `$${Math.round(form.leafHostFeeCents / 100)}` : null;
  // The free-night clock rides on the button so it's always in view.
  const freeLeft = useCountdown(
    form?.billing?.freeNightDeadline,
    perRsvp && form?.state !== "accepted" && form?.billing?.freeNightState === "open",
  );
  const suggested: Suggested | null = form?.suggested ?? (form?.offer ? { title: form.offer.title, description: form.offer.description, durationMin: form.offer.durationMin, priceCents: form.offer.priceCents } : null);
  const nightTitle = useOwn || !suggested ? title : suggested.title;
  const nightDescription = useOwn || !suggested ? description : suggested.description;
  const phoneDigits = contactPhone.replace(/\D/g, "");
  const missing: string[] = [];
  if (!nightTitle.trim()) missing.push("a name for the night");
  if (!perRsvp && hasSpace === null) missing.push("whether you have room");
  if (form?.state !== "accepted" && preferredDay === null) missing.push("a day");
  if (phoneDigits.length > 0 && phoneDigits.length < 10) missing.push("a full phone number (or leave it blank)");

  const saveCardOnly = async () => {
    setBusy(true);
    setError(null);
    try {
      await cardRef.current?.save();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That card didn't save.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (preview) return;
    if (missing.length) {
      setError(`Add ${missing.join(", ")}.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (perRsvp) await cardRef.current?.save();
      if (notices) {
        const r = (await Parse.Cloud.run("updateMerchantNotices", { token, ...noticePayload(notices) })) as { notices: Notices };
        setNotices(r.notices);
      }
      const r = (await Parse.Cloud.run("submitMerchantOfferForm", {
        token,
        accept: true,
        title: nightTitle,
        description: nightDescription,
        priceCents: perRsvp ? 0 : Math.round(Number(price || 0) * 100),
        durationMin: Number(durationMin),
        hasSpace,
        capacity: hasSpace ? Number(capacity) || null : null,
        address: hasSpace ? address : "",
        merchantHosts: merchantHosts === true,
        contactName,
        contactPhone,
        // Editing keeps their dates; a new sign-up sends the day instead.
        windows: form?.state === "accepted" ? windows : [],
        otherWindows: form?.state === "accepted" ? otherWindows : "",
        preferredDay: form?.state === "accepted" ? undefined : preferredDay,
      })) as { state: string; bookedDate?: string | null; benched?: boolean; updated?: boolean; requested?: boolean };
      setDone({ bookedDate: r.bookedDate ?? null, benched: Boolean(r.benched), updated: r.updated });
      // Straight to their dashboard, with what just happened at the top.
      if (r.state === "accepted" && !noDashboard) {
        setWelcome(
          r.updated
            ? "Your changes are saved."
            : r.requested
              ? `You're in. We'll confirm the date and time of your first ${DAYS[preferredDay ?? 0]} within a day.${perRsvp && form?.billing?.firstNightFree ? " It's on us." : ""}`
              : r.bookedDate
              ? `You're in. See you ${r.bookedDate}.${perRsvp && form?.billing?.firstNightFree ? " This first night is on us." : ""}`
              : "You're in. Those weeks already have someone, so you're first in line for the next opening.",
        );
        setForm((f) => (f ? { ...f, state: "accepted" } : f));
        setDone(null);
        setView("dashboard");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (preview) return;
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
        <Brand />
        <div className="mt-8 animate-pulse space-y-4" aria-label="Loading">
          <div className="h-4 w-1/3 rounded bg-stone-200" />
          <div className="h-8 w-4/5 rounded bg-stone-200" />
          <div className="h-40 rounded-2xl bg-stone-100" />
          <div className="h-12 rounded-xl bg-stone-100" />
        </div>
      </Shell>
    );
  }
  if (!form || form.state === "unavailable") {
    return (
      <Closed
        title="We couldn't find this one."
        body="The link may have been cut off. Try tapping it again from Shawn's email, or just reply to it."
      >
        <a href="/partners/login" className="mt-4 block px-1 text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Already with Leaf? Email me my sign-in link
        </a>
      </Closed>
    );
  }
  if (form.state === "declined") {
    return (
      <Closed
        neighborhood={form.neighborhood}
        title="No problem at all."
        body="Thanks for letting us know. If the timing changes, reply to Shawn's email and we'll find another week."
      />
    );
  }
  if (form.state === "expired") {
    return (
      <Closed
        neighborhood={form.neighborhood}
        title="This one has passed."
        body="The weeks on this offer have gone by. Reply to Shawn's email if you'd like to be on a future night."
      >
        <a href="/partners/login" className="mt-4 block px-1 text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Already with Leaf? Email me my sign-in link
        </a>
      </Closed>
    );
  }

  const accountSections = (
    <>
          {perRsvp && (
            <section id="card" className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-fm-serif text-[26px] text-stone-900">Card on file</h2>
              <div className="mt-3">
                <CardSetup
                  ref={cardRef}
                  token={token}
                  card={card}
                  onSaved={setCard}
                  feeCents={form.billing?.rsvpFeeCents ?? 600}
                  firstNightFree={Boolean(form.billing?.firstNightFree)}
                  hostFeeCents={form.leafHostFeeCents ?? 0}
                />
              </div>
              {card === null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveCardOnly}
                  className="mt-3 h-12 w-full rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save card"}
                </button>
              )}
            </section>
          )}
          {notices && (
            <section id="notifications" className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-fm-serif text-[26px] text-stone-900">Notifications</h2>
              <div className="mt-3">
                <NoticePrefs token={token} value={notices} onChange={setNotices} standalone />
              </div>
            </section>
          )}
          {!perRsvp && Number(price) > 0 && <PayoutSetup token={token} />}
    </>
  );

  if (done) {
    return (
      <Shell>
        <Brand neighborhood={form.neighborhood} />
        <div className="mt-8 rounded-3xl bg-leaf-800 p-6 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">{done.updated ? "Saved" : "You're in"}</p>
          <h1 className="mt-2 font-fm-serif text-[36px] leading-[1.02]">
            {done.updated ? "Your changes are saved." : done.bookedDate ? `See you ${done.bookedDate}.` : "Thanks! We'll confirm your date."}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-leaf-100">
            {done.updated
              ? "We'll use the new details from here on."
              : done.bookedDate
                ? `${form.calendarName} neighbors can start RSVPing soon. We'll send the count 2 hours before${
                    perRsvp && form.billing?.firstNightFree ? ", and this first night is on us" : ""
                  }.`
                : "Those weeks already have someone, so you're first in line for the next opening. We'll be in touch."}
          </p>
        </div>
        <div className="mt-4 space-y-4">
          {accountSections}
          {error && <p className="text-[14px] text-red-600">{error}</p>}
          {!noDashboard && (
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setView("dashboard");
              }}
              className="h-12 w-full rounded-xl border border-stone-300 text-[15px] font-semibold text-stone-800"
            >
              See your nights
            </button>
          )}
        </div>
      </Shell>
    );
  }

  if (form.state === "accepted" && view === "dashboard") {
    return (
      <MerchantDashboard token={token} onEdit={showForm} onUnavailable={dashboardUnavailable} account={accountSections} welcome={welcome} preview={preview} />
    );
  }

  const accepted = form.state === "accepted";
  const steps = (perRsvp ? 4 : 3) + (notices ? 1 : 0);
  const withHost = merchantHosts === false && hostFee ? ` + ${hostFee} host` : "";
  const cta = accepted ? "Save changes" : perRsvp && form.billing?.firstNightFree ? `Hold my free night${withHost}` : "Count me in";
  const freeWorth = perRsvp && !accepted && !withHost && form.billing?.firstNightFree ? dollars((form.billing?.rsvpFeeCents ?? 600) * TYPICAL_RSVPS) : null;

  return (
    <Shell>
      {preview && (
        <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-900">
          {`Preview of ${form.merchantName ? `${form.merchantName}\u2019s` : "their"} page. Opening it here doesn\u2019t count as them opening it, and nothing can be submitted.`}
        </p>
      )}
      <Brand neighborhood={form.neighborhood} />
      <BusinessPhoto url={form.photoUrl} credit={form.photoCredit} name={form.merchantName} />
      {accepted && !noDashboard && !preview && (
        <button type="button" onClick={() => setView("dashboard")} className="mt-4 px-1 text-[15px] font-semibold text-leaf-700">
          ← Back to your nights
        </button>
      )}

      <header className="mt-8 px-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">{accepted ? "Your Leaf nights" : "An invitation from Leaf"}</p>
        <h1 className="mt-2 font-fm-serif text-[40px] leading-[1.02] tracking-[-0.01em] text-stone-900">
          {perRsvp ? (
            <>
              Let&rsquo;s fill a slow night at <em className="text-leaf-700">{form.merchantName}</em>.
            </>
          ) : (
            <>
              A night on the calendar at <em className="text-leaf-700">{form.merchantName}</em>.
            </>
          )}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-stone-600">
          {perRsvp
            ? `We bring ${form.headcount} neighbors from ${theCalendar(form.calendarName)} calendar to you, on your slowest day.`
            : `A taster for ${form.headcount} neighbors on ${theCalendar(form.calendarName)} calendar, on a day that suits you. Leaf keeps 10% of tickets.`}{" "}
          {form.calendarUrl && (
            <a href={form.calendarUrl} target="_blank" rel="noreferrer" className="font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
              See the calendar
            </a>
          )}
        </p>
      </header>

      {perRsvp && form.billing && !accepted && form.billing.freeNightState && (
        <div className="mt-7">
          <FreeNightCountdown
            deadline={form.billing.freeNightDeadline ?? null}
            state={form.billing.freeNightState}
            feeLabel={dollars(form.billing.rsvpFeeCents)}
            worthLabel={dollars(form.billing.rsvpFeeCents * TYPICAL_RSVPS)}
          />
        </div>
      )}

      {perRsvp && form.billing && (
        <div className="mt-4">
          <OfferCard form={form} />
        </div>
      )}
      {accepted && form.billing?.cardFailed && (
        <p className="mt-6 rounded-xl bg-amber-50 p-3.5 text-[14px] text-amber-900">
          Your last charge didn&rsquo;t go through.{" "}
          <a href="#card" className="font-semibold underline">
            Update your card
          </a>
        </p>
      )}

      <div className="mt-6 space-y-4">
        <Section n={1} total={steps} title="Your night" sub="Keep ours, or write your own.">
          {suggested && (
            <NightPicker
              suggested={suggested}
              useOwn={useOwn}
              setUseOwn={setUseOwn}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              merchantName={form.merchantName}
              meta={nightMeta({
                // The time is set with them per night, not the calendar's default.
                startTimeLabel: "",
                durationMin: Number(durationMin) || suggested.durationMin,
                headcount: form.headcount,
                priceCents: perRsvp ? 0 : Math.round(Number(price || 0) * 100),
                perRsvp,
              })}
            />
          )}
          {perRsvp ? (
            <Field label="How many can you seat together?" hint="We never bill for more RSVPs than this.">
              <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price per person">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-stone-500">$</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    className={`${input} pl-7`}
                  />
                </div>
              </Field>
              <Field label="Minutes">
                <input value={durationMin} onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} />
              </Field>
            </div>
          )}
          {!perRsvp && Number(price) * 100 > form.priceCeilingCents && (
            <p className="rounded-xl bg-amber-50 p-3 text-[14px] leading-snug text-amber-900">
              Under {dollars(form.priceCeilingCents)} is where neighbors actually RSVP. Above it, they hesitate.
            </p>
          )}
          {!perRsvp && (
            <div>
              <span className="mb-1.5 block text-[14px] font-medium text-stone-700">Do you have room for {form.headcount}?</span>
              <div className="flex gap-2">
                <Choice on={hasSpace === true} onClick={() => setHasSpace(true)}>
                  Yes, here
                </Choice>
                <Choice on={hasSpace === false} onClick={() => setHasSpace(false)}>
                  Find a space
                </Choice>
              </div>
            </div>
          )}
          {!perRsvp && hasSpace && (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" className={input} />
              </Field>
              <Field label="Fits">
                <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} />
              </Field>
            </div>
          )}
        </Section>

        <Section
          n={2}
          total={steps}
          title={accepted ? "Your nights" : "What day works best?"}
          sub={accepted ? "Book more nights from your dashboard." : "Pick your slowest day. We'll set the time and confirm your first one within a day."}
        >
          {!accepted && (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = preferredDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPreferredDay(on ? null : d)}
                    aria-pressed={on}
                    className={`min-h-12 rounded-xl border px-2 text-[15px] font-semibold transition-colors ${
                      on ? "border-leaf-800 bg-leaf-800 text-white" : "border-stone-300 bg-white text-stone-900 active:bg-stone-50"
                    }`}
                  >
                    {DAYS[d].slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <Section n={3} total={steps} title="Who welcomes the group?" sub="Your team, or make it a Hosted night.">
          <div className="flex gap-2">
            <Choice on={merchantHosts === true} onClick={() => setMerchantHosts(true)}>
              We will
            </Choice>
            <Choice on={merchantHosts === false} onClick={() => setMerchantHosts(false)}>
              {`Hosted night${hostFee ? ` \u00b7 ${hostFee}` : ""}`}
            </Choice>
          </div>
          {merchantHosts === true && (
            <div className="rounded-2xl bg-leaf-50 p-4">
              <p className="font-fm-serif text-[22px] leading-tight text-stone-900">Meet your new regulars</p>
              <p className="mt-1 text-[14px] leading-snug text-stone-600">
                Say hi at the door and show them to their table. That first hello is how a room of neighbors turns into faces you see every week.
              </p>
              <ul className="mt-3 space-y-2 text-[14px] leading-snug text-stone-700">
                <li className="flex gap-2.5">
                  <span aria-hidden className="text-leaf-600">●</span>
                  <span>
                    <strong className="font-semibold text-stone-900">Two minutes, not a shift.</strong> We send the invites, the RSVPs and the count.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden className="text-leaf-600">●</span>
                  <span>
                    <strong className="font-semibold text-stone-900">Learn a few names.</strong> People come back to places that know them.
                  </span>
                </li>
              </ul>
            </div>
          )}
          {merchantHosts === false && (
            <div className="overflow-hidden rounded-2xl bg-leaf-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hosted-night.jpg"
                alt="A Leaf host pouring wine for neighbors at a long table in a busy local bar"
                className="aspect-[4/3] w-full object-cover object-center"
                loading="lazy"
              />
              <div className="p-4">
              <p className="font-fm-serif text-[22px] leading-tight text-stone-900">Hosted night</p>
              <p className="mt-1 text-[14px] leading-snug text-stone-600">
                {`A Leaf host runs the night${hostFee ? ` for ${hostFee}, ${perRsvp ? "added to that night\u2019s bill" : "taken from your ticket payout"}` : ""}. Then you get:`}
              </p>
              <ul className="mt-3 space-y-2 text-[14px] leading-snug text-stone-700">
                <li className="flex gap-2.5">
                  <span aria-hidden className="text-leaf-600">●</span>
                  <span>
                    <strong className="font-semibold text-stone-900">What your guests spent</strong>, from the night&rsquo;s receipts
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden className="text-leaf-600">●</span>
                  <span>
                    <strong className="font-semibold text-stone-900">Photos for your socials</strong> of your place full of neighbors
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden className="text-leaf-600">●</span>
                  <span>
                    <strong className="font-semibold text-stone-900">New regulars</strong>: how many followed you, and who came back
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-[13px] leading-snug text-stone-500">We&rsquo;ll confirm the host fee with you before your night.</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who should they ask for?" hint="Whoever's usually on. Someone else on a given night? Just tell us.">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" className={input} />
            </Field>
            <Field label="Phone (optional)" hint="The main line is fine. Only your host uses it, to find you on the night.">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(formatPhone(e.target.value))}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(555) 555-5555"
                className={input}
              />
            </Field>
          </div>
        </Section>

        {perRsvp && (
          <Section
            n={4}
            total={steps}
            id="card"
            title="Hold it with a card"
            sub={
              form.billing?.firstNightFree
                ? "Your first night is free. After that, nights come out of a Leaf balance that tops up $60 at a time from this card."
                : "Nights come out of a Leaf balance that tops up $60 at a time from this card."
            }
          >
            <CardSetup
                  ref={cardRef}
                  token={token}
                  card={card}
                  onSaved={setCard}
                  feeCents={form.billing?.rsvpFeeCents ?? 600}
                  firstNightFree={Boolean(form.billing?.firstNightFree)}
                  hostFeeCents={form.leafHostFeeCents ?? 0}
                />
          </Section>
        )}

        {notices && (
          <Section n={perRsvp ? 5 : 4} total={steps} id="notifications" title="How should we reach you?" sub="Only about your nights. Never marketing.">
            <NoticePrefs token={token} value={notices} onChange={setNotices} />
          </Section>
        )}

        {!accepted && (
          <div className="px-1 pt-4">
            {!declining ? (
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className="min-h-11 text-[14px] font-medium text-stone-500 underline underline-offset-2"
              >
                Not for us right now
              </button>
            ) : (
              <div className="space-y-3">
                <Field label="Anything we should know? (optional)">
                  <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={2} className={textarea} />
                </Field>
                <button
                  type="button"
                  onClick={decline}
                  disabled={busy || preview}
                  className="h-12 w-full rounded-xl border border-stone-300 text-[15px] font-semibold text-stone-700 disabled:opacity-50"
                >
                  Not for us right now
                </button>
              </div>
            )}
          </div>
        )}
        {accepted && !perRsvp && Number(price) > 0 && <PayoutSetup token={token} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[#f6f2ea]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {error && <p className="mb-2 text-[14px] leading-snug text-red-600">{error}</p>}
          {freeLeft != null && (
            <p className="mb-2 text-center text-[14px] text-stone-600">
              Your free night is held for <span className="text-[18px]"><CountdownText left={freeLeft} /></span>
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || preview}
            className="h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white shadow-sm transition-opacity active:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              "One moment…"
            ) : (
              <>
                {cta}
                {freeWorth && (
                  <>
                    <span className="sr-only">, usually </span>
                    <s className="ml-2 font-normal text-white/60 decoration-white/60">{freeWorth}</s>
                  </>
                )}
              </>
            )}
          </button>
          {perRsvp && !accepted && (
            <p className="mt-2 text-center text-[12px] text-stone-500">
              {form.billing?.firstNightFree ? "Free first night. " : ""}
              {dollars(form.billing?.rsvpFeeCents ?? 600)} per RSVP after that. Stop anytime by replying to Shawn.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}
