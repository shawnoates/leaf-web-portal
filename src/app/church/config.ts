// /church — the example calendar linked from /church-leaders.
//
// This page has one job: prove that a member-led calendar looks
// different from the one a church already has. So the mix is
// deliberate and should stay that way if anyone edits it:
//
//   - mostly informal gatherings, hosted by members, using their names
//   - two official items only (service + the youth thing), so it's
//     obvious the two kinds live side by side
//   - a couple of neighborhood events, which is why members open it at all
//
// If this drifts back into a programming calendar it stops selling the
// landing page and starts contradicting it.

import type { LandingConfig } from "@/components/CalendarLandingPage";

export const config: LandingConfig = {
  profileName: "Grace Fellowship",
  profilePhoto:
    "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=400&q=80",
  brandColor: "#1b4332",
  followerCount: 164,
  navLabel: "Church",
  plansHeader: "What's happening",
  ctaTitle: "Start your church's free calendar",
  ctaSubtitle:
    "A community calendar your members fill in themselves — the hikes, the coffees, the meal trains. Your staff doesn't maintain it, and there's nothing to download.",
  ctaButtonLabel: "Start your church's free calendar",
  ctaFootnote: "Free · No card · Nothing to download",
  scrollPopupTitle: "A calendar your members fill in",
  scrollPopupSubtitle: "Free for any church — live in minutes",
  scrollPopupButton: "Start free",
  bottomCtaText: "Start your church's free calendar",
  plans: [
    {
      id: "1",
      title: "Walking the bridge",
      daysFromNow: 3,
      time: "8:00 AM",
      description:
        "Walking the bridge before it gets hot. Meet at the coffee place on the corner, come if you want. Back by 10 or so.",
      image:
        "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 7,
      location: "Coffee shop at Grand & 5th",
    },
    {
      id: "2",
      title: "Moms + strollers at the park",
      daysFromNow: 5,
      time: "10:00 AM",
      description:
        "Park by the library, near the little playground. Bring whatever, no plan. Usually a few of us, sometimes ten.",
      image:
        "https://images.unsplash.com/photo-1503668630001-50cf6f5d256f?w=800&q=80",
      hostName: "Priya",
      attendeeCount: 11,
      location: "Library Park",
    },
    {
      id: "3",
      title: "Helping the Delgados move",
      daysFromNow: 6,
      time: "9:00 AM",
      description:
        "Need two more sets of hands and a truck if anyone has one. Should be done by early afternoon — pizza after.",
      image:
        "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80",
      hostName: "Tomas",
      attendeeCount: 6,
      location: "Bergen St, apartment 3R",
    },
    {
      id: "4",
      title: "Sunday Service",
      daysFromNow: 4,
      time: "10:00 AM",
      description:
        "Worship and teaching, with coffee in the lobby afterward. Kids' programs for all ages.",
      image:
        "https://images.unsplash.com/photo-1519491050282-cf00c82424b4?w=800&q=80",
      hostName: "Grace Fellowship",
      attendeeCount: 148,
      location: "Grace Fellowship",
    },
    {
      id: "5",
      title: "Board games at our place",
      daysFromNow: 7,
      time: "7:00 PM",
      description:
        "First time doing this, no idea who'll come. We have Codenames and a lot of snacks. Kids welcome, it'll be loud anyway.",
      image:
        "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80",
      hostName: "Sam",
      attendeeCount: 9,
      location: "Sam & Dee's, Carroll St",
    },
    {
      id: "6",
      title: "Trying the new Ethiopian place",
      daysFromNow: 4,
      time: "12:30 PM",
      description:
        "Right after service, the corner spot that just opened. Table for however many — say you're coming so I can call ahead.",
      image:
        "https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80",
      hostName: "Rachel",
      attendeeCount: 13,
      location: "Awash, 2 blocks from church",
    },
    {
      id: "7",
      title: "Meal train for the Okonkwos",
      daysFromNow: 8,
      time: "5:30 PM",
      description:
        "Baby came early. Signing up for one night each through the end of the month — drop off at the door, no need to stay.",
      image:
        "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80",
      hostName: "Deb",
      attendeeCount: 15,
      location: "Their place, Prospect Ave",
    },
    {
      id: "8",
      title: "Saturday farmers market run",
      daysFromNow: 10,
      time: "9:30 AM",
      description:
        "Walking over together from the church lot. Nothing organized, just easier than going alone.",
      image:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
      hostName: "Ana",
      attendeeCount: 5,
      location: "Grand Army Plaza Greenmarket",
    },
    {
      id: "9",
      title: "Neighborhood block party",
      daysFromNow: 12,
      time: "1:00 PM",
      description:
        "The block association's annual one. Street closed, music, food trucks. A bunch of us are going as a group.",
      image:
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80",
      hostName: "Carroll St Block Association",
      attendeeCount: 34,
      location: "Carroll St, between 6th & 7th",
    },
    {
      id: "10",
      title: "Youth Night",
      daysFromNow: 11,
      time: "6:30 PM",
      description:
        "Middle and high school. Games, dinner, and a short teaching. Drop-off and pickup in the back lot.",
      image:
        "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80",
      hostName: "Grace Fellowship",
      attendeeCount: 41,
      location: "Fellowship Hall",
    },
    {
      id: "11",
      title: "Early run, easy pace",
      daysFromNow: 9,
      time: "6:15 AM",
      description:
        "Three miles around the park loop. Genuinely easy pace, I stop at every light. Coffee after if anyone's up for it.",
      image:
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80",
      hostName: "Jon",
      attendeeCount: 4,
      location: "Park entrance at 9th St",
    },
    {
      id: "12",
      title: "Repair night in the garage",
      daysFromNow: 14,
      time: "6:00 PM",
      description:
        "Bring a bike, a lamp, whatever's broken. I have tools and two people who actually know what they're doing.",
      image:
        "https://images.unsplash.com/photo-1567361808960-dec9cb578182?w=800&q=80",
      hostName: "Eli",
      attendeeCount: 8,
      location: "Eli's garage, Sterling Pl",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Coffee after service",
      description:
        "Walk to the place down the block instead of heading straight home. Whoever comes, comes.",
      category: "Food & Drink",
      image:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    },
    {
      id: "i2",
      title: "Saturday morning hike",
      description:
        "Pick a trail, post the time, drive out together. No experience and no gear required.",
      category: "Outdoors",
      image:
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
    },
    {
      id: "i3",
      title: "Dinner at someone's table",
      description:
        "Six chairs, one pot of something. The oldest form of this there is.",
      category: "Food & Drink",
      image:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    },
    {
      id: "i4",
      title: "A hand with a move",
      description:
        "Somebody's always moving. Post the address and the time and see who's free.",
      category: "Helping out",
      image:
        "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80",
    },
  ],
  dealsHeader: "Nearby, from the neighborhood",
  deals: [
    {
      id: "d1",
      businessName: "Corner Roasters",
      title: "Buy one coffee, get one free",
      description: "Show the code at the counter. One per person.",
      address: "Grand & 5th · 3 min walk",
      promoCode: "LEAFCORNER",
      dealType: "public",
      interestCount: 19,
      imageUrl:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    },
    {
      id: "d2",
      businessName: "Awash Ethiopian",
      title: "15% off for groups of four or more",
      description: "Dine-in, any night. Just mention it when you sit down.",
      address: "112 Grand Ave · 2 blocks",
      promoCode: "LEAFAWASH",
      dealType: "public",
      interestCount: 12,
      imageUrl:
        "https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80",
    },
    {
      id: "d3",
      businessName: "Prospect Books",
      title: "10% off, always",
      description: "Independent shop around the corner. In-store only.",
      address: "88 Prospect Ave · 5 min walk",
      promoCode: "LEAFREAD",
      dealType: "public",
      interestCount: 7,
      imageUrl:
        "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    },
    {
      id: "d4",
      businessName: "Sterling Hardware",
      title: "Free key cutting",
      description: "Handy for the repair-night crowd. Show the code.",
      address: "301 Sterling Pl · 6 min walk",
      promoCode: "LEAFSTERLING",
      dealType: "public",
      interestCount: 4,
      imageUrl:
        "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80",
    },
  ],
};
