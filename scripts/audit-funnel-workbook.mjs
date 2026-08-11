import nextEnv from "@next/env";
import { google } from "googleapis";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
if (
  !spreadsheetId ||
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY
) {
  throw new Error("Google Sheets is not configured");
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });
const metadata = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: "sheets.properties.title",
});
const titles = metadata.data.sheets
  ?.map((sheet) => sheet.properties?.title)
  .filter(Boolean) ?? [];
const eventSheet = process.env.FUNNEL_EVENTS_SHEET_NAME || "Funnel Events";
const attemptsSheet =
  process.env.FUNNEL_QUIZ_ATTEMPTS_SHEET_NAME || "Quiz Attempts";

console.log(`Funnel tabs: ${titles.filter((title) => title.startsWith("Funnel ")).join(", ") || "none"}`);
if (titles.includes(eventSheet)) {
  const values = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${eventSheet.replace(/'/g, "''")}'!A:Z`,
  });
  const rows = values.data.values ?? [];
  console.log(`Funnel event rows: ${Math.max(0, rows.length - 1)}`);
  for (const row of rows.slice(1).slice(-20)) {
    console.log([row[0], row[2], row[5], row[6], row[8], row[25]].join(" | "));
  }
}

if (titles.includes(attemptsSheet)) {
  const values = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${attemptsSheet.replace(/'/g, "''")}'!A:N`,
  });
  const rows = values.data.values ?? [];
  console.log(`Quiz attempt rows: ${Math.max(0, rows.length - 1)}`);
  for (const row of rows.slice(1).slice(-20)) {
    console.log(
      [row[0], row[1], row[5], row[6], row[8], row[9], row[13]].join(" | "),
    );
  }
}

const dashboardSheet =
  process.env.FUNNEL_DASHBOARD_SHEET_NAME || "Funnel Dashboard";
if (titles.includes(dashboardSheet)) {
  const dashboard = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${dashboardSheet.replace(/'/g, "''")}'!A1:B10`,
  });
  console.log(
    `Dashboard metrics: ${Math.max(0, (dashboard.data.values?.length ?? 0) - 1)}`,
  );
}
