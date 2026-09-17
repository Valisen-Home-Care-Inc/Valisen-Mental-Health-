import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const base = process.env.SITE_URL || "http://127.0.0.1:3030";
const output = path.resolve("artifacts/ads-concepts");
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const errors = [], prohibited = [], warnings = [];
const page = await browser.newPage();
page.setDefaultTimeout(30_000);
await page.setRequestInterception(true);
await page.evaluateOnNewDocument(() => {
  window.previewEvents = [];
  window.addEventListener("valisen:concept-preview", (event) => window.previewEvents.push(event.detail));
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && /hydration|pattern attribute/i.test(message.text())) errors.push(message.text());
  if (["warning", "warn", "error"].includes(message.type())) warnings.push(message.text());
});
page.on("request", (request) => {
  const url = new URL(request.url());
  if ((request.method() === "POST" && !url.pathname.startsWith("/__nextjs")) || /\/api\/(funnel|google-ads|consultation|quiz)/.test(url.pathname) || /google-analytics|googletagmanager|facebook\.net/.test(url.hostname)) {
    prohibited.push(`${request.method()} ${url.origin}${url.pathname}`);
    void request.abort();
  } else void request.continue();
});
async function navigate(route) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle0", timeout: 120_000 });
  assert.ok([200, 304].includes(response.status()), `${route}: HTTP ${response.status()}`);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.$$eval("h1", (nodes) => nodes.length), 1, `${route}: one H1`);
  assert.match(await page.$eval('meta[name="robots"]', (element) => element.content), /noindex/);
  if (route.endsWith('/mandarin') || route.endsWith('/arabic')) {
    assert.equal(await page.$('dialog[open]'), null, 'No automatic language popup');
    assert.equal(await page.$eval('#top', (element) => element.lang), route.endsWith('/arabic') ? 'ar' : 'zh-Hans');
  }
}
async function dimensions(label) {
  const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("main *")].filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 5).map((element) => `${element.tagName}.${element.className}`) }));
  assert.ok(result.scroll <= result.width + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.overflow, [], `${label}: clipped content`);
}
async function clickText(selector, text) {
  await page.$$eval(selector, (elements, wanted) => {
    const element = elements.find((item) => item.textContent.trim() === wanted);
    if (!element) throw new Error(`Missing button: ${wanted}`);
    element.click();
  }, text);
}
const calendar = '#consultation [class*="calendar"] [aria-pressed]:not([disabled])';
const times = '#consultation [class*="timeGrid"] button';
const next = '#consultation [data-booking-step="time"] button[class*="primaryButton"]';
const summary = '#consultation [class*="bookingSummary"]';
async function pickTime() {
  if (!await page.$(calendar)) await page.click('#consultation [class*="monthNav"] button:last-child:not([disabled])');
  await page.click(calendar); await page.waitForSelector(times); await page.click(times);
}
async function booking(route) {
  const slug = route.split('/').at(-1);
  const native = ['arabic', 'mandarin'].includes(slug);
  const nativeLocale = slug === 'arabic' ? 'ar' : 'zh-Hans';
  const intendedLanguage = slug === 'arabic' ? 'Arabic' : 'Mandarin';
  const clinicians = await page.$$eval('#your-therapist article h3', (items) => items.map((item) => item.textContent));
  await page.click('#your-therapist article:last-child button');
  assert.ok((await page.$eval(summary, (el) => el.textContent)).includes(clinicians.at(-1)), 'Profile CTA preserves selected therapist');
  await page.click(next); await page.waitForSelector('[role="alert"]');
  await pickTime();
  const chosenDate = await page.$eval(`${calendar}[aria-pressed="true"]`, (el) => el.getAttribute('aria-label'));
  const chosenTime = await page.$eval(`${times}[aria-pressed="true"]`, (el) => el.textContent);
  if (native) {
    await page.click('[class*="languageToggle"] button[lang="en"]');
    assert.equal(await page.$eval('#consultation select', (el) => el.value), intendedLanguage, 'Page toggle must not change consultation language');
    assert.equal(await page.$eval(`${calendar}[aria-pressed="true"]`, (el) => el.getAttribute('aria-label')), chosenDate);
    await page.click(`[class*="languageToggle"] button[lang="${nativeLocale}"]`);
    assert.equal(await page.$eval(`${times}[aria-pressed="true"]`, (el) => el.textContent), chosenTime);
  }
  await page.click(next); await page.waitForSelector('input[name="firstName"]');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'firstName');
  assert.equal(await page.$('[class*="mobileSticky"]'), null, 'No floating CTA while entering details');
  const fieldTop = await page.$eval('input[name="firstName"]', (el) => el.getBoundingClientRect().top);
  assert.ok(fieldTop > 65 && fieldTop < 800, `${route}: first field visible (${fieldTop})`);
  await page.click('button[type="submit"]'); await page.waitForSelector('[role="alert"]');
  assert.equal(await page.$('[role="status"]'), null, 'Empty contact details must not complete');
  if (native) assert.ok(!/Please complete/.test(await page.$eval('[role="alert"]', (el) => el.textContent)), 'Translated validation');
  await page.type('input[name="firstName"]', 'Preview');
  await page.type('input[name="email"]', 'preview@example.invalid');
  await page.type('input[name="phone"]', '(613) 555-0100');
  await page.click('input[type="checkbox"]');
  await page.click('#consultation button[class*="backButton"]'); await page.waitForSelector(next);
  if (clinicians.length > 1) {
    const firstSlug = await page.$eval('#consultation select', (el) => el.options[0].value);
    await page.select('#consultation select', firstSlug); await pickTime();
  }
  await page.click(next); await page.waitForSelector('input[name="firstName"]');
  assert.deepEqual(await page.$$eval('#consultation form input', (items) => items.map((el) => el.type === 'checkbox' ? el.checked : el.value)), ['Preview', 'preview@example.invalid', '(613) 555-0100', true], 'Changing therapist/time preserves contact details');
  assert.ok((await page.$eval(summary, (el) => el.textContent)).includes(clinicians[0]), 'Updated therapist appears in details');
  const before = await page.$eval(summary, (el) => el.textContent);
  if (native) await page.screenshot({ path: path.join(output, `${slug}-booking-details.png`) });
  await page.click('button[type="submit"]'); await page.waitForSelector('[role="status"]');
  assert.equal(await page.$eval(summary, (el) => el.textContent), before, 'Summary preserved through confirmation');
  assert.equal(new URL(page.url()).pathname, route, 'Booking stays on the page');
  if (native) await page.screenshot({ path: path.join(output, `${slug}-confirmation.png`) });
  await dimensions(`${route} confirmation`);
  const events = await page.evaluate(() => window.previewEvents);
  for (const name of ['cta_clicked', 'booking_started', 'details_viewed', 'preview_completed']) assert.ok(events.some((event) => event.event === name), name);
  assert.equal(events.filter((event) => event.event === 'booking_started').length, 1);
  assert.ok(events.every((event) => event.preview && !('email' in event) && !('phone' in event)));
  console.log(`PASS ${route}: named booking, selection persistence, validation, retained details, confirmation, local events`);
}
async function reminderChecks() {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await navigate('/ads-preview/anxiety');
  await page.evaluate(() => { sessionStorage.clear(); document.getElementById('our-approach').scrollIntoView({ behavior: 'instant' }); scrollBy({ top: 180, behavior: 'instant' }); });
  await page.bringToFront();
  const focus = await page.evaluate(() => document.activeElement.tagName);
  assert.ok(await page.evaluate(() => document.getElementById('your-therapist').getBoundingClientRect().bottom < 0), 'Therapist section has been passed');
  await page.waitForSelector('[class*="cornerInvitation"]', { timeout: 40_000 });
  assert.equal(await page.evaluate(() => document.activeElement.tagName), focus, 'Invitation does not steal focus');
  assert.ok(await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), 'Page remains scrollable');
  await page.screenshot({ path: path.join(output, 'desktop-invitation.png') });
  await page.click('[aria-label="Dismiss invitation"]');
  assert.equal(await page.$('[class*="cornerInvitation"]'), null);
  assert.ok(await page.evaluate(() => window.previewEvents.some((item) => item.event === 'reminder_dismissed')));
  await navigate('/ads-preview/depression');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('valisen.ads-preview.reminder.v1')), '1', 'Dismissal shared across pages');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => document.getElementById('your-therapist').scrollIntoView({ behavior: 'instant' }));
  await page.waitForSelector('[class*="mobileSticky"]'); await page.click('[class*="mobileSticky"] button');
  await page.waitForFunction(() => !document.querySelector('[class*="mobileSticky"]'));
  assert.ok(await page.evaluate(() => window.previewEvents.some((item) => item.event === 'cta_clicked' && item.placement === 'mobile')));
  await navigate('/ads-preview/anxiety?reminder=off');
  await page.evaluate(() => { sessionStorage.clear(); document.getElementById('your-therapist').scrollIntoView({ behavior: 'instant' }); });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => { window.dispatchEvent(new Event('scroll')); requestAnimationFrame(resolve); })));
  assert.equal(await page.$('[class*="mobileSticky"]'), null, 'Comparison switch disables reminders');
  console.log('PASS contextual reminder: active delay, nonmodal, dismissal, cross-page state, mobile suppression, disable switch');
}
try {
  if (process.env.QA_REMINDER_ONLY !== '1') {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await navigate('/ads-preview');
  const slugs = await page.$$eval('a[href^="/ads-preview/"]', (links) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href) => href !== '/ads-preview/keyword-map'))]);
  assert.equal(slugs.length, 15);
  for (const [label, count] of [['Current keywords', 10], ['Language & niche', 5], ['All concepts', 15]]) {
    await clickText('[aria-label="Filter landing concepts"] button', label);
    await page.waitForFunction((count) => document.querySelectorAll('a[href^="/ads-preview/"]:not([download])').length === count, {}, count);
  }
  await page.screenshot({ path: path.join(output, 'gallery-desktop.png'), fullPage: true });
  for (const route of slugs) {
    await navigate(route);
    await page.evaluate(async () => { for (const image of document.images) { image.loading = 'eager'; await image.decode().catch(() => {}); } });
    assert.deepEqual(await page.$$eval('img', (images) => images.filter((image) => !image.naturalWidth).map((image) => image.src)), []);
    for (const width of [1440, 768, 430, 390, 360, 320]) {
      await page.setViewport({ width, height: width >= 768 ? 1000 : 844, deviceScaleFactor: 1 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await dimensions(`${route} ${width}`);
      const slug = route.split('/').at(-1);
      if (['anxiety', 'couples', 'mandarin', 'arabic', 'free-consultation', 'online-therapy'].includes(slug) && [1440, 390].includes(width)) {
        await page.screenshot({ path: path.join(output, `${slug}-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(output, `${slug}-hero-${width}.png`) });
      }
    }
    console.log(`PASS ${route}: six responsive sizes`);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await booking(route);
  }
  const keywordResponse = await fetch(`${base}/ads-preview/keyword-map`); assert.equal(keywordResponse.status, 200);
  const csv = await keywordResponse.text(); assert.equal(csv.trim().split('\r\n').length, 54);
  assert.ok(!csv.includes('""book a therapist""') && !csv.includes('""therapist ontario""'), 'Paused keywords omitted');
  for (const keyword of ['[book a psychotherapist]', '[online psychotherapist ontario]']) assert.ok(csv.split('\r\n').find((row) => row.includes(keyword)).includes('/welcome/psychotherapists'));
  }
  await reminderChecks();
  const missing = await page.goto(`${base}/ads-preview/not-a-concept`, { waitUntil: 'networkidle0' }); assert.equal(missing.status(), 404);
  assert.deepEqual(errors, [], 'Runtime errors'); assert.deepEqual(prohibited, [], 'No production analytics or booking requests');
  console.log(process.env.QA_REMINDER_ONLY === '1' ? 'Reminder checks passed; zero lead or tracking requests.' : 'All 15 previews passed; zero lead or tracking requests.');
} finally {
  await fs.writeFile(path.join(output, 'refinement-qa.json'), JSON.stringify({ base, errors, prohibited, warnings }, null, 2));
  await browser.close();
}
