// Building intro card copy (spec 2026-09-10 §4, §11). Every user-facing string
// in the card lives here so the banned-word rule is checked at build time.

export type BuildingIntroAnswer = "yes" | "declined" | "no" | "unsure";
export type BuildingIntroChannel = "newsletter" | "chat_group" | "online_board" | "physical_board";

export const COPY = {
  prompt: "Does your apartment building have a resident newsletter, chat group or an online or physical bulletin board?",
  options: [
    { key: "yes", label: "Yes, at least one" },
    { key: "declined", label: "Yes, but I'd rather not ask" },
    { key: "no", label: "I don't think so" },
    { key: "unsure", label: "I'm not sure" },
  ] as { key: BuildingIntroAnswer; label: string }[],
  channels: {
    prompt: "Which ones?",
    sub: "Pick all that apply.",
    options: [
      { key: "newsletter", label: "Resident newsletter" },
      { key: "chat_group", label: "Chat group" },
      { key: "online_board", label: "Online bulletin board" },
      { key: "physical_board", label: "Bulletin board in the building" },
    ] as { key: BuildingIntroChannel; label: string }[],
    done: "Done",
  },
  thanks: {
    yes: "Thanks, good to know.",
    declined: "Understood, thanks.",
    no: "Thanks.",
    unsure: "No problem, thanks.",
  } as Record<BuildingIntroAnswer, string>,
  error: "Something went wrong. Give it another go.",
};

const BANNED = [
  /\bgame-?changer\b/i,
  /\bobsessed\b/i,
  /\bgroup ?chat\b/i,
  /\bcurated experiences?\b/i,
  /\bseamlessly\b/i,
];

function flatten(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => flatten(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => flatten(x, out));
  return out;
}

export function findBannedCopy(): string[] {
  return flatten(COPY).filter((s) => BANNED.some((re) => re.test(s)));
}

if (process.env.NODE_ENV !== "production") {
  const hits = findBannedCopy();
  if (hits.length) throw new Error(`buildingIntroCopy: banned word in ${JSON.stringify(hits)}`);
}
