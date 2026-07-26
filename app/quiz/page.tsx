import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import QuizFlow from "@/components/quiz/QuizFlow";

export const metadata: Metadata = {
  title: "Why haven't I been feeling like myself? | Self-Reflection Quiz",
  description:
    "A short self-reflection on worry, mood, stress, and connection, followed by a personalized snapshot and therapist recommendation. Educational only — not a diagnosis.",
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
            <span className="badge-outline-teal mb-5">TAKE THE 3-MINUTE QUIZ</span>
            <h1 className="font-serif text-[34px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[46px]">
              How have you{" "}
              <span className="italic text-teal">really been feeling</span> lately?
            </h1>
            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.7] text-ink-secondary">
              Worry, low mood, stress, and strained relationships can feel surprisingly similar from
              the inside. Answer a few honest questions and get your personal well-being snapshot —
              plus what might actually help.
            </p>
            <p className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12.5px] font-medium text-ink-hint">
              <span>Educational only · Not a diagnosis</span>
              <span aria-hidden="true">·</span>
              <span>Personalized snapshot</span>
              <span aria-hidden="true">·</span>
              <span>~3 minutes</span>
            </p>
          </div>

          <QuizFlow />
        </div>
      </section>

      <Footer />
    </main>
  );
}
