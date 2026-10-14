import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CheckpointExperience from "@/components/checkpoints/CheckpointExperience";
import MentalBatteryJourney from "@/components/checkpoints/journey/MentalBatteryJourney";
import { checkpointClinicians } from "@/lib/checkpoints/journey/clinicians";
import { checkpointJourneyReady } from "@/lib/server/checkpointJourneyRepository";
import {
  CHECKPOINT_CODES,
  isCheckpointCode,
} from "@/lib/checkpoints/config";

type CheckpointPageProps = {
  params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mental Battery Checkpoint",
  description:
    "A private, 30-second mental wellness reflection from Valisen Mental Health.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export function generateStaticParams() {
  return CHECKPOINT_CODES.map((code) => ({ code }));
}

export default async function CheckpointPage({ params }: CheckpointPageProps) {
  const { code } = await params;
  if (!isCheckpointCode(code)) notFound();

  // Never replace working requests with a form whose database migration is missing.
  if (!await checkpointJourneyReady()) return <CheckpointExperience checkpointCode={code} />;
  return <MentalBatteryJourney key={code} checkpointCode={code} clinicians={checkpointClinicians()} />;
}
