import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabaseServer", () => ({
  callSupabaseRpc: rpc,
}));

import {
  persistCheckpointConsultation,
  persistCheckpointEvent,
} from "@/lib/server/checkpointRepository";

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
});
