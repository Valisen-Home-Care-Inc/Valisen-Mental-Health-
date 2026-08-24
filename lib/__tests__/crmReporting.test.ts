import { describe, expect, it } from "vitest";
import {
  clampCrmReportingRange,
  sanitizeCrmArchiveLabel,
} from "@/lib/crmReporting";

describe("CRM reporting periods", () => {
  const range = {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-24T00:00:00.000Z",
    preset: "30d" as const,
  };

  it("clamps dashboard data to the current reporting period", () => {
    expect(
      clampCrmReportingRange(range, "2026-08-23T15:30:00.000Z"),
    ).toEqual({
      ...range,
      from: "2026-08-23T15:30:00.000Z",
    });
  });

  it("does not widen a shorter selected range", () => {
    expect(
      clampCrmReportingRange(range, "2026-07-01T00:00:00.000Z"),
    ).toEqual(range);
  });

  it("keeps a valid one-millisecond range immediately after reset", () => {
    expect(
      clampCrmReportingRange(range, "2026-08-25T00:00:00.000Z").from,
    ).toBe("2026-08-23T23:59:59.999Z");
  });

  it("accepts useful archive names and rejects controls or oversized names", () => {
    expect(sanitizeCrmArchiveLabel("  August campaign  ")).toBe(
      "August campaign",
    );
    expect(sanitizeCrmArchiveLabel("bad\nname")).toBeNull();
    expect(sanitizeCrmArchiveLabel("x".repeat(101))).toBeNull();
  });
});
