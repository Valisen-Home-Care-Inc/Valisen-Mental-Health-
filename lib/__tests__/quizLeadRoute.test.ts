import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { QUESTIONS, QUIZ_VERSION, type Answers } from "@/lib/quiz";
import {
  CONTACT_CONSENT_TEXT,
  QUIZ_CONTACT_HELP_TURNSTILE_ACTION,
  QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
} from "@/lib/quizLead";
import type {
  NewQuizLead,
  QuizLeadPatch,
  QuizLeadStore,
  StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import {
  resetQuizLeadStoreStateForTests,
} from "@/lib/server/quizLeadStore";
import { resetRateLimitState } from "@/lib/server/rateLimit";

const mocks = vi.hoisted(() => {
  const records: StoredQuizLead[] = [];
  const resultRegistry = new Map<
    string,
    {
      referenceId: string;
      payloadHash: string;
      storageStatus: "pending" | "ready" | "failed";
      sheetRowNumber?: number;
      claimToken?: string;
      attemptCount: number;
    }
  >();
  const emailRegistry = new Map<
    string,
    {
      status: "pending" | "sent" | "failed";
      claimToken?: string;
      attemptCount: number;
      sentAt?: string;
    }
  >();
  let nextRow = 2;
  let nextReference = 1;
  let nextClaim = 1;
  let appendFailuresRemaining = 0;
  const store: QuizLeadStore = {
    async findByClientSubmissionId(clientSubmissionId) {
      return (
        records.find(
          (record) => record.clientSubmissionId === clientSubmissionId,
        ) ?? null
      );
    },
    async findBySubmissionTokenHash(tokenHash) {
      return (
        records.find(
          (record) => record.submissionTokenHash === tokenHash,
        ) ?? null
      );
    },
    async appendLead(lead: NewQuizLead) {
      if (appendFailuresRemaining > 0) {
        appendFailuresRemaining -= 1;
        throw new Error("simulated CRM record save failure");
      }
      const stored = { ...lead, rowNumber: nextRow++ };
      records.push(stored);
      return stored;
    },
    async updateLead(rowNumber: number, patch: QuizLeadPatch) {
      const record = records.find((item) => item.rowNumber === rowNumber);
      if (!record) throw new Error("missing row");
      Object.assign(record, patch);
    },
  };
  return {
    records,
    resetRecords() {
      records.splice(0, records.length);
      resultRegistry.clear();
      emailRegistry.clear();
      nextRow = 2;
      nextReference = 1;
      nextClaim = 1;
      appendFailuresRemaining = 0;
    },
    resultRegistry,
    emailRegistry,
    forgetResultRegistry(clientSubmissionId: string) {
      const existing = resultRegistry.get(clientSubmissionId);
      if (existing) {
        emailRegistry.delete(`${existing.referenceId}:internal_results`);
        emailRegistry.delete(`${existing.referenceId}:visitor_results`);
      }
      resultRegistry.delete(clientSubmissionId);
    },
    forgetEmailDelivery(referenceId: string, kind: string) {
      emailRegistry.delete(`${referenceId}:${kind}`);
    },
    failNextAppend() {
      appendFailuresRemaining += 1;
    },
    store,
    sendMail: vi.fn(),
    buildPdf: vi.fn(),
    verifyTurnstile: vi.fn(),
    recordQuizLeadLink: vi.fn(),
    claimQuizResultSubmission: vi.fn(),
    completeQuizResultSubmissionStorage: vi.fn(),
    recordQuizResultSubmissionFailure: vi.fn(),
    completeQuizResultFailureAlert: vi.fn(),
    claimQuizResultEmailDelivery: vi.fn(),
    completeQuizResultEmailDelivery: vi.fn(),
    installGrowthRegistryDefaults() {
      this.claimQuizResultSubmission.mockImplementation(
        async (input: {
          clientSubmissionId: string;
          payloadHash: string;
          existingReferenceId?: string;
        }) => {
          let entry = resultRegistry.get(input.clientSubmissionId);
          if (entry) {
            if (
              entry.payloadHash !== input.payloadHash ||
              (input.existingReferenceId &&
                input.existingReferenceId !== entry.referenceId)
            ) {
              throw new Error("registry collision");
            }
            if (entry.storageStatus === "ready") {
              return {
                accepted: true,
                claimed: false,
                reason: "already_ready",
                clientSubmissionId: input.clientSubmissionId,
                referenceId: entry.referenceId,
                storageStatus: entry.storageStatus,
                sheetRowNumber: entry.sheetRowNumber,
                attemptCount: entry.attemptCount,
                retryAfterSeconds: 0,
              };
            }
          } else {
            const generated = `VQ-${String(nextReference++).padStart(12, "0")}`;
            entry = {
              referenceId: input.existingReferenceId ?? generated,
              payloadHash: input.payloadHash,
              storageStatus: "pending",
              attemptCount: 0,
            };
            resultRegistry.set(input.clientSubmissionId, entry);
          }
          entry.storageStatus = "pending";
          entry.sheetRowNumber = undefined;
          entry.attemptCount += 1;
          entry.claimToken = `10000000-0000-4000-8000-${String(
            nextClaim++,
          ).padStart(12, "0")}`;
          return {
            accepted: true,
            claimed: true,
            reason: "claimed",
            clientSubmissionId: input.clientSubmissionId,
            referenceId: entry.referenceId,
            storageStatus: entry.storageStatus,
            claimToken: entry.claimToken,
            attemptCount: entry.attemptCount,
            retryAfterSeconds: 0,
          };
        },
      );
      this.completeQuizResultSubmissionStorage.mockImplementation(
        async (input: {
          clientSubmissionId: string;
          claimToken: string;
          status: "ready" | "failed";
          sheetRowNumber?: number;
        }) => {
          const entry = resultRegistry.get(input.clientSubmissionId);
          if (!entry || entry.claimToken !== input.claimToken) {
            return {
              accepted: false,
              staleClaim: true,
              clientSubmissionId: input.clientSubmissionId,
              referenceId: entry?.referenceId ?? "VQ-MISSING0000",
              storageStatus: entry?.storageStatus ?? "failed",
              attemptCount: entry?.attemptCount ?? 0,
            };
          }
          entry.storageStatus = input.status;
          entry.sheetRowNumber = input.sheetRowNumber;
          entry.claimToken = undefined;
          return {
            accepted: true,
            staleClaim: false,
            clientSubmissionId: input.clientSubmissionId,
            referenceId: entry.referenceId,
            storageStatus: entry.storageStatus,
            sheetRowNumber: entry.sheetRowNumber,
            attemptCount: entry.attemptCount,
          };
        },
      );
      this.recordQuizResultSubmissionFailure.mockImplementation(
        async (input: {
          clientSubmissionId: string;
          claimToken: string;
        }) => {
          const entry = resultRegistry.get(input.clientSubmissionId);
          if (!entry || entry.claimToken !== input.claimToken) {
            return {
              accepted: false,
              staleClaim: true,
              clientSubmissionId: input.clientSubmissionId,
              referenceId: entry?.referenceId ?? "VQ-MISSING0000",
              storageStatus: entry?.storageStatus ?? "failed",
              attemptCount: entry?.attemptCount ?? 0,
              alertRequired: false,
              alertAttemptCount: 0,
            };
          }
          entry.storageStatus = "failed";
          entry.sheetRowNumber = undefined;
          entry.claimToken = undefined;
          return {
            accepted: true,
            staleClaim: false,
            clientSubmissionId: input.clientSubmissionId,
            referenceId: entry.referenceId,
            storageStatus: entry.storageStatus,
            attemptCount: entry.attemptCount,
            alertRequired: true,
            alertAttemptCount: 1,
          };
        },
      );
      this.completeQuizResultFailureAlert.mockResolvedValue(undefined);
      this.claimQuizResultEmailDelivery.mockImplementation(
        async (input: {
          referenceId: string;
          deliveryKind: string;
          knownSent: boolean;
        }) => {
          const key = `${input.referenceId}:${input.deliveryKind}`;
          let entry = emailRegistry.get(key);
          if (!entry) {
            entry = {
              status: input.knownSent ? "sent" : "pending",
              attemptCount: 0,
              sentAt: input.knownSent ? new Date().toISOString() : undefined,
            };
            emailRegistry.set(key, entry);
          } else if (input.knownSent) {
            entry.status = "sent";
            entry.claimToken = undefined;
            entry.sentAt ??= new Date().toISOString();
          }
          if (entry.status === "sent") {
            return {
              accepted: true,
              claimed: false,
              reason: "already_sent",
              alreadySent: true,
              referenceId: input.referenceId,
              deliveryKind: input.deliveryKind,
              deliveryStatus: entry.status,
              attemptCount: entry.attemptCount,
              retryAfterSeconds: 0,
            };
          }
          entry.attemptCount += 1;
          entry.status = "pending";
          entry.claimToken = `20000000-0000-4000-8000-${String(
            nextClaim++,
          ).padStart(12, "0")}`;
          return {
            accepted: true,
            claimed: true,
            reason: "claimed",
            alreadySent: false,
            referenceId: input.referenceId,
            deliveryKind: input.deliveryKind,
            deliveryStatus: entry.status,
            claimToken: entry.claimToken,
            attemptCount: entry.attemptCount,
            retryAfterSeconds: 0,
          };
        },
      );
      this.completeQuizResultEmailDelivery.mockImplementation(
        async (input: {
          referenceId: string;
          deliveryKind: string;
          claimToken: string;
          status: "sent" | "failed";
        }) => {
          const key = `${input.referenceId}:${input.deliveryKind}`;
          const entry = emailRegistry.get(key);
          if (!entry || entry.claimToken !== input.claimToken) {
            return {
              accepted: false,
              staleClaim: true,
              referenceId: input.referenceId,
              deliveryKind: input.deliveryKind,
              deliveryStatus: entry?.status ?? "failed",
              attemptCount: entry?.attemptCount ?? 0,
            };
          }
          entry.status = input.status;
          entry.claimToken = undefined;
          entry.sentAt = input.status === "sent" ? new Date().toISOString() : undefined;
          return {
            accepted: true,
            staleClaim: false,
            referenceId: input.referenceId,
            deliveryKind: input.deliveryKind,
            deliveryStatus: entry.status,
            attemptCount: entry.attemptCount,
            sentAt: entry.sentAt,
          };
        },
      );
    },
    upsertConsultationLead: vi.fn(),
    claimConsultationNotification: vi.fn(),
    completeConsultationNotificationClaim: vi.fn(),
  };
});

vi.mock("@/lib/server/quizLeadStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/quizLeadStore")>();
  return {
    ...actual,
    getQuizLeadStore: vi.fn(async () => mocks.store),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mocks.sendMail })),
  },
}));

vi.mock("@/lib/server/quizSummaryPdf", () => ({
  buildQuizSummaryPdf: mocks.buildPdf,
}));

vi.mock("@/lib/server/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));

vi.mock("@/lib/server/growthRepository", () => ({
  recordQuizLeadLink: mocks.recordQuizLeadLink,
  claimQuizResultSubmission: mocks.claimQuizResultSubmission,
  completeQuizResultSubmissionStorage:
    mocks.completeQuizResultSubmissionStorage,
  recordQuizResultSubmissionFailure: mocks.recordQuizResultSubmissionFailure,
  completeQuizResultFailureAlert: mocks.completeQuizResultFailureAlert,
  claimQuizResultEmailDelivery: mocks.claimQuizResultEmailDelivery,
  completeQuizResultEmailDelivery: mocks.completeQuizResultEmailDelivery,
  upsertConsultationLead: mocks.upsertConsultationLead,
  claimConsultationNotification: mocks.claimConsultationNotification,
  completeConsultationNotificationClaim:
    mocks.completeConsultationNotificationClaim,
}));

process.env.QUIZ_LEAD_TOKEN_SECRET =
  "test-only-quiz-lead-token-secret";
process.env.GMAIL_USER = "sender@example.com";
process.env.GMAIL_APP_PASSWORD = "test-password";
process.env.QUIZ_LEAD_ADMIN_URL =
  "https://admin.example.com/quiz/{referenceId}";
process.env.NEXT_PUBLIC_SITE_URL = "https://valisenmentalhealth.com";

import { POST as saveLead } from "@/app/api/quiz-lead/route";
import { POST as restorePrivateResult } from "@/app/api/quiz-lead/result/route";
import { POST as submitContactConsent } from "@/app/api/quiz-lead/contact-consent/route";
import { POST as recordEngagement } from "@/app/api/quiz-lead/engagement/route";
import { POST as downloadQuizPdf } from "@/app/api/quiz-lead/pdf/route";

function completedAnswers(intent = "ready_to_speak"): Answers {
  const answers: Answers = {};
  for (const question of QUESTIONS) {
    if (question.kind === "safety" || question.id === "language") continue;
    if (question.kind === "scored") {
      answers[question.id] = 2;
    } else if (question.kind === "multi") {
      answers[question.id] =
        question.id === "concerns" ? ["anxiety"] : [];
    } else if (question.id === "gender_preference") {
      answers[question.id] = "no-preference";
    } else if (question.id === "intent") {
      answers[question.id] = intent;
    } else {
      answers[question.id] = question.options[0].value;
    }
  }
  return answers;
}

function futurePreferredTimes(count = 2, daysAhead = 7): string[] {
  const start = Date.now() + daysAhead * 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
  );
}

let idCounter = 0;
function accessPayload(overrides: Record<string, unknown> = {}) {
  idCounter += 1;
  return {
    clientSubmissionId: `client-${idCounter
      .toString()
      .padStart(8, "0")}`,
    quizVersion: QUIZ_VERSION,
    firstName: "Alex",
    email: "alex@example.com",
    phone: "613-555-0100",
    privacyAcknowledged: true,
    privacyLanguage: RESULTS_ACCESS_PRIVACY_TEXT,
    privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
    answers: completedAnswers(),
    attribution: {
      source: "google",
      medium: "cpc",
      campaign: "ottawa-therapy",
    },
    turnstileToken: "test-turnstile-token",
    ...overrides,
  };
}

let ipCounter = 0;
function postRequest(path: string, body: unknown, ip?: string) {
  ipCounter += 1;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      "x-forwarded-for": ip ?? `10.20.0.${ipCounter}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function postAccess(body: unknown, ip?: string) {
  return saveLead(postRequest("/api/quiz-lead", body, ip));
}

async function postConsent(body: unknown, ip?: string) {
  return submitContactConsent(
    postRequest("/api/quiz-lead/contact-consent", body, ip),
  );
}

async function postEngagement(body: unknown, ip?: string) {
  return recordEngagement(
    postRequest("/api/quiz-lead/engagement", body, ip),
  );
}

async function postPdf(body: unknown, ip?: string, query = "") {
  return downloadQuizPdf(
    postRequest(`/api/quiz-lead/pdf${query}`, body, ip),
  );
}

async function postRestore(body: unknown, ip?: string, query = "") {
  return restorePrivateResult(
    postRequest(`/api/quiz-lead/result${query}`, body, ip),
  );
}

async function saveValidLead(overrides: Record<string, unknown> = {}) {
  const payload = accessPayload(overrides);
  const response = await postAccess(payload);
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.ok).toBe(true);
  return { payload, body };
}

function sentMessages() {
  return mocks.sendMail.mock.calls.map(([message]) => message);
}

function internalResultsMessages() {
  return sentMessages().filter((message) =>
    String(message.subject).includes("New Quiz Results Submission"),
  );
}

function userResultsMessages() {
  return sentMessages().filter(
    (message) =>
      String(message.subject) === "Your Valisen quiz result and next step",
  );
}

function contactMessages() {
  return sentMessages().filter((message) =>
    String(message.subject).includes("Booking Help Requested"),
  );
}

function validContact(submissionToken: string) {
  return {
    submissionToken,
    contactMethod: "text",
    phone: "613-555-0199",
    preferredTimes: futurePreferredTimes(),
    timeZone: "UTC",
    message: "Please text before calling.",
    consentGranted: true,
    consentLanguage: CONTACT_CONSENT_TEXT,
    turnstileToken: "test-turnstile-token",
  };
}

beforeEach(() => {
  mocks.resetRecords();
  mocks.claimQuizResultSubmission.mockReset();
  mocks.completeQuizResultSubmissionStorage.mockReset();
  mocks.recordQuizResultSubmissionFailure.mockReset();
  mocks.completeQuizResultFailureAlert.mockReset();
  mocks.claimQuizResultEmailDelivery.mockReset();
  mocks.completeQuizResultEmailDelivery.mockReset();
  mocks.installGrowthRegistryDefaults();
  mocks.sendMail
    .mockReset()
    .mockResolvedValue({ accepted: ["accepted@example.com"] });
  mocks.buildPdf
    .mockReset()
    .mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
  mocks.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  mocks.recordQuizLeadLink.mockReset().mockResolvedValue(undefined);
  mocks.upsertConsultationLead
    .mockReset()
    .mockResolvedValue({ leadId: "00000000-0000-4000-8000-000000000001" });
  mocks.claimConsultationNotification.mockReset().mockResolvedValue({
    accepted: true,
    claimed: true,
    reason: "claimed",
    alreadySent: false,
    claimToken: "22222222-2222-4222-8222-222222222222",
    leadId: "00000000-0000-4000-8000-000000000001",
    requestReference: "VQ-TEST123456",
    requestNotificationStatus: "sending",
    attemptCount: 1,
    rowVersion: 1,
  });
  mocks.completeConsultationNotificationClaim.mockReset().mockResolvedValue({
    accepted: true,
    staleClaim: false,
    leadId: "00000000-0000-4000-8000-000000000001",
    requestReference: "VQ-TEST123456",
    requestNotificationStatus: "sent",
    rowVersion: 2,
  });
  resetRateLimitState();
  resetQuizLeadStoreStateForTests();
});

describe("POST /api/quiz-lead", () => {
  it("persists authoritative score/match, intent and safe attribution, then sends two independent emails", async () => {
    const payload = accessPayload({
      funnelSessionId: "fs-1234567890abcdef",
      quizAttemptId: "qa-1234567890abcdef",
      answers: {
        ...completedAnswers("brief_consultation"),
        safety: "often",
      },
    });
    const response = await postAccess(payload);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      intent: "brief_consultation",
      resultsEmailSent: true,
      userResultsEmailSent: true,
    });
    expect(body.referenceId).toMatch(/^VQ-[0-9A-F]{12}$/);
    expect(body.submissionToken).toMatch(/^v1\.VQ-/);
    expect(body.outcome.score).toBeGreaterThanOrEqual(0);

    const stored = mocks.records[0];
    expect(stored.intent).toBe("brief_consultation");
    expect(stored.attribution).toEqual(payload.attribution);
    expect(stored.phone).toBe("613-555-0100");
    expect(stored.privacyText).toBe(RESULTS_ACCESS_PRIVACY_TEXT);
    expect(stored.privacyTextVersion).toBe(RESULTS_ACCESS_PRIVACY_TEXT_VERSION);
    expect(stored.accessNotificationStatus).toBe("sent");
    expect(stored.userResultsEmailStatus).toBe("sent");
    expect(stored.notificationStatus).toBe("not_requested");
    expect("safety" in stored.answers).toBe(false);
    expect(stored.outcome).toEqual(body.outcome);
    expect(stored.match).toEqual(body.match);

    expect(internalResultsMessages()).toHaveLength(1);
    expect(userResultsMessages()).toHaveLength(1);
    expect(internalResultsMessages()[0].to).toBe(
      "info@valisenmentalhealth.com",
    );
    expect(internalResultsMessages()[0].text).toContain(
      "I’d like a brief consultation first",
    );
    expect(internalResultsMessages()[0].text).toContain(
      "campaign: ottawa-therapy",
    );
    expect(internalResultsMessages()[0].text).toMatch(
      /outbound click is not a confirmed/i,
    );
    expect(userResultsMessages()[0].to).toBe("alex@example.com");
    expect(userResultsMessages()[0].text).toContain(
      "valisenmentalhealth.com/consultation?therapist=meryem-ibrahim",
    );
    expect(userResultsMessages()[0].text).toContain("#result=");
    expect(userResultsMessages()[0].text).toContain(
      "does not subscribe you to promotional email",
    );
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "test-turnstile-token",
      QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION,
      payload.clientSubmissionId,
    );
    expect(mocks.buildPdf).toHaveBeenCalledTimes(1);
    expect(mocks.recordQuizLeadLink).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: body.referenceId,
        funnelSessionId: "fs-1234567890abcdef",
        quizAttemptId: "qa-1234567890abcdef",
      }),
    );
  });

  it("keeps one stable VQ reference when CRM record finalization fails and is reconciled on retry", async () => {
    const payload = accessPayload();
    mocks.failNextAppend();

    const first = await postAccess(payload);
    expect(first.status).toBe(503);
    await expect(first.json()).resolves.toMatchObject({
      ok: false,
      storageStatus: "failed",
      failureRecorded: true,
      retriable: true,
    });
    expect(mocks.records).toHaveLength(0);
    const registered = mocks.resultRegistry.get(
      String(payload.clientSubmissionId),
    );
    expect(registered).toMatchObject({ storageStatus: "failed" });
    const stableReference = registered?.referenceId;
    expect(stableReference).toMatch(/^VQ-[0-9A-F]{12}$/);

    const retry = await postAccess(payload);
    const body = await retry.json();
    expect(retry.status).toBe(201);
    expect(body).toMatchObject({ ok: true, referenceId: stableReference });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].referenceId).toBe(stableReference);
    expect(mocks.claimQuizResultSubmission).toHaveBeenCalledTimes(2);
  });

  it("returns a retriable 202 without finalizing the CRM record or email when another storage lease is active", async () => {
    const payload = accessPayload();
    mocks.claimQuizResultSubmission.mockResolvedValueOnce({
      accepted: true,
      claimed: false,
      reason: "lease_active",
      clientSubmissionId: payload.clientSubmissionId,
      referenceId: "VQ-ABCDEF123456",
      storageStatus: "pending",
      attemptCount: 1,
      retryAfterSeconds: 45,
    });

    const response = await postAccess(payload);
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      ok: false,
      pending: true,
      retriable: true,
      referenceId: "VQ-ABCDEF123456",
      retryAfterSeconds: 45,
    });
    expect(mocks.records).toHaveLength(0);
    expect(mocks.completeQuizResultSubmissionStorage).not.toHaveBeenCalled();
    expect(mocks.recordQuizLeadLink).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("attempts the operational path when the initial recovery claim is temporarily unavailable", async () => {
    mocks.claimQuizResultSubmission.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await postAccess(accessPayload());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      warnings: expect.arrayContaining([
        expect.stringMatching(/CRM recovery claim/i),
      ]),
    });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].firstName).toBe("Alex");
  });

  it("treats a durable email lease as pending and does not race the internal send", async () => {
    const payload = accessPayload();
    mocks.claimQuizResultEmailDelivery.mockResolvedValueOnce({
      accepted: true,
      claimed: false,
      reason: "lease_active",
      alreadySent: false,
      referenceId: "VQ-000000000001",
      deliveryKind: "internal_results",
      deliveryStatus: "pending",
      attemptCount: 1,
      retryAfterSeconds: 30,
    });

    const response = await postAccess(payload);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      resultsEmailSent: false,
      userResultsEmailSent: true,
    });
    expect(internalResultsMessages()).toHaveLength(0);
    expect(userResultsMessages()).toHaveLength(1);
  });

  it("does not reject a saved lead when its journey link is temporarily unavailable", async () => {
    const payload = accessPayload({
      funnelSessionId: "fs-fedcba0987654321",
      quizAttemptId: "qa-fedcba0987654321",
    });
    mocks.recordQuizLeadLink.mockRejectedValueOnce(new Error("database unavailable"));

    const first = await postAccess(payload);
    expect(first.status).toBe(201);
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      warnings: expect.arrayContaining([
        expect.stringMatching(/analytics link is still pending/i),
      ]),
    });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);

    const retry = await postAccess(payload);
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ ok: true, duplicate: true });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.recordQuizLeadLink).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not reject a saved lead when an email delivery claim is unavailable", async () => {
    mocks.claimQuizResultEmailDelivery.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await postAccess(accessPayload());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      resultsEmailSent: false,
      userResultsEmailSent: true,
      warnings: expect.arrayContaining([
        expect.stringMatching(/clinic notification is still pending/i),
      ]),
    });
    expect(mocks.records).toHaveLength(1);
  });

  it("is idempotent across retries and does not resend delivered emails", async () => {
    const payload = accessPayload();
    const first = await (await postAccess(payload)).json();
    const secondResponse = await postAccess(payload);
    const second = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(second).toMatchObject({
      duplicate: true,
      referenceId: first.referenceId,
      submissionToken: first.submissionToken,
      resultsEmailSent: true,
      userResultsEmailSent: true,
    });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(mocks.records[0].userResultsEmailAttempts).toBe(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not block a saved result when the internal email fails, and retries only that delivery", async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));
    const payload = accessPayload();
    const response = await postAccess(payload);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      resultsEmailSent: false,
      userResultsEmailSent: true,
    });
    expect(body.warnings).toHaveLength(1);
    expect(mocks.records[0].accessNotificationStatus).toBe("failed");
    expect(mocks.records[0].userResultsEmailStatus).toBe("sent");

    const retry = await postAccess(payload);
    const retryBody = await retry.json();
    expect(retry.status).toBe(200);
    expect(retryBody).toMatchObject({
      resultsEmailSent: true,
      userResultsEmailSent: true,
    });
    expect(mocks.records[0].accessNotificationAttempts).toBe(2);
    expect(mocks.records[0].userResultsEmailAttempts).toBe(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
  });

  it("warns instead of inferring therapist-contact authorization when retrying a legacy record", async () => {
    const { payload } = await saveValidLead();
    Object.assign(mocks.records[0], {
      privacyText: "I consent to receiving my quiz results.",
      privacyTextVersion: "2026-07-22.v1",
      accessNotificationStatus: "failed",
      accessNotificationClaimId: undefined,
      accessNotificationClaimedAt: undefined,
      accessNotificationLastError: "Legacy delivery pending.",
    });
    // Simulate a Sheet row created before the durable Supabase registry was
    // deployed. The first retry must adopt its existing VQ reference without
    // inferring that an email was already delivered.
    mocks.forgetResultRegistry(payload.clientSubmissionId);
    mocks.sendMail.mockClear();
    mocks.buildPdf.mockClear();

    const retry = await postAccess(payload);
    expect(retry.status).toBe(200);
    expect(internalResultsMessages()).toHaveLength(1);
    const internal = internalResultsMessages()[0];
    expect(`${internal.text}\n${internal.html}`).toMatch(
      /legacy version; review required/i,
    );
    expect(`${internal.text}\n${internal.html}`).toMatch(
      /do not infer authorization for therapist contact or disclosure/i,
    );
    expect(`${internal.text}\n${internal.html}`).not.toMatch(
      /contact and therapist sharing authorized/i,
    );
    expect(mocks.buildPdf.mock.calls[0][0].initialContactAuthorization)
      .toMatchObject({
        status: "legacy",
        textVersion: "2026-07-22.v1",
      });
  });

  it("tracks visitor email failure independently and keeps the private result available", async () => {
    mocks.sendMail
      .mockResolvedValueOnce({ accepted: ["internal@example.com"] })
      .mockRejectedValueOnce(new Error("visitor rejected"));
    const payload = accessPayload();
    const response = await postAccess(payload);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      resultsEmailSent: true,
      userResultsEmailSent: false,
    });
    expect(mocks.records[0].userResultsEmailStatus).toBe("failed");

    const retry = await postAccess(payload);
    expect(retry.status).toBe(200);
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(mocks.records[0].userResultsEmailAttempts).toBe(2);
    expect(mocks.records[0].userResultsEmailStatus).toBe("sent");
  });

  it("requires phone and rejects missing intent and unsafe attribution", async () => {
    expect(
      (await postAccess(accessPayload({ phone: undefined }))).status,
    ).toBe(400);
    expect((await postAccess(accessPayload({ phone: "" }))).status).toBe(400);
    expect((await postAccess(accessPayload({ phone: "12" }))).status).toBe(400);
    expect(
      (
        await postAccess(
          accessPayload({ privacyLanguage: undefined }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await postAccess(
          accessPayload({
            privacyLanguage: "Older consent copy",
            privacyTextVersion: "2026-07-22.v1",
          }),
        )
      ).status,
    ).toBe(400);

    const missingIntentAnswers = completedAnswers();
    delete missingIntentAnswers.intent;
    const missingIntent = await postAccess(
      accessPayload({ answers: missingIntentAnswers }),
    );
    expect(missingIntent.status).toBe(400);

    const unsafeAttribution = await postAccess(
      accessPayload({
        attribution: { source: "google", concern: "anxiety" },
      }),
    );
    expect(unsafeAttribution.status).toBe(400);
  });

  it("requires same-origin JSON and a valid results-access Turnstile action", async () => {
    const payload = accessPayload();
    const crossOrigin = new NextRequest("http://localhost/api/quiz-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify(payload),
    });
    expect((await saveLead(crossOrigin)).status).toBe(403);

    mocks.verifyTurnstile.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    expect((await postAccess(payload)).status).toBe(400);
    expect(mocks.records).toHaveLength(0);

    mocks.verifyTurnstile.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    expect((await postAccess(accessPayload())).status).toBe(503);
    expect(mocks.records).toHaveLength(0);
  });

  it("quietly swallows honeypots and rejects oversized payloads", async () => {
    const honeypot = await postAccess(
      accessPayload({ website: "bot" }),
    );
    expect(honeypot.status).toBe(200);
    const oversized = await postAccess(
      accessPayload({ extra: "x".repeat(60_000) }),
    );
    expect(oversized.status).toBe(413);
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });
});

describe("POST /api/quiz-lead/result", () => {
  it("restores consented contact details only through the private result view model", async () => {
    const { body: saved } = await saveValidLead({
      answers: completedAnswers("exploring"),
    });
    const response = await postRestore({
      submissionToken: saved.submissionToken,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      firstName: "Alex",
      email: "alex@example.com",
      phone: "613-555-0100",
      referenceId: saved.referenceId,
      intent: "exploring",
      contactHelpSent: false,
      attribution: {
        source: "google",
        campaign: "ottawa-therapy",
      },
    });
    expect(body.outcome).toBeTruthy();
    expect(body.match).toBeTruthy();
    expect(body).not.toHaveProperty("answers");
    expect(body).not.toHaveProperty("submissionToken");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("rejects URL capabilities, malformed bodies, unknown tokens, and extra fields", async () => {
    const { body: saved } = await saveValidLead();

    expect(
      (
        await postRestore(
          { submissionToken: saved.submissionToken },
          undefined,
          `?token=${encodeURIComponent(saved.submissionToken)}`,
        )
      ).status,
    ).toBe(400);
    expect((await postRestore("{")).status).toBe(400);
    expect((await postRestore({ submissionToken: "short" })).status).toBe(400);
    expect(
      (
        await postRestore({
          submissionToken: saved.submissionToken,
          email: "alex@example.com",
        })
      ).status,
    ).toBe(400);

    const unknown = `v1.VQ-UNKNOWN00000.${"a".repeat(43)}`;
    expect(
      (
        await postRestore({ submissionToken: unknown })
      ).status,
    ).toBe(404);
  });

  it("requires JSON, rate-limits token lookup, and leaves no GET query-token handler", async () => {
    const { body: saved } = await saveValidLead();
    const nonJson = new NextRequest(
      "http://localhost/api/quiz-lead/result",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "x-forwarded-for": "10.50.0.1",
        },
        body: JSON.stringify({ submissionToken: saved.submissionToken }),
      },
    );
    expect((await restorePrivateResult(nonJson)).status).toBe(415);

    const crossOrigin = new NextRequest(
      "http://localhost/api/quiz-lead/result",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({ submissionToken: saved.submissionToken }),
      },
    );
    expect((await restorePrivateResult(crossOrigin)).status).toBe(403);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(
        (
          await postRestore(
            { submissionToken: saved.submissionToken },
            "10.50.0.2",
          )
        ).status,
      ).toBe(200);
    }
    const limited = await postRestore(
      { submissionToken: saved.submissionToken },
      "10.50.0.2",
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toContain("no-store");

    const primaryRoute = await import("@/app/api/quiz-lead/route");
    expect("GET" in primaryRoute).toBe(false);
  });
});

describe("POST /api/quiz-lead/pdf", () => {
  it("returns a private attachment from a body-only capability without contact data", async () => {
    const { body: saved } = await saveValidLead();
    mocks.buildPdf.mockClear();

    const response = await postPdf({
      submissionToken: saved.submissionToken,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="valisen-quiz-results-${saved.referenceId}.pdf"`,
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(
      Buffer.from(await response.arrayBuffer()).toString("ascii"),
    ).toBe("%PDF-");

    expect(mocks.buildPdf).toHaveBeenCalledTimes(1);
    const pdfModel = mocks.buildPdf.mock.calls[0][0];
    expect(pdfModel.initialContactAuthorization).toMatchObject({
      status: "granted",
      textVersion: "2026-08-13.v5",
    });
    expect(pdfModel.contactHelpRequest).toEqual({
      status: "not_requested",
    });
    const serialized = JSON.stringify(pdfModel);
    for (const forbidden of [
      "alex@example.com",
      "613-555-0100",
      "Please text before calling.",
      '"answers"',
      '"contactMessage"',
      '"preferredTimes"',
      '"timeZone"',
      saved.submissionToken,
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects query capabilities, malformed bodies, unknown tokens, and extra fields", async () => {
    const { body: saved } = await saveValidLead();

    const queryToken = await postPdf(
      { submissionToken: saved.submissionToken },
      undefined,
      `?submissionToken=${encodeURIComponent(saved.submissionToken)}`,
    );
    expect(queryToken.status).toBe(400);
    expect(queryToken.headers.get("Cache-Control")).toContain("no-store");
    expect((await postPdf("{")).status).toBe(400);
    expect(
      (
        await postPdf({
          submissionToken: saved.submissionToken,
          email: "alex@example.com",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await postPdf({
          submissionToken: `v1.VQ-UNKNOWN00000.${"a".repeat(43)}`,
        })
      ).status,
    ).toBe(404);
  });

  it("marks a later help request as submitted but never confirmed, and rate-limits generation", async () => {
    const { body: saved } = await saveValidLead();
    expect(
      (await postConsent(validContact(saved.submissionToken))).status,
    ).toBe(200);
    mocks.buildPdf.mockClear();

    const afterHelp = await postPdf({
      submissionToken: saved.submissionToken,
    });
    expect(afterHelp.status).toBe(200);
    expect(mocks.buildPdf.mock.calls[0][0].contactHelpRequest).toMatchObject({
      status: "submitted",
    });
    expect(
      JSON.stringify(mocks.buildPdf.mock.calls[0][0]),
    ).not.toContain("Please text before calling.");

    resetRateLimitState();
    const rateIp = "10.99.0.1";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(
        (
          await postPdf(
            { submissionToken: saved.submissionToken },
            rateIp,
          )
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await postPdf(
          { submissionToken: saved.submissionToken },
          rateIp,
        )
      ).status,
    ).toBe(429);
  });
});

describe("POST /api/quiz-lead/engagement", () => {
  it("records privacy-safe view/open/click milestones and an allow-listed Jane placement", async () => {
    const { body: saved } = await saveValidLead();
    for (const event of [
      "results_viewed",
      "therapist_match_viewed",
      "contact_help_opened",
    ]) {
      const response = await postEngagement({
        submissionToken: saved.submissionToken,
        event,
      });
      expect(response.status).toBe(200);
    }
    const jane = await postEngagement({
      submissionToken: saved.submissionToken,
      event: "jane_booking_clicked",
      ctaPlacement: "mobile_sticky",
    });
    expect(jane.status).toBe(200);

    const stored = mocks.records[0];
    expect(stored.resultsViewedAt).toBeTruthy();
    expect(stored.resultsViewedCount).toBe(1);
    expect(stored.therapistMatchViewedAt).toBeTruthy();
    expect(stored.therapistMatchViewedCount).toBe(1);
    expect(stored.contactHelpOpenedAt).toBeTruthy();
    expect(stored.contactHelpOpenedCount).toBe(1);
    expect(stored.janeBookingClickedAt).toBeTruthy();
    expect(stored.janeBookingClickCount).toBe(1);
    expect(stored.janeCtaPlacement).toBe("mobile_sticky");
    expect(stored).not.toHaveProperty("bookingConfirmed");
  });

  it("rejects invented Jane placement and sensitive properties", async () => {
    const { body: saved } = await saveValidLead();
    expect(
      (
        await postEngagement({
          submissionToken: saved.submissionToken,
          event: "jane_booking_clicked",
          ctaPlacement: "hero_anxiety_score_42",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await postEngagement({
          submissionToken: saved.submissionToken,
          event: "results_viewed",
          score: 42,
        })
      ).status,
    ).toBe(400);
  });
});

describe("POST /api/quiz-lead/contact-consent", () => {
  it("stores the explicit help preferences only after consent and sends one internal notification", async () => {
    const { body: saved } = await saveValidLead({
      answers: completedAnswers("brief_consultation"),
    });
    await postEngagement({
      submissionToken: saved.submissionToken,
      event: "results_viewed",
    });
    await postEngagement({
      submissionToken: saved.submissionToken,
      event: "jane_booking_clicked",
      ctaPlacement: "results_primary",
    });

    const contact = validContact(saved.submissionToken);
    const response = await postConsent(contact);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      emailSent: true,
      referenceId: saved.referenceId,
    });

    const stored = mocks.records[0];
    expect(stored).toMatchObject({
      contactMethod: "text",
      contactPhone: "613-555-0199",
      preferredContactTimes: contact.preferredTimes,
      preferredContactTimeZone: "UTC",
      contactMessage: "Please text before calling.",
      contactConsentText: CONTACT_CONSENT_TEXT,
      notificationStatus: "sent",
      notificationAttempts: 1,
    });
    expect(stored.contactConsentAt).toBeTruthy();
    expect(contactMessages()).toHaveLength(1);
    const mail = contactMessages()[0];
    expect(mail.to).toBe("info@valisenmentalhealth.com");
    expect(mail.text).toContain("brief consultation first");
    expect(mail.text).toContain("campaign: ottawa-therapy");
    expect(mail.text).toContain("Jane booking CTA clicked: Yes");
    expect(mail.text).toMatch(/outbound click is not a confirmed/i);
    expect(mail.text).toContain(
      contact.preferredTimes[0],
    );
    expect(mail.text).toContain("Time zone: UTC");
    expect(mail.text).toMatch(/proposed consultation times — not confirmed/i);
    expect(mail.text).toContain(CONTACT_CONSENT_TEXT);
    expect(mail.attachments).toHaveLength(1);
    expect(mocks.verifyTurnstile).toHaveBeenLastCalledWith(
      expect.any(NextRequest),
      "test-turnstile-token",
      QUIZ_CONTACT_HELP_TURNSTILE_ACTION,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("requires explicit consent and rejects an invalid supplied phone override", async () => {
    const { body: saved } = await saveValidLead();
    const noConsent = await postConsent({
      ...validContact(saved.submissionToken),
      consentGranted: false,
    });
    expect(noConsent.status).toBe(400);
    const noPhone = await postConsent({
      ...validContact(saved.submissionToken),
      phone: "invalid",
    });
    expect(noPhone.status).toBe(400);
    expect(mocks.records[0].contactConsentAt).toBeUndefined();
    expect(mocks.records[0].contactMethod).toBeUndefined();
    expect(contactMessages()).toHaveLength(0);
  });

  it("does not duplicate the consent record or notification", async () => {
    const { body: saved } = await saveValidLead();
    const consent = validContact(saved.submissionToken);
    const first = await postConsent(consent);
    const timestamp = mocks.records[0].contactConsentAt;
    const second = await postConsent(consent);
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(secondBody).toMatchObject({
      ok: true,
      emailSent: true,
      duplicate: true,
    });
    expect(mocks.records[0].contactConsentAt).toBe(timestamp);
    expect(mocks.records[0].notificationAttempts).toBe(1);
    expect(contactMessages()).toHaveLength(1);
  });

  it("uses edited preferences after a failed delivery retry and gives the revision a new message id", async () => {
    const { body: saved } = await saveValidLead();
    mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));
    const original = validContact(saved.submissionToken);
    expect((await postConsent(original)).status).toBe(502);

    const editedTimes = futurePreferredTimes(2, 21);
    const retry = await postConsent({
      ...original,
      contactMethod: "email",
      phone: undefined,
      preferredTimes: editedTimes,
      timeZone: "America/Vancouver",
      message: "A changed retry message",
    });
    expect(retry.status).toBe(200);
    expect(mocks.records[0]).toMatchObject({
      contactMethod: "email",
      contactPhone: undefined,
      preferredContactTimes: editedTimes,
      preferredContactTimeZone: "America/Vancouver",
      contactMessage: "A changed retry message",
      notificationAttempts: 2,
    });
    const messages = contactMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1].text).toContain(editedTimes[0]);
    expect(messages[1].text).toContain("America/Vancouver");
    expect(messages[1].text).toContain("A changed retry message");
    expect(messages[1].messageId).not.toBe(messages[0].messageId);
  });

  it("preserves the original revision when recovering a stale in-flight delivery claim", async () => {
    const { body: saved } = await saveValidLead();
    mocks.sendMail.mockRejectedValueOnce(new Error("ambiguous smtp failure"));
    const original = validContact(saved.submissionToken);
    expect((await postConsent(original)).status).toBe(502);
    Object.assign(mocks.records[0], {
      notificationStatus: "sending",
      notificationClaimId: "stale-claim",
      notificationClaimedAt: new Date(
        Date.now() - 6 * 60 * 1000,
      ).toISOString(),
    });

    const retry = await postConsent({
      ...original,
      contactMethod: "email",
      phone: undefined,
      preferredTimes: futurePreferredTimes(2, 21),
      timeZone: "America/Vancouver",
      message: "Do not adopt this edit for an ambiguous send.",
    });
    expect(retry.status).toBe(200);
    expect(mocks.records[0]).toMatchObject({
      contactMethod: "text",
      contactPhone: "613-555-0199",
      preferredContactTimes: original.preferredTimes,
      preferredContactTimeZone: "UTC",
      contactMessage: "Please text before calling.",
      notificationAttempts: 2,
    });
    const messages = contactMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1].messageId).toBe(messages[0].messageId);
  });

  it("allows email contact without collecting a new phone", async () => {
    const { body: saved } = await saveValidLead();
    const response = await postConsent({
      ...validContact(saved.submissionToken),
      contactMethod: "email",
      phone: undefined,
    });
    expect(response.status).toBe(200);
    expect(mocks.records[0].contactMethod).toBe("email");
    expect(mocks.records[0].contactPhone).toBeUndefined();
  });

  it("uses the mandatory stored lead phone when a phone/text override is omitted", async () => {
    const { body: saved } = await saveValidLead();
    const response = await postConsent({
      ...validContact(saved.submissionToken),
      phone: undefined,
    });
    expect(response.status).toBe(200);
    expect(mocks.records[0].contactMethod).toBe("text");
    expect(mocks.records[0].contactPhone).toBe("613-555-0100");
  });

  it("requires same-origin JSON and a valid contact-help Turnstile action", async () => {
    const { body: saved } = await saveValidLead();
    const contact = validContact(saved.submissionToken);
    mocks.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });

    const crossOrigin = new NextRequest(
      "http://localhost/api/quiz-lead/contact-consent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify(contact),
      },
    );
    expect((await submitContactConsent(crossOrigin)).status).toBe(403);
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();

    mocks.verifyTurnstile.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    expect((await postConsent(contact)).status).toBe(400);
    expect(mocks.records[0].contactConsentAt).toBeUndefined();

    mocks.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
    const honeypot = await postConsent({ ...contact, website: "bot" });
    expect(honeypot.status).toBe(200);
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });
});
