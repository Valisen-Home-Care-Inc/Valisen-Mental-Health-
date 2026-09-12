// Isolated browser regression: local database fixtures, no real leads or bookings.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";

const port = Number(process.env.CRM_QA_PORT || 3315);
const origin = `http://localhost:${port}`;
const secret = "quiz-crm-local-browser-qa-secret";
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({ sub: "checkpoint-admin", iat: now, exp: now + 28800, nonce: randomBytes(16).toString("base64url") })).toString("base64url");
const unsigned = `v1.${payload}`;
const cookie = `__Host-vmh_checkpoint_admin=${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
const generatedAt = new Date().toISOString();
const from = new Date(Date.now() - 86400_000).toISOString();
const state = { section: "quiz", activeSince: "2026-01-01T00:00:00.000Z", updatedAt: from };
const version = (quizVersion, totalQuestions, attempts) => ({ quizVersion, totalQuestions, attempts,
  questions: Array.from({ length: totalQuestions }, (_, i) => ({ questionNumber: i + 1, reached: attempts,
    answered: attempts - 1, exits: 1, exitsBeforeAnswer: 1, exitsAfterAnswer: 0, reachRate: 100, answerRate: 90, exitRate: 10 })),
  access: { viewed: 5, started: 4, submitAttempted: 3, saved: 2, resultsViewed: 2, validationFailed: 1, verificationFailed: 1, submitFailed: 1, exitedWithoutSubmitting: 2 },
});
const kpis = Object.fromEntries(["trackedSessions", "quizVisitors", "quizAttempts", "quizAttemptCompletions", "quizStarts", "quizCompletions", "quizLeads", "resultsViewed", "therapistMatchesViewed", "consultationClicks", "consultationRequests", "duplicateConsultationRequests", "consultationOpportunities", "consultationBookings", "paidTherapyConversions", "quizCompletionRate", "quizAttemptCompletionRate", "quizToConsultationRate", "requestToBookingRate", "opportunityToBookingRate", "bookingToPaidTherapyRate"].map((key) => [key, 0]));
const data = { generatedAt, range: { from, to: generatedAt }, kpis: { ...kpis, quizVisitors: 30 },
  quizFunnel: [{ key: "quiz_completions", label: "19 questions completed", count: 5, conversionRate: 50 }], quizIntentMix: [],
  quizQuestions: version("mixed", 19, 30).questions, sources: [], recentSessions: [],
  quizFlow: [version("6.0.0", 12, 10), version("5.1.0", 18, 12), version("5.0.0", 19, 8)] };
const database = createServer(async (request, response) => {
  for await (const _ of request) { /* Drain request. */ }
  const name = new URL(request.url, origin).pathname.split("/").pop();
  const results = {
    get_crm_reporting_state: state, list_crm_reporting_archives: { ...state, archives: [] },
    get_growth_dashboard: data,
    get_quiz_submission_recovery_queue: { generatedAt, pendingCount: 0, failedCount: 0, alertFailureCount: 0, submissions: [] },
    get_quiz_test_candidates: { generatedAt, flaggedCount: 0, testerIdentityCount: 0, records: [] },
    get_quiz_result_engagement: { views: 0, visitors: 0, averageActiveSeconds: 0, averageScrollDepth: 0, records: [] },
  };
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(results[name] ?? {}));
});
await new Promise((resolve) => database.listen(port + 1, "127.0.0.1", resolve));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  windowsHide: true,
  env: { ...process.env, NODE_ENV: "development", SUPABASE_URL: `http://127.0.0.1:${port + 1}`,
    SUPABASE_SECRET_KEY: "sb_secret_local_fixture", SUPABASE_SERVICE_ROLE_KEY: "", CHECKPOINT_ADMIN_SESSION_SECRET: secret,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(`${origin}/api/admin/checkpoints/quiz/dashboard`, { headers: { cookie }, signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, output.slice(-3000));
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setExtraHTTPHeaders({ cookie });
  await page.setRequestInterception(true);
  page.on("request", (request) => new URL(request.url()).origin === origin ? void request.continue() : void request.abort());
  await page.goto(`${origin}/admin/checkpoints/quiz`, { waitUntil: "networkidle0", timeout: 120000 });
  const selector = '[aria-label="Questionnaire version"]';
  const rows = '[aria-labelledby="quiz-questions-title"] tbody tr';
  assert.equal(await page.$eval(selector, (el) => el.value), "6.0.0");
  assert.equal((await page.$$(rows)).length, 12);
  assert(await page.evaluate(() => document.body.innerText.includes('Q12 · Payment and insurance readiness')));
  assert.equal(await page.evaluate(() => document.body.innerText.includes('Q19 routing') || document.body.innerText.includes('19-question journey')), false);
  for (const [v, count, first, last] of [["5.1.0", 18, "Reason for visiting", "Q18 · Preferred next step"], ["5.0.0", 19, "Reason for visiting", "Q19 · Preferred next step"], ["6.0.0", 12, "Type of support", "Q12 · Payment and insurance readiness"]]) {
    await page.select(selector, v);
    await page.waitForFunction((text) => document.body.innerText.includes(text), {}, last);
    assert.equal((await page.$$(rows)).length, count);
    assert((await page.$eval(`${rows}:first-child`, (el) => el.innerText)).includes(first));
  }
  assert.equal((await page.$$('[aria-label="Results access tracking"] .grid > div')).length, 9);
  await page.setViewport({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile CRM must not overflow');
  assert.deepEqual(errors, []);
  console.log('PASS CRM: default 12 questions, historical 18/19 labels, access milestones, desktop/mobile layout');
  await browser.close(); browser = undefined;
  const child = spawn(process.execPath, ['scripts/quiz-calendar-smoke.mjs'], {
    windowsHide: true, env: { ...process.env, SITE_URL: origin }, stdio: 'inherit',
  });
  const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  assert.equal(exitCode, 0, 'Quiz flow and result/calendar checks must pass');
} finally {
  await browser?.close(); server.kill(); database.closeAllConnections();
  await new Promise((resolve) => database.close(resolve));
}
