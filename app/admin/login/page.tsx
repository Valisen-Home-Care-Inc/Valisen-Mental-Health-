import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BatteryCharging, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import {
  getCheckpointAdminPageSession,
  sanitizeCheckpointAdminReturnPath,
} from "@/lib/server/checkpointAdminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkpoint Admin Sign In",
  description: "Secure access to Valisen Mental Health checkpoint analytics.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function CheckpointAdminLoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedNext = Array.isArray(resolvedSearchParams?.next)
    ? resolvedSearchParams?.next[0]
    : resolvedSearchParams?.next;
  const nextPath = sanitizeCheckpointAdminReturnPath(requestedNext);

  if (await getCheckpointAdminPageSession()) redirect(nextPath);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef3ef] text-[#173536]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.44]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(25,76,74,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(25,76,74,.055) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom,black,transparent 78%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-28 top-[-170px] h-[480px] w-[480px] rounded-full bg-[#b7d8cc]/55 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-36 bottom-[-220px] h-[520px] w-[520px] rounded-full bg-[#c7ded6]/60 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2a7f7f]"
            aria-label="Valisen Mental Health home"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#123f40] text-white shadow-[0_8px_22px_rgba(18,63,64,.18)]">
              <span className="font-serif text-[20px] leading-none">V</span>
            </span>
            <span>
              <span className="block text-[14px] font-semibold tracking-[-0.02em] text-[#173536]">
                Valisen Mental Health
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6e8580]">
                Operations
              </span>
            </span>
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-[#bfcfca] bg-white/55 px-3 py-1.5 text-[11px] font-medium text-[#55716d] backdrop-blur sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#58a488] shadow-[0_0_0_3px_rgba(88,164,136,.13)]" />
            Private admin area
          </span>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1fr_470px] lg:gap-20 lg:py-16">
          <section className="hidden max-w-[570px] lg:block" aria-labelledby="login-context-title">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bad0c9] bg-white/55 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3e6d65] backdrop-blur">
              <BatteryCharging size={14} aria-hidden="true" />
              Mental Battery Checkpoints
            </div>
            <h1
              id="login-context-title"
              className="mt-7 max-w-[540px] font-serif text-[49px] font-medium leading-[1.04] tracking-[-0.035em] text-[#173536] xl:text-[56px]"
            >
              A clear signal from every checkpoint.
            </h1>
            <p className="mt-6 max-w-[510px] text-[15px] leading-7 text-[#5f7470]">
              Securely review anonymous campaign performance, compare placements, and coordinate
              the consultation requests people intentionally submit.
            </p>

            <div className="mt-10 grid max-w-[500px] grid-cols-3 gap-3" aria-hidden="true">
              {["Sessions", "Check-ins", "Intent"].map((label, index) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/70 bg-white/48 px-4 py-4 shadow-[0_8px_28px_rgba(24,61,58,.04)] backdrop-blur"
                >
                  <div className="mb-5 flex h-7 items-end gap-1">
                    {[36, 55, 42, 73, 62].map((height, barIndex) => (
                      <span
                        key={barIndex}
                        className={`w-full rounded-sm ${barIndex === 3 && index === 1 ? "bg-[#c78558]" : "bg-[#79aa9c]"}`}
                        style={{ height: `${Math.max(22, height - index * 7)}%` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c817d]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="mx-auto w-full max-w-[470px] rounded-[26px] border border-white/90 bg-[#fbfcfa]/95 p-6 shadow-[0_28px_80px_rgba(24,63,59,.13)] backdrop-blur-xl sm:p-9"
            aria-labelledby="admin-sign-in-title"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6e8d86]">
                  Authorized access
                </p>
                <h2
                  id="admin-sign-in-title"
                  className="mt-2.5 font-serif text-[32px] font-medium leading-tight tracking-[-0.025em] text-[#173536]"
                >
                  Welcome back
                </h2>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#d8e4df] bg-[#edf5f1] text-[#2a7169]">
                <LockKeyhole size={19} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-[#687b78]">
              Sign in to the internal checkpoint analytics and placement dashboard.
            </p>

            <LoginForm nextPath={nextPath} />

            <div className="mt-7 border-t border-[#e1e9e5] pt-5">
              <p className="flex items-start gap-2.5 text-[11px] leading-5 text-[#71817e]">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#4b8b7c]" aria-hidden="true" />
                This area has no public registration. Access is protected by an eight-hour,
                signed server session.
              </p>
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#cbd9d4]/80 pt-5 text-[10px] font-medium text-[#738681] sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg transition hover:text-[#285f5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7f7f]"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Return to public website
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <Check size={12} className="text-[#4f8e7d]" aria-hidden="true" />
            No clinical answers are stored in checkpoint analytics
          </span>
        </footer>
      </div>
    </main>
  );
}
