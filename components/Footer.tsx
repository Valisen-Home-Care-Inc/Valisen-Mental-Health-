import Link from "next/link";
import CrisisNote from "./CrisisNote";
import Logo from "./Logo";

const COL_SERVICES = [
  { href: "/services", label: "Individual therapy" },
  { href: "/services", label: "Couples therapy" },
  { href: "/anxiety-therapy-ottawa", label: "Anxiety Therapy" },
  { href: "/depression-therapy-ottawa", label: "Depression Therapy" },
  { href: "/trauma-therapy-ottawa", label: "Trauma Therapy" },
  { href: "/grief-counselling-ottawa", label: "Grief Counselling" },
  { href: "/stress-therapy-ottawa", label: "Stress Therapy" },
  { href: "/self-esteem-therapy-ottawa", label: "Self-Esteem Therapy" },
  { href: "/relationship-counselling-ottawa", label: "Relationship Counselling" },
  { href: "/life-transitions-therapy-ottawa", label: "Life Transitions Therapy" },
];

const COL_COMPANY = [
  { href: "/about", label: "About Valisen" },
  { href: "/therapists", label: "Our Therapists" },
  { href: "/insurance", label: "Insurance" },
];

const COL_LEGAL = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default function Footer() {
  return (
    <footer className="bg-[#1C1C1A]">
      <div className="container-v py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.25fr_1fr_0.75fr_0.75fr_1fr]">
          <div>
            <Logo dark />
            <p className="mt-4 max-w-[300px] text-[13px] leading-[1.6] text-white/50">
              Ottawa therapy clinic. Registered Psychotherapists delivering
              virtual care across Ontario.
            </p>
          </div>

          <FooterCol heading="Services" links={COL_SERVICES} />
          <FooterCol heading="Company" links={COL_COMPANY} />
          <FooterCol heading="Legal" links={COL_LEGAL} />

          <div>
            <h4 className="mb-4 text-vxs uppercase tracking-[1.2px] text-white/40">
              Contact
            </h4>
            <ul className="space-y-2 text-[13px] text-white/70">
              <li>
                <a href="tel:613-707-0333" className="no-underline hover:text-teal-light">
                  613-707-0333
                </a>
              </li>
              <li>
                <a href="mailto:info@valisenmentalhealth.com" className="no-underline hover:text-teal-light">
                  info@valisenmentalhealth.com
                </a>
              </li>
              <li className="text-white/40">Ottawa, Ontario</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <span className="text-[12px] text-white/30">
              &copy; 2026 Valisen Mental Health. All rights reserved.
            </span>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy" className="text-[12px] text-white/40 hover:text-white/70 no-underline">
                Privacy Policy
              </Link>
              <span className="text-white/20" aria-hidden="true">|</span>
              <Link href="/terms" className="text-[12px] text-white/40 hover:text-white/70 no-underline">
                Terms of Service
              </Link>
            </div>
          </div>
          <CrisisNote dark className="md:text-right" />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="mb-4 text-vxs uppercase tracking-[1.2px] text-white/40">{heading}</h4>
      <ul className="space-y-2 text-[13px] text-white/70">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="no-underline hover:text-teal-light">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
