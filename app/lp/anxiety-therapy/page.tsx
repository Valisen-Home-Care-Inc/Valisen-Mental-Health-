import type { Metadata } from "next";
import PaidSearchLandingPage from "@/components/paid-search/PaidSearchLandingPage";
import { getPaidSearchLandingPage } from "@/lib/paidSearchLandingPages";

const config = getPaidSearchLandingPage("anxiety-therapy");
const canonical = "https://valisenmentalhealth.com/lp/anxiety-therapy";

export const metadata: Metadata = {
  title: { absolute: config.title },
  description: config.description,
  alternates: { canonical },
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: canonical,
    siteName: "Valisen Mental Health",
    title: config.title,
    description: config.description,
  },
  twitter: {
    card: "summary",
    title: config.title,
    description: config.description,
  },
};

export default function AnxietyTherapyLandingPage() {
  return <PaidSearchLandingPage config={config} />;
}
