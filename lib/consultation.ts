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

export type ConsultationPrefill = {
  firstName: string;
  email: string;
  phone: string;
};

type ConsultationPrefillStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const CONSULTATION_PREFILL_STORAGE_KEY = "valisen.consultation.prefill";
const CONSULTATION_PREFILL_VERSION = 1;
const CONSULTATION_PREFILL_MAX_AGE_MS = 15 * 60 * 1000;

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
  details: ConsultationPrefill,
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
  if (
    !firstName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !isValidConsultationPhone(phone)
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
    if (
      parsed.version !== CONSULTATION_PREFILL_VERSION ||
      typeof parsed.createdAt !== "number" ||
      parsed.createdAt > now + 10_000 ||
      now - parsed.createdAt > CONSULTATION_PREFILL_MAX_AGE_MS
    ) {
      return null;
    }
    const firstName = cleanSingleLine(parsed.firstName, 80);
    const email = cleanSingleLine(parsed.email, 254).toLowerCase();
    const phone = cleanSingleLine(parsed.phone, 30);
    if (
      !firstName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !isValidConsultationPhone(phone)
    ) {
      return null;
    }
    return { firstName, email, phone };
  } catch {
    return null;
  }
}
