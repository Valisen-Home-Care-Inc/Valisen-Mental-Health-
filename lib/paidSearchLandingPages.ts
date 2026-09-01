import type { SpecificTherapistSlug } from "@/lib/intake";

export const PAID_SEARCH_LANDING_SLUG = "google-ads" as const;

export type PaidSearchLandingPageConfig = {
  slug: typeof PAID_SEARCH_LANDING_SLUG;
  title: string;
  description: string;
  therapistPriority: SpecificTherapistSlug[];
  specialtyKeywords: string[];
  hero: {
    heading: string;
    body: string;
    imageHeading: string;
    imageBody: string;
  };
  therapists: {
    heading: string;
  };
  specificFaqs: Array<{
    question: string;
    answer: string;
  }>;
  finalCta: {
    heading: string;
  };
};

export const paidSearchLandingPage: PaidSearchLandingPageConfig = {
  slug: PAID_SEARCH_LANDING_SLUG,
  title: "Online Therapy in Ontario | Free Consultation | Valisen",
  description:
    "Start online therapy with a regulated Ontario therapist. Support is available for anxiety, depression, relationships, stress, trauma, grief, and more, beginning with a free consultation.",
  therapistPriority: [
    "ryann-simpson",
    "wilfred-bengnwi",
    "meryem-ibrahim",
    "dayong-quan",
    "tim-kahtava",
  ],
  specialtyKeywords: [
    "anxiety",
    "depression",
    "stress",
    "relationships",
    "couples",
    "trauma",
    "grief",
    "self-esteem",
    "life transitions",
  ],
  hero: {
    heading: "You do not have to figure everything out alone.",
    body:
      "Online therapy for anxiety, depression, relationships, stress, trauma, grief, and more. Meet a regulated therapist and start with a free, no-pressure consultation from anywhere in Ontario.",
    imageHeading: "Compassionate therapists. Clear next steps.",
    imageBody:
      "See current availability and fees, then decide whether a free conversation feels right.",
  },
  therapists: {
    heading: "Meet therapists who can support what you are facing.",
  },
  specificFaqs: [
    {
      question: "What can I get support with?",
      answer:
        "Valisen therapists support concerns including anxiety, depression, stress, trauma, grief, relationships, self-esteem, life transitions, and more. You do not need to know the exact label for what you are experiencing before reaching out.",
    },
  ],
  finalCta: {
    heading: "Start with one free conversation.",
  },
};

export function getPaidSearchLandingPage(): PaidSearchLandingPageConfig {
  return paidSearchLandingPage;
}
