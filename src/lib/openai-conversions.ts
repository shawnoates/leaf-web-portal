/**
 * OpenAI Ads conversion tracking
 * Sends conversion events to OpenAI's Conversions API
 */

export function trackOpenAIConversion(
  eventType: string,
  data?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;

  // Browser-side: fire the pixel event
  const w = window as unknown as {
    oaiq?: (action: string, event: string, payload: Record<string, unknown>) => void;
  };

  if (w.oaiq) {
    w.oaiq("measure", eventType, {
      type: "contents",
      ...data,
    });
  }

  // Server-side: send to OpenAI Conversions API
  sendServerConversion(eventType, data).catch((e) => {
    console.error("OpenAI conversion tracking failed:", e);
  });
}

async function sendServerConversion(
  eventType: string,
  data?: Record<string, unknown>,
) {
  try {
    // Forward to our backend which will send to OpenAI Conversions API
    // This avoids exposing the API key to the client
    const response = await fetch("/api/openai-conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        timestamp: Date.now(),
        url: window.location.href,
        ...data,
      }),
    });

    if (!response.ok) {
      console.warn(`OpenAI conversion tracking returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send server conversion event:", error);
  }
}
