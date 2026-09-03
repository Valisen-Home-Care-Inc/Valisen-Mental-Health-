import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PaidSearchLandingPage from "@/components/paid-search/PaidSearchLandingPage";
import {
  googleAdsDirectEntryPath,
  type HomepageSearchParams,
} from "@/lib/googleAdsHomepageEntry";
import { getPaidSearchLandingPage } from "@/lib/paidSearchLandingPages";

const config = getPaidSearchLandingPage();
const canonical = "https://valisenmentalhealth.com/welcome";

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

export default async function WelcomeLandingPage({
  searchParams,
}: {
  searchParams: Promise<HomepageSearchParams>;
}) {
  // A real Google Ads click is signed on the server before any HTML is sent,
  // so the CRM counts it even if the visitor leaves before scripts run. The
  // inline pre-hydration bridge in the root layout remains as a fallback.
  const entry = googleAdsDirectEntryPath("/welcome", await searchParams);
  if (entry) redirect(entry);
  return <PaidSearchLandingPage config={config} landingPath="/welcome" />;
}
