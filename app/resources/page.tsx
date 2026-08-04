import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Compass,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";

const ARTICLE_URL = "/resources/five-signs-of-perfectionism";

export const metadata: Metadata = {
  title: "Mental Health Resources",
  description:
    "Clear, compassionate mental health guides and practical tools from Valisen Mental Health for people across Ontario.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Mental Health Resources | Valisen Mental Health",
    description:
      "Clear, compassionate mental health guides and practical tools from Valisen Mental Health.",
    url: "https://valisenmentalhealth.com/resources",
    type: "website",
  },
};

export default function ResourcesPage() {
  return (
    <main>
      <NavBar />

      <section className="relative overflow-hidden bg-teal-dark py-20 text-white md:py-28">
        <div
          className="absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute -right-8 -top-16 h-[270px] w-[270px] rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div className="container-v relative max-w-[900px] text-center">
          <span className="badge-outline-white mb-6">RESOURCES</span>
          <h1 className="font-serif text-[43px] font-medium leading-[1.02] tracking-[-1.5px] text-canvas md:text-[64px]">
            Useful language for what you may be feeling
          </h1>
          <p className="mx-auto mt-6 max-w-[660px] text-[16px] leading-[1.75] text-white/75 md:text-[18px]">
            Thoughtful mental health guides designed to help you notice patterns,
            ask better questions, and decide what kind of support might fit.
          </p>
        </div>
      </section>

      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[1.3px] text-teal">
                Featured guide
              </span>
              <h2 className="mt-2 font-serif text-[32px] font-medium tracking-[-0.8px] text-ink md:text-[42px]">
                Start with something recognizable
              </h2>
            </div>
            <p className="max-w-[390px] text-[13.5px] leading-[1.65] text-ink-secondary sm:text-right">
              Educational resources can offer a starting point, but they cannot
              diagnose a mental health condition.
            </p>
          </div>

          <Link
            href={ARTICLE_URL}
            className="group grid overflow-hidden rounded-[26px] border border-hairline bg-white shadow-[0_18px_60px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-teal/25 hover:shadow-[0_24px_70px_rgba(0,0,0,0.10)] lg:grid-cols-[1.08fr_0.92fr]"
          >
            <div className="p-7 md:p-11 lg:p-14">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[1px] text-teal-dark">
                <span className="rounded-pill bg-teal-xlight px-3 py-1.5">
                  Perfectionism
                </span>
                <span className="text-ink-hint">8 minute read</span>
              </div>
              <h3 className="mt-7 max-w-[650px] font-serif text-[34px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[46px]">
                Five signs of perfectionism
              </h3>
              <p className="mt-5 max-w-[610px] text-[15.5px] leading-[1.75] text-ink-secondary">
                High standards can be meaningful. But when “good enough” never
                arrives, mistakes feel personal, or success only moves the finish
                line, perfectionism may be taking more than it gives.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-teal transition-colors group-hover:text-teal-dark">
                Read the article
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="relative min-h-[330px] overflow-hidden bg-[#E8F0EB] p-8 md:p-12">
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-teal/15" />
              <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full border border-teal/15" />
              <div className="relative flex h-full flex-col justify-between rounded-[22px] border border-white/75 bg-white/65 p-7 backdrop-blur-sm">
                <BookOpen size={30} className="text-teal" aria-hidden="true" />
                <div className="mt-16">
                  <p className="font-serif text-[24px] font-medium leading-[1.25] text-ink">
                    “What would change if the goal were meaningful—not flawless?”
                  </p>
                  <div className="mt-7 flex gap-2" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((number) => (
                      <span
                        key={number}
                        className="grid h-8 w-8 place-items-center rounded-full bg-teal text-[12px] font-semibold text-white"
                      >
                        {number}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container-v">
          <div className="max-w-[620px]">
            <span className="badge-outline-teal mb-5">TOOLS &amp; ANSWERS</span>
            <h2 className="font-serif text-[32px] font-medium leading-tight tracking-[-0.8px] text-ink md:text-[42px]">
              Explore at your own pace
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ResourceCard
              href="/quiz"
              icon={<Compass size={22} aria-hidden="true" />}
              title="Find your next step"
              body="Take a private self-reflection quiz and see which therapist may align with what you want support with."
              linkLabel="Take the quiz"
            />
            <ResourceCard
              href="/faq"
              icon={<HelpCircle size={22} aria-hidden="true" />}
              title="Mental health questions"
              body="Read direct answers about symptoms, therapy, insurance, fees, and what beginning care can look like."
              linkLabel="Browse FAQs"
            />
            <ResourceCard
              href="/therapists"
              icon={<Sparkles size={22} aria-hidden="true" />}
              title="Meet our therapists"
              body="Learn about each clinician’s approach, areas of focus, availability, and the people they support."
              linkLabel="View therapists"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function ResourceCard({
  href,
  icon,
  title,
  body,
  linkLabel,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  linkLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[20px] border border-hairline bg-canvas p-7 transition-all duration-200 hover:-translate-y-1 hover:border-teal/25 hover:shadow-md"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-teal-xlight text-teal">
        {icon}
      </span>
      <h3 className="mt-6 font-serif text-[24px] font-medium text-ink">{title}</h3>
      <p className="mt-3 text-[14px] leading-[1.7] text-ink-secondary">{body}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal group-hover:text-teal-dark">
        {linkLabel} <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}
