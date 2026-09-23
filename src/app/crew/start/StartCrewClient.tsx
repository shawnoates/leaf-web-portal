"use client";

/**
 * The five steps of the Friend Mode intro, as a page (the /me and dashboard
 * popups run the same steps in a modal via <StartCrewFlow>).
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useIsLoggedIn } from "@/components/marketing/useMarketingSession";
import StartCrewFlow from "@/components/crew/StartCrewFlow";
import { CrewShell } from "@/components/crew/CrewShell";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

export default function StartCrewClient() {
  const params = useSearchParams();
  const signedIn = useIsLoggedIn();

  return (
    <CrewShell>
      <div className="mb-6">
        <Link href="/" className="text-sm text-leaf-600 hover:underline">← Leaf</Link>
        <div className="mt-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-leaf-600">
          <FriendModeIcon size={24} /> Friend Mode
        </div>
      </div>
      <StartCrewFlow
        signedIn={signedIn}
        suggest={params.get("suggest") === "1"}
        initialName={params.get("name") || ""}
        fromEventGroupId={params.get("from")}
        initialStep={params.get("step") === "consent" ? "consent" : null}
        onClose={null}
      />
    </CrewShell>
  );
}
