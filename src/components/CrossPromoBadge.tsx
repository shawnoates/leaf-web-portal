"use client";

import Link from "next/link";
import Parse from "@/lib/parse-client";
import { createPortal } from "react-dom";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { getVerifiedUserCookie } from "@/lib/verified-user";

// Cross-promotion attribution — "this plan came from another calendar."
// Two variants per the design spec (Cross-promo Attribution, option 1C):
//   <CrossPromoPhotoBadge/>  dark badge over a plan card's photo
//   <CrossPromoEyebrow/>     light eyebrow above the date line in a detail header
// Both lead with the source calendar's avatar (never truncated) and ellipsize
// the name. Tapping opens a small sheet that answers "who is this?" in place
// (avatar, name, description) and offers "View calendar" / "Follow" — the
// viewer is mid-browse on a calendar they follow, so a full navigation to the
// source page (whose description sits at the bottom) threw away their place
// without answering the question.

export interface CrossPromoSource {
  name: string | null;
  shareId: string | null;
  photoUrl?: string | null;
  /** The source calendar's `descriptionString`. Absent from older payloads. */
  description?: string | null;
  /** Needed for the Follow action; the popover hides Follow without it. */
  calendarId?: string | null;
}

function Avatar({ name, photoUrl, size = 18 }: Pick<CrossPromoSource, "name" | "photoUrl"> & { size?: number }) {
  const radius = Math.round(size * 0.28);
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, borderRadius: radius }}
        className="object-cover flex-none"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size / 2) }}
      className="flex-none inline-flex items-center justify-center bg-[#1f3a5f] text-white font-bold"
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

// A card is usually itself clickable (opens the plan); the badge must not
// also trigger that.
function stop(e: MouseEvent) {
  e.stopPropagation();
}

type FollowState = "idle" | "busy" | "following" | "pending" | "error";

/**
 * The "who is this calendar?" sheet. Rendered through a portal so it escapes
 * the plan modals (which scroll and clip) the badge often sits inside.
 */
function CrossPromoPopover({ source, onClose }: { source: CrossPromoSource; onClose: () => void }) {
  const name = source.name || "Another calendar";
  const description = (source.description || "").trim();
  const [verified] = useState(() => getVerifiedUserCookie());
  const [follow, setFollow] = useState<FollowState>("idle");
  const [followError, setFollowError] = useState("");
  const canFollow = Boolean(source.calendarId && verified?.name && verified?.phone);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleFollow = async () => {
    if (!canFollow || follow === "busy" || !verified) return;
    setFollow("busy");
    setFollowError("");
    try {
      // Same endpoint the calendar page's own Follow uses; idempotent. The
      // legacy `leaf_follower` cookie is single-calendar and belongs to the
      // page the viewer is on, so it is deliberately NOT rewritten here.
      const result = (await Parse.Cloud.run("followCalendarViaWeb", {
        calendarId: source.calendarId,
        name: verified.name,
        phoneNumber: verified.phone.replace(/\D/g, ""),
      })) as { alreadyFollowing?: boolean; pending?: boolean } | null | undefined;
      setFollow(result?.pending ? "pending" : "following");
    } catch (err: unknown) {
      setFollowError(err instanceof Error ? err.message : "Could not follow. Please try again.");
      setFollow("error");
    }
  };

  const followLabel =
    follow === "following" ? "Following" : follow === "pending" ? "Request sent" : "Follow";

  const sheet = (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        stop(e);
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="xp-popover-title"
        onClick={stop}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start gap-4">
          <Avatar name={source.name} photoUrl={source.photoUrl} size={48} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a7a78]">Hosts this plan</p>
            <h2 id="xp-popover-title" className="text-lg font-semibold text-zinc-900 leading-snug break-words">
              {name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line line-clamp-6">
          {description || `${name} runs this plan on its own calendar and shared it here.`}
        </p>

        {followError && (
          <p role="alert" className="text-xs text-red-600">
            {followError}
          </p>
        )}

        <div className="flex gap-3">
          {source.shareId ? (
            <Link
              href={`/org/${source.shareId}`}
              onClick={stop}
              className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-center text-white bg-zinc-900 rounded-lg hover:opacity-90 transition-opacity no-underline"
            >
              View calendar
            </Link>
          ) : null}
          {canFollow && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={follow === "busy" || follow === "following" || follow === "pending"}
              className="flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg border border-zinc-300 text-zinc-900 hover:bg-zinc-50 transition-colors disabled:opacity-60 flex items-center justify-center"
            >
              {follow === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : followLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

function Wrapper({
  source,
  className,
  children,
}: {
  source: CrossPromoSource;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = `Shared from ${source.name || "another calendar"}`;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          stop(e);
          e.preventDefault();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      {open && <CrossPromoPopover source={source} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Bottom-left badge over a plan photo. The parent must be `position: relative`. */
export function CrossPromoPhotoBadge({ source }: { source: CrossPromoSource }) {
  return (
    <Wrapper
      source={source}
      className="absolute left-3 bottom-3 z-[1] max-w-[calc(100%-24px)] inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-[7px] bg-[rgba(17,17,17,0.78)] hover:bg-[rgba(17,17,17,0.9)] backdrop-blur-[8px] text-white text-xs font-semibold tracking-normal whitespace-nowrap cursor-pointer transition-colors"
    >
      <Avatar name={source.name} photoUrl={source.photoUrl} />
      <span className="overflow-hidden text-ellipsis">{source.name || "Another calendar"}</span>
    </Wrapper>
  );
}

/** Eyebrow above a detail header's date line. Hugs its content. */
export function CrossPromoEyebrow({ source }: { source: CrossPromoSource }) {
  return (
    <Wrapper
      source={source}
      className="group/xp self-start max-w-full inline-flex items-center gap-2 pl-[5px] pr-2.5 py-[5px] rounded-md bg-[#f2f2f0] hover:bg-[#e9e9e6] text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap cursor-pointer transition-colors"
    >
      <Avatar name={source.name} photoUrl={source.photoUrl} />
      <span className="text-[#7a7a78]">Shared from</span>
      <span className="text-[#111] group-hover/xp:text-[#555] overflow-hidden text-ellipsis transition-colors">
        {source.name || "Another calendar"}
      </span>
    </Wrapper>
  );
}
