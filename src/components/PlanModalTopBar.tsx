"use client";

import { useEffect, useState, type RefObject } from "react";
import { Check, Link2, Plus } from "lucide-react";

/**
 * True once the plan's big title has started scrolling up, so the
 * bar can show a smaller copy of it.
 */
export function useTitleScrolledPast(
  scrollRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLElement | null>,
  resetKey?: unknown,
): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const title = titleRef.current;
      if (!title) { setPast(false); return; }
      // As soon as the title starts to slide up toward the bar, so it never
      // sits half-hidden under the buttons.
      setPast(title.getBoundingClientRect().top < el.getBoundingClientRect().top + 12);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [scrollRef, titleRef, resetKey]);
  return past;
}

/**
 * The plan modal's top bar: copy link and close on the right, always there.
 * Once the title scrolls away it becomes a white header holding a smaller
 * title, so it stays put while the details scroll under it.
 */
export function PlanModalTopBar({
  title,
  showTitle,
  onClose,
  onCopyLink,
  linkCopied,
}: {
  title: string;
  showTitle: boolean;
  onClose: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}) {
  return (
    <div
      className={`absolute inset-x-0 top-0 z-50 flex items-center gap-3 pl-8 md:pl-16 pr-4 md:pr-6 py-3 md:py-4 transition-colors duration-200 ${
        showTitle ? "bg-white border-b border-zinc-100" : "pointer-events-none"
      }`}
    >
      <p
        aria-hidden={!showTitle}
        className={`flex-1 min-w-0 truncate text-lg md:text-xl font-light tracking-tight text-zinc-900 transition-opacity duration-200 ${
          showTitle ? "opacity-100" : "opacity-0"
        }`}
      >
        {title}
      </p>
      <div className="pointer-events-auto flex items-center gap-2 shrink-0">
        {onCopyLink && (
          <button
            type="button"
            onClick={onCopyLink}
            title="Copy direct link to this plan"
            aria-label="Copy link to this plan"
            className="p-2 rounded-full bg-zinc-100 text-zinc-900 md:bg-transparent hover:bg-zinc-100"
          >
            {linkCopied ? <Check className="w-5 h-5 text-emerald-600" /> : <Link2 className="w-5 h-5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full bg-zinc-100 text-zinc-900 md:bg-transparent hover:bg-zinc-100"
        >
          <Plus className="w-8 h-8 rotate-45" />
        </button>
      </div>
    </div>
  );
}
