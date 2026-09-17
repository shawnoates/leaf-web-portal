"use client";

// Static trust strip above the hero headline. The 4.8 is the iPhone app's
// App Store average (checked 2026-09-16 — re-check each release, update if
// it moves ≥0.1). No ratings count and no store name here on purpose —
// those live in "What people say" and the final CTA.

export default function TrustPill() {
  return (
    <div className="trust-pill">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z" />
      </svg>
      Rated 4.8 by planners

      <style jsx>{`
        .trust-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 12px 22px;
          border: 1px solid #e3e3df;
          border-radius: 999px;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          color: #141413;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
