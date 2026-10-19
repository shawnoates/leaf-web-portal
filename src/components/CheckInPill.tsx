"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { POINTS_EVENT } from "@/components/PointsChip";

// What checking in at a plan is worth, and the way to do it from the web.
// Before the window opens it is a small "+30 pts when you check in" pill; from
// 30 minutes before the start to 1 hour after it becomes an "I'm here" button
// that reads the browser's location and asks the server to verify it; once
// done it says so. Nothing shows for plans you host, plans you're not going to,
// or plans whose venue can't be verified (the server sends no points then).

const OPEN_BEFORE_MS = 30 * 60 * 1000;
const CLOSE_AFTER_MS = 60 * 60 * 1000;

export default function CheckInPill({
  planId, date, points, checkedIn, going, hosting,
}: {
  planId: string;
  date: string | null;
  points?: number | null;
  checkedIn?: boolean;
  going: boolean;
  hosting: boolean;
}) {
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | "already" | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (!going || hosting || !date || points == null || now === 0) return null;
  const start = new Date(date).getTime();
  if (!Number.isFinite(start)) return null;

  const isDone = checkedIn || done !== null;
  const open = now >= start - OPEN_BEFORE_MS && now <= start + CLOSE_AFTER_MS;

  if (isDone) {
    const earned = typeof done === "number" ? done : null;
    return <span style={S.pill}>Checked in{earned ? ` · +${earned} pts` : ""}</span>;
  }
  if (now > start + CLOSE_AFTER_MS) return null;
  if (!open) return <span style={S.pill}>+{points} pts when you check in</span>;

  const checkIn = () => {
    if (busy) return;
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share its location. Check in on the Leaf app instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await Parse.Cloud.run("webCheckIn", {
            planId, lat: pos.coords.latitude, lng: pos.coords.longitude,
          });
          setDone(res?.already ? "already" : (res?.points ?? points));
          window.dispatchEvent(new Event(POINTS_EVENT));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Couldn't check you in. Try again.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError("Allow location to check in, or use the Leaf app.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      <button type="button" onClick={checkIn} disabled={busy} style={S.btn}>
        {busy ? "Checking…" : `I'm here · +${points} pts`}
      </button>
      {error && <span style={S.err}>{error}</span>}
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  pill: {
    display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 500, color: "#253a33",
    background: "#f3f7f5", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
  },
  btn: {
    display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "8px 13px",
    borderRadius: 7, border: "1px solid #253a33", background: "#253a33", color: "#fff", cursor: "pointer",
    whiteSpace: "nowrap", fontFamily: "inherit",
  },
  err: { fontSize: 10.5, color: "#b42318", lineHeight: 1.4 },
};
