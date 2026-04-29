import SpecialtyPage from "@/components/SpecialtyPage";
import { getSpecialty } from "@/lib/specialties";

const specialty = getSpecialty("grief-counselling-ottawa")!;

export const metadata = {
  title: specialty.title,
  description: specialty.metaDescription,
};

export default function Page() {
  return <SpecialtyPage specialty={specialty} />;
}
