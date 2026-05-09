import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Our Therapists — Registered Psychotherapists in Ottawa & Ontario",
  description:
    "Meet the Registered Psychotherapists and Social Workers at Valisen Mental Health. Book in-person therapy in Ottawa or virtual sessions anywhere in Ontario.",
  alternates: {
    canonical: "https://valisenmentalhealth.com/therapists",
  },
};

const THERAPISTS = [
  {
    name: "Sarah M.",
    designation: "RP",
    designationFull: "Registered Psychotherapist",
    specialty: "Anxiety & Stress",
    bio: "Sarah works with clients navigating anxiety, chronic stress, and the ways worry can take over daily life. Her approach is collaborative and practical — focused on helping you build tools that actually work for your life.",
    approaches: ["CBT", "Mindfulness-Based", "ACT"],
    accepting: true,
  },
  {
    name: "James T.",
    designation: "RSW",
    designationFull: "Registered Social Worker",
    specialty: "Trauma & PTSD",
    bio: "James specialises in trauma-informed care. He creates a safe, unhurried space for clients to process difficult experiences at their own pace — whether from a single event or ongoing adversity.",
    approaches: ["Trauma-Informed", "EMDR-Informed", "Somatic"],
    accepting: true,
  },
  {
    name: "Priya K.",
    designation: "RP",
    designationFull: "Registered Psychotherapist",
    specialty: "Couples & Relationships",
    bio: "Priya works with individuals and couples on relationship patterns, communication, and connection. She brings warmth and directness to sessions and helps clients find clearer language for what they're experiencing.",
    approaches: ["Emotionally Focused", "Narrative", "Systems"],
    accepting: true,
  },
];

function AvatarPlaceholder({ initials }: { initials: string }) {
  return (
    <div
      className="flex h-24 w-24 items-center justify-center rounded-full text-[26px] font-semibold text-white"
      style={{ background: "linear-gradient(135deg, #2A7F7F 0%, #8BB5A0 100%)" }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function TherapistsPage() {
  return (
    <main>
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-canvas">
        <div
          className="pointer-events-none absolute -right-80 -top-40 h-[600px] w-[600px] rounded-full bg-teal/[0.07] blur-[120px]"
          aria-hidden="true"
        />
        <div className="container-v relative z-10 py-24 md:py-32">
          <div className="max-w-[720px]">
            <span className="badge-outline-teal mb-6">OUR TEAM</span>
            <h1 className="mb-6 font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
              Meet our <span className="italic text-teal">therapists</span>
            </h1>
            <p className="max-w-[600px] text-vbase leading-[1.7] text-ink-secondary">
              All Valisen therapists are Registered Psychotherapists (RP) or Registered Social
              Workers (RSW) regulated under Ontario law. When you book with us, you&apos;re matched
              with the right person for your specific needs — not just whoever is next available.
            </p>
          </div>
        </div>
      </section>

      {/* Credentials bar */}
      <section className="border-y border-hairline bg-white">
        <div className="container-v grid grid-cols-1 gap-6 py-10 sm:grid-cols-3">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" stroke="#2A7F7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              title: "Ontario Regulated",
              body: "All therapists are registered with the College of Registered Psychotherapists of Ontario (CRPO) or the Ontario College of Social Workers.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#2A7F7F" strokeWidth="2" />
                  <path d="M8 2v4M16 2v4M3 10h18" stroke="#2A7F7F" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
              title: "Matched to You",
              body: "We don't assign whoever is available. Our team reviews your intake carefully and matches you with the right fit.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="#2A7F7F" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="#2A7F7F" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
              title: "Usually Within Days",
              body: "Most clients are matched and scheduled within a few days of submitting their intake form.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <div className="shrink-0 text-teal">{item.icon}</div>
              <div>
                <p className="mb-1 font-medium text-ink">{item.title}</p>
                <p className="text-[13.5px] leading-[1.6] text-ink-secondary">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Therapist cards */}
      <section className="bg-canvas py-24 md:py-32">
        <div className="container-v">
          <div className="mb-14 max-w-[600px]">
            <span className="badge-outline-teal mb-5">CURRENTLY ACCEPTING CLIENTS</span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Our registered therapists
            </h2>
          </div>

          <div className="flex flex-col gap-8">
            {THERAPISTS.map((therapist, idx) => {
              const initials = therapist.name
                .split(" ")
                .map((p) => p[0])
                .join("");
              return (
                <article
                  key={therapist.name}
                  className="card-lift grid grid-cols-1 gap-8 rounded-card border-[0.5px] border-hairline bg-white p-8 md:grid-cols-[auto_1fr_auto] md:items-start md:p-10"
                >
                  {/* Avatar */}
                  <AvatarPlaceholder initials={initials} />

                  {/* Info */}
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-3">
                      <h3 className="font-serif text-[24px] font-medium text-ink">
                        {therapist.name}
                      </h3>
                      <span className="rounded-full bg-teal-xlight px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-teal">
                        {therapist.designation}
                      </span>
                      {therapist.accepting && (
                        <span className="flex items-center gap-1.5 text-[12px] font-medium text-green-700">
                          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                          Accepting New Clients
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-[13px] font-medium text-ink-secondary">
                      {therapist.designationFull} · {therapist.specialty}
                    </p>
                    <p className="mb-5 max-w-[600px] text-[15px] leading-[1.7] text-ink-secondary">
                      {therapist.bio}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {therapist.approaches.map((approach) => (
                        <span
                          key={approach}
                          className="rounded-full border border-hairline bg-canvas px-3 py-1 text-[12px] font-medium text-ink-secondary"
                        >
                          {approach}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex flex-col gap-3 md:min-w-[160px]">
                    <Link href="/intake" className="btn-primary whitespace-nowrap text-sm">
                      Book with {therapist.name.split(" ")[0]} &rarr;
                    </Link>
                    <Link
                      href="/intake"
                      className="text-center text-[13px] text-ink-secondary hover:text-ink"
                    >
                      Not sure who to pick?
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-12 rounded-card border-[0.5px] border-hairline bg-white p-8 text-center">
            <p className="font-serif text-[22px] font-medium text-ink">
              Not sure which therapist is right for you?
            </p>
            <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-[1.6] text-ink-secondary">
              Complete our short intake form and we&apos;ll match you with the right therapist
              based on your specific needs, preferences, and availability.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/intake" className="btn-primary">
                Start My Matching Intake &rarr;
              </Link>
              <a href="tel:613-707-0333" className="btn-outline">
                Call 613-707-0333
              </a>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        dark
        headline="Ready to meet your therapist?"
        subtext="Book your intake today. We'll have you matched and scheduled within days."
      />
      <Footer />
    </main>
  );
}
