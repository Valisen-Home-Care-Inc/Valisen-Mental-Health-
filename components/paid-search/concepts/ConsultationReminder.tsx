"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowRight, X } from "lucide-react";
import { landingTranslator, type LandingLocale } from "@/lib/paidSearchLocale";
import { PREVIEW_REMINDER, PREVIEW_REMINDER_KEY, PREVIEW_BOOKING_KEY, previewSessionHas, previewSessionMark, recordConceptPreviewEvent, reminderEligible } from "@/lib/paidSearchPreviewExperience";
import styles from "./ConceptLanding.module.css";

export default function ConsultationReminder({ conceptSlug, locale, therapistName, bookingRef, bookingStarted, onChoose }: { conceptSlug: string; locale: LandingLocale; therapistName: string; bookingRef: RefObject<HTMLElement>; bookingStarted: boolean; onChoose: (placement: "reminder" | "mobile") => void }) {
  const [desktopVisible, setDesktopVisible] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const shown = useRef(false);
  const started = useRef(bookingStarted);
  const activeMs = useRef(0);
  const t = landingTranslator(locale);
  const context = useRef({ locale, conceptSlug });
  useEffect(() => { context.current = { locale, conceptSlug }; }, [locale, conceptSlug]);
  useEffect(() => { started.current = bookingStarted; if (bookingStarted) { setDesktopVisible(false); setMobileVisible(false); previewSessionMark(PREVIEW_BOOKING_KEY); } }, [bookingStarted]);
  useEffect(() => {
    const enabled = PREVIEW_REMINDER.enabled && new URLSearchParams(location.search).get("reminder") !== "off";
    let last = performance.now();
    let wasVisible = document.visibilityState === "visible" && document.hasFocus();
    const update = () => {
      const now = performance.now();
      const visible = document.visibilityState === "visible" && document.hasFocus();
      if (wasVisible && visible) activeMs.current += Math.min(now - last, 2000);
      last = now; wasVisible = visible;
      const rect = bookingRef.current?.getBoundingClientRect();
      const bookingVisible = Boolean(rect && rect.top < innerHeight && rect.bottom > 0);
      const therapists = document.getElementById("your-therapist")?.getBoundingClientRect();
      const overlayOpen = Boolean(document.querySelector("dialog[open]"));
      const fieldFocused = Boolean(document.activeElement?.matches("input, select, textarea"));
      const keyboardOpen = Boolean(window.visualViewport && window.visualViewport.height < innerHeight * .75);
      const suppressed = started.current || previewSessionHas(PREVIEW_BOOKING_KEY);
      const desktop = matchMedia("(min-width: 901px)").matches;
      const eligible = reminderEligible({ enabled, desktop, activeMs: activeMs.current, delayMs: PREVIEW_REMINDER.activeDelayMs, passedTherapists: Boolean(therapists && therapists.bottom < 0), bookingVisible, bookingStarted: suppressed, alreadyShown: shown.current || previewSessionHas(PREVIEW_REMINDER_KEY), overlayOpen });
      if (eligible && visible && !fieldFocused) {
        shown.current = true; previewSessionMark(PREVIEW_REMINDER_KEY); setDesktopVisible(true);
        recordConceptPreviewEvent("reminder_exposed", context.current.conceptSlug, "reminder", context.current.locale);
      }
      if (bookingVisible || suppressed || overlayOpen || !desktop || fieldFocused) setDesktopVisible(false);
      const hero = document.getElementById("landing-hero")?.getBoundingClientRect();
      setMobileVisible(enabled && !desktop && Boolean(hero && hero.bottom < 0) && !bookingVisible && !suppressed && !overlayOpen && !fieldFocused && !keyboardOpen);
    };
    update(); const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update); window.addEventListener("blur", update);
    window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update); document.addEventListener("visibilitychange", update); document.addEventListener("focusin", update); document.addEventListener("focusout", update); window.visualViewport?.addEventListener("resize", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); window.removeEventListener("blur", update); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); document.removeEventListener("visibilitychange", update); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); window.visualViewport?.removeEventListener("resize", update); };
  }, [bookingRef]);
  function choose(placement: "reminder" | "mobile") {
    if (placement === "reminder") recordConceptPreviewEvent("reminder_clicked", conceptSlug, placement, locale);
    setDesktopVisible(false); setMobileVisible(false); onChoose(placement);
  }
  return <>
    {desktopVisible ? <aside className={styles.cornerInvitation} aria-label={t("Free consultation invitation")}>
      <button type="button" className={styles.dismissInvitation} aria-label={t("Dismiss invitation")} onClick={(event) => { recordConceptPreviewEvent("reminder_dismissed", conceptSlug, "reminder", locale); setDesktopVisible(false); if (document.activeElement === event.currentTarget) document.getElementById("fees-and-questions")?.focus({ preventScroll: true }); }}><X size={20} /></button>
      <h2>{t("Meet {name} before deciding.", { name: therapistName })}</h2>
      <p>{t("Book a free 20-minute call to ask questions and see whether working together feels right.")}</p>
      <button type="button" className={styles.primaryButton} onClick={() => choose("reminder")}>{t("Choose a time")}<ArrowRight size={16} /></button>
    </aside> : null}
    {mobileVisible ? <div className={styles.mobileSticky}><span>{t("20 minutes. No obligation.")}</span><button type="button" onClick={() => choose("mobile")}>{t("Book a free consultation")}<ArrowRight size={16} /></button></div> : null}
  </>;
}
