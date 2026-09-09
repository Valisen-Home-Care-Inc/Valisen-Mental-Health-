export const CONSULTATION_AVAILABILITY_WINDOWS = {
  morning: {
    time: "9AM – 12PM",
    label: "Morning",
    submissionLabel: "9AM – 12PM (Morning)",
  },
  afternoon: {
    time: "12PM – 4PM",
    label: "Afternoon",
    submissionLabel: "12PM – 4PM (Afternoon)",
  },
  late_afternoon: {
    time: "4PM – 8PM",
    label: "Evening",
    submissionLabel: "4PM – 8PM (Evening)",
  },
  flexible: {
    time: "Anytime",
    label: "Flexible",
    submissionLabel: "Anytime (Flexible)",
  },
} as const;

export const CONSULTATION_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const CONSULTATION_DAYS_LABEL = "Monday to Sunday";

export type ConsultationAvailability =
  keyof typeof CONSULTATION_AVAILABILITY_WINDOWS;

/**
 * Fixed time-of-day options shown in the "/welcome" slot picker's time grid,
 * on 20-minute increments to match the actual length of the free
 * consultation call advertised elsewhere on the site. There is no
 * scheduling system behind this yet, so these are the same hardcoded
 * options every selectable day rather than real per-day or per-therapist
 * availability. Each maps back onto an existing {@link ConsultationAvailability}
 * bucket so nothing downstream (validation, the CRM record, the Sheet
 * export, the notification email) needs to change to support a specific
 * time being requested.
 */
export const CONSULTATION_TIME_SLOTS: ReadonlyArray<{
  time: string;
  availability: ConsultationAvailability;
}> = [
  { time: "9:00 AM", availability: "morning" },
  { time: "9:20 AM", availability: "morning" },
  { time: "9:40 AM", availability: "morning" },
  { time: "10:00 AM", availability: "morning" },
  { time: "10:20 AM", availability: "morning" },
  { time: "10:40 AM", availability: "morning" },
  { time: "11:00 AM", availability: "morning" },
  { time: "11:20 AM", availability: "morning" },
  { time: "11:40 AM", availability: "morning" },
  { time: "12:00 PM", availability: "afternoon" },
  { time: "12:20 PM", availability: "afternoon" },
  { time: "12:40 PM", availability: "afternoon" },
  { time: "1:00 PM", availability: "afternoon" },
  { time: "1:20 PM", availability: "afternoon" },
  { time: "1:40 PM", availability: "afternoon" },
  { time: "2:00 PM", availability: "afternoon" },
  { time: "2:20 PM", availability: "afternoon" },
  { time: "2:40 PM", availability: "afternoon" },
  { time: "3:00 PM", availability: "afternoon" },
  { time: "3:20 PM", availability: "afternoon" },
  { time: "3:40 PM", availability: "afternoon" },
  { time: "4:00 PM", availability: "late_afternoon" },
  { time: "4:20 PM", availability: "late_afternoon" },
  { time: "4:40 PM", availability: "late_afternoon" },
  { time: "5:00 PM", availability: "late_afternoon" },
  { time: "5:20 PM", availability: "late_afternoon" },
  { time: "5:40 PM", availability: "late_afternoon" },
  { time: "6:00 PM", availability: "late_afternoon" },
  { time: "6:20 PM", availability: "late_afternoon" },
  { time: "6:40 PM", availability: "late_afternoon" },
  { time: "7:00 PM", availability: "late_afternoon" },
  { time: "7:20 PM", availability: "late_afternoon" },
  { time: "7:40 PM", availability: "late_afternoon" },
];

const WEEKDAY_SHORT_SUN_FIRST = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export { WEEKDAY_SHORT_SUN_FIRST, MONTH_LONG as CONSULTATION_MONTH_NAMES };

export function consultationDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** How far out the fake calendar offers days at all — a plausibility bound, not real availability data. */
export const CONSULTATION_BOOKING_WINDOW_DAYS = 30;

export type ConsultationCalendarCell = {
  /** ISO date, e.g. "2026-09-09". */
  date: string;
  dayOfMonth: number;
  /** Whether this cell belongs to the month being displayed (vs. a leading/trailing filler day). */
  inDisplayedMonth: boolean;
  /** Weekday, not in the past, and within the booking window — the only signal this calendar shows. */
  selectable: boolean;
};

/**
 * A standard Sunday-first month grid for `year`/`month` (0-11), always in
 * full rows of 7 so the layout never reflows. Weekends are shown but always
 * closed (the clinic doesn't offer weekend consultations) rather than
 * omitted from the grid. Deliberately exposes only one signal per day —
 * selectable or not — rather than simulating booked/pending/partially-booked
 * states, since there's no real scheduling system behind this to make those
 * states true.
 */
export function getConsultationCalendarMonth(
  year: number,
  month: number,
  now: Date = new Date(),
): ConsultationCalendarCell[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS);

  const firstOfMonth = new Date(year, month, 1);
  const firstColumnSunFirst = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstColumnSunFirst + daysInMonth) / 7) * 7;

  const cells: ConsultationCalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstColumnSunFirst + 1;
    const inDisplayedMonth = dayNum >= 1 && dayNum <= daysInMonth;
    if (!inDisplayedMonth) {
      cells.push({ date: "", dayOfMonth: 0, inDisplayedMonth: false, selectable: false });
      continue;
    }
    const cellDate = new Date(year, month, dayNum);
    const dow = cellDate.getDay();
    const isWeekday = dow !== 0 && dow !== 6;
    const isStrictlyFuture = cellDate.getTime() > today.getTime();
    const withinWindow = cellDate.getTime() <= windowEnd.getTime();
    cells.push({
      date: consultationDateKey(cellDate),
      dayOfMonth: cellDate.getDate(),
      inDisplayedMonth: true,
      selectable: isWeekday && isStrictlyFuture && withinWindow,
    });
  }
  return cells;
}

/**
 * A fixed weekly availability pattern, indexed by `Date#getDay()`
 * (0=Sunday..6=Saturday). Each entry is a list of `[startIndex, endIndex]`
 * indices into {@link CONSULTATION_TIME_SLOTS}. There is no real scheduling
 * system behind this — it's the same shape every week, not per-therapist or
 * per-date data — but it reads as a realistic recurring schedule (busier
 * some days, a single slot on others, closed weekends) rather than either
 * "wide open every day" or randomized noise.
 */
function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/** Every `step`-th index from `start` to `end` inclusive — a full span, thinned out. */
function stepRange(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += step) out.push(i);
  return out;
}

const WEEKLY_AVAILABILITY_INDICES: ReadonlyArray<ReadonlyArray<number>> = [
  [], // Sunday — closed
  range(18, 32), // Monday — 3:00 PM to 7:40 PM
  stepRange(0, 32, 2), // Tuesday — full 9:00 AM to 7:40 PM span, every other slot
  [...range(0, 11), ...range(24, 29)], // Wednesday — 9:00 AM-12:40 PM, and 5:00-6:40 PM
  range(21, 29), // Thursday — 4:00 PM to 6:40 PM
  [19], // Friday — a single slot, 3:20 PM
  [], // Saturday — closed
];

/**
 * The available times for a given date, per the fixed weekly pattern above.
 * Deterministic by day of week (every Tuesday looks the same), not a claim
 * about real bookings — nothing labels a time as "taken" or references
 * other clients.
 */
export function getAvailableTimeSlotsForDate(
  isoDate: string,
): typeof CONSULTATION_TIME_SLOTS {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const keep = new Set(WEEKLY_AVAILABILITY_INDICES[date.getDay()]);
  return CONSULTATION_TIME_SLOTS.filter((_, index) => keep.has(index));
}

/** Human-readable label for an ISO date, e.g. "Tuesday, September 9". */
export function formatConsultationDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAY_LONG[date.getDay()]}, ${MONTH_LONG[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Human-readable label for a chosen day + time, e.g.
 * "Tuesday, September 9 at 11:00 AM". Used both for the on-screen
 * confirmation and as the text sent to the server to fold into the
 * coordination notes.
 */
export function formatPreferredSlotLabel(isoDate: string, time: string): string {
  return `${formatConsultationDateLabel(isoDate)} at ${time}`;
}

/** What the "/welcome" slot picker produces: either a specific day+time, or an explicit "no preference" choice. */
export type ConsultationSlotSelection =
  | {
      kind: "specific";
      date: string;
      time: string;
      availability: ConsultationAvailability;
      label: string;
    }
  | { kind: "flexible" };

export function availabilityFromSlotSelection(
  selection: ConsultationSlotSelection,
): ConsultationAvailability {
  return selection.kind === "flexible" ? "flexible" : selection.availability;
}

export function slotLabelFromSelection(
  selection: ConsultationSlotSelection,
): string | undefined {
  return selection.kind === "specific" ? selection.label : undefined;
}

export function isConsultationAvailability(
  value: unknown,
): value is ConsultationAvailability {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CONSULTATION_AVAILABILITY_WINDOWS, value)
  );
}

export function isValidConsultationPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    digits.length >= 7 &&
    digits.length <= 15 &&
    value.length <= 30 &&
    /^[0-9+().\-\s]+$/.test(value)
  );
}

/**
 * A server-issued consultation reference is the reliable signal that the
 * request reached Valisen's durable consultation workflow. Bot-honeypot
 * responses intentionally omit one while still returning a generic success.
 */
export function isConfirmedConsultationReference(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^VC-[A-Za-z0-9_-]{6,36}$/.test(value)
  );
}

/**
 * A successful HTTP-shaped response is not enough to show a person the
 * confirmation UI. The honeypot intentionally receives `{ ok: true }` without
 * a durable reference, and a malformed upstream response must remain
 * retryable rather than looking like a saved consultation.
 */
export function confirmedConsultationReferenceFromResponse(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { ok?: unknown; referenceId?: unknown };
  return response.ok === true &&
    isConfirmedConsultationReference(response.referenceId)
    ? response.referenceId
    : null;
}

export function shouldTrackConsultationSubmission(
  value: unknown,
  trackedReference: string | null,
): value is string {
  return (
    isConfirmedConsultationReference(value) && value !== trackedReference
  );
}

export type ConsultationPrefill = {
  firstName: string;
  email: string;
  phone: string;
  /**
   * Opaque quiz-result capability used only for the server-verified
   * quiz-to-consultation link. Legacy v1 handoffs do not contain one.
   */
  submissionToken?: string;
};

export type QuizConsultationPrefill = ConsultationPrefill & {
  submissionToken: string;
};

type ConsultationPrefillStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const CONSULTATION_PREFILL_STORAGE_KEY = "valisen.consultation.prefill";
const CONSULTATION_PREFILL_VERSION = 2;
const LEGACY_CONSULTATION_PREFILL_VERSION = 1;
const CONSULTATION_PREFILL_MAX_AGE_MS = 15 * 60 * 1000;
const QUIZ_SUBMISSION_TOKEN_PATTERN = /^[A-Za-z0-9._-]{32,256}$/;

function cleanSingleLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Stage contact details only for the immediate same-tab quiz-to-consultation
 * navigation. The payload is short-lived, same-origin, and never placed in a
 * URL or analytics event.
 */
export function stageConsultationPrefill(
  storage: ConsultationPrefillStorage,
  details: QuizConsultationPrefill,
  now = Date.now(),
): boolean {
  try {
    storage.removeItem(CONSULTATION_PREFILL_STORAGE_KEY);
  } catch {
    return false;
  }
  const firstName = cleanSingleLine(details.firstName, 80);
  const email = cleanSingleLine(details.email, 254).toLowerCase();
  const phone = cleanSingleLine(details.phone, 30);
  const submissionToken = details.submissionToken;
  if (
    !firstName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !isValidConsultationPhone(phone) ||
    !QUIZ_SUBMISSION_TOKEN_PATTERN.test(submissionToken)
  ) {
    return false;
  }

  try {
    storage.setItem(
      CONSULTATION_PREFILL_STORAGE_KEY,
      JSON.stringify({
        version: CONSULTATION_PREFILL_VERSION,
        createdAt: now,
        firstName,
        email,
        phone,
        submissionToken,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Consume and erase the quiz handoff so contact details do not linger. */
export function consumeConsultationPrefill(
  storage: ConsultationPrefillStorage,
  now = Date.now(),
): ConsultationPrefill | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(CONSULTATION_PREFILL_STORAGE_KEY);
    storage.removeItem(CONSULTATION_PREFILL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const isLegacy = parsed.version === LEGACY_CONSULTATION_PREFILL_VERSION;
    if (
      (!isLegacy && parsed.version !== CONSULTATION_PREFILL_VERSION) ||
      typeof parsed.createdAt !== "number" ||
      parsed.createdAt > now + 10_000 ||
      now - parsed.createdAt > CONSULTATION_PREFILL_MAX_AGE_MS
    ) {
      return null;
    }
    const firstName = cleanSingleLine(parsed.firstName, 80);
    const email = cleanSingleLine(parsed.email, 254).toLowerCase();
    const phone = cleanSingleLine(parsed.phone, 30);
    let submissionToken: string | undefined;
    if (!isLegacy) {
      if (
        typeof parsed.submissionToken !== "string" ||
        !QUIZ_SUBMISSION_TOKEN_PATTERN.test(parsed.submissionToken)
      ) {
        return null;
      }
      submissionToken = parsed.submissionToken;
    }
    if (
      !firstName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !isValidConsultationPhone(phone)
    ) {
      return null;
    }
    return {
      firstName,
      email,
      phone,
      ...(submissionToken ? { submissionToken } : {}),
    };
  } catch {
    return null;
  }
}
