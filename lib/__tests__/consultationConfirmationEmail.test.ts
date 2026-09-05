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
      expect(body).toContain("Thank you for requesting a free consultation");
      expect(body).toContain("to arrange your consultation");
      expect(body).toContain("Prefer to book now?");
      expect(body).toContain(CLINIC_JANE_BOOKING_URL);
      expect(body).not.toContain("Your next step starts here");
      expect(body).not.toContain("VC-TEST123");
    }
    expect(email.html).toContain(`href="${CLINIC_JANE_BOOKING_URL}"`);
    expect(email.html).toContain("View availability on Jane");
    expect(email.html).not.toMatch(/<script|utm_|gclid|janeapp\.com\/\?/i);
    expect(email.text.split(/\s+/).length).toBeLessThan(65);
  });

  it("escapes dynamic content without changing the plain-text greeting", () => {
    const email = buildConsultationConfirmationEmail({
      firstName: '<img src=x onerror="alert(1)"> & Alex',
      referenceId: "VC-<test>",
    });
    expect(email.html.match(/<img\b/g)).toHaveLength(1);
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("&amp; Alex");
    expect(email.html).not.toContain("VC-");
    expect(email.text).toContain('Hello <img src=x onerror="alert(1)"> & Alex,');
  });

  it("uses the clinic logo and larger text without adding more copy", () => {
    const email = buildConsultationConfirmationEmail({ firstName: "Alex", referenceId: "VC-TEST123" });
    expect(email.html).toContain('src="https://valisenmentalhealth.com/valisen-logo.png"');
    expect(email.html).toContain('alt="Valisen Mental Health"');
    expect(email.html).toContain('width="240"');
    expect(email.html).toContain("max-width:100%;height:auto");
    expect(email.html).toContain("font-size:18px;line-height:29px");
    expect(email.html).toContain('role="presentation"');
    const visibleCopy = email.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    expect(visibleCopy).toBe(email.text.replace(CLINIC_JANE_BOOKING_URL, "").replace("Jane:", "Jane").replace(/\s+/g, " ").trim());
  });
});
