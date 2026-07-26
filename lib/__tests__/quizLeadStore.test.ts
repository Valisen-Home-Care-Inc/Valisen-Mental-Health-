import { beforeEach, describe, expect, it } from "vitest";
import type { NewQuizLead } from "@/lib/server/quizLeadStore";
import {
  createSubmissionToken,
  hashSubmissionToken,
  planQuizLeadHeaderUpdate,
  quizLeadToRow,
  resetQuizLeadStoreStateForTests,
  rowToQuizLead,
  rowsToQuizLeads,
  withQuizLeadLock,
} from "@/lib/server/quizLeadStore";

function lead(overrides: Partial<NewQuizLead> = {}): NewQuizLead {
  return {
    referenceId: "VQ-ABCDEF123456",
    submissionTokenHash: "a".repeat(64),
    clientSubmissionId: "client-12345678",
    createdAt: "2026-07-22T18:00:00.000Z",
    firstName: "Alex",
    email: "alex@example.com",
    phone: "613-555-0100",
    privacyAcknowledgedAt: "2026-07-22T18:00:00.000Z",
    privacyText: "Privacy acknowledgement",
    privacyTextVersion: "2026-07-22.v1",
    quizVersion: "4.0.0",
    scoringVersion: "1.0.0",
    answers: { worry_1: 2, concerns: ["anxiety"] },
    outcome: {
      scores: [
        { dimension: "worry", average: 2, answered: 1 },
        { dimension: "mood", average: null, answered: 0 },
        { dimension: "stress", average: null, answered: 0 },
        { dimension: "relationships", average: null, answered: 0 },
      ],
      resultKey: "worry",
      ordered: ["worry"],
      score: 46,
      answeredCount: 1,
    },
    resultCategory: "Worry and tension stood out",
    scoreBand: "Carrying a real load right now",
    match: { status: "no-clear-match", reason: "no-supporting-signal" },
    notificationStatus: "not_requested",
    notificationAttempts: 0,
    updatedAt: "2026-07-22T18:00:00.000Z",
    accessNotificationStatus: "pending",
    accessNotificationAttempts: 0,
    intent: "exploring",
    attribution: {},
    resultsViewedCount: 0,
    therapistMatchViewedCount: 0,
    janeBookingClickCount: 0,
    contactHelpOpenedCount: 0,
    preferredContactTimes: [],
    userResultsEmailStatus: "pending",
    userResultsEmailAttempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.QUIZ_LEAD_TOKEN_SECRET = "test-only-quiz-lead-token-secret";
  resetQuizLeadStoreStateForTests();
});

describe("quiz lead sheet serialization", () => {
  it("round-trips a lead without losing answers, outcome, match, or consent state", () => {
    const source = lead({
      contactConsentAt: "2026-07-22T18:05:00.000Z",
      contactConsentText: "Contact consent",
      contactConsentTextVersion: "2026-07-22.v1",
      notificationStatus: "sent",
      notificationSentAt: "2026-07-22T18:05:01.000Z",
      notificationAttempts: 1,
      accessNotificationStatus: "sent",
      accessNotificationClaimId: "access-claim-1",
      accessNotificationClaimedAt: "2026-07-22T18:00:01.000Z",
      accessNotificationSentAt: "2026-07-22T18:00:02.000Z",
      accessNotificationAttempts: 1,
      intent: "brief_consultation",
      attribution: { source: "google", campaign: "therapy" },
      resultsViewedAt: "2026-07-22T18:01:00.000Z",
      resultsViewedCount: 2,
      therapistMatchViewedAt: "2026-07-22T18:01:01.000Z",
      therapistMatchViewedCount: 1,
      janeBookingClickedAt: "2026-07-22T18:02:00.000Z",
      janeBookingClickCount: 1,
      janeCtaPlacement: "results_primary",
      contactHelpOpenedAt: "2026-07-22T18:03:00.000Z",
      contactHelpOpenedCount: 1,
      contactMethod: "text",
      contactPhone: "613-555-0199",
      preferredContactTime: "evening",
      preferredContactTimes: [
        "2026-08-03T10:30",
        "2026-08-04T14:00",
      ],
      preferredContactTimeZone: "America/Toronto",
      contactMessage: "Please text first.",
      userResultsEmailStatus: "sent",
      userResultsEmailClaimId: "user-email-claim-1",
      userResultsEmailClaimedAt: "2026-07-22T18:00:01.000Z",
      userResultsEmailSentAt: "2026-07-22T18:00:03.000Z",
      userResultsEmailAttempts: 1,
    });
    const parsed = rowToQuizLead(quizLeadToRow(source), 2);
    expect(parsed).toEqual({ ...source, rowNumber: 2 });
  });

  it("round-trips a new lead with no phone number", () => {
    const source = lead({ phone: "" });
    expect(rowToQuizLead(quizLeadToRow(source), 2)).toEqual({
      ...source,
      rowNumber: 2,
    });
  });

  it("reads rows from the legacy 29-column schema with pending access delivery", () => {
    const legacyRow = quizLeadToRow(lead()).slice(0, 29);
    const parsed = rowToQuizLead(legacyRow, 7);

    expect(parsed).toMatchObject({
      rowNumber: 7,
      referenceId: "VQ-ABCDEF123456",
      notificationStatus: "not_requested",
      notificationAttempts: 0,
      accessNotificationStatus: "pending",
      accessNotificationAttempts: 0,
      intent: "exploring",
      attribution: {},
      userResultsEmailStatus: "not_applicable",
      userResultsEmailAttempts: 0,
      resultsViewedCount: 0,
      janeBookingClickCount: 0,
      preferredContactTimes: [],
    });
    expect(parsed.accessNotificationClaimId).toBeUndefined();
    expect(parsed.accessNotificationClaimedAt).toBeUndefined();
    expect(parsed.accessNotificationSentAt).toBeUndefined();
    expect(parsed.accessNotificationLastError).toBeUndefined();
  });

  it("reads the former 35-column schema with safe conversion defaults", () => {
    const formerRow = quizLeadToRow(lead()).slice(0, 35);
    const parsed = rowToQuizLead(formerRow, 8);
    expect(parsed).toMatchObject({
      intent: "exploring",
      attribution: {},
      resultsViewedCount: 0,
      therapistMatchViewedCount: 0,
      janeBookingClickCount: 0,
      contactHelpOpenedCount: 0,
      preferredContactTimes: [],
      userResultsEmailStatus: "not_applicable",
      userResultsEmailAttempts: 0,
    });
  });

  it("derives answeredCount for outcomes stored before quiz v5", () => {
    const row = quizLeadToRow(lead());
    const legacyOutcome = { ...lead().outcome } as Partial<
      NewQuizLead["outcome"]
    >;
    delete legacyOutcome.answeredCount;
    row[13] = JSON.stringify(legacyOutcome);

    expect(rowToQuizLead(row, 9).outcome.answeredCount).toBe(1);
  });

  it("fails closed for corrupted JSON or notification status", () => {
    const row = quizLeadToRow(lead());
    row[12] = "{bad";
    expect(() => rowToQuizLead(row, 2)).toThrow(/invalid answers JSON/);

    const badStatus = quizLeadToRow(lead());
    badStatus[22] = "emailed maybe";
    expect(() => rowToQuizLead(badStatus, 2)).toThrow(/invalid notification status/);

    const badAccessStatus = quizLeadToRow(lead());
    badAccessStatus[29] = "emailed maybe";
    expect(() => rowToQuizLead(badAccessStatus, 2)).toThrow(
      /invalid access notification status/,
    );

    const badAccessAttempts = quizLeadToRow(lead());
    badAccessAttempts[33] = -1;
    expect(() => rowToQuizLead(badAccessAttempts, 2)).toThrow(
      /invalid access notification attempts/,
    );

    const badIntent = quizLeadToRow(lead());
    badIntent[35] = "diagnose_me";
    expect(() => rowToQuizLead(badIntent, 2)).toThrow(/invalid quiz intent/);

    const badUserEmailStatus = quizLeadToRow(lead());
    badUserEmailStatus[50] = "probably sent";
    expect(() => rowToQuizLead(badUserEmailStatus, 2)).toThrow(
      /invalid user results email status/,
    );

    const badPreferredTimes = quizLeadToRow(lead());
    badPreferredTimes[56] = JSON.stringify([
      "2026-08-03T10:30",
      "2026-08-03T10:30",
    ]);
    badPreferredTimes[57] = "America/Toronto";
    expect(() => rowToQuizLead(badPreferredTimes, 2)).toThrow(
      /invalid preferred contact times JSON/,
    );

    const timesWithoutZone = quizLeadToRow(lead());
    timesWithoutZone[56] = JSON.stringify([
      "2026-08-03T10:30",
      "2026-08-04T14:00",
    ]);
    expect(() => rowToQuizLead(timesWithoutZone, 2)).toThrow(
      /invalid preferred contact time zone/,
    );
  });

  it("skips blank/malformed unrelated rows while retaining valid leads", () => {
    const warning = console.warn;
    const messages: string[] = [];
    console.warn = (message?: unknown) => messages.push(String(message));
    try {
      const parsed = rowsToQuizLeads(
        [[], ["manual note"], quizLeadToRow(lead()), Array(35).fill("")],
        2,
      );
      expect(parsed).toHaveLength(1);
      expect(parsed[0].referenceId).toBe("VQ-ABCDEF123456");
      expect(messages).toEqual(["quiz-lead-store: skipping malformed row 3"]);
    } finally {
      console.warn = warning;
    }
  });
});

describe("quiz lead sheet header migration", () => {
  it("extends the legacy schema in place without rewriting its 29 columns", () => {
    const initial = planQuizLeadHeaderUpdate([]);
    expect(initial.kind).toBe("write");
    if (initial.kind !== "write") throw new Error("expected initial header write");

    const legacyHeaders = initial.headers.slice(0, 29);
    const migration = planQuizLeadHeaderUpdate(legacyHeaders);
    expect(migration).toMatchObject({
      kind: "write",
      firstColumn: "AD",
    });
    if (migration.kind !== "write") throw new Error("expected migration");
    expect(migration.headers.slice(0, 6)).toEqual([
        "Results Access Notification Status",
        "Results Access Notification Claim ID",
        "Results Access Notification Claimed At (ISO)",
        "Results Access Notification Sent At (ISO)",
        "Results Access Notification Attempts",
        "Results Access Notification Last Error",
    ]);
    expect(migration.headers).toContain("Quiz Intent");
    expect(migration.headers).toContain("Campaign Attribution JSON");
    expect(migration.headers).toContain("User Results Email Last Error");
    expect(migration.headers.slice(-2)).toEqual([
      "Preferred Contact Times JSON",
      "Preferred Contact Time Zone",
    ]);
    expect(initial.headers).toHaveLength(58);

    expect(planQuizLeadHeaderUpdate(initial.headers)).toEqual({ kind: "current" });
  });

  it("recovers an exact partially migrated prefix but rejects renamed columns", () => {
    const initial = planQuizLeadHeaderUpdate([]);
    if (initial.kind !== "write") throw new Error("expected initial header write");

    const partiallyMigrated = initial.headers.slice(0, 32);
    expect(planQuizLeadHeaderUpdate(partiallyMigrated)).toMatchObject({
      kind: "write",
      firstColumn: "AG",
    });

    const incompatible = [...initial.headers.slice(0, 29)];
    incompatible[4] = "Given Name";
    expect(planQuizLeadHeaderUpdate(incompatible)).toEqual({ kind: "incompatible" });
  });
});

describe("opaque submission tokens", () => {
  it("are deterministic for idempotent retries but differ between leads", () => {
    const first = createSubmissionToken("VQ-ABCDEF123456", "client-12345678");
    expect(createSubmissionToken("VQ-ABCDEF123456", "client-12345678")).toBe(first);
    expect(createSubmissionToken("VQ-ABCDEF999999", "client-12345678")).not.toBe(first);
    expect(first).not.toContain("alex@example.com");
    expect(hashSubmissionToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("per-process keyed lock", () => {
  it("serializes two tasks for the same submission", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withQuizLeadLock("same", async () => {
      events.push("first:start");
      await gate;
      events.push("first:end");
    });
    const second = withQuizLeadLock("same", async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
