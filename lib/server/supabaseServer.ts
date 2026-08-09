const DEFAULT_TIMEOUT_MS = 10_000;

export class SupabaseServerError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SupabaseServerError";
    this.status = status;
  }
}

function configuration(): { url: string; serviceRoleKey: string; legacyJwt: boolean } {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceRoleKey) {
    throw new SupabaseServerError("Checkpoint database is not configured.", 503);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SupabaseServerError("Checkpoint database URL is invalid.", 503);
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) {
    throw new SupabaseServerError("Checkpoint database URL must use HTTPS.", 503);
  }
  return {
    url: parsed.origin,
    serviceRoleKey,
    legacyJwt: !serviceRoleKey.startsWith("sb_secret_"),
  };
}

export function isCheckpointDatabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SECRET_KEY?.trim() ||
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  );
}

/**
 * Calls a service-role-only Postgres function through Supabase PostgREST.
 * This helper is server-only by convention and intentionally never exposes
 * either configuration value through a NEXT_PUBLIC environment variable.
 */
export async function callSupabaseRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!/^[a-z][a-z0-9_]{1,80}$/.test(functionName)) {
    throw new SupabaseServerError("Invalid database operation.", 500);
  }
  const { url, serviceRoleKey, legacyJwt } = configuration();
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        ...(legacyJwt
          ? { Authorization: `Bearer ${serviceRoleKey}` }
          : {}),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new SupabaseServerError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Checkpoint database timed out."
        : "Checkpoint database is unavailable.",
      503,
    );
  }

  if (!response.ok) {
    // Supabase's response can contain schema and SQL details. Keep those out
    // of browser responses while retaining a low-detail server diagnostic.
    const diagnostic = (await response.text().catch(() => "")).slice(0, 500);
    console.error(
      `checkpoint-db: ${functionName} failed (${response.status})`,
      diagnostic.replace(/[\r\n]+/g, " "),
    );
    throw new SupabaseServerError(
      response.status === 409
        ? "The checkpoint placement changed before this request completed."
        : "Checkpoint database operation failed.",
      response.status === 409 ? 409 : 503,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SupabaseServerError("Checkpoint database returned invalid data.", 503);
  }
}
