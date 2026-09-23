"use client";

/**
 * Works out how the viewer is identified on a /crew/[token] page.
 *
 * SMS members arrive with an HMAC token. Signed-in members arrive from /me
 * with the crew id in the same URL slot. We try the token first (it needs no
 * session); if the server says the link is unknown and there's a session, we
 * retry as {crewId}. Callers get `auth` to pass to every cloud call.
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

export function useCrewAuth(slug: string): CrewLoad {
  const [auth, setAuth] = useState<CrewAuth | null>(null);
  const [data, setData] = useState<CrewPage | null>(null);
  const [failure, setFailure] = useState<"expired" | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const attempts: CrewAuth[] = [{ token: slug }];
      if (Parse.User.current()) attempts.push({ crewId: slug });
      let lastCode: number | undefined;
      let lastMessage = "";
      for (const candidate of attempts) {
        try {
          const page = await fetchCrew(candidate);
          if (cancelled) return;
          setAuth(candidate);
          setData(page);
          return;
        } catch (err) {
          lastCode = (err as { code?: number })?.code;
          lastMessage = (err as Error)?.message || "Something went wrong.";
        }
      }
      if (!cancelled) setFailure(lastCode === NOT_FOUND ? "expired" : lastMessage);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const reload = useCallback(async () => {
    if (!auth) return;
    setData(await fetchCrew(auth));
  }, [auth]);

  if (failure === "expired") return { status: "expired" };
  if (failure) return { status: "error", message: failure };
  if (auth && data) return { status: "ready", auth, data, reload };
  return { status: "loading" };
}
