// Spread "needs a host" plan ideas across the community's real cadence.
//
// The server stamps every generated idea with a single fallback date (the
// first Saturday past a 2-week floor), so a batch of ideas all lands on the
// same day — the calendar reads as "ten things, one Sunday" instead of a
// living month. This recomputes each idea's date on the client so they fan
// out across the weekdays/times the community *actually* meets, inferred
// from real upcoming plans.
//
// Cadence = the distinct (weekday, hour, minute) slots real plans use. With
// no real plans to learn from we fall back to a weekly Saturday-2pm slot so
// ideas still spread by week instead of stacking. Assignment is a stable
// round-robin: ideas ordered by their original date walk forward through the
// cadence slots week over week, skipping any day a real plan already owns so
// a suggestion never shadows a confirmed event. The walk stops at a fixed
// horizon (MAX_WEEKS) so ideas can't drift into a season their copy was never
// written for; anything left unslotted keeps the server's own date.
//
// Shared by the public /org calendar page and the owner dashboard's
// suggested-plans list so both surfaces show the same fanned-out dates.
const SPREAD_MIN_LEAD_MS = 14 * 24 * 60 * 60 * 1000; // match server's 2-week floor

function deriveCadenceSlots(
  planDates: Date[]
): { dow: number; hour: number; minute: number }[] {
  const seen = new Map<string, { dow: number; hour: number; minute: number }>();
  for (const d of planDates) {
    const slot = { dow: d.getDay(), hour: d.getHours(), minute: d.getMinutes() };
    const key = `${slot.dow}-${slot.hour}-${slot.minute}`;
    if (!seen.has(key)) seen.set(key, slot);
  }
  if (seen.size === 0) {
    // No real plans yet — default to a single Saturday-afternoon slot so
    // ideas still spread one-per-week rather than collapsing onto one day.
    return [{ dow: 6, hour: 14, minute: 0 }];
  }
  // Order slots by weekday then time so the round-robin advances in a
  // natural Mon→Sun reading order within each week.
  return [...seen.values()].sort(
    (a, b) => a.dow - b.dow || a.hour - b.hour || a.minute - b.minute
  );
}

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function computeSpreadIdeaDates(
  planISODates: (string | null | undefined)[],
  ideas: { id: string; date: string | null; isManual?: boolean; datePinned?: boolean }[],
  nowMs: number
): Map<string, Date> {
  const result = new Map<string, Date>();
  if (ideas.length === 0) return result;

  const planDates = planISODates
    .map((s) => (s ? new Date(s) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

  const slots = deriveCadenceSlots(planDates);
  // Days already taken by real plans — a suggestion should never share a day
  // with a confirmed event.
  const takenDays = new Set(planDates.map(dayKeyOf));

  // Preserve intentional dates: owner-authored suggestions (manual one-offs,
  // recurring series instances) AND any idea whose date the owner explicitly
  // pinned via the editor keep the chosen date — spreading only exists to fan
  // out AI-generated ideas that all share one fallback date. Their day is
  // reserved so a fanned AI idea won't land on top of them.
  const toFan: { id: string; date: string | null }[] = [];
  for (const idea of ideas) {
    if ((idea.isManual || idea.datePinned) && idea.date) {
      const d = new Date(idea.date);
      if (!Number.isNaN(d.getTime())) {
        result.set(idea.id, d);
        takenDays.add(dayKeyOf(d));
        continue;
      }
    }
    toFan.push(idea);
  }
  if (toFan.length === 0) return result;

  const earliest = new Date(nowMs + SPREAD_MIN_LEAD_MS);
  // Walk forward week by week, emitting each cadence slot's concrete date,
  // collecting the first N unclaimed candidates (N = idea count).
  const candidates: Date[] = [];
  const startOfWeek = new Date(earliest);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // back to Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  // Horizon cap. Fanning out over a full year silently re-dates ideas months
  // past the season their copy was written for: the server writes a plan for
  // *today's* season, but an unbounded round-robin will happily hand the 13th
  // idea a slot 14 weeks out — which is how a September-authored outdoor
  // playground plan surfaced as a December afternoon in NYC.
  const MAX_WEEKS = 6;
  // Backlogged calendars carry far more ideas than a 6-week window has days
  // (some hold hundreds). Rather than strand the overflow — which would drop
  // it back to the server's single fallback date, restacking the very pile
  // this module exists to break up, and sorting that pile *above* the fanned
  // ideas — we re-walk the horizon in successive passes, doubling ideas up on
  // a day only once every day in the window is spoken for. Days owned by real
  // plans or by pinned ideas stay reserved in every pass: a suggestion must
  // never shadow a confirmed event.
  const fannedDays = new Set<string>();
  for (let pass = 0; candidates.length < toFan.length; pass++) {
    const filledBefore = candidates.length;
    for (let week = 0; week < MAX_WEEKS && candidates.length < toFan.length; week++) {
      for (const slot of slots) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + week * 7 + slot.dow);
        d.setHours(slot.hour, slot.minute, 0, 0);
        if (d.getTime() < earliest.getTime()) continue;
        const dayKey = dayKeyOf(d);
        if (takenDays.has(dayKey)) continue;
        // First pass keeps the one-suggestion-per-day rule; later passes
        // revisit the same days to absorb the backlog in place.
        if (pass === 0 && fannedDays.has(dayKey)) continue;
        fannedDays.add(dayKey);
        candidates.push(d);
        if (candidates.length >= toFan.length) break;
      }
    }
    // Every day in the horizon is reserved by a real plan — no progress is
    // possible, so leave the remainder on the server's date rather than spin.
    if (candidates.length === filledBefore) break;
  }

  // Stable idea order: original date (nulls last), then id — so the same
  // idea keeps the same slot across re-renders.
  const ordered = [...toFan].sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  ordered.forEach((idea, i) => {
    if (i < candidates.length) result.set(idea.id, candidates[i]);
  });
  return result;
}
