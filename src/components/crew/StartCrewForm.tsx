"use client";

/**
 * Start a crew from the web in under a minute: name it, pick how often, verify
 * a phone number (the same one-time code the crew join page uses), and the
 * crew exists. The last step hands back the invite link to send the group and
 * the organizer's own crew page. Someone already signed in skips the phone.
 */

import { useState } from "react";
import { Check, Copy, Share } from "lucide-react";
import Parse from "@/lib/parse-client";
import { setVerifiedUserCookie } from "@/lib/verified-user";
import { trackMarketingEvent } from "@/components/marketing/analytics";

const PACES = [
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 28, label: "Every month" },
  { days: 0, label: "Just once" },
];

type Step = "crew" | "phone" | "code" | "done";
type Created = { crewId: string; link: string; inviteLink: string };

const field = "h-12 w-full rounded-2xl border border-fm-line bg-fm-canvas px-4 text-base text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
const primary = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fm-accent px-6 text-[15px] font-bold text-fm-canvas transition hover:brightness-105 disabled:opacity-60";

export default function StartCrewForm() {
  const [step, setStep] = useState<Step>("crew");
  const [crewName, setCrewName] = useState("");
  const [pace, setPace] = useState(14);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/\D/g, "");
  const e164 = `+1${digits.slice(-10)}`;

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
      setCreated(r);
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
    setStep("phone");
  };

  const sendCode = async () => {
    if (!name.trim()) { setError("Your name, so your friends know who's inviting them."); return; }
    if (digits.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setBusy(true); setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: e164 });
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: e164, code })) as { sessionToken?: string } | string;
      const token = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!token) { setError("That code didn't work. Try again."); setBusy(false); return; }
      await Parse.User.become(token);
      setVerifiedUserCookie(name.trim(), phone);
      const me = Parse.User.current();
      if (me && !me.get("full_name")) { me.set("full_name", name.trim()); me.set("name", name.trim()); await me.save().catch(() => {}); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify that code.");
      setBusy(false);
      return;
    }
    await create();
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
          <button type="button" className={primary} onClick={next} disabled={busy}>{busy ? "Starting…" : "Start the crew"}</button>
          <p className="m-0 text-xs leading-relaxed text-fm-muted">Your friends don&rsquo;t need the app. They join from a link.</p>
        </>
      )}

      {step === "phone" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.1em] text-fm-muted">Almost there</span>
            <h2 className="m-0 font-fm-serif text-[32px] font-normal leading-tight">Who&rsquo;s organizing?</h2>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="org-name" className="text-sm font-semibold text-fm-ink-2">Your name</label>
            <input id="org-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last" autoComplete="name" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="org-phone" className="text-sm font-semibold text-fm-ink-2">Your phone</label>
            <input id="org-phone" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" autoComplete="tel-national" />
          </div>
          <button type="button" className={primary} onClick={sendCode} disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
          <p className="m-0 text-xs leading-relaxed text-fm-muted">We text a one-time code to sign you in. Leaf texts you about this crew&rsquo;s plans; reply STOP any time.</p>
          <button type="button" className="self-start text-sm text-fm-muted underline" onClick={() => { setStep("crew"); setError(""); }}>Back</button>
        </>
      )}

      {step === "code" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.1em] text-fm-muted">Check your texts</span>
            <h2 className="m-0 font-fm-serif text-[32px] font-normal leading-tight">Enter the code</h2>
            <p className="m-0 text-sm text-fm-ink-2">Sent to ({digits.slice(-10, -7)}) {digits.slice(-7, -4)}-{digits.slice(-4)}.</p>
          </div>
          <input className={`${field} text-center font-fm-mono tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" aria-label="Code" />
          <button type="button" className={primary} onClick={verify} disabled={busy || code.length < 4}>{busy ? "Starting your crew…" : "Verify and start"}</button>
          <button type="button" className="self-start text-sm text-fm-muted underline" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>Use a different number</button>
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
          <a href={created.link} className="flex h-12 items-center justify-center rounded-full border border-fm-line text-[15px] font-semibold text-fm-ink hover:bg-fm-card">Open your crew page</a>
        </>
      )}

      {error && <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p>}
    </div>
  );
}
