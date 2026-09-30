"use client";

/**
 * The public partner sign-up — /partner
 *
 * A link Shawn can hand to any business. They find themselves on Google,
 * leave a name and email, and — when their neighborhood has a Leaf calendar
 * with an open week — land on the same page an offer email links to
 * (/o/m/[token]) to pick nights and hold their first free night.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { Brand, Field, Shell, formatPhone, input } from "@/app/o/m/[token]/ui";

type Place = { placeId: string; name: string; address: string; type: string };
type Outcome = { outcome: "offer" | "known" | "no_calendar" | "no_week" | "thanks"; name?: string; token?: string };

export default function PartnerClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [picked, setPicked] = useState<Place | null>(null);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);

  const find = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = (await Parse.Cloud.run("partnerFindBusiness", { query })) as { results: Place[] };
      setResults(r.results);
      if (!r.results.length) setError("No match on Google. Try the name with the street, or paste your Google Maps link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      const r = (await Parse.Cloud.run("partnerSignUp", {
        placeId: picked.placeId,
        contactName,
        email,
        phone,
        website: trap,
      })) as Outcome;
      if (r.outcome === "offer" && r.token) {
        router.push(`/o/m/${r.token}`);
        return;
      }
      setDone(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const name = done.name || picked?.name || "your place";
    const body =
      done.outcome === "known"
        ? `We already know ${name}. Shawn will reach out within a day to pick up where you left off.`
        : done.outcome === "no_calendar"
          ? `There isn't a Leaf calendar near ${name} yet. We'll email you as soon as your neighborhood opens.`
          : done.outcome === "no_week"
            ? `The next few weeks near ${name} are spoken for. You're first in line, and we'll email you when a night opens.`
            : "Thanks! We'll be in touch.";
    return (
      <Shell>
        <Brand />
        <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">Thanks</p>
          <h1 className="mt-2 font-fm-serif text-[34px] leading-[1.05] text-stone-900">We&rsquo;ve got you.</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-stone-600">{body}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />

      <header className="mt-8 px-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">For local businesses</p>
        <h1 className="mt-2 font-fm-serif text-[40px] leading-[1.02] tracking-[-0.01em] text-stone-900">
          Fill a slow night with <em className="text-leaf-700">your neighbors</em>.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-stone-600">
          Leaf runs a calendar for each neighborhood. We bring 8 to 15 neighbors to you on a quiet evening. Bars and restaurants pay $6 per RSVP
          after the night, and your first night is free.
        </p>
      </header>

      <div className="mt-7 space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">Step 1 of 2</p>
          <h2 className="mt-1 font-fm-serif text-[28px] leading-[1.05] text-stone-900">Find your business</h2>
          <div className="mt-4 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim().length >= 3 && find()}
              placeholder="Name, or your Google Maps link"
              className={input}
            />
            <button
              type="button"
              onClick={find}
              disabled={busy || query.trim().length < 3}
              className="h-12 shrink-0 rounded-xl bg-leaf-800 px-4 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Find
            </button>
          </div>
          {results && results.length > 0 && (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Your business">
              {results.map((p) => {
                const on = picked?.placeId === p.placeId;
                return (
                  <button
                    key={p.placeId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(p)}
                    className={`w-full rounded-2xl border-2 p-3.5 text-left transition-colors ${on ? "border-leaf-700 bg-leaf-50/60" : "border-stone-200 bg-white"}`}
                  >
                    <p className="text-[16px] font-semibold text-stone-900">{p.name}</p>
                    <p className="text-[13px] text-stone-500">{[p.type, p.address].filter(Boolean).join(" · ")}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {picked && (
          <section className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">Step 2 of 2</p>
            <h2 className="mt-1 font-fm-serif text-[28px] leading-[1.05] text-stone-900">How we reach you</h2>
            <div className="mt-4 space-y-4">
              <Field label="Your name">
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" className={input} />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" className={input} />
              </Field>
              <Field label="Phone (optional)">
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  className={input}
                />
              </Field>
              {/* Spam trap: hidden from people, filled by bots. */}
              <input
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="website"
              />
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[#f6f2ea]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {error && <p className="mb-2 text-[14px] leading-snug text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !picked || !contactName.trim() || !email.trim()}
            className="h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white shadow-sm disabled:opacity-40"
          >
            {busy && picked ? "One moment…" : picked ? `Continue with ${picked.name}` : "Find your business to start"}
          </button>
          <p className="mt-2 text-center text-[12px] text-stone-500">Next you&rsquo;ll pick your nights. Nothing is charged today.</p>
        </div>
      </div>
    </Shell>
  );
}
