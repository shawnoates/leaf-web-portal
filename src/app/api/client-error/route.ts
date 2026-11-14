import { NextRequest, NextResponse } from "next/server";

// Sink for src/components/CrashScreen.tsx: a page that crashed in someone's
// browser posts its error here and it lands in the server log as one line
// starting "[client-error]", so it can be searched for in Amplify's logs.
// Nothing is stored. Fields are clipped so a bad caller can't flood the log.

export const dynamic = "force-dynamic";

function clip(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  return String(v).slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.length > 20000) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  console.error(
    "[client-error]",
    JSON.stringify({
      where: clip(body.where, 20),
      name: clip(body.name, 100),
      message: clip(body.message, 1000),
      digest: clip(body.digest, 100),
      path: clip(body.path, 300),
      userAgent: clip(body.userAgent || req.headers.get("user-agent"), 300),
      at: clip(body.at, 40),
      stack: clip(body.stack, 4000),
    }),
  );
  return new NextResponse(null, { status: 204 });
}
