import { NextResponse } from "next/server";
import {
  CONSULTATION_BOOKING_WINDOW_DAYS,
  consultationDateKey,
} from "@/lib/consultation";
import { torontoCalendarToday } from "@/lib/quizConsultation";
import { getBookedConsultationSlots } from "@/lib/server/consultationBookingRepository";
import { consultationPoolForConcept } from "@/lib/paidSearchConcepts";

export const runtime = "nodejs";

export async function GET(request?: Request) {
  const concept = request ? new URL(request.url).searchParams.get("concept") || undefined : undefined;
  const selected = request ? new URL(request.url).searchParams.get("therapist") : null;
  const eligible = consultationPoolForConcept(concept);
  if (selected !== null && (!concept || !eligible?.some((slug) => slug === selected))) return NextResponse.json({ error: "Invalid therapist." }, { status: 400 });
  const pool = selected ? eligible?.filter((slug) => slug === selected) : eligible;
  if (!pool?.length) return NextResponse.json({ error: "Invalid calendar." }, { status: 400 });
  const today = torontoCalendarToday();
  const end = new Date(today);
  end.setDate(end.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS);

  try {
    const slots = await getBookedConsultationSlots(
      consultationDateKey(today),
      consultationDateKey(end),
      pool,
    );
    if (!Array.isArray(slots)) throw new Error("Invalid availability response");
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
      { booked, calendarVersion: "therapist-capacity-v2" },
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
