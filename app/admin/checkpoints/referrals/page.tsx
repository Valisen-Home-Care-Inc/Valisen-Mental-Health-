import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
export const dynamic = "force-dynamic";
export default async function ReferralsDeliveryPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/referrals");
  return <section className="mx-auto max-w-3xl p-6">
    <h1 className="text-3xl font-semibold">Patient referrals are delivered by email</h1>
    <p className="mt-4">New provider referrals go directly to info@valisenmentalhealth.com with a subject beginning &ldquo;PATIENT REFERRAL | Healthcare Provider&rdquo;.</p>
    <p className="mt-4">The website no longer stores new referrals in the CRM or database. Review referrals and coordinate patient contact from the clinic mailbox.</p>
  </section>;
}
