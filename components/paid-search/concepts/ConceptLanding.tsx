"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, HeartHandshake, MessageCircle, Phone, ShieldCheck, Video } from "lucide-react";
import type { PaidSearchConcept } from "@/lib/paidSearchConcepts";
import ConceptBooking from "./ConceptBooking";
import styles from "./ConceptLanding.module.css";
import { landingTranslator, type LandingLocale } from "@/lib/paidSearchLocale";
import { arabicLandingTranslations, mandarinLandingTranslations, translateLandingTree } from "@/lib/paidSearchLanguageContent";

export type ConceptClinician = {
  slug: string; name: string; role: string; photo: string;
  fee: number; duration: number; languages: string[];
  heading: string; description: string; reasons: string[];
  qualifications: Array<{ label: string; value: string }>;
};

export default function ConceptLanding({ concept: originalConcept, clinicians: originalClinicians, previews, preview = true }: {
  concept: PaidSearchConcept;
  clinicians: ConceptClinician[];
  previews: Array<{ slug: string; label: string }>;
  preview?: boolean;
}) {
  const router = useRouter();
  const nativeLocale: LandingLocale = originalConcept.slug === "arabic" ? "ar" : originalConcept.slug === "mandarin" ? "zh-Hans" : "en";
  const [locale, setLocale] = useState<LandingLocale>(nativeLocale);
  const languagePrompt = useRef<HTMLDialogElement>(null);
  const t = landingTranslator(locale, locale === "ar" ? arabicLandingTranslations : locale === "zh-Hans" ? mandarinLandingTranslations : {});
  const concept = translateLandingTree(originalConcept, t);
  const clinicians = translateLandingTree(originalClinicians, t);
  useEffect(() => {
    if (nativeLocale !== "en") languagePrompt.current?.showModal();
  }, [nativeLocale]);
  const [sticky, setSticky] = useState(false);
  const hero = useRef<HTMLElement>(null);
  const booking = useRef<HTMLElement>(null);
  const lead = clinicians[0];
  const minimum = Math.min(...clinicians.map((person) => person.fee));
  const maximum = Math.max(...clinicians.map((person) => person.fee));
  const price = minimum === maximum ? `$${minimum}` : `$${minimum}–$${maximum}`;
  useEffect(() => {
    const update = () => {
      const heroBounds = hero.current?.getBoundingClientRect();
      const formBounds = booking.current?.getBoundingClientRect();
      setSticky(Boolean(heroBounds && formBounds && heroBounds.bottom < 80 && (formBounds.top > innerHeight || formBounds.bottom < 0)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  function choose() {
    booking.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  const faqs = [...concept.faqs,
    { question: "What happens in the free consultation?", answer: "It is a 20-minute phone conversation about your needs, therapist fit, scheduling, and fees. It is not a full therapy session. You can ask questions without committing to paid therapy." },
    { question: "How much do therapy sessions cost?", answer: `${t("The featured therapists’ listed fees are {price} per 50-minute session. Confirm the fee and session format before a paid appointment.", { price })} ${concept.slug === "couples" ? t("For couples work, confirm the arrangements for couples sessions.") + " " : ""}${t("The initial 20-minute consultation is free.")}` },
    { question: "Can I use my workplace benefits or insurance?", answer: "Receipts are provided for reimbursement where applicable. Coverage depends on your plan and the clinician’s designation. Check whether your plan covers an RP, RP (Qualifying), or RSW, as appropriate, before booking paid sessions." },
  ];

  return <div className={styles.page} data-tone={concept.tone} id="top" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    {nativeLocale !== "en" ? <dialog ref={languagePrompt} className={styles.languagePrompt} lang="en" dir="ltr" aria-labelledby="language-prompt-heading">
      <p className={styles.eyebrow}>Choose your page language</p><h2 id="language-prompt-heading">Prefer English?</h2><p>Booking for someone else? You can view this entire page in English.</p>
      <button type="button" className={styles.primaryButton} onClick={() => { setLocale("en"); languagePrompt.current?.close(); }}>Switch to English <ArrowRight size={18} /></button>
      <button type="button" className={styles.keepLanguage} onClick={() => languagePrompt.current?.close()}>{nativeLocale === "ar" ? "المتابعة بالعربية" : "继续使用中文"}</button>
    </dialog> : null}
    <a className={styles.skipLink} href="#main-content">{t("Skip to content")}</a>
    {preview ? <div className={styles.reviewBar}><Link href="/ads-preview"><ArrowLeft size={12} />{t("All page concepts")}</Link><span>{t("Design preview")}</span>{!concept.language ? <label><span className={styles.srOnly}>{t("Preview another landing page")}</span><select value={concept.slug} onChange={(event) => router.push(`/ads-preview/${event.target.value}`)}>{previews.map((page) => <option key={page.slug} value={page.slug}>{page.label}</option>)}</select></label> : null}</div> : null}
    <header className={styles.header}><div className={styles.container}>
      <a href="#top" aria-label={t("Back to top")}><Image src="/valisen-logo.png" alt={t("Valisen Mental Health")} width={950} height={330} className={styles.logo} priority /></a>
      <nav aria-label={t("Page sections")}><a href="#your-therapist">{t("Your therapist")}</a><a href="#our-approach">{t("Our approach")}</a><a href="#fees-and-questions">{t("Fees & FAQs")}</a></nav>
      <a href="#consultation" className={styles.headerCta}>{t("Free consultation")}<ArrowRight size={15} /></a>
      {nativeLocale !== "en" ? <div className={styles.languageToggle} role="group" aria-label="Language / اللغة / 语言" dir="ltr"><button type="button" lang={nativeLocale} aria-pressed={locale === nativeLocale} onClick={() => setLocale(nativeLocale)}>{nativeLocale === "ar" ? "العربية" : "中文"}</button><button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{"English"}</button></div> : null}
    </div></header>
    <main id="main-content">
      <section ref={hero} className={styles.hero} aria-labelledby="landing-heading"><div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.eyebrowLine} /> {concept.eyebrow}</p>
          <h1 id="landing-heading">{concept.headline} <em>{concept.emphasis}</em></h1>
          <p className={styles.heroIntro}>{concept.introduction}</p>
          <a href="#consultation" className={styles.primaryButton}>{concept.cta} <ArrowRight size={18} /></a>
          <p className={styles.heroReassurance}>{t("Free 20-minute phone consultation · No obligation")}</p>
          <a className={styles.meetLink} href="#your-therapist"><span className={styles.avatarStack}>{clinicians.slice(0, 3).map((person) => <Image key={person.slug} src={person.photo} alt="" width={38} height={38} />)}</span><span>{clinicians.length === 1 ? t("Meet {name}", { name: lead?.name.split(" ")[0] || "" }) : t("Meet your therapists")}<ArrowDown size={13} /></span></a>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.portraitFrame}>
            {lead ? <Image src={lead.photo} alt={lead.name} fill priority sizes="(max-width: 700px) 90vw, 43vw" className={styles.heroPortrait} /> : null}
            <div className={styles.portraitTop}><span className={styles.availabilityDot} />{t("Accepting new clients")}</div>
          </div>
          <div className={styles.personCaption}><div><span>{concept.language?.label ?? t("A real person, here to listen")}</span><h2>{lead?.name}</h2><p>{lead?.role}</p></div><span className={styles.captionSeal} aria-hidden="true"><HeartHandshake size={27} strokeWidth={1.25} /></span></div>
          <div className={styles.heroProof}><span className={styles.proofIcon}><Check size={17} /></span><div><strong>{concept.proof[0]}</strong><span>{concept.proof[1]}</span></div></div>
        </div>
      </div></section>

      <div className={styles.trustStrip}><div className={styles.container}>
        <span><ShieldCheck size={18} />{t("Regulated Ontario clinicians")}</span><span><Video size={18} />{t("Online, across Ontario")}</span><span><Clock3 size={18} />{t("A free first conversation")}</span>
      </div></div>

      <section className={`${styles.section} ${styles.recognition}`}><div className={`${styles.container} ${styles.recognitionGrid}`}>
        <div><p className={styles.eyebrow}>{t("If this sounds familiar")}</p><h2>{concept.recognitionHeading}</h2></div>
        <ul>{concept.recognition.map((text, index) => <li key={text}><span>0{index + 1}</span><p>{text}</p></li>)}</ul>
      </div></section>

      <section id="your-therapist" className={`${styles.section} ${styles.therapistSection}`} aria-labelledby="therapist-heading"><div className={styles.container}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{t("The person makes a difference")}</p><h2 id="therapist-heading">{t("A therapist you can")}{" "}<em>{t("get to know.")}</em></h2></div><p>{t("Their experience. Their way of working. The details that help you decide who you’d like to talk to.")}</p></div>
        <div className={styles.therapistGrid} data-count={clinicians.length}>{clinicians.map((person) => <article className={styles.therapistCard} key={person.slug}>
          <div className={styles.profileTop}><Image src={person.photo} alt={person.name} width={96} height={112} className={styles.profilePhoto} /><div><h3>{person.name}</h3><p>{person.role}</p><span className={styles.languageTag}>{person.languages.join(" · ")}</span></div></div>
          <h4>{person.heading}</h4><p className={styles.profileDescription}>{person.description}</p>
          <ul className={styles.fitReasons}>{person.reasons.map((reason) => <li key={reason}><Check size={15} /><span>{reason}</span></li>)}</ul>
          <details className={styles.qualifications}><summary>{t("Qualifications & background")}<ChevronDown size={14} /></summary><dl>{person.qualifications.map((qualification) => <div key={`${qualification.label}:${qualification.value}`}><dt>{qualification.label}</dt><dd>{qualification.value}</dd></div>)}</dl></details>
          <div className={styles.profileBottom}><span>{t("{amount} / {duration} min", { amount: `$${person.fee}`, duration: person.duration })}</span><button type="button" onClick={choose}>{t("Book free consultation")}<ArrowRight size={14} /></button></div>
        </article>)}</div>
      </div></section>

      <section id="our-approach" className={`${styles.section} ${styles.approachSection}`}><div className={styles.container}>
        <div className={styles.approachHeading}><p className={styles.eyebrow}>{t("What working together can look like")}</p><h2>{concept.approachHeading}</h2><p>{concept.approachIntro}</p></div>
        <div className={styles.approachGrid}>{concept.approach.map((item, index) => <article key={item.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
      </div></section>

      <section id="fees-and-questions" className={`${styles.section} ${styles.faqSection}`}><div className={`${styles.container} ${styles.faqGrid}`}>
        <div className={styles.feeCopy}><p className={styles.eyebrow}>{t("A clear next step")}</p><h2>{t("Meet first.")}<br /><em>{t("Decide together.")}</em></h2><p>{t("Know the cost and the process before committing to a paid session.")}</p>
          <div className={styles.priceRow}><span>{t("First phone consultation")}<small>{t("20 minutes · No obligation")}</small></span><strong>{t("Free")}</strong></div>
          <div className={styles.priceRow}><span>{t("Therapy sessions")}<small>{t("Featured clinicians · 50 minutes")}</small></span><strong>{price}</strong></div>
          <p className={styles.insuranceNote}><ShieldCheck size={16} />{t("Receipts for insurance reimbursement where applicable. Confirm your coverage and clinician’s designation with your insurer.")}</p>
        </div>
        <div className={styles.faqList}><p className={styles.eyebrow}>{t("Good questions, clear answers")}</p>{faqs.map((faq) => <details key={faq.question}><summary>{t(faq.question)}<span aria-hidden="true">+</span></summary><p>{t(faq.answer)}</p></details>)}</div>
      </div></section>

      <section ref={booking} id="consultation" className={styles.bookingSection} aria-labelledby="booking-heading"><div className={`${styles.container} ${styles.bookingGrid}`}>
        <div className={styles.bookingCopy}><p className={styles.eyebrow}><span className={styles.eyebrowLine} />{t("Let’s talk")}</p><h2 id="booking-heading">{concept.bookingHeading}</h2><p>{t("A free, 20-minute phone conversation with Valisen to talk about fit, ask questions, and explore the next step.")}</p>
          <ol className={styles.bookingSteps}><li><span>1</span><div><strong>{t("Pick a time that works.")}</strong><p>{t("Choose a day and a time for a phone call.")}</p></div></li><li><span>2</span><div><strong>{t("Share your contact details.")}</strong><p>{t("No detailed personal history needed here.")}</p></div></li><li><span>3</span><div><strong>{t("Have a conversation. Then decide.")}</strong><p>{t("Ask about your therapist, fees, and next steps.")}</p></div></li></ol>
          <div className={styles.bookingHuman}><MessageCircle size={24} strokeWidth={1.4} /><p>{t("It’s okay to begin with")}<br /><strong>{t("“I’m not sure where to start.”")}</strong></p></div>
        </div>
        <ConceptBooking conceptSlug={originalConcept.slug} language={originalConcept.language?.label} locale={locale} preview={preview} />
      </div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}>
      <div className={styles.footerTop}><Image src="/valisen-logo.png" alt={t("Valisen Mental Health")} width={950} height={330} className={styles.logo} /><p>{t("Thoughtful therapy.")}<br />{t("A human place to begin.")}</p><a href="tel:6137070333"><Phone size={15} />{t("613-707-0333")}</a></div>
      <details id="privacy-information" className={styles.privacy}><summary>{t("Privacy information")}</summary><p>{t(preview ? "This is a design preview. The booking demonstration keeps entered details in the page only. It does not send a consultation request, reserve an appointment, or save details to the CRM." : "Your contact details are used to arrange and contact you about your consultation. Read our privacy policy for details.")}</p>{!preview ? <Link href="/privacy-policy">{t("Privacy information")}</Link> : null}</details>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()}{" "}{t("Valisen Mental Health")}</span><span>{t("Virtual therapy for adults in Ontario")}</span>{preview ? <Link href="/ads-preview">{t("Back to all concepts")}<ArrowRight size={12} /></Link> : null}</div>
    </div></footer>
    {sticky ? <div className={styles.mobileSticky}><span>{t("20 minutes. No obligation.")}</span><a href="#consultation">{t("Book free consultation")}<ArrowRight size={16} /></a></div> : null}
  </div>;
}
