import { HOST_POINTS_MAX } from "@/lib/points";

// The full sentence for a host's confirm screen: what hosting this plan earns,
// right above the button that does it.
export function HostPointsNote() {
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
      10 points when someone comes, plus 3 for everyone who does. Up to {HOST_POINTS_MAX} a plan.
    </div>
  );
}

// The small "you'd earn points for this" pill next to a Host this button.
// Self-contained styling so it reads the same on /me and on the public
// calendar page, which don't share a stylesheet.
export default function HostPointsTag({
  short = false,
  className,
}: {
  /** "up to 50 pts" for tight rows. */
  short?: boolean;
  className?: string;
}) {
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
      {short ? `up to ${HOST_POINTS_MAX} pts` : `Earn up to ${HOST_POINTS_MAX} points`}
    </span>
  );
}
