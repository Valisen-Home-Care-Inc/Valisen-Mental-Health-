import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import BookingNote from "@/components/BookingNote";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";

export const metadata = {
  title: "About - Valisen Mental Health",
  description:
    "Valisen Mental Health is an Ottawa therapy clinic offering virtual sessions with Registered Psychotherapists.",
};

const VALUES = [
  {
    title: "Accessibility",
    body: "Therapy shouldn't be reserved for people who already know how to navigate the system. We meet you where you are.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M3 12 H21 M12 3 Q 17 12, 12 21 M12 3 Q 7 12, 12 21" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: "Trust",
    body: "Our therapists are Registered Psychotherapists — regulated professionals who are accountable to their college.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3 L20 6 V12 Q 20 18, 12 21 Q 4 18, 4 12 V6 Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9 12 L11 14 L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Responsiveness",
    body: "When you've decided to ask for help, the next step should feel clear. Browse our therapist profiles, choose who feels right, and book directly — no intake or referral required.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M12 9 V13 L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 3 H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <main>
      <NavBar />

      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v max-w-[820px]">
          <span className="badge-outline-teal mb-5">OUR MISSION</span>
          <h1 className="font-serif text-[40px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Making therapy <span className="italic text-teal">actually accessible</span> in Ottawa and Ontario
          </h1>
          <p className="mt-6 max-w-[680px] text-vlg leading-[1.6] text-ink-secondary">
            Valisen exists because finding the right therapist in Ontario can feel complicated.
            We&apos;re here to make it easier — as a clinic, we keep the process clear
            and help make sure your insurance does the heavy lifting.
          </p>
        </div>
      </section>

      <section className="bg-teal-dark py-16 md:py-20">
        <div className="container-v grid grid-cols-1 gap-12 md:grid-cols-2 md:items-start">
          <div>
            <span className="badge-outline-white mb-5">HOW WE WORK</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
              We provide.
              <br />
              Our therapists deliver.
            </h2>
          </div>
          <div className="space-y-5 text-[15px] leading-[1.7] text-canvas/85">
            <p>
              Valisen Mental Health is an Ottawa therapy clinic. Our Registered Psychotherapists
              provide virtual sessions directly to clients across Ontario.
            </p>
            <p>
              Browse our therapist profiles, choose who feels right for you, and book directly
              through Jane. Your care is provided by a regulated clinician on our team from
              day one.
            </p>
            <p>
              That&apos;s how we keep things simple — and how we help make sure your insurance may
              cover your sessions the way it should.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v">
          <div className="mb-12 max-w-[640px]">
            <span className="badge-outline-teal mb-5">OUR VALUES</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              What we hold ourselves to
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {VALUES.map((value) => (
              <article
                key={value.title}
                className="rounded-card border-[0.5px] border-hairline bg-white p-7"
              >
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-teal-xlight text-teal">
                  {value.icon}
                </div>
                <h3 className="mb-3 font-serif text-vxl font-medium text-ink">{value.title}</h3>
                <p className="text-[14px] leading-[1.6] text-ink-secondary">{value.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-canvas pb-16 md:pb-24">
        <div className="container-v rounded-card border-[0.5px] border-hairline bg-white px-8 py-12 text-center md:px-16 md:py-16">
          <h2 className="mx-auto max-w-[640px] font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Book with Valisen
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[15px] text-ink-secondary">
            Book directly through Jane or call us if you would like help choosing a therapist.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={MATCHING_FORM_URL}
              className="btn-primary justify-center"
            >
              {MATCHING_CTA_LABEL} <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href="tel:613-707-0333" className="btn-outline justify-center">
              Call 613-707-0333
            </a>
          </div>
          <BookingNote className="mx-auto mt-4 max-w-[520px]" />
        </div>
      </section>

      <Footer />
    </main>
  );
}
