"use client";

import { Check, Clock3, Phone } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import CrisisNote from "@/components/CrisisNote";
import { consumeWelcomeThankYou } from "@/components/paid-search/thankYouHandoff";

const PHONE_NUMBER = "613-707-0333";
const PHONE_HREF = "tel:613-707-0333";

/**
 * Confirmation screen for consultation requests sent from /welcome.
 *
 * This is intentionally separate from /thank-you: that page is gated on a
 * one-use signed conversion receipt and is what fires the Google Ads
 * conversion, so it must stay unreachable without a genuine receipt. This
 * page carries no conversion tag and simply guarantees that every successful
 * submission ends on a real thank-you screen.
 */
export default function PaidSearchThankYou() {
  const [reference, setReference] = useState<string | null>(null);
  const consumedRef = useRef(false);

  useEffect(() => {
    // Reading clears the handoff, so guard against a second invocation
    // (React StrictMode runs effects twice in development) overwriting the
    // reference with the now-empty result.
    if (consumedRef.current) return;
    consumedRef.current = true;
    setReference(consumeWelcomeThankYou());
  }, []);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-black/[0.07] bg-white/95">
        <div className="container-v flex min-h-[66px] items-center py-2.5 md:min-h-[76px]">
          <a href="/welcome" className="inline-flex items-center no-underline" aria-label="Valisen Mental Health">
            <Image
              src="/valisen-logo.png"
              alt="Valisen Mental Health"
              width={950}
              height={330}
              className="h-8 w-auto object-contain md:h-10"
              priority
            />
          </a>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="container-v max-w-[760px]">
          <div className="rounded-[24px] bg-white px-6 py-11 text-center shadow-[0_6px_44px_rgba(0,0,0,0.09)] sm:px-12 sm:py-14">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal text-white">
              <Check size={32} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[1.5px] text-teal-dark">
              Request received
            </p>
            <h1 className="mt-3 font-serif text-[32px] font-medium leading-[1.08] tracking-[-1.3px] text-ink sm:text-[46px]">
              Thank you. Your request is in.
            </h1>
            <p className="mx-auto mt-5 max-w-[570px] text-[15px] leading-7 text-ink-secondary sm:text-base">
              A member of the Valisen team will contact you within 24 hours to
              coordinate your free consultation. Your requested time is a
              preference until our team confirms it with you.
            </p>

            <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-pill bg-teal-xlight px-4 py-1.5 text-[12px] font-semibold text-teal-dark">
              <Clock3 size={14} aria-hidden="true" /> We reply within 24 hours, not weeks
            </p>

            <div className="mx-auto mt-8 max-w-[540px] rounded-2xl border border-[#cfe0da] bg-[#f3f8f5] px-5 py-5 text-left">
              <p className="text-sm font-semibold text-ink">What happens next</p>
              <p className="mt-1 text-[13px] leading-6 text-ink-secondary">
                Please watch your email and phone for our response. If you need to
                reach us sooner, call the intake line at{" "}
                <a className="font-semibold text-teal-dark" href={PHONE_HREF}>
                  {PHONE_NUMBER}
                </a>
                .
              </p>
              {reference ? (
                <p className="mt-3 border-t border-[#cfe0da] pt-3 text-[12px] text-ink-secondary">
                  Reference: <strong className="text-ink">{reference}</strong>
                </p>
              ) : null}
            </div>

            <a
              href={PHONE_HREF}
              className="btn-primary mt-8 inline-flex min-h-12 items-center justify-center px-7 no-underline"
              aria-label={`Call Valisen Mental Health at ${PHONE_NUMBER}`}
            >
              <Phone size={16} className="mr-2" aria-hidden="true" />
              Call {PHONE_NUMBER}
            </a>
          </div>

          <div className="mt-8 text-center">
            <CrisisNote className="mx-auto max-w-[560px]" />
          </div>
        </div>
      </section>
    </main>
  );
}
