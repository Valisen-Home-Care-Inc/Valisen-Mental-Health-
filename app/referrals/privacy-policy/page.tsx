import type { Metadata } from "next";
import Link from "next/link";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";
import styles from "../referrals.module.css";

export const metadata: Metadata = {
  title: { absolute: "Referral Privacy Policy | Valisen Mental Health" },
  description: "How Valisen Mental Health handles personal information and healthcare provider referrals.",
  alternates: { canonical: "/referrals/privacy-policy" },
};

export default function ReferralPrivacyPage() {
  return <main>
    <div className="container-v"><Link className={styles.textLink} href="/referrals#refer-patient">← Back to referrals</Link></div>
    <PrivacyPolicyContent homeHref="/referrals" />
  </main>;
}
