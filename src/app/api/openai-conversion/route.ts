import { NextRequest, NextResponse } from "next/server";

const OPENAI_PIXEL_ID = "FVMLwvPMmn8xZGNNktSZ6H";
const OPENAI_API_KEY = process.env.OPENAI_CONVERSIONS_API_KEY;

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_CONVERSIONS_API_KEY not configured");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const body = await request.json();
    const { eventType, timestamp, url, ...data } = body;

    // Send to OpenAI Conversions API
    const response = await fetch("https://bzr.openai.com/v1/events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validate_only: false,
        events: [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: eventType,
            timestamp_ms: timestamp,
            source_url: url,
            action_source: "web",
            data: {
              type: "contents",
              ...data,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI conversion API error:", response.status, await response.text());
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to forward conversion to OpenAI:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
