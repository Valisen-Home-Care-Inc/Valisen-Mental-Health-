import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { QUESTIONS, QUIZ_VERSION, type Answers } from "@/lib/quiz";
import {
  CONTACT_CONSENT_TEXT,
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
  let nextRow = 2;
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
    String(message.subject).startsWith("New Quiz Results Submission"),
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
    String(message.subject).startsWith("Booking Help Requested"),
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
  };
}

beforeEach(() => {
  mocks.resetRecords();
  mocks.sendMail
    .mockReset()
    .mockResolvedValue({ accepted: ["accepted@example.com"] });
  mocks.buildPdf
    .mockReset()
    .mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
  resetRateLimitState();
  resetQuizLeadStoreStateForTests();
});

describe("POST /api/quiz-lead", () => {
  it("persists authoritative score/match, intent and safe attribution, then sends two independent emails", async () => {
    const payload = accessPayload({
      answers: {
        ...completedAnswers("brief_consultation"),
        safety: "often",
      },
      outcome: { score: 999 },
      match: { therapistSlug: "tampered" },
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
    expect(body.outcome.score).not.toBe(999);

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
      "valisenmentalhealth.janeapp.com",
    );
    expect(userResultsMessages()[0].text).toContain("#result=");
    expect(userResultsMessages()[0].text).toContain(
      "does not subscribe you to promotional email",
    );
    expect(mocks.buildPdf).toHaveBeenCalledTimes(1);
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

  it("quietly swallows honeypots and rejects oversized payloads", async () => {
    const honeypot = await postAccess(
      accessPayload({ website: "bot" }),
    );
    expect(honeypot.status).toBe(200);
    const oversized = await postAccess(
      accessPayload({ extra: "x".repeat(60_000) }),
    );
    expect(oversized.status).toBe(413);
  });
});

describe("POST /api/quiz-lead/result", () => {
  it("restores only the private result view model with no contact details or answers", async () => {
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
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("phone");
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
      textVersion: "2026-07-26.v4",
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
});
