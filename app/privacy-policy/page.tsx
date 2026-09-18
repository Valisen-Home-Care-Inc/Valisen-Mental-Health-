import type { Metadata } from "next";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Valisen Mental Health",
  description:
    "Valisen Mental Health's Privacy Policy. How we collect, use, protect and disclose your personal health information under PIPEDA and PHIPA (Ontario).",
  alternates: { canonical: "https://valisenmentalhealth.com/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return <main><NavBar /><PrivacyPolicyContent /><Footer /></main>;
}
