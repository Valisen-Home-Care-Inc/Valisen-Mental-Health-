import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { sendMail, createTransport, close } = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
import { buildReferralEmail, sendReferralEmail } from "@/lib/server/referralEmail";
import { EMPTY_REFERRAL } from "@/lib/referrals";
import { resetRateLimitState } from "@/lib/server/rateLimit";
import { GET } from "@/app/referrals/guide/route";
import { PDFDocument } from "pdf-lib";

const fields = { ...EMPTY_REFERRAL, providerEmail: "provider@example.invalid", patientName: "Test Patient", patientPhone: "6135550100", consent: true };
beforeEach(() => {
  resetRateLimitState();
  vi.stubEnv("GMAIL_USER", "clinic@example.invalid");
  vi.stubEnv("GMAIL_APP_PASSWORD", "test-only");
  createTransport.mockReset().mockReturnValue({ sendMail, close });
  sendMail.mockReset().mockResolvedValue({ accepted: ["info@valisenmentalhealth.com"] });
  close.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("sends an unmistakable patient referral to the fixed clinic mailbox, without PHI in its subject", async () => {
  await sendReferralEmail(fields, "test-1");
  const email = sendMail.mock.calls[0][0];
  expect(email.to).toBe("info@valisenmentalhealth.com");
  expect(email.subject).toBe("PATIENT REFERRAL | Healthcare Provider | VR-test-1");
  expect(email.subject).not.toContain(fields.patientName);
  expect(email.replyTo).toBe(fields.providerEmail);
  expect(email.text).toContain(fields.patientName);
  expect(email.text).toContain(fields.patientPhone);
  expect(createTransport.mock.calls[0][0]).toMatchObject({ requireTLS: true, logger: false, debug: false });
});
it("deduplicates simultaneous requests and completed retries within an instance", async () => {
  await Promise.all([sendReferralEmail(fields, "test-2"), sendReferralEmail(fields, "test-2")]);
  await sendReferralEmail(fields, "test-2");
  expect(sendMail).toHaveBeenCalledOnce();
});
it("does not acknowledge a rejected email and permits a retry", async () => {
  sendMail.mockResolvedValueOnce({ accepted: [], rejected: ["info@valisenmentalhealth.com"] });
  await expect(sendReferralEmail(fields, "test-3")).rejects.toThrow();
  await expect(sendReferralEmail(fields, "test-3")).resolves.toBeUndefined();
  expect(sendMail).toHaveBeenCalledTimes(2);
});
it("fails without email credentials and does not create a transport", async () => {
  vi.stubEnv("GMAIL_APP_PASSWORD", "");
  await expect(sendReferralEmail(fields, "test-4")).rejects.toThrow();
  expect(createTransport).not.toHaveBeenCalled();
});
it("uses plain text rather than interpreting provider-supplied HTML", () => {
  const message = buildReferralEmail({ ...fields, notes: "<script>sample</script>" }, "test-5");
  expect(message).not.toHaveProperty("html");
  expect(message.text).toContain("<script>sample</script>");
});
it("serves a real downloadable referral guide", async () => {
  const response = await GET();
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  expect(pdf.getTitle()).toContain("Healthcare Provider Referral Guide");
});
