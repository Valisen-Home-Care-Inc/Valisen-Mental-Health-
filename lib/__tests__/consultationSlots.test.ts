import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBookedConsultationSlots = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/consultationBookingRepository", () => ({
  getBookedConsultationSlots,
}));

import { GET } from "@/app/api/consultation-slots/route";

describe("shared consultation availability route", () => {
  beforeEach(() => { getBookedConsultationSlots.mockReset(); });

  it("returns only privacy-safe booked slot keys without caching", async () => {
    getBookedConsultationSlots.mockResolvedValue([
      { date: "2026-09-10", time: "9:00 AM" },
      { date: "invalid", time: "private" },
    ]);

    const response = await GET(new Request("https://valisenmentalhealth.com/api/consultation-slots"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      booked: ["2026-09-10|9:00 AM"], calendarVersion: "therapist-capacity-v2",
    });
    expect(getBookedConsultationSlots).toHaveBeenCalledOnce();
  });

  it("restricts named availability to the selected eligible therapist", async () => {
    getBookedConsultationSlots.mockResolvedValue([]);
    const response = await GET(new Request("https://valisenmentalhealth.com/api/consultation-slots?concept=ocd&therapist=ryann-simpson"));
    expect(response.status).toBe(200);
    expect(getBookedConsultationSlots).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["ryann-simpson"]);
  });

  it.each(["concept=arabic&therapist=ryann-simpson", "therapist=ryann-simpson", "concept=ocd&therapist=unknown", "concept=unknown"])("rejects an invalid named calendar: %s", async (query) => {
    expect((await GET(new Request(`https://valisenmentalhealth.com/api/consultation-slots?${query}`))).status).toBe(400);
    expect(getBookedConsultationSlots).not.toHaveBeenCalled();
  });

  it("fails closed if availability cannot be read", async () => {
    getBookedConsultationSlots.mockRejectedValue(new Error("offline"));
    expect((await GET(new Request("https://valisenmentalhealth.com/api/consultation-slots"))).status).toBe(503);
  });

});

describe("consultation slot migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260909000000_consultation_slot_bookings.sql",
    ),
    "utf8",
  );

  it("uses one unique slot claim shared by /welcome and /quiz", () => {
    expect(migration).toContain(
      "constraint consultation_slot_bookings_slot_unique unique (slot_date, slot_time)",
    );
    expect(migration).toContain("'welcome', 'quiz_calendar'");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("mark_consultation_slot_booked");
  });

  it("keeps slot state service-role-only and free of contact details", () => {
    expect(migration).toContain(
      "alter table public.consultation_slot_bookings enable row level security;",
    );
    expect(migration).toContain(
      "revoke all on table public.consultation_slot_bookings",
    );
    expect(migration).toContain("to service_role;");
    const table = migration.slice(
      migration.indexOf("create table if not exists public.consultation_slot_bookings"),
      migration.indexOf("create index if not exists consultation_slot_bookings_date_idx"),
    );
    expect(table).not.toMatch(/\b(first_name|last_name|email|phone|notes)\b/i);
  });
});

describe("shared consultation picker", () => {
  it("renders occupied times as disabled Booked choices", () => {
    const picker = readFileSync(
      join(process.cwd(), "components/paid-search/ConsultationTimeSlotPicker.tsx"),
      "utf8",
    );

    expect(picker).toContain('useConsultationAvailability(undefined, availabilityRefreshKey)');
    expect(picker).toContain("disabled={disabled}");
    expect(picker).toContain("<small>Booked</small>");
    expect(readFileSync(join(process.cwd(), "lib/useConsultationAvailability.ts"), "utf8")).toContain("30_000");
  });
});
