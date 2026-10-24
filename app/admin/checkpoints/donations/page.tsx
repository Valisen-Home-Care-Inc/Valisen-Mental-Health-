import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatDonationCents } from "@/lib/donations/contract";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchDonationReport, type DonationReport } from "@/lib/server/donationRepository";

export const dynamic = "force-dynamic";

const TORONTO = "America/Toronto";

const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  failed: "Failed",
  paid: "Paid",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function stripePaymentUrl(paymentIntentId: string | null, livemode: boolean): string | null {
  if (!paymentIntentId) return null;
  return `https://dashboard.stripe.com/${livemode ? "" : "test/"}payments/${paymentIntentId}`;
}

function Tile({ label, cents, count }: { label: string; cents: number; count: number }) {
  return (
    <div className="rounded-[18px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667471]">{label}</p>
      <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-[-0.6px] text-[#192725]">
        {formatDonationCents(cents)}
      </p>
      <p className="mt-1 text-[12px] text-[#667471]">
        {count} {count === 1 ? "contribution" : "contributions"}
      </p>
    </div>
  );
}

export default async function DonationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCheckpointAdminPage("/admin/checkpoints/donations");
  const params = await searchParams;
  const livemode = params.mode !== "test";

  let report: DonationReport | null = null;
  let error: string | null = null;
  try {
    report = await fetchDonationReport(livemode);
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "Contribution records are temporarily unavailable.";
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-7 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.6px] text-[#192725]">
            Contributions
          </h1>
          <p className="mt-1 max-w-[680px] text-[13px] leading-6 text-[#667471]">
            Subsidized psychotherapy contributions from /donate, recorded only from
            signature-verified Stripe webhooks. Totals are net of refunds and use
            Toronto dates. Donor names and emails stay in Stripe.
          </p>
        </div>
        <nav aria-label="Payment mode" className="flex gap-1 rounded-[12px] bg-white p-1 shadow-sm">
          <Link
            href="/admin/checkpoints/donations"
            aria-current={livemode ? "page" : undefined}
            className={`rounded-[9px] px-3 py-2 text-[12.5px] font-medium no-underline ${livemode ? "bg-[#153f3e] text-white" : "text-[#4d5a58]"}`}
          >
            Live payments
          </Link>
          <Link
            href="/admin/checkpoints/donations?mode=test"
            aria-current={!livemode ? "page" : undefined}
            className={`rounded-[9px] px-3 py-2 text-[12.5px] font-medium no-underline ${!livemode ? "bg-[#153f3e] text-white" : "text-[#4d5a58]"}`}
          >
            Test mode
          </Link>
        </nav>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-[14px] border border-[#f1c7c2] bg-[#fdf0ee] p-4 text-[13px] text-[#8a1c12]">
          {error} If the donations migration has not been applied yet, run
          supabase/migrations/20261024000000_donations.sql.
        </p>
      ) : null}

      {report ? (
        <>
          <section aria-label="Totals" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Today" cents={report.totals.todayCents} count={report.totals.todayCount} />
            <Tile label="Last 7 days" cents={report.totals.last7DaysCents} count={report.totals.last7DaysCount} />
            <Tile label="Last 30 days" cents={report.totals.last30DaysCents} count={report.totals.last30DaysCount} />
            <Tile label="All time" cents={report.totals.allTimeCents} count={report.totals.allTimeCount} />
          </section>
          <p className="mt-3 text-[12px] text-[#667471]">
            Refunded to date: {formatDonationCents(report.totals.refundedCents)} ·
            Payments still processing: {report.pendingCount} · Amounts are before
            Stripe fees.
          </p>

          <section
            aria-labelledby="donation-sources"
            className="mt-6 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6"
          >
            <h2 id="donation-sources" className="text-[18px] font-semibold tracking-[-0.4px] text-[#192725]">
              By source
            </h2>
            <p className="mt-1 text-[12px] text-[#667471]">
              From utm_source and utm_campaign on the /donate link (for example a QR code).
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-black/[0.07] text-left text-[11px] uppercase tracking-[0.08em] text-[#667471]">
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Campaign</th>
                    <th className="px-3 py-2 text-right font-semibold">Contributions</th>
                    <th className="px-3 py-2 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-[#667471]">No contributions yet.</td>
                    </tr>
                  ) : (
                    report.sources.map((row) => (
                      <tr key={`${row.source}:${row.campaign}`} className="border-b border-black/[0.05]">
                        <td className="px-3 py-2.5 font-medium text-[#192725]">{row.source}</td>
                        <td className="px-3 py-2.5 text-[#4d5a58]">{row.campaign || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatDonationCents(row.netCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            aria-labelledby="donation-recent"
            className="mt-6 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6"
          >
            <h2 id="donation-recent" className="text-[18px] font-semibold tracking-[-0.4px] text-[#192725]">
              Recent contributions
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-black/[0.07] text-left text-[11px] uppercase tracking-[0.08em] text-[#667471]">
                    <th className="px-3 py-2 font-semibold">Paid</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Option</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-[#667471]">No contributions yet.</td>
                    </tr>
                  ) : (
                    report.recent.map((row) => {
                      const url = stripePaymentUrl(row.paymentIntentId, livemode);
                      return (
                        <tr key={row.checkoutSessionId} className="border-b border-black/[0.05]">
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(row.paidAt ?? row.createdAt)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            {formatDonationCents(row.amountCents)}
                            {row.amountRefundedCents > 0 ? (
                              <span className="block text-[11px] text-[#8a1c12]">
                                −{formatDonationCents(row.amountRefundedCents)}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">{STATUS_LABELS[row.status] ?? row.status}</td>
                          <td className="px-3 py-2.5 capitalize text-[#4d5a58]">{row.amountOption ?? "—"}</td>
                          <td className="px-3 py-2.5 text-[#4d5a58]">
                            {[row.utmSource, row.utmCampaign].filter(Boolean).join(" · ") || "direct"}
                          </td>
                          <td className="px-3 py-2.5">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-[#153f3e]"
                              >
                                Open <ExternalLink size={12} aria-hidden="true" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
