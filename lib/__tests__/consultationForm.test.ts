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
        },
        now,
      ),
    ).toBe(true);
    expect(consumeConsultationPrefill(storage, now + 1_000)).toEqual({
      firstName: "Alex",
      email: "alex@example.com",
      phone: "+1 (416) 555-0100",
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
      },
      now,
    );
    expect(consumeConsultationPrefill(storage, now + 16 * 60 * 1000)).toBeNull();
  });
});
