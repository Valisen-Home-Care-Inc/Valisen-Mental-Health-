"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const NAVIGATION = [
  {
    href: "/admin/checkpoints",
    label: "Checkpoints",
    icon: Activity,
    active: (pathname: string) =>
      pathname === "/admin/checkpoints" || /^\/admin\/checkpoints\/VMH-/.test(pathname),
  },
  {
    href: "/admin/checkpoints/quiz",
    label: "Quiz analytics",
    icon: BarChart3,
    active: (pathname: string) => pathname.startsWith("/admin/checkpoints/quiz"),
  },
  {
    href: "/admin/checkpoints/consultations",
    label: "Consultations",
    icon: ClipboardList,
    active: (pathname: string) => pathname.startsWith("/admin/checkpoints/consultations"),
  },
] as const;

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/admin/checkpoints/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#172322]">
      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#f9faf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1680px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:flex-nowrap sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#153f3e] text-white shadow-[0_8px_24px_rgba(21,63,62,0.18)]">
              <BriefcaseBusiness size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.2px]">
                Valisen Intelligence
              </p>
              <p className="truncate text-[11px] text-[#667371]">Growth &amp; consultations</p>
            </div>
          </div>

          <nav aria-label="Valisen operations" className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const active = item.active(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[12px] font-medium no-underline transition lg:px-3.5 lg:text-[13px] ${
                    active
                      ? "bg-white text-[#153f3e] shadow-[0_1px_8px_rgba(0,0,0,0.07)]"
                      : "text-[#667371] hover:bg-white/70 hover:text-[#153f3e]"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#4d5a58] shadow-sm transition hover:border-black/15 hover:text-[#153f3e] disabled:opacity-60"
          >
            {signingOut ? (
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={14} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
