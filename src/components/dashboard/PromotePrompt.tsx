"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Mail, MessageCircle, QrCode, Share2, X } from "lucide-react";
import { SITE_HOST, SITE_URL } from "@/lib/site";
import { PROMOTE_AUDIENCE, promoteMessage } from "@/lib/promoteCopy";

/**
 * "Get your first 10 followers" — the share kit an owner sees on the
 * dashboard while their calendar is new. The page decides when it's due
 * (owner, under GOAL followers, not snoozed — see promotePromptDue); this is
 * just the sheet. Bottom sheet on phones, centered modal from md up, same
 * shell as P2pIntroModal.
 */

export const PROMOTE_GOAL = 10;
const SNOOZE_KEY = (orgId: string) => `leaf:promotePrompt:${orgId}`;
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
// Someone who copied or shared has done the thing — give them longer.
const SHARED_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function promotePromptSnoozed(orgId: string): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY(orgId)) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function snooze(orgId: string, ms: number) {
  try { localStorage.setItem(SNOOZE_KEY(orgId), String(Date.now() + ms)); } catch { /* private mode */ }
}

export default function PromotePrompt({
  orgId,
  calendarName,
  shareId,
  orgType,
  followerCount,
  onClose,
}: {
  orgId: string;
  calendarName: string;
  shareId: string;
  orgType: string | null;
  followerCount: number;
  onClose: () => void;
}) {
  const url = `${SITE_URL}/org/${shareId}`;
  const shownUrl = `${SITE_HOST}/org/${shareId}`;
  const message = promoteMessage(orgType, calendarName, url);
  const audience = orgType ? PROMOTE_AUDIENCE[orgType] : undefined;
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [acted, setActed] = useState(false);
  // Only ever mounted client-side, after the dashboard loads — safe to read
  // navigator in the initializer.
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  // Snooze on the act itself: "Print a flyer" navigates away, and an sms: or
  // mailto: link can background the tab, before close() ever runs.
  const markShared = () => {
    setActed(true);
    snooze(orgId, SHARED_SNOOZE_MS);
  };

  const close = () => {
    snooze(orgId, acted ? SHARED_SNOOZE_MS : SNOOZE_MS);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copy = async (what: "link" | "message") => {
    markShared();
    try {
      await navigator.clipboard.writeText(what === "link" ? url : message);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800);
    } catch { /* clipboard blocked — the text is on screen to select */ }
  };

  const share = async () => {
    try {
      await navigator.share({ title: calendarName, text: message });
      markShared();
    } catch { /* dismissed */ }
  };

  const pct = Math.min(100, Math.round((Math.min(followerCount, PROMOTE_GOAL) / PROMOTE_GOAL) * 100));
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(`Follow ${calendarName}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-prompt-title"
        className="relative bg-white w-full md:max-w-[520px] max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] px-5 pt-2.5 pb-7 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-emerald-700">{calendarName} is live</p>
            <h2 id="promote-prompt-title" className="mt-1 text-[23px] md:text-[26px] font-semibold tracking-tight text-zinc-900 leading-tight">
              Get your first {PROMOTE_GOAL} followers
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="shrink-0 flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[13px] font-medium text-zinc-600">
            {Math.min(followerCount, PROMOTE_GOAL)} of {PROMOTE_GOAL}
          </span>
        </div>

        {canShare && (
          <>
            <button
              onClick={share}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 text-base font-semibold text-white hover:bg-zinc-800 transition-colors md:hidden"
            >
              <Share2 className="w-[18px] h-[18px]" /> Share your calendar
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500 md:hidden">Opens your phone&rsquo;s share sheet with the message and link</p>
          </>
        )}

        <div className={canShare ? "mt-5 hidden md:block" : "mt-5"}>
          <label htmlFor="promote-link" className="text-[13px] text-zinc-600">Your calendar link</label>
          <div className="mt-2 flex gap-2">
            <input
              id="promote-link"
              readOnly
              value={shownUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900"
            />
            <button
              onClick={() => copy("link")}
              className="flex h-11 items-center gap-2 rounded-[10px] bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[13px] text-zinc-600">
            {canShare ? <span className="md:hidden">Or paste this into your group chat</span> : null}
            <span className={canShare ? "hidden md:inline" : ""}>Paste into your group chat or Slack</span>
          </p>
          <p className="mt-2 rounded-xl bg-zinc-100 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 select-all">{message}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {audience ? `Written for ${audience} · edit before you send` : "Edit before you send"}
            </span>
            <div className="flex shrink-0 gap-2">
              {canShare && (
                <button
                  onClick={() => copy("link")}
                  className="h-11 md:hidden whitespace-nowrap rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-900"
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
              )}
              <button
                onClick={() => copy("message")}
                className="h-11 md:h-9 whitespace-nowrap rounded-full border border-zinc-300 px-4 text-sm md:text-[13px] font-medium text-zinc-900 hover:border-zinc-400 transition-colors"
              >
                {copied === "message" ? "Copied" : "Copy message"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 md:gap-2.5">
          <Tile href={smsHref} onClick={markShared} icon={<MessageCircle className="w-[22px] h-[22px]" />} label="Text a friend" />
          <Tile href={mailHref} onClick={markShared} icon={<Mail className="w-[22px] h-[22px]" />} label="Email your list" />
          <Tile href={`/org/${shareId}/promote?org=${orgId}`} internal onClick={markShared} icon={<QrCode className="w-[22px] h-[22px]" />} label="Print a flyer" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className="text-[13px] text-zinc-500">Shows again until you reach {PROMOTE_GOAL}</span>
          <button onClick={close} className="h-11 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  internal,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  internal?: boolean;
  onClick: () => void;
}) {
  const cls =
    "flex flex-col items-center gap-2 rounded-xl border border-zinc-200 px-1 py-4 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 transition-colors";
  const body = (
    <>
      {icon}
      <span className="text-xs md:text-[13px] font-medium">{label}</span>
    </>
  );
  return internal ? (
    <Link href={href} className={cls} onClick={onClick}>{body}</Link>
  ) : (
    <a href={href} className={cls} onClick={onClick}>{body}</a>
  );
}
