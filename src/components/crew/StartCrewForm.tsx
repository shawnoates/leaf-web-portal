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
];

type Step = "crew" | "signin" | "done";
type Created = { crewId: string; link: string; inviteLink: string };

const field = "h-12 w-full rounded-2xl border border-fm-line bg-fm-canvas px-4 text-base text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
const primary = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fm-accent px-6 text-[15px] font-bold text-fm-canvas transition hover:brightness-105 disabled:opacity-60";

export default function StartCrewForm({ onOpenCrew }: {
  /** In the dashboard: open the new crew there instead of leaving for its page. */
  onOpenCrew?: (crewId: string) => void;
} = {}) {
  const [step, setStep] = useState<Step>("crew");
  const [crewName, setCrewName] = useState("");
  const [pace, setPace] = useState(14);
  // "Just once" is for one place: ask where up front, so Leaf never picks one.
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<{ placeId?: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        rhythmDays: pace || 28,
        oneTime: pace === 0,
        invitees: [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: "landing",
      })) as Created;
      if (place) {
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
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-fm-ink-2">How often?</legend>
            <div className="grid grid-cols-2 gap-2">
              {PACES.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setPace(p.days)}
                  aria-pressed={pace === p.days}
                  className={`h-11 rounded-full border text-sm font-semibold transition ${pace === p.days ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink hover:bg-fm-card"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
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
            <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">Send the link to the group. Leaf starts planning the first night once 3 of you are in.</p>
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
