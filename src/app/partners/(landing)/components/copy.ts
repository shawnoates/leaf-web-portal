/**
 * The /partners page in three versions (2026-10-15), picked by ?for=:
 *   bar    (default) Neighbor Hours: free first night, then $6 per RSVP
 *   shop   a Neighbor Night: a $20 ticket that's $20 to spend, Leaf keeps $6 after the first
 *   studio a taster class: tickets at their price, Leaf keeps $6 after the first
 * A rep's claim email links to the version it describes.
 */
export type Kind = "bar" | "shop" | "studio";

export function kindOf(v: string | string[] | undefined | null): Kind {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "shop" || s === "studio" ? s : "bar";
}

type Step = { n: string; h: string; b: string };
type Faq = { q: string; a: string };
type OfferCard = { tag?: string; kind: string; amount: string; per: string; desc: string; list: string[] };

export interface PartnerCopy {
  tab: string;
  cta: string;
  heroTitle: [string, string];
  heroLead: string;
  floatTitle: string;
  floatBadge: string;
  photoAlt: string;
  trust: [string, string, string];
  steps: Step[];
  offerTitle: string;
  offerLead: string;
  offers: [OfferCard, OfferCard];
  faq: Faq[];
  closingTitle: [string, string];
  closingLead: string;
}

const SIGN_IN_FAQ: Faq = {
  q: "I'm already a partner. How do I sign in?",
  a: "Use Partner sign in and enter your email. We'll send you a link to your dashboard, no password needed.",
};

export const COPY: Record<Kind, PartnerCopy> = {
  bar: {
    tab: "Bars & restaurants",
    cta: "Claim your free Neighbor Hour",
    heroTitle: ["Neighbors in your", "slowest hours."],
    heroLead:
      "Tell us your slowest days and hours. We’ll send the residents who live around the corner, from your neighborhood’s Leaf calendar. Your first Neighbor Hour is free: no listing fee, no RSVP fees.",
    floatTitle: "Neighbor Hour at your place",
    floatBadge: "Neighbors",
    photoAlt: "Neighbors laughing around a table at a local bar",
    trust: ["First Neighbor Hour free", "$6 per RSVP after", "No contract"],
    steps: [
      { n: "01", h: "Tell us your slowest hours", b: "Pick the days and hours you’d most like to fill. We’ll set up your free Neighbor Hour." },
      { n: "02", h: "We bring the neighbors", b: "Each week we post a Neighbor Hour at your place on your neighborhood’s Leaf calendar. Residents a short walk away RSVP. A typical one draws 8 to 15." },
      { n: "03", h: "They come back", b: "They order their own, meet each other, and find their new spot." },
    ],
    offerTitle: "You only pay for neighbors who said they’re coming.",
    offerLead: "No contract. Try one, see who walks in, and keep going when it works.",
    offers: [
      {
        tag: "Free",
        kind: "Your first Neighbor Hour",
        amount: "$0",
        per: "on us",
        desc: "No listing fee and no RSVP fees. Add a card to claim it and we’ll set it up with you.",
        list: ["Pick your slowest days and times", "We invite the residents around you", "You just have room for the group"],
      },
      {
        kind: "Every one after",
        amount: "$6",
        per: "per RSVP",
        desc: "One Neighbor Hour a week on one of your days. $6 for each neighbor who RSVPs, counted 2 hours before and charged once a week, never more than the weekly limit you set. Switch it off anytime.",
        list: [
          "RSVPs outside your days and times are free",
          "Set a weekly limit: your RSVP charges never go over it",
          "A one-time $100 setup, added to your first paid week",
          "Optional Leaf host, $99, for any Neighbor Hour you’d like us to run",
        ],
      },
    ],
    faq: [
      { q: "What's the catch?", a: "There isn't one. Your first Neighbor Hour is free: no listing fee, no RSVP fees. After that it's $6 per RSVP, never more than your weekly limit." },
      { q: "Who are these people?", a: "Residents of the buildings around you who use their neighborhood's Leaf calendar to plan their week. They live a short walk away, so they can become regulars." },
      { q: "Do I have to run anything?", a: "No. Give the group a few tables or a corner of the room, and they order off your menu like anyone else. If you'd rather someone run the night, add a Leaf host for $99." },
      { q: "What if nobody shows up?", a: "You only pay for neighbors who RSVP, inside the days and times you pick, and never more than your weekly limit." },
      { q: "How is this different from an ad?", a: "An ad reaches strangers anywhere and charges for clicks. Leaf reaches the people who live a 5-minute walk away, and you pay per person who RSVPs." },
      SIGN_IN_FAQ,
    ],
    closingTitle: ["Fill your slowest hours", "with neighbors."],
    closingLead: "Your first Neighbor Hour is free: no listing fee, no RSVP fees. Nothing is charged today.",
  },

  shop: {
    tab: "Shops",
    cta: "Claim your Neighbor Night",
    heroTitle: ["An evening for neighbors", "in your shop."],
    heroLead:
      "A dozen neighbors from a few blocks away, on one of your quiet evenings. People who’ve walked past and never come in. They buy a $20 ticket that’s $20 to spend that night, so everyone who walks in is ready to buy.",
    floatTitle: "Neighbor Night at your shop",
    floatBadge: "$20 to spend",
    photoAlt: "Neighbors laughing together with drinks in hand",
    trust: ["First Neighbor Night: you keep all of it", "$14 of every $20 after", "No setup fee"],
    steps: [
      { n: "01", h: "Tell us what you’d show them", b: "Three things you’d want every neighbor to know about, something they only get that night, and a quiet evening: after close, a slow hour, or before you open." },
      { n: "02", h: "We bring the neighbors", b: "Your Neighbor Night goes on your neighborhood’s Leaf calendar. Ten to fifteen residents a short walk away buy a $20 ticket that’s $20 to spend with you." },
      { n: "03", h: "They become customers", b: "You show them your favorite things, they browse and shop, and now they know where you are. We pay you the morning after." },
    ],
    offerTitle: "Every neighbor who walks in is ready to buy.",
    offerLead: "No setup fee, no card, nothing upfront. We take our part from ticket sales, never from you.",
    offers: [
      {
        tag: "On us",
        kind: "Your first Neighbor Night",
        amount: "$20",
        per: "of every $20 ticket is yours",
        desc: "Neighbors buy a $20 ticket that’s $20 to spend in your shop that night. On your first one, you keep all of it.",
        list: ["Show neighbors three things you love", "Give them something they only get that night", "We pay you the morning after"],
      },
      {
        kind: "Every one after",
        amount: "$14",
        per: "of every $20 ticket",
        desc: "Leaf keeps $6 of each ticket, and every guest still has $20 to spend with you. It works out to $6 for each neighbor who walks in ready to buy.",
        list: [
          "The ticket is always $20, and always $20 to spend",
          "Card fees are on us",
          "Optional Leaf host, $99, from that night’s ticket sales",
          "No contract: book another night when it works",
        ],
      },
    ],
    faq: [
      { q: "Why would anyone buy a ticket to shop?", a: "They're not paying to shop: they're coming for the evening. A dozen neighbors, something they only get that night, and you telling the story of the shop. The ticket comes back as $20 to spend, so it costs them nothing extra." },
      { q: "So I'm giving away $20?", a: "No: they paid the $20. On your first night you keep all of it. After that you keep $14, and each guest spends at least $20 at your prices. Most spend more." },
      { q: "We're open late anyway. Does it still work?", a: "Yes. We pick your quietest evening hour and bring the group in while you're open. Other customers can still come in; it just makes the place feel busier." },
      { q: "Who are these people?", a: "Residents of the buildings around you who use their neighborhood's Leaf calendar to plan their week. They live a short walk away, so they can become regulars." },
      { q: "How do they use the credit?", a: "They show their Leaf ticket at the register that night." },
      SIGN_IN_FAQ,
    ],
    closingTitle: ["Bring the neighborhood", "into your shop."],
    closingLead: "Your first Neighbor Night is on us: you keep every ticket dollar. No setup fee, no card.",
  },

  studio: {
    tab: "Studios & classes",
    cta: "Claim your first taster",
    heroTitle: ["A taster class for", "your neighbors."],
    heroLead:
      "About an hour of what you teach, for neighbors who live a short walk away. They buy tickets at a price you set, try it, and the ones who love it come back for your full class.",
    floatTitle: "Taster class at your studio",
    floatBadge: "Tickets",
    photoAlt: "Neighbors laughing together",
    trust: ["First taster: you keep all of it", "$6 a ticket after", "No setup fee"],
    steps: [
      { n: "01", h: "Tell us what you’d teach", b: "About an hour of it, a ticket price, and the days that work. Leaf writes the listing with you." },
      { n: "02", h: "We bring the neighbors", b: "Your taster goes on your neighborhood’s Leaf calendar. Ten to fifteen residents a short walk away buy tickets." },
      { n: "03", h: "They sign up for more", b: "They try it, meet each other, and the ones who love it join your full class. We pay you the morning after." },
    ],
    offerTitle: "Fill a class with neighbors, and get paid for it.",
    offerLead: "No setup fee, no card, nothing upfront. We take our part from ticket sales, never from you.",
    offers: [
      {
        tag: "On us",
        kind: "Your first taster",
        amount: "100%",
        per: "of ticket sales are yours",
        desc: "Neighbors buy tickets at a price you set. On your first taster, you keep every ticket dollar.",
        list: ["About an hour of what you teach", "We invite the residents around you", "We pay you the morning after"],
      },
      {
        kind: "Every one after",
        amount: "$6",
        per: "per ticket to Leaf",
        desc: "The rest of every ticket is yours. Tasters sell best between $15 and $50, so on a $35 ticket you keep $29.",
        list: [
          "You set the price",
          "Card fees are on us",
          "Optional Leaf host, $99, from that taster’s ticket sales",
          "No contract: book another when it works",
        ],
      },
    ],
    faq: [
      { q: "What's the catch?", a: "There isn't one. On your first taster you keep every ticket dollar. After that Leaf keeps $6 a ticket and the rest is yours." },
      { q: "Who are these people?", a: "Residents of the buildings around you who use their neighborhood's Leaf calendar to plan their week. They live a short walk away, so they can become regulars." },
      { q: "What should the taster be?", a: "About an hour of your real class: one technique, one small piece to take home, or a beginner flow. Easy for first-timers, and a taste of the full thing." },
      { q: "What if nobody buys a ticket?", a: "Then nothing is charged. You never pay Leaf anything upfront; we only take our part from tickets sold." },
      { q: "How do I get paid?", a: "Connect your bank once on your dashboard. Ticket money lands the morning after each taster." },
      SIGN_IN_FAQ,
    ],
    closingTitle: ["Turn neighbors", "into students."],
    closingLead: "Your first taster is on us: you keep every ticket dollar. No setup fee, no card.",
  },
};
