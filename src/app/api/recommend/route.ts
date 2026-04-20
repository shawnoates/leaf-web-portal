import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ recommendedIds: [] });
  }

  try {
    const { events, orgSettings } = await request.json();

    if (!events?.length || !orgSettings) {
      return NextResponse.json({ recommendedIds: [] });
    }

    // Build compact event list (minimize tokens)
    const eventList = events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any, i: number) => `${i + 1}. [${e.id}] "${e.title}" - ${(e.description || "").slice(0, 100)} (${e.source})`)
      .join("\n");

    const excludedCategories = orgSettings.blacklistCategories?.length
      ? orgSettings.blacklistCategories.join(", ")
      : "None";

    const excludedKeywords = orgSettings.excludeKeywords?.length
      ? orgSettings.excludeKeywords.join(", ")
      : "None";

    const prompt = `You are a recommendation engine for a community group planning app called Leaf. Your job is to pick the best events/activities for a specific organization's members to do together as a group outing.

Organization: ${orgSettings.name || "Unknown"}
Type: ${orgSettings.orgType || "Community group"}
Description: ${orgSettings.description || "No description"}
Calendar: ${orgSettings.calendarDescription || "General"}
Excluded venue categories: ${excludedCategories}
Excluded keywords: ${excludedKeywords}

Below are available events/activities from various sources. Pick the 10 most relevant ones for this organization's members to attend together as a group activity. Consider:
- The org's values, mission, and audience
- What would make a fun, appropriate group outing for these members
- Variety across different types of activities
- Exclude anything that conflicts with the org's values or excluded categories/keywords

Events:
${eventList}

Return ONLY a JSON array of the selected event IDs in ranked order (best first). Example: ["tm-123", "yelp-456", "tmdb-789"]`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const recommendedIds: string[] = JSON.parse(text);

    return NextResponse.json({ recommendedIds: recommendedIds.slice(0, 10) });
  } catch {
    return NextResponse.json({ recommendedIds: [] });
  }
}
