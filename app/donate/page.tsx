import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Lock, Plus } from "lucide-react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import DonationForm from "@/components/donate/DonationForm";
import { DonatePageViewed } from "@/components/donate/DonatePageAnalytics";
import { DONATION_FACTS } from "@/lib/donations/facts";
import {
  CUSTOM_DONATION_MAX_DOLLARS,
  CUSTOM_DONATION_MIN_DOLLARS,
  DONATION_PRESETS,
  FULL_SESSION_EQUIVALENT_DOLLARS,
  formatDonationDollars,
} from "@/lib/donations/contract";
import {
  DONATION_CONTACT_EMAIL,
  PROGRAM_POLICY,
} from "@/lib/donations/program";
import { MATCHING_FORM_URL } from "@/lib/intake";
import { isStripeCheckoutConfigured } from "@/lib/server/stripe";
import {
  CONSULTATION_DURATION_MINUTES,
  THERAPY_SESSION_DURATION_MINUTES,
  THERAPY_SESSION_PRICE_MAXIMUM,
  THERAPY_SESSION_PRICE_MINIMUM,
  getActiveTherapists,
} from "@/lib/therapists";
import styles from "./donate.module.css";

const PAGE_URL = "https://valisenmentalhealth.com/donate";
const TITLE = "Help Fund a Therapy Session";
const DESCRIPTION =
  "Contribute to Valisen Mental Health's subsidy fund, which lowers psychotherapy session fees for people in Ontario facing financial barriers. Secure one-time payment in CAD.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: PAGE_URL,
    siteName: "Valisen Mental Health",
    title: "Everyone deserves someone to talk to. Help fund a therapy session.",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Everyone deserves someone to talk to. Help fund a therapy session.",
    description: DESCRIPTION,
  },
};

// Static for fast mobile loads; re-checks Stripe availability every 5 minutes.
export const revalidate = 300;

const PRICE_RANGE = `$${THERAPY_SESSION_PRICE_MINIMUM}–$${THERAPY_SESSION_PRICE_MAXIMUM}`;

const FAQS: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: "Where does my contribution go?",
    answer: (
      <>
        {PROGRAM_POLICY.purposeShort} {PROGRAM_POLICY.unassignedFunds}{" "}
        {PROGRAM_POLICY.processingFees}
      </>
    ),
  },
  {
    question: "How does Valisen decide who receives subsidized care?",
    answer: (
      <>
        {PROGRAM_POLICY.eligibility} Details about the people who receive
        support are kept confidential.
      </>
    ),
  },
  {
    question: "Can I contribute any amount?",
    answer: (
      <>
        Yes, within ${CUSTOM_DONATION_MIN_DOLLARS} and $
        {CUSTOM_DONATION_MAX_DOLLARS.toLocaleString("en-CA")} per online
        payment, in whole Canadian dollars. Choose one of the suggested
        amounts or enter your own. For a larger contribution, email{" "}
        <a href={`mailto:${DONATION_CONTACT_EMAIL}`}>{DONATION_CONTACT_EMAIL}</a>.
      </>
    ),
  },
  {
    question: "Is my payment secure?",
    answer:
      "Yes. Payment happens on Stripe's secure checkout page. Your card details go directly to Stripe and are never seen or stored by Valisen.",
  },
  {
    question: "Will I receive confirmation of my payment?",
    answer:
      "Yes. After a successful payment you'll see a confirmation page, and a payment confirmation is emailed to the address you enter at checkout.",
  },
  {
    question: "Is my contribution tax-deductible?",
    answer: PROGRAM_POLICY.taxStatus,
  },
  {
    question: "How do I request a refund or get help with a payment?",
    answer: (
      <>
        {PROGRAM_POLICY.refunds} For any other question, email{" "}
        <a href={`mailto:${DONATION_CONTACT_EMAIL}`}>{DONATION_CONTACT_EMAIL}</a>.
      </>
    ),
  },
];

function TeamFaces({ size = 42 }: { size?: number }) {
  const team = getActiveTherapists().filter((therapist) => therapist.photo);
  return (
    <span className={styles.faces} aria-hidden="true">
      {team.map((therapist) => (
        <Image
          key={therapist.slug}
          src={therapist.photo as string}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          style={therapist.photoPosition ? { objectPosition: therapist.photoPosition } : undefined}
        />
      ))}
    </span>
  );
}

export default function DonatePage() {
  const available = isStripeCheckoutConfigured();
  const team = getActiveTherapists();

  return (
    <div className={styles.page}>
      <DonatePageViewed />
      <NavBar />

      <main>
        {/* A — Hero with the contribution form */}
        <section className={styles.hero} aria-labelledby="donate-heading">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Help fund a therapy session</p>
              <h1 id="donate-heading" className={styles.heroTitle}>
                Everyone deserves someone to talk to.
                <span>Not everyone can afford it.</span>
              </h1>
              <p className={styles.heroText}>
                Between rent, groceries and everything else, therapy is often the
                first thing people put off. Your contribution goes into
                Valisen&apos;s subsidy fund, which lowers session fees for people
                who need support but can&apos;t cover the full cost.
              </p>
              <div className={styles.heroActions}>
                <a href="#contribute" className={styles.primaryButton}>
                  Help fund a therapy session
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
              <p className={styles.trustLine}>
                <Lock size={16} aria-hidden="true" />
                <span>
                  Contributions support subsidized psychotherapy with Registered
                  Psychotherapists and Registered Social Workers. Secure payment
                  by Stripe.
                </span>
              </p>
              <div className={styles.team}>
                <TeamFaces />
                <p>
                  <strong>Ottawa-based, virtual across Ontario</strong>
                  Care from Valisen&apos;s regulated therapists
                </p>
              </div>
            </div>

            <DonationForm available={available} />
          </div>
        </section>

        {/* B — Why this matters */}
        <section className={`${styles.section} ${styles.sectionWhite}`} aria-labelledby="why-heading">
          <div className={styles.container}>
            <p className={styles.eyebrow}>Why this matters</p>
            <h2 id="why-heading" className={styles.sectionTitle}>
              When money is tight, therapy is often the first thing to go.
            </h2>
            <p className={styles.sectionLead}>
              It might be a student paying rent on a part-time income, a parent
              weighing a session against the grocery bill, or someone who knows
              they need support but can&apos;t justify the cost this month. The
              need doesn&apos;t go away. The appointment just keeps getting
              pushed back.
            </p>

            <ul className={styles.stats}>
              {DONATION_FACTS.map((fact) => (
                <li key={fact.sourceUrl} className={styles.stat}>
                  <span className={styles.statFigure}>{fact.figure}</span>
                  <p className={styles.statClaim}>{fact.claim}</p>
                  <p className={styles.statSource}>
                    {fact.context}{" "}
                    <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {fact.source}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                </li>
              ))}
            </ul>

            <p className={styles.connect}>
              A 50-minute session at Valisen costs {PRICE_RANGE}. For someone
              already stretched, a subsidy can be the difference between booking
              and waiting.
            </p>
          </div>
        </section>

        {/* C — Where your money goes */}
        <section className={styles.section} aria-labelledby="money-heading">
          <div className={styles.container}>
            <p className={styles.eyebrow}>Where your money goes</p>
            <h2 id="money-heading" className={styles.sectionTitle}>
              One fund, used only to make sessions more affordable.
            </h2>

            <ol className={styles.steps}>
              {PROGRAM_POLICY.howItWorks.map((step) => (
                <li key={step.title} className={styles.step}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>

            <div className={styles.split}>
              <div className={styles.panel}>
                <h3>What the suggested amounts mean</h3>
                <p>
                  Because contributions are pooled, an amount isn&apos;t tied to
                  one person or session. These comparisons use Valisen&apos;s
                  standard ${FULL_SESSION_EQUIVALENT_DOLLARS} fee for a{" "}
                  {THERAPY_SESSION_DURATION_MINUTES}-minute session.
                </p>
                <ul className={styles.amountList}>
                  {DONATION_PRESETS.map((preset) => (
                    <li key={preset.dollars}>
                      <strong>{formatDonationDollars(preset.dollars)}</strong>
                      <span>{preset.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${styles.panel} ${styles.panelAccent}`}>
                <h3>Need support yourself?</h3>
                <p>
                  If cost is what&apos;s holding you back, book a free{" "}
                  {CONSULTATION_DURATION_MINUTES}-minute consultation and ask
                  about subsidized sessions. Support depends on the funds
                  available at the time.
                </p>
                <p>
                  <Link href={MATCHING_FORM_URL} className={styles.secondaryButton}>
                    Book a free consultation
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* D — About Valisen */}
        <section className={`${styles.section} ${styles.sectionNavy}`} aria-labelledby="about-heading">
          <div className={`${styles.container} ${styles.aboutGrid}`}>
            <div>
              <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Who you&apos;re supporting</p>
              <h2 id="about-heading" className={styles.sectionTitle}>
                A local clinic working to make therapy easier to reach.
              </h2>
              <p className={styles.aboutText}>
                Valisen Mental Health is an Ottawa-based psychotherapy clinic.
                Therapy is delivered virtually across Ontario by Registered
                Psychotherapists and Registered Social Workers, regulated
                professionals accountable to their colleges.
              </p>
              <p className={styles.aboutText}>
                Our mission is to make mental health care more accessible. The
                subsidy fund extends that to people for whom cost is the main
                barrier.
              </p>
              <div className={styles.aboutTeam}>
                <TeamFaces size={44} />
                <p>
                  {team.length} therapists, each with a public profile and
                  college registration.
                </p>
              </div>
              <div className={styles.aboutLinks}>
                <Link href="/therapists">
                  Meet the therapists
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/about">
                  About Valisen
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <dl className={styles.facts}>
              <div>
                <dt>Based in</dt>
                <dd>Ottawa, Ontario</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>Virtual therapy across Ontario</dd>
              </div>
              <div>
                <dt>Clinicians</dt>
                <dd>Registered Psychotherapists &amp; Social Workers</dd>
              </div>
              <div>
                <dt>Session fee</dt>
                <dd>
                  {PRICE_RANGE} per {THERAPY_SESSION_DURATION_MINUTES} min
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* F — Transparency and FAQ */}
        <section className={`${styles.section} ${styles.sectionWhite}`} aria-labelledby="faq-heading">
          <div className={styles.container}>
            <p className={styles.eyebrow}>Transparency</p>
            <h2 id="faq-heading" className={styles.sectionTitle}>
              Questions before you contribute
            </h2>
            <div className={styles.faqList}>
              {FAQS.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>
                    {faq.question}
                    <Plus size={20} aria-hidden="true" />
                  </summary>
                  <div>{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className={`${styles.section} ${styles.closing}`} aria-labelledby="closing-heading">
          <div className={styles.container}>
            <h2 id="closing-heading" className={styles.sectionTitle}>
              Help someone take the first step.
            </h2>
            <p className={styles.sectionLead}>
              Any amount helps lower the cost of a session for someone who&apos;s
              been putting it off.
            </p>
            <div className={styles.closingActions}>
              <a href="#contribute" className={styles.primaryButton}>
                Help fund a therapy session
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.closingNote}>
              One-time payment in CAD · Secure checkout by Stripe ·{" "}
              {PROGRAM_POLICY.taxStatusShort}
            </p>
          </div>
        </section>
      </main>

      <Footer tone="brand" />
      {available ? <div className={styles.stickySpacer} aria-hidden="true" /> : null}
    </div>
  );
}
