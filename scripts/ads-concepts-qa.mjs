import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const base = process.env.SITE_URL || "http://127.0.0.1:3010";
const output = path.resolve("artifacts/ads-concepts");
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const errors = [];
const prohibited = [];
const warnings = [];
const page = await browser.newPage();
page.setDefaultTimeout(60_000);
await page.setRequestInterception(true);
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
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('#top', (element) => element.lang), route.endsWith('/arabic') ? 'ar' : 'zh-Hans');
    await page.screenshot({ path: path.join(output, `${route.split('/').at(-1)}-english-prompt.png`) });
    await page.click('dialog button:last-child');
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
async function booking(route) {
  if (route.endsWith('/mandarin') || route.endsWith('/arabic')) await page.click('[class*="languageToggle"] button[lang="en"]');
  await page.click('#your-therapist article button');
  await clickText('#consultation button', 'Continue');
  await page.waitForSelector('[role="alert"]');
  await page.click('[aria-label="Choose a consultation date"] button:not([disabled])');
  await page.click('[aria-label="Choose a consultation time"] button');
  await clickText('#consultation button', 'Continue');
  await page.waitForSelector('input[name="firstName"]');
  assert.equal(await page.$('#consultation form select'), null, `${route}: clinic booking does not select a therapist`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'firstName');
  const fieldTop = await page.$eval('input[name="firstName"]', (element) => element.getBoundingClientRect().top);
  assert.ok(fieldTop > 65 && fieldTop < 600, `${route}: contact form visible after transition (${fieldTop})`);
  await page.click('button[type="submit"]');
  assert.equal(await page.$('[role="status"]'), null, 'Empty contact details must not complete');
  await page.type('input[name="firstName"]', 'Preview');
  await page.type('input[name="email"]', 'preview@example.invalid');
  await page.type('input[name="phone"]', '(613) 555-0100');
  assert.equal(await page.$eval('input[name="phone"]', (element) => element.checkValidity()), true);
  await page.click('input[type="checkbox"]');
  if (route.endsWith('/mandarin')) await page.screenshot({ path: path.join(output, 'mandarin-booking-details.png') });
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="status"]');
  assert.match(await page.$eval('[role="status"]', (element) => element.textContent), /details were not sent/);
  assert.equal(new URL(page.url()).pathname, route, 'Booking stays on the same page');
  if (route.endsWith('/mandarin')) await page.screenshot({ path: path.join(output, 'mandarin-confirmation.png') });
  await clickText('[role="status"] button', 'Try the booking preview again');
  await page.waitForSelector('[aria-label="Choose a consultation date"]');
  assert.equal(await page.$$eval('[aria-label="Choose a consultation date"] button[aria-pressed="true"]', (elements) => elements.length), 0);
  console.log(`PASS ${route}: selection, validation, contact form, confirmation, retry; no navigation`);
}
try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await navigate("/ads-preview");
  const slugs = await page.$$eval('a[href^="/ads-preview/"]', (links) => [...new Set(links.map((link) => link.getAttribute("href")).filter((href) => href !== "/ads-preview/keyword-map"))]);
  assert.equal(slugs.length, 15);
  for (const [label, count] of [['Current keywords', 10], ['Language & niche', 5], ['All concepts', 15]]) {
    await clickText('[aria-label="Filter landing concepts"] button', label);
    await page.waitForFunction((count) => document.querySelectorAll('a[href^="/ads-preview/"]:not([download])').length === count, {}, count);
  }
  await page.screenshot({ path: path.join(output, "gallery-desktop.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await dimensions('Gallery mobile');
  await page.screenshot({ path: path.join(output, 'gallery-mobile.png'), fullPage: true });
  for (const slug of slugs) {
    await navigate(slug);
    await page.evaluate(async () => { for (const image of document.images) { image.loading = 'eager'; await image.decode().catch(() => {}); } });
    assert.deepEqual(await page.$$eval('img', (images) => images.filter((image) => !image.naturalWidth).map((image) => image.src)), []);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: width >= 768 ? 1000 : 844, deviceScaleFactor: 1 });
      await dimensions(`${slug} ${width}`);
      if (["anxiety", "couples", "mandarin", "ocd", "arabic"].includes(slug.split("/").at(-1)) && [1440, 390].includes(width)) {
        await page.evaluate(async () => { for (const image of document.images) { image.loading = "eager"; await image.decode().catch(() => {}); } });
        const broken = await page.$$eval("img", (images) => images.filter((image) => !image.naturalWidth).map((image) => image.src));
        assert.deepEqual(broken, []);
        await page.screenshot({ path: path.join(output, `${slug.split("/").at(-1)}-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(output, `${slug.split('/').at(-1)}-hero-${width}.png`) });
      }
    }
    console.log(`PASS ${slug}: four responsive sizes`);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await booking(slug);
  }
  const keywordResponse = await fetch(`${base}/ads-preview/keyword-map`);
  assert.equal(keywordResponse.status, 200);
  const csv = await keywordResponse.text();
  assert.equal(csv.trim().split('\r\n').length, 54, 'Header and 53 keywords in download');
  assert.ok(csv.includes('[book a therapist]'), 'Enabled exact-match keyword retained');
  assert.ok(!csv.includes('""book a therapist""'), 'Paused phrase-match keyword omitted');
  assert.ok(!csv.includes('""therapist ontario""'), 'Paused phrase-match keyword omitted');
  await navigate('/ads-preview/mandarin');
  await page.click('[class*="languageToggle"] button[lang="en"]');
  assert.equal(await page.$eval('#top', (element) => element.lang), 'en');
  await page.click('[class*="languageToggle"] button[lang="zh-Hans"]');
  assert.equal(await page.$eval('#top', (element) => element.lang), 'zh-Hans');
  await navigate('/ads-preview/arabic');
  assert.equal(await page.$eval('#top', (element) => element.dir), 'rtl');
  const missing = await page.goto(`${base}/ads-preview/not-a-concept`, { waitUntil: 'networkidle0' });
  assert.equal(missing.status(), 404, 'Unknown concept returns 404');
  assert.deepEqual(errors, [], "Runtime errors");
  assert.deepEqual(prohibited, [], "Previews must not send analytics or lead data");
  console.log("All 15 previews render without overflow, runtime errors, or tracking requests.");
} finally {
  await fs.writeFile(path.join(output, "initial-qa.json"), JSON.stringify({ errors, prohibited, warnings }, null, 2));
  await browser.close();
}
