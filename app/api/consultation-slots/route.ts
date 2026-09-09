import { NextResponse } from "next/server";
import {
  CONSULTATION_BOOKING_WINDOW_DAYS,
  consultationDateKey,
} from "@/lib/consultation";
import { torontoCalendarToday } from "@/lib/quizConsultation";
import { getBookedConsultationSlots } from "@/lib/server/consultationBookingRepository";

export const runtime = "nodejs";

export async function GET() {
  const today = torontoCalendarToday();
  const end = new Date(today);
  end.setDate(end.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS);

  try {
    const slots = await getBookedConsultationSlots(
      consultationDateKey(today),
      consultationDateKey(end),
    );
    const booked = Array.isArray(slots)
      ? slots
          .filter(
            (slot) =>
              slot &&
              typeof slot.date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
              typeof slot.time === "string" &&
              slot.time.length <= 12,
          )
          .map((slot) => `${slot.date}|${slot.time}`)
      : [];

    return NextResponse.json(
      { booked },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "consultation-slots: availability lookup failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Live availability is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
