"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { ChevronDown, ChevronRight, Brain, Heart, Users, DollarSign, Calendar } from "lucide-react";
import { MATCHING_FORM_URL } from "@/lib/intake";

// --- Types -------------------------------------------------------------------

type FAQItem = {
  question: string;
  shortAnswer: string;
  slug: string;
};

type FAQCategory = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  faqs: FAQItem[];
};

// --- FAQ Content -------------------------------------------------------------

const CATEGORIES: FAQCategory[] = [
  {
    id: "mental-health-signs",
    label: "Mental Health Signs",
    icon: <Brain size={18} />,
    description: "Understanding your symptoms and what they might mean",
    faqs: [
      {
        slug: "am-i-depressed",
        question: "Am I depressed? How do I know if what I'm feeling is depression?",
        shortAnswer:
          "Depression is more than sadness — it's a clinical condition that reshapes how you think, feel, and function. Key signs include persistent low mood for 2+ weeks, loss of interest in things you once enjoyed, fatigue, and feelings of worthlessness. If several of these have been present most days for two weeks or more, it's worth speaking with a therapist.",
      },
      {
        slug: "do-i-have-anxiety",
        question: "Do I have anxiety? What are the signs of an anxiety disorder?",
        shortAnswer:
          "An anxiety disorder involves worry or fear that is persistent, out of proportion, and interferes with daily life. Common signs include constant worry, avoidance of feared situations, sleep problems, and physical symptoms like racing heart or nausea. Normal anxiety lifts when the stressor resolves; an anxiety disorder persists regardless.",
      },
      {
        slug: "stress-vs-anxiety",
        question: "What is the difference between stress and an anxiety disorder?",
        shortAnswer:
          "Stress is a response to an identifiable external demand and eases when circumstances change. Anxiety persists even without a clear stressor — it attaches to hypothetical futures and does not resolve when things improve. If worry feels chronic, pervasive, and disproportionate to the situation, that pattern is more consistent with an anxiety disorder.",
      },
      {
        slug: "am-i-burnt-out",
        question: "Am I burnt out, or is it something more serious?",
        shortAnswer:
          "Burnout is chronic exhaustion from prolonged demands and typically lifts with genuine rest and removal from the stressor. Depression is more pervasive and does not reliably improve with time away alone. If you have taken significant time off and still feel hollow or hopeless, that pattern is more consistent with clinical depression.",
      },
      {
        slug: "trauma-signs",
        question: "How do I know if I have trauma or PTSD?",
        shortAnswer:
          "Trauma is defined by its lasting impact on your nervous system, not the severity of the event. Signs of PTSD include intrusive memories, avoidance, emotional numbing, and hypervigilance. Complex trauma can also show up as emotional dysregulation, difficulty trusting others, and a pervasive sense of being fundamentally different.",
      },
      {
        slug: "is-my-grief-normal",
        question: "Is my grief normal? When does grief become something that needs support?",
        shortAnswer:
          "Normal grief is intense and non-linear, but tends to soften over time. Complicated grief is characterized by grief that remains acutely debilitating for many months with no change, and a persistent inability to engage with life. If your grief has not shifted at all, or has triggered depression or trauma symptoms, therapy can help.",
      },
    ],
  },
  {
    id: "finding-therapist",
    label: "Finding a Therapist",
    icon: <Users size={18} />,
    description: "How to choose a therapist who is right for you",
    faqs: [
      {
        slug: "how-to-find-therapist",
        question: "How do I find the right therapist in Ottawa?",
        shortAnswer:
          "The quality of the therapeutic relationship is the strongest predictor of good outcomes — so finding the right fit matters as much as credentials. Start with a rough sense of what you want support with, check your insurance requirements, and use a free consultation to gauge the connection before committing.",
      },
      {
        slug: "rp-vs-rsw",
        question: "What is the difference between an RP and an RSW?",
        shortAnswer:
          "Both Registered Psychotherapists (RP) and Registered Social Workers (RSW) are regulated, graduate-trained professionals providing psychotherapy in Ontario. The main practical difference is insurance eligibility — some plans cover RPs, some cover RSWs, and some cover both. Always verify with your specific plan.",
      },
      {
        slug: "first-therapy-session",
        question: "What happens in a first therapy session?",
        shortAnswer:
          "The first session is an intake — your therapist will learn why you've come in, what your life looks like, and what you hope to work on. You won't be pushed to disclose anything before you're ready. Most people leave feeling a mix of relief and slight vulnerability, which is completely normal.",
      },
      {
        slug: "therapy-approaches",
        question: "What is the difference between CBT, DBT, and EMDR?",
        shortAnswer:
          "CBT is a structured, skills-based approach with strong evidence for anxiety and depression. EMDR is a trauma-specific protocol that helps the brain reprocess stored traumatic memories. DBT was developed for emotional dysregulation and is used broadly for self-harm, eating disorders, and interpersonal difficulties.",
      },
    ],
  },
  {
    id: "cost-insurance",
    label: "Cost and Insurance",
    icon: <DollarSign size={18} />,
    description: "Understanding fees, coverage, and what your benefits include",
    faqs: [
      {
        slug: "therapy-cost-ottawa",
        question: "How much does therapy cost in Ottawa?",
        shortAnswer:
          "Individual therapy in Ottawa typically ranges from $140–$200 per 50-minute session with an RP or RSW. Many employer benefit plans cover a meaningful portion of this — check your plan for annual limits and eligible provider types. We provide itemized receipts for insurance reimbursement after every session.",
      },
      {
        slug: "does-insurance-cover-therapy",
        question: "Does insurance cover therapy in Canada?",
        shortAnswer:
          "Most group health benefit plans include mental health coverage for registered psychotherapists and registered social workers. Coverage depends on your specific plan design, not just your insurer. The key things to check are eligible provider types, annual maximum, and whether pre-authorization is required.",
      },
      {
        slug: "which-plans-cover-rps",
        question: "Which major insurance plans cover Registered Psychotherapists?",
        shortAnswer:
          "Manulife, Sun Life, Canada Life, Greenshield, and Equitable Life all include RP and RSW coverage across most standard plan tiers. Coverage varies by your specific plan design, not just the insurer. Valisen's team includes both Registered Psychotherapists (RP) and Registered Social Workers (RSW).",
      },
      {
        slug: "tax-deductible-therapy",
        question: "Can I claim therapy costs on my taxes in Canada?",
        shortAnswer:
          "Therapy with a regulated professional in Ontario may qualify as a medical expense under the CRA's Medical Expense Tax Credit. Sessions with RPs and RSWs are likely eligible, though CRA guidance can change annually. We provide itemized receipts after every session with the documentation needed for a claim.",
      },
    ],
  },
  {
    id: "sessions",
    label: "About Sessions",
    icon: <Calendar size={18} />,
    description: "What therapy sessions look like and how the process works",
    faqs: [
      {
        slug: "how-often-therapy",
        question: "How often should I go to therapy?",
        shortAnswer:
          "Weekly sessions are the standard starting cadence — they build consistency and momentum in the early stage of therapy. As you make progress, many people move to biweekly. The most important factor is showing up reliably; imperfect consistency still produces better outcomes than sporadic attendance.",
      },
      {
        slug: "how-long-therapy",
        question: "How long does therapy take? When will I feel better?",
        shortAnswer:
          "Short-term focused work (8–20 sessions) works well for specific, circumscribed issues. More complex presentations — trauma, chronic depression, deep relational patterns — typically take longer. Most people notice some shift within the first few sessions; meaningful symptom improvement often appears within 6–12 weeks of weekly work.",
      },
      {
        slug: "dont-know-what-i-need",
        question: "What if I don't know what kind of therapy I need?",
        shortAnswer:
          "Not knowing what you need is the most common starting point — you don't need a diagnosis, a clear goal, or any knowledge of therapy modalities. Your therapist will help clarify what to focus on as you go. A free 20-minute consultation is enough to start the process.",
      },
    ],
  },
  {
    id: "valisen",
    label: "About Valisen",
    icon: <Heart size={18} />,
    description: "How our clinic works and what makes us different",
    faqs: [
      {
        slug: "what-is-valisen",
        question: "What is Valisen Mental Health?",
        shortAnswer:
          "Valisen Mental Health is a private therapy practice in Ottawa offering evidence-based individual therapy from a focused team of registered, experienced therapists. We work with anxiety, depression, trauma, grief, relationship challenges, and life transitions. Virtual sessions are available across Ontario.",
      },
      {
        slug: "how-to-book",
        question: "How do I book a consultation or my first session?",
        shortAnswer:
          "Browse our therapist profiles, choose who feels right for you, and book a free 20-minute consultation directly with them through Jane — no referral or intake form needed. Sessions are typically available within a few days.",
      },
      {
        slug: "languages-offered",
        question: "Do you offer therapy in languages other than English?",
        shortAnswer:
          "Our team currently offers therapy in English, Arabic, French, and Mandarin. Meryem provides therapy in English and Arabic, Dayong in English and Mandarin, and Wilfred in English and French. Filter by language on our therapists page to find the right fit.",
      },
      {
        slug: "therapist-credentials",
        question: "Are your therapists licensed and regulated in Ontario?",
        shortAnswer:
          "Yes. Valisen therapists are Registered Psychotherapists (RP) with CRPO or Registered Social Workers (RSW) with OCSWSSW — both regulated designations requiring graduate-level training and professional accountability. You can verify any therapist's registration through their college's public registry.",
      },
    ],
  },
];

// --- Schema (JSON-LD) ---------------------------------------------------------

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CATEGORIES.flatMap((cat) =>
    cat.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.shortAnswer + ` Full answer: https://valisenmentalhealth.ca/faq/${faq.slug}`,
      },
    })),
  ),
};

// --- Component ---------------------------------------------------------------

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].id);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const current = CATEGORIES.find((c) => c.id === activeCategory)!;

  function toggle(slug: string) {
    setOpenSlug((prev) => (prev === slug ? null : slug));
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <NavBar />

      {/* -- Hero -- */}
      <section className="relative overflow-hidden bg-canvas py-24 md:py-32">
        <div
          className="pointer-events-none absolute -right-60 -top-40 h-[600px] w-[600px] rounded-full bg-teal/[0.07] blur-[130px]"
          aria-hidden="true"
        />
        <div className="container-v relative z-10 max-w-[760px] text-center">
          <span className="badge-outline-teal mb-6">FREQUENTLY ASKED QUESTIONS</span>
          <h1 className="font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Honest answers to the{" "}
            <span className="italic text-teal">questions we hear most</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-vbase leading-[1.7] text-ink-secondary">
            From understanding your symptoms to navigating insurance and booking your first session
            — everything you need to know, written clearly.
          </p>
        </div>
      </section>

      {/* -- Category tabs + accordion -- */}
      <section className="bg-white pb-32 pt-0">
        <div className="container-v max-w-[900px]">
          {/* Category nav */}
          <div className="mb-8 flex flex-wrap gap-2 border-b border-hairline pb-6">
            {CATEGORIES.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setOpenSlug(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-teal text-white shadow-sm"
                      : "border border-black/10 bg-[#FAFAF8] text-ink-secondary hover:border-teal/30 hover:text-teal"
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Category headline */}
          <div className="mb-6" id={current.id}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">
                {current.icon}
              </span>
              <h2 className="font-serif text-[24px] font-medium tracking-[-0.5px] text-ink">
                {current.label}
              </h2>
            </div>
            <p className="mt-2 text-[13px] text-ink-secondary">{current.description}</p>
          </div>

          {/* Accordion */}
          <div className="space-y-3">
            {current.faqs.map((faq) => {
              const isOpen = openSlug === faq.slug;
              return (
                <div
                  key={faq.slug}
                  id={faq.slug}
                  className={`rounded-[16px] border transition-all duration-200 ${
                    isOpen
                      ? "border-teal/40 bg-white shadow-md"
                      : "border-hairline bg-[#FAFAF8] hover:border-teal/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(faq.slug)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-5 px-6 py-5 text-left"
                  >
                    <h3
                      className={`font-serif text-[17px] font-medium leading-[1.35] transition-colors ${
                        isOpen ? "text-teal" : "text-ink"
                      }`}
                    >
                      {faq.question}
                    </h3>
                    <span
                      className={`mt-0.5 shrink-0 text-teal transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <ChevronDown size={20} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6">
                      <p className="text-[15px] leading-[1.8] text-ink-secondary">
                        {faq.shortAnswer}
                      </p>
                      <Link
                        href={`/faq/${faq.slug}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal underline underline-offset-2 hover:text-teal-dark"
                      >
                        Read the full answer ?
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -- In-depth articles -- */}
      <section className="bg-canvas py-16">
        <div className="container-v max-w-[900px]">
          <div className="mb-8">
            <span className="badge-outline-teal mb-3 inline-block text-[11px] uppercase tracking-[0.08em]">IN-DEPTH GUIDES</span>
            <h2 className="font-serif text-[26px] font-medium tracking-[-0.5px] text-ink">
              Browse all topics
            </h2>
            <p className="mt-2 text-[13px] text-ink-secondary">
              Each article below is a full, indexed page — written for Google and for you.
            </p>
          </div>
          <div className="space-y-8">
            {CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">
                    {cat.icon}
                  </span>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                    {cat.label}
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {cat.faqs.map((faq) => (
                    <Link
                      key={faq.slug}
                      href={`/faq/${faq.slug}`}
                      className="group flex items-start justify-between gap-3 rounded-[12px] border border-hairline bg-white px-4 py-3.5 text-left transition-all hover:border-teal/30 hover:shadow-sm"
                    >
                      <span className="text-[13px] font-medium leading-[1.45] text-ink group-hover:text-teal">
                        {faq.question}
                      </span>
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-ink-secondary group-hover:text-teal" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- CTA strip -- */}
      <section className="bg-teal-dark py-20">
        <div className="container-v max-w-[700px] text-center">
          <span className="badge-outline-white mb-5">READY TO START?</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.8px] text-canvas md:text-[38px]">
            Still have questions? Let&apos;s talk.
          </h2>
          <p className="mx-auto mt-4 max-w-[500px] text-[15px] leading-[1.7] text-white/75">
            Book a free 20-minute phone consultation. No pressure, no commitment — just a real
            conversation about how we can help.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={MATCHING_FORM_URL} className="btn-primary">
              Book Free Consultation
            </Link>
            <a
              href="tel:613-707-0333"
              className="text-[14px] font-medium text-white/80 hover:text-white"
            >
              or call 613-707-0333
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
