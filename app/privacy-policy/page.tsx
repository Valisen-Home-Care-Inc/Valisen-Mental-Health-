import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Valisen Mental Health",
  description:
    "Valisen Mental Health's Privacy Policy. How we collect, use, protect and disclose your personal health information under PIPEDA and PHIPA (Ontario).",
  alternates: { canonical: "https://valisenmentalhealth.com/privacy-policy" },
};

const EFFECTIVE_DATE = "July 26, 2026";
const LAST_UPDATED = "July 26, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main>
      <NavBar />
      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v max-w-[760px]">
          <span className="badge-outline-teal mb-6">LEGAL</span>
          <h1 className="font-serif text-[38px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-[13px] text-ink-secondary">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {LAST_UPDATED}
          </p>

          <div className="prose-valisen mt-10 space-y-10 text-[15px] leading-[1.75] text-ink-secondary">

            <Section title="1. Who We Are">
              <p>
                Valisen Mental Health (&ldquo;Valisen&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;,
                or &ldquo;us&rdquo;) is a therapy clinic based in Ottawa, Ontario, Canada,
                operating at{" "}
                <a href="https://valisenmentalhealth.ca" className="text-teal hover:underline">
                  valisenmentalhealth.ca
                </a>
                . Our Registered Psychotherapists and Registered Social Workers provide virtual therapy services directly to clients across Ontario.
              </p>
              <p>
                Questions about this policy? Contact our Privacy Officer at{" "}
                <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                  info@valisenmentalhealth.com
                </a>{" "}
                or by phone at{" "}
                <a href="tel:613-707-0333" className="text-teal hover:underline">
                  613-707-0333
                </a>
                .
              </p>
            </Section>

            <Section title="2. Legislation That Governs Us">
              <p>
                As a therapy clinic operating in Ontario, we comply with the following legislation:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>
                  <strong className="text-ink">Personal Health Information Protection Act (PHIPA)</strong>{" "}
                  — Ontario legislation governing the collection, use, and disclosure of personal
                  health information.
                </li>
                <li>
                  <strong className="text-ink">Personal Information Protection and Electronic Documents Act (PIPEDA)</strong>{" "}
                  — Federal legislation governing personal information in the course of commercial
                  activity.
                </li>
                <li>
                  <strong className="text-ink">Regulated Health Professions Act (RHPA), 1991</strong>{" "}
                  — Governs the professional obligations of the Registered Psychotherapists and
                  Registered Social Workers in our network.
                </li>
              </ul>
            </Section>

            <Section title="3. What Information We Collect">
              <p>We collect the following categories of personal information:</p>
              <h4 className="mt-4 font-semibold text-ink">a) Information you provide directly</h4>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  Name, email address, and phone number on the quiz results-access form; plus any
                  contact preferences you separately provide when asking for booking help
                </li>
                <li>
                  Name, email address, phone number, therapy type, preferred therapist,
                  broad weekly availability, optional message, referral source, and the exact
                  consent record when you request a free consultation
                </li>
                <li>Reason for seeking therapy and general mental health concerns</li>
                <li>
                  Answers you choose to submit through our educational self-reflection quiz,
                  together with the result category and therapist recommendation generated from
                  those answers. Your raw safety-check answer is never sent to or stored by
                  Valisen or our analytics providers. To preserve the appropriate safety message
                  if you restore a result during the same browser session, only a derived{" "}
                  <code>safetyFlagged</code> true/false value may be retained temporarily in{" "}
                  <code>sessionStorage</code> on your device.
                  When you continue directly from a quiz result to a consultation request, the
                  first name, email address, and phone number you already provided may also be
                  placed briefly in same-tab <code>sessionStorage</code> to prefill that form. The
                  consultation form consumes and removes this one-time handoff, and the details
                  are never placed in its URL or analytics events.
                </li>
                <li>
                  Records of privacy acknowledgements and optional scheduling-help requests,
                  including your chosen contact method, proposed consultation dates and times,
                  time zone, optional message, consent wording, and the date and time of the
                  action
                </li>
                <li>
                  Privacy-limited funnel events, such as the page or quiz question reached,
                  consultation CTA clicks, form step reached, results views, and secondary Jane
                  link clicks. These events do not contain quiz answers, contact details, concern
                  categories, scores, or free-text messages
                </li>
                <li>Insurance provider information (if applicable)</li>
                <li>Communication preferences</li>
              </ul>
              <h4 className="mt-4 font-semibold text-ink">b) Clinical information</h4>
              <p className="mt-2">
                Session notes and treatment records are maintained exclusively by your
                therapist. Valisen does not hold, access, or store clinical
                records. Any clinical information you share is used solely to facilitate your
                care and is not retained beyond that purpose. Quiz answers and generated quiz
                results are administrative lead records, not clinical records or a diagnosis.
              </p>
              <h4 className="mt-4 font-semibold text-ink">c) Technical information</h4>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>IP address, browser type, and pages visited on our website (analytics)</li>
                <li>Cookies (see Section 9)</li>
              </ul>
            </Section>

            <Section title="4. How We Use Your Information">
              <p>We use your personal information only for the purposes for which it was collected:</p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>To facilitate and support your therapy care</li>
                <li>To schedule and facilitate therapy services</li>
                <li>To communicate with you about your care</li>
                <li>
                  To save and display quiz results, generate a therapist recommendation, email the
                  requested results and matched consultation next step to you, generate a private
                  results PDF when you request one, contact you by email, phone, or text about
                  your result, therapist match, consultations, scheduling, and related therapy
                  services, share your contact details and relevant quiz summary with the
                  recommended therapist for those purposes, and send an administrative summary
                  to Valisen&apos;s authorized internal inbox
                </li>
                <li>To issue receipts for insurance claims where applicable</li>
                <li>To comply with our legal and professional obligations</li>
                <li>To improve our platform&apos;s services (in aggregate, de-identified form only)</li>
              </ul>
              <p className="mt-3">
                We do <strong className="text-ink">not</strong> sell your information, use it for
                unrelated advertising, or use it for purposes outside the consent presented when
                you submit the form.
              </p>
              <p className="mt-3">
                Receiving your requested quiz results does not enrol you in promotional or
                marketing email campaigns.
              </p>
            </Section>

            <Section title="5. Consent">
              <p>
                We obtain your consent before collecting personal information. By submitting our
                intake or consultation-request form, you consent to the collection and use of
                your information as described in this policy.
              </p>
              <p className="mt-3">
                The quiz results-access form requires an unchecked acknowledgement before the quiz
                submission is saved and results are displayed and emailed to you. That
                acknowledgement authorizes Valisen and the recommended therapist to contact you
                by email, phone, or text about your quiz result, therapist match, consultations,
                scheduling, and related therapy services. It also authorizes Valisen to share your
                contact details and relevant quiz summary with that therapist for those stated
                purposes. It does not authorize sale of your information or enrolment in unrelated
                promotional marketing.
              </p>
              <p className="mt-3">
                When the results-access form is submitted, an administrative copy of the result
                summary is delivered to Valisen&apos;s authorized internal inbox for secure record
                handling. The stored administrative record captures the exact acknowledgement and
                its version. The email identifies the authorization status and version, and flags
                legacy or inconsistent wording for staff review before contact or sharing.
              </p>
              <p className="mt-3">
                The optional scheduling-help form is a separate request to review two to four
                proposed consultation times. Its checkbox confirms that the times are preferences,
                not a booked appointment. Valisen or the therapist must still confirm a time before
                an appointment exists.
              </p>
              <p className="mt-3">
                You may withdraw consent at any time by contacting us at{" "}
                <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                  info@valisenmentalhealth.com
                </a>
                . Withdrawal of consent may affect our ability to provide services. We will
                advise you of the implications before acting on your withdrawal.
              </p>
              <p className="mt-3">
                Implied consent applies in limited circumstances where the purpose of collection
                is obvious (e.g., providing your phone number when requesting a callback).
              </p>
            </Section>

            <Section title="6. Disclosure of Personal Information">
              <p>
                We do <strong className="text-ink">not</strong> sell, rent, or trade your
                personal information. We may share it only in the following circumstances:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>
                  <strong className="text-ink">Service providers:</strong> Trusted third-party
                  vendors (e.g., secure form processing, email delivery, Cloudflare Turnstile bot
                  verification, and access-controlled spreadsheet storage) who are contractually
                  bound to protect your information and use it only to provide services to us.
                </li>
                <li>
                  <strong className="text-ink">Insurance providers:</strong> With your explicit
                  consent, to facilitate reimbursement claims.
                </li>
                <li>
                  <strong className="text-ink">Recommended therapist:</strong> Only after you
                  submit the results-access acknowledgement authorizing Valisen to share your
                  contact details and relevant quiz summary, and only for result, matching,
                  consultation, scheduling, and related therapy-service follow-up. If you submit
                  proposed times through scheduling help, those preferences may also be shared to
                  coordinate a possible appointment.
                </li>
                <li>
                  <strong className="text-ink">Legal requirements:</strong> When required by law,
                  court order, or regulatory body.
                </li>
                <li>
                  <strong className="text-ink">Safety:</strong> Where there is an immediate risk
                  of serious harm to you or another person, as required under PHIPA and our
                  professional obligations.
                </li>
              </ul>
            </Section>

            <Section title="7. Retention of Records">
              <p>
                Valisen retains administrative intake and quiz lead records (name, contact
                information, insurance details when applicable, submitted quiz data, matching
                information, administrative engagement timestamps, proposed scheduling times and
                time zone, booking-help preferences, and consent records) for a minimum of{" "}
                <strong className="text-ink">7 years</strong> for tax and regulatory purposes.
              </p>
              <p className="mt-3">
                Clinical records — including session notes, treatment plans, and progress records
                — are held exclusively by your assigned therapist in accordance with their
                regulatory college&apos;s standards (CRPO for Registered Psychotherapists, OCSWSSW for
                Registered Social Workers), which require retention for a minimum of{" "}
                <strong className="text-ink">10 years</strong> from the date of last service, or
                until a minor client turns 18 plus 10 years, whichever is longer. For questions
                about your clinical records, contact your therapist directly.
              </p>
            </Section>

            <Section title="8. Safeguards">
              <p>
                We protect your personal information using appropriate physical, administrative,
                and technical safeguards, including:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>Encrypted data transmission (TLS/HTTPS) for all web communications</li>
                <li>Secure, access-controlled systems</li>
                <li>Role-based access so only authorized administrative staff can view intake records</li>
                <li>Cloudflare Turnstile verification, server-side validation, honeypots, origin checks, payload limits, and rate limits on consultation submissions</li>
                <li>Confidentiality agreements with all staff and contractors</li>
              </ul>
            </Section>

            <Section title="9. Cookies and Website Analytics">
              <p>
                Our website uses cookies and similar technologies to improve user experience and
                analyse traffic. We use:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>
                  <strong className="text-ink">Essential browser storage:</strong> Necessary for
                  functions such as restoring a private quiz result and maintaining a random,
                  per-tab funnel session during the browser session.
                  This can include the private result capability and the derived{" "}
                  <code>safetyFlagged</code> true/false value on your device; it does not include
                  your raw safety-check answer.
                </li>
                <li>
                  <strong className="text-ink">Therapist finder:</strong> Choices made in the short
                  homepage or directory finder stay in the current page only. They are not placed
                  in the page URL, saved to browser storage, or sent in advertising analytics
                  events.
                </li>
                <li>
                  <strong className="text-ink">First-touch attribution:</strong> Standard UTM
                  campaign fields may be retained in session storage to understand the non-clinical
                  source of a visit. UTM terms remain first-party and are not copied into analytics
                  events because a term could contain health-related wording.
                </li>
                <li>
                  <strong className="text-ink">Analytics cookies:</strong> We may use
                  privacy-respecting analytics to understand how visitors use our website. Quiz
                  scores, finder choices, therapist recommendations, concern categories, written
                  responses, safety answers, names, email addresses, and phone numbers are not
                  sent in quiz or therapist-finder analytics events.
                </li>
                <li>
                  <strong className="text-ink">First-party funnel measurement:</strong> A random
                  session identifier and sequence number let us update a session summary and an
                  event log in our access-controlled Google Sheet. This shows the last page, quiz
                  question, or consultation step reached and whether a consultation CTA or
                  secondary Jane link was clicked. The event endpoint rejects contact information,
                  quiz answers, scores, safety answers, and written messages.
                </li>
              </ul>
              <p className="mt-3">
                You may disable cookies in your browser settings, though this may affect
                functionality.
              </p>
            </Section>

            <Section title="10. Your Rights Under PHIPA and PIPEDA">
              <p>You have the right to:</p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>
                  <strong className="text-ink">Access</strong> your personal information held
                  by us
                </li>
                <li>
                  <strong className="text-ink">Request correction</strong> of inaccurate
                  information
                </li>
                <li>
                  <strong className="text-ink">Know</strong> what information we hold about you
                  and how it has been used or disclosed
                </li>
                <li>
                  <strong className="text-ink">Complain</strong> to the Information and Privacy
                  Commissioner of Ontario (IPC) if you believe your privacy rights have been
                  violated
                </li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                  info@valisenmentalhealth.com
                </a>
                . We will respond within 30 days.
              </p>
            </Section>

            <Section title="11. Mandatory Reporting Obligations">
              <p>
                The Registered Psychotherapists and Registered Social Workers in our network are
                subject to mandatory reporting obligations under Ontario law, including:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>
                  Reporting suspected child abuse or neglect to the Children&apos;s Aid Society
                  under the <em>Child, Youth and Family Services Act, 2017</em>
                </li>
                <li>
                  Disclosing information where there is imminent risk of serious bodily harm to a
                  person
                </li>
                <li>
                  Reporting sexual abuse by a health professional under RHPA requirements
                </li>
              </ul>
              <p className="mt-3">
                These disclosures do not require your consent and are required by law.
              </p>
            </Section>

            <Section title="12. Virtual Sessions">
              <p>
                Virtual therapy sessions are conducted via secure, encrypted video platforms used
                by your assigned therapist. We use only platforms that comply with Canadian
                privacy law. Recordings of sessions are not made without your explicit written
                consent.
              </p>
            </Section>

            <Section title="13. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Material changes will be
                communicated to active clients via email. The &ldquo;Last updated&rdquo; date at
                the top of this page reflects the most recent revision. Continued use of our
                services after changes constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section title="14. Contact Us and Complaints">
              <p>
                <strong className="text-ink">Privacy Officer</strong>
                <br />
                Valisen Mental Health
                <br />
                Ottawa, Ontario, Canada
                <br />
                Email:{" "}
                <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                  info@valisenmentalhealth.com
                </a>
                <br />
                Phone:{" "}
                <a href="tel:613-707-0333" className="text-teal hover:underline">
                  613-707-0333
                </a>
              </p>
              <p className="mt-4">
                If you are not satisfied with our response, you may contact the{" "}
                <strong className="text-ink">
                  Information and Privacy Commissioner of Ontario (IPC)
                </strong>
                :
              </p>
              <p className="mt-2">
                2 Bloor Street East, Suite 1400
                <br />
                Toronto, Ontario M4W 1A8
                <br />
                Phone: 1-800-387-0073
                <br />
                Website:{" "}
                <a
                  href="https://www.ipc.on.ca"
                  className="text-teal hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.ipc.on.ca
                </a>
              </p>
            </Section>

          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 font-serif text-[22px] font-medium text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

