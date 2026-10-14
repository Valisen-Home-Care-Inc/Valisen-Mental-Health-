"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import styles from "./JourneyDialog.module.css";

export default function JourneyDialog({ title, children, onClose, busy = false }: {
  title: string; children: React.ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const overflow = document.body.style.overflow;
    element.showModal();
    element.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <header className={styles.dialogHeader}>
      <h2 id={titleId}>{title}</h2>
      <button type="button" className={styles.iconButton} aria-label="Close panel" onClick={onClose} disabled={busy}><X size={21} aria-hidden="true" /></button>
    </header>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
