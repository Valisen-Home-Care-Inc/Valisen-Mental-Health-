import type { Metadata } from "next";
import ConceptGallery from "@/components/paid-search/concepts/ConceptGallery";
import { conceptTherapists, paidSearchConcepts } from "@/lib/paidSearchConcepts";
import keywordMap from "@/lib/paidSearchKeywordMap.json";

export const metadata: Metadata = {
  title: { absolute: "Google Ads Page Concepts | Valisen Design Preview" },
  description: "Review focused Google Ads landing-page concepts for Valisen Mental Health.",
  openGraph: {
    title: "Valisen | Google Ads Landing Page Concepts",
    description: "Explore 15 focused landing-page designs, including Arabic and Mandarin. Interactive previews for team review.",
    url: "https://valisenmentalhealth.com/ads-preview",
  },
  twitter: {
    card: "summary",
    title: "Valisen | Google Ads Landing Page Concepts",
    description: "Explore 15 focused landing-page designs. Interactive previews for team review.",
  },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AdsPreviewGallery() {
  const concepts = paidSearchConcepts.map((concept) => {
    const first = conceptTherapists(concept)[0]?.therapist;
    return { slug: concept.slug, label: concept.label, collection: concept.collection,
      tone: concept.tone, headline: concept.headline, emphasis: concept.emphasis,
      photo: first?.photo || "/valisen-logo.png", clinician: first?.name || "Valisen team",
      role: first?.credentialSummary || "", keywords: keywordMap.filter((keyword) => keyword.slug === concept.slug).length };
  });
  return <ConceptGallery concepts={concepts} keywordCount={keywordMap.length} />;
}
