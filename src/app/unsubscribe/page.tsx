import UnsubscribeClient from "./UnsubscribeClient";
import HostOptOutClient from "./HostOptOutClient";
import HostEmailOptOutClient from "./HostEmailOptOutClient";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{
    u?: string; t?: string; g?: string; c?: string; k?: string; h?: string;
  }>;
}) {
  const params = await searchParams;

  // Roster hosts are not _User rows, so they arrive as `h` rather than `u`.
  // Branch before UnsubscribeClient because that component unsubscribes on
  // mount, and this flow has to offer a choice (pause vs remove) instead —
  // firing on load would opt someone out of everything for clicking a link to
  // see what it did.
  if (params.k === "host-offers") {
    return <HostOptOutClient hostId={params.h || ""} token={params.t || ""} />;
  }
  // Admin-sent host updates. Also a button, not on load; see the component.
  if (params.k === "host-emails") {
    return <HostEmailOptOutClient hostId={params.h || ""} token={params.t || ""} />;
  }

  return (
    <UnsubscribeClient
      userId={params.u || ""}
      token={params.t || ""}
      eventGroupId={params.g || ""}
      calendarId={params.c || ""}
      kind={params.k || ""}
    />
  );
}
