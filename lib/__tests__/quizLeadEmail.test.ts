import { describe, expect, it } from "vitest";
import {
  buildQuizLeadEmail,
  buildQuizResultsAccessEmail,
  buildQuizUserResultsEmail,
  scoreQuizLeadHeat,
  type QuizLeadEmailModel,
  type QuizResultsAccessEmailModel,
} from "@/lib/server/quizLeadEmail";
import {
  CONTACT_CONSENT_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
} from "@/lib/quizLead";

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
    contactMethod: "text",
    contactPhone: "613-555-0199",
    preferredTimes: [
      "2026-08-03T10:30",
      "2026-08-04T14:00",
    ],
    timeZone: "America/Toronto",
    contactMessage: "Please text first.",
    intent: "brief_consultation",
    attribution: { source: "google", campaign: "ottawa-therapy" },
    resultsViewed: true,
    therapistMatchViewed: true,
    janeBookingClicked: true,
    janeCtaPlacement: "results_primary",
    contactHelpRequested: true,
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
    privacyText: RESULTS_ACCESS_PRIVACY_TEXT,
    privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
    intent: "exploring",
    attribution: { source: "google", campaign: "ottawa-therapy" },
    resultsViewed: false,
    therapistMatchViewed: false,
    janeBookingClicked: false,
    contactHelpRequested: false,
    adminUrl: "https://admin.example.com/quiz/VQ-ACCESS1234",
    ...overrides,
  };
}

describe("buildQuizResultsAccessEmail", () => {
  it("states the specific initial staff/therapist contact and sharing authorization", () => {
    const email = buildQuizResultsAccessEmail(accessModel());

    expect(email.subject).toBe(
      "[LEAD 2/10 | VERY COLD] New Quiz Results Submission — Alex",
    );
    for (const content of [email.text, email.html]) {
      expect(content).toContain("Alex");
      expect(content).toContain("alex@example.com");
      expect(content).toContain("613-555-0100");
      expect(content).toContain("Worry and tension stood out");
      expect(content).toContain("Tim Kahtava");
      expect(content).toContain("VQ-ACCESS1234");
      expect(content).toMatch(/contact and therapist sharing authorized/i);
      expect(content).toMatch(/authorized staff/i);
      expect(content).toMatch(/recommended or matched therapist/i);
      expect(content).toMatch(/by email, phone, or text/i);
      expect(content).toMatch(/quiz results, (?:the )?therapist match, consultations, scheduling/i);
      expect(content).toMatch(/share their contact details and relevant quiz summary/i);
      expect(content).toMatch(/does not authorize sale/i);
      expect(content).toMatch(/unrelated promotional marketing/i);
      expect(content).toContain("I’m just exploring right now");
      expect(content).toContain("campaign: ottawa-therapy");
      expect(content).toMatch(/outbound click is not a confirmed/i);
      expect(content).toMatch(/lead heat:\s*2\/10/i);
      expect(content).toMatch(/treat this as information gathering/i);
      expect(content).toMatch(/symptom severity.*earns no (?:lead )?points/i);
    }
  });

  it("keeps the authorization specific and does not imply unrelated outreach", () => {
    const email = buildQuizResultsAccessEmail(accessModel());
    const combined = `${email.subject}\n${email.text}\n${email.html}`;

    expect(combined).toMatch(/recommended or matched therapist to contact/i);
    expect(combined).not.toMatch(/any therapist|any purpose|any marketing/i);
    expect(combined).not.toContain(CONTACT_CONSENT_TEXT);
    expect(combined).not.toMatch(/user requested contact:\s*yes/i);
  });

  it("does not infer current therapist-contact authorization from legacy or inconsistent consent", () => {
    for (const legacy of [
      accessModel({
        privacyText: "I consent to receiving my quiz results.",
        privacyTextVersion: "2026-07-22.v1",
      }),
      accessModel({
        privacyText: "Different copy despite a current-looking version.",
        privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
      }),
    ]) {
      const email = buildQuizResultsAccessEmail(legacy);
      const combined = `${email.text}\n${email.html}`;

      expect(combined).toMatch(/legacy version; review required/i);
      expect(combined).toMatch(
        /do not infer authorization for therapist contact or disclosure/i,
      );
      expect(combined).not.toMatch(
        /contact and therapist sharing authorized/i,
      );
    }
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
      "[LEAD 9/10 | BLAZING] Booking Help Requested — Alex",
    );
  });

  it("cannot inject additional mail headers through a legacy first name", () => {
    const { subject } = buildQuizLeadEmail(
      model({ firstName: "Alex\r\nBcc: attacker@example.com" }),
    );
    expect(subject).toBe(
      "[LEAD 9/10 | BLAZING] Booking Help Requested — Alex Bcc: attacker@example.com",
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
      expect(content).toContain("explicitly asked");
      expect(content).toContain("VQ-TEST1234");
      expect(content).toContain(CONTACT_CONSENT_TEXT);
      expect(content).toContain("Preferred contact method");
      expect(content).toContain("2026-08-03T10:30");
      expect(content).toContain("2026-08-04T14:00");
      expect(content).toContain("America/Toronto");
      expect(content).toMatch(/not confirmed/i);
      expect(content).toMatch(/no appointment is booked until/i);
      expect(content).toMatch(/outbound click is not a confirmed/i);
      expect(content).toMatch(/lead heat:\s*9\/10/i);
      expect(content).toMatch(/exceptional intent/i);
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

  it("reserves 10/10 for every strongest observed booking-intent signal", () => {
    const hottest = scoreQuizLeadHeat(
      model({
        intent: "ready_to_speak",
      }),
    );
    expect(hottest).toMatchObject({
      score: 10,
      label: "SOLAR HOT",
    });
    expect(hottest.blockers).toEqual([]);
  });

  it("brutally keeps quiz-only curiosity cold and ignores symptom severity", () => {
    const cold = scoreQuizLeadHeat(
      accessModel({
        phone: undefined,
        intent: "exploring",
        resultCategory: "Severe-looking result wording that must not affect heat",
        scoreBand: "Highest symptom strain",
      }),
    );
    expect(cold).toMatchObject({
      score: 1,
      label: "ICE COLD",
      verdict: expect.stringMatching(/do not treat.*booking-ready/i),
    });
    expect(cold.blockers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/not say.*ready/i),
        expect.stringMatching(/no phone/i),
        expect.stringMatching(/no Jane booking click/i),
        expect.stringMatching(/no explicit booking-help request/i),
      ]),
    );
  });
});

describe("buildQuizUserResultsEmail", () => {
  it.each([
    ["ready_to_speak", "Request My Free Consultation"],
    ["brief_consultation", "Request a Consultation with Tim"],
    ["see_recommended_therapist", "Request a Consultation with Tim"],
    ["exploring", "Request a Free Consultation"],
  ] as const)("uses adaptive CTA copy for %s", (intent, cta) => {
    const email = buildQuizUserResultsEmail({
      referenceId: "VQ-USER123456",
      firstName: "Alex",
      resultHeading: "Worry and tension stood out",
      intent,
      recommendedTherapistSlug: "tim-kahtava",
      recommendedTherapistName: "Tim Kahtava",
      privateResultsUrl:
        "https://valisenmentalhealth.com/quiz#result=v1.VQ-USER123456.token",
    });

    expect(email.text).toContain(cta);
    expect(email.html).toContain(cta);
    expect(email.bookingUrl).toBe(
      "https://valisenmentalhealth.com/consultation?therapist=tim-kahtava&source=quiz_results_email",
    );
    expect(email.text).toContain("#result=");
    expect(email.text).toContain("does not subscribe you to promotional email");
    expect(email.text).not.toMatch(/newsletter|special offer/i);
  });

  it("falls back to the clinic consultation request without a match", () => {
    const email = buildQuizUserResultsEmail({
      referenceId: "VQ-USER123456",
      firstName: "Alex",
      resultHeading: "Your reflection",
      intent: "exploring",
      recommendedTherapistName: null,
      privateResultsUrl:
        "https://valisenmentalhealth.com/quiz#result=v1.VQ-USER123456.token",
    });
    expect(email.bookingUrl).toBe(
      "https://valisenmentalhealth.com/consultation?source=quiz_results_email",
    );
  });

  it("uses Dayong's preselected consultation request and therapist-specific CTA", () => {
    const email = buildQuizUserResultsEmail({
      referenceId: "VQ-USER123456",
      firstName: "Alex",
      resultHeading: "Your reflection",
      intent: "see_recommended_therapist",
      recommendedTherapistSlug: "dayong-quan",
      recommendedTherapistName: "Dayong Quan",
      privateResultsUrl:
        "https://valisenmentalhealth.com/quiz#result=v1.VQ-USER123456.token",
    });

    expect(email.bookingUrl).toBe(
      "https://valisenmentalhealth.com/consultation?therapist=dayong-quan&source=quiz_results_email",
    );
    for (const content of [email.text, email.html]) {
      expect(content).toContain("Request a Consultation with Dayong");
      expect(content).not.toMatch(/clinic booking page in Jane/i);
    }
  });
});
