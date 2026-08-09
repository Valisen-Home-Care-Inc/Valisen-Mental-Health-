"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useCallback, useId, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

type LoginFormProps = {
  nextPath: string;
};

type SessionResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
};

export default function LoginForm({ nextPath }: LoginFormProps) {
  const passwordId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((current) => current + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || !turnstileToken || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/checkpoints/session?next=${encodeURIComponent(nextPath)}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, turnstileToken }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as SessionResponse;
      if (!response.ok || !body.ok) {
        setError(body.error || "We couldn’t sign you in. Please try again.");
        resetTurnstile();
        return;
      }

      window.location.assign(body.redirectTo || nextPath);
    } catch {
      setError("We couldn’t reach the secure sign-in service. Check your connection and try again.");
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8" aria-busy={submitting} noValidate>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={passwordId}
          className="text-[13px] font-semibold tracking-[-0.01em] text-[#263c3c]"
        >
          Admin password
        </label>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#71807d]">
          <LockKeyhole size={12} aria-hidden="true" />
          Encrypted sign-in
        </span>
      </div>

      <div className="relative mt-2.5">
        <input
          id={passwordId}
          name="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-[54px] w-full rounded-[14px] border border-[#cfdbd7] bg-white px-4 pr-12 text-[15px] text-[#183535] shadow-[0_1px_2px_rgba(23,53,53,0.03)] outline-none transition placeholder:text-[#9ba8a5] hover:border-[#aec4bf] focus:border-[#2a7f7f] focus:ring-4 focus:ring-[#2a7f7f]/10"
          placeholder="Enter your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[#71807d] transition hover:bg-[#eef4f1] hover:text-[#285f5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2a7f7f]"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-5">
        <TurnstileWidget
          action="checkpoint_admin_login"
          onToken={handleTurnstileToken}
          resetKey={turnstileResetKey}
        />
      </div>

      <div className="min-h-[45px] pt-2.5">
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="rounded-xl border border-[#e8c7bd] bg-[#fff5f1] px-3.5 py-2.5 text-[12px] leading-5 text-[#9a432d]"
          >
            {error}
          </p>
        ) : (
          <p className="text-[11px] leading-5 text-[#7c8987]">
            Sessions close automatically after eight hours.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!password || !turnstileToken || submitting}
        className="group mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#123f40] px-5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(18,63,64,0.19)] transition duration-200 hover:-translate-y-px hover:bg-[#0d3435] hover:shadow-[0_14px_34px_rgba(18,63,64,0.24)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
      >
        {submitting ? (
          <>
            <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
            Verifying…
          </>
        ) : (
          <>
            <ShieldCheck size={17} aria-hidden="true" />
            Open checkpoint dashboard
          </>
        )}
      </button>
    </form>
  );
}
