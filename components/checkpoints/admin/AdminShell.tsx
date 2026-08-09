"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BatteryCharging, LogOut, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

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
        <div className="mx-auto flex min-h-[68px] max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#153f3e] text-white shadow-[0_8px_24px_rgba(21,63,62,0.18)]">
              <BatteryCharging size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.2px]">
                Mental Battery
              </p>
              <p className="truncate text-[11px] text-[#667371]">Valisen operations</p>
            </div>
          </div>

          <nav aria-label="Checkpoint administration" className="hidden items-center gap-1 sm:flex">
            <Link
              href="/admin/checkpoints"
              className={`inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium no-underline transition ${
                pathname.startsWith("/admin/checkpoints")
                  ? "bg-white text-[#153f3e] shadow-[0_1px_8px_rgba(0,0,0,0.07)]"
                  : "text-[#667371] hover:bg-white/70 hover:text-[#153f3e]"
              }`}
            >
              <Activity size={15} aria-hidden="true" />
              Checkpoints
            </Link>
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
