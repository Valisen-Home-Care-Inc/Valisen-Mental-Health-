import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const port = process.env.PORT || "3000";
const origin = process.env.BASE_ORIGIN || `http://localhost:${port}`;
const outputDir = path.resolve("artifacts/google-ads");
const clickId = "qa-google-click-123";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function preparePage(browser, confirmationStatuses = []) {
  const page = await browser.newPage();
  const googleEventRequests = [];
  const entryResponses = [];
  const confirmationRequests = [];
  let confirmationIndex = 0;
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  page.on("pageerror", (error) => {
    process.stderr.write(`Browser page error: ${error.message}\n`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      process.stderr.write(`Browser console error: ${message.text()}\n`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/google-ads/")) {
      entryResponses.push({
        path: url.pathname,
        status: response.status(),
        headers: response.headers(),
      });
    }
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/google-ads/events") {
      googleEventRequests.push({
        body: request.postData() || "",
        url: request.url(),
      });
      void request.respond({ status: 204, body: "" });
      return;
    }
    if (url.pathname === "/thank-you/confirm") {
      const status = confirmationStatuses[confirmationIndex] ?? 409;
      confirmationIndex += 1;
      confirmationRequests.push({ body: request.postData() || "", status });
      void request.respond({
        status,
        contentType: "application/json",
        body:
          status === 200
            ? '{"ok":true,"conversionId":"gac-0123456789abcdef0123456789abcdef"}'
            : '{"error":"not confirmed"}',
      });
      return;
    }
    if (
      url.hostname.endsWith("googletagmanager.com") ||
      url.hostname.endsWith("google-analytics.com") ||
      url.hostname === "challenges.cloudflare.com"
    ) {
      void request.abort();
      return;
    }
    void request.continue();
  });
  return {
    page,
    googleEventRequests,
    entryResponses,
    confirmationRequests,
  };
}

async function goto(page, url, settleMilliseconds = 900) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  assert(response, `No document response for ${url}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.race([
      Promise.all(
        Array.from(document.images)
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
          ),
      ),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  });
  await delay(settleMilliseconds);
  return response;
}

await mkdir(outputDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  negativeTraffic: {},
  signedJourney: {},
  thankYou: {},
};

try {
  process.stdout.write("Checking direct Google-like traffic isolation\n");
  const direct = await preparePage(browser);
  await goto(
    direct.page,
    `${origin}/lp/anxiety-therapy?utm_source=google&utm_medium=cpc&gclid=direct-google-click`,
  );
  assert(
    direct.googleEventRequests.length === 0,
    "A direct Google-like landing URL entered the isolated Google Ads CRM",
  );
  report.negativeTraffic.directGoogleLikeRequests =
    direct.googleEventRequests.length;
  await direct.page.close();

  process.stdout.write("Checking Meta traffic isolation\n");
  const meta = await preparePage(browser);
  await goto(
    meta.page,
    `${origin}/lp/anxiety-therapy?utm_source=meta&utm_medium=paid-social&utm_campaign=qa-meta`,
  );
  assert(
    meta.googleEventRequests.length === 0,
    "Meta traffic entered the isolated Google Ads CRM",
  );
  report.negativeTraffic.metaRequests = meta.googleEventRequests.length;
  await meta.page.close();

  process.stdout.write("Checking signed same-domain journey\n");
  const tracked = await preparePage(browser, [503, 503, 503, 200, 409]);
  await goto(
    tracked.page,
    `${origin}/google-ads/anxiety?gclid=${clickId}&utm_campaign=qa_anxiety&utm_content=creative_7&utm_term=must_not_survive`,
  );
  const landing = await tracked.page.evaluate(() => ({
    hash: window.location.hash,
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    clickStorage: sessionStorage.getItem(
      "valisen:first-touch-google-click:v1",
    ),
    journeyProof: sessionStorage.getItem(
      "valisen:google-ads-journey-proof:v1",
    ),
  }));
  assert(
    landing.pathname === "/lp/anxiety-therapy",
    `The entry route resolved to ${landing.pathname}`,
  );
  assert(landing.hash === "", "The signed entry fragment remained visible");
  assert(
    !landing.search.includes("gclid") && !landing.href.includes(clickId),
    "The raw click ID remained in the visible landing URL",
  );
  assert(
    landing.search.includes("utm_campaign=qa_anxiety") &&
      landing.search.includes("utm_content=creative_7"),
    "Safe campaign dimensions were not preserved",
  );
  assert(
    !landing.search.includes("utm_term"),
    "A search term survived the entry allowlist",
  );
  assert(
    landing.journeyProof?.startsWith("v1."),
    "No signed per-tab journey proof was stored; verify GOOGLE_ADS_CONVERSION_SECRET",
  );
  assert(
    landing.clickStorage?.includes(clickId),
    "The click ID was not retained in isolated per-tab storage",
  );
  assert(
    tracked.entryResponses.some(
      (response) =>
        response.status === 302 &&
        response.headers["x-robots-tag"]?.includes("noindex"),
    ),
    "The entry redirect was not a noindex 302",
  );
  assert(
    tracked.googleEventRequests.length > 0,
    "The signed journey did not flush an isolated event batch",
  );
  assert(
    tracked.googleEventRequests.every(
      (request) =>
        request.body.includes("journeyToken") &&
        !request.body.includes(clickId) &&
        !request.body.includes("must_not_survive"),
    ),
    "A Google Ads event request was unsigned or leaked a raw click/search value",
  );
  const landingImage = await tracked.page.screenshot({ fullPage: true });
  await writeFile(path.join(outputDir, "same-domain-ads-landing.png"), landingImage);

  const requestsBeforeNavigation = tracked.googleEventRequests.length;
  await tracked.page.click('a[href="/privacy-policy"]');
  await tracked.page.waitForFunction(
    () => window.location.pathname === "/privacy-policy",
  );
  await delay(900);
  assert(
    tracked.googleEventRequests.length > requestsBeforeNavigation,
    "The signed session did not continue across main-domain navigation",
  );
  report.signedJourney = {
    landingPath: landing.pathname,
    visibleSearch: landing.search,
    trackedBatches: tracked.googleEventRequests.length,
    continuedAcrossNavigation: true,
    screenshot: "same-domain-ads-landing.png",
  };

  process.stdout.write("Checking thank-you outage recovery and dedupe\n");
  const fakeReceipt = `v1.${"a".repeat(100)}.${"b".repeat(43)}`;
  await tracked.page.evaluate((target) => {
    window.location.href = target;
  }, `${origin}/thank-you#vmh_gc=${encodeURIComponent(fakeReceipt)}`);
  await tracked.page.waitForFunction(
    () => window.location.pathname === "/thank-you",
  );
  await tracked.page.waitForSelector("h1");
  assert(
    tracked.confirmationRequests.length === 3 &&
      tracked.confirmationRequests.every((request) => request.status === 503),
    "The temporary confirmation outage did not exercise all bounded retries",
  );
  const pending = await tracked.page.evaluate(() => ({
    conversions: (window.dataLayer || []).filter(
      (entry) => entry?.event === "google_ads_consultation_conversion",
    ).length,
    receipt: sessionStorage.getItem(
      "valisen:google-ads-conversion-proof:v1",
    ),
  }));
  assert(pending.conversions === 0, "A 503 confirmation emitted a conversion");
  assert(pending.receipt, "A 503 confirmation discarded the retry receipt");

  await tracked.page.reload({ waitUntil: "domcontentloaded" });
  await tracked.page.waitForFunction(
    () =>
      (window.dataLayer || []).filter(
        (entry) => entry?.event === "google_ads_consultation_conversion",
      ).length === 1,
  );
  const confirmed = await tracked.page.evaluate(() => {
    const entries = window.dataLayer || [];
    return {
      consentIndex: entries.findIndex(
        (entry) => entry?.[0] === "consent" && entry?.[1] === "default",
      ),
      contextIndex: entries.findIndex(
        (entry) => entry?.analytics_context === "google_ads_conversion_only",
      ),
      conversionIndex: entries.findIndex(
        (entry) => entry?.event === "google_ads_consultation_conversion",
      ),
      visibleSearch: window.location.search,
    };
  });
  assert(
    confirmed.consentIndex >= 0 &&
      confirmed.consentIndex < confirmed.contextIndex &&
    confirmed.contextIndex >= 0 &&
      confirmed.contextIndex < confirmed.conversionIndex,
    "Consent/context were not queued before the conversion",
  );
  assert(
    confirmed.visibleSearch.includes(`gclid=${clickId}`),
    "The confirmed conversion did not temporarily stage its click ID",
  );
  await tracked.page.evaluate(() =>
    window.dispatchEvent(new Event("valisen:google-ads-tags-initialized")),
  );
  assert(
    (await tracked.page.evaluate(() => window.location.search)) === "",
    "The temporarily staged click ID was not removed after tag initialization",
  );
  const thankYouImage = await tracked.page.screenshot({ fullPage: true });
  await writeFile(path.join(outputDir, "same-domain-thank-you.png"), thankYouImage);

  await tracked.page.reload({ waitUntil: "domcontentloaded" });
  await tracked.page.waitForSelector("h1");
  await delay(500);
  const refreshConversions = await tracked.page.evaluate(
    () =>
      (window.dataLayer || []).filter(
        (entry) => entry?.event === "google_ads_consultation_conversion",
      ).length,
  );
  assert(refreshConversions === 0, "A thank-you refresh duplicated conversion");
  report.thankYou = {
    temporaryFailureRetries: 3,
    conversionEventsAfterRecovery: 1,
    refreshConversionEvents: refreshConversions,
    contextBeforeConversion: true,
    screenshot: "same-domain-thank-you.png",
  };

  await tracked.page.evaluate((target) => {
    window.location.href = target;
  }, `${origin}/?utm_source=meta&utm_medium=paid-social`);
  await tracked.page.waitForFunction(() => window.location.pathname === "/");
  await delay(900);
  const resetProof = await tracked.page.evaluate(() =>
    sessionStorage.getItem("valisen:google-ads-journey-proof:v1"),
  );
  assert(resetProof === null, "A new Meta campaign did not clear the Ads proof");
  // The prior document may finish one final page-exit batch while unloading.
  // Snapshot after the Meta page settles, then prove a subsequent navigation
  // cannot restart or continue the isolated Google Ads tracker.
  const requestsAfterMetaLanding = tracked.googleEventRequests.length;
  await tracked.page.evaluate((target) => {
    window.location.href = target;
  }, `${origin}/privacy-policy`);
  await tracked.page.waitForFunction(
    () => window.location.pathname === "/privacy-policy",
  );
  await delay(900);
  assert(
    tracked.googleEventRequests.length === requestsAfterMetaLanding,
    "A new Meta campaign continued the prior Google Ads journey",
  );
  report.negativeTraffic.metaClearedPriorAdsSession = true;
  await tracked.page.close();

  process.stdout.write("Checking direct thank-you rejection\n");
  const directThankYou = await preparePage(browser);
  await goto(directThankYou.page, `${origin}/thank-you`, 100);
  await directThankYou.page.waitForFunction(
    () => window.location.pathname === "/consultation",
  );
  assert(
    directThankYou.googleEventRequests.length === 0,
    "A direct thank-you visit entered the Google Ads CRM",
  );
  report.negativeTraffic.directThankYouRedirected = true;
  await directThankYou.page.close();

  await writeFile(
    path.join(outputDir, "qa-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(
    `Same-domain Google Ads QA passed. Report: ${path.join(outputDir, "qa-report.json")}\n`,
  );
} finally {
  await browser.close();
}
