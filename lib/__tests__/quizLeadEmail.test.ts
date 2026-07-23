import { describe, expect, it } from "vitest";
import {
  buildQuizLeadEmail,
  buildQuizResultsAccessEmail,
  type QuizLeadEmailModel,
  type QuizResultsAccessEmailModel,
} from "@/lib/server/quizLeadEmail";
import { CONTACT_CONSENT_TEXT } from "@/lib/quizLead";

function model(overrides: Partial<QuizLeadEmailModel> = {}): QuizLeadEmailModel {
  return {
    referenceId: "VQ-TEST1234",
    firstName: "Alex",
    email: "alex@example.com",
    phone: "613-555-0100",
    resultCategory: "Worry and tension stood out",
    scoreBand: "Coping, but under some strain",
    recommendedTherapistName: "Tim Kahtava",
    consentTimestampLabel: "Wednesday, July 22, 2026 at 2:00 p.m.",
    consentText: CONTACT_CONSENT_TEXT,
    consentTextVersion: "2026-07-22.v1",
    adminUrl: "https://admin.example.com/quiz/VQ-TEST1234",
    ...overrides,
  };
}

function accessModel(
  overrides: Partial<QuizResultsAccessEmailModel> = {},
): QuizResultsAccessEmailModel {
  return {
    referenceId: "VQ-ACCESS1234",
    firstName: "Alex",
    email: "alex@example.com",
    phone: "613-555-0100",
    resultCategory: "Worry and tension stood out",
    scoreBand: "Coping, but under some strain",
    recommendedTherapistName: "Tim Kahtava",
    submittedAtLabel: "Thursday, July 23, 2026 at 2:00 p.m.",
    privacyAcknowledgedAtLabel: "Thursday, July 23, 2026 at 2:00 p.m.",
    adminUrl: "https://admin.example.com/quiz/VQ-ACCESS1234",
    ...overrides,
  };
}

describe("buildQuizResultsAccessEmail", () => {
  it("builds a neutral internal results notification without contact permission", () => {
    const email = buildQuizResultsAccessEmail(accessModel());

    expect(email.subject).toBe("New Quiz Results Submission — Alex");
    for (const content of [email.text, email.html]) {
      expect(content).toContain("Alex");
      expect(content).toContain("alex@example.com");
      expect(content).toContain("613-555-0100");
      expect(content).toContain("Worry and tension stood out");
      expect(content).toContain("Tim Kahtava");
      expect(content).toContain("VQ-ACCESS1234");
      expect(content).toMatch(/results access only/i);
      expect(content).toMatch(/contact (?:the visitor )?regarding therapy services/i);
      expect(content).toMatch(/separate therapist-contact request is required/i);
    }
  });

  it("never describes results access as granted therapist-contact consent", () => {
    const email = buildQuizResultsAccessEmail(accessModel());
    const combined = `${email.subject}\n${email.text}\n${email.html}`;

    expect(combined).toMatch(/therapist contact not requested/i);
    expect(combined).not.toMatch(/explicitly requested to be contacted/i);
    expect(combined).not.toContain(CONTACT_CONSENT_TEXT);
    expect(combined).not.toMatch(/user requested contact:\s*yes/i);
  });

  it("sanitizes the subject and escapes submitted values in HTML", () => {
    const email = buildQuizResultsAccessEmail(
      accessModel({
        firstName: "Alex\r\nBcc: attacker@example.com",
        email: `<script>alert("x")</script>@example.com`,
      }),
    );

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("supports no match, missing phone, and an internal reference fallback", () => {
    const email = buildQuizResultsAccessEmail(
      accessModel({
        recommendedTherapistName: null,
        phone: undefined,
        adminUrl: undefined,
      }),
    );

    expect(email.text).toContain("No clear automated match");
    expect(email.text).toContain("Phone: Not provided");
    expect(email.text).toContain("Internal submission reference: VQ-ACCESS1234");
    expect(email.html).toContain("Internal submission reference");
  });

  it("does not embed raw quiz answer keys or a safety response", () => {
    const email = buildQuizResultsAccessEmail(accessModel());
    const combined = `${email.text}\n${email.html}`;

    expect(combined).not.toMatch(/worry_1|mood_1|gender_preference|"language"|"safety"/i);
  });
});

describe("buildQuizLeadEmail", () => {
  it("uses the requested subject with the visitor's first name", () => {
    expect(buildQuizLeadEmail(model()).subject).toBe(
      "New Therapist Contact Request — Alex",
    );
  });

  it("cannot inject additional mail headers through a legacy first name", () => {
    const { subject } = buildQuizLeadEmail(
      model({ firstName: "Alex\r\nBcc: attacker@example.com" }),
    );
    expect(subject).toBe(
      "New Therapist Contact Request — Alex Bcc: attacker@example.com",
    );
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("includes every required internal contact-request field", () => {
    const { text, html } = buildQuizLeadEmail(model());
    for (const content of [text, html]) {
      expect(content).toContain("Alex");
      expect(content).toContain("alex@example.com");
      expect(content).toContain("613-555-0100");
      expect(content).toContain("Worry and tension stood out");
      expect(content).toContain("Tim Kahtava");
      expect(content).toContain("July 22, 2026");
      expect(content).toContain("explicitly requested");
      expect(content).toContain("VQ-TEST1234");
      expect(content).toContain(CONTACT_CONSENT_TEXT);
    }
  });

  it("includes a secure internal link when configured", () => {
    const email = buildQuizLeadEmail(model());
    expect(email.text).toContain("https://admin.example.com/quiz/VQ-TEST1234");
    expect(email.html).toContain("Open the secure submission");
  });

  it("falls back to the internal reference when no URL is configured", () => {
    const { text, html } = buildQuizLeadEmail(model({ adminUrl: undefined }));
    expect(text).toContain("Internal submission reference: VQ-TEST1234");
    expect(html).toContain("Internal submission reference");
  });

  it("handles no clear automated therapist match", () => {
    const { text } = buildQuizLeadEmail(model({ recommendedTherapistName: null }));
    expect(text).toContain("No clear automated match");
  });

  it("escapes user-provided values in HTML", () => {
    const { html } = buildQuizLeadEmail(
      model({
        firstName: `<img src=x onerror=alert(1)>`,
        email: `<script>alert("x")</script>@example.com`,
      }),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });

  it("does not embed raw quiz answer keys", () => {
    const email = buildQuizLeadEmail(model());
    expect(email.text).not.toMatch(/worry_1|mood_1|gender_preference|"language"/i);
  });
});
