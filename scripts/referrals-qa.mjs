import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.SITE_URL || "http://127.0.0.1:3000";
const directory = "artifacts/referrals";
await fs.mkdir(directory, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const analytics = [];
let submitMode = "error";
page.on("pageerror", error => errors.push(error.message));
await page.setRequestInterception(true);
page.on("request", request => {
  if (request.url().includes("/api/funnel-events")) { analytics.push(request.postData() || ""); return request.respond({ status: 204 }); }
  if (request.url().includes("/api/referrals")) return request.respond({ status: submitMode === "error" ? 503 : 200, contentType: "application/json", body: JSON.stringify(submitMode === "error" ? { error: "Synthetic service failure. Please retry." } : { ok: true }) });
  if (request.url().includes("challenges.cloudflare.com/turnstile/v0/api.js")) return request.respond({ status: 200, contentType: "application/javascript", body: "window.turnstile={render:function(el,options){setTimeout(function(){options.callback('synthetic-token')},20);return 'test'},remove:function(){},execute:function(){}};" });
  return request.continue();
});
try {
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 950, deviceScaleFactor: 1 });
    await page.goto(`${base}/referrals`, { waitUntil: "networkidle2" });
    await page.$$eval("img", images => images.forEach(image => { image.loading = "eager"; }));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
    assert.equal(await page.$$eval("h1", items => items.length), 1);
    assert.equal(await page.$$eval("[data-referral-event='therapist_profile_clicked_from_referrals']", items => items.length), 5);
    assert.equal(await page.$$eval("script[src*='googletagmanager']", items => items.length), 0);
    assert.equal(await page.$$eval("img", items => items.every(image => image.complete && image.naturalWidth > 0)), true);
    assert.equal(await page.$eval('nav[aria-label="Healthcare referrals"]', nav => nav.getBoundingClientRect().width <= innerWidth), true);
    await page.screenshot({ path: `${directory}/${width}.png`, fullPage: true });
    if (width === 390 || width === 1440) await page.screenshot({ path: `${directory}/${width}-hero.png` });
  }
  const brokenAnchors = await page.$$eval('a[href^="#"]', anchors => anchors.map(a => a.getAttribute("href")).filter(href => !document.getElementById(href.slice(1))));
  assert.deepEqual(brokenAnchors, []);
  const paths = await page.$$eval("main a[href^='/']", anchors => [...new Set(anchors.map(a => a.getAttribute("href")))]);
  for (const path of paths) { const response = await fetch(`${base}${path}`); assert.equal(response.ok, true, `Broken route ${path}`); }
  const formEnabled = await page.$eval("#ref-providerName", input => !input.disabled);
  let submissionTest = "disabled-state only";
  if (formEnabled) {
    await page.$eval('form[aria-label="Healthcare provider referral"]', form => form.requestSubmit());
    await page.waitForSelector("[aria-invalid='true']");
    const sample = { providerName: "Synthetic Provider", providerRole: "Nurse", organization: "QA Clinic", providerPhone: "6135550101", providerEmail: "qa-provider@example.invalid", patientName: "Synthetic Patient", patientPhone: "6135550102" };
    for (const [name, value] of Object.entries(sample)) await page.type(`#ref-${name}`, value);
    await page.select("#ref-reason", "Anxiety");
    await page.click("#ref-consent");
    const hasVerificationWidget = Boolean(await page.$('[aria-label="Automated spam protection"]'));
    await page.$eval('form[aria-label="Healthcare provider referral"]', form => form.requestSubmit());
    if (!hasVerificationWidget) {
      await page.waitForFunction(() => document.body.innerText.includes("Please complete the security verification"));
      submissionTest = "validation and missing production Turnstile configuration fail closed";
    } else {
    await page.waitForFunction(() => document.body.innerText.includes("Synthetic service failure"));
    assert.equal(await page.$eval("#ref-patientName", input => input.value), "Synthetic Patient");
    submitMode = "success";
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    await new Promise(resolve => setTimeout(resolve, 200));
    await page.$eval('form[aria-label="Healthcare provider referral"]', form => form.requestSubmit());
    await page.waitForFunction(() => document.body.innerText.includes("Thank you for referring your patient."));
    await page.screenshot({ path: `${directory}/success.png`, fullPage: true });
    assert.equal(await page.$("#ref-patientName"), null);
    submissionTest = "mocked success and failure";
    }
  }
  await page.$eval("details summary", el => el.click());
  assert.equal(await page.$eval("details", el => el.open), true);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const payloads = analytics.join("\n");
  for (const forbidden of ["Synthetic Patient", "qa-provider", "6135550102", "Anxiety", "patientName", "reason"]) assert.equal(payloads.includes(forbidden), false, `PHI in analytics: ${forbidden}`);
  assert.deepEqual(errors, []);
  const report = { widths: [375, 390, 430, 768, 1024, 1440], formEnabled, submissionTest, routesChecked: paths, consoleErrors: errors, analyticsBatches: analytics.length };
  await fs.writeFile(`${directory}/qa-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
