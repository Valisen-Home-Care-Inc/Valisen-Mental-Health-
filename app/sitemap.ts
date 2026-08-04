import type { MetadataRoute } from "next";
import { therapists } from "@/lib/therapists";

const BASE_URL = "https://valisenmentalhealth.com";

const SPECIALTY_SLUGS = [
  "anxiety-therapy-ottawa",
  "depression-therapy-ottawa",
  "trauma-therapy-ottawa",
  "grief-counselling-ottawa",
  "stress-therapy-ottawa",
  "self-esteem-therapy-ottawa",
  "relationship-counselling-ottawa",
  "life-transitions-therapy-ottawa",
];

const FAQ_SLUGS = [
  // Understanding your symptoms
  "am-i-depressed",
  "do-i-have-anxiety",
  "stress-vs-anxiety",
  "am-i-burnt-out",
  "trauma-signs",
  "is-my-grief-normal",
  // Finding a therapist
  "how-to-find-therapist",
  "rp-vs-rsw",
  "first-therapy-session",
  "therapy-approaches",
  // Cost & insurance
  "therapy-cost-ottawa",
  "does-insurance-cover-therapy",
  "which-plans-cover-rps",
  "tax-deductible-therapy",
  // About sessions
  "how-often-therapy",
  "how-long-therapy",
  "dont-know-what-i-need",
  // About Valisen
  "what-is-valisen",
  "how-to-book",
  "languages-offered",
  "therapist-credentials",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/services`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/therapists`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/insurance`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/resources`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.82,
    },
    {
      url: `${BASE_URL}/resources/five-signs-of-perfectionism`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.78,
    },
    {
      url: `${BASE_URL}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...SPECIALTY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...FAQ_SLUGS.map((slug) => ({
      url: `${BASE_URL}/faq/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    ...therapists.map((therapist) => ({
      url: `${BASE_URL}/therapists/${therapist.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: therapist.slug === "sarah-chen" ? 0.88 : 0.8,
    })),
  ];
}
