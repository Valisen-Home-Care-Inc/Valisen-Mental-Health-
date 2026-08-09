import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TherapistProfile from "@/components/TherapistProfile";
import { getTherapistBySlug, therapists } from "@/lib/therapists";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return therapists.map((therapist) => ({
    slug: therapist.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const therapist = getTherapistBySlug(slug);

  if (!therapist) {
    return {
      title: "Therapist Profile - Valisen Mental Health",
    };
  }

  return {
    title: therapist.seo.title,
    description: therapist.seo.description,
    keywords: therapist.seo.keywords,
    alternates: {
      canonical: `https://valisenmentalhealth.com/therapists/${therapist.slug}`,
    },
    openGraph: {
      title: `${therapist.name}, ${therapist.credentials}`,
      description: therapist.seo.description,
      url: `https://valisenmentalhealth.com/therapists/${therapist.slug}`,
      type: "profile",
      siteName: "Valisen Mental Health",
    },
  };
}

export default async function TherapistPage({ params }: PageProps) {
  const { slug } = await params;
  const therapist = getTherapistBySlug(slug);

  if (!therapist) {
    notFound();
  }

  return <TherapistProfile therapist={therapist} />;
}
