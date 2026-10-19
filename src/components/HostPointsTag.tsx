import { HOST_POINTS_MAX } from "@/lib/points";

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
