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
// a suggestion never shadows a confirmed event.
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

export function computeSpreadIdeaDates(
  planISODates: (string | null | undefined)[],
  ideas: { id: string; date: string | null }[],
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
  const takenDays = new Set(
    planDates.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  );

  const earliest = new Date(nowMs + SPREAD_MIN_LEAD_MS);
  // Walk forward week by week, emitting each cadence slot's concrete date,
  // collecting the first N unclaimed candidates (N = idea count).
  const candidates: Date[] = [];
  const startOfWeek = new Date(earliest);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // back to Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  const MAX_WEEKS = 52;
  for (let week = 0; week < MAX_WEEKS && candidates.length < ideas.length; week++) {
    for (const slot of slots) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + week * 7 + slot.dow);
      d.setHours(slot.hour, slot.minute, 0, 0);
      if (d.getTime() < earliest.getTime()) continue;
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (takenDays.has(dayKey)) continue;
      takenDays.add(dayKey); // one suggestion per day
      candidates.push(d);
      if (candidates.length >= ideas.length) break;
    }
  }

  // Stable idea order: original date (nulls last), then id — so the same
  // idea keeps the same slot across re-renders.
  const ordered = [...ideas].sort((a, b) => {
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
