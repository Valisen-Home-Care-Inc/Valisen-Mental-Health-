// Isolated CRM browser check. All database requests use local fixtures.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer";

const port = Number(process.env.CRM_QA_PORT || 3311);
const databasePort = port + 1;
const origin = `http://localhost:${port}`;
const secret = "google-ads-dashboard-local-browser-qa-secret";
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({ sub: "checkpoint-admin", iat: now, exp: now + 28800,
  nonce: randomBytes(16).toString("base64url") })).toString("base64url");
const unsigned = `v1.${payload}`;
const cookie = `__Host-vmh_checkpoint_admin=${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
const startedAt = new Date(Date.now() - 3600_000).toISOString();
const state = { section: "google_ads", activeSince: "2026-01-01T00:00:00.000Z", updatedAt: startedAt };
const journey = (id, landingPath, engagedMs, eventCount = 2) => ({
  sessionId: `gas-00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  startedAt, lastSeenAt: new Date(Date.parse(startedAt) + engagedMs).toISOString(),
  landingPath, lastPath: landingPath, engagedMs, eventCount, source: "google", medium: "cpc",
  campaignName: landingPath === "/welcome" ? "Welcome campaign" : "Home campaign",
});
const fixtures = [journey(1, "/welcome", 15000), journey(2, "/welcome", 2000),
  journey(3, "/welcome", 0, 0), journey(4, "/welcome", 0, 0), journey(5, "/welcome", 0, 0),
  journey(6, "/", 90000), journey(7, "/services", 25000)];
const timeline = fixtures.filter((row) => row.eventCount > 0).map((row) => ({
  sessionId: row.sessionId, sessionStartedAt: row.startedAt, occurredAt: row.startedAt,
  sequence: 1, event: "page_viewed", path: row.landingPath,
}));
const database = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  const name = new URL(request.url, origin).pathname.split("/").pop();
  let result = {};
  if (name === "get_crm_reporting_state") result = state;
  if (name === "list_crm_reporting_archives") result = { ...state, archives: [] };
  if (name === "export_google_ads_journeys" || name === "export_google_ads_journey_events") {
    const rows = body.p_test ? [] : name === "export_google_ads_journeys" ? fixtures : timeline;
    result = rows.slice(body.p_offset, body.p_offset + body.p_limit);
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(result));
});
await new Promise((resolve) => database.listen(databasePort, "127.0.0.1", resolve));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  windowsHide: true,
  env: { ...process.env, NODE_ENV: "development", SUPABASE_URL: `http://127.0.0.1:${databasePort}`,
    SUPABASE_SECRET_KEY: "sb_secret_local_fixture", SUPABASE_SERVICE_ROLE_KEY: "",
    CHECKPOINT_ADMIN_SESSION_SECRET: secret, GOOGLE_ADS_CONVERSION_SECRET: secret },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (data) => { serverOutput += data.toString(); });
server.stderr.on("data", (data) => { serverOutput += data.toString(); });
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${origin}/api/admin/checkpoints/google-ads/dashboard?scope=invalid`, {
        headers: { cookie }, signal: AbortSignal.timeout(1000),
      });
      if (response.status === 400) break;
    } catch { /* Wait for the local development server. */ }
    if (attempt === 119) throw new Error(`Local CRM server did not start. ${serverOutput.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log("Local fixture server ready; launching browser.");
  browser = await puppeteer.launch({ headless: true, timeout: 120000, protocolTimeout: 120000 });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setExtraHTTPHeaders({ cookie });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "localhost" && url.protocol !== "data:") void request.abort();
    else void request.continue();
  });
  await page.goto(`${origin}/admin/checkpoints/google-ads`, { waitUntil: "networkidle0", timeout: 120000 });
  console.log("Dashboard loaded; checking URL tabs.");
  const tabs = '[aria-label="Google Ads final URL tabs"]';
  await page.waitForSelector(tabs);
  assert.equal(await page.$eval(`${tabs} button[aria-pressed="true"]`, (node) => node.textContent), "/welcome");
  assert.equal(await page.$eval(`${tabs} button:first-child`, (node) => node.textContent), "/welcome");
  assert(await page.evaluate(() => document.body.innerText.includes("3 entry requests without recorded activity are excluded")));
  assert(await page.evaluate(() => document.body.innerText.includes("Welcome campaign")));
  assert.equal(await page.evaluate(() => document.body.innerText.includes("Home campaign")), false);
  await page.click(`${tabs} button[title="valisenmentalhealth.com/"]`);
  await page.waitForFunction(() => document.body.innerText.includes("Home campaign"));
  assert.equal(await page.evaluate(() => document.body.innerText.includes("Welcome campaign")), false);
  const home = await page.evaluate(async () => (await fetch("/api/admin/checkpoints/google-ads/dashboard?landingPath=%2F&range=30d")).json());
  assert.equal(home.data.kpis.sessions, 1);
  assert.equal(home.data.kpis.averageEngagedMs, 90000);
  const welcome = await page.evaluate(async () => (await fetch("/api/admin/checkpoints/google-ads/dashboard?range=30d")).json());
  assert.equal(welcome.data.kpis.sessions, 2);
  assert.equal(welcome.data.kpis.averageEngagedMs, 8500);
  const csv = await page.evaluate(async () => (await fetch("/api/admin/checkpoints/google-ads/export?kind=journeys&landingPath=%2F&range=30d")).text());
  assert(csv.includes(fixtures[5].sessionId));
  assert(!csv.includes(fixtures[0].sessionId));
  await page.click(`${tabs} button:first-child`);
  await page.waitForFunction(() => document.body.innerText.includes("Welcome campaign"));
  await mkdir("artifacts/google-ads", { recursive: true });
  await page.screenshot({ path: "artifacts/google-ads/crm-url-tabs-desktop.png" });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.screenshot({ path: "artifacts/google-ads/crm-url-tabs-mobile.png" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((node) => node.textContent === "Test QA").click());
  await page.waitForFunction(() => document.body.innerText.includes("Test QA data only") && !document.body.innerText.includes("Welcome campaign"));
  assert.equal(await page.$eval(`${tabs} button:first-child`, (node) => node.textContent), "/welcome");
  assert.deepEqual(errors, []);
  console.log("PASS default/persistent welcome tab, URL switching, full scoped metrics, exports, empty QA scope, desktop/mobile layout, no browser errors");
} finally {
  await browser?.close();
  server.kill();
  database.closeAllConnections();
  await new Promise((resolve) => database.close(resolve));
}
