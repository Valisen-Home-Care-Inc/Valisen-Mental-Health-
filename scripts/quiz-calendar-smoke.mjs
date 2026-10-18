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
const { QUESTIONS, QUIZ_VERSION, scoreQuiz, scoreBandFor } = loadLocal("@/lib/quiz");
const { matchTherapistPair } = loadLocal("@/lib/matching");
const answers = { ...Object.fromEntries(QUESTIONS.filter((q) => q.kind === "scored").map((q) => [q.id, 2])), duration: "acute", impact: "none" };
const outcome = scoreQuiz(answers);
const legacyOutcome = { ...outcome, score: null, answeredCount: 0 };
const match = matchTherapistPair(outcome, { concerns: ["anxiety"], genderPreference: "no-preference" });
const token = "quiz-calendar-browser-test-token-1234567890";
const origin = process.env.SITE_URL || "http://127.0.0.1:3010";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "valisen-quiz-calendar-"));
const browser = await puppeteer.launch({
  headless: true,
  // CI containers often run as root, where Chromium needs --no-sandbox.
  args: process.getuid?.() === 0 ? ["--no-sandbox"] : [],
});
try {
  async function pageFor(width, restore, savedMatch = match, savedOutcome = outcome) {
    const page = await browser.newPage();
    const requests = [], metrics = [], errors = [], quizSaves = [], funnel = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width, height: 900, hasTouch: width < 640 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument((savedToken) => { if (savedToken) sessionStorage.setItem("valisen.quiz.resultToken", savedToken); }, restore ? token : null);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname === "challenges.cloudflare.com") return void request.respond({ status: 200, contentType: "application/javascript", body: 'window.turnstile={render:function(el,options){el.__qa=options;setTimeout(function(){options.callback("test-turnstile-token")},0);return "qa"},remove:function(){},execute:function(el){setTimeout(function(){el.__qa&&el.__qa.callback("test-turnstile-token")},0)}};' });
      if (url.origin !== origin) return void request.abort();
      if (url.pathname === "/api/consultation-slots") return void request.respond({ status: 200, contentType: "application/json", body: '{"booked":[]}' });
      if (url.pathname === "/api/funnel-events") {
        funnel.push(...JSON.parse(request.postData()).events);
        return void request.respond({ status: 204 });
      }
      if (url.pathname === "/api/quiz-lead") {
        quizSaves.push(JSON.parse(request.postData()));
        return void request.respond({ status: quizSaves.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(quizSaves.length === 1
          ? { error: "Temporary access-form test failure" }
          : { ok: true, referenceId: "VQ-ACCESSQA", submissionToken: token, outcome: savedOutcome, match: savedMatch, intent: "exploring" }) });
      }
      if (url.pathname === "/api/quiz-lead/result") return void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, referenceId: "VQ-CALENDARQA", firstName: "Alex", email: "qa@example.invalid", phone: "613-555-0100", outcome: savedOutcome, match: savedMatch, intent: "see_recommended_therapist", attribution: {} }) });
      if (url.pathname === "/api/submit-intake") {
        requests.push(JSON.parse(request.postData()));
        return void request.respond({ status: requests.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(requests.length === 1 ? { error: "Temporary test failure" } : { ok: true, referenceId: "VC-CALENDARQA", crmSaved: true }) });
      }
      if (url.pathname === "/api/quiz-lead/result-engagement") metrics.push(JSON.parse(request.postData()));
      if (url.pathname.startsWith("/api/")) return void request.respond({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      void request.continue();
    });
    return { page, requests, metrics, errors, quizSaves, funnel };
  }
  if (!process.argv.includes('--welcome-only')) {
  const fresh = await pageFor(390, false);
  await fresh.page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
  await fresh.page.screenshot({ path: path.join(output, "quiz-question-1-390.png"), fullPage: true });
  assert.equal(await fresh.page.$('[role="status"] .animate-spin'), null, "Question 1 must render without the saved-result spinner");
  const clickByText = (page, text) => page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
    if (!button) throw new Error(`Missing button: ${label}`);
    button.click();
  }, text);
  for (let index = 0; index < QUESTIONS.length; index++) {
    console.log(`Checking question ${index + 1} of ${QUESTIONS.length}`);
    try {
      await fresh.page.waitForFunction((counter) => document.body.textContent.includes(counter), { timeout: 20000 }, `Question ${index + 1} of ${QUESTIONS.length}`);
    } catch (error) {
      console.log(await fresh.page.evaluate(() => document.body.innerText));
      console.log(fresh.errors);
      throw error;
    }
    const q = QUESTIONS[index];
    assert(!["age", "eligibility", "residency", "gender_preference"].includes(q.id));
    if (["intro", "stress_2", "safety", "feel_different", "call_time"].includes(q.id)) {
      await fresh.page.screenshot({ path: path.join(output, `quiz-${q.id}-390.png`), fullPage: true });
    }
    if (index === 7) {
      assert((await fresh.page.evaluate(() => document.body.innerText)).includes("Halfway there"), "Halfway encouragement shows");
    }
    if (q.kind === "scored") {
      if (index === 1) {
        // "Prefer not to answer" is recorded, then changed on the way back.
        await clickByText(fresh.page, "Prefer not to answer");
        await fresh.page.waitForFunction(() => document.body.textContent.includes("Question 3 of"));
        await clickByText(fresh.page, "Back");
        await fresh.page.waitForFunction(() => document.body.textContent.includes("Question 2 of"));
        assert.equal(await fresh.page.$eval('button[aria-pressed="true"]', (button) => button.textContent.trim()), "Prefer not to answer");
      }
      await clickByText(fresh.page, "More than half the days");
    } else if (q.kind === "safety") {
      assert((await fresh.page.evaluate(() => document.body.textContent)).includes("One question we ask everyone"), "Safety has a gentle lead-in");
      await clickByText(fresh.page, "Yes, often");
      await fresh.page.waitForFunction(() => document.body.innerText.includes("Please reach out to someone who can help today"));
      await fresh.page.screenshot({ path: path.join(output, "quiz-safety-interstitial-390.png"), fullPage: true });
      await clickByText(fresh.page, "Go back");
      await fresh.page.waitForFunction((counter) => document.body.textContent.includes(counter), {}, `Question ${index + 1} of ${QUESTIONS.length}`);
      await clickByText(fresh.page, "No");
    } else if (q.kind === "multi") {
      if (q.id === "feel_different") {
        const choices = await fresh.page.$$('button[aria-pressed="false"]');
        for (const choice of choices.slice(0, 2)) await choice.click();
        assert.equal(await fresh.page.$eval('button[aria-pressed="false"]', (button) => button.disabled), true, "Choices must stop at two");
        await clickByText(fresh.page, "I'm not sure yet");
        assert.equal(await fresh.page.$$eval('button[aria-pressed="true"]', (items) => items.length), 1, "Not sure must be exclusive");
        await fresh.page.click('button[aria-pressed="false"]');
        assert.equal(await fresh.page.$$eval('button[aria-pressed="true"]', (items) => items.length), 1, "A specific goal must replace Not sure");
        await clickByText(fresh.page, "Continue");
      } else {
        // Optional: the button offers to skip until something is chosen.
        assert(await fresh.page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Skip — nothing specific"))));
        await clickByText(fresh.page, "Anxiety or worry");
        await clickByText(fresh.page, "Continue");
      }
    } else if (q.id === "call_time") {
      const text = await fresh.page.evaluate(() => document.body.textContent);
      assert(text.includes("Your results are next"), "The last question says results are next");
      assert(text.includes("You'll see your score and matches either way"), "The last question promises results either way");
      await clickByText(fresh.page, "Weekday evenings");
    } else await fresh.page.click('button[aria-pressed="false"]');
  }
  await fresh.page.waitForSelector('input[autocomplete="given-name"]');
  assert.equal(fresh.metrics.length, 0, "Result metrics must not run before submission");
  await fresh.page.type('input[autocomplete="given-name"]', 'Alex');
  // Starting the form must be captured before the first field loses focus.
  const pending = await fresh.page.evaluate(() => JSON.parse(sessionStorage.getItem('valisen:funnel-pending:v1') || '{}').events || []);
  assert([...fresh.funnel, ...pending].some((event) => event.event === 'quiz_access_form_started'), 'Form start must be queued or delivered immediately');
  assert.equal(await fresh.page.evaluate(() => document.activeElement?.getAttribute('autocomplete')), 'given-name');
  await fresh.page.type('input[type="email"]', 'qa@example.invalid');
  await fresh.page.type('input[type="tel"]', '6135550100');
  await fresh.page.click('input[type="checkbox"]');
  await fresh.page.waitForFunction(() => !document.querySelector('form button[type="submit"]').disabled);
  await Promise.all([
    fresh.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/quiz-lead' && response.status() === 503),
    fresh.page.click('form button[type="submit"]'),
  ]);
  await fresh.page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'false');
  assert.equal(fresh.quizSaves.length, 1);
  assert.equal(fresh.metrics.length, 0, 'Failed access save must not open results');
  await fresh.page.click('form button[type="submit"]');
  await fresh.page.waitForSelector('[data-quiz-results]');
  await fresh.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/quiz-lead/result-engagement');
  assert.equal(fresh.quizSaves.length, 2);
  assert.equal(fresh.quizSaves[0].clientSubmissionId, fresh.quizSaves[1].clientSubmissionId);
  const distinctEvents = [...new Map(fresh.funnel.map((event) => [event.eventId, event])).values()];
  for (const name of ['quiz_completed', 'quiz_intent_selected', 'quiz_access_form_viewed', 'quiz_access_form_started', 'quiz_access_form_submit_failed', 'lead_details_submitted', 'results_viewed']) {
    assert.equal(distinctEvents.filter((event) => event.event === name).length, 1, name);
  }
  assert.equal(distinctEvents.filter((event) => event.event === 'quiz_access_form_submit_attempted').length, 2);
  assert(distinctEvents.filter((event) => event.page === 'quiz').every((event) => event.quizVersion === QUIZ_VERSION));
  const submitted = fresh.quizSaves[1].answers;
  assert.equal("safety" in submitted, false, "The safety answer must stay on the device");
  assert.deepEqual(QUESTIONS.filter((q) => q.kind === "scored").map((q) => submitted[q.id]), Array(12).fill(2));
  assert.deepEqual(submitted.concerns, ["anxiety"]);
  assert.equal(submitted.call_time, "weekday-evenings");
  assert(!JSON.stringify(fresh.funnel).includes('qa@example.invalid'));
  assert(!JSON.stringify(fresh.funnel).includes('6135550100'));
  assert.deepEqual(fresh.errors, []);
  await fresh.page.close();
  console.log(`PASS all ${QUESTIONS.length} quiz screens; access milestones, immediate start, failed save, stable retry, results tracking and privacy`);

  // A male strongest match must still DISPLAY the woman first, without relabeling the strongest match.
  const malePrimary = { ...match, therapistSlug: "tim-kahtava", reasons: match.alternative.reasons, alternative: { therapistSlug: "meryem-ibrahim", reasons: match.reasons } };
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    const { page, requests, errors } = await pageFor(width, true, malePrimary);
    await page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForSelector('#quiz-therapist-matches article');
    const cards = await page.$$eval('#quiz-therapist-matches article', (items) => items.map((item) => ({ name: item.querySelector('h3').textContent, photo: Boolean(item.querySelector('img')) })));
    assert.equal(cards.length, 2);
    assert.equal(cards[0].name, "Meryem Ibrahim");
    assert(cards.every((card) => card.photo), "Each match shows the therapist's photo");
    const resultsText = await page.$eval('[data-quiz-results]', (el) => el.innerText);
    assert(resultsText.includes(String(outcome.score)), "The wellbeing score is shown");
    assert(resultsText.includes(scoreBandFor(outcome.score)), "The score band meaning is shown");
    assert.equal(await page.$eval('[role="meter"]', (el) => el.getAttribute('aria-valuenow')), String(outcome.score));
    assert.equal(await page.$eval('a[href="/valisen-care.vcf"]', (el) => el.hasAttribute('download')), true, "Save contact downloads the vCard");
    assert(await page.$('a[href="https://wa.me/16137070333"]'), "WhatsApp link is present");
    assert.equal((await page.$eval('[data-quiz-results]', (el) => el.textContent)).includes('Download My Results PDF'), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.$eval('[data-quiz-results]', (el) => el.scrollIntoView());
    await page.screenshot({ path: path.join(output, `results-viewport-${width}.png`) });
    await page.screenshot({ path: path.join(output, `results-${width}.png`), fullPage: true });
    console.log(`Results height at ${width}px: ${await page.$eval('[data-quiz-results]', (el) => Math.round(el.getBoundingClientRect().height))}px`);

    await page.click('#quiz-therapist-matches article:first-child summary');
    await page.waitForFunction(() => document.querySelector('#quiz-therapist-matches article:first-child details').open);
    await page.click('#quiz-therapist-matches article:first-child summary');
    await page.click('#quiz-consultation-booking [aria-label="Next month"]');
    await page.click('#quiz-consultation-booking [aria-label="Previous month"]');
    assert.equal(await page.$eval('#quiz-consultation-booking [aria-label="Previous month"]', (el) => el.disabled), true);
    for (const weekday of ['Saturday','Sunday']) assert(await page.$$eval('[aria-label^="Choose a date"] button', (items,day) => items.some((el) => el.getAttribute('aria-label').includes(day)&&!el.disabled),weekday), `${weekday} has recurring consultation shifts`);
    await page.click('[aria-label^="Choose a date"] button:not([disabled])');
    await page.waitForSelector('[aria-label^="Choose a time"] button');
    await page.$eval('[aria-label^="Choose a time"] button:last-child', (el) => el.scrollIntoView({ block: 'center' }));
    await page.click('[aria-label^="Choose a time"] button:last-child');
    assert.equal(await page.$eval('[aria-label^="Choose a time"] button:last-child', (el) => el.getAttribute('aria-pressed')), 'true');
    await page.$eval('#quiz-consultation-booking', (el) => el.scrollIntoView());
    await page.screenshot({ path: path.join(output, `calendar-viewport-${width}.png`) });
    await page.screenshot({ path: path.join(output, `calendar-${width}.png`), fullPage: true });
    await page.click('[aria-label^="Choose a date"] button:not([disabled]):not([aria-pressed="true"])');
    assert.equal(await page.$$eval('[aria-label^="Choose a time"] button[aria-pressed="true"]', (items) => items.length), 0, 'Changing the date must clear the old time');
    assert.equal(requests.length, 0);
    assert.deepEqual(errors, []);
    console.log(`PASS design ${width}px: score, female first photo cards, contact and WhatsApp links, no overflow, month navigation, time slots, date reset`);
    await page.close();
  }

  {
    // A saved version 6 result has no score: show matches without a number.
    const { page, errors } = await pageFor(390, true, match, legacyOutcome);
    await page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForSelector('#quiz-therapist-matches article');
    assert.equal(await page.$('[role="meter"]'), null);
    assert((await page.$eval('[data-quiz-results]', (el) => el.innerText)).includes("Your therapist matches are ready"));
    assert.deepEqual(errors, []);
    console.log("PASS restored version 6 result without a score");
    await page.close();
  }

  for (const width of [375, 1440]) {
    const { page, requests, metrics, errors } = await pageFor(width, true);
    if (width >= 1024) await page.evaluateOnNewDocument(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => query === "(hover: hover) and (pointer: fine)"
        ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
        : original(query);
    });
    await page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForSelector('[data-result-section="therapists"] article');
    assert.equal(await page.$$eval('[data-result-section="therapists"] article', (cards) => cards.length), 2);
    assert.equal(await page.$$eval('#quiz-consultation-booking input:not([type="hidden"]):not([type="checkbox"])', (inputs) => inputs.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bookNow = async () => (await page.evaluateHandle(() => [...document.querySelectorAll('#quiz-consultation-booking button')].find((b) => b.textContent.includes('Book now') || b.textContent.includes('Booking')))).asElement();
    assert.equal(await (await bookNow()).evaluate((button) => button.disabled), true, "Book now waits for a time");
    await page.evaluate(() => [...document.querySelectorAll('#quiz-therapist-matches button')].find((b) => b.textContent.trim() === 'Book with Meryem').click());
    await page.waitForFunction(() => document.querySelector('#quiz-consultation-booking').innerText.includes("like to meet Meryem"));
    await page.click('[aria-label^="Choose a date"] button:not([disabled])');
    await page.waitForSelector('[aria-label^="Choose a time"] button');
    await page.click('[aria-label^="Choose a time"] button');
    assert.equal(await page.$$eval('#quiz-consultation-booking input[type="checkbox"]', (items) => items.length), 0, "No consent checkbox: one tap books");
    assert((await page.$eval('#quiz-consultation-booking', (el) => el.innerText)).includes('By tapping “Book now”'));
    await (await bookNow()).click();
    await page.waitForFunction(() => document.body.innerText.includes("Temporary test failure"));
    await page.waitForFunction(() => !document.querySelector('#quiz-consultation-booking fieldset').disabled);
    await (await bookNow()).click();
    await page.waitForFunction(() => document.body.innerText.includes("You're booked, Alex!"));
    assert.equal(requests.length, 2);
    assert.equal(requests[0].clientSubmissionId, requests[1].clientSubmissionId);
    assert.equal(requests[1].email, "qa@example.invalid");
    assert.equal(requests[1].phone, "613-555-0100");
    assert.equal(requests[1].quizSubmissionToken, token);
    assert.equal(requests[1].formVariant, "quiz_calendar");
    assert.equal(requests[1].preferredTherapist, "meryem-ibrahim");
    assert.equal(requests[1].consent, true);
    assert(requests[1].consentLanguage.startsWith("I agree that Valisen Mental Health"));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(output, `quiz-${width}.png`), fullPage: true });
    const serialized = JSON.stringify(metrics.map((entry) => entry.snapshot));
    assert(metrics.length > 0);
    assert(!/qa@example|613-555|Alex|consultationDate|consultationTime|answers|safety/.test(serialized));
    assert(metrics.some((entry) => entry.snapshot.actions.booking_completed === 1));
    assert.deepEqual(errors, []);
    if (width >= 1024) {
      // Desktop "before you go" prompt appears once after a short stay and closes with Escape.
      await new Promise((resolve) => setTimeout(resolve, 8300));
      await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { clientY: -2, relatedTarget: null, bubbles: true })));
      assert.equal(await page.$('[aria-labelledby="exit-save-title"]'), null, "No exit prompt after booking");
    }
    console.log(`PASS ${width}px: two therapists, saved details, one-tap booking, preference, retry, confirmation, privacy-safe metrics`);
    await page.close();
  }
  {
    const { page, errors } = await pageFor(1440, true);
    // Headless Chromium reports no mouse, so present a desktop pointer for the
    // "before you go" prompt, which only arms on hover-capable devices.
    await page.evaluateOnNewDocument(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => query === "(hover: hover) and (pointer: fine)"
        ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
        : original(query);
    });
    await page.goto(origin + "/quiz", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForSelector('#quiz-therapist-matches article');
    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { clientY: -2, relatedTarget: null, bubbles: true })));
    assert.equal(await page.$('[aria-labelledby="exit-save-title"]'), null, "No exit prompt in the first seconds");
    await new Promise((resolve) => setTimeout(resolve, 8300));
    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { clientY: -2, relatedTarget: null, bubbles: true })));
    await page.waitForSelector('[aria-labelledby="exit-save-title"]');
    await page.screenshot({ path: path.join(output, "exit-prompt-1440.png") });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector('[aria-labelledby="exit-save-title"]'));
    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { clientY: -2, relatedTarget: null, bubbles: true })));
    assert.equal(await page.$('[aria-labelledby="exit-save-title"]'), null, "The exit prompt shows once per session");
    assert.deepEqual(errors, []);
    console.log("PASS exit prompt: delayed, once per session, Escape closes");
    await page.close();
  }
  }
  for (const width of [320, 390, 1440]) {
    const { page, requests, errors } = await pageFor(width, false);
    await page.goto(origin + '/welcome', { waitUntil: 'networkidle2', timeout: 120000 });
    const form = await page.$('form[data-google-ads-consultation-form]');
    await (await form.$('input[autocomplete="name"]')).type('Alex');
    await (await form.$('input[type="tel"]')).type('6135550100');
    await (await form.$('input[type="email"]')).type('qa@example.invalid');
    await (await form.$('input[type="checkbox"]')).click();
    await form.evaluate((el) => [...el.querySelectorAll('button')].find((button) => button.textContent.includes('Continue to Pick a Time')).click());
    await page.waitForSelector('[aria-label^="Choose a date"]');
    await (await form.$('[aria-label^="Choose a date"] button:not([disabled])')).click();
    await page.waitForSelector('[aria-label^="Choose a time"] button');
    const firstTime = await form.$('[aria-label^="Choose a time"] button');
    await firstTime.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForFunction((element) => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, {}, firstTime);
    await firstTime.click();
    await page.waitForSelector('[aria-label^="Choose a time"] button[aria-pressed="true"]');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await form.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 125, behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `welcome-viewport-${width}.png`) });
    await form.screenshot({ path: path.join(output, `welcome-calendar-${width}.png`) });
    await form.evaluate((el) => [...el.querySelectorAll('button')].find((button) => button.textContent.includes('suitable time')).click());
    assert.equal(await form.$$eval('[aria-label^="Choose a date"]', (items) => items.length), 0);
    assert((await form.evaluate((el) => el.textContent)).includes('within 24 hours'));
    await form.evaluate((el) => [...el.querySelectorAll('button')].find((button) => button.textContent.includes('Pick a specific time instead')).click());
    await page.waitForSelector('[aria-label^="Choose a date"]');
    assert.equal(requests.length, 0, 'Visual checks must not create a booking');
    assert.deepEqual(errors, []);
    console.log(`PASS welcome ${width}px: contact handoff, calendar, selected time, flexible toggle, no overflow`);
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
