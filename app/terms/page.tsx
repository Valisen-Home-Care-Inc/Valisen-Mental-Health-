import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — Valisen Mental Health",
  description:
    "Terms of Service for Valisen Mental Health. Read our conditions of use, client obligations, and liability terms applicable in Ontario, Canada.",
  alternates: { canonical: "https://valisenmentalhealth.com/terms" },
};

const EFFECTIVE_DATE = "May 9, 2026";

export default function TermsPage() {
  return (
    <main>
      <NavBar />
      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v max-w-[760px]">
          <span className="badge-outline-teal mb-6">LEGAL</span>
          <h1 className="font-serif text-[38px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-[13px] text-ink-secondary">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {EFFECTIVE_DATE}
          </p>

          <div className="mt-10 space-y-10 text-[15px] leading-[1.75] text-ink-secondary">

            <Section title="1. About These Terms">
              <p>
                These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the website
                located at{" "}
                <a href="https://valisenmentalhealth.com" className="text-teal hover:underline">
                  valisenmentalhealth.com
                </a>{" "}
                and any services provided by Valisen Mental Health (&ldquo;Valisen&rdquo;,
                &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), a mental health
                clinic based in Ottawa, Ontario, Canada.
              </p>
              <p>
                By accessing our website or using our services, you agree to be bound by these
                Terms. If you do not agree, please do not use our services.
              </p>
            </Section>

            <Section title="2. Nature of Services">
              <p>
                Valisen Mental Health connects clients with Registered Psychotherapists (RP) and
                Registered Social Workers (RSW) for individual and couples therapy. Services are
                available virtually for residents anywhere in Ontario.
              </p>
              <p>
                Valisen is <strong className="text-ink">not</strong> an emergency mental health
                service. In the event of a mental health emergency or crisis, please call{" "}
                <strong className="text-ink">988</strong> (Suicide Crisis Helpline), the Ottawa
                crisis line at{" "}
                <a href="tel:613-722-6914" className="text-teal hover:underline">
                  613-722-6914
                </a>
                , or{" "}
                <strong className="text-ink">911</strong>.
              </p>
              <p>
                Nothing on this website constitutes medical advice, diagnosis, or treatment.
                Information provided is for general informational purposes only.
              </p>
            </Section>

            <Section title="3. Eligibility">
              <p>
                You must be at least 18 years of age to submit an intake form or enter into a
                therapeutic agreement independently. Clients under 18 may access services with
                the written consent of a parent or legal guardian, subject to the therapist&apos;s
                clinical judgment and applicable Ontario law.
              </p>
              <p>
                Services are available to residents of Ontario, Canada. Virtual services may be
                subject to additional jurisdictional requirements.
              </p>
            </Section>

            <Section title="4. Booking and Intake">
              <p>
                Submitting an intake form does not guarantee placement or constitute a therapeutic
                agreement. We will contact you within one business day to discuss availability and
                confirm your match.
              </p>
              <p>
                You agree to provide accurate and complete information in your intake form. Providing
                false or misleading information may result in termination of services.
              </p>
            </Section>

            <Section title="5. Cancellation and No-Show Policy">
              <p>
                You are required to provide at least{" "}
                <strong className="text-ink">48 hours notice</strong> for cancellations or
                rescheduling. Cancellations with less than 48 hours notice may be subject to a
                late cancellation fee, which will be communicated to you by your therapist or
                our administrative team at the time of scheduling.
              </p>
              <p>
                No-shows without any notice may be charged the full session fee. Repeated
                cancellations or no-shows may result in discharge from services.
              </p>
            </Section>

            <Section title="6. Fees and Receipts">
              <p>
                Session fees vary by therapist and service type. Your fee will be clearly
                communicated before your first session.
              </p>
              <p>
                We provide receipts suitable for insurance reimbursement purposes. Valisen does not
                provide direct billing to insurers; clients submit receipts directly to their provider.
              </p>
              <p>
                Fees are subject to change. You will be notified of any changes with reasonable
                notice before they take effect.
              </p>
            </Section>

            <Section title="7. Insurance">
              <p>
                We make reasonable efforts to indicate which extended health plans commonly cover
                our services. However, coverage depends entirely on your individual plan. We
                make no guarantee that your insurer will reimburse your sessions. You are
                responsible for verifying your own coverage.
              </p>
            </Section>

            <Section title="8. Confidentiality">
              <p>
                All personal health information shared in the context of therapy is kept strictly
                confidential in accordance with our Privacy Policy and applicable Ontario law,
                including the Personal Health Information Protection Act (PHIPA).
              </p>
              <p>
                Exceptions to confidentiality exist in limited circumstances required by law.
                These are detailed in our{" "}
                <a href="/privacy-policy" className="text-teal hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </Section>

            <Section title="9. Therapeutic Relationship">
              <p>
                Therapy is a professional relationship with defined boundaries. Clients are
                expected to treat Valisen staff and therapists with respect. Threatening,
                harassing, or abusive behaviour toward any team member is grounds for immediate
                termination of services.
              </p>
              <p>
                Therapists retain the right to terminate the therapeutic relationship at any time
                for clinical or professional reasons, with appropriate notice and referral where
                possible.
              </p>
            </Section>

            <Section title="10. Website Use">
              <p>You agree not to:</p>
              <ul className="ml-5 mt-3 list-disc space-y-1">
                <li>Use our website for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any part of our systems</li>
                <li>Interfere with the operation of our website</li>
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Reproduce or distribute our content without prior written consent</li>
              </ul>
            </Section>

            <Section title="11. Intellectual Property">
              <p>
                All content on this website — including text, graphics, logos, and design — is
                the property of Valisen Mental Health and is protected by applicable Canadian
                intellectual property law. You may not reproduce, distribute, or create
                derivative works without our express written consent.
              </p>
            </Section>

            <Section title="12. Disclaimer of Warranties">
              <p>
                Our website and its content are provided &ldquo;as is&rdquo; without warranties
                of any kind, express or implied. We do not warrant that our website will be
                uninterrupted, error-free, or free of viruses.
              </p>
              <p>
                Clinical outcomes cannot be guaranteed. Therapy may not be appropriate for all
                individuals, and therapeutic results vary.
              </p>
            </Section>

            <Section title="13. Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable Ontario and Canadian law, Valisen
                Mental Health shall not be liable for any indirect, incidental, consequential, or
                punitive damages arising from your use of our services or website.
              </p>
              <p>
                Our total liability for any claim arising from our services shall not exceed the
                amount charged for services in the three months preceding the event giving rise to the
                claim.
              </p>
            </Section>

            <Section title="14. Governing Law">
              <p>
                These Terms are governed by and construed in accordance with the laws of the
                Province of Ontario and the federal laws of Canada applicable therein. Any
                dispute arising from these Terms shall be subject to the exclusive jurisdiction
                of the courts of Ontario.
              </p>
            </Section>

            <Section title="15. Changes to These Terms">
              <p>
                We reserve the right to update these Terms at any time. Material changes will
                be communicated to active clients via email. Continued use of our services after
                changes constitutes acceptance of the updated Terms. The effective date at the
                top of this page indicates the most recent revision.
              </p>
            </Section>

            <Section title="16. Contact">
              <p>
                Questions about these Terms? Contact us at:
                <br />
                <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                  info@valisenmentalhealth.com
                </a>
                {" "}·{" "}
                <a href="tel:613-707-0333" className="text-teal hover:underline">
                  613-707-0333
                </a>
                <br />
                Valisen Mental Health, Ottawa, Ontario, Canada
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

