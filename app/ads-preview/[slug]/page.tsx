import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConceptLanding from "@/components/paid-search/concepts/ConceptLanding";
import { conceptTherapists, getPaidSearchConcept, paidSearchConcepts } from "@/lib/paidSearchConcepts";
import { landingTranslator } from "@/lib/paidSearchLocale";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";

export function generateStaticParams() {
  return paidSearchConcepts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const concept = getPaidSearchConcept((await params).slug);
  const t = concept?.slug === "arabic" ? landingTranslator("ar", arabicLandingTranslations) : concept?.slug === "mandarin" ? landingTranslator("zh-Hans", mandarinLandingTranslations) : landingTranslator("en");
  return {
    title: { absolute: `${t(concept?.label || "Page")} | ${t("Valisen Mental Health")} · ${t("Design preview")}` },
    description: concept ? t(concept.introduction) : undefined,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export default async function AdsPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const concept = getPaidSearchConcept((await params).slug);
  if (!concept) notFound();
  const clinicians = conceptTherapists(concept).map(({ therapist, ...fit }) => ({
    ...fit, name: therapist.name, role: therapist.credentialSummary,
    photo: therapist.photo || "/valisen-logo.png", fee: therapist.therapySessionPriceMinimum,
    duration: therapist.therapySessionDurationMinutes, languages: therapist.languages,
    qualifications: therapist.credentialsList,
  }));
  return <ConceptLanding key={concept.slug} concept={concept} clinicians={clinicians} previews={paidSearchConcepts.map(({ slug, label }) => ({ slug, label }))} />;
}
