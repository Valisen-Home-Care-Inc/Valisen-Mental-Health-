import BookingLinksPanel from "@/components/checkpoints/admin/BookingLinksPanel";
import { buildBookingLinkSections } from "@/lib/bookingLinkReport";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchBookingLinkReport } from "@/lib/server/bookingLinkRepository";

export const dynamic = "force-dynamic";

export default async function BookingLinksPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/booking");
  let sections = null;
  let error: string | null = null;
  try {
    sections = buildBookingLinkSections(await fetchBookingLinkReport());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Booking scan counts are unavailable.";
  }
  return <BookingLinksPanel sections={sections} error={error} />;
}
