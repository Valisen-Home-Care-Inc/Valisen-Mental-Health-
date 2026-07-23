import { beforeEach, describe, expect, it } from "vitest";
import {
  getCompletedSubmission,
  isRateLimited,
  markSubmissionCompleted,
  resetRateLimitState,
} from "@/lib/server/rateLimit";

beforeEach(() => {
  resetRateLimitState();
});

describe("isRateLimited", () => {
  it("allows requests up to the limit and blocks beyond it", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited("ip:1.2.3.4", 5, 60_000, now + i)).toBe(false);
    }
    expect(isRateLimited("ip:1.2.3.4", 5, 60_000, now + 10)).toBe(true);
  });

  it("resets after the window elapses", () => {
    const now = 1_000_000;
    for (let i = 0; i < 6; i++) isRateLimited("ip:1.2.3.4", 5, 60_000, now);
    expect(isRateLimited("ip:1.2.3.4", 5, 60_000, now + 60_001)).toBe(false);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < 6; i++) isRateLimited("ip:1.1.1.1", 5, 60_000, now);
    expect(isRateLimited("ip:2.2.2.2", 5, 60_000, now)).toBe(false);
  });
});

describe("idempotency records", () => {
  it("returns the stored reference id for a completed submission", () => {
    markSubmissionCompleted("client-abc", "VQ-11111111");
    expect(getCompletedSubmission("client-abc")).toBe("VQ-11111111");
  });

  it("returns null for unknown ids", () => {
    expect(getCompletedSubmission("never-seen")).toBeNull();
  });

  it("expires records after the TTL", () => {
    const now = 1_000_000;
    markSubmissionCompleted("client-abc", "VQ-11111111", now);
    expect(getCompletedSubmission("client-abc", now + 6 * 60 * 60 * 1000 + 1)).toBeNull();
  });
});
