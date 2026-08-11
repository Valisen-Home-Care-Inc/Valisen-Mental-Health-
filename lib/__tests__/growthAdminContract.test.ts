import { describe, expect, it } from "vitest";
import {
  isUuid,
  parseConsultationLeadUpdate,
} from "@/lib/checkpoints/growthAdminContract";

describe("growth admin contracts", () => {
  it("accepts an exact, versioned consultation update", () => {
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "in_progress",
        conversionStage: "consultation_booked",
        expectedVersion: 3,
        note: "  Confirmed by phone.\r\nStarts next week.  ",
      }),
    ).toEqual({
      value: {
        workflowStatus: "in_progress",
        conversionStage: "consultation_booked",
        expectedVersion: 3,
        note: "Confirmed by phone.\nStarts next week.",
      },
    });
  });

  it("rejects unknown fields and invalid optimistic versions", () => {
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "new",
        conversionStage: "consultation_requested",
        expectedVersion: 1,
        email: "should-not-be-editable@example.com",
      }).error,
    ).toMatch(/fields/i);
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "new",
        conversionStage: "consultation_requested",
        expectedVersion: 0,
      }).error,
    ).toMatch(/version/i);
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "new",
        conversionStage: "consultation_requested",
        expectedVersion: 2_147_483_648,
      }).error,
    ).toMatch(/version/i);
  });

  it("enforces the paid-therapy workflow invariant before the RPC", () => {
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "in_progress",
        conversionStage: "paid_therapy",
        expectedVersion: 4,
      }).error,
    ).toMatch(/converted workflow/i);
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "closed_won",
        conversionStage: "paid_therapy",
        expectedVersion: 4,
      }).value,
    ).toMatchObject({
      workflowStatus: "closed_won",
      conversionStage: "paid_therapy",
    });
  });

  it("accepts the explicit legacy outcome-review status", () => {
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "closed_unknown",
        conversionStage: "consultation_requested",
        expectedVersion: 1,
        note: "Legacy outcome needs review.",
      }).value?.workflowStatus,
    ).toBe("closed_unknown");
  });

  it("keeps update notes within the close-reason storage limit", () => {
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "closed_lost",
        conversionStage: "consultation_requested",
        expectedVersion: 2,
        note: "a".repeat(500),
      }).value?.note,
    ).toHaveLength(500);
    expect(
      parseConsultationLeadUpdate({
        workflowStatus: "closed_lost",
        conversionStage: "consultation_requested",
        expectedVersion: 2,
        note: "a".repeat(501),
      }).error,
    ).toMatch(/500 characters/i);
  });

  it("accepts canonical UUIDs only for record routes", () => {
    expect(isUuid("389260cb-5ac8-4f33-8dc2-c234b70d072d")).toBe(true);
    expect(isUuid("../../consultations" )).toBe(false);
    expect(isUuid("389260cb5ac84f338dc2c234b70d072d")).toBe(false);
  });
});
