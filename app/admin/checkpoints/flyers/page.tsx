import FlyerGeneratorClient from "@/components/checkpoints/admin/FlyerGeneratorClient";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";

export const dynamic = "force-dynamic";

export default async function CheckpointFlyersPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/flyers");
  return <FlyerGeneratorClient />;
}
