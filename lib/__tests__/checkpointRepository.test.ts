import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabaseServer", () => ({
  callSupabaseRpc: rpc,
}));

import {
  fetchCheckpointDashboard,
  fetchCheckpointDetail,
  persistCheckpointConsultation,
  persistCheckpointEvent,
} from "@/lib/server/checkpointRepository";

const baseKpis = {
  sessions: 10,
  checkinsStarted: 9,
  checkinsCompleted: 8,
  completionRate: 80,
  resultViews: 7,
  therapistIntent: 99,
  consultationCtaRate: 990,
  consultationsStarted: 3,
  consultationsSubmitted: 2,
  sessionToConsultationRate: 20,
  externalBookingClicks: 1,
};

const actionMetrics = {
  total: 3,
  cohortSessions: 10,
  resultActions: [
    { key: "consultation_cta", count: 3, sessionRate: 30 },
    { key: "therapist_match", count: 2, sessionRate: 20 },
    { key: "therapist_browse", count: 1, sessionRate: 10 },
    { key: "any_action", count: 5, sessionRate: 50 },
  ],
  intentMix: [
    { intent: "result_only", count: 4, share: 40, sessionRate: 40 },
    { intent: "practical_suggestions", count: 3, share: 30, sessionRate: 30 },
    { intent: "explore_therapists", count: 2, share: 20, sessionRate: 20 },
    { intent: "talk_soon", count: 1, share: 10, sessionRate: 10 },
  ],
  checkpoints: [{ code: "VMH-01", count: 3 }],
  placements: [{ id: "placement-1", count: 3 }],
  daily: [{ date: "2026-08-10", count: 3 }],
  dayOfWeek: [{ dayIndex: 1, count: 3 }],
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({
    accepted: true,
    placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
    sessionId: "eaed651f-b6fa-4672-bfc9-4fad2981b543",
  });
});

describe("checkpoint database RPC boundaries", () => {
  it("passes event identifiers and no open metadata object", async () => {
    await persistCheckpointEvent({
      clientEventId: "a6309e4f-ae6d-4524-b310-0cd7c10567ab",
      anonymousSessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      checkpointCode: "VMH-07",
      eventName: "checkin_step_completed",
      stepNumber: 3,
    });
    expect(rpc).toHaveBeenCalledWith("ingest_checkpoint_event", {
      p_client_event_id: "a6309e4f-ae6d-4524-b310-0cd7c10567ab",
      p_checkpoint_code: "VMH-07",
      p_anonymous_session_id: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      p_event_name: "checkin_step_completed",
      p_step_number: 3,
    });
  });

  it("preserves checkpoint and anonymous session when attaching a voluntary consultation", async () => {
    await persistCheckpointConsultation({
      anonymousSessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      checkpointCode: "VMH-04",
      consultationReferenceId: "VC-ABC1234567",
    });
    expect(rpc).toHaveBeenCalledWith("record_checkpoint_consultation", {
      p_anonymous_session_id: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      p_checkpoint_code: "VMH-04",
      p_consultation_reference_id: "VC-ABC1234567",
      p_status: "submitted",
    });
  });

  it("uses the exact CTA cohort for dashboard rates and keeps branches out of the core funnel", async () => {
    const dashboard = {
      generatedAt: "2026-08-10T12:00:00.000Z",
      range: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-11T00:00:00.000Z" },
      kpis: baseKpis,
      funnel: [
        { event: "session", count: 10 },
        { event: "checkin_started", count: 9 },
        { event: "checkin_completed", count: 8 },
        { event: "result_viewed", count: 7 },
        { event: "therapist_cta_clicked", count: 99 },
        { event: "consultation_started", count: 3 },
      ],
      questionSteps: [],
      checkpoints: [
        {
          code: "VMH-01",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          currentPlacement: null,
          sparkline: [],
          ...baseKpis,
        },
      ],
      leads: [],
    };
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "get_checkpoint_dashboard" ? dashboard : actionMetrics,
      ),
    );

    const result = await fetchCheckpointDashboard(
      dashboard.range.from,
      dashboard.range.to,
    );

    expect(result.kpis.therapistIntent).toBe(3);
    expect(result.kpis.consultationCtaRate).toBe(30);
    expect(result.funnel.map((stage) => stage.event)).toEqual([
      "session",
      "checkin_started",
      "checkin_completed",
      "result_viewed",
    ]);
    expect(result.resultActions).toEqual(actionMetrics.resultActions);
    expect(result.intentMix).toEqual(actionMetrics.intentMix);
    expect(result.checkpoints[0]).toMatchObject({
      therapistIntent: 3,
      consultationCtaRate: 30,
    });
  });

  it("computes detail action rates from matching cohorts and uses now for lifetime CTA metrics", async () => {
    const selectedTo = "2025-01-31T23:59:59.000Z";
    const detail = {
      generatedAt: "2026-08-10T12:00:00.000Z",
      range: { from: "2025-01-01T00:00:00.000Z", to: selectedTo },
      checkpoint: {
        code: "VMH-01",
        status: "active",
        createdAt: "2025-01-01T00:00:00.000Z",
        currentPlacement: null,
      },
      kpis: baseKpis,
      cumulativeKpis: { sessions: 20, therapistIntent: 99 },
      funnel: [
        { event: "session", count: 10 },
        { event: "checkin_started", count: 9 },
        { event: "result_viewed", count: 7 },
        { event: "therapist_cta_clicked", count: 99 },
      ],
      questionSteps: [],
      placements: [
        {
          id: "placement-1",
          partnerName: "Partner",
          locationName: "Location",
          startedAt: "2025-01-01T00:00:00.000Z",
          sessions: 10,
        },
      ],
      daily: [
        {
          date: "2026-08-10",
          sessions: 10,
          checkinsStarted: 9,
          checkinsCompleted: 8,
          therapistIntent: 99,
          consultationsSubmitted: 2,
        },
      ],
      dayOfWeek: [
        {
          day: "Monday",
          dayIndex: 1,
          sessions: 10,
          checkinsCompleted: 8,
          therapistIntent: 99,
          consultationsSubmitted: 2,
        },
      ],
      leads: [],
    };
    const cumulativeActions = {
      ...actionMetrics,
      total: 6,
      cohortSessions: 20,
    };
    rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === "get_checkpoint_detail") return Promise.resolve(detail);
      return Promise.resolve(
        args.p_from === "2020-01-01T00:00:00.000Z"
          ? cumulativeActions
          : actionMetrics,
      );
    });

    const result = await fetchCheckpointDetail(
      "VMH-01",
      detail.range.from,
      selectedTo,
    );

    expect(result.kpis.consultationCtaRate).toBe(30);
    expect(result.cumulativeKpis).toMatchObject({
      therapistIntent: 6,
      consultationCtaRate: 30,
    });
    expect(result.placements[0]).toMatchObject({
      therapistIntent: 3,
      consultationCtaRate: 30,
    });
    expect(result.daily[0].therapistIntent).toBe(3);
    expect(result.dayOfWeek[0].therapistIntent).toBe(3);
    const lifetimeCall = rpc.mock.calls.find(
      ([name, args]) =>
        name === "get_checkpoint_action_metrics" &&
        args.p_from === "2020-01-01T00:00:00.000Z",
    );
    expect(lifetimeCall?.[1].p_to).not.toBe(selectedTo);
    expect(Date.parse(lifetimeCall?.[1].p_to)).toBeGreaterThan(
      Date.parse(selectedTo),
    );
  });
});
