import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminShell from "@/components/checkpoints/admin/AdminShell";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Valisen Growth & Consultation Operations",
  description: "Private Valisen growth analytics, checkpoint intelligence, and consultation operations.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function CheckpointAdminLayout({ children }: { children: ReactNode }) {
  await requireCheckpointAdminPage("/admin/checkpoints");
  return <AdminShell>{children}</AdminShell>;
}
