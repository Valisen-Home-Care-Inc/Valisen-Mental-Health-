import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import QuizFlow from "@/components/quiz/QuizFlow";

export const metadata: Metadata = {
  title: "Find Your Therapist | Valisen Mental Health",
  description:
    "Tell us what you are looking for and Valisen will help match you with a therapist based on your needs, preferences, language, and availability.",
  alternates: {
    canonical: "https://valisenmentalhealth.com/quiz",
  },
  robots: {
    // Quiz is a paid-traffic landing experience, not an SEO page.
    index: false,
    follow: true,
  },
};

export default function QuizPage() {
  return (
    <main className="bg-canvas">
      {/*
       * A private result may arrive as #result=<opaque token>. Move it into
       * session storage during HTML parsing and remove the fragment before
       * afterInteractive analytics can observe the URL.
       */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var token="";try{var hash=window.location.hash||"";var direct=hash.match(/^#result(?:=|\\/)([A-Za-z0-9._-]+)$/);if(direct){token=direct[1]}else if(hash.indexOf("#result?")===0){token=new URLSearchParams(hash.slice(8)).get("token")||""}if(token){window.sessionStorage.setItem("valisen.quiz.resultToken",token);window.history.replaceState(null,"",window.location.pathname+window.location.search)}}catch(_error){if(token){window.history.replaceState(null,"",window.location.pathname+window.location.search)}}})();`,
        }}
      />
      <NavBar hideBookingCta />

      <section id="quiz-shell" className="bg-canvas py-8 md:py-12">
        <div className="container-v max-w-[1080px]">
          <div id="quiz-intro" className="mx-auto mb-8 max-w-[600px] text-center">
            <span className="badge-outline-teal mb-5">GET MATCHED IN ABOUT 2 MINUTES</span>
            <h1 className="font-serif text-[34px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[46px]">
              Find a therapist who{" "}
              <span className="italic text-teal">fits what you need</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.7] text-ink-secondary">
              Answer a few quick questions about what you&apos;re looking for. We&apos;ll use your answers
              to help identify the right fit and make starting therapy feel simpler.
            </p>
            <p className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12.5px] font-medium text-ink-hint">
              <span>Private and personalized</span>
              <span aria-hidden="true">·</span>
              <span>Free 20-minute consultation</span>
              <span aria-hidden="true">·</span>
              <span>About 2 minutes</span>
            </p>
          </div>

          <QuizFlow />
        </div>
      </section>

      <Footer />
    </main>
  );
}
