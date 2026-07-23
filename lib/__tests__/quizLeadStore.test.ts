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
    },
    resultCategory: "Worry and tension stood out",
    scoreBand: "Carrying a real load right now",
    match: { status: "no-clear-match", reason: "no-supporting-signal" },
    notificationStatus: "not_requested",
    notificationAttempts: 0,
    updatedAt: "2026-07-22T18:00:00.000Z",
    accessNotificationStatus: "pending",
    accessNotificationAttempts: 0,
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
    });
    const parsed = rowToQuizLead(quizLeadToRow(source), 2);
    expect(parsed).toEqual({ ...source, rowNumber: 2 });
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
    });
    expect(parsed.accessNotificationClaimId).toBeUndefined();
    expect(parsed.accessNotificationClaimedAt).toBeUndefined();
    expect(parsed.accessNotificationSentAt).toBeUndefined();
    expect(parsed.accessNotificationLastError).toBeUndefined();
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
    expect(migration).toEqual({
      kind: "write",
      firstColumn: "AD",
      headers: [
        "Results Access Notification Status",
        "Results Access Notification Claim ID",
        "Results Access Notification Claimed At (ISO)",
        "Results Access Notification Sent At (ISO)",
        "Results Access Notification Attempts",
        "Results Access Notification Last Error",
      ],
    });

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
