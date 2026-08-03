"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";
import { ChevronDown } from "lucide-react";
import TrackedLink from "@/components/TrackedLink";
import { MATCHING_FORM_URL } from "@/lib/intake";

const FINDER_URL = "/therapists#therapist-finder";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/therapists", label: "Therapists" },
  { href: "/insurance", label: "Insurance" },
  { href: "/about", label: "About" },
];

const FAQ_CATEGORIES = [
  { label: "Mental Health Signs", href: "/faq" },
  { label: "Finding a Therapist", href: "/faq" },
  { label: "Insurance and Fees", href: "/faq" },
  { label: "The Therapy Process", href: "/faq" },
  { label: "About Valisen", href: "/faq" },
];

export default function NavBar({
  hideBookingCta = false,
}: {
  /** Quiz/results pages provide their own personalized consultation action. */
  hideBookingCta?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-hairline-light bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-container items-center justify-between px-5 py-3 md:px-8 md:py-[18px]">
        <Logo />

        <ul className="hidden items-center gap-7 text-[14px] text-ink md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-inherit no-underline hover:text-teal">
                {link.label}
              </Link>
            </li>
          ))}

          {/* FAQ dropdown */}
          <li className="group relative">
            <Link
              href="/faq"
              className="flex items-center gap-1 text-inherit no-underline hover:text-teal"
            >
              FAQ
              <ChevronDown size={13} className="transition-transform duration-150 group-hover:rotate-180" />
            </Link>
            {/* Dropdown panel */}
            <div className="pointer-events-none absolute right-0 top-full pt-3 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
              <div className="w-52 overflow-hidden rounded-xl border border-black/8 bg-white shadow-lg">
                {FAQ_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.label}
                    href={cat.href}
                    className="block px-4 py-2.5 text-[13px] text-ink no-underline hover:bg-teal/5 hover:text-teal"
                  >
                    {cat.label}
                  </Link>
                ))}
                <div className="border-t border-black/8">
                  <Link
                    href="/faq"
                    className="flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-teal no-underline hover:bg-teal/5"
                  >
                    Browse all FAQs <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </li>

          {!hideBookingCta ? (
            <li>
              <TrackedLink
                href={MATCHING_FORM_URL}
                event="consultation_request_clicked"
                page="sitewide"
                placement="navigation"
                className="btn-dark"
              >
                Book Free Consultation
              </TrackedLink>
            </li>
          ) : null}
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

            {/* FAQ expandable in mobile */}
            <li>
              <button
                type="button"
                className="flex w-full items-center justify-between py-2 text-left text-ink"
                onClick={() => setFaqOpen((v) => !v)}
              >
                FAQ
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-150 ${faqOpen ? "rotate-180" : ""}`}
                />
              </button>
              {faqOpen && (
                <ul className="mb-1 ml-3 flex flex-col border-l-2 border-teal/20 pl-3">
                  {FAQ_CATEGORIES.map((cat) => (
                    <li key={cat.label}>
                      <Link
                        href={cat.href}
                        className="block py-1.5 text-[14px] text-ink-secondary no-underline"
                        onClick={() => { setOpen(false); setFaqOpen(false); }}
                      >
                        {cat.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/faq"
                      className="block py-1.5 text-[14px] font-medium text-teal no-underline"
                      onClick={() => { setOpen(false); setFaqOpen(false); }}
                    >
                      Browse all FAQs →
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {!hideBookingCta ? (
              <li className="pt-2">
                <TrackedLink
                  href={MATCHING_FORM_URL}
                  event="consultation_request_clicked"
                  page="sitewide"
                  placement="navigation"
                  className="btn-dark w-full justify-center"
                  onClick={() => setOpen(false)}
                >
                  Book Free Consultation
                </TrackedLink>
                <p className="mt-2 px-1 text-center text-[13px] leading-[1.5] text-ink-secondary">
                  Need help choosing?{" "}
                  <Link
                    href={FINDER_URL}
                    className="font-semibold text-teal no-underline"
                    onClick={() => setOpen(false)}
                  >
                    Find my therapist
                  </Link>
                </p>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
