import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBookedConsultationSlots = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/consultationBookingRepository", () => ({
  getBookedConsultationSlots,
}));

import { GET } from "@/app/api/consultation-slots/route";

describe("shared consultation availability route", () => {
  beforeEach(() => getBookedConsultationSlots.mockReset());

  it("returns only privacy-safe booked slot keys without caching", async () => {
    getBookedConsultationSlots.mockResolvedValue([
      { date: "2026-09-10", time: "9:00 AM" },
      { date: "invalid", time: "private" },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      booked: ["2026-09-10|9:00 AM"],
    });
    expect(getBookedConsultationSlots).toHaveBeenCalledOnce();
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

    expect(picker).toContain('fetch("/api/consultation-slots"');
    expect(picker).toContain("disabled={disabled}");
    expect(picker).toContain("<small>Booked</small>");
    expect(picker).toContain("30_000");
  });
});
