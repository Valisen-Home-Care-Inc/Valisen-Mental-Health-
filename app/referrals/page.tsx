import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, Check, FileText, Phone } from "lucide-react";
import ReferralForm from "@/components/ReferralForm";
import ReferralAnalytics from "@/components/ReferralAnalytics";
import { getActiveTherapists, getVerifiedLanguages } from "@/lib/therapists";
import { REFERRAL_GUIDE_URL, REFERRAL_REASONS } from "@/lib/referrals";
import styles from "./referrals.module.css";

export const dynamic = "force-dynamic";
const title = "Healthcare Provider Referrals | Valisen Mental Health Ontario";
const description = "Refer patients to Valisen Mental Health for virtual psychotherapy across Ontario. Explore our registered therapists, current services, and healthcare referral process.";
export const metadata: Metadata = {
  title: { absolute: title }, description, alternates: { canonical: "/referrals" },
  openGraph: { title, description, url: "/referrals", type: "website", locale: "en_CA", images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Valisen Mental Health" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.jpg"] },
};

const benefits = [
  ["Current clinician availability", "Browse clinicians accepting new clients and help patients explore available appointments. Timing is confirmed individually; no appointment window is guaranteed."],
  ["Ontario-wide virtual access", "Patients can attend from a private space in Ontario. Video appointments are available, with telephone options depending on the clinician."],
  ["A diverse clinician team", "Registered Psychotherapists, including a Qualifying clinician, and a Registered Social Worker bring different clinical backgrounds and language capabilities."],
  ["Simple coordination", "Refer a patient with their consent, or share our information so they can contact us independently. The patient chooses their next step."],
];
const steps = [
  ["Submit the referral", "With patient consent, provide contact information and brief referral details using the form below."],
  ["We contact the patient", "Our team reviews the referral and contacts the patient to discuss their needs, therapist fit and availability."],
  ["Patient selects a clinician", "The patient can review suitable clinicians and discuss next steps before an appointment is arranged."],
  ["Care begins", "Once an appointment is confirmed, the patient begins virtual care with their selected clinician."],
];
const faqs = [
  ["Does a patient need a physician referral?", "No. Patients can contact Valisen directly or request a consultation. Healthcare professionals can also submit a referral with the patient’s consent."],
  ["Do you accept patients from anywhere in Ontario?", "Valisen offers virtual therapy across Ontario. Patients should have a private place for their appointment; the clinician will confirm location and suitability for virtual care."],
  ["What types of professionals provide care at Valisen?", "Our current team includes Registered Psychotherapists, a Registered Psychotherapist (Qualifying), and a Registered Social Worker. Individual credentials and clinical backgrounds are listed on each profile."],
  ["How quickly can a patient get an appointment?", "The profiles below identify clinicians currently listed as accepting new clients. Appointment times vary by clinician and are confirmed during coordination. Submitting a referral does not reserve an appointment."],
  ["Can patients use insurance benefits?", "Itemized receipts are provided after sessions. Coverage depends on the patient’s plan and the clinician’s professional designation. Patients should confirm eligibility and limits with their insurer before booking."],
  ["Can I refer a patient to a specific therapist?", "Yes. Indicate a therapist preference in the referral form. Our team will discuss suitability and current availability with the patient; a preference does not guarantee a booking."],
  ["What happens after I submit a referral?", "After the form confirms receipt, our team reviews the referral and contacts the patient using their preferred method. Patients can explore therapist fit and scheduling. Clinical information is not automatically shared back with the referring provider."],
];

function ReferralButton({ children = "Refer a Patient" }: { children?: React.ReactNode }) {
  return <a className={styles.button} href="#refer-patient" data-referral-event="referral_cta_clicked">{children}<span aria-hidden="true">→</span></a>;
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ therapist?: string }> }) {
  const { therapist } = await searchParams;
  const clinicians = getActiveTherapists();
  const languages = getVerifiedLanguages(clinicians);
  return <>
    <a href="#referrals-main" className={styles.skipLink}>Skip to referral information</a>
    <ReferralAnalytics />
    <main id="referrals-main">
      <section className={styles.hero}>
        <div className={`container-v ${styles.heroGrid}`}>
          <div>
            <p className={styles.eyebrow}>Ontario healthcare referral resource</p>
            <h1>Refer Your Patients to <em>Accessible Mental Health Care</em></h1>
            <p className={styles.lead}>Valisen Mental Health connects patients across Ontario with registered mental-health professionals offering secure virtual therapy.</p>
            <div className={styles.actions}><ReferralButton /><a className={styles.secondaryButton} href="#referral-therapists">Meet Our Therapists <ArrowUpRight size={16} aria-hidden="true" /></a></div>
            <p className={styles.trust}>Registered clinicians <span>·</span> Ontario-wide care <span>·</span> Direct referrals welcome</p>
          </div>
          <aside className={styles.infoPanel} aria-label="Referral information">
            <div className={styles.panelHeader}><span className={styles.eyebrow}>At a glance</span><span className={styles.documentMark} aria-hidden="true">VMH / ON</span></div>
            <h2>Referral Information</h2>
            <dl><div><dt>Care setting</dt><dd>Outpatient virtual psychotherapy</dd></div><div><dt>Patients</dt><dd>Adults &amp; couples in Ontario</dd></div><div><dt>Languages</dt><dd>{languages.join(" · ")}</dd></div><div><dt>Appointments</dt><dd>Secure video; telephone options by clinician</dd></div></dl>
            <div className={styles.availability}><span aria-hidden="true" />{clinicians.filter(t => t.acceptingNewClients).length} clinicians accepting new clients</div>
            <p className={styles.hint}>Availability varies by clinician. Contact our team for current appointment times.</p>
          </aside>
        </div>
      </section>

      <section className={styles.quickBand} aria-label="Referral essentials"><div className={`container-v ${styles.quickGrid}`}>
        <div><strong>Current availability</strong><p>Clinicians accepting new clients.</p></div><div><strong>Virtual across Ontario</strong><p>Care from a private space.</p></div><div><strong>Multiple languages</strong><p>{languages.join(", ")}.</p></div><div><strong>Insurance receipts</strong><p>Confirm coverage with the insurer.</p></div>
      </div></section>

      <section className={`container-v ${styles.section} ${styles.supportGrid}`}>
        <div><p className={styles.eyebrow}>Appropriate referrals</p><h2>Who You Can Refer</h2><p>Adults and couples seeking outpatient virtual mental-health care. We welcome referrals from family physicians, clinics, hospital teams, social workers, nurses and community providers.</p><Link href="#referral-therapists" className={styles.textLink}>Explore our clinical team <span aria-hidden="true">↗</span></Link></div>
        <div><ul className={styles.concerns}>{REFERRAL_REASONS.map(reason => <li key={reason}><Check size={15} aria-hidden="true" />{reason}</li>)}</ul><p className={styles.notice}><strong>Outpatient care only.</strong> Valisen Mental Health is not an emergency or crisis service. Patients requiring immediate emergency intervention should be directed to appropriate emergency or crisis resources.</p></div>
      </section>

      <section className={styles.benefitSection}><div className={`container-v ${styles.section}`}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>For your practice</p><h2>A Simple Referral Option<br className={styles.desktopBreak} /> for Your Patients</h2></div><p>A clear pathway from your recommendation to a conversation about care.</p></div>
        <div className={styles.benefits}>{benefits.map(([heading, body], i) => <article key={heading}><span className={styles.number}>0{i + 1}</span><h3>{heading}</h3><p>{body}</p></article>)}</div>
      </div></section>

      <section id="referral-therapists" className={`container-v ${styles.section}`}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Our clinical team</p><h2>Meet Our Therapists</h2></div><p>Review credentials, language options and areas of support before making a referral.</p></div>
        <div className={styles.clinicians}>{clinicians.map(t => <article key={t.slug} className={styles.clinician}>
          <div className={styles.clinicianTop}>{t.photo && <Image src={t.photo} alt={t.name} width={90} height={108} sizes="90px" style={{ objectPosition: t.photoPosition || "center 25%" }} />}<div><h3>{t.name}</h3><p>{t.credentials}</p>{t.registration && <p>{t.registration.college} #{t.registration.number}</p>}</div></div>
          <div className={styles.clinicianBody}><p className={styles.clinicianStatus}><span aria-hidden="true" />{t.acceptingNewClients ? "Accepting new clients" : "Contact for availability"}</p><dl><div><dt>Languages</dt><dd>{t.languages.join(" · ")}</dd></div><div><dt>Areas of support</dt><dd>{t.specialties.slice(0, 3).join(" · ")}</dd></div></dl><Link className={styles.profileLink} href={`/referrals/therapists/${t.slug}`} data-referral-event="therapist_profile_clicked_from_referrals" aria-label={`View profile: ${t.name}`}>View Profile <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        </article>)}</div>
        <div className={styles.rosterFooter}><p>Accepting new clients does not guarantee an immediate appointment. Confirm timing with our team.</p><Link className={styles.textLink} href="#referral-therapists">View All Therapists <span aria-hidden="true">↗</span></Link></div>
      </section>

      <section className={styles.processSection}><div className={`container-v ${styles.section}`}><p className={styles.eyebrow}>From referral to care</p><h2>How Referrals Work</h2><ol className={styles.steps}>{steps.map(([heading, body], i) => <li key={heading}><span className={styles.stepNumber}>0{i + 1}</span><h3>{heading}</h3><p>{body}</p></li>)}</ol></div></section>

      <section id="refer-patient" className={`container-v ${styles.section} ${styles.referralLayout}`}>
        <div className={styles.referralIntro}><p className={styles.eyebrow}>Healthcare provider referral</p><h2>Refer a Patient</h2><p>A straightforward first step towards finding suitable care. Please obtain the patient’s consent before sharing their information.</p><div className={styles.beforeSubmit}><h3>Before you submit</h3><ul><li>The patient is seeking outpatient care.</li><li>The patient is aware Valisen may contact them.</li><li>Contact details and preferences are accurate.</li></ul></div><p className={styles.hint}>Need help with a referral? <a href="#referral-contact">Contact our team</a>.</p></div>
        <div><ReferralForm initialTherapist={therapist} enabled={true} /><div id="referral-contact" className={styles.contact}><h3>Prefer another referral method?</h3><p>Contact Valisen to discuss how to arrange a referral.</p><a className={styles.contactPhone} href="tel:613-707-0333" data-referral-event="referral_phone_clicked"><Phone size={17} aria-hidden="true" />613-707-0333</a><a href="mailto:info@valisenmentalhealth.com">info@valisenmentalhealth.com</a><p className={styles.hint}>Email is for general enquiries. Please do not include patient details or clinical information in ordinary email.</p></div></div>
      </section>

      <section className={styles.resourcesSection}><div className={`container-v ${styles.resources}`}><div><p className={styles.eyebrow}>For your referral toolkit</p><h2>Referral Resources</h2><p>Keep Valisen’s information close at hand.</p></div><div className={styles.resourceCard}><FileText size={30} strokeWidth={1.25} aria-hidden="true" /><div><h3>Valisen Mental Health<br />Therapist Referral Guide</h3><p>A concise overview of our clinicians, services, languages, and referral information for healthcare providers.</p><a className={styles.textLink} href={REFERRAL_GUIDE_URL} download data-referral-event="referral_guide_downloaded">Download Referral Guide <ArrowDownToLine size={16} aria-hidden="true" /></a></div></div></div></section>

      <section className={`container-v ${styles.section} ${styles.faqLayout}`}><div><p className={styles.eyebrow}>Provider questions</p><h2>A Few Helpful Details</h2><a className={styles.textLink} href="#referral-contact">Contact Our Referral Team <span aria-hidden="true">↗</span></a></div><div className={styles.faq}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className={styles.finalCta}><div className="container-v"><p className={styles.eyebrow}>A next step for your patient</p><h2>Have a Patient Who May<br className={styles.desktopBreak} /> Benefit From Therapy?</h2><p>Submit a referral and our team can help the patient explore available clinicians and next steps.</p><div className={styles.actions}><ReferralButton /><a className={styles.finalLink} href="#referral-contact">Contact Valisen <span aria-hidden="true">↗</span></a></div></div></section>
    </main>
  </>;
}
