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
    "Create a free calendar for your league. Schedule games, manage divisions, track RSVPs, and rally your captains in one place.",
  ctaButtonLabel: "Create Your League Calendar",
  scrollPopupTitle: "Start your own rec league",
  scrollPopupSubtitle: "Free calendar for organizers",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free rec league calendar",
  plans: [
    {
      id: "1",
      title: "Coed Kickball — Week 3",
      daysFromNow: 4,
      time: "6:30 PM",
      description:
        "Diamonds 1 and 2. Four games on the schedule. Sliding Into DMs vs. Kick Assets at 6:30, Base Invaders vs. Pitch Please at 7:45. Bar tab at Park Tavern after.",
      image:
        "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 96,
      location: "Piedmont Park, Active Oval",
    },
    {
      id: "2",
      title: "Softball Opening Day",
      daysFromNow: 9,
      time: "5:00 PM",
      description:
        "First pitch of the spring season. 8 teams, 4 games, 1 home run derby at the end. Food trucks on site. Captains check in by 4:30.",
      image:
        "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=800&q=80",
      hostName: "Jordan",
      attendeeCount: 142,
      location: "Grant Park Fields A & B",
    },
    {
      id: "3",
      title: "Sand Volleyball Tuesdays",
      daysFromNow: 13,
      time: "7:00 PM",
      description:
        "Weekly 6v6 matches across 4 courts. Open division and competitive division. Beer and tacos at the cabana between games. Bring a sub or recruit a sideline cheering section.",
      image:
        "https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=80",
      hostName: "Ashley",
      attendeeCount: 64,
      location: "Westside Sand Courts",
    },
    {
      id: "4",
      title: "Flag Football Sundays",
      daysFromNow: 19,
      time: "10:00 AM",
      description:
        "Week 5 of the fall season. Top 4 records play under the lights at 11:30. Refs provided. Captains: send your roster lock-ins by Friday.",
      image:
        "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&q=80",
      hostName: "Dani",
      attendeeCount: 88,
      location: "Adams Park Fields",
    },
    {
      id: "5",
      title: "Dodgeball One-Day Tournament",
      daysFromNow: 32,
      time: "11:00 AM",
      description:
        "16 teams, double-elimination bracket, costumes encouraged. $25/player, proceeds to ATL Community Food Bank. Trophy, bragging rights, and an open bar for the champs.",
      image:
        "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=800&q=80",
      hostName: "Tasha",
      attendeeCount: 124,
      location: "Westside Park Gym",
    },
    {
      id: "6",
      title: "End-of-Season Championship + Bar Night",
      daysFromNow: 48,
      time: "4:00 PM",
      description:
        "Kickball and softball finals back-to-back, then we take over Ladybird for the awards ceremony. Trophy presentations, MVP votes, and the infamous Best Team Name award.",
      image:
        "https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 210,
      location: "Piedmont Park → Ladybird Grove",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Add a New Sport or Division",
      description:
        "Pickleball? Cornhole league? Coed-only division? Pitch a new format and we'll see if there's demand.",
      category: "Expansion",
      image:
        "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80",
    },
    {
      id: "i2",
      title: "Sponsor Bar Night",
      description:
        "Find a local spot to host weekly post-game hangs. Discount on pitchers, jerseys on the wall, team takes over the back patio.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
    },
    {
      id: "i3",
      title: "Charity Tournament",
      description:
        "One-day bracket with entry fees going to a local cause. Easy way to grow the league while doing some good.",
      category: "Community",
      image:
        "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
    },
    {
      id: "i4",
      title: "Captains' Meeting + Draft Night",
      description:
        "Set the season schedule, draft free agents, hand out rule books. Pizza and beer on the league.",
      category: "Planning",
      image:
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80",
    },
  ],
};

export default function RecLeaguePage() {
  return <CalendarLandingPage config={config} />;
}
