import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
} from "lucide-react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";

const PAGE_URL =
  "https://valisenmentalhealth.com/resources/five-signs-of-perfectionism";
const REVIEWED_DATE = "2026-08-03";

export const metadata: Metadata = {
  title: "Five Signs of Perfectionism",
  description:
    "Learn five common signs that high standards may have become unhelpful perfectionism, plus practical ways to respond with more flexibility.",
  alternates: { canonical: "/resources/five-signs-of-perfectionism" },
  openGraph: {
    title: "Five Signs of Perfectionism",
    description:
      "How to recognize when high standards start costing you time, confidence, rest, or connection.",
    url: PAGE_URL,
    type: "article",
    publishedTime: REVIEWED_DATE,
    modifiedTime: REVIEWED_DATE,
  },
};

const SIGNS = [
  {
    title: '“Good enough” never feels finished',
    body: "You may check the same work repeatedly, rewrite a message several times, or keep refining something long after it serves its purpose. The standard is not simply high—it is difficult to complete because certainty never quite arrives.",
    examples: [
      "Taking much longer than the task reasonably needs",
      "Seeking reassurance, then doubting the reassurance",
      "Feeling unable to stop while any flaw is still possible",
    ],
    reflection: "If no one else could judge this, when would I consider it complete?",
  },
  {
    title: "You procrastinate when the outcome matters",
    body: "Perfectionism can look like delay rather than overwork. When the imagined result must be exceptional, beginning can feel risky. You might wait for the ideal plan, enough confidence, more time, or the right mood—and interpret that avoidance as laziness.",
    examples: [
      "Planning extensively without taking the first visible step",
      "Avoiding opportunities you cannot guarantee you will do well",
      "Finishing at the last minute because urgency finally overrides fear",
    ],
    reflection: "What is the smallest imperfect version I could begin today?",
  },
  {
    title: "Mistakes feel like evidence about who you are",
    body: "A mistake may quickly become a verdict: ‘I am careless,’ ‘I am not capable,’ or ‘I have let everyone down.’ Instead of evaluating one action, the mind evaluates the whole person. This can make ordinary feedback feel threatening and trigger shame, defensiveness, or rumination.",
    examples: [
      "Replaying a small error long after it has been addressed",
      "Discounting everything that went well because one part did not",
      "Using harsher language with yourself than you would with another person",
    ],
    reflection: "Can I describe what happened without turning it into an identity?",
  },
  {
    title: "The finish line moves when you reach it",
    body: "Success may bring relief, but not satisfaction. You might explain an achievement away as easy, lucky, or expected—and immediately set a harder standard. The result is a cycle in which achievement never becomes evidence that you are already capable.",
    examples: [
      "Thinking ‘anyone could have done that’ after succeeding",
      "Focusing first on what should be improved next time",
      "Needing a new goal before allowing yourself to feel proud",
    ],
    reflection: "What would it look like to let this count before raising the bar?",
  },
  {
    title: "Your standards are costing more than they give",
    body: "The clearest sign is often the cost. High standards become unhelpful when pursuing them repeatedly takes away sleep, health, connection, curiosity, or the ability to finish—and yet relaxing the standard feels unacceptable.",
    examples: [
      "Skipping rest or relationships to keep working",
      "Feeling chronically tense even when things are going well",
      "Continuing the same pattern despite burnout or other consequences",
    ],
    reflection: "What is this standard helping me protect, and what is it asking me to sacrifice?",
  },
] as const;

export default function FiveSignsOfPerfectionismPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Five Signs of Perfectionism",
    description:
      "Five common signs that high standards may have become unhelpful perfectionism, with practical reflection prompts.",
    datePublished: REVIEWED_DATE,
    dateModified: REVIEWED_DATE,
    mainEntityOfPage: PAGE_URL,
    author: {
      "@type": "Organization",
      name: "Valisen Mental Health",
      url: "https://valisenmentalhealth.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Valisen Mental Health",
      url: "https://valisenmentalhealth.com",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://valisenmentalhealth.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: "https://valisenmentalhealth.com/resources",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Five Signs of Perfectionism",
        item: PAGE_URL,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <NavBar hideBookingCta />

      <main>
        <nav aria-label="Breadcrumb" className="border-b border-hairline bg-white py-3">
          <ol className="container-v flex max-w-[980px] items-center gap-1.5 overflow-hidden text-[12px] text-ink-secondary">
            <li>
              <Link href="/" className="hover:text-teal">
                Home
              </Link>
            </li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li>
              <Link href="/resources" className="hover:text-teal">
                Resources
              </Link>
            </li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="truncate text-ink" aria-current="page">
              Five Signs of Perfectionism
            </li>
          </ol>
        </nav>

        <article>
          <header className="relative overflow-hidden bg-canvas py-14 md:py-24">
            <div className="absolute -right-40 top-8 h-[420px] w-[420px] rounded-full border border-teal/10" aria-hidden="true" />
            <div className="absolute -right-16 top-28 h-[240px] w-[240px] rounded-full border border-teal/10" aria-hidden="true" />
            <div className="container-v relative max-w-[980px]">
              <Link
                href="/resources"
                className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-teal-dark"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to resources
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <span className="badge-outline-teal">PERFECTIONISM</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-hint">
                  <Clock3 size={13} aria-hidden="true" /> 8 minute read
                </span>
              </div>
              <h1 className="mt-7 max-w-[850px] font-serif text-[43px] font-medium leading-[1.02] tracking-[-1.5px] text-ink md:text-[64px]">
                Five signs of perfectionism
              </h1>
              <p className="mt-6 max-w-[760px] text-[18px] leading-[1.7] text-ink-secondary md:text-[21px]">
                High standards can help you build a life you care about. But when
                your worth depends on meeting them, “doing your best” can quietly
                become a rule that never lets you rest.
              </p>
              <p className="mt-7 text-[12px] text-ink-hint">
                Published and reviewed August 3, 2026 · Educational information,
                not a diagnosis
              </p>
            </div>
          </header>

          <div className="bg-white py-14 md:py-20">
            <div className="container-v grid max-w-[1080px] gap-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
              <div className="min-w-0">
                <section id="what-is-perfectionism" className="scroll-mt-28">
                  <span className="text-[11px] font-semibold uppercase tracking-[1.3px] text-teal">
                    First, a useful distinction
                  </span>
                  <h2 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-[-0.7px] text-ink md:text-[38px]">
                    Perfectionism is more than caring about quality
                  </h2>
                  <div className="mt-6 space-y-5 text-[16px] leading-[1.85] text-ink-secondary">
                    <p>
                      Wanting to do something well is not automatically a problem.
                      Perfectionism becomes less helpful when demanding standards are
                      relentless, your self-worth rises and falls with performance, and
                      you keep pursuing the standard despite meaningful costs.
                    </p>
                    <p>
                      That framing is consistent with the Centre for Clinical
                      Interventions’ perfectionism resources and a widely used
                      cognitive-behavioural model of clinical perfectionism. The word
                      describes a pattern; it does not diagnose a mental health condition
                      by itself.
                    </p>
                  </div>
                  <div className="mt-8 rounded-[18px] border border-teal/20 bg-teal/[0.055] p-6 md:p-7">
                    <p className="font-serif text-[22px] font-medium leading-[1.35] text-teal-dark">
                      A helpful question is not “Are my standards high?” but “Can I
                      choose when they matter—and can I stop when the cost is too high?”
                    </p>
                  </div>
                </section>

                <div className="my-12 h-px bg-hairline" />

                <section id="five-signs" className="scroll-mt-28">
                  <span className="text-[11px] font-semibold uppercase tracking-[1.3px] text-teal">
                    Five patterns to notice
                  </span>
                  <h2 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-[-0.7px] text-ink md:text-[38px]">
                    What perfectionism can look like day to day
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.8] text-ink-secondary">
                    You do not need to identify with every sign. Perfectionism can show
                    up differently at work, school, in relationships, parenting,
                    appearance, health, or any area that feels closely tied to identity.
                  </p>

                  <div className="mt-10 space-y-8">
                    {SIGNS.map((sign, index) => (
                      <section
                        key={sign.title}
                        id={`sign-${index + 1}`}
                        className="scroll-mt-28 rounded-[22px] border border-hairline bg-canvas p-6 md:p-8"
                      >
                        <div className="flex items-start gap-4 md:gap-5">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal font-serif text-[18px] font-medium text-white">
                            {index + 1}
                          </span>
                          <div>
                            <h3 className="font-serif text-[25px] font-medium leading-[1.2] tracking-[-0.4px] text-ink md:text-[29px]">
                              {sign.title}
                            </h3>
                            <p className="mt-4 text-[15.5px] leading-[1.8] text-ink-secondary">
                              {sign.body}
                            </p>
                          </div>
                        </div>
                        <ul className="mt-6 grid gap-2.5 border-t border-black/8 pt-6 md:ml-16">
                          {sign.examples.map((example) => (
                            <li key={example} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink-secondary">
                              <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal">
                                <Check size={10} strokeWidth={3} aria-hidden="true" />
                              </span>
                              {example}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-6 rounded-[12px] bg-white px-4 py-3 text-[13.5px] leading-[1.6] text-teal-dark md:ml-16">
                          <strong>Try asking:</strong> {sign.reflection}
                        </p>
                      </section>
                    ))}
                  </div>
                </section>

                <div className="my-12 h-px bg-hairline" />

                <section id="high-standards" className="scroll-mt-28">
                  <span className="text-[11px] font-semibold uppercase tracking-[1.3px] text-teal">
                    Keep the ambition, add flexibility
                  </span>
                  <h2 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-[-0.7px] text-ink md:text-[38px]">
                    Healthy high standards versus unhelpful perfectionism
                  </h2>
                  <div className="mt-8 grid overflow-hidden rounded-[20px] border border-hairline md:grid-cols-2">
                    <div className="bg-teal/[0.055] p-6 md:p-8">
                      <h3 className="font-serif text-[23px] font-medium text-teal-dark">
                        Flexible high standards
                      </h3>
                      <ul className="mt-5 space-y-3 text-[14px] leading-[1.65] text-ink-secondary">
                        <li>Goals can change when circumstances change.</li>
                        <li>Effort is balanced with time, health, and relationships.</li>
                        <li>Mistakes provide information without defining your worth.</li>
                        <li>Finishing and learning can matter more than flawless results.</li>
                      </ul>
                    </div>
                    <div className="border-t border-hairline bg-canvas p-6 md:border-l md:border-t-0 md:p-8">
                      <h3 className="font-serif text-[23px] font-medium text-ink">
                        Unrelenting perfectionism
                      </h3>
                      <ul className="mt-5 space-y-3 text-[14px] leading-[1.65] text-ink-secondary">
                        <li>The standard feels compulsory rather than chosen.</li>
                        <li>Achievement brings brief relief, then a higher bar.</li>
                        <li>Errors trigger broad self-criticism or shame.</li>
                        <li>The cost continues even when it affects daily life.</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <div className="my-12 h-px bg-hairline" />

                <section id="what-helps" className="scroll-mt-28">
                  <span className="text-[11px] font-semibold uppercase tracking-[1.3px] text-teal">
                    A different way to practise
                  </span>
                  <h2 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-[-0.7px] text-ink md:text-[38px]">
                    What can help loosen the cycle
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.85] text-ink-secondary">
                    The goal is usually not to stop caring or abandon standards. It is
                    to make them more flexible, reduce the link between performance and
                    self-worth, and test what actually happens when something is simply
                    good enough.
                  </p>
                  <ol className="mt-8 space-y-5">
                    <Step number="1" title="Define “done” before you begin">
                      Choose the purpose, time limit, and minimum useful outcome while
                      your anxiety is lower—not halfway through another round of checking.
                    </Step>
                    <Step number="2" title="Run a small imperfection experiment">
                      Send one low-stakes message after a single review, submit a draft
                      that meets the brief, or let a minor preference remain unresolved.
                      Observe the outcome rather than predicting it.
                    </Step>
                    <Step number="3" title="Separate behaviour from identity">
                      Replace “I am a failure” with a specific description: “I missed one
                      detail and can decide whether it needs repairing.”
                    </Step>
                    <Step number="4" title="Let success register">
                      Before setting the next goal, name what worked, what you learned,
                      and what effort you want to acknowledge.
                    </Step>
                    <Step number="5" title="Talk about the cost">
                      A therapist can help you understand what perfectionism protects you
                      from, practise uncertainty, and build standards that leave room for
                      a fuller life.
                    </Step>
                  </ol>
                </section>

                <section id="support" className="mt-12 scroll-mt-28 rounded-[22px] border border-hairline bg-canvas p-7 md:p-9">
                  <h2 className="font-serif text-[28px] font-medium leading-tight text-ink md:text-[34px]">
                    Consider support when the pattern is narrowing your life
                  </h2>
                  <p className="mt-4 text-[15px] leading-[1.75] text-ink-secondary">
                    It may be worth speaking with a regulated mental health
                    professional if perfectionism is contributing to persistent
                    anxiety, low mood, burnout, eating or body-image concerns, conflict,
                    lost sleep, or avoidance of important parts of life. You do not
                    need to wait until the pattern becomes severe.
                  </p>
                  <Link
                    href="/therapists/ryann-simpson"
                    className="group mt-7 block rounded-[16px] border border-teal/20 bg-white p-5 transition-colors hover:border-teal/40"
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-teal">
                      Related therapist
                    </span>
                    <span className="mt-2 block font-serif text-[22px] font-medium text-ink group-hover:text-teal-dark">
                      Ryann Simpson, Registered Social Worker
                    </span>
                    <span className="mt-2 block text-[13.5px] leading-[1.65] text-ink-secondary">
                      Ryann supports adults and couples navigating perfectionism,
                      anxiety, people-pleasing, self-esteem, and patterns that feel
                      difficult to change.
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-teal">
                      Read Ryann’s profile <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                </section>

                <section id="sources" className="mt-12 scroll-mt-28 border-t border-hairline pt-10">
                  <div className="flex items-center gap-2 text-teal">
                    <BookOpen size={18} aria-hidden="true" />
                    <h2 className="font-serif text-[24px] font-medium text-ink">
                      Sources and further reading
                    </h2>
                  </div>
                  <ul className="mt-5 space-y-3 text-[13.5px] leading-[1.65] text-ink-secondary">
                    <li>
                      <ExternalSource href="https://www.cci.health.wa.gov.au/resources/looking-after-yourself/perfectionism">
                        Centre for Clinical Interventions: Perfectionism self-help resources
                      </ExternalSource>
                    </li>
                    <li>
                      <ExternalSource href="https://pubmed.ncbi.nlm.nih.gov/12074372/">
                        Shafran, Cooper &amp; Fairburn (2002): Clinical perfectionism—a cognitive-behavioural analysis
                      </ExternalSource>
                    </li>
                    <li>
                      <ExternalSource href="https://oxfordhealth.nhs.uk/camhs/carers/ed/perfectionism/">
                        Oxford Health NHS CAMHS: Perfectionism
                      </ExternalSource>
                    </li>
                  </ul>
                  <p className="mt-7 rounded-[12px] border border-gold/25 bg-gold-light/35 p-4 text-[12.5px] leading-[1.7] text-ink-secondary">
                    This article provides general educational information. It is not a
                    diagnostic tool and does not replace individualized medical or mental
                    health advice.
                  </p>
                </section>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-28 rounded-[18px] border border-hairline bg-canvas p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-teal-dark">
                    In this article
                  </p>
                  <nav className="mt-4" aria-label="Article sections">
                    <ul className="space-y-3 text-[13px] leading-[1.45] text-ink-secondary">
                      <li><a href="#what-is-perfectionism" className="hover:text-teal">What perfectionism means</a></li>
                      <li><a href="#five-signs" className="hover:text-teal">The five signs</a></li>
                      <li><a href="#high-standards" className="hover:text-teal">High standards comparison</a></li>
                      <li><a href="#what-helps" className="hover:text-teal">What can help</a></li>
                      <li><a href="#support" className="hover:text-teal">When to seek support</a></li>
                      <li><a href="#sources" className="hover:text-teal">Sources</a></li>
                    </ul>
                  </nav>
                </div>
              </aside>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-[16px] border border-hairline bg-canvas p-5 md:gap-5 md:p-6">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-xlight text-[12px] font-bold text-teal-dark">
        {number}
      </span>
      <div>
        <h3 className="font-serif text-[20px] font-medium text-ink">{title}</h3>
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-secondary">{children}</p>
      </div>
    </li>
  );
}

function ExternalSource({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1.5 text-teal underline decoration-teal/35 underline-offset-2 hover:text-teal-dark"
    >
      <span>{children}</span>
      <ExternalLink size={12} className="mt-1 shrink-0" aria-hidden="true" />
    </a>
  );
}
