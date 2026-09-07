import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/quizLeadStore", () => ({ getQuizLeadStore: async () => ({ findBySubmissionTokenHash: mocks.lookup }), hashSubmissionToken: () => "hash" }));
vi.mock("@/lib/server/supabaseServer", () => ({ callSupabaseRpc: mocks.rpc }));
import { POST } from "@/app/api/quiz-lead/result-engagement/route";
import { resetRateLimitState } from "@/lib/server/rateLimit";
const origin = "https://valisenmentalhealth.com";
const token = "quiz-calendar-result-token-1234567890";
const snapshot = { viewId: "12345678-1234-4234-9234-123456789abc", sequence: 1, elapsedSeconds: 25, activeSeconds: 20, scrollDepth: 65, sections: ["summary"], actions: {} };
const request = (body: unknown, url = origin + "/api/quiz-lead/result-engagement", requestOrigin = origin) => new NextRequest(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin }, body: JSON.stringify(body) });
beforeEach(() => { resetRateLimitState(); mocks.lookup.mockReset().mockResolvedValue({ referenceId: "VQ-SERVER123" }); mocks.rpc.mockReset().mockResolvedValue({ ok: true }); });
describe("result engagement boundary", () => {
  it("derives the reference from a saved result, never the browser", async () => {
    const response = await POST(request({ submissionToken: token, snapshot }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("record_quiz_result_engagement", { p_reference_id: "VQ-SERVER123", p_snapshot: snapshot });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each([{ referenceId: "VQ-OTHER" }, { answers: {} }, { email: "private@example.com" }])("rejects additional identifying or clinical fields %j", async (extra) => {
    expect((await POST(request({ submissionToken: token, snapshot, ...extra }))).status).toBe(400);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and token-bearing URLs", async () => {
    expect((await POST(request({ submissionToken: token, snapshot }, undefined, "https://attacker.example"))).status).toBe(403);
    expect((await POST(request({ submissionToken: token, snapshot }, origin + "/api/quiz-lead/result-engagement?token=private"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires an existing saved result", async () => {
    mocks.lookup.mockResolvedValue(null);
    expect((await POST(request({ submissionToken: token, snapshot }))).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails gracefully if the migration is not installed", async () => {
    mocks.rpc.mockRejectedValue(new Error("Missing RPC"));
    expect((await POST(request({ submissionToken: token, snapshot }))).status).toBe(503);
  });
  it("rejects oversized requests before lookup", async () => {
    expect((await POST(request({ submissionToken: token, snapshot, text: "x".repeat(5000) }))).status).toBe(413);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
