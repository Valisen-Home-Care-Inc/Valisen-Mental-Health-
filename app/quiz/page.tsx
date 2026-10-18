import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import QuizFlow from "@/components/quiz/QuizFlow";
import styles from "./QuizPage.module.css";

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
    <main className={styles.page}>
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

      {/* Every quiz step draws its own full-width brand band at the top. */}
      <section id="quiz-shell" className={styles.section}>
        <div className="container-v max-w-[1080px]">
          <QuizFlow />
        </div>
      </section>

      <Footer tone="brand" />
    </main>
  );
}
