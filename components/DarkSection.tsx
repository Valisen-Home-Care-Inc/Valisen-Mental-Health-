import Link from "next/link";
import ImageSlideshow from "./ImageSlideshow";

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
      <br className="hidden md:block" /> We&apos;ll handle the rest.
    </>
  ),
  body = (
    <>
      Finding a therapist you can trust should feel clear and supported. Tell us what
      you&apos;re looking for and we&apos;ll help match you with the right person. No clinical
      questionnaires, no confusing search process.
    </>
  ),
  showMatchCard = true,
}: DarkSectionProps) {
  return (
    <section className="relative overflow-hidden bg-teal-dark">
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

      <div className="container-v grid grid-cols-1 items-center gap-12 py-16 md:grid-cols-2 md:py-20">
        <div>
          <span className="badge-outline-white mb-5">{badge}</span>
          <h2 className="mb-5 font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
            {headline}
          </h2>
          <p className="max-w-[440px] text-[14px] leading-[1.7] text-canvas/75">{body}</p>
        </div>

        {showMatchCard ? <MatchCard /> : null}
      </div>
    </section>
  );
}

function MatchCard() {
  return (
    <div className="overflow-hidden rounded-card bg-white">
      <div className="relative h-[190px] bg-sage">
        <ImageSlideshow height={190} />
      </div>
      <Link
        href="/intake"
        className="flex items-center justify-between border-b-[0.5px] border-hairline px-[22px] py-[18px] no-underline"
      >
        <span className="font-serif text-vlg font-medium text-ink">Find your match</span>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-sage">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 17 L17 7 M17 7 L9 7 M17 7 L17 15"
              stroke="#2C2C2C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
      <p className="px-[22px] pb-[18px] pt-[14px] text-[12px] leading-[1.5] text-ink-secondary">
        A simple intake. We handle the matching.
      </p>
    </div>
  );
}
