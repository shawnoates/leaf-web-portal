"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "ATL Rec League",
  profilePhoto: "https://randomuser.me/api/portraits/men/32.jpg",
  brandColor: "#ea580c",
  followerCount: 847,
  navLabel: "Rec League",
  plansHeader: "Upcoming Games",
  ctaTitle: "Run Your Rec League",
  ctaSubtitle:
    "Your league already runs the games. Leaf runs everything around them — post-game happy hours, conditioning runs, watch parties, and captain hangs.",
  ctaButtonLabel: "Create Your League Calendar",
  scrollPopupTitle: "Start your own rec league",
  scrollPopupSubtitle: "Free calendar for organizers",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free rec league calendar",
  plans: [
    {
      id: "1",
      title: "Post-Kickball Happy Hour @ Ladybird",
      daysFromNow: 4,
      time: "9:00 PM",
      description:
        "Games wrap at 8:30 — we take over Ladybird's back patio after. Pitchers on the league, jerseys stay on, season standings on the chalkboard. Recap the bad calls and even worse plays.",
      image:
        "https://images.unsplash.com/photo-1559526324-c1f275fbfa32?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 78,
      location: "Ladybird Grove & Mess Hall",
    },
    {
      id: "2",
      title: "Saturday Pre-Season Conditioning Run",
      daysFromNow: 9,
      time: "8:00 AM",
      description:
        "Easy 3 miles around Piedmont before opening day. Don't show up to the first game gassed after one inning. Coffee at Octane after — captains expected.",
      image:
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80",
      hostName: "Dani",
      attendeeCount: 26,
      location: "Piedmont Park, 14th St Entrance",
    },
    {
      id: "3",
      title: "Braves vs. Phillies Watch Party",
      daysFromNow: 13,
      time: "7:00 PM",
      description:
        "Taking over the upstairs at Park Tavern. Beer towers, $5 wings, and the league banner on the wall. Free-agent signups happen at the bar — bring anyone thinking about joining a team.",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
      hostName: "Ashley",
      attendeeCount: 92,
      location: "Park Tavern Upstairs",
    },
    {
      id: "4",
      title: "Captains Brunch + Schedule Sync",
      daysFromNow: 19,
      time: "11:00 AM",
      description:
        "All 12 captains, one big table. Spring schedule, rule changes, rookie draft order, bottomless mimosas. Show up or your team gets stuck with the 8 AM Sunday games.",
      image:
        "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
      hostName: "Jordan",
      attendeeCount: 14,
      location: "Murphy's, Virginia-Highland",
    },
    {
      id: "5",
      title: "Open Field Pickup Scrimmage",
      daysFromNow: 26,
      time: "6:00 PM",
      description:
        "No standings, no refs, no pressure. Mixed-team scrimmage to shake off the rust mid-season. Bring a friend who's been thinking about joining — we'll sub them in for an inning.",
      image:
        "https://images.unsplash.com/photo-1486218119243-13883505764c?w=800&q=80",
      hostName: "Tasha",
      attendeeCount: 48,
      location: "Grant Park Field B",
    },
    {
      id: "6",
      title: "End-of-Season Awards Night",
      daysFromNow: 48,
      time: "7:00 PM",
      description:
        "Take over Ladybird for the awards ceremony. MVP votes counted live, trophy handoff, and the infamous Best Team Name award. Wear your jersey one last time.",
      image:
        "https://images.unsplash.com/photo-1559526324-c1f275fbfa32?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 186,
      location: "Ladybird Grove & Mess Hall",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Sponsor Bar Crawl",
      description:
        "Lock in 3–4 bars to rotate post-game nights through the season. Discounted pitchers, league-night specials, jerseys on the wall.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
    },
    {
      id: "i2",
      title: "Charity 5K Before Championship Weekend",
      description:
        "Saturday morning fun run, entry fees to a local cause. Captains rally their teams. Hangover-free way to kick off title weekend.",
      category: "Community",
      image:
        "https://images.unsplash.com/photo-1530143584546-02191bc84eb5?w=800&q=80",
    },
    {
      id: "i3",
      title: "Pickup Practice Night",
      description:
        "Open field, no refs, drills + casual scrimmage. Lets new players get a feel before committing — and gives current teams a midweek tune-up.",
      category: "Skills",
      image:
        "https://images.unsplash.com/photo-1483721310020-03333e577078?w=800&q=80",
    },
    {
      id: "i4",
      title: "Tailgate Before Opening Day",
      description:
        "Parking-lot grill-out before first pitch. Captains bring teams, food, coolers. Sets the tone for the whole season.",
      category: "Pre-Game",
      image:
        "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=80",
    },
  ],
};

export default function RecLeaguePage() {
  return <CalendarLandingPage config={config} />;
}
