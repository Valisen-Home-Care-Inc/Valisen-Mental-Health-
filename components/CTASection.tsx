import { ArrowRight } from "lucide-react";
import BookingNote from "@/components/BookingNote";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";

type CTASectionProps = {
  headline: string;
  subtext?: string;
  dark?: boolean;
  secondaryCall?: boolean;
  className?: string;
  href?: string;
  buttonLabel?: string;
};

export default function CTASection({
  headline,
  subtext,
  dark = false,
  secondaryCall = false,
  className = "",
  href = MATCHING_FORM_URL,
  buttonLabel = MATCHING_CTA_LABEL,
}: CTASectionProps) {
  const isExternal = href.startsWith("http");

  return (
    <section className={`${dark ? "bg-teal-dark" : "bg-canvas"} py-24 md:py-32 ${className}`}>
      <div className="container-v text-center">
        <h2
          className={`mx-auto max-w-[680px] font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] md:text-v2xl ${
            dark ? "text-canvas" : "text-ink"
          }`}
        >
          {headline}
        </h2>
        {subtext ? (
          <p
            className={`mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.6] ${
              dark ? "text-canvas/80" : "text-ink-secondary"
            }`}
          >
            {subtext}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={
              dark
                ? "btn border border-canvas/80 bg-transparent text-canvas hover:bg-canvas hover:text-ink"
                : "btn-primary"
            }
          >
            {buttonLabel}
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </a>
          {secondaryCall ? (
            <a href="tel:613-707-0333" className="btn-outline">
              Call 613-707-0333
            </a>
          ) : null}
        </div>
        <BookingNote dark={dark} className="mx-auto mt-4 max-w-[520px]" />
      </div>
    </section>
  );
}
