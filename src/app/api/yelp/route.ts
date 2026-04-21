import { NextRequest, NextResponse } from "next/server";

const YELP_API_KEY = process.env.YELP_API_KEY || "";

// Categories people would actually want to visit as a group
const GROUP_CATEGORIES = [
  "restaurants",
  "bars",
  "museums",
  "parks",
].join(",");

// Map Yelp categories to app categories
function mapCategory(categories: { alias: string; title: string }[]): string {
  const aliases = categories.map((c) => c.alias).join(",");
  if (/restaurant|food|dining|brunch|breakfast|lunch|dinner|cafe|coffee|bakeries|pizza|sushi|mexican|italian|chinese|thai/.test(aliases)) return "dining";
  if (/sport|recreation|stadiums|basketball|soccer|bowling|gokarts|paintball|laser_tag|skating|surfing|climbing|boating/.test(aliases)) return "sports";
  if (/music|concert|dj|karaoke|musicvenues|jazz|comedyclubs/.test(aliases)) return "music";
  if (/art|gallery|museum|theater|theatre|film|cinema|performing|pottery|cookingclasses/.test(aliases)) return "arts";
  if (/nightlife|bar|pub|club|lounge|brewery|wine_bars|cocktailbars|winetastingroom/.test(aliases)) return "nightlife";
  if (/park|hik|outdoor|garden|beach|nature|camping|playground|mini_golf|boating|surfing/.test(aliases)) return "outdoors";
  if (/escapegames|arcades|axethrowing|teambuilding|amusementparks|trampoline/.test(aliases)) return "sports";
  return "arts";
}

// ── Plan generation helpers ──────────────────────────────────────────

interface PlanInfo {
  title: string;
  description: string;
  suggestedDays: string[];
  suggestedTimes: string[];
}

function generatePlan(name: string, category: string, aliases: string, rating: number): PlanInfo {
  const stars = rating >= 4.5 ? "top-rated" : rating >= 4 ? "highly-rated" : "popular";

  // Category-specific title prefixes and time suggestions
  if (/brunch|breakfast/.test(aliases)) {
    return {
      title: `Brunch at ${name}`,
      description: `Start the weekend right with a group brunch at this ${stars} spot.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["morning"],
    };
  }
  if (/cafe|coffee|bakeries/.test(aliases)) {
    return {
      title: `Coffee Meetup at ${name}`,
      description: `Catch up over coffee and pastries at this ${stars} local cafe.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["morning"],
    };
  }
  if (/pizza/.test(aliases)) {
    return {
      title: `Pizza Night at ${name}`,
      description: `Grab a few pies with the crew at this ${stars} pizza spot.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening"],
    };
  }
  if (/bar|pub|brewery|wine_bars|cocktailbars|winetastingroom/.test(aliases)) {
    return {
      title: `Happy Hour at ${name}`,
      description: `Unwind together at this ${stars} local spot.`,
      suggestedDays: ["Thursday", "Friday"],
      suggestedTimes: ["evening"],
    };
  }
  if (/restaurant|food|dining|sushi|mexican|italian|chinese|thai/.test(aliases)) {
    return {
      title: `Group Dinner at ${name}`,
      description: `Get the group together for a meal at this ${stars} restaurant.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening"],
    };
  }
  if (/bowling/.test(aliases)) {
    return {
      title: `Bowling Night at ${name}`,
      description: `Hit the lanes for a fun, competitive group outing.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening"],
    };
  }
  if (/escapegames/.test(aliases)) {
    return {
      title: `Escape Room Challenge at ${name}`,
      description: `Test your teamwork and problem-solving skills together.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["afternoon"],
    };
  }
  if (/arcades|gokarts|laser_tag|trampoline|amusementparks/.test(aliases)) {
    return {
      title: `Game Day at ${name}`,
      description: `Burn some energy and have a blast at this ${stars} spot.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["afternoon"],
    };
  }
  if (/axethrowing|paintball/.test(aliases)) {
    return {
      title: `Adventure Outing at ${name}`,
      description: `Try something different with the group at this ${stars} venue.`,
      suggestedDays: ["Saturday"],
      suggestedTimes: ["afternoon"],
    };
  }
  if (/museum|gallery/.test(aliases)) {
    return {
      title: `Museum Visit to ${name}`,
      description: `Explore art and culture together at this ${stars} museum.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["afternoon"],
    };
  }
  if (/theater|theatre|performing|comedyclubs/.test(aliases)) {
    return {
      title: `Show Night at ${name}`,
      description: `Enjoy a live performance together at this ${stars} venue.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening"],
    };
  }
  if (/park|hik|garden|beach|nature|playground/.test(aliases)) {
    return {
      title: `Outdoor Day at ${name}`,
      description: `Get some fresh air and enjoy the outdoors together.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["morning", "afternoon"],
    };
  }
  if (/karaoke/.test(aliases)) {
    return {
      title: `Karaoke Night at ${name}`,
      description: `Sing your hearts out at this ${stars} karaoke spot.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening", "night"],
    };
  }
  if (/climbing/.test(aliases)) {
    return {
      title: `Rock Climbing at ${name}`,
      description: `Challenge yourselves on the wall at this ${stars} climbing gym.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["morning", "afternoon"],
    };
  }
  if (/skating|surfing|boating/.test(aliases)) {
    return {
      title: `Active Outing at ${name}`,
      description: `Get moving together at this ${stars} spot.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["morning", "afternoon"],
    };
  }
  if (/pottery|cookingclasses/.test(aliases)) {
    return {
      title: `Workshop at ${name}`,
      description: `Learn something new together at this ${stars} studio.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["afternoon"],
    };
  }

  // Generic fallback
  if (category === "dining") {
    return {
      title: `Dinner Outing at ${name}`,
      description: `Enjoy a group meal at this ${stars} local spot.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening"],
    };
  }
  if (category === "sports") {
    return {
      title: `Sports Outing at ${name}`,
      description: `Get active together at this ${stars} venue.`,
      suggestedDays: ["Saturday", "Sunday"],
      suggestedTimes: ["afternoon"],
    };
  }
  if (category === "nightlife") {
    return {
      title: `Night Out at ${name}`,
      description: `Get the group together for a fun evening out.`,
      suggestedDays: ["Friday", "Saturday"],
      suggestedTimes: ["evening", "night"],
    };
  }

  return {
    title: `Group Outing to ${name}`,
    description: `Check out this ${stars} local spot with the group.`,
    suggestedDays: ["Saturday"],
    suggestedTimes: ["afternoon"],
  };
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  const query = request.nextUrl.searchParams.get("q");
  if (!city || !YELP_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  const headers = {
    Authorization: `Bearer ${YELP_API_KEY}`,
    Accept: "application/json",
  };

  const termParam = query ? `&term=${encodeURIComponent(query)}` : "";

  // Match iOS app: 40km radius, best_match sort, fetch 20 to allow post-filtering
  const res = await fetch(
    `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}${query ? termParam : `&categories=${GROUP_CATEGORIES}`}&sort_by=best_match&radius=40000&limit=20`,
    { headers }
  );

  if (!res.ok) {
    return NextResponse.json({ events: [] });
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businesses: any[] = (data.businesses || [])
    // Post-filter: rating >= 3.0 and must not be permanently closed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => (b.rating ?? 0) >= 3.0 && !b.is_closed)
    .slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = businesses.map((b: any) => {
    const category = b.categories ? mapCategory(b.categories) : "arts";
    const aliases = b.categories?.map((c: { alias: string }) => c.alias).join(",") || "";
    const plan = generatePlan(b.name, category, aliases, b.rating || 0);

    return {
      id: `yelp-${b.id}`,
      title: b.name,
      description: b.categories?.map((c: { title: string }) => c.title).join(", ") || "",
      planTitle: plan.title,
      planDescription: plan.description,
      category,
      image: b.image_url || null,
      source: "yelp",
      url: b.url || null,
      venue: {
        name: b.name,
        address: b.location?.display_address?.join(", ") || "",
      },
      suggestedDate: null,
      suggestedTime: null,
      capacityMin: null,
      capacityMax: null,
      suggestedDays: plan.suggestedDays,
      suggestedTimes: plan.suggestedTimes,
    };
  });

  return NextResponse.json({ events });
}
