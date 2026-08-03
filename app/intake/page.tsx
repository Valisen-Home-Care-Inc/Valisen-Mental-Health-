import { redirect } from "next/navigation";
import { getConsultationRequestUrl } from "@/lib/intake";

export const metadata = {
  title: "Free consultation - Valisen Mental Health",
  description: "Request a free consultation with the Valisen Mental Health team.",
};

export default function IntakePage({
  searchParams,
}: {
  searchParams?: { therapist?: string | string[] };
}) {
  const therapist = Array.isArray(searchParams?.therapist)
    ? searchParams?.therapist[0]
    : searchParams?.therapist;
  redirect(getConsultationRequestUrl(therapist, "legacy_intake"));
}
