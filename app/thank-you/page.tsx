import type { Metadata } from "next";
import GoogleAdsThankYou from "@/components/GoogleAdsThankYou";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: "Consultation Request Received | Valisen Mental Health" },
  description:
    "Confirmation that your Valisen Mental Health consultation request was received.",
  robots: { index: false, follow: false, noarchive: true },
  alternates: { canonical: "https://valisenmentalhealth.com/consultation" },
};

export default function ThankYouPage() {
  return <GoogleAdsThankYou />;
}
