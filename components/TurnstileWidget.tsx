"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light" | "dark" | "auto";
      size: "normal" | "compact" | "flexible";
      appearance: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const DEVELOPMENT_SITE_KEY = "1x00000000000000000000AA";

export default function TurnstileWidget({
  action,
  onToken,
  resetKey = 0,
}: {
  action: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [challengeError, setChallengeError] = useState(false);
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    (process.env.NODE_ENV !== "production" ? DEVELOPMENT_SITE_KEY : "");

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    containerRef.current.replaceChildren();
    setChallengeError(false);
    onToken(null);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      size: "flexible",
      appearance: "always",
      callback: (token) => {
        setChallengeError(false);
        onToken(token);
      },
      "expired-callback": () => onToken(null),
      "error-callback": () => {
        setChallengeError(true);
        onToken(null);
      },
    });
  }, [action, onToken, siteKey]);

  useEffect(() => {
    if (scriptReady || window.turnstile) renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, resetKey, scriptReady]);

  if (!siteKey) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
        Secure verification is temporarily unavailable. Please call 613-707-0333.
      </div>
    );
  }

  return (
    <div>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />
      <div
        id={`turnstile-${reactId.replace(/:/g, "")}`}
        ref={containerRef}
        className="min-h-[65px] w-full overflow-hidden rounded-xl"
        aria-label="Automated spam protection"
      />
      {challengeError ? (
        <p role="alert" className="mt-2 text-[12px] text-red-700">
          Verification could not load. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}
