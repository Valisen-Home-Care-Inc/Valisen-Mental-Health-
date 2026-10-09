import { createHmac, timingSafeEqual } from "node:crypto";

type Contact = { firstName: string; lastName: string; email: string; phone: string; landingConcept?: string };
const secret = () => process.env.CONSULTATION_CONTINUATION_SECRET || process.env.GOOGLE_ADS_CONVERSION_SECRET;
const fingerprint = (contact: Contact, key: string) => createHmac("sha256", key).update(JSON.stringify([
  contact.firstName.trim().replace(/\s+/g, " "), contact.lastName.trim().replace(/\s+/g, " "),
  contact.email.trim().toLowerCase(), contact.phone.replace(/\D/g, ""), contact.landingConcept || "welcome",
])).digest("hex");
export function consultationContinuationConfigured() { return Buffer.byteLength(secret() || "") >= 32; }

/** A short-lived proof of an accepted contact request, containing no contact values. */
export function createConsultationContinuation(contact: Contact, reference: string, now = Date.now()): string {
  const key = secret();
  if (!key || !consultationContinuationConfigured()) throw new Error("Continuation secret unavailable");
  const encoded = Buffer.from(JSON.stringify({ sub: "consultation-contact-v1", reference,
    fingerprint: fingerprint(contact, key), expires: now + 2 * 60 * 60 * 1000 })).toString("base64url");
  return `${encoded}.${createHmac("sha256", key).update(encoded).digest("base64url")}`;
}

export function verifyConsultationContinuation(token: unknown, contact: Contact, now = Date.now()): string | null {
  const key = secret();
  if (!key || !consultationContinuationConfigured() || typeof token !== "string" || token.length > 1000) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const expected = createHmac("sha256", key).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return value.sub === "consultation-contact-v1" && /^VC-[A-F0-9]{24}$/.test(value.reference)
      && typeof value.expires === "number" && value.expires > now && value.expires <= now + 2 * 60 * 60 * 1000
      && value.fingerprint === fingerprint(contact, key) ? value.reference : null;
  } catch { return null; }
}
