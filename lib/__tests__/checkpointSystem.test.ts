import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { shouldLoadSiteAnalytics } from "@/lib/analyticsBoundary";
import { GET as getDashboard } from "@/app/api/admin/checkpoints/dashboard/route";
import { parseMoveCheckpointInput } from "@/lib/checkpoints/adminContract";
import {
  parseCheckpointConsultationAttribution,
} from "@/lib/checkpoints/consultationAttribution";
import {
  checkpointPerformance,
  resolveCheckpointDateRange,
  safeConversionRate,
  type CheckpointMetric,
} from "@/lib/checkpoints/dashboardMetrics";
import { validateCheckpointEvent } from "@/lib/checkpoints/eventContract";
import {
  formatTorontoDateTimeInput,
  parseTorontoDateTimeInput,
} from "@/lib/checkpoints/torontoDateTime";
import {
  bindSessionToPlacement,
  movePlacementTimeline,
  resolvePlacementAt,
  type PlacementInterval,
} from "@/lib/checkpoints/placementTimeline";

const SESSION_ID = "f27de343-dd23-48d7-988a-30ef6a97f31c";
const EVENT_ID = "a6309e4f-ae6d-4524-b310-0cd7c10567ab";

describe("checkpoint event boundary", () => {
  it("accepts only the exact privacy-minimal event shape", () => {
    const accepted = validateCheckpointEvent({
      eventId: EVENT_ID,
      sessionId: SESSION_ID,
      checkpointCode: "VMH-03",
      event: "checkin_step_completed",
      stepNumber: 2,
    });
    expect(accepted.ok).toBe(true);

    for (const extra of [
      { answer: "very overwhelmed" },
      { score: 3 },
      { email: "private@example.com" },
      { userAgent: "fingerprint-me" },
    ]) {
      expect(
        validateCheckpointEvent({
          eventId: EVENT_ID,
          sessionId: SESSION_ID,
          checkpointCode: "VMH-03",
          event: "checkin_started",
          ...extra,
        }).ok,
      ).toBe(false);
    }
  });

  it("allows a step only for step completion and only from one through four", () => {
    expect(validateCheckpointEvent({ eventId: EVENT_ID, sessionId: SESSION_ID, checkpointCode: "VMH-01", event: "checkin_started", stepNumber: 1 }).ok).toBe(false);
    expect(validateCheckpointEvent({ eventId: EVENT_ID, sessionId: SESSION_ID, checkpointCode: "VMH-01", event: "checkin_step_completed", stepNumber: 5 }).ok).toBe(false);
  });

  it("rejects the server-only consultation conversion event", () => {
    expect(
      validateCheckpointEvent({
        eventId: EVENT_ID,
        sessionId: SESSION_ID,
        checkpointCode: "VMH-01",
        event: "consultation_submitted",
      }).ok,
    ).toBe(false);
  });
});

describe("checkpoint marketing privacy boundary", () => {
  it("suppresses third-party site analytics for private routes and the active journey", () => {
    expect(shouldLoadSiteAnalytics("/c/VMH-01")).toBe(false);
    expect(shouldLoadSiteAnalytics("/admin/checkpoints")).toBe(false);
    expect(shouldLoadSiteAnalytics("/consultation", true)).toBe(false);
    expect(shouldLoadSiteAnalytics("/therapists", true)).toBe(false);
    expect(shouldLoadSiteAnalytics("/consultation", false)).toBe(true);
  });

  it("keeps private-route headers later than the baseline and limits Turnstile to login", () => {
    const config = readFileSync(resolve(process.cwd(), "next.config.js"), "utf8");
    const baselineIndex = config.indexOf('source: "/:path*"');
    const checkpointIndex = config.indexOf('source: "/c/:path*"');
    const adminIndex = config.indexOf('source: "/admin/:path*"');
    const loginIndex = config.indexOf('source: "/admin/login"');

    expect(baselineIndex).toBeGreaterThan(-1);
    expect(baselineIndex).toBeLessThan(checkpointIndex);
    expect(checkpointIndex).toBeLessThan(adminIndex);
    expect(adminIndex).toBeLessThan(loginIndex);
    expect(config).toMatch(
      /const adminLoginCsp =[\s\S]+https:\/\/challenges\.cloudflare\.com/,
    );
    expect(config).toMatch(
      /source: "\/c\/:path\*"[\s\S]+value: privateRouteCsp/,
    );
  });
});

describe("checkpoint placement attribution", () => {
  const original: PlacementInterval[] = [
    {
      id: "coffee",
      checkpointCode: "VMH-03",
      partnerName: "Coffee Shop A",
      locationName: "Front counter",
      startedAt: "2026-08-01T14:00:00.000Z",
      endedAt: null,
    },
  ];

  it("keeps an existing session on its historical placement after a move", () => {
    const historicalSession = bindSessionToPlacement(
      original,
      "VMH-03",
      SESSION_ID,
      "2026-08-10T16:00:00.000Z",
    );
    const moved = movePlacementTimeline(original, {
      id: "salon",
      checkpointCode: "VMH-03",
      partnerName: "Salon B",
      locationName: "Reception",
      effectiveAt: "2026-08-21T13:00:00.000Z",
    });

    expect(historicalSession.placementId).toBe("coffee");
    expect(resolvePlacementAt(moved, "VMH-03", historicalSession.startedAt)?.id).toBe("coffee");
    expect(moved.find((placement) => placement.id === "coffee")?.endedAt).toBe("2026-08-21T13:00:00.000Z");
  });

  it("binds new sessions after the move to the new placement", () => {
    const moved = movePlacementTimeline(original, {
      id: "salon",
      checkpointCode: "VMH-03",
      partnerName: "Salon B",
      locationName: "Reception",
      effectiveAt: "2026-08-21T13:00:00.000Z",
    });
    const newSession = bindSessionToPlacement(
      moved,
      "VMH-03",
      "2db59439-9865-4c94-a1e0-ed9867096c88",
      "2026-08-22T16:00:00.000Z",
    );
    expect(newSession.placementId).toBe("salon");
  });
});

describe("consultation checkpoint attribution", () => {
  it("retains only source, checkpoint, and anonymous session", () => {
    expect(
      parseCheckpointConsultationAttribution({
        source: "mental_battery_checkpoint",
        checkpointCode: "VMH-04",
        sessionId: SESSION_ID,
      }),
    ).toEqual({
      source: "mental_battery_checkpoint",
      checkpointCode: "VMH-04",
      sessionId: SESSION_ID,
    });
    expect(
      parseCheckpointConsultationAttribution({
        source: "mental_battery_checkpoint",
        checkpointCode: "VMH-04",
        sessionId: SESSION_ID,
        answer: "private",
      }),
    ).toBeNull();
  });
});

describe("dashboard ranges and conversion math", () => {
  it("uses Toronto calendar boundaries for preset date filters", () => {
    const now = new Date("2026-08-06T18:30:00.000Z");
    expect(resolveCheckpointDateRange("today", null, null, now)).toEqual({
      from: "2026-08-06T04:00:00.000Z",
      to: now.toISOString(),
      preset: "today",
    });
    expect(resolveCheckpointDateRange("7d", null, null, now)?.from).toBe(
      "2026-07-31T04:00:00.000Z",
    );
  });

  it("rejects inverted custom ranges and handles zero denominators safely", () => {
    expect(
      resolveCheckpointDateRange(
        "custom",
        "2026-08-03T00:00:00.000Z",
        "2026-08-01T00:00:00.000Z",
        new Date("2026-08-06T00:00:00.000Z"),
      ),
    ).toBeNull();
    expect(safeConversionRate(4, 0)).toBe(0);
    expect(safeConversionRate(4, 25)).toBe(16);
  });

  it("includes the current Toronto day in a custom Through range without accepting future dates", () => {
    const now = new Date("2026-08-06T18:30:00.000Z");
    expect(
      resolveCheckpointDateRange(
        "custom",
        "2026-08-01",
        "2026-08-06",
        now,
      ),
    ).toEqual({
      from: "2026-08-01T04:00:00.000Z",
      to: now.toISOString(),
      preset: "custom",
    });
    expect(
      resolveCheckpointDateRange(
        "custom",
        "2026-08-01",
        "2026-08-07",
        now,
      ),
    ).toBeNull();
  });

  it("does not label tiny samples as strong or weak", () => {
    const metric = (code: string, sessions: number, completed: number): CheckpointMetric => ({
      code,
      status: "active",
      createdAt: "2026-08-01T00:00:00.000Z",
      currentPlacement: null,
      sessions,
      checkinsStarted: sessions,
      checkinsCompleted: completed,
      completionRate: safeConversionRate(completed, sessions),
      resultViews: completed,
      therapistIntent: 1,
      consultationsStarted: 1,
      consultationsSubmitted: 1,
      sessionToConsultationRate: safeConversionRate(1, sessions),
      externalBookingClicks: 0,
      sparkline: [],
    });
    const small = metric("VMH-01", 3, 3);
    expect(checkpointPerformance(small, [small, metric("VMH-02", 40, 20)])).toBe("Not enough data yet");
  });
});

describe("placement administration validation", () => {
  it("accepts a bounded future placement and rejects arbitrary fields", () => {
    const now = new Date("2026-08-06T16:00:00.000Z");
    expect(parseMoveCheckpointInput({ partnerName: "Café", locationName: "Front counter", effectiveAt: "2026-08-07T16:00:00.000Z" }, now).value).toMatchObject({ partnerName: "Café", locationName: "Front counter" });
    expect(parseMoveCheckpointInput({ partnerName: "Café", locationName: "Front counter", effectiveAt: "2026-08-07T16:00:00.000Z", admin: true }, now).value).toBeUndefined();
  });

  it("treats placement form times as Toronto wall-clock values", () => {
    expect(
      formatTorontoDateTimeInput(new Date("2026-08-06T16:30:00.000Z")),
    ).toBe("2026-08-06T12:30");
    expect(parseTorontoDateTimeInput("2026-08-06T12:30")).toBe(
      "2026-08-06T16:30:00.000Z",
    );
    expect(parseTorontoDateTimeInput("2026-03-08T02:30")).toBeNull();
  });
});

describe("checkpoint admin protection", () => {
  it("returns 401 before querying analytics without a signed admin cookie", async () => {
    const response = await getDashboard(
      new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/dashboard?range=30d"),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Authentication required.",
    });
  });
});

describe("database migration privacy and idempotency", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260806000000_mental_battery_checkpoints.sql",
    ),
    "utf8",
  );

  it("contains no storage columns for answers, contact data, IPs, or fingerprints", () => {
    expect(migration).not.toMatch(/^\s+(answer|answers|score|email|phone|ip_address|user_agent|fingerprint|latitude|longitude)\s+/gim);
  });

  it("enforces immutable placement attribution and event uniqueness", () => {
    expect(migration).toMatch(/checkpoint_placements_do_not_overlap/i);
    expect(migration).toMatch(/funnel_events_logical_event_unique/i);
    expect(migration).toMatch(/client_event_id uuid not null unique/i);
    expect(migration).toMatch(/placement_id uuid not null/i);
    expect(migration).toMatch(/security definer/g);
    expect(migration).toMatch(/grant execute[\s\S]+to service_role/i);
  });

  it("accepts consultation submissions only through the trusted attribution RPC", () => {
    const anonymousIngest = migration.match(
      /create or replace function public\.ingest_checkpoint_event[\s\S]+?create or replace function public\.record_checkpoint_consultation/i,
    )?.[0] ?? "";
    const trustedConsultation = migration.match(
      /create or replace function public\.record_checkpoint_consultation[\s\S]+?-- RLS has no public policies/i,
    )?.[0] ?? "";

    expect(anonymousIngest).not.toContain("'consultation_submitted'");
    expect(trustedConsultation).toContain("'consultation_submitted'");
  });

  it("aggregates all four answer-free question steps and their exact drop-off points", () => {
    expect(migration.match(/'questionSteps'/g)).toHaveLength(2);
    expect(migration.match(/generate_series\(1, 4\) as question\(step_number\)/g)).toHaveLength(2);
    expect(migration.match(/as last_step_completed/g)).toHaveLength(2);
    expect(
      migration.match(
        /greatest\(question\.reached - question\.completed, 0\)::bigint as drop_offs/g,
      ),
    ).toHaveLength(2);
    expect(migration).toMatch(/'dropOffRate'/);
  });

  it("normalizes downstream funnel evidence into monotonic earlier-stage flags", () => {
    expect(
      migration.match(
        /coalesce\(bool_or\(event\.event_name in \(\s*'checkin_completed',\s*'result_viewed',\s*'therapist_cta_clicked',\s*'consultation_started',\s*'consultation_submitted',\s*'external_booking_clicked'\s*\)\), false\) as checkin_completed/g,
      ),
    ).toHaveLength(3);
    expect(
      migration.match(
        /coalesce\(bool_or\(event\.event_name in \(\s*'result_viewed',\s*'therapist_cta_clicked',\s*'consultation_started',\s*'consultation_submitted',\s*'external_booking_clicked'\s*\)\), false\) as result_viewed/g,
      ),
    ).toHaveLength(2);
  });
});
