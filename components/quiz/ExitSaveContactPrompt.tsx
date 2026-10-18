"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, UserPlus, X } from "lucide-react";
import {
  VALISEN_CARE_MARK_PATH,
  VALISEN_CARE_NAME,
  VALISEN_CARE_PHONE_DISPLAY,
  VALISEN_CARE_VCARD_PATH,
  WHATSAPP_URL,
} from "@/lib/valisenCare";
import styles from "./ResultsReveal.module.css";

const SHOWN_KEY = "valisen.quiz.exitPromptShown";
/** Do not interrupt someone who has only just arrived on their results. */
const MIN_DWELL_MS = 8000;

function alreadyShown(): boolean {
  try {
    return window.sessionStorage.getItem(SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberShown() {
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "true");
  } catch {
    // Without storage the prompt can still only open once per page view.
  }
}

/**
 * Desktop-only "before you go" prompt to save the discreet Valisen Care
 * contact. Phones have no reliable exit signal, so they get the in-page band
 * and sticky bar instead. It never opens for someone shown crisis resources
 * or someone who has already booked.
 */
export default function ExitSaveContactPrompt({
  enabled,
  onShown,
  onSave,
  onWhatsApp,
  onDismiss,
}: {
  enabled: boolean;
  onShown?: () => void;
  onSave?: () => void;
  onWhatsApp?: () => void;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(false);
  // Latest callbacks without re-arming the exit listener on every render.
  const callbacks = useRef({ onShown, onDismiss });
  useEffect(() => {
    callbacks.current = { onShown, onDismiss };
  }, [onShown, onDismiss]);

  function dismiss() {
    setOpen(false);
    callbacks.current.onDismiss?.();
  }

  useEffect(() => {
    if (!enabled || openedRef.current) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || alreadyShown()) return;
    const armedAt = Date.now();
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget !== null || event.clientY > 0) return;
      if (Date.now() - armedAt < MIN_DWELL_MS || openedRef.current || alreadyShown()) return;
      openedRef.current = true;
      rememberShown();
      setOpen(true);
      callbacks.current.onShown?.();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  if (!open) return null;

  return (
    <div className={styles.exitOverlay} onClick={(event) => event.target === event.currentTarget && dismiss()}>
      <div role="dialog" aria-modal="true" aria-labelledby="exit-save-title" className={styles.exitDialog}>
        <button ref={closeRef} type="button" className={styles.exitClose} aria-label="Close" onClick={dismiss}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className={styles.contactPreview} aria-hidden="true">
          <span className={styles.saveIcon}>
            <Image src={VALISEN_CARE_MARK_PATH} alt="" width={44} height={46} />
          </span>
          <div>
            <strong>{VALISEN_CARE_NAME}</strong>
            <span>mobile · {VALISEN_CARE_PHONE_DISPLAY}</span>
          </div>
        </div>
        <p className={styles.eyebrow}>Before you go</p>
        <h2 id="exit-save-title">Keep Valisen Care one tap away</h2>
        <p>Save us to your phone, so help is easy to find whenever you need it.</p>
        <ul className={styles.exitList}>
          <li><span aria-hidden="true"><Check size={12} strokeWidth={3.4} /></span><span><strong>A direct line to a care coordinator</strong> for help choosing a therapist, booking or checking your coverage</span></li>
          <li><span aria-hidden="true"><Check size={12} strokeWidth={3.4} /></span><span><strong>Your free 20-minute consultation,</strong> whenever you’re ready</span></li>
          <li><span aria-hidden="true"><Check size={12} strokeWidth={3.4} /></span><span><strong>Message us on WhatsApp</strong> if calling feels like too much</span></li>
        </ul>
        <div className={styles.exitActions}>
          <a
            href={VALISEN_CARE_VCARD_PATH}
            download="Valisen Care.vcf"
            className={styles.exitPrimary}
            onClick={() => {
              setOpen(false);
              onSave?.();
            }}
          >
            <UserPlus size={19} aria-hidden="true" />
            Save to my contacts
          </a>
          <div className={styles.exitSecondary}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp}>WhatsApp us</a>
            <button type="button" onClick={dismiss}>No thanks</button>
          </div>
        </div>
        <p className={styles.exitFine}>Saves as “Valisen Care”, a discreet name in your contacts. In an emergency, call or text 9-8-8.</p>
      </div>
    </div>
  );
}
