import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "./referrals.module.css";

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>
    <header className={styles.referralHeader}>
      <div className={`container-v ${styles.referralHeaderInner}`}>
        <Logo href="/referrals" label="Valisen healthcare referrals home" />
        <nav aria-label="Healthcare referrals">
          <Link href="/referrals#referral-therapists">Our therapists</Link>
          <Link href="/referrals#referral-contact">Contact</Link>
          <Link className={styles.button} href="/referrals#refer-patient">Refer a Patient</Link>
        </nav>
      </div>
    </header>
    {children}
    <footer className={styles.referralFooter}>
      <div className={`container-v ${styles.referralFooterInner}`}>
        <div><Logo dark href="/referrals" label="Valisen healthcare referrals home" /><p>Healthcare provider referrals · Virtual care across Ontario</p></div>
        <nav aria-label="Referral resources">
          <Link href="/referrals#referral-therapists">Our therapists</Link>
          <Link href="/referrals/privacy-policy">Privacy Policy</Link>
          <Link href="/referrals#referral-contact">Contact our team</Link>
          <a href="tel:613-707-0333">613-707-0333</a>
        </nav>
        <p>Valisen is an outpatient psychotherapy service, not an emergency or crisis service.</p>
      </div>
    </footer>
  </div>;
}
