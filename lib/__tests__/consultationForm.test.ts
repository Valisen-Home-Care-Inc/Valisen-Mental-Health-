import { describe, expect, it } from "vitest";
import {
  CONSULTATION_AVAILABILITY_WINDOWS,
  CONSULTATION_DAYS,
  CONSULTATION_DAYS_LABEL,
  consumeConsultationPrefill,
  isValidConsultationPhone,
  stageConsultationPrefill,
} from "@/lib/consultation";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

const SUBMISSION_TOKEN =
  "v1.VQ-123456789ABC.abcdefghijklmnopqrstuvwxyz0123456789_-";

describe("consultation form contract", () => {
  it("offers morning availability from 9AM and evening availability through 8PM", () => {
    expect(CONSULTATION_AVAILABILITY_WINDOWS.morning.submissionLabel).toBe(
      "9AM – 12PM (Morning)",
    );
    expect(
      CONSULTATION_AVAILABILITY_WINDOWS.late_afternoon.submissionLabel,
    ).toBe("4PM – 8PM (Evening)");
  });

  it("accepts consultation availability from Monday through Sunday", () => {
    expect(CONSULTATION_DAYS_LABEL).toBe("Monday to Sunday");
    expect(CONSULTATION_DAYS).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("requires a plausible phone number", () => {
    expect(isValidConsultationPhone("416-555-0100")).toBe(true);
    expect(isValidConsultationPhone("+1 (647) 555-0123")).toBe(true);
    expect(isValidConsultationPhone("")).toBe(false);
    expect(isValidConsultationPhone("call me")).toBe(false);
  });

  it("moves quiz contact details through one short-lived, one-time handoff", () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 7, 3, 12);
    expect(
      stageConsultationPrefill(
        storage,
        {
          firstName: " Alex ",
          email: "ALEX@EXAMPLE.COM ",
          phone: "+1 (416) 555-0100",
          submissionToken: SUBMISSION_TOKEN,
        },
        now,
      ),
    ).toBe(true);
    expect(consumeConsultationPrefill(storage, now + 1_000)).toEqual({
      firstName: "Alex",
      email: "alex@example.com",
      phone: "+1 (416) 555-0100",
      submissionToken: SUBMISSION_TOKEN,
    });
    expect(consumeConsultationPrefill(storage, now + 2_000)).toBeNull();
  });

  it("discards expired handoff data", () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 7, 3, 12);
    stageConsultationPrefill(
      storage,
      {
        firstName: "Alex",
        email: "alex@example.com",
        phone: "416-555-0100",
        submissionToken: SUBMISSION_TOKEN,
      },
      now,
    );
    expect(consumeConsultationPrefill(storage, now + 16 * 60 * 1000)).toBeNull();
  });

  it("rejects a missing, malformed, or whitespace-altered quiz capability", () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 7, 3, 12);
    const contact = {
      firstName: "Alex",
      email: "alex@example.com",
      phone: "416-555-0100",
    };

    expect(
      stageConsultationPrefill(
        storage,
        { ...contact, submissionToken: "short" },
        now,
      ),
    ).toBe(false);
    expect(
      stageConsultationPrefill(
        storage,
        { ...contact, submissionToken: `${SUBMISSION_TOKEN} ` },
        now,
      ),
    ).toBe(false);
    expect(consumeConsultationPrefill(storage, now)).toBeNull();
  });

  it("consumes legacy v1 contact-only handoffs without fabricating attribution", () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 7, 3, 12);
    storage.setItem(
      "valisen.consultation.prefill",
      JSON.stringify({
        version: 1,
        createdAt: now,
        firstName: "Legacy",
        email: "legacy@example.com",
        phone: "613-555-0100",
      }),
    );

    expect(consumeConsultationPrefill(storage, now + 1_000)).toEqual({
      firstName: "Legacy",
      email: "legacy@example.com",
      phone: "613-555-0100",
    });
  });

  it("rejects a v2 handoff whose stored capability was tampered with", () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 7, 3, 12);
    storage.setItem(
      "valisen.consultation.prefill",
      JSON.stringify({
        version: 2,
        createdAt: now,
        firstName: "Alex",
        email: "alex@example.com",
        phone: "416-555-0100",
        submissionToken: "private token with spaces",
      }),
    );

    expect(consumeConsultationPrefill(storage, now + 1_000)).toBeNull();
    expect(consumeConsultationPrefill(storage, now + 2_000)).toBeNull();
  });
});
