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
  { href: "/services#insurance", label: "Insurance" },
];

export default function Footer() {
  return (
    <footer className="border-t-[0.5px] border-hairline bg-canvas">
      <div className="container-v py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.25fr_1fr_0.75fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[300px] text-[13px] leading-[1.6] text-ink-secondary">
              Ottawa therapy clinic. Registered Psychotherapists and Social Workers delivering
              in-person and virtual care across Ontario.
            </p>
          </div>

          <FooterCol heading="Services" links={COL_SERVICES} />
          <FooterCol heading="Company" links={COL_COMPANY} />

          <div>
            <h4 className="mb-4 text-vxs uppercase tracking-[1.2px] text-ink-secondary">
              Contact
            </h4>
            <ul className="space-y-2 text-[13px] text-ink">
              <li>
                <a href="tel:613-707-0333" className="no-underline hover:text-teal">
                  613-707-0333
                </a>
              </li>
              <li>
                <a href="mailto:info@valisenmentalhealth.com" className="no-underline hover:text-teal">
                  info@valisenmentalhealth.com
                </a>
              </li>
              <li className="text-ink-secondary">Ottawa Ontario</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t-[0.5px] border-hairline pt-6 md:flex-row md:items-center">
          <span className="text-[12px] text-ink-secondary">
            &copy; 2026 Valisen Mental Health. All rights reserved.
          </span>
          <CrisisNote className="md:text-right" />
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
      <h4 className="mb-4 text-vxs uppercase tracking-[1.2px] text-ink-secondary">{heading}</h4>
      <ul className="space-y-2 text-[13px] text-ink">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="no-underline hover:text-teal">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
