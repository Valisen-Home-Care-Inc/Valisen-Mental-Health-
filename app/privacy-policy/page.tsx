import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Valisen Mental Health",
  description:
    "Valisen Mental Health's Privacy Policy. How we collect, use, protect and disclose your personal health information under PIPEDA and PHIPA (Ontario).",
  alternates: { canonical: "https://valisenmentalhealth.com/privacy-policy" },
};

const EFFECTIVE_DATE = "May 9, 2026";

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
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {EFFECTIVE_DATE}
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
                  — Governs the professional obligations of the Registered Psychotherapists in our
                  network.
                </li>
              </ul>
            </Section>

            <Section title="3. What Information We Collect">
              <p>We collect the following categories of personal information:</p>
              <h4 className="mt-4 font-semibold text-ink">a) Information you provide directly</h4>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>Name, phone number, and email address (intake form)</li>
                <li>Reason for seeking therapy and general mental health concerns</li>
                <li>Insurance provider information (if applicable)</li>
                <li>Communication preferences</li>
              </ul>
              <h4 className="mt-4 font-semibold text-ink">b) Clinical information</h4>
              <p className="mt-2">
                Session notes and treatment records are maintained exclusively by your
                Registered Psychotherapist. Valisen does not hold, access, or store clinical
                records. Any clinical information you share is used solely to facilitate your
                care and is not retained beyond that purpose.
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
                <li>To issue receipts for insurance claims where applicable</li>
                <li>To comply with our legal and professional obligations</li>
                <li>To improve our platform&apos;s services (in aggregate, de-identified form only)</li>
              </ul>
              <p className="mt-3">
                We do <strong className="text-ink">not</strong> use your information for
                advertising, sell it to third parties, or use it for any purpose unrelated to
                your care without your express consent.
              </p>
            </Section>

            <Section title="5. Consent">
              <p>
                We obtain your consent before collecting personal information. By submitting our
                intake form, you consent to the collection and use of your information as
                described in this policy.
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
                  vendors (e.g., secure form processing, email delivery) who are contractually bound
                  to protect your information and use it only to provide services to us.
                </li>
                <li>
                  <strong className="text-ink">Insurance providers:</strong> With your explicit
                  consent, to facilitate reimbursement claims.
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
                Valisen retains administrative intake records (name, contact information,
                insurance details, and matching information) for a minimum of{" "}
                <strong className="text-ink">7 years</strong> for tax and regulatory purposes.
              </p>
              <p className="mt-3">
                Clinical records — including session notes, treatment plans, and progress records
                — are held exclusively by your assigned Registered Psychotherapist in accordance
                with CRPO standards, which require retention for a minimum of{" "}
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
                  <strong className="text-ink">Essential cookies:</strong> Necessary for the
                  website to function (e.g., form submission state).
                </li>
                <li>
                  <strong className="text-ink">Analytics cookies:</strong> We may use
                  privacy-respecting analytics to understand how visitors use our website. No
                  personally identifiable information is collected through analytics.
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
                The Registered Psychotherapists in our network are subject to mandatory reporting
                obligations under Ontario law, including:
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

