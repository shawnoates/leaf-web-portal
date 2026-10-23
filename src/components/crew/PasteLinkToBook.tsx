"use client";

/**
 * Paste a link (an Instagram or TikTok post, an event page) and it goes in the
 * crew's book: the server reads the page (importLinkToCrew) and files it under
 * Places with a venue, or Happenings with "Where is this?" without. It takes a
 * minute, so `onAdded` runs a couple of times while it lands.
 *
 * The crew page shows this box; the book page offers the same thing from its
 * search (`isLink` / `linkHost` / `importLink`).
 */

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/crew/CrewShell";
import { run, type CrewAuth } from "@/lib/crew";

/** A pasted web link. */
export function isLink(q: string) {
  return /^https?:\/\/\S+\.\S+$/i.test(q) || /^(www\.)?(instagram|tiktok|eventbrite|lu\.ma|luma|yelp|ticketmaster|seatgeek|fandango)\.\S+\/\S*$/i.test(q);
}

/** "instagram.com" from a link, for the row and the note. */
export function linkHost(q: string) {
  try {
    return new URL(/^https?:\/\//i.test(q) ? q : `https://${q}`).hostname.replace(/^www\./, "");
  } catch {
    return "the link";
  }
}

/**
 * Starts the import and returns the "on its way" note. Refreshes the book
 * after 25s and 60s, when it has usually landed.
 */
export async function importLink(auth: CrewAuth, url: string, onAdded: () => unknown): Promise<string> {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const r = await run<{ started: boolean }>("importLinkToCrew", auth, { url: full });
  if (!r.started) return "";
  for (const ms of [25000, 60000]) setTimeout(() => { Promise.resolve(onAdded()).catch(() => {}); }, ms);
  return `Adding ${linkHost(url)}… it'll be in the book in a minute.`;
}

export default function PasteLinkToBook({ auth, onAdded }: { auth: CrewAuth; onAdded: () => unknown }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const trimmed = url.trim();
  const ready = isLink(trimmed);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const text = await importLink(auth, trimmed, onAdded);
      setUrl("");
      setNote(text);
      if (text) setTimeout(() => setNote(""), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Paste a link to add it to the book</span>
          <Link2 size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fm-muted" />
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            placeholder="Paste a link: a post or an event page"
            className="h-12 w-full rounded-full border border-fm-line bg-fm-surface pl-11 pr-4 text-[15px] text-fm-ink outline-none placeholder:text-fm-muted focus:border-fm-ink-2"
          />
        </label>
        <Button small disabled={!ready || busy} type="submit">{busy ? "Adding…" : "Add"}</Button>
      </form>
      {note && <p role="status" className="m-0 ml-4 text-xs text-fm-ink-2">{note}</p>}
      {error && <p role="alert" className="m-0 ml-4 text-xs text-fm-danger">{error}</p>}
    </div>
  );
}
