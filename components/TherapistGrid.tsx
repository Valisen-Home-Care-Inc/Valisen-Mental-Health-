import TherapistCard from "@/components/TherapistCard";
import { therapists as defaultTherapists, type Therapist } from "@/lib/therapists";

export default function TherapistGrid({
  therapists = defaultTherapists,
}: {
  therapists?: Therapist[];
}) {
  const sorted = [...therapists].sort((a, b) => {
    if (a.comingSoon && !b.comingSoon) return 1;
    if (!a.comingSoon && b.comingSoon) return -1;
    return 0;
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {sorted.map((therapist) => (
        <TherapistCard key={therapist.slug} therapist={therapist} />
      ))}
    </div>
  );
}
