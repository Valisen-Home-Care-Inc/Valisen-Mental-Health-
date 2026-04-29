import Link from "next/link";

type CTASectionProps = {
  headline: string;
  subtext?: string;
  dark?: boolean;
  secondaryCall?: boolean;
  className?: string;
};

export default function CTASection({
  headline,
  subtext,
  dark = false,
  secondaryCall = false,
  className = "",
}: CTASectionProps) {
  return (
    <section className={`${dark ? "bg-teal-dark" : "bg-canvas"} py-16 md:py-20 ${className}`}>
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
          <Link
            href="/intake"
            className={
              dark
                ? "btn border border-canvas/80 bg-transparent text-canvas hover:bg-canvas hover:text-ink"
                : "btn-primary"
            }
          >
            Start free intake <span aria-hidden="true">&rarr;</span>
          </Link>
          {secondaryCall ? (
            <a href="tel:613-707-0333" className="btn-outline">
              Call 613-707-0333
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
