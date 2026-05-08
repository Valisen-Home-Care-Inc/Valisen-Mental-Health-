import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy - Valisen Mental Health",
};

export default function PrivacyPolicyPage() {
  return (
    <main>
      <NavBar />
      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v max-w-[760px]">
          <h1 className="font-serif text-[36px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Privacy Policy
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-ink-secondary">
            Valisen Mental Health is committed to protecting your privacy. This policy will be
            updated shortly. For questions, contact{" "}
            <a
              href="mailto:support@valisencare.ca"
              className="font-medium text-ink underline hover:text-teal"
            >
              support@valisencare.ca
            </a>
            .
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
