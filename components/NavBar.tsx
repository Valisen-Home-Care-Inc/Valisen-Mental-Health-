"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/services#insurance", label: "Insurance" },
  { href: "/about", label: "About" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b-[0.5px] border-hairline-light bg-white">
      <div className="mx-auto flex max-w-container items-center justify-between px-6 py-[18px] md:px-8">
        <Logo />

        <ul className="hidden items-center gap-7 text-[14px] text-ink md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-inherit no-underline hover:text-teal">
                {link.label}
              </Link>
            </li>
          ))}
          <li className="h-[18px] w-[0.5px] bg-black/15" aria-hidden="true" />
          <li className="text-ink-secondary">EN</li>
          <li>
            <Link href="/intake" className="btn-dark">
              Get matched <span aria-hidden="true">&rarr;</span>
            </Link>
          </li>
        </ul>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-full border border-black/10 md:hidden"
          onClick={() => setOpen((current) => !current)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6 L18 18 M18 6 L6 18" stroke="#2C2C2C" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7 H20 M4 12 H20 M4 17 H20" stroke="#2C2C2C" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-hairline-light bg-white md:hidden">
          <ul className="flex flex-col gap-1 px-6 py-4 text-[15px]">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block py-2 text-ink no-underline"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/intake"
                className="btn-dark w-full justify-center"
                onClick={() => setOpen(false)}
              >
                Get matched <span aria-hidden="true">&rarr;</span>
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
