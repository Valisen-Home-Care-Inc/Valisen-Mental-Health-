import { ArrowRight, CalendarDays, CheckCircle, Phone } from "lucide-react";
import BookingNote from "@/components/BookingNote";
import { CLINIC_JANE_BOOKING_URL } from "@/lib/therapistBooking";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[88vh] flex-col justify-center overflow-hidden bg-canvas">
      {/* Decorative gradient blobs */}
      <div
        className="pointer-events-none absolute -right-80 -top-40 h-[700px] w-[700px] rounded-full bg-teal/[0.08] blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 bottom-[-10%] h-[500px] w-[500px] rounded-full bg-sage/[0.12] blur-[100px]"
        aria-hidden="true"
      />

      <div className="container-v relative z-10 grid w-full grid-cols-1 items-center gap-12 py-20 md:grid-cols-[1.02fr_0.98fr] md:py-28">
        <div>
          <span className="badge-outline-teal mb-6">SERVING ALL OF ONTARIO</span>

          <h1 className="mb-6 font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Professional therapy in Ontario — from our{" "}
            <span className="italic text-teal">registered</span> therapists, usually within days.
          </h1>

          <p className="max-w-[560px] text-vbase leading-[1.6] text-ink-secondary">
            Valisen Mental Health is an Ontario therapy clinic based in Ottawa. Start with a free
            20-minute phone consultation and explore support from one of our Registered
            Psychotherapists, virtually anywhere in Ontario.
          </p>
          <p className="mt-5 text-[14px] text-ink-secondary">
            Or call us directly at{" "}
            <a href="tel:613-707-0333" className="font-medium text-ink hover:text-teal">
              613-707-0333
            </a>
          </p>
          <ul className="mt-6 flex max-w-[560px] flex-col gap-3 text-[15px] leading-[1.5] text-ink-secondary">
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Virtual therapy available across Ontario</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Insurance accepted — Manulife, Sun Life, Canada Life and more</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Registered Psychotherapists and Social Workers</span>
            </li>
          </ul>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <FreeConsultationCard />
        </div>
      </div>
    </section>
  );
}

function FreeConsultationCard() {
  return (
    <div className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-8">
      <div className="mb-6">
        <div className="mb-1.5 text-vxs font-semibold uppercase tracking-[1.5px] text-teal">
          Free 20-minute Phone Consultation
        </div>
        <h2 className="font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.6px] text-ink">
          Start with a short call.
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-ink-secondary">
          Browse our therapists, choose who feels right for you, and book a free consultation
          directly with them — no referrals, no waitlists.
        </p>
      </div>

      <div className="space-y-3 border-y border-hairline py-5">
        {[
          "20-minute phone consultation",
          "No cost to start the consultation process",
          "Available for new clients exploring therapist fit",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <CheckCircle size={15} className="shrink-0 text-teal" aria-hidden="true" />
            <span className="text-[13px] text-ink-secondary">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <a
          href={CLINIC_JANE_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full justify-center"
        >
          <CalendarDays size={16} className="mr-2" aria-hidden="true" />
          Book now
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </a>
        <a href="tel:613-707-0333" className="btn-outline w-full justify-center">
          <Phone size={16} className="mr-2" aria-hidden="true" />
          Call 613-707-0333
        </a>
      </div>
      <BookingNote className="mt-4" />
    </div>
  );
}
