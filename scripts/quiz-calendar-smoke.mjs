import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import ts from "typescript";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const cache = new Map();
function loadLocal(name) {
  if (!name.startsWith("@/")) return require(name);
  const filename = path.resolve(name.slice(2) + ".ts");
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} };
  cache.set(filename, compiledModule);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(loadLocal, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { QUESTIONS, scoreQuiz } = loadLocal("@/lib/quiz");
const { matchTherapistPair } = loadLocal("@/lib/matching");
const answers = Object.fromEntries(QUESTIONS.filter((q) => q.kind === "scored").map((q) => [q.id, 2]));
const outcome = scoreQuiz(answers);
const match = matchTherapistPair(outcome, { concerns: ["anxiety"], genderPreference: "no-preference" });
const token = "quiz-calendar-browser-test-token-1234567890";
const origin = process.env.SITE_URL || "http://127.0.0.1:3010";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "valisen-quiz-calendar-"));
const browser = await puppeteer.launch({ headless: true });
try {
  async function pageFor(width, restore) {
    const page = await browser.newPage();
    const requests = [], metrics = [], errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width, height: 900 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument((savedToken) => { if (savedToken) sessionStorage.setItem("valisen.quiz.resultToken", savedToken); }, restore ? token : null);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname === "challenges.cloudflare.com") return void request.respond({ status: 200, contentType: "application/javascript", body: 'window.turnstile={render:function(el,options){setTimeout(function(){options.callback("test-turnstile-token")},0);return "qa"},remove:function(){},execute:function(){}};' });
      if (url.origin !== origin) return void request.abort();
      if (url.pathname === "/api/quiz-lead/result") return void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, referenceId: "VQ-CALENDARQA", firstName: "Alex", email: "qa@example.invalid", phone: "613-555-0100", outcome, match, intent: "see_recommended_therapist", attribution: {} }) });
      if (url.pathname === "/api/submit-intake") {
        requests.push(JSON.parse(request.postData()));
        return void request.respond({ status: requests.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(requests.length === 1 ? { error: "Temporary test failure" } : { ok: true, referenceId: "VC-CALENDARQA", crmSaved: true }) });
      }
      if (url.pathname === "/api/quiz-lead/result-engagement") metrics.push(JSON.parse(request.postData()));
      if (url.pathname.startsWith("/api/")) return void request.respond({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      void request.continue();
    });
    return { page, requests, metrics, errors };
  }
  const fresh = await pageFor(390, false);
  await fresh.page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
  for (let index = 0; index < QUESTIONS.length; index++) {
    console.log(`Checking question ${index + 1} of 18`);
    try {
      await fresh.page.waitForFunction((counter) => document.body.textContent.includes(counter), { timeout: 20000 }, `Question ${index + 1} of 18`);
    } catch (error) {
      console.log(await fresh.page.evaluate(() => document.body.innerText));
      console.log(fresh.errors);
      throw error;
    }
    const q = QUESTIONS[index];
    assert(!q.id.includes("gender"));
    if (q.kind === "multi") {
      await fresh.page.click('button[aria-pressed="false"]');
      await fresh.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue").click());
    } else await fresh.page.click('button[aria-pressed="false"]');
  }
  await fresh.page.waitForFunction(() => document.body.innerText.includes("Your personalized results are ready"));
  assert.equal(fresh.metrics.length, 0, "Result metrics must not run before submission");
  await fresh.page.close();
  console.log("PASS all 18 quiz screens; no result analytics before saved results");

  for (const width of [375, 1440]) {
    const { page, requests, metrics, errors } = await pageFor(width, true);
    await page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForSelector('[data-result-section="therapists"] article');
    assert.equal(await page.$$eval('[data-result-section="therapists"] article', (cards) => cards.length), 2);
    assert.equal(await page.$$eval('#quiz-consultation-booking input:not([type="hidden"]):not([type="checkbox"])', (inputs) => inputs.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.$eval('#quiz-consultation-booking', (el) => el.scrollIntoView());
    await page.click('#quiz-consultation-booking button[type="submit"]');
    assert.equal(requests.length, 0);
    await page.click('[aria-label^="Choose a date"] button:not([disabled])');
    await page.waitForSelector('[aria-label^="Choose a time"] button');
    await page.click('[aria-label^="Choose a time"] button');
    await page.click('#quiz-consultation-booking button[type="submit"]');
    assert.equal(requests.length, 0, "Consent is required");
    await page.click('#quiz-consultation-booking input[type="checkbox"]');
    await page.click('#quiz-consultation-booking button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes("Temporary test failure"));
    await page.waitForFunction(() => !document.querySelector('#quiz-consultation-booking fieldset').disabled);
    await page.click('#quiz-consultation-booking button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes("Your free consultation is booked."));
    assert.equal(requests.length, 2);
    assert.equal(requests[0].clientSubmissionId, requests[1].clientSubmissionId);
    assert.equal(requests[1].email, "qa@example.invalid");
    assert.equal(requests[1].phone, "613-555-0100");
    assert.equal(requests[1].quizSubmissionToken, token);
    assert.equal(requests[1].formVariant, "quiz_calendar");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(output, `quiz-${width}.png`), fullPage: true });
    const serialized = JSON.stringify(metrics.map((entry) => entry.snapshot));
    assert(metrics.length > 0);
    assert(!/qa@example|613-555|Alex|consultationDate|consultationTime|answers|safety/.test(serialized));
    assert(metrics.some((entry) => entry.snapshot.actions.booking_completed === 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: two therapists, saved details, calendar, consent, retry, confirmation, privacy-safe metrics`);
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
