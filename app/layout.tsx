import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valisen Mental Health - Ottawa Therapy Clinic",
  description:
    "Valisen Mental Health is an Ottawa therapy clinic offering in-person and virtual sessions with Registered Psychotherapists and Registered Social Workers across Ontario.",
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  name: "Valisen Mental Health",
  url: "https://valisenmentalhealth.com",
  telephone: "613-707-0333",
  email: "support@valisencare.ca",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Ottawa",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  areaServed: ["Ottawa", "Ontario"],
  medicalSpecialty: "Psychiatry",
  serviceType: [
    "Individual Therapy",
    "Couples Therapy",
    "Anxiety Therapy",
    "Trauma Therapy",
    "Depression Therapy",
    "Grief Counselling",
    "Virtual Therapy Ontario",
  ],
  description:
    "Valisen Mental Health is an Ottawa therapy clinic offering in-person and virtual sessions with Registered Psychotherapists and Registered Social Workers.",
  priceRange: "$$",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
