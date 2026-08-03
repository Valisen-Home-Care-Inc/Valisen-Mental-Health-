import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/submit-intake/route";

const consentLanguage =
  "I consent to Valisen Mental Health using the name, email address, and phone number I have provided to contact me regarding my consultation request and to coordinate a consultation within my preferred availability.";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: "11111111-1111-4111-8111-111111111111",
    formStartedAt: Date.now() - 5_000,
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    reason: "Individual Therapy",
    preferredTherapist: "flexible",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    timeOfDay: "morning",
    consent: true,
    consentLanguage,
    consentVersion: "consultation-coordination-v1",
    source: "test",
    website: "",
    turnstileToken: "test-token",
    ...overrides,
  };
}

function request(body: unknown, origin = "https://valisenmentalhealth.com") {
  return new NextRequest("https://valisenmentalhealth.com/api/submit-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

describe("consultation submission boundary", () => {
  it("rejects cross-origin requests before processing a form", async () => {
    const response = await POST(request(payload(), "https://attacker.example"));
    expect(response.status).toBe(403);
  });

  it("rejects unknown payload fields", async () => {
    const response = await POST(request(payload({ admin: true })));
    expect(response.status).toBe(400);
  });

  it("silently accepts a filled honeypot without external side effects", async () => {
    const response = await POST(request(payload({ website: "spam.example" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("requires the exact, versioned consultation consent", async () => {
    const response = await POST(request(payload({ consentLanguage: "I agree" })));
    expect(response.status).toBe(400);
  });
});
