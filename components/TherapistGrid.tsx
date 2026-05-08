// TODO: Replace placeholder cards with real therapist profiles and
// headshots once onboarding is complete.

import Link from "next/link";

const THERAPISTS = [
  {
    name: "Sarah M.",
    designation: "RP",
    specialty: "Anxiety & Stress",
    bookLabel: "Book With Sarah",
  },
  {
    name: "James T.",
    designation: "RSW",
    specialty: "Trauma & PTSD",
    bookLabel: "Book With James",
  },
  {
    name: "Priya K.",
    designation: "RP",
    specialty: "Couples & Relationships",
    bookLabel: "Book With Priya",
  },
];

function AvatarPlaceholder({ initials }: { initials: string }) {
  return (
    <div
      className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage text-[22px] font-medium text-ink-secondary"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function TherapistGrid() {
  return (
    <section className="bg-canvas pb-16 md:pb-24">
      <div className="container-v">
        <div className="mb-10 max-w-[640px]">
          <span className="badge-outline-teal mb-5">OUR THERAPISTS</span>
          <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Meet Our Therapists
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {THERAPISTS.map((therapist) => {
            const initials = therapist.name
              .split(" ")
              .map((p) => p[0])
              .join("");
            return (
              <article
                key={therapist.name}
                className="rounded-card border-[0.5px] border-hairline bg-white p-7 text-center"
              >
                <AvatarPlaceholder initials={initials} />
                <h3 className="mt-5 font-serif text-vlg font-medium text-ink">
                  {therapist.name}, {therapist.designation}
                </h3>
                <p className="mt-1 text-[14px] text-ink-secondary">{therapist.specialty}</p>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  <span className="text-[12px] font-medium text-green-700">
                    Accepting New Clients
                  </span>
                </div>
                <Link
                  href="/#book"
                  className="btn-primary mt-5 w-full justify-center text-sm"
                >
                  {therapist.bookLabel} &rarr;
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
