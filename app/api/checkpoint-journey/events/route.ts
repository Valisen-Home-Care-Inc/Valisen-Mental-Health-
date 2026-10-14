import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { parseJourneyEvent } from "@/lib/checkpoints/journey/contract";
import { persistJourneyEvent } from "@/lib/server/checkpointJourneyRepository";
import { hasJsonContentType, isSameOriginRequest, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
export const runtime = "nodejs";
const NETWORK_SECRET = randomBytes(32);
export async function POST(request: NextRequest) {
  const response = (status: number) => NextResponse.json({ ok: false }, { status, headers: { "Cache-Control": "no-store" } });
  if (!hasJsonContentType(request)) return response(415);
  if (!isSameOriginRequest(request)) return response(403);
  const body = await readBoundedJson(request, 4096); if (!body.ok) return response(body.reason === "too_large" ? 413 : 400);
  const event = parseJourneyEvent(body.value); if (!event) return response(400);
  const network = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const networkKey = createHmac("sha256",NETWORK_SECRET).update(network).digest("hex").slice(0,24);
  if (isRateLimited(`checkpoint-v3-network:${networkKey}`,600,10 * 60_000) || isRateLimited(`checkpoint-v3-event:${event.sessionId}`, 80, 10 * 60_000)) return response(429);
  try { const result = await persistJourneyEvent(event); return NextResponse.json({ ok: result.accepted, placementId: result.placementId }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return response(503); }
}
