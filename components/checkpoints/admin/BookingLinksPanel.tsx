import { ArrowRight, CalendarDays, ScanQrCode } from "lucide-react";
import { formatCount } from "@/components/checkpoints/admin/MetricVisuals";
import {
  bookingDeviceLabel,
  BOOKING_REPORT_DAYS,
  type BookingLinkSection,
} from "@/lib/bookingLinkReport";

const TORONTO = "America/Toronto";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function DailyBars({ section }: { section: BookingLinkSection }) {
  const busiest = Math.max(0, ...section.daily.map((day) => day.count));
  const max = Math.max(busiest, 1);
  const first = section.daily[0]?.date;
  const last = section.daily[section.daily.length - 1]?.date;
  return (
    <div>
      <div
        className="flex h-[120px] items-end gap-[3px]"
        role="img"
        aria-label={`${section.label} scans per day, last ${BOOKING_REPORT_DAYS} days`}
      >
        {section.daily.map((day) => (
          <div
            key={day.date}
            title={`${formatShortDate(day.date)}: ${day.count} ${day.count === 1 ? "scan" : "scans"}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] ${day.count ? "bg-[#1f716c]" : "bg-[#e6ebe9]"}`}
              style={{ height: day.count ? `${Math.max(6, (day.count / max) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-[#8a9491]">
        <span>{first ? formatShortDate(first) : ""}</span>
        <span>Busiest day: {formatCount(busiest)}</span>
        <span>{last ? `${formatShortDate(last)} (today)` : ""}</span>
      </div>
    </div>
  );
}

function AreaOverview({ sections }: { sections: BookingLinkSection[] }) {
  const ranked = [...sections].sort(
    (a, b) => b.last30Days - a.last30Days || b.allTime - a.allTime || a.label.localeCompare(b.label),
  );
  const total = (key: "today" | "last7Days" | "last30Days" | "allTime") =>
    sections.reduce((sum, section) => sum + section[key], 0);
  const cell = "px-4 py-3 text-right tabular-nums";
  return (
    <section
      aria-labelledby="booking-overview"
      className="mt-6 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6"
    >
      <h2 id="booking-overview" className="text-[18px] font-semibold tracking-[-0.4px] text-[#192725]">
        All areas
      </h2>
      <p className="mt-1 text-[12px] text-[#667471]">Ranked by scans in the last {BOOKING_REPORT_DAYS} days.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[400px] text-[12.5px]">
          <thead>
            <tr className="border-b border-black/[0.07] text-[10px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">
              <th scope="col" className="px-4 py-2 text-left">Area</th>
              <th scope="col" className="px-4 py-2 text-right">Today</th>
              <th scope="col" className="px-4 py-2 text-right">7 days</th>
              <th scope="col" className="px-4 py-2 text-right">{BOOKING_REPORT_DAYS} days</th>
              <th scope="col" className="px-4 py-2 text-right">All time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {ranked.map((section) => (
              <tr key={section.code}>
                <th scope="row" className="px-4 py-3 text-left font-semibold text-[#1d2b29]">
                  <a href={`#booking-${section.code}`} className="no-underline hover:underline">
                    {section.label}
                  </a>
                  <span className="ml-2 hidden font-normal text-[#8a9491] sm:inline">/booking/{section.code}</span>
                </th>
                <td className={cell}>{formatCount(section.today)}</td>
                <td className={cell}>{formatCount(section.last7Days)}</td>
                <td className={`${cell} font-semibold text-[#1e5f5a]`}>{formatCount(section.last30Days)}</td>
                <td className={cell}>{formatCount(section.allTime)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/[0.1] font-semibold text-[#1d2b29]">
              <th scope="row" className="px-4 py-3 text-left">Total</th>
              <td className={cell}>{formatCount(total("today"))}</td>
              <td className={cell}>{formatCount(total("last7Days"))}</td>
              <td className={cell}>{formatCount(total("last30Days"))}</td>
              <td className={cell}>{formatCount(total("allTime"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function LinkSection({ section }: { section: BookingLinkSection }) {
  const metrics = [
    { label: "Today", value: section.today },
    { label: "Last 7 days", value: section.last7Days },
    { label: `Last ${BOOKING_REPORT_DAYS} days`, value: section.last30Days },
    { label: "All time", value: section.allTime },
  ];
  const deviceTotal = section.devices.reduce((sum, row) => sum + row.count, 0);

  return (
    <section
      aria-labelledby={`booking-${section.code}`}
      className="mt-6 scroll-mt-24 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 id={`booking-${section.code}`} className="text-[22px] font-semibold tracking-[-0.6px] text-[#192725]">
            {section.label}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#667471]">
            <span className="font-medium text-[#1e5f5a]">valisenmentalhealth.com{section.path}</span>
            <ArrowRight size={13} aria-hidden="true" />
            <span>Jane booking page</span>
          </p>
        </div>
        <p className="text-[11px] text-[#7a8582]">
          {section.lastScanAt ? `Last scan ${formatDateTime(section.lastScanAt)}` : "No scans yet"}
          {!section.configured ? " · area removed from the website" : ""}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-[15px] border border-black/[0.06] bg-[#f9faf8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">{metric.label}</p>
            <p className="mt-1.5 text-[27px] font-semibold tracking-[-1px] tabular-nums text-[#1d2b29]">
              {formatCount(metric.value)}
            </p>
            <p className="text-[10.5px] text-[#8a9491]">{metric.value === 1 ? "scan" : "scans"}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,.5fr)]">
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[#2b3836]">Scans per day</h3>
          <DailyBars section={section} />
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[#2b3836]">Phones, last {BOOKING_REPORT_DAYS} days</h3>
          <ul className="grid gap-2.5">
            {section.devices.map((row) => (
              <li key={row.device} className="grid gap-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#4d5a58]">{bookingDeviceLabel(row.device)}</span>
                  <span className="font-semibold tabular-nums text-[#1d2b29]">{formatCount(row.count)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#eef1f0]">
                  <div
                    className="h-2 rounded-full bg-[#79a89d]"
                    style={{ width: deviceTotal ? `${(row.count / deviceTotal) * 100}%` : "0%" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-[13px] font-semibold text-[#2b3836]">Latest scans</h3>
        {section.recent.length ? (
          <ul className="divide-y divide-black/[0.06] rounded-[14px] border border-black/[0.06]">
            {section.recent.slice(0, 10).map((row) => (
              <li key={row.scannedAt + row.device} className="flex justify-between gap-3 px-4 py-2.5 text-[12px]">
                <span className="tabular-nums text-[#2b3836]">{formatDateTime(row.scannedAt)}</span>
                <span className="text-[#667471]">{bookingDeviceLabel(row.device)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[14px] border border-dashed border-black/10 px-4 py-5 text-[12px] text-[#667471]">
            Scans appear here a few seconds after someone scans the QR code.
          </p>
        )}
      </div>
    </section>
  );
}

export default function BookingLinksPanel({
  sections,
  error,
}: {
  sections: BookingLinkSection[] | null;
  error: string | null;
}) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
        <span className="h-px w-5 bg-[#79a89d]" />
        Flyer QR scans by area
      </div>
      <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
        Booking
      </h1>
      <p className="mt-2 max-w-[660px] text-[13px] leading-5 text-[#667471]">
        Each flyer area has its own QR link. Every scan is counted under its area, then the visitor goes straight
        to Jane. Link previews and bots are not counted. Bookings themselves are recorded in Jane.
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] text-[#7a8582]">
        <CalendarDays size={13} aria-hidden="true" />
        Days follow Toronto time
      </p>

      {error ? (
        <div role="alert" className="mt-6 rounded-[16px] border border-[#eccabd] bg-[#fff5f0] px-5 py-4 text-[12px] text-[#8d452e]">
          <p className="font-semibold">Scan counts could not be loaded</p>
          <p className="mt-1 leading-5">{error}</p>
          <p className="mt-1 leading-5">
            On a new install, run <code>supabase/migrations/20261019020000_booking_link_scans.sql</code> in the Supabase SQL editor.
          </p>
        </div>
      ) : null}

      {sections && sections.length > 1 ? <AreaOverview sections={sections} /> : null}

      {sections?.map((section) => <LinkSection key={section.code} section={section} />)}

      {sections && !sections.length ? (
        <p className="mt-6 inline-flex items-center gap-2 text-[12px] text-[#667471]">
          <ScanQrCode size={15} aria-hidden="true" /> No flyer areas are set up.
        </p>
      ) : null}
    </main>
  );
}
