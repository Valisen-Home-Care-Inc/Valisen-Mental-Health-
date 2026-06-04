import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mental Health FAQ | Am I Depressed? Do I Have Anxiety? | Valisen Mental Health Ottawa",
  description:
    "Honest answers to the most common mental health questions — including signs of depression and anxiety, how to find the right therapist, insurance coverage in Ontario, and what to expect from therapy.",
  keywords: [
    "am I depressed",
    "do I have anxiety",
    "signs of depression",
    "anxiety symptoms",
    "how to find a therapist Ottawa",
    "therapy cost Ottawa",
    "does insurance cover therapy Ontario",
    "CBT vs EMDR vs DBT",
    "how long does therapy take",
    "Registered Psychotherapist vs Registered Social Worker",
    "therapy FAQ Ottawa",
    "mental health questions Ottawa",
  ],
  openGraph: {
    title: "Mental Health FAQ | Valisen Mental Health Ottawa",
    description:
      "Clear, professionally written answers to the most common questions about therapy, mental health signs, insurance, and getting started.",
    type: "website",
    url: "https://valisenmentalhealth.ca/faq",
  },
  alternates: {
    canonical: "https://valisenmentalhealth.ca/faq",
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
