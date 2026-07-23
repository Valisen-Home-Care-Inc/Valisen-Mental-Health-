import { describe, expect, it } from "vitest";
import { QUESTIONS, QUIZ_VERSION, type Answers } from "@/lib/quiz";
import {
  CONTACT_CONSENT_TEXT,
  CONTACT_CONSENT_TEXT_VERSION,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
  cleanAnswers,
  escapeHtml,
  isValidEmail,
  isValidPhone,
  sanitizeFreeText,
  validateQuizContactConsentEnvelope,
  validateQuizContactConsentPayload,
  validateQuizLeadAccessPayload,
} from "@/lib/quizLead";

function completedAnswers(): Answers {
  const answers: Answers = {};
  for (const question of QUESTIONS) {
    if (question.kind === "safety" || question.id === "language") continue;
    if (question.kind === "multi") {
      answers[question.id] = [];
    } else {
      answers[question.id] = question.options[0].value;
    }
  }
  return answers;
}

function validAccessPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: "11111111-2222-3333-4444-555555555555",
    quizVersion: QUIZ_VERSION,
    firstName: "Alex",
    email: "Alex@Example.com",
    phone: "613-555-0100",
    privacyAcknowledged: true,
    answers: completedAnswers(),
    ...overrides,
  };
}

describe("results-access validation", () => {
  it("accepts and normalizes a completed lead payload", () => {
    const result = validateQuizLeadAccessPayload(
      validAccessPayload({ firstName: "  Alex\r\nInjected  " }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toBe("Alex Injected");
      expect(result.data.email).toBe("alex@example.com");
      expect(result.data.phone).toBe("613-555-0100");
      expect(result.data.privacyAcknowledged).toBe(true);
    }
  });

  it("requires first name, email, phone, and privacy acknowledgement", () => {
    expect(validateQuizLeadAccessPayload(validAccessPayload({ firstName: "" })).ok).toBe(false);
    expect(validateQuizLeadAccessPayload(validAccessPayload({ email: "not-an-email" })).ok).toBe(
      false,
    );
    expect(validateQuizLeadAccessPayload(validAccessPayload({ phone: "12" })).ok).toBe(false);
    expect(
      validateQuizLeadAccessPayload(validAccessPayload({ privacyAcknowledged: false })).ok,
    ).toBe(false);
  });

  it("requires a current quiz version and stable client id", () => {
    expect(validateQuizLeadAccessPayload(validAccessPayload({ quizVersion: "0.0.1" })).ok).toBe(
      false,
    );
    expect(validateQuizLeadAccessPayload(validAccessPayload({ clientSubmissionId: "short" })).ok).toBe(
      false,
    );
  });

  it("requires a complete quiz", () => {
    const incomplete = completedAnswers();
    delete incomplete[QUESTIONS.find((question) => question.kind === "scored")!.id];
    expect(validateQuizLeadAccessPayload(validAccessPayload({ answers: incomplete })).ok).toBe(
      false,
    );
  });

  it("flags honeypot submissions without accepting their data", () => {
    expect(validateQuizLeadAccessPayload(validAccessPayload({ website: "spam" }))).toEqual({
      ok: false,
      error: "honeypot",
    });
  });

  it("uses separate, versioned privacy and contact-consent wording", () => {
    expect(RESULTS_ACCESS_PRIVACY_TEXT).toContain("provide my personalized results");
    expect(RESULTS_ACCESS_PRIVACY_TEXT).toContain("authorized internal inbox");
    expect(RESULTS_ACCESS_PRIVACY_TEXT).not.toContain("contacted");
    expect(CONTACT_CONSENT_TEXT).toContain("consent to being contacted");
    expect(RESULTS_ACCESS_PRIVACY_TEXT_VERSION).toBeTruthy();
    expect(CONTACT_CONSENT_TEXT_VERSION).toBeTruthy();
  });
});

describe("answer allow-listing", () => {
  it("strips the safety answer even if a tampered client sends it", () => {
    const result = cleanAnswers({ ...completedAnswers(), safety: "often" });
    expect(result).not.toBeNull();
    expect(result && "safety" in result).toBe(false);
  });

  it("rejects the removed language answer", () => {
    expect(cleanAnswers({ ...completedAnswers(), language: "english" })).toBeNull();
  });

  it("rejects unknown ids and out-of-range values", () => {
    expect(cleanAnswers({ ...completedAnswers(), hacked_field: 1 })).toBeNull();
    expect(cleanAnswers({ ...completedAnswers(), worry_1: 99 })).toBeNull();
    expect(cleanAnswers({ ...completedAnswers(), worry_1: "3" })).toBeNull();
  });

  it("accepts scored nulls and de-duplicates valid multi-select values", () => {
    const answers = completedAnswers();
    answers.worry_1 = null;
    answers.concerns = ["anxiety", "anxiety"];
    const cleaned = cleanAnswers(answers);
    expect(cleaned?.worry_1).toBeNull();
    expect(cleaned?.concerns).toEqual(["anxiety"]);
  });

  it("rejects invalid multi-select values", () => {
    expect(cleanAnswers({ ...completedAnswers(), concerns: ["not-a-concern"] })).toBeNull();
  });
});

describe("separate contact-consent validation", () => {
  const token = `v1.VQ-123456789ABC.${"a".repeat(43)}`;

  it("accepts only the exact current consent language", () => {
    expect(
      validateQuizContactConsentPayload({
        submissionToken: token,
        consentLanguage: CONTACT_CONSENT_TEXT,
      }).ok,
    ).toBe(true);
    expect(
      validateQuizContactConsentPayload({
        submissionToken: token,
        consentLanguage: "Yes, contact me",
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentEnvelope({
        submissionToken: token,
        consentLanguage: "An older, already-recorded consent copy",
      }).ok,
    ).toBe(true);
  });

  it("rejects malformed tokens and honeypots", () => {
    expect(
      validateQuizContactConsentPayload({
        submissionToken: "short",
        consentLanguage: CONTACT_CONSENT_TEXT,
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        submissionToken: token,
        consentLanguage: CONTACT_CONSENT_TEXT,
        website: "bot",
      }),
    ).toEqual({ ok: false, error: "honeypot" });
  });
});

describe("sanitization", () => {
  it("removes control characters but keeps newlines", () => {
    const input = `hello${String.fromCharCode(0)}world\nline two`;
    expect(sanitizeFreeText(input, 100)).toBe("helloworld\nline two");
  });

  it("escapes HTML-sensitive characters", () => {
    expect(escapeHtml(`<script>alert("hi")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;",
    );
  });

  it("validates contact fields", () => {
    expect(isValidEmail("person@example.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidPhone("613-555-0100")).toBe(true);
    expect(isValidPhone("12")).toBe(false);
    expect(isValidPhone("613-555-CALL")).toBe(false);
  });
});
