import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import type { ReferralFields } from "@/lib/referrals";
import { getTherapistBySlug } from "@/lib/therapists";

export const dynamic = "force-dynamic";
type Referral = { id: string; created_at: string; details: ReferralFields; consent_version: string; status: string };

async function updateStatus(form: FormData) {
  "use server";
  await requireCheckpointAdminPage("/admin/checkpoints/referrals");
  const id = form.get("id");
  const status = form.get("status");
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id) || typeof status !== "string" || !["new", "contacted", "closed"].includes(status)) return;
  await callSupabaseRpc("update_provider_referral", { p_id: id, p_status: status });
  revalidatePath("/admin/checkpoints/referrals");
}

export default async function ReferralsInbox({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireCheckpointAdminPage("/admin/checkpoints/referrals");
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1)));
  let referrals: Referral[] = [];
  let unavailable = false;
  try { referrals = await callSupabaseRpc<Referral[]>("list_provider_referrals", { p_offset: (page - 1) * 50 }); }
  catch { unavailable = true; }
  return <section className="mx-auto max-w-5xl p-6" data-private="true" data-hj-suppress>
    <h1 className="text-3xl font-semibold">Provider referrals</h1>
    <p className="mt-3 text-sm text-ink-secondary">Private patient information. Review new referrals regularly and coordinate care using the patient’s preferred contact method. Clinical updates require separate authorization. Refresh to check for new referrals.</p>
    {unavailable ? <p role="alert" className="mt-6 border border-red-300 p-4">The referral inbox is unavailable. Check database configuration and the provider-referrals migration.</p> : referrals.length === 0 ? <p className="mt-6">No referrals on this page.</p> : <div className="mt-6 space-y-4">{referrals.map(referral => {
      const r = referral.details;
      return <details key={referral.id} className="border border-black/15 bg-white p-5">
        <summary className="cursor-pointer font-semibold">{r.patientName} <span className="font-normal">— {referral.status} · {new Date(referral.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })} (Toronto)</span></summary>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          {[ ["Provider", `${r.providerName} · ${r.providerRole} · ${r.organization}`], ["Provider contact", `${r.providerPhone} · ${r.providerEmail}`], ["Patient phone", r.patientPhone || "Not provided"], ["Patient email", r.patientEmail || "Not provided"], ["Preferred contact", r.contactMethod], ["Reason", r.reason], ["Language", r.language], ["Therapist preference", getTherapistBySlug(r.therapist)?.name || "No preference"], ["Coordination notes", r.notes || "None"], ["Patient authorization", `Confirmed at submission · version ${referral.consent_version}`] ].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
        </dl>
        <form action={updateStatus} className="mt-5 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={referral.id} />
          <label htmlFor={`status-${referral.id}`}>Status</label><select id={`status-${referral.id}`} name="status" defaultValue={referral.status} className="rounded border p-2"><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select><button className="btn-dark" type="submit">Update status</button>
        </form>
      </details>;
    })}</div>}
    <nav aria-label="Referral inbox pages" className="mt-6 flex gap-6">{page > 1 && <Link href={`/admin/checkpoints/referrals?page=${page - 1}`}>Previous page</Link>}{referrals.length === 50 && <Link href={`/admin/checkpoints/referrals?page=${page + 1}`}>Next page</Link>}</nav>
  </section>;
}
