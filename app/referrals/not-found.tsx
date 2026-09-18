import Link from "next/link";
import styles from "./referrals.module.css";

export default function ReferralNotFound() {
  return <main className={`container-v ${styles.section}`}>
    <h1>Referral page not found</h1>
    <p>This clinician profile or referral resource is not available.</p>
    <Link className={styles.textLink} href="/referrals#referral-therapists">Return to referral therapists →</Link>
  </main>;
}
