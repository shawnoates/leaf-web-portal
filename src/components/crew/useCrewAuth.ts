"use client";

/**
 * Works out how the viewer is identified on a /crew/[token] page.
 *
 * SMS members arrive with an HMAC token. Signed-in members arrive from /me
 * with the crew id in the same URL slot. We try the token first (it needs no
 * session); if the server says the link is unknown and there's a session, we
 * retry as {crewId}. Callers get `auth` to pass to every cloud call.
 *
 * The last page this device saw for the link is kept locally and shown at
 * once on the next visit, then replaced by the fresh one (a crew opened from
 * the app's Home no longer sits on "Loading your crew…" every time).
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { fetchCrew, type CrewAuth, type CrewPage } from "@/lib/crew";

export type CrewLoad =
  | { status: "loading" }
  | { status: "ready"; auth: CrewAuth; data: CrewPage; reload: () => Promise<void> }
  | { status: "expired" }
  | { status: "error"; message: string };

const NOT_FOUND = 101;
const CACHE_PREFIX = "crewPage:";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Cached = { auth: CrewAuth; data: CrewPage; at: number };

function readCache(slug: string): Cached | null {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (!c?.auth || !c?.data || Date.now() - c.at > CACHE_MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}
function writeCache(slug: string, auth: CrewAuth, data: CrewPage) {
  try {
    window.localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ auth, data, at: Date.now() }));
  } catch {
    // Storage full or blocked: the page just loads the slow way next time.
  }
}
function clearCache(slug: string) {
  try { window.localStorage.removeItem(CACHE_PREFIX + slug); } catch { /* ignore */ }
}

export function useCrewAuth(slug: string): CrewLoad {
  const [auth, setAuth] = useState<CrewAuth | null>(null);
  const [data, setData] = useState<CrewPage | null>(null);
  const [failure, setFailure] = useState<"expired" | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(slug);
    (async () => {
      // Paint the last copy first; the fetch below replaces it.
      if (cached) {
        setAuth(cached.auth);
        setData(cached.data);
      }
      // The link that worked last time goes first.
      const attempts: CrewAuth[] = cached ? [cached.auth] : [{ token: slug }];
      if (!cached && Parse.User.current()) attempts.push({ crewId: slug });
      if (cached && !("token" in cached.auth && cached.auth.token === slug)) attempts.push({ token: slug });
      if (cached && "token" in cached.auth && Parse.User.current()) attempts.push({ crewId: slug });
      let lastCode: number | undefined;
      let lastMessage = "";
      for (const candidate of attempts) {
        try {
          const page = await fetchCrew(candidate);
          if (cancelled) return;
          setAuth(candidate);
          setData(page);
          writeCache(slug, candidate, page);
          return;
        } catch (err) {
          lastCode = (err as { code?: number })?.code;
          lastMessage = (err as Error)?.message || "Something went wrong.";
        }
      }
      if (cancelled) return;
      // A dead link shows as dead even if an old copy was on screen. A
      // network hiccup keeps the old copy up instead of an error page.
      if (lastCode === NOT_FOUND) { clearCache(slug); setFailure("expired"); return; }
      if (!cached) setFailure(lastMessage);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const reload = useCallback(async () => {
    if (!auth) return;
    const page = await fetchCrew(auth);
    setData(page);
    writeCache(slug, auth, page);
  }, [auth, slug]);

  if (failure === "expired") return { status: "expired" };
  if (failure) return { status: "error", message: failure };
  if (auth && data) return { status: "ready", auth, data, reload };
  return { status: "loading" };
}
