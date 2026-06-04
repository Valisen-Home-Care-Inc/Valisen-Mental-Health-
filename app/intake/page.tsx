import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import IntakeForm from "@/components/IntakeForm";
import { normalizePreferredTherapist } from "@/lib/intake";

type IntakePageProps = {
  searchParams?: {
    therapist?: string | string[];
  };
};

export const metadata = {
  title: "Free intake - Valisen Mental Health",
  description:
    "A simple intake to help connect you with a Registered Psychotherapist or Social Worker in Ontario.",
};

export default function IntakePage({ searchParams }: IntakePageProps) {
  const therapistParam = Array.isArray(searchParams?.therapist)
    ? searchParams?.therapist[0]
    : searchParams?.therapist;
  const initialPreferredTherapist = normalizePreferredTherapist(therapistParam);

  return (
    <main className="min-h-screen bg-canvas">
      <NavBar />

      <section className="py-12 md:py-20">
        <div className="container-v max-w-[560px]">
          <div className="mb-8 text-center">
            <span className="badge-outline-teal mb-5">FREE MATCHING INTAKE</span>
            <h1 className="font-serif text-[36px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Tell us a bit about you
            </h1>
            <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.6] text-ink-secondary">
              We&apos;ll connect you with a Registered Psychotherapist or Social Worker who fits
              what you&apos;re looking for.
            </p>
          </div>

          <IntakeForm initialPreferredTherapist={initialPreferredTherapist} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
