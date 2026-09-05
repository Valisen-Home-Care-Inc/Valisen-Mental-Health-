import { describe, expect, it } from "vitest";
import { buildConsultationConfirmationEmail } from "@/lib/server/consultationConfirmationEmail";
import { CLINIC_JANE_BOOKING_URL } from "@/lib/therapists";

describe("welcome consultation confirmation email", () => {
  it("includes the receipt, 24-hour follow-up and direct Jane link in both formats", () => {
    const email = buildConsultationConfirmationEmail({
      firstName: "Alex",
      referenceId: "VC-TEST123",
    });
    expect(email.subject).toBe("We've received your consultation request | Valisen");
    for (const body of [email.text, email.html]) {
      expect(body).toContain("Hello Alex,");
      expect(body).toContain("within 24 hours");
      expect(body).toContain("not a confirmed appointment");
      expect(body).toContain(CLINIC_JANE_BOOKING_URL);
      expect(body).toContain("VC-TEST123");
      expect(body).toContain("613-707-0333");
      expect(body).toContain("does not subscribe you to promotional emails");
    }
    expect(email.html).toContain(`href="${CLINIC_JANE_BOOKING_URL}"`);
    expect(email.html).toContain("View availability on Jane");
    expect(email.html).not.toMatch(/<img|<script|utm_|gclid|janeapp\.com\/\?/i);
  });

  it("escapes dynamic content without changing the plain-text greeting", () => {
    const email = buildConsultationConfirmationEmail({
      firstName: '<img src=x onerror="alert(1)"> & Alex',
      referenceId: "VC-<test>",
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("&amp; Alex");
    expect(email.html).toContain("VC-&lt;test&gt;");
    expect(email.text).toContain('Hello <img src=x onerror="alert(1)"> & Alex,');
  });
});
