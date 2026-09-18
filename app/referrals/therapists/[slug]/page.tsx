import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTherapySession, getActiveTherapists } from "@/lib/therapists";
import styles from "../../referrals.module.css";

type Props = { params: Promise<{ slug: string }> };
function clinician(slug: string) {
  return getActiveTherapists().find(t => t.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const therapist = clinician(slug);
  if (!therapist) return {};
  const title = `${therapist.name} | Healthcare Referrals | Valisen Mental Health`;
  const description = `Review ${therapist.name}’s credentials, languages and areas of support for a healthcare referral to Valisen Mental Health.`;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: `/referrals/therapists/${slug}` },
    openGraph: { title, description, url: `/referrals/therapists/${slug}` },
  };
}

export default async function ReferralTherapistPage({ params }: Props) {
  const { slug } = await params;
  const t = clinician(slug);
  if (!t) notFound();
  return <main>
    <section className={styles.hero}>
      <div className="container-v">
        <Link className={styles.textLink} href="/referrals#referral-therapists">← Back to referral therapists</Link>
        <div className={styles.profileHero}>
          <div>
            <p className={styles.eyebrow}>Healthcare referral · Clinician profile</p>
            <h1>{t.name}</h1>
            <p className={styles.profileCredential}>{t.credentials}</p>
            <p className={styles.lead}>{t.cardStatement}</p>
            <div className={styles.availability}><span aria-hidden="true" />{t.acceptingNewClients ? "Accepting new clients" : "Contact for availability"}</div>
            <p className={styles.hint}>Appointment times are confirmed during referral coordination.</p>
            <div className={styles.actions}>
              <Link className={styles.button} href={`/referrals?therapist=${t.slug}#refer-patient`}>Refer to {t.name.split(" ")[0]} <span aria-hidden="true">→</span></Link>
              <Link className={styles.secondaryButton} href="/referrals#referral-therapists">View All Therapists</Link>
            </div>
          </div>
          {t.photo && <Image className={styles.profilePhoto} src={t.photo} alt={t.name} width={360} height={420} priority sizes="(max-width: 800px) 260px, 360px" style={{ objectPosition: t.photoPosition || "center 25%" }} />}
        </div>
      </div>
    </section>
    <div className={`container-v ${styles.section} ${styles.profileDetails}`}>
      <div>
        <section><p className={styles.eyebrow}>Clinical background</p><h2>About {t.name.split(" ")[0]}</h2>{t.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>
        <section><h2>Areas of Support</h2>{t.areasOfSupport.map(area => <div key={area.title}><h3>{area.title}</h3><p>{area.description}</p></div>)}</section>
        <section><h2>Approach to Therapy</h2><p>{t.therapyStyle.summary}</p>{t.therapyStyle.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>
      </div>
      <aside>
        <div className={styles.infoPanel}>
          <h2>Referral Details</h2>
          <dl>{[
            ["Languages", t.languages.join(", ")],
            ["Format", t.formats.join(", ")],
            ["Patients", t.populationsServed.join(", ")],
            ["Session fee", formatTherapySession(t)],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className={styles.hint}>Insurance eligibility depends on the patient’s plan and the clinician’s designation.</p>
        </div>
        <section><h2>Credentials</h2><dl className={styles.credentials}>{t.credentialsList.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>
        <Link className={styles.textLink} href="/referrals#referral-contact">Contact the referral team →</Link>
      </aside>
    </div>
  </main>;
}
