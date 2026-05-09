import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://valisenmentalhealth.com"),
  title: {
    default: "Valisen Mental Health — Ottawa Therapy Clinic | Registered Therapists",
    template: "%s | Valisen Mental Health Ottawa",
  },
  description:
    "Valisen Mental Health is an Ottawa therapy clinic with Registered Psychotherapists and Social Workers. Book in-person or virtual therapy across Ontario — usually matched within days.",
  keywords: [
    "therapy Ottawa",
    "therapist Ottawa",
    "psychotherapist Ottawa",
    "registered psychotherapist Ottawa",
    "mental health Ottawa",
    "anxiety therapy Ottawa",
    "depression therapy Ottawa",
    "trauma therapy Ottawa",
    "grief counselling Ottawa",
    "virtual therapy Ontario",
    "online therapy Ontario",
    "couples therapy Ottawa",
    "stress therapy Ottawa",
    "Ottawa mental health clinic",
    "registered social worker Ottawa",
  ],
  authors: [{ name: "Valisen Mental Health" }],
  creator: "Valisen Mental Health",
  publisher: "Valisen Mental Health",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://valisenmentalhealth.com",
    siteName: "Valisen Mental Health",
    title: "Valisen Mental Health — Ottawa Therapy Clinic",
    description:
      "Book with a Registered Psychotherapist or Social Worker in Ottawa. In-person and virtual therapy across Ontario, matched to you within days.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Valisen Mental Health — Ottawa Therapy Clinic",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valisen Mental Health — Ottawa Therapy Clinic",
    description:
      "Book with a Registered Psychotherapist in Ottawa. In-person and virtual therapy across Ontario.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://valisenmentalhealth.com",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["MedicalClinic", "LocalBusiness"],
      "@id": "https://valisenmentalhealth.com/#organization",
      name: "Valisen Mental Health",
      url: "https://valisenmentalhealth.com",
      logo: "https://valisenmentalhealth.com/valisen-logo.png",
      telephone: "613-707-0333",
      email: "info@valisenmentalhealth.com",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Ottawa",
        addressLocality: "Ottawa",
        addressRegion: "ON",
        addressCountry: "CA",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 45.4215,
        longitude: -75.6972,
      },
      areaServed: [
        { "@type": "City", name: "Ottawa" },
        { "@type": "State", name: "Ontario" },
      ],
      medicalSpecialty: "Psychiatry",
      availableService: [
        { "@type": "MedicalTherapy", name: "Individual Therapy" },
        { "@type": "MedicalTherapy", name: "Couples Therapy" },
        { "@type": "MedicalTherapy", name: "Anxiety Therapy" },
        { "@type": "MedicalTherapy", name: "Trauma Therapy" },
        { "@type": "MedicalTherapy", name: "Depression Therapy" },
        { "@type": "MedicalTherapy", name: "Grief Counselling" },
        { "@type": "MedicalTherapy", name: "Virtual Therapy Ontario" },
      ],
      description:
        "Valisen Mental Health is an Ottawa therapy clinic offering in-person and virtual sessions with Registered Psychotherapists and Registered Social Workers across Ontario.",
      priceRange: "$$",
      openingHours: "Mo-Fr 09:00-19:00",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
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

