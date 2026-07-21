import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { MATCHING_FORM_URL } from "@/lib/intake";

const TRUST_ITEMS = [
  {
    icon: <CalendarDays size={15} aria-hidden="true" />,
    text: "Usually available within a few days — no long waitlists",
  },
  {
    icon: <MapPin size={15} aria-hidden="true" />,
    text: "Virtual therapy available anywhere in Ontario",
  },
  {
    icon: <ShieldCheck size={15} aria-hidden="true" />,
    text: "Insurance accepted — Manulife, Sun Life, Canada Life and more",
  },
];

type DarkSectionProps = {
  badge?: string;
  headline?: React.ReactNode;
  body?: React.ReactNode;
  showMatchCard?: boolean;
};

export default function DarkSection({
  badge = "CARE THAT FEELS HUMAN",
  headline = (
    <>
      You&apos;ve decided to get help.
      <br className="hidden md:block" /> Start whenever you&apos;re ready.
    </>
  ),
  body = (
    <>
      Browse our therapist profiles, choose who feels right for you, and book a free
      20-minute consultation directly with them — no waitlists, no referrals needed.
    </>
  ),
  showMatchCard = true,
}: DarkSectionProps) {
  return (
    <section className="relative overflow-hidden bg-teal-dark">
      {/* Ambient blobs */}
      <div
        className="pointer-events-none absolute -right-48 -top-40 h-[600px] w-[600px] rounded-full bg-teal/[0.15] blur-[130px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-[-15%] h-[450px] w-[450px] rounded-full bg-sage/[0.10] blur-[110px]"
        aria-hidden="true"
      />

      {/* Decorative curves */}
      <svg
        className="absolute right-10 top-20 hidden md:block"
        width="60"
        height="60"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
      >
        <path d="M10 40 Q 20 20, 40 30" stroke="#8BB5A0" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 50 Q 45 35, 60 45" stroke="#8BB5A0" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 65 Q 35 50, 55 60" stroke="#8BB5A0" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="container-v relative z-10 grid grid-cols-1 items-center gap-14 py-24 md:grid-cols-2 md:py-32">
        {/* Left — headline + body */}
        <div>
          <span className="badge-outline-white mb-5">{badge}</span>
          <h2 className="mb-5 font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
            {headline}
          </h2>
          <p className="max-w-[440px] text-[14px] leading-[1.7] text-canvas/75">{body}</p>
        </div>

        {/* Right — consultation card */}
        {showMatchCard ? <ConsultationCard /> : null}
      </div>
    </section>
  );
}

function ConsultationCard() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.13] bg-white/[0.07] backdrop-blur-sm">
      {/* Inner glow blobs */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-teal/[0.22] blur-[55px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-sage/[0.20] blur-[45px]"
        aria-hidden="true"
      />

      <div className="relative z-10 p-8 md:p-9">
        {/* Header block */}
        <div className="mb-7 border-b border-white/[0.13] pb-7">
          <p className="mb-3 text-vxs font-semibold uppercase tracking-[1.8px] text-canvas/45">
            Free · No commitment · Usually within days
          </p>
          <h3 className="font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.5px] text-canvas">
            Book your free
            <br />
            20-minute call.
          </h3>
        </div>

        {/* Trust signals */}
        <ul className="mb-8 space-y-4">
          {TRUST_ITEMS.map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-teal-light">{item.icon}</span>
              <span className="text-[13.5px] leading-[1.6] text-canvas/75">{item.text}</span>
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <Link
          href={MATCHING_FORM_URL}
          className="btn-primary w-full justify-center py-[15px] text-[15px]"
        >
          Book Free Consultation
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </Link>

        {/* Phone fallback */}
        <p className="mt-4 text-center text-[12px] text-canvas/45">
          Or call us at{" "}
          <a
            href="tel:613-707-0333"
            className="text-canvas/65 transition-colors hover:text-canvas/90"
          >
            613-707-0333
          </a>
        </p>
      </div>
    </div>
  );
}

