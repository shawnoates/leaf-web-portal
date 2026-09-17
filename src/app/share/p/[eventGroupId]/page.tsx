import { redirect } from "next/navigation";

// Non-AASA mirror of /p/<eventGroupId>. The iOS Universal Link allowlist
// covers /p/* and /open/p/*, so a tap on /share/p/<id> bypasses app
// interception and lands the user in Safari. The server-side redirect to
// /p/<id> happens inside the browser, which does not re-fire AASA, so the
// user stays on the web standalone plan page.
//
// Used by the EventGroup afterSave SMS dispatch in leaflets-server for
// followers who have no current Installation tied to their User — they're
// either non-app users or signed in as a different account in Leaf, and
// would otherwise bounce into a confusing in-app state.

type PageProps = {
  params: Promise<{ eventGroupId: string }>;
  searchParams: Promise<{ copy?: string; rsvp?: string; src?: string; via?: string }>;
};

export default async function ShareRedirectPage({ params, searchParams }: PageProps) {
  const { eventGroupId } = await params;
  const { copy, rsvp, src, via } = await searchParams;
  const query = new URLSearchParams();
  if (copy) query.set("copy", copy);
  if (rsvp) query.set("rsvp", rsvp);
  // Attribution survives the hop. The host share kit links here with
  // ?src=host_share, and /p/ records the arrival; dropping it at this redirect
  // is how the first version silently measured nothing.
  if (src) query.set("src", src);
  // Cross-promotion: keeps the landing on the calendar the link came from.
  if (via) query.set("via", via);
  const qs = query.toString();
  redirect(`/p/${eventGroupId}${qs ? `?${qs}` : ""}`);
}
