import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import Script from "next/script";
import GlobalFunnelClickTracker from "@/components/GlobalFunnelClickTracker";
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
    "Valisen Mental Health is an Ottawa therapy clinic with Registered Psychotherapists and Registered Social Workers offering virtual therapy across Ontario.",
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
      "Book with a Registered Psychotherapist in Ottawa. Virtual therapy across Ontario.",
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
      "Book with a Registered Psychotherapist in Ottawa. Virtual therapy across Ontario.",
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
      "@type": "Organization",
      "@id": "https://valisenmentalhealth.com/#organization",
      name: "Valisen Mental Health",
      url: "https://valisenmentalhealth.com",
      logo: {
        "@type": "ImageObject",
        "@id": "https://valisenmentalhealth.com/#logo",
        url: "https://valisenmentalhealth.com/valisen-logo.png",
        contentUrl: "https://valisenmentalhealth.com/valisen-logo.png",
        width: 512,
        height: 512,
        caption: "Valisen Mental Health",
      },
      image: "https://valisenmentalhealth.com/valisen-logo.png",
      telephone: "613-707-0333",
      email: "info@valisenmentalhealth.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ottawa",
        addressRegion: "ON",
        addressCountry: "CA",
      },
      areaServed: [
        { "@type": "City", name: "Ottawa" },
        { "@type": "State", name: "Ontario" },
      ],
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
        "Valisen Mental Health is an Ottawa therapy clinic offering virtual sessions with Registered Psychotherapists and Registered Social Workers across Ontario.",
      priceRange: "$$",
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
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-T3RZ2837');
          `}
        </Script>
        {/* End Google Tag Manager */}
      </head>
      <body>
        <GlobalFunnelClickTracker />
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-T3RZ2837"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
      </body>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18124413697"
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18124413697');
        `}
      </Script>
    </html>
  );
}

