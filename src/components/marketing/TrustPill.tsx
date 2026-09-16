"use client";

// Static trust strip under the hero Generate row. Every claim traces to a
// public source: the 4.8 is the iPhone app's App Store average (checked
// 2026-09-16 — re-check each release, update if it moves ≥0.1); the quote
// is a public review trimmed to one clause. No ratings count and no store
// name here on purpose — those live in "What people say" and the final CTA.

export default function TrustPill() {
  return (
    <div className="trust-pill">
      <span className="trust-pill__rating">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z" />
        </svg>
        Rated 4.8 by Leaf users
      </span>
      <span className="trust-pill__divider" />
      <span className="trust-pill__quote">
        <em>&quot;So easy to send invites and get everyone together.&quot;</em>
        <span className="trust-pill__by">— Layne B.</span>
      </span>
      <span className="trust-pill__divider" />
      <span className="trust-pill__reach">
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Works in any neighborhood
      </span>

      <style jsx>{`
        .trust-pill {
          display: inline-flex;
          align-items: center;
          gap: 20px;
          margin-top: 26px;
          padding: 12px 22px;
          max-width: 1120px;
          border: 1px solid #e3e3df;
          border-radius: 999px;
          background: #fafaf8;
          font-size: 13px;
          line-height: 1;
          color: #141413;
          white-space: nowrap;
        }
        .trust-pill > * {
          flex-shrink: 0;
        }
        .trust-pill__rating {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-weight: 600;
        }
        .trust-pill__divider {
          width: 1px;
          height: 18px;
          background: #d4d4d0;
        }
        .trust-pill__quote {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .trust-pill__by {
          color: #7a7a76;
        }
        .trust-pill__reach {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #55554f;
        }
        @media (max-width: 1023px) {
          .trust-pill__reach,
          .trust-pill__quote + .trust-pill__divider {
            display: none;
          }
        }
        @media (max-width: 767px) {
          .trust-pill {
            flex-direction: column;
            gap: 8px;
            padding: 12px 18px;
            border-radius: 16px;
            white-space: normal;
            text-align: center;
            margin-top: 16px;
          }
          .trust-pill__divider {
            display: none;
          }
        }
        @media (max-width: 479px) {
          .trust-pill__quote {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
