import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import GoogleAdsJourneyBoundary from "@/components/GoogleAdsJourneyBoundary";
import { GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP } from "@/lib/googleAdsHomepageEntry";
import SiteAnalyticsBoundary from "@/components/SiteAnalyticsBoundary";
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

const GOOGLE_ADS_ENTRY_BOOTSTRAP = `(function(){try{
  var u=new URL(window.location.href),p=new URLSearchParams(u.hash.slice(1));
  var k="vmh_ga",t=p.get(k),s="valisen:google-ads-journey-proof:v1";
  var c="valisen:first-touch-google-click:v1",m="valisen:google-ads-internal-navigation:v1";
  var stateKeys=[s,c,"valisen:google-ads-conversion-proof:v1","valisen:google-ads-session:v2","valisen:google-ads-pending:v2","valisen:google-ads-thank-you:v2",m];
  var clear=function(){for(var j=0;j<stateKeys.length;j++){sessionStorage.removeItem(stateKeys[j])}};
  var internal=false,mr=sessionStorage.getItem(m);sessionStorage.removeItem(m);
  if(mr){try{var mo=JSON.parse(mr),mn=Date.now(),mp=u.pathname.length>1&&u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname;internal=mo&&mo.version===1&&mo.path===mp&&typeof mo.createdAt==="number"&&mo.createdAt<=mn+1000&&mo.createdAt>=mn-15000}catch(_){internal=false}}
  var reset=p.get("vmh_gx")==="1"||u.searchParams.has("fbclid");
  var source=(u.searchParams.get("utm_source")||"").toLowerCase();
  if(source&&source!=="google"){reset=true}
  if(t===null&&document.referrer){try{if(new URL(document.referrer).origin!==u.origin){reset=true}}catch(_){reset=true}}
  if(t===null&&!document.referrer&&!internal){var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(n&&n.type==="navigate"&&sessionStorage.getItem(s)){reset=true}}
  if(t===null&&sessionStorage.getItem(s)){try{var z=JSON.parse(sessionStorage.getItem("valisen:google-ads-session:v2")||"null"),d=Date.parse(z&&z.lastActivityAt||"");if(z&&(!isFinite(d)||d<Date.now()-1800000)){reset=true}}catch(_){reset=true}}
  if(t===null&&reset){clear()}
  if(t!==null){var v=/^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(t)&&t.length<=2500;
    if(v){sessionStorage.setItem(s,t);var a={},ks=["gclid","gbraid","wbraid"];
      for(var i=0;i<ks.length;i++){var f="vmh_"+ks[i],x=p.get(f)||u.searchParams.get(ks[i]);if(x&&/^[A-Za-z0-9._~-]{6,500}$/.test(x)){a[ks[i]]=x}p.delete(f);u.searchParams.delete(ks[i])}
      if(Object.keys(a).length){sessionStorage.setItem(c,JSON.stringify(a))}else{sessionStorage.removeItem(c)}
    }else{clear()}}
  p.delete(k);p.delete("vmh_gx");
  var active=sessionStorage.getItem(s);if(active&&/^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(active)){window.dataLayer=window.dataLayer||[];var g=function(){window.dataLayer.push(arguments)};g("consent","default",{ad_storage:"denied",analytics_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",wait_for_update:500})}
  if(t!==null||reset){var q=u.searchParams.toString(),h=p.toString();history.replaceState(history.state,"",u.pathname+(q?"?"+q:"")+(h?"#"+h:""))}
}catch(_){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        <script
          id="google-ads-homepage-entry"
          dangerouslySetInnerHTML={{
            __html: GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP,
          }}
        />
        <script
          id="google-ads-entry-bootstrap"
          dangerouslySetInnerHTML={{
            __html: GOOGLE_ADS_ENTRY_BOOTSTRAP,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
        />
      </head>
      <body>
        <GoogleAdsJourneyBoundary />
        <SiteAnalyticsBoundary />
        {children}
      </body>
    </html>
  );
}

