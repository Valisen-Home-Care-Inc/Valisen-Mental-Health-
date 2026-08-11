import { google } from "googleapis";
import {
  CHECKPOINT_CONSULTATION_SOURCE,
  parseCheckpointConsultationAttribution,
} from "@/lib/checkpoints/consultationAttribution";
import { recordCheckpointAttribution } from "@/lib/server/checkpointAttributionRepair";
import { repairConsultationRequestAttribution } from "@/lib/server/growthRepository";

const MAXIMUM_SHEET_DATA_ROWS = 10_000;
const MAXIMUM_RECONCILIATIONS_PER_RUN = 3;
const RECONCILIATION_COOLDOWN_MS = 60_000;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$/;

type ReconciliationResult = { attempted: number; repaired: number };

let reconciliationInFlight: Promise<ReconciliationResult> | null = null;
let lastReconciliationStartedAt = 0;

export function selectRotatingReconciliationBatch<T>(
  pending: readonly T[],
  now: number,
): T[] {
  if (pending.length === 0) return [];
  const start =
    (Math.floor(now / RECONCILIATION_COOLDOWN_MS) *
      MAXIMUM_RECONCILIATIONS_PER_RUN) %
    pending.length;
  const count = Math.min(MAXIMUM_RECONCILIATIONS_PER_RUN, pending.length);
  return Array.from(
    { length: count },
    (_, index) => pending[(start + index) % pending.length],
  );
}

type SheetsContext = {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
};

type AttributionSheetRow = {
  checkpointCode: string;
  referenceId: string;
  rowNumber: number;
  sessionId: string;
  source: string;
  status: string;
};

function sheetsContext(): SheetsContext | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!email || !privateKey || !spreadsheetId) return null;
  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

async function readAttributionRows(
  context: SheetsContext,
): Promise<AttributionSheetRow[]> {
  const lastRow = MAXIMUM_SHEET_DATA_ROWS + 1;
  const response = await context.sheets.spreadsheets.values.batchGet({
    spreadsheetId: context.spreadsheetId,
    ranges: [
      `M2:M${lastRow}`,
      `P2:P${lastRow}`,
      `S2:V${lastRow}`,
    ],
    majorDimension: "ROWS",
  });
  const [references = [], sources = [], attribution = []] = (
    response.data.valueRanges ?? []
  ).map((range) => range.values ?? []);
  const rowCount = Math.max(references.length, sources.length, attribution.length);
  const rows: AttributionSheetRow[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const [checkpointCode = "", , sessionId = "", status = ""] =
      attribution[index] ?? [];
    rows.push({
      checkpointCode: String(checkpointCode),
      referenceId: String(references[index]?.[0] ?? ""),
      rowNumber: index + 2,
      sessionId: String(sessionId),
      source: String(sources[index]?.[0] ?? ""),
      status: String(status),
    });
  }
  return rows;
}

async function markRowAttributed(
  context: SheetsContext,
  row: AttributionSheetRow,
  placementId: string,
): Promise<void> {
  await context.sheets.spreadsheets.values.update({
    spreadsheetId: context.spreadsheetId,
    range: `T${row.rowNumber}:V${row.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[placementId, row.sessionId, "Attributed"]],
    },
  });
}

export async function repairConsultationSheetAttribution(input: {
  checkpointCode: string;
  placementId: string;
  referenceId: string;
  sessionId: string;
}): Promise<boolean> {
  const context = sheetsContext();
  if (!context) return false;
  try {
    const rows = await readAttributionRows(context);
    const row = rows.find(
      (candidate) =>
        candidate.referenceId === input.referenceId &&
        candidate.checkpointCode === input.checkpointCode &&
        candidate.sessionId === input.sessionId,
    );
    if (!row) return false;
    await markRowAttributed(context, row, input.placementId);
    return true;
  } catch (error) {
    console.warn(
      "checkpoint-attribution: spreadsheet repair failed",
      error instanceof Error ? error.name : "unknown",
    );
    return false;
  }
}

async function runPendingCheckpointReconciliation(
  now: number,
): Promise<ReconciliationResult> {
  const context = sheetsContext();
  if (!context) return { attempted: 0, repaired: 0 };
  try {
    const rows = await readAttributionRows(context);
    const pending = rows
      .filter((row) => {
        if (
          row.status !== "Attribution pending" ||
          row.source !== CHECKPOINT_CONSULTATION_SOURCE ||
          !REFERENCE_PATTERN.test(row.referenceId)
        ) {
          return false;
        }
        return Boolean(
          parseCheckpointConsultationAttribution({
            source: CHECKPOINT_CONSULTATION_SOURCE,
            checkpointCode: row.checkpointCode,
            sessionId: row.sessionId,
          }),
        );
      });
    // Rotate deterministically each minute. Even after a cold serverless start,
    // irreparable recent rows cannot permanently starve older pending rows.
    const selected = selectRotatingReconciliationBatch(pending, now);

    let repaired = 0;
    for (const row of selected) {
      const attribution = parseCheckpointConsultationAttribution({
        source: CHECKPOINT_CONSULTATION_SOURCE,
        checkpointCode: row.checkpointCode,
        sessionId: row.sessionId,
      });
      if (!attribution) continue;
      const result = await recordCheckpointAttribution(attribution, row.referenceId);
      if (!result.saved) continue;
      try {
        const crmRepair = await repairConsultationRequestAttribution(
          row.referenceId,
        );
        if (!crmRepair.accepted || !crmRepair.verified) continue;
        await markRowAttributed(context, row, result.placementId);
        repaired += 1;
      } catch (error) {
        console.warn(
          "checkpoint-attribution: reconciled database row but spreadsheet status update failed",
          error instanceof Error ? error.name : "unknown",
        );
      }
    }
    return { attempted: selected.length, repaired };
  } catch (error) {
    console.warn(
      "checkpoint-attribution: pending spreadsheet reconciliation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { attempted: 0, repaired: 0 };
  }
}

export function reconcilePendingCheckpointAttributions(
  now = Date.now(),
): Promise<ReconciliationResult> {
  if (reconciliationInFlight) return reconciliationInFlight;
  if (now - lastReconciliationStartedAt < RECONCILIATION_COOLDOWN_MS) {
    return Promise.resolve({ attempted: 0, repaired: 0 });
  }
  lastReconciliationStartedAt = now;
  const task = runPendingCheckpointReconciliation(now).finally(() => {
    if (reconciliationInFlight === task) reconciliationInFlight = null;
  });
  reconciliationInFlight = task;
  return task;
}
