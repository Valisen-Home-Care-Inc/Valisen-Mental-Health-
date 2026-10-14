"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Brain, Check, ChevronDown, CircleCheck, Compass, Heart, Leaf, LockKeyhole, MessageCircle, ShieldCheck, Sparkles, Sun, Waves } from "lucide-react";
import { buildJourneyReflection, CONVERSION_VERSION, EMPTY_JOURNEY, callRequestPayload, questionCount, questionFor, recommendClinicians, updateJourney, validateContact, type JourneyAnswers, type JourneyClinician, type JourneyContactDraft } from "@/lib/checkpoints/journey/conversionModel";
import type { ContactErrors } from "@/lib/checkpoints/journey/contact";
import { createJourneyAdapters } from "@/lib/checkpoints/journey/adapters";
import { formatReferralPhone } from "@/lib/phoneFormatting";
import TurnstileWidget from "@/components/TurnstileWidget";
import type { JourneyEventName, JourneyEventDetails } from "@/lib/checkpoints/journey/contract";
import JourneyDialog from "./JourneyDialog";
import { CrisisPanel, TermsPanel } from "./InformationPanels";
import styles from "./MentalBatteryJourney.module.css";

type Panel = "request" | "people" | "privacy" | "terms" | "crisis" | null;
const PANEL_TITLES = { request: "Your free first conversation", people: "Someone you could talk with", privacy: "Your reflection stays yours", terms: "About this check-in", crisis: "Support right now" };
const EMPTY_CONTACT: JourneyContactDraft = { firstName: "", phone: "", message: "", consent: false };

function GlassBattery({ bars = 3 }: { bars?: number }) {
  return <div className={styles.battery} role="img" aria-label={`Mental battery illustration: ${bars} of 4 segments. A metaphor, not a clinical score.`} style={{ "--charge": `${bars * 25}%` } as CSSProperties}><div><span className={styles.charge} /></div></div>;
}
function ChoiceIcon({ name }: { name?: string }) {
  const energyBars: Record<string, number> = { full: 4, steady: 3, low: 2, empty: 1 };
  const bars = energyBars[name || ""];
  if (bars) return <span className={styles.miniBattery}>{[0, 1, 2, 3].map(index => <i key={index} data-filled={index < bars} />)}</span>;
  const icons: Record<string, typeof Brain> = { worry: Brain, burnout: Waves, mood: Sun, relationships: Heart, focus: Sparkles, changes: Compass, none: Leaf };
  const Icon = icons[name || ""] || MessageCircle;
  return <Icon size={18} strokeWidth={1.6} />;
}

function RequestForm({ person, draft, onChange, onSubmit, pending, failure, language, onLanguage, service, onStart, track }: {
  person?: JourneyClinician; draft: JourneyContactDraft; onChange: (draft: JourneyContactDraft) => void; onSubmit: (token: string) => void;
  pending: boolean; failure: string | null; language: string; onLanguage: (language: string) => void;
  service: "individual" | "couples"; onStart: () => void; track: (event: JourneyEventName, details?: JourneyEventDetails) => unknown;
}) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [token, setToken] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const onToken = useCallback((value: string | null) => { setToken(value); if (value) setVerificationError(false); }, []);
  useEffect(() => { if (failure) { setToken(null); setResetKey(value => value + 1); } }, [failure]);
  const form = useRef<HTMLFormElement>(null);
  function update(field: keyof JourneyContactDraft, value: string | boolean) {
    onStart(); onChange({ ...draft, [field]: value });
    setErrors(current => ({ ...current, [field === "phone" ? "contact" : field]: undefined }));
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    const next = validateContact(draft); setErrors(next);
    if (Object.keys(next).length) { void track("form_validation_failed"); form.current?.querySelector<HTMLInputElement>(`[name="${next.firstName ? "firstName" : next.contact ? "phone" : "consent"}"]`)?.focus(); return; }
    if (!token) { setVerificationError(true); return; }
    onSubmit(token);
  }
  return <div className={styles.form}>
    {person ? <div className={styles.formLead}><Image src={person.photo} alt="" width={49} height={59} style={{ objectPosition: person.photoPosition }} /><div><strong>Free {person.consultationMinutes}-minute phone call with {person.name}</strong><p>{person.credential} · {service === "couples" ? "Couples consultation" : "Individual consultation"}</p></div></div> : <p className={styles.formIntro}>Our team will help you explore options for a free 20-minute phone consultation. Requested language: {language}. We’ll confirm whether a suitable therapist is available.</p>}
    <p className={styles.formIntro}>Leave your phone number. Our team will call within 24 hours to arrange a time. You don’t need to choose a date or pay anything now.</p>
    <form ref={form} onSubmit={submit} noValidate aria-busy={pending} onFocusCapture={event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      const field = ({ firstName: "name", phone: "phone", consent: "consent", language: "language" } as const)[target.name as "firstName" | "phone" | "consent" | "language"];
      if (field) { onStart(); void track("contact_field_reached", { field }); }
    }}>
      <fieldset disabled={pending} className={styles.fields}>
        <div className={styles.field}><label htmlFor="journey-name">Your name</label><input id="journey-name" name="firstName" data-initial-focus autoComplete="given-name" placeholder="A first name is enough" required maxLength={80} value={draft.firstName} aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "journey-name-error" : undefined} onChange={event => update("firstName", event.target.value)} />{errors.firstName ? <p id="journey-name-error" className={styles.fieldError}>{errors.firstName}</p> : null}</div>
        <div className={styles.field}><label htmlFor="journey-contact">Phone number (required)</label><input id="journey-contact" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(613) 555-0123" required maxLength={30} value={draft.phone} aria-invalid={Boolean(errors.contact)} aria-describedby={errors.contact ? "journey-contact-error" : "journey-contact-note"} onChange={event => {
          const input = event.target, result = formatReferralPhone(input.value, input.selectionStart ?? input.value.length); update("phone", result.formatted);
          requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(result.caret, result.caret); });
        }} />{errors.contact ? <p className={styles.fieldError} id="journey-contact-error">{errors.contact}</p> : null}<p id="journey-contact-note" className={styles.formSmall}>We need your number for the free phone consultation.</p></div>
        {person && person.languages.length > 1 ? <div className={styles.field}><label htmlFor="journey-call-language">Language for your consultation</label><select id="journey-call-language" name="language" value={language} onChange={event => onLanguage(event.target.value)}>{person.languages.map(value => <option key={value}>{value}</option>)}</select></div> : null}
        <label className={styles.consent}><input type="checkbox" name="consent" checked={draft.consent} required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "journey-consent-error" : undefined} onChange={event => update("consent", event.target.checked)} /><span>I agree that Valisen Mental Health may contact me about this free consultation request and help arrange a therapist and time.</span></label>
        {errors.consent ? <p className={styles.fieldError} id="journey-consent-error">{errors.consent}</p> : null}
      </fieldset>
      {Object.keys(errors).some(key => errors[key as keyof ContactErrors]) ? <p role="alert" className={styles.srOnly}>Please check the highlighted fields.</p> : null}
      <TurnstileWidget action="checkpoint_call" onToken={onToken} resetKey={resetKey} />
      {verificationError ? <p role="alert" className={styles.fieldError}>Please complete the security check above, then try again.</p> : null}
      {failure ? <div role="alert" className={styles.error}><strong>We couldn’t finish this request.</strong><p>{failure}</p><p>Your details are still here. Try again when you’re ready, or call <a href="tel:6137070333">613-707-0333</a>.</p></div> : null}
      <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Preparing your request…" : "Request my free call"}{pending ? null : <ArrowRight size={18} aria-hidden="true" />}</button>
      <p className={styles.formSmall}>Your check-in answers aren’t attached. No marketing subscription.<br />{service === "couples" ? "$200 CAD total for both partners / 50-minute therapy session." : `Ongoing therapy: ${person?.fee || "$160–$180 per 50 minutes"}.`} Paid therapy is separate from this free call.</p>
      <p className={styles.srOnly} role="status">{pending ? "Sending your consultation request." : ""}</p>
    </form>
  </div>;
}

export default function MentalBatteryJourney({ checkpointCode, clinicians }: { checkpointCode: string; clinicians: JourneyClinician[] }) {
  const [phase, setPhase] = useState<"questions" | "result" | "confirmation">("questions");
  const [answers, setAnswers] = useState<JourneyAnswers>({ ...EMPTY_JOURNEY });
  const [step, setStep] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [language, setLanguage] = useState("any");
  const [consultationLanguage, setConsultationLanguage] = useState("English");
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [draft, setDraft] = useState<JourneyContactDraft>({ ...EMPTY_CONTACT });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ person: string; language: string; service: string; referenceId: string }>();
  const [ctaVisible, setCtaVisible] = useState(true);
  const [completionSeconds, setCompletionSeconds] = useState<number>();
  const [adapters] = useState(() => createJourneyAdapters(checkpointCode));
  const answerLock = useRef(false), submitLock = useRef(false), started = useRef(false), formStarted = useRef(false);
  const mounted = useRef(true), arrival = useRef(0), initialized = useRef(false), lastView = useRef("questions:0");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const heading = useRef<HTMLHeadingElement>(null), cta = useRef<HTMLButtonElement>(null);
  const reflection = useMemo(() => buildJourneyReflection(answers), [answers]);
  const recommendations = useMemo(() => reflection ? recommendClinicians(reflection, clinicians, language) : [], [reflection, clinicians, language]);
  const person = recommendations.find(candidate => candidate.slug === selectedSlug) || recommendations[0];
  const languages = [...new Set(clinicians.flatMap(candidate => candidate.languages))];
  const question = questionFor(step, answers);
  const totalQuestions = questionCount(answers);

  useEffect(() => { mounted.current = true; const activeTimers = timers.current; if (!initialized.current) { initialized.current = true; arrival.current = performance.now(); adapters.track("landing_view"); } return () => { mounted.current = false; activeTimers.forEach(clearTimeout); }; }, [adapters]);
  useEffect(() => { if (phase === "questions") void adapters.track("question_reached", { stepNumber: step + 1 }); }, [adapters, phase, step]);
  useEffect(() => { const view = `${phase}:${step}`; if (lastView.current === view) return; lastView.current = view; window.scrollTo({ top: 0, behavior: "instant" }); heading.current?.focus({ preventScroll: true }); }, [step, phase]);
  useEffect(() => {
    if (phase !== "result" || !cta.current) return;
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0.1 }); observer.observe(cta.current); return () => observer.disconnect();
  }, [phase, person?.slug, receipt]);

  function answer(value: string, detail: number) {
    if (answerLock.current || detail > 1) return;
    const next = updateJourney(answers, step, value); if (next === answers) return;
    answerLock.current = true; setAdvancing(true); setAnswers(next);
    if (!started.current) { started.current = true; adapters.track("checkin_started"); }
    adapters.track("question_completed", { stepNumber: step + 1 });
    timers.current.push(setTimeout(() => {
      if (step === questionCount(next) - 1 && buildJourneyReflection(next)) { setPhase("result"); setCompletionSeconds((performance.now() - arrival.current) / 1000); setSelectedSlug(undefined); adapters.track("checkin_completed"); adapters.track("result_viewed"); }
      else setStep(step + 1);
      timers.current.push(setTimeout(() => { answerLock.current = false; if (mounted.current) setAdvancing(false); }, 180));
    }, 180));
  }
  function request(placement: "offer" | "mobile" = "offer") {
    if (receipt) { setPanel(null); setPhase("confirmation"); return; }
    if (language !== "any") setConsultationLanguage(language);
    else if (person) setConsultationLanguage(person.languages.includes(consultationLanguage) ? consultationLanguage : person.languages[0]);
    adapters.track("consultation_cta_clicked", { placement }); adapters.track("consultation_started"); adapters.startForm(); setFailure(null); setPanel("request");
  }
  async function submit(token: string) {
    if (submitLock.current || receipt) return;
    submitLock.current = true; setPending(true); setFailure(null);
    const service = reflection?.couples ? "couples" : "individual";
    void adapters.track("request_attempted");
    try {
      const saved = await adapters.submit(callRequestPayload(draft, checkpointCode, person, consultationLanguage, service), token);
      if (!mounted.current) return;
      setReceipt({ person: person?.name || "a suitable therapist", language: consultationLanguage, service, referenceId: saved.referenceId });
      setPanel(null); setPhase("confirmation");
    } catch (error) { void adapters.track("request_failed"); if (mounted.current) setFailure(error instanceof Error ? error.message : "Please try again."); }
    finally { submitLock.current = false; if (mounted.current) setPending(false); }
  }
  function edit() { setStep(0); setPhase("questions"); }
  const action = receipt ? "View my request" : person ? `Talk with ${person.name.split(" ")[0]} for free` : "Request my free call";
  return <div className={styles.root} data-phase={phase} data-checkpoint-code={checkpointCode} data-funnel-version={CONVERSION_VERSION} data-completion-seconds={completionSeconds ?? ""}>
    <div className={styles.frame}>
      <header className={styles.header}><Image src="/valisen-logo.png" width={950} height={330} priority alt="Valisen Mental Health" /><span className={styles.private}><LockKeyhole size={13} aria-hidden="true" />PRIVATE CHECK-IN</span></header>
      <main>
        {phase === "questions" ? <div className={styles.entry}>
          {step === 0 ? <div className={styles.intro}><GlassBattery bars={answers.energy ? { energized: 4, okay: 3, low: 2, drained: 1 }[answers.energy] : 3} /><p className={styles.eyebrow}><Sparkles size={13} aria-hidden="true" />A moment to check in</p><h1>Check Your<em>Mental Battery</em></h1><p>Up to 4 quick questions · About 30 seconds · No account</p></div> : <div className={styles.compactIntro}><div><h1>A little space for you.</h1><p>Your reflection is {totalQuestions - step} {totalQuestions - step === 1 ? "answer" : "answers"} away.</p></div><GlassBattery bars={answers.energy ? { energized: 4, okay: 3, low: 2, drained: 1 }[answers.energy] : 3} /></div>}
          <section className={styles.quiz} data-question={step + 1} aria-labelledby="journey-heading">
            <div className={styles.progressText}><strong>{["Your energy", "What’s on your mind", "A little more personal", "Your everyday life"][step]}</strong><span>{step + 1} of {totalQuestions}</span></div>
            <div className={styles.progress} role="progressbar" aria-label="Check-in progress" aria-valuemin={0} aria-valuemax={totalQuestions} aria-valuenow={step} aria-valuetext={`Question ${step + 1} of ${totalQuestions}`}>{Array.from({ length: totalQuestions }, (_, index) => <span key={index} data-active={index <= step} />)}</div>
            <div className={styles.question}><h2 id="journey-heading" ref={heading} tabIndex={-1}>{question.title}</h2><p>{question.subtitle}</p>
              <fieldset className={`${styles.choices} ${step === 0 ? styles.energyChoices : step === 1 ? styles.topicChoices : styles.stacked}`}><legend className={styles.srOnly}>{question.title}</legend>{question.choices.map(choice => <button type="button" key={`${step}-${choice.value}`} className={styles.choice} data-answer={choice.value} disabled={advancing} aria-pressed={answers[question.key] === choice.value} onClick={event => answer(choice.value, event.detail)}><span className={styles.choiceIcon} aria-hidden="true">{answers[question.key] === choice.value ? <Check size={18} /> : <ChoiceIcon name={choice.icon} />}</span><span><strong>{choice.label}</strong>{choice.hint ? <small>{choice.hint}</small> : null}</span></button>)}</fieldset>
              <div className={styles.bottom}>{step > 0 ? <button type="button" className={styles.textButton} disabled={advancing} onClick={() => { if (!answerLock.current) setStep(step - 1); }}><ArrowLeft size={14} aria-hidden="true" />Back</button> : <span>No right or wrong answer.</span>}<span>Tap to continue</span></div>
            </div><p className={styles.privacyNote}><ShieldCheck size={13} aria-hidden="true" />Your answers stay on this device.</p>
          </section>
        </div> : null}

        {phase === "result" && reflection ? <div data-result-pathway={reflection.tag} data-result-bars={reflection.bars}>
          <section className={styles.resultIntro}><p className={styles.eyebrow}><Leaf size={13} aria-hidden="true" />Your mental battery, today</p><GlassBattery bars={reflection.bars} /><h1 ref={heading} tabIndex={-1}>{reflection.title}</h1><p>A snapshot of what you shared, not a diagnosis.</p></section>
          <div className={styles.resultGrid}>
            <div>
              <section className={styles.reflection}><p className={styles.eyebrow}>What’s on your mind</p><h2>{reflection.positive ? "A pause can be enough." : "Your starting point."}</h2><p>{reflection.summary}</p><div className={styles.chips}><span>{reflection.topic}</span></div><div className={styles.reflectionFoot}><span>Your result is yours to keep.</span><button type="button" className={styles.textButton} onClick={edit}>Edit answers</button></div></section>
              <div className={styles.extras}>
                <details><summary>One small thing to try today<ChevronDown size={17} aria-hidden="true" /></summary><p>{reflection.smallStep}</p></details>
                <details><summary>What could we talk about on the call?<ChevronDown size={17} aria-hidden="true" /></summary><p>The free call is a chance to ask about fit, rather than a full therapy session. You could ask about:</p><ul className={styles.callList}>{reflection.talkingPoints.map(point => <li key={point}><Check size={13} aria-hidden="true" />{point}</li>)}</ul></details>
                <details><summary>Not sure how to start?<ChevronDown size={17} aria-hidden="true" /></summary><blockquote>“{reflection.starter}”</blockquote><p>This is just for you. These words and your check-in answers aren’t attached to a request.</p></details>
                <details><summary>What if I’m not ready for therapy?<ChevronDown size={17} aria-hidden="true" /></summary><p>You can keep your reflection and stop here. A free conversation is another option if you want to ask questions, meet a therapist or explore what support could look like. You choose whether to continue afterward.</p></details>
              </div>
            </div>
            <section className={styles.offer} aria-labelledby="offer-heading"><p className={styles.offerTag}><MessageCircle size={14} aria-hidden="true" />FREE · {person?.consultationMinutes || 20} MINUTES · BY PHONE</p><h2 id="offer-heading">{reflection.supportTitle}</h2><p>{reflection.invitation}</p>{reflection.reassurance ? <p className={styles.offerReassurance}>{reflection.reassurance}</p> : null}
              <div className={styles.languageRow}><label htmlFor="result-language">Prefer another language?</label><select id="result-language" value={language} onChange={event => { setLanguage(event.target.value); setSelectedSlug(undefined); }}><option value="any">Any language</option>{languages.map(value => <option key={value}>{value}</option>)}</select></div>
              {person ? <article className={styles.person}><Image src={person.photo} width={67} height={82} alt={person.name} style={{ objectPosition: person.photoPosition }} /><div><strong>{person.name}</strong><p>{person.credential}</p>{person.reassurance?.[reflection.tag] ? <span className={styles.reputation} data-clinician-reassurance><Check size={12} aria-hidden="true" />{person.reassurance[reflection.tag]}</span> : null}<p>{person.languages.join(" · ")}</p><p className={styles.reason}>Suggested for: {reflection.label.toLowerCase()}.</p><button type="button" className={styles.textButton} onClick={() => { void adapters.track("therapist_options_opened"); setPanel("people"); }}>See therapist & other options</button></div></article> : <div className={styles.person}><p>No listed therapist combines this support area and language in the current roster. Our team can help you explore your options; this is not a guaranteed match.</p></div>}
              <button type="button" ref={cta} className={styles.primary} onClick={() => request()} data-primary-consultation>{action}<ArrowRight size={18} aria-hidden="true" /></button><p className={styles.assurance}>No payment details. No commitment to paid therapy.</p>
              <details className={styles.fees}><summary>Free call now. Paid therapy only if you choose.</summary><p>{reflection.couples ? "Couples therapy: $200 CAD total for both partners per 50-minute session." : `Individual therapy with ${person?.name || "our team"}: ${person?.fee || "$160–$180 per 50 minutes"}, CAD.`} Ongoing sessions are separate from your free consultation.</p><p>Virtual therapy across Ontario. Receipts for possible insurance reimbursement; coverage depends on your plan and therapist’s designation. No direct billing.</p></details>
            </section>
            <section className={styles.nextSteps}><h3>First, a conversation.</h3><p>Share your phone number. Our team will call within 24 hours to arrange your free call. Meet your therapist, ask questions, and decide together whether there’s a next step. The response promise is not a promise of an appointment within 24 hours.</p></section>
          </div>
        </div> : null}

        {phase === "confirmation" && receipt ? <section className={styles.receipt}><CircleCheck size={47} strokeWidth={1.4} aria-hidden="true" /><h1 ref={heading} tabIndex={-1}>You’ve taken the first step.</h1><p>Your free consultation request is saved.</p><div className={styles.receiptDetails}><p><strong>Free 20-minute phone consultation</strong></p><p>Therapist preference: {receipt.person}</p><p>Consultation language: {receipt.language}</p><p>Our team will call within 24 hours to arrange a time. The appointment time will be confirmed with you.</p></div><p className={styles.formSmall}>This is a request, not a confirmed appointment. Our team will help arrange your call.</p><button type="button" className={styles.textButton} onClick={() => setPhase("result")}><ArrowLeft size={15} aria-hidden="true" />Back to my reflection</button></section> : null}
      </main>
      <footer className={styles.footer}><p>A wellness reflection, not a clinical assessment or diagnosis.</p><div><button type="button" onClick={() => setPanel("privacy")}>Privacy</button><button type="button" onClick={() => setPanel("terms")}>About this experience</button><button type="button" onClick={() => setPanel("crisis")}>Need help now?</button></div><p>CHECKPOINT {checkpointCode}</p></footer>
    </div>
    {phase === "result" && !panel && !ctaVisible && !receipt ? <div className={styles.sticky}><button type="button" className={styles.primary} onClick={() => request("mobile")}>{action}<ArrowRight size={18} aria-hidden="true" /></button></div> : null}
    {panel ? <JourneyDialog key={panel} title={PANEL_TITLES[panel]} busy={pending} onClose={() => setPanel(null)}>
      {panel === "request" ? <RequestForm person={person} draft={draft} onChange={setDraft} onSubmit={submit} pending={pending} failure={failure} language={consultationLanguage} onLanguage={setConsultationLanguage} service={reflection?.couples ? "couples" : "individual"} onStart={() => { if (!formStarted.current) { formStarted.current = true; adapters.startForm(); } }} track={adapters.track} /> : null}
      {panel === "people" ? <div className={styles.panel}><p>These therapists list support for the area you chose. This is a starting point, rather than a clinical match or a guarantee of availability. Fit is something you explore together.</p><div className={styles.otherPeople}>{recommendations.map(candidate => <button type="button" key={candidate.slug} className={styles.personChoice} aria-pressed={candidate.slug === person?.slug} onClick={() => { setSelectedSlug(candidate.slug); void adapters.track("therapist_changed"); }}><Image src={candidate.photo} alt="" width={46} height={53} style={{ objectPosition: candidate.photoPosition }} /><span><strong>{candidate.name}</strong><small>{candidate.credential} · {candidate.languages.join(" / ")}</small>{reflection && candidate.reassurance?.[reflection.tag] ? <span className={styles.reputation} data-clinician-reassurance><Check size={12} aria-hidden="true" />{candidate.reassurance[reflection.tag]}</span> : null}<small>{candidate.registration}</small><small>{reflection?.couples ? "$200 CAD total / 50 minutes for both partners" : candidate.fee}</small></span>{candidate.slug === person?.slug ? <Check size={18} aria-hidden="true" /> : null}</button>)}</div><p className={styles.formNotice}>You can request {person?.name || "team assistance"}. Our team will confirm service fit and availability with you before the call.</p><button type="button" className={styles.primary} onClick={() => request()}>{action}<ArrowRight size={18} aria-hidden="true" /></button></div> : null}
      {panel === "privacy" ? <div className={styles.panel}><h3>Your check-in stays on your device.</h3><p>Your answers, reflection and suggested support pathway stay in this page’s temporary memory. They aren’t saved, attached to a request, or sent to advertising or AI services.</p><h3>Anonymous progress, separate from your answers</h3><p>We track which question screens and form fields are reached or completed, and whether a call is requested. Anonymous session identifiers and progress milestones help us improve this experience and attribute requests to the original checkpoint location. They do not include your answers, selected concern or field values. Anonymous identifiers use session storage; quiz answers do not.</p><h3>Requesting a call is your choice.</h3><p>If you submit the form, your name, required phone number, selected therapist, consultation language, individual/couples service and consent are securely saved for authorized Valisen staff and sent to the clinic to arrange your call. Your check-in answers and generated conversation starter aren’t attached. No marketing subscription.</p><p>You can ask to access or correct your information, withdraw permission to contact you, or raise privacy concerns at <a href="mailto:info@valisenmentalhealth.com">info@valisenmentalhealth.com</a> or <a href="tel:6137070333">613-707-0333</a>.</p><a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Read the clinic privacy policy</a></div> : null}
      {panel === "terms" ? <TermsPanel /> : null}{panel === "crisis" ? <CrisisPanel /> : null}
    </JourneyDialog> : null}
  </div>;
}
