import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock, HeartHandshake, RotateCcw } from "lucide-react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import {
  DonationCompleted,
  StripSessionIdFromUrl,
} from "@/components/donate/DonatePageAnalytics";
import { formatDonationCents } from "@/lib/donations/contract";
import {
  DONATION_CONTACT_EMAIL,
  PROGRAM_POLICY,
  REFUND_REQUEST_WINDOW_DAYS,
} from "@/lib/donations/program";
import {
  lookupDonationSession,
  type ConfirmedDonationSessionView,
} from "@/lib/server/donationSession";
import styles from "../donate.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thank You for Your Contribution",
  description: "Confirmation of your contribution to Valisen Mental Health's subsidized psychotherapy fund.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  alternates: { canonical: "https://valisenmentalhealth.com/donate" },
};

function Paid({ view }: { view: ConfirmedDonationSessionView }) {
  return (
    <>
      <DonationCompleted reference={view.reference} dollars={Math.round(view.amountCents / 100)} />
      <span className={styles.resultIcon} aria-hidden="true">
        <HeartHandshake size={30} />
      </span>
      <h1 className={styles.resultTitle}>Thank you. Your contribution went through.</h1>
      <p className={styles.resultAmount}>{formatDonationCents(view.amountCents)} CAD</p>
      <p className={styles.resultText}>
        Your contribution is now part of Valisen&apos;s subsidy fund, which lowers
        session fees for people facing financial barriers.
      </p>
      <ul className={styles.resultList}>
        <li>
          <Check size={16} aria-hidden="true" />
          A payment confirmation from Stripe is on its way to the email address
          you entered at checkout.
        </li>
        <li>
          <Check size={16} aria-hidden="true" />
          {PROGRAM_POLICY.taxStatusShort}
        </li>
        <li>
          <Check size={16} aria-hidden="true" />
          Made a mistaken or duplicate payment? Email {DONATION_CONTACT_EMAIL} within{" "}
          {REFUND_REQUEST_WINDOW_DAYS} days to request a refund.
        </li>
      </ul>
    </>
  );
}

function Processing({ view }: { view: ConfirmedDonationSessionView }) {
  return (
    <>
      <span className={styles.resultIcon} aria-hidden="true">
        <Clock size={30} />
      </span>
      <h1 className={styles.resultTitle}>Thank you. Your payment is processing.</h1>
      <p className={styles.resultAmount}>{formatDonationCents(view.amountCents)} CAD</p>
      <p className={styles.resultText}>
        Your bank or payment method is still confirming this payment, which can
        take a few days for some methods. Stripe will email you once it
        completes. There&apos;s nothing else you need to do.
      </p>
    </>
  );
}

function NotCompleted() {
  return (
    <>
      <span className={styles.resultIcon} aria-hidden="true">
        <RotateCcw size={30} />
      </span>
      <h1 className={styles.resultTitle}>Your payment wasn&apos;t completed.</h1>
      <p className={styles.resultText}>
        No contribution was charged. If you&apos;d still like to contribute, you
        can return to the form and try again.
      </p>
    </>
  );
}

function Unconfirmed({ unavailable }: { unavailable: boolean }) {
  return (
    <>
      <span className={styles.resultIcon} aria-hidden="true">
        <HeartHandshake size={30} />
      </span>
      <h1 className={styles.resultTitle}>Thank you for supporting affordable therapy.</h1>
      <p className={styles.resultText}>
        {unavailable
          ? "We couldn't load your payment details just now. "
          : "We couldn't find payment details for this page. "}
        If you completed a payment, Stripe has emailed a confirmation to the
        address you entered at checkout. For help, email{" "}
        <a href={`mailto:${DONATION_CONTACT_EMAIL}`}>{DONATION_CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}

export default async function DonationThankYouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;
  const view = await lookupDonationSession(sessionId);
  const testMode = (view.state === "paid" || view.state === "processing") && !view.livemode;

  return (
    <div className={styles.page}>
      <StripSessionIdFromUrl />
      <NavBar />
      <main className={styles.resultWrap}>
        <div className={styles.container}>
          <section className={styles.resultCard} aria-live="polite">
            {testMode ? <span className={styles.testBadge}>Test mode · no real charge</span> : null}
            {view.state === "paid" ? <Paid view={view} /> : null}
            {view.state === "processing" ? <Processing view={view} /> : null}
            {view.state === "not_completed" ? <NotCompleted /> : null}
            {view.state === "not_found" || view.state === "unavailable" ? (
              <Unconfirmed unavailable={view.state === "unavailable"} />
            ) : null}

            <div className={styles.resultActions}>
              {view.state === "not_completed" ? (
                <Link href="/donate#contribute" className={styles.primaryButton}>
                  Try again
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ) : (
                <Link href="/about" className={styles.primaryButton}>
                  Learn about Valisen
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              )}
              <Link href="/donate" className={styles.secondaryButton}>
                Back to the contribution page
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer tone="brand" />
    </div>
  );
}
