import assert from "node:assert/strict";
import fs from "node:fs/promises";
import puppeteer from "puppeteer";

const base = process.env.SITE_URL || "http://localhost:3101";
await fs.mkdir("artifacts/referrals", { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.setRequestInterception(true);
page.on("request", request => {
  if (request.url().includes("/api/funnel-events")) return request.respond({ status: 204 });
  return request.continue();
});
async function checkIsolation() {
  const escaped = await page.$$eval("a[href]", links => links.map(link => link.href).filter(href => {
    const url = new URL(href);
    return url.origin === location.origin && url.pathname !== "/referrals" && !url.pathname.startsWith("/referrals/");
  }));
  assert.deepEqual(escaped, [], `Main-site links at ${page.url()}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.$$eval("script[src*='googletagmanager']", scripts => scripts.length), 0);
}
try {
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 950 });
    const home = await page.goto(`${base}/referrals`, { waitUntil: "networkidle2" });
    assert.ok(home.headers()["content-security-policy"].includes("default-src 'self'"));
    await checkIsolation();
    const profiles = await page.$$eval("a[data-referral-event='therapist_profile_clicked_from_referrals']", links => links.map(link => link.getAttribute("href")));
    assert.equal(profiles.length, 5);
    for (const path of profiles) {
      await page.click(`a[href='${path}']`);
      await page.waitForFunction(expected => location.pathname === expected, {}, path);
      await page.waitForSelector("h1");
      await checkIsolation();
      await page.goBack({ waitUntil: "networkidle2" });
      assert.equal(new URL(page.url()).pathname, "/referrals");
      await page.goto(`${base}${path}`, { waitUntil: "networkidle2" });
      await page.click('main a[href="/referrals#referral-therapists"]');
      await page.waitForSelector("#referral-therapists");
      assert.equal(new URL(page.url()).pathname, "/referrals");
    }
    await page.goto(`${base}${profiles[0]}`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: `artifacts/referrals/profile-${width}.png`, fullPage: true });
    await page.click('main a[href^="/referrals?therapist="]');
    await page.waitForSelector("#ref-therapist");
    assert.equal(await page.$eval("#ref-therapist", el => el.value), profiles[0].split("/").pop());
    await checkIsolation();
    await page.goto(`${base}/referrals/privacy-policy`, { waitUntil: "networkidle2" });
    await checkIsolation();
    await page.click('main a[href="/referrals#refer-patient"]');
    await page.waitForSelector("#refer-patient");
    const missing = await page.goto(`${base}/referrals/therapists/not-a-clinician`, { waitUntil: "networkidle2" });
    assert.ok([200, 404].includes(missing.status())); // Next can stream a not-found boundary with 200.
    assert.ok(await page.$eval("main", el => el.textContent.includes("Referral page not found")));
    await checkIsolation();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile("artifacts/referrals/navigation-qa.json", JSON.stringify({ widths: [390, 1440], profiles: 5, browserBack: "passed", profileReturnLinks: "passed", therapistPreselection: "passed", privacyAndNotFound: "passed", escapedLinks: [], consoleErrors: errors }, null, 2));
  console.log("Referral navigation passed: five profiles, browser Back, in-area return links, therapist preselection, privacy, not-found, mobile and desktop.");
} finally { await browser.close(); }
