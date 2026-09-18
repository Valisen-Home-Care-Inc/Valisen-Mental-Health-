import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { googleAdsDirectEntryPath, type HomepageSearchParams } from "@/lib/googleAdsHomepageEntry";
import ConceptLanding from "@/components/paid-search/concepts/ConceptLanding";
import { conceptTherapists, getPaidSearchConcept, paidSearchConcepts } from "@/lib/paidSearchConcepts";
import { landingTranslator } from "@/lib/paidSearchLocale";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";

export function generateStaticParams() { return paidSearchConcepts.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const concept = getPaidSearchConcept((await params).slug);
  if (!concept) return {};
  const t = concept.slug === "arabic" ? landingTranslator("ar", arabicLandingTranslations) : concept.slug === "mandarin" ? landingTranslator("zh-Hans", mandarinLandingTranslations) : landingTranslator("en");
  const canonical = `https://valisenmentalhealth.com/welcome/${concept.slug}`;
  return { title: { absolute: `${t(concept.label)} | ${t("Valisen Mental Health")}` }, description: t(concept.introduction), alternates: { canonical }, openGraph: { title: t(concept.headline), description: t(concept.introduction), url: canonical, images: [conceptTherapists(concept)[0]?.therapist.photo || "/valisen-logo.png"] }, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } };
}
export default async function FocusedLandingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<HomepageSearchParams> }) {
  const concept = getPaidSearchConcept((await params).slug);
  if (!concept) notFound();
  const entry = googleAdsDirectEntryPath(`/welcome/${concept.slug}`, await searchParams);
  if (entry) redirect(entry);
  const clinicians = conceptTherapists(concept).map(({ therapist, ...fit }) => ({ ...fit, name: therapist.name, role: therapist.credentialSummary, photo: therapist.photo || "/valisen-logo.png", fee: therapist.therapySessionPriceMinimum, duration: therapist.therapySessionDurationMinutes, languages: therapist.languages, qualifications: therapist.credentialsList }));
  return <ConceptLanding key={concept.slug} concept={concept} clinicians={clinicians} previews={[]} preview={false} />;
}
