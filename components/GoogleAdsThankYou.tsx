"use client";

import { Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { stageGoogleAdsClickAttributionForConversion } from "@/lib/campaignAttribution";
import {
  captureGoogleAdsJourneyFromUrl,
  clearGoogleAdsConversionReceipt,
  consumeGoogleAdsConversionReceiptFromUrl,
  getGoogleAdsJourneyToken,
} from "@/lib/googleAdsJourney";
import {
  emitGoogleAdsConversionOnce,
  flushGoogleAdsEvents,
  hasConfirmedGoogleAdsThankYou,
  markGoogleAdsThankYouConfirmed,
  recordGoogleAdsEvent,
  startGoogleAdsTracking,
} from "@/lib/googleAdsTracking";

type ConfirmationState = "checking" | "confirmed";

export default function GoogleAdsThankYou() {
  const [state, setState] = useState<ConfirmationState>("checking");

  useEffect(() => {
    let cancelled = false;
    let kickoffTimer: number | undefined;
    let retryTimer: number | undefined;
    let retryInFlight = false;
    let retryAttempt = 0;
    let backgroundRetryEnabled = false;
    let thankYouRecorded = false;
    let conversionApplied = false;
    const retryDeadline = Date.now() + 14 * 60 * 1_000;
    captureGoogleAdsJourneyFromUrl();
    const journeyToken = getGoogleAdsJourneyToken();
    const conversionReceipt = consumeGoogleAdsConversionReceiptFromUrl();

    const showThankYou = () => {
      if (thankYouRecorded || cancelled) return;
      thankYouRecorded = true;
      startGoogleAdsTracking();
      recordGoogleAdsEvent("thank_you_viewed");
      void flushGoogleAdsEvents();
      setState("confirmed");
    };

    const applyConfirmedConversion = (conversionId: string) => {
      if (conversionApplied || cancelled) return;
      conversionApplied = true;
      backgroundRetryEnabled = false;
      clearGoogleAdsConversionReceipt();
      const clearStagedClickAttribution =
        stageGoogleAdsClickAttributionForConversion();
      let fallbackTimer: number | undefined;
      const clearStaged = () => {
        window.removeEventListener(
          "valisen:google-ads-tags-initialized",
          clearStaged,
        );
        if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
        clearStagedClickAttribution();
      };
      window.addEventListener(
        "valisen:google-ads-tags-initialized",
        clearStaged,
        { once: true },
      );
      // Slow or blocked tag requests must not leave click IDs visible forever.
      fallbackTimer = window.setTimeout(clearStaged, 60_000);
      if (!markGoogleAdsThankYouConfirmed(conversionId)) {
        clearStaged();
        return;
      }
      emitGoogleAdsConversionOnce();
      void flushGoogleAdsEvents();
    };

    const confirm = async (): Promise<
      | { kind: "confirmed"; conversionId: string }
      | { kind: "retry" }
      | { kind: "terminal" }
    > => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch("/thank-you/confirm", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ journeyToken, conversionReceipt }),
        });
        const body = (await response.json().catch(() => null)) as
          | { ok?: boolean; conversionId?: unknown }
          | null;
        if (
          response.ok &&
          body?.ok &&
          typeof body.conversionId === "string" &&
          /^gac-[a-f0-9]{32}$/.test(body.conversionId)
        ) {
          return { kind: "confirmed", conversionId: body.conversionId };
        }
        return response.status === 429 || response.status >= 500
          ? { kind: "retry" }
          : { kind: "terminal" };
      } catch {
        return { kind: "retry" };
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const scheduleBackgroundRetry = (delayMs: number) => {
      if (
        !backgroundRetryEnabled ||
        cancelled ||
        Date.now() >= retryDeadline ||
        retryTimer !== undefined
      ) {
        return;
      }
      retryTimer = window.setTimeout(async () => {
        retryTimer = undefined;
        if (
          cancelled ||
          retryInFlight ||
          Date.now() >= retryDeadline ||
          navigator.onLine === false ||
          document.visibilityState === "hidden"
        ) {
          scheduleBackgroundRetry(5_000);
          return;
        }
        retryInFlight = true;
        const result = await confirm();
        retryInFlight = false;
        if (cancelled) return;
        if (result.kind === "confirmed") {
          applyConfirmedConversion(result.conversionId);
          return;
        }
        if (result.kind === "terminal") {
          backgroundRetryEnabled = false;
          clearGoogleAdsConversionReceipt();
          return;
        }
        retryAttempt += 1;
        scheduleBackgroundRetry(
          Math.min(60_000, 3_000 * 2 ** Math.min(5, retryAttempt)),
        );
      }, delayMs);
    };

    const wakeRetry = () => {
      if (
        backgroundRetryEnabled &&
        document.visibilityState !== "hidden" &&
        navigator.onLine !== false
      ) {
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
        retryTimer = undefined;
        scheduleBackgroundRetry(0);
      }
    };
    window.addEventListener("online", wakeRetry);
    document.addEventListener("visibilitychange", wakeRetry);

    // Defer startup by one task so React's development-only effect replay can
    // cleanly cancel its probe without consuming a one-time confirmation.
    kickoffTimer = window.setTimeout(() => {
      if (cancelled) return;
      const previouslyConfirmed = hasConfirmedGoogleAdsThankYou();
      void (async () => {
        if (previouslyConfirmed) {
          clearGoogleAdsConversionReceipt();
          showThankYou();
          return;
        }
        if (!journeyToken || !conversionReceipt) {
          window.location.replace("/consultation");
          return;
        }
        for (const delayMs of [0, 500, 1_500]) {
          if (delayMs) {
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, delayMs),
            );
          }
          const result = await confirm();
          if (result.kind === "confirmed") {
            showThankYou();
            applyConfirmedConversion(result.conversionId);
            return;
          }
          if (result.kind === "terminal") {
            clearGoogleAdsConversionReceipt();
            showThankYou();
            return;
          }
        }
        // The intake is already durable. Keep showing success while bounded
        // background retries recover a temporary claim outage.
        showThankYou();
        backgroundRetryEnabled = true;
        scheduleBackgroundRetry(3_000);
      })();
    }, 0);

    return () => {
      cancelled = true;
      if (kickoffTimer !== undefined) window.clearTimeout(kickoffTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener("online", wakeRetry);
      document.removeEventListener("visibilitychange", wakeRetry);
    };
  }, []);

  if (state === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="text-center" role="status" aria-live="polite">
          <LoaderCircle
            className="mx-auto animate-spin text-teal motion-reduce:animate-none"
            size={34}
            aria-hidden="true"
          />
          <p className="mt-4 text-sm text-ink-secondary">
            Confirming your request…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <NavBar hideBookingCta />
      <section className="bg-canvas px-5 py-16 sm:py-24">
        <div className="container-v max-w-[760px]">
          <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_6px_44px_rgba(0,0,0,0.09)] sm:px-12 sm:py-16">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal text-white">
              <Check size={32} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[1.5px] text-teal-dark">
              Request received
            </p>
            <h1 className="mt-3 font-serif text-[38px] font-medium leading-[1.08] tracking-[-1.3px] text-ink sm:text-[48px]">
              Thank you. Your request is in.
            </h1>
            <p className="mx-auto mt-5 max-w-[570px] text-[15px] leading-7 text-ink-secondary sm:text-base">
              A member of the Valisen team will contact you within one business
              day to coordinate your free consultation. Your requested time is
              a preference until our team confirms it with you.
            </p>
            <div className="mx-auto mt-8 max-w-[540px] rounded-2xl border border-[#cfe0da] bg-[#f3f8f5] px-5 py-5 text-left">
              <p className="text-sm font-semibold text-ink">What happens next</p>
              <p className="mt-1 text-[13px] leading-6 text-ink-secondary">
                Please watch your email and phone for our response. If you need
                to reach us sooner, call the intake line at{" "}
                <a className="font-semibold text-teal-dark" href="tel:613-707-0333">
                  613-707-0333
                </a>
                .
              </p>
            </div>
            <Link
              href="/"
              onClick={(event) => {
                event.preventDefault();
                // A document navigation unloads the conversion-only GTM
                // container before returning to ordinary site analytics.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign("/");
              }}
              className="btn-primary mt-8 inline-flex min-h-12 items-center justify-center px-7 no-underline"
            >
              Return to the Valisen home page
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
