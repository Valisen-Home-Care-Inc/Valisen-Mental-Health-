import type { Metadata } from "next";
import PaidSearchThankYou from "@/components/paid-search/PaidSearchThankYou";

export const metadata: Metadata = {
  title: { absolute: "Consultation Request Received | Valisen Mental Health" },
  description:
    "Confirmation that your Valisen Mental Health consultation request was received.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: "https://valisenmentalhealth.com/welcome" },
};

export default function WelcomeThankYouPage() {
  return <PaidSearchThankYou />;
}
