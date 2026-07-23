/**
 * Best-effort in-memory rate limiting and idempotency for the quiz-lead
 * endpoint.
 *
 * KNOWN LIMITATION (documented): on serverless hosting each warm instance
 * keeps its own memory, so these guards are per-instance rather than
 * global. They still stop the common abuse cases (rapid duplicate clicks,
 * simple scripted spam) without introducing a database, which this
 * workflow deliberately avoids. Nodemailer + Gmail's own sending limits
 * act as the final backstop.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  if (buckets.size > 5000) pruneExpired(buckets, now);
  return bucket.count > limit;
}

/* ── Idempotency: clientSubmissionId → referenceId of the completed send ── */

type IdempotencyRecord = { referenceId: string; expiresAt: number };

const completed = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function getCompletedSubmission(
  clientSubmissionId: string,
  now: number = Date.now(),
): string | null {
  const record = completed.get(clientSubmissionId);
  if (!record || record.expiresAt <= now) return null;
  return record.referenceId;
}

export function markSubmissionCompleted(
  clientSubmissionId: string,
  referenceId: string,
  now: number = Date.now(),
): void {
  if (completed.size > 5000) pruneExpired(completed, now);
  completed.set(clientSubmissionId, { referenceId, expiresAt: now + IDEMPOTENCY_TTL_MS });
}

function pruneExpired(map: Map<string, { resetAt?: number; expiresAt?: number }>, now: number) {
  map.forEach((value, key) => {
    const expiry = value.resetAt ?? value.expiresAt ?? 0;
    if (expiry <= now) map.delete(key);
  });
}

/** Test hook — clears all in-memory state. */
export function resetRateLimitState() {
  buckets.clear();
  completed.clear();
}
