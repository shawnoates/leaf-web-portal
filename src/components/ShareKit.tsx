"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, MessageSquare, Smartphone, FileText } from "lucide-react";
import Parse from "@/lib/parse-client";
import { SITE_URL } from "@/lib/site";
import {
  COPY,
  CC_EMAIL,
  type ShareKitContext,
  type ShareKitOption,
  type ShareKitOptionId,
} from "@/app/me/shareKitCopy";

// ============================================================================
// Share kit — the four notes a follower can pass on (handoff 2026-09-10,
// turns 4–5). One row spec shared by the post-follow modal/sheet and the /me
// card; only the chrome around the rows differs. Everything sends from the
// follower's own apps (mailto / sms / clipboard / print), never from Leaf.
// ============================================================================

export interface ShareKitPayload {
  calendarId: string | null;
  calendarName: string;
  shareId: string | null;
}

export type ShareKitSurface = "post_follow" | "me_card";

// Sent events end eligibility server-side (recordBuildingIntroEvent); the row
// stays for this mount so a second note can still be sent.
type SentEvent = "mailto_opened" | "sms_opened" | "copy_used" | "flyer_opened";

export function calendarUrl(shareId: string | null) {
  return shareId ? `${SITE_URL}/org/${shareId}` : SITE_URL;
}

export interface ShareKitItem extends Omit<ShareKitOption, "subject" | "body"> {
  subject: string | null;
  body: string | null;
}

export function useShareKit({
  payload,
  firstName,
  surface,
  preview = false,
}: {
  payload: ShareKitPayload;
  firstName: string;
  surface: ShareKitSurface;
  preview?: boolean;
}) {
  const [openId, setOpenId] = useState<ShareKitOptionId | null>(null);
  const [copiedId, setCopiedId] = useState<ShareKitOptionId | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ShareKitOptionId, string>>>({});
  const copiedTimer = useRef<number | null>(null);
  const renderedRef = useRef(false);

  const record = useCallback(
    (event: "rendered" | SentEvent) => {
      Parse.Cloud.run("recordBuildingIntroEvent", {
        event,
        surface,
        calendarId: payload.calendarId,
        ...(preview ? { preview: true } : {}),
      }).catch(() => {});
    },
    [surface, payload.calendarId, preview],
  );

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    record("rendered");
  }, [record]);

  useEffect(() => () => {
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
  }, []);

  const ctx: ShareKitContext = { calendarName: payload.calendarName, url: calendarUrl(payload.shareId), firstName };
  const items: ShareKitItem[] = COPY.options.map((o) => ({
    ...o,
    subject: o.subject ? o.subject(ctx) : null,
    body: o.body ? drafts[o.id] ?? o.body(ctx) : null,
  }));

  const toggle = (id: ShareKitOptionId) => setOpenId((cur) => (cur === id ? null : id));
  const setDraft = (id: ShareKitOptionId, text: string) => setDrafts((d) => ({ ...d, [id]: text }));

  async function copy(item: ShareKitItem) {
    if (item.body == null) return;
    const text = item.subject ? `${item.subject}\n\n${item.body}` : item.body;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard blocked; the text is selectable in the textarea
    }
    record("copy_used");
    setCopiedId(item.id);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedId(null), 1500);
  }

  const mailtoHref = (item: ShareKitItem) =>
    `mailto:?cc=${encodeURIComponent(CC_EMAIL)}` +
    `&subject=${encodeURIComponent(item.subject || "")}&body=${encodeURIComponent(item.body || "")}`;
  const smsHref = (item: ShareKitItem) => `sms:?&body=${encodeURIComponent(item.body || "")}`;
  // The follower view of /promote is a letter-size flyer with the QR code and
  // a Print / Save as PDF button — both flyer actions land there.
  const flyerHref = payload.shareId ? `/org/${payload.shareId}/promote` : null;

  return { items, openId, copiedId, toggle, setDraft, copy, record, mailtoHref, smsHref, flyerHref };
}

export type ShareKit = ReturnType<typeof useShareKit>;

// ---- Rows ------------------------------------------------------------------
const ICON: Record<ShareKitOptionId, typeof Mail> = {
  email: Mail,
  chat: MessageSquare,
  text: Smartphone,
  flyer: FileText,
};

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function ShareKitRows({ kit, compact = false }: { kit: ShareKit; compact?: boolean }) {
  return (
    <div className="sk-rows">
      {kit.items.map((item) => {
        const Icon = ICON[item.id];
        const open = kit.openId === item.id;
        const copied = kit.copiedId === item.id;
        const bodyId = `sk-body-${item.id}`;
        return (
          <div key={item.id} className={`sk-row${open ? " open" : ""}`}>
            <button
              type="button"
              className="sk-row-head"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => kit.toggle(item.id)}
            >
              <span className="sk-tile"><Icon size={20} strokeWidth={1.8} aria-hidden /></span>
              <span className="sk-row-text">
                <span className="sk-label">{item.label}</span>
                {!compact && <span className="sk-sub">{item.subtitle}</span>}
              </span>
              <span className="sk-chev" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </button>
            {open && (
              <div className="sk-body" id={bodyId}>
                {item.body != null ? (
                  <div className="sk-paper">
                    <textarea
                      ref={grow}
                      className="sk-ta"
                      rows={1}
                      value={item.body}
                      aria-label={item.label}
                      onChange={(e) => { kit.setDraft(item.id, e.target.value); grow(e.currentTarget); }}
                    />
                  </div>
                ) : (
                  <p className="sk-note">{item.note}</p>
                )}
                <div className="sk-acts">
                  <Primary kit={kit} item={item} copied={copied} />
                  <Secondary kit={kit} item={item} copied={copied} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Primary({ kit, item, copied }: { kit: ShareKit; item: ShareKitItem; copied: boolean }) {
  switch (item.id) {
    case "email":
      return <a className="sk-btn" href={kit.mailtoHref(item)} onClick={() => kit.record("mailto_opened")}>{item.primary}</a>;
    case "text":
      return <a className="sk-btn" href={kit.smsHref(item)} onClick={() => kit.record("sms_opened")}>{item.primary}</a>;
    case "flyer":
      return <FlyerLink kit={kit} className="sk-btn">{item.primary}</FlyerLink>;
    case "chat":
      return (
        <button type="button" className="sk-btn" onClick={() => kit.copy(item)}>
          {copied ? COPY.copied : item.primary}
        </button>
      );
  }
}

function Secondary({ kit, item, copied }: { kit: ShareKit; item: ShareKitItem; copied: boolean }) {
  if (!item.secondary) return null;
  if (item.id === "flyer") return <FlyerLink kit={kit} className="sk-link">{item.secondary}</FlyerLink>;
  return (
    <button type="button" className="sk-link" onClick={() => kit.copy(item)}>
      {copied ? COPY.copied : item.secondary}
    </button>
  );
}

function FlyerLink({ kit, className, children }: { kit: ShareKit; className: string; children: React.ReactNode }) {
  if (!kit.flyerHref) return <span className={className} aria-disabled="true">{children}</span>;
  return (
    <a className={className} href={kit.flyerHref} target="_blank" rel="noopener noreferrer" onClick={() => kit.record("flyer_opened")}>
      {children}
    </a>
  );
}

// ---- Skyline band (post-follow header) -------------------------------------
export function Skyline() {
  return (
    <>
      <svg className="sk-sky sk-sky-m" viewBox="0 0 390 56" fill="none" stroke="#7a5a12" strokeWidth="1.4" strokeLinejoin="round" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path d="M0 56V30h30V18h20v38" /><path d="M50 56V36h26V22h16v34" /><path d="M92 56V12h38v44" /><path d="M110 12V4h8v8" /><path d="M130 56V30h26v12h18v14" /><path d="M174 56V20h32v36" /><path d="M206 56V26h24v30" /><path d="M230 56V8h42v48" /><path d="M248 8V2h6v6" /><path d="M272 56V34h24V24h16v32" /><path d="M312 56V40h20V28h22v28" /><path d="M354 56V16h36v40" />
        <g strokeWidth="1.1" opacity=".7"><path d="M98 22h6M110 22h6M122 22h6M98 32h6M110 32h6M122 32h6M98 42h6M110 42h6M122 42h6" /><path d="M236 18h6M248 18h6M260 18h6M236 30h6M248 30h6M260 30h6M236 42h6M248 42h6M260 42h6" /><path d="M180 30h6M192 30h6M180 42h6M192 42h6" /><path d="M360 28h6M372 28h6M360 40h6M372 40h6" /></g>
      </svg>
      <svg className="sk-sky sk-sky-d" viewBox="0 0 560 84" fill="none" stroke="#7a5a12" strokeWidth="1.5" strokeLinejoin="round" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path d="M0 84V40h40V24h28v60" /><path d="M68 84V52h36V30h22v54" /><path d="M126 84V18h50v66" /><path d="M150 18V6h10v12" /><path d="M176 84V44h34V60h24V84" /><path d="M234 84V28h42v56" /><path d="M276 84V36h30v48" /><path d="M306 84V12h56v72" /><path d="M330 12V2h8v10" /><path d="M362 84V48h30V34h20v50" /><path d="M412 84V56h24V40h28v44" /><path d="M464 84V22h40v62" /><path d="M504 84V46h30V60h26V84" />
        <g strokeWidth="1.2" opacity=".7"><path d="M134 30h8M148 30h8M162 30h8M134 44h8M148 44h8M162 44h8M134 58h8M148 58h8M162 58h8" /><path d="M314 24h8M330 24h8M346 24h8M314 40h8M330 40h8M346 40h8M314 56h8M330 56h8M346 56h8" /><path d="M242 40h8M258 40h8M242 54h8M258 54h8M242 68h8M258 68h8" /><path d="M472 34h8M488 34h8M472 50h8M488 50h8M472 66h8M488 66h8" /><path d="M8 52h8M24 52h8M8 66h8M24 66h8" /></g>
      </svg>
    </>
  );
}

// ---- Scoped styles ---------------------------------------------------------
// Design tokens from the handoff. Scoped under .sk so the same rows render
// identically inside the Tailwind org page and the CSS-string /me page.
export function ShareKitStyles() {
  return <style>{CSS}</style>;
}

const CSS = `
.sk{--sk-ink:#1a1a1a;--sk-accent:#7a5a12;--sk-tint:#f6e9c8;--sk-paper:#fbf7ec;--sk-open:#f7f5ef;
  --sk-sans:var(--font-geist-sans),system-ui,-apple-system,"Segoe UI",sans-serif;
  --sk-serif:var(--font-newsreader),Georgia,serif;
  font-family:var(--sk-sans);color:var(--sk-ink);-webkit-font-smoothing:antialiased;text-align:left}
.sk *{box-sizing:border-box}
.sk button,.sk textarea{font-family:inherit}
.sk-h{font-family:var(--sk-serif);font-weight:400;letter-spacing:-.01em;margin:0;color:var(--sk-ink)}
.sk-intro{margin:10px 0 0;color:rgba(0,0,0,.6);line-height:1.5;text-wrap:pretty}

/* Rows */
.sk-rows{display:flex;flex-direction:column;gap:4px}
.sk-row{border-radius:16px;background:transparent;transition:background .2s}
.sk-row.open{background:var(--sk-open)}
.sk-row-head{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:8px 10px;
  border:0;background:none;text-align:left;cursor:pointer;color:inherit;border-radius:inherit}
.sk-tile{width:40px;height:40px;border-radius:12px;background:var(--sk-tint);color:var(--sk-accent);
  display:flex;align-items:center;justify-content:center;flex:none}
.sk-row-text{flex:1;min-width:0}
.sk-label{display:block;font-size:16px;font-weight:500;line-height:1.25;color:var(--sk-ink)}
.sk-sub{display:block;font-size:12.5px;color:rgba(0,0,0,.5);margin-top:1px}
.sk-chev{flex:none;display:flex;color:rgba(0,0,0,.35);padding-right:4px;transition:transform .2s}
.sk-row.open .sk-chev{transform:rotate(180deg)}
.sk-body{padding:2px 10px 12px}
.sk-paper{background:var(--sk-paper);border-radius:12px;padding:14px 16px 12px}
.sk-ta{display:block;width:100%;border:0;padding:0;margin:0;resize:none;outline:none;background:transparent;
  font-size:14px;line-height:1.55;color:rgba(0,0,0,.8);overflow:hidden}
.sk-note{margin:2px 0 0;padding:0 2px;font-size:14px;line-height:1.5;color:rgba(0,0,0,.6)}
.sk-acts{display:flex;align-items:center;gap:18px;margin-top:12px;padding:0 2px;flex-wrap:wrap}
.sk-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 22px;border:0;
  border-radius:12px;background:var(--sk-accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;
  text-decoration:none;white-space:nowrap;transition:opacity .12s}
.sk-btn:hover{opacity:.92;color:#fff}
.sk-link{border:0;background:none;padding:0;font-size:14px;color:rgba(0,0,0,.55);text-decoration:underline;cursor:pointer}
.sk-link:hover{color:var(--sk-ink)}
.sk [aria-disabled="true"]{opacity:.5;cursor:default;pointer-events:none}
.sk-btn:focus-visible,.sk-link:focus-visible,.sk-row-head:focus-visible,.sk-later:focus-visible{
  outline:2px solid var(--sk-accent);outline-offset:2px}

/* Post-follow: bottom sheet under 768px, centered modal above */
.sk-post{display:flex;flex-direction:column;min-height:0;max-height:inherit;
  padding-bottom:calc(20px + env(safe-area-inset-bottom))}
.sk-band{flex:none;position:relative;height:56px;background:var(--sk-tint);overflow:hidden;display:flex;align-items:flex-end}
.sk-sky{display:block;width:100%;height:100%}
.sk-sky-d{display:none}
.sk-grip{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:36px;height:4px;border-radius:2px;background:rgba(122,90,18,.3)}
.sk-title{flex:none;padding:18px 22px 18px}
.sk-title .sk-h{font-size:30px;line-height:1.1}
.sk-title .sk-intro{font-size:14px}
.sk-h-d{display:none}
.sk-later{border:0;background:none;padding:0;font-size:14px;color:rgba(0,0,0,.5);cursor:pointer}
.sk-later:hover{color:var(--sk-ink)}
.sk-later.top{display:none}
.sk-post .sk-rows{overflow:auto;min-height:0;padding:0 14px}
.sk-foot{flex:none;text-align:center;padding-top:16px}
@media(min-width:768px){
  .sk-post{padding-bottom:18px}
  .sk-band{height:84px}
  .sk-sky-m{display:none}.sk-sky-d{display:block}
  .sk-grip{display:none}
  .sk-title{padding:24px 30px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .sk-title .sk-h{font-size:32px}
  .sk-h-m{display:none}.sk-h-d{display:inline}
  .sk-later.top{display:block;white-space:nowrap;padding:4px 0 0 12px;color:rgba(0,0,0,.45)}
  .sk-post .sk-rows{padding:0 20px}
  .sk-post .sk-btn{height:42px}
  .sk-foot{display:none}
}

/* /me card: compact rows in a 2×2 grid beside the headline */
.sk-card{border:1.5px dashed rgba(0,0,0,.18);border-radius:16px;padding:18px 24px 16px;margin-top:22px;
  background:#fff;container-type:inline-size}
.sk-card .eyebrow{display:block;margin-bottom:8px}
.sk-grid{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:28px;align-items:center}
.sk-card .sk-h{font-size:24px;line-height:1.15;margin-bottom:6px}
.sk-card .sk-intro{font-size:13px;line-height:1.45;margin:0}
.sk-card .sk-rows{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin:0 -8px}
.sk-card .sk-row{border-radius:12px}
.sk-card .sk-row.open{grid-column:1 / -1}
.sk-card .sk-row-head{min-height:44px;padding:4px 8px;gap:10px}
.sk-card .sk-tile{width:32px;height:32px;border-radius:9px}
.sk-card .sk-label{font-size:14px}
.sk-card .sk-btn{height:40px;padding:0 20px;border-radius:10px}
@container (max-width:700px){
  .sk-grid{grid-template-columns:1fr;gap:16px}
}
@container (max-width:480px){
  .sk-card .sk-rows{grid-template-columns:1fr}
  .sk-card .sk-row.open{grid-column:auto}
}
@media(prefers-reduced-motion:reduce){.sk *{transition:none!important}}
`;
