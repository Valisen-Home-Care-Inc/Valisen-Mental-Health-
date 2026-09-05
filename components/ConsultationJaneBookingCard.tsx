import { ArrowUpRight, CalendarDays } from "lucide-react";
import { CLINIC_JANE_BOOKING_URL } from "@/lib/therapists";

export default function ConsultationJaneBookingCard() {
  return (
    <div className="mx-auto mt-8 max-w-[540px] rounded-2xl border border-teal/20 bg-teal-xlight px-5 py-6 sm:px-7">
      <CalendarDays className="mx-auto text-teal" size={24} aria-hidden="true" />
      <h2 className="mt-3 font-serif text-2xl leading-tight text-ink">
        Can’t wait to take the next step?
      </h2>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        Browse available appointments and book directly through Jane, our online
        booking platform. Prefer to wait? We’ll still be in touch about your request.
      </p>
      <a
        href={CLINIC_JANE_BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="btn-primary mt-5 inline-flex min-h-12 items-center justify-center gap-2 px-6 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
      >
        View availability on Jane
        <ArrowUpRight size={18} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
