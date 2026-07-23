import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTIONS, QUIZ_VERSION, type Answers } from "@/lib/quiz";
import { CONTACT_CONSENT_TEXT } from "@/lib/quizLead";
import type {
  NewQuizLead,
  QuizLeadPatch,
  QuizLeadStore,
  StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import {
  createSubmissionToken,
  resetQuizLeadStoreStateForTests,
} from "@/lib/server/quizLeadStore";
import { resetRateLimitState } from "@/lib/server/rateLimit";

const mocks = vi.hoisted(() => {
  const records: StoredQuizLead[] = [];
  let nextRow = 2;
  const store: QuizLeadStore = {
    async findByClientSubmissionId(clientSubmissionId) {
      return records.find((record) => record.clientSubmissionId === clientSubmissionId) ?? null;
    },
    async findBySubmissionTokenHash(tokenHash) {
      return records.find((record) => record.submissionTokenHash === tokenHash) ?? null;
    },
    async appendLead(lead: NewQuizLead) {
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
      nextRow = 2;
    },
    store,
    sendMail: vi.fn(),
    buildPdf: vi.fn(),
  };
});

vi.mock("@/lib/server/quizLeadStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/quizLeadStore")>();
  return {
    ...actual,
    getQuizLeadStore: vi.fn(async () => mocks.store),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: mocks.sendMail })) },
}));

vi.mock("@/lib/server/quizSummaryPdf", () => ({
  buildQuizSummaryPdf: mocks.buildPdf,
}));

process.env.QUIZ_LEAD_TOKEN_SECRET = "test-only-quiz-lead-token-secret";
process.env.GMAIL_USER = "sender@example.com";
process.env.GMAIL_APP_PASSWORD = "test-password";
process.env.QUIZ_LEAD_ADMIN_URL = "https://admin.example.com/quiz/{referenceId}";

import { POST as saveLead } from "@/app/api/quiz-lead/route";
import { POST as submitContactConsent } from "@/app/api/quiz-lead/contact-consent/route";

function completedAnswers(): Answers {
  const answers: Answers = {};
  for (const question of QUESTIONS) {
    if (question.kind === "safety" || question.id === "language") continue;
    if (question.kind === "scored") {
      answers[question.id] = 2;
    } else if (question.kind === "multi") {
      answers[question.id] = question.id === "concerns" ? ["anxiety"] : [];
    } else if (question.id === "gender_preference") {
      answers[question.id] = "no-preference";
    } else {
      answers[question.id] = question.options[0].value;
    }
  }
  return answers;
}

let idCounter = 0;
function accessPayload(overrides: Record<string, unknown> = {}) {
  idCounter += 1;
  return {
    clientSubmissionId: `client-${idCounter.toString().padStart(8, "0")}`,
    quizVersion: QUIZ_VERSION,
    firstName: "Alex",
    email: "alex@example.com",
    phone: "613-555-0100",
    privacyAcknowledged: true,
    answers: completedAnswers(),
    ...overrides,
  };
}

let ipCounter = 0;
function request(path: string, body: unknown, ip?: string) {
  ipCounter += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? `10.20.0.${ipCounter}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function postAccess(body: unknown, ip?: string) {
  return saveLead(request("/api/quiz-lead", body, ip) as never);
}

async function postConsent(body: unknown, ip?: string) {
  return submitContactConsent(
    request("/api/quiz-lead/contact-consent", body, ip) as never,
  );
}

async function saveValidLead(overrides: Record<string, unknown> = {}) {
  const payload = accessPayload(overrides);
  const response = await postAccess(payload);
  const body = await response.json();
  expect(response.status).toBe(201);
  return { payload, body } as {
    payload: ReturnType<typeof accessPayload>;
    body: {
      ok: true;
      referenceId: string;
      submissionToken: string;
      outcome: unknown;
      match: unknown;
    };
  };
}

function sentMessages() {
  return mocks.sendMail.mock.calls.map(([message]) => message);
}

function accessMessages() {
  return sentMessages().filter((message) =>
    String(message.subject).startsWith("New Quiz Results Submission"),
  );
}

function contactMessages() {
  return sentMessages().filter((message) =>
    String(message.subject).startsWith("New Therapist Contact Request"),
  );
}

beforeEach(() => {
  mocks.resetRecords();
  mocks.sendMail.mockReset().mockResolvedValue({ accepted: ["info@valisenmentalhealth.com"] });
  mocks.buildPdf.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
  resetRateLimitState();
  resetQuizLeadStoreStateForTests();
});

describe("POST /api/quiz-lead — results access", () => {
  it("persists the canonical server result and sends a distinct internal results summary", async () => {
    const payload = accessPayload({
      answers: { ...completedAnswers(), safety: "often" },
      outcome: { score: 999 },
      match: { therapistSlug: "tampered" },
    });
    const response = await postAccess(payload);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.referenceId).toMatch(/^VQ-[0-9A-F]{12}$/);
    expect(body.submissionToken).toMatch(/^v1\.VQ-/);
    expect(body.resultsEmailSent).toBe(true);
    expect(body.outcome.score).not.toBe(999);
    expect(body.outcome).toEqual(mocks.records[0].outcome);
    expect(body.match).toEqual(mocks.records[0].match);
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationStatus).toBe("sent");
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(mocks.records[0].notificationStatus).toBe("not_requested");
    expect(mocks.records[0].contactConsentAt).toBeUndefined();
    expect(mocks.records[0].privacyText).toContain("personalized results");
    expect("safety" in mocks.records[0].answers).toBe(false);
    expect("language" in mocks.records[0].answers).toBe(false);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);

    const mail = accessMessages()[0];
    expect(mail.to).toBe("info@valisenmentalhealth.com");
    expect(mail.subject).toBe("New Quiz Results Submission — Alex");
    expect(mail.text).toContain("THERAPIST CONTACT NOT REQUESTED");
    expect(mail.text).toContain(mocks.records[0].resultCategory);
    expect(mail.text).not.toContain("explicitly requested to be contacted");
    expect(mail.attachments).toHaveLength(1);
    expect(mocks.buildPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        contactConsent: { status: "not_requested" },
      }),
    );
  });

  it("returns the same persisted record/token for an idempotent save retry", async () => {
    const payload = accessPayload();
    const first = await (await postAccess(payload)).json();
    const secondResponse = await postAccess(payload);
    const second = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(second.duplicate).toBe(true);
    expect(second.referenceId).toBe(first.referenceId);
    expect(second.submissionToken).toBe(first.submissionToken);
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);
  });

  it("serializes concurrent access submissions into one row and one results email", async () => {
    const payload = accessPayload();
    const [first, second] = await Promise.all([
      postAccess(payload, "10.25.0.1"),
      postAccess(payload, "10.25.0.2"),
    ]);

    expect([first.status, second.status]).toEqual([201, 200]);
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);
  });

  it("keeps a saved lead retryable when the results email fails", async () => {
    const payload = accessPayload();
    mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));

    const failed = await postAccess(payload);
    expect(failed.status).toBe(502);
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationStatus).toBe("failed");
    expect(mocks.records[0].accessNotificationAttempts).toBe(1);
    expect(mocks.records[0].notificationStatus).toBe("not_requested");
    expect(mocks.records[0].contactConsentAt).toBeUndefined();

    const retry = await postAccess(payload);
    const retryBody = await retry.json();
    expect(retry.status).toBe(200);
    expect(retryBody).toMatchObject({
      ok: true,
      duplicate: true,
      resultsEmailSent: true,
    });
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationStatus).toBe("sent");
    expect(mocks.records[0].accessNotificationAttempts).toBe(2);
    expect(accessMessages()).toHaveLength(2);
    expect(contactMessages()).toHaveLength(0);
  });

  it("retries a results-summary PDF failure without duplicating the lead", async () => {
    const payload = accessPayload();
    mocks.buildPdf.mockRejectedValueOnce(new Error("pdf unavailable"));

    const failed = await postAccess(payload);
    expect(failed.status).toBe(502);
    expect(mocks.records).toHaveLength(1);
    expect(mocks.records[0].accessNotificationStatus).toBe("failed");
    expect(accessMessages()).toHaveLength(0);

    const retry = await postAccess(payload);
    expect(retry.status).toBe(200);
    expect(mocks.records[0].accessNotificationStatus).toBe("sent");
    expect(mocks.records[0].accessNotificationAttempts).toBe(2);
    expect(accessMessages()).toHaveLength(1);
  });

  it("rejects missing access fields, stale quizzes, and language answers", async () => {
    const base = accessPayload();
    for (const invalid of [
      { ...base, firstName: "" },
      { ...base, email: "bad" },
      { ...base, phone: "12" },
      { ...base, privacyAcknowledged: false },
      { ...base, quizVersion: "0.0.1" },
      { ...base, answers: { ...completedAnswers(), language: "english" } },
    ]) {
      const response = await postAccess(invalid);
      expect(response.status).toBe(400);
    }
    expect(mocks.records).toHaveLength(0);
    expect(sentMessages()).toHaveLength(0);
  });

  it("quietly swallows honeypots and rejects oversized payloads", async () => {
    const honeypot = await postAccess(accessPayload({ website: "bot" }));
    expect(honeypot.status).toBe(200);
    const oversized = await postAccess(accessPayload({ extra: "x".repeat(60_000) }));
    expect(oversized.status).toBe(413);
    expect(mocks.records).toHaveLength(0);
  });
});

describe("POST /api/quiz-lead/contact-consent", () => {
  it("stores exact consent and sends one complete internal notification", async () => {
    const { body: saved } = await saveValidLead();
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);

    const response = await postConsent({
      submissionToken: saved.submissionToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, emailSent: true, referenceId: saved.referenceId });
    expect(mocks.records[0].contactConsentAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(mocks.records[0].contactConsentAt!))).toBe(false);
    expect(mocks.records[0].contactConsentText).toBe(CONTACT_CONSENT_TEXT);
    expect(mocks.records[0].notificationStatus).toBe("sent");
    expect(mocks.records[0].notificationAttempts).toBe(1);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);

    const mail = contactMessages()[0];
    expect(mail.subject).toBe("New Therapist Contact Request — Alex");
    expect(mail.text).toContain("alex@example.com");
    expect(mail.text).toContain("613-555-0100");
    expect(mail.text).toContain(mocks.records[0].resultCategory);
    expect(mail.text).toContain(saved.referenceId);
    expect(mail.text).toContain("https://admin.example.com/quiz/");
    expect(mail.text).toContain(CONTACT_CONSENT_TEXT);
    expect(mail.attachments).toHaveLength(1);
    expect(mocks.buildPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        contactConsent: expect.objectContaining({
          status: "granted",
        }),
      }),
    );
  });

  it("does not create duplicate consent records or emails on repeat clicks", async () => {
    const { body: saved } = await saveValidLead();
    const consent = {
      submissionToken: saved.submissionToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    };
    const first = await postConsent(consent);
    const timestamp = mocks.records[0].contactConsentAt;
    const second = await postConsent(consent);
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(secondBody).toMatchObject({ ok: true, emailSent: true, duplicate: true });
    expect(mocks.records[0].contactConsentAt).toBe(timestamp);
    expect(mocks.records[0].notificationAttempts).toBe(1);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("serializes concurrent double clicks so only one email is sent", async () => {
    const { body: saved } = await saveValidLead();
    const consent = {
      submissionToken: saved.submissionToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    };

    const [first, second] = await Promise.all([
      postConsent(consent, "10.30.0.1"),
      postConsent(consent, "10.30.0.2"),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(mocks.records[0].notificationAttempts).toBe(1);
  });

  it("marks delivery failures retryable without losing consent or results", async () => {
    const { body: saved } = await saveValidLead();
    mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));
    const consent = {
      submissionToken: saved.submissionToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    };
    const failed = await postConsent(consent);
    const originalTimestamp = mocks.records[0].contactConsentAt;

    expect(failed.status).toBe(502);
    expect(mocks.records[0].notificationStatus).toBe("failed");
    expect(mocks.records[0].outcome).toBeTruthy();

    // Simulate retrying an already-recorded consent after canonical copy was
    // changed by a later deployment. The first timestamp/copy stay authoritative.
    const originalConsentText = "Legacy consent wording already shown and recorded.";
    mocks.records[0].contactConsentText = originalConsentText;
    mocks.records[0].contactConsentTextVersion = "2026-07-01.v1";
    const retry = await postConsent({
      ...consent,
      consentLanguage: originalConsentText,
    });
    expect(retry.status).toBe(200);
    expect(mocks.records[0].notificationStatus).toBe("sent");
    expect(mocks.records[0].contactConsentAt).toBe(originalTimestamp);
    expect(mocks.records[0].contactConsentText).toBe(originalConsentText);
    expect(mocks.records[0].contactConsentTextVersion).toBe("2026-07-01.v1");
    expect(mocks.records[0].notificationAttempts).toBe(2);
    expect(contactMessages()).toHaveLength(2);
    expect(contactMessages()[1].text).toContain(originalConsentText);
  });

  it("marks PDF/preparation failures failed so an immediate retry can send", async () => {
    const { body: saved } = await saveValidLead();
    mocks.buildPdf.mockRejectedValueOnce(new Error("pdf unavailable"));
    const consent = {
      submissionToken: saved.submissionToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    };
    const failed = await postConsent(consent);
    expect(failed.status).toBe(502);
    expect(mocks.records[0].notificationStatus).toBe("failed");
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);

    const retry = await postConsent(consent);
    expect(retry.status).toBe(200);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown tokens and stale consent wording without emailing", async () => {
    const unknownToken = createSubmissionToken("VQ-UNKNOWN00000", "client-unknown01");
    const missing = await postConsent({
      submissionToken: unknownToken,
      consentLanguage: CONTACT_CONSENT_TEXT,
    });
    expect(missing.status).toBe(404);

    const { body: saved } = await saveValidLead();
    const stale = await postConsent({
      submissionToken: saved.submissionToken,
      consentLanguage: "Yes, contact me",
    });
    expect(stale.status).toBe(400);
    expect(accessMessages()).toHaveLength(1);
    expect(contactMessages()).toHaveLength(0);
  });
});
