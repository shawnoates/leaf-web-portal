import type { Metadata } from "next";
import PayHostClient from "./PayHostClient";

// The host's side of peer-to-peer plan payments (server: cloud/p2p-payment.js):
// who has paid, confirm / not received, nudge the rest — and, for a signed-in
// host whose plan isn't collecting yet, turning it on.
//
// Reached from host texts ("Maya says she paid you $60… Confirm: <link>"),
// which carry a plan-scoped HMAC as `?t=` so a host without the app can act
// without signing in, and `?confirm=<seat id>` to lead with that guest.
// Everything loads client-side: a signed-in host's session lives in the
// browser, and the token works the same either way.

type PageProps = {
  params: Promise<{ planId: string }>;
  // `u`/`vt`: the signed viewer pair the app adds (getP2pHostLink), traded
  // for a web session like /me's — so setup works in the app's web view.
  searchParams: Promise<{ t?: string; confirm?: string; u?: string; vt?: string }>;
};

export const metadata: Metadata = {
  title: "Payments · Leaf",
  description: "Who has paid you back for this plan.",
  // Private to one host, token or not.
  robots: { index: false, follow: false },
};

export default async function PayHostPage({ params, searchParams }: PageProps) {
  const { planId } = await params;
  const { t, confirm, u, vt } = await searchParams;
  return (
    <PayHostClient
      planId={planId}
      token={t || null}
      confirmId={confirm || null}
      viewer={u && vt ? { userId: u, token: vt } : null}
    />
  );
}
