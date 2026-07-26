import { describe, expect, it } from "vitest";
import { QUESTIONS, QUIZ_VERSION, type Answers } from "@/lib/quiz";
import {
  CONTACT_CONSENT_TEXT,
  CONTACT_CONSENT_TEXT_VERSION,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
  cleanAnswers,
  escapeHtml,
  hasCurrentResultsAccessAuthorization,
  isValidEmail,
  isValidContactTimeZone,
  isValidPhone,
  isStrictLocalDateTime,
  normalizeContactTimeZone,
  sanitizeFreeText,
  validateQuizContactConsentEnvelope,
  validateQuizContactConsentPayload,
  validateQuizEngagementPayload,
  validateQuizLeadAccessPayload,
} from "@/lib/quizLead";

function futurePreferredTimes(count = 2): string[] {
  const start = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
  );
}

function localDateTimeAt(epochMs: number, timeZone: string): string {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(epochMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}`;
}

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
    privacyLanguage: RESULTS_ACCESS_PRIVACY_TEXT,
    privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
    answers: completedAnswers(),
    attribution: {
      source: "google",
      medium: "cpc",
      campaign: "ottawa therapy",
    },
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
      expect(result.data.privacyLanguage).toBe(RESULTS_ACCESS_PRIVACY_TEXT);
      expect(result.data.privacyTextVersion).toBe(
        RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
      );
      expect(result.data.intent).toBe("ready_to_speak");
      expect(result.data.attribution).toEqual({
        source: "google",
        medium: "cpc",
        campaign: "ottawa therapy",
      });
    }
  });

  it("requires name, email, phone, and the results-access acknowledgement", () => {
    expect(validateQuizLeadAccessPayload(validAccessPayload({ firstName: "" })).ok).toBe(false);
    expect(validateQuizLeadAccessPayload(validAccessPayload({ email: "not-an-email" })).ok).toBe(
      false,
    );
    expect(validateQuizLeadAccessPayload(validAccessPayload({ phone: "12" })).ok).toBe(false);
    expect(
      validateQuizLeadAccessPayload(validAccessPayload({ phone: undefined })).ok,
    ).toBe(false);
    expect(validateQuizLeadAccessPayload(validAccessPayload({ phone: "" })).ok).toBe(
      false,
    );
    expect(
      validateQuizLeadAccessPayload(validAccessPayload({ privacyAcknowledged: false })).ok,
    ).toBe(false);
    expect(
      validateQuizLeadAccessPayload(
        validAccessPayload({ privacyLanguage: "Older consent copy" }),
      ).ok,
    ).toBe(false);
    expect(
      validateQuizLeadAccessPayload(
        validAccessPayload({ privacyTextVersion: "2026-07-22.v1" }),
      ).ok,
    ).toBe(false);
    expect(
      validateQuizLeadAccessPayload(
        validAccessPayload({ privacyLanguage: undefined }),
      ).ok,
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

  it("requires the intent answer and rejects unknown attribution fields", () => {
    const noIntent = completedAnswers();
    delete noIntent.intent;
    expect(
      validateQuizLeadAccessPayload(validAccessPayload({ answers: noIntent })).ok,
    ).toBe(false);
    expect(
      validateQuizLeadAccessPayload(
        validAccessPayload({
          attribution: { source: "google", searchTerm: "anxiety help" },
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateQuizLeadAccessPayload(
        validAccessPayload({ attribution: { source: 42 } }),
      ).ok,
    ).toBe(false);
  });

  it("flags honeypot submissions without accepting their data", () => {
    expect(validateQuizLeadAccessPayload(validAccessPayload({ website: "spam" }))).toEqual({
      ok: false,
      error: "honeypot",
    });
  });

  it("uses separate, versioned privacy and contact-consent wording", () => {
    expect(RESULTS_ACCESS_PRIVACY_TEXT).toBe(
      "I consent to Valisen Mental Health securely collecting, storing, and using my contact information and quiz responses to create and deliver my personalized results and maintain related administrative records, as described in the Privacy Policy. I authorize Valisen's authorized staff and my recommended or matched therapist to contact me by email, phone, or text about my quiz results, therapist match, consultations, scheduling, and related Valisen therapy services. I authorize Valisen to share my contact details and relevant quiz summary with that therapist for those purposes. This consent does not authorize Valisen to sell my information or enroll me in unrelated promotional marketing.",
    );
    expect(CONTACT_CONSENT_TEXT).toBe(
      "I understand that the proposed times I provide are preferences, not confirmed appointments. I ask Valisen and my matched therapist to coordinate with me about these times using my selected contact method. I understand that an appointment is booked only after I receive confirmation.",
    );
    expect(RESULTS_ACCESS_PRIVACY_TEXT_VERSION).toBe("2026-07-26.v4");
    expect(CONTACT_CONSENT_TEXT_VERSION).toBe("2026-07-26.v3");
    expect(
      hasCurrentResultsAccessAuthorization(
        RESULTS_ACCESS_PRIVACY_TEXT,
        RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
      ),
    ).toBe(true);
    expect(
      hasCurrentResultsAccessAuthorization(
        "Different copy",
        RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
      ),
    ).toBe(false);
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
  const validContact = {
    submissionToken: token,
    contactMethod: "text",
    phone: "613-555-0100",
    preferredTimes: futurePreferredTimes(),
    timeZone: "UTC",
    message: "  Please text first.\nThank you. ",
    consentGranted: true,
    consentLanguage: CONTACT_CONSENT_TEXT,
  };

  it("accepts only the exact current consent language", () => {
    expect(
      validateQuizContactConsentPayload(validContact).ok,
    ).toBe(true);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        consentLanguage: "Yes, contact me",
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentEnvelope({
        ...validContact,
        consentLanguage: "An older, already-recorded consent copy",
      }).ok,
    ).toBe(true);
  });

  it("rejects malformed tokens and honeypots", () => {
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        submissionToken: "short",
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        website: "bot",
      }),
    ).toEqual({ ok: false, error: "honeypot" });
  });

  it("requires exact future times, a time zone, method, and explicit consent", () => {
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        contactMethod: "phone",
        phone: undefined,
      }).ok,
    ).toBe(true);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        phone: "",
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        preferredTimes: [futurePreferredTimes()[0]],
      }).ok,
    ).toBe(false);
    const duplicate = futurePreferredTimes()[0];
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        preferredTimes: [duplicate, duplicate],
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        preferredTimes: ["2026-02-30T10:00", "2026-03-01T10:00"],
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        timeZone: "not/a real zone<script>",
      }).ok,
    ).toBe(false);
    const now = Date.now();
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        timeZone: "America/Toronto",
        preferredTimes: [
          localDateTimeAt(
            now + 7 * 24 * 60 * 60 * 1000,
            "America/Toronto",
          ),
          localDateTimeAt(
            now + 8 * 24 * 60 * 60 * 1000,
            "America/Toronto",
          ),
        ],
      }).ok,
    ).toBe(true);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        preferredTimes: [
          localDateTimeAt(now - 24 * 60 * 60 * 1000, "UTC"),
          localDateTimeAt(now + 7 * 24 * 60 * 60 * 1000, "UTC"),
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        preferredTimes: [
          localDateTimeAt(now + 366 * 24 * 60 * 60 * 1000, "UTC"),
          localDateTimeAt(now + 367 * 24 * 60 * 60 * 1000, "UTC"),
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        consentGranted: false,
      }).ok,
    ).toBe(false);
    expect(
      validateQuizContactConsentPayload({
        ...validContact,
        message: "x".repeat(1_100),
      }),
    ).toMatchObject({
      ok: true,
      data: { message: "x".repeat(1_000) },
    });
  });
});

describe("privacy-safe engagement validation", () => {
  const token = `v1.VQ-123456789ABC.${"a".repeat(43)}`;

  it("requires an allow-listed placement only for Jane clicks", () => {
    expect(
      validateQuizEngagementPayload({
        submissionToken: token,
        event: "results_viewed",
      }).ok,
    ).toBe(true);
    expect(
      validateQuizEngagementPayload({
        submissionToken: token,
        event: "jane_booking_clicked",
        ctaPlacement: "results_primary",
      }).ok,
    ).toBe(true);
    expect(
      validateQuizEngagementPayload({
        submissionToken: token,
        event: "jane_booking_clicked",
        ctaPlacement: "invented_button",
      }).ok,
    ).toBe(false);
  });

  it("rejects sensitive or unknown fields", () => {
    expect(
      validateQuizEngagementPayload({
        submissionToken: token,
        event: "results_viewed",
        score: 42,
      }).ok,
    ).toBe(false);
    expect(
      validateQuizEngagementPayload({
        submissionToken: token,
        event: "results_viewed",
        ctaPlacement: "results_primary",
      }).ok,
    ).toBe(false);
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
    expect(isStrictLocalDateTime("2026-08-03T10:30")).toBe(true);
    expect(isStrictLocalDateTime("2026-02-30T10:30")).toBe(false);
    expect(isValidContactTimeZone("America/Toronto")).toBe(true);
    expect(normalizeContactTimeZone("  America/Toronto  ")).toBe(
      "America/Toronto",
    );
    expect(isValidContactTimeZone("Toronto")).toBe(false);
  });
});
