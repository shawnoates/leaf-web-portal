import Parse from "@/lib/parse-client";

// hostPlanIdea's "the venue's hours say it's closed then" warning
// (HOURS_WARNING_CODE on the server). Google's hours are often wrong for event
// venues, so it's an alert the host can wave through, not a block.
const HOURS_WARNING_CODE = 460;

/**
 * Runs hostPlanIdea; on an hours warning, shows the hours and asks whether to
 * host anyway, resending with `ignoreHours` if so. Returns null when the host
 * backs out — the caller just stays on the form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runHostPlanIdea(params: Record<string, unknown>): Promise<any | null> {
  try {
    return await Parse.Cloud.run("hostPlanIdea", params);
  } catch (err) {
    if ((err as { code?: number })?.code !== HOURS_WARNING_CODE) throw err;
    const message = err instanceof Error ? err.message : "This venue may be closed then.";
    if (!window.confirm(`${message}\n\nHost it anyway?`)) return null;
    return await Parse.Cloud.run("hostPlanIdea", { ...params, ignoreHours: true });
  }
}
