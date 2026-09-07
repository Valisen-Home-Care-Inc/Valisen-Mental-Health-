import { isConfirmedConsultationReference } from "@/lib/consultation";

export const WELCOME_THANK_YOU_PATH = "/welcome/thank-you";

const STORAGE_KEY = "valisen:welcome-thank-you:v1";
const MAX_AGE_MS = 15 * 60 * 1_000;

/**
 * Hands the confirmed reference (and, if one was picked, the requested
 * time's display label) to the landing page's thank-you screen for the same
 * tab only. It deliberately stays out of the URL so the reference is never
 * carried into a referrer header or an analytics page path.
 */
export function stageWelcomeThankYou(
  reference: string,
  slotLabel?: string,
): void {
  if (typeof window === "undefined") return;
  if (!isConfirmedConsultationReference(reference)) return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        reference,
        slotLabel: typeof slotLabel === "string" ? slotLabel.slice(0, 80) : undefined,
        storedAt: Date.now(),
      }),
    );
  } catch {
    // Storage-disabled browsers still get the confirmation, just without the
    // reference line.
  }
}

export type WelcomeThankYouHandoff = {
  reference: string;
  slotLabel?: string;
};

export function consumeWelcomeThankYou(
  now = Date.now(),
): WelcomeThankYouHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      reference?: unknown;
      slotLabel?: unknown;
      storedAt?: unknown;
    };
    if (
      !isConfirmedConsultationReference(parsed.reference) ||
      typeof parsed.storedAt !== "number" ||
      parsed.storedAt > now + 10_000 ||
      parsed.storedAt < now - MAX_AGE_MS
    ) {
      return null;
    }
    return {
      reference: parsed.reference,
      slotLabel:
        typeof parsed.slotLabel === "string" && parsed.slotLabel.trim()
          ? parsed.slotLabel.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}
