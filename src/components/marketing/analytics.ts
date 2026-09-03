// Marketing-page analytics. Every "Generate" surface on /personal and
// /organizations funnels through one handler, so the funnel dashboard can
// attribute a submit to the surface that produced it.

export type GenerateSource =
  | "hero"
  | "chip"
  | "closing"
  | "sticky"
  | "slot"
  | "pricing_free";

function push(event: string, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event, ...(detail || {}) });
}

export function trackGenerateSubmit(
  source: GenerateSource,
  prompt: string,
  extra?: Record<string, unknown>
) {
  push("homepage_generate_submit", {
    source,
    prompt_length: prompt.trim().length,
    ...(extra || {}),
  });
}

export function trackMarketingEvent(
  event: string,
  detail?: Record<string, unknown>
) {
  push(`homepage_${event}`, detail);
}
