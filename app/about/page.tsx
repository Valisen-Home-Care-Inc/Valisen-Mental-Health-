import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "About - Valisen Mental Health",
  description:
    "Valisen is an Ottawa-based therapy matching service connecting Ontario residents with Registered Psychotherapists and Registered Social Workers.",
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
    body: "We only connect you with Registered Psychotherapists and Registered Social Workers. Regulated professionals who are accountable to their college.",
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
    body: "When you've decided to ask for help, the next step should feel supported. We focus on finding a thoughtful match for your needs.",
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
            Making therapy <span className="italic text-teal">actually accessible</span> in Ottawa
          </h1>
          <p className="mt-6 max-w-[680px] text-vlg leading-[1.6] text-ink-secondary">
            Valisen exists because finding the right therapist in Ontario can feel complicated.
            We&apos;re here to make the process easier - by connecting you with the right therapist
            and helping make sure your insurance does the heavy lifting.
          </p>
        </div>
      </section>

      <section className="bg-teal-dark py-16 md:py-20">
        <div className="container-v grid grid-cols-1 gap-12 md:grid-cols-2 md:items-start">
          <div>
            <span className="badge-outline-white mb-5">HOW WE WORK</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
              We match.
              <br />
              Therapists deliver.
            </h2>
          </div>
          <div className="space-y-5 text-[15px] leading-[1.7] text-canvas/85">
            <p>
              Valisen is not a clinic. We don&apos;t deliver sessions ourselves. What we do is the
              part that&apos;s broken: the matching.
            </p>
            <p>
              You fill out a simple intake. We review it, connect with you to learn more about
              what you need, and introduce you to a Registered Psychotherapist or Social Worker who fits.
              From that point on, your relationship is directly with your therapist.
            </p>
            <p>
              That&apos;s how we keep things simple - and how we help make sure your insurance may
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
            Start with a free intake
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[15px] text-ink-secondary">
            Share what you&apos;re looking for. We&apos;ll help with the matching.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/intake" className="btn-primary justify-center">
              Start free intake <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href="tel:613-707-0333" className="btn-outline justify-center">
              Call 613-707-0333
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
