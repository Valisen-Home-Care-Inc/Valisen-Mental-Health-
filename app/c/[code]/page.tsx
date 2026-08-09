import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CheckpointExperience from "@/components/checkpoints/CheckpointExperience";
import {
  CHECKPOINT_CODES,
  isCheckpointCode,
} from "@/lib/checkpoints/config";

type CheckpointPageProps = {
  params: Promise<{ code: string }>;
};

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

  return <CheckpointExperience checkpointCode={code} />;
}
