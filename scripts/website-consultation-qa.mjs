import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import puppeteer from "puppeteer";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url), modules = new Map();
function loadLocal(name) {
  if (!name.startsWith("@/")) return require(name);
  const filename = path.resolve(name.slice(2) + ".ts");
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = { exports: {} }; modules.set(filename, mod);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(loadLocal, mod, mod.exports);
  return mod.exports;
}
const { getAvailableTimeSlotsForDate } = loadLocal("@/lib/consultation");

const origin = process.env.SITE_URL || "http://127.0.0.1:3019";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "valisen-website-booking-"));
const browser = await puppeteer.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, hasTouch: width < 640 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const contacts = [], bookings = [], availability = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "challenges.cloudflare.com") return void request.respond({ status: 200, contentType: "application/javascript", body: 'window.turnstile={render:function(el,options){el.__qa=options;return "qa"},remove:function(){},execute:function(el){setTimeout(function(){el.__qa.callback("test-turnstile-token")},0)}};' });
      if (url.origin !== origin) return void request.abort();
      if (url.pathname === "/api/consultation-slots") {
        availability.push(url.searchParams.get("therapist"));
        return void request.respond({ status: 200, contentType: "application/json", body: '{"booked":[],"calendarVersion":"therapist-capacity-v2"}' });
      }
      if (url.pathname === "/api/submit-intake") {
        const body = JSON.parse(request.postData());
        if (body.bookingStage === "contact") {
          contacts.push(body);
          return void request.respond({ status: contacts.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(contacts.length === 1 ? { error: "Temporary contact test failure" } : { ok: true, referenceId: "VC-111111111111111111111111", continuationToken: "qa-signed-continuation" }) });
        }
        bookings.push(body);
        return void request.respond({ status: bookings.length === 1 ? 409 : bookings.length === 2 ? 503 : 200, contentType: "application/json", body: JSON.stringify(bookings.length === 1 ? { error: "That time was just booked.", slotUnavailable: true } : bookings.length === 2 ? { error: "Temporary booking test failure" } : { ok: true, referenceId: "VC-222222222222222222222222", bookedTherapistSlug: body.preferredTherapist === "flexible" ? "wilfred-bengnwi" : body.preferredTherapist }) });
      }
      if (url.pathname.startsWith("/api/")) return void request.respond({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      void request.continue();
    });
    await page.goto(origin + "/consultation?source=website&therapist=meryem-ibrahim", { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForFunction(() => Object.keys(document.querySelector('#phone')).some(key => key.startsWith('__reactProps$')), { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.scrollY), 0, "No initial auto-scroll");
    assert.equal(await page.evaluate(() => document.body.innerText.includes("When works best for you?")), false);
    assert.equal(await page.$('[data-website-calendar]'), null, "No calendar before contact succeeds");
    await page.type('#full-name', 'Alex');
    await page.type('#email', 'qa@example.invalid');
    await page.type('#phone', '61355501239999');
    assert.equal(await page.$eval('#phone', el => el.value), '(613) 555-0123');
    await page.select('#therapy-type', 'Individual Therapy');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes("Please provide consent"));
    assert.equal(contacts.length, 0, "Consent required before saving");
    await page.click('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes("Temporary contact test failure"));
    assert.equal(await page.$('[data-website-calendar]'), null);
    assert.equal(await page.$eval('#full-name', el => el.value), 'Alex');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-website-calendar]');
    await page.screenshot({ path: path.join(output, `website-calendar-${width}.png`), fullPage: true });
    assert.equal(contacts.length, 2);
    assert.equal(contacts[0].clientSubmissionId, contacts[1].clientSubmissionId);
    assert.equal(contacts[1].lastName, '');
    assert.equal(contacts[1].timeOfDay, 'flexible');
    assert.equal(contacts[1].formVariant, 'website');
    assert(!contacts[1].consultationDate);
    assert.equal(await page.$eval('#website-booking-therapist', el => el.value), 'flexible');
    assert((await page.$eval('[data-website-calendar]', el => el.innerText)).includes('Your consultation details are saved.'));
    await page.waitForFunction(() => document.querySelector('[aria-label^="Choose a date"] button:not([disabled])'));
    const checkTimes = async (pool) => {
      await page.click('[aria-label^="Choose a date"] button:not([disabled])');
      await page.waitForSelector('[aria-label^="Choose a time"] button:not([disabled])');
      const label = await page.$eval('[aria-label^="Choose a date"] button[aria-pressed="true"]', el => el.getAttribute('aria-label'));
      const day = new Date(label);
      const iso = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
      const actual = await page.$$eval('[aria-label^="Choose a time"] button', buttons => buttons.map(button => button.textContent.trim()));
      assert.deepEqual(actual, getAvailableTimeSlotsForDate(iso, pool).map(slot => slot.time));
    };
    await checkTimes(); assert(availability.includes(null), 'Flexible loads the shared clinic pool');
    const clickText = text => page.evaluate(label => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label)?.click(), text);
    await clickText('Have our team help me schedule');
    await page.waitForFunction(() => document.body.innerText.includes("You don't need to submit anything else."));
    assert.equal(contacts.length, 2); assert.equal(bookings.length, 0);
    for (const slug of ['ryann-simpson','wilfred-bengnwi','tim-kahtava','dayong-quan','meryem-ibrahim']) {
      await page.select('#website-booking-therapist', slug);
      await page.waitForFunction(expected => document.querySelector('#website-booking-therapist').value === expected, {}, slug);
      await page.waitForFunction(() => document.querySelector('[aria-label^="Choose a date"] button:not([disabled])'));
      await checkTimes([slug]);
      assert(availability.includes(slug), `Live inventory fetched for ${slug}`);
    }
    const finalChoice = width === 375 ? 'flexible' : 'meryem-ibrahim';
    const expectedName = finalChoice === 'flexible' ? 'Wilfred Bengnwi' : 'Meryem Ibrahim';
    if (finalChoice === 'flexible') {
      await page.select('#website-booking-therapist', 'flexible');
      assert.equal(await page.$('[aria-label^="Choose a time"] button[aria-pressed="true"]'), null);
      await checkTimes();
    }
    const selectTime = async () => {
      await page.waitForSelector('[aria-label^="Choose a time"] button:not([disabled])');
      await page.click('[aria-label^="Choose a time"] button:not([disabled])');
    };
    await selectTime(); await clickText('Confirm my free consultation');
    await page.waitForFunction(() => document.body.innerText.includes("That time has just been booked"));
    assert.equal(await page.$eval('#website-booking-therapist', el => el.matches(':disabled')), false);
    await selectTime(); await clickText('Confirm my free consultation');
    await page.waitForFunction(() => document.body.innerText.includes("Temporary booking test failure"));
    assert.equal(await page.$eval('#website-booking-therapist', el => el.matches(':disabled')), true, "Uncertain outcome retains booking identity for retry");
    await clickText('Retry this booking');
    await page.waitForFunction(() => document.body.innerText.includes("Your consultation is booked."));
    assert.equal(bookings.length, 3);
    assert.equal(bookings[1].clientSubmissionId, bookings[2].clientSubmissionId);
    assert.equal(bookings[1].consultationDate, bookings[2].consultationDate);
    assert.equal(bookings[2].email, contacts[1].email);
    assert.equal(bookings[2].phone, contacts[1].phone);
    assert.equal(bookings[2].preferredTherapist, finalChoice);
    assert.equal(bookings[2].continuationToken, 'qa-signed-continuation');
    assert((await page.$eval('[data-website-calendar]', el => el.innerText).catch(() => page.evaluate(() => document.body.innerText))).includes(expectedName));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, `website-booked-${width}.png`), fullPage: true });
    await page.close();
    console.log(`PASS ${width}px: required consent/phone, single name, failed contact, saved request, help without duplicates, all therapist calendars, slot conflict, failed booking/retry, confirmed booking.`);
  }
  const page = await browser.newPage();
  for (const route of ['/', '/therapists']) {
    await page.goto(origin + route, { waitUntil: 'networkidle2', timeout: 120000 });
    const heroCount = await page.$eval('h1', heading => [...heading.closest('section').querySelectorAll('a')].filter(link => link.textContent.trim().startsWith('Book Free Consultation')).length);
    assert.equal(heroCount, 1, 'A single consultation button in each hero');
    assert.equal(await page.$('#therapist-finder'), null, `${route} finder removed`);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('a')].some(el => el.textContent.toLowerCase().includes('find my therapist'))), false);
  }
  console.log(`PASS finder removal. Screenshots: ${output}`);
} finally { await browser.close(); }
