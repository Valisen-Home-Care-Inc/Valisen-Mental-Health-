const TORONTO_TIME_ZONE = "America/Toronto";
const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type TorontoParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsAt(date: Date): TorontoParts {
  const entries = new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    entries
      .filter((entry) => entry.type !== "literal")
      .map((entry) => [entry.type, Number(entry.value)]),
  );
  return values as TorontoParts;
}

function offsetAt(date: Date): number {
  const parts = partsAt(date);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - date.getTime();
}

export function formatTorontoDateTimeInput(date = new Date()): string {
  const parts = partsAt(date);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${two(parts.month)}-${two(parts.day)}T${two(parts.hour)}:${two(parts.minute)}`;
}

/** Convert a datetime-local wall clock value explicitly in Toronto to UTC. */
export function parseTorontoDateTimeInput(value: string): string | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(wallClockAsUtc);
  const firstCandidate = new Date(wallClockAsUtc - offsetAt(firstGuess));
  const candidate = new Date(wallClockAsUtc - offsetAt(firstCandidate));
  const resolved = partsAt(candidate);

  // Reject impossible spring-forward wall times instead of silently moving a
  // scheduled placement by an hour.
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    return null;
  }
  return candidate.toISOString();
}
