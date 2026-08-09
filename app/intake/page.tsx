import { redirect } from "next/navigation";
import { getConsultationRequestUrl } from "@/lib/intake";

export const metadata = {
  title: "Free consultation - Valisen Mental Health",
  description: "Request a free consultation with the Valisen Mental Health team.",
};

export default async function IntakePage({
  searchParams,
}: {
  searchParams?: Promise<{ therapist?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const therapist = Array.isArray(resolvedSearchParams?.therapist)
    ? resolvedSearchParams?.therapist[0]
    : resolvedSearchParams?.therapist;
  redirect(getConsultationRequestUrl(therapist, "legacy_intake"));
}
