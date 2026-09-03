/**
 * Neutral alias for the signed Google Ads event endpoint. Browser content
 * blockers match request paths against generic "ads" patterns; a same-origin
 * path without that word keeps first-party journey batches flowing. The
 * handler, verification, and rate limits are identical.
 */
export { POST } from "@/app/api/google-ads/events/route";

export const runtime = "nodejs";
