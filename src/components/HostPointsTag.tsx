"use client";

import { usePointsConfig } from "@/lib/points-config";

// The "you'd earn points for this" pill next to a Host this button. Self-
// contained styling so it reads the same on /me and on the public calendar
// page, which don't share a stylesheet. The number comes from the server.
export default function HostPointsTag({
  short = false,
  className,
}: {
  /** Tight rows: "up to 50 pts". */
  short?: boolean;
  className?: string;
}) {
  const cfg = usePointsConfig();
  const text = cfg
    ? short ? `up to ${cfg.hostMax} pts` : `Earn up to ${cfg.hostMax} points`
    : short ? "earn pts" : "Earn Leaf points";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10.5,
        fontWeight: 500,
        color: "#253a33",
        background: "#f3f7f5",
        borderRadius: 999,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

// The sentence for a host's confirm screen, right above the button that does
// it. It says what drives the reward, not how it is calculated.
export function HostPointsNote() {
  const cfg = usePointsConfig();
  return (
    <div
      style={{
        background: "#f3f7f5",
        border: "1px solid rgba(0,0,0,.09)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        lineHeight: 1.5,
        color: "#253a33",
      }}
    >
      <span style={{ fontWeight: 500 }}>Earn Leaf points for hosting.</span>{" "}
      The more people who come, the more you earn
      {cfg ? `, up to ${cfg.hostMax} points a plan` : ""}.
    </div>
  );
}
