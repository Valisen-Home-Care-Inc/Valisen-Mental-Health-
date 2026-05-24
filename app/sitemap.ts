import type { MetadataRoute } from "next";

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
      url: `${BASE_URL}/intake`,
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
      url: `${BASE_URL}/privacy-policy`,
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
  ];
}
