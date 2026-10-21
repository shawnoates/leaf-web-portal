"use client";

/**
 * Start a crew from the web in under a minute: name it, pick how often, sign
 * in (Google, email or phone: the same Leaf account the app and calendars
 * use), and the crew exists. The last step hands back the invite link to
 * send the group and the organizer's own crew page, plus texts for anyone
 * who signed in without a phone, and calendar availability after Google.
 * Someone already signed in skips sign-in.
 */

import { useState } from "react";
import { CalendarCheck, Check, Copy, Share } from "lucide-react";
import Parse from "@/lib/parse-client";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import LeafSignIn, { type SignInMethod } from "@/components/LeafSignIn";
import VenueSearch from "@/components/VenueSearch";

const PACES = [
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 28, label: "Every month" },
  { days: 0, label: "Just once" },
  { days: -1, label: "On a trigger" },
];
/** "On a trigger" (BETA): no rhythm; a place in the book with a rule starts each night. */
const TRIGGER = -1;
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TRIGGER_TIMES = [{ time: "14:00", label: "Afternoon" }, { time: "18:00", label: "Evening" }];

type Step = "crew" | "signin" | "done";
/** Someone already on Leaf, picked before the form opened (people you go out with). */
export type CrewPerson = { userId: string; name: string };
type Created = { crewId: string; link: string; inviteLink: string };

const field = "h-12 w-full rounded-2xl border border-fm-line bg-fm-canvas px-4 text-base text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
const primary = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fm-accent px-6 text-[15px] font-bold text-fm-canvas transition hover:brightness-105 disabled:opacity-60";

export default function StartCrewForm({ onOpenCrew, people = [], suggestedName = "", source = "landing", fromCalendar = null }: {
  /** In the dashboard: open the new crew there instead of leaving for its page. */
  onOpenCrew?: (crewId: string) => void;
  /** Invited by account when the crew is made ("Start a crew with Maya and Dev"). */
  people?: CrewPerson[];
  suggestedName?: string;
  /** Where it started, for friendMode.enabledVia ("me", "landing", …). */
  source?: string;
  /** Started from a calendar's prompt: credited to it, and its places can start the book. */
  fromCalendar?: { id: string; name: string | null } | null;
} = {}) {
  const [seedBook, setSeedBook] = useState(true);
  const [step, setStep] = useState<Step>("crew");
  const [crewName, setCrewName] = useState(suggestedName);
  const [pace, setPace] = useState(14);
  // "Just once" is for one place: ask where up front, so Leaf never picks one.
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<{ placeId?: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // On a trigger · Weather: the rule and the place it's for.
  const [minF, setMinF] = useState(80);
  const [noRain, setNoRain] = useState(true);
  const [days, setDays] = useState<number[]>([6, 0]);
  const [trigTime, setTrigTime] = useState("14:00");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [how, setHow] = useState<SignInMethod | null>(null);
  const [hasPhone, setHasPhone] = useState(true);
  const [textPhone, setTextPhone] = useState("");
  const [textsOn, setTextsOn] = useState(false);

  const create = async () => {
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("createFriendCrew", {
        name: crewName.trim(),
        rhythmDays: pace > 0 ? pace : 28,
        oneTime: pace === 0,
        ...(pace === TRIGGER && place ? {
          triggerOnly: true,
          trigger: { kind: "weather", minF, noRain, days, time: trigTime },
          triggerPlace: { placeId: place.placeId || null, name: place.name },
        } : {}),
        invitees: people.map((p) => ({ userId: p.userId })),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source,
        ...(fromCalendar ? { fromCalendarId: fromCalendar.id, seedFromCalendar: seedBook } : {}),
      })) as Created;
      if (place && pace !== TRIGGER) {
        await Parse.Cloud.run("addToCrewBook", { crewId: r.crewId, placeId: place.placeId || null, venue: place }).catch(() => {});
      }
      setCreated(r);
      setHasPhone(Boolean(Parse.User.current()?.get("phone")));
      setStep("done");
      trackMarketingEvent("friend_mode_crew_created", { surface: "friends_page", oneTime: pace === 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the crew. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (!crewName.trim()) { setError("Give the crew a name, like \"Thursday dinners\"."); return; }
    if (pace === TRIGGER && !place) { setError("Pick the place it's for, like the beach or a rooftop."); return; }
    if (pace === TRIGGER && days.length === 0) { setError("Pick at least one day."); return; }
    setError("");
    trackMarketingEvent("friend_mode_cta_click", { surface: "friends_page_form" });
    if (Parse.User.current()) { await create(); return; }
    setStep("signin");
  };

  const turnOnTexts = async () => {
    if (!created) return;
    const d = textPhone.replace(/\D/g, "");
    if (d.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setBusy(true); setError("");
    try {
      await Parse.Cloud.run("setCrewTexts", { crewId: created.crewId, on: true, phone: `+1${d.slice(-10)}` });
      setTextsOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on texts.");
    } finally { setBusy(false); }
  };

  const connectCalendar = async () => {
    if (!created) return;
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("createGoogleCalendarConnectUrl", { returnTo: created.link })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect your calendar.");
      setBusy(false);
    }
  };

  const inviteText = created ? `Join ${crewName.trim()} on Leaf. It finds a night that works for all of us: ${created.inviteLink}` : "";
  const copy = async () => {
    if (!created) return;
    await navigator.clipboard?.writeText(created.inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    if (!created) return;
    if (navigator.share) await navigator.share({ text: inviteText }).catch(() => {});
    else await copy();
  };

  return (
    <div className="flex flex-col gap-5 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 text-left sm:p-7">
      {step === "crew" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.1em] text-fm-muted">Start a crew · free</span>
            <h2 className="m-0 font-fm-serif text-[32px] font-normal leading-tight">Who are you trying to see more?</h2>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="crew-name" className="text-sm font-semibold text-fm-ink-2">Name your crew</label>
            <input id="crew-name" className={field} value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Thursday dinners" maxLength={60} autoComplete="off" />
          </div>
          {people.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-fm-ink-2">Who&rsquo;s in</span>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <span key={p.userId} className="flex h-9 items-center rounded-full border border-fm-line bg-fm-card px-3.5 text-sm">{p.name}</span>
                ))}
              </div>
              <span className="text-xs text-fm-muted">They get the invite from you. You can add more from the crew page.</span>
            </div>
          )}
          {fromCalendar && (
            <label className="flex items-start gap-3 rounded-2xl border border-fm-line bg-fm-card px-4 py-3 text-sm">
              <input type="checkbox" checked={seedBook} onChange={(e) => setSeedBook(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-fm-accent)]" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-fm-ink">Start the book with {fromCalendar.name ? `${fromCalendar.name}\u2019s` : "the calendar\u2019s"} places</span>
                <span className="text-xs text-fm-muted">The spots its plans go to. Add your own any time.</span>
              </span>
            </label>
          )}
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-fm-ink-2">How often?</legend>
            <div className="grid grid-cols-2 gap-2">
              {PACES.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setPace(p.days)}
                  aria-pressed={pace === p.days}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold transition ${p.days === TRIGGER ? "col-span-2 " : ""}${pace === p.days ? "border-fm-accent bg-fm-accent text-fm-canvas" : p.days === TRIGGER ? "border-fm-accent text-fm-accent hover:bg-fm-card" : "border-fm-line text-fm-ink hover:bg-fm-card"}`}
                >
                  {p.label}
                  {p.days === TRIGGER && (
                    <span className={`rounded-full px-1.5 py-0.5 font-fm-mono text-[9px] tracking-[0.06em] ${pace === TRIGGER ? "bg-fm-canvas text-fm-accent" : "bg-fm-card text-fm-accent"}`}>BETA</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          {pace === TRIGGER && (
            <div className="flex flex-col gap-3 rounded-2xl border border-fm-line bg-fm-surface p-4">
              <div role="group" aria-label="Trigger" className="flex flex-wrap gap-2">
                <button type="button" aria-pressed="true" className="h-9 rounded-full bg-fm-ink px-4 text-sm font-semibold text-fm-canvas">Weather</button>
                <button type="button" disabled className="flex h-9 items-center gap-1.5 rounded-full border border-fm-line px-4 text-sm text-fm-muted">A game <span className="font-fm-mono text-[9px]">SOON</span></button>
                <button type="button" disabled className="flex h-9 items-center gap-1.5 rounded-full border border-fm-line px-4 text-sm text-fm-muted">An event <span className="font-fm-mono text-[9px]">SOON</span></button>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-fm-ink-2">When it&rsquo;s at least</span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label="Cooler" onClick={() => setMinF(Math.max(50, minF - 5))} className="h-9 w-9 rounded-full border border-fm-line text-fm-ink">&minus;</button>
                  <span className="w-12 text-center font-fm-serif text-[22px]">{minF}&deg;</span>
                  <button type="button" aria-label="Warmer" onClick={() => setMinF(Math.min(100, minF + 5))} className="h-9 w-9 rounded-full border border-fm-line text-fm-ink">+</button>
                </span>
              </div>
              <label className="flex items-center justify-between text-sm font-semibold text-fm-ink-2">
                No rain
                <input type="checkbox" checked={noRain} onChange={(e) => setNoRain(e.target.checked)} className="h-5 w-5 accent-[var(--color-fm-accent)]" />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-fm-ink-2">On</span>
                <div className="flex gap-1.5">
                  {WEEK.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={WEEK_NAMES[i]}
                        aria-pressed={on}
                        onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])}
                        className={`h-10 flex-1 rounded-xl border text-sm font-semibold ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                {TRIGGER_TIMES.map((t) => (
                  <button key={t.time} type="button" aria-pressed={trigTime === t.time} onClick={() => setTrigTime(t.time)}
                    className={`h-9 flex-1 rounded-full border text-sm font-semibold ${trigTime === t.time ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-fm-ink-2">Where?</span>
                {place ? (
                  <div className="flex h-12 items-center justify-between gap-2 rounded-2xl border border-fm-line bg-fm-canvas px-4 text-[15px]">
                    <span className="truncate">{place.name}</span>
                    <button type="button" className="text-xs text-fm-muted underline" onClick={() => setPlace(null)}>Change</button>
                  </div>
                ) : (
                  <VenueSearch
                    value={placeQuery}
                    onChange={setPlaceQuery}
                    onSelect={(v) => setPlace(v as { placeId?: string | null; name: string })}
                    placeholder="The beach, a rooftop, a park…"
                    className={field}
                  />
                )}
              </div>
              <p className="m-0 text-xs leading-relaxed text-fm-muted">
                Leaf watches the 10-day forecast there. When a day looks good it gives everyone a heads-up, then asks who&rsquo;s in 3 days before. If it cools off, Leaf calls it off.
              </p>
            </div>
          )}
          {pace === 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-fm-ink-2">Where are you going?</span>
              {place ? (
                <div className="flex h-12 items-center justify-between gap-2 rounded-2xl border border-fm-line bg-fm-canvas px-4 text-[15px]">
                  <span className="truncate">{place.name}</span>
                  <button type="button" className="text-xs text-fm-muted underline" onClick={() => setPlace(null)}>Change</button>
                </div>
              ) : (
                <VenueSearch
                  value={placeQuery}
                  onChange={setPlaceQuery}
                  onSelect={(v) => setPlace(v as { placeId?: string | null; name: string })}
                  placeholder="The bathhouse, the restaurant…"
                  className={field}
                />
              )}
              <p className="m-0 text-xs text-fm-muted">Leaf finds the date that works for everyone{place ? "" : ". Add the place now or on the crew page"}.</p>
            </div>
          )}
          <button type="button" className={primary} onClick={next} disabled={busy}>{busy ? "Starting…" : "Start the crew"}</button>
          <p className="m-0 text-xs leading-relaxed text-fm-muted">Your friends don&rsquo;t need the app. They join from a link.</p>
        </>
      )}

      {step === "signin" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.1em] text-fm-muted">Almost there</span>
            <h2 className="m-0 font-fm-serif text-[32px] font-normal leading-tight">Sign in to start {crewName.trim()}</h2>
            <p className="m-0 text-sm text-fm-ink-2">Your Leaf account, the same one the app uses.</p>
          </div>
          {busy ? (
            <p className="m-0 text-[15px] text-fm-ink-2">Starting your crew…</p>
          ) : (
            <LeafSignIn
              tone="dark"
              askName
              phoneNote="Leaf texts you about this crew's plans. Reply STOP any time."
              onSignedIn={async (_u, method) => { setHow(method); await create(); }}
            />
          )}
          <button type="button" className="self-start text-sm text-fm-muted underline" onClick={() => { setStep("crew"); setError(""); }}>Back</button>
        </>
      )}

      {step === "done" && created && (
        <>
          <div className="flex flex-col gap-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.1em] text-fm-accent">You&rsquo;re set</span>
            <h2 className="m-0 font-fm-serif text-[32px] font-normal leading-tight">{crewName.trim()} is ready.</h2>
            <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
              {pace === TRIGGER && place
                ? `Send the link to the group. Leaf watches the forecast at ${place.name} and asks who's in when a good day comes up.`
                : "Send the link to the group. Leaf starts planning the first night once 3 of you are in."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-fm-line bg-fm-canvas p-2 pl-4">
            <span className="min-w-0 flex-1 truncate font-fm-mono text-[13px] text-fm-ink-2">{created.inviteLink.replace(/^https?:\/\//, "")}</span>
            <button type="button" onClick={copy} className="flex h-10 items-center gap-1.5 rounded-full border border-fm-line px-3.5 text-[13px] font-semibold text-fm-ink hover:bg-fm-card">
              {copied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy</>}
            </button>
          </div>
          <button type="button" className={primary} onClick={share}><Share size={16} aria-hidden /> Send the invite</button>
          {onOpenCrew ? (
            <button type="button" onClick={() => onOpenCrew(created.crewId)} className="flex h-12 items-center justify-center rounded-full border border-fm-line text-[15px] font-semibold text-fm-ink hover:bg-fm-card">Open your crew</button>
          ) : (
            <a href={created.link} className="flex h-12 items-center justify-center rounded-full border border-fm-line text-[15px] font-semibold text-fm-ink hover:bg-fm-card">Open your crew page</a>
          )}
          {!hasPhone && (
            <div className="flex flex-col gap-2 rounded-2xl border border-fm-line-dim bg-fm-canvas p-4">
              {textsOn ? (
                <p className="m-0 flex items-center gap-2 text-sm text-fm-ink"><Check size={16} className="text-fm-accent" aria-hidden /> Texts are on. Leaf will text you about this crew.</p>
              ) : (
                <>
                  <label htmlFor="crew-texts-phone" className="text-sm font-semibold text-fm-ink">Text me about this crew</label>
                  <p className="m-0 text-xs leading-relaxed text-fm-muted">Date polls, the night that locks, and the booking link. Reply STOP any time.</p>
                  <div className="flex gap-2">
                    <input id="crew-texts-phone" className={`${field} h-11`} value={textPhone} onChange={(e) => setTextPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" autoComplete="tel-national" />
                    <button type="button" onClick={turnOnTexts} disabled={busy} className="h-11 shrink-0 rounded-full bg-fm-ink px-4 text-sm font-bold text-fm-canvas disabled:opacity-60">Text me</button>
                  </div>
                </>
              )}
            </div>
          )}
          {how === "google" && (
            <button type="button" onClick={connectCalendar} disabled={busy} className="flex items-center gap-3 rounded-2xl border border-fm-line-dim bg-fm-canvas p-4 text-left hover:bg-fm-card disabled:opacity-60">
              <CalendarCheck size={20} className="shrink-0 text-fm-accent" aria-hidden />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-fm-ink">Connect your Google Calendar</span>
                <span className="text-xs text-fm-muted">So Leaf only suggests nights you&rsquo;re free.</span>
              </span>
            </button>
          )}
        </>
      )}

      {error && <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p>}
    </div>
  );
}
